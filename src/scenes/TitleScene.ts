import * as Phaser from 'phaser';
import { continueStory, SceneKeys, startEvening, startStory } from '../flow';
import { loadStory } from '../state/StorySave';
import { formatMoney } from '../util/format';

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

type Mode = 'quick' | 'story' | 'continue';
type Option = { id: Mode; label: string };

const TRUCK_KEY = 'limezu-ice-cream-truck';

export class TitleScene extends Phaser.Scene {
  private starting = false;
  private selected = 0;
  private modeTexts: Phaser.GameObjects.Text[] = [];
  private options: Option[] = [];
  /** Asking "start a new story?" over a saved run. */
  private confirming = false;
  private confirmGroup: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKeys.Title);
  }

  preload(): void {
    this.load.image(TRUCK_KEY, 'assets/limezu/ice_cream_truck.png');
  }

  create(): void {
    const { width, height } = this.scale;
    // Pixel art stays crisp when scaled (only this texture: the text stays smooth).
    this.textures.get(TRUCK_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(150, 92, TRUCK_KEY).setScale(0.5);

    this.starting = false;
    this.selected = 0;
    this.confirming = false;
    this.confirmGroup = [];
    const save = loadStory();
    this.options = save
      ? [
          { id: 'quick', label: 'Quick play' },
          { id: 'continue', label: `Continue story: day ${save.day}, ${formatMoney(save.cashCents)}` },
          { id: 'story', label: 'New story' },
        ]
      : [
          { id: 'quick', label: 'Quick play' },
          { id: 'story', label: 'Story' },
        ];

    this.add
      .text(width / 2, 90, 'ICE MACHINE', { fontFamily: 'monospace', fontSize: '56px', color: '#bfe6ff' })
      .setOrigin(0.5);
    // How to drive: the one set of controls.
    this.add.rectangle(width / 2, 260, 520, 170, 0x1f2a44).setStrokeStyle(2, 0x4d5a70);
    this.add.text(width / 2, 202, 'HOW TO DRIVE', { fontFamily: 'monospace', fontSize: '24px', color: '#ffe066' }).setOrigin(0.5);
    this.add
      .text(width / 2, 276, '↑ gas      ↓ brake / reverse\n← → steer      Q park brake\n\nPull up beside a customer and stop', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#d6deeb',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    const spacing = this.options.length > 2 ? 32 : 36;
    this.modeTexts = this.options.map((m, i) =>
      this.add
        .text(width / 2, 372 + i * spacing, m.label, { fontFamily: 'monospace', fontSize: '24px', color: '#d6deeb' })
        .setOrigin(0.5),
    );
    this.refreshModes();
    this.add
      .text(width / 2, height - 58, '↑ ↓ choose    Press Enter to start', { fontFamily: 'monospace', fontSize: '20px', color: '#8a9bb3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)    Map data © OpenStreetMap contributors', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.starting) return;
      const key = event.key;
      if (this.confirming) {
        if (key === 'y' || key === 'Y') this.start('story');
        else if (key === 'n' || key === 'N' || key === 'Escape') this.closeConfirm();
        return;
      }
      const n = this.options.length;
      if (key === 'ArrowUp') this.selected = (this.selected - 1 + n) % n;
      else if (key === 'ArrowDown') this.selected = (this.selected + 1) % n;
      else if (key === 'Enter') {
        const id = this.options[this.selected]?.id ?? 'quick';
        // A new story over a saved run asks first (SCREAM-17).
        if (id === 'story' && loadStory()) return this.openConfirm();
        return this.start(id);
      }
      this.refreshModes();
    });
  }

  private start(id: Mode): void {
    this.starting = true;
    if (id === 'story') startStory(this);
    else if (id === 'continue') {
      if (!continueStory(this)) {
        this.starting = false; // The save vanished (storage cleared): stay on the title.
        this.scene.restart();
      }
    } else startEvening(this);
  }

  private openConfirm(): void {
    const { width, height } = this.scale;
    this.confirming = true;
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
      this.add
        .text(width / 2, height / 2 + 50, 'Y: yes, start over    N: no', { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066' })
        .setOrigin(0.5),
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
