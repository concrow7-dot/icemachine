// SCREAM-267: what is pinned to the cork board. For now a DUMMY skill map (PO, November 12:
// "For now lets just add a dummy skill map. As we add more powerups, the actual skill trees
// will take shape."): three trees with the PO's names, and notes that only mark a place. Each
// power-up ticket replaces a dummy note with a real one (name, price, what it does).
// SCREAM-296: the dummies can be bought (and do nothing), so buying and saving can be tested.

import { getFlavour, type FlavourId } from './flavours';
import { BACK_IT_UP_PRICE_CENTS, SPEEDY_PRICE_CENTS, MIRRORS_PRICE_CENTS, MORE_JUNK_PRICE_CENTS, BASS_PRICE_CENTS, REGISTER_PRICE_CENTS, NOTEBOOK_PRICE_CENTS, TRAIN_PRICE_CENTS, BRAKES_PRICE_CENTS, STEAM_PRICE_CENTS, CALCULATOR_PRICE_CENTS, GITTY_UP_PRICE_CENTS, ICE_CREAM_UNLOCK_CENTS, ICE_CREAM_UNLOCK_PRICES, REFUSE_ABOVE_CENTS, SMILE_PRICE_CENTS, SPEAKER_PRICE_CENTS, STORY_FIRST_FLAVOUR, STORY_REFUSE_ABOVE_CENTS, TROT_PRICE_CENTS } from './tuning';

// SCREAM-271 (PO, November 13: "I reworked the skill map so its only the three, truck, ice cream
// and customer"): Speaker is part of Truck now, and Sales became Customer.
export type PowerUpTreeId = 'truck' | 'icecream' | 'customer';

/** The picture on a note: its tree's placeholder, or a power-up's own. */
export type PowerUpLogo = PowerUpTreeId | 'speaker' | 'bass-guitar' | 'notepad' | 'tablet' | 'gas-can' | 'gitty-up' | 'trot' | 'tip-jar' | 'calculator' | 'steam-engine' | 'back-it-up' | 'more-junk' | 'mirror' | 'sneaker' | 'brake-disc' | 'train-off-tracks' | 'question' | FlavourId;

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
  /** SCREAM-352: the description's paragraphs; the opened note shows them with an empty line between. */
  paragraphs?: string[];
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

/** SCREAM-329: the Speaker with Heavier Bass note (Customer tree, third row): some-days customers come out more often. */
export const BASS_ID = 'heavier-bass';

/** SCREAM-245: the Handy Notebook note (Customer tree, third row): hints given by customers are written down. */
export const NOTEBOOK_ID = 'handy-notebook';

/** SCREAM-330: the This Century Register note (Customer tree, third row): click the ice creams and the price adds up. */
export const REGISTER_ID = 'this-century-register';

/** SCREAM-317: the Calculator note (+ − × ÷ = on the window's price pad). */
export const CALCULATOR_ID = 'calculator';

/** SCREAM-80: the Train Off The Tracks note (Truck tree, third row). */
export const TRAIN_ID = 'train-off-the-tracks';

/** SCREAM-325: the Brakes Made This Century note (Truck tree, third row). */
export const BRAKES_ID = 'brakes-made-this-century';

/** SCREAM-326: the Steam Engine note (Truck tree, third row). */
export const STEAM_ID = 'steam-engine';

/** SCREAM-340: the Back It Up note (Truck tree, fourth row): the truck reverses faster. */
export const BACK_IT_UP_ID = 'back-it-up';

/** SCREAM-25: the More Space for Scream note (first named More Junk; the id keeps the old name) (Truck tree, fifth row): a bottom row opens in each cooler crate. */
export const MORE_JUNK_ID = 'more-junk';

/** SCREAM-341: the Better Mirrors note (Customer tree, fourth row): markers at the screen edge for customers on their way. */
export const MIRRORS_ID = 'better-mirrors';

/** SCREAM-342: the Speedy Neighbors note (Customer tree, fifth row): most customers run after the truck faster. */
export const SPEEDY_ID = 'speedy-neighbors';

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
 * SCREAM-333 (his sketch of November 14): SpongePop and the Explorer Pop now hang side by side;
 * see ICE_CREAM_PLACES below.
 */
/** SCREAM-135: what an ice cream does besides selling, told on its note (Story only). */
// SCREAM-328 (PO, November 14): no note says exactly how strong it is ("For example, 10% or 5%").
const ICE_CREAM_EFFECTS: Partial<Record<FlavourId, string>> = {
  eclair: 'If you have these stocked in your cooler, every customer will buy an extra ice cream.', // SCREAM-315; the PO's words
  spongepop: 'Kids who order one tip more.', // SCREAM-313; engineering's wording
  explorer: 'The further from home, the bigger the tip.', // SCREAM-312; the PO's words (November 14)
  louball: 'High upside, crazy downside.', // SCREAM-334; the PO's words (his sketch, November 14)
  drumcone: 'Drum solo reaches more of the neighborhood.', // SCREAM-335; the PO's words (his sketch; the cut-off ending confirmed November 15)
};

/**
 * SCREAM-333 (PO's sketch, November 14, "Ice cream tree, third row"): where each ice cream's note
 * hangs. The eclair at the top; SpongePop and the Lil Explorer Pop side by side under it, each on
 * its own string; a third-row note under each; the sandwich in the middle of the fourth row,
 * unlocked by either third-row note.
 */
const ROW_THREE_LEFT_ID = iceCreamNoteId('louball'); // SCREAM-334
const ROW_THREE_RIGHT_ID = iceCreamNoteId('drumcone'); // SCREAM-335
const ICE_CREAM_PLACES: Record<FlavourId, { col: 0 | 1 | 2; row: number; from: string[] }> = {
  eclair: { col: 1, row: 0, from: [] },
  spongepop: { col: 0, row: 1, from: [iceCreamNoteId('eclair')] },
  explorer: { col: 2, row: 1, from: [iceCreamNoteId('eclair')] },
  louball: { col: 0, row: 2, from: [iceCreamNoteId('spongepop')] },
  drumcone: { col: 2, row: 2, from: [iceCreamNoteId('explorer')] },
  cookie: { col: 1, row: 3, from: [ROW_THREE_LEFT_ID, ROW_THREE_RIGHT_ID] },
};

function iceCreamNote(flavour: FlavourId): PowerUpNote {
  const f = getFlavour(flavour);
  const first = flavour === STORY_FIRST_FLAVOUR;
  const place = ICE_CREAM_PLACES[flavour];
  const limit = `The average person won't pay more than ${dollars(storyRefuseAboveCents(flavour))} for one.`;
  // SCREAM-352 (PO, November 15): "I want to add the cost of buying each ice cream to the powerup card."
  const cost = `Costs you ${dollars(f.costCents)} each to stock.`;
  // PO, November 14: "Lets remove the line 'Stock it and customers order it.'"
  const paragraphs = [first ? 'Owned from the start.' : '', ICE_CREAM_EFFECTS[flavour] ?? '', limit, cost].filter(Boolean);
  return {
    id: iceCreamNoteId(flavour),
    col: place.col,
    row: place.row,
    from: place.from,
    priceCents: first ? 0 : ICE_CREAM_UNLOCK_PRICES[flavour] ?? ICE_CREAM_UNLOCK_CENTS,
    name: f.name.toUpperCase(),
    description: paragraphs.join(' '),
    paragraphs,
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
        description: 'Run out of gas and it pours itself in: a splash to get you going. Full again every day.',
        logo: 'gas-can',
      },
      // SCREAM-25 (PO, November 15, notepad sketches): "Cooler Size - 'More Junk'", then
      // (02:40) "Change \"more Junk\" to \"More Space for Scream\"". It takes the
      // Truck 8 dummy's place (engineering's proposal; the sketch gives no place).
      // SCREAM-364 (PO, November 16): the left note under the gas can now (Gitty Up's old place and price).
      {
        id: MORE_JUNK_ID,
        col: 0,
        row: 1,
        from: [GAS_CAN_ID],
        priceCents: MORE_JUNK_PRICE_CENTS,
        name: 'MORE SPACE FOR SCREAM',
        description: 'More room in the cooler: a new bottom row opens in every crate.',
        logo: 'more-junk',
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
        from: [MORE_JUNK_ID], // SCREAM-364: from the left note under the gas can, now More Space for Scream
        priceCents: TRAIN_PRICE_CENTS,
        name: 'TRAIN OFF THE TRACKS',
        description: 'Max velocity increased.',
        logo: 'train-off-tracks',
      },
      // SCREAM-325 (PO, November 14, notepad sketch): the Truck tree's third row.
      {
        id: BRAKES_ID,
        col: 1,
        row: 2,
        from: [MORE_JUNK_ID, TROT_ID], // SCREAM-364
        priceCents: BRAKES_PRICE_CENTS,
        name: 'BRAKES MADE THIS CENTURY',
        description: 'Brakes are better.',
        logo: 'brake-disc',
      },
      // SCREAM-326 (PO, November 14, notepad sketch): the Truck tree's third row.
      {
        id: STEAM_ID,
        col: 2,
        row: 2,
        from: [TROT_ID],
        priceCents: STEAM_PRICE_CENTS,
        name: 'STEAM ENGINE',
        description: 'Increase the speed of the truck as it rolls.',
        logo: 'steam-engine',
      },
      // SCREAM-340 (PO, November 15, notepad sketches): "Reverse Speed - 'Back it up'". It takes the
      // Truck 7 dummy's place (engineering's proposal; the sketch gives no place).
      {
        // PO, November 15 (03:28): "From brakes made this century and handy notebook, two powerups should
        // come out. It should be both of the powerups just added": left and right under Brakes.
        id: BACK_IT_UP_ID,
        col: 0,
        row: 3,
        from: [BRAKES_ID],
        priceCents: BACK_IT_UP_PRICE_CENTS,
        name: 'BACK IT UP',
        description: 'Increase the speed of the truck in reverse.',
        logo: 'back-it-up',
      },
      // SCREAM-309 (PO, November 14): the left note under the gas can. SCREAM-364 (PO, November 16: "I want
      // to switch "more space for scream" with "gitty up" in both location and price"): under Brakes now.
      {
        id: GITTY_UP_ID,
        col: 2,
        row: 3,
        from: [BRAKES_ID],
        priceCents: GITTY_UP_PRICE_CENTS,
        name: 'GITTY UP',
        description: "Increase acceleration. The truck still is heavy, so don't expect much.",
        logo: 'gitty-up',
      },
      // The last dummy hangs in the middle of the fifth row, from either of the two above (engineering's call).
      { id: 'truck-9', col: 1, row: 4, from: [BACK_IT_UP_ID, GITTY_UP_ID], priceCents: 2500 }, // SCREAM-364
    ],
  },
  {
    id: 'icecream',
    name: 'ICE CREAM',
    string: 0x2884d6,
    paper: 0xcfe6fb,
    notes: [
      iceCreamNote('eclair'),
      iceCreamNote('spongepop'),
      iceCreamNote('explorer'),
      iceCreamNote('louball'), // SCREAM-334: the third row, left
      iceCreamNote('drumcone'), // SCREAM-335: the third row, right
      iceCreamNote('cookie'),
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
        description: 'Tips start higher, and you get more time to earn one.',
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
        description: 'Increase the reach of the speaker.',
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
      // SCREAM-329 (PO, November 14, notepad sketch "Customer power-ups, third row"): note 1, under the speaker.
      {
        id: BASS_ID,
        col: 0,
        row: 2,
        from: [SPEAKER_ID],
        priceCents: BASS_PRICE_CENTS,
        name: 'SPEAKER WITH HEAVIER BASS',
        description: 'More likely to get customers in their home.',
        logo: 'bass-guitar',
      },
      // SCREAM-245 (PO, November 14, the same sketch): note 2, in the middle, joined to the speaker and the calculator.
      // His answer: "$40, need either".
      {
        id: NOTEBOOK_ID,
        col: 1,
        row: 2,
        from: [SPEAKER_ID, CALCULATOR_ID],
        priceCents: NOTEBOOK_PRICE_CENTS,
        name: 'HANDY NOTEBOOK',
        description: 'Hints given by customers are written down.',
        logo: 'notepad',
      },
      // SCREAM-330 (PO, November 14, the same sketch): note 3, under the calculator.
      {
        id: REGISTER_ID,
        col: 2,
        row: 2,
        from: [CALCULATOR_ID],
        priceCents: REGISTER_PRICE_CENTS,
        name: 'THIS CENTURY REGISTER',
        description: 'Click the icons of the ice cream to calculate price.',
        logo: 'tablet',
      },
      // The rest mirror the Truck tree: dummies until their tickets.
      // SCREAM-341 (PO, November 15, notepad sketches): "Better Mirrors". It takes the Customer 7
      // dummy's place (engineering's proposal; the sketches give no place).
      {
        // PO, November 15 (03:28): both new notes come out of the Handy Notebook, left and right.
        id: MIRRORS_ID,
        col: 0,
        row: 3,
        from: [NOTEBOOK_ID],
        priceCents: MIRRORS_PRICE_CENTS,
        name: 'BETTER MIRRORS',
        description: 'A marker at the edge of the screen points at each customer on their way to you.',
        logo: 'mirror',
      },
      // SCREAM-342 (PO, November 15, notepad sketches): "Customers chasing - Speedy Neighbors". It
      // takes the Customer 8 dummy's place (engineering's proposal; the sketches give no place).
      {
        id: SPEEDY_ID,
        col: 2,
        row: 3,
        from: [NOTEBOOK_ID],
        priceCents: SPEEDY_PRICE_CENTS,
        name: 'SPEEDY NEIGHBORS',
        description: 'Most customers run after the truck faster.',
        logo: 'sneaker',
      },
      { id: 'customer-9', col: 1, row: 4, from: [MIRRORS_ID, SPEEDY_ID], priceCents: 2500 },
    ],
  },
];

/** SCREAM-271: the notes owned from the start of every Story run. */
export const FREE_NOTE_IDS: string[] = POWER_UP_TREES.flatMap((t) => t.notes.filter((n) => n.free).map((n) => n.id));
