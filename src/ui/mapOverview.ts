import * as Phaser from 'phaser';
import { versioned, type GameMap } from '../config/maps';

/**
 * SCREAM-178 (PO, November 5): a zoomed-out view of a whole map, for behind the tutorial's
 * opening credits. The same pictures the drive scene paints (grass, roads, houses, trees),
 * as one container at the given scale. Parked cars and the pump bay are left out.
 */

/** Call in preload: queues the map's pictures that aren't loaded yet. */
export function loadMapOverview(scene: Phaser.Scene, map: GameMap): void {
  if (!scene.textures.exists(map.grassKey)) scene.load.image(map.grassKey, map.grassUrl);
  if (!scene.textures.exists(map.atlasKey)) scene.load.atlas(map.atlasKey, map.atlasPng, map.atlasJson);
  for (const { key } of map.data.roadTiles) {
    const textureKey = map.roadKeyPrefix + key;
    if (!scene.textures.exists(textureKey)) scene.load.image(textureKey, versioned(`${map.roadDir}/${key}.png`, map.data));
  }
}

/** The whole map, top-left at (x, y), shrunk by `scale`. */
export function addMapOverview(scene: Phaser.Scene, map: GameMap, x: number, y: number, scale: number): Phaser.GameObjects.Container {
  const { data } = map;
  const parts: Phaser.GameObjects.GameObject[] = [scene.add.tileSprite(0, 0, data.width, data.height, map.grassKey).setOrigin(0, 0)];
  const tileScale = data.roadTileScale;
  for (const t of data.roadTiles) {
    parts.push(scene.add.image(t.x, t.y, map.roadKeyPrefix + t.key).setOrigin(0, 0).setScale(tileScale));
  }
  const atlas = scene.textures.get(map.atlasKey);
  for (const o of [...data.objects].sort((a, b) => a.y - b.y)) {
    if (atlas.has(o.key)) parts.push(scene.add.image(o.x, o.y, map.atlasKey, o.key).setOrigin(0.5, 1));
  }
  return scene.add.container(x, y, parts).setScale(scale);
}
