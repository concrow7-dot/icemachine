import * as Phaser from 'phaser';
import { getEvening, SceneKeys, startEvening } from '../flow';
import { formatMoney } from '../util/format';

// Issue #4: basic results screen. The full breakdown and the pinball-style
// high score table come in issue #16.
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Results);
  }

  create(): void {
    const { width, height } = this.scale;
    const cents = getEvening(this).moneyCents;

    this.add
      .text(width / 2, height / 2 - 90, 'THE SUN HAS SET', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#ffe8a3',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 20, `Tonight's total: ${formatMoney(cents)}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: cents < 0 ? '#ff9c9c' : '#c8f7c5',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 60, 'Enter: new evening    Esc: title screen', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#8a9bb3',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.once('keydown-ENTER', () => startEvening(this));
    keyboard?.once('keydown-ESC', () => this.scene.start(SceneKeys.Title));
  }
}
