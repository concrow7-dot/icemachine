// SCREAM-267: what is pinned to the cork board. For now a DUMMY skill map (PO, November 12:
// "For now lets just add a dummy skill map. As we add more powerups, the actual skill trees
// will take shape."): three trees with the PO's names, and notes that only mark a place. Each
// power-up ticket replaces a dummy note with a real one (name, price, what it does).

export type PowerUpTreeId = 'truck' | 'speaker' | 'sales';

export type PowerUpNote = {
  id: string;
  /** Column in its tree: 0 left, 1 middle, 2 right. */
  col: 0 | 1 | 2;
  /** Row in its tree, 0 at the top. */
  row: number;
  /** The notes above that this one hangs from (a string joins them). */
  from: string[];
};

export type PowerUpTree = {
  id: PowerUpTreeId;
  /** The label pinned over the tree. */
  name: string;
  /** The colour of the tree's string and pins. */
  string: number;
  /** The colour of its paper notes. */
  paper: number;
  notes: PowerUpNote[];
};

/** What a dummy note says when it is picked (doc 15). */
export const DUMMY_NOTE_STATUS = 'Not for sale yet';
export const DUMMY_NOTE_TEXT = 'Power-ups will be pinned here as they are built.';

// Left to right on the board.
export const POWER_UP_TREES: PowerUpTree[] = [
  {
    id: 'truck',
    name: 'TRUCK',
    string: 0xd9622b,
    paper: 0xfff2a8,
    notes: [
      { id: 'truck-1', col: 1, row: 0, from: [] },
      { id: 'truck-2', col: 0, row: 1, from: ['truck-1'] },
      { id: 'truck-3', col: 2, row: 1, from: ['truck-1'] },
      { id: 'truck-4', col: 0, row: 2, from: ['truck-2'] },
      { id: 'truck-5', col: 1, row: 2, from: ['truck-2', 'truck-3'] },
      { id: 'truck-6', col: 2, row: 2, from: ['truck-3'] },
      { id: 'truck-7', col: 1, row: 3, from: ['truck-5'] },
      { id: 'truck-8', col: 0, row: 4, from: ['truck-7'] },
      { id: 'truck-9', col: 2, row: 4, from: ['truck-7'] },
    ],
  },
  {
    id: 'speaker',
    name: 'SPEAKER',
    string: 0x2f9e44,
    paper: 0xc9efc0,
    notes: [
      { id: 'speaker-1', col: 1, row: 0, from: [] },
      { id: 'speaker-2', col: 1, row: 1, from: ['speaker-1'] },
      { id: 'speaker-3', col: 0, row: 2, from: ['speaker-2'] },
      { id: 'speaker-4', col: 2, row: 2, from: ['speaker-2'] },
      { id: 'speaker-5', col: 0, row: 3, from: ['speaker-3'] },
      { id: 'speaker-6', col: 2, row: 3, from: ['speaker-4'] },
      { id: 'speaker-7', col: 1, row: 4, from: ['speaker-5', 'speaker-6'] },
    ],
  },
  {
    id: 'sales',
    name: 'SALES',
    string: 0xb23aa8,
    paper: 0xf6cdea,
    notes: [
      { id: 'sales-1', col: 0, row: 0, from: [] },
      { id: 'sales-2', col: 2, row: 0, from: [] },
      { id: 'sales-3', col: 0, row: 1, from: ['sales-1'] },
      { id: 'sales-4', col: 2, row: 1, from: ['sales-2'] },
      { id: 'sales-5', col: 1, row: 2, from: ['sales-3', 'sales-4'] },
      { id: 'sales-6', col: 1, row: 3, from: ['sales-5'] },
      { id: 'sales-7', col: 0, row: 4, from: ['sales-6'] },
      { id: 'sales-8', col: 1, row: 4, from: ['sales-6'] },
      { id: 'sales-9', col: 2, row: 4, from: ['sales-6'] },
    ],
  },
];
