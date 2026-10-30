import * as Phaser from 'phaser';

// SCREAM-12 (PO, October 30, with a photo of a desk calculator): the price is
// entered on a calculator at the sales window. A large LCD display with the $
// on the left and the digits right-aligned, the black number keys from the
// photo (7-9, 4-6, 1-3, 0, 00, .), and C, back and CHARGE keys so it can be
// used with the mouse alone.

export type CalculatorKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | 'C' | 'BACK' | 'CHARGE';

const KEY_W = 52;
const KEY_H = 32;
const GAP = 6;
const PAD = 14;
const DISPLAY_H = 46;
export const CALCULATOR_WIDTH = PAD * 2 + KEY_W * 4 + GAP * 3;
export const CALCULATOR_HEIGHT = PAD + DISPLAY_H + 10 + KEY_H * 4 + GAP * 3 + PAD;
/** Characters of room for the digits on the display. */
const DISPLAY_CHARS = 9;

const BODY = 0xe9ecef;
const BODY_EDGE = 0x9aa0a6;
const LCD = 0xc5cfbd;
const LCD_INK = '#1f2a1c';
const NUMBER_KEY = 0x2b2b2b;
const EDIT_KEY = 0x2f5fa8;
const CHARGE_KEY = 0xe8782a;

// [label, key, column, row, rows tall, colour]
const LAYOUT: [string, CalculatorKey, number, number, number, number][] = [
  ['7', '7', 0, 0, 1, NUMBER_KEY], ['8', '8', 1, 0, 1, NUMBER_KEY], ['9', '9', 2, 0, 1, NUMBER_KEY], ['C', 'C', 3, 0, 1, EDIT_KEY],
  ['4', '4', 0, 1, 1, NUMBER_KEY], ['5', '5', 1, 1, 1, NUMBER_KEY], ['6', '6', 2, 1, 1, NUMBER_KEY], ['←', 'BACK', 3, 1, 1, EDIT_KEY],
  ['1', '1', 0, 2, 1, NUMBER_KEY], ['2', '2', 1, 2, 1, NUMBER_KEY], ['3', '3', 2, 2, 1, NUMBER_KEY], ['CHARGE', 'CHARGE', 3, 2, 2, CHARGE_KEY],
  ['0', '0', 0, 3, 1, NUMBER_KEY], ['00', '00', 1, 3, 1, NUMBER_KEY], ['.', '.', 2, 3, 1, NUMBER_KEY],
];

export class Calculator {
  readonly container: Phaser.GameObjects.Container;
  /** The digits on the display, right-aligned (the $ is a separate label on the left). */
  readonly display: Phaser.GameObjects.Text;
  readonly keys = new Map<CalculatorKey, Phaser.GameObjects.Rectangle>();

  constructor(scene: Phaser.Scene, x: number, y: number, onKey: (key: CalculatorKey) => void) {
    this.container = scene.add.container(x, y);

    const body = scene.add.graphics();
    body.fillStyle(BODY_EDGE).fillRoundedRect(0, 0, CALCULATOR_WIDTH, CALCULATOR_HEIGHT, 14);
    body.fillStyle(BODY).fillRoundedRect(3, 3, CALCULATOR_WIDTH - 6, CALCULATOR_HEIGHT - 6, 12);
    body.fillStyle(LCD).fillRoundedRect(PAD, PAD, CALCULATOR_WIDTH - 2 * PAD, DISPLAY_H, 6);
    this.container.add(body);

    const dollar = scene.add
      .text(PAD + 10, PAD + DISPLAY_H / 2, '$', { fontFamily: 'monospace', fontSize: '32px', color: LCD_INK })
      .setOrigin(0, 0.5);
    this.display = scene.add
      .text(CALCULATOR_WIDTH - PAD - 10, PAD + DISPLAY_H / 2, '0', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: LCD_INK,
      })
      .setOrigin(1, 0.5);
    this.container.add([dollar, this.display]);

    const top = PAD + DISPLAY_H + 10;
    for (const [label, key, col, row, rows, colour] of LAYOUT) {
      const h = KEY_H * rows + GAP * (rows - 1);
      const kx = PAD + col * (KEY_W + GAP) + KEY_W / 2;
      const ky = top + row * (KEY_H + GAP) + h / 2;
      const rect = scene.add.rectangle(kx, ky, KEY_W, h, colour).setInteractive({ useHandCursor: true });
      const text = scene.add
        .text(kx, ky, label, {
          fontFamily: 'monospace',
          fontSize: label.length > 2 ? '11px' : '20px',
          color: '#ffffff',
          fontStyle: label.length > 2 ? 'bold' : 'normal',
        })
        .setOrigin(0.5);
      rect.on('pointerover', () => rect.setAlpha(0.85));
      rect.on('pointerout', () => rect.setAlpha(1));
      rect.on('pointerdown', () => onKey(key));
      this.keys.set(key, rect);
      this.container.add([rect, text]);
    }
  }

  /** Shows the typed text (or 0) right-aligned on the display. */
  show(typed: string): void {
    this.display.setText((typed === '' ? '0' : typed).slice(-DISPLAY_CHARS));
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }
}
