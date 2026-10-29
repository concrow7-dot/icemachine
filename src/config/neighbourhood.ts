// Issue #9: the neighbourhood the truck drives around. One fixed, hand-made map
// (PO decision), the same every evening, about 20 seconds to drive across.
// It is the starting point for the persistent neighbourhood in #28.
//
// Each character is one 60 x 60 pixel tile:
//   .  road (the truck can drive here)
//   #  houses and gardens (solid)
//   p  park (solid)
//   H  the player's home (solid; the evening starts on the road outside)
//
// Edit the map here; the driving scene draws whatever this says.

export const TILE_SIZE = 60;

export const NEIGHBOURHOOD_MAP: readonly string[] = [
  '################################################',
  '################################################',
  '##............................................##',
  '##............................................##',
  '##..############..#############..ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##..############.................ppppppppppp..##',
  '##..############.................ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##..############..#############..ppppppppppp..##',
  '##............................................##',
  '##............................................##',
  '##..#HHHH#######..#############..###########..##',
  '##..#HHHH#######..#############..###########..##',
  '##..#HHHH#######..############....##########..##',
  '##..#HHHH#######..############....##########..##',
  '##..############..############....##########..##',
  '##..############..##########################..##',
  '##..############..##########################..##',
  '##..############..##########################..##',
  '##............................................##',
  '##............................................##',
  '################################################',
  '################################################',
];

// Positions below are in tiles, measured from the top-left corner of the map,
// so { col: 7.5, row: 14 } is 7.5 tiles across and 14 tiles down. Halves land
// on the middle of a road, between its two lanes.

/** Where the truck starts each evening: on the road outside home, facing right. */
export const HOME_START = { col: 7.5, row: 14 };

/** Which side of a road tile the curb (and the customer on the sidewalk) is on. */
export type CurbSide = 'up' | 'down' | 'left' | 'right';

/**
 * Issue #12: curbside spots where customers wait, one at a time, picked at
 * random. Each is a road tile next to a sidewalk: the customer stands on the
 * sidewalk on `side`, and the truck picks them up by pulling into that tile
 * (the lane nearest the curb). Later these become residents' homes (#28).
 */
export const CURB_SPOTS: readonly { col: number; row: number; side: CurbSide }[] = [
  { col: 8, row: 3, side: 'down' },
  { col: 25, row: 3, side: 'down' },
  { col: 38, row: 3, side: 'down' },
  { col: 3, row: 9, side: 'right' },
  { col: 16, row: 6, side: 'left' },
  { col: 22, row: 8, side: 'up' },
  { col: 28, row: 9, side: 'down' },
  { col: 32, row: 6, side: 'right' },
  { col: 44, row: 10, side: 'left' },
  { col: 12, row: 14, side: 'down' },
  { col: 25, row: 13, side: 'up' },
  { col: 40, row: 14, side: 'down' },
  { col: 30, row: 18, side: 'left' },
  { col: 17, row: 20, side: 'right' },
  { col: 3, row: 20, side: 'right' },
  { col: 9, row: 23, side: 'up' },
  { col: 37, row: 23, side: 'up' },
];

/**
 * Issue #10: potholes, at the centre of these road tiles. Driving over one
 * spins the truck round and stops it. Placed away from customer spots.
 * 7 of them (down from 10, PO testing PR #40).
 */
export const POTHOLES: readonly { col: number; row: number }[] = [
  { col: 20, row: 2 },
  { col: 6, row: 24 },
  { col: 28, row: 23 },
  { col: 45, row: 6 },
  { col: 2, row: 17 },
  { col: 24, row: 8 },
  { col: 36, row: 13 },
];

/**
 * Issue #10: cars parked in the curb lane of these road tiles, against the
 * curb on `side`. Solid, like the road edge. Placed away from customer spots.
 * 24 of them (3x the first 8, PO testing PR #40). Each sits on a straight
 * stretch with the other lane clear, so no road is ever fully blocked.
 */
export const PARKED_CARS: readonly { col: number; row: number; side: CurbSide }[] = [
  { col: 14, row: 3, side: 'down' },
  { col: 30, row: 2, side: 'up' },
  { col: 3, row: 15, side: 'right' },
  { col: 19, row: 14, side: 'down' },
  { col: 43, row: 23, side: 'up' },
  { col: 16, row: 21, side: 'left' },
  { col: 45, row: 18, side: 'right' },
  { col: 21, row: 24, side: 'down' },
  { col: 42, row: 2, side: 'up' },
  { col: 32, row: 23, side: 'up' },
  { col: 2, row: 5, side: 'left' },
  { col: 29, row: 13, side: 'up' },
  { col: 22, row: 2, side: 'up' },
  { col: 38, row: 13, side: 'up' },
  { col: 36, row: 2, side: 'up' },
  { col: 20, row: 8, side: 'up' },
  { col: 44, row: 8, side: 'left' },
  { col: 26, row: 8, side: 'up' },
  { col: 14, row: 13, side: 'up' },
  { col: 11, row: 23, side: 'up' },
  { col: 26, row: 23, side: 'up' },
  { col: 6, row: 2, side: 'up' },
  { col: 10, row: 2, side: 'up' },
  { col: 2, row: 11, side: 'left' },
];
