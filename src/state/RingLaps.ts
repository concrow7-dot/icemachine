// SCREAM-145 (PO, November 8-9): a roundabout is the way between the maps. Driving round
// Elm Park's roundabout 3 times takes the truck to Foley Stadium (and 3 laps of Newton Square
// bring it home). This counts the laps from the truck's position, frame by frame.

import type { MapRoad } from '../config/mapTypes';

export interface Ring {
  x: number;
  y: number;
  /** The radius of the road's centre line (px). */
  r: number;
}

/** How far outside the road's centre line the truck still counts as on the roundabout (px). */
const RING_SLACK = 100;

/** The map's roundabout, if it has one (a road with a `ring`). */
export function ringOf(roads: readonly MapRoad[]): Ring | null {
  return roads.find((r) => r.ring)?.ring ?? null;
}

/**
 * Counts laps of a roundabout. Feed it the truck's position every frame: it adds up how far
 * round the circle the truck has gone. Leaving the roundabout, or turning back the other way,
 * starts the count again (a lap has to be a lap).
 */
export class LapCounter {
  /** Degrees travelled round the centre since the count started, always positive. */
  private travelled = 0;
  private lastAngle: number | null = null;
  /** +1 clockwise, -1 anticlockwise, 0 while undecided. */
  private direction = 0;

  readonly ring: Ring;
  readonly lapsNeeded: number;

  constructor(ring: Ring, lapsNeeded = 3) {
    this.ring = ring;
    this.lapsNeeded = lapsNeeded;
  }

  /** Whole laps so far. */
  get laps(): number {
    return Math.floor(this.travelled / 360);
  }

  /** How far round the current lap, 0 to 1 (for an on-screen counter, if there is one). */
  get progress(): number {
    return (this.travelled % 360) / 360;
  }

  /** SCREAM-229: laps so far as a fraction (1.5 = halfway round the second lap). */
  get turns(): number {
    return this.travelled / 360;
  }

  get onRing(): boolean {
    return this.lastAngle !== null;
  }

  /** True on the frame the last lap is completed. */
  update(x: number, y: number): boolean {
    const dist = Math.hypot(x - this.ring.x, y - this.ring.y);
    if (dist > this.ring.r + RING_SLACK) {
      this.reset();
      return false;
    }
    const angle = (Math.atan2(y - this.ring.y, x - this.ring.x) * 180) / Math.PI;
    if (this.lastAngle === null) {
      this.lastAngle = angle;
      return false;
    }
    let delta = angle - this.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    this.lastAngle = angle;
    if (delta === 0) return false;
    const dir = Math.sign(delta);
    if (this.direction === 0) this.direction = dir;
    if (dir !== this.direction) {
      // Turned round: start again, going this way.
      this.travelled = 0;
      this.direction = dir;
      return false;
    }
    const before = this.laps;
    this.travelled += Math.abs(delta);
    const done = this.laps >= this.lapsNeeded && before < this.lapsNeeded;
    return done;
  }

  reset(): void {
    this.travelled = 0;
    this.lastAngle = null;
    this.direction = 0;
  }
}

/**
 * SCREAM-229 (PO, November 9): how strong the portal in the middle of the roundabout is, 0 to 1,
 * from the laps driven so far (`LapCounter.turns`). Nothing on the first lap; it appears at the
 * start of the second and grows steadily until the last lap is done (1). With 3 laps: 1.5 laps
 * is 0.25, 2 laps is 0.5.
 */
export function portalStrength(turns: number, lapsNeeded: number): number {
  if (lapsNeeded <= 1) return Math.min(Math.max(turns, 0), 1);
  return Math.min(Math.max((turns - 1) / (lapsNeeded - 1), 0), 1);
}

/**
 * Where the truck appears after arriving on a map through its roundabout: on the ring road
 * itself, on its far side from the street that leads in (so the way out is the way ahead),
 * heading round the ring clockwise. Null if the map has no roundabout.
 */
export function arrivalSpot(roads: readonly MapRoad[]): { x: number; y: number; angle: number } | null {
  const ring = ringOf(roads);
  if (!ring) return null;
  // The street(s) that end at the ring's centre: the roundabout's exits.
  let exitAngle = 0;
  for (const r of roads) {
    if (r.ring) continue;
    const p = r.points;
    const ends: [number, number, number, number][] = [
      [p[0]!, p[1]!, p[2]!, p[3]!],
      [p[p.length - 2]!, p[p.length - 1]!, p[p.length - 4]!, p[p.length - 3]!],
    ];
    for (const [ex, ey, nx, ny] of ends) {
      if (Math.hypot(ex - ring.x, ey - ring.y) < 1) exitAngle = Math.atan2(ny - ring.y, nx - ring.x);
    }
  }
  // Opposite the exit, on the centre line, facing clockwise (angle 0 = right, 90 = down).
  const a = exitAngle + Math.PI;
  return {
    x: Math.round((ring.x + ring.r * Math.cos(a)) * 10) / 10,
    y: Math.round((ring.y + ring.r * Math.sin(a)) * 10) / 10,
    angle: Math.round(((a * 180) / Math.PI + 90 + 540) % 360) - 180,
  };
}
