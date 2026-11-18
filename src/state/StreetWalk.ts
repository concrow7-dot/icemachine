import type { MapRoad } from '../config/mapTypes';
import { AWAY_EDGE_MARGIN, WALKER_EXIT_REACH, WALKER_JOIN_REACH, WALKER_RING_CLEAR, WALKER_SIDEWALK_GAP } from '../config/tuning';

/**
 * SCREAM-394 (PO, November 17): "a few people who are randomly walking up and down the streets of
 * the elm park map ... They can come from the edge map and walk around awhile before they leave."
 *
 * The pure part (no Phaser, unit-tested): the streets as a web of sidewalks. A walker goes from one
 * stop to the next (a stop is a corner: where two streets meet, or a street's end), on one side of
 * the street, and at each stop picks a way on. They come in and go out where a street's end is near
 * the map's edge, walking straight on past it. `Residents` moves the people.
 */
export type Point = [number, number];

/** A stop on a street: which street, how far along it (px from its first point), and which sidewalk (+1 = right of first to last). */
export interface WalkSpot {
  road: number;
  t: number;
  side: 1 | -1;
}

/** One stretch of a walk: the points to walk through and the stop it ends at (`out`: it ends off the map). */
export interface WalkLeg {
  route: Point[];
  to: WalkSpot;
  out?: boolean;
}

interface Street {
  pts: Point[];
  cum: number[];
  length: number;
  /** From the street's middle to the middle of its sidewalk. */
  off: number;
  /** Where the corners are, px along the street, in order (its two ends included). */
  stops: number[];
}

const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export class StreetNet {
  readonly streets: Street[] = [];
  /** The street ends near the map's edge: where walkers come in and go out. */
  readonly exits: { road: number; t: number; dir: Point; reach: number }[] = [];

  private readonly size: { width: number; height: number };
  private readonly margin: number;

  constructor(roads: readonly MapRoad[], size: { width: number; height: number }, margin = AWAY_EDGE_MARGIN) {
    this.size = size;
    this.margin = margin;
    // Nobody walks through a roundabout: no corner inside one, and no way in or out across one.
    const rings = roads.flatMap((r) => (r.ring ? [{ at: [r.ring.x, r.ring.y] as Point, reach: r.ring.r + WALKER_RING_CLEAR }] : []));
    const inRing = (p: Point): boolean => rings.some((g) => dist(g.at, p) < g.reach);
    const crossesRing = (p: Point, d: Point, far: number): boolean =>
      rings.some((g) => {
        const f = Math.max(0, Math.min(far, (g.at[0] - p[0]) * d[0] + (g.at[1] - p[1]) * d[1]));
        return dist(g.at, [p[0] + d[0] * f, p[1] + d[1] * f]) < g.reach;
      });
    for (const road of roads) {
      if (road.ring) continue; // nobody strolls round a roundabout
      const pts: Point[] = [];
      for (let i = 0; i + 1 < road.points.length; i += 2) pts.push([road.points[i]!, road.points[i + 1]!]);
      if (pts.length < 2) continue;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
      this.streets.push({ pts, cum, length: cum[cum.length - 1]!, off: (road.lanes ?? 1) * 60 + WALKER_SIDEWALK_GAP, stops: [] });
    }
    // The corners: a street's own ends, and wherever another street's end comes up to it.
    this.streets.forEach((s, i) => {
      const stops = [0, s.length];
      this.streets.forEach((o, j) => {
        if (i === j) return;
        for (const end of [o.pts[0]!, o.pts[o.pts.length - 1]!]) {
          const near = this.nearest(i, end);
          if (near.d <= WALKER_JOIN_REACH && stops.every((t) => Math.abs(t - near.t) > WALKER_JOIN_REACH)) stops.push(near.t);
        }
      });
      s.stops = stops.sort((a, b) => a - b).filter((t) => !inRing(this.middle(i, t)));
    });
    // The ways in and out: a street end from which straight on soon leaves the map.
    this.streets.forEach((s, road) => {
      if (s.stops.length < 2) return;
      for (const t of [s.stops[0]!, s.stops[s.stops.length - 1]!]) {
        const [, dir] = this.at(road, t);
        const out: Point = t === s.stops[0] ? [-dir[0], -dir[1]] : dir;
        const reach = this.toBorder(this.middle(road, t), out);
        if (reach <= WALKER_EXIT_REACH && !crossesRing(this.middle(road, t), out, reach)) this.exits.push({ road, t, dir: out, reach });
      }
    });
  }

  /** The middle of a street `t` px along it, and the way the street runs there (a unit vector). */
  private at(road: number, t: number): [Point, Point] {
    const s = this.streets[road]!;
    const u = Math.max(0, Math.min(s.length, t));
    let k = 1;
    while (k < s.cum.length - 1 && s.cum[k]! < u) k++;
    const a = s.pts[k - 1]!;
    const b = s.pts[k]!;
    const len = s.cum[k]! - s.cum[k - 1]! || 1;
    const f = (u - s.cum[k - 1]!) / len;
    return [
      [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
      [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    ];
  }

  middle(road: number, t: number): Point {
    return this.at(road, t)[0];
  }

  /** Where someone at this stop stands: on the sidewalk beside the street. */
  stand(spot: WalkSpot): Point {
    const [p, d] = this.at(spot.road, spot.t);
    const off = this.streets[spot.road]!.off * spot.side;
    return [p[0] - d[1] * off, p[1] + d[0] * off];
  }

  /** The point of a street nearest `p`: how far along it, and how far away. */
  private nearest(road: number, p: Point): { t: number; d: number } {
    const s = this.streets[road]!;
    let best = { t: 0, d: Infinity };
    for (let k = 1; k < s.pts.length; k++) {
      const a = s.pts[k - 1]!;
      const b = s.pts[k]!;
      const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
      const f = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2));
      const d = Math.hypot(p[0] - (a[0] + (b[0] - a[0]) * f), p[1] - (a[1] + (b[1] - a[1]) * f));
      if (d < best.d) best = { t: s.cum[k - 1]! + f * (s.cum[k]! - s.cum[k - 1]!), d };
    }
    return best;
  }

  /** How far from `p` along the unit direction `d` until the map is left. */
  private toBorder(p: Point, d: Point): number {
    let t = Infinity;
    if (d[0] > 1e-9) t = Math.min(t, (this.size.width - p[0]) / d[0]);
    if (d[0] < -1e-9) t = Math.min(t, -p[0] / d[0]);
    if (d[1] > 1e-9) t = Math.min(t, (this.size.height - p[1]) / d[1]);
    if (d[1] < -1e-9) t = Math.min(t, -p[1] / d[1]);
    return Math.max(0, t);
  }

  /** The way in or out through an exit that this stop is at, if it is at one. */
  private exitAt(spot: WalkSpot): { road: number; t: number; dir: Point; reach: number } | undefined {
    return this.exits.find((e) => e.road === spot.road && Math.abs(e.t - spot.t) < 1);
  }

  /** The point off the map beyond an exit, for someone on this side of the street. */
  private beyond(spot: WalkSpot, exit: { dir: Point }): Point {
    const [x, y] = this.stand(spot);
    const far = this.toBorder([x, y], exit.dir) + this.margin; // from where they stand (the sidewalk), not the street's middle
    return [x + exit.dir[0] * far, y + exit.dir[1] * far];
  }

  /** Someone new: where they appear (just off the map) and the stop they walk to first. */
  enter(dice: () => number): { from: Point; leg: WalkLeg } {
    const exit = this.exits[Math.floor(dice() * this.exits.length)]!;
    const to: WalkSpot = { road: exit.road, t: exit.t, side: dice() < 0.5 ? 1 : -1 };
    return { from: this.beyond(to, exit), leg: { route: [this.stand(to)], to } };
  }

  /** A stop somewhere on the streets (for the walkers already out at the start of the evening). */
  anywhere(dice: () => number): WalkSpot {
    const usable = this.streets.map((s, i) => (s.stops.length >= 2 ? i : -1)).filter((i) => i >= 0);
    const road = usable[Math.floor(dice() * usable.length)]!;
    const stops = this.streets[road]!.stops;
    return { road, t: stops[Math.floor(dice() * stops.length)]!, side: dice() < 0.5 ? 1 : -1 };
  }

  /** The stops that can be walked to from this one: along its own street, or along a street that meets it here. */
  private ways(spot: WalkSpot, from: Point): WalkLeg[] {
    const here = this.middle(spot.road, spot.t);
    const legs: WalkLeg[] = [];
    this.streets.forEach((s, road) => {
      let t: number;
      if (road === spot.road) t = spot.t;
      else {
        const near = this.nearest(road, here);
        if (near.d > WALKER_JOIN_REACH) return;
        t = near.t;
      }
      // The stop on this street that is here (its corner with the street they are on).
      const at = s.stops.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), s.stops[0]!);
      const k = s.stops.indexOf(at);
      for (const next of [s.stops[k + 1], s.stops[k - 1]]) {
        if (next === undefined) continue;
        // Whichever sidewalk is nearer to where they are standing.
        const sides: (1 | -1)[] = road === spot.road ? [spot.side] : [1, -1];
        const side = sides.reduce((best, x) => (dist(this.stand({ road, t: at, side: x }), from) < dist(this.stand({ road, t: at, side: best }), from) ? x : best), sides[0]!);
        const route: Point[] = [];
        const start = this.stand({ road, t: at, side });
        if (dist(start, from) > 1) route.push(start);
        // A street with bends: round each bend on the way.
        const [lo, hi] = at < next ? [at, next] : [next, at];
        const bends = s.cum.filter((c) => c > lo + 1 && c < hi - 1);
        for (const c of at < next ? bends : bends.reverse()) route.push(this.stand({ road, t: c, side }));
        route.push(this.stand({ road, t: next, side }));
        legs.push({ route, to: { road, t: next, side } });
      }
    });
    return legs;
  }

  /**
   * The next stretch for someone standing at `spot` (at `from`), who came from `prev`. Wandering:
   * any way on but straight back, picked by `dice`. `leaving`: out through this stop's exit if it has
   * one, else the way on that ends nearest an exit.
   */
  next(spot: WalkSpot, prev: WalkSpot | undefined, from: Point, dice: () => number, leaving: boolean): WalkLeg {
    if (leaving) {
      const exit = this.exitAt(spot);
      if (exit) return { route: [this.beyond(spot, exit)], to: spot, out: true };
    }
    const all = this.ways(spot, from);
    const back = (leg: WalkLeg): boolean => !!prev && leg.to.road === prev.road && Math.abs(leg.to.t - prev.t) < 1;
    const onward = all.filter((leg) => !back(leg));
    const pool = onward.length ? onward : all;
    if (pool.length === 0) return { route: [this.nearestEdge(from)], to: spot, out: true };
    if (!leaving) return pool[Math.floor(dice() * pool.length)]!;
    const far = (leg: WalkLeg): number => Math.min(...this.exits.map((e) => dist(this.middle(e.road, e.t), this.middle(leg.to.road, leg.to.t))));
    return pool.reduce((best, leg) => (far(leg) < far(best) ? leg : best), pool[0]!);
  }

  /** The nearest point just off the map (for someone who can't find a street out). */
  nearestEdge(p: Point): Point {
    const m = this.margin;
    const ways: [number, Point][] = [
      [p[0], [-m, p[1]]],
      [this.size.width - p[0], [this.size.width + m, p[1]]],
      [p[1], [p[0], -m]],
      [this.size.height - p[1], [p[0], this.size.height + m]],
    ];
    return ways.reduce((best, w) => (w[0] < best[0] ? w : best), ways[0]!)[1];
  }
}

/** The dice for who walks the streets when, one evening: from the Story run's seed and the day (its own, so other dice are left alone). */
export function walkerDice(seed: number, day: number): () => number {
  let a = (Math.imul(seed ^ 0x2f6b9d31, 2654435761) ^ Math.imul(day + 394, 2246822507)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
