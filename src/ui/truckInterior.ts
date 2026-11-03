import * as Phaser from 'phaser';

// SCREAM-57: the PO's coloured drawing of the inside of the truck.
// SCREAM-123: also the backdrop of the pause menu and the end-of-evening screens,
// under a coloured layer so the text on top is easy to read.

export const INTERIOR_KEY = 'truck-interior';
const INTERIOR_URL = 'assets/interior/truck-interior.png';

/** Call in preload: queues the picture unless it's already loaded. */
export function loadTruckInterior(scene: Phaser.Scene): void {
  if (!scene.textures.exists(INTERIOR_KEY)) scene.load.image(INTERIOR_KEY, INTERIOR_URL);
}

/** Pause menu: night blue, strong enough that the menu reads clearly. */
export const PAUSE_SHADE = { color: 0x0b1220, alpha: 0.78 };
/** End of the evening: the sun has set, so a deeper dusk blue. */
export const DUSK_SHADE = { color: 0x0b1430, alpha: 0.88 };

/**
 * Draws the truck interior filling the screen, behind everything else,
 * with a coloured layer over it. Returns the layer (callers may make it
 * interactive to block clicks).
 */
export function addTruckBackdrop(
  scene: Phaser.Scene,
  shade: { color: number; alpha: number },
): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.scale;
  scene.add.image(0, 0, INTERIOR_KEY).setOrigin(0, 0).setDisplaySize(width, height).setDepth(-20);
  return scene.add.rectangle(0, 0, width, height, shade.color, shade.alpha).setOrigin(0, 0).setDepth(-10);
}
