import * as Phaser from 'phaser';

/**
 * SCREAM-126 (PO, November 2): one speech bubble style for the whole game, like
 * Pokémon Yellow's text boxes: white, a dark pixel outline with notched corners, a
 * thin inner line, and a stepped pixel tail. Used by the "!" over customers on the map
 * and the customer's words at the window.
 *
 * Everything is drawn in blocks of `unit` px, so it looks like pixel art at any size.
 */
export const BUBBLE_INK = 0x2b1d10;
export const BUBBLE_FILL = 0xfffdf9;
const BUBBLE_INNER_LINE = 0xc9bfb3;

export interface BubbleSpec {
  /** Top-left corner and size of the box, in px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The size of one "pixel" in px. */
  unit: number;
  /**
   * The tail: which side it leaves from, where along that side (px from the box's
   * left for 'down', from its top for 'right'), how many steps long, and how many
   * units each step reaches.
   */
  tail: { side: 'down' | 'right'; at: number; steps: number; reach?: number };
  /** Draw the thin inner line (the window's big box) or not (the small map bubble). */
  innerLine?: boolean;
}

type Rect = [number, number, number, number];

/** The tail's blocks, each [x, y, w, h], leaving the box at its edge. */
function tailRects(s: BubbleSpec): Rect[] {
  const { unit: u, tail } = s;
  const reach = (tail.reach ?? 1) * u;
  const rects: Rect[] = [];
  for (let k = 0; k < tail.steps; k++) {
    // Each step is one unit narrower than the last; the straight edge stays put,
    // so the tail leans like a pixel-art speech tail.
    const span = (tail.steps - k) * u;
    if (tail.side === 'down') rects.push([s.x + tail.at, s.y + s.h + k * reach, span, reach]);
    else rects.push([s.x + s.w + k * reach, s.y + tail.at - span + u, reach, span]);
  }
  return rects;
}

/** Draws the bubble into `g` (cleared first). */
export function drawBubble(g: Phaser.GameObjects.Graphics, s: BubbleSpec): Phaser.GameObjects.Graphics {
  const { x, y, w, h, unit: u } = s;
  const tail = tailRects(s);
  g.clear();
  // Outline: the box with notched corners, and every tail block one unit bigger all round.
  g.fillStyle(BUBBLE_INK, 1);
  g.fillRect(x, y + u, w, h - 2 * u).fillRect(x + u, y, w - 2 * u, h);
  for (const [tx, ty, tw, th] of tail) g.fillRect(tx - u, ty - u, tw + 2 * u, th + 2 * u);
  // Body: the same shapes one unit in, which also opens the box where the tail joins.
  g.fillStyle(BUBBLE_FILL, 1);
  g.fillRect(x + u, y + 2 * u, w - 2 * u, h - 4 * u).fillRect(x + 2 * u, y + u, w - 4 * u, h - 2 * u);
  for (const [tx, ty, tw, th] of tail) {
    if (s.tail.side === 'down') g.fillRect(tx, ty - u, tw, th + u);
    else g.fillRect(tx - u, ty, tw + u, th);
  }
  if (s.innerLine) {
    g.lineStyle(u / 2, BUBBLE_INNER_LINE, 1).strokeRect(x + 3 * u, y + 3 * u, w - 6 * u, h - 6 * u);
  }
  return g;
}
