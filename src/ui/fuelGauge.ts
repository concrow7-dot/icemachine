import { FUEL_GAUGE_WOBBLE_MAX, FUEL_GAUGE_WOBBLE_START } from '../config/tuning';

/**
 * SCREAM-121 (PO, November 2): an old-school gas gauge whose needle jumps around near
 * empty, so the player can't tell exactly when the tank will run dry. Above
 * FUEL_GAUGE_WOBBLE_START the needle is steady; below it, the needle hops to a new random
 * spot every so often, a little further from the true level the emptier the tank.
 * No Phaser here, so the maths can be tested on its own.
 */
export class NeedleWobble {
  /** How far the needle is from the true level right now (fraction of a tank). */
  offset = 0;
  private target = 0;
  private nextHopMs = 0;

  private readonly random: () => number;

  // No constructor parameter properties: the test harness strips types without compiling.
  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** How far the needle may stray at this level: 0 above the start, the max at empty. */
  static amplitude(fuel: number): number {
    if (fuel >= FUEL_GAUGE_WOBBLE_START) return 0;
    const emptiness = (FUEL_GAUGE_WOBBLE_START - Math.max(0, fuel)) / FUEL_GAUGE_WOBBLE_START;
    return emptiness * FUEL_GAUGE_WOBBLE_MAX;
  }

  /** Where the needle points (0 = E, 1 = F) for the true level, at time nowMs, deltaMs since last call. */
  update(fuel: number, nowMs: number, deltaMs: number): number {
    const amp = NeedleWobble.amplitude(fuel);
    if (nowMs >= this.nextHopMs) {
      this.target = (this.random() * 2 - 1) * amp;
      // A hop every 0.12 to 0.4 s: twitchy, like a worn float in the tank.
      this.nextHopMs = nowMs + 120 + this.random() * 280;
    }
    if (amp === 0) this.target = 0;
    // Ease toward the target quickly, so it reads as a jump rather than a slide.
    this.offset += (this.target - this.offset) * Math.min(1, deltaMs / 60);
    return Math.min(1, Math.max(0, fuel + this.offset));
  }
}
