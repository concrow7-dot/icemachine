import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, stockCostOf, type FlavourId } from '../config/flavours';
import type { CoolerOrder } from './CoolerOrder';
import { generateOrder, orderTotalCents, Sale, withExtraIceCream, type OrderLine } from './Sale';
import { explorationTipCents } from './ExplorationTip';
import { MAPS, currentMap, fixedParkedCars, setCurrentMap, type MapId } from '../config/maps';
import { arrivalSpot } from './RingLaps';
import {
  BASS_INDOORS_FACTOR, STORY_INDOORS_FACTOR, CUSTOMER_INDOORS_FACTOR, DRUM_CONE_RADIUS_FACTOR, DRUM_CONE_SOLO_SECONDS, LOU_BALL_REVERSED_SECONDS, LOU_BALL_TIP_FACTOR, TOW_COST_CENTS, GAS_CAN_FILL, COOLER_CAPACITY, ROTARY_HINT_LINE, ROTARY_HINT_REGULARS, REFUSE_ABOVE_CENTS, SMILE_TIP_PERCENT_STEPS, SPONGEPOP_KID_TIP_POINTS, TIP_PERCENT_STEPS } from '../config/tuning';
import { coolerCellOpenIn, truckSpec, type TruckSpec } from './TruckSpec';
import type { WorcesterMap } from '../config/mapTypes';
import { Residents, type ResidentNow, type Wall } from './Residents';
import { CurbFinder } from './CurbFinder';
import { assignHints } from './Hints';
import { HINT_LINES } from '../config/hintLines';
import { assignNeighbourLines, assignScheduleLines, isSpecialCustomer, neighbourLineToday, scheduleLineToday, type ScheduleLine } from './ScheduleLines';
import { SCHEDULE_LINES } from '../config/scheduleLines';
import { NEIGHBOUR_LINES } from '../config/neighbourLines';
import { TutorialEvents, TutorialRun } from './Tutorial';
import { count } from './Counter';
import { RoadNetwork } from './RoadGeometry';
import {
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
  UNCLE_LEFT_CENTS,
  FUEL_QUICK_PLAY_START,
  FUEL_TUTORIAL_START,
  FUEL_STEP_CENTS,
  STARTING_CASH_CENTS,
} from '../config/tuning';

/** Events the evening sends out. Scenes listen for these instead of checking every frame. */
import { MAX_PRICE_CENTS, MENU_STARTS_AT_TOP } from '../config/tuning';
import { MIRRORS_ID, SPEEDY_ID } from '../config/powerUps';
import { SPEEDY_SPEED_FACTOR } from '../config/tuning';
import { BASS_ID, FREE_NOTE_IDS, GAS_CAN_ID, NOTEBOOK_ID, iceCreamNoteId, POWER_UP_TREES, SMILE_ID, storyRefuseAboveCents } from '../config/powerUps';
import { buyStatus, placeNotes, type BuyStatus } from './PowerUpBoard';
import { addNotebookEntry, type NotebookEntry } from './Notebook';
import { walkInRoute } from './ComingHome';
import { RoadGraph } from './RoadGraph';

/** SCREAM-296: every note on the cork board. */
const POWER_UP_NOTES = placeNotes(POWER_UP_TREES);

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
function pinkSquareFitsOn(map: WorcesterMap, roads: RoadNetwork, cars: () => readonly { x: number; y: number; clear?: number }[] = () => map.parkedCars) {
  return (x: number, y: number, road: number): boolean => {
    if (!roads.onRoad(x, y) || roads.nearestSegment(x, y)?.road !== road) return false;
    const near = (a: { x: number; y: number }, d: number) => Math.hypot(a.x - x, a.y - y) < d;
    // SCREAM-252: the cars on the street now (the map's own, and residents' while they're home).
    if (cars().some((c) => near(c, c.clear ?? PINK_CLEAR_CAR))) return false; // SCREAM-361: residents' cars are bigger
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
  /** #66: the evening opens at the cooler with the clock stopped at 4:00 PM (SCREAM-371); it starts when you leave the cooler. */
  private clockRunning = false;
  private ended = false;
  /** SCREAM-119: the evening ended because the tank ran empty. */
  private ranOutOfGas = false;
  private startCashCents: number;
  /** SCREAM-191: the uncle's $50 is still to come (guided tutorial, before his line at the cooler). */
  private uncleGiftPending = false;
  private cashCents: number;
  private customerAtWindow = false;
  private prepLocked = false;
  /** SCREAM-54: true while the player is at the cooler after pulling into Home's driveway. */
  private restockingNow = false;
  /** SCREAM-321: looking inside the truck with Tab, away from home. */
  private peekingNow = false;
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
  /** SCREAM-312: exploration tips tonight (their own row on the end-of-day screen). */
  private explorationTotalCents = 0;
  /**
   * SCREAM-334: how much longer the steering is reversed (left is right), in ms. 0 = normal.
   * SCREAM-389: for the same time the gas and the brake are swapped too.
   * SCREAM-358 (PO, November 15: "The key bindings reversing isn't happening"): it runs down only
   * while the truck is moving. It used to run down parked too, so after a sale (parked on the brake,
   * waiting for or serving the next customer) it was over before the player steered at all.
   */
  steeringReversedMs = 0;
  get steeringReversed(): boolean {
    return this.steeringReversedMs > 0;
  }
  /**
   * SCREAM-334: called by the driving view each frame the player has the wheel: runs the driving-only
   * timers down. `moving` (SCREAM-358): whether the truck is moving this frame; the reversed steering
   * waits while it is parked. The drum solo counts either way (it calls customers while parked too).
   */
  driveTick(deltaMs: number, moving = true): void {
    if (moving && this.steeringReversedMs > 0) this.steeringReversedMs = Math.max(0, this.steeringReversedMs - deltaMs);
    if (this.drumSoloMs > 0) this.drumSoloMs = Math.max(0, this.drumSoloMs - deltaMs);
  }
  /** SCREAM-335: how much longer the Drum Cone's drum solo plays, in ms of driving. 0 = the usual tune. */
  drumSoloMs = 0;
  get drumSolo(): boolean {
    return this.drumSoloMs > 0;
  }
  /** SCREAM-335: tonight's truck with the music ring 10% bigger, used while the drum solo plays. */
  private truckDrum?: { of: TruckSpec; spec: TruckSpec };
  /** SCREAM-313: the part of tonight's tips that SpongePops earned (their own row on the end-of-day screen). */
  private spongePopTotalCents = 0;
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
  /**
   * SCREAM-307 (PO, November 14): "on the second night. The player should start not at the
   * cooler, but at the truck screen. That way they can decide to go to the powerups or the
   * cooler screen first." Story from Day 2 on. The clock still waits until the player leaves
   * the cooler or drives off.
   */
  readonly opensAtHub: boolean;
  /**
   * SCREAM-318 (PO, November 14): "At the beginning of the night, I want to make it so the clock
   * doesn't start until the player hits \"Drive\"". Story (not the uncle's guided evening): leaving
   * the cooler no longer starts the clock; only DRIVE on the truck screen does.
   */
  readonly clockWaitsForDrive: boolean;

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
  private readonly coolerCells: (FlavourId | null)[] = [];
  /** SCREAM-204: what tonight's truck can do (Story's is weaker than Quick play's). SCREAM-309: and the power-ups that change it. */
  private truckNow!: TruckSpec;
  get spec(): TruckSpec {
    if (this.drumSoloMs <= 0) return this.truckNow;
    // SCREAM-335: during a Drum Cone's drum solo the music reaches 10% further.
    if (this.truckDrum?.of !== this.truckNow) {
      this.truckDrum = { of: this.truckNow, spec: { ...this.truckNow, musicRadius: this.truckNow.musicRadius * DRUM_CONE_RADIUS_FACTOR } };
    }
    return this.truckDrum.spec;
  }
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
    /** SCREAM-377: Story only: the other map has been reached on an earlier evening. */
    otherMapSeen?: boolean;
    /** SCREAM-268: Story only: the uncle's $20 for gas hasn't been used yet this run. */
    uncleGas?: boolean;
    /** SCREAM-296: Story only: the power-ups bought so far this run (note ids). */
    powerUps?: readonly string[];
    /** SCREAM-245: Story only: what the Handy Notebook holds so far this run. */
    notebook?: readonly NotebookEntry[];
  }, mapId: MapId = 'worcester', guided = false) {
    super();
    // SCREAM-334: an ice cream made for Story has no slot in Quick play's cooler (Quick play is unchanged).
    if (!carry?.story) {
      for (let i = this.coolerSlots.length - 1; i >= 0; i--) if (getFlavour(this.coolerSlots[i].flavour).storyOnly) this.coolerSlots.splice(i, 1);
    }
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
    this.opensAtHub = !!carry?.story && carry.story.day >= 2 && !this.tutorial; // SCREAM-307
    this.clockWaitsForDrive = !!carry?.story && !this.tutorial; // SCREAM-318
    for (let i = 0; i < COOLER_CAPACITY; i++) this.coolerCells.push(null);
    this.visits = { ...(carry?.visits ?? {}) };
    this.rotaryHintGiven = carry?.rotaryHintGiven ?? false;
    this.otherMapSeen = carry?.otherMapSeen ?? false;
    this.uncleGasLeft = carry?.uncleGas ?? false;
    this.powerUpsOwned = [...(carry?.powerUps ?? [])];
    this.notebook = (carry?.notebook ?? []).map((e) => ({ ...e })); // SCREAM-245
    this.truckNow = truckSpec(!!carry?.story, this.powerUpsOwned);
    this.gasCanReady = this.powerUpsOwned.includes(GAS_CAN_ID); // SCREAM-122: full again every day
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
    // SCREAM-204 / SCREAM-269: a save from before the smaller cooler can hold more than fits now: the extras
    // (from the last flavours back) are left behind.
    let over = this.coolerSlots.reduce((sum, sl) => sum + sl.quantity, 0) - this.spec.coolerCapacity;
    for (let n = this.coolerSlots.length - 1; n >= 0 && over > 0; n--) {
      const sl = this.coolerSlots[n];
      if (!sl) continue;
      const cut = Math.min(sl.quantity, over);
      sl.quantity -= cut;
      over -= cut;
    }
    carry?.cells?.forEach((f, i) => {
      if (this.cellOpen(i)) this.coolerCells[i] = f; // SCREAM-269: nothing sits under a covered half
    });
    this.syncCells();
  }

  /** SCREAM-145: the people of a map (made on first use). */
  private residentsOn(id: MapId): Residents {
    let people = this.residentsByMap.get(id);
    if (!people) {
      const map = MAPS[id];
      const roads = roadsOf(id, map.data);
      const cars = () => [...fixedParkedCars(map), ...(this.residentsByMap.get(id)?.carsNow ?? []).filter((c) => !c.moving)]; // SCREAM-252 (SCREAM-380: not the cars driving home)
      people = new Residents(map.residents, Math.random, new CurbFinder(roads, pinkSquareFitsOn(map.data, roads, cars)), this.story);
      people.carsOn = !!this.story && !this.tutorial; // SCREAM-252: Story, not the uncle's evening
      people.nowMinutes = () => this.clockMinutes; // SCREAM-249: hours of the evening
      people.hardToFindOn = !this.tutorial; // SCREAM-250: not in the uncle's evening
      people.indoorsFactor = this.indoorsFactor; // SCREAM-366
      people.chaseRules = !!this.story && !this.tutorial; // SCREAM-342: Story's chasing rules, not in the uncle's evening
      people.speedyFactor = this.speedyFactor; // SCREAM-342
      people.walls = wallsOf(map.data);
      if (this.story && !this.tutorial) people.openPark(); // SCREAM-224: people at the park, Story only, not the uncle's evening
      if (this.story && !this.tutorial) {
        // SCREAM-379: away on their unticked days. SCREAM-380: car owners drive home (the streets' web is made the first time it is needed).
        let graph: RoadGraph | null = null;
        people.sendAway(
          (r) => walkInRoute(r, map.data.roads, map.data),
          (r) => (r.car ? (graph ??= new RoadGraph(map.data.roads, map.data, map.data.roadMask)).driveIn({ x: r.car[0], y: r.car[1], angle: r.car[2] }) : null),
        );
      }
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
  /** SCREAM-145: the regulars served a second time this evening, in order (tests read it). */
  readonly secondVisits: string[] = [];

  /**
   * SCREAM-145 (PO, November 9): counts a paid sale, and on a regular's second visit they may pass
   * on the way to the other neighbourhood. SCREAM-299 (PO, November 13): "The player should then
   * successfully complete 2 transactions with 3 regulars": the third regular of the run to be
   * served twice tells (it was the second). Counted over the whole run, from `visits`.
   */
  private countVisit(sale: Sale): void {
    const person = this.servingNow;
    if (!person || !this.story) return;
    if (this.tutorial?.step === 'sale') return; // the uncle's sale (PO)
    const id = person.resident.id;
    this.visits[id] = (this.visits[id] ?? 0) + 1;
    if (this.visits[id] !== 2 || this.residents.kindOf(person.resident) !== 'regular') return;
    this.secondVisits.push(id);
    if (this.rotaryHintGiven) return;
    const servedTwice = this.residents.all.filter((p) => (this.visits[p.resident.id] ?? 0) >= 2 && this.residents.kindOf(p.resident) === 'regular').length;
    if (servedTwice < ROTARY_HINT_REGULARS) return;
    this.rotaryHintGiven = true;
    sale.addRotaryHint(ROTARY_HINT_LINE);
    this.writeDown(ROTARY_HINT_LINE); // SCREAM-245
  }

  /** SCREAM-377 (PO, November 16): "once the player teleports to the other map, that map should become available too." */
  otherMapSeen = false;
  /** SCREAM-377: the maps the in-truck map can show: home's first, then the other one once the truck has been there. */
  get knownMaps(): MapId[] {
    const other: MapId = this.homeMapId === 'tutorial' ? 'worcester' : 'tutorial';
    return this.otherMapSeen ? [this.homeMapId, other] : [this.homeMapId];
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
    this.streetNow = ''; // SCREAM-237: the other map's streets
    this.mapSwitches += 1;
    this.otherMapSeen = true; // SCREAM-377: the in-truck map shows this map from now on
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

  /** SCREAM-269: whether a square can be used tonight (in Story the right half of each crate is covered). */
  cellOpen(cell: number): boolean {
    return coolerCellOpenIn(this.spec.coolerColumns, this.spec.coolerRows, cell);
  }

  /** The first empty square that can be used, or -1. */
  private firstEmptyCell(): number {
    return this.coolerCells.findIndex((f, i) => f === null && this.cellOpen(i));
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
        const empty = this.firstEmptyCell();
        if (empty < 0) break;
        this.coolerCells[empty] = slot.flavour;
        count++;
      }
    }
  }

  // ---- Clock (#5) ----

  /** How far through the evening we are, from 0 (4pm) to 1 (8pm). */
  get progress(): number {
    return Math.min(this.elapsedMs / this.lengthMs, 1);
  }

  /** Current in-game time as minutes since midnight (4pm = 960). */
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

  /**
   * Debug (Shift+9, SCREAM-324; PO, November 14): "add money to my wallet on any screen ... +$50".
   * Only the cash changes: the starting cash rises with it, so tonight's profit doesn't count it.
   */
  debugAddCash(cents: number): void {
    if (this.ended) return;
    this.startCashCents += cents;
    this.changeMoney(cents, 'Debug');
  }

  /**
   * Debug (Shift+0, SCREAM-337; PO, November 15): "another testing helper. Fill gas." The tank
   * is full again; it costs nothing and counts as no purchase. The Temporary Gas Can is left alone.
   */
  debugFillGas(): void {
    if (this.ended) return;
    this.fuelLeft = 1;
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

  // ---- Power-ups (SCREAM-296) ----

  private powerUpsOwned: string[] = [];
  private powerUpsSpentCents = 0;

  /** The power-ups owned now: the run's, plus any bought tonight. Restart Evening goes back to the run's. */
  get powerUps(): readonly string[] {
    return this.powerUpsOwned;
  }

  /**
   * 073: power-ups are bought at home. SCREAM-320 (PO, November 14): "I want the player to be able
   * to purchase powerups while at home at any time": before setting off, and on every home stop.
   */
  get atHome(): boolean {
    return (!this.prepLocked || this.restockingNow) && !this.ended;
  }

  /** Whether the cork board's note can be bought now, and if not, why. */
  powerUpStatus(id: string): BuyStatus | null {
    const note = POWER_UP_NOTES.find((n) => n.id === id);
    // SCREAM-271: the free notes (the Chocolate Eclair) are owned without being in the run's list.
    return note ? buyStatus(note, [...FREE_NOTE_IDS, ...this.powerUpsOwned], this.cashCents, this.atHome) : null;
  }

  /**
   * SCREAM-271 (PO, November 13): in Story only the Chocolate Eclair can be stocked until an
   * ice cream's note is bought on the cork board. Quick play has them all.
   */
  flavourUnlocked(flavour: FlavourId): boolean {
    // SCREAM-334: an ice cream made for Story's cork board is never on Quick play's clipboard.
    if (!this.story) return !getFlavour(flavour).storyOnly;
    const id = iceCreamNoteId(flavour);
    return FREE_NOTE_IDS.includes(id) || this.powerUpsOwned.includes(id);
  }

  /** SCREAM-303: tonight's tip steps: 25% first and 10 seconds longer once Service With A Smile is owned. */
  get tipSteps(): readonly number[] {
    return this.powerUpsOwned.includes(SMILE_ID) ? SMILE_TIP_PERCENT_STEPS : TIP_PERCENT_STEPS;
  }

  /**
   * The tip steps for one sale: tonight's (SCREAM-303), plus 10 points at every step when a kid's
   * order includes a SpongePop (SCREAM-313, PO, November 14; Story only).
   */
  saleTipSteps(order: readonly OrderLine[], customer?: ResidentNow): readonly number[] {
    const points = this.spongePopPoints(order, customer);
    return points > 0 ? this.tipSteps.map((percent) => percent + points) : this.tipSteps;
  }

  /** SCREAM-313: the extra tip points a SpongePop brings: 10 for a kid who orders one in Story, else 0. */
  spongePopPoints(order: readonly OrderLine[], customer?: ResidentNow): number {
    const kidWithSpongePop = this.story && !!customer?.resident.kid && order.some((line) => line.flavour === 'spongepop');
    return kidWithSpongePop ? SPONGEPOP_KID_TIP_POINTS : 0;
  }

  /** SCREAM-271: the ice creams the clipboard offers tonight, in the order of FLAVOURS. */
  get unlockedFlavours(): FlavourId[] {
    return FLAVOURS.map((f) => f.id).filter((id) => this.flavourUnlocked(id));
  }

  /** SCREAM-271: the most a customer pays for one of these tonight before leaving it out of the order. */
  refuseAboveCents(flavour: FlavourId): number {
    return this.story ? storyRefuseAboveCents(flavour) : REFUSE_ABOVE_CENTS;
  }

  /**
   * SCREAM-343 (PO, November 15): "At the cooler, when seeing today's menu, the player should not be
   * able to raise the price above the one stated on the cork board". In Story (not the uncle's
   * evening) Today's Menu stops at the price on the ice cream's note; elsewhere at MAX_PRICE_CENTS.
   */
  menuTopPriceCents(flavour: FlavourId): number {
    return this.story && !this.tutorial ? storyRefuseAboveCents(flavour) : MAX_PRICE_CENTS;
  }

  /**
   * SCREAM-374 (PO, November 16): "On the chocolate éclair, spongepop and lil explorer, [m]ake the
   * price the max allowed when added [from] available ice cream." In Story (not the uncle's
   * evening) those three go onto Today's Menu at the most a customer pays; null = keep its price.
   */
  menuAddPriceCents(flavour: FlavourId): number | null {
    if (!this.story || this.tutorial || !MENU_STARTS_AT_TOP.includes(flavour)) return null;
    return this.menuTopPriceCents(flavour);
  }

  /** SCREAM-343: brings any menu price above its top down to it (an old save's); called when the cooler opens. */
  capMenuPrices(): void {
    for (const slot of this.coolerSlots) slot.priceCents = Math.min(slot.priceCents, this.menuTopPriceCents(slot.flavour));
  }

  /** SCREAM-245: the Handy Notebook's entries, oldest first (kept for the whole Story run). */
  readonly notebook: NotebookEntry[];

  /** SCREAM-245: the Handy Notebook is owned: hints are written down, and it sits in the truck to be read. */
  get hasNotebook(): boolean {
    return this.powerUpsOwned.includes(NOTEBOOK_ID);
  }

  /** SCREAM-245: with the notebook, writes down what the customer at the window just said (a hint of any kind). */
  private writeDown(text: string): void {
    const who = this.servingNow?.resident.name;
    if (!this.hasNotebook || !this.story || !who) return;
    addNotebookEntry(this.notebook, { day: this.story.day, who, text });
  }

  /** SCREAM-342: Speedy Neighbors: how much faster most customers go after the truck (1 without the note). */
  get speedyFactor(): number {
    return this.powerUpsOwned.includes(SPEEDY_ID) ? SPEEDY_SPEED_FACTOR : 1;
  }

  /** SCREAM-341: Better Mirrors is owned: the road shows a marker for each customer on their way who is off screen. */
  get hasBetterMirrors(): boolean {
    return this.powerUpsOwned.includes(MIRRORS_ID);
  }

  /** SCREAM-366: how likely someone indoors is to come out, against someone in their yard (Story: a quarter; half with the bass). */
  get indoorsFactor(): number {
    if (!this.story) return CUSTOMER_INDOORS_FACTOR;
    return this.powerUpsOwned.includes(BASS_ID) ? BASS_INDOORS_FACTOR : STORY_INDOORS_FACTOR;
  }

  /** Buys a note from the cork board with tonight's cash. Returns false, changing nothing, if it can't be bought. */
  buyPowerUp(id: string): boolean {
    const note = POWER_UP_NOTES.find((n) => n.id === id);
    if (!note || this.powerUpStatus(id) !== 'ok') return false;
    this.powerUpsOwned.push(id);
    if (id === GAS_CAN_ID) this.gasCanReady = true; // it comes full
    this.truckNow = truckSpec(!!this.story, this.powerUpsOwned); // SCREAM-309: a power-up may change the truck
    if (id === BASS_ID) for (const people of this.residentsByMap.values()) people.indoorsFactor = this.indoorsFactor; // SCREAM-329, SCREAM-366: from now on
    if (id === SPEEDY_ID) for (const people of this.residentsByMap.values()) people.speedyFactor = this.speedyFactor; // SCREAM-342: from now on
    this.powerUpsSpentCents += note.priceCents;
    this.changeMoney(-note.priceCents, 'Power-up');
    return true;
  }

  /**
   * SCREAM-312 (PO, November 14): in Story, each Lil Explorer Pop in a paid order earns an
   * exploration tip that grows with the straight-line distance from home. Paid even when the
   * customer leaves no normal tip. Measured at the customer's pickup square (where the truck is).
   */
  private payExplorationTip(sale: Sale): void {
    const pops = sale.order.filter((line) => line.flavour === 'explorer').reduce((n, line) => n + line.count, 0);
    const at = this.servingNow?.pickup;
    if (!this.story || pops === 0 || !at) return;
    const cents = pops * explorationTipCents(this.mapId, this.homeMapId, at[0], at[1]);
    if (cents <= 0) return;
    sale.explorationTipCents = cents;
    this.explorationTotalCents += cents;
    this.changeMoney(cents, 'Exploration tip');
  }

  /** Tonight's breakdown for the results screen (#16). */
  get breakdown(): { salesCents: number; tipsCents: number; spongePopCents: number; explorationCents: number; stockCents: number; gasCents: number; damageCents: number; powerUpsCents: number } {
    return {
      salesCents: this.salesTotalCents,
      tipsCents: this.tipsTotalCents,
      spongePopCents: this.spongePopTotalCents, // SCREAM-313
      explorationCents: this.explorationTotalCents, // SCREAM-312
      stockCents: this.stockSpentCents,
      gasCents: this.gasSpentCents,
      damageCents: this.damageTotalCents,
      powerUpsCents: this.powerUpsSpentCents,
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
  /** SCREAM-390: what tonight's tow home cost, in cents (0 when there was none, or it was free). */
  private towPaidCents = 0;
  get towCents(): number {
    return this.towPaidCents;
  }

  get endedOutOfGas(): boolean {
    return this.ranOutOfGas;
  }

  // SCREAM-122 (PO, November 13): the Temporary Gas Can. Owned for the rest of the run once
  // bought, and full at the start of every evening; it pours itself in once an evening.
  private gasCanReady = false;
  private gasCansPoured = 0;

  /** SCREAM-207: the "How To Drive" pop-up has been shown this evening (it shows once, on Day 1's first drive). */
  howToDriveShown = false;

  /** True while tonight's can is still full. */
  get gasCanFull(): boolean {
    return this.gasCanReady;
  }

  /** How many times the can has been poured in tonight (0 or 1). */
  get gasCansUsed(): number {
    return this.gasCansPoured;
  }

  /**
   * Uses up the gas for driving this many px (forward or back). SCREAM-119 (PO, November 2):
   * when the tank runs empty, the evening ends (it used to let the truck crawl to the pumps).
   * SCREAM-122: unless the Temporary Gas Can is full: then it pours itself in (a fifth of a
   * tank), the evening carries on, and this returns true so the road can show the can.
   */
  burnFuel(px: number): boolean {
    if (this.ended || px <= 0) return false;
    const before = this.fuelLeft;
    this.fuelLeft = Math.max(0, this.fuelLeft - px / this.spec.fuelTankPx);
    if (before > 0 && this.fuelLeft <= 0) {
      if (this.gasCanReady) {
        this.gasCanReady = false;
        this.gasCansPoured += 1;
        this.fuelLeft = GAS_CAN_FILL;
        return true;
      }
      // SCREAM-390: in Story (not the uncle's evening) the tow home costs TOW_COST_CENTS, counted with tonight's gas.
      if (this.story && (!this.tutorial || this.tutorial.skipped)) {
        this.towPaidCents = TOW_COST_CENTS;
        this.gasSpentCents += TOW_COST_CENTS;
        this.changeMoney(-TOW_COST_CENTS, 'Tow home');
      }
      this.ranOutOfGas = true;
      this.endNow();
    }
    return false;
  }

  /**
   * SCREAM-184 (PO, November 6): what filling the tank to the top costs, in cents, rounded
   * to the nearest 50 cents.
   */
  get fillUpCents(): number {
    return Math.round(((1 - this.fuelLeft) * FUEL_FULL_TANK_CENTS) / FUEL_CENT_STEP) * FUEL_CENT_STEP;
  }

  /**
   * SCREAM-173 (PO, November 6): at the pump in the guided tutorial, the uncle pays.
   * SCREAM-360 (PO, November 15): "The uncle pays for the whole first tank of gas" (was up to $20).
   */
  get unclePaysGas(): boolean {
    return this.tutorial?.step === 'pump' || this.uncleLeftGas;
  }

  /**
   * SCREAM-268 (PO, November 12): in Story, a player who didn't get the uncle's gas at his pump
   * (On My Own, or he was skipped first) finds it waiting at their first pump. It is used up only
   * when gas is bought with it. SCREAM-360 (PO, November 15, "Both"): a whole tank, here too.
   */
  get uncleLeftGas(): boolean {
    return this.uncleGasLeft && (!this.tutorial || this.tutorial.skipped);
  }

  /** SCREAM-268: the uncle's tank of gas is still to come in this Story run. */
  private uncleGasLeft: boolean;
  /** SCREAM-268: the uncle's tank of gas was used tonight (StoryRun carries it on). */
  uncleGasUsed = false;

  /**
   * The most gas the player can buy now, in cents: up to a full tank (SCREAM-184), and no more
   * than the wallet holds. SCREAM-360: when the uncle pays, always up to a full tank.
   */
  get maxGasCents(): number {
    if (this.unclePaysGas) return this.fillUpCents;
    const wallet = Math.max(0, this.cashCents);
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
    } else {
      this.uncleGasLeft = false;
      this.uncleGasUsed = true;
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
    const refuse = (f: FlavourId) => this.refuseAboveCents(f);
    let order = generateOrder(this.coolerSlots, Math.random, customer?.resident.orderSize, refuse);
    // SCREAM-315 (PO, November 14): with a Chocolate Eclair in the cooler, every Story customer orders one more ice cream.
    // SCREAM-354 (PO, November 15): of any kind they'd buy, not only an eclair.
    if (this.story) order = withExtraIceCream(order, this.coolerSlots, Math.random, refuse);
    this.saleNow = new Sale(order, this.coolerSlots.length, this.nowMsValue, Math.random() < this.orderPictureChance, this.isSoldOut);
    // SCREAM-250 (PO): a hard-to-find customer tips 4 times as much (Story only, like all traits).
    if (this.story && customer?.resident.hardToFind) this.saleNow.tipFactor = HARD_TO_FIND_TIP_FACTOR;
    // SCREAM-334 (PO): a sale with a Two Ball Lou Ball pays 1.5 times the tip (SCREAM-389; it was double), once, however many are in the order.
    if (this.story && order.some((line) => line.flavour === 'louball')) {
      this.saleNow.louBall = true;
      this.saleNow.tipFactor *= LOU_BALL_TIP_FACTOR;
    }
    // SCREAM-335 (PO): a sale with a Drum Cone starts the drum solo once it is paid.
    if (this.story && order.some((line) => line.flavour === 'drumcone')) this.saleNow.drumCone = true;
    this.saleNow.tipSteps = this.saleTipSteps(this.saleNow.order, customer); // SCREAM-303, SCREAM-313
    this.saleNow.spongePopPoints = this.spongePopPoints(this.saleNow.order, customer);
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
    const target = this.coolerCells[cell] === null && this.cellOpen(cell) ? cell : this.firstEmptyCell();
    if (target >= 0) this.coolerCells[target] = flavour;
  }

  /** The player types a price and presses Enter (#15). */
  chargeForSale(priceCents: number): void {
    const sale = this.saleNow;
    if (!sale) return;
    const result = sale.charge(priceCents, orderTotalCents(sale.order, this.coolerSlots), this.nowMsValue);
    // SCREAM-383 (PO, November 17): "When you give an incorrect order, leave the items you tried to give the
    // customer in the bag. Currently you need to completely restock it." So after a first wrong order the bag
    // keeps what was handed over (it used to go back to the cooler); the player fixes only the mistake.
    if (sale.outcome?.kind === 'paid') {
      this.changeMoney(sale.outcome.priceCents, 'Sale');
      this.salesTotalCents += sale.outcome.priceCents;
      // SCREAM-313 (PO, November 14): the part of the tip a SpongePop earned is shown and counted on its own.
      const sponge = sale.spongePopTipCents;
      if (sale.outcome.tipCents - sponge > 0) this.changeMoney(sale.outcome.tipCents - sponge, 'Tip');
      if (sponge > 0) this.changeMoney(sponge, 'SpongePop tip');
      this.tipsTotalCents += sale.outcome.tipCents - sponge;
      this.spongePopTotalCents += sponge;
      this.payExplorationTip(sale); // SCREAM-312
      // SCREAM-334: ...and the steering is reversed for 10 seconds of driving (a second sale starts them again).
      if (sale.louBall) this.steeringReversedMs = LOU_BALL_REVERSED_SECONDS * 1000;
      // SCREAM-335: ...and a Drum Cone's drum solo plays for 30 seconds of driving (a second sale starts them again).
      if (sale.drumCone) this.drumSoloMs = DRUM_CONE_SOLO_SECONDS * 1000;
      this.largestSaleTotalCents = Math.max(this.largestSaleTotalCents, sale.outcome.priceCents + sale.outcome.tipCents + sale.explorationTipCents);
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
    this.writeDown(this.hintFor.get(pick.id)!); // SCREAM-245
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
    // SCREAM-275: only special customers talk about their own week, and only special neighbours are talked about.
    const own = isSpecialCustomer(me)
      ? scheduleLineToday(this.scheduleLinesFor.get(me.id), me, this.story.day, STORY_DAYS, Math.random, this.scheduleLinesHeard)
      : null;
    // SCREAM-248 (decision 065): or something about a neighbour on their street.
    const neighbour = neighbourLineToday(
      me,
      this.residents.all.map((p) => p.resident).filter(isSpecialCustomer),
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
      this.writeDown(neighbour!.text); // SCREAM-245
      this.neighboursToldAbout.push(neighbour!.about);
      this.scheduleLinesHeard.push(neighbour!.id);
    } else {
      sale.addScheduleLine(own!.text);
      this.writeDown(own!.text); // SCREAM-245
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

  /** SCREAM-237: the street the truck was last on (the road view sets it whenever the truck is on a named street). */
  streetNow = '';
  /**
   * SCREAM-237 (PO, November 15: "Street instead"): the street for Story's top bar. The last one
   * the truck drove on; before it has driven tonight (home's driveway), the street nearest to it.
   */
  get street(): string {
    if (this.streetNow) return this.streetNow;
    const roads = roadsOf(this.mapId, MAPS[this.mapId].data);
    const seg = roads.nearestSegment(this.truckPosition.x, this.truckPosition.y);
    return seg ? (roads.names[seg.road] ?? '') : '';
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

  /**
   * SCREAM-319 (PO, November 14): "When the player pulls into home ... it should be on the truck
   * screen, not the cooler screen." Story (not the uncle's evening): a home stop opens the truck
   * screen, where the cooler, the cork board and DRIVE are.
   */
  get homeOpensTruck(): boolean {
    return this.clockWaitsForDrive;
  }

  /**
   * SCREAM-321 (PO, November 14): "If the player is at very low speed, they can hit \"Tab\" and they
   * will go to the inside truck view. They can see inventory at this time, but not purchase it. They
   * can see powerups but not purchase them." Story, once the truck has set off. The clock runs.
   */
  get canPeek(): boolean {
    return this.clockWaitsForDrive && this.prepLocked && !this.restockingNow && !this.ended;
  }

  startPeek(): boolean {
    if (!this.canPeek) return false;
    this.peekingNow = true;
    return true;
  }

  endPeek(): void {
    this.peekingNow = false;
  }

  /** True while looking inside the truck with Tab (SCREAM-321). */
  get isPeeking(): boolean {
    return this.peekingNow;
  }

  /** True while restocking at home (SCREAM-54). */
  get isRestocking(): boolean {
    return this.restockingNow;
  }

  /**
   * SCREAM-368 (PO, November 16: "If the player goes to drive and they haven't restocked the truck,
   * warn them"; his answer "No stock bought tonight"): Story, not the uncle's evening, before the first
   * drive, with something in the cooler but nothing bought tonight.
   */
  get shouldWarnNotRestocked(): boolean {
    return !!this.story && !this.tutorial && !this.prepLocked && this.stockLeft > 0 && this.stockSpentCents === 0;
  }

  /** Whether the cooler can be changed now: before the first drive, or restocking at home. */
  get canStock(): boolean {
    return (!this.prepLocked || this.restockingNow) && !this.ended;
  }

  /** Total spent on the stock currently in the cooler. */
  get stockCostCents(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity * this.stockCostOf(s.flavour), 0);
  }

  /** SCREAM-365: what one ice cream costs to stock tonight (Story has its own prices). */
  stockCostOf(flavour: FlavourId): number {
    return stockCostOf(flavour, !!this.story);
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
      this.coolerCells[i] = this.cellOpen(i) ? f : null;
    });
    this.syncCells();
    if (cost !== 0) this.changeMoney(-cost, 'Stock', false);
    this.stockSpentCents += cost;
    this.emit(EveningEvents.CoolerChanged);
    this.tutorial?.signal('stockBought');
    return true;
  }
}
