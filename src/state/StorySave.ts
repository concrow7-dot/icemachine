import { FLAVOURS, type FlavourId } from '../config/flavours';
import type { CoolerSlot } from './EveningState';
import type { RunTotals } from './StoryRun';

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
  /** SCREAM-18: the run's takings so far. */
  totals: RunTotals;
};

/** Bump the version only if the saved format changes in a way old saves can't be read. */
const STORAGE_KEY = 'icemachine.story.v1';

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
      totals: { salesCents: cents(t.salesCents), tipsCents: cents(t.tipsCents), stockCents: cents(t.stockCents), damageCents: cents(t.damageCents) },
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
