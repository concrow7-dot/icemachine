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
  CUSTOMER_CHANCE_FIRST,
  CUSTOMER_CHANCE_FLOOR,
  CUSTOMER_CHANCE_SETTLE_SECONDS,
  CUSTOMER_INDOORS_FACTOR,
  CUSTOMER_FOLLOW_MAX,
  CUSTOMER_QUEUE_GAP,
  CUSTOMER_RUN_SPEED,
  CUSTOMER_STOP_GAP,
  CUSTOMER_WAIT_SECONDS,
  RESIDENT_IDLE_SECONDS,
  RESIDENT_INSIDE_SECONDS,
  RESIDENT_OUTSIDE_SECONDS,
  RESIDENT_START_OUTSIDE_CHANCE,
  RESIDENT_WALK_SPEED,
} from '../config/tuning';
import type { CurbPath } from './CurbPath';
import { LANE_OFFSET } from './RoadGeometry';

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
  /**
   * SCREAM-140: where their pink square is (x, y, the road's angle in degrees). Their own
   * curb spot's square until they walk along the curb toward the truck.
   */
  pickup: [number, number, number];
}

/** The truck's music ring this frame: who can hear it, and whether anyone may start wanting ice cream. */
export interface Ring {
  x: number;
  y: number;
  radius: number;
  /** False when nobody new should come out: sold out, after 8 PM, or the evening is over. */
  open: boolean;
  /**
   * SCREAM-118: how many times longer waiting customers are willing to wait right now
   * (2 while you serve someone at the window). Leave out for normal waiting.
   */
  patience?: number;
}

type Then = 'idle' | 'inside' | 'curb';
type Plan =
  | { kind: 'inside'; until: number }
  | { kind: 'walk'; route: [number, number][]; speed: number; then: Then }
  | { kind: 'follow' }
  | { kind: 'idle'; until: number };

/** SCREAM-140: a customer beside a street: which, how far along, which side; `home` is their own curb spot. */
interface Follow {
  road: number;
  along: number;
  side: number;
  home: number;
}

interface Running extends ResidentNow {
  plan: Plan;
  /** When they head back inside, in seconds of evening time. */
  goInsideAt: number;
  /** How many seconds in a row they've been hearing the truck. */
  heard: number;
  waitUntil: number;
  follow?: Follow;
}

const between = (rnd: () => number, [low, high]: readonly [number, number]) => low + rnd() * (high - low);

/**
 * The chance, in a second, that someone who has heard the truck for `heard` seconds in
 * a row wants ice cream (PO, November 2): highest the moment they hear it, then falling,
 * each second by less than the last, from CUSTOMER_CHANCE_FIRST toward CUSTOMER_CHANCE_FLOOR.
 * Then times their likelihood from the sheet, and halved while they're indoors.
 */
export function customerChance(heard: number, likelihood: number, indoors: boolean): number {
  const settled = 1 - Math.exp(-Math.max(0, heard - 1) / CUSTOMER_CHANCE_SETTLE_SECONDS);
  const base = CUSTOMER_CHANCE_FIRST - (CUSTOMER_CHANCE_FIRST - CUSTOMER_CHANCE_FLOOR) * settled;
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
  /** SCREAM-140: the streets, for walking along the curb (without them, customers wait at their own curb spot). */
  private readonly curbs?: CurbPath;
  /** Where the truck was last seen (the ring's centre). */
  private truck: [number, number] | null = null;
  private readonly squareFits?: (x: number, y: number, road: number) => boolean;

  /** `rnd` returns 0 to 1 (Math.random by default; tests pass their own). */
  /**
   * `curbs` (SCREAM-140) lets customers walk along the curb toward the truck; `squareFits`
   * says whether a pink square can go at (x, y) beside that street (on the road, clear of
   * parked cars, bays and junctions).
   */
  constructor(
    list: readonly Resident[],
    rnd: () => number = Math.random,
    curbs?: CurbPath,
    squareFits?: (x: number, y: number, road: number) => boolean,
  ) {
    this.rnd = rnd;
    this.curbs = curbs;
    this.squareFits = squareFits;
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
        pickup: [resident.curb[2], resident.curb[3], resident.curb[4]],
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
    if (ring) this.truck = [ring.x, ring.y];
    this.sinceRoll += dt;
    while (this.sinceRoll >= 1) {
      this.sinceRoll -= 1;
      this.rollChances(ring);
    }
    // SCREAM-118: while you serve someone, the others at the curb wait longer (their time runs slower).
    const patience = ring?.patience ?? 1;
    if (patience > 1) {
      for (const p of this.people) if (p.customer === 'waiting') p.waitUntil += dt * (1 - 1 / patience);
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
    // SCREAM-140: back on the sidewalk where they stood (they may have walked along the curb).
    if (!p.follow) {
      p.x = p.resident.curb[0];
      p.y = p.resident.curb[1];
    }
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
    p.pickup = [p.resident.curb[2], p.resident.curb[3], p.resident.curb[4]];
    p.follow = undefined;
    p.plan = { kind: 'idle', until: Infinity };
  }

  private rollChances(ring?: Ring): void {
    for (const p of this.people) {
      if (p.customer !== 'none') continue;
      const indoors = !p.outside;
      const [x, y] = indoors ? p.resident.door : [p.x, p.y];
      const inRing = !!ring && Math.hypot(x - ring.x, y - ring.y) <= ring.radius;
      // Seconds heard are counted in a row, so someone who hears the truck again later gets a fresh first-second chance.
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
    const f = p.follow;
    p.follow = undefined;
    if (f && this.curbs && Math.abs(f.along - f.home) > 1) {
      // SCREAM-140: back along the curb to their own spot, then up to the door.
      const back = this.curbs.route(f.road, f.along, f.home, f.side);
      this.walkTo(p, [...back, [p.resident.curb[0], p.resident.curb[1]], p.resident.door], RESIDENT_WALK_SPEED, 'inside');
      return;
    }
    this.walkTo(p, [p.resident.door], RESIDENT_WALK_SPEED, 'inside');
  }

  /**
   * SCREAM-140 (PO, November 2): at the curb, a customer walks along it toward the truck,
   * and stops a short way off (CUSTOMER_STOP_GAP), at most CUSTOMER_FOLLOW_MAX from their own
   * spot, or just before someone already waiting. Then they wait, with their pink square beside them.
   */
  private stepFollow(p: Running, dt: number): void {
    const f = p.follow;
    const curbs = this.curbs;
    if (!f || !curbs) return this.startWaiting(p);
    const truck = this.truck ? curbs.project(f.road, this.truck[0], this.truck[1]) : null;
    if (!truck) return this.startWaiting(p);
    // Where to stop: a short way before the truck (or here, if it's already that close),
    // no further than they're willing to go, on the street.
    const toTruck = truck.along - f.along;
    let goal = Math.abs(toTruck) <= CUSTOMER_STOP_GAP ? f.along : truck.along - Math.sign(toTruck) * CUSTOMER_STOP_GAP;
    goal = Math.max(f.home - CUSTOMER_FOLLOW_MAX, Math.min(f.home + CUSTOMER_FOLLOW_MAX, goal));
    goal = Math.max(0, Math.min(curbs.length(f.road), goal));
    // ...and where their pink square has room: not on a parked car, a bay, a junction or
    // someone else's square. Otherwise a little further back toward their own spot (always fine).
    while (Math.abs(goal - f.home) > 1 && !this.roomFor(p, f, goal)) {
      goal = Math.abs(goal - f.home) <= 10 ? f.home : goal - Math.sign(goal - f.home) * 10;
    }
    const step = Math.min(Math.abs(goal - f.along), CUSTOMER_RUN_SPEED * dt);
    if (step <= 0.001) return this.startWaiting(p);
    const before: [number, number] = [p.x, p.y];
    f.along += Math.sign(goal - f.along) * step;
    const spot = curbs.at(f.road, f.along, f.side);
    p.x = spot.x;
    p.y = spot.y;
    p.walking = true;
    p.facing = facingFor(p.x - before[0], p.y - before[1]);
  }

  /** Is there room for this customer's pink square `along` px down their street? */
  private roomFor(p: Running, f: Follow, along: number): boolean {
    const square = this.curbs!.at(f.road, along, Math.sign(f.side) * LANE_OFFSET);
    if (this.squareFits && !this.squareFits(square.x, square.y, f.road)) return false;
    return !this.people.some(
      (o) => o !== p && o.customer === 'waiting' && Math.hypot(o.pickup[0] - square.x, o.pickup[1] - square.y) < CUSTOMER_QUEUE_GAP,
    );
  }

  /** At the curb (or done walking along it): wait for the truck, the pink square beside them. */
  private startWaiting(p: Running): void {
    p.customer = 'waiting';
    p.walking = false;
    p.waitUntil = this.now + CUSTOMER_WAIT_SECONDS;
    p.waitLeft = CUSTOMER_WAIT_SECONDS;
    const f = p.follow;
    if (f && this.curbs && Math.abs(f.along - f.home) > 1) {
      const square = this.curbs.at(f.road, f.along, Math.sign(f.side) * LANE_OFFSET);
      p.pickup = [square.x, square.y, square.angle];
      p.facing = facingFor(square.x - p.x, square.y - p.y);
    } else {
      p.pickup = [p.resident.curb[2], p.resident.curb[3], p.resident.curb[4]];
      p.facing = this.facingToRoad(p.resident);
    }
    p.plan = { kind: 'idle', until: Infinity };
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
    if (plan.kind === 'follow') return this.stepFollow(p, dt);
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
      // SCREAM-140: at the curb, along it toward the truck (or wait here without the streets).
      const spot = this.curbs?.locate(p.resident.curb[2], p.resident.curb[3]);
      const stand = spot && this.curbs?.project(spot.road, p.x, p.y);
      if (!spot || !stand) return this.startWaiting(p);
      p.follow = { road: spot.road, along: stand.along, side: stand.side, home: stand.along };
      p.walking = true;
      p.plan = { kind: 'follow' };
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
