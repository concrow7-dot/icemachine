import type { PowerUpTree } from '../config/powerUps';

// SCREAM-267: where the cork board's notes sit and how the arrow keys move between them.
// No Phaser here, so it can be unit-tested.

/** The board on the 960 x 540 screen: each tree's middle, and the notes' spacing. */
export const BOARD_LAYOUT = {
  treeX: [170, 480, 790],
  firstRowY: 136,
  rowGap: 60,
  colGap: 84,
  note: 46,
};

export type PlacedNote = {
  id: string;
  /** Its tree's place in the list (0 is the leftmost). */
  tree: number;
  /** Its number within the tree, from 1 (shown to the player: "TRUCK 3"). */
  number: number;
  x: number;
  y: number;
  from: string[];
};

/** Every note of every tree with its place on the screen. */
export function placeNotes(trees: PowerUpTree[]): PlacedNote[] {
  const placed: PlacedNote[] = [];
  trees.forEach((tree, t) => {
    tree.notes.forEach((note, n) => {
      placed.push({
        id: note.id,
        tree: t,
        number: n + 1,
        x: BOARD_LAYOUT.treeX[t] + (note.col - 1) * BOARD_LAYOUT.colGap,
        y: BOARD_LAYOUT.firstRowY + note.row * BOARD_LAYOUT.rowGap,
        from: note.from,
      });
    });
  });
  return placed;
}

export type BoardDirection = 'left' | 'right' | 'up' | 'down';

/**
 * The note an arrow key moves to: the nearest one that way, counting a step sideways off the
 * arrow's line as twice as far. Trees are crossed like any other gap. With nothing that way,
 * the highlight stays where it is.
 */
export function nextNote(notes: PlacedNote[], fromId: string, direction: BoardDirection): string {
  const from = notes.find((n) => n.id === fromId);
  if (!from) return notes[0]?.id ?? fromId;
  let best = fromId;
  let bestScore = Infinity;
  for (const note of notes) {
    if (note.id === fromId) continue;
    const dx = note.x - from.x;
    const dy = note.y - from.y;
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 1) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = note.id;
    }
  }
  return best;
}
