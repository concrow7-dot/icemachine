import * as Phaser from 'phaser';
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
      .text(140, 22, 'DEBUG  1:+$4.50  2:-$2.00  3:end evening  4:customer on/off', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d9a0ff',
      })
      .setOrigin(0, 0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ONE', () => this.evening.changeMoney(450, 'Sale'));
    keyboard?.on('keydown-TWO', () => this.evening.changeMoney(-200, 'Damage'));
    keyboard?.on('keydown-THREE', () => this.evening.endNow());
    keyboard?.on('keydown-FOUR', () =>
      this.evening.setCustomerWaiting(!this.evening.customerWaiting),
    );
  }

  update(_time: number, delta: number): void {
    this.evening.tick(delta);
    this.clockText.setText(formatClock(this.evening.clockMinutes));
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
