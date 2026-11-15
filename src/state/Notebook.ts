// SCREAM-245 (PO, November 10 and 14): the Handy Notebook. "Hints given by customers are written
// down." No Phaser here, so it can be unit-tested.

/** One thing a customer said at the window: the Story day, who said it, and their words. */
export type NotebookEntry = { day: number; who: string; text: string };

/** Never more than this many entries are kept (the oldest go first). A run is 10 evenings of a few hints each. */
export const NOTEBOOK_MAX_ENTRIES = 200;

/**
 * Writes an entry at the end (the newest). The same words from the same person are not written
 * twice (engineering's proposal). Returns whether anything was written.
 */
export function addNotebookEntry(entries: NotebookEntry[], entry: NotebookEntry): boolean {
  const text = entry.text.trim();
  if (!text) return false;
  if (entries.some((e) => e.who === entry.who && e.text === text)) return false;
  entries.push({ day: entry.day, who: entry.who, text });
  if (entries.length > NOTEBOOK_MAX_ENTRIES) entries.splice(0, entries.length - NOTEBOOK_MAX_ENTRIES);
  return true;
}

/** The pages to read, newest entry first. Always at least one page (empty when nothing is written yet). */
export function notebookPages(entries: readonly NotebookEntry[], perPage: number): NotebookEntry[][] {
  const newestFirst = [...entries].reverse();
  const pages: NotebookEntry[][] = [];
  for (let i = 0; i < newestFirst.length; i += perPage) pages.push(newestFirst.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

/** Reads the notebook out of a Story save: anything that isn't an entry is left out. */
export function readNotebook(data: unknown): NotebookEntry[] {
  if (!Array.isArray(data)) return [];
  const entries: NotebookEntry[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    const { day, who, text } = item as Record<string, unknown>;
    if (Number.isInteger(day) && (day as number) >= 1 && typeof who === 'string' && typeof text === 'string' && text.trim()) {
      entries.push({ day: day as number, who, text: text.trim() });
    }
  }
  return entries.slice(-NOTEBOOK_MAX_ENTRIES);
}
