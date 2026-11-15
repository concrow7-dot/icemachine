import * as Phaser from 'phaser';
import { getFlavour, type FlavourId } from '../config/flavours';
import { formatMoney } from '../util/format';
import { addFlavourIcon, MARKER_FONT } from './flavourArt';

// SCREAM-330 (PO, November 14, notepad sketch): This Century Register. "Click the icons of the
// Ice Cream to calculate price." "Player clicks on which item and they add up automatically."
// A tablet at the sales window: the total at the top, one tile per ice cream on tonight's menu
// (its picture, its name and its price), then CLEAR and CHARGE. A click on a tile adds one of
// that ice cream to the total.
// PO, November 14, on the first build (the tablet sat beside the calculator pad, in the mini
// Today's Menu's place): "The tablet should replace the calculator". So it sits where the pad
// was and the pad is gone while the register is owned. PO, November 15: "One the tablet powerup is
// bought, lets remove the price menu": the mini Today's Menu is not shown with it either.
// Placeholder art by engineering until the PO draws it.

const BEZEL = 0x2b2f36;
const SCREEN = 0xeaf3fa;
const LCD = 0xcfeef5;
const LCD_INK = '#1f2a3c';
const TILE = 0xffffff;
const TILE_EDGE = 0x7f8a96;
const INK = '#2b1d10';
const BADGE = 0xe8782a;
const CLEAR_KEY = 0x2884d6;
const CHARGE_KEY = 0xe8782a;
const PAD = 14;
const DISPLAY_Y = 26;
const DISPLAY_H = 40;
const TILES_Y = 74;
const TILE_H = 96;
const GAP = 6;
const BUTTON_Y = 178;
const BUTTON_H = 38;

export type RegisterRow = { flavour: FlavourId; priceCents: number };
export type RegisterKey = 'C' | 'CHARGE';

export class RegisterTablet {
  readonly container: Phaser.GameObjects.Container;
  /** Test hooks: each ice cream's tile and the two buttons (places are relative to the container), the count on each badge, and the total shown. */
  readonly tiles = new Map<FlavourId, Phaser.GameObjects.Rectangle>();
  readonly keys = new Map<RegisterKey, Phaser.GameObjects.Rectangle>();
  readonly counts = new Map<FlavourId, number>();
  readonly display: Phaser.GameObjects.Text;
  private readonly badges = new Map<FlavourId, { dot: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text }>();
  private readonly tileParts: Phaser.GameObjects.GameObject[] = [];
  private shown = '';
  private readonly scene: Phaser.Scene;
  private readonly width: number;
  private readonly onPick: (flavour: FlavourId) => void;

  // No parameter properties: the test harness only strips types (Node's stripTypeScriptTypes).
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, onPick: (flavour: FlavourId) => void, onKey: (key: RegisterKey) => void) {
    this.scene = scene;
    this.width = width;
    this.onPick = onPick;
    this.container = scene.add.container(x, y);
    const body = scene.add.graphics();
    body.fillStyle(BEZEL, 1).fillRoundedRect(0, 0, width, height, 14);
    body.fillStyle(SCREEN, 1).fillRoundedRect(8, 8, width - 16, height - 16, 7);
    body.fillStyle(0x5a616b, 1).fillCircle(width / 2, 4.5, 2); // the camera
    body.fillStyle(LCD, 1).fillRoundedRect(PAD, DISPLAY_Y, width - 2 * PAD, DISPLAY_H, 6);
    this.container.add(body);
    this.container.add(scene.add.text(width / 2, 17, 'REGISTER', { fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#3b4654' }).setOrigin(0.5));
    const dollar = scene.add.text(PAD + 10, DISPLAY_Y + DISPLAY_H / 2, '$', { fontFamily: 'monospace', fontSize: '28px', color: LCD_INK }).setOrigin(0, 0.5);
    this.display = scene.add.text(width - PAD - 10, DISPLAY_Y + DISPLAY_H / 2, '0', { fontFamily: 'monospace', fontSize: '28px', color: LCD_INK }).setOrigin(1, 0.5);
    this.container.add([dollar, this.display]);
    // CLEAR on the left, a wide CHARGE on the right.
    const clearW = 86;
    const buttons: [RegisterKey, string, number, number, number][] = [
      ['C', 'CLEAR', PAD + clearW / 2, clearW, CLEAR_KEY],
      ['CHARGE', 'CHARGE', PAD + clearW + GAP + (width - 2 * PAD - clearW - GAP) / 2, width - 2 * PAD - clearW - GAP, CHARGE_KEY],
    ];
    for (const [key, label, cx, w, colour] of buttons) {
      const rect = scene.add.rectangle(cx, BUTTON_Y + BUTTON_H / 2, w, BUTTON_H, colour).setStrokeStyle(2, 0x2b2f36).setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setAlpha(0.85));
      rect.on('pointerout', () => rect.setAlpha(1));
      rect.on('pointerdown', () => onKey(key));
      const text = scene.add.text(cx, BUTTON_Y + BUTTON_H / 2, label, { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.keys.set(key, rect);
      this.container.add([rect, text]);
    }
  }

  /** Shows the total, a tile per row (rebuilt only when the rows or prices changed) and the counts on the badges. */
  show(rows: readonly RegisterRow[], total: string): void {
    const key = rows.map((r) => `${r.flavour}:${r.priceCents}`).join(',');
    if (key !== this.shown) this.build(rows, key);
    this.display.setText(total);
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
    for (const part of this.tileParts) part.destroy();
    this.tileParts.length = 0;
    this.tiles.clear();
    this.badges.clear();
    const { scene, width } = this;
    const n = Math.max(1, rows.length);
    const tileW = Math.min(84, (width - 2 * PAD - (n - 1) * GAP) / n);
    const startX = (width - (n * tileW + (n - 1) * GAP)) / 2;
    rows.forEach((row, i) => {
      const cx = startX + i * (tileW + GAP) + tileW / 2;
      const cy = TILES_Y + TILE_H / 2;
      const rect = scene.add.rectangle(cx, cy, tileW, TILE_H, TILE).setStrokeStyle(2, TILE_EDGE).setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(0xfff3c4));
      rect.on('pointerout', () => rect.setFillStyle(TILE));
      rect.on('pointerdown', () => this.onPick(row.flavour));
      const icon = addFlavourIcon(scene, cx, cy - 22, row.flavour, 1.5);
      const name = scene.add
        .text(cx, cy + 13, getFlavour(row.flavour).name, { fontFamily: 'monospace', fontSize: '9px', color: INK, align: 'center', wordWrap: { width: tileW - 4 } })
        .setOrigin(0.5);
      const price = scene.add
        .text(cx, cy + 35, formatMoney(row.priceCents).replace(/\.00$/, ''), { fontFamily: MARKER_FONT, fontSize: '17px', color: '#141418' })
        .setOrigin(0.5);
      const dot = scene.add.circle(cx + tileW / 2 - 9, cy - TILE_H / 2 + 9, 9, BADGE).setStrokeStyle(2, 0x2b1d10).setVisible(false);
      const text = scene.add
        .text(cx + tileW / 2 - 9, cy - TILE_H / 2 + 9, '', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setVisible(false);
      this.tiles.set(row.flavour, rect);
      this.badges.set(row.flavour, { dot, text });
      this.tileParts.push(rect, icon, name, price, dot, text);
      this.container.add([rect, icon, name, price, dot, text]);
    });
  }
}
