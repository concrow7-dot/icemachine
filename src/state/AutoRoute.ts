/**
 * SCREAM-171 (PO, November 5): the uncle drives the truck in the tutorial. This is the path he
 * follows: along the streets' centre lines, rounded at the corners, kept in a lane (an offset to
 * the right of the way he's going), swinging out round parked cars in that lane.
 *
 * Pure maths, no Phaser: positions are map pixels, headings are degrees (0 = right, 90 = down),
 * the way the truck's heading is measured. Distances along the path are in pixels.
 */
export type Point = [number, number];

export interface RouteSample {
  x: number;
  y: number;
  /** Degrees, the way the truck is pointing there. */
  heading: number;
  /** How sharply the path bends there, degrees per pixel (0 on a straight). */
  bend: number;
}

export interface RouteOptions {
  /** The streets' centre lines, corner to corner, in the order he drives them. */
  corners: Point[];
  /** How far right of the centre line to drive on each stretch (one per stretch between corners). */
  lanes: number[];
  /** Corner rounding, px (on the centre line). */
  radius: number;
  /** Parked cars: their centres. Any in the lane he's using, he swings out round. */
  cars?: Point[];
  /** How far right of the centre line to pass a parked car in his lane. */
  passOffset?: number;
  /**
   * Places he stops, where he must be straight in his lane (PO, November 6: pull up to the
   * customer straight). A parked car just past one is swung round only after it.
   */
  keepStraightAt?: Point[];
}

const STEP = 4;
/** Half the stretch past a parked car he keeps swung out, and how long the swing takes. */
const PASS_HALF = 50;
const PASS_RAMP = 140;
/** Moving over a lane (e.g. into Park Ave's curb lane) takes this long, done on the straight after a turn. */
const LANE_CHANGE = 160;

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export class AutoRoute {
  readonly samples: RouteSample[] = [];
  /** Distance along the path of each sample. */
  private readonly along: number[] = [];
  /** The centre line, sampled the same way (for working out where things are along the road). */
  private readonly centre: { x: number; y: number; dx: number; dy: number; s: number; stretch: number }[] = [];
  /** Where each rounded corner starts and ends along the centre line. */
  private readonly arcs: { start: number; end: number }[] = [];

  constructor(opts: RouteOptions) {
    this.sampleCentre(opts.corners, opts.radius);
    // Each stretch's lane. A change of lane happens on a straight, not in the turn: moving
    // right (outward), just after the corner; moving left, just before it.
    const lanes = this.centre.map((c) => {
      let lane = opts.lanes[0] ?? 0;
      this.arcs.forEach((arc, k) => {
        const from = opts.lanes[k] ?? lane;
        const to = opts.lanes[k + 1] ?? from;
        if (from === to) return;
        const t = to > from ? (c.s - arc.end) / LANE_CHANGE : (c.s - (arc.start - LANE_CHANGE)) / LANE_CHANGE;
        if (t >= 0) lane = from + (to - from) * smooth(t);
      });
      return lane;
    });
    // Parked cars in his lane: swing out to passOffset round each.
    const pass = opts.passOffset ?? 0;
    const straight = (opts.keepStraightAt ?? []).map((p) => this.project(p[0], p[1])?.s).filter((v): v is number => v !== undefined);
    for (const car of opts.cars ?? []) {
      const at = this.project(car[0], car[1]);
      if (!at) continue;
      const lane = lanes[at.index] ?? 0;
      if (Math.abs(at.side - lane) > 45 || at.side * lane <= 0) continue; // not in the lane he's using
      // Swing out over [rampIn, holdFrom], hold to holdTo, swing back over [holdTo, rampOut].
      let holdFrom = at.s - PASS_HALF;
      let rampIn = holdFrom - PASS_RAMP;
      const holdTo = at.s + PASS_HALF;
      const rampOut = holdTo + PASS_RAMP;
      // A stop just before the car: stay straight there, and swing out after it (a shorter swing).
      for (const stop of straight) {
        if (stop > rampIn - 20 && stop < at.s) {
          rampIn = stop + 20;
          holdFrom = Math.max(rampIn + 60, holdFrom);
        }
      }
      this.centre.forEach((c, i) => {
        let w = 0;
        if (c.s >= holdFrom && c.s <= holdTo) w = 1;
        else if (c.s > rampIn && c.s < holdFrom) w = smooth((c.s - rampIn) / (holdFrom - rampIn));
        else if (c.s > holdTo && c.s < rampOut) w = 1 - smooth((c.s - holdTo) / (rampOut - holdTo));
        if (w > 0) lanes[i] = Math.min(lanes[i]!, lanes[i]! + (pass - lanes[i]!) * w);
      });
    }
    // The path itself: each centre point moved right by its lane.
    const pts = this.centre.map((c, i) => ({ x: c.x - c.dy * lanes[i]!, y: c.y + c.dx * lanes[i]! }));
    let s = 0;
    pts.forEach((p, i) => {
      if (i > 0) s += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y);
      this.along.push(s);
    });
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(pts.length - 1, i + 1)]!;
      this.samples.push({ x: p.x, y: p.y, heading: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, bend: 0 });
    });
    this.samples.forEach((smp, i) => {
      const a = this.samples[Math.max(0, i - 2)]!;
      const b = this.samples[Math.min(this.samples.length - 1, i + 2)]!;
      const ds = this.along[Math.min(this.samples.length - 1, i + 2)]! - this.along[Math.max(0, i - 2)]!;
      smp.bend = ds > 0 ? Math.abs(wrap(b.heading - a.heading)) / ds : 0;
    });
  }

  get length(): number {
    return this.along[this.along.length - 1] ?? 0;
  }

  /** Where the path is `s` px along (clamped to its ends), interpolated between samples. */
  at(s: number): RouteSample {
    const n = this.samples.length;
    if (s <= 0) return { ...this.samples[0]! };
    if (s >= this.length) return { ...this.samples[n - 1]! };
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.along[mid]! <= s) lo = mid;
      else hi = mid;
    }
    const a = this.samples[lo]!;
    const b = this.samples[hi]!;
    const t = (s - this.along[lo]!) / (this.along[hi]! - this.along[lo]! || 1);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      heading: a.heading + wrap(b.heading - a.heading) * t,
      bend: a.bend + (b.bend - a.bend) * t,
    };
  }

  /** How far along the path the point nearest (x, y) is. */
  distanceAlong(x: number, y: number): number {
    let best = 0;
    let bestD = Infinity;
    this.samples.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = this.along[i]!;
      }
    });
    return best;
  }

  /** Samples the centre line every STEP px, with the corners rounded to `radius`. */
  private sampleCentre(corners: Point[], radius: number): void {
    const add = (x: number, y: number, dx: number, dy: number, stretch: number) => {
      const last = this.centre[this.centre.length - 1];
      const s = last ? last.s + Math.hypot(x - last.x, y - last.y) : 0;
      this.centre.push({ x, y, dx, dy, s, stretch });
      return s;
    };
    const dirs = corners.slice(1).map((p, i) => {
      const q = corners[i]!;
      const len = Math.hypot(p[0] - q[0], p[1] - q[1]);
      return { dx: (p[0] - q[0]) / len, dy: (p[1] - q[1]) / len, len };
    });
    // How much of each corner's rounding eats into the stretches either side.
    const cut = corners.map((_, i) => {
      if (i === 0 || i === corners.length - 1) return 0;
      const a = dirs[i - 1]!;
      const b = dirs[i]!;
      const turn = Math.acos(Math.max(-1, Math.min(1, a.dx * b.dx + a.dy * b.dy)));
      return Math.min(radius * Math.tan(turn / 2), a.len / 2, b.len / 2);
    });
    dirs.forEach((d, i) => {
      const start = corners[i]!;
      const from = cut[i]!;
      const to = d.len - cut[i + 1]!;
      for (let t = from; t < to; t += STEP) add(start[0] + d.dx * t, start[1] + d.dy * t, d.dx, d.dy, i);
      const next = dirs[i + 1];
      if (!next) {
        add(start[0] + d.dx * d.len, start[1] + d.dy * d.len, d.dx, d.dy, i);
        return;
      }
      // The rounded corner: a curve from the end of this stretch to the start of the next.
      const c = corners[i + 1]!;
      const k = cut[i + 1]!;
      const p0 = [c[0] - d.dx * k, c[1] - d.dy * k];
      const p2 = [c[0] + next.dx * k, c[1] + next.dy * k];
      const steps = Math.max(2, Math.ceil((2 * k) / STEP));
      const arc = { start: 0, end: 0 };
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        // A quadratic curve through the corner point: close to a circular arc, tangent at both ends.
        const x = (1 - t) ** 2 * p0[0]! + 2 * (1 - t) * t * c[0] + t * t * p2[0]!;
        const y = (1 - t) ** 2 * p0[1]! + 2 * (1 - t) * t * c[1] + t * t * p2[1]!;
        const tx = 2 * (1 - t) * (c[0] - p0[0]!) + 2 * t * (p2[0]! - c[0]);
        const ty = 2 * (1 - t) * (c[1] - p0[1]!) + 2 * t * (p2[1]! - c[1]);
        const len = Math.hypot(tx, ty) || 1;
        const at = add(x, y, tx / len, ty / len, i);
        if (j === 0) arc.start = at;
        arc.end = at;
      }
      this.arcs.push(arc);
    });
  }

  /** Where a point is along the centre line: distance along, which sample, and how far right of it. */
  private project(x: number, y: number): { s: number; index: number; side: number } | null {
    let best = -1;
    let bestD = Infinity;
    this.centre.forEach((c, i) => {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const c = this.centre[best];
    if (!c || bestD > 200 * 200) return null;
    return { s: c.s, index: best, side: (x - c.x) * -c.dy + (y - c.y) * c.dx };
  }
}

/**
 * How fast to go: up to `cruise`, slower on bends, and slowing to a stop at the end. A simple
 * speed-up / slow-down so the truck eases off and stops where it should.
 */
export interface DriveProfile {
  cruise: number;
  /** px/s², speeding up and slowing down. */
  accel: number;
  brake: number;
  /** Speed on the sharpest bends. */
  bendSpeed: number;
}

export function nextSpeed(route: AutoRoute, s: number, end: number, v: number, dt: number, p: DriveProfile): number {
  const left = Math.max(0, end - s);
  // Look a little ahead for bends, so he's slowed by the time he's in one.
  let bend = 0;
  for (let ahead = 0; ahead <= 80; ahead += 20) bend = Math.max(bend, route.at(s + ahead).bend);
  const bendCap = bend > 0.15 ? p.bendSpeed : p.cruise;
  const stopCap = Math.sqrt(2 * p.brake * left);
  const target = Math.min(p.cruise, bendCap, stopCap);
  if (v < target) return Math.min(target, v + p.accel * dt);
  return Math.max(target, v - p.brake * dt);
}
