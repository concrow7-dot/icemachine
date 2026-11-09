import { FLAVOURS, type FlavourId } from '../config/flavours';
import type { CoolerSlot } from './EveningState';
import type { RunTotals } from './StoryRun';
import { FUEL_STORY_START } from '../config/tuning';

// SCREAM-17 (PO, October 31): Story mode is saved in the browser, the same way
// high scores are (decision 004): no accounts, and clearing the browser's data
// loses it. One save slot. The game saves at the end of each evening, so
// quitting mid-evening means replaying that evening. The save is cleared when
// a run ends (the last day, or game over).

/** What's needed to start the next evening of a run. */
export type StorySave = {
  /** The evening to play next, from 1. */
  day: number;
  cashCents: number;
  slots: CoolerSlot[];
  /** SCREAM-131: where each ice cream sits in the cooler. Saves from before it have none. */
  cells?: (FlavourId | null)[];
  /** SCREAM-22: gas left in the tank, 0 to 1. Saves from before fuel get a quarter tank. */
  fuel: number;
  /** SCREAM-18: the run's takings so far. */
  totals: RunTotals;
  /** SCREAM-148: picks each sometimes buyer's day. Saves from before it get a new one. */
  seed?: number;
  /** SCREAM-145: paid sales per resident so far, and whether a regular has told the roundabout's trick. */
  visits?: Record<string, number>;
  rotaryHintGiven?: boolean;
};

/**
 * Bump the version only if the saved format changes in a way old saves can't be read.
 * SCREAM-205 (engineering's call): v2 when Story moved to the tutorial map and 5 days; a v1 run
 * (3 days on Worcester) isn't offered to continue.
 */
const STORAGE_KEY = 'icemachine.story.v2';

const FLAVOUR_IDS = new Set<string>(FLAVOURS.map((f) => f.id));

function isSlot(s: unknown): s is CoolerSlot {
  if (typeof s !== 'object' || s === null) return false;
  const slot = s as Record<string, unknown>;
  return (
    typeof slot.flavour === 'string' &&
    FLAVOUR_IDS.has(slot.flavour as FlavourId) &&
    Number.isInteger(slot.quantity) &&
    (slot.quantity as number) >= 0 &&
    Number.isInteger(slot.priceCents)
  );
}

/** The saved run, or null if there isn't one (or it can't be read: storage blocked, or a damaged save). */
export function loadStory(): StorySave | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!Number.isInteger(data.day) || (data.day as number) < 1) return null;
    if (!Number.isInteger(data.cashCents)) return null;
    if (!Array.isArray(data.slots) || !data.slots.every(isSlot)) return null;
    const t = (data.totals ?? {}) as Record<string, unknown>;
    const cents = (v: unknown) => (Number.isInteger(v) ? (v as number) : 0);
    return {
      day: data.day as number,
      cashCents: data.cashCents as number,
      slots: data.slots.map((s) => ({ ...s })),
      cells: Array.isArray(data.cells)
        ? data.cells.map((c) => (typeof c === 'string' && FLAVOUR_IDS.has(c) ? (c as FlavourId) : null))
        : undefined,
      fuel: typeof data.fuel === 'number' && data.fuel >= 0 && data.fuel <= 1 ? data.fuel : FUEL_STORY_START,
      seed: Number.isInteger(data.seed) ? (data.seed as number) : undefined,
      visits:
        typeof data.visits === 'object' && data.visits !== null
          ? Object.fromEntries(Object.entries(data.visits as Record<string, unknown>).filter(([, v]) => Number.isInteger(v) && (v as number) > 0) as [string, number][])
          : undefined,
      rotaryHintGiven: data.rotaryHintGiven === true,
      totals: {
        salesCents: cents(t.salesCents),
        tipsCents: cents(t.tipsCents),
        stockCents: cents(t.stockCents),
        gasCents: cents(t.gasCents),
        damageCents: cents(t.damageCents),
        largestSaleCents: cents(t.largestSaleCents),
      },
    };
  } catch {
    return null;
  }
}

export function saveStory(save: StorySave): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable: the run just isn't kept.
  }
}

export function clearStorySave(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
