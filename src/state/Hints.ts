import type { Resident } from './Residents';

/**
 * SCREAM-103 (PO, November 8): what a customer says when they point the player to a big
 * regular. The lines are in the "Hint lines" tab of sheet 23 (src/config/hintLines.ts).
 */
export interface HintLine {
  id: string;
  /** Average, funny, dark or absurd (lower case). */
  tone: 'average' | 'funny' | 'dark' | 'absurd';
  /** Which regulars the line suits: anyone, adults only, or kids only. */
  who: 'any' | 'adult' | 'kid';
  /** The line, with [Name] and [Street]. */
  text: string;
}

/** The line with the regular's name and street put in. */
export function fillHint(text: string, resident: Pick<Resident, 'name' | 'street'>): string {
  return text.split('[Name]').join(resident.name.trim()).split('[Street]').join(resident.street);
}

/** A small seeded random number generator (mulberry32): the same seed gives the same numbers. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * PO, November 8: a regular is never hinted at in two different ways in the same story. So
 * each hinted regular gets one line for the whole run, picked from the run's seed (the same
 * every day of a Story run), and no two regulars share a line. Returns resident id → the
 * finished line. Regulars left without a fitting line get none.
 */
export function assignHints(residents: readonly Resident[], lines: readonly HintLine[], seed: number): Map<string, string> {
  const rnd = seeded(seed);
  const used = new Set<string>();
  const out = new Map<string, string>();
  const hinted = residents.filter((r) => r.hinted).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const r of hinted) {
    const fits = lines.filter((l) => !used.has(l.id) && (l.who === 'any' || (l.who === 'kid') === r.kid));
    if (fits.length === 0) continue;
    const line = fits[Math.floor(rnd() * fits.length)];
    used.add(line.id);
    out.set(r.id, fillHint(line.text, r));
  }
  return out;
}
