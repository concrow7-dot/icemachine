// SCREAM-59 + SCREAM-73: the neighbourhood's residents. Everyone has a name, a house
// and their own likelihood of buying (from the PO's residents sheet, doc 15), and
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
  BUYER_REGULAR_FROM,
  BUYER_SOMETIMES_DAYS,
  CUSTOMER_CHANCE_FIRST,
  CUSTOMER_CHANCE_FLOOR,
  CUSTOMER_CHANCE_SETTLE_SECONDS,
  CUSTOMER_DECIDE_SECONDS,
  CUSTOMER_REGULAR_CHANCE,
  CUSTOMER_INDOORS_FACTOR,
  CUSTOMER_FOLLOW_AGAIN,
  CUSTOMER_QUEUE_GAP,
  CUSTOMER_RUN_SPEED,
  CUSTOMER_SIDE_BY_SIDE,
  CUSTOMER_SPOT_REACH,
  CUSTOMER_SPOT_MAX,
  CUSTOMER_STOP_GAP,
  CUSTOMER_WAIT_SECONDS,
  RESIDENT_IDLE_SECONDS,
  RESIDENT_INSIDE_SECONDS,
  RESIDENT_OUTSIDE_SECONDS,
  RESIDENT_START_OUTSIDE_CHANCE,
  RESIDENT_WALK_SPEED,
  BUYERS_INSIDE_SECONDS,
  BUYERS_OUTSIDE_SECONDS,
  BUYERS_START_OUTSIDE_CHANCE,
} from '../config/tuning';
import type { CurbFinder } from './CurbFinder';

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

/**
 * SCREAM-148 (PO, November 3): what kind of buyer someone is, from their likelihood.
 * - regular: can buy every evening
 * - sometimes: buys on one day in BUYER_SOMETIMES_DAYS, and is outside more
 * - never: never buys (likelihood 0)
 */
export type BuyerKind = 'regular' | 'sometimes' | 'never';

export function buyerKind(likelihood: number): BuyerKind {
  if (likelihood <= 0) return 'never';
  return likelihood >= BUYER_REGULAR_FROM ? 'regular' : 'sometimes';
}

/**
 * SCREAM-148: which day of each BUYER_SOMETIMES_DAYS a sometimes buyer buys on (0 is the
 * first), worked out from the Story run's seed so it stays the same for the whole run.
 */
export function sometimesDay(id: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) % BUYER_SOMETIMES_DAYS;
}

/**
 * Does this resident buy tonight? Quick play leaves `story` out: a sometimes buyer then
 * has a 1 in BUYER_SOMETIMES_DAYS chance. Story passes the day (from 1) and the run's seed.
 */
export function buysTonight(
  resident: Resident,
  rnd: () => number,
  story?: { day: number; seed: number },
): boolean {
  const kind = buyerKind(resident.likelihood);
  if (kind !== 'sometimes') return kind === 'regular';
  if (!story) return rnd() < 1 / BUYER_SOMETIMES_DAYS;
  return (story.day - 1) % BUYER_SOMETIMES_DAYS === sometimesDay(resident.id, story.seed);
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
   * SCREAM-140: where their pink square is (x, y, the road's angle in degrees), beside
   * where they stopped (their own curb spot's square without the streets).
   */
  pickup: [number, number, number];
  /** SCREAM-148: whether they'd buy tonight at all (never buyers, and sometimes buyers on their other days, don't). */
  readonly buys: boolean;
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

interface Running extends ResidentNow {
  plan: Plan;
  /** When they head back inside, in seconds of evening time. */
  goInsideAt: number;
  /** How many seconds in a row they've been hearing the truck. */
  heard: number;
  waitUntil: number;
  /** SCREAM-142: seconds of waiting left; it only counts down while they're stopped. */
  patience: number;
  /** SCREAM-142: where their pink square will be, once they've picked a spot by the truck. */
  waitAt?: [number, number, number];
  /** SCREAM-156: where the first person at their spot stands (others stand beside it). */
  spotStand?: [number, number];
  /** SCREAM-152: heard the truck CUSTOMER_DECIDE_SECONDS without coming out: not tonight. */
  decided?: boolean;
  /** SCREAM-142: true for customers who follow the truck (not the test hook's, who stay at their curb). */
  follows?: boolean;
}

const between = (rnd: () => number, [low, high]: readonly [number, number]) => low + rnd() * (high - low);

/**
 * The chance, in a second, that someone who has heard the truck for `heard` seconds in
 * a row wants ice cream (PO, November 2): highest the moment they hear it, then falling,
 * each second by less than the last, from CUSTOMER_CHANCE_FIRST toward CUSTOMER_CHANCE_FLOOR.
 * Then times their likelihood from the sheet, and halved while they're indoors.
 * SCREAM-152: regulars have a steady CUSTOMER_REGULAR_CHANCE instead of the falling one, and
 * after CUSTOMER_DECIDE_SECONDS of hearing it, nobody comes out (they've made up their mind).
 */
export function customerChance(heard: number, likelihood: number, indoors: boolean, regular = false): number {
  if (heard > CUSTOMER_DECIDE_SECONDS) return 0;
  const indoorsFactor = indoors ? CUSTOMER_INDOORS_FACTOR : 1;
  if (regular) return CUSTOMER_REGULAR_CHANCE * likelihood * indoorsFactor;
  const settled = 1 - Math.exp(-Math.max(0, heard - 1) / CUSTOMER_CHANCE_SETTLE_SECONDS);
  const base = CUSTOMER_CHANCE_FIRST - (CUSTOMER_CHANCE_FIRST - CUSTOMER_CHANCE_FLOOR) * settled;
  return base * likelihood * indoorsFactor;
}

/** SCREAM-148 / 152 (PO, November 3): sometimes buyers and regulars are outside about 3/4 of the time; never buyers as before. */
function routineFor(resident: Resident): {
  startOutside: number;
  outside: readonly [number, number];
  inside: readonly [number, number];
} {
  return buyerKind(resident.likelihood) !== 'never'
    ? { startOutside: BUYERS_START_OUTSIDE_CHANCE, outside: BUYERS_OUTSIDE_SECONDS, inside: BUYERS_INSIDE_SECONDS }
    : { startOutside: RESIDENT_START_OUTSIDE_CHANCE, outside: RESIDENT_OUTSIDE_SECONDS, inside: RESIDENT_INSIDE_SECONDS };
}

export class Residents {
  private readonly people: Running[];
  private readonly rnd: () => number;
  private now = 0;
  private sinceRoll = 0;
  /** The chance formula, for the browser tests. */
  static readonly chance = customerChance;
  /** SCREAM-148: the buyer kinds, for the browser tests. */
  static readonly kind = buyerKind;
  static readonly buysTonight = buysTonight;
  /** Test hook: when true, nobody new wants ice cream (keeps driving tests free of sales). */
  hearingOff = false;
  /** SCREAM-140: finds a spot at the curb with room for a pink square (without it, customers wait at their own curb spot). */
  private readonly curbs?: CurbFinder;
  /** Where the truck was last seen (the ring's centre). */
  private truck: [number, number] | null = null;

  /** `rnd` returns 0 to 1 (Math.random by default; tests pass their own). */
  /** `curbs` (SCREAM-140) lets customers walk to the truck and wait at the curb beside it. */
  /** `story` (SCREAM-148): Story mode's day and run seed, which pick each sometimes buyer's day. */
  /**
   * SCREAM-161: houses, shops, fences, the court and the playground, as boxes on the map.
   * Customers head straight for the truck but walk round these (EveningState sets them).
   */
  walls: readonly Wall[] = [];

  constructor(
    list: readonly Resident[],
    rnd: () => number = Math.random,
    curbs?: CurbFinder,
    story?: { day: number; seed: number },
  ) {
    this.rnd = rnd;
    this.curbs = curbs;
    this.people = list.map((resident) => {
      const times = routineFor(resident);
      const outside = rnd() < times.startOutside;
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
        patience: 0,
        buys: buysTonight(resident, rnd, story),
      };
      if (outside) {
        person.goInsideAt = between(rnd, times.outside) * rnd();
        person.plan = { kind: 'idle', until: between(rnd, RESIDENT_IDLE_SECONDS) * rnd() };
      } else {
        person.plan = { kind: 'inside', until: between(rnd, times.inside) * rnd() };
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
    // SCREAM-140: back on the sidewalk where they stood, then home.
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
    p.patience = CUSTOMER_WAIT_SECONDS;
    p.waitAt = undefined;
    p.spotStand = [p.resident.curb[0], p.resident.curb[1]];
    p.follows = false;
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
      if (!inRing || !ring?.open || this.hearingOff || !p.buys || p.decided) continue;
      const regular = buyerKind(p.resident.likelihood) === 'regular';
      if (this.rnd() < customerChance(p.heard, p.resident.likelihood, indoors, regular)) this.wantIceCream(p);
      else if (p.heard >= CUSTOMER_DECIDE_SECONDS) p.decided = true;
    }
  }

  /**
   * They want ice cream: out of the house if need be, then (SCREAM-142) straight toward the
   * truck. Without the streets, a run to their own curb spot as before.
   */
  private wantIceCream(p: Running): void {
    p.customer = 'running';
    p.patience = CUSTOMER_WAIT_SECONDS;
    p.waitAt = undefined;
    const fromDoor = !p.outside;
    if (fromDoor) {
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
    }
    p.follows = !!this.curbs;
    if (this.curbs) {
      p.walking = true;
      p.plan = { kind: 'follow' };
      return;
    }
    const stand: [number, number] = [p.resident.curb[0], p.resident.curb[1]];
    // Yard spots are chosen so the walk to the door never crosses the house; the run to the curb starts there.
    this.walkTo(p, fromDoor ? [stand] : [p.resident.door, stand], CUSTOMER_RUN_SPEED, 'curb');
  }

  /**
   * SCREAM-156: a spot near `p` where someone is already waiting (or heading) with room for
   * one more, and where `p` would stand: beside the others along the curb, on the sidewalk.
   */
  private joinSpot(p: Running): { square: [number, number, number]; base: [number, number]; stand: [number, number] } | null {
    if (!this.curbs) return null;
    const spots = new Map<string, { square: [number, number, number]; base: [number, number]; count: number }>();
    for (const o of this.people) {
      if (o === p || !o.spotStand) continue;
      const square = o.customer === 'waiting' ? o.pickup : o.customer === 'running' ? o.waitAt : undefined;
      if (!square) continue;
      const key = `${square[0]},${square[1]}`;
      const s = spots.get(key);
      if (s) s.count++;
      else spots.set(key, { square, base: o.spotStand, count: 1 });
    }
    let best: { square: [number, number, number]; base: [number, number]; stand: [number, number] } | null = null;
    let bestD = Infinity;
    for (const s of spots.values()) {
      if (s.count >= CUSTOMER_SPOT_MAX) continue;
      const d = Math.hypot(s.base[0] - p.x, s.base[1] - p.y);
      if (d > CUSTOMER_STOP_GAP || d >= bestD) continue;
      // Beside the others along the curb: +12, -12, +24, -24 px; the first of those on the sidewalk.
      const a = (s.square[2] * Math.PI) / 180;
      let stand: [number, number] | null = null;
      for (let k = s.count; k <= CUSTOMER_SPOT_MAX + 1 && !stand; k++) {
        const shift = Math.ceil(k / 2) * CUSTOMER_SIDE_BY_SIDE * (k % 2 ? 1 : -1);
        const pt: [number, number] = [s.base[0] + Math.cos(a) * shift, s.base[1] + Math.sin(a) * shift];
        const reach = !this.truck || Math.hypot(pt[0] - this.truck[0], pt[1] - this.truck[1]) <= CUSTOMER_SPOT_REACH;
        if (reach && this.curbs.standClear(pt[0], pt[1])) stand = pt;
      }
      if (!stand) continue;
      best = { square: s.square, base: s.base, stand };
      bestD = d;
    }
    return best;
  }

  private walkHome(p: Running): void {
    this.walkTo(p, [p.resident.door], RESIDENT_WALK_SPEED, 'inside');
  }

  /**
   * SCREAM-140 / SCREAM-142 (PO, November 2): a customer walks straight toward the truck and
   * keeps following it. Once within CUSTOMER_STOP_GAP of it, they step to the curb beside them
   * where there's room for a pink square, and wait there.
   */
  private stepFollow(p: Running, dt: number): void {
    if (!this.truck || !this.curbs) return;
    const [tx, ty] = this.truck;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CUSTOMER_STOP_GAP) {
      // SCREAM-156: join someone already waiting nearby, if their spot has room.
      const join = this.joinSpot(p);
      if (join) {
        p.waitAt = join.square;
        p.spotStand = join.base;
        this.walkTo(p, [join.stand], CUSTOMER_RUN_SPEED, 'curb');
        return;
      }
      const taken: [number, number][] = [];
      for (const o of this.people) {
        if (o === p) continue;
        if (o.customer === 'waiting') taken.push([o.pickup[0], o.pickup[1]]);
        else if (o.waitAt) taken.push([o.waitAt[0], o.waitAt[1]]);
      }
      const spot = this.curbs.near(p.x, p.y, taken, CUSTOMER_QUEUE_GAP, [tx, ty, CUSTOMER_SPOT_REACH]);
      if (spot) {
        p.waitAt = spot.square;
        p.spotStand = spot.stand;
        this.walkTo(p, [spot.stand], CUSTOMER_RUN_SPEED, 'curb');
        return;
      }
      // SCREAM-150: no room for a pink square anywhere near the truck. Rather than stand in
      // the street with no square, they go back to their own curb spot (it always has room)
      // and wait there, without following the truck again.
      p.waitAt = [p.resident.curb[2], p.resident.curb[3], p.resident.curb[4]];
      p.spotStand = [p.resident.curb[0], p.resident.curb[1]];
      p.follows = false;
      this.walkTo(p, [[p.resident.curb[0], p.resident.curb[1]]], CUSTOMER_RUN_SPEED, 'curb');
      return;
    }
    // Toward the truck, but not into it; SCREAM-161: round any building in the way.
    const step = Math.min(CUSTOMER_RUN_SPEED * dt, Math.max(0, dist - CUSTOMER_STOP_GAP / 2));
    p.walking = step > 0;
    if (step <= 0) return;
    const [vx, vy] = detour(this.walls, p.x, p.y, tx, ty);
    const vdx = vx - p.x;
    const vdy = vy - p.y;
    const vd = Math.hypot(vdx, vdy) || 1;
    p.x += (vdx / vd) * Math.min(step, vd);
    p.y += (vdy / vd) * Math.min(step, vd);
    p.facing = facingFor(vdx, vdy);
  }

  private step(p: Running, dt: number): void {
    if (p.customer === 'window') return;
    if (p.customer === 'waiting') {
      p.waitLeft = Math.max(0, p.waitUntil - this.now);
      // SCREAM-150 (PO, November 3): only served from the sidewalk. Anyone waiting in the road
      // (it shouldn't happen) keeps looking for a spot where they can be served.
      if (p.waitLeft > 0 && p.follows && this.curbs && !this.curbs.standClear(p.x, p.y)) {
        p.patience = p.waitLeft;
        p.customer = 'running';
        p.waitAt = undefined;
        p.spotStand = undefined;
        p.walking = true;
        p.plan = { kind: 'follow' };
        return;
      }
      // SCREAM-142: if the truck pulls away, they set off after it again (their patience paused).
      if (p.waitLeft > 0 && p.follows && this.truck && Math.hypot(this.truck[0] - p.x, this.truck[1] - p.y) > CUSTOMER_FOLLOW_AGAIN) {
        p.patience = p.waitLeft;
        p.spotStand = undefined;
        p.customer = 'running';
        p.walking = true;
        p.plan = { kind: 'follow' };
        return;
      }
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
      p.goInsideAt = this.now + between(this.rnd, routineFor(p.resident).outside);
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
      // SCREAM-161: round a building in the way first (yard walks never meet one).
      const [vx, vy] = detour(this.walls, p.x, p.y, tx, ty);
      if (vx !== tx || vy !== ty) {
        const vdx = vx - p.x;
        const vdy = vy - p.y;
        const vd = Math.hypot(vdx, vdy) || 1;
        p.x += (vdx / vd) * Math.min(stepLength, vd);
        p.y += (vdy / vd) * Math.min(stepLength, vd);
        p.facing = facingFor(vdx, vdy);
        return;
      }
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
      p.plan = { kind: 'inside', until: this.now + between(this.rnd, routineFor(p.resident).inside) };
    } else if (then === 'curb') {
      // At the curb: wait for the truck, the pink square beside them (SCREAM-140: where they stopped).
      p.customer = 'waiting';
      p.waitUntil = this.now + p.patience;
      p.waitLeft = p.patience;
      if (p.waitAt) {
        p.pickup = p.waitAt;
        p.waitAt = undefined;
        p.facing = facingFor(p.pickup[0] - p.x, p.pickup[1] - p.y);
      } else {
        p.pickup = [p.resident.curb[2], p.resident.curb[3], p.resident.curb[4]];
        p.facing = this.facingToRoad(p.resident);
      }
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

/** SCREAM-161: a building's box on the map (its picture: left, top, right, bottom). */
export interface Wall {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How far round a building people keep (px). */
const WALL_GAP = 6;

function inBox(w: Wall, x: number, y: number, pad: number): boolean {
  return x > w.x0 - pad && x < w.x1 + pad && y > w.y0 - pad && y < w.y1 + pad;
}

/** Where the line a-b first enters box w grown by pad, as a fraction of the way (null if it doesn't). */
function hitBox(w: Wall, ax: number, ay: number, bx: number, by: number, pad: number): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const edges: [number, number][] = [[-dx, ax - (w.x0 - pad)], [dx, w.x1 + pad - ax], [-dy, ay - (w.y0 - pad)], [dy, w.y1 + pad - ay]];
  for (const [q, r] of edges) {
    if (q === 0) {
      if (r < 0) return null;
      continue;
    }
    const t = r / q;
    if (q < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return t0;
}

/** How far round the area between walker and target buildings are looked at (px). */
const DETOUR_REACH = 240;

/**
 * SCREAM-161 / SCREAM-162: where to head for to get from (x, y) toward (tx, ty) without walking
 * through a building: the target itself if the way is clear, or else the first corner of the
 * shortest way round the buildings in between (corners kept WALL_GAP + 1 px off each building).
 * Being the start of the shortest way, it stays the same from one step to the next, so nobody
 * flips between two corners. Buildings the walker or the target is inside (a spot behind a
 * house) don't count; one they're right beside only counts its walls, not the gap kept round it.
 */
export function detour(walls: readonly Wall[], x: number, y: number, tx: number, ty: number): [number, number] {
  const lx = Math.min(x, tx) - DETOUR_REACH;
  const hx = Math.max(x, tx) + DETOUR_REACH;
  const ly = Math.min(y, ty) - DETOUR_REACH;
  const hy = Math.max(y, ty) + DETOUR_REACH;
  const near = walls.filter((w) => w.x1 > lx && w.x0 < hx && w.y1 > ly && w.y0 < hy && !inBox(w, x, y, 0) && !inBox(w, tx, ty, 0));
  // Is the straight line a-b clear? A building one end is right beside only counts without its gap.
  const open = (ax: number, ay: number, bx: number, by: number): boolean => {
    for (const w of near) {
      const pad = inBox(w, ax, ay, WALL_GAP) || inBox(w, bx, by, WALL_GAP) ? 0 : WALL_GAP;
      if (hitBox(w, ax, ay, bx, by, pad) !== null) return false;
    }
    return true;
  };
  if (open(x, y, tx, ty)) return [tx, ty];
  // Corners round the buildings, leaving out any inside another building.
  const g = WALL_GAP + 1;
  const pts: [number, number][] = [[x, y], [tx, ty]];
  for (const w of near) {
    for (const c of [[w.x0 - g, w.y0 - g], [w.x1 + g, w.y0 - g], [w.x1 + g, w.y1 + g], [w.x0 - g, w.y1 + g]] as [number, number][]) {
      if (!near.some((o) => inBox(o, c[0], c[1], 0))) pts.push(c);
    }
  }
  // Shortest way from the target back to the walker (Dijkstra over the corners), so the
  // answer is the walker's next corner.
  const n = pts.length;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  const next = new Array<number>(n).fill(-1);
  dist[1] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0 || u === 0) break;
    done[u] = true;
    const [ux, uy] = pts[u]!;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const [vx, vy] = pts[v]!;
      const d = dist[u]! + Math.hypot(vx - ux, vy - uy);
      if (d < dist[v]! && open(vx, vy, ux, uy)) {
        dist[v] = d;
        next[v] = u;
      }
    }
  }
  const step = next[0]!;
  return step >= 0 ? pts[step]! : [tx, ty];
}
