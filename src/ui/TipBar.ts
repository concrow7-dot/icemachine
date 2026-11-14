import * as Phaser from 'phaser';
import { TIP_PERCENT_STEPS } from '../config/tuning';
import { tipCountdownSeconds } from '../state/Sale';
import type { EveningState } from '../state/EveningState';
import { MARKER_FONT } from './flavourArt';

const WIDTH = 360;
const HEIGHT = 14;
/** SCREAM-125 (PO, November 2): at the window, the tip is the drawing's green cup, on the counter right of the customer. */
const JAR_W = 46;
const JAR_H = 70;
/** How far the bills stick out of the cup with the whole tip still on offer. */
const BILLS_H = 30;
/**
 * SCREAM-281 (PO, November 12): at the cooler the green above the cup is a tall bar, full at
 * the top tip and shrinking as the countdown runs, so the player can see the tip ticking away.
 */
const TALL_H = 190;
/** SCREAM-284: below this height there is no room for the 20% / 15% / 10% / 5% labels beside the bar. */
const ZONE_LABELS_FROM = 150;

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
  private readonly steps: readonly number[];
  private readonly tall: boolean;
  /** How tall the green stands above the cup with the whole tip on offer (test hook). */
  readonly fullHeight: number = BILLS_H;
  /** SCREAM-281: the tall bar's zone labels, top tip first (test hook). */
  readonly zoneLabels: Phaser.GameObjects.Text[] = [];
  /** SCREAM-287: the bar's track and side labels, hidden with the green once there is no tip (test hook). */
  readonly barParts: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  /** Where the label sits above the full bar, and just above the cup when the bar is away. */
  private labelY = 0;
  private labelLowY = 0;

  /**
   * A bar across the top (the cooler), or with `jar`, a tip jar standing on the counter with
   * (x, y) the middle of its base: it empties from the top down as the tip shrinks.
   */
  /** `tall`: the bar that shrinks with the tip (SCREAM-281), `barHeight` px when full (SCREAM-284: the window's is the jar's height). */
  /** `steps`: tonight's tip steps (SCREAM-303: five with the Service With A Smile power-up). */
  constructor(scene: Phaser.Scene, x: number, y: number, jar = false, tall = false, barHeight = TALL_H, steps: readonly number[] = TIP_PERCENT_STEPS) {
    this.steps = steps;
    this.jar = jar;
    this.tall = jar && tall;
    if (jar) {
      const fullH = this.tall ? barHeight : BILLS_H;
      this.fullHeight = fullH;
      const barW = JAR_W - 12;
      const extras: Phaser.GameObjects.GameObject[] = [];
      if (this.tall) {
        // The bar's track, with a line and a label where the tip steps down (20%, 15%, 10%, 5%).
        const track = scene.add.graphics();
        const top = -JAR_H + 6 - fullH;
        track.fillStyle(0x2b1d10, 0.12).fillRect(-barW / 2, top, barW, fullH);
        track.lineStyle(2, 0x2b1d10, 0.55).strokeRect(-barW / 2, top, barW, fullH);
        const zone = fullH / steps.length;
        steps.forEach((percent, n) => {
          if (n > 0) track.lineStyle(2, 0x2b1d10, 0.55).lineBetween(-barW / 2 - 4, top + n * zone, barW / 2 + 8, top + n * zone);
          if (fullH < ZONE_LABELS_FROM) return;
          const label = scene.add
            .text(barW / 2 + 12, top + (n + 0.5) * zone, `${percent}%`, { fontFamily: 'monospace', fontSize: '13px', color: '#5a4636' })
            .setOrigin(0, 0.5);
          this.zoneLabels.push(label);
          extras.push(label);
        });
        extras.unshift(track);
        this.barParts.push(track, ...this.zoneLabels);
      }
      // The green cup from the PO's drawing, with TIP written on it (as in his first sketch).
      // Dollar bills stick out of the top and sink into the cup as the tip shrinks.
      this.fill = scene.add.rectangle(0, -JAR_H + 6, barW, fullH, 0x9ad48c).setOrigin(0.5, 1);
      const cup = scene.add.graphics();
      cup.fillStyle(0x22b14c, 1).fillRoundedRect(-JAR_W / 2, -JAR_H, JAR_W, JAR_H, 5);
      cup.fillStyle(0x188c3a, 1).fillRect(-JAR_W / 2 + 4, -JAR_H + 4, JAR_W - 8, 8);
      cup.lineStyle(3, 0x7f7f7f, 1).strokeRoundedRect(-JAR_W / 2, -JAR_H, JAR_W, JAR_H, 5);
      const word = scene.add
        .text(0, -JAR_H / 2 + 4, 'TIP', { fontFamily: MARKER_FONT, fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5)
        .setAngle(-6);
      this.label = scene.add
        .text(0, -JAR_H - fullH - (this.tall ? 10 : 14), '', { fontFamily: 'monospace', fontSize: this.tall && fullH >= ZONE_LABELS_FROM ? '18px' : '14px', color: '#2b1d10', fontStyle: 'bold', align: 'center' })
        .setOrigin(0.5);
      // The track goes behind the green; the zone labels beside it.
      const [track, ...labels] = extras;
      this.labelY = this.label.y;
      this.labelLowY = -JAR_H - 14;
      this.container = scene.add.container(x, y, [...(track ? [track] : []), this.fill, ...labels, cup, word, this.label]).setDepth(20);
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

  /** SCREAM-287: shows the countdown bar, or puts it away and drops the label to just above the cup. */
  private showBar(on: boolean): void {
    if (!this.tall) return;
    this.fill.setVisible(on);
    this.barParts.forEach((part) => part.setVisible(on));
    this.label.setY(on ? this.labelY : this.labelLowY - (this.label.text.includes('\n') ? 8 : 0));
  }

  /** Redraws from the sale's clock. Hidden until the order is first hidden. */
  update(evening: EveningState): void {
    const sale = evening.sale;
    const seconds = sale?.countdownSeconds(evening.nowMs) ?? null;
    // SCREAM-134 (PO, November 2): at the window the cup is always on the counter during a
    // visit: full while the order shows, then emptying; when the sale ends it keeps its last look.
    if (this.jar && sale && sale.phase !== 'over' && seconds === null) {
      this.container.setVisible(true);
      this.showBar(true);
      this.fill.setDisplaySize(JAR_W - 12, this.fullHeight).setFillStyle(this.tall ? 0x2e7d32 : 0x9ad48c);
      this.label.setText('');
      return;
    }
    if (this.jar && sale?.phase === 'over') {
      this.container.setVisible(true);
      this.label.setText('');
      return;
    }
    if (!sale || seconds === null || sale.phase === 'over') {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const fraction = Math.max(0, 1 - seconds / tipCountdownSeconds(this.steps));
    const percent = sale.tipPercent(evening.nowMs);
    if (this.jar) this.fill.setDisplaySize(JAR_W - 12, Math.max(1, this.fullHeight * fraction));
    else this.fill.setDisplaySize(WIDTH * fraction, HEIGHT);
    // Greener for a bigger tip; grey once it's gone (asked again, a mistake, or out of time).
    // SCREAM-303: by place in the countdown, so 25% and 20% are the first two greens whatever the top is.
    const place = this.steps.indexOf(percent);
    const colour = percent === 0 ? 0x8a8a8a : place === 0 ? 0x2e7d32 : place < this.steps.length - 1 ? 0x7cb342 : 0xf9a825;
    // The cup's bills stay bill-green while there's a tip, grey once it's gone.
    // SCREAM-281: the tall bar changes colour with the tip, like the old bar across the top.
    this.fill.setFillStyle(this.jar && !this.tall ? (percent === 0 ? 0x8a8a8a : 0x9ad48c) : colour);
    const text = percent > 0 ? `${percent}%` : sale.askedAgain || sale.retryUsed || sale.repriceUsed ? 'No tip' : 'Took too long';
    // The jar is narrow: "Took too long" goes on two lines there.
    this.label.setText(this.jar && text === 'Took too long' ? 'Took too\nlong' : text);
    // SCREAM-287 (PO, November 12): with no tip left the countdown is over: no bar, just the words.
    this.showBar(percent > 0);
  }
}
