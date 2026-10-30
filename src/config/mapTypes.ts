// SCREAM-10: the shape of the generated Worcester map (src/config/worcester.ts).
// Positions are pixels from the map's top-left corner; angles are degrees
// (0 = right, 90 = down), the way the truck's heading is measured.

/** A street's centre line: x, y pairs, one after another. Two lanes, 60 px each. */
export interface MapRoad {
  name: string;
  points: number[];
}

/** A street name written along the road. */
export interface MapLabel {
  name: string;
  x: number;
  y: number;
  angle: number;
}

/** A park, field or school ground from OpenStreetMap: an outline of x, y pairs. */
export interface MapArea {
  name: string;
  kind: string;
  points: number[];
}

/** Where a customer waits: the pickup square is in the curb lane at (x, y), facing along the road. */
export interface MapCurbSpot {
  x: number;
  y: number;
  angle: number;
  customerX: number;
  customerY: number;
  street: string;
}

/** A house or tree: a LimeZu sprite, drawn with its bottom middle at (x, y). */
export interface MapObject {
  key: string;
  x: number;
  y: number;
}

export interface WorcesterMap {
  width: number;
  height: number;
  roads: MapRoad[];
  labels: MapLabel[];
  areas: MapArea[];
  /** Where the truck starts each evening: in the lane outside home. */
  homeStart: { x: number; y: number; angle: number };
  /** Home's house (a proposal for the PO: on Longfellow Road). */
  home: MapObject | null;
  curbSpots: MapCurbSpot[];
  potholes: { x: number; y: number }[];
  parkedCars: { x: number; y: number; angle: number }[];
  objects: MapObject[];
  sprites: { key: string; w: number; h: number }[];
  /** The road surface as images (sidewalk, curb, asphalt; rounded corners), drawn at `roadTileScale` times their size. */
  roadTiles: { key: string; x: number; y: number }[];
  roadTileScale: number;
  /** Where the asphalt is, for the road edge: per row of `scale` px, [start, end) pairs of columns. */
  roadMask: RoadMask;
}

export interface RoadMask {
  scale: number;
  rows: number[][];
}
