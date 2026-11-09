import * as Phaser from 'phaser';
import { getEvening, SceneKeys } from '../flow';
import { skipUncle, type TutorialRun } from '../state/Tutorial';
import { count, secondsSinceTutorialStart } from '../state/Counter';
import { showLoadingWhileLoading } from './LoadingScene';
import { CREDITS_TUNE_KEY } from './TutorialCrawlScene';
import { HIGHLIGHT, OUTLINE, ZONES } from './TruckScene';
import { INTERIOR_KEY, loadTruckInterior } from '../ui/truckInterior';
import { drawBubble } from '../ui/speechBubble';
import { smoothUncleTexture, SMOOTH_FACTOR, UNCLE_KEY, UNCLE_URL } from '../ui/smoothPixels';

/**
 * SCREAM-169 (PO, November 5): the guided tutorial opens with the uncle standing inside the
 * truck (the PO's drawing of the interior), drawn like a customer at the sales window, and
 * talking in the sales window's quote box: name top left in pink, his words inside.
 * Click, Enter or Space shows his next line.
 *
 * SCREAM-177 (PO's note, November 5): his last line here asks the player to click on the
 * cooler. The cooler is outlined like on the hub, and only it (or Enter) moves on: to the
 * cooler, where his small box (ui/uncleBox) carries on with the step's last line.
 */
const INK = '#2b1d10';
/** Standing in the aisle between the seats, blown up like a customer at the window. */
const UNCLE_X = 520;
const UNCLE_FEET = 512;
const UNCLE_SCALE = 11;
const BUBBLE = { x: 40, y: 92, w: 400, h: 170 };
/** SCREAM-171: where his walk to the cab ends, beside the driver's seat (the cooler's edge is at x 362). */
const CAB_X = 422;
const CAB_FEET = 385;

export class UncleIntroScene extends Phaser.Scene {
  private run!: TutorialRun;
  private lineText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private more!: Phaser.GameObjects.Text;
  private coolerOutline!: Phaser.GameObjects.Graphics;
  private coolerTag!: Phaser.GameObjects.Text;
  private leaving = false;
  /** When he asked for the cooler (scene time). */
  private askedAt = Infinity;
  /** Keys and clicks count from this time on, so the S that skipped the credits doesn't also skip him (SCREAM-217). */
  private readyAt = 0;
  /** SCREAM-171: back in the truck after Buy Stock, he says his line and walks to the cab to drive. */
  private headingOut = false;
  /** SCREAM-185: back home after the gas; his line, then the player is on the road alone. */
  private atHome = false;
  private uncle!: Phaser.GameObjects.Sprite;
  private bubbleParts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKeys.UncleIntro);
  }

  preload(): void {
    loadTruckInterior(this);
    if (!this.textures.exists(UNCLE_KEY)) this.load.image(UNCLE_KEY, UNCLE_URL);
    showLoadingWhileLoading(this);
  }

  create(): void {
    const tutorial = getEvening(this).tutorial;
    if (!tutorial) {
      this.scene.start(SceneKeys.Cooler);
      return;
    }
    this.run = tutorial;
    this.leaving = false;
    this.askedAt = Infinity;
    this.readyAt = this.game.getTime() + 300;
    const { width, height } = this.scale;
    this.add.image(0, 0, INTERIOR_KEY).setOrigin(0, 0).setDisplaySize(width, height);

    // SCREAM-178: the credits' tune fades out as the uncle appears.
    for (const tune of this.sound.getAll(CREDITS_TUNE_KEY)) {
      this.tweens.add({ targets: tune, volume: 0, duration: 1200, onComplete: () => tune.destroy() });
    }

    // The cooler, outlined and clickable once he asks for it (the hub's outline and tag).
    const cooler = ZONES.find((z) => z.id === 'cooler')!;
    const path: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < cooler.points.length; i += 2) path.push(new Phaser.Math.Vector2(cooler.points[i], cooler.points[i + 1]));
    this.coolerOutline = this.add.graphics();
    this.coolerOutline.lineStyle(9, OUTLINE, 0.9).strokePoints(path, true, true);
    this.coolerOutline.lineStyle(5, HIGHLIGHT, 1).strokePoints(path, true, true);
    this.coolerTag = this.add
      .text(cooler.tag.x, cooler.tag.y, 'COOLER', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: INK,
        backgroundColor: '#ffe066',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: [this.coolerOutline, this.coolerTag], alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    const coolerZone = this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive(new Phaser.Geom.Polygon(cooler.points), Phaser.Geom.Polygon.Contains)
      .setName('cooler-zone');
    coolerZone.on('pointerdown', () => {
      // Not the same click that brought up his "click on the cooler" line.
      if (this.askingForCooler && this.time.now > this.askedAt) this.toCooler();
    });

    // The uncle, the same size and smoothing as a customer at the window, breathing.
    const key = smoothUncleTexture(this);
    const uncle = this.add
      .sprite(UNCLE_X, UNCLE_FEET, key, 0)
      .setOrigin(0.5, 1)
      .setScale(UNCLE_SCALE / SMOOTH_FACTOR)
      .setName('uncle');
    this.uncle = uncle;
    let step = 0;
    this.time.addEvent({ delay: 160, loop: true, callback: () => uncle.setFrame(++step % 6) });
    this.headingOut = this.run.step === 'drive';
    this.atHome = this.run.step === 'alone';
    if (this.atHome) this.cameras.main.fadeIn(500);

    // The sales window's quote box, its tail stepping toward his face.
    const bubbleStart = this.children.list.length;
    drawBubble(this.add.graphics(), {
      ...BUBBLE,
      unit: 4,
      innerLine: true,
      tail: { side: 'right', at: 150, steps: 6, reach: 3 },
    });
    this.add.text(BUBBLE.x + 28, BUBBLE.y + 16, 'Uncle', {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#c2185b',
    });
    this.lineText = this.add
      .text(BUBBLE.x + BUBBLE.w / 2, BUBBLE.y + BUBBLE.h / 2 + 6, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: INK,
        align: 'center',
        wordWrap: { width: BUBBLE.w - 60 },
        lineSpacing: 4,
      })
      .setOrigin(0.5);
    this.more = this.add
      .text(BUBBLE.x + BUBBLE.w - 22, BUBBLE.y + BUBBLE.h - 16, '▶', { fontFamily: 'monospace', fontSize: '16px', color: INK })
      .setOrigin(1, 1);
    this.tweens.add({ targets: this.more, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    this.bubbleParts = this.children.list.slice(bubbleStart);
    this.hint = this.add
      .text(width / 2, height - 14, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', backgroundColor: '#2b1d10', padding: { x: 8, y: 3 } })
      .setOrigin(0.5, 1);

    // A click anywhere else shows his next line (not while he's waiting for the cooler).
    this.input.on('pointerdown', () => {
      if (!this.askingForCooler) this.next();
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // SCREAM-200: S skips the uncle from here too.
      // SCREAM-217: a held S (key repeat) from skipping the credits doesn't skip him too.
      if ((event.key === 's' || event.key === 'S') && !event.shiftKey) return event.repeat ? undefined : this.skipHim();
      // Esc (pause) is the HUD's, as on every evening screen. Enter picks the cooler when he asks for it.
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (this.askingForCooler) this.toCooler();
      else this.next();
    });
    this.show();
  }

  /** The line on screen now (tests read it). */
  get shown(): string {
    return this.lineText.text;
  }

  /** On his last line in the truck: "Click on the cooler." (it waits for the cooler, SCREAM-170). */
  get askingForCooler(): boolean {
    return this.run.waitingFor === 'coolerOpened';
  }

  private show(): void {
    this.lineText.setText(this.run.line ?? '');
    const asking = this.askingForCooler;
    if (asking && this.askedAt === Infinity) this.askedAt = this.time.now;
    this.more.setVisible(!asking);
    this.coolerOutline.setVisible(asking);
    this.coolerTag.setVisible(asking);
    const skip = this.run.canSkip ? '   S: Skip The Uncle' : '';
    this.hint.setText((asking ? 'Click The Cooler (Or Press Enter)' : 'Click Or Enter: Next') + skip);
    // SCREAM-171: heading out, his one line here moves on only when the player has read it (no timer).
    if (this.headingOut || this.atHome) this.more.setVisible(true);
  }

  private next(): void {
    if (this.leaving || this.askingForCooler || this.game.getTime() < this.readyAt) return;
    if (this.headingOut) return this.walkToCab();
    if (this.atHome && !this.run.moreLines) return this.backOnTheRoad();
    this.run.nextLine();
    this.show();
  }

  /**
   * SCREAM-171 (PO's note): "Uncle turns around and an animation looks like he's walking towards
   * the front of the truck. Fade out, fade in with the truck driving itself." His bubble goes,
   * he turns and walks up the aisle, getting smaller, the screen fades, and the drive begins.
   */
  private walkToCab(): void {
    this.leaving = true;
    for (const part of this.bubbleParts) (part as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    this.hint.setVisible(false);
    this.uncle.setTexture(smoothUncleTexture(this, 'walkAway'), 0);
    this.tweens.add({
      targets: this.uncle,
      // PO (November 6): toward the driver's seat on the left, clear of the cooler's edge.
      x: CAB_X,
      y: CAB_FEET,
      scale: (UNCLE_SCALE / SMOOTH_FACTOR) * 0.55,
      duration: 1700,
      ease: 'Sine.easeIn',
    });
    this.time.delayedCall(1300, () => this.cameras.main.fadeOut(600));
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.run.nextLine(); // his line for the drive
      const evening = getEvening(this);
      evening.lockPrep();
      this.scene.start(SceneKeys.Drive);
    });
  }

  /** SCREAM-185: his line at home read: his part is over, and the player drives on alone. */
  private backOnTheRoad(): void {
    this.leaving = true;
    this.run.nextLine(); // finishes his last step
    count('wheel', 'tutorial', secondsSinceTutorialStart()); // SCREAM-201: title screen to the wheel
    this.cameras.main.fadeOut(500);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SceneKeys.Drive));
  }

  /**
   * SCREAM-200 (PO, November 7): the player skips him. He's marked finished (the tutorial counts
   * as done), and the evening goes on without him from wherever this screen was heading: the
   * cooler at the start, the road when he was about to drive, or the road again at home.
   */
  private skipHim(): void {
    if (this.leaving || !this.run.canSkip || this.game.getTime() < this.readyAt) return;
    this.leaving = true;
    skipUncle(this.run);
    const evening = getEvening(this);
    if (this.headingOut) evening.lockPrep();
    const next = this.headingOut || this.atHome ? SceneKeys.Drive : SceneKeys.Cooler;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(next));
  }

  private toCooler(): void {
    if (this.leaving || this.game.getTime() < this.readyAt) return;
    this.leaving = true;
    this.run.signal('coolerOpened');
    this.scene.start(SceneKeys.Cooler);
  }
}
