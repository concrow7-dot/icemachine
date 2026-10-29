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

/** Issue #9: truck top speed in pixels per second. Doubled to 300 after PO testing (PR #38): about 10 seconds across the map. */
export const TRUCK_SPEED = 300;

/** Issue #9: seconds to reach top speed from a stop. */
export const TRUCK_ACCELERATION_SECONDS = 0.25;

// ---- Driving feel (#32), PO decisions in doc 18 ----

/**
 * Letting go of the keys: the truck rolls to a stop over this many seconds from
 * top speed. 0.2 s at 300 px/s is about 30 px, half a tile (Q16).
 */
export const TRUCK_COAST_SECONDS = 0.2;

/** Pressing the opposite direction brakes hard: top speed to a stop in this many seconds, then the truck turns round (Q16). */
export const TRUCK_BRAKING_SECONDS = 0.15;

/** Turning while going faster than this share of top speed costs speed (Q17)... */
export const TURN_SLOWDOWN_ABOVE_FRACTION = 0.5;
/** ...the truck keeps this share of its speed through the turn: it slows by a third. */
export const TURN_SPEED_KEPT = 2 / 3;

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
