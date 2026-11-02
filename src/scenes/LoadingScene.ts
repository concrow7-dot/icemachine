import * as Phaser from 'phaser';
import { SceneKeys } from '../flow';
import { TRUCK_KEY, TRUCK_URL } from '../ui/truckLaps';

// SCREAM-75 (PO, November 2): any loading screen shows the ice cream truck driving
// back and forth, like the winning screen, a row lower each time, leaving a trail of
// music notes that stays, so the page slowly fills up while the game loads.
//
// A scene that loads things calls showLoadingWhileLoading(this) at the end of its
// preload(). The loading screen runs as its own scene on top (a scene that's still
// loading doesn't animate), and stops when the loading is done. Quick loads (under
// SHOW_AFTER_MS) never show it, so there's no flash.

const SHOW_AFTER_MS = 150;
const ROW_GAP = 56;
const CROSS_MS = 1600;
const NOTES = ['♪', '♫'];
const COLOURS = ['#ff9ec4', '#ffe066', '#9be7ff', '#c8f7c5'];

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Loading);
  }

  preload(): void {
    if (!this.textures.exists(TRUCK_KEY)) this.load.image(TRUCK_KEY, TRUCK_URL);
  }

  create(): void {
    const { width, height } = this.scale;
    this.scene.bringToTop();
    const layer = this.add.container(0, 0).setAlpha(0).setName('loading-layer');
    layer.add(this.add.rectangle(0, 0, width, height, 0x1b2230).setOrigin(0, 0));
    layer.add(this.add.text(width / 2, height - 28, 'Loading...', { fontFamily: 'monospace', fontSize: '20px', color: '#8a9bb3' }).setOrigin(0.5));
    this.time.delayedCall(SHOW_AFTER_MS, () => layer.setAlpha(1));

    this.textures.get(TRUCK_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const truck = this.add.image(-200, 0, TRUCK_KEY).setScale(0.28).setName('loading-truck');
    layer.add(truck);
    const off = truck.displayWidth / 2 + 10;
    const rows = Math.max(1, Math.floor((height - 60) / ROW_GAP));
    let leg = 0;
    const drive = (): void => {
      // Top to bottom, a row lower each lap; then round again over the notes already there.
      const y = 40 + (leg % rows) * ROW_GAP;
      const rightward = leg % 2 === 0;
      leg += 1;
      truck.setFlipX(!rightward).setPosition(rightward ? -off : width + off, y);
      this.tweens.add({ targets: truck, x: rightward ? width + off : -off, duration: CROSS_MS, ease: 'Linear', onComplete: drive });
    };
    drive();
    let n = 0;
    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        const behind = truck.flipX ? 1 : -1;
        n += 1;
        const note = this.add
          .text(truck.x + behind * truck.displayWidth * 0.5, truck.y + Phaser.Math.Between(-24, 24), NOTES[n % NOTES.length] ?? '♪', {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: COLOURS[n % COLOURS.length] ?? '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setName('loading-note');
        // The notes stay where they land, under the truck, so the page fills up.
        layer.addAt(note, 1);
      },
    });
  }
}

/**
 * Call at the end of a scene's preload(): if it has anything to load, the loading
 * screen runs on top until the loading is done.
 */
export function showLoadingWhileLoading(scene: Phaser.Scene): void {
  if (scene.load.list.size === 0) return;
  const loading = scene.scene.get(SceneKeys.Loading);
  scene.registry.set('loadingShown', (Number(scene.registry.get('loadingShown')) || 0) + 1);
  scene.scene.launch(SceneKeys.Loading);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (loading.scene.isActive() || loading.scene.isPaused()) scene.scene.stop(SceneKeys.Loading);
    else loading.events.once(Phaser.Scenes.Events.CREATE, () => scene.scene.stop(SceneKeys.Loading));
  });
}
