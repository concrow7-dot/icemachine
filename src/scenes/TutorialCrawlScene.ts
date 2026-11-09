import * as Phaser from 'phaser';
import { SceneKeys } from '../flow';
import { currentMap } from '../config/maps';
import { showLoadingWhileLoading } from './LoadingScene';
import { addMapOverview, loadMapOverview } from '../ui/mapOverview';
import { musicFor } from '../audio/Music';

/** SCREAM-178 (PO, November 5): the ice cream truck tune that plays with the credits (see public/assets/audio/README.md). */
export const CREDITS_TUNE_KEY = 'credits-tune';
const CREDITS_TUNE_URL = 'assets/audio/credits-tune.mp3';
const CREDITS_TUNE_VOLUME = 0.7;

/**
 * SCREAM-177 (PO's note, November 5): the guided tutorial opens with credits in the style of
 * a famous space film's opening: one still line in blue, then the story scrolling away from
 * the player in yellow. SCREAM-178 (PO, November 5): behind it, a zoomed-out view of the tutorial map
 * (not space), drifting slowly, under a dark layer so the text reads clearly. Original text only (the PO's); no logo or music
 * from the film. S or a click skips it (SCREAM-217: S is the tutorial's one skip key; it used to be
 * Enter or Space). Then the uncle, in the truck.
 */
const STILL_LINE = 'In an ice cream truck, not that far away...';
/** The PO's words (spelling tidied). */
const STORY =
  'Your uncle, who owns an ice cream truck, dropped a pallet of Chaco Tacos on his foot. ' +
  'Out of commission, he has asked for your help. ' +
  'You agree, since you could use a little more money before school starts in the fall...';
const BLUE = '#4bd5ee';
const YELLOW = '#ffe81f';
/** How many characters fit on one line of the scroll, before it shrinks into the distance. */
const LINE_CHARS = 30;
const LINE_GAP = 54;
/** The scroll's speed along the "floor", px per second, and how fast it shrinks with distance. */
const SPEED = 62;
const DEPTH = 260;
/** Where the scroll vanishes (the horizon) and where it starts (just off the bottom). */
const HORIZON_Y = 70;
const START_Y = 600;
const STILL_MS = 4200;
/** PO (November 5): the scroll ran too long (5 seconds, then 10, then 12 more); it cuts to the truck this much before the last line fades out. */
const CUT_EARLY_MS = 27000;
/** The distance along the floor where a line is gone (its size reaches 0.1). */
const GONE_AT = DEPTH * (1 / 0.1 - 1);
/** The map shrunk to the screen's width; it drifts from its top to its bottom while the credits play. */
const DRIFT_MS = 36000;
const SHADE_ALPHA = 0.7;

/** Splits the story into lines of about LINE_CHARS characters, at spaces. */
export function crawlLines(text: string = STORY, width = LINE_CHARS): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line);
      line = word;
    } else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

export class TutorialCrawlScene extends Phaser.Scene {
  private lines: Phaser.GameObjects.Text[] = [];
  /** How far the scroll has moved along the floor, px. */
  private travelled = 0;
  private scrolling = false;
  private done = false;

  constructor() {
    super(SceneKeys.TutorialCrawl);
  }

  preload(): void {
    loadMapOverview(this, currentMap());
    if (!this.cache.audio.exists(CREDITS_TUNE_KEY)) this.load.audio(CREDITS_TUNE_KEY, CREDITS_TUNE_URL);
    showLoadingWhileLoading(this);
  }

  create(): void {
    const { width, height } = this.scale;
    this.lines = [];
    this.travelled = 0;
    this.scrolling = false;
    this.done = false;
    // The whole tutorial map, shrunk to the screen's width, drifting from top to bottom, under a dark layer.
    const map = currentMap();
    const scale = width / map.data.width;
    const overview = addMapOverview(this, map, 0, 0, scale).setName('crawl-map');
    const spare = Math.max(0, map.data.height * scale - height);
    this.tweens.add({ targets: overview, y: -spare, duration: DRIFT_MS, ease: 'Sine.easeInOut' });
    this.add.rectangle(0, 0, width, height, 0x000000, SHADE_ALPHA).setOrigin(0, 0);

    const still = this.add
      .text(width / 2, height / 2, STILL_LINE, { fontFamily: 'monospace', fontSize: '30px', color: BLUE, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setAlpha(0)
      .setName('crawl-still');
    this.tweens.chain({
      targets: still,
      tweens: [
        { alpha: 1, duration: 900 },
        { alpha: 1, duration: STILL_MS - 1800 },
        { alpha: 0, duration: 900 },
      ],
      onComplete: () => {
        this.scrolling = true;
      },
    });

    this.lines = crawlLines().map((l) =>
      this.add
        .text(width / 2, START_Y, l, { fontFamily: 'monospace', fontSize: '40px', fontStyle: 'bold', color: YELLOW, stroke: '#000000', strokeThickness: 6 })
        .setOrigin(0.5, 1)
        .setVisible(false),
    );

    this.add
      .text(width - 12, height - 10, 'S: Skip', { fontFamily: 'monospace', fontSize: '13px', color: '#c0c8d6' })
      .setOrigin(1, 1);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // SCREAM-217 (PO, November 9): S skips, as everywhere in the uncle's evening; a held S doesn't repeat into his part.
      if ((event.key === 's' || event.key === 'S') && !event.shiftKey && !event.repeat) this.finish();
    });
    this.input.on('pointerdown', () => this.finish());

    // The tune, unless the player has muted the music (M). It pauses with the game (Esc), and
    // fades out once the uncle appears (UncleIntroScene), however the credits ended.
    this.sound.stopByKey(CREDITS_TUNE_KEY);
    if (!musicFor(this).muted) {
      const tune = this.sound.add(CREDITS_TUNE_KEY, { volume: CREDITS_TUNE_VOLUME });
      tune.play();
      const pause = () => tune.pause();
      const resume = () => tune.resume();
      this.events.on(Phaser.Scenes.Events.PAUSE, pause);
      this.events.on(Phaser.Scenes.Events.RESUME, resume);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.events.off(Phaser.Scenes.Events.PAUSE, pause);
        this.events.off(Phaser.Scenes.Events.RESUME, resume);
      });
    }
  }

  update(_time: number, delta: number): void {
    if (!this.scrolling || this.done) return;
    this.travelled += (SPEED * delta) / 1000;
    let anyLeft = false;
    this.lines.forEach((t, i) => {
      // Distance this line has moved along the floor since it came on at the bottom.
      const along = this.travelled - i * LINE_GAP;
      if (along < 0) return t.setVisible(false);
      // Farther away: smaller and closer to the horizon, like text lying on a floor.
      const near = DEPTH / (DEPTH + along);
      const y = HORIZON_Y + (START_Y - HORIZON_Y) * near;
      t.setPosition(this.scale.width / 2, y).setScale(near).setAlpha(Phaser.Math.Clamp((near - 0.1) / 0.15, 0, 1));
      t.setVisible(near > 0.1);
      if (near > 0.1) anyLeft = true;
    });
    const lastAlong = this.travelled - (this.lines.length - 1) * LINE_GAP;
    if ((!anyLeft && this.travelled > this.lines.length * LINE_GAP) || lastAlong >= GONE_AT - (SPEED * CUT_EARLY_MS) / 1000) this.finish();
  }

  /** On to the uncle in the truck. */
  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.scene.start(SceneKeys.UncleIntro);
  }
}
