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

/**
 * SCREAM-129 (PO, November 2): the cooler is 3 crates of 4 x 4 squares, one ice cream per
 * square, any mix of flavours: 48 in all (it was 3 slots of 15). The PO kept the total close
 * to the old 45. SCREAM-25 (a bigger cooler) could add a crate.
 */
export const COOLER_CRATES = 3;
export const CRATE_SIDE = 4;
export const COOLER_CAPACITY = COOLER_CRATES * CRATE_SIDE * CRATE_SIDE;

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

/**
 * SCREAM-114 (PO, November 2): much more momentum. Let go of every key and the truck keeps
 * this share of its speed every TRUCK_COAST_KEEP_SECONDS, so it rolls on almost at the
 * same speed until you brake (a creep is still the slowest it rolls). Read as "loses 10% per
 * half second": from top speed it takes about 10 s to roll down to a creep.
 * TRUCK_COAST_SECONDS above still sets how fast it eases up to a creep from a stop, and how
 * an empty tank drops it to its crawl.
 */
export const TRUCK_COAST_KEEP = 0.9;
export const TRUCK_COAST_KEEP_SECONDS = 0.5;

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
 * SCREAM-137 (PO, November 2): customers sometimes say the ice creams' names and sometimes
 * show their pictures instead; which one is random. The chance an order is in pictures.
 */
export const ORDER_PICTURE_CHANCE = 0.5;

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
export const RESIDENT_WALK_SPEED = 11; // SCREAM-140 (PO, November 2): everyone walks at half the old 22.

/** Once outside, a resident stays out this many seconds (somewhere in the range) before going back in. */
export const RESIDENT_OUTSIDE_SECONDS: readonly [number, number] = [25, 70];

/** Once inside, a resident stays in this many seconds before coming out again. */
export const RESIDENT_INSIDE_SECONDS: readonly [number, number] = [20, 60];

/** Between walks, a resident stands still this many seconds. */
export const RESIDENT_IDLE_SECONDS: readonly [number, number] = [2, 7];

/** At the start of an evening, this share of residents are already outside. */
export const RESIDENT_START_OUTSIDE_CHANCE = 0.5;

// ---- SCREAM-148 (PO, November 3): three kinds of buyer, read from the sheet's Likelihood (%) ----
// 0% never buys. Below BUYER_REGULAR_FROM: a "sometimes" buyer, who only buys one day in
// BUYER_SOMETIMES_DAYS. From BUYER_REGULAR_FROM up: an every-day regular. The PO's split:
// 25% regulars, 50% sometimes, 25% never (set in sheet 15).

/** Likelihood (0 to 1) from which someone is an every-day regular. Engineering's line. */
export const BUYER_REGULAR_FROM = 0.5;
/** PO: a "sometimes" buyer buys on 1 day in this many. Story picks the day; Quick play rolls 1 in this many. */
export const BUYER_SOMETIMES_DAYS = 3;
/**
 * PO: sometimes buyers are outside more, about 3/4 of the time; SCREAM-152: regulars too, so
 * players get to know them. Never buyers keep the old routine. Engineering's numbers.
 */
export const BUYERS_START_OUTSIDE_CHANCE = 0.75;
export const BUYERS_OUTSIDE_SECONDS: readonly [number, number] = [40, 100];
export const BUYERS_INSIDE_SECONDS: readonly [number, number] = [10, 30];

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
// SCREAM-152 (PO, November 3): fewer customers per stop, to encourage exploring. Was 0.25 and 0.05.
export const CUSTOMER_CHANCE_FIRST = 0.1;
export const CUSTOMER_CHANCE_FLOOR = 0.03;
export const CUSTOMER_CHANCE_SETTLE_SECONDS = 6;

/**
 * SCREAM-152 (PO, November 3): after hearing the truck this many seconds without coming out,
 * someone has made up their mind: nobody new comes out after that. Engineering's call: it
 * holds for the rest of the evening, so parking in one spot dries up and you have to move on.
 */
export const CUSTOMER_DECIDE_SECONDS = 30;

/**
 * SCREAM-152 (PO, November 3): regulars come out reliably and quickly. Each second they hear
 * the truck, this times their likelihood (steady, not falling). Engineering's number: a 75%
 * regular outside comes out within 5 seconds about 3 times in 4.
 */
export const CUSTOMER_REGULAR_CHANCE = 0.35;

/** PO: people inside their houses are half as likely (they don't hear as well; the AC is on). */
export const CUSTOMER_INDOORS_FACTOR = 0.5;

/** How fast a customer walks to the curb and along it, in px per second. SCREAM-140 (PO, November 2): half the old 75. */
export const CUSTOMER_RUN_SPEED = 37;

/**
 * SCREAM-140 / SCREAM-142 (PO, November 2): from the moment the "!" shows, a customer walks
 * straight toward the truck and keeps following it. Engineering's numbers (proposals): within
 * CUSTOMER_STOP_GAP px of the truck they stop at the curb beside them and their pink square
 * appears; if the truck gets more than CUSTOMER_FOLLOW_AGAIN px away, they set off after it
 * again. Pink squares keep CUSTOMER_QUEUE_GAP px apart, so customers queue up.
 */
export const CUSTOMER_STOP_GAP = 150;
export const CUSTOMER_FOLLOW_AGAIN = 260;
export const CUSTOMER_QUEUE_GAP = 100;

/** PO: a customer waits at the curb this long, then walks home. */
export const CUSTOMER_WAIT_SECONDS = 30;

/**
 * SCREAM-118 (PO, November 2): while you serve someone at the window, people waiting at
 * the curb are willing to wait this many times longer (their 30 seconds run at half speed).
 */
export const SERVING_PATIENCE = 2;

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
 * again: 78,000 / 1.15 = 67,800 px, then 25% faster: 54,200 px. SCREAM-119 (PO, November 2):
 * 30% faster again: 54,200 / 1.3 = about 41,700 px. SCREAM-151 (PO, November 3): 30% faster
 * again: 41,700 / 1.3 = about 32,100 px. The farthest road is about 2,600 px from a gas
 * station in a straight line, so Story's 1/6 tank minimum (about 5,350 px) still reaches one.
 */
export const FUEL_TANK_PX = 32100;

/** PO: Story's day 1 starts with a quarter tank. Later days carry over what's left. */
export const FUEL_STORY_START = 0.25;

/**
 * SCREAM-119 (PO, November 2): running out of gas ends the evening, and the next Story day
 * starts with 1/6 of a tank (PO raised it from 1/8 after running dry on the way), enough to reach a gas station. Engineering's call: a day
 * never starts with less than this, however the last one ended.
 */
export const FUEL_STORY_MIN_START = 1 / 6;

/** PO (November 2): Quick play has fuel too, but starts each evening with a full tank. */
export const FUEL_QUICK_PLAY_START = 1;


/** The HUD's gauge turns red at or below this much of a tank. */
export const FUEL_LOW = 0.15;

/** SCREAM-121 (PO, November 2): the gauge's needle is steady above a quarter tank and starts jumping around below it. */
export const FUEL_GAUGE_WOBBLE_START = 0.25;

/**
 * SCREAM-121: at empty, the needle can show up to this much of a tank either side of the
 * true level (less the fuller the tank). Engineering's starting value; tune by playing.
 */
export const FUEL_GAUGE_WOBBLE_MAX = 0.1;

// ---- Sizes and view (SCREAM-114 / SCREAM-97, PO November 2) ----

/**
 * The truck's bump box (what hits parked cars and the road edge), in px.
 * SCREAM-114: was 46 x 28 scaled 1.3x (60 x 36). SCREAM-115 (PO, November 2): the
 * LimeZu truck at the pack's own size, with the box grown to match the picture.
 * Lanes stay 60 px.
 */
export const TRUCK_LENGTH = 104;
export const TRUCK_WIDTH = 42;

/** SCREAM-115: how big the truck's LimeZu picture is drawn. 1 is the pack's own size (109 px long), like the map's houses and trees. */
export const TRUCK_LOOK_SCALE = 1;

/**
 * SCREAM-115: the pink pickup squares at the curb and the pump bays grow with the
 * truck, so "half the truck in the square" (SCREAM-16) still works: along the road
 * by the same ratio as the truck's length, across it by its width. Engineering's numbers.
 */
export const PICKUP_ZONE_LENGTH = 86;
export const PICKUP_ZONE_WIDTH = 58;

/** SCREAM-115: tilt the truck's picture to match the truck's exact heading (false: no tilt). */
export const TRUCK_LOOK_TILT = true;

/** PO: smaller parked cars. Engineering's starting point: 0.8x (54 x 32 px became 43 x 26). */
export const PARKED_CAR_SCALE = 0.8;

/** PO: zoom in slightly while driving, so you see closer to the street. 1 is the old view. */
export const DRIVE_CAMERA_ZOOM = 1.2;
