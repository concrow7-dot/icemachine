// SCREAM-59 + SCREAM-73: the neighbourhood's residents. Everyone has a name, a house
// and their own likelihood of buying (from the PO's residents sheet, doc 38), and
// spends the evening going in and out of their house and wandering their yard.
//
// No Phaser here: the Drive scene draws what this works out. The residents belong to
// the evening (EveningState), so they carry on where they were after a sale.
//
// Buying is not part of this yet: the sonar ring and the chance check come in SCREAM-67.

import {
  RESIDENT_IDLE_SECONDS,
  RESIDENT_INSIDE_SECONDS,
  RESIDENT_OUTSIDE_SECONDS,
  RESIDENT_START_OUTSIDE_CHANCE,
  RESIDENT_WALK_SPEED,
} from '../config/tuning';

/** One resident, as generated from the sheet (src/config/residents.ts). */
export interface Resident {
  id: string;
  name: string;
  kid: boolean;
  street: string;
  /** 0 to 1: the sheet's "Likelihood (%)". Used by the chance check (SCREAM-67). */
  likelihood: number;
  /** Which look in residents.png. */
  look: number;
  /** Where they come out of and go into their house. */
  door: [number, number];
  /** Spots in their yard, as x, y pairs. */
  yard: number[];
}

export type ResidentFacing = 'right' | 'up' | 'left' | 'down';

/** What a resident is doing right now. */
export interface ResidentNow {
  readonly resident: Resident;
  x: number;
  y: number;
  /** False while they're inside their house (not drawn). */
  outside: boolean;
  /** True while walking; false while standing still. */
  walking: boolean;
  facing: ResidentFacing;
}

type Plan =
  | { kind: 'inside'; until: number }
  | { kind: 'walk'; to: [number, number]; thenInside: boolean }
  | { kind: 'idle'; until: number };

interface Running extends ResidentNow {
  plan: Plan;
  /** When they head back inside, in seconds of evening time. */
  goInsideAt: number;
}

const between = (rnd: () => number, [low, high]: readonly [number, number]) => low + rnd() * (high - low);

export class Residents {
  private readonly people: Running[];
  private readonly rnd: () => number;
  private now = 0;

  /** `rnd` returns 0 to 1 (Math.random by default; tests pass their own). */
  constructor(list: readonly Resident[], rnd: () => number = Math.random) {
    this.rnd = rnd;
    this.people = list.map((resident) => {
      const outside = rnd() < RESIDENT_START_OUTSIDE_CHANCE;
      const spot = outside ? this.yardSpot(resident) : resident.door;
      const person: Running = {
        resident,
        x: spot[0],
        y: spot[1],
        outside,
        walking: false,
        facing: 'down',
        plan: { kind: 'inside', until: 0 },
        goInsideAt: 0,
      };
      if (outside) {
        person.goInsideAt = between(rnd, RESIDENT_OUTSIDE_SECONDS) * rnd();
        person.plan = { kind: 'idle', until: between(rnd, RESIDENT_IDLE_SECONDS) * rnd() };
      } else {
        person.plan = { kind: 'inside', until: between(rnd, RESIDENT_INSIDE_SECONDS) * rnd() };
      }
      return person;
    });
  }

  /** Everyone, inside or out, in the sheet's order. */
  get all(): readonly ResidentNow[] {
    return this.people;
  }

  /** Moves everyone on by `dt` seconds. */
  update(dt: number): void {
    this.now += dt;
    for (const p of this.people) this.step(p, dt);
  }

  private step(p: Running, dt: number): void {
    const plan = p.plan;
    if (plan.kind === 'inside') {
      if (this.now < plan.until) return;
      // Out of the front door, then off into the yard.
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
      p.goInsideAt = this.now + between(this.rnd, RESIDENT_OUTSIDE_SECONDS);
      this.walkTo(p, this.yardSpot(p.resident), false);
      return;
    }
    if (plan.kind === 'idle') {
      if (this.now < plan.until) return;
      if (this.now >= p.goInsideAt) this.walkTo(p, p.resident.door, true);
      else this.walkTo(p, this.yardSpot(p.resident), false);
      return;
    }
    // Walking.
    const [tx, ty] = plan.to;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const stepLength = RESIDENT_WALK_SPEED * dt;
    if (dist <= stepLength) {
      p.x = tx;
      p.y = ty;
      p.walking = false;
      if (plan.thenInside) {
        p.outside = false;
        p.plan = { kind: 'inside', until: this.now + between(this.rnd, RESIDENT_INSIDE_SECONDS) };
      } else {
        p.facing = 'down';
        p.plan = { kind: 'idle', until: this.now + between(this.rnd, RESIDENT_IDLE_SECONDS) };
      }
      return;
    }
    p.x += (dx / dist) * stepLength;
    p.y += (dy / dist) * stepLength;
  }

  private walkTo(p: Running, to: [number, number], thenInside: boolean): void {
    p.plan = { kind: 'walk', to, thenInside };
    p.walking = true;
    const dx = to[0] - p.x;
    const dy = to[1] - p.y;
    p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  private yardSpot(r: Resident): [number, number] {
    const n = r.yard.length / 2;
    if (n === 0) return r.door;
    const i = Math.floor(this.rnd() * n);
    return [r.yard[i * 2], r.yard[i * 2 + 1]];
  }
}
