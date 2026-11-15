// Issue #8: the four prepackaged ice creams in the first playable, with what
// each costs the truck driver. Names are original (PO decision, October 28).

export type FlavourId = 'eclair' | 'spongepop' | 'explorer' | 'cookie' | 'louball' | 'drumcone';

export type Flavour = {
  id: FlavourId;
  name: string;
  costCents: number;
  /** SCREAM-334: only in Story (bought on the cork board); Quick play's clipboard never offers it. */
  storyOnly?: boolean;
};

export const FLAVOURS: Flavour[] = [
  { id: 'eclair', name: 'Chocolate Eclair', costCents: 100 },
  { id: 'spongepop', name: 'SpongePop', costCents: 150 },
  { id: 'explorer', name: 'Lil Explorer Pop', costCents: 150 },
  { id: 'cookie', name: 'Cookie Ice Cream Sandwich', costCents: 200 },
  // SCREAM-334 (PO, November 15): a parody name of his own ("two ball lou ball"). New ice creams go
  // at the end: the pictures' sheet and old saves follow this order.
  { id: 'louball', name: 'Two Ball Lou Ball', costCents: 200, storyOnly: true },
  // SCREAM-335 (PO, November 15): "drum cone", his own name in place of a real brand's.
  { id: 'drumcone', name: 'Drum Cone', costCents: 200, storyOnly: true },
];

export function getFlavour(id: FlavourId): Flavour {
  const flavour = FLAVOURS.find((f) => f.id === id);
  if (!flavour) throw new Error(`Unknown flavour: ${id}`);
  return flavour;
}

/** Suggested starting price for a flavour: cost plus $1.00. The player can change it. */
export function defaultPriceCents(id: FlavourId): number {
  return getFlavour(id).costCents + 100;
}
