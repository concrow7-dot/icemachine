import type { WorcesterMap } from '../config/mapTypes';
import { ringOf } from './RingLaps';

// SCREAM-377 (PO, November 16): "I want to add a map to game... The map should show details like
// home and gas stations, parks." What the in-truck map marks on one of the game's maps, in that
// map's own px. Pure data, so the map screen and the tests share it.

/** The map pieces that make Elm Park's park (the same two the residents build uses, SCREAM-224). */
const PARK_PIECES = ['court_basketball', 'play_ground'];
/** How far past its pieces Elm Park's park is drawn, px. */
const PARK_PAD = 70;

export interface MapPark {
  name: string;
  /** Its outline, x, y pairs. */
  points: number[];
  /** Where its label goes: the middle of the outline. */
  x: number;
  y: number;
}

export interface MapMarks {
  home: { x: number; y: number } | null;
  gas: { x: number; y: number; name: string }[];
  parks: MapPark[];
  /** The roundabout that leads to the other map, or null if this map has none. */
  portal: { x: number; y: number; r: number } | null;
}

function middle(points: readonly number[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i += 2) {
    x += points[i]!;
    y += points[i + 1]!;
  }
  const n = Math.max(points.length / 2, 1);
  return { x: x / n, y: y / n };
}

/** The part of a map the in-truck map shows: its streets, with a margin, inside the map's edges. */
export function mapView(map: WorcesterMap, margin = 140): { x: number; y: number; w: number; h: number } {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  const take = (x: number, y: number, r = 0) => {
    left = Math.min(left, x - r);
    right = Math.max(right, x + r);
    top = Math.min(top, y - r);
    bottom = Math.max(bottom, y + r);
  };
  for (const road of map.roads) {
    if (road.ring) take(road.ring.x, road.ring.y, road.ring.r);
    else for (let i = 0; i < road.points.length; i += 2) take(road.points[i]!, road.points[i + 1]!);
  }
  if (left > right) return { x: 0, y: 0, w: map.width, h: map.height };
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(map.width, right + margin);
  bottom = Math.min(map.height, bottom + margin);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Cuts an outline (x, y pairs) down to the part inside a rectangle; empty if none of it is. */
export function clipToRect(points: readonly number[], rect: { x: number; y: number; w: number; h: number }): number[] {
  let poly: [number, number][] = [];
  for (let i = 0; i < points.length; i += 2) poly.push([points[i]!, points[i + 1]!]);
  // One edge of the rectangle at a time: keep what is on its inside.
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= rect.x, (a, b) => [rect.x, a[1] + ((b[1] - a[1]) * (rect.x - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= rect.x + rect.w, (a, b) => [rect.x + rect.w, a[1] + ((b[1] - a[1]) * (rect.x + rect.w - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= rect.y, (a, b) => [a[0] + ((b[0] - a[0]) * (rect.y - a[1])) / (b[1] - a[1]), rect.y]],
    [(p) => p[1] <= rect.y + rect.h, (a, b) => [a[0] + ((b[0] - a[0]) * (rect.y + rect.h - a[1])) / (b[1] - a[1]), rect.y + rect.h]],
  ];
  for (const [inside, cross] of edges) {
    const next: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      if (inside(a)) next.push(a);
      if (inside(a) !== inside(b)) next.push(cross(a, b));
    }
    poly = next;
    if (poly.length === 0) break;
  }
  return poly.flat();
}

export function mapMarks(map: WorcesterMap): MapMarks {
  const parks: MapPark[] = map.areas.filter((a) => a.kind === 'park').map((a) => ({ name: a.name, points: [...a.points], ...middle(a.points) }));
  // Elm Park's park is not an outline in the map's data: it is where the court and the playground stand.
  const pieces = map.objects.filter((o) => PARK_PIECES.includes(o.key));
  if (pieces.length > 0) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const o of pieces) {
      const size = map.sprites.find((s) => s.key === o.key) ?? { w: 160, h: 120 };
      // A piece is drawn with its bottom middle at (x, y).
      left = Math.min(left, o.x - size.w / 2);
      right = Math.max(right, o.x + size.w / 2);
      top = Math.min(top, o.y - size.h);
      bottom = Math.max(bottom, o.y);
    }
    left = Math.max(0, left - PARK_PAD);
    right = Math.min(map.width, right + PARK_PAD);
    top = Math.max(0, top - PARK_PAD);
    bottom = Math.min(map.height, bottom + PARK_PAD);
    const points = [left, top, right, top, right, bottom, left, bottom];
    parks.push({ name: 'Park', points, ...middle(points) });
  }
  // Only the part of each park that is on the shown map; its label goes in the middle of that part.
  const view = mapView(map);
  const shown: MapPark[] = [];
  for (const park of parks) {
    const points = clipToRect(park.points, view);
    if (points.length >= 6) shown.push({ name: park.name, points, ...middle(points) });
  }
  parks.length = 0;
  parks.push(...shown);
  const ring = ringOf(map.roads);
  return {
    home: map.home ? { x: map.home.x, y: map.home.y } : null,
    gas: map.gasStations.map((g) => ({ x: g.pad.x, y: g.pad.y, name: g.name })),
    parks,
    portal: ring ? { x: ring.x, y: ring.y, r: ring.r } : null,
  };
}
