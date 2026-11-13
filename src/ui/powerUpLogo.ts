import * as Phaser from 'phaser';
import type { PowerUpTreeId } from '../config/powerUps';
import { MARKER_FONT } from './flavourArt';

// SCREAM-296: the picture on a cork board note. Engineering's placeholders, drawn in code, one
// per tree (a wheel, a speaker, a coin), until the PO draws a logo for each power-up.

const INK = 0x2b1d10;

/**
 * Draws a tree's logo centred on (0, 0) inside `into`, about `size` px across.
 * `grey` is the not-yet-bought look: no colour, and fainter.
 */
export function addPowerUpLogo(
  scene: Phaser.Scene,
  into: Phaser.GameObjects.Container,
  tree: PowerUpTreeId,
  size: number,
  grey: boolean,
): void {
  const g = scene.add.graphics();
  into.add(g);
  const r = size / 2;
  const line = Math.max(2, size / 14);
  const colour = (c: number) => (grey ? 0x9a9a9a : c);
  g.setAlpha(grey ? 0.75 : 1);
  if (tree === 'truck') {
    // A wheel: tyre, hubcap and five spokes.
    g.fillStyle(colour(0x33302c), 1).fillCircle(0, 0, r);
    g.fillStyle(grey ? 0xd0d0d0 : 0xcfd6dc, 1).fillCircle(0, 0, r * 0.58);
    g.lineStyle(line, colour(0x33302c), 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.lineBetween(0, 0, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
    }
    g.fillStyle(colour(0xd9622b), 1).fillCircle(0, 0, r * 0.18);
  } else if (tree === 'speaker') {
    // A loudspeaker: the box, the cone and two sound waves.
    g.fillStyle(colour(0x2f9e44), 1);
    g.fillRect(-r, -r * 0.3, r * 0.5, r * 0.6);
    g.fillTriangle(-r * 0.5, -r * 0.3, -r * 0.5, r * 0.3, r * 0.1, r * 0.8);
    g.fillTriangle(-r * 0.5, -r * 0.3, r * 0.1, -r * 0.8, r * 0.1, r * 0.8);
    g.lineStyle(line, grey ? 0x9a9a9a : INK, 1);
    g.beginPath().arc(r * 0.1, 0, r * 0.5, -0.8, 0.8).strokePath();
    g.beginPath().arc(r * 0.1, 0, r * 0.88, -0.8, 0.8).strokePath();
  } else {
    // A coin with a dollar sign.
    g.fillStyle(colour(0xb8860b), 1).fillCircle(0, 0, r);
    g.fillStyle(grey ? 0xd0d0d0 : 0xffd84a, 1).fillCircle(0, 0, r * 0.82);
    const dollar = scene.add
      .text(0, r * 0.06, '$', { fontFamily: MARKER_FONT, fontSize: `${Math.round(size * 0.72)}px`, color: grey ? '#8a8a8a' : '#7a5200' })
      .setOrigin(0.5);
    dollar.setAlpha(grey ? 0.75 : 1);
    into.add(dollar);
  }
}
