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

/** Issue #9: truck top speed in pixels per second. 150 crosses the 2880-pixel neighbourhood in about 20 seconds. */
export const TRUCK_SPEED = 150;

/** Issue #9: seconds to reach top speed from a stop, and to stop from top speed. */
export const TRUCK_ACCELERATION_SECONDS = 0.25;
export const TRUCK_BRAKING_SECONDS = 0.15;

/** PO decision on #9: until selling (#13-#15) exists, leaving the window serves the customer for this much. */
export const PLACEHOLDER_SALE_CENTS = 400;
