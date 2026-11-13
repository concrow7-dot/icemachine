import * as Phaser from 'phaser';
import { GAS_CAN_POP_MS, GAS_CAN_PULSES } from '../config/tuning';
import { SceneKeys } from '../flow';
import { drawGasCan } from '../ui/powerUpLogo';

// SCREAM-122 (PO, November 13): "The game should pause and the temporary gas tank should pop
// onto the screen pulse a few times and then go away." Launched over the frozen road by
// showGasCan (flow.ts) when the tank runs empty and the can pours itself in.

export class GasCanScene extends Phaser.Scene {
  /** The evening screens frozen behind the can, resumed when it goes away. */
  private paused: string[] = [];
  /** Test hook: the can on screen. */
  can!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.GasCan);
  }

  create(data: { paused?: string[] }): void {
    this.paused = data.paused ?? [];
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0, 0);
    this.can = this.add.container(width / 2, height / 2);
    const g = this.add.graphics();
    drawGasCan(g, 200, false);
    this.can.add(g);

    // Pops in, pulses, pops out: together GAS_CAN_POP_MS.
    const pop = 180;
    const pulse = (GAS_CAN_POP_MS - pop * 2) / (GAS_CAN_PULSES * 2);
    this.can.setScale(0);
    this.tweens.chain({
      targets: this.can,
      tweens: [
        { scale: 1, duration: pop, ease: 'Back.easeOut' },
        { scale: 1.18, duration: pulse, ease: 'Sine.easeInOut', yoyo: true, repeat: GAS_CAN_PULSES - 1 },
        { scale: 0, duration: pop, ease: 'Back.easeIn' },
      ],
      onComplete: () => this.finish(),
    });
  }

  private finish(): void {
    for (const key of this.paused) this.scene.resume(key);
    this.scene.stop();
  }
}
