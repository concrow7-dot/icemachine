import * as Phaser from 'phaser';
import { getFlavour, type FlavourId } from '../config/flavours';
import { formatMoney } from '../util/format';
import { addFlavourIcon, MARKER_FONT } from './flavourArt';

// SCREAM-330 (PO, November 14, notepad sketch): This Century Register. "Click the icons of the
// Ice Cream to calculate price." "Player clicks on which item and they add up automatically."
// A tablet at the sales window with one tile per ice cream on tonight's menu: its picture, its
// name and its price. A click on a tile adds one of that ice cream to the total on the pad
// (his answer: "Tablet beside the pad", the pad stays). It takes the place of the mini Today's
// Menu taped to the glass, since it shows the same names and prices (engineering's proposal:
// there is no room at the window for both). Placeholder art by engineering until the PO draws it.

const BEZEL = 0x2b2f36;
const SCREEN = 0xeaf3fa;
const TILE = 0xffffff;
const TILE_EDGE = 0x7f8a96;
const INK = '#2b1d10';
const BADGE = 0xe8782a;
const PAD = 10;
const TOP = 26;
const TILE_H = 100;
const GAP = 6;

export type RegisterRow = { flavour: FlavourId; priceCents: number };

export class RegisterTablet {
  readonly container: Phaser.GameObjects.Container;
  /** Test hooks: each ice cream's tile (its place is relative to the container), and the count on its badge. */
  readonly tiles = new Map<FlavourId, Phaser.GameObjects.Rectangle>();
  readonly counts = new Map<FlavourId, number>();
  private readonly badges = new Map<FlavourId, { dot: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text }>();
  private shown = '';

  private readonly scene: Phaser.Scene;
  private readonly width: number;
  private readonly onPick: (flavour: FlavourId) => void;

  // No parameter properties: the test harness only strips types (Node's stripTypeScriptTypes).
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, onPick: (flavour: FlavourId) => void) {
    this.scene = scene;
    this.width = width;
    this.onPick = onPick;
    this.container = scene.add.container(x, y);
  }

  get height(): number {
    return TOP + TILE_H + PAD + 8;
  }

  /** Draws a tile per row (only when the rows or prices changed) and the counts on the badges. */
  show(rows: readonly RegisterRow[]): void {
    const key = rows.map((r) => `${r.flavour}:${r.priceCents}`).join(',');
    if (key !== this.shown) this.build(rows, key);
    for (const [flavour, badge] of this.badges) {
      const n = this.counts.get(flavour) ?? 0;
      badge.dot.setVisible(n > 0);
      badge.text.setText(`${n}`).setVisible(n > 0);
    }
  }

  /** One more of this ice cream has been rung up. */
  count(flavour: FlavourId): void {
    this.counts.set(flavour, (this.counts.get(flavour) ?? 0) + 1);
  }

  /** The total was cleared: the badges go. */
  clearCounts(): void {
    this.counts.clear();
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  private build(rows: readonly RegisterRow[], key: string): void {
    this.shown = key;
    this.container.removeAll(true);
    this.tiles.clear();
    this.badges.clear();
    const { scene, width } = this;
    const body = scene.add.graphics();
    body.fillStyle(BEZEL, 1).fillRoundedRect(0, 0, width, this.height, 14);
    body.fillStyle(SCREEN, 1).fillRoundedRect(8, 8, width - 16, this.height - 16, 7);
    body.fillStyle(0x5a616b, 1).fillCircle(width / 2, 4.5, 2); // the camera
    this.container.add(body);
    this.container.add(scene.add.text(width / 2, 18, 'REGISTER', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#3b4654' }).setOrigin(0.5));
    const n = Math.max(1, rows.length);
    const tileW = Math.min(84, (width - 2 * PAD - (n - 1) * GAP - 8) / n);
    const startX = (width - (n * tileW + (n - 1) * GAP)) / 2;
    rows.forEach((row, i) => {
      const cx = startX + i * (tileW + GAP) + tileW / 2;
      const cy = TOP + TILE_H / 2;
      const rect = scene.add.rectangle(cx, cy, tileW, TILE_H, TILE).setStrokeStyle(2, TILE_EDGE).setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(0xfff3c4));
      rect.on('pointerout', () => rect.setFillStyle(TILE));
      rect.on('pointerdown', () => this.onPick(row.flavour));
      const icon = addFlavourIcon(scene, cx, cy - 24, row.flavour, 1.5);
      const name = scene.add
        .text(cx, cy + 12, getFlavour(row.flavour).name, { fontFamily: 'monospace', fontSize: '9px', color: INK, align: 'center', wordWrap: { width: tileW - 4 } })
        .setOrigin(0.5);
      const price = scene.add
        .text(cx, cy + 36, formatMoney(row.priceCents).replace(/\.00$/, ''), { fontFamily: MARKER_FONT, fontSize: '17px', color: '#141418' })
        .setOrigin(0.5);
      const dot = scene.add.circle(cx + tileW / 2 - 9, cy - TILE_H / 2 + 9, 9, BADGE).setStrokeStyle(2, 0x2b1d10).setVisible(false);
      const text = scene.add
        .text(cx + tileW / 2 - 9, cy - TILE_H / 2 + 9, '', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setVisible(false);
      this.tiles.set(row.flavour, rect);
      this.badges.set(row.flavour, { dot, text });
      this.container.add([rect, icon, name, price, dot, text]);
    });
  }
}
