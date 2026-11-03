// SCREAM-140 / SCREAM-142 (PO, November 2): customers walk straight toward the truck and
// stop a short way off, at the curb beside them; their pink square goes in the lane there.
// This finds that spot: the nearest street, a place along it with room for the square,
// where to stand on the sidewalk, and the square itself. No Phaser here.

import { LANE_OFFSET, ROAD_HALF_WIDTH, type RoadNetwork } from './RoadGeometry';

/** Where a customer stands to wait, and their pink square (x, y, the road's angle in degrees). */
export interface CurbSpot {
  stand: [number, number];
  square: [number, number, number];
}

/** How far from the street's centre line a waiting customer stands (just onto the sidewalk). */
const STAND_OFFSET = ROAD_HALF_WIDTH + 8;
/** How far from where they are a customer will look for room, and the steps they look in (px). */
const SEARCH = 150;
const SEARCH_STEP = 25;
/** How far from the street a customer can be and still count as beside it (px). */
const REACH = 120;

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
  near(x: number, y: number, taken: readonly [number, number][], gap: number): CurbSpot | null {
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
    if (!best || best.d > REACH + STAND_OFFSET) return null;
    const { ax, ay, vx, vy, len, t, side, road } = best;
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
      return { stand: [cx + nx * STAND_OFFSET, cy + ny * STAND_OFFSET], square: [sx, sy, angle] };
    }
    return null;
  }
}
