import * as Phaser from 'phaser';
import { bubbleOutline, type BubbleTail } from '../state/BubbleOutline';

/**
 * SCREAM-378 (PO, November 16): "I want to upgrade the look of the speech bubble on the sales
 * screen. Its too pixelated for the look we are going for for inside the truck." The screens
 * inside the truck are his hand-drawn cartoons, so their bubbles are hand-drawn too: a rounded
 * box with a slightly wobbly ink line and a curved tail. Used at the sales window (the
 * customer's and the player's), the uncle's text box and the uncle's intro. The "!" over
 * customers on the map keeps the pixel bubble (`speechBubble.ts`).
 *
 * The bubble is painted on a canvas at twice its size and shown as a picture, so its line is
 * smooth (Phaser's own shapes have hard, stepped edges).
 */
export const HAND_BUBBLE_INK = '#2b1d10';
export const HAND_BUBBLE_FILL = '#fffdf9';

export interface HandBubbleSpec {
  w: number;
  h: number;
  tail?: BubbleTail;
  /** Corner radius (default 22), the ink line's width (default 3.5), and how far the line wanders (default 1.6), in px. */
  radius?: number;
  line?: number;
  wobble?: number;
  /** A different seed gives a differently wobbly line. */
  seed?: number;
}

/** Room round the box for the line's width and wander. */
const PAD = 6;
/** The canvas is this many times the bubble's size. */
const SHARP = 2;
let made = 0;

export class HandBubble {
  readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  /** What is drawn now (tests read it). */
  spec: HandBubbleSpec = { w: 0, h: 0 };

  /** (x, y) is the box's top-left corner. */
  constructor(scene: Phaser.Scene, x: number, y: number, spec: HandBubbleSpec) {
    const key = `hand-bubble-${made++}`;
    this.texture = scene.textures.createCanvas(key, 4, 4)!;
    this.image = scene.add.image(x - PAD, y - PAD, key).setOrigin(0, 0).setName('hand-bubble');
    this.image.once(Phaser.GameObjects.Events.DESTROY, () => scene.textures.remove(key));
    this.draw(spec);
  }

  /** Moves the box's top-left corner to (x, y). */
  setPosition(x: number, y: number): this {
    this.image.setPosition(x - PAD, y - PAD);
    return this;
  }

  /** Paints the bubble again (a new height, or the tail on another side). */
  draw(spec: HandBubbleSpec): this {
    this.spec = spec;
    const tail = spec.tail;
    const right = tail?.side === 'right' ? tail.length : 0;
    const down = tail?.side === 'down' ? tail.length : 0;
    const w = Math.ceil(spec.w + right + 2 * PAD);
    const h = Math.ceil(spec.h + down + 2 * PAD);
    this.texture.setSize(w * SHARP, h * SHARP);
    const ctx = this.texture.context;
    ctx.setTransform(SHARP, 0, 0, SHARP, PAD * SHARP, PAD * SHARP);
    ctx.clearRect(-PAD, -PAD, w, h);
    const points = bubbleOutline({
      w: spec.w,
      h: spec.h,
      radius: spec.radius ?? 22,
      wobble: spec.wobble ?? 1.6,
      seed: spec.seed ?? 7,
      tail,
    });
    ctx.beginPath();
    points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = HAND_BUBBLE_FILL;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = HAND_BUBBLE_INK;
    ctx.lineWidth = spec.line ?? 3.5;
    ctx.stroke();
    this.texture.refresh();
    this.image.setTexture(this.texture.key).setDisplaySize(w, h);
    return this;
  }
}
