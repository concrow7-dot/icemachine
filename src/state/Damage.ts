import { HIT_COST_MIN_FRACTION, HIT_MIN_SPEED_FRACTION } from '../config/tuning';

// Issue #32 (PO, doc 18 Q18): harder hits cost more. A hit at top speed costs
// the full price; the slowest hit that still counts (a quarter of top speed)
// costs half, and the price climbs in a straight line between the two.
// Rounded to the nearest quarter so the popups read cleanly ($3.75, not $3.81).

/** What a hit costs, in cents, at `speed` (pixels per second) for a full price of `fullCents`. */
export function hitCostCents(fullCents: number, speed: number, topSpeed: number): number {
  const range = 1 - HIT_MIN_SPEED_FRACTION;
  const hardness = Math.min(1, Math.max(0, (speed / topSpeed - HIT_MIN_SPEED_FRACTION) / range));
  const share = HIT_COST_MIN_FRACTION + (1 - HIT_COST_MIN_FRACTION) * hardness;
  return Math.round((fullCents * share) / 25) * 25;
}
