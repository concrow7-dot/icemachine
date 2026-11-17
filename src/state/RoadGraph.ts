import type { MapRoad, RoadMask } from '../config/mapTypes';

/**
 * SCREAM-380 (PO, November 17: "Drive in by car"): the streets as a web of junctions, so a
 * resident's car can find its way from the edge of the map to its parking spot.
 *
 * Pure maths, no Phaser (unit-tested). Positions are map pixels; angles are degrees (0 = right,
 * 90 = down), the way a car's heading is measured.
 *
 * - A junction is wherever two streets cross, or one street's end meets another street.
 * - A roundabout is one-way (the way traffic that keeps right goes round), and the bit of a
 *   street drawn under its island is not a road.
 * - A way in is wherever the asphalt runs off the edge of the map (read from the road mask).
 */
export type Point = [number, number];

interface Edge {
  from: number;
  to: number;
  length: number;
  /** The street (index into the roads) this stretch belongs to; -1 for the way in from the edge. */
  road: number;
}

/** Points nearer than this are one junction, px. */
const MERGE = 34;
/** A street's end this near another street's line joins it, px. */
const JOIN = 48;
/** How far outside the map a car starts, px. */
const OUTSIDE = 90;
/** The way in joins the nearest junction within this distance of where the asphalt meets the edge, px. */
const ENTRY_REACH = 420;

export class RoadGraph {
  readonly nodes: Point[] = [];
  private readonly edges: Edge[] = [];
  private readonly out: number[][] = [];
  /** Where cars come onto the map: a node just outside it, for each place the asphalt meets the edge. */
  readonly entries: number[] = [];
  private readonly roads: readonly MapRoad[];

  constructor(roads: readonly MapRoad[], size: { width: number; height: number }, mask?: RoadMask) {
    this.roads = roads;
    const rings = roads.flatMap((r) => (r.ring ? [r.ring] : []));
    // Each street as its corner points.
    const lines: Point[][] = roads.map((r) => {
      const pts: Point[] = [];
      for (let i = 0; i + 1 < r.points.length; i += 2) pts.push([r.points[i]!, r.points[i + 1]!]);
      return pts;
    });
    // Where each stretch (street i, from corner k to k + 1) is cut by a junction: how far along it, 0 to 1.
    const cuts = new Map<string, number[]>();
    const cut = (i: number, k: number, t: number) => {
      const key = `${i}:${k}`;
      const list = cuts.get(key);
      if (list) list.push(t);
      else cuts.set(key, [t]);
    };
    for (let i = 0; i < lines.length; i++) {
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue;
        const a = lines[i]!;
        const b = lines[j]!;
        for (let k = 0; k + 1 < a.length; k++) {
          for (let m = 0; m + 1 < b.length; m++) {
            // Crossing stretches (each pair once).
            if (i < j) {
              const hit = crossing(a[k]!, a[k + 1]!, b[m]!, b[m + 1]!);
              if (hit) {
                cut(i, k, hit[0]);
                cut(j, m, hit[1]);
                continue;
              }
            }
          }
          // An end of street j that stops at (or just short of) this stretch of street i.
          for (const end of [b[0]!, b[b.length - 1]!]) {
            const t = along(a[k]!, a[k + 1]!, end);
            if (t <= 0 || t >= 1) continue;
            const px = a[k]![0] + (a[k + 1]![0] - a[k]![0]) * t;
            const py = a[k]![1] + (a[k + 1]![1] - a[k]![1]) * t;
            if (Math.hypot(end[0] - px, end[1] - py) <= JOIN) cut(i, k, t);
          }
        }
      }
    }
    const node = (p: Point): number => {
      for (let n = 0; n < this.nodes.length; n++) {
        if (Math.hypot(this.nodes[n]![0] - p[0], this.nodes[n]![1] - p[1]) <= MERGE) return n;
      }
      this.nodes.push([p[0], p[1]]);
      this.out.push([]);
      return this.nodes.length - 1;
    };
    const link = (from: number, to: number, road: number) => {
      if (from === to) return;
      const length = Math.hypot(this.nodes[to]![0] - this.nodes[from]![0], this.nodes[to]![1] - this.nodes[from]![1]);
      this.out[from]!.push(this.edges.length);
      this.edges.push({ from, to, length, road });
    };
    lines.forEach((pts, i) => {
      const ring = roads[i]!.ring;
      // A street's ends that stop just short of another street are pulled onto it (the same junction).
      for (let k = 0; k + 1 < pts.length; k++) {
        const ts = [0, ...(cuts.get(`${i}:${k}`) ?? []).sort((x, y) => x - y), 1];
        for (let n = 0; n + 1 < ts.length; n++) {
          const p: Point = [pts[k]![0] + (pts[k + 1]![0] - pts[k]![0]) * ts[n]!, pts[k]![1] + (pts[k + 1]![1] - pts[k]![1]) * ts[n]!];
          const q: Point = [pts[k]![0] + (pts[k + 1]![0] - pts[k]![0]) * ts[n + 1]!, pts[k]![1] + (pts[k + 1]![1] - pts[k]![1]) * ts[n + 1]!];
          if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1) continue;
          const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          if (ring) {
            // One way round: for traffic that keeps right, with the island on the left.
            const turn = (p[0] - ring.x) * (q[1] - ring.y) - (p[1] - ring.y) * (q[0] - ring.x);
            if (turn < 0) link(node(p), node(q), i);
            else link(node(q), node(p), i);
            continue;
          }
          // Under a roundabout's island there is no street.
          if (rings.some((g) => Math.hypot(mid[0] - g.x, mid[1] - g.y) < g.r - 10)) continue;
          const a = node(p);
          const b = node(q);
          link(a, b, i);
          link(b, a, i);
        }
      }
    });
    // Street ends that stop just short of another street: joined to the nearest junction on it.
    lines.forEach((pts, i) => {
      if (roads[i]!.ring) return;
      for (const end of [pts[0]!, pts[pts.length - 1]!]) {
        const here = node(end);
        let best = -1;
        let bestD = JOIN;
        for (let n = 0; n < this.nodes.length; n++) {
          if (n === here) continue;
          const d = Math.hypot(this.nodes[n]![0] - end[0], this.nodes[n]![1] - end[1]);
          if (d < bestD && !this.out[here]!.some((e) => this.edges[e]!.to === n)) {
            best = n;
            bestD = d;
          }
        }
        if (best >= 0 && !rings.some((g) => Math.hypot(end[0] - g.x, end[1] - g.y) < g.r - 10)) {
          link(here, best, i);
          link(best, here, i);
        }
      }
    });
    // The ways in: where the asphalt meets the edge of the map.
    if (mask) {
      const real = this.nodes.length;
      for (const [edge, outward] of asphaltAtEdge(mask, size)) {
        let best = -1;
        let bestD = ENTRY_REACH;
        for (let n = 0; n < real; n++) {
          const d = Math.hypot(this.nodes[n]![0] - edge[0], this.nodes[n]![1] - edge[1]);
          if (d < bestD && this.out[n]!.length > 0) {
            best = n;
            bestD = d;
          }
        }
        if (best < 0) continue;
        const start = node([edge[0] + outward[0] * OUTSIDE, edge[1] + outward[1] * OUTSIDE]);
        link(start, best, -1);
        this.entries.push(start);
      }
    }
  }

  /**
   * The way for a car from the edge of the map to a parking spot: the corners of the streets'
   * centre lines, from just outside the map to the point in the road beside the spot, arriving
   * the way the parked car faces (`angle`). Null if there is no way (no way in, or no street).
   */
  driveIn(spot: { x: number; y: number; angle: number }): Point[] | null {
    if (this.entries.length === 0) return null;
    // The stretch of street the spot is beside, driven the way the car will face.
    const face: Point = [Math.cos((spot.angle * Math.PI) / 180), Math.sin((spot.angle * Math.PI) / 180)];
    let goal: { edge: number; at: Point; d: number } | null = null;
    this.edges.forEach((e, index) => {
      if (e.road < 0 || this.roads[e.road]!.ring) return;
      const a = this.nodes[e.from]!;
      const b = this.nodes[e.to]!;
      if ((b[0] - a[0]) * face[0] + (b[1] - a[1]) * face[1] <= 0) return;
      const t = Math.max(0, Math.min(1, along(a, b, [spot.x, spot.y])));
      const at: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const d = Math.hypot(spot.x - at[0], spot.y - at[1]);
      if (!goal || d < goal.d) goal = { edge: index, at, d };
    });
    if (!goal) return null;
    const target = goal as { edge: number; at: Point; d: number };
    // Shortest way, stretch by stretch, never turning straight back.
    const dist = new Array<number>(this.edges.length).fill(Infinity);
    const prev = new Array<number>(this.edges.length).fill(-1);
    const open = new Set<number>();
    for (const n of this.entries) {
      for (const e of this.out[n]!) {
        dist[e] = this.edges[e]!.length;
        open.add(e);
      }
    }
    while (open.size > 0) {
      let e = -1;
      for (const c of open) if (e < 0 || dist[c]! < dist[e]!) e = c;
      open.delete(e);
      if (e === target.edge) break;
      const edge = this.edges[e]!;
      for (const next of this.out[edge.to]!) {
        const n = this.edges[next]!;
        if (n.to === edge.from) continue;
        const d = dist[e]! + n.length;
        if (d < dist[next]!) {
          dist[next] = d;
          prev[next] = e;
          open.add(next);
        }
      }
    }
    if (dist[target.edge] === Infinity) return null;
    const chain: number[] = [];
    for (let e = target.edge; e >= 0; e = prev[e]!) chain.unshift(e);
    const pts: Point[] = [this.nodes[this.edges[chain[0]!]!.from]!];
    for (const e of chain.slice(0, -1)) pts.push(this.nodes[this.edges[e]!.to]!);
    pts.push(target.at);
    return tidy(pts);
  }
}

/** How far along a to b the point nearest `p` is (0 at a, 1 at b; outside that range beyond the ends). */
function along(a: Point, b: Point, p: Point): number {
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
  return ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2;
}

/** Where stretch a to b crosses stretch c to d: how far along each (0 to 1), or null. Shared ends don't count. */
function crossing(a: Point, b: Point, c: Point, d: Point): [number, number] | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  const eps = 1e-6;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  const endA = t < eps || t > 1 - eps;
  const endC = u < eps || u > 1 - eps;
  if (endA && endC) return null;
  return [Math.max(0, Math.min(1, t)), Math.max(0, Math.min(1, u))];
}

/** Drops points in the middle of a straight run (junctions driven straight through) and points too close together. */
function tidy(pts: Point[]): Point[] {
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) continue;
    const next = pts[i + 1];
    if (next) {
      const a1 = Math.atan2(p[1] - last[1], p[0] - last[0]);
      const a2 = Math.atan2(next[1] - p[1], next[0] - p[0]);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn < (4 * Math.PI) / 180) continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Where the asphalt meets the edge of the map: for each such place, the middle of it on the edge
 * and the way that points off the map.
 */
export function asphaltAtEdge(mask: RoadMask, size: { width: number; height: number }): [Point, Point][] {
  const found: [Point, Point][] = [];
  const s = mask.scale;
  const lastCol = Math.ceil(size.width / s) - 1;
  // Left and right edges: rows whose asphalt starts at the first column, or ends at the last.
  for (const side of ['left', 'right'] as const) {
    let from = -1;
    for (let row = 0; row <= mask.rows.length; row++) {
      const runs = mask.rows[row];
      const on = !!runs && runs.length >= 2 && (side === 'left' ? runs[0]! <= 0 : runs[runs.length - 1]! > lastCol);
      if (on && from < 0) from = row;
      if (!on && from >= 0) {
        if (row - from >= 6) found.push([[side === 'left' ? 0 : size.width, ((from + row) / 2) * s], [side === 'left' ? -1 : 1, 0]]);
        from = -1;
      }
    }
  }
  // Top and bottom edges: the runs of the first and last rows.
  for (const side of ['top', 'bottom'] as const) {
    const runs = mask.rows[side === 'top' ? 0 : mask.rows.length - 1] ?? [];
    for (let i = 0; i + 1 < runs.length; i += 2) {
      if (runs[i + 1]! - runs[i]! >= 6) found.push([[((runs[i]! + runs[i + 1]!) / 2) * s, side === 'top' ? 0 : size.height], [0, side === 'top' ? -1 : 1]]);
    }
  }
  return found;
}
