import * as Phaser from 'phaser';

// SCREAM-115: the driving truck's four views, built by tools/truck/build_truck.py from
// LimeZu Modern Exteriors: the title screen's ice cream truck for left and right, and
// the pack's ambulance repainted in its colours (with the cone on the roof) for up and down.

export const TRUCK_VIEWS_KEY = 'truck-views';
export const TRUCK_VIEWS_URL = 'assets/limezu/truck_views.png';
/** Each view sits in a square frame this many px across (16 px art). */
export const TRUCK_VIEW_FRAME = 110;

/** Frames in truck_views.png, in this order: facing right, down, left, up (0, 90, 180, 270 degrees). */
export const TRUCK_VIEW_NAMES = ['right', 'down', 'left', 'up'] as const;

/**
 * Where the middle of the truck's footprint is in each frame, from the top (0 to 1).
 * The views are drawn from slightly above, so the roof and cone stick up above it:
 * the side views' wheels and the front and back bumpers sit on the bump box's edge.
 */
export const TRUCK_VIEW_ORIGIN_Y = [0.68, 0.53, 0.68, 0.48];

/** Loads the sheet if it isn't loaded yet. Call from a scene's preload(). */
export function loadTruckViews(scene: Phaser.Scene): void {
  if (scene.textures.exists(TRUCK_VIEWS_KEY)) return;
  scene.load.spritesheet(TRUCK_VIEWS_KEY, TRUCK_VIEWS_URL, { frameWidth: TRUCK_VIEW_FRAME, frameHeight: TRUCK_VIEW_FRAME });
}

/**
 * Within this many degrees of straight left or right, the truck shows its side view;
 * otherwise its front or back view (seen mostly from above), tilted to the heading.
 * The side view looks wrong tilted far (it seems to tip over), but the front and back
 * views tilt well, so they cover the diagonals. Tests and playtests can change it.
 */
export const TRUCK_SIDE_VIEW_DEGREES = 25;

/** Which view to show for a heading in degrees (0 = right, 90 = down): 0 right, 1 down, 2 left, 3 up. */
export function truckView(degrees: number, sideDegrees = TRUCK_SIDE_VIEW_DEGREES): number {
  const d = ((degrees % 360) + 360) % 360;
  if (d <= sideDegrees || d >= 360 - sideDegrees) return 0;
  if (Math.abs(d - 180) <= sideDegrees) return 2;
  return d < 180 ? 1 : 3;
}
