// Issue #16: the pinball-style high score table. Decision 004: scores are
// kept on this computer only (in the browser), a top 5 for now (PO, October
// 29), and the table starts fresh with every new build of the game.
// Negative evenings count too, if they make the top 5.

export const HIGH_SCORE_COUNT = 5;

export type HighScore = {
  initials: string;
  /** Tonight's profit, in cents. */
  scoreCents: number;
  /** When it was set (ISO date). */
  date: string;
};

const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
const STORAGE_KEY = `icemachine.highscores.${BUILD}`;

/** Reads the table. Storage can be missing or blocked (private windows), so failures give an empty table. */
export function loadHighScores(): HighScore[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is HighScore =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as HighScore).initials === 'string' &&
          typeof (s as HighScore).scoreCents === 'number' &&
          typeof (s as HighScore).date === 'string',
      )
      .slice(0, HIGH_SCORE_COUNT);
  } catch {
    return [];
  }
}

function saveHighScores(scores: HighScore[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Storage unavailable: the score just isn't kept.
  }
}

/** True if this score would make the table: fewer than 5 scores so far, or better than the lowest. */
export function isHighScore(scoreCents: number, scores: readonly HighScore[] = loadHighScores()): boolean {
  if (scores.length < HIGH_SCORE_COUNT) return true;
  const lowest = scores[scores.length - 1];
  return lowest !== undefined && scoreCents > lowest.scoreCents;
}

/**
 * Adds a score and saves the table. Highest first; a tie goes below the
 * older score. Returns the new table and where the new score landed (or -1).
 */
export function addHighScore(initials: string, scoreCents: number, date = new Date()): { scores: HighScore[]; rank: number } {
  const entry: HighScore = { initials: initials.toUpperCase().slice(0, 3), scoreCents, date: date.toISOString() };
  const scores = loadHighScores();
  let at = scores.findIndex((s) => scoreCents > s.scoreCents);
  if (at === -1) at = scores.length;
  scores.splice(at, 0, entry);
  const kept = scores.slice(0, HIGH_SCORE_COUNT);
  saveHighScores(kept);
  return { scores: kept, rank: at < HIGH_SCORE_COUNT ? at : -1 };
}
