// SCREAM-267: what is pinned to the cork board. It began as a dummy skill map of three trees;
// each power-up ticket put a real note in a dummy's place. SCREAM-395: two trees now (see below).

import { getFlavour, stockCostOf, type FlavourId } from './flavours';
import { MORE_JUNK_PRICE_CENTS, BASS_PRICE_CENTS, ICE_CREAM_UNLOCK_CENTS, ICE_CREAM_UNLOCK_PRICES, REFUSE_ABOVE_CENTS, SMILE_PRICE_CENTS, SPEAKER_PRICE_CENTS, STORY_FIRST_FLAVOUR, STORY_REFUSE_ABOVE_CENTS, XP_NOTE_PRICES } from './tuning';

// SCREAM-271 (PO, November 13: "I reworked the skill map so its only the three, truck, ice cream
// and customer"): Speaker is part of Truck now, and Sales became Customer.
// SCREAM-395 (PO, November 17): two trees now, one paid with money and one with XP.
export type PowerUpTreeId = 'money' | 'xp';

/** The picture on a note: its tree's placeholder, or a power-up's own. */
export type PowerUpLogo = 'truck' | 'icecream' | 'customer' | 'speaker' | 'bass-guitar' | 'notepad' | 'tablet' | 'gas-can' | 'gitty-up' | 'trot' | 'tip-jar' | 'calculator' | 'steam-engine' | 'back-it-up' | 'more-junk' | 'mirror' | 'sneaker' | 'brake-disc' | 'train-off-tracks' | 'question' | FlavourId;

export type PowerUpNote = {
  id: string;
  /** Column in its tree, 0 at the left (the tree says how many it has). */
  col: number;
  /** Row in its tree, 0 at the top. */
  row: number;
  /** The notes above that this one hangs from (a string joins them). Owning any one of them unlocks it. */
  from: string[];
  /** What it costs, from the Story cash (decision 073). 0 for a note paid with XP. */
  priceCents: number;
  /** SCREAM-395: what it costs in XP (the XP tree's notes). */
  xp?: number;
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
  /** SCREAM-395: how many columns of notes it has. */
  cols: number;
  /** The colour of the tree's string and pins. */
  string: number;
  /** The colour of its paper notes. */
  paper: number;
  notes: PowerUpNote[];
};

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

function iceCreamNote(flavour: FlavourId, col: number, row: number, from: string[] = []): PowerUpNote {
  const f = getFlavour(flavour);
  const first = flavour === STORY_FIRST_FLAVOUR;
  const limit = `The average person won't pay more than ${dollars(storyRefuseAboveCents(flavour))} for one.`;
  // SCREAM-352 (PO, November 15): "I want to add the cost of buying each ice cream to the powerup card."
  const cost = `Costs you ${dollars(stockCostOf(flavour, true))} each to stock.`; // SCREAM-365: the notes are Story's
  // PO, November 14: "Lets remove the line 'Stock it and customers order it.'"
  const paragraphs = [first ? 'Owned from the start.' : '', ICE_CREAM_EFFECTS[flavour] ?? '', limit, cost].filter(Boolean);
  return {
    id: iceCreamNoteId(flavour),
    col,
    row,
    from,
    priceCents: first ? 0 : ICE_CREAM_UNLOCK_PRICES[flavour] ?? ICE_CREAM_UNLOCK_CENTS,
    name: f.name.toUpperCase(),
    description: paragraphs.join(' '),
    paragraphs,
    logo: flavour,
    flavour,
    free: first,
  };
}

// SCREAM-395 (PO, November 17): "Im finding that most items, just aren't worth the money, they are
// helpful, but you can't exactly see the monetary payoff. Then others obviously do, I want the ones
// that do to remain in a paid unlock system... All the other items, I want to pull into a new system
// where its based on XP or experience points." and "I want to completely separate the two. tracks.
// Some are earned through xp the other tree money." So the three trees became two: a MONEY tree
// (the ice creams and the notes he ticked "money": gas can, More Space for Scream, Service With A
// Smile, the two speakers) and an XP tree (everything else). The dummies are gone.

/** What each note says and shows. Where it hangs, and what it costs in XP, is in the trees below. */
type NoteText = { priceCents: number; name: string; description: string; logo: PowerUpLogo };
const NOTE_TEXT: Record<string, NoteText> = {
  // SCREAM-122 (PO, November 13): the first real power-up; the can is full again every day.
  // SCREAM-369 (PO, November 16): the first row costs $10. SCREAM-382 (PO, November 17): "Refills daily."
  [GAS_CAN_ID]: { priceCents: 1000, name: 'TEMPORARY GAS CAN', description: 'Run out of gas and it pours itself in: a splash to get you going. Refills daily.', logo: 'gas-can' },
  // SCREAM-25 (PO, November 15): "Cooler Size", then "Change \"more Junk\" to \"More Space for Scream\"".
  [MORE_JUNK_ID]: { priceCents: MORE_JUNK_PRICE_CENTS, name: 'MORE SPACE FOR SCREAM', description: 'More room in the cooler: a new bottom row opens in every crate.', logo: 'more-junk' },
  // SCREAM-303 (PO, November 14).
  [SMILE_ID]: { priceCents: SMILE_PRICE_CENTS, name: 'SERVICE WITH A SMILE', description: 'Tips start higher, and you get more time to earn one.', logo: 'tip-jar' },
  // SCREAM-81 (PO, November 14).
  [SPEAKER_ID]: { priceCents: SPEAKER_PRICE_CENTS, name: 'UPGRADE SPEAKER', description: 'Increase the reach of the speaker.', logo: 'speaker' },
  // SCREAM-329 (PO, November 14).
  [BASS_ID]: { priceCents: BASS_PRICE_CENTS, name: 'SPEAKER WITH HEAVIER BASS', description: 'More likely to get customers in their home.', logo: 'bass-guitar' },
  // The XP tree's notes cost XP, not cash (their old prices are gone).
  [TROT_ID]: { priceCents: 0, name: 'TROT', description: 'Increase the speed of the truck as it rolls without any gas pedal pushed.', logo: 'trot' }, // SCREAM-310
  [TRAIN_ID]: { priceCents: 0, name: 'TRAIN OFF THE TRACKS', description: 'Max velocity increased.', logo: 'train-off-tracks' }, // SCREAM-80
  [BRAKES_ID]: { priceCents: 0, name: 'BRAKES MADE THIS CENTURY', description: 'Brakes are better.', logo: 'brake-disc' }, // SCREAM-325
  [STEAM_ID]: { priceCents: 0, name: 'STEAM ENGINE', description: 'Increase the speed of the truck as it rolls.', logo: 'steam-engine' }, // SCREAM-326
  [BACK_IT_UP_ID]: { priceCents: 0, name: 'BACK IT UP', description: 'Increase the speed of the truck in reverse.', logo: 'back-it-up' }, // SCREAM-340
  [GITTY_UP_ID]: { priceCents: 0, name: 'GITTY UP', description: "Increase acceleration. The truck still is heavy, so don't expect much.", logo: 'gitty-up' }, // SCREAM-309
  [CALCULATOR_ID]: { priceCents: 0, name: 'CALCULATOR', description: 'Get a calculator to use at the sales window.', logo: 'calculator' }, // SCREAM-317
  [NOTEBOOK_ID]: { priceCents: 0, name: 'HANDY NOTEBOOK', description: 'Hints given by customers are written down.', logo: 'notepad' }, // SCREAM-245
  [REGISTER_ID]: { priceCents: 0, name: 'THIS CENTURY REGISTER', description: 'Click the icons of the ice cream to calculate price.', logo: 'tablet' }, // SCREAM-330
  [MIRRORS_ID]: { priceCents: 0, name: 'BETTER MIRRORS', description: 'A marker at the edge of the screen points at each customer on their way to you.', logo: 'mirror' }, // SCREAM-341
  [SPEEDY_ID]: { priceCents: 0, name: 'SPEEDY NEIGHBORS', description: 'Most customers run after the truck faster.', logo: 'sneaker' }, // SCREAM-342
};

/** A money note at its place: pays with the Story cash. */
function paid(id: string, col: number, row: number, from: string[] = []): PowerUpNote {
  return { id, col, row, from, ...NOTE_TEXT[id]! };
}

/** An XP note at its place: its row sets what it costs (XP_NOTE_PRICES). */
function earned(id: string, col: number, row: number, from: string[] = []): PowerUpNote {
  return { id, col, row, from, ...NOTE_TEXT[id]!, priceCents: 0, xp: XP_NOTE_PRICES[row] ?? XP_NOTE_PRICES[XP_NOTE_PRICES.length - 1]! };
}

const ICE = iceCreamNoteId;

// Left to right on the board. PO, November 17: "for now lets just use the same tree structure and put
// items next to each other that are the same cost." Which note sits where is engineering's proposal.
export const POWER_UP_TREES: PowerUpTree[] = [
  {
    id: 'money',
    name: 'MONEY',
    cols: 5,
    string: 0x2f8f46,
    paper: 0xd9f2c9,
    notes: [
      // SCREAM-396 (PO's two notepad sketches, November 18; "I want the best items to be last"): one
      // path down the middle. The eclair (yours from the start), the gas can, then a choice of
      // speaker ("The player should buy both items but the choice may make them bypass one. I also
      // want players to get better speakers for making finding customers less frusterating."),
      // an ice cream under each, Service With A Smile from either, More Space for Scream, and the
      // Lou Ball and the Explorer Pop last. Every note keeps its price (engineering's call).
      // The Cookie Ice Cream Sandwich is off the board ("For now we can remove it from the game."):
      // its flavour stays in flavours.ts for Quick play and for the day it comes back.
      paid(GAS_CAN_ID, 2, 1, [ICE('eclair')]),
      iceCreamNote('eclair', 2, 0),
      paid(SPEAKER_ID, 1, 2, [GAS_CAN_ID]),
      paid(BASS_ID, 3, 2, [GAS_CAN_ID]),
      iceCreamNote('spongepop', 1, 3, [SPEAKER_ID]),
      iceCreamNote('drumcone', 3, 3, [BASS_ID]),
      paid(SMILE_ID, 2, 4, [ICE('spongepop'), ICE('drumcone')]),
      paid(MORE_JUNK_ID, 2, 5, [SMILE_ID]),
      iceCreamNote('louball', 1, 6, [MORE_JUNK_ID]),
      iceCreamNote('explorer', 3, 6, [MORE_JUNK_ID]),
    ],
  },
  {
    id: 'xp',
    name: 'XP',
    cols: 5,
    string: 0x7a4fd0,
    paper: 0xe3d8fb,
    notes: [
      // SCREAM-398 (PO's notepad sketch, November 18, "Here the xp tree"): Trot on top; the
      // Calculator and Brakes under it; Train Off The Tracks (his "Max Velocity") from the Calculator,
      // the Handy Notebook from either, Back It Up from Brakes; the Steam Engine from the Notebook;
      // Gitty Up and Speedy Neighbors from the Steam Engine; This Century Register from either.
      earned(TROT_ID, 2, 0),
      earned(CALCULATOR_ID, 1, 1, [TROT_ID]),
      earned(BRAKES_ID, 3, 1, [TROT_ID]),
      earned(TRAIN_ID, 0, 2, [CALCULATOR_ID]),
      earned(NOTEBOOK_ID, 2, 2, [CALCULATOR_ID, BRAKES_ID]),
      earned(BACK_IT_UP_ID, 4, 2, [BRAKES_ID]),
      earned(STEAM_ID, 2, 3, [NOTEBOOK_ID]),
      // Better Mirrors is not on his sketch ("I'll add a screenshot"): engineering's placeholder
      // until it comes, under the Handy Notebook as before.
      earned(MIRRORS_ID, 4, 3, [NOTEBOOK_ID]),
      earned(GITTY_UP_ID, 1, 4, [STEAM_ID]),
      earned(SPEEDY_ID, 3, 4, [STEAM_ID]),
      earned(REGISTER_ID, 2, 5, [GITTY_UP_ID, SPEEDY_ID]),
    ],
  },
];

/** SCREAM-271: the notes owned from the start of every Story run. */
export const FREE_NOTE_IDS: string[] = POWER_UP_TREES.flatMap((t) => t.notes.filter((n) => n.free).map((n) => n.id));
