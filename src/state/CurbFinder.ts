// SCREAM-140 / SCREAM-142 (PO, November 2): customers walk straight toward the truck and
// stop a short way off, at the curb beside them; their pink square goes in the lane there.
// This finds that spot: the nearest street, a place along it with room for the square,
// where to stand on the sidewalk, and the square itself. No Phaser here.

import { type RoadNetwork } from './RoadGeometry';

/** Where a customer stands to wait, and their pink square (x, y, the road's angle in degrees). */
export interface CurbSpot {
  stand: [number, number];
  square: [number, number, number];
}

/** How far past the curb a waiting customer stands (just onto the sidewalk). */
const STAND_PAST_CURB = 8;
/** How far from where they are a customer will look for room, and the steps they look in (px). */
const SEARCH = 150;
const SEARCH_STEP = 25;
/** How far from the street a customer can be and still count as beside it (px). */
const REACH = 120;
/** SCREAM-150: when there's no room nearby, how far along each nearby street to look (px). */
const SEARCH_FAR = 400;

export class CurbFinder {
  private readonly roads: RoadNetwork;
  private readonly squareFits: (x: number, y: number, road: number) => boolean;

  /** `squareFits` says whether a pink square can go at (x, y) beside street `road`. */
  constructor(roads: RoadNetwork, squareFits: (x: number, y: number, road: number) => boolean) {
    this.roads = roads;
    this.squareFits = squareFits;
  }

  /**
   * The nearest spot beside a street to (x, y) with room for a pink square: on the same side
   * of the street, as close as possible, not within `gap` px of any square in `taken`. Null if
   * (x, y) isn't near a street or there's no room within reach.
   */
  /** `around` (SCREAM-150): [x, y, max px]: only stands that close to that point (the truck) count. */
  near(x: number, y: number, taken: readonly [number, number][], gap: number, around?: [number, number, number]): CurbSpot | null {
    return this.nearest(x, y, taken, gap, around) ?? this.further(x, y, taken, gap, around);
  }

  /**
   * SCREAM-150 (PO, November 3): customers are only served from the sidewalk. True if
   * (x, y) and the points just around it are off the road (so not in a cross street at a corner).
   */
  standClear(x: number, y: number): boolean {
    for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) if (this.roads.onRoad(x + dx, y + dy)) return false;
    return true;
  }

  /** The first try: the nearest street only, same side, within SEARCH px. */
  private nearest(x: number, y: number, taken: readonly [number, number][], gap: number, around?: [number, number, number]): CurbSpot | null {
    let best = null as null | { ax: number; ay: number; vx: number; vy: number; len: number; t: number; d: number; side: number; road: number };
    for (const s of this.roads.segments) {
      const vx = s.bx - s.ax;
      const vy = s.by - s.ay;
      const len = Math.hypot(vx, vy);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / (len * len)));
      const d = Math.hypot(x - s.ax - t * vx, y - s.ay - t * vy);
      if (!best || d < best.d) {
        const cross = vx * (y - s.ay) - vy * (x - s.ax);
        best = { ax: s.ax, ay: s.ay, vx, vy, len, t, d, side: cross >= 0 ? 1 : -1, road: s.road };
      }
    }
    if (!best || best.d > REACH + this.roads.halfWidth(best.road) + STAND_PAST_CURB) return null;
    const { ax, ay, vx, vy, len, t, side, road } = best;
    // SCREAM-159: a wider street puts the square in its outside lane and the customer at its curb.
    const STAND_OFFSET = this.roads.halfWidth(road) + STAND_PAST_CURB;
    const LANE_OFFSET = this.roads.laneOffset(road);
    const nx = (-vy / len) * side;
    const ny = (vx / len) * side;
    const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
    for (let k = 0; k <= (SEARCH / SEARCH_STEP) * 2; k++) {
      // 0, +25, -25, +50, -50, ... px along the street.
      const shift = Math.ceil(k / 2) * SEARCH_STEP * (k % 2 ? 1 : -1);
      const u = t + shift / len;
      if (u < 0 || u > 1) continue;
      const cx = ax + vx * u;
      const cy = ay + vy * u;
      const sx = cx + nx * LANE_OFFSET;
      const sy = cy + ny * LANE_OFFSET;
      if (!this.squareFits(sx, sy, road)) continue;
      if (taken.some(([qx, qy]) => Math.hypot(qx - sx, qy - sy) < gap)) continue;
      const stand: [number, number] = [cx + nx * STAND_OFFSET, cy + ny * STAND_OFFSET];
      if (!this.standClear(stand[0], stand[1])) continue;
      if (around && Math.hypot(stand[0] - around[0], stand[1] - around[1]) > around[2]) continue;
      return { stand, square: [sx, sy, angle] };
    }
    return null;
  }

  /**
   * SCREAM-150: no room on the nearest street (a corner, parked cars, other customers'
   * squares). Look up to SEARCH_FAR px along every street within reach, on either side,
   * and take the spot closest to (x, y).
   */
  private further(x: number, y: number, taken: readonly [number, number][], gap: number, around?: [number, number, number]): CurbSpot | null {
    let best: CurbSpot | null = null;
    let bestD = Infinity;
    for (const s of this.roads.segments) {
      const vx = s.bx - s.ax;
      const vy = s.by - s.ay;
      const len = Math.hypot(vx, vy);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / (len * len)));
      const STAND_OFFSET = this.roads.halfWidth(s.road) + STAND_PAST_CURB;
      const LANE_OFFSET = this.roads.laneOffset(s.road);
      if (Math.hypot(x - s.ax - t * vx, y - s.ay - t * vy) > REACH + STAND_OFFSET) continue;
      const angle = (Math.atan2(vy, vx) * 180) / Math.PI;
      for (const side of [1, -1]) {
        const nx = (-vy / len) * side;
        const ny = (vx / len) * side;
        for (let shift = -SEARCH_FAR; shift <= SEARCH_FAR; shift += SEARCH_STEP) {
          const u = t + shift / len;
          if (u < 0 || u > 1) continue;
          const cx = s.ax + vx * u;
          const cy = s.ay + vy * u;
          const stand: [number, number] = [cx + nx * STAND_OFFSET, cy + ny * STAND_OFFSET];
          const d = Math.hypot(stand[0] - x, stand[1] - y);
          if (d >= bestD) continue;
          if (around && Math.hypot(stand[0] - around[0], stand[1] - around[1]) > around[2]) continue;
          const sx = cx + nx * LANE_OFFSET;
          const sy = cy + ny * LANE_OFFSET;
          if (!this.squareFits(sx, sy, s.road)) continue;
          if (taken.some(([qx, qy]) => Math.hypot(qx - sx, qy - sy) < gap)) continue;
          if (!this.standClear(stand[0], stand[1])) continue;
          best = { stand, square: [sx, sy, angle] };
          bestD = d;
        }
      }
    }
    return best;
  }
}
