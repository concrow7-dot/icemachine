import * as Phaser from 'phaser';
import { counterOn } from '../state/Counter';
import { continueStory, SceneKeys, startEvening, startStory } from '../flow';
import { loadStory } from '../state/StorySave';
import { tutorialDone } from '../state/Tutorial';
import { loadHighScores } from '../state/HighScores';

/**
 * SCREAM-175 (PO, November 5): a new player plays the Tutorial first; the other modes
 * unlock once they've finished its evening (day 1). Anyone with a saved Story or a high score
 * already counts as finished, so current players aren't locked out.
 * SCREAM-205 (PO, November 8): the uncle's evening is now Story's Day 1, so a new player starts
 * with Story; Quick Play unlocks once his evening is finished (or skipped).
 */
export function modesUnlocked(): boolean {
  return tutorialDone() || !!loadStory() || (['quick', 'story', 'tutorial'] as const).some((t) => loadHighScores(t).length > 0);
}
const LOCK_NOTE = "Play Story's first day to unlock Quick Play.";
import { formatMoney } from '../util/format';
import { driveLaps, TRUCK_KEY, TRUCK_URL } from '../ui/truckLaps';
import { weekdayName } from '../state/Residents';

// Issue #4: title screen. Placeholder text until art direction (#17) is decided.
// SCREAM-53 (PO, October 30, after playtest feedback): no difficulty choice;
// one way to drive (car-style), shown here before starting.
// SCREAM-6 (PO, October 30): LimeZu's ice cream truck sits beside the title, and
// the LimeZu credit the licence asks for is shown at the bottom (decision 008).
// SCREAM-10: the Worcester map's street data needs an OpenStreetMap credit too.
// SCREAM-19 / SCREAM-21 (PO, October 31): two modes. Quick play is the
// one-evening game; Story carries cash and stock over several evenings.
// Quick play is picked first, so Enter alone starts it as before.
// SCREAM-17 (PO, October 31): with a saved Story run, the menu offers Continue
// and New story; New story asks before it overwrites the save.
// SCREAM-90 (PO, November 1): the mouse works too: point at an option to pick
// it, click to start; the New story question has Yes and No to click.
// SCREAM-107 (PO, November 2): the opening screen has the ice cream truck
// driving around it, like the winning screen: across the top, then back along
// the bottom, again and again, with music notes trailing behind (engineering's
// call: the truck plays music). The rest of the screen moved to make two lanes.

// SCREAM-146 (PO, November 4): Tutorial played one evening on the smaller tutorial map.
// SCREAM-169 (PO, November 5): the first time, the uncle always guides it. Once a player
// has finished an evening with him, he's optional (With Uncle / On My Own).
// SCREAM-205 (PO, November 8): Tutorial is off the menu; the uncle's evening is Story's Day 1.
// A new Story asks With Uncle / On My Own once his evening has been played.
type Mode = 'quick' | 'story' | 'continue';

/** SCREAM-107: the truck's two lanes, above the title and below the menu. */
const LANE_TOP = 40;
const LANE_BOTTOM = 446;
type Option = { id: Mode; label: string; locked?: boolean };


export class TitleScene extends Phaser.Scene {
  private starting = false;
  private selected = 0;
  private modeTexts: Phaser.GameObjects.Text[] = [];
  private options: Option[] = [];
  private lockNote!: Phaser.GameObjects.Text;
  /** Asking "start a new story?" over a saved run, or (SCREAM-169) "with your uncle?". */
  private confirming = false;
  /** SCREAM-169: which question the box is asking. */
  private asking: 'story' | 'uncle' = 'story';
  private confirmGroup: Phaser.GameObjects.GameObject[] = [];
  /** SCREAM-270: the open question's answers and which one is marked (test hooks). */
  answers: { label: string; pick: () => void; text: Phaser.GameObjects.Text }[] = [];
  answerSelected = 0;

  constructor() {
    super(SceneKeys.Title);
  }

  preload(): void {
    this.load.image(TRUCK_KEY, TRUCK_URL);
  }

  create(): void {
    const { width, height } = this.scale;
    driveLaps(this, {
      rows: [LANE_TOP, LANE_BOTTOM],
      scale: 0.28,
      crossMs: 4200,
      trail: '♪',
      trailColour: '#ffb6d5',
      depth: 5,
      truckName: 'title-truck',
      trailName: 'title-note',
    });

    this.starting = false;
    this.selected = 0;
    this.confirming = false;
    this.asking = 'story';
    this.confirmGroup = [];
    this.answers = [];
    const save = loadStory();
    this.options = save
      ? [
          { id: 'quick', label: 'Quick Play' },
          { id: 'continue', label: `Continue Story: ${weekdayName(save.day)}, ${formatMoney(save.cashCents)}` },
          { id: 'story', label: 'New Story' },
        ]
      : [
          { id: 'quick', label: 'Quick Play' },
          { id: 'story', label: 'Story' },
        ];
    // SCREAM-175, SCREAM-205: until the uncle's evening is finished, only Story can be picked.
    const locked = !modesUnlocked();
    if (locked) for (const o of this.options) o.locked = o.id === 'quick';
    this.selected = Math.max(0, this.options.findIndex((o) => !o.locked));

    // SCREAM-292 (PO, November 12): "Move the Title and Menu options together and Vertically center
    // the text." The title, the options and (before the uncle's evening is done) the lock note are
    // one group, centred on the screen.
    const spacing = this.options.length > 3 ? 26 : this.options.length > 2 ? 30 : 34;
    const TITLE_H = 60;
    const TITLE_GAP = 36; // engineering's call: about one line of the title's height, a little less
    const NOTE_H = locked ? 26 : 0;
    const groupH = TITLE_H + TITLE_GAP + this.options.length * spacing + NOTE_H;
    const groupTop = Math.round(height / 2 - groupH / 2);
    const firstOptionY = groupTop + TITLE_H + TITLE_GAP + spacing / 2;
    this.add
      .text(width / 2, groupTop + TITLE_H / 2, 'ICE MACHINE', { fontFamily: 'monospace', fontSize: '52px', color: '#bfe6ff' })
      .setOrigin(0.5);
    // SCREAM-286 (PO, November 12): no HOW TO DRIVE box; the drive screen's line names the keys.

    this.modeTexts = this.options.map((m, i) =>
      this.add
        .text(width / 2, firstOptionY + i * spacing, m.label, { fontFamily: 'monospace', fontSize: '24px', color: '#d6deeb' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.starting || this.confirming || this.options[i]?.locked) return;
          this.selected = i;
          this.refreshModes();
        })
        .on('pointerdown', () => {
          if (this.starting || this.confirming) return;
          if (this.options[i]?.locked) return this.flashLockNote();
          this.selected = i;
          this.chooseSelected();
        }),
    );
    this.refreshModes();
    this.lockNote = this.add
      .text(width / 2, firstOptionY + (this.options.length - 0.5) * spacing + NOTE_H / 2 + 2, locked ? LOCK_NOTE : '', { fontFamily: 'monospace', fontSize: '15px', color: '#8a9bb3' })
      .setOrigin(0.5)
      .setName('lock-note');
    // SCREAM-286: no line of keys along the bottom here.
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)   Map data © OpenStreetMap contributors   Tune: Travis Morgan (SoundEffectsFactory.com)' + (counterOn() ? '   Counts anonymous plays' : ''), { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.starting) return;
      const key = event.key;
      if (this.confirming) {
        // SCREAM-270: ← → move between a question's two answers and Enter picks the marked one.
        // A held Enter (still down from choosing New Story) doesn't count.
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          this.answerSelected = (this.answerSelected + 1) % this.answers.length;
          return this.refreshAnswers();
        }
        if (key === 'Enter') {
          if (!event.repeat) this.answers[this.answerSelected]?.pick();
          return;
        }
        if (this.asking === 'uncle') {
          if (key === 'u' || key === 'U') this.startNewStory(true);
          else if (key === 'o' || key === 'O') this.startNewStory(false);
          else if (key === 'Escape') this.closeConfirm();
          return;
        }
        if (key === 'y' || key === 'Y') this.newStory();
        else if (key === 'n' || key === 'N' || key === 'Escape') this.closeConfirm();
        return;
      }
      const n = this.options.length;
      // SCREAM-175: the arrows skip locked modes.
      const step = (d: number) => {
        let i = this.selected;
        for (let k = 0; k < n; k++) {
          i = (i + d + n) % n;
          if (!this.options[i]?.locked) return i;
        }
        return this.selected;
      };
      if (key === 'ArrowUp') this.selected = step(-1);
      else if (key === 'ArrowDown') this.selected = step(1);
      else if (key === 'Enter') return this.chooseSelected();
      this.refreshModes();
    });
  }

  /** Enter or a click on the picked option. A new story over a saved run asks first (SCREAM-17). */
  private chooseSelected(): void {
    if (this.options[this.selected]?.locked) return this.flashLockNote();
    const id = this.options[this.selected]?.id ?? 'quick';
    if (id === 'story' && loadStory()) return this.openConfirm();
    if (id === 'story') return this.newStory();
    this.start(id);
  }

  private start(id: Mode): void {
    this.starting = true;
    if (id === 'continue') {
      if (!continueStory(this)) {
        this.starting = false; // The save vanished (storage cleared): stay on the title.
        this.scene.restart();
      }
    } else startEvening(this);
  }

  /** SCREAM-205: a new Story. The first time, the uncle's evening is Day 1; after that, ask. */
  private newStory(): void {
    this.closeConfirm();
    if (tutorialDone()) return this.openUncleChoice();
    this.startNewStory(true);
  }

  private startNewStory(withUncle: boolean): void {
    this.starting = true;
    startStory(this, withUncle);
  }

  /** SCREAM-169: after a first full play, the uncle's steps can be skipped. */
  private openUncleChoice(): void {
    const { width, height } = this.scale;
    this.confirming = true;
    this.asking = 'uncle';
    this.confirmGroup = [
      this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0),
      this.add.rectangle(width / 2, height / 2, 560, 190, 0x1f2a44).setStrokeStyle(2, 0xffe066),
      this.add
        .text(width / 2, height / 2 - 30, 'Bring your uncle along again?', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5),
      ...this.addAnswers(
        [
          { x: width / 2 - 120, label: 'With Uncle (U)', pick: () => this.startNewStory(true) },
          { x: width / 2 + 120, label: 'On My Own (O)', pick: () => this.startNewStory(false) },
        ],
        0,
      ),
    ];
  }

  private openConfirm(): void {
    const { width, height } = this.scale;
    this.confirming = true;
    this.asking = 'story';
    this.confirmGroup = [
      this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0),
      this.add.rectangle(width / 2, height / 2, 560, 190, 0x1f2a44).setStrokeStyle(2, 0xffe066),
      this.add
        .text(width / 2, height / 2 - 30, 'Start a new story?\nYour saved story will be lost.', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
          align: 'center',
          lineSpacing: 8,
        })
        .setOrigin(0.5),
      // SCREAM-90: click Yes or No, or press Y or N. SCREAM-270: Enter picks the marked one,
      // which starts on No so a second Enter can't wipe a saved story by accident.
      ...this.addAnswers(
        [
          { x: width / 2 - 110, label: 'Yes, Start Over (Y)', pick: () => this.newStory() },
          { x: width / 2 + 140, label: 'No (N)', pick: () => this.closeConfirm() },
        ],
        1,
      ),
    ];
  }

  /**
   * SCREAM-270: a question's answers, in a row. A left click picks the one under the mouse;
   * ← → move the mark and Enter picks the marked one. Returns what was drawn, for the group.
   */
  private addAnswers(list: { x: number; label: string; pick: () => void }[], marked: number): Phaser.GameObjects.Text[] {
    const { width, height } = this.scale;
    this.answerSelected = marked;
    this.answers = list.map((a, i) => ({
      label: a.label,
      pick: a.pick,
      text: this.add
        .text(a.x, height / 2 + 44, a.label, { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.answerSelected = i;
          this.refreshAnswers();
        })
        .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.button === 0) a.pick();
        }),
    }));
    this.refreshAnswers();
    // SCREAM-286: no "← → Choose    Enter Or Click To Pick" line under the answers.
    return this.answers.map((a) => a.text);
  }

  private refreshAnswers(): void {
    this.answers.forEach((a, i) => {
      const on = i === this.answerSelected;
      a.text.setText(on ? `> ${a.label} <` : a.label).setColor(on ? '#ffe066' : '#8a9bb3');
    });
  }

  private closeConfirm(): void {
    this.confirming = false;
    this.answers = [];
    this.confirmGroup.forEach((o) => o.destroy());
    this.confirmGroup = [];
  }

  private refreshModes(): void {
    this.modeTexts.forEach((t, i) => {
      const on = i === this.selected;
      const label = this.options[i]?.label ?? '';
      // SCREAM-175: a locked mode is dimmed and marked.
      if (this.options[i]?.locked) return void t.setText(`${label} (Locked)`).setColor('#4d5a70');
      t.setText(on ? `> ${label} <` : label);
      t.setColor(on ? '#ffe066' : '#8a9bb3');
    });
  }

  /** SCREAM-175: a click on a locked mode makes the note say why. */
  private flashLockNote(): void {
    this.tweens.killTweensOf(this.lockNote);
    this.lockNote.setColor('#ffe066').setScale(1);
    this.tweens.add({ targets: this.lockNote, scale: 1.08, duration: 120, yoyo: true, repeat: 1, onComplete: () => this.lockNote.setColor('#8a9bb3') });
  }
}
