import * as Phaser from 'phaser';
import { continueStory, SceneKeys, startEvening, startStory } from '../flow';
import { loadStory } from '../state/StorySave';
import { tutorialDone } from '../state/Tutorial';
import { formatMoney } from '../util/format';
import { driveLaps, TRUCK_KEY, TRUCK_URL } from '../ui/truckLaps';

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

// SCREAM-146 (PO, November 4): Tutorial plays one evening on the smaller tutorial map.
// SCREAM-169 (PO, November 5): the first time, the uncle always guides it. Once a player
// has finished an evening with him, Tutorial asks whether to bring him along or go alone.
type Mode = 'quick' | 'story' | 'continue' | 'tutorial';

/** SCREAM-107: the truck's two lanes, above the title and below the menu. */
const LANE_TOP = 40;
const LANE_BOTTOM = 446;
type Option = { id: Mode; label: string };


export class TitleScene extends Phaser.Scene {
  private starting = false;
  private selected = 0;
  private modeTexts: Phaser.GameObjects.Text[] = [];
  private options: Option[] = [];
  /** Asking "start a new story?" over a saved run, or (SCREAM-169) "with your uncle?". */
  private confirming = false;
  /** SCREAM-169: which question the box is asking. */
  private asking: 'story' | 'uncle' = 'story';
  private confirmGroup: Phaser.GameObjects.GameObject[] = [];

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
    const save = loadStory();
    this.options = save
      ? [
          { id: 'quick', label: 'Quick Play' },
          { id: 'continue', label: `Continue Story: Day ${save.day}, ${formatMoney(save.cashCents)}` },
          { id: 'story', label: 'New Story' },
          { id: 'tutorial', label: 'Tutorial' },
        ]
      : [
          { id: 'quick', label: 'Quick Play' },
          { id: 'story', label: 'Story' },
          { id: 'tutorial', label: 'Tutorial' },
        ];

    this.add
      .text(width / 2, 112, 'ICE MACHINE', { fontFamily: 'monospace', fontSize: '52px', color: '#bfe6ff' })
      .setOrigin(0.5);
    // How to drive: the one set of controls.
    this.add.rectangle(width / 2, 238, 520, 150, 0x1f2a44).setStrokeStyle(2, 0x4d5a70);
    this.add.text(width / 2, 186, 'HOW TO DRIVE', { fontFamily: 'monospace', fontSize: '24px', color: '#ffe066' }).setOrigin(0.5);
    this.add
      .text(width / 2, 252, '↑ Gas      ↓ Brake / Reverse\n← → Steer      Q Park Brake\n\nPull up beside a customer and stop.', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#d6deeb',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    const spacing = this.options.length > 3 ? 26 : this.options.length > 2 ? 30 : 34;
    this.modeTexts = this.options.map((m, i) =>
      this.add
        .text(width / 2, 345 + i * spacing, m.label, { fontFamily: 'monospace', fontSize: '24px', color: '#d6deeb' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.starting || this.confirming) return;
          this.selected = i;
          this.refreshModes();
        })
        .on('pointerdown', () => {
          if (this.starting || this.confirming) return;
          this.selected = i;
          this.chooseSelected();
        }),
    );
    this.refreshModes();
    this.add
      .text(width / 2, height - 32, '↑ ↓ Or Mouse: Choose    Press Enter Or Click To Start', { fontFamily: 'monospace', fontSize: '16px', color: '#8a9bb3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)    Map data © OpenStreetMap contributors', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.starting) return;
      const key = event.key;
      if (this.confirming && this.asking === 'uncle') {
        if (key === 'u' || key === 'U') this.startTutorial(true);
        else if (key === 'o' || key === 'O') this.startTutorial(false);
        else if (key === 'Escape') this.closeConfirm();
        return;
      }
      if (this.confirming) {
        if (key === 'y' || key === 'Y') this.start('story');
        else if (key === 'n' || key === 'N' || key === 'Escape') this.closeConfirm();
        return;
      }
      const n = this.options.length;
      if (key === 'ArrowUp') this.selected = (this.selected - 1 + n) % n;
      else if (key === 'ArrowDown') this.selected = (this.selected + 1) % n;
      else if (key === 'Enter') return this.chooseSelected();
      this.refreshModes();
    });
  }

  /** Enter or a click on the picked option. A new story over a saved run asks first (SCREAM-17). */
  private chooseSelected(): void {
    const id = this.options[this.selected]?.id ?? 'quick';
    if (id === 'story' && loadStory()) return this.openConfirm();
    if (id === 'tutorial' && tutorialDone()) return this.openUncleChoice();
    this.start(id);
  }

  private start(id: Mode): void {
    this.starting = true;
    if (id === 'story') startStory(this);
    else if (id === 'continue') {
      if (!continueStory(this)) {
        this.starting = false; // The save vanished (storage cleared): stay on the title.
        this.scene.restart();
      }
    } else if (id === 'tutorial') startEvening(this, 'tutorial', true);
    else startEvening(this);
  }

  private startTutorial(guided: boolean): void {
    this.starting = true;
    startEvening(this, 'tutorial', guided);
  }

  /** SCREAM-169: after a first full play, the uncle's steps can be skipped. */
  private openUncleChoice(): void {
    const { width, height } = this.scale;
    this.confirming = true;
    this.asking = 'uncle';
    const option = (x: number, label: string, guided: boolean) =>
      this.add
        .text(x, height / 2 + 50, label, { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.startTutorial(guided));
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
      option(width / 2 - 120, 'With Uncle (U)', true),
      option(width / 2 + 120, 'On My Own (O)', false),
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
      // SCREAM-90: click Yes or No, or press Y or N.
      this.add
        .text(width / 2 - 110, height / 2 + 50, 'Yes, Start Over (Y)', { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.start('story')),
      this.add
        .text(width / 2 + 140, height / 2 + 50, 'No (N)', { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.closeConfirm()),
    ];
  }

  private closeConfirm(): void {
    this.confirming = false;
    this.confirmGroup.forEach((o) => o.destroy());
    this.confirmGroup = [];
  }

  private refreshModes(): void {
    this.modeTexts.forEach((t, i) => {
      const on = i === this.selected;
      const label = this.options[i]?.label ?? '';
      t.setText(on ? `> ${label} <` : label);
      t.setColor(on ? '#ffe066' : '#8a9bb3');
    });
  }
}
