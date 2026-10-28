// Issue #8: the four prepackaged ice creams in the first playable, with what
// each costs the truck driver. Names are original (PO decision, October 28).

export type FlavourId = 'eclair' | 'spongepop' | 'explorer' | 'cookie';

export type Flavour = {
  id: FlavourId;
  name: string;
  costCents: number;
};

export const FLAVOURS: Flavour[] = [
  { id: 'eclair', name: 'Chocolate Eclair', costCents: 100 },
  { id: 'spongepop', name: 'SpongePop', costCents: 150 },
  { id: 'explorer', name: 'Lil Explorer Pop', costCents: 150 },
  { id: 'cookie', name: 'Cookie Ice Cream Sandwich', costCents: 200 },
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
