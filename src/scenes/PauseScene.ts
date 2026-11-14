import * as Phaser from 'phaser';
import { clearStory, EVENING_SCENES, getEvening, getStory, restartEvening, SceneKeys } from '../flow';
import { addTruckBackdrop, loadTruckInterior, PAUSE_SHADE } from '../ui/truckInterior';
import { showLoadingWhileLoading } from './LoadingScene';

// Issue #19 (PO decisions in doc 10, Q7-Q9): Esc pauses the evening on any
// screen except results. The clock, the truck and every timer stop while the
// menu is open. Restart and Quit ask "Are you sure?" first, and an evening
// that's quit or restarted doesn't go on the high score table (it never
// reaches the results screen).
// SCREAM-181: the high score screen opens it as well while it is asking for initials.

type Choice = 'resume' | 'end' | 'restart' | 'quit' | 'keys';

const CHOICES: { id: Choice; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  // SCREAM-290 (PO, November 12): "If its 7:30 and I am out of stock. I may just want to end the evening."
  { id: 'end', label: 'End Evening' },
  { id: 'restart', label: 'Restart Evening' },
  { id: 'quit', label: 'Quit To Title' },
  // SCREAM-206 (decision 104): last, so the other options keep their places.
  { id: 'keys', label: 'Key Bindings' },
];

/**
 * SCREAM-181 (PO, November 6): Esc on the high score screen (while it asks for initials) opens
 * this menu too, with a warning. The evening is over there, so there is nothing to restart.
 */
// SCREAM-206: no Key Bindings here either (the evening is over, and the warning sits where a third option would).
const RESULTS_CHOICES = CHOICES.filter((c) => c.id !== 'restart' && c.id !== 'end' && c.id !== 'keys');
/** SCREAM-290: not while the uncle is running his evening (skipping him first gives it back). */
const UNCLE_CHOICES = CHOICES.filter((c) => c.id !== 'end');
export const HIGH_SCORE_WARNING = "Quitting won't save your high score.";

const INK = '#ffffff';
const WARNING = '#ff9c9c';
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
  /** SCREAM-181: opened from the high score screen, with initials still to enter. */
  private fromResults = false;
  private choices = CHOICES;
  private warning: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.Pause);
  }

  preload(): void {
    loadTruckInterior(this);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(data: { paused?: string[]; fromResults?: boolean }): void {
    this.paused = data.paused ?? [];
    this.fromResults = !!data.fromResults;
    const uncle = !this.fromResults && (() => {
      try {
        const run = getEvening(this).tutorial;
        return !!run && !run.skipped && run.step !== 'done';
      } catch {
        return false;
      }
    })();
    this.choices = this.fromResults ? RESULTS_CHOICES : uncle ? UNCLE_CHOICES : CHOICES;
    this.warning = null;
    this.selected = 0;
    this.confirming = null;
    this.answer = 1;
    const { width, height } = this.scale;

    // SCREAM-123: the inside of the truck behind the menu, under a night-blue layer.
    addTruckBackdrop(this, PAUSE_SHADE).setInteractive();
    this.add.rectangle(width / 2, height / 2, 420, 300, 0x1f2a44).setStrokeStyle(3, 0x8a9bb3);
    this.add.text(width / 2, height / 2 - 110, 'PAUSED', { fontFamily: 'monospace', fontSize: '34px', color: '#ffe8a3' }).setOrigin(0.5);

    this.items = this.choices.map((c, i) =>
      this.add
        .text(width / 2, height / 2 - 40 + i * (this.choices.length > 4 ? 34 : this.choices.length > 3 ? 38 : 48), c.label, { fontFamily: 'monospace', fontSize: '24px', color: INK })
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
      // SCREAM-89: wrap inside the box, so a long question never runs off it.
      .text(width / 2, height / 2 - 15, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: INK,
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: 390 },
      })
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
    if (this.fromResults) {
      this.warning = this.add
        .text(width / 2, height / 2 + 70, HIGH_SCORE_WARNING, { fontFamily: 'monospace', fontSize: '16px', color: WARNING })
        .setOrigin(0.5)
        .setName('high-score-warning');
    }
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
    this.selected = (this.selected + step + this.choices.length) % this.choices.length;
    this.refresh();
  }

  private choose(): void {
    const choice = this.choices[this.selected]?.id ?? 'resume';
    if (choice === 'resume') this.resume();
    else if (choice === 'keys') this.showKeyBindings();
    else {
      this.confirming = choice;
      this.answer = 1;
      this.refresh();
    }
  }

  /** SCREAM-206: the Key Bindings page opens over the menu, which waits until it closes. */
  private showKeyBindings(): void {
    this.scene.pause();
    this.scene.launch(SceneKeys.KeyBindings, { opener: SceneKeys.Pause });
    this.scene.bringToTop(SceneKeys.KeyBindings);
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
      t.setText(`${i === this.selected ? '> ' : '  '}${this.choices[i]?.label ?? ''}${i === this.selected ? ' <' : '  '}`);
    });
    // SCREAM-181: the question says it instead while "Are you sure?" is up.
    this.warning?.setVisible(!asking);
    this.prompt.setVisible(asking);
    if (this.confirming === 'restart') {
      this.prompt.setText(getStory(this) ? 'Restart this evening?\nCash, stock and gas go back\nto how they were.' : "Restart this evening?\nIt won't count for high scores.");
    }
    if (this.confirming === 'end') {
      const saleOn = (() => {
        try {
          return !!getEvening(this).sale;
        } catch {
          return false;
        }
      })();
      const after = saleOn ? '\nIt ends once this sale is done.' : '';
      this.prompt.setText((getStory(this) ? 'End this evening now?\nYou keep what you made.' : 'End this evening now?\nIt still counts for high scores.') + after);
    }
    if (this.confirming === 'quit' && this.fromResults) {
      this.prompt.setText("Quit to the title screen?\nYour high score won't be saved.");
    } else if (this.confirming === 'quit') {
      this.prompt.setText(getStory(this) ? 'Quit to the title screen?\nContinue picks up at\nthe start of this evening.' : "Quit to the title screen?\nThis evening won't count.");
    }
    this.answers.forEach((t, i) => {
      const on = i === this.answer;
      const word = i === 0 ? 'Yes' : 'No';
      t.setVisible(asking).setColor(on ? HIGHLIGHT : INK).setText(on ? `> ${word} <` : `  ${word}  `);
    });
    this.hint.setText(asking ? '← →: Choose    Enter: Select    Y / N' : '↑ ↓: Choose    Enter: Select    Esc: Resume');
  }

  private confirm(): void {
    const choice = this.confirming;
    this.confirming = null;
    if (choice === 'end') {
      // SCREAM-290: the same as the Shift+3 debug key: the clock runs out now (a sale under way finishes first).
      this.resume();
      getEvening(this).endNow();
    } else if (choice === 'restart') {
      this.stopEvening();
      restartEvening(this);
    } else if (choice === 'quit') {
      this.stopEvening();
      clearStory(this);
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
    // SCREAM-181: the high score screen frozen behind the menu goes too.
    if (this.fromResults) this.scene.stop(SceneKeys.Results);
  }
}
