// Issue #8: the four prepackaged ice creams in the first playable, with what
// each costs the truck driver. Names are original (PO decision, October 28).

export type FlavourId = 'eclair' | 'spongepop' | 'explorer' | 'cookie' | 'louball' | 'drumcone';

export type Flavour = {
  id: FlavourId;
  name: string;
  costCents: number;
  /** SCREAM-351: the price it starts at on Today's Menu, when that isn't cost plus $1.00. */
  startPriceCents?: number;
  /** SCREAM-334: only in Story (bought on the cork board); Quick play's clipboard never offers it. */
  storyOnly?: boolean;
  /** SCREAM-365 (PO, November 16): what it costs to stock in Story, when that isn't `costCents` (Quick play keeps `costCents`). */
  storyCostCents?: number;
};

/** SCREAM-365: what one costs to stock: Story's price if it has one, else the usual. */
export function stockCostOf(id: FlavourId, story: boolean): number {
  const f = getFlavour(id);
  return story ? (f.storyCostCents ?? f.costCents) : f.costCents;
}

export const FLAVOURS: Flavour[] = [
  { id: 'eclair', name: 'Chocolate Eclair', costCents: 100 },
  // SCREAM-365 (PO, November 16): "The spongepop and explorer pop ice cream should reduce to $1.25 each" (Story).
  { id: 'spongepop', name: 'SpongePop', costCents: 150, storyCostCents: 125 },
  { id: 'explorer', name: 'Lil Explorer Pop', costCents: 150, storyCostCents: 125 },
  { id: 'cookie', name: 'Cookie Ice Cream Sandwich', costCents: 200 },
  // SCREAM-334 (PO, November 15): a parody name of his own ("two ball lou ball"). New ice creams go
  // at the end: the pictures' sheet and old saves follow this order.
  // SCREAM-351 (PO, November 15): "I want these two ice creams to be more profitable. So they should
  // cost $1 but be able to be sold at $3." They were $2.00 to stock; they still start at $3.00.
  // SCREAM-365 (PO, November 16): "The 2 ball lou ball and drumcone should be $0.75 each".
  { id: 'louball', name: 'Two Ball Lou Ball', costCents: 75, startPriceCents: 300, storyOnly: true },
  // SCREAM-335 (PO, November 15): "drum cone", his own name in place of a real brand's.
  { id: 'drumcone', name: 'Drum Cone', costCents: 75, startPriceCents: 300, storyOnly: true },
];

export function getFlavour(id: FlavourId): Flavour {
  const flavour = FLAVOURS.find((f) => f.id === id);
  if (!flavour) throw new Error(`Unknown flavour: ${id}`);
  return flavour;
}

/** Suggested starting price for a flavour: cost plus $1.00 (or its own `startPriceCents`). The player can change it. */
export function defaultPriceCents(id: FlavourId): number {
  const flavour = getFlavour(id);
  return flavour.startPriceCents ?? flavour.costCents + 100;
}
