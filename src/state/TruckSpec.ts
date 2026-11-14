import { GITTY_UP_ID, TROT_ID } from '../config/powerUps';
import {
  COOLER_CAPACITY,
  GITTY_UP_ACCELERATION_FACTOR,
  TROT_CREEP_FACTOR,
  CRATE_SIDE,
  FUEL_TANK_PX,
  MUSIC_RING_RADIUS,
  STORY_COOLER_COLUMNS,
  STORY_COOLER_HALF_COVERED,
  STORY_COOLER_ROWS,
  STORY_FUEL_BURN_FACTOR,
  STORY_MUSIC_RADIUS_FACTOR,
  STORY_TRUCK_ACCELERATION_FACTOR,
  STORY_TRUCK_BRAKING_FACTOR,
  STORY_TRUCK_CREEP_FACTOR,
  STORY_TRUCK_REVERSE_ACCELERATION_FACTOR,
  STORY_TRUCK_REVERSE_SPEED_FACTOR,
  STORY_TRUCK_ROLL_SECONDS,
  STORY_TRUCK_SPEED_FACTOR,
  STORY_TRUCK_TURN_ABOVE_ROLL_FACTOR,
  STORY_TRUCK_TURN_FACTOR,
  TRUCK_ACCELERATION_SECONDS,
  TRUCK_BRAKING_SECONDS,
  TRUCK_COAST_KEEP,
  TRUCK_COAST_KEEP_SECONDS,
  TRUCK_CREEP_SPEED,
  TRUCK_MAX_TURN_DEGREES_PER_SECOND,
  TRUCK_REVERSE_ACCELERATION_SECONDS,
  TRUCK_REVERSE_SPEED,
  TRUCK_SPEED,
} from '../config/tuning';

/**
 * SCREAM-204 (PO, November 11-12): what this evening's truck can do. Quick play has the
 * full-strength truck; Story starts with a weaker one, so that the power-ups the player
 * buys (decision 073) feel earned. Power-ups will change these numbers; scenes read them
 * from `evening.spec` instead of the tuning values.
 */
export interface TruckSpec {
  /** True for Story's weaker truck. */
  readonly weak: boolean;
  /** Top speed, px per second. */
  readonly topSpeed: number;
  /** Seconds from a stop to top speed. */
  readonly accelerationSeconds: number;
  /** Seconds from top speed to a stop on the brake. */
  readonly brakingSeconds: number;
  /** The speed the truck rolls at with no key held, px per second. */
  readonly creepSpeed: number;
  /** With no key held, above the creep: the share of its speed the truck keeps every TRUCK_COAST_KEEP_SECONDS. */
  readonly coastKeep: number;
  /** Top speed in reverse, px per second. */
  readonly reverseSpeed: number;
  /** Seconds to reach full reverse speed. */
  readonly reverseAccelerationSeconds: number;
  /** The fastest the wheel turns the truck, degrees per second. */
  readonly maxTurnDegrees: number;
  /** Above the roll (creep) speed, the wheel turns the truck this share as fast (1 = no change). */
  readonly turnAboveRoll: number;
  /** How far the music reaches, px from the truck. */
  readonly musicRadius: number;
  /** SCREAM-269: true when part of every crate is closed (Story's starting cooler). */
  readonly coolerHalfCovered: boolean;
  /** SCREAM-293: the columns and rows of each crate that are open (4 by 4 when nothing is closed). */
  readonly coolerColumns: number;
  readonly coolerRows: number;
  /** Ice creams the cooler holds. */
  readonly coolerCapacity: number;
  /** How far a full tank goes, px of driving. */
  readonly fuelTankPx: number;
}

/**
 * The truck for an evening: `weak` is Story's starting truck. `powerUps` are the cork board's notes
 * owned tonight (SCREAM-309: the first power-ups that change the truck).
 */
export function truckSpec(weak: boolean, powerUps: readonly string[] = []): TruckSpec {
  const has = (id: string) => powerUps.includes(id);
  const halfCovered = weak && STORY_COOLER_HALF_COVERED;
  const topSpeed = weak ? TRUCK_SPEED * STORY_TRUCK_SPEED_FACTOR : TRUCK_SPEED;
  // SCREAM-310: Trot raises the creep (Story's 12 px/s to 18). The roll down from top speed still
  // takes STORY_TRUCK_ROLL_SECONDS, ending at the new creep; turns widen above it (SCREAM-280).
  const creepSpeed = (weak ? TRUCK_CREEP_SPEED * STORY_TRUCK_CREEP_FACTOR : TRUCK_CREEP_SPEED) * (has(TROT_ID) ? TROT_CREEP_FACTOR : 1);
  return {
    weak,
    topSpeed,
    accelerationSeconds:
      (weak ? TRUCK_ACCELERATION_SECONDS * STORY_TRUCK_ACCELERATION_FACTOR : TRUCK_ACCELERATION_SECONDS) /
      (has(GITTY_UP_ID) ? GITTY_UP_ACCELERATION_FACTOR : 1),
    brakingSeconds: weak ? TRUCK_BRAKING_SECONDS * STORY_TRUCK_BRAKING_FACTOR : TRUCK_BRAKING_SECONDS,
    creepSpeed,
    // Story: from top speed down to the creep in STORY_TRUCK_ROLL_SECONDS.
    coastKeep: weak ? (creepSpeed / topSpeed) ** (TRUCK_COAST_KEEP_SECONDS / STORY_TRUCK_ROLL_SECONDS) : TRUCK_COAST_KEEP,
    reverseSpeed: weak ? TRUCK_REVERSE_SPEED * STORY_TRUCK_REVERSE_SPEED_FACTOR : TRUCK_REVERSE_SPEED,
    reverseAccelerationSeconds: weak ? TRUCK_REVERSE_ACCELERATION_SECONDS * STORY_TRUCK_REVERSE_ACCELERATION_FACTOR : TRUCK_REVERSE_ACCELERATION_SECONDS,
    maxTurnDegrees: weak ? TRUCK_MAX_TURN_DEGREES_PER_SECOND * STORY_TRUCK_TURN_FACTOR : TRUCK_MAX_TURN_DEGREES_PER_SECOND,
    turnAboveRoll: weak ? STORY_TRUCK_TURN_ABOVE_ROLL_FACTOR : 1,
    musicRadius: weak ? MUSIC_RING_RADIUS * STORY_MUSIC_RADIUS_FACTOR : MUSIC_RING_RADIUS,
    coolerHalfCovered: halfCovered,
    coolerColumns: halfCovered ? STORY_COOLER_COLUMNS : CRATE_SIDE,
    coolerRows: halfCovered ? STORY_COOLER_ROWS : CRATE_SIDE,
    // SCREAM-291: Story's open squares, counted (18: two columns by three rows, in three crates).
    coolerCapacity: Array.from({ length: COOLER_CAPACITY }, (_, i) => coolerCellOpen(halfCovered, i)).filter(Boolean).length,
    fuelTankPx: weak ? FUEL_TANK_PX / STORY_FUEL_BURN_FACTOR : FUEL_TANK_PX,
  };
}

/**
 * SCREAM-269: whether a square of the cooler can be used. Squares are numbered crate by crate
 * and row by row; with the halves covered, only the left two columns of each crate are open.
 * SCREAM-291 (PO, November 12): "completely remove the bottom row of the cooler. So there should be
 * 18 total slots. 6 per cooler now": in Story the bottom row of every crate is gone too.
 */
export function coolerCellOpen(halfCovered: boolean, cell: number): boolean {
  return halfCovered ? coolerCellOpenIn(STORY_COOLER_COLUMNS, STORY_COOLER_ROWS, cell) : coolerCellOpenIn(CRATE_SIDE, CRATE_SIDE, cell);
}

/** SCREAM-293: whether a square is open when each crate has `columns` x `rows` open, from its top left. */
export function coolerCellOpenIn(columns: number, rows: number, cell: number): boolean {
  if (cell < 0 || cell >= COOLER_CAPACITY) return false;
  const inCrate = cell % (CRATE_SIDE * CRATE_SIDE);
  return cell % CRATE_SIDE < columns && Math.floor(inCrate / CRATE_SIDE) < rows;
}
