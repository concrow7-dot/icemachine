// Tuning values: numbers the product owner may want to change after playtests.
// Change them here, not inside the scenes.

/** Real-world length of one evening, in seconds. Issue #5: 5 minutes for the first playable. */
export const EVENING_LENGTH_SECONDS = 300;

/** In-game clock: the evening runs from 5pm to 8pm (24-hour clock). */
export const EVENING_START_HOUR = 17;
export const EVENING_END_HOUR = 20;

/** Issue #21: cash the player starts with, in cents ($50). Quick play: resets each evening. */
export const STARTING_CASH_CENTS = 5000;

/** SCREAM-19 (PO, October 31): Story mode starts with $100; cash and stock then carry over. */
export const STORY_START_CASH_CENTS = 10000;

/**
 * SCREAM-19 / SCREAM-65 (PO, October 31): a Story run is 3 evenings for now,
 * to grow to 21 later. Lower it to 1 or 2 to test the end of a run quickly.
 */
export const STORY_DAYS = 3;

/** SCREAM-18 (PO, October 31): the story's goal, a new bike, costs $200. */
export const BIKE_PRICE_CENTS = 20000;

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
 * x0.75 to 394, then +10% to 433, about 6.5 seconds across the map. SCREAM-114 (PO,
 * November 2): +10% again, to 476, then +15% to 547.
 */
export const TRUCK_SPEED = 547;

/**
 * Issue #9: seconds to reach top speed from a stop. First 0.25 s; raised to
 * 2.5 s while testing PR #58, so the loaded truck builds speed slowly, a bit
 * like a train (PO).
 */
export const TRUCK_ACCELERATION_SECONDS = 2.5;

// ---- Driving feel (#32): PO decisions in doc 10, then car-style steering after testing PR #58 ----

/**
 * Letting go of the gas: the truck rolls down from top speed over this many
 * seconds (to a creep, below). First 0.2 s (half a tile, Q16); doubled to 0.4 s
 * while testing PR #58; SCREAM-114 (PO, November 2): 25% more momentum, 0.5 s.
 */
export const TRUCK_COAST_SECONDS = 0.5;

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

// ---- Selling (#13-#15), decided in doc 08 ----

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

// ---- Residents (SCREAM-59, SCREAM-73) ----
// Engineering's starting values, to tune after the PO's first test.

/** How fast residents walk around their yard, in px per second (the truck's top speed is far higher). */
export const RESIDENT_WALK_SPEED = 22;

/** Once outside, a resident stays out this many seconds (somewhere in the range) before going back in. */
export const RESIDENT_OUTSIDE_SECONDS: readonly [number, number] = [25, 70];

/** Once inside, a resident stays in this many seconds before coming out again. */
export const RESIDENT_INSIDE_SECONDS: readonly [number, number] = [20, 60];

/** Between walks, a resident stands still this many seconds. */
export const RESIDENT_IDLE_SECONDS: readonly [number, number] = [2, 7];

/** At the start of an evening, this share of residents are already outside. */
export const RESIDENT_START_OUTSIDE_CHANCE = 0.5;

// ---- Customers: the sonar ring (SCREAM-67), PO decisions November 2 (doc 14) ----

/** How far the truck's music reaches, in px from the truck: residents inside this ring can hear it. Engineering's value. */
export const MUSIC_RING_RADIUS = 300;

/**
 * Each second someone hears the truck, the chance they want ice cream. PO, November 2:
 * people are most likely to want ice cream the moment they hear the truck; after that
 * they may still change their mind, but less and less often. So the chance is
 * CUSTOMER_CHANCE_FIRST in the first second, then falls toward CUSTOMER_CHANCE_FLOOR,
 * each second by less than the last (about two thirds of the way down after
 * CUSTOMER_CHANCE_SETTLE_SECONDS). Overall, the longer someone hears the truck, the
 * more likely they've come out. Engineering's numbers. Then multiplied by the
 * resident's likelihood from the residents sheet (doc 15).
 */
export const CUSTOMER_CHANCE_FIRST = 0.25;
export const CUSTOMER_CHANCE_FLOOR = 0.05;
export const CUSTOMER_CHANCE_SETTLE_SECONDS = 6;

/** PO: people inside their houses are half as likely (they don't hear as well; the AC is on). */
export const CUSTOMER_INDOORS_FACTOR = 0.5;

/** How fast a customer runs to the curb, in px per second. */
export const CUSTOMER_RUN_SPEED = 75;

/** PO: a customer waits at the curb this long, then walks home. */
export const CUSTOMER_WAIT_SECONDS = 30;

// ---- Fuel (SCREAM-22, PO October 29 and November 2) ----

/** PO: a full tank costs $30. */
export const FUEL_FULL_TANK_CENTS = 3000;

/** PO: gas is bought in $5 steps (so $5 is a sixth of a tank). */
export const FUEL_STEP_CENTS = 500;

/**
 * How far a full tank goes, in px of driving. PO: a full evening of driving uses
 * about 2/3 of a tank. Engineering's guess at "a full evening": moving 60% of the
 * 300 s evening at top speed (433 px/s) is about 78,000 px. It was 117,000 (2/3 of a
 * tank); SCREAM-114 (PO, November 2): gas should burn quicker, so now a full evening
 * of driving uses about a full tank (1.5x as fast). Then (PO, November 2) 15% faster
 * again: 78,000 / 1.15 = 67,800 px, then 25% faster: 54,200 px. Tune after playing.
 */
export const FUEL_TANK_PX = 54200;

/** PO: Story's day 1 starts with a quarter tank. Later days carry over what's left. */
export const FUEL_STORY_START = 0.25;

/** PO (November 2): Quick play has fuel too, but starts each evening with a full tank. */
export const FUEL_QUICK_PLAY_START = 1;

/** PO: with an empty tank the truck crawls at a quarter of its top speed (no tow, for now). */
export const FUEL_EMPTY_SPEED_FRACTION = 0.25;

/** The HUD's gauge turns red at or below this much of a tank. */
export const FUEL_LOW = 0.15;

// ---- Sizes and view (SCREAM-114 / SCREAM-97, PO November 2) ----

/** PO: a bigger truck. Engineering's starting point: 1.3x (46 x 28 px became 60 x 36). Lanes stay 60 px. */
export const TRUCK_SCALE = 1.3;

/** PO: smaller parked cars. Engineering's starting point: 0.8x (54 x 32 px became 43 x 26). */
export const PARKED_CAR_SCALE = 0.8;

/** PO: zoom in slightly while driving, so you see closer to the street. 1 is the old view. */
export const DRIVE_CAMERA_ZOOM = 1.2;
