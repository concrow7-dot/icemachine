import { currentMap } from '../config/maps';
import * as Phaser from 'phaser';
import { FUEL_LOW, MUSIC_RING_RADIUS, PATIENCE_WARNING_SECONDS, SERVING_PATIENCE, TOW_MESSAGE_SECONDS } from '../config/tuning';
import { musicFor } from '../audio/Music';
import { endEvening, getEvening, getStory, SceneKeys, pauseEvening } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatClock, formatMoney, formatMoneyChange } from '../util/format';
import { NeedleWobble } from '../ui/fuelGauge';
import { debugOn } from '../util/debug';
import { addUnclePointer } from '../ui/unclePointer';
import { UncleBox } from '../ui/uncleBox';
import { markTutorialDone, skipUncle } from '../state/Tutorial';
import { count } from '../state/Counter';

/**
 * SCREAM-121: the old-school dial. The needle's pivot sits just under the top bar, in the
 * middle; the face is a fan from E (left) to F (right), angles in degrees clockwise from
 * pointing right (so 270 is straight up).
 */
const FUEL_DIAL = { x: 585, pivotY: 46, radius: 46, from: 200, to: 340 };
const DIAL_FACE = 0x4b4440;
const DIAL_EDGE = 0x241f1c;
const DIAL_INK = 0xf4ead2;
const DIAL_INK_CSS = '#f4ead2';
const DIAL_LOW_CSS = '#ff6b5e';

// Issues #5 and #6: the clock and money display. This scene runs on top of
// every evening phase and is what keeps the clock moving in all of them.
export class HudScene extends Phaser.Scene {
  private evening!: EveningState;
  /** SCREAM-19: "  Day 1/3" beside the clock in Story mode; empty in Quick play. */
  private dayLabel = '';
  private debugText?: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private soldOutText!: Phaser.GameObjects.Text;
  private patienceWarning!: Phaser.GameObjects.Container;
  /** SCREAM-208: true from running out of gas until the end-of-evening screen; the message shown meanwhile. */
  towing = false;
  /** True on the frames the gauge's edge is red (it flashes when the tank is empty); a test hook. */
  gaugeRed = false;
  towText?: Phaser.GameObjects.Text;
  /** SCREAM-22: the fuel gauge, shown while driving and at the pump. */
  private fuelGauge!: Phaser.GameObjects.Container;
  private dialFace!: Phaser.GameObjects.Graphics;
  private needle!: Phaser.GameObjects.Graphics;
  private emptyLabel!: Phaser.GameObjects.Text;
  /** SCREAM-121: where the needle points (0 = E, 1 = F); tests read it. */
  fuelNeedle = 1;
  private readonly wobble = new NeedleWobble();
  /** SCREAM-169: the uncle's lines, during the guided tutorial only. */
  uncleBox?: UncleBox;

  constructor() {
    super(SceneKeys.Hud);
  }

  create(): void {
    this.evening = getEvening(this);
    const story = getStory(this);
    // SCREAM-18 (PO, November 2): the bike goal is shown on the end-of-day screen only, not up here.
    this.dayLabel = story ? `   Day ${story.day}/${story.days}` : '';
    const { width } = this.scale;

    this.add.rectangle(0, 0, width, 44, 0x000000, 0.45).setOrigin(0, 0);

    this.clockText = this.add.text(16, 10, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffe8a3',
    });

    this.moneyText = this.add
      .text(width - 16, 10, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c8f7c5',
      })
      .setOrigin(1, 0);

    // Issue #12: on the road with an empty cooler, no customers come.
    this.soldOutText = this.add
      .text(0, 12, 'SOLD OUT', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#c2185b',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0)
      .setVisible(false);

    // PO, PR #37: with 5 seconds of the customer's minute left, a pulsing "!" in the top bar.
    const warnCircle = this.add.circle(0, 0, 15, 0xff4f9a).setStrokeStyle(2, 0xffffff);
    const warnMark = this.add
      .text(0, 0, '!', { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.patienceWarning = this.add.container(0, 22, [warnCircle, warnMark]).setVisible(false);
    this.tweens.add({ targets: this.patienceWarning, scale: 1.3, duration: 300, yoyo: true, repeat: -1 });

    this.buildFuelDial();

    this.refresh();
    this.addDebugKeys();
    this.uncleBox = this.evening.tutorial ? new UncleBox(this, this.evening.tutorial) : undefined;
    // SCREAM-173 (PO): "Keep an eye on the gauge up top" outlines the fuel gauge.
    if (this.evening.tutorial) {
      const { x, pivotY, radius } = FUEL_DIAL;
      addUnclePointer(this, this.evening.tutorial, { gauge: () => new Phaser.Geom.Rectangle(x - radius - 8, 2, radius * 2 + 16, pivotY + 4) });
    }

    const onMoney = (change: number, _cash: number, label: string, popup: boolean) => {
      this.refresh();
      if (popup) this.showMoneyChange(change, label);
    };
    const onEnded = () => {
      // SCREAM-208 (PO, November 8): out of gas on the road, the truck stops, the gauge flashes and
      // "Needed a tow home." shows for a moment first, so it's clear why the evening ended.
      if (this.evening.endedOutOfGas && this.scene.isActive(SceneKeys.Drive) && !this.towing) {
        this.towHome(onEnded);
        return;
      }
      // SCREAM-169: a whole evening with the uncle counts as done; next time he can be skipped.
      if (this.evening.tutorial) markTutorialDone();
      // SCREAM-201: anonymous counts of evenings played and tutorials finished.
      count('evening-ended', this.evening.tutorial ? 'tutorial' : story ? 'story' : this.evening.mapId === 'tutorial' ? 'tutorial-alone' : 'quick');
      if (this.evening.tutorial && !this.evening.tutorial.skipped) count('tutorial-finished', 'tutorial');
      endEvening(this);
    };

    const onStock = () => this.refresh();
    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.evening.on(EveningEvents.CoolerChanged, onStock);
    this.evening.once(EveningEvents.Ended, onEnded);

    // Stop listening when this scene closes, so old evenings can't affect new ones.
    // SCREAM-118: off the road the HUD plays the music, so it stops while paused and when the evening ends.
    const stopMusic = () => {
      if (!this.scene.isActive(SceneKeys.Drive)) musicFor(this).stop();
    };
    this.events.on(Phaser.Scenes.Events.PAUSE, stopMusic);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, stopMusic);
      musicFor(this).stop();
      this.evening.off(EveningEvents.MoneyChanged, onMoney);
      this.evening.off(EveningEvents.CoolerChanged, onStock);
      this.evening.off(EveningEvents.Ended, onEnded);
    });
  }

  /**
   * TEMPORARY debug keys, available on every evening screen.
   * SCREAM-88 (PO, November 1): only "Shift+3: end evening" is shown, just right
   * of the clock and day, and since SCREAM-220 only with ?debug in the address. Shift+1 (+$4.50), Shift+2 (-$2.00), Shift+5 (show the loading screen, SCREAM-75), Shift+6 (the next
   * tipped sale ends with a hint, SCREAM-103) and Shift+4 (serve now) still work for testing, but aren't shown.
   */
  private addDebugKeys(): void {
    // SCREAM-220 (PO, November 9): players don't see the debug hint; add ?debug to the address to show it.
    if (debugOn()) this.debugText = this.add
      .text(0, 22, 'DEBUG Shift+3: End Evening', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d9a0ff',
      })
      .setOrigin(0, 0.5);
    this.placeDebugText();

    // Shift + number, so the plain number keys are free for typing prices (PO, doc 08 Q30).
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // Esc pauses the evening from any screen (#19). The HUD runs during every evening screen, so it listens here.
      if (event.key === 'Escape') {
        pauseEvening(this);
        return;
      }
      // SCREAM-118: M mutes and N skips the song off the road too (the driving view handles them on the road).
      if (!this.scene.isActive(SceneKeys.Drive) && !event.shiftKey) {
        if (event.key === 'm' || event.key === 'M') musicFor(this).toggleMute();
        if (event.key === 'n' || event.key === 'N') musicFor(this).skip();
      }
      // SCREAM-200: S skips the uncle (the truck screen handles it itself while he's talking there).
      if (!event.shiftKey && (event.key === 's' || event.key === 'S') && this.evening.tutorial?.canSkip) {
        if (!this.scene.isActive(SceneKeys.UncleIntro) && !this.scene.isActive(SceneKeys.TutorialCrawl)) skipUncle(this.evening.tutorial);
      }
      if (!event.shiftKey) return;
      if (event.code === 'Digit1') this.evening.changeMoney(450, 'Sale');
      if (event.code === 'Digit2') this.evening.changeMoney(-200, 'Damage');
      if (event.code === 'Digit3') this.evening.endNow();
      if (event.code === 'Digit4') this.serveNow();
      if (event.code === 'Digit5') this.previewLoading();
      if (event.code === 'Digit6') this.evening.forceHint = true; // SCREAM-103: the next tipped sale gives a hint
    });
  }

  /** Debug (SCREAM-75): shows the loading screen for 5 seconds, since real loads are usually too quick to see. */
  private previewLoading(): void {
    if (this.scene.isActive(SceneKeys.Loading)) return;
    this.scene.launch(SceneKeys.Loading);
    this.time.delayedCall(5000, () => this.scene.stop(SceneKeys.Loading));
  }

  /** Debug: skip the drive and start a sale right away, with a waiting customer if there is one. */
  private serveNow(): void {
    if (this.evening.sale || !this.evening.isPrepLocked) return;
    const customer = this.evening.residents.waiting[0];
    for (const key of [SceneKeys.Truck, SceneKeys.Cooler, SceneKeys.Drive]) {
      if (this.scene.isActive(key)) this.scene.stop(key);
    }
    this.evening.startSale(customer);
    this.scene.launch(SceneKeys.Sales);
    this.scene.bringToTop();
  }

  /** SCREAM-88: keeps the debug hint just right of the clock (and the day, in Story), never on top of it. */
  private placeDebugText(): void {
    this.debugText?.setX(this.clockText.x + this.clockText.width + 24);
  }

  update(_time: number, delta: number): void {
    this.uncleBox?.place(
      this.scene.isActive(SceneKeys.UncleIntro) || this.scene.isActive(SceneKeys.TutorialCrawl) ? 'intro' : this.scene.isActive(SceneKeys.Cooler) ? 'cooler' : 'other',
    );
    // SCREAM-177: the opening credits fill the screen, so the top bar waits until they're over.
    this.cameras.main.setVisible(!this.scene.isActive(SceneKeys.TutorialCrawl));
    this.evening.tick(delta);
    this.keepNeighbourhoodGoing(delta);
    this.keepMusicGoing();
    // SCREAM-145: in Story the neighbourhood's name sits after the day, since the truck can change map.
    this.clockText.setText(formatClock(this.evening.clockMinutes) + this.dayLabel + (this.dayLabel ? `  ${currentMap().name}` : ''));
    this.placeDebugText();
    const sale = this.evening.sale;
    const warn =
      !!sale && sale.phase !== 'over' && sale.patienceLeftSeconds(this.evening.nowMs) <= PATIENCE_WARNING_SECONDS;
    this.patienceWarning.setVisible(warn).setX(this.moneyText.x - this.moneyText.width - 30);
    this.drawFuel(delta);
  }

  /**
   * SCREAM-114 (PO, November 2): the neighbourhood keeps going while you're off the road
   * (the window, the cooler, the pump, the truck), so customers waiting at the curb can give
   * up while you serve someone. On the road, the driving view does this itself; paused, the
   * HUD is paused too.
   * SCREAM-118 (PO, November 2): the music keeps playing off the road, and while you serve
   * someone, people in the ring still hear it and may come out, and those already waiting
   * wait twice as long (SERVING_PATIENCE). Elsewhere off the road (the hub, the pump), nobody
   * new comes out, as before.
   */
  private keepNeighbourhoodGoing(deltaMs: number): void {
    if (this.scene.isActive(SceneKeys.Drive) || !this.evening.isClockRunning || this.evening.isOver) return;
    const truck = this.evening.truck;
    const sale = this.evening.sale;
    const serving = !!sale && sale.phase !== 'over';
    this.evening.residents.update(Math.min(deltaMs, 100) / 1000, {
      x: truck.x,
      y: truck.y,
      radius: MUSIC_RING_RADIUS,
      open: serving && this.evening.acceptingCustomers,
      patience: serving ? SERVING_PATIENCE : 1,
    });
  }

  /**
   * SCREAM-118: the truck's music off the road. It plays once the truck has been out on the
   * road this evening (not while stocking up before the first drive), and the driving view
   * plays it on the road. The song carries on from where it was.
   */
  private keepMusicGoing(): void {
    if (this.scene.isActive(SceneKeys.Drive)) return;
    const music = musicFor(this);
    if (this.evening.isPrepLocked && this.evening.isClockRunning && !this.evening.isOver) {
      music.start();
      music.tick();
    } else {
      music.stop();
    }
  }

  /**
   * SCREAM-121 (PO, November 2): an old car's gas gauge, a dark fan with E, 1/2 and F and a
   * pale needle (the PO's reference photo), in the middle of the top bar.
   */
  private buildFuelDial(): void {
    const { radius, from, to } = FUEL_DIAL;
    const rad = Phaser.Math.DegToRad;
    const at = (deg: number, r: number) => ({ x: Math.cos(rad(deg)) * r, y: Math.sin(rad(deg)) * r });
    this.dialFace = this.add.graphics();
    const face = this.dialFace;
    face.fillStyle(DIAL_FACE, 1).slice(0, 0, radius, rad(from), rad(to), false).fillPath();
    // A lighter rim inside the dark edge, like the pressed metal plate.
    face.lineStyle(2, 0x6e645d, 1).beginPath().arc(0, 0, radius - 3, rad(from + 2), rad(to - 2), false).strokePath();
    // "E . 1/2 . F" round the top, like the reference photo: dots at a quarter and three quarters.
    const labelR = radius - 13;
    face.fillStyle(DIAL_INK, 1);
    for (const f of [0.25, 0.75]) {
      const p = at(from + (to - from) * f, labelR);
      face.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    }
    const label = (deg: number, text: string, size: number, font = 'monospace') => {
      const p = at(deg, labelR);
      return this.add
        .text(p.x, p.y, text, { fontFamily: font, fontSize: `${size}px`, fontStyle: 'bold', color: DIAL_INK_CSS })
        .setOrigin(0.5);
    };
    this.emptyLabel = label(from + 10, 'E', 16);
    const half = label(270, '½', 15, 'Arial, sans-serif');
    const full = label(to - 10, 'F', 16);
    this.needle = this.add.graphics();
    this.fuelGauge = this.add.container(FUEL_DIAL.x, FUEL_DIAL.pivotY, [face, this.emptyLabel, half, full, this.needle]);
  }

  /**
   * SCREAM-22 / SCREAM-121: the gauge, while driving or at the pump. The needle is steady
   * above a quarter tank and jumps around below it (NeedleWobble); E turns red when low and
   * the plate's edge flashes red when empty.
   */
  private drawFuel(delta = 16): void {
    const show = this.scene.isActive(SceneKeys.Drive) || this.scene.isActive(SceneKeys.Pump);
    this.fuelGauge.setVisible(show);
    if (!show) return;
    const fuel = this.evening.fuel;
    this.fuelNeedle = this.wobble.update(fuel, this.time.now, delta);
    const { radius, from, to } = FUEL_DIAL;
    const rad = Phaser.Math.DegToRad;
    // SCREAM-208: faster and bolder while the tow message shows.
    const flash = fuel <= 0 && Math.floor(this.time.now / (this.towing ? 200 : 300)) % 2 === 0;
    this.gaugeRed = flash;
    this.emptyLabel.setColor(fuel <= FUEL_LOW ? DIAL_LOW_CSS : DIAL_INK_CSS);
    const angle = rad(from + (to - from) * this.fuelNeedle);
    const tipX = Math.cos(angle) * (radius - 6);
    const tipY = Math.sin(angle) * (radius - 6);
    const g = this.needle.clear();
    g.lineStyle(flash && this.towing ? 4 : 2, flash ? 0xff5252 : DIAL_EDGE, 1).beginPath().arc(0, 0, radius, rad(from), rad(to), false);
    g.lineTo(0, 0).closePath().strokePath();
    g.lineStyle(5, DIAL_EDGE, 1).lineBetween(0, 0, tipX, tipY);
    g.lineStyle(3, DIAL_INK, 1).lineBetween(0, 0, tipX, tipY);
    g.fillStyle(DIAL_EDGE, 1).fillCircle(0, 0, 6);
    g.fillStyle(DIAL_INK, 1).fillCircle(0, 0, 4);
  }

  private refresh(): void {
    this.clockText.setText(formatClock(this.evening.clockMinutes) + this.dayLabel);
    const cents = this.evening.moneyCents;
    this.moneyText.setText(`Cash ${formatMoney(cents)}`);
    this.moneyText.setColor(cents < 0 ? '#ff9c9c' : '#c8f7c5');
    this.soldOutText
      .setVisible(this.evening.isSoldOut)
      .setX(this.moneyText.x - this.moneyText.width - 20);
  }

  /** SCREAM-208: stops the truck, shows "Needed a tow home." (the gauge flashes meanwhile), then `then`. */
  private towHome(then: () => void): void {
    this.towing = true;
    (this.scene.get(SceneKeys.Drive) as unknown as { stopForTow?: () => void }).stopForTow?.();
    const { width, height } = this.scale;
    this.towText = this.add
      .text(width / 2, height / 2, 'Needed a tow home.', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#ffffff',
        backgroundColor: '#14161c',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);
    this.time.delayedCall(TOW_MESSAGE_SECONDS * 1000, then);
  }

  /** Shows "+$4.50 Sale" or "-$2.00 Damage" under the total, then fades it out. */
  private showMoneyChange(cents: number, label: string): void {
    const { width } = this.scale;
    const popup = this.add
      .text(width - 16, 52, `${formatMoneyChange(cents)} ${label}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: cents >= 0 ? '#c8f7c5' : '#ff9c9c',
      })
      .setOrigin(1, 0);

    this.tweens.add({
      targets: popup,
      y: 82,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
