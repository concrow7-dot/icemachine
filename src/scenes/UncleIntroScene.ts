import * as Phaser from 'phaser';
import { getEvening, SceneKeys } from '../flow';
import type { TutorialRun } from '../state/Tutorial';
import { showLoadingWhileLoading } from './LoadingScene';
import { INTERIOR_KEY, loadTruckInterior } from '../ui/truckInterior';
import { drawBubble } from '../ui/speechBubble';
import { smoothUncleTexture, SMOOTH_FACTOR, UNCLE_KEY, UNCLE_URL } from '../ui/smoothPixels';

/**
 * SCREAM-169 (PO, November 5): the guided tutorial opens with the uncle standing inside the
 * truck (the PO's drawing of the interior), drawn like a customer at the sales window, and
 * talking in the sales window's quote box: name top left in pink, his words inside.
 * Click, Enter or Space shows his next line. When he gets to the last line of the first step,
 * the player goes to the cooler, where his small box carries on (ui/uncleBox).
 */
const INK = '#2b1d10';
/** Standing in the aisle between the seats, blown up like a customer at the window. */
const UNCLE_X = 520;
const UNCLE_FEET = 512;
const UNCLE_SCALE = 11;
const BUBBLE = { x: 40, y: 150, w: 400, h: 170 };

export class UncleIntroScene extends Phaser.Scene {
  private run!: TutorialRun;
  private lineText!: Phaser.GameObjects.Text;
  private leaving = false;

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
    const { width, height } = this.scale;
    this.add.image(0, 0, INTERIOR_KEY).setOrigin(0, 0).setDisplaySize(width, height);

    // The uncle, the same size and smoothing as a customer at the window, breathing.
    const key = smoothUncleTexture(this);
    const uncle = this.add
      .sprite(UNCLE_X, UNCLE_FEET, key, 0)
      .setOrigin(0.5, 1)
      .setScale(UNCLE_SCALE / SMOOTH_FACTOR)
      .setName('uncle');
    let step = 0;
    this.time.addEvent({ delay: 160, loop: true, callback: () => uncle.setFrame(++step % 6) });

    // The sales window's quote box, its tail stepping toward his face.
    drawBubble(this.add.graphics(), {
      ...BUBBLE,
      unit: 4,
      innerLine: true,
      tail: { side: 'right', at: 140, steps: 6, reach: 3 },
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
    const more = this.add
      .text(BUBBLE.x + BUBBLE.w - 22, BUBBLE.y + BUBBLE.h - 16, '▶', { fontFamily: 'monospace', fontSize: '16px', color: INK })
      .setOrigin(1, 1);
    this.tweens.add({ targets: more, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    this.add
      .text(width / 2, height - 14, 'Click Or Enter: Next', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', backgroundColor: '#2b1d10', padding: { x: 8, y: 3 } })
      .setOrigin(0.5, 1);

    this.input.on('pointerdown', () => this.next());
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // Esc (pause) is the HUD's, as on every evening screen.
      if (event.key === 'Enter' || event.key === ' ') this.next();
    });
    this.show();
  }

  /** The line on screen now (tests read it). */
  get shown(): string {
    return this.lineText.text;
  }

  private show(): void {
    this.lineText.setText(this.run.line ?? '');
  }

  /** His next line; on the first step's last line, off to the cooler (his small box says it there). */
  private next(): void {
    if (this.leaving) return;
    this.run.nextLine();
    if (this.run.moreLines) return this.show();
    this.leaving = true;
    this.scene.start(SceneKeys.Cooler);
  }
}
