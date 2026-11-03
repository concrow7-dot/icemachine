import * as Phaser from 'phaser';
import { FLAVOURS, type FlavourId } from '../config/flavours';

/**
 * SCREAM-129: the ice creams' pictures and Today's Menu look, shared by any screen.
 *
 * - The pictures are placeholders (tools/flavours/draw_icons.py) until SCREAM-113's art:
 *   one row of FLAVOUR_FRAME_W x FLAVOUR_FRAME_H frames in the order of FLAVOURS, shown
 *   scaled up with sharp pixels.
 * - Each flavour has a card colour and a lighter sunburst colour, like a real truck's menu
 *   board (the PO's reference photo).
 * - Prices are written in a marker font (Permanent Marker, Apache 2.0 licence, in
 *   public/assets/fonts), as if in sharpie (PO, November 2).
 */
export const FLAVOUR_ICONS_KEY = 'flavour-icons';
export const FLAVOUR_FRAME_W = 28;
export const FLAVOUR_FRAME_H = 36;
export const MARKER_FONT = 'Permanent Marker';

const ICONS_URL = 'assets/flavours/icons.png';
const MARKER_URL = 'assets/fonts/permanent-marker.woff2';

export const MENU_COLOURS: Record<FlavourId, { card: number; burst: number }> = {
  eclair: { card: 0xd6343c, burst: 0xe86046 },
  spongepop: { card: 0x2884d6, burst: 0x4ea2e6 },
  explorer: { card: 0x30a050, burst: 0x5abe68 },
  cookie: { card: 0x8048c4, burst: 0x9c68d6 },
};

/** Call in preload: queues the pictures and the marker font unless they're already loaded. */
export function loadFlavourArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FLAVOUR_ICONS_KEY)) {
    scene.load.spritesheet(FLAVOUR_ICONS_KEY, ICONS_URL, { frameWidth: FLAVOUR_FRAME_W, frameHeight: FLAVOUR_FRAME_H });
    // Sharp pixels when scaled up.
    scene.load.once(`filecomplete-spritesheet-${FLAVOUR_ICONS_KEY}`, () =>
      scene.textures.get(FLAVOUR_ICONS_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST),
    );
  }
  // (document.fonts.check() says yes for a font it has never heard of, so look for it by name.)
  let loaded = false;
  document.fonts.forEach((f) => {
    if (f.family.replace(/"/g, '') === MARKER_FONT && f.status === 'loaded') loaded = true;
  });
  if (!loaded) scene.load.font(MARKER_FONT, MARKER_URL, 'woff2');
}

/** The frame of a flavour's picture in the sheet. */
export function flavourFrame(id: FlavourId): number {
  return Math.max(0, FLAVOURS.findIndex((f) => f.id === id));
}

/** A flavour's picture, centred on (x, y), `scale` screen px per art pixel. */
export function addFlavourIcon(scene: Phaser.Scene, x: number, y: number, id: FlavourId, scale: number): Phaser.GameObjects.Image {
  return scene.add.image(x, y, FLAVOUR_ICONS_KEY, flavourFrame(id)).setScale(scale);
}
