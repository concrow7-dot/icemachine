import * as Phaser from 'phaser';
import { RESIDENT_FRAME } from '../config/residents';
import { residentFrame, residentsKey } from './residentLook';

// SCREAM-110 (PO, November 2): the customer at the window, blown up from their
// 16 x 32 px map sprite, looked blocky. Scale2x (also called EPX), run three
// times, enlarges pixel art 8x and rounds off the stair-step edges without adding
// any new colours, so they still look like themselves, only smoother. Done in the
// browser for the one customer at the window, so it adds no files to download.

/** How many times bigger the smoothed frames are than the map's (Scale2x three times). */
export const SMOOTH_FACTOR = 8;

/** Scale2x on one image's pixels (as 32-bit numbers, one per pixel): returns one twice as wide and tall. */
export function scale2x(src: Uint32Array, w: number, h: number): Uint32Array {
  const out = new Uint32Array(w * 2 * h * 2);
  const at = (x: number, y: number) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1); // above
      const b = at(x + 1, y); // right
      const c = at(x - 1, y); // left
      const d = at(x, y + 1); // below
      const o = y * 2 * (w * 2) + x * 2;
      out[o] = c === a && c !== d && a !== b ? a : p;
      out[o + 1] = a === b && a !== c && b !== d ? b : p;
      out[o + w * 2] = d === c && d !== b && c !== a ? c : p;
      out[o + w * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out;
}

/**
 * A texture holding one look's six idle, facing-down frames, smoothed and 8x bigger,
 * as frames 0 to 5. Made once per look and kept for the rest of the game.
 */
export function smoothCustomerTexture(scene: Phaser.Scene, look: number): string {
  const sheetKey = residentsKey();
  const sheet = scene.textures.get(sheetKey);
  const frames = [0, 1, 2, 3, 4, 5].map((i) => {
    const f = sheet.get(residentFrame(look, false, 'down', i));
    return { x: f.cutX, y: f.cutY };
  });
  return smoothFrames(scene, `customer-smooth-${sheetKey}-${look}`, sheetKey, frames);
}

/** SCREAM-169: the uncle's picture (one look, residents' layout), idle facing down: frames 18-23 of the first row. */
export const UNCLE_KEY = 'uncle';
export const UNCLE_URL = 'assets/limezu/uncle.png';

/**
 * The uncle's six frames, smoothed like a customer at the window: idle facing the player, or
 * (SCREAM-171) walking away up the truck toward the cab (the walk row's facing-up frames).
 */
export function smoothUncleTexture(scene: Phaser.Scene, pose: 'idle' | 'walkAway' = 'idle'): string {
  const { width: fw, height: fh } = RESIDENT_FRAME;
  const frames = [0, 1, 2, 3, 4, 5].map((i) =>
    pose === 'idle' ? { x: (18 + i) * fw, y: 0 } : { x: (6 + i) * fw, y: fh },
  );
  return smoothFrames(scene, pose === 'idle' ? 'uncle-smooth' : 'uncle-smooth-walk-away', UNCLE_KEY, frames);
}

/** Smooths six 16 x 32 frames of `sourceKey` (top-left corners given) into texture `key`, frames 0 to 5. */
function smoothFrames(scene: Phaser.Scene, key: string, sourceKey: string, frames: { x: number; y: number }[]): string {
  if (scene.textures.exists(key)) return key;
  const { width: fw, height: fh } = RESIDENT_FRAME;
  const source = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
  const small = document.createElement('canvas');
  small.width = fw;
  small.height = fh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const big = scene.textures.createCanvas(key, fw * SMOOTH_FACTOR * frames.length, fh * SMOOTH_FACTOR);
  if (!sctx || !big) return sourceKey;
  const bctx = big.getContext();
  frames.forEach((f, i) => {
    sctx.clearRect(0, 0, fw, fh);
    sctx.drawImage(source, f.x, f.y, fw, fh, 0, 0, fw, fh);
    let px: Uint32Array = new Uint32Array(sctx.getImageData(0, 0, fw, fh).data.buffer.slice(0));
    let w = fw;
    let h = fh;
    for (let n = 1; n < SMOOTH_FACTOR; n *= 2) {
      px = scale2x(px, w, h);
      w *= 2;
      h *= 2;
    }
    bctx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer as ArrayBuffer), w, h), i * w, 0);
    big.add(i, 0, i * w, 0, w, h);
  });
  big.refresh();
  big.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}
