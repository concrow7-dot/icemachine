import * as Phaser from 'phaser';
import { TIP_COUNTDOWN_SECONDS, TIP_PERCENT_STEPS } from '../config/tuning';
import type { EveningState } from '../state/EveningState';

const WIDTH = 360;
const HEIGHT = 14;
/** SCREAM-125 (PO, November 2): at the window, the tip is a jar on the counter, to the right of the customer. */
const JAR_W = 40;
const JAR_H = 112;

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
  private readonly jar: boolean;

  /**
   * A bar across the top (the cooler), or with `jar`, a tip jar standing on the counter with
   * (x, y) the middle of its base: it empties from the top down as the tip shrinks.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, jar = false) {
    this.jar = jar;
    if (jar) {
      const glass = scene.add.graphics();
      glass.fillStyle(0xcfeef5, 0.55).fillRect(-JAR_W / 2, -JAR_H, JAR_W, JAR_H);
      this.fill = scene.add.rectangle(0, -2, JAR_W - 6, JAR_H - 6, 0x2e7d32).setOrigin(0.5, 1);
      const rim = scene.add.graphics();
      rim.lineStyle(3, 0x7f7f7f, 1).strokeRect(-JAR_W / 2, -JAR_H, JAR_W, JAR_H);
      rim.fillStyle(0xc8c8c8, 1).fillRect(-JAR_W / 2 - 4, -JAR_H - 8, JAR_W + 8, 8);
      rim.lineStyle(2, 0x7f7f7f, 1).strokeRect(-JAR_W / 2 - 4, -JAR_H - 8, JAR_W + 8, 8);
      rim.lineStyle(3, 0xffffff, 0.7).lineBetween(-JAR_W / 2 + 6, -12, -JAR_W / 2 + 6, -JAR_H + 10);
      const title = scene.add
        .text(0, -JAR_H - 34, 'TIP', { fontFamily: 'monospace', fontSize: '14px', color: '#2b1d10', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.label = scene.add
        .text(0, -JAR_H - 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#2b1d10', fontStyle: 'bold', align: 'center' })
        .setOrigin(0.5);
      this.container = scene.add.container(x, y, [glass, this.fill, rim, title, this.label]).setDepth(20);
      return;
    }
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
    if (this.jar) this.fill.setDisplaySize(JAR_W - 6, (JAR_H - 6) * fraction);
    else this.fill.setDisplaySize(WIDTH * fraction, HEIGHT);
    // Greener for a bigger tip; grey once it's gone (asked again, a mistake, or out of time).
    const top = TIP_PERCENT_STEPS[0] ?? 20;
    const colour = percent === 0 ? 0x8a8a8a : percent >= top ? 0x2e7d32 : percent >= top / 2 ? 0x7cb342 : 0xf9a825;
    this.fill.setFillStyle(colour);
    const text = percent > 0 ? `${percent}%` : sale.askedAgain || sale.retryUsed || sale.repriceUsed ? 'No tip' : 'Took too long';
    // The jar is narrow: "Took too long" goes on two lines there.
    this.label.setText(this.jar && text === 'Took too long' ? 'Took too\nlong' : text);
  }
}
