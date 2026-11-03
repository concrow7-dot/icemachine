// SCREAM-140 (PO, November 2): customers walk along the curb toward the truck. This
// measures positions along a street's centre line, so a customer can keep the same
// distance from it (their side of the street) while they walk along it.
// No Phaser here.

/** A street's centre line, as x, y pairs (the map's roads). */
export interface CentreLine {
  points: number[];
}

/** Where someone is beside a street: which street, how far along it, and how far to one side (signed). */
export interface CurbSpot {
  road: number;
  along: number;
  side: number;
}

export class CurbPath {
  private readonly lines: { pts: number[]; cum: number[] }[];

  constructor(roads: readonly CentreLine[]) {
    this.lines = roads.map((r) => {
      const pts = r.points;
      const cum = [0];
      for (let k = 0; k + 3 < pts.length; k += 2) {
        cum.push(cum[cum.length - 1]! + Math.hypot(pts[k + 2]! - pts[k]!, pts[k + 3]! - pts[k + 1]!));
      }
      return { pts, cum };
    });
  }

  /** The street length, in px. */
  length(road: number): number {
    const c = this.lines[road]?.cum;
    return c ? c[c.length - 1]! : 0;
  }

  /** The nearest street to (x, y), and where (x, y) sits beside it. */
  locate(x: number, y: number): CurbSpot | null {
    let best: CurbSpot | null = null;
    let bestDistance = Infinity;
    this.lines.forEach((_, road) => {
      const spot = this.project(road, x, y);
      if (spot && Math.abs(spot.side) < bestDistance) {
        bestDistance = Math.abs(spot.side);
        best = spot;
      }
    });
    return best;
  }

  /** Where (x, y) sits beside one given street (the nearest point on it). */
  project(road: number, x: number, y: number): CurbSpot | null {
    const line = this.lines[road];
    if (!line) return null;
    const { pts, cum } = line;
    let best: CurbSpot | null = null;
    let bestDistance = Infinity;
    for (let k = 0, s = 0; k + 3 < pts.length; k += 2, s++) {
      const ax = pts[k]!, ay = pts[k + 1]!;
      const vx = pts[k + 2]! - ax, vy = pts[k + 3]! - ay;
      const len = Math.hypot(vx, vy);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (len * len)));
      const d = Math.hypot(x - ax - t * vx, y - ay - t * vy);
      if (d < bestDistance) {
        bestDistance = d;
        // Signed: positive on the left of the line's direction (screen coordinates).
        const side = (vx * (y - ay) - vy * (x - ax)) / len;
        best = { road, along: cum[s]! + t * len, side: Math.sign(side || 1) * d };
      }
    }
    return best;
  }

  /** The point `along` px down the street, `side` px off it, and the street's angle there (degrees). */
  at(road: number, along: number, side: number): { x: number; y: number; angle: number } {
    const line = this.lines[road];
    if (!line || line.pts.length < 4) return { x: 0, y: 0, angle: 0 };
    const { pts, cum } = line;
    const a = Math.max(0, Math.min(this.length(road), along));
    let s = 0;
    while (s + 2 < cum.length && cum[s + 1]! < a) s++;
    const k = s * 2;
    const ax = pts[k]!, ay = pts[k + 1]!;
    const vx = pts[k + 2]! - ax, vy = pts[k + 3]! - ay;
    const len = Math.hypot(vx, vy) || 1;
    const t = (a - cum[s]!) / len;
    return {
      x: ax + vx * t + (-vy / len) * side,
      y: ay + vy * t + (vx / len) * side,
      angle: (Math.atan2(vy, vx) * 180) / Math.PI,
    };
  }

  /** The corners passed walking from `from` to `to` along the street at `side`, then the end point. */
  route(road: number, from: number, to: number, side: number): [number, number][] {
    const cum = this.lines[road]?.cum ?? [];
    const out: [number, number][] = [];
    const corners = cum.filter((c) => (to > from ? c > from && c < to : c < from && c > to));
    if (to < from) corners.reverse();
    for (const c of corners) {
      // Just either side of the corner, so the walk keeps to the curb round it.
      const before = this.at(road, c - Math.sign(to - from) * 0.01, side);
      const after = this.at(road, c + Math.sign(to - from) * 0.01, side);
      out.push([before.x, before.y], [after.x, after.y]);
    }
    const end = this.at(road, to, side);
    out.push([end.x, end.y]);
    return out;
  }
}
