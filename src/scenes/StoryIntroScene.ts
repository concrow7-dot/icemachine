import * as Phaser from 'phaser';
import { BIKE_PRICE_CENTS, STORY_DAYS, STORY_START_CASH_CENTS } from '../config/tuning';
import { SceneKeys, startStoryEvening } from '../flow';
import { fadeTo, loadStoryAhead } from './loadAhead';
import { formatMoney } from '../util/format';

// SCREAM-18 (PO, October 31): the story's intro, a plain text screen for now.
// The player is saving up for a new bike before school starts. The text below
// is engineering's PLACEHOLDER: the PO writes the real story and provides the
// art (SCREAM-76).

const MONO = 'monospace';

// SCREAM-242 (PO, November 10: "add a pixel-art bike image to the page, and make it shine so it
// looks like a cartoonishly good prize to win"; November 15: red, with a glint and twinkles). The
// picture is drawn by tools/bike/draw_bike.py and shown BIKE_SCALE times as big.
export const BIKE_KEY = 'story-bike';
const BIKE_URL = 'assets/story/bike.png';
const BIKE_SCALE = 3;
const BIKE_Y = 165;
/** The glint: a band of light this many art pixels wide slides across the bike, then waits. */
const GLINT_WIDTH = 14;
const GLINT_SLIDE_MS = 900;
const GLINT_EVERY_MS = 2600;
/** The twinkles: where each star sits (art pixels from the bike's middle) and when in the cycle it peaks (0 to 1). */
const TWINKLES: readonly [number, number, number][] = [
  [-62, -30, 0],
  [58, -36, 0.35],
  [66, 14, 0.7],
  [-58, 26, 0.5],
  [-70, -6, 0.85],
];
const TWINKLE_MS = 1800;
const TWINKLE_COLOUR = 0xfff3b0;

/** Queues the bike's picture if it isn't loaded yet (this screen's preload, and SCREAM-243's loading ahead). */
export function loadBikeArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BIKE_KEY)) scene.load.image(BIKE_KEY, BIKE_URL);
}

/** Placeholder story text (SCREAM-76 replaces it). */
function introText(): string {
  return [
    `School starts in ${STORY_DAYS} days.`,
    '',
    `There's a new bike in the shop window: ${formatMoney(BIKE_PRICE_CENTS)}.`,
    `You've got ${formatMoney(STORY_START_CASH_CENTS)} and an ice cream truck.`,
    '',
    'Sell enough ice cream before school starts',
    'to buy that bike.',
  ].join('\n');
}

export class StoryIntroScene extends Phaser.Scene {
  private leaving = false;
  /** SCREAM-242: the bike, its glint (the same picture in white, cropped to a band) and its stars. Test hooks. */
  bike?: Phaser.GameObjects.Image;
  glint?: Phaser.GameObjects.Image;
  twinkles: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super(SceneKeys.StoryIntro);
  }

  preload(): void {
    loadBikeArt(this);
  }

  /** SCREAM-242: the bike under the title, with a band of light that slides across it and a few twinkling stars. */
  private addBike(x: number, y: number): void {
    const texture = this.textures.get(BIKE_KEY);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const art = texture.getSourceImage();
    this.bike = this.add.image(x, y, BIKE_KEY).setScale(BIKE_SCALE);
    this.glint = this.add.image(x, y, BIKE_KEY).setScale(BIKE_SCALE).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setAlpha(0.85).setVisible(false);
    this.twinkles = TWINKLES.map(([dx, dy]) => {
      const g = this.add.graphics().setPosition(x + dx * BIKE_SCALE, y + dy * BIKE_SCALE);
      // A four-pointed star in pixels: a long cross with a bright middle.
      g.fillStyle(TWINKLE_COLOUR, 1).fillRect(-1, -7, 3, 15).fillRect(-7, -1, 15, 3);
      g.fillStyle(0xffffff, 1).fillRect(-1, -3, 3, 7).fillRect(-3, -1, 7, 3);
      return g;
    });
    this.shine(0, art.width);
    this.events.on(Phaser.Scenes.Events.UPDATE, (time: number) => this.shine(time, art.width));
  }

  /** SCREAM-242: where the glint and the stars are at `time` ms (the picture is `artWidth` art pixels wide). */
  private shine(time: number, artWidth: number): void {
    const t = time % GLINT_EVERY_MS;
    const sliding = t < GLINT_SLIDE_MS;
    this.glint?.setVisible(sliding);
    if (sliding) {
      const left = Math.round(-GLINT_WIDTH + (t / GLINT_SLIDE_MS) * (artWidth + GLINT_WIDTH));
      this.glint?.setCrop(left, 0, GLINT_WIDTH, 1000);
    }
    this.twinkles.forEach((g, i) => {
      // Each star swells and fades once a cycle, at its own moment.
      const phase = (((time / TWINKLE_MS - TWINKLES[i][2]) % 1) + 1) % 1;
      const size = Math.max(0, Math.sin(phase * Math.PI * 2));
      g.setScale(0.3 + size * 0.9).setAlpha(size);
    });
  }

  create(): void {
    const { width, height } = this.scale;
    this.leaving = false;
    loadStoryAhead(this); // SCREAM-243: normally all loaded at the title already
    // SCREAM-242: the title moved up and the text down and a little smaller, to make room for the bike.
    this.add.text(width / 2, 28, 'THE NEW BIKE', { fontFamily: MONO, fontSize: '32px', color: '#ffe8a3' }).setOrigin(0.5);
    this.addBike(width / 2, BIKE_Y);
    this.add
      .text(width / 2, 374, introText(), { fontFamily: MONO, fontSize: '19px', color: '#d6deeb', align: 'center', lineSpacing: 1 })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 56, 'Placeholder text: the final story and art are coming (SCREAM-76)', {
        fontFamily: MONO,
        fontSize: '13px',
        color: '#6b7a93',
      })
      .setOrigin(0.5);
    this.add.text(width / 2, height - 28, 'Click Or Enter: Start Monday', { fontFamily: MONO, fontSize: '20px', color: '#8a9bb3' }).setOrigin(0.5).setName('begin-hint');

    // SCREAM-270 (PO, November 12): a left click begins, as well as Enter.
    const begin = () => {
      if (this.leaving) return;
      this.leaving = true;
      // SCREAM-243: a short fade into the game.
      fadeTo(this, [SceneKeys.Cooler, SceneKeys.Hud], () => startStoryEvening(this));
    };
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) begin();
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // A held key (Enter still down from the title screen) doesn't count.
      if (event.key === 'Enter' && !event.repeat) begin();
    });
  }
}
