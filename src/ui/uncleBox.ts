import * as Phaser from 'phaser';
import { drawBubble } from './speechBubble';
import { TutorialEvents, type TutorialRun } from '../state/Tutorial';

/**
 * SCREAM-169: the uncle's lines during the guided tutorial, in the sales window's quote box
 * style (SCREAM-126, 127: his name top left in pink, PO November 5). He opens in the truck
 * (UncleIntroScene); this smaller box carries his lines after that. Lives in the HUD, so it shows on every evening
 * screen. A line moves on by itself after LINE_MS, or straight away when clicked; the last
 * line of a step stays up until the player has done what it asks.
 *
 * It sits near the top on most screens, clear of the calculator, the buttons and the
 * controls line along the bottom, and stops short of the map's OpenStreetMap credit (top
 * right). The cooler's clipboard and crates fill its top, so there it sits bottom right,
 * over Today's Menu, clear of Buy Stock.
 */
const BOX = { x: 0, y: 0, w: 680, h: 72, unit: 4 };
const SPOT_TOP = { x: 90, y: 48 };
const SPOT_COOLER = { x: 262, y: 434 };
const LINE_MS = 6000;
/** How long his last line stays up once he has nothing more to say. */
const LAST_LINE_MS = 9000;

export class UncleBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly more: Phaser.GameObjects.Text;
  private timer?: Phaser.Time.TimerEvent;
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
    const name = scene.add.text(BOX.x + 20, BOX.y + 12, 'Uncle', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#c2185b',
    });
    this.text = scene.add.text(BOX.x + 20, BOX.y + 32, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#2b1d10',
      wordWrap: { width: BOX.w - 60 },
      lineSpacing: 2,
    });
    this.more = scene.add
      .text(BOX.x + BOX.w - 16, BOX.y + BOX.h - 12, '▶', { fontFamily: 'monospace', fontSize: '14px', color: '#2b1d10' })
      .setOrigin(1, 1);
    scene.tweens.add({ targets: this.more, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    const hit = scene.add.zone(BOX.x, BOX.y, BOX.w, BOX.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => run.nextLine());
    this.container = scene.add
      .container(SPOT_TOP.x, SPOT_TOP.y, [g, name, this.text, this.more, hit])
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
    if (line === null) {
      // He's said everything: keep his last words up a while, then the box goes.
      this.more.setVisible(false);
      this.timer = this.scene.time.delayedCall(LAST_LINE_MS, () => {
        this.gone = true;
        this.container.setVisible(false);
      });
      return;
    }
    this.text.setText(line);
    // ▶ when clicking (or waiting) brings another line, or finishes a step that's only talk.
    const goesOn = this.run.moreLines || this.run.talkOnly;
    this.more.setVisible(goesOn);
    if (goesOn) {
      this.timer = this.scene.time.delayedCall(LINE_MS, () => this.autoNext());
    }
  }
}
