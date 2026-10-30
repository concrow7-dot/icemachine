import * as Phaser from 'phaser';
import { EVENING_SCENES, SceneKeys, startEvening } from '../flow';

// Issue #19 (PO decisions in doc 18, Q7-Q9): Esc pauses the evening on any
// screen except results. The clock, the truck and every timer stop while the
// menu is open. Restart and Quit ask "Are you sure?" first, and an evening
// that's quit or restarted doesn't go on the high score table (it never
// reaches the results screen).

type Choice = 'resume' | 'restart' | 'quit';

const CHOICES: { id: Choice; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  { id: 'restart', label: 'Restart evening' },
  { id: 'quit', label: 'Quit to title' },
];

const INK = '#ffffff';
const HIGHLIGHT = '#ffe066';
const QUIET = '#b7c2d6';

export class PauseScene extends Phaser.Scene {
  /** The evening screens frozen behind the menu, resumed when it closes. */
  private paused: string[] = [];
  private selected = 0;
  /** Waiting for "Are you sure?" on restart or quit. */
  private confirming: Choice | null = null;
  /** #68: the highlighted answer to "Are you sure?" (0 = Yes, 1 = No). No comes first, the safe choice. */
  private answer = 1;
  private answers: Phaser.GameObjects.Text[] = [];
  private items: Phaser.GameObjects.Text[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Pause);
  }

  create(data: { paused?: string[] }): void {
    this.paused = data.paused ?? [];
    this.selected = 0;
    this.confirming = null;
    this.answer = 1;
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x0b1220, 0.72).setOrigin(0, 0).setInteractive();
    this.add.rectangle(width / 2, height / 2, 420, 300, 0x1f2a44).setStrokeStyle(3, 0x8a9bb3);
    this.add.text(width / 2, height / 2 - 110, 'PAUSED', { fontFamily: 'monospace', fontSize: '34px', color: '#ffe8a3' }).setOrigin(0.5);

    this.items = CHOICES.map((c, i) =>
      this.add
        .text(width / 2, height / 2 - 40 + i * 48, c.label, { fontFamily: 'monospace', fontSize: '24px', color: INK })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (!this.confirming) {
            this.selected = i;
            this.refresh();
          }
        })
        .on('pointerdown', () => {
          if (!this.confirming) {
            this.selected = i;
            this.choose();
          }
        }),
    );
    this.prompt = this.add
      .text(width / 2, height / 2 - 15, '', { fontFamily: 'monospace', fontSize: '20px', color: INK, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    this.answers = ['Yes', 'No'].map((label, i) =>
      this.add
        .text(width / 2 + (i === 0 ? -70 : 70), height / 2 + 55, label, { fontFamily: 'monospace', fontSize: '24px', color: INK })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.confirming) {
            this.answer = i;
            this.refresh();
          }
        })
        .on('pointerdown', () => {
          if (this.confirming) {
            this.answer = i;
            this.answerChosen();
          }
        }),
    );
    this.hint = this.add
      .text(width / 2, height / 2 + 120, '', { fontFamily: 'monospace', fontSize: '14px', color: QUIET })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    this.refresh();
  }

  private onKey(event: KeyboardEvent): void {
    const key = event.key;
    if (this.confirming) {
      if (key === 'y' || key === 'Y') this.confirm();
      else if (key === 'n' || key === 'N' || key === 'Escape') this.cancelConfirm();
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(key)) {
        this.answer = 1 - this.answer;
        this.refresh();
      } else if (key === 'Enter') this.answerChosen();
      return;
    }
    if (key === 'Escape') this.resume();
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') this.move(-1);
    else if (key === 'ArrowDown' || key === 's' || key === 'S') this.move(1);
    else if (key === 'Enter') this.choose();
  }

  private move(step: number): void {
    this.selected = (this.selected + step + CHOICES.length) % CHOICES.length;
    this.refresh();
  }

  private choose(): void {
    const choice = CHOICES[this.selected]?.id ?? 'resume';
    if (choice === 'resume') this.resume();
    else {
      this.confirming = choice;
      this.answer = 1;
      this.refresh();
    }
  }

  /** Enter or a click on Yes / No. */
  private answerChosen(): void {
    if (this.answer === 0) this.confirm();
    else this.cancelConfirm();
  }

  private cancelConfirm(): void {
    this.confirming = null;
    this.refresh();
  }

  private refresh(): void {
    const asking = this.confirming !== null;
    this.items.forEach((t, i) => {
      t.setVisible(!asking);
      t.setColor(i === this.selected ? HIGHLIGHT : INK);
      t.setText(`${i === this.selected ? '> ' : '  '}${CHOICES[i]?.label ?? ''}${i === this.selected ? ' <' : '  '}`);
    });
    this.prompt.setVisible(asking);
    if (this.confirming === 'restart') this.prompt.setText("Restart this evening?\nIt won't count for high scores.");
    if (this.confirming === 'quit') this.prompt.setText("Quit to the title screen?\nThis evening won't count.");
    this.answers.forEach((t, i) => {
      const on = i === this.answer;
      const word = i === 0 ? 'Yes' : 'No';
      t.setVisible(asking).setColor(on ? HIGHLIGHT : INK).setText(on ? `> ${word} <` : `  ${word}  `);
    });
    this.hint.setText(asking ? '← →: choose    Enter: select    Y / N' : '↑ ↓: choose    Enter: select    Esc: resume');
  }

  private confirm(): void {
    const choice = this.confirming;
    this.confirming = null;
    if (choice === 'restart') {
      this.stopEvening();
      startEvening(this);
    } else if (choice === 'quit') {
      this.stopEvening();
      this.scene.start(SceneKeys.Title);
    }
  }

  /** Back to the evening exactly where it was. */
  private resume(): void {
    for (const key of this.paused) this.scene.resume(key);
    this.scene.stop();
  }

  private stopEvening(): void {
    for (const key of EVENING_SCENES) this.scene.stop(key);
  }
}
