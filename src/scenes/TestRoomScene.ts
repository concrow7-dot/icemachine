import * as Phaser from 'phaser';
import { getEvening, SceneKeys } from '../flow';

type MoveKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

// Placeholder for evening gameplay until the truck hub (#7) and driving (#9)
// are built. Includes temporary debug keys for testing the clock and money.
export class TestRoomScene extends Phaser.Scene {
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: MoveKeys;
  private readonly speed = 220; // pixels per second — tuning value, not final

  constructor() {
    super(SceneKeys.TestRoom);
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 90, 'Evening gameplay goes here', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#bfe6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 130, 'Move with arrow keys or WASD', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8a9bb3',
      })
      .setOrigin(0.5);

    // TEMPORARY debug keys for testing issues #5 and #6. Remove once real
    // sales (#15) and damage (#10) exist.
    this.add
      .text(width / 2, height - 40, 'DEBUG  1: fake sale +$4.50   2: fake damage -$2.00   3: end evening now', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#d9a0ff',
      })
      .setOrigin(0.5);

    // Player stand-in: a 32x32 square with a physics body.
    const square = this.add.rectangle(width / 2, height / 2, 32, 32, 0x5ec8ff);
    this.physics.add.existing(square);
    this.playerBody = square.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as MoveKeys;

    const evening = getEvening(this);
    keyboard.on('keydown-ONE', () => evening.changeMoney(450, 'Sale'));
    keyboard.on('keydown-TWO', () => evening.changeMoney(-200, 'Damage'));
    keyboard.on('keydown-THREE', () => evening.endNow());
  }

  update(): void {
    const body = this.playerBody;
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    body.setVelocity(0);
    if (left) body.setVelocityX(-this.speed);
    if (right) body.setVelocityX(this.speed);
    if (up) body.setVelocityY(-this.speed);
    if (down) body.setVelocityY(this.speed);

    // Keep diagonal movement the same speed as straight movement.
    body.velocity.normalize().scale(this.speed);
    if (!left && !right && !up && !down) body.setVelocity(0);
  }
}
