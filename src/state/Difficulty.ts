// Near-term build from playtest feedback (PO, October 29): two difficulties,
// picked on the title screen and only changeable there.
//   easy: the original driving. The arrows point the truck that way (up,
//         down, left, right), it stops when you let go.
//   hard: car-style driving (#32): gas, brake and reverse, steer at any angle.
// The last pick is remembered in this browser; a first-time player starts on easy.

export type Difficulty = 'easy' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'hard'];

const STORAGE_KEY = 'icemachine.difficulty';

export function loadDifficulty(): Difficulty {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'hard' || saved === 'easy' ? saved : 'easy';
  } catch {
    return 'easy';
  }
}

export function saveDifficulty(difficulty: Difficulty): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, difficulty);
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}
