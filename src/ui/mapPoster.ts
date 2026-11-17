import * as Phaser from 'phaser';
import { MAPS } from '../config/maps';
import { mapMarks, mapView } from '../state/MapMarks';

// SCREAM-377 (PO, November 16, 22:59, with a pen sketch of the poster drawn slanted, as the wall
// is): "I want the map to look like it is a part of the truck more. Use the elm park map on the
// map. Also make the map feel a bit worn. Maybe an edge is bent." The poster on the truck's wall:
// drawn in the wall's perspective (taller on the side nearer the viewer), in the truck drawing's
// grey outlines, on aged paper with fold lines, a stain, tape, and its bottom corner bent up.
// "MAP" and Elm Park's own streets are drawn on it in pen strokes, so they slant with the paper.

/** The poster's corners on the 960 x 540 screen: top left, top right, bottom right, bottom left. */
export const MAP_POSTER_QUAD: readonly [number, number][] = [
  [769, 160],
  [842, 147],
  [843, 266],
  [770, 247],
];

const PAPER = 0xf5eedb;
const PAPER_SHADE = 0xd6c8a2;
const FOLD_BACK = 0xcdbf98;
const EDGE = 0xa9a9a9; // the truck drawing's grey outlines
const INK = 0x5a4a3a;
const MARKER = 0xb3261e;

/** A point on the paper: u across (0 left, 1 right), v down (0 top, 1 bottom). */
function on(u: number, v: number): Phaser.Math.Vector2 {
  const [tl, tr, br, bl] = MAP_POSTER_QUAD as [[number, number], [number, number], [number, number], [number, number]];
  const topX = tl[0] + (tr[0] - tl[0]) * u;
  const topY = tl[1] + (tr[1] - tl[1]) * u;
  const botX = bl[0] + (br[0] - bl[0]) * u;
  const botY = bl[1] + (br[1] - bl[1]) * u;
  return new Phaser.Math.Vector2(topX + (botX - topX) * v, topY + (botY - topY) * v);
}

function stroke(g: Phaser.GameObjects.Graphics, points: [number, number][]): void {
  g.strokePoints(points.map(([u, v]) => on(u, v)), false);
}

/** How far up the right edge, and in along the bottom edge, the bent corner starts. */
const BEND = { v: 0.84, u: 0.74 };

/** The paper's outline with its bottom right corner bent up: u, v pairs, clockwise from the top left. */
export const MAP_POSTER_OUTLINE: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, BEND.v],
  [BEND.u, 1],
  [0, 1],
];

/** The outline on screen, x, y pairs: what the truck screen's click zone uses. */
export function mapPosterPoints(): number[] {
  return MAP_POSTER_OUTLINE.flatMap(([u, v]) => {
    const p = on(u, v);
    return [Math.round(p.x), Math.round(p.y)];
  });
}

export function drawMapPoster(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const outline = MAP_POSTER_OUTLINE.map(([u, v]) => on(u, v));

  // A soft shadow on the wall, then the paper.
  g.fillStyle(0x000000, 0.12).fillPoints(outline.map((p) => new Phaser.Math.Vector2(p.x + 2, p.y + 3)), true);
  g.fillStyle(PAPER, 1).fillPoints(outline, true);
  // Worn: darker toward the bottom, a ring left by a cup, and a few specks.
  g.fillStyle(PAPER_SHADE, 0.55).fillPoints([on(0, 0.7), on(1, 0.62), on(1, BEND.v), on(BEND.u, 1), on(0, 1)], true);
  const ring = on(0.27, 0.8);
  g.lineStyle(2, 0xb89a6a, 0.45).strokeEllipse(ring.x, ring.y, 17, 13);
  g.fillStyle(0xb89a6a, 0.5);
  for (const [u, v] of [[0.82, 0.12], [0.12, 0.3], [0.66, 0.9], [0.9, 0.5], [0.4, 0.05]] as [number, number][]) {
    const p = on(u, v);
    g.fillRect(p.x, p.y, 2, 2);
  }
  // Fold lines: it spent years folded in the glove box.
  g.lineStyle(1.5, 0xbfb08a, 0.9);
  stroke(g, [[0, 0.335], [0.5, 0.33], [1, 0.335]]);
  stroke(g, [[0.5, 0], [0.505, 0.5], [0.5, 1]]);
  g.lineStyle(1, 0xfaf3dc, 0.9);
  stroke(g, [[0, 0.345], [1, 0.345]]);

  // "MAP", in marker strokes.
  g.lineStyle(2.6, MARKER, 1);
  const letter = (left: number, right: number, shape: [number, number][]) => stroke(g, shape.map(([x, y]) => [left + (right - left) * x, 0.09 + 0.19 * y]));
  letter(0.16, 0.38, [[0, 1], [0.05, 0], [0.5, 0.62], [0.95, 0], [1, 1]]);
  letter(0.44, 0.64, [[0, 1], [0.5, 0], [1, 1]]);
  letter(0.44, 0.64, [[0.24, 0.6], [0.78, 0.6]]);
  letter(0.7, 0.86, [[0, 1], [0, 0], [0.7, 0], [1, 0.25], [0.7, 0.52], [0, 0.52]]);

  // Elm Park's streets, in pen ("Use the elm park map on the map").
  const data = MAPS.tutorial.data;
  const view = mapView(data, 60);
  const box = { u: 0.13, v: 0.4, w: 0.74, h: 0.42 };
  // The paper is taller than it is wide on screen, so u and v are not the same length: keep the map's own shape.
  const tall = 1.5; // the poster's height over its width
  const scaleU = Math.min(box.w / view.w, (box.h * tall) / view.h);
  const scaleV = scaleU / tall;
  const offU = box.u + (box.w - view.w * scaleU) / 2;
  const offV = box.v + (box.h - view.h * scaleV) / 2;
  const at = (x: number, y: number): [number, number] => [offU + (x - view.x) * scaleU, offV + (y - view.y) * scaleV];
  g.lineStyle(1.6, INK, 1);
  for (const road of data.roads) {
    if (road.ring) {
      const c = on(...at(road.ring.x, road.ring.y));
      g.strokeCircle(c.x, c.y, 2.2);
      continue;
    }
    const points: [number, number][] = [];
    for (let i = 0; i < road.points.length; i += 2) points.push(at(road.points[i]!, road.points[i + 1]!));
    stroke(g, points);
  }
  // Home, circled in marker, and the park shaded.
  const marks = mapMarks(data);
  if (marks.home) {
    const h = on(...at(marks.home.x, marks.home.y));
    g.fillStyle(MARKER, 1).fillCircle(h.x, h.y, 2.4);
  }
  for (const park of marks.parks) {
    const p = on(...at(park.x, park.y));
    g.fillStyle(0x6fa86f, 0.8).fillRect(p.x - 3, p.y - 2, 6, 5);
  }

  // The bent corner: folded up over the front, its back a shade darker, with a crease.
  const a = on(1, BEND.v);
  const b = on(BEND.u, 1);
  const tip = new Phaser.Math.Vector2(a.x + b.x - on(1, 1).x, a.y + b.y - on(1, 1).y); // the corner, folded over the crease
  g.fillStyle(0x000000, 0.14).fillPoints([a, b, new Phaser.Math.Vector2(tip.x - 2, tip.y + 2)], true);
  g.fillStyle(FOLD_BACK, 1).fillPoints([a, b, tip], true);
  g.lineStyle(2, EDGE, 1).strokePoints([a, tip, b], false);

  // The paper's edge, in the truck drawing's grey.
  g.lineStyle(3, EDGE, 1).strokePoints(outline, true, true);

  // Yellowed tape at the top corners.
  for (const [u, tilt] of [[0.1, -0.5], [0.9, 0.45]] as [number, number][]) {
    const p = on(u, 0);
    const dx = Math.cos(tilt) * 8;
    const dy = Math.sin(tilt) * 8;
    g.lineStyle(7, 0xf3e7a6, 0.85).lineBetween(p.x - dx, p.y - dy - 1, p.x + dx, p.y + dy - 1);
  }
  return g;
}
