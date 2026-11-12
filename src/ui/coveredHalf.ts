import Phaser from 'phaser';

/**
 * SCREAM-269 (PO, November 12): in Story, half of every crate is covered to start, so the
 * cooler holds 24 ice creams. The covered half is a plain panel (PO: "Plain panel"): no
 * words on it, and it takes no clicks. With `handle` it is drawn as a shut door, like the
 * door beside it (the PO's sketch: two doors on each crate, each with a handle).
 */
export function addCoveredHalf(scene: Phaser.Scene, left: number, top: number, width: number, height: number, handle = false): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0xaab4bb, 1).fillRect(0, 0, width, height);
  g.lineStyle(4, 0x7f7f7f, 1).strokeRect(2, 2, width - 4, height - 4);
  if (handle) {
    g.fillStyle(0xffffff, 1).fillRect(width / 2 - 14, height - 22, 28, 10);
    g.lineStyle(3, 0x7f7f7f, 1).strokeRect(width / 2 - 14, height - 22, 28, 10);
  }
  return scene.add.container(left, top, [g]).setDepth(11).setName('covered-half');
}

/** The freezer's dark inside and the crates' cardboard edge, as drawn in the cooler pictures. */
const FREEZER_DARK = 0x121b28;
const CRATE_EDGE = 0x968058;

/**
 * SCREAM-293 (PO, November 12: "completely remove the row highlighted in red"): in Story the
 * crates are one row shorter. The pictures have four rows baked in, so the bottom one is painted
 * over with the freezer's dark inside and the crate gets a new cardboard edge where it now ends.
 * `bottom` is where the crate ends now; `oldBottom` where the picture's crate ended.
 */
export function cutBottomRow(scene: Phaser.Scene, left: number, width: number, bottom: number, oldBottom: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(FREEZER_DARK, 1).fillRect(left - 6, bottom, width + 12, oldBottom - bottom + 8);
  g.lineStyle(4, CRATE_EDGE, 1).lineBetween(left + 1, bottom - 2, left + width - 1, bottom - 2);
  return g.setDepth(1).setName('cut-row');
}
