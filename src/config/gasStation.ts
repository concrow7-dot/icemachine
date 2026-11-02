// SCREAM-22 (PO, November 2): the gas station is the real Speedway on Park
// Avenue at Chandler Street. In real life it's just past the corner, off the
// map's edge, so it sits on Park Avenue's east side just north of the corner.
// PO: it's drawn as a couple of LimeZu's charging stations side by side, as pumps.
// Hand-placed (not generated): if the map is rebuilt, check it still lines up.

/** Park Avenue's line on the map, from the Chandler Street corner northward (from worcester.ts). */
const PARK_AVE = { ax: 5485, ay: 4819, bx: 5882, by: 3662 };
const LENGTH = Math.hypot(PARK_AVE.bx - PARK_AVE.ax, PARK_AVE.by - PARK_AVE.ay);
const UX = (PARK_AVE.bx - PARK_AVE.ax) / LENGTH;
const UY = (PARK_AVE.by - PARK_AVE.ay) / LENGTH;
/** Pointing east, away from the road, toward the pumps. */
const NX = -UY;
const NY = UX;

/** How far north of the corner the station is, along Park Avenue, in px. */
const ALONG = 172;
const at = (side: number, along = ALONG) => ({ x: PARK_AVE.ax + UX * along + NX * side, y: PARK_AVE.ay + UY * along + NY * side });

export const GAS_STATION = {
  /** Where to stop: a bay in Park Avenue's east (curb) lane, turned to the road (degrees). */
  bay: { ...at(30), angle: (Math.atan2(UY, UX) * 180) / Math.PI },
  /** The concrete forecourt beside the sidewalk: centre, size along the road and out from it, angle. */
  pad: { ...at(118), length: 150, depth: 76, angle: (Math.atan2(UY, UX) * 180) / Math.PI },
  /** The two pumps, standing on the forecourt (bottom-centre of each sprite). */
  pumps: [at(112, ALONG - 28), at(112, ALONG + 28)],
  /** The "GAS" sign over the forecourt. */
  sign: at(118, ALONG + 4),
  /** The scenery house that stood on this spot (worcester.ts), left out so the station fits. */
  replaces: { key: 'house_small_3', x: 5685.5, y: 4735.6 },
};
