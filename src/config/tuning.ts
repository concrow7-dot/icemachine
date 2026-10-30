// Tuning values: numbers the product owner may want to change after playtests.
// Change them here, not inside the scenes.

/** Real-world length of one evening, in seconds. Issue #5: 5 minutes for the first playable. */
export const EVENING_LENGTH_SECONDS = 300;

/** In-game clock: the evening runs from 5pm to 8pm (24-hour clock). */
export const EVENING_START_HOUR = 17;
export const EVENING_END_HOUR = 20;

/** Issue #21: cash the player starts with, in cents ($50). Resets each evening for now. */
export const STARTING_CASH_CENTS = 5000;

/** Issue #8: the cooler has 3 flavour slots holding 15 bars each. */
export const COOLER_SLOTS = 3;
export const SLOT_CAPACITY = 15;

/** Issue #23: selling prices move in 25-cent steps between these limits. */
export const PRICE_STEP_CENTS = 25;
export const MIN_PRICE_CENTS = 25;
export const MAX_PRICE_CENTS = 1000;

/** Issue #23: first-playable rule, customers refuse to pay more than this per ice cream. */
export const REFUSE_ABOVE_CENTS = 400;

/**
 * Issue #9: truck top speed in pixels per second. Doubled to 300 after PO
 * testing (PR #38), then while testing driving feel (PR #58): x1.75 to 525,
 * x0.75 to 394, then +10% to 433, about 6.5 seconds across the map.
 */
export const TRUCK_SPEED = 433;

/**
 * Issue #9: seconds to reach top speed from a stop. First 0.25 s; raised to
 * 2.5 s while testing PR #58, so the loaded truck builds speed slowly, a bit
 * like a train (PO).
 */
export const TRUCK_ACCELERATION_SECONDS = 2.5;

// ---- Driving feel (#32): PO decisions in doc 18, then car-style steering after testing PR #58 ----

/**
 * Letting go of the gas: the truck rolls down from top speed over this many
 * seconds (to a creep, below). First 0.2 s (half a tile, Q16); doubled to 0.4 s
 * while testing PR #58.
 */
export const TRUCK_COAST_SECONDS = 0.4;

/** The brake (down arrow): top speed to a stop in this many seconds. */
export const TRUCK_BRAKING_SECONDS = 0.15;

/**
 * The truck never quite stops on its own (PO, testing PR #58): letting go of the
 * gas slows it to this creep, in px/s, so you can still steer slowly. Only the
 * brake brings it to a full stop. First 60 (a tile a second); +20% to 72 in testing.
 * The park brake (Q) works at this speed or slower, and in reverse (#64).
 */
export const TRUCK_CREEP_SPEED = 72;

/**
 * Holding the brake once stopped reverses, up to this speed in px/s: a quarter of the forward
 * top speed (PO, ICE-13; was 175).
 */
export const TRUCK_REVERSE_SPEED = TRUCK_SPEED / 4;
/** Seconds to reach full reverse speed (reversing picks up quicker than going forward). */
export const TRUCK_REVERSE_ACCELERATION_SECONDS = 0.5;
/** ...after holding it this long at a stop, so a quick brake to stop doesn't back you up. */
export const TRUCK_REVERSE_DELAY_SECONDS = 0.4;

/**
 * Steering (left and right arrows) turns the truck like a car, at any angle
 * (PO, testing PR #58). The tightest turn has this radius in px, so a U-turn
 * fits across a two-lane road when you're going slowly...
 */
export const TRUCK_MIN_TURN_RADIUS = 40;
/** ...and the wheel never turns the truck faster than this, in degrees per second, so at speed the turns get wider. */
export const TRUCK_MAX_TURN_DEGREES_PER_SECOND = 200;

/**
 * Turning hard at speed scrubs some speed off (Q17, eased after testing): above
 * this share of top speed, steering loses this share of top speed per second.
 */
export const TURN_SLOWDOWN_ABOVE_FRACTION = 0.5;
export const TURN_SPEED_LOSS_PER_SECOND = 0.5;

/** Harder hits cost more (Q18): the slowest hit that counts costs this share of the full price; top speed costs it all. */
export const HIT_COST_MIN_FRACTION = 0.5;

/** PO decision on #9: until selling (#13-#15) exists, leaving the window serves the customer for this much. */
export const PLACEHOLDER_SALE_CENTS = 400;

// ---- Selling (#13-#15), decided in doc 12 ----

/** How long the customer's order stays in the speech bubble, in seconds. */
export const ORDER_SHOW_SECONDS = 5;

/**
 * Chance of each order size, from 1 to 6 ice creams (PO: 2 and 3 about 30% each).
 * Must add up to 100.
 */
export const ORDER_SIZE_WEIGHTS = [15, 30, 30, 12, 8, 5];

/** The tip countdown: starts when the order is hidden and runs this many seconds. */
export const TIP_COUNTDOWN_SECONDS = 40;

/** Tip percentage for each 10-second step of the countdown: 20% within 10 s, then 15%, 10%, 5%, then none. */
export const TIP_STEP_SECONDS = 10;
export const TIP_PERCENT_STEPS = [20, 15, 10, 5];

/** A customer at the window waits this long, from when the conversation starts, before leaving. */
export const WINDOW_PATIENCE_SECONDS = 60;

/** With this many seconds of patience left, a pulsing "!" appears in the top bar. */
export const PATIENCE_WARNING_SECONDS = 5;

// ---- Obstacles (#10), PO decisions October 29 ----

/** Damage costs at top speed, in cents: a pothole $5, a parked car $10, the road edge $2 per hit. Slower hits cost less (#32). */
export const POTHOLE_DAMAGE_CENTS = 500;
export const PARKED_CAR_DAMAGE_CENTS = 1000;
export const ROAD_EDGE_DAMAGE_CENTS = 200;

/**
 * A bump only counts as a hit if the truck was going at least this share of
 * top speed, so resting against a wall or nudging along it doesn't keep charging.
 */
export const HIT_MIN_SPEED_FRACTION = 0.25;

/** How long the truck spins after hitting a pothole, in seconds. */
export const POTHOLE_SPIN_SECONDS = 0.6;
