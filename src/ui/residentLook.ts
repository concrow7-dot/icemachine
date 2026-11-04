import * as Phaser from 'phaser';
import { RESIDENT_FRAME, RESIDENT_LOOKS_ACROSS } from '../config/residents';
import { currentMap } from '../config/maps';
import type { ResidentFacing } from '../state/Residents';

// The residents' sprite sheet (SCREAM-59): LimeZu Modern Interiors characters.
// Shared by the map (DriveScene) and the sales window (SCREAM-106), so a
// customer looks the same in both.

/** SCREAM-146: each map has its own residents and sheet; this is the current map's texture key. */
export function residentsKey(): string {
  return currentMap().residentsKey;
}

const FACING_COLUMN: Record<ResidentFacing, number> = { right: 0, up: 1, left: 2, down: 3 };

/** Loads the residents' sheet if it isn't loaded yet. Call from a scene's preload(). */
export function loadResidentSheet(scene: Phaser.Scene): void {
  const { residentsKey: key, residentsUrl } = currentMap();
  if (scene.textures.exists(key)) return;
  scene.load.spritesheet(key, residentsUrl, {
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
