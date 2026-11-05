import type { Resident } from '../state/Residents';
import type { WorcesterMap } from './mapTypes';
import { RESIDENTS } from './residents';
import { TUTORIAL } from './tutorial';
import { TUTORIAL_RESIDENTS } from './tutorialResidents';
import { WORCESTER } from './worcester';

// SCREAM-146 (PO, November 4): a second, smaller map for the tutorial, with its own
// residents (sheet 23, "Tutorial residents"). Each map has its own picture files and
// texture keys, so both can stay loaded. The evening being played says which map it's
// on (EveningState sets it when it starts); scenes read it from here.

export type MapId = 'worcester' | 'tutorial';

export interface GameMap {
  id: MapId;
  data: WorcesterMap;
  residents: Resident[];
  /** Texture keys and files. */
  atlasKey: string;
  atlasPng: string;
  atlasJson: string;
  grassKey: string;
  grassUrl: string;
  /** A road image's texture key is this plus its key in data.roadTiles; its file is in roadDir. */
  roadKeyPrefix: string;
  roadDir: string;
  residentsKey: string;
  residentsUrl: string;
}

/**
 * SCREAM-160: picture files keep the same names when a map changes, so a browser could use an
 * old picture sheet with new map data (every piece then drawn as the whole sheet). A map built
 * from Tiled carries a version that's added to its picture URLs, so a change means a fresh download.
 */
export function versioned(url: string, data: WorcesterMap): string {
  return data.assetVersion ? `${url}?v=${data.assetVersion}` : url;
}

export const MAPS: Record<MapId, GameMap> = {
  worcester: {
    id: 'worcester',
    data: WORCESTER,
    residents: RESIDENTS,
    atlasKey: 'map-atlas',
    atlasPng: 'assets/limezu/map/atlas.png',
    atlasJson: 'assets/limezu/map/atlas.json',
    grassKey: 'map-grass',
    grassUrl: 'assets/limezu/map/grass.png',
    roadKeyPrefix: 'map-',
    roadDir: 'assets/map',
    residentsKey: 'residents',
    residentsUrl: 'assets/limezu/residents.png',
  },
  tutorial: {
    id: 'tutorial',
    data: TUTORIAL,
    residents: TUTORIAL_RESIDENTS,
    atlasKey: 'tut-atlas',
    atlasPng: versioned('assets/limezu/map-tutorial/atlas.png', TUTORIAL),
    atlasJson: versioned('assets/limezu/map-tutorial/atlas.json', TUTORIAL),
    grassKey: 'tut-grass',
    grassUrl: 'assets/limezu/map-tutorial/grass.png',
    roadKeyPrefix: 'tut-',
    roadDir: 'assets/map-tutorial',
    residentsKey: 'residents-tutorial',
    residentsUrl: 'assets/limezu/residents-tutorial.png',
  },
};

let current: MapId = 'worcester';

/** Called by EveningState when an evening starts. */
export function setCurrentMap(id: MapId): void {
  current = id;
}

/** The map the evening in progress is on (Worcester until an evening says otherwise). */
export function currentMap(): GameMap {
  return MAPS[current];
}
