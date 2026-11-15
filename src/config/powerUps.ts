// SCREAM-267: what is pinned to the cork board. For now a DUMMY skill map (PO, November 12:
// "For now lets just add a dummy skill map. As we add more powerups, the actual skill trees
// will take shape."): three trees with the PO's names, and notes that only mark a place. Each
// power-up ticket replaces a dummy note with a real one (name, price, what it does).
// SCREAM-296: the dummies can be bought (and do nothing), so buying and saving can be tested.

import { FLAVOURS, getFlavour, type FlavourId } from './flavours';
import { TRAIN_PRICE_CENTS, BRAKES_PRICE_CENTS, CALCULATOR_PRICE_CENTS, GITTY_UP_PRICE_CENTS, ICE_CREAM_UNLOCK_CENTS, ICE_CREAM_UNLOCK_PRICES, REFUSE_ABOVE_CENTS, SMILE_PRICE_CENTS, SPEAKER_PRICE_CENTS, STORY_FIRST_FLAVOUR, STORY_REFUSE_ABOVE_CENTS, TROT_PRICE_CENTS } from './tuning';

// SCREAM-271 (PO, November 13: "I reworked the skill map so its only the three, truck, ice cream
// and customer"): Speaker is part of Truck now, and Sales became Customer.
export type PowerUpTreeId = 'truck' | 'icecream' | 'customer';

/** The picture on a note: its tree's placeholder, or a power-up's own. */
export type PowerUpLogo = PowerUpTreeId | 'speaker' | 'gas-can' | 'gitty-up' | 'trot' | 'tip-jar' | 'calculator' | 'brake-disc' | 'train-off-tracks' | 'question' | FlavourId;

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

/** SCREAM-310: the Trot note (the truck creeps faster with no key held). */
export const TROT_ID = 'trot';

/** SCREAM-81: the Upgrade Speaker note (the music reaches 10% further). */
export const SPEAKER_ID = 'upgrade-speaker';

/** SCREAM-317: the Calculator note (+ − × ÷ = on the window's price pad). */
export const CALCULATOR_ID = 'calculator';

/** SCREAM-80: the Train Off The Tracks note (Truck tree, third row). */
export const TRAIN_ID = 'train-off-the-tracks';

/** SCREAM-325: the Brakes Made This Century note (Truck tree, third row). */
export const BRAKES_ID = 'brakes-made-this-century';

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
/** SCREAM-135: what an ice cream does besides selling, told on its note (Story only). */
const ICE_CREAM_EFFECTS: Partial<Record<FlavourId, string>> = {
  eclair: 'If you have these stocked in your cooler, every customer will buy an extra ice cream.', // SCREAM-315; the PO's words
  spongepop: 'Kids who order one tip 10% more.', // SCREAM-313; engineering's wording
  explorer: 'The further from home, the bigger the tip.', // SCREAM-312; the PO's words (November 14)
};

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
    priceCents: first ? 0 : ICE_CREAM_UNLOCK_PRICES[flavour] ?? ICE_CREAM_UNLOCK_CENTS,
    name: f.name.toUpperCase(),
    // PO, November 14: "Lets remove the line 'Stock it and customers order it.'"
    description: [first ? 'Owned from the start.' : '', ICE_CREAM_EFFECTS[flavour], limit].filter(Boolean).join(' '),
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
      // SCREAM-310 (PO, November 14): the right note under the gas can.
      {
        id: TROT_ID,
        col: 2,
        row: 1,
        from: [GAS_CAN_ID],
        priceCents: TROT_PRICE_CENTS,
        name: 'TROT',
        description: 'Increase the speed of the truck as it rolls without any gas pedal pushed.',
        logo: 'trot',
      },
      // SCREAM-80 (PO, November 14, notepad sketch): the Truck tree's third row.
      {
        id: TRAIN_ID,
        col: 0,
        row: 2,
        from: [GITTY_UP_ID],
        priceCents: TRAIN_PRICE_CENTS,
        name: 'TRAIN OFF THE TRACKS',
        description: 'Max velocity increased by 5%.',
        logo: 'train-off-tracks',
      },
      // SCREAM-325 (PO, November 14, notepad sketch): the Truck tree's third row.
      {
        id: BRAKES_ID,
        col: 1,
        row: 2,
        from: [GITTY_UP_ID, TROT_ID],
        priceCents: BRAKES_PRICE_CENTS,
        name: 'BRAKES MADE THIS CENTURY',
        description: 'Brakes are better. 10% increase.',
        logo: 'brake-disc',
      },
      { id: 'truck-6', col: 2, row: 2, from: [TROT_ID], priceCents: 1500 },
      { id: 'truck-7', col: 1, row: 3, from: [BRAKES_ID], priceCents: 2000 },
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
      // SCREAM-81 (PO, November 14): the left note under Service With A Smile.
      {
        id: SPEAKER_ID,
        col: 0,
        row: 1,
        from: [SMILE_ID],
        priceCents: SPEAKER_PRICE_CENTS,
        name: 'UPGRADE SPEAKER',
        description: 'Increase the reach of the speaker by 10%.',
        logo: 'speaker',
      },
      // SCREAM-317 (PO, November 14): the right note under Service With A Smile.
      {
        id: CALCULATOR_ID,
        col: 2,
        row: 1,
        from: [SMILE_ID],
        priceCents: CALCULATOR_PRICE_CENTS,
        name: 'CALCULATOR',
        description: 'Get a calculator to use at the sales window.',
        logo: 'calculator',
      },
      { id: 'customer-4', col: 1, row: 2, from: [SPEAKER_ID, CALCULATOR_ID], priceCents: 1500 },
      { id: 'customer-5', col: 1, row: 3, from: ['customer-4'], priceCents: 2000 },
      { id: 'customer-6', col: 0, row: 4, from: ['customer-5'], priceCents: 2500 },
      { id: 'customer-7', col: 1, row: 4, from: ['customer-5'], priceCents: 2500 },
      { id: 'customer-8', col: 2, row: 4, from: ['customer-5'], priceCents: 2500 },
    ],
  },
];

/** SCREAM-271: the notes owned from the start of every Story run. */
export const FREE_NOTE_IDS: string[] = POWER_UP_TREES.flatMap((t) => t.notes.filter((n) => n.free).map((n) => n.id));
