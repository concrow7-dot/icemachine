import type { MapRoad } from '../config/mapTypes';
import { AWAY_ROUNDABOUT_COST, AWAY_ADULT_EARLY_SHARE, AWAY_ADULT_EARLY_UNTIL_MINUTE, AWAY_BACK_YARD_COST, AWAY_EDGE_MARGIN, AWAY_FIRST_HOME_MINUTE, AWAY_LAST_HOME_MINUTE } from '../config/tuning';

/**
 * SCREAM-379 (PO, November 17): "the days people aren't home (marked in the residents sheet),
 * they don't show up on their property ... those people slowly arrive home throughout the
 * evening ... they should come from the edge of the map and make there way home. Starting at
 * 5:30 they should start getting home, especially the adults."
 *
 * The pure parts (no Phaser, unit-tested): when someone who is away appears at the map's edge,
 * and the way they walk from there to their own curb. `Residents.sendAway` uses both.
 */
export type Point = [number, number];

/** The dice for who is away how long, one evening: from the Story run's seed and the day (its own, so other dice are left alone). */
export function awayDice(seed: number, day: number): () => number {
  let a = (Math.imul(seed ^ 0x51ed270b, 2654435761) ^ Math.imul(day + 379, 2246822507)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The minute (since midnight) someone who is away appears at the map's edge. Adults mostly in
 * the first hour from 5:30; kids any time from 5:30 to 7:30.
 */
export function arrivalMinute(kid: boolean, dice: () => number): number {
  const early = !kid && dice() < AWAY_ADULT_EARLY_SHARE;
  const [low, high] = early ? [AWAY_FIRST_HOME_MINUTE, AWAY_ADULT_EARLY_UNTIL_MINUTE] : kid ? [AWAY_FIRST_HOME_MINUTE, AWAY_LAST_HOME_MINUTE] : [AWAY_ADULT_EARLY_UNTIL_MINUTE, AWAY_LAST_HOME_MINUTE];
  return Math.round(low + dice() * (high - low));
}

/** How far from `p` along the unit direction `d` until the map (plus `margin` all round) is left. */
function toBorder(p: Point, d: Point, width: number, height: number, margin: number): number {
  let t = Infinity;
  if (d[0] > 1e-9) t = Math.min(t, (width + margin - p[0]) / d[0]);
  if (d[0] < -1e-9) t = Math.min(t, (-margin - p[0]) / d[0]);
  if (d[1] > 1e-9) t = Math.min(t, (height + margin - p[1]) / d[1]);
  if (d[1] < -1e-9) t = Math.min(t, (-margin - p[1]) / d[1]);
  return Math.max(0, t);
}

const pathLength = (pts: Point[]): number => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) : 0), 0);

/**
 * The way home on foot from the map's edge: the points to walk through, the first just outside
 * the map, the last where they stand at their own curb (the door comes after).
 *
 * They come along their own street's sidewalk, on their side of it, from whichever end of the
 * street is nearer the edge; or straight in behind their house, or straight across the street
 * to it, when the edge is much nearer that way (the houses along the outside of the map).
 */
export function walkInRoute(
  person: { door: readonly number[]; curb: readonly number[] },
  roads: readonly MapRoad[],
  size: { width: number; height: number },
  margin = AWAY_EDGE_MARGIN,
): Point[] {
  const stand: Point = [person.curb[0]!, person.curb[1]!];
  const square: Point = [person.curb[2] ?? stand[0], person.curb[3] ?? stand[1]];
  const door: Point = [person.door[0]!, person.door[1]!];
  // Their street: the stretch of road nearest their pink square (a roundabout is nobody's street).
  let best: { road: MapRoad; k: number; d: number } | null = null;
  for (const road of roads) {
    if (road.ring) continue;
    const p = road.points;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k]!, ay = p[k + 1]!, bx = p[k + 2]!, by = p[k + 3]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((square[0] - ax) * (bx - ax) + (square[1] - ay) * (by - ay)) / len2));
      const d = Math.hypot(square[0] - (ax + t * (bx - ax)), square[1] - (ay + t * (by - ay)));
      if (!best || d < best.d) best = { road, k, d };
    }
  }
  if (!best) return [[door[0], size.height + margin], stand];
  const pts: Point[] = [];
  for (let i = 0; i + 1 < best.road.points.length; i += 2) pts.push([best.road.points[i]!, best.road.points[i + 1]!]);
  const seg = best.k / 2;
  const a = pts[seg]!;
  const b = pts[seg + 1]!;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const ul = Math.hypot(ux, uy) || 1;
  // Which side of the street they stand on (+1 = to the right of a to b), and how far from its middle.
  const cross = (ux * (stand[1] - a[1]) - uy * (stand[0] - a[0])) / ul;
  const side = cross >= 0 ? 1 : -1;
  const off = Math.abs(cross);
  /** A point of the street's middle, moved onto their sidewalk beside the stretch from `p` to `q`. */
  const beside = (at: Point, p: Point, q: Point): Point => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    return [at[0] + (-dy / l) * side * off, at[1] + (dx / l) * side * off];
  };
  /** From the stand along the street toward its end (`forward`) or its start, then straight on to the map's edge. */
  const along = (forward: boolean): Point[] => {
    const out: Point[] = [stand];
    let lastDir: Point = forward ? [ux / ul, uy / ul] : [-ux / ul, -uy / ul];
    if (forward) {
      for (let i = seg + 1; i < pts.length; i++) {
        out.push(beside(pts[i]!, pts[i - 1]!, pts[i]!));
        const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]) || 1;
        lastDir = [(pts[i]![0] - pts[i - 1]![0]) / l, (pts[i]![1] - pts[i - 1]![1]) / l];
      }
    } else {
      for (let i = seg; i >= 0; i--) {
        out.push(beside(pts[i]!, pts[i]!, pts[i + 1]!));
        const l = Math.hypot(pts[i]![0] - pts[i + 1]![0], pts[i]![1] - pts[i + 1]![1]) || 1;
        lastDir = [(pts[i]![0] - pts[i + 1]![0]) / l, (pts[i]![1] - pts[i + 1]![1]) / l];
      }
    }
    const end = out[out.length - 1]!;
    const t = toBorder(end, lastDir, size.width, size.height, margin);
    out.push([end[0] + lastDir[0] * t, end[1] + lastDir[1] * t]);
    return out;
  };
  // Straight in behind the house: away from the street, through the door.
  const nx = (-uy / ul) * side;
  const ny = (ux / ul) * side;
  const back: Point[] = [stand, door, [door[0] + nx * toBorder(door, [nx, ny], size.width, size.height, margin), door[1] + ny * toBorder(door, [nx, ny], size.width, size.height, margin)]];
  // Straight across the street from the far side (a house that faces the edge of the map).
  const across = toBorder(stand, [-nx, -ny], size.width, size.height, margin);
  const front: Point[] = [stand, [stand[0] - nx * across, stand[1] - ny * across]];
  const choices = [
    { path: along(true), cost: 1 },
    { path: along(false), cost: 1 },
    { path: back, cost: AWAY_BACK_YARD_COST },
    { path: front, cost: AWAY_BACK_YARD_COST },
  ];
  // Nobody walks across the middle of a roundabout: a way that does counts as much longer.
  // (Crossing its road near the outside, where a street's sidewalk runs on past it, is fine.)
  const rings = roads.flatMap((r) => (r.ring ? [{ x: r.ring.x, y: r.ring.y, reach: r.ring.r - 30 }] : []));
  const crossesRing = (path: Point[]): boolean =>
    path.some((p, i) => {
      if (!i) return false;
      const q = path[i - 1]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 20));
      for (let k = 0; k <= steps; k++) {
        const x = q[0] + ((p[0] - q[0]) * k) / steps;
        const y = q[1] + ((p[1] - q[1]) * k) / steps;
        if (rings.some((g) => Math.hypot(x - g.x, y - g.y) < g.reach)) return true;
      }
      return false;
    });
  for (const c of choices) if (crossesRing(c.path)) c.cost *= AWAY_ROUNDABOUT_COST;
  choices.sort((p, q) => pathLength(p.path) * p.cost - pathLength(q.path) * q.cost);
  // Points that are already outside the map are dropped, but for the one they appear at.
  const path = choices[0]!.path.slice().reverse();
  const inside = (p: Point) => p[0] >= 0 && p[0] <= size.width && p[1] >= 0 && p[1] <= size.height;
  while (path.length > 2 && !inside(path[1]!)) path.shift();
  return path;
}
