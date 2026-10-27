import * as Phaser from 'phaser';

type MoveKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

// Placeholder scene: proves rendering, input and physics all work.
// The blue square is a stand-in for the player until mechanics are specced.
export class TestRoomScene extends Phaser.Scene {
  private playerBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: MoveKeys;
  private readonly speed = 220; // pixels per second — tuning value, not final

  constructor() {
    super('TestRoom');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 60, 'ICE MACHINE', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#bfe6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 110, 'Move with arrow keys or WASD', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8a9bb3',
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
