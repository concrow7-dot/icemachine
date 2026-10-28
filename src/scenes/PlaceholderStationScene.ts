import * as Phaser from 'phaser';
import { returnToTruck, SceneKeys, type Station } from '../flow';

// Temporary screens for stations that aren't built yet, so the truck hub (#7)
// can be tested end to end. Replaced by the real cooler (#8) and window (#13).

abstract class PlaceholderStationScene extends Phaser.Scene {
  protected abstract readonly station: Station;
  protected abstract readonly title: string;
  protected abstract readonly comingIn: string;

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 44, width, height - 44, 0x2a3446).setOrigin(0, 0);

    this.add
      .text(width / 2, height / 2 - 40, this.title, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#bfe6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, this.comingIn, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8a9bb3',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 70, 'Backspace or B: back to the truck', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffe8a3',
      })
      .setOrigin(0.5);

    const back = () => returnToTruck(this, this.station);
    this.input.keyboard?.once('keydown-BACKSPACE', back);
    this.input.keyboard?.once('keydown-B', back);
  }
}

export class CoolerScene extends PlaceholderStationScene {
  protected readonly station = 'cooler';
  protected readonly title = 'THE COOLER';
  protected readonly comingIn = 'Stocking up comes in issue #8';

  constructor() {
    super(SceneKeys.Cooler);
  }
}

export class WindowScene extends PlaceholderStationScene {
  protected readonly station = 'window';
  protected readonly title = 'THE WINDOW';
  protected readonly comingIn = 'Taking orders comes in issue #13';

  constructor() {
    super(SceneKeys.Window);
  }
}
