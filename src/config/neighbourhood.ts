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

/**
 * Road tiles where customers wait, in the order they appear (one at a time).
 * Placeholder for #12, which decides how many customers there are and when they leave.
 */
export const CUSTOMER_SPOTS: readonly { col: number; row: number }[] = [
  { col: 11.5, row: 3 },
  { col: 24.5, row: 9 },
  { col: 40.5, row: 14 },
  { col: 32, row: 18.5 },
  { col: 17, row: 20.5 },
  { col: 38.5, row: 24 },
  { col: 3, row: 7.5 },
];
