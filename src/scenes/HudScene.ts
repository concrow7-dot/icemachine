import * as Phaser from 'phaser';
import { FUEL_LOW, PATIENCE_WARNING_SECONDS } from '../config/tuning';
import { endEvening, getEvening, getStory, SceneKeys, pauseEvening } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatClock, formatMoney, formatMoneyChange } from '../util/format';

/** SCREAM-22: where the fuel gauge's bar starts, and its size. */
const FUEL_GAUGE = { x: 530, w: 110, h: 14 };

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
  /** SCREAM-22: the fuel gauge, shown while driving and at the pump. */
  private fuelGauge!: Phaser.GameObjects.Container;
  private fuelBar!: Phaser.GameObjects.Graphics;

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

    // SCREAM-22: E [====    ] F, in the middle of the top bar.
    this.fuelBar = this.add.graphics();
    const gaugeText = (x: number, text: string) =>
      this.add.text(x, 0, text, { fontFamily: 'monospace', fontSize: '16px', color: '#ffe8a3' }).setOrigin(0.5);
    this.fuelGauge = this.add.container(FUEL_GAUGE.x, 22, [gaugeText(-10, 'E'), this.fuelBar, gaugeText(FUEL_GAUGE.w + 10, 'F')]);

    this.refresh();
    this.addDebugKeys();

    const onMoney = (change: number, _cash: number, label: string, popup: boolean) => {
      this.refresh();
      if (popup) this.showMoneyChange(change, label);
    };
    const onEnded = () => endEvening(this);

    const onStock = () => this.refresh();
    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.evening.on(EveningEvents.CoolerChanged, onStock);
    this.evening.once(EveningEvents.Ended, onEnded);

    // Stop listening when this scene closes, so old evenings can't affect new ones.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.MoneyChanged, onMoney);
      this.evening.off(EveningEvents.CoolerChanged, onStock);
      this.evening.off(EveningEvents.Ended, onEnded);
    });
  }

  /**
   * TEMPORARY debug keys, available on every evening screen.
   * SCREAM-88 (PO, November 1): only "Shift+3: end evening" is shown, just right
   * of the clock and day. Shift+1 (+$4.50), Shift+2 (-$2.00) and Shift+4 (serve
   * now) still work for testing, but aren't shown.
   */
  private addDebugKeys(): void {
    this.debugText = this.add
      .text(0, 22, 'DEBUG Shift+3: end evening', {
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
      if (!event.shiftKey) return;
      if (event.code === 'Digit1') this.evening.changeMoney(450, 'Sale');
      if (event.code === 'Digit2') this.evening.changeMoney(-200, 'Damage');
      if (event.code === 'Digit3') this.evening.endNow();
      if (event.code === 'Digit4') this.serveNow();
    });
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
    this.evening.tick(delta);
    this.clockText.setText(formatClock(this.evening.clockMinutes) + this.dayLabel);
    this.placeDebugText();
    const sale = this.evening.sale;
    const warn =
      !!sale && sale.phase !== 'over' && sale.patienceLeftSeconds(this.evening.nowMs) <= PATIENCE_WARNING_SECONDS;
    this.patienceWarning.setVisible(warn).setX(this.moneyText.x - this.moneyText.width - 30);
    this.drawFuel();
  }

  /** SCREAM-22: the gauge, while driving or at the pump. Red when low; flashing when empty. */
  private drawFuel(): void {
    const show = this.scene.isActive(SceneKeys.Drive) || this.scene.isActive(SceneKeys.Pump);
    this.fuelGauge.setVisible(show);
    if (!show) return;
    const fuel = this.evening.fuel;
    const { w, h } = FUEL_GAUGE;
    const g = this.fuelBar.clear();
    g.fillStyle(0x000000, 0.5).fillRect(0, -h / 2, w, h);
    g.fillStyle(fuel <= FUEL_LOW ? 0xff5252 : 0xf5a623, 1).fillRect(0, -h / 2, w * fuel, h);
    g.lineStyle(1, 0xffe8a3, 0.8);
    for (let i = 1; i < 4; i++) g.lineBetween((w * i) / 4, -h / 2, (w * i) / 4, -h / 2 + 4);
    const flash = fuel <= 0 && Math.floor(this.time.now / 300) % 2 === 0;
    g.lineStyle(2, flash ? 0xff5252 : 0xffe8a3, 1).strokeRect(0, -h / 2, w, h);
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
