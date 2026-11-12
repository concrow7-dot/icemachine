import {
  COOLER_CRATES,
  CRATE_SIDE,
  FUEL_TANK_PX,
  MUSIC_RING_RADIUS,
  STORY_COOLER_CRATES,
  STORY_FUEL_BURN_FACTOR,
  STORY_MUSIC_RADIUS_FACTOR,
  STORY_TRUCK_ACCELERATION_FACTOR,
  STORY_TRUCK_BRAKING_FACTOR,
  STORY_TRUCK_CREEP_FACTOR,
  STORY_TRUCK_SPEED_FACTOR,
  STORY_TRUCK_TURN_FACTOR,
  TRUCK_ACCELERATION_SECONDS,
  TRUCK_BRAKING_SECONDS,
  TRUCK_CREEP_SPEED,
  TRUCK_MAX_TURN_DEGREES_PER_SECOND,
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
  /** The fastest the wheel turns the truck, degrees per second. */
  readonly maxTurnDegrees: number;
  /** How far the music reaches, px from the truck. */
  readonly musicRadius: number;
  /** Crates in the cooler that can be used (the rest are locked). */
  readonly coolerCrates: number;
  /** Ice creams the cooler holds. */
  readonly coolerCapacity: number;
  /** How far a full tank goes, px of driving. */
  readonly fuelTankPx: number;
}

/** The truck for an evening: `weak` is Story's starting truck. */
export function truckSpec(weak: boolean): TruckSpec {
  const crates = weak ? Math.min(STORY_COOLER_CRATES, COOLER_CRATES) : COOLER_CRATES;
  return {
    weak,
    topSpeed: weak ? TRUCK_SPEED * STORY_TRUCK_SPEED_FACTOR : TRUCK_SPEED,
    accelerationSeconds: weak ? TRUCK_ACCELERATION_SECONDS * STORY_TRUCK_ACCELERATION_FACTOR : TRUCK_ACCELERATION_SECONDS,
    brakingSeconds: weak ? TRUCK_BRAKING_SECONDS * STORY_TRUCK_BRAKING_FACTOR : TRUCK_BRAKING_SECONDS,
    creepSpeed: weak ? TRUCK_CREEP_SPEED * STORY_TRUCK_CREEP_FACTOR : TRUCK_CREEP_SPEED,
    maxTurnDegrees: weak ? TRUCK_MAX_TURN_DEGREES_PER_SECOND * STORY_TRUCK_TURN_FACTOR : TRUCK_MAX_TURN_DEGREES_PER_SECOND,
    musicRadius: weak ? MUSIC_RING_RADIUS * STORY_MUSIC_RADIUS_FACTOR : MUSIC_RING_RADIUS,
    coolerCrates: crates,
    coolerCapacity: crates * CRATE_SIDE * CRATE_SIDE,
    fuelTankPx: weak ? FUEL_TANK_PX / STORY_FUEL_BURN_FACTOR : FUEL_TANK_PX,
  };
}
