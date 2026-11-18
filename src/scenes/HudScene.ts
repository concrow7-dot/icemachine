import { currentMap } from '../config/maps';
import { loadHandFonts } from '../ui/handFonts';
import { UNCLE_HAND } from '../state/Handwriting';
import * as Phaser from 'phaser';
import { PATIENCE_WARNING_SECONDS, SERVING_PATIENCE, TOW_MESSAGE_SECONDS, TOW_TRUCK_PULSES } from '../config/tuning';
import { drawTowTruck } from '../ui/powerUpLogo';
import { musicFor } from '../audio/Music';
import { endEvening, getEvening, getStory, SceneKeys, pauseEvening } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatClock, formatMoney, formatMoneyChange } from '../util/format';
import { NeedleWobble } from '../ui/fuelGauge';
import { buildFuelDial, drawFuelNeedle, FUEL_DIAL, FUEL_DIAL_SPOT, type FuelDialParts } from '../ui/fuelDial';
import { debugOn } from '../util/debug';
import { addUnclePointer } from '../ui/unclePointer';
import { UncleBox } from '../ui/uncleBox';
import { markTutorialDone, skipUncle } from '../state/Tutorial';
import { count } from '../state/Counter';
import { dayText } from '../state/Residents';


// Issues #5 and #6: the clock and money display. This scene runs on top of
// every evening phase and is what keeps the clock moving in all of them.
/** SCREAM-392 (PO, November 17): the line under the tow truck when the tank runs dry. It was "Needed a tow home." (SCREAM-208). */
export const TOW_LINE = 'The truck ran out of gas, and you need a tow home.';

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
  /** SCREAM-390: the tow's price under the line, in Story (test hook). */
  towCost?: Phaser.GameObjects.Text;
  /** SCREAM-390: the tow truck that pops up with it (test hook). */
  towTruck?: Phaser.GameObjects.Container;
  /** SCREAM-22: the fuel gauge, shown while driving and at the pump. */
  private fuelGauge!: Phaser.GameObjects.Container;
  private dial!: FuelDialParts;
  /** SCREAM-121: where the needle points (0 = E, 1 = F); tests read it. */
  fuelNeedle = 1;
  private readonly wobble = new NeedleWobble();
  /** SCREAM-169: the uncle's lines, during the guided tutorial only. */
  uncleBox?: UncleBox;

  constructor() {
    super(SceneKeys.Hud);
  }

  /** SCREAM-378: the uncle's box is written in his handwriting. */
  preload(): void {
    loadHandFonts(this, [UNCLE_HAND]);
  }

  create(): void {
    this.evening = getEvening(this);
    const story = getStory(this);
    // SCREAM-18 (PO, November 2): the bike goal is shown on the end-of-day screen only, not up here.
    // SCREAM-221 / SCREAM-232 (PO, November 10): just the weekday ("leave it at the day of the week"); Story starts on a Monday.
    // SCREAM-327 (PO, November 14): the count is back beside it: "Tuesday Day 2/10".
    this.dayLabel = story ? `   ${dayText(story.day, story.days)}` : '';
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
    // SCREAM-173 (PO): the uncle's line about the gauge outlines it (SCREAM-238: at the bottom left).
    if (this.evening.tutorial) {
      const { radius } = FUEL_DIAL;
      addUnclePointer(this, this.evening.tutorial, { gauge: () => new Phaser.Geom.Rectangle(this.fuelGauge.x - radius - 4, this.fuelGauge.y - radius - 6, radius * 2 + 8, radius + 16) });
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
    // SCREAM-395: XP earned shows like money does, a line lower and in its own colour.
    const onXp = (points: number, _xp: number, label: string) => {
      if (points > 0) this.showXpChange(points, label);
    };
    this.evening.on(EveningEvents.XpChanged, onXp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.evening.off(EveningEvents.XpChanged, onXp));
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
   * tipped sale ends with a hint, SCREAM-103), Shift+7 (the next paid sale ends with the customer's schedule line, SCREAM-247), Shift+8 (...with a line about a neighbour, SCREAM-248), Shift+- (+50 XP in Story, SCREAM-395), Shift+9 (+$50 cash, not profit, SCREAM-324), Shift+0 (a full gas tank, SCREAM-337) and Shift+4 (serve now) still work for testing, but aren't shown.
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
      // SCREAM-363 (PO, November 16): Shift+F freezes the game exactly as it looks, for screenshots; again to carry on.
      if (event.shiftKey && event.code === 'KeyF' && !event.repeat) {
        this.toggleFreeze();
        return;
      }
      if (this.frozen) return; // frozen: no other key does anything
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
      // SCREAM-200: X skips the uncle (S until SCREAM-217's change, PO November 9) (the truck screen handles it itself while he's talking there).
      if (!event.shiftKey && !event.repeat && (event.key === 'x' || event.key === 'X') && this.evening.tutorial?.canSkip) {
        if (!this.onIntro()) skipUncle(this.evening.tutorial);
      }
      if (!event.shiftKey) return;
      if (event.code === 'Digit1') this.evening.changeMoney(450, 'Sale');
      if (event.code === 'Digit2') this.evening.changeMoney(-200, 'Damage');
      if (event.code === 'Digit3') this.evening.endNow();
      if (event.code === 'Digit4') this.serveNow();
      if (event.code === 'Digit5') this.previewLoading();
      if (event.code === 'Digit6') this.evening.forceHint = true; // SCREAM-103: the next tipped sale gives a hint
      if (event.code === 'Digit7') this.evening.forceScheduleLine = true; // SCREAM-247: the next paid sale ends with the customer's schedule line
      if (event.code === 'Digit8') this.evening.forceNeighbourLine = true; // SCREAM-248: the next paid sale ends with a line about a neighbour
      if (event.code === 'Digit9') this.evening.debugAddCash(5000); // SCREAM-324: +$50 on any evening screen, not counted as profit
      if (event.code === 'Digit0') this.evening.debugFillGas(); // SCREAM-337: a full tank on any evening screen, free
      if (event.code === 'Minus') this.evening.debugAddXp(50); // SCREAM-395: +50 XP in Story (engineering's addition, for testing the XP tree)
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

  /**
   * The credits or the uncle's truck scene are on, or one of them is still starting. SCREAM-235: the truck
   * scene loads his picture on a first run, and for those frames neither scene was "active", so the small
   * box's 6 s timer could move him on to his second line before the truck scene showed his first.
   */
  private onIntro(): boolean {
    return [SceneKeys.UncleIntro, SceneKeys.TutorialCrawl].some((key) => {
      const status = this.scene.getStatus(key);
      return this.scene.isActive(key) || (status >= Phaser.Scenes.INIT && status <= Phaser.Scenes.CREATING);
    });
  }

  /** SCREAM-88: keeps the debug hint just right of the clock (and the day, in Story), never on top of it. */
  private placeDebugText(): void {
    this.debugText?.setX(this.clockText.x + this.clockText.width + 24);
  }

  /**
   * SCREAM-363 (PO, November 16: "pause mid game showing the screen that I'm seeing ... It should be
   * Shift + something. It should be hidden"): the scenes Shift+F froze (null when not frozen). Every
   * evening scene but this one is paused, this one stops ticking, and the sound stops; nothing is drawn
   * to say so (it would be in the screenshot). A debug key: not in the key lists.
   */
  frozen: string[] | null = null;

  toggleFreeze(): void {
    if (this.frozen) {
      for (const key of this.frozen) this.scene.resume(key);
      this.frozen = null;
      this.sound.resumeAll();
      return;
    }
    this.frozen = this.scene.manager
      .getScenes(true)
      .map((s) => s.scene.key)
      .filter((key) => key !== this.scene.key && !this.scene.isPaused(key));
    for (const key of this.frozen) this.scene.pause(key);
    this.sound.pauseAll();
  }

  update(_time: number, delta: number): void {
    if (this.frozen) return; // SCREAM-363: the clock and everything else wait
    this.uncleBox?.place(this.onIntro() ? 'intro' : this.scene.isActive(SceneKeys.Cooler) ? 'cooler' : 'other');
    // SCREAM-177: the opening credits fill the screen, so the top bar waits until they're over.
    this.cameras.main.setVisible(!this.scene.isActive(SceneKeys.TutorialCrawl));
    this.evening.tick(delta);
    this.keepNeighbourhoodGoing(delta);
    this.keepMusicGoing();
    // SCREAM-237 (PO, November 15: "Street instead"): in Story the street the truck is on sits after the day
    // (the neighbourhood's name sat there, SCREAM-145).
    this.clockText.setText(formatClock(this.evening.clockMinutes) + this.dayLabel + (this.dayLabel ? `  ${this.evening.street}` : ''));
    this.placeDebugText();
    const sale = this.evening.sale;
    const warn =
      !!sale && sale.phase !== 'over' && sale.patienceLeftSeconds(this.evening.nowMs) <= PATIENCE_WARNING_SECONDS;
    this.patienceWarning.setVisible(warn).setX(this.leftOfMoney() - 16);
    this.drawFuel(delta);
    this.soldOutText.setX(this.leftOfMoney() - 6);
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
      radius: this.evening.spec.musicRadius,
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

  /** SCREAM-121, SCREAM-238: the gas dial, bottom left (drawn by ui/fuelDial, SCREAM-276). */
  private buildFuelDial(): void {
    this.dial = buildFuelDial(this, FUEL_DIAL_SPOT.x, FUEL_DIAL_SPOT.driveY);
    this.fuelGauge = this.dial.container;
  }

  /**
   * SCREAM-22 / SCREAM-121: the gauge, while driving or at the pump. The needle is steady
   * above a quarter tank and jumps around below it (NeedleWobble); E turns red when low and
   * the plate's edge flashes red when empty.
   */
  private drawFuel(delta = 16): void {
    // SCREAM-276 (PO, November 12): inside the truck too, in Story: "Same as the roads dial. Except it
    // doesn't wobble under 1/4 full like on the road. Similar spot in the bottom left corner."
    const inHub = !!getStory(this) && this.scene.isActive(SceneKeys.Truck);
    const show = this.scene.isActive(SceneKeys.Drive) || this.scene.isActive(SceneKeys.Pump) || inHub;
    this.fuelGauge.setVisible(show);
    if (!show) return;
    this.fuelGauge.setY(this.scene.isActive(SceneKeys.Pump) ? FUEL_DIAL_SPOT.pumpY : inHub ? FUEL_DIAL_SPOT.hubY : FUEL_DIAL_SPOT.driveY);
    const fuel = this.evening.fuel;
    this.fuelNeedle = inHub ? fuel : this.wobble.update(fuel, this.time.now, delta);
    // SCREAM-208: faster and bolder while the tow message shows.
    const flash = fuel <= 0 && Math.floor(this.time.now / (this.towing ? 200 : 300)) % 2 === 0;
    this.gaugeRed = flash;
    drawFuelNeedle(this.dial, fuel, this.fuelNeedle, flash, this.towing);
  }

  private refresh(): void {
    this.clockText.setText(formatClock(this.evening.clockMinutes) + this.dayLabel);
    const cents = this.evening.moneyCents;
    this.moneyText.setText(`Cash ${formatMoney(cents)}`);
    this.moneyText.setColor(cents < 0 ? '#ff9c9c' : '#c8f7c5');
    this.soldOutText
      .setVisible(this.evening.isSoldOut)
      .setX(this.leftOfMoney() - 6);
  }

  /** Where SOLD OUT and the "!" line up: just left of the money (SCREAM-238: the gauge no longer sits there). */
  private leftOfMoney(): number {
    return this.moneyText.x - this.moneyText.width - 14;
  }

  /** SCREAM-208: stops the truck, shows "Needed a tow home." (SCREAM-390: with its price in Story) (the gauge flashes meanwhile), then `then`. */
  private towHome(then: () => void): void {
    this.towing = true;
    (this.scene.get(SceneKeys.Drive) as unknown as { stopForTow?: () => void }).stopForTow?.();
    const { width, height } = this.scale;
    // SCREAM-390 (PO, November 17): a tow truck pops up over the darkened road and pulses, like the
    // Temporary Gas Can's pop-up, and stays until the end-of-day screen; the line sits under it.
    this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0, 0).setDepth(900);
    this.towTruck = this.add.container(width / 2, height / 2 - 40).setDepth(901);
    const g = this.add.graphics();
    drawTowTruck(g, 200);
    this.towTruck.add(g);
    this.towTruck.setScale(0);
    this.tweens.chain({
      targets: this.towTruck,
      tweens: [
        { scale: 1, duration: 180, ease: 'Back.easeOut' },
        { scale: 1.18, duration: 190, ease: 'Sine.easeInOut', yoyo: true, repeat: TOW_TRUCK_PULSES - 1 },
      ],
    });
    this.towText = this.add
      .text(width / 2, height / 2 + 105, TOW_LINE, {
        fontFamily: 'monospace',
        fontSize: '24px', // SCREAM-392: the longer line (it was 30px)
        color: '#ffffff',
        backgroundColor: '#14161c',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(901);
    // SCREAM-390 (PO, November 17: "The screen should show that the player is paying $25"): the tow's
    // price, big and red under the line, when there is one (Story).
    if (this.evening.towCents > 0) {
      this.towCost = this.add
        .text(width / 2, height / 2 + 168, `-${formatMoney(this.evening.towCents)}`, {
          fontFamily: 'monospace',
          fontSize: '44px',
          fontStyle: 'bold',
          color: '#ff6b6b',
          backgroundColor: '#14161c',
          padding: { x: 18, y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(901);
    }
    this.time.delayedCall(TOW_MESSAGE_SECONDS * 1000, then);
  }

  /** SCREAM-395: the last XP pop-up's words (test hook). */
  lastXpPopup = '';

  /** SCREAM-395: shows "+5 XP Sale" under the money pop-ups, then fades it out. */
  private showXpChange(points: number, label: string): void {
    const { width } = this.scale;
    this.lastXpPopup = `+${points} XP ${label}`;
    const popup = this.add
      .text(width - 16, 76, this.lastXpPopup, { fontFamily: 'monospace', fontSize: '16px', color: '#d9c8ff', stroke: '#1b1030', strokeThickness: 3 })
      .setOrigin(1, 0);
    this.tweens.add({ targets: popup, y: 104, alpha: 0, duration: 1600, ease: 'Cubic.easeOut', onComplete: () => popup.destroy() });
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
