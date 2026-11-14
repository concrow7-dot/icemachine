// SCREAM-312 (PO, November 14; decision 117): the exploration tip. Each Lil Explorer Pop sold
// in Story pays extra cash the further the truck is from home, measured in a straight line.
// No Phaser here, so the unit tests can check it.
import { MAPS, type MapId } from '../config/maps';
import {
  EXPLORATION_AWAY_FARTHEST_CENTS,
  EXPLORATION_AWAY_START_CENTS,
  EXPLORATION_HOME_MAX_CENTS,
  EXPLORATION_STEP_CENTS,
} from '../config/tuning';

const distance = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** The map's roundabout (the way between the maps), if it has one. */
function ringOf(mapId: MapId): { x: number; y: number } | undefined {
  return MAPS[mapId].data.roads.find((road) => road.ring)?.ring;
}

/** In $0.10 steps, rounded down: the next 10 cents is earned by going a little further. */
function toSteps(cents: number): number {
  return Math.floor(cents / EXPLORATION_STEP_CENTS + 1e-9) * EXPLORATION_STEP_CENTS;
}

/**
 * The exploration tip for one Explorer Pop sold at (x, y) on `mapId`, in cents.
 * On the home map it grows from $0 at home (where the evening starts) to $1.00 at the
 * roundabout. On the other map it starts at $1.50 at the roundabout you arrive at and grows to
 * $5.00 at the customer farthest from it (no cap beyond).
 */
export function explorationTipCents(mapId: MapId, homeMapId: MapId, x: number, y: number): number {
  if (mapId === homeMapId) {
    const home = MAPS[mapId].data.homeStart;
    const ring = ringOf(mapId);
    if (!ring) return 0;
    const share = Math.min(1, distance(home.x, home.y, x, y) / distance(home.x, home.y, ring.x, ring.y));
    return toSteps(EXPLORATION_HOME_MAX_CENTS * share);
  }
  const ring = ringOf(mapId);
  if (!ring) return 0;
  const farthest = Math.max(...MAPS[mapId].residents.map((r) => distance(ring.x, ring.y, r.curb[2], r.curb[3])));
  const share = distance(ring.x, ring.y, x, y) / farthest;
  return toSteps(EXPLORATION_AWAY_START_CENTS + (EXPLORATION_AWAY_FARTHEST_CENTS - EXPLORATION_AWAY_START_CENTS) * share);
}
