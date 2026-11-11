import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import type { CoolerOrder } from './CoolerOrder';
import { generateOrder, orderTotalCents, Sale } from './Sale';
import { MAPS, currentMap, setCurrentMap, type MapId } from '../config/maps';
import { arrivalSpot } from './RingLaps';
import { ROTARY_HINT_LINE } from '../config/tuning';
import type { WorcesterMap } from '../config/mapTypes';
import { Residents, type ResidentNow, type Wall } from './Residents';
import { CurbFinder } from './CurbFinder';
import { assignHints } from './Hints';
import { HINT_LINES } from '../config/hintLines';
import { assignNeighbourLines, assignScheduleLines, neighbourLineToday, scheduleLineToday, type ScheduleLine } from './ScheduleLines';
import { SCHEDULE_LINES } from '../config/scheduleLines';
import { NEIGHBOUR_LINES } from '../config/neighbourLines';
import { TutorialEvents, TutorialRun } from './Tutorial';
import { count } from './Counter';
import { RoadNetwork } from './RoadGeometry';
import {
  COOLER_CAPACITY,
  ORDER_PICTURE_CHANCE,
  HINT_CHANCE,
  HINT_FIRST_AFTER_SALES,
  HINT_GAP_SALES,
  HINT_MAX_PER_EVENING,
  SCHEDULE_LINE_CHANCE,
  HARD_TO_FIND_TIP_FACTOR,
  SCHEDULE_LINE_CHANCE_SOME_DAYS,
  NEIGHBOUR_LINE_SHARE_EVERY_DAY,
  NEIGHBOUR_LINE_SHARE_SOME_DAYS,
  SCHEDULE_LINES_MAX_PER_EVENING,
  STORY_DAYS,
  CRATE_SIDE,
  EVENING_END_HOUR,
  EVENING_LENGTH_SECONDS,
  EVENING_START_HOUR,
  FUEL_FULL_TANK_CENTS,
  FUEL_CENT_STEP,
  UNCLE_GAS_CENTS,
  UNCLE_LEFT_CENTS,
  FUEL_QUICK_PLAY_START,
  FUEL_TUTORIAL_START,
  FUEL_STEP_CENTS,
  FUEL_TANK_PX,
  STARTING_CASH_CENTS,
} from '../config/tuning';

/** Events the evening sends out. Scenes listen for these instead of checking every frame. */
export const EveningEvents = {
  /** (changeCents: number, cashCents: number, label: string, popup: boolean) */
  MoneyChanged: 'money-changed',
  /** () — the clock reached 8pm */
  Ended: 'ended',
  /** (waiting: boolean) — a customer arrived at, or left, the window */
  CustomerChanged: 'customer-changed',
  /** () — a cooler slot's flavour, quantity or price changed */
  CoolerChanged: 'cooler-changed',
  /** () — the sale at the window changed phase or ended (#13-#15) */
  SaleChanged: 'sale-changed',
  /** (mapId: MapId) — SCREAM-145: the truck went through a roundabout to the other map */
  MapChanged: 'map-changed',
} as const;

/** The four arrow keys (and W A S D): up is gas, down is brake and reverse, left and right steer (#32). */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Where the truck is parked in the neighbourhood, in pixels, and the way it points in degrees (0 = right, 90 = down). */
export type TruckPosition = { x: number; y: number; angle: number };

/** One of the cooler's flavour slots (issue #8). */
export type CoolerSlot = {
  flavour: FlavourId;
  quantity: number;
  priceCents: number;
};

/**
 * Everything about the current evening: the clock, the cash and the cooler.
 * A brand-new EveningState is created for every evening, so starting
 * again always resets everything (issue #4).
 *
 * Money is stored in whole cents to avoid rounding errors.
 */
/**
 * SCREAM-140: can a customer's pink square go at (x, y), beside street `road`? On that
 * street's asphalt (not in a junction), and clear of parked cars, the pump bays and home's driveway.
 */
/** Each map's road network, made once (SCREAM-146: there are two maps). */
const ROAD_NETWORKS = new Map<MapId, RoadNetwork>();
function roadsOf(id: MapId, map: WorcesterMap): RoadNetwork {
  let roads = ROAD_NETWORKS.get(id);
  if (!roads) ROAD_NETWORKS.set(id, (roads = new RoadNetwork(map.roads, map.roadMask)));
  return roads;
}
function pinkSquareFitsOn(map: WorcesterMap, roads: RoadNetwork) {
  return (x: number, y: number, road: number): boolean => {
    if (!roads.onRoad(x, y) || roads.nearestSegment(x, y)?.road !== road) return false;
    const near = (a: { x: number; y: number }, d: number) => Math.hypot(a.x - x, a.y - y) < d;
    if (map.parkedCars.some((c) => near(c, PINK_CLEAR_CAR))) return false;
    if (map.gasStations.some((g) => near(g.bay, PINK_CLEAR_BAY)) || near(map.homeStart, PINK_CLEAR_BAY)) return false;
    return true;
  };
}
/**
 * SCREAM-161: the buildings customers walk round: houses, shops, fences, the court and playground;
 * SCREAM-163: and big yard pieces (a pergola, a shed, a trampoline), anything 32 x 32 px or more.
 */
function wallsOf(map: WorcesterMap): Wall[] {
  const sizes = new Map(map.sprites.map((sp) => [sp.key, sp] as const));
  const out: Wall[] = [];
  for (const o of map.objects) {
    const sp = sizes.get(o.key);
    if (!sp) continue;
    const building = /^(house|villa|shop_|fence_|court_|play_)/.test(o.key);
    const bigPiece = o.key.startsWith('orn_') && sp.w >= BIG_PIECE && sp.h >= BIG_PIECE;
    if (building || bigPiece) out.push({ x0: o.x - sp.w / 2, y0: o.y - sp.h, x1: o.x + sp.w / 2, y1: o.y });
  }
  return out;
}
/** SCREAM-163: yard pieces at least this wide and tall (px) are walked round, like buildings. */
const BIG_PIECE = 32;
/** How far a pink square's centre keeps from a parked car's, and from a bay's (px). */
const PINK_CLEAR_CAR = 80;
const PINK_CLEAR_BAY = 100;

export class EveningState extends Phaser.Events.EventEmitter {
  private elapsedMs = 0;
  /** #66: the evening opens at the cooler with the clock stopped at 5:00 PM; it starts when you leave the cooler. */
  private clockRunning = false;
  private ended = false;
  /** SCREAM-119: the evening ended because the tank ran empty. */
  private ranOutOfGas = false;
  private readonly startCashCents: number;
  /** SCREAM-191: the uncle's $50 is still to come (guided tutorial, before his line at the cooler). */
  private uncleGiftPending = false;
  private cashCents: number;
  private customerAtWindow = false;
  private prepLocked = false;
  /** SCREAM-54: true while the player is at the cooler after pulling into Home's driveway. */
  private restockingNow = false;
  private readonly lengthMs = EVENING_LENGTH_SECONDS * 1000;
  /** SCREAM-67: the resident being served at the window, or null. */
  private servingNow: ResidentNow | null = null;
  /** Keeps running after 8 PM, so a sale in progress can finish (#15). */
  private nowMsValue = 0;
  private endPending = false;
  private saleNow: Sale | null = null;
  private damageTotalCents = 0;
  private salesTotalCents = 0;
  private tipsTotalCents = 0;
  /** SCREAM-93: the most paid for one order tonight, price plus tip. */
  private largestSaleTotalCents = 0;
  private stockSpentCents = 0;
  /** SCREAM-22: gas in the tank, from 0 (empty) to 1 (full). */
  private fuelLeft: number;
  private gasSpentCents = 0;
  private lastSalePhase: string | null = null;

  /** The truck starts each evening on the road outside home (#9); set in the constructor. */
  private truckPosition: TruckPosition;

  /** SCREAM-146: which map the truck is on now: Foley Stadium (worcester) or Elm Park (tutorial). SCREAM-145: it can change mid-evening. */
  mapId: MapId;
  /** SCREAM-145: the map the evening started on, where home is. In Story that's Elm Park every day (PO). */
  readonly homeMapId: MapId;
  /**
   * SCREAM-145: whether the roundabouts lead to the other map tonight. Story only (engineering's
   * call: Quick play stays one evening in Foley Stadium, as the PO asked); and not while the uncle
   * is still guiding (his evening has its own route).
   */
  readonly mapsJoined: boolean;
  /** SCREAM-145: how many times the truck has gone through a roundabout tonight (for the HUD and tests). */
  mapSwitches = 0;
  /** SCREAM-169: the uncle's steps, on the tutorial map when he's guiding; null otherwise. */
  readonly tutorial: TutorialRun | null;

  /** SCREAM-137: the chance a customer shows pictures instead of names (tests set 0 or 1). */
  orderPictureChance = ORDER_PICTURE_CHANCE;
  /** SCREAM-103: the chance a tipped sale ends with a hint (tests set 0 or 1). */
  hintChance = HINT_CHANCE;
  /** SCREAM-103: paid sales tonight, and who customers have pointed the player to (resident IDs). */
  paidSales = 0;
  readonly hintsGiven: string[] = [];
  private lastHintAtSale = -Infinity;
  /** SCREAM-103: each hinted regular's one line for this run (resident id → line), from the run's seed. */
  readonly hintFor: Map<string, string>;
  /** Debug (Shift+6): the next tipped sale gives a hint, whatever the count and the chance (still at most 2 a night). */
  forceHint = false;
  /** SCREAM-247: the chance a paid sale ends with the customer's own schedule line (tests set 0 or 1); null = the tuning values (people with some days ticked say theirs more often). */
  scheduleLineChance: number | null = null;
  /** SCREAM-247: the lines (ids) heard tonight: no wording twice in an evening. */
  readonly scheduleLinesHeard: string[] = [];
  /** SCREAM-247: each resident's own few schedule lines for this run (resident id → lines), from the run's seed. Empty outside Story. */
  readonly scheduleLinesFor: Map<string, ScheduleLine[]>;
  /** SCREAM-247: how many customers have mentioned their schedule tonight. */
  scheduleLinesSaid = 0;
  /** Debug (Shift+7): the next paid sale ends with the customer's schedule line, if they have one that fits today. */
  forceScheduleLine = false;
  /** SCREAM-248: what the street says about each resident this run (id of the resident talked about → lines). Empty outside Story. */
  readonly neighbourLinesFor: Map<string, ScheduleLine[]>;
  /** SCREAM-248: who customers have told the player about tonight (resident ids), most recent last. */
  readonly neighboursToldAbout: string[] = [];
  /** SCREAM-248: how often a schedule line is about a neighbour (tests set 0 or 1); null = the tuning values. */
  neighbourLineShare: number | null = null;
  /** Debug (Shift+8): the next paid sale ends with a line about a neighbour, if the customer has one to talk about today. */
  forceNeighbourLine = false;

  /** The neighbourhood's people (SCREAM-59, SCREAM-73), going in and out of their houses all evening. SCREAM-145: the current map's. */
  get residents(): Residents {
    return this.residentsOn(this.mapId);
  }
  /** SCREAM-145: each map's people, made the first time the truck gets there; they keep their state while the truck is away. */
  private readonly residentsByMap = new Map<MapId, Residents>();
  private readonly story: { day: number; seed: number } | undefined;

  /** SCREAM-129: one stock line per flavour, all empty at first, each at its suggested price. */
  /**
   * SCREAM-131 (PO, November 2): which ice cream sits in each of the cooler's squares,
   * crate by crate and row by row, so the player has to remember where things are. Kept in
   * step with the stock counts (`coolerSlots`) by syncCells().
   */
  private readonly coolerCells: (FlavourId | null)[] = Array.from({ length: COOLER_CAPACITY }, () => null);
  /** During a sale: each ice cream in the bag and the square it came from, so it can go back there. */
  private bagCells: { cell: number; slot: number }[] = [];

  private readonly coolerSlots: CoolerSlot[] = FLAVOURS.map((f) => ({
    flavour: f.id,
    quantity: 0,
    priceCents: defaultPriceCents(f.id),
  }));

  /**
   * Quick play starts every evening fresh. Story mode (SCREAM-19) passes in the
   * cash and the cooler left over from the evening before.
   */
  constructor(carry?: {
    cashCents: number;
    slots: readonly Readonly<CoolerSlot>[];
    fuel: number;
    /** SCREAM-131: where each ice cream sat (saves from before it have none, and get a fresh layout). */
    cells?: readonly (FlavourId | null)[];
    /** SCREAM-148: Story's day and run seed, which pick the day each sometimes buyer buys. */
    story?: { day: number; seed: number };
    /** SCREAM-145: paid sales per resident over the run so far, and whether the roundabout's secret is out. */
    visits?: Readonly<Record<string, number>>;
    rotaryHintGiven?: boolean;
  }, mapId: MapId = 'worcester', guided = false) {
    super();
    this.tutorial = guided && mapId === 'tutorial' ? new TutorialRun() : null;
    // SCREAM-187 (PO, November 6): "I left $50 on the truck for you to get started." (once)
    const run = this.tutorial;
    if (run) {
      const gift = () => {
        // SCREAM-200: skipped before his line about the $50: he leaves it anyway.
        if (!(run.givesCash || run.skipped) || !this.uncleGiftPending) return;
        run.off(TutorialEvents.Changed, gift);
        this.uncleGiftPending = false;
        this.changeMoney(UNCLE_LEFT_CENTS, 'From the uncle');
      };
      run.on(TutorialEvents.Changed, gift);
    }
    // SCREAM-146: everything tonight (scenes included) uses this evening's map.
    this.mapId = mapId;
    this.homeMapId = mapId;
    this.story = carry?.story;
    this.visits = { ...(carry?.visits ?? {}) };
    this.rotaryHintGiven = carry?.rotaryHintGiven ?? false;
    this.mapsJoined = !!carry?.story && !this.tutorial;
    setCurrentMap(mapId);
    const map = currentMap();
    this.truckPosition = { x: map.data.homeStart.x, y: map.data.homeStart.y, angle: map.data.homeStart.angle };
    this.residentsOn(mapId);
    // PO, November 8: the same reason for a regular all through a Story run, and Story only (Quick Play
    // is one evening: not enough time for the neighbourhood's story). SCREAM-145: the lines come from the
    // home map's (Elm Park's) residents.
    this.hintFor = carry?.story ? assignHints(map.residents, HINT_LINES, carry.story.seed) : new Map();
    // SCREAM-247 (PO, decision 063: traits are Story only and fixed for a run): both maps' people.
    this.scheduleLinesFor = carry?.story
      ? assignScheduleLines(Object.values(MAPS).flatMap((m) => m.residents), SCHEDULE_LINES, carry.story.seed)
      : new Map();
    // SCREAM-248: and what their neighbours say about them.
    this.neighbourLinesFor = carry?.story
      ? assignNeighbourLines(Object.values(MAPS).flatMap((m) => m.residents), NEIGHBOUR_LINES, carry.story.seed)
      : new Map();
    this.startCashCents = carry?.cashCents ?? STARTING_CASH_CENTS;
    // SCREAM-191 (PO, November 6): with the uncle, the cash starts empty; his $50 comes with his
    // line at the cooler. It still counts as the starting $50, so the night's profit is the same.
    // SCREAM-205: Story's Day 1 with the uncle too (its start cash is his $50).
    this.uncleGiftPending = !!this.tutorial && this.startCashCents >= UNCLE_LEFT_CENTS;
    this.cashCents = this.uncleGiftPending ? this.startCashCents - UNCLE_LEFT_CENTS : this.startCashCents;
    this.fuelLeft = Phaser.Math.Clamp(carry?.fuel ?? (this.tutorial ? FUEL_TUTORIAL_START : FUEL_QUICK_PLAY_START), 0, 1);
    // Matched by flavour, so a save from before SCREAM-129 (3 slots, any flavours) carries over too.
    carry?.slots.forEach((slot) => {
      const target = this.coolerSlots.find((s) => s.flavour === slot.flavour);
      if (!target) return;
      target.quantity += slot.quantity;
      target.priceCents = slot.priceCents;
    });
    carry?.cells?.forEach((f, i) => {
      if (i < COOLER_CAPACITY) this.coolerCells[i] = f;
    });
    this.syncCells();
  }

  /** SCREAM-145: the people of a map (made on first use). */
  private residentsOn(id: MapId): Residents {
    let people = this.residentsByMap.get(id);
    if (!people) {
      const map = MAPS[id];
      const roads = roadsOf(id, map.data);
      people = new Residents(map.residents, Math.random, new CurbFinder(roads, pinkSquareFitsOn(map.data, roads)), this.story);
      people.nowMinutes = () => this.clockMinutes; // SCREAM-249: hours of the evening
      people.hardToFindOn = !this.tutorial; // SCREAM-250: not in the uncle's evening
      people.walls = wallsOf(map.data);
      this.residentsByMap.set(id, people);
    }
    return people;
  }

  /**
   * SCREAM-145: paid sales per resident, carried over the Story run (the uncle's guided sale
   * on Day 1 doesn't count; PO). `rotaryHintGiven` once a regular has told the player the trick.
   */
  readonly visits: Record<string, number>;
  rotaryHintGiven: boolean;
  /** SCREAM-145: the regulars who have been served a second time, in order (the second one tells). */
  readonly secondVisits: string[] = [];

  /**
   * SCREAM-145 (PO, November 9): counts a paid sale, and on a regular's second visit, if they're the
   * second regular to get there this run, they pass on the way to the other neighbourhood.
   */
  private countVisit(sale: Sale): void {
    const person = this.servingNow;
    if (!person || !this.story) return;
    if (this.tutorial?.step === 'sale') return; // the uncle's sale (PO)
    const id = person.resident.id;
    this.visits[id] = (this.visits[id] ?? 0) + 1;
    if (this.visits[id] !== 2 || this.residents.kindOf(person.resident) !== 'regular') return;
    this.secondVisits.push(id);
    if (this.rotaryHintGiven || this.secondVisits.length !== 2) return;
    this.rotaryHintGiven = true;
    sale.addRotaryHint(ROTARY_HINT_LINE);
  }

  /** SCREAM-145: true while the truck is away from the map home is on. */
  get awayFromHome(): boolean {
    return this.mapId !== this.homeMapId;
  }

  /**
   * SCREAM-145: the truck has done its laps of the roundabout: it goes to the other map, appearing
   * on that map's roundabout (`arrivalSpot`). The clock, the cash, the cooler and the gas carry on
   * as they are. Returns the map it went to, or null if the roundabouts don't lead anywhere tonight.
   */
  switchMap(): MapId | null {
    if (!this.mapsJoined || this.isOver) return null;
    const to: MapId = this.mapId === 'tutorial' ? 'worcester' : 'tutorial';
    const spot = arrivalSpot(MAPS[to].data.roads);
    if (!spot) return null;
    this.mapId = to;
    setCurrentMap(to);
    this.residentsOn(to);
    this.truckPosition = spot;
    this.mapSwitches += 1;
    this.emit(EveningEvents.MapChanged, to);
    return to;
  }

  /** A copy of the cooler as it is now, to carry into the next evening (SCREAM-19). */
  get slotsSnapshot(): CoolerSlot[] {
    return this.coolerSlots.map((s) => ({ ...s }));
  }

  /** SCREAM-131: a copy of where each ice cream sits, to carry into the next evening. */
  get cellsSnapshot(): (FlavourId | null)[] {
    return [...this.cells];
  }

  /** SCREAM-131: the cooler's squares, crate by crate and row by row (null = empty). */
  get cells(): readonly (FlavourId | null)[] {
    this.syncCells();
    return this.coolerCells;
  }

  /** Which crate a square is in (0, 1 or 2). */
  static crateOf(cell: number): number {
    return Math.floor(cell / (CRATE_SIDE * CRATE_SIDE));
  }

  /**
   * Keeps the squares in step with the stock counts: if a flavour has fewer squares than ice
   * creams, the extras go in the first empty squares; if it has more, the last ones go. Most
   * changes move squares and counts together, so this rarely does anything.
   */
  private syncCells(): void {
    for (const slot of this.coolerSlots) {
      let count = this.coolerCells.filter((f) => f === slot.flavour).length;
      while (count > slot.quantity) {
        this.coolerCells[this.coolerCells.lastIndexOf(slot.flavour)] = null;
        count--;
      }
      while (count < slot.quantity) {
        const empty = this.coolerCells.indexOf(null);
        if (empty < 0) break;
        this.coolerCells[empty] = slot.flavour;
        count++;
      }
    }
  }

  // ---- Clock (#5) ----

  /** How far through the evening we are, from 0 (5pm) to 1 (8pm). */
  get progress(): number {
    return Math.min(this.elapsedMs / this.lengthMs, 1);
  }

  /** Current in-game time as minutes since midnight (5pm = 1020). */
  get clockMinutes(): number {
    const startMinutes = EVENING_START_HOUR * 60;
    const spanMinutes = (EVENING_END_HOUR - EVENING_START_HOUR) * 60;
    return startMinutes + this.progress * spanMinutes;
  }

  get isOver(): boolean {
    return this.ended;
  }

  /** Has the clock started? (It waits while you stock the cooler at the start, #66.) */
  get isClockRunning(): boolean {
    return this.clockRunning;
  }

  /** Starts the evening's clock: leaving the cooler for the first time (#66). Safe to call again. */
  startClock(): void {
    this.clockRunning = true;
  }

  /** Advances the clock. Called every frame by the HUD, whatever phase the player is in. */
  tick(deltaMs: number): void {
    if (this.ended || !this.clockRunning) return;
    this.nowMsValue += deltaMs;
    // SCREAM-172: at the window in the guided tutorial, the sale's clocks wait for the uncle's line.
    if (this.tutorial?.holdsSale && this.saleNow) this.saleNow.wait(deltaMs);
    this.updateSale();
    if (this.endPending) return;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.lengthMs) {
      this.elapsedMs = this.lengthMs;
      this.finishEvening();
    }
  }

  /** Ends the evening now (debug shortcut). A sale in progress still finishes first. */
  endNow(): void {
    if (this.ended) return;
    this.elapsedMs = this.lengthMs;
    this.finishEvening();
  }

  /** 8 PM: the evening ends, unless a sale is under way, which finishes first (PO, doc 08 Q31). */
  private finishEvening(): void {
    if (this.saleNow) {
      this.endPending = true;
      return;
    }
    this.ended = true;
    this.emit(EveningEvents.Ended);
  }

  /** Past 8 PM: no new customers. */
  get isAfterHours(): boolean {
    return this.elapsedMs >= this.lengthMs;
  }

  /** The evening's running clock in milliseconds; keeps going while a sale finishes after 8 PM. */
  get nowMs(): number {
    return this.nowMsValue;
  }

  // ---- Wallet (#21) ----

  /** Cash on hand right now. */
  get moneyCents(): number {
    return this.cashCents;
  }

  /**
   * SCREAM-191: with the uncle, the cash starts empty and his $50 comes a few lines into the
   * cooler; picks made before then count it already (so the tutorial isn't stuck at $0).
   */
  get uncleGiftComing(): boolean {
    return this.uncleGiftPending;
  }

  get stockBudgetCents(): number {
    return this.cashCents + (this.uncleGiftPending ? UNCLE_LEFT_CENTS : 0);
  }

  /** Tonight's profit so far: cash now minus cash at the start. This is the high score. */
  get profitCents(): number {
    return this.cashCents - this.startCashCents;
  }

  /**
   * Adds (or, with a negative amount, removes) cash. Sales and damage may take
   * the total below zero; buying stock never does (see CoolerOrder).
   * `popup` controls whether the HUD shows a "+$x Label" popup.
   */
  changeMoney(cents: number, label: string, popup = true): void {
    if (this.ended) return;
    this.cashCents += cents;
    this.emit(EveningEvents.MoneyChanged, cents, this.cashCents, label, popup);
  }

  // ---- Damage (#10) ----

  /** Charges for a hit on the road (pothole, parked car, road edge). Cash may go below zero. */
  takeDamage(cents: number, label: string): void {
    if (this.ended) return;
    this.damageTotalCents += cents;
    this.changeMoney(-cents, label);
  }

  /** Total paid in damage tonight. */
  get damageCents(): number {
    return this.damageTotalCents;
  }

  /** SCREAM-93: the most paid for one order tonight (price plus tip), in cents. */
  get largestSaleCents(): number {
    return this.largestSaleTotalCents;
  }

  /** Tonight's breakdown for the results screen (#16). */
  get breakdown(): { salesCents: number; tipsCents: number; stockCents: number; gasCents: number; damageCents: number } {
    return {
      salesCents: this.salesTotalCents,
      tipsCents: this.tipsTotalCents,
      stockCents: this.stockSpentCents,
      gasCents: this.gasSpentCents,
      damageCents: this.damageTotalCents,
    };
  }

  // ---- Fuel (SCREAM-22) ----

  /** Gas in the tank, from 0 (empty) to 1 (full). */
  get fuel(): number {
    return this.fuelLeft;
  }

  get isOutOfFuel(): boolean {
    return this.fuelLeft <= 0;
  }

  /** SCREAM-119: true if the evening ended because the tank ran empty. */
  get endedOutOfGas(): boolean {
    return this.ranOutOfGas;
  }

  /**
   * Uses up the gas for driving this many px (forward or back). SCREAM-119 (PO, November 2):
   * when the tank runs empty, the evening ends (it used to let the truck crawl to the pumps).
   */
  burnFuel(px: number): void {
    if (this.ended || px <= 0) return;
    const before = this.fuelLeft;
    this.fuelLeft = Math.max(0, this.fuelLeft - px / FUEL_TANK_PX);
    if (before > 0 && this.fuelLeft <= 0) {
      this.ranOutOfGas = true;
      this.endNow();
    }
  }

  /**
   * SCREAM-184 (PO, November 6): what filling the tank to the top costs, in cents, rounded
   * to the nearest 50 cents.
   */
  get fillUpCents(): number {
    return Math.round(((1 - this.fuelLeft) * FUEL_FULL_TANK_CENTS) / FUEL_CENT_STEP) * FUEL_CENT_STEP;
  }

  /**
   * SCREAM-173 (PO, November 6): at the pump in the guided tutorial, the uncle pays, up to
   * the $20 he has on him.
   */
  get unclePaysGas(): boolean {
    return this.tutorial?.step === 'pump';
  }

  /**
   * The most gas the player can buy now, in cents: up to a full tank (SCREAM-184), and no more
   * than the wallet holds (or, in the tutorial, the uncle's $20).
   */
  get maxGasCents(): number {
    const wallet = this.unclePaysGas ? UNCLE_GAS_CENTS : Math.max(0, this.cashCents);
    const affordable = Math.floor(wallet / FUEL_CENT_STEP) * FUEL_CENT_STEP;
    return Math.max(0, Math.min(this.fillUpCents, affordable));
  }

  /** Buys gas at the pump: whole 50 cents, no more than maxGasCents. Returns false, changing nothing, otherwise. */
  buyGas(cents: number): boolean {
    if (this.ended || cents <= 0 || cents % FUEL_CENT_STEP !== 0 || cents > this.maxGasCents) return false;
    this.fuelLeft = cents >= this.fillUpCents ? 1 : Math.min(1, this.fuelLeft + cents / FUEL_FULL_TANK_CENTS);
    if (!this.unclePaysGas) {
      this.gasSpentCents += cents;
      this.changeMoney(-cents, 'Gas');
    }
    this.tutorial?.signal('gasBought');
    return true;
  }

  // ---- Customers (#7, set for real by #12) ----

  /**
   * SCREAM-241: who else is waiting at the parked truck right now (set by the road when a sale starts);
   * the window uses it to offer "Next Customer". Null before the first sale.
   */
  nextAtTruck: (() => ResidentNow | undefined) | null = null;
  /** SCREAM-241: the player drove off (B) with people still waiting: the road serves nobody until the truck moves. */
  windowShutUntilMoved = false;

  /** True while a customer is waiting at the window (issue #7: window only usable during a sale). */
  get customerWaiting(): boolean {
    return this.customerAtWindow;
  }

  /** Sets whether a customer is at the window. */
  setCustomerWaiting(waiting: boolean): void {
    if (this.customerAtWindow === waiting) return;
    this.customerAtWindow = waiting;
    this.emit(EveningEvents.CustomerChanged, waiting);
    if (waiting) this.tutorial?.signal('customerAtWindow');
  }

  /** Total ice creams left in the cooler. */
  get stockLeft(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity, 0);
  }

  /** On the road with nothing left to sell: no customers come, and the HUD says so (#12). */
  get isSoldOut(): boolean {
    return this.prepLocked && this.stockLeft === 0;
  }

  /**
   * SCREAM-67: whether anyone new may start wanting ice cream when they hear the
   * truck: only once the truck is on the road, with stock to sell, before 8 PM.
   * Customers already at the curb keep waiting either way.
   */
  get acceptingCustomers(): boolean {
    return this.prepLocked && !this.ended && !this.isAfterHours && !this.isSoldOut;
  }

  /** The resident being served at the window (SCREAM-99 shows their name), or null. */
  get customer(): ResidentNow | null {
    return this.servingNow;
  }

  // ---- Selling (#13-#15) ----

  /** The sale at the window, or null. */
  get sale(): Sale | null {
    return this.saleNow;
  }

  /**
   * The truck reached a customer: they step up to the window and order from
   * what's in the cooler (PO, doc 08 Q22: straight to the sales screen).
   */
  startSale(customer?: ResidentNow): Sale {
    // SCREAM-67: the resident steps up to the window (the Shift+4 debug key starts a sale with nobody).
    if (customer) {
      this.residents.startServing(customer);
      this.servingNow = customer;
    }
    this.setCustomerWaiting(true);
    // SCREAM-218: an empty cooler (the HUD's SOLD OUT) is "sold out", not "too expensive".
    this.saleNow = new Sale(generateOrder(this.coolerSlots, Math.random, customer?.resident.orderSize), this.coolerSlots.length, this.nowMsValue, Math.random() < this.orderPictureChance, this.isSoldOut);
    // SCREAM-250 (PO): a hard-to-find customer tips 4 times as much (Story only, like all traits).
    if (this.story && customer?.resident.hardToFind) this.saleNow.tipFactor = HARD_TO_FIND_TIP_FACTOR;
    this.lastSalePhase = this.saleNow.phase;
    this.emit(EveningEvents.SaleChanged);
    return this.saleNow;
  }

  /**
   * At the cooler during a sale: moves one ice cream between the slot and the bag (+1 or -1).
   * Taking one takes the last square of that flavour; putting one back returns the last of that
   * flavour taken to its square. (The cooler screen takes from a chosen square: pickCell.)
   */
  pickForSale(slot: number, delta: 1 | -1): boolean {
    const flavour = this.coolerSlots[slot]?.flavour;
    if (!flavour) return false;
    if (delta > 0) return this.pickCell(this.cells.lastIndexOf(flavour));
    const last = this.bagCells.map((b) => b.slot).lastIndexOf(slot);
    return last >= 0 && this.putBack(last);
  }

  /** SCREAM-131: during a sale, takes the ice cream in this square and puts it in the bag. */
  pickCell(cell: number): boolean {
    const sale = this.saleNow;
    const flavour = this.cells[cell];
    const slot = this.coolerSlots.findIndex((s) => s.flavour === flavour);
    const stock = this.coolerSlots[slot];
    if (!sale || sale.phase !== 'deciding' || !flavour || !stock || stock.quantity <= 0) return false;
    this.coolerCells[cell] = null;
    stock.quantity -= 1;
    sale.bag[slot] = (sale.bag[slot] ?? 0) + 1;
    this.bagCells.push({ cell, slot });
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }

  /** SCREAM-131: what's in the bag, in the order taken: each ice cream's flavour and its square. */
  get bagContents(): { cell: number; flavour: FlavourId }[] {
    return this.bagCells.flatMap((b) => {
      const flavour = this.coolerSlots[b.slot]?.flavour;
      return flavour ? [{ cell: b.cell, flavour }] : [];
    });
  }

  /** SCREAM-131: puts the n-th ice cream in the bag back in its square (or the first empty one). */
  putBack(n: number): boolean {
    const sale = this.saleNow;
    const item = this.bagCells[n];
    const stock = item ? this.coolerSlots[item.slot] : undefined;
    if (!sale || sale.phase !== 'deciding' || !item || !stock) return false;
    this.bagCells.splice(n, 1);
    this.placeInCell(item.cell, stock.flavour);
    stock.quantity += 1;
    sale.bag[item.slot] = Math.max(0, (sale.bag[item.slot] ?? 0) - 1);
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }

  /** Puts an ice cream in a square, or the first empty one if that's taken. Doesn't tidy up. */
  private placeInCell(cell: number, flavour: FlavourId): void {
    const target = this.coolerCells[cell] === null ? cell : this.coolerCells.indexOf(null);
    if (target >= 0) this.coolerCells[target] = flavour;
  }

  /** The player types a price and presses Enter (#15). */
  chargeForSale(priceCents: number): void {
    const sale = this.saleNow;
    if (!sale) return;
    const result = sale.charge(priceCents, orderTotalCents(sale.order, this.coolerSlots), this.nowMsValue);
    if (result === 'retry') this.returnBagToStock(sale);
    if (sale.outcome?.kind === 'paid') {
      this.changeMoney(sale.outcome.priceCents, 'Sale');
      this.salesTotalCents += sale.outcome.priceCents;
      if (sale.outcome.tipCents > 0) this.changeMoney(sale.outcome.tipCents, 'Tip');
      this.tipsTotalCents += sale.outcome.tipCents;
      this.largestSaleTotalCents = Math.max(this.largestSaleTotalCents, sale.outcome.priceCents + sale.outcome.tipCents);
      this.paidSales += 1;
      this.countVisit(sale); // SCREAM-145
      if (sale.outcome.tipCents > 0 && !sale.toldAboutRotary) this.maybeHint(sale);
      if (!sale.toldAboutRotary && !sale.hintAbout) this.maybeScheduleLine(sale); // SCREAM-247: one extra line at most
      this.tutorial?.signal('salePaid');
      count('first-sale', this.tutorial ? 'tutorial' : this.mapId); // SCREAM-201: once a visit
    }
    this.afterSaleChange();
  }

  /**
   * SCREAM-103 (PO, November 8): after a tipped sale, sometimes the customer points the player to
   * a big regular (the residents sheet's "Hint" column). Just words: no marker on the map.
   * Engineering's calls: not during the uncle's evening (his lines only); never about the customer
   * themselves, someone already pointed to tonight, someone already served, or someone who
   * doesn't buy tonight.
   */
  private maybeHint(sale: Sale): void {
    if (this.tutorial) return;
    if (this.hintsGiven.length >= HINT_MAX_PER_EVENING) return;
    const forced = this.forceHint;
    if (!forced && (this.paidSales < HINT_FIRST_AFTER_SALES || this.paidSales - this.lastHintAtSale < HINT_GAP_SALES)) return;
    const me = this.servingNow?.resident.id;
    const choices = this.residents.all.filter(
      (p) => this.hintFor.has(p.resident.id) && p.resident.id !== me && p.buys && p.customer !== 'done' && !this.hintsGiven.includes(p.resident.id),
    );
    if (choices.length === 0 || (!forced && Math.random() >= this.hintChance)) return;
    this.forceHint = false;
    const pick = choices[Math.floor(Math.random() * choices.length)].resident;
    sale.addHint(pick.id, this.hintFor.get(pick.id)!);
    this.hintsGiven.push(pick.id);
    this.lastHintAtSale = this.paidSales;
  }

  /**
   * SCREAM-247 (PO, November 10; decision 064): after a paid sale, sometimes the customer says
   * something true about their own week ("See you Thursday!"). Story only. Engineering's calls:
   * not during the uncle's evening (his lines only); never on top of a hint; a tip isn't needed
   * (unlike hints, this is about themselves); at most a few an evening. SCREAM-248: the line is
   * sometimes about a neighbour instead; both kinds share the evening's limit.
   */
  private maybeScheduleLine(sale: Sale): void {
    if (this.tutorial || !this.story) return;
    const me = this.servingNow?.resident;
    if (!me) return;
    const forced = this.forceScheduleLine || this.forceNeighbourLine;
    if (!forced && this.scheduleLinesSaid >= SCHEDULE_LINES_MAX_PER_EVENING) return;
    const everyDay = (me.days?.length ?? 0) >= 7;
    const own = scheduleLineToday(this.scheduleLinesFor.get(me.id), me, this.story.day, STORY_DAYS, Math.random, this.scheduleLinesHeard);
    // SCREAM-248 (decision 065): or something about a neighbour on their street.
    const neighbour = neighbourLineToday(
      me,
      this.residents.all.map((p) => p.resident),
      this.neighbourLinesFor,
      this.story.day,
      STORY_DAYS,
      Math.random,
      this.scheduleLinesHeard,
      this.neighboursToldAbout,
    );
    if (!own && !neighbour) return;
    const chance = this.scheduleLineChance ?? (everyDay ? SCHEDULE_LINE_CHANCE : SCHEDULE_LINE_CHANCE_SOME_DAYS);
    if (!forced && Math.random() >= chance) return;
    const share = this.neighbourLineShare ?? (everyDay ? NEIGHBOUR_LINE_SHARE_EVERY_DAY : NEIGHBOUR_LINE_SHARE_SOME_DAYS);
    const aboutNeighbour = !!neighbour && (!own || (this.forceNeighbourLine ? true : this.forceScheduleLine ? false : Math.random() < share));
    this.forceScheduleLine = false;
    this.forceNeighbourLine = false;
    if (aboutNeighbour) {
      sale.addNeighbourLine(neighbour!.about, neighbour!.text);
      this.neighboursToldAbout.push(neighbour!.about);
      this.scheduleLinesHeard.push(neighbour!.id);
    } else {
      sale.addScheduleLine(own!.text);
      this.scheduleLinesHeard.push(own!.id);
    }
    this.scheduleLinesSaid += 1;
  }

  /** B on the sales screen: drive off without serving (a lost sale). */
  driveOffFromSale(): void {
    this.saleNow?.driveOff();
    this.afterSaleChange();
  }

  /**
   * The player leaves the sales screen after the sale is over. Items handed
   * over in a failed sale are gone; anything else in the bag goes back in the
   * cooler. The next customer appears, or the evening ends if it's past 8 PM.
   */
  closeSale(): void {
    const sale = this.saleNow;
    if (!sale || sale.phase !== 'over') return;
    if (!sale.itemsGivenAway && sale.outcome?.kind !== 'paid') this.returnBagToStock(sale);
    this.bagCells = [];
    this.saleNow = null;
    this.lastSalePhase = null;
    if (this.servingNow) this.residents.finishServing(this.servingNow);
    this.servingNow = null;
    this.setCustomerWaiting(false);
    this.emit(EveningEvents.SaleChanged);
    this.tutorial?.signal('saleClosed');
    if (this.endPending) {
      this.endPending = false;
      this.ended = true;
      this.emit(EveningEvents.Ended);
    }
  }

  private returnBagToStock(sale: Sale): void {
    // SCREAM-131: each ice cream goes back to the square it came from (counts and squares
    // move together, so nothing is tidied away half way).
    for (const { cell, slot } of this.bagCells) {
      const stock = this.coolerSlots[slot];
      if (!stock || (sale.bag[slot] ?? 0) <= 0) continue;
      this.placeInCell(cell, stock.flavour);
      stock.quantity += 1;
      sale.bag[slot] = (sale.bag[slot] ?? 0) - 1;
    }
    this.bagCells = [];
    // Anything left in the bag without a square (shouldn't happen) still goes back in the count.
    sale.bag.forEach((count, slot) => {
      const stock = this.coolerSlots[slot];
      if (stock) stock.quantity += count;
      sale.bag[slot] = 0;
    });
    this.syncCells();
    this.emit(EveningEvents.CoolerChanged);
  }

  /** Advances the sale's timers and tells the scenes when its phase changes. */
  private updateSale(): void {
    const sale = this.saleNow;
    if (!sale) return;
    sale.update(this.nowMsValue);
    if (sale.phase !== this.lastSalePhase) this.afterSaleChange();
  }

  private afterSaleChange(): void {
    // SCREAM-172: the customer has finished giving her order (the uncle's next tip).
    if (this.lastSalePhase === 'ordering' && this.saleNow && this.saleNow.phase !== 'ordering') this.tutorial?.signal('orderHidden');
    this.lastSalePhase = this.saleNow?.phase ?? null;
    this.emit(EveningEvents.SaleChanged);
  }

  // ---- Driving (#9) ----

  get truck(): Readonly<TruckPosition> {
    return this.truckPosition;
  }

  /** Remembers where the truck stopped, so driving resumes from the same place. */
  parkTruck(position: TruckPosition): void {
    this.truckPosition = { ...position };
  }

  // ---- Cooler prep (#8) and selling prices (#23) ----

  get slots(): readonly Readonly<CoolerSlot>[] {
    return this.coolerSlots;
  }

  /** Prep is locked once the player first heads for the driver's seat. */
  get isPrepLocked(): boolean {
    return this.prepLocked;
  }

  /** Called when the player first heads for the road; from then on, people who hear the truck may want ice cream. */
  lockPrep(): void {
    this.prepLocked = true;
    this.tutorial?.signal('setOff');
  }

  /**
   * SCREAM-54 (PO, November 2): back home in the driveway, the cooler can be restocked and
   * the prices changed again, with the clock running. Only once the truck has been on the road.
   */
  startRestock(): boolean {
    if (!this.prepLocked || this.ended) return false;
    this.restockingNow = true;
    return true;
  }

  endRestock(): void {
    this.restockingNow = false;
  }

  /** True while restocking at home (SCREAM-54). */
  get isRestocking(): boolean {
    return this.restockingNow;
  }

  /** Whether the cooler can be changed now: before the first drive, or restocking at home. */
  get canStock(): boolean {
    return (!this.prepLocked || this.restockingNow) && !this.ended;
  }

  /** Total spent on the stock currently in the cooler. */
  get stockCostCents(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity * getFlavour(s.flavour).costCents, 0);
  }

  /**
   * Buy Stock (PR #29 feedback): pays for a draft order from the cooler and
   * makes it the cooler's contents. Returns false, changing nothing, if prep is
   * locked (and the player isn't restocking at home), the evening is over, or the
   * player can't afford it.
   */
  buyStock(order: CoolerOrder): boolean {
    if (!this.canStock) return false;
    const cost = order.costCents;
    if (cost > this.stockBudgetCents) return false;
    // SCREAM-191: bought before the uncle's line: his $50 is handed over first.
    if (this.uncleGiftPending) {
      this.uncleGiftPending = false;
      this.changeMoney(UNCLE_LEFT_CENTS, 'From the uncle');
    }

    order.slots.forEach((slot) => {
      const target = this.coolerSlots.find((s) => s.flavour === slot.flavour);
      if (target) Object.assign(target, slot);
    });
    // SCREAM-131/132: the squares as the player arranged them.
    order.layout.forEach((f, i) => {
      this.coolerCells[i] = f;
    });
    this.syncCells();
    if (cost !== 0) this.changeMoney(-cost, 'Stock', false);
    this.stockSpentCents += cost;
    this.emit(EveningEvents.CoolerChanged);
    this.tutorial?.signal('stockBought');
    return true;
  }
}
