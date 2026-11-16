import * as Phaser from 'phaser';
import { FUEL_LOW } from '../config/tuning';

/**
 * SCREAM-121: the old-school dial. The needle's pivot sits just under the top bar, in the
 * middle; the face is a fan from E (left) to F (right), angles in degrees clockwise from
 * pointing right (so 270 is straight up).
 * SCREAM-276: moved here from HudScene so the end-of-day screen can draw the same dial.
 */
export const FUEL_DIAL = { radius: 72, from: 200, to: 340 };
/**
 * SCREAM-238 (PO, November 10; replaces SCREAM-219's top right): the gauge is bigger and sits at the
 * bottom left. `x` is the needle's pivot; on the road the pivot sits just above the controls hint,
 * at the pump (no hint on the left there) it sits lower, clear of the pump's picture.
 */
// SCREAM-276: in the hub (Story) it sits at the same spot as at the pump.
export const FUEL_DIAL_SPOT = { x: 80, driveY: 504, pumpY: 530, hubY: 530 };
/** How much bigger the dial is than the one it was first drawn as (radius 46): labels and needle scale with it. */
const DIAL_SCALE = FUEL_DIAL.radius / 46;
const DIAL_FACE = 0x4b4440;
const DIAL_EDGE = 0x241f1c;
const DIAL_INK = 0xf4ead2;
const DIAL_INK_CSS = '#f4ead2';
const DIAL_LOW_CSS = '#ff6b5e';

export type FuelDialParts = {
  container: Phaser.GameObjects.Container;
  needle: Phaser.GameObjects.Graphics;
  emptyLabel: Phaser.GameObjects.Text;
};

/**
 * SCREAM-121 (PO, November 2): an old car's gas gauge, a dark fan with E, 1/2 and F and a
 * pale needle (the PO's reference photo). SCREAM-238: bigger, at the bottom left.
 */
export function buildFuelDial(scene: Phaser.Scene, x: number, y: number): FuelDialParts {
  const { radius, from, to } = FUEL_DIAL;
  const rad = Phaser.Math.DegToRad;
  const at = (deg: number, r: number) => ({ x: Math.cos(rad(deg)) * r, y: Math.sin(rad(deg)) * r });
  const face = scene.add.graphics();
  face.fillStyle(DIAL_FACE, 1).slice(0, 0, radius, rad(from), rad(to), false).fillPath();
  // A lighter rim inside the dark edge, like the pressed metal plate.
  face.lineStyle(2, 0x6e645d, 1).beginPath().arc(0, 0, radius - 4, rad(from + 2), rad(to - 2), false).strokePath();
  // "E . 1/2 . F" round the top, like the reference photo: dots at a quarter and three quarters.
  const labelR = radius - Math.round(13 * DIAL_SCALE);
  face.fillStyle(DIAL_INK, 1);
  for (const f of [0.25, 0.75]) {
    const p = at(from + (to - from) * f, labelR);
    face.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 3, 6, 6);
  }
  const label = (deg: number, text: string, size: number, font = 'monospace') => {
    const p = at(deg, labelR);
    return scene.add
      .text(p.x, p.y, text, { fontFamily: font, fontSize: `${Math.round(size * DIAL_SCALE)}px`, fontStyle: 'bold', color: DIAL_INK_CSS })
      .setOrigin(0.5);
  };
  const emptyLabel = label(from + 10, 'E', 16);
  const half = label(270, '½', 15, 'Arial, sans-serif');
  const full = label(to - 10, 'F', 16);
  const needle = scene.add.graphics();
  const container = scene.add.container(x, y, [face, emptyLabel, half, full, needle]);
  return { container, needle, emptyLabel };
}

/**
 * Draws the needle at `needle` (0 = E, 1 = F). E turns red when the true level `fuel` is low;
 * `flash` reddens the plate's edge (empty), bolder while `towing`.
 */
export function drawFuelNeedle(parts: FuelDialParts, fuel: number, needle: number, flash = false, towing = false): void {
  const { radius, from, to } = FUEL_DIAL;
  const rad = Phaser.Math.DegToRad;
  parts.emptyLabel.setColor(fuel <= FUEL_LOW ? DIAL_LOW_CSS : DIAL_INK_CSS);
  const angle = rad(from + (to - from) * needle);
  const tipX = Math.cos(angle) * (radius - 9);
  const tipY = Math.sin(angle) * (radius - 9);
  const g = parts.needle.clear();
  g.lineStyle(flash && towing ? 6 : 3, flash ? 0xff5252 : DIAL_EDGE, 1).beginPath().arc(0, 0, radius, rad(from), rad(to), false);
  g.lineTo(0, 0).closePath().strokePath();
  g.lineStyle(7, DIAL_EDGE, 1).lineBetween(0, 0, tipX, tipY);
  g.lineStyle(4, DIAL_INK, 1).lineBetween(0, 0, tipX, tipY);
  g.fillStyle(DIAL_EDGE, 1).fillCircle(0, 0, 9);
  g.fillStyle(DIAL_INK, 1).fillCircle(0, 0, 6);
}
