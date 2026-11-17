import type * as Phaser from 'phaser';
import { ALL_HANDS, type Hand } from '../state/Handwriting';

/**
 * SCREAM-378: the handwriting fonts (free, with their licence files beside them in
 * public/assets/fonts). Call in a scene's preload with the hands it writes in; a font
 * already loaded is skipped.
 */
export function loadHandFonts(scene: Phaser.Scene, hands: readonly Hand[] = ALL_HANDS): void {
  // (document.fonts.check() says yes for a font it has never heard of, so look for it by name.)
  const loaded = new Set<string>();
  document.fonts.forEach((f) => {
    if (f.status === 'loaded') loaded.add(f.family.replace(/"/g, ''));
  });
  for (const hand of hands) {
    if (!loaded.has(hand.font)) scene.load.font(hand.font, `assets/fonts/${hand.file}`, 'woff2');
  }
}

/** A hand's font for a Phaser text style: the typewriter font stands in for a missing letter. */
export function handFamily(hand: Hand): string {
  return `"${hand.font}", monospace`;
}
