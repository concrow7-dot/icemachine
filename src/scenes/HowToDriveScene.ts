import * as Phaser from 'phaser';
import { DRIVING_KEYS } from '../config/keyBindings';
import { HOW_TO_DRIVE_CLOSE_WAIT_MS } from '../config/tuning';
import { SceneKeys } from '../flow';

// SCREAM-207 (decision 105): "How To Drive" used to sit on the title screen (gone since 087).
// Now it is a quick pop-up the first time the player has the wheel (Story's Day 1: after the
// uncle's drive, after skipping him, or On My Own). Launched over the frozen road by
// showHowToDrive (flow.ts); closing it (Enter, Space or a click) starts the player's driving.
// The full list of keys is the pause menu's Key Bindings page (SCREAM-206).

const INK = '#ffffff';
const HIGHLIGHT = '#ffe066';
const QUIET = '#b7c2d6';
const TITLE = '#ffe8a3';

export class HowToDriveScene extends Phaser.Scene {
  /** The evening screens frozen behind the pop-up, resumed when it closes. */
  private paused: string[] = [];
  private openedAt = 0;
  private closing = false;
  /** Test hook: every line on the pop-up, "keys: what it does". */
  lines: string[] = [];

  constructor() {
    super(SceneKeys.HowToDrive);
  }

  create(data: { paused?: string[] }): void {
    this.paused = data.paused ?? [];
    this.closing = false;
    this.openedAt = this.game.getTime();
    const { width, height } = this.scale;
    const rows = DRIVING_KEYS.rows;
    const top = height / 2 - 150;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setOrigin(0.5);
    this.add.rectangle(width / 2, height / 2, 520, 320, 0x1f2a44).setStrokeStyle(3, 0x8a9bb3);
    this.add.text(width / 2, top + 32, 'HOW TO DRIVE', { fontFamily: 'monospace', fontSize: '28px', color: TITLE }).setOrigin(0.5);

    this.lines = [];
    rows.forEach(([keys, does], i) => {
      const y = top + 80 + i * 24;
      this.add.text(width / 2 - 215, y, keys, { fontFamily: 'monospace', fontSize: '16px', color: HIGHLIGHT });
      this.add.text(width / 2 - 20, y, does, { fontFamily: 'monospace', fontSize: '16px', color: INK });
      this.lines.push(`${keys}: ${does}`);
    });
    this.add
      .text(width / 2, top + 80 + rows.length * 24 + 14, 'Every Key Is Listed Under Pause > Key Bindings.', { fontFamily: 'monospace', fontSize: '13px', color: QUIET })
      .setOrigin(0.5);
    this.add
      .text(width / 2, top + 292, 'Click Or Enter: Start Driving', { fontFamily: 'monospace', fontSize: '17px', color: HIGHLIGHT })
      .setOrigin(0.5);

    // A key still held from before (Enter on the uncle's last line) or a click in the first moments doesn't close it.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.close();
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'Enter' || event.key === ' ') this.close();
    });
  }

  /** Test hook, Enter, Space and a click: back to the road, the evening running again. */
  close(): void {
    if (this.closing || this.game.getTime() - this.openedAt < HOW_TO_DRIVE_CLOSE_WAIT_MS) return;
    this.closing = true;
    for (const key of this.paused) this.scene.resume(key);
    this.scene.stop();
  }
}
