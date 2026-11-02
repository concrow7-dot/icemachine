// SCREAM-93 (PO, November 2): the largest sale: the most paid for one order at the
// window, price plus tip. Shown for tonight (or a Story run) with the all-time record
// beside it. Quick play and Story keep their own records, as they keep their own high
// scores. Kept in the browser like the high scores (decision 004).

import type { ScoreTable } from './HighScores';

const STORAGE_KEY = 'icemachine.records.v1';

type SaleRecord = { largestSaleCents: number; date: string };
type Stored = Partial<Record<ScoreTable, SaleRecord>>;

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

/** The record for a mode, in cents (0 if there isn't one yet). */
export function largestSaleRecord(table: ScoreTable): number {
  const r = load()[table];
  return r && Number.isInteger(r.largestSaleCents) && r.largestSaleCents > 0 ? r.largestSaleCents : 0;
}

/**
 * Offers a largest sale to the record. Saves it if it beats the record (a tie doesn't).
 * Returns the record before this sale and whether this one is the new record.
 */
export function offerLargestSale(table: ScoreTable, cents: number, date = new Date()): { before: number; isNew: boolean } {
  const before = largestSaleRecord(table);
  const isNew = cents > before;
  if (isNew) {
    const all = load();
    all[table] = { largestSaleCents: cents, date: date.toISOString() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Storage unavailable: the record just isn't kept.
    }
  }
  return { before, isNew };
}

/** The line shown under a breakdown: this sale, and either NEW RECORD or the record to beat. */
export function largestSaleLine(cents: number, record: { before: number; isNew: boolean }, formatMoney: (c: number) => string): string {
  if (cents <= 0) return 'Largest sale: none yet';
  if (record.isNew) return `Largest sale: ${formatMoney(cents)}  NEW RECORD!`;
  return `Largest sale: ${formatMoney(cents)}  (record ${formatMoney(record.before)})`;
}
