import { AutoRoute, nextSpeed, type Point } from './AutoRoute';
import { HOME_DRIVE_CORNER_RADIUS, HOME_DRIVE_GAP, HOME_DRIVE_LANE_OFFSET, HOME_DRIVE_PARK_GLIDE, HOME_DRIVE_PROFILE } from '../config/tuning';

/**
 * SCREAM-380 (PO, November 17): a resident's car on its way home. "Drive in by car": it comes
 * onto the map at the edge, drives along the streets in its lane to its parking spot and parks.
 * "The car stops and waits": it brakes when something is in its way (the truck, a person on
 * foot, another car) and carries on once the way is clear.
 *
 * Pure maths, no Phaser (unit-tested). `Residents` owns the cars and says what is in the way.
 */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export class HomeDrive {
  readonly route: AutoRoute;
  /** How far along its way it is, px, and how fast it is going, px/s. */
  s = 0;
  v = 0;
  x = 0;
  y = 0;
  /** Degrees (0 = right, 90 = down). */
  angle = 0;
  /** In its parking spot. */
  parked = false;
  /** Stopped (or stopping) for something in its way. */
  waiting = false;
  private readonly spot: { x: number; y: number; angle: number };
  /** Half the car's length, px (how far its nose is in front of its middle). */
  readonly nose: number;

  /**
   * `corners` is the way along the streets' centre lines (RoadGraph.driveIn), ending in the
   * road beside `spot`; `halfLength` is half the car's length.
   */
  constructor(corners: Point[], spot: { x: number; y: number; angle: number }, halfLength: number) {
    this.route = new AutoRoute({
      corners,
      lanes: corners.slice(1).map(() => HOME_DRIVE_LANE_OFFSET),
      radius: HOME_DRIVE_CORNER_RADIUS,
    });
    this.spot = spot;
    this.nose = halfLength;
    this.place();
  }

  /** The whole way, px. */
  get length(): number {
    return this.route.length;
  }

  /** Where the car's middle is `s` px along: in its lane, then over the last stretch across to its parking spot. */
  at(s: number): { x: number; y: number; angle: number } {
    const glideFrom = Math.max(0, this.length - HOME_DRIVE_PARK_GLIDE);
    if (s <= glideFrom) {
      const p = this.route.at(s);
      return { x: p.x, y: p.y, angle: p.heading };
    }
    const from = this.route.at(glideFrom);
    const t = Math.min(1, (s - glideFrom) / (this.length - glideFrom || 1));
    // Along the lane at an even pace, across to the curb with an ease in and out.
    const lane = this.route.at(s);
    const end = this.route.at(this.length);
    const across = smooth(t);
    return {
      x: lane.x + (this.spot.x - end.x) * across,
      y: lane.y + (this.spot.y - end.y) * across,
      angle: from.heading + wrap(this.spot.angle - from.heading) * t + Math.sin(Math.PI * t) * this.swing(end),
    };
  }

  /** The few degrees the car turns toward the curb as it pulls in (and back out of as it straightens). */
  private swing(end: { x: number; y: number; heading: number }): number {
    const h = (end.heading * Math.PI) / 180;
    // Positive when the spot is to the right of the way the car is going.
    const side = -(this.spot.x - end.x) * Math.sin(h) + (this.spot.y - end.y) * Math.cos(h);
    const reach = Math.hypot(this.spot.x - end.x, this.spot.y - end.y);
    return Math.sign(side) * Math.min(25, (Math.atan2(reach * 1.5, HOME_DRIVE_PARK_GLIDE) * 180) / Math.PI);
  }

  private place(): void {
    const p = this.at(this.s);
    this.x = p.x;
    this.y = p.y;
    this.angle = p.angle;
  }

  /**
   * Moves the car on by `dt` seconds. `blocked(x, y)` says whether something is in the way of a
   * car whose middle would be at (x, y).
   */
  step(dt: number, blocked: (x: number, y: number) => boolean): void {
    if (this.parked) return;
    // Look along the way ahead, from just past the nose to as far as it needs to stop.
    const stopIn = (this.v * this.v) / (2 * HOME_DRIVE_PROFILE.brake);
    const reach = this.nose + HOME_DRIVE_GAP + stopIn;
    let clear = Infinity;
    for (let d = this.nose * 0.5; d <= reach; d += 8) {
      if (this.s + d > this.length) break;
      const p = this.at(this.s + d);
      if (blocked(p.x, p.y)) {
        clear = d;
        break;
      }
    }
    if (clear < Infinity) {
      this.waiting = true;
      const room = clear - this.nose - HOME_DRIVE_GAP;
      // Brake so as to stop with a gap; right up against it, stop dead.
      if (room <= 0) this.v = 0;
      else this.v = Math.min(Math.max(0, this.v - HOME_DRIVE_PROFILE.brake * dt), Math.sqrt(2 * HOME_DRIVE_PROFILE.brake * room));
    } else {
      this.waiting = false;
      this.v = nextSpeed(this.route, this.s, this.length, this.v, dt, HOME_DRIVE_PROFILE);
      // Never quite stopping short of the spot: creep the last pixels.
      if (this.v < 12 && this.s < this.length) this.v = Math.min(12, this.v + HOME_DRIVE_PROFILE.accel * dt);
    }
    this.s = Math.min(this.length, this.s + this.v * dt);
    if (this.s >= this.length - 0.5) {
      this.s = this.length;
      this.v = 0;
      this.parked = true;
      this.x = this.spot.x;
      this.y = this.spot.y;
      this.angle = this.spot.angle;
      return;
    }
    this.place();
  }
}
