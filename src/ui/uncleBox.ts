import * as Phaser from 'phaser';
import { drawBubble } from './speechBubble';
import { skipUncle, TutorialEvents, type TutorialRun } from '../state/Tutorial';

/**
 * SCREAM-169: the uncle's lines during the guided tutorial, in the sales window's quote box
 * style (SCREAM-126, 127: his name top left in pink, PO November 5). He opens in the truck
 * (UncleIntroScene); this smaller box carries his lines after that. Lives in the HUD, so it shows on every evening
 * screen. A line moves on by itself after LINE_MS, or straight away when clicked; the last
 * line of a step stays up until the player has done what it asks.
 *
 * It sits near the top on most screens, clear of the calculator, the buttons and the
 * controls line along the bottom, and stops short of the map's OpenStreetMap credit (top
 * right). On the cooler (SCREAM-170) it sits top right, over the freezer's sign, clear of the
 * clipboard, Today's Menu and Buy Stock, which he talks about.
 */
const BOX = { x: 0, y: 0, w: 690, h: 58, unit: 4 };
/** PO (November 6): a line too long for one row gets a second row; the box grows down by this much. */
const SECOND_ROW = 18;
const SPOT_TOP = { x: 90, y: 48 };
const SPOT_COOLER = { x: 254, y: 39 };
const LINE_MS = 6000;
/** How long his last line stays up once he has nothing more to say. */
const LAST_LINE_MS = 9000;

export class UncleBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly more: Phaser.GameObjects.Text;
  /** SCREAM-200: "S: Skip The Uncle", bottom left, while he can still be skipped. */
  private readonly skipHint: Phaser.GameObjects.Text;
  /** SCREAM-180: the bubble itself, scaled from its middle when a new line pops in. */
  private readonly bubble: Phaser.GameObjects.Container;
  /** SCREAM-180: a yellow glow round the bubble that flashes as a new line arrives. */
  private readonly glow: Phaser.GameObjects.Graphics;
  private timer?: Phaser.Time.TimerEvent;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  /** The box's height now (one row, or two). */
  height = BOX.h;
  /** He's said everything and his last line has had its time: the box stays away. */
  private gone = false;
  /** The screen underneath, from place(). */
  private screen: 'intro' | 'cooler' | 'other' = 'other';
  private readonly scene: Phaser.Scene;
  private readonly run: TutorialRun;

  constructor(scene: Phaser.Scene, run: TutorialRun) {
    this.scene = scene;
    this.run = run;
    const g = drawBubble(scene.add.graphics(), { ...BOX, tail: { side: 'down', at: 0, steps: 0 }, innerLine: true });
    this.frame = g;
    const name = scene.add.text(BOX.x + 18, BOX.y + 9, 'Uncle', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#c2185b',
    });
    // One row of text: his lines fit at this size (the longest, at the cooler, is 74 letters).
    this.text = scene.add.text(BOX.x + 18, BOX.y + 27, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#2b1d10',
      wordWrap: { width: BOX.w - 44 },
      lineSpacing: 2,
    });
    this.more = scene.add
      .text(BOX.x + BOX.w - 16, BOX.y + BOX.h - 12, '▶', { fontFamily: 'monospace', fontSize: '14px', color: '#2b1d10' })
      .setOrigin(1, 1);
    scene.tweens.add({ targets: this.more, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    // SCREAM-200 (PO, November 7): a visible way past him, from his first line on.
    this.skipHint = scene.add
      .text(BOX.x + BOX.w - 34, BOX.y + 9, 'S: Skip The Uncle', { fontFamily: 'monospace', fontSize: '11px', color: '#7a6a5a' })
      .setOrigin(1, 0)
      .setName('uncle-skip')
      .setInteractive({ useHandCursor: true });
    this.skipHint.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      skipUncle(run);
    });
    // The bubble's parts sit round its middle, so it can pop in from there (SCREAM-180).
    const parts = [g, name, this.text, this.more, this.skipHint];
    for (const p of parts) (p as unknown as { x: number; y: number }).x -= BOX.w / 2;
    for (const p of parts) (p as unknown as { x: number; y: number }).y -= BOX.h / 2;
    this.bubble = scene.add.container(BOX.w / 2, BOX.h / 2, parts);
    this.glow = scene.add.graphics().setAlpha(0);
    const hit = scene.add.zone(BOX.x, BOX.y, BOX.w, BOX.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.hit = hit;
    this.drawGlow();
    hit.on('pointerdown', () => run.nextLine());
    this.container = scene.add
      .container(SPOT_TOP.x, SPOT_TOP.y, [this.glow, this.bubble, hit])
      .setName('uncle-box')
      .setDepth(50);

    const onChanged = () => this.show();
    run.on(TutorialEvents.Changed, onChanged);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      run.off(TutorialEvents.Changed, onChanged);
      this.timer?.remove();
    });
    this.show();
  }

  /**
   * Moves the box to suit the screen underneath (the HUD calls this every frame). Hidden
   * while he's talking in the truck at the start, where he has his own big quote box.
   */
  place(screen: 'intro' | 'cooler' | 'other'): void {
    this.screen = screen;
    this.container.setVisible(!this.gone && screen !== 'intro');
    const spot = screen === 'cooler' ? SPOT_COOLER : SPOT_TOP;
    if (this.container.x !== spot.x || this.container.y !== spot.y) this.container.setPosition(spot.x, spot.y);
  }

  /** What the box says now (tests read it). */
  get shown(): string {
    return this.container.visible ? this.text.text : '';
  }

  /** His line has been up a while: the next one, unless the credits or the truck scene are on (they move him on themselves). */
  private autoNext(): void {
    if (this.screen === 'intro') this.timer = this.scene.time.delayedCall(LINE_MS, () => this.autoNext());
    else this.run.nextLine();
  }

  private show(): void {
    this.timer?.remove();
    this.timer = undefined;
    const line = this.run.line;
    if (line === null && this.screen === 'intro') {
      // SCREAM-185: his last words were in the truck's big box: this one stays away.
      this.gone = true;
      this.container.setVisible(false);
      return;
    }
    this.skipHint.setVisible(this.run.canSkip);
    if (this.run.skipped) {
      // SCREAM-200: his goodbye pops in, stays a while, and the box goes for good.
      if (line !== this.text.text) this.popIn(line!);
      this.more.setVisible(false);
      this.timer = this.scene.time.delayedCall(LAST_LINE_MS, () => {
        this.gone = true;
        this.container.setVisible(false);
      });
      return;
    }
    if (line === null) {
      // He's said everything: keep his last words up a while, then the box goes.
      this.more.setVisible(false);
      this.timer = this.scene.time.delayedCall(LAST_LINE_MS, () => {
        this.gone = true;
        this.container.setVisible(false);
      });
      return;
    }
    // Only a new line pops in (not the same one again, e.g. when the sale starts counting).
    if (line !== this.text.text || this.screen === 'intro') this.popIn(line);
    // ▶ when clicking (or waiting) brings another line, or finishes a step that's only talk.
    // SCREAM-170: a line waiting for the player to do something stays until they do.
    const goesOn = !this.run.waitingFor && (this.run.moreLines || this.run.talkOnly);
    // PO (November 6): his line at the window waits for a click (▶), with no timer.
    // SCREAM-172: his line as the truck pulls up holds her window until it's clicked or has had its time.
    this.more.setVisible(goesOn || this.run.holdsSale || this.run.holdsWindow);
    if (goesOn || this.run.holdsWindow) {
      this.timer = this.scene.time.delayedCall(LINE_MS, () => this.autoNext());
    }
  }

  /** One row: a line too long for it at 14 px (e.g. his line at the window) is set at 13 px. */
  private fitText(line: string): void {
    this.text.setFontSize(14).setText(line);
    if (this.text.height > 24) this.text.setFontSize(13);
    this.setHeight(this.text.height > 24 ? BOX.h + SECOND_ROW : BOX.h);
  }

  /** One row or two: the box grows down (its top stays put). */
  private setHeight(h: number): void {
    if (h === this.height) return;
    this.height = h;
    drawBubble(this.frame, { ...BOX, h, tail: { side: 'down', at: 0, steps: 0 }, innerLine: true });
    this.more.y = BOX.y + h - 12 - BOX.h / 2;
    this.hit.setSize(BOX.w, h);
    this.drawGlow();
  }

  private drawGlow(): void {
    this.glow.clear();
    this.glow.lineStyle(10, 0x3b2a1a, 0.6).strokeRoundedRect(-6, -6, BOX.w + 12, this.height + 12, 12);
    this.glow.lineStyle(6, 0xffe066, 1).strokeRoundedRect(-6, -6, BOX.w + 12, this.height + 12, 12);
  }

  /**
   * SCREAM-180 (PO, November 5): a new line should be obvious. The old bubble shrinks away,
   * the new one pops in with a little overshoot, and a yellow glow flashes round it twice.
   * (While he's talking in the truck the box is hidden, so the text just changes.)
   */
  private popIn(line: string): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf([this.bubble, this.glow]);
    const arrive = () => {
      this.fitText(line);
      this.bubble.setScale(0.5).setAlpha(0);
      tweens.add({ targets: this.bubble, scale: 1, alpha: 1, duration: 340, ease: 'Back.easeOut' });
      this.glow.setAlpha(0);
      tweens.add({ targets: this.glow, alpha: 1, duration: 160, yoyo: true, repeat: 2, delay: 200 });
    };
    if (this.screen === 'intro' || !this.text.text) {
      this.bubble.setScale(1).setAlpha(1);
      if (this.screen === 'intro') return void this.fitText(line);
      return arrive();
    }
    tweens.add({ targets: this.bubble, scale: 0.6, alpha: 0, duration: 140, ease: 'Quad.easeIn', onComplete: arrive });
  }
}
