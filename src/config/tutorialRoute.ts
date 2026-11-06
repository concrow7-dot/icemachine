import type { Point } from '../state/AutoRoute';
import type { DriveProfile } from '../state/AutoRoute';

/**
 * SCREAM-171 (PO, November 5): the uncle drives from home to the gas station on Park Ave:
 * down Westland St, left along Highland St, left up Park Ave into the pump bay. These are the
 * streets' centre lines from the tutorial map (src/config/tutorial.ts: Westland Street runs
 * 1416,446 to 1245,2089; Highland Street's west half ends at Park Avenue, 1590,2061; Park Avenue
 * runs from there to 2672,545). If the tutorial map's roads move, update these.
 *
 * He keeps right: 30 px right of the centre line on the two-lane streets, and in Park Ave's
 * curb lane (90 px) where the pump bay is.
 */
export const UNCLE_ROUTE_CORNERS: Point[] = [
  [1416, 446],
  [1245, 2089],
  [1590, 2061],
  [1939, 1572],
];
export const UNCLE_ROUTE_LANES = [30, 30, 90];
export const UNCLE_ROUTE_RADIUS = 100;
/** Passing a parked car in his lane, he swings out to just right of the centre line. */
export const UNCLE_PASS_OFFSET = -2;

/** PO (November 5): the regular he stops for, on the way: Chloe Hogan, sheet 23 (80%, an every-day regular). */
export const TUTORIAL_REGULAR_ID = 'T008';
/** She comes out (her "!") once the truck is this close to her pink square (PO: "automatically when the truck gets within range"). */
export const REGULAR_CALL_DISTANCE = 180;
/**
 * PO (November 6): the instant she has her "!", the truck stops for this long while the uncle
 * says his first line about her; then it creeps up to her square while he says the second.
 */
export const REGULAR_HOLD_MS = 4000;
/** He stops this far short of the middle of her square (still well over half on it), clear of the parked car past it. */
export const REGULAR_STOP_SHORT = 15;

/** An unhurried drive, so the player can watch the streets go by and read his lines. */
export const UNCLE_DRIVING: DriveProfile = { cruise: 190, accel: 140, brake: 170, bendSpeed: 110 };
/**
 * PO (November 6): from home to his regular, 4 times as long as before (about 2.6 s, now about
 * 10 s), so there's time to read his line about the sun.
 */
export const UNCLE_TO_REGULAR: DriveProfile = { cruise: 48, accel: 140, brake: 170, bendSpeed: 48 };
/** PO (November 6): creeping up to her square (about 4 to 5 seconds), then pulling up to it. */
export const UNCLE_CREEP: DriveProfile = { cruise: 34, accel: 60, brake: 40, bendSpeed: 34 };
