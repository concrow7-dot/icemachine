import Phaser from 'phaser';
import { MARKER_FONT } from './flavourArt';

/**
 * SCREAM-204 (PO, November 11): Story's cooler starts with fewer crates. A crate the player
 * doesn't have yet is shut under a dark cover marked LOCKED, on the prep screen and when
 * filling an order. It takes no clicks. SCREAM-25 (a bigger cooler) will open one.
 */
export function addLockedCrate(scene: Phaser.Scene, left: number, top: number, size: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0x3b4650, 0.92).fillRect(0, 0, size, size);
  g.lineStyle(4, 0x1f262c, 1).strokeRect(2, 2, size - 4, size - 4);
  // Two straps across the lid.
  g.fillStyle(0x1f262c, 0.9).fillRect(0, size * 0.22, size, 8).fillRect(0, size * 0.72, size, 8);
  const label = scene.add
    .text(size / 2, size / 2, 'LOCKED', { fontFamily: MARKER_FONT, fontSize: '26px', color: '#e8edf0' })
    .setOrigin(0.5)
    .setName('locked-crate-label');
  return scene.add.container(left, top, [g, label]).setDepth(11).setName('locked-crate');
}
