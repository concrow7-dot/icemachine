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
  SCHEDULE_TICKED_FACTOR,
  SCHEDULE_UNTICKED_FACTOR,
  CUSTOMER_CHANCE_FIRST,
  CUSTOMER_CHANCE_FLOOR,
  CUSTOMER_CHANCE_SETTLE_SECONDS,
  CUSTOMER_DECIDE_SECONDS,
  CUSTOMER_REGULAR_CHANCE,
  CUSTOMER_INDOORS_FACTOR,
  CUSTOMER_FOLLOW_AGAIN,
  CUSTOMER_QUEUE_GAP,
  CHASE_ADULT_SECONDS,
  CHASE_REGULAR_SHARE,
  CHASE_SLOW_KID_SECONDS,
  CUSTOMER_RUN_SPEED,
  FAST_KID_SPEED_FACTOR,
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
  CUSTOMER_CURVE_POINTS,
  CUSTOMER_CURVE_SCALE,
  CUSTOMER_CURVE_PEAK_SPREAD,
  PARK_VISITORS_TONIGHT,
  PARK_STAY_LATE,
  PARK_LEAVE_MINUTES,
  PARK_HOME_WALK_MINUTES,
  PARK_LEAVE_SPEED,
  PARK_SPOT_GAP,
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
  /** SCREAM-189 (PO): the sheet's "Order size": always this many ice creams (as many as there are, if fewer). */
  orderSize?: number;
  /** SCREAM-342 (PO): the sheet's "Fast": a kid who is fast and follows the truck anywhere. */
  fast?: boolean;
  /** SCREAM-103 (PO): the sheet's "Hinted": other customers sometimes point the player to this big regular. */
  hinted?: boolean;
  /**
   * SCREAM-221 (PO, decision 057): the sheet's Mon to Sun ticks, as the days they're home
   * (0 = Monday ... 6 = Sunday). In Story these replace Likelihood's buyer kind; Quick play
   * ignores them. Left out when the sheet has no day columns (Story then uses Likelihood).
   */
  days?: number[];
  /**
   * SCREAM-249 (PO, decision 066): the sheet's From and Until, as minutes since midnight
   * (7 PM = 1140), either one null for "no limit": the hours of the evening they're home, in
   * Story. Outside them they stay indoors and don't come to the truck. Left out for most people.
   */
  hours?: [number | null, number | null];
  /**
   * SCREAM-250 (PO, decision 067): the sheet's "Hard to find". In Story, if the music reaches
   * them inside their short window (`hours`) on a ticked day, they always come out; at any other
   * time they're nearly impossible (their tiny Likelihood). Their order is big (Order size) and
   * their tip is 4 times the usual.
   */
  hardToFind?: boolean;
  /**
   * SCREAM-224 (PO, November 15: "I want to add customers to the park area on the elm park map.
   * The basketball court and sand area"): the sheet's "Park". Their places at the park: spots to
   * stand on (x, y pairs), where they walk off the map when they leave, and the park's curb spot
   * (like `curb`). A resident with a house is at the park until they come home (their From).
   */
  park?: { spots: number[]; exit: [number, number]; curb: [number, number, number, number, number] };
  /**
   * SCREAM-224: a park visitor (the sheet's Park with no House): lives in none of the houses.
   * Their `door` is where they walk off the map, their `yard` and `curb` are the park's.
   */
  visitor?: boolean;
}

/** SCREAM-249: whether a resident with hours is home at this time (minutes since midnight). No hours = always. */
export function homeAt(resident: Pick<Resident, 'hours'>, minutes: number): boolean {
  const [from, until] = resident.hours ?? [null, null];
  return (from === null || minutes >= from) && (until === null || minutes < until);
}

/** SCREAM-221: the days of the week, Monday first (Story's Day 1 is a Monday). */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Story's days are Monday to Friday; the weekend is skipped (SCREAM-322). */
export const STORY_WEEK_DAYS = 5;

/**
 * SCREAM-221: which day of the week a Story day is (0 = Monday): Day 1 is Monday. SCREAM-322 (PO,
 * November 14): "Monday through friday for day 1-5 and 6-10": after Friday comes Monday (Day 6).
 */
export function weekdayOf(day: number): number {
  return (((day - 1) % STORY_WEEK_DAYS) + STORY_WEEK_DAYS) % STORY_WEEK_DAYS;
}

/** SCREAM-327 (PO, November 14): "Tuesday Day 2/10", on the HUD and on Continue Story. */
export function dayText(day: number, days: number): string {
  return `${weekdayName(day)} Day ${day}/${days}`;
}

/** SCREAM-221: a Story day's name, e.g. "Monday" for Day 1. */
export function weekdayName(day: number): string {
  return WEEKDAYS[weekdayOf(day)]!;
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
 * SCREAM-221 (decision 057) and SCREAM-232 (PO, November 10): in Story, someone with ticks is a
 * regular if ticked all seven days (reliable at the window, 034), never a buyer only at 0%, and
 * otherwise may come out any evening, likelier on their ticked days (see `scheduleFactor`).
 * Without ticks, or in Quick play (no `story`), Likelihood decides as before.
 */
export function kindFor(resident: Resident, story?: { day: number; seed: number }): BuyerKind {
  // SCREAM-224: a park visitor has no days and is never a regular (engineering's call).
  if (resident.visitor) return resident.likelihood <= 0 ? 'never' : 'sometimes';
  if (!story || !resident.days) return buyerKind(resident.likelihood);
  if (resident.likelihood <= 0) return 'never';
  return resident.days.length >= 7 ? 'regular' : 'sometimes';
}

/**
 * SCREAM-232 (PO, November 10): in Story, how much likelier (ticked today) or less likely (not
 * ticked) someone is to want ice cream tonight: multiplies their Likelihood. 1 in Quick play.
 */
export function scheduleFactor(resident: Resident, story?: { day: number; seed: number }): number {
  if (!story || !resident.days) return 1;
  return resident.days.includes(weekdayOf(story.day)) ? SCHEDULE_TICKED_FACTOR : SCHEDULE_UNTICKED_FACTOR;
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
  const kind = kindFor(resident, story);
  if (kind !== 'sometimes') return kind === 'regular';
  if (resident.visitor) return true; // SCREAM-224: whether they're at the park tonight is rolled by `openPark`
  if (!story) return rnd() < 1 / BUYER_SOMETIMES_DAYS;
  // SCREAM-232: with ticks, anyone (but 0%) may come out any evening; the ticks change how likely (scheduleFactor).
  if (resident.days) return true;
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
  /** SCREAM-224: at the park this evening (until they have walked off or gone home). */
  atPark?: boolean;
  /** SCREAM-224: their time at the park is up: on their way out of it. */
  leaving?: boolean;
  /** SCREAM-224: a park visitor who isn't here tonight, or has left: not on the map at all. */
  gone?: boolean;
}

/** The truck's music ring this frame: who can hear it, and whether anyone may start wanting ice cream. */
export interface Ring {
  x: number;
  y: number;
  radius: number;
  /** False when nobody new should come out: sold out, after 8 PM, or the evening is over. */
  open: boolean;
  /** SCREAM-155: the truck is on the road with an empty cooler: customers coming or waiting walk home. */
  soldOut?: boolean;
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
  /** SCREAM-342: seconds spent walking after the truck since they set off (or last stood at the curb). */
  chased?: number;
  /** SCREAM-142: true for customers who follow the truck (not the test hook's, who stay at their curb). */
  follows?: boolean;
  /** SCREAM-224: when they leave the park, in minutes since midnight; null = they stay all evening. */
  leaveAt?: number | null;
  /**
   * SCREAM-155 (PO, November 13): sent home because the truck sold out. "If the player goes home,
   * gets ice cream and then returns to that player, they should be willing to buy": they come
   * straight out again when they next hear the truck with stock.
   */
  missedOut?: boolean;
}

const between = (rnd: () => number, [low, high]: readonly [number, number]) => low + rnd() * (high - low);

/**
 * SCREAM-224 (PO, November 15: "Random each evening"): the park's own dice for one evening, made
 * from the Story run's seed and the day, so each evening is rolled fresh and the other dice in
 * the game are left alone.
 */
export function parkDice(seed: number, day: number): () => number {
  let a = (Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(day + 224, 2246822507)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * SCREAM-182 (PO, November 6, his drawing; "Height and peak time", November 15): in Story, the chance
 * in a second that someone who has heard the truck for `heard` seconds wants ice cream. It rises to a
 * peak at `peakAt` seconds, then fades by CUSTOMER_DECIDE_SECONDS (the shape is CUSTOMER_CURVE_POINTS,
 * stretched so its peak comes at `peakAt`); times CUSTOMER_CURVE_SCALE, their likelihood, and halved
 * indoors. Regulars keep their steady chance (decision 034): see `customerChance`.
 */
export function curveChance(heard: number, likelihood: number, indoors: boolean, peakAt: number): number {
  if (heard > CUSTOMER_DECIDE_SECONDS) return 0;
  const pts = CUSTOMER_CURVE_POINTS;
  const drawnPeak = pts.reduce((best, p) => (p[1] > best[1] ? p : best))[0];
  const end = pts[pts.length - 1]![0];
  const at = (t: number) => (t <= drawnPeak ? (t * peakAt) / drawnPeak : peakAt + ((t - drawnPeak) * (end - peakAt)) / (end - drawnPeak));
  let height = pts[pts.length - 1]![1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = at(pts[i]![0]);
    const b = at(pts[i + 1]![0]);
    if (heard >= a && heard <= b) {
      height = pts[i]![1] + ((pts[i + 1]![1] - pts[i]![1]) * (heard - a)) / (b - a || 1);
      break;
    }
  }
  return height * CUSTOMER_CURVE_SCALE * likelihood * (indoors ? CUSTOMER_INDOORS_FACTOR : 1);
}

/** SCREAM-182: when this resident's curve peaks, in seconds heard: the drawing's peak, nudged by their ID (the same every evening). */
export function peakTimeOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  // Mixed well, so IDs that differ only in their last digit still get different peaks.
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  const spread = ((h >>> 0) / 4294967296) * 2 - 1;
  const drawnPeak = CUSTOMER_CURVE_POINTS.reduce((best, p) => (p[1] > best[1] ? p : best))[0];
  return drawnPeak + spread * CUSTOMER_CURVE_PEAK_SPREAD;
}

/** SCREAM-148 / 152 (PO, November 3): sometimes buyers and regulars are outside about 3/4 of the time; never buyers as before. */
function routineFor(resident: Resident, story?: { day: number; seed: number }): {
  startOutside: number;
  outside: readonly [number, number];
  inside: readonly [number, number];
} {
  return kindFor(resident, story) !== 'never'
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
  /** SCREAM-182: Story's curve and each resident's peak, for the browser tests. */
  static readonly curveChance = curveChance;
  static readonly peakTimeOf = peakTimeOf;
  /** SCREAM-148: the buyer kinds, for the browser tests. */
  static readonly kind = buyerKind;
  static readonly buysTonight = buysTonight;
  /** SCREAM-221: the buyer kind in Story (ticks) or Quick play (Likelihood), for the browser tests. */
  static readonly kindFor = kindFor;
  static readonly scheduleFactor = scheduleFactor;
  /** SCREAM-221: Story's day and run seed (undefined in Quick play). */
  private readonly story?: { day: number; seed: number };
  /** SCREAM-221: what kind of buyer this resident is tonight (Story: their ticks; Quick play: Likelihood). */
  kindOf(resident: Resident): BuyerKind {
    return kindFor(resident, this.story);
  }

  /**
   * SCREAM-329: Speaker with Heavier Bass. Multiplies the Likelihood of the some-days people
   * (kind `sometimes`) when they roll to come out. 1 without the note (EveningState sets it).
   */
  sometimesFactor = 1;

  /** What someone's Likelihood counts as tonight: the sheet's, times today's tick (SCREAM-232), times the bass (SCREAM-329). */
  likelihoodNow(resident: Resident): number {
    const bass = this.kindOf(resident) === 'sometimes' ? this.sometimesFactor : 1;
    return Math.min(1, resident.likelihood * scheduleFactor(resident, this.story) * bass);
  }

  /** Test hook: when true, nobody new wants ice cream (keeps driving tests free of sales). */
  hearingOff = false;
  /** SCREAM-249: the evening's clock, in minutes since midnight (EveningState sets it; without it everyone is always home). */
  nowMinutes: (() => number) | null = null;
  /** SCREAM-250: false in the uncle's evening, when the hard-to-find customers stay in (engineering's call). */
  hardToFindOn = true;

  /**
   * SCREAM-342 (PO, November 15): Story's chasing rules (EveningState turns them on; not in Quick
   * play or the uncle's evening). Adults follow the truck for CHASE_ADULT_SECONDS and then go home;
   * fast kids (the sheet's Fast column) are quicker and follow it anywhere; the other kids give up
   * after CHASE_SLOW_KID_SECONDS.
   */
  chaseRules = false;
  /** SCREAM-342: Speedy Neighbors: how much faster everyone but the slower kids goes after the truck (1 without the note). */
  speedyFactor = 1;
  /** SCREAM-342: how many customers have given up following the truck tonight (test hook). */
  chaseGiveUps = 0;

  /** SCREAM-342: how fast this customer goes after the truck and to the curb, px per second. */
  runSpeedOf(resident: Resident): number {
    if (!this.chaseRules) return CUSTOMER_RUN_SPEED;
    const fastKid = resident.kid && !!resident.fast;
    const slowKid = resident.kid && !resident.fast;
    return CUSTOMER_RUN_SPEED * (fastKid ? FAST_KID_SPEED_FACTOR : 1) * (slowKid ? 1 : this.speedyFactor);
  }

  /** SCREAM-342: how many seconds this customer follows the truck before going home (Infinity: never gives up). */
  chaseSecondsOf(resident: Resident): number {
    if (!this.chaseRules) return Infinity;
    if (this.chasesForever(resident)) return Infinity;
    return resident.kid ? CHASE_SLOW_KID_SECONDS : CHASE_ADULT_SECONDS;
  }

  /**
   * SCREAM-168 (PO, November 15): "Let's have 70% of regulars chase": the regulars who follow the
   * truck forever. The game picks them (his choice): tonight's regulars in the order of a number
   * made from each ID, the first CHASE_REGULAR_SHARE of them, so it is the same people every evening.
   */
  private readonly chasers = new Set<string>();
  private pickChasers(list: readonly Resident[]): void {
    const regulars = list.filter((r) => this.kindOf(r) === 'regular');
    const mark = (id: string): number => {
      let h = 2166136261;
      for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
      return h >>> 0;
    };
    regulars.sort((a, b) => mark(a.id) - mark(b.id) || (a.id < b.id ? -1 : 1));
    for (const r of regulars.slice(0, Math.round(regulars.length * CHASE_REGULAR_SHARE))) this.chasers.add(r.id);
  }
  /** SCREAM-168: a regular picked to chase the truck forever (whether or not the chasing rules are on tonight). */
  isChaser(resident: Resident): boolean {
    return this.chasers.has(resident.id);
  }
  /** SCREAM-168: never gives up following the truck (Story's chasing rules): a fast kid or a chasing regular. */
  chasesForever(resident: Resident): boolean {
    return this.chaseRules && ((resident.kid && !!resident.fast) || this.chasers.has(resident.id));
  }
  /** SCREAM-168 (PO): the other regulars "Wait at their own curb": they never follow the truck. */
  staysAtCurb(resident: Resident): boolean {
    return this.chaseRules && this.kindOf(resident) === 'regular' && !this.chasesForever(resident);
  }

  /**
   * SCREAM-249 (PO): in Story, people with hours are only home inside them. Quick play ignores hours.
   * SCREAM-250: a hard-to-find customer is always home; their hours are the window when they answer.
   */
  homeNow(resident: Resident): boolean {
    if (!this.story || !this.nowMinutes || !resident.hours || resident.hardToFind) return true;
    return homeAt(resident, this.nowMinutes());
  }
  /**
   * SCREAM-251 (PO, November 15: a porch light, on "Only while they are physically in", "Always
   * right"): whether this person's porch light is on. On while they are indoors at home; off while
   * they are out in the yard, on their way to the truck or at its window, and off outside their
   * From and Until hours (the game keeps them indoors then, but they are not home).
   */
  porchLit(p: ResidentNow): boolean {
    // SCREAM-224: a park visitor has no house, so no porch light.
    return !p.outside && p.customer !== 'window' && !p.resident.visitor && this.homeNow(p.resident);
  }
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
    this.story = story;
    this.pickChasers(list);
    this.people = list.map((resident) => {
      // SCREAM-224: a park visitor isn't on the map until `openPark` puts tonight's at the park.
      if (resident.visitor) {
        const away: Running = {
          resident,
          x: resident.door[0],
          y: resident.door[1],
          outside: false,
          walking: false,
          facing: 'down',
          customer: 'none',
          waitLeft: 0,
          pickup: [resident.curb[2], resident.curb[3], resident.curb[4]],
          plan: { kind: 'inside', until: Infinity },
          goInsideAt: 0,
          heard: 0,
          waitUntil: 0,
          patience: 0,
          buys: resident.likelihood > 0,
          gone: true,
        };
        return away;
      }
      const times = routineFor(resident, story);
      // SCREAM-249: in Story, someone who only gets home later in the evening starts indoors.
      const outside = rnd() < times.startOutside && !(story && resident.hours && resident.hours[0] !== null);
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

  /** SCREAM-224: true once tonight's people have been put at the park (Story, not the uncle's evening). */
  parkOpen = false;

  /**
   * SCREAM-224 (PO, November 15): "There should be a lot of people there like 13 at 5pm. Then
   * after 5:45 it should start to empty out. so that by 7 there are only 1 or 2 people left."
   * His answers: "A mix" (the residents who get home late, plus new visitors) and "Random each
   * evening". Puts tonight's people at the park: PARK_VISITORS_TONIGHT of the visitors, picked by
   * the evening's dice, each leaving at their own time in PARK_LEAVE_MINUTES except the 1 or 2
   * (PARK_STAY_LATE) who stay; and every resident with Park, who sets off PARK_HOME_WALK_MINUTES
   * before their From so they are home by then. Story only; EveningState calls it.
   */
  openPark(): void {
    if (!this.story || this.parkOpen) return;
    this.parkOpen = true;
    const dice = parkDice(this.story.seed, this.story.day);
    const visitors = this.people.filter((p) => p.resident.visitor && p.resident.park);
    for (let i = visitors.length - 1; i > 0; i--) {
      const j = Math.floor(dice() * (i + 1));
      [visitors[i], visitors[j]] = [visitors[j]!, visitors[i]!];
    }
    const here = visitors.slice(0, PARK_VISITORS_TONIGHT);
    const stay = PARK_STAY_LATE[0] + Math.floor(dice() * (PARK_STAY_LATE[1] - PARK_STAY_LATE[0] + 1));
    here.forEach((p, i) => {
      p.gone = false;
      this.putAtPark(p, i < stay ? null : between(dice, PARK_LEAVE_MINUTES), dice);
    });
    for (const p of this.people) {
      const r = p.resident;
      const from = r.hours?.[0];
      if (r.visitor || !r.park || from == null || r.hardToFind) continue;
      this.putAtPark(p, from - PARK_HOME_WALK_MINUTES, dice);
    }
  }

  /** SCREAM-224: stands someone on one of their spots at the park, to leave at `leaveAt`. */
  private putAtPark(p: Running, leaveAt: number | null, dice: () => number): void {
    p.atPark = true;
    p.leaving = false;
    p.leaveAt = leaveAt;
    p.outside = true;
    p.walking = false;
    p.facing = 'down';
    const [x, y] = this.parkSpot(p, dice);
    p.x = x;
    p.y = y;
    p.plan = { kind: 'idle', until: this.now + between(dice, RESIDENT_IDLE_SECONDS) * dice() };
  }

  /** SCREAM-224: one of their spots at the park that nobody else is standing on or heading for (if there is one). */
  private parkSpot(p: Running, dice: () => number = this.rnd): [number, number] {
    const s = p.resident.park?.spots ?? [];
    const all: [number, number][] = [];
    for (let i = 0; i + 1 < s.length; i += 2) all.push([s[i]!, s[i + 1]!]);
    if (all.length === 0) return [p.x, p.y];
    const taken = (x: number, y: number): boolean =>
      this.people.some((o) => {
        if (o === p || !o.atPark || !o.outside) return false;
        const to = o.plan.kind === 'walk' ? o.plan.route[o.plan.route.length - 1] : undefined;
        return Math.hypot(o.x - x, o.y - y) < PARK_SPOT_GAP || (!!to && Math.hypot(to[0] - x, to[1] - y) < PARK_SPOT_GAP);
      });
    const elsewhere = all.filter(([x, y]) => Math.hypot(p.x - x, p.y - y) > 1);
    const free = elsewhere.filter(([x, y]) => !taken(x, y));
    const pool = free.length ? free : elsewhere.length ? elsewhere : all;
    return pool[Math.floor(dice() * pool.length)]!;
  }

  /** SCREAM-224: whether it is time for this person to leave the park. */
  private parkTimeUp(p: Running): boolean {
    return p.leaveAt != null && !!this.nowMinutes && this.nowMinutes() >= p.leaveAt;
  }

  /**
   * SCREAM-224: back to the park (after a sale, or giving up on the truck, or just to another
   * spot), or out of it if their time is up: off the bottom of the map, or, for a resident who
   * has ended up nearer their house than the way out, straight home.
   */
  private parkNext(p: Running): void {
    const park = p.resident.park;
    if (!park) return;
    if (!this.parkTimeUp(p)) {
      this.walkTo(p, [this.parkSpot(p)], RESIDENT_WALK_SPEED, 'idle');
      return;
    }
    p.leaving = true;
    const [dx, dy] = p.resident.door;
    const home = !p.resident.visitor && Math.hypot(dx - p.x, dy - p.y) < Math.hypot(park.exit[0] - p.x, park.exit[1] - p.y);
    this.walkTo(p, [home ? p.resident.door : park.exit], PARK_LEAVE_SPEED, 'inside');
  }

  /** SCREAM-224: where this person's own curb spot is right now: the park's while they are there. */
  private curbOf(p: Running): [number, number, number, number, number] {
    return p.atPark && p.resident.park ? p.resident.park.curb : p.resident.curb;
  }

  /** SCREAM-224: the people standing about at the park right now (not the ones on their way out, or off after the truck). */
  get atParkNow(): readonly ResidentNow[] {
    return this.people.filter((p) => p.atPark && !p.leaving && p.outside && (p.customer === 'none' || p.customer === 'done'));
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
    if (ring?.soldOut) this.sendHomeSoldOut();
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
    // SCREAM-224: someone at the park waits at the park's curb spot; a visitor who wasn't here tonight is now.
    p.gone = false;
    const own = this.curbOf(p);
    p.customer = 'waiting';
    p.outside = true;
    p.walking = false;
    p.x = own[0];
    p.y = own[1];
    p.waitUntil = this.now + CUSTOMER_WAIT_SECONDS;
    p.waitLeft = CUSTOMER_WAIT_SECONDS;
    p.facing = facingFor(own[2] - own[0], own[3] - own[1]);
    p.pickup = [own[2], own[3], own[4]];
    p.patience = CUSTOMER_WAIT_SECONDS;
    p.waitAt = undefined;
    p.spotStand = [own[0], own[1]];
    p.follows = false;
    p.plan = { kind: 'idle', until: Infinity };
  }

  /**
   * SCREAM-155 (PO, November 13): the truck has sold out. "Those players should start walking home":
   * everyone on their way to the truck or waiting at a pink square gives up their square and walks
   * home. They aren't done for the night: see `missedOut`. Returns how many were sent.
   */
  sendHomeSoldOut(): number {
    let sent = 0;
    for (const p of this.people) {
      if (p.customer !== 'running' && p.customer !== 'waiting') continue;
      p.customer = 'none';
      p.missedOut = true;
      p.heard = 0;
      p.waitLeft = 0;
      p.waitAt = undefined;
      p.spotStand = undefined;
      p.follows = false;
      this.walkHome(p);
      sent += 1;
    }
    return sent;
  }

  private rollChances(ring?: Ring): void {
    for (const p of this.people) {
      if (p.customer !== 'none' || p.gone) continue; // SCREAM-224: a visitor who isn't here hears nothing
      const indoors = !p.outside;
      const [x, y] = indoors ? p.resident.door : [p.x, p.y];
      const inRing = !!ring && Math.hypot(x - ring.x, y - ring.y) <= ring.radius;
      // Seconds heard are counted in a row, so someone who hears the truck again later gets a fresh first-second chance.
      p.heard = inRing ? p.heard + 1 : 0;
      // SCREAM-249: not home at this hour: they don't hear it, and get a fresh chance once they are.
      // SCREAM-224: someone at the park isn't home, but they are out there and hear it.
      if (!p.atPark && !this.homeNow(p.resident)) {
        p.heard = 0;
        continue;
      }
      // SCREAM-250 (PO, November 10): a hard-to-find customer comes out for certain ("100% in the
      // window") when the music reaches them inside their window on a ticked day. At any other
      // time they're "nearly impossible": the usual roll with their tiny Likelihood from the sheet.
      // SCREAM-155: someone the truck sold out on comes out again as soon as they hear it with stock.
      if (p.missedOut) {
        if (inRing && ring?.open && !this.hearingOff) this.wantIceCream(p);
        continue;
      }
      if (this.story && p.resident.hardToFind) {
        if (!this.hardToFindOn) continue; // the uncle's evening
        const today = p.resident.days?.includes(weekdayOf(this.story.day)) ?? false;
        const inWindow = today && !!this.nowMinutes && homeAt(p.resident, this.nowMinutes());
        if (inWindow && inRing && ring?.open && !this.hearingOff) {
          this.wantIceCream(p);
          continue;
        }
        // Outside the window: one roll per evening at their Likelihood, not one a second.
        if (inRing && ring?.open && !this.hearingOff && !p.decided) {
          if (this.rnd() < p.resident.likelihood * scheduleFactor(p.resident, this.story)) this.wantIceCream(p);
          else p.decided = true;
        }
        continue;
      }
      if (!inRing || !ring?.open || this.hearingOff || !p.buys || p.decided) continue;
      const regular = this.kindOf(p.resident) === 'regular';
      const likelihood = this.likelihoodNow(p.resident);
      // SCREAM-182: in Story the chance rises to a peak, then fades (regulars stay steady).
      const chance = this.story && !regular ? curveChance(p.heard, likelihood, indoors, peakTimeOf(p.resident.id)) : customerChance(p.heard, likelihood, indoors, regular);
      if (this.rnd() < chance) this.wantIceCream(p);
      else if (p.heard >= CUSTOMER_DECIDE_SECONDS) p.decided = true;
    }
  }

  /**
   * They want ice cream: out of the house if need be, then (SCREAM-142) straight toward the
   * truck. Without the streets, a run to their own curb spot as before.
   */
  /**
   * SCREAM-171: the tutorial's regular comes out for the uncle's truck: from wherever she is
   * (her door if she's inside) to her own curb spot, where she waits for it. She doesn't follow
   * the truck, and nothing is left to chance (PO: 100% likely).
   */
  comeOutToOwnCurb(person: ResidentNow): void {
    const p = person as Running;
    if (p.customer !== 'none') return;
    p.customer = 'running';
    p.patience = CUSTOMER_WAIT_SECONDS;
    p.waitAt = undefined;
    const fromDoor = !p.outside;
    if (fromDoor) {
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
    }
    p.follows = false;
    const stand: [number, number] = [p.resident.curb[0], p.resident.curb[1]];
    this.walkTo(p, fromDoor ? [stand] : [p.resident.door, stand], CUSTOMER_RUN_SPEED, 'curb');
  }

  private wantIceCream(p: Running): void {
    p.customer = 'running';
    p.missedOut = false;
    p.chased = 0;
    p.patience = CUSTOMER_WAIT_SECONDS;
    p.waitAt = undefined;
    const fromDoor = !p.outside;
    if (fromDoor) {
      p.outside = true;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
    }
    // SCREAM-168: a regular who doesn't chase waits at their own curb and never follows the truck.
    p.follows = !!this.curbs && !this.staysAtCurb(p.resident);
    if (p.follows) {
      p.walking = true;
      p.plan = { kind: 'follow' };
      return;
    }
    const own = this.curbOf(p);
    const stand: [number, number] = [own[0], own[1]];
    // Yard spots are chosen so the walk to the door never crosses the house; the run to the curb starts there.
    // SCREAM-224: from the park, straight to the park's curb spot.
    this.walkTo(p, fromDoor || p.atPark ? [stand] : [p.resident.door, stand], this.runSpeedOf(p.resident), 'curb');
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
    // SCREAM-224: someone from the park goes back to it (or leaves it, if their time is up).
    if (p.atPark) return this.parkNext(p);
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
        this.walkTo(p, [join.stand], this.runSpeedOf(p.resident), 'curb');
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
        this.walkTo(p, [spot.stand], this.runSpeedOf(p.resident), 'curb');
        return;
      }
      // SCREAM-150: no room for a pink square anywhere near the truck. Rather than stand in
      // the street with no square, they go back to their own curb spot (it always has room)
      // and wait there, without following the truck again.
      const own = this.curbOf(p);
      p.waitAt = [own[2], own[3], own[4]];
      p.spotStand = [own[0], own[1]];
      p.follows = false;
      this.walkTo(p, [[own[0], own[1]]], this.runSpeedOf(p.resident), 'curb');
      return;
    }
    // Toward the truck, but not into it; SCREAM-161: round any building in the way.
    // SCREAM-342: only so long after the truck, then home (adults and the slower kids, in Story).
    p.chased = (p.chased ?? 0) + dt;
    if (p.chased >= this.chaseSecondsOf(p.resident)) {
      p.customer = 'done';
      this.chaseGiveUps++;
      this.walkHome(p);
      return;
    }
    const step = Math.min(this.runSpeedOf(p.resident) * dt, Math.max(0, dist - CUSTOMER_STOP_GAP / 2));
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
    if (p.customer === 'window' || p.gone) return; // SCREAM-224: a visitor who isn't here does nothing
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
        p.chased = 0; // SCREAM-342: they stood at the curb: the count starts again
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
      if (!this.homeNow(p.resident)) return; // SCREAM-249: not home yet (or any more): nobody comes out
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
      // SCREAM-224: at the park: on to another spot, or out of the park when their time is up.
      if (p.atPark) return this.parkNext(p);
      if (this.now >= p.goInsideAt || !this.homeNow(p.resident)) this.walkTo(p, [p.resident.door], RESIDENT_WALK_SPEED, 'inside'); // SCREAM-249: in at their Until
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
    if (then === 'inside' && (p.atPark || p.resident.visitor)) {
      // SCREAM-224: out of the park. A visitor is gone for the evening; a resident is on their
      // way home, and comes out of their own door once their From time has come.
      p.atPark = false;
      p.leaving = false;
      p.outside = false;
      p.x = p.resident.door[0];
      p.y = p.resident.door[1];
      if (p.resident.visitor) {
        p.gone = true;
        p.plan = { kind: 'inside', until: Infinity };
      } else {
        p.plan = { kind: 'inside', until: this.now + between(this.rnd, routineFor(p.resident).inside) };
      }
    } else if (then === 'inside') {
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
        const own = this.curbOf(p);
        p.pickup = [own[2], own[3], own[4]];
        p.facing = facingFor(own[2] - own[0], own[3] - own[1]);
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
