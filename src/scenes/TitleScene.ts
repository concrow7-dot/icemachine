import * as Phaser from 'phaser';
import { SceneKeys, startEvening } from '../flow';

// Issue #4: title screen. Placeholder text until art direction (#17) is decided.
// SCREAM-53 (PO, October 30, after playtest feedback): no difficulty choice;
// one way to drive (car-style), shown here before starting.
// SCREAM-6 (PO, October 30): LimeZu's ice cream truck sits beside the title, and
// the LimeZu credit the licence asks for is shown at the bottom (decision 008).
// SCREAM-10: the Worcester map's street data needs an OpenStreetMap credit too.

const TRUCK_KEY = 'limezu-ice-cream-truck';

export class TitleScene extends Phaser.Scene {
  private starting = false;

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

    this.add
      .text(width / 2, 90, 'ICE MACHINE', { fontFamily: 'monospace', fontSize: '56px', color: '#bfe6ff' })
      .setOrigin(0.5);
    // How to drive: the one set of controls.
    this.add.rectangle(width / 2, 300, 520, 180, 0x1f2a44).setStrokeStyle(2, 0x4d5a70);
    this.add.text(width / 2, 238, 'HOW TO DRIVE', { fontFamily: 'monospace', fontSize: '24px', color: '#ffe066' }).setOrigin(0.5);
    this.add
      .text(width / 2, 318, '↑ gas      ↓ brake / reverse\n← → steer      Q park brake\n\nPull up beside a customer and stop', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#d6deeb',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 70, 'Press Enter to start', { fontFamily: 'monospace', fontSize: '22px', color: '#8a9bb3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 12, 'Art: LimeZu (limezu.itch.io)    Map data © OpenStreetMap contributors', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7a93' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !this.starting) {
        this.starting = true;
        startEvening(this);
      }
    });
  }
}
