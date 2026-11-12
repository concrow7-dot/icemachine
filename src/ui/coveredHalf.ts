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
 * SCREAM-293 (PO, November 12: "completely remove the row highlighted in red", then "move the cooler
 * down so it is vertically aligned"): in Story the crates are one row shorter and sit lower, in the
 * middle of the freezer. The background pictures have four-row crates drawn in at the top, so the
 * old crate is painted over with the freezer's dark inside, its top three rows are copied from the
 * picture `textureKey` and drawn `drop` px lower, and the crate gets a cardboard edge where it ends.
 */
/** The middle of the freezer's dark inside, top to bottom (below the icicles and the rim). */
const FREEZER_MIDDLE_Y = 189;

/**
 * SCREAM-293: where a crate's top goes. A full-height crate stays where the picture has it
 * (`pictureTop`); a shorter one is centred in the freezer.
 */
export function crateTopFor(pictureTop: number, height: number, fullHeight: number): number {
  return height >= fullHeight ? pictureTop : Math.round(FREEZER_MIDDLE_Y - height / 2);
}

export function moveShortCrate(
  scene: Phaser.Scene,
  textureKey: string,
  left: number,
  width: number,
  top: number,
  shortH: number,
  fullH: number,
): Phaser.GameObjects.Container {
  const drop = crateTopFor(top, shortH, fullH) - top;
  const g = scene.add.graphics();
  g.fillStyle(FREEZER_DARK, 1).fillRect(left - 6, top - 3, width + 12, fullH + 12);
  const { width: screenW } = scene.scale;
  const img = scene.add.image(0, drop, textureKey).setOrigin(0, 0);
  const k = img.width / screenW; // the pictures are drawn at twice the screen's size
  img.setScale(1 / k).setCrop((left - 2) * k, (top - 1) * k, (width + 4) * k, shortH * k);
  const edge = scene.add.graphics();
  edge.lineStyle(4, CRATE_EDGE, 1).lineBetween(left + 1, top + drop + shortH - 2, left + width - 1, top + drop + shortH - 2);
  return scene.add.container(0, 0, [g, img, edge]).setDepth(1).setName('moved-crate');
}
