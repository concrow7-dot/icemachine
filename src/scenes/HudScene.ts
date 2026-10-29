import * as Phaser from 'phaser';
import { PATIENCE_WARNING_SECONDS } from '../config/tuning';
import { endEvening, getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatClock, formatMoney, formatMoneyChange } from '../util/format';

// Issues #5 and #6: the clock and money display. This scene runs on top of
// every evening phase and is what keeps the clock moving in all of them.
export class HudScene extends Phaser.Scene {
  private evening!: EveningState;
  private clockText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private soldOutText!: Phaser.GameObjects.Text;
  private patienceWarning!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Hud);
  }

  create(): void {
    this.evening = getEvening(this);
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

    this.refresh();
    this.addDebugKeys();

    const onMoney = (change: number, _cash: number, label: string, popup: boolean) => {
      this.refresh();
      if (popup) this.showMoneyChange(change, label);
    };
    const onEnded = () => endEvening(this);

    const onStock = () => this.refresh();
    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.evening.on(EveningEvents.RoadCustomerChanged, onStock);
    this.evening.once(EveningEvents.Ended, onEnded);

    // Stop listening when this scene closes, so old evenings can't affect new ones.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.MoneyChanged, onMoney);
      this.evening.off(EveningEvents.RoadCustomerChanged, onStock);
      this.evening.off(EveningEvents.Ended, onEnded);
    });
  }

  /**
   * TEMPORARY debug keys, available on every evening screen. Remove once real
   * sales (#15), damage (#10) and customers (#12) exist.
   */
  private addDebugKeys(): void {
    this.add
      .text(140, 22, 'DEBUG (Shift+)  1:+$4.50  2:-$2.00  3:end evening  4:serve now', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d9a0ff',
      })
      .setOrigin(0, 0.5);

    // Shift + number, so the plain number keys are free for typing prices (PO, doc 12 Q30).
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!event.shiftKey) return;
      if (event.code === 'Digit1') this.evening.changeMoney(450, 'Sale');
      if (event.code === 'Digit2') this.evening.changeMoney(-200, 'Damage');
      if (event.code === 'Digit3') this.evening.endNow();
      if (event.code === 'Digit4') this.serveNow();
    });
  }

  /** Debug: skip the drive and start a sale with the waiting customer right away. */
  private serveNow(): void {
    if (this.evening.sale || !this.evening.roadCustomer) return;
    for (const key of [SceneKeys.Truck, SceneKeys.Cooler, SceneKeys.Drive]) {
      if (this.scene.isActive(key)) this.scene.stop(key);
    }
    this.evening.startSale();
    this.scene.launch(SceneKeys.Sales);
    this.scene.bringToTop();
  }

  update(_time: number, delta: number): void {
    this.evening.tick(delta);
    this.clockText.setText(formatClock(this.evening.clockMinutes));
    const sale = this.evening.sale;
    const warn =
      !!sale && sale.phase !== 'over' && sale.patienceLeftSeconds(this.evening.nowMs) <= PATIENCE_WARNING_SECONDS;
    this.patienceWarning.setVisible(warn).setX(this.moneyText.x - this.moneyText.width - 30);
  }

  private refresh(): void {
    this.clockText.setText(formatClock(this.evening.clockMinutes));
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
