import * as Phaser from 'phaser';
import type { PowerUpLogo } from '../config/powerUps';
import { FLAVOURS } from '../config/flavours';
import { FLAVOUR_FRAME_H, FLAVOUR_ICONS_KEY, flavourFrame, MARKER_FONT } from './flavourArt';

// SCREAM-296: the picture on a cork board note. Engineering's placeholders, drawn in code, one
// per tree (a wheel, a speaker, a coin), until the PO draws a logo for each power-up.
// SCREAM-122: the Temporary Gas Can has its own: a red can with a black spout, in the hub's
// cartoon style (flat colours, thick dark outlines). An original design: no brand, no label text.

const INK = 0x2b1d10;

/**
 * Draws a tree's logo centred on (0, 0) inside `into`, about `size` px across.
 * `grey` is the not-yet-bought look: no colour, and fainter.
 */
export function addPowerUpLogo(
  scene: Phaser.Scene,
  into: Phaser.GameObjects.Container,
  tree: PowerUpLogo,
  size: number,
  grey: boolean,
): void {
  const g = scene.add.graphics();
  into.add(g);
  const r = size / 2;
  const line = Math.max(2, size / 14);
  const colour = (c: number) => (grey ? 0x9a9a9a : c);
  g.setAlpha(grey ? 0.75 : 1);
  const flavour = FLAVOURS.find((f) => f.id === tree);
  if (flavour) {
    // SCREAM-271: an ice cream's own picture (the loading screen's caller loads the sheet).
    // Whole-number scale, so the pixel art stays sharp.
    const picture = scene.add.image(0, -size * 0.08, FLAVOUR_ICONS_KEY, flavourFrame(flavour.id)).setScale(Math.max(1, Math.round(size / FLAVOUR_FRAME_H)));
    if (grey) picture.setTint(0x8f8f8f).setAlpha(0.6);
    into.add(picture);
  } else if (tree === 'question') {
    // SCREAM-271: an ice cream the PO hasn't decided yet.
    const mark = scene.add
      .text(0, 0, '?', { fontFamily: MARKER_FONT, fontSize: `${Math.round(size * 1.05)}px`, color: grey ? '#8a8a8a' : '#2b1d10' })
      .setOrigin(0.5);
    mark.setAlpha(grey ? 0.75 : 1);
    into.add(mark);
  } else if (tree === 'tip-jar') {
    // SCREAM-303: the PO's sketch (Personal Notes, November 14): a jar with TIPS on it and a plus
    // at its top right. Drawn like the gas can: flat colour, a thick dark outline.
    const ink = grey ? 0x6f6f6f : INK;
    const w = size * 0.56;
    const h = size * 0.8;
    const left = -w / 2 - size * 0.08;
    const top = -h / 2 + size * 0.08;
    g.fillStyle(grey ? 0xdcdcdc : 0xd8f1ff, 1).fillRoundedRect(left, top, w, h, size * 0.08);
    g.lineStyle(line, ink, 1).strokeRoundedRect(left, top, w, h, size * 0.08);
    g.fillStyle(grey ? 0xc4c4c4 : 0xa9dcf7, 1).fillEllipse(left + w / 2, top, w, size * 0.2);
    g.lineStyle(line, ink, 1).strokeEllipse(left + w / 2, top, w, size * 0.2);
    const word = scene.add
      .text(left + w / 2, top + h * 0.55, 'TIPS', { fontFamily: MARKER_FONT, fontSize: `${Math.max(7, Math.round(size * 0.21))}px`, color: grey ? '#6f6f6f' : '#2b1d10' })
      .setOrigin(0.5);
    into.add(word);
    // The plus, top right.
    const px = left + w + size * 0.12;
    const py = top - size * 0.02;
    const arm = size * 0.13;
    g.lineStyle(Math.max(3, size / 9), grey ? 0x8a8a8a : 0x2e9e44, 1);
    g.lineBetween(px - arm, py, px + arm, py).lineBetween(px, py - arm, px, py + arm);
  } else if (tree === 'gas-can') {
    drawGasCan(g, size, grey);
  } else if (tree === 'gitty-up') {
    drawGittyUp(g, size, grey);
  } else if (tree === 'trot') {
    drawTrot(g, size, grey);
  } else if (tree === 'truck') {
    // A wheel: tyre, hubcap and five spokes.
    g.fillStyle(colour(0x33302c), 1).fillCircle(0, 0, r);
    g.fillStyle(grey ? 0xd0d0d0 : 0xcfd6dc, 1).fillCircle(0, 0, r * 0.58);
    g.lineStyle(line, colour(0x33302c), 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.lineBetween(0, 0, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
    }
    g.fillStyle(colour(0xd9622b), 1).fillCircle(0, 0, r * 0.18);
  } else if (tree === 'speaker') {
    // A loudspeaker: the box, the cone and two sound waves.
    g.fillStyle(colour(0x2f9e44), 1);
    g.fillRect(-r, -r * 0.3, r * 0.5, r * 0.6);
    g.fillTriangle(-r * 0.5, -r * 0.3, -r * 0.5, r * 0.3, r * 0.1, r * 0.8);
    g.fillTriangle(-r * 0.5, -r * 0.3, r * 0.1, -r * 0.8, r * 0.1, r * 0.8);
    g.lineStyle(line, grey ? 0x9a9a9a : INK, 1);
    g.beginPath().arc(r * 0.1, 0, r * 0.5, -0.8, 0.8).strokePath();
    g.beginPath().arc(r * 0.1, 0, r * 0.88, -0.8, 0.8).strokePath();
  } else {
    // A coin with a dollar sign.
    g.fillStyle(colour(0xb8860b), 1).fillCircle(0, 0, r);
    g.fillStyle(grey ? 0xd0d0d0 : 0xffd84a, 1).fillCircle(0, 0, r * 0.82);
    const dollar = scene.add
      .text(0, r * 0.06, '$', { fontFamily: MARKER_FONT, fontSize: `${Math.round(size * 0.72)}px`, color: grey ? '#8a8a8a' : '#7a5200' })
      .setOrigin(0.5);
    dollar.setAlpha(grey ? 0.75 : 1);
    into.add(dollar);
  }
}

/**
 * SCREAM-122: the gas can, centred on (0, 0), about `size` px tall. The PO's reference was a
 * photo of a red plastic can: square body, a handle on top, a black spout up to the left, a
 * yellow label. Drawn like the truck's inside: flat colour, a thick dark outline, one highlight.
 */
export function drawGasCan(g: Phaser.GameObjects.Graphics, size: number, grey: boolean): void {
  const u = size / 100; // drawn on a 100 x 100 grid
  const ink = grey ? 0x6f6f6f : INK;
  const red = grey ? 0xa9a9a9 : 0xd8332a;
  const redDark = grey ? 0x8f8f8f : 0xa8231c;
  const yellow = grey ? 0xcfcfcf : 0xffd84a;
  const black = grey ? 0x7d7d7d : 0x2a2622;
  const line = Math.max(2, 5 * u);
  const P = (x: number, y: number) => new Phaser.Math.Vector2((x - 50) * u, (y - 50) * u);
  const poly = (colour: number, pts: [number, number][]) => {
    const v = pts.map(([x, y]) => P(x, y));
    g.fillStyle(colour, 1).fillPoints(v, true);
    g.lineStyle(line, ink, 1).strokePoints(v, true, true);
  };
  // The spout: a black tube up and to the left, with its collar where it meets the can.
  poly(black, [[30, 34], [14, 6], [24, 1], [42, 30]]);
  poly(black, [[24, 30], [48, 24], [52, 36], [28, 42]]);
  // The body, with the handle's block on top at the right.
  poly(red, [[54, 36], [59, 14], [87, 14], [93, 36]]);
  poly(red, [[20, 40], [26, 34], [90, 34], [96, 42], [96, 90], [90, 97], [26, 97], [20, 90]]);
  // The grip under the handle (a darker hollow).
  g.fillStyle(redDark, 1).fillPoints([P(66, 21), P(81, 21), P(84, 31), P(63, 31)], true);
  g.lineStyle(Math.max(1.5, 3 * u), ink, 1).strokePoints([P(66, 21), P(81, 21), P(84, 31), P(63, 31)], true, true);
  // The shaded right side and a highlight on the left.
  g.fillStyle(redDark, 1).fillPoints([P(82, 40), P(92, 44), P(92, 88), P(82, 92)], true);
  g.fillStyle(0xffffff, grey ? 0.25 : 0.35).fillRect((26 - 50) * u, (44 - 50) * u, 4 * u, 22 * u);
  // The label: yellow, with a dark drop on it (no words).
  poly(yellow, [[34, 54], [66, 54], [66, 88], [34, 88]]);
  g.fillStyle(ink, 1).fillCircle(0, (76 - 50) * u, 6 * u);
  g.fillTriangle((44 - 50) * u, (74 - 50) * u, (56 - 50) * u, (74 - 50) * u, 0, (60 - 50) * u);
}

/**
 * SCREAM-309: Gitty Up, from the PO's sketch (Personal Notes, November 14): a box truck pulling
 * away to the left, with a puff of exhaust behind it. Drawn like the gas can, on a 100 x 100 grid.
 */
export function drawGittyUp(g: Phaser.GameObjects.Graphics, size: number, grey: boolean): void {
  const u = size / 100;
  const ink = grey ? 0x6f6f6f : INK;
  const line = Math.max(2, 5 * u);
  const P = (x: number, y: number) => new Phaser.Math.Vector2((x - 50) * u, (y - 50) * u);
  const poly = (colour: number, pts: [number, number][]) => {
    const v = pts.map(([x, y]) => P(x, y));
    g.fillStyle(colour, 1).fillPoints(v, true);
    g.lineStyle(line, ink, 1).strokePoints(v, true, true);
  };
  const circle = (colour: number, x: number, y: number, r: number) => {
    g.fillStyle(colour, 1).fillCircle((x - 50) * u, (y - 50) * u, r * u);
    g.lineStyle(line, ink, 1).strokeCircle((x - 50) * u, (y - 50) * u, r * u);
  };
  // The puff of exhaust behind the truck.
  const puff = grey ? 0xd6d6d6 : 0xe6e2da;
  circle(puff, 86, 68, 8);
  circle(puff, 92, 56, 7);
  circle(puff, 82, 54, 7);
  g.lineStyle(line, ink, 1).lineBetween((70 - 50) * u, (70 - 50) * u, (78 - 50) * u, (66 - 50) * u);
  // The ground.
  g.lineStyle(line, ink, 1).lineBetween((2 - 50) * u, (88 - 50) * u, (74 - 50) * u, (88 - 50) * u);
  // The truck: a low cab at the front (left) with a sloping windscreen, then the box.
  poly(grey ? 0xeeeeee : 0xfff8ec, [[4, 76], [4, 56], [16, 52], [24, 32], [72, 28], [72, 76]]);
  g.fillStyle(grey ? 0xc4c4c4 : 0xf29bbd, 1).fillRect((30 - 50) * u, (56 - 50) * u, 42 * u, 7 * u);
  g.lineStyle(Math.max(1.5, 3 * u), ink, 1).lineBetween((30 - 50) * u, (32 - 50) * u, (30 - 50) * u, (76 - 50) * u);
  poly(grey ? 0xcfcfcf : 0x9fd8f2, [[17, 50], [25, 36], [30, 36], [30, 50]]);
  // The wheels.
  const tyre = grey ? 0x7d7d7d : 0x2a2622;
  const hub = grey ? 0xd0d0d0 : 0xcfd6dc;
  for (const x of [20, 58]) {
    circle(tyre, x, 78, 10);
    g.fillStyle(hub, 1).fillCircle((x - 50) * u, (78 - 50) * u, 4 * u);
  }
}

/**
 * SCREAM-310: Trot, from the PO's sketch (Personal Notes, November 14): someone leaning back in a
 * lounge chair with their hands behind their head and their feet up on a footstool. Drawn like the
 * gas can, on a 100 x 100 grid.
 */
export function drawTrot(g: Phaser.GameObjects.Graphics, size: number, grey: boolean): void {
  const u = size / 100;
  const ink = grey ? 0x6f6f6f : INK;
  const line = Math.max(2, 5 * u);
  const P = (x: number, y: number) => new Phaser.Math.Vector2((x - 50) * u, (y - 50) * u);
  const poly = (colour: number, pts: [number, number][]) => {
    const v = pts.map(([x, y]) => P(x, y));
    g.fillStyle(colour, 1).fillPoints(v, true);
    g.lineStyle(line, ink, 1).strokePoints(v, true, true);
  };
  const limb = (colour: number, pts: [number, number][], width: number) => {
    const v = pts.map(([x, y]) => P(x, y));
    g.lineStyle(width * u + line * 2, ink, 1).strokePoints(v, false, false);
    g.lineStyle(width * u, colour, 1).strokePoints(v, false, false);
    for (const p of v) g.fillStyle(colour, 1).fillCircle(p.x, p.y, (width * u) / 2);
  };
  const seat = grey ? 0xb5b5b5 : 0xd9622b;
  const legs = (pts: [number, number][]) => g.lineStyle(line, ink, 1).strokePoints(pts.map(([x, y]) => P(x, y)), false, false);
  // The footstool: a round cushion on two legs.
  legs([[12, 76], [7, 90]]);
  legs([[26, 76], [30, 90]]);
  g.fillStyle(seat, 1).fillEllipse((19 - 50) * u, (73 - 50) * u, 30 * u, 10 * u);
  g.lineStyle(line, ink, 1).strokeEllipse((19 - 50) * u, (73 - 50) * u, 30 * u, 10 * u);
  // The chair: a reclined back and seat in one piece, on a two-legged base.
  legs([[50, 86], [40, 97]]);
  legs([[56, 86], [66, 97]]);
  poly(seat, [[36, 84], [42, 76], [76, 30], [90, 36], [62, 86], [46, 90]]);
  // The person: legs out to the stool, the body leaning back, hands behind the head.
  limb(grey ? 0x8a8a8a : 0x3b5ba5, [[48, 72], [34, 68], [22, 66]], 7);
  g.fillStyle(grey ? 0x7d7d7d : 0x2a2622, 1).fillCircle((18 - 50) * u, (65 - 50) * u, 4.5 * u);
  limb(grey ? 0xa5a5a5 : 0xf2d14a, [[48, 72], [66, 40]], 10);
  limb(grey ? 0xc4c4c4 : 0xf2c49b, [[66, 40], [56, 30], [64, 18]], 5);
  const skin = grey ? 0xd0d0d0 : 0xf2c49b;
  g.fillStyle(skin, 1).fillCircle((71 - 50) * u, (24 - 50) * u, 10 * u);
  g.lineStyle(line, ink, 1).strokeCircle((71 - 50) * u, (24 - 50) * u, 10 * u);
}
