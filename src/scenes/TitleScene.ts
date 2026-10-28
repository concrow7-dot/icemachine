import * as Phaser from 'phaser';
import { SceneKeys, startEvening } from '../flow';

// Issue #4: title screen. Placeholder text until art direction (#17) is decided.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 40, 'ICE MACHINE', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#bfe6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, 'Press Enter to start', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#8a9bb3',
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown-ENTER', () => startEvening(this));
  }
}
