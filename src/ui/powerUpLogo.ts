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
  // The truck: a low cab at the front (left) with a sloping windscreen, then the box. The PO
  // (November 14, 02:36): leaning back more, "like a big truck will do": the body tilts back on
  // its rear wheel as it pulls away; the wheels stay on the ground.
  const tilt = (9 * Math.PI) / 180;
  const [cx, cy] = [58, 78];
  const T = (x: number, y: number): [number, number] => [
    cx + (x - cx) * Math.cos(tilt) - (y - cy) * Math.sin(tilt),
    cy + (x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt),
  ];
  const tilted = (colour: number, pts: [number, number][]) => poly(colour, pts.map(([x, y]) => T(x, y)));
  tilted(grey ? 0xeeeeee : 0xfff8ec, [[4, 72], [4, 54], [16, 50], [24, 30], [72, 26], [72, 72]]);
  const stripe = [T(30, 54), T(72, 54), T(72, 61), T(30, 61)].map(([x, y]) => P(x, y));
  g.fillStyle(grey ? 0xc4c4c4 : 0xf29bbd, 1).fillPoints(stripe, true);
  const [d0, d1] = [T(30, 30), T(30, 72)];
  g.lineStyle(Math.max(1.5, 3 * u), ink, 1).lineBetween((d0[0] - 50) * u, (d0[1] - 50) * u, (d1[0] - 50) * u, (d1[1] - 50) * u);
  tilted(grey ? 0xcfcfcf : 0x9fd8f2, [[17, 48], [25, 34], [30, 34], [30, 48]]);
  // The wheels.
  const tyre = grey ? 0x7d7d7d : 0x2a2622;
  const hub = grey ? 0xd0d0d0 : 0xcfd6dc;
  for (const x of [20, 58]) {
    circle(tyre, x, 78, 10);
    g.fillStyle(hub, 1).fillCircle((x - 50) * u, (78 - 50) * u, 4 * u);
  }
}

/**
 * SCREAM-310: Trot. The PO (November 14, 02:35) wanted "a more cartoonish version" of a trotting
 * horse outline icon he found (his first sketch was someone with their feet up). Engineering's own
 * drawing, not a copy: a brown horse side-on, at a trot (redrawn from his sketches, 02:55 and 03:03),
 * in the gas can's style, on a 100 x 100 grid.
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
  const coat = grey ? 0xb5b5b5 : 0xb7743f;
  const coatFar = grey ? 0x9a9a9a : 0x8f5a2f;
  const hair = grey ? 0x7d7d7d : 0x4a2c17;
  const hoof = grey ? 0x6f6f6f : 0x2a2622;
  // A leg: a thick outlined line through its joints, with a hoof at the end.
  const leg = (colour: number, pts: [number, number][]) => {
    const v = pts.map(([x, y]) => P(x, y));
    const w = 6 * u;
    g.lineStyle(w + line * 2, ink, 1).strokePoints(v, false, false);
    for (const p of v) g.fillStyle(ink, 1).fillCircle(p.x, p.y, w / 2 + line);
    g.lineStyle(w, colour, 1).strokePoints(v, false, false);
    for (const p of v) g.fillStyle(colour, 1).fillCircle(p.x, p.y, w / 2);
    const end = v[v.length - 1];
    g.fillStyle(hoof, 1).fillRect(end.x - 4.5 * u, end.y, 9 * u, 5 * u);
  };
  // PO's sketch (November 14, 03:03, "Trot horse 2" in Personal Notes): facing right, the head held
  // high on an upright neck, a long tail hanging down, one back leg stretched far behind, a front
  // leg reaching forward, and the other two tucked under.
  // The legs on the far side, darker, tucked under.
  leg(coatFar, [[36, 58], [37, 72], [45, 84]]);
  leg(coatFar, [[60, 60], [61, 72], [55, 84]]);
  // The long tail, hanging down from the rump.
  poly(hair, [[24, 40], [13, 47], [8, 64], [10, 80], [17, 76], [18, 60], [25, 50]]);
  // The body, the upright neck and the head (facing right).
  g.fillStyle(coat, 1).fillEllipse((45 - 50) * u, (51 - 50) * u, 50 * u, 22 * u);
  g.lineStyle(line, ink, 1).strokeEllipse((45 - 50) * u, (51 - 50) * u, 50 * u, 22 * u);
  poly(coat, [[57, 46], [61, 24], [67, 12], [78, 16], [73, 32], [72, 56]]);
  poly(coat, [[66, 12], [76, 8], [90, 18], [94, 26], [88, 29], [74, 24]]);
  poly(coat, [[69, 11], [71, 2], [77, 9]]);
  // The mane, down the back of the neck.
  poly(hair, [[56, 44], [60, 23], [66, 12], [64, 28], [61, 46]]);
  // The eye and the nostril.
  g.fillStyle(ink, 1).fillCircle((80 - 50) * u, (16 - 50) * u, 2.6 * u);
  g.fillStyle(ink, 1).fillCircle((91 - 50) * u, (25 - 50) * u, 1.6 * u);
  // The legs on the near side: the back one stretched far behind, the front one reaching forward.
  leg(coat, [[28, 56], [17, 72], [9, 87]]);
  leg(coat, [[66, 58], [77, 70], [86, 84]]);
}
