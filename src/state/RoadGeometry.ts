// SCREAM-10 (PO, October 30): roads keep their real angles, so "on the road" is
// worked out from the streets' centre lines instead of a tile grid. A point is on
// the road if it's within half a road's width (two 60 px lanes, as on the old map) of a centre line.

import type { MapRoad, RoadMask } from '../config/mapTypes';

export const ROAD_HALF_WIDTH = 60;
/** Distance from the centre line to the middle of a lane. */
export const LANE_OFFSET = 30;

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  road: number;
}

const CELL = 128;

/** Distance from (px, py) to the segment a-b. */
export function distanceToSegment(px: number, py: number, s: Segment): number {
  const vx = s.bx - s.ax;
  const vy = s.by - s.ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * vx + (py - s.ay) * vy) / len2));
  return Math.hypot(px - s.ax - t * vx, py - s.ay - t * vy);
}

export class RoadNetwork {
  readonly segments: Segment[] = [];
  /** Each road's street name, by index (Segment.road). */
  readonly names: string[];
  private readonly grid = new Map<string, number[]>();

  /**
   * With a mask (SCREAM-10, rounded corners), "on the road" is read from it:
   * the generator rounds every street corner, and the mask matches the drawn
   * curbs exactly. Without one (the test track), it's within half a road's
   * width of a centre line.
   */
  private readonly mask?: RoadMask;

  constructor(roads: readonly MapRoad[], mask?: RoadMask) {
    this.mask = mask;
    this.names = roads.map((r) => r.name);
    roads.forEach((road, i) => {
      const p = road.points;
      for (let k = 0; k + 3 < p.length; k += 2) {
        this.segments.push({ ax: p[k]!, ay: p[k + 1]!, bx: p[k + 2]!, by: p[k + 3]!, road: i });
      }
    });
    // Each grid cell lists the segments whose road could reach into it.
    this.segments.forEach((s, i) => {
      const pad = ROAD_HALF_WIDTH + 4;
      const x0 = Math.floor((Math.min(s.ax, s.bx) - pad) / CELL);
      const x1 = Math.floor((Math.max(s.ax, s.bx) + pad) / CELL);
      const y0 = Math.floor((Math.min(s.ay, s.by) - pad) / CELL);
      const y1 = Math.floor((Math.max(s.ay, s.by) + pad) / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = `${cx},${cy}`;
          const list = this.grid.get(key);
          if (list) list.push(i);
          else this.grid.set(key, [i]);
        }
      }
    });
  }

  private near(x: number, y: number): Segment[] {
    return (this.grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []).map((i) => this.segments[i]!);
  }

  /** Is (x, y) on the road (asphalt, not the sidewalk)? */
  onRoad(x: number, y: number): boolean {
    if (this.mask) {
      const runs = this.mask.rows[Math.floor(y / this.mask.scale)];
      if (!runs) return false;
      const col = Math.floor(x / this.mask.scale);
      for (let i = 0; i + 1 < runs.length; i += 2) {
        if (col < runs[i]!) return false;
        if (col < runs[i + 1]!) return true;
      }
      return false;
    }
    return this.near(x, y).some((s) => distanceToSegment(x, y, s) <= ROAD_HALF_WIDTH);
  }

  /** The nearest segment to (x, y) within reach of the road, or null. */
  nearestSegment(x: number, y: number): Segment | null {
    let best: Segment | null = null;
    let bestDistance = Infinity;
    for (const s of this.near(x, y)) {
      const d = distanceToSegment(x, y, s);
      if (d < bestDistance) {
        best = s;
        bestDistance = d;
      }
    }
    return best;
  }

  /** The street at (x, y), or '' off the road. */
  streetAt(x: number, y: number): string {
    const seg = this.nearestSegment(x, y);
    return seg && this.onRoad(x, y) ? (this.names[seg.road] ?? '') : '';
  }
}

/** A rectangle that can be turned: centre, half length (along `angle`), half width. */
export interface TurnedBox {
  x: number;
  y: number;
  angle: number;
  halfLength: number;
  halfWidth: number;
}

/** Do two turned rectangles overlap? Checked along each of their four edge directions. */
export function boxesOverlap(a: TurnedBox, b: TurnedBox): boolean {
  const axes = [a.angle, a.angle + 90, b.angle, b.angle + 90].map((d) => {
    const r = (d * Math.PI) / 180;
    return { x: Math.cos(r), y: Math.sin(r) };
  });
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = (box: TurnedBox, ax: { x: number; y: number }) => {
    const r = (box.angle * Math.PI) / 180;
    const ux = Math.cos(r);
    const uy = Math.sin(r);
    return box.halfLength * Math.abs(ux * ax.x + uy * ax.y) + box.halfWidth * Math.abs(-uy * ax.x + ux * ax.y);
  };
  return axes.every((ax) => Math.abs(dx * ax.x + dy * ax.y) < reach(a, ax) + reach(b, ax));
}
