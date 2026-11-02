// SCREAM-59 + SCREAM-73: the neighbourhood's residents. Everyone has a name, a house
// and their own likelihood of buying (from the PO's residents sheet, doc 38), and
// spends the evening going in and out of their house and wandering their yard.
//
// SCREAM-67: residents are also the customers. While someone is inside the truck's
// music ring (the "sonar"), the game rolls a chance every second that they want ice
// cream. If they do, a "!" pops up and they run to the curb and wait; the truck
// serves them by stopping in the pink square beside them.
//
// No Phaser here: the Drive scene draws what this works out. The residents belong to
// the evening (EveningState), so they carry on where they were after a sale.

import {
  CUSTOMER_CHANCE_CAP,
  CUSTOMER_CHANCE_GROWTH_SECONDS,
  CUSTOMER_CHANCE_START,
  CUSTOMER_INDOORS_FACTOR,
  CUSTOMER_RUN_SPEED,
  CUSTOMER_WAIT_SECONDS,
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
  /** 0 to 1: the sheet's "Likelihood (%)". Scales the chance that they want ice cream. */
  likelihood: number;
  /** Which look in residents.png. */
  look: number;
  /** Where they come out of and go into their house. */
  door: [number, number];
  /** Spots in their yard, as x, y pairs. */
  yard: number[];
  /**
   * SCREAM-67: where they wait for the truck: [stand x, stand y, pink square x,
   * pink square y, the road's angle in degrees]. They run to it straight from their door.
   */
  curb: [number, number, number, number, number];
}

export type ResidentFacing = 'right' | 'up' | 'left' | 'down';

/**
 * A resident as a customer (SCREAM-67):
 * - none: hasn't wanted ice cream yet this evening
 * - running: heard the truck, wants ice cream, heading for the curb
 * - waiting: at the curb, waiting for the truck
 * - window: being served at the truck's window
 * - done: served, or gave up waiting. Nobody is a customer twice in one evening.
 */
export type CustomerState = 'none' | 'running' | 'waiting' | 'window' | 'done';

/** What a resident is doing right now. */
export interface ResidentNow {
  readonly resident: Resident;
  x: number;
  y: number;
  /** False while they're inside their house (not drawn), or at the truck's window. */
  outside: boolean;
  /** True while walking or running; false while standing still. */
  walking: boolean;
  facing: ResidentFacing;
  customer: CustomerState;
  /** Seconds left before a waiting customer gives up and walks home. */
  waitLeft: number;
}

/** The truck's music ring this frame: who can hear it, and whether anyone may start wanting ice cream. */
export interface Ring {
  x: number;
  y: number;
  radius: number;
  /** False when nobody new should come out: sold out, after 8 PM, or the evening is over. */
  open: boolean;
}

type Then = 'idle' | 'inside' | 'curb';
type Plan =
  | { kind: 'inside'; until: number }
  | { kind: 'walk'; route: [number, number][]; speed: number; then: Then }
  | { kind: 'idle'; until: number };

interface Running extends ResidentNow {
  plan: Plan;
  /** When they head back inside, in seconds of evening time. */
  goInsideAt: number;
  /** How many seconds in a row they've been hearing the truck. */
  heard: number;
  waitUntil: number;
}

const between = (rnd: () => number, [low, high]: readonly [number, number]) => low + rnd() * (high - low);

/**
 * The chance, each second, that someone who has heard the truck for `heard` seconds
 * in a row wants ice cream (PO, November 2): it grows the longer they hear it, each
 * second adding less than the last, from CUSTOMER_CHANCE_START toward CUSTOMER_CHANCE_CAP.
 * Then times their likelihood from the sheet, and halved while they're indoors.
 */
export function customerChance(heard: number, likelihood: number, indoors: boolean): number {
  const growth = 1 - Math.exp(-Math.max(0, heard - 1) / CUSTOMER_CHANCE_GROWTH_SECONDS);
  const base = CUSTOMER_CHANCE_START + (CUSTOMER_CHANCE_CAP - CUSTOMER_CHANCE_START) * growth;
  return base * likelihood * (indoors ? CUSTOMER_INDOORS_FACTOR : 1);
}

export class Residents {
  private readonly people: Running[];
  private readonly rnd: () => number;
  private now = 0;
  private sinceRoll = 0;
  /** The chance formula, for the browser tests. */
  static readonly chance = customerChance;
  /** Test hook: when true, nobody new wants ice cream (keeps driving tests free of sales). */
  hearingOff = false;

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
        customer: 'none',
        waitLeft: 0,
        plan: { kind: 'inside', until: 0 },
        goInsideAt: 0,
        heard: 0,
        waitUntil: 0,
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

  /** Customers at the curb right now, waiting for the truck. */
  get waiting(): readonly ResidentNow[] {
    return this.people.filter((p) => p.customer === 'waiting');
  }

  /**
   * Moves everyone on by `dt` seconds. With a `ring` (the truck is on the road),
   * everyone inside it gets their once-a-second chance of wanting ice cream.
   */
  update(dt: number, ring?: Ring): void {
    this.now += dt;
    this.sinceRoll += dt;
    while (this.sinceRoll >= 1) {
      this.sinceRoll -= 1;
      this.rollChances(ring);
    }
    for (const p of this.people) this.step(p, dt);
  }

  /** The truck picked this customer up: they're at the window now. */
  startServing(person: ResidentNow): void {
    const p = person as Running;
    if (p.customer !== 'waiting') return;
    p.customer = 'window';
    p.outside = false;
    p.walking = false;
  }

  /** The sale is over (sold, or not): they step back onto the sidewalk and walk home. */
  finishServing(person: ResidentNow): void {
    const p = person as Running;
    if (p.customer !== 'window') return;
    p.customer = 'done';
    p.outside = true;
    p.x = p.resident.curb[0];
    p.y = p.resident.curb[1];
    this.walkHome(p);
  }

  /**
   * Test and debug hook: makes this resident a customer waiting at their curb right
   * now, as if they'd heard the truck and run out.
   */
  callNow(person: ResidentNow): void {
    const p = person as Running;
    p.customer = 'waiting';
    p.outside = true;
    p.walking = false;
    p.x = p.resident.curb[0];
    p.y = p.resident.curb[1];
    p.waitUntil = this.now + CUSTOMER_WAIT_SECONDS;
    p.waitLeft = CUSTOMER_WAIT_SECONDS;
    p.facing = this.facingToRoad(p.resident);
    p.plan = { kind: 'idle', until: Infinity };
  }

  private rollChances(ring?: Ring): void {
    for (const p of this.people) {
      if (p.customer !== 'none') continue;
      const indoors = !p.outside;
      const [x, y] = indoors ? p.resident.door : [p.x, p.y];
      const inRing = !!ring && Math.hypot(x - ring.x, y - ring.y) <= ring.radius;
      // "The longer someone hears the truck": counted in a row, so it starts again once the truck has gone.
      p.heard = inRing ? p.heard + 1 : 0;
      if (!inRing || !ring?.open || this.hearingOff) continue;
      if (this.rnd() < customerChance(p.heard, p.resident.likelihood, indoors)) this.wantIceCream(p);
    }
  }

  /** They want ice cream: out of the house if need be, then a run to the curb. */
  private wantIceCream(p: Running): void {
    p.customer = 'running';
    const stand: [number, number] = [p.resident.curb[0], p.resident.curb[1]];
    if (!p.outside) {
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
      this.walkTo(p, [stand], CUSTOMER_RUN_SPEED, 'curb');
    } else {
      // Yard spots are chosen so the walk to the door never crosses the house; the run to the curb starts there.
      this.walkTo(p, [p.resident.door, stand], CUSTOMER_RUN_SPEED, 'curb');
    }
  }

  private walkHome(p: Running): void {
    this.walkTo(p, [p.resident.door], RESIDENT_WALK_SPEED, 'inside');
  }

  private step(p: Running, dt: number): void {
    if (p.customer === 'window') return;
    if (p.customer === 'waiting') {
      p.waitLeft = Math.max(0, p.waitUntil - this.now);
      if (p.waitLeft > 0) return;
      // PO, November 2: a customer waits 30 seconds at the curb, then walks home.
      p.customer = 'done';
      this.walkHome(p);
      return;
    }
    const plan = p.plan;
    if (plan.kind === 'inside') {
      if (this.now < plan.until) return;
      // Out of the front door, then off into the yard.
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
      p.goInsideAt = this.now + between(this.rnd, RESIDENT_OUTSIDE_SECONDS);
      this.walkTo(p, [this.yardSpot(p.resident)], RESIDENT_WALK_SPEED, 'idle');
      return;
    }
    if (plan.kind === 'idle') {
      if (this.now < plan.until) return;
      if (this.now >= p.goInsideAt) this.walkTo(p, [p.resident.door], RESIDENT_WALK_SPEED, 'inside');
      else this.walkTo(p, [this.yardSpot(p.resident)], RESIDENT_WALK_SPEED, 'idle');
      return;
    }
    // Walking (or running), one leg of the route at a time.
    let stepLength = plan.speed * dt;
    while (stepLength > 0 && plan.route.length) {
      const [tx, ty] = plan.route[0];
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > stepLength) {
        p.x += (dx / dist) * stepLength;
        p.y += (dy / dist) * stepLength;
        p.facing = facingFor(dx, dy);
        return;
      }
      p.x = tx;
      p.y = ty;
      stepLength -= dist;
      plan.route.shift();
      const next = plan.route[0];
      if (next) p.facing = facingFor(next[0] - p.x, next[1] - p.y);
    }
    this.arrive(p, plan.then);
  }

  private arrive(p: Running, then: Then): void {
    p.walking = false;
    if (then === 'inside') {
      p.outside = false;
      p.plan = { kind: 'inside', until: this.now + between(this.rnd, RESIDENT_INSIDE_SECONDS) };
    } else if (then === 'curb') {
      p.customer = 'waiting';
      p.waitUntil = this.now + CUSTOMER_WAIT_SECONDS;
      p.waitLeft = CUSTOMER_WAIT_SECONDS;
      p.facing = this.facingToRoad(p.resident);
      p.plan = { kind: 'idle', until: Infinity };
    } else {
      p.facing = 'down';
      p.plan = { kind: 'idle', until: this.now + between(this.rnd, RESIDENT_IDLE_SECONDS) };
    }
  }

  private walkTo(p: Running, route: [number, number][], speed: number, then: Then): void {
    p.plan = { kind: 'walk', route: route.map(([x, y]) => [x, y]), speed, then };
    p.walking = true;
    const first = route[0];
    if (first) p.facing = facingFor(first[0] - p.x, first[1] - p.y);
  }

  private facingToRoad(r: Resident): ResidentFacing {
    return facingFor(r.curb[2] - r.curb[0], r.curb[3] - r.curb[1]);
  }

  private yardSpot(r: Resident): [number, number] {
    const n = r.yard.length / 2;
    if (n === 0) return r.door;
    const i = Math.floor(this.rnd() * n);
    return [r.yard[i * 2], r.yard[i * 2 + 1]];
  }
}

function facingFor(dx: number, dy: number): ResidentFacing {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}
