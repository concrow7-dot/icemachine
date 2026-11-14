// SCREAM-267: what is pinned to the cork board. For now a DUMMY skill map (PO, November 12:
// "For now lets just add a dummy skill map. As we add more powerups, the actual skill trees
// will take shape."): three trees with the PO's names, and notes that only mark a place. Each
// power-up ticket replaces a dummy note with a real one (name, price, what it does).
// SCREAM-296: the dummies can be bought (and do nothing), so buying and saving can be tested.

import { FLAVOURS, getFlavour, type FlavourId } from './flavours';
import { GITTY_UP_PRICE_CENTS, ICE_CREAM_UNLOCK_CENTS, REFUSE_ABOVE_CENTS, SMILE_PRICE_CENTS, STORY_FIRST_FLAVOUR, STORY_REFUSE_ABOVE_CENTS } from './tuning';

// SCREAM-271 (PO, November 13: "I reworked the skill map so its only the three, truck, ice cream
// and customer"): Speaker is part of Truck now, and Sales became Customer.
export type PowerUpTreeId = 'truck' | 'icecream' | 'customer';

/** The picture on a note: its tree's placeholder, or a power-up's own. */
export type PowerUpLogo = PowerUpTreeId | 'speaker' | 'gas-can' | 'gitty-up' | 'tip-jar' | 'question' | FlavourId;

export type PowerUpNote = {
  id: string;
  /** Column in its tree: 0 left, 1 middle, 2 right. */
  col: 0 | 1 | 2;
  /** Row in its tree, 0 at the top. */
  row: number;
  /** The notes above that this one hangs from (a string joins them). Owning any one of them unlocks it. */
  from: string[];
  /** What it costs, from the Story cash (decision 073). */
  priceCents: number;
  /** A real power-up's name, description and picture. A dummy note has none: it is called by its tree and number. */
  name?: string;
  description?: string;
  logo?: PowerUpLogo;
  /** SCREAM-271: the ice cream this note unlocks in Story. */
  flavour?: FlavourId;
  /** SCREAM-271: owned from the start of every run (the Chocolate Eclair): never bought, never saved. */
  free?: boolean;
};

/** SCREAM-303: the Service With A Smile note (tips start at 25% and the countdown is 10 seconds longer). */
export const SMILE_ID = 'service-with-a-smile';

/** SCREAM-309: the Gitty Up note (the truck speeds up 10% faster). */
export const GITTY_UP_ID = 'gitty-up';

/** SCREAM-122: the Temporary Gas Can's note. */
export const GAS_CAN_ID = 'temp-gas-can';

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

/** SCREAM-296: what a dummy note says when it is opened (doc 15). Dummy prices too: $5 a row. */
export const DUMMY_NOTE_TEXT = 'A dummy power-up. It does nothing yet.';

/** SCREAM-271: the id of the note that unlocks an ice cream. */
export function iceCreamNoteId(flavour: FlavourId): string {
  return `icecream-${flavour}`;
}

/** SCREAM-271: the most a customer pays for one of these in Story before leaving it out of the order. */
export function storyRefuseAboveCents(flavour: FlavourId): number {
  return STORY_REFUSE_ABOVE_CENTS[flavour] ?? REFUSE_ABOVE_CENTS;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * SCREAM-271 (PO, November 13): the ice creams are power-ups. His sketch ("Power-up trees",
 * Personal Notes): top down, Chocolate Eclair (yours from the start), SpongePop, Explorer,
 * the sandwich, then a split into ice creams not decided yet ("just make them ? for now").
 * The sketch's last two shapes (a circle, then a box) wait for a taller board: it has 5 rows.
 */
function iceCreamNote(flavour: FlavourId, row: number): PowerUpNote {
  const f = getFlavour(flavour);
  const first = flavour === STORY_FIRST_FLAVOUR;
  const before = FLAVOURS[FLAVOURS.findIndex((x) => x.id === flavour) - 1];
  const limit = `The average person won't pay more than ${dollars(storyRefuseAboveCents(flavour))} for one.`;
  return {
    id: iceCreamNoteId(flavour),
    col: 1,
    row,
    from: first || !before ? [] : [iceCreamNoteId(before.id)],
    priceCents: first ? 0 : ICE_CREAM_UNLOCK_CENTS,
    name: f.name.toUpperCase(),
    description: first ? `Yours from the start. ${limit}` : `Stock it and customers order it. ${limit}`,
    logo: flavour,
    flavour,
    free: first,
  };
}

// Left to right on the board.
export const POWER_UP_TREES: PowerUpTree[] = [
  {
    id: 'truck',
    name: 'TRUCK',
    string: 0xd9622b,
    paper: 0xfff2a8,
    notes: [
      // SCREAM-122 (PO, November 13): the first real power-up. $15, bought once; the can is full again every day.
      {
        id: GAS_CAN_ID,
        col: 1,
        row: 0,
        from: [],
        priceCents: 1500,
        name: 'TEMPORARY GAS CAN',
        description: 'Run out of gas and it pours itself in: a fifth of a tank. Full again every day.',
        logo: 'gas-can',
      },
      // SCREAM-309 (PO, November 14): the left note under the gas can.
      {
        id: GITTY_UP_ID,
        col: 0,
        row: 1,
        from: [GAS_CAN_ID],
        priceCents: GITTY_UP_PRICE_CENTS,
        name: 'GITTY UP',
        description: "Increase acceleration by 10%. The truck still is heavy, so don't expect much.",
        logo: 'gitty-up',
      },
      { id: 'truck-3', col: 2, row: 1, from: [GAS_CAN_ID], priceCents: 1000 },
      { id: 'truck-4', col: 0, row: 2, from: [GITTY_UP_ID], priceCents: 1500 },
      { id: 'truck-5', col: 1, row: 2, from: [GITTY_UP_ID, 'truck-3'], priceCents: 1500 },
      { id: 'truck-6', col: 2, row: 2, from: ['truck-3'], priceCents: 1500 },
      { id: 'truck-7', col: 1, row: 3, from: ['truck-5'], priceCents: 2000 },
      { id: 'truck-8', col: 0, row: 4, from: ['truck-7'], priceCents: 2500 },
      { id: 'truck-9', col: 2, row: 4, from: ['truck-7'], priceCents: 2500 },
    ],
  },
  {
    id: 'icecream',
    name: 'ICE CREAM',
    string: 0x2884d6,
    paper: 0xcfe6fb,
    notes: [
      ...FLAVOURS.map((f, row) => iceCreamNote(f.id, row)),
      { id: 'icecream-5', col: 0, row: FLAVOURS.length, from: [iceCreamNoteId(FLAVOURS[FLAVOURS.length - 1].id)], priceCents: ICE_CREAM_UNLOCK_CENTS, logo: 'question' },
      { id: 'icecream-6', col: 2, row: FLAVOURS.length, from: [iceCreamNoteId(FLAVOURS[FLAVOURS.length - 1].id)], priceCents: ICE_CREAM_UNLOCK_CENTS, logo: 'question' },
    ],
  },
  {
    id: 'customer',
    name: 'CUSTOMER',
    string: 0xb23aa8,
    paper: 0xf6cdea,
    notes: [
      // SCREAM-303 (PO, November 14): the second real power-up, the Customer tree's top item.
      {
        id: SMILE_ID,
        col: 1,
        row: 0,
        from: [],
        priceCents: SMILE_PRICE_CENTS,
        name: 'SERVICE WITH A SMILE',
        description: 'Tips start at 25%, not 20%, and you get 10 more seconds to earn one.',
        logo: 'tip-jar',
      },
      // SCREAM-303 (PO, November 14): "service with a smile is the only first option under the customer tree".
      { id: 'customer-2', col: 0, row: 1, from: [SMILE_ID], priceCents: 1000 },
      { id: 'customer-3', col: 2, row: 1, from: [SMILE_ID], priceCents: 1000 },
      { id: 'customer-4', col: 1, row: 2, from: ['customer-2', 'customer-3'], priceCents: 1500 },
      { id: 'customer-5', col: 1, row: 3, from: ['customer-4'], priceCents: 2000 },
      { id: 'customer-6', col: 0, row: 4, from: ['customer-5'], priceCents: 2500 },
      { id: 'customer-7', col: 1, row: 4, from: ['customer-5'], priceCents: 2500 },
      { id: 'customer-8', col: 2, row: 4, from: ['customer-5'], priceCents: 2500 },
    ],
  },
];

/** SCREAM-271: the notes owned from the start of every Story run. */
export const FREE_NOTE_IDS: string[] = POWER_UP_TREES.flatMap((t) => t.notes.filter((n) => n.free).map((n) => n.id));
