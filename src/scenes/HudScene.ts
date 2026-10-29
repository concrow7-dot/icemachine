import * as Phaser from 'phaser';
import { CUSTOMER_FLASH_SECONDS, CUSTOMER_PATIENCE_SECONDS } from '../config/tuning';
import { endEvening, getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatClock, formatMoney, formatMoneyChange } from '../util/format';

/** Width of the customer patience bar in the HUD, in pixels. */
const PATIENCE_BAR_WIDTH = 90;

// Issues #5 and #6: the clock and money display. This scene runs on top of
// every evening phase and is what keeps the clock moving in all of them.
export class HudScene extends Phaser.Scene {
  private evening!: EveningState;
  private clockText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private soldOutText!: Phaser.GameObjects.Text;
  private patience!: Phaser.GameObjects.Container;
  private patienceFill!: Phaser.GameObjects.Rectangle;
  private patienceTime!: Phaser.GameObjects.Text;

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

    // Issue #12: how long the current customer will keep waiting. It lives in the
    // HUD so the same indicator works on every screen (road, truck, and later the
    // sales window and cooler). Flashes for the last few seconds.
    const label = this.add
      .text(0, 0, 'CUSTOMER', { fontFamily: 'monospace', fontSize: '13px', color: '#ff8fbf' })
      .setOrigin(0, 0.5);
    const track = this.add.rectangle(84, 0, PATIENCE_BAR_WIDTH, 10, 0xffffff, 0.15).setOrigin(0, 0.5);
    this.patienceFill = this.add.rectangle(84, 0, PATIENCE_BAR_WIDTH, 10, 0xff4f9a).setOrigin(0, 0.5);
    this.patienceTime = this.add
      .text(84 + PATIENCE_BAR_WIDTH + 8, 0, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff' })
      .setOrigin(0, 0.5);
    this.patience = this.add.container(0, 22, [label, track, this.patienceFill, this.patienceTime]).setVisible(false);

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

  update(time: number, delta: number): void {
    this.evening.tick(delta);
    this.clockText.setText(formatClock(this.evening.clockMinutes));
    this.updatePatience(time);
  }

  /** Shows the curb customer's remaining patience next to the cash; flashes red near the end. */
  private updatePatience(time: number): void {
    const waiting = this.evening.roadCustomer !== null && !this.evening.customerWaiting;
    this.patience.setVisible(waiting);
    if (!waiting) return;

    const left = this.evening.roadCustomerSecondsLeft;
    const fraction = left / CUSTOMER_PATIENCE_SECONDS;
    this.patienceFill.setDisplaySize(Math.max(0, PATIENCE_BAR_WIDTH * fraction), 10);
    this.patienceTime.setText(`0:${Math.ceil(left).toString().padStart(2, '0')}`.replace('0:60', '1:00'));

    const ending = left <= CUSTOMER_FLASH_SECONDS;
    this.patienceFill.setFillStyle(ending ? 0xff5252 : 0xff4f9a);
    this.patience.setAlpha(ending && Math.floor(time / 200) % 2 === 0 ? 0.25 : 1);

    const right = this.moneyText.x - this.moneyText.width - 20;
    this.patience.setX(right - (84 + PATIENCE_BAR_WIDTH + 8 + 40));
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
