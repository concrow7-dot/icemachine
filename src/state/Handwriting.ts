/**
 * SCREAM-378 (PO, November 16): "What is we do a bunch of different ones. Adults will have
 * better handwritting. Lets make the kids orders and names be a bit more childlike, still
 * readable but not perfect. some kids should be near perfect, others messy."
 *
 * Whose words are written in which handwriting. No Phaser here (unit-tested);
 * `src/ui/handFonts.ts` loads the fonts.
 *
 * Engineering's calls (proposals): a person keeps the same handwriting every evening, worked
 * out from their ID (no sheet column); the uncle has one neat hand of his own, and the
 * player's "You" bubble uses it too.
 */
export interface Hand {
  /** The font's name, and its file in public/assets/fonts. */
  font: string;
  file: string;
  /** The fonts draw at different sizes for the same number: multiply a font size by this. */
  size: number;
  /** The most the writing leans off level, in degrees (a messy hand doesn't keep to the line). */
  maxTilt: number;
}

/** Neat grown-up hands. */
export const ADULT_HANDS: readonly Hand[] = [
  { font: 'Kalam', file: 'kalam.woff2', size: 1.05, maxTilt: 0 },
  { font: 'Delius', file: 'delius.woff2', size: 1, maxTilt: 0 },
  { font: 'Architects Daughter', file: 'architects-daughter.woff2', size: 1, maxTilt: 0 },
];

/** Kids' hands, from nearly perfect to messy. All can be read. */
export const KID_HANDS: readonly Hand[] = [
  { font: 'Coming Soon', file: 'coming-soon.woff2', size: 1, maxTilt: 0 },
  { font: 'Schoolbell', file: 'schoolbell.woff2', size: 1.12, maxTilt: 0.6 },
  { font: 'Gochi Hand', file: 'gochi-hand.woff2', size: 1.1, maxTilt: 1 },
  { font: 'Indie Flower', file: 'indie-flower.woff2', size: 1.15, maxTilt: 1.5 },
  { font: 'Gloria Hallelujah', file: 'gloria-hallelujah.woff2', size: 0.95, maxTilt: 2 },
  { font: 'Just Me Again Down Here', file: 'just-me-again-down-here.woff2', size: 1.4, maxTilt: 2.5 },
];

/** The uncle's hand (and the player's own bubble). */
export const UNCLE_HAND: Hand = { font: 'Patrick Hand', file: 'patrick-hand.woff2', size: 1.15, maxTilt: 0 };
export const PLAYER_HAND = UNCLE_HAND;

export const ALL_HANDS: readonly Hand[] = [...ADULT_HANDS, ...KID_HANDS, UNCLE_HAND];

/** A number from a person's ID that is the same every time (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Writing {
  hand: Hand;
  /** How far this person's writing leans, in degrees (0 for a neat hand). */
  tilt: number;
}

/** This person's handwriting: the same every evening. */
export function writingFor(person: { id: string; kid: boolean }): Writing {
  const n = hash(person.id);
  const hands = person.kid ? KID_HANDS : ADULT_HANDS;
  const hand = hands[n % hands.length];
  // A second number from the same ID, between -1 and 1, for which way and how far it leans.
  const lean = ((hash(`${person.id}/tilt`) % 2001) - 1000) / 1000;
  return { hand, tilt: Math.round(hand.maxTilt * lean * 10) / 10 || 0 }; // (|| 0: never minus zero)
}

/** A font size in this hand that looks about as big as `px` did in the old typewriter font. */
export function handSize(hand: Hand, px: number): number {
  return Math.round(px * hand.size);
}
