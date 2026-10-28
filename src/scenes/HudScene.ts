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

    this.refresh();

    const onMoney = (change: number, _total: number, label: string) => {
      this.refresh();
      this.showMoneyChange(change, label);
    };
    const onEnded = () => endEvening(this);

    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.evening.once(EveningEvents.Ended, onEnded);

    // Stop listening when this scene closes, so old evenings can't affect new ones.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.MoneyChanged, onMoney);
      this.evening.off(EveningEvents.Ended, onEnded);
    });
  }

  update(_time: number, delta: number): void {
    this.evening.tick(delta);
    this.clockText.setText(formatClock(this.evening.clockMinutes));
  }

  private refresh(): void {
    this.clockText.setText(formatClock(this.evening.clockMinutes));
    const cents = this.evening.moneyCents;
    this.moneyText.setText(formatMoney(cents));
    this.moneyText.setColor(cents < 0 ? '#ff9c9c' : '#c8f7c5');
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
