import * as Phaser from 'phaser';

// The ice cream truck driving back and forth across a screen, again and again,
// with something trailing behind it. SCREAM-94's victory lap (the winning
// screen) and, after SCREAM-107, the title screen.

export const TRUCK_KEY = 'limezu-ice-cream-truck';
export const TRUCK_URL = 'assets/limezu/ice_cream_truck.png';

export type LapOptions = {
  /** The heights it drives along, in turn: the first rightward, the next leftward, and so on. */
  rows: number[];
  scale: number;
  /** Milliseconds to cross the screen once. */
  crossMs: number;
  /** What pops out behind it (a "W", a music note), and in what colour. */
  trail: string;
  trailColour: string;
  depth: number;
  /** Names for the truck and the trail, so tests can find them. */
  truckName: string;
  trailName: string;
};

/** Starts the laps. Everything stops with the scene. */
export function driveLaps(scene: Phaser.Scene, o: LapOptions): Phaser.GameObjects.Image {
  const { width } = scene.scale;
  scene.textures.get(TRUCK_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  const truck = scene.add.image(-120, o.rows[0] ?? 70, TRUCK_KEY).setScale(o.scale).setDepth(o.depth).setName(o.truckName);
  const off = truck.displayWidth / 2 + 10;
  let leg = 0;
  const drive = (): void => {
    const y = o.rows[leg % o.rows.length] ?? 70;
    const rightward = leg % 2 === 0;
    leg += 1;
    truck.setFlipX(!rightward).setPosition(rightward ? -off : width + off, y);
    scene.tweens.add({ targets: truck, x: rightward ? width + off : -off, duration: o.crossMs, ease: 'Linear', onComplete: drive });
  };
  drive();
  scene.time.addEvent({
    delay: 140,
    loop: true,
    callback: () => {
      const behind = truck.flipX ? 1 : -1;
      const bit = scene.add
        .text(truck.x + behind * truck.displayWidth * 0.5, truck.y + Phaser.Math.Between(-14, 14), o.trail, {
          fontFamily: 'monospace',
          fontSize: '26px',
          color: o.trailColour,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(o.depth - 1)
        .setName(o.trailName);
      scene.tweens.add({ targets: bit, y: bit.y - 30, alpha: 0, scale: 1.4, duration: 900, onComplete: () => bit.destroy() });
    },
  });
  return truck;
}
