import * as Phaser from 'phaser';
import { TIP_COUNTDOWN_SECONDS, TIP_PERCENT_STEPS } from '../config/tuning';
import type { EveningState } from '../state/EveningState';

const WIDTH = 360;
const HEIGHT = 14;

/**
 * Issue #14/#15: the 40-second tip countdown, shown on the sales screen and
 * at the cooler (PO: it persists until the end of the transaction). The bar
 * empties over 40 seconds; the label shows the tip on offer right now
 * (20%, 15%, 10%, 5%, then none). Grey once there's no tip to win.
 */
export class TipBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const title = scene.add
      .text(0, 0, 'TIP', { fontFamily: 'monospace', fontSize: '16px', color: '#2b1d10', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    const track = scene.add.rectangle(44, 0, WIDTH, HEIGHT, 0x2b1d10, 0.25).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(44, 0, WIDTH, HEIGHT, 0x2e7d32).setOrigin(0, 0.5);
    this.label = scene.add
      .text(44 + WIDTH + 12, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#2b1d10', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.container = scene.add.container(x, y, [title, track, this.fill, this.label]).setDepth(20);
  }

  /** Redraws from the sale's clock. Hidden until the order is first hidden. */
  update(evening: EveningState): void {
    const sale = evening.sale;
    const seconds = sale?.countdownSeconds(evening.nowMs) ?? null;
    if (!sale || seconds === null || sale.phase === 'over') {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const fraction = Math.max(0, 1 - seconds / TIP_COUNTDOWN_SECONDS);
    const percent = sale.tipPercent(evening.nowMs);
    this.fill.setDisplaySize(WIDTH * fraction, HEIGHT);
    // Greener for a bigger tip; grey once it's gone (asked again, a mistake, or out of time).
    const top = TIP_PERCENT_STEPS[0] ?? 20;
    const colour = percent === 0 ? 0x8a8a8a : percent >= top ? 0x2e7d32 : percent >= top / 2 ? 0x7cb342 : 0xf9a825;
    this.fill.setFillStyle(colour);
    this.label.setText(percent > 0 ? `${percent}%` : sale.askedAgain || sale.retryUsed ? 'no tip' : 'Took too long');
  }
}
