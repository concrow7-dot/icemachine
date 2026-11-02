import * as Phaser from 'phaser';
import { RESIDENT_FRAME, RESIDENT_LOOKS_ACROSS } from '../config/residents';
import type { ResidentFacing } from '../state/Residents';

// The residents' sprite sheet (SCREAM-59): LimeZu Modern Interiors characters.
// Shared by the map (DriveScene) and the sales window (SCREAM-106), so a
// customer looks the same in both.

export const RESIDENTS_KEY = 'residents';
export const RESIDENTS_URL = 'assets/limezu/residents.png';

const FACING_COLUMN: Record<ResidentFacing, number> = { right: 0, up: 1, left: 2, down: 3 };

/** Loads the residents' sheet if it isn't loaded yet. Call from a scene's preload(). */
export function loadResidentSheet(scene: Phaser.Scene): void {
  if (scene.textures.exists(RESIDENTS_KEY)) return;
  scene.load.spritesheet(RESIDENTS_KEY, RESIDENTS_URL, {
    frameWidth: RESIDENT_FRAME.width,
    frameHeight: RESIDENT_FRAME.height,
  });
}

/**
 * The frame for a look: each look is two rows in residents.png, idle then walk,
 * with six frames each for right, up, left and down.
 */
export function residentFrame(look: number, walking: boolean, facing: ResidentFacing, step: number): number {
  const across = RESIDENT_LOOKS_ACROSS * 24;
  const row = Math.floor(look / RESIDENT_LOOKS_ACROSS) * 2 + (walking ? 1 : 0);
  return row * across + (look % RESIDENT_LOOKS_ACROSS) * 24 + FACING_COLUMN[facing] * 6 + (step % 6);
}
