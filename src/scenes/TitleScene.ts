import * as Phaser from 'phaser';
import { SceneKeys, startEvening } from '../flow';
import { DIFFICULTIES, loadDifficulty, saveDifficulty, type Difficulty } from '../state/Difficulty';

// Issue #4: title screen. Placeholder text until art direction (#17) is decided.
// Difficulty (PO, October 29): picked here, and only here, before starting.
// SCREAM-6 (PO, October 30): LimeZu's ice cream truck sits beside the title, and
// the LimeZu credit the licence asks for is shown at the bottom (decision 008).

const TRUCK_KEY = 'limezu-ice-cream-truck';

const INFO: Record<Difficulty, { name: string; lines: string }> = {
  easy: { name: 'EASY', lines: 'Arrows point the way\nyou drive. Let go\nto stop.' },
  hard: { name: 'HARD', lines: 'Drive like a car:\ngas, brake, steer.\nQ: park brake.' },
};

export class TitleScene extends Phaser.Scene {
  private difficulty: Difficulty = 'easy';
  private starting = false;
  private cards: { box: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; lines: Phaser.GameObjects.Text }[] = [];

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

    this.difficulty = loadDifficulty();
    this.cards = [];
    this.starting = false;

    this.add
      .text(width / 2, 90, 'ICE MACHINE', { fontFamily: 'monospace', fontSize: '56px', color: '#bfe6ff' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 170, 'Choose a difficulty', { fontFamily: 'monospace', fontSize: '20px', color: '#d6deeb' })
      .setOrigin(0.5);

    DIFFICULTIES.forEach((d, i) => {
      const x = width / 2 + (i === 0 ? -150 : 150);
      const box = this.add
        .rectangle(x, 300, 260, 180, 0x1f2a44)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.choose(d));
      const name = this.add.text(x, 240, INFO[d].name, { fontFamily: 'monospace', fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
      const lines = this.add
        .text(x, 315, INFO[d].lines, { fontFamily: 'monospace', fontSize: '16px', color: '#b7c2d6', align: 'center', lineSpacing: 6 })
        .setOrigin(0.5);
      this.cards.push({ box, name, lines });
    });

    this.add
      .text(width / 2, height - 70, 'Press Enter to start', { fontFamily: 'monospace', fontSize: '22px', color: '#8a9bb3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 38, '← → or click: choose    You can change it here between evenings', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6b7a93',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const key = event.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.choose('easy');
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.choose('hard');
      else if (key === 'Enter' && !this.starting) {
        this.starting = true;
        startEvening(this);
      }
    });
    this.refresh();
  }

  private choose(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    saveDifficulty(difficulty);
    this.refresh();
  }

  private refresh(): void {
    DIFFICULTIES.forEach((d, i) => {
      const card = this.cards[i];
      if (!card) return;
      const on = d === this.difficulty;
      card.box.setStrokeStyle(on ? 5 : 2, on ? 0xffe066 : 0x4d5a70);
      card.name.setColor(on ? '#ffe066' : '#8a9bb3');
      card.lines.setColor(on ? '#d6deeb' : '#6b7a93');
    });
  }
}
