import * as Phaser from 'phaser';
import { SceneKeys, startEvening, startStory } from '../flow';

// Issue #4: title screen. Placeholder text until art direction (#17) is decided.
// SCREAM-53 (PO, October 30, after playtest feedback): no difficulty choice;
// one way to drive (car-style), shown here before starting.
// SCREAM-6 (PO, October 30): LimeZu's ice cream truck sits beside the title, and
// the LimeZu credit the licence asks for is shown at the bottom (decision 008).
// SCREAM-10: the Worcester map's street data needs an OpenStreetMap credit too.
// SCREAM-19 / SCREAM-21 (PO, October 31): two modes. Quick play is the
// one-evening game; Story carries cash and stock over several evenings.
// Quick play is picked first, so Enter alone starts it as before.
// SCREAM-90 (PO, November 1): the mouse works too: point at an option to pick
// it, click to start.

type Mode = 'quick' | 'story';
const MODES: { id: Mode; label: string }[] = [
  { id: 'quick', label: 'Quick play' },
  { id: 'story', label: 'Story' },
];

const TRUCK_KEY = 'limezu-ice-cream-truck';

export class TitleScene extends Phaser.Scene {
  private starting = false;
  private selected = 0;
  private modeTexts: Phaser.GameObjects.Text[] = [];

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

    this.modeTexts = MODES.map((m, i) =>
      this.add
        .text(width / 2, 380 + i * 36, m.label, { fontFamily: 'monospace', fontSize: '24px', color: '#d6deeb' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.starting) return;
          this.selected = i;
          this.refreshModes();
        })
        .on('pointerdown', () => {
          this.selected = i;
          this.startSelected();
        }),
    );
    this.refreshModes();
    this.add
      .text(width / 2, height - 58, '↑ ↓ or mouse: choose    Press Enter or click to start', { fontFamily: 'monospace', fontSize: '20px', color: '#8a9bb3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)    Map data © OpenStreetMap contributors', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.starting) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        this.selected = (this.selected + 1) % MODES.length;
        this.refreshModes();
      } else if (event.key === 'Enter') {
        this.startSelected();
      }
    });
  }

  private startSelected(): void {
    if (this.starting) return;
    this.starting = true;
    if (MODES[this.selected]?.id === 'story') startStory(this);
    else startEvening(this);
  }

  private refreshModes(): void {
    this.modeTexts.forEach((t, i) => {
      const on = i === this.selected;
      t.setText(on ? `> ${MODES[i]?.label} <` : MODES[i]?.label ?? '');
      t.setColor(on ? '#ffe066' : '#8a9bb3');
    });
  }
}
