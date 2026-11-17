// SCREAM-377 (PO, November 16): "I want to add a map to game. The map should show the elm park map,
// and then once the player teleports to the other map, that map should become available too...
// The map should show details like home and gas stations, parks."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const MapMarksModule = await game('state/MapMarks');
const { mapMarks } = MapMarksModule;
const { MAPS } = await game('config/maps');

test('Elm Park: home, one gas station, the park round the court and the playground, and the roundabout', () => {
  const data = MAPS.tutorial.data;
  const m = mapMarks(data);
  assert.deepEqual(m.home, { x: data.home.x, y: data.home.y });
  assert.equal(m.gas.length, 1);
  assert.equal(m.parks.length, 1);
  const [park] = m.parks;
  for (const piece of data.objects.filter((o) => ['court_basketball', 'play_ground'].includes(o.key))) {
    assert.ok(piece.x > park.points[0] && piece.x < park.points[2] && piece.y > park.points[1] && piece.y <= park.points[5], `${piece.key} is inside the park`);
  }
  assert.ok(m.portal && m.portal.r > 0);
});

test('Foley Stadium: two gas stations, its three parks by name, and its roundabout', () => {
  const m = mapMarks(MAPS.worcester.data);
  assert.equal(m.gas.length, 2);
  assert.deepEqual(m.parks.map((p) => p.name).sort(), ['Beaver Brook Park', 'General Foley Stadium', 'Newton Hill at Elm Park']);
  assert.ok(m.portal);
  for (const p of m.parks) assert.ok(p.x > 0 && p.x < MAPS.worcester.data.width && p.y > 0 && p.y < MAPS.worcester.data.height);
});

test('the shown part of each map holds every street, and every park outline is cut to it', () => {
  const { mapView, clipToRect } = MapMarksModule;
  for (const id of ['tutorial', 'worcester']) {
    const data = MAPS[id].data;
    const v = mapView(data);
    assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= data.width && v.y + v.h <= data.height, id);
    for (const road of data.roads) {
      if (road.ring) continue;
      for (let i = 0; i < road.points.length; i += 2) assert.ok(road.points[i] >= v.x && road.points[i] <= v.x + v.w && road.points[i + 1] >= v.y && road.points[i + 1] <= v.y + v.h, `${id}: ${road.name}`);
    }
    for (const park of mapMarks(data).parks) {
      for (let i = 0; i < park.points.length; i += 2) assert.ok(park.points[i] >= v.x - 0.01 && park.points[i] <= v.x + v.w + 0.01 && park.points[i + 1] >= v.y - 0.01 && park.points[i + 1] <= v.y + v.h + 0.01, `${id}: ${park.name}`);
    }
  }
  const half = clipToRect([0, 0, 10, 0, 10, 10, 0, 10], { x: 5, y: 0, w: 20, h: 20 });
  assert.equal(half.length, 8);
  assert.deepEqual([Math.min(...half.filter((_, i) => i % 2 === 0)), Math.max(...half.filter((_, i) => i % 2 === 0))], [5, 10]);
  assert.deepEqual(clipToRect([0, 0, 1, 0, 1, 1], { x: 5, y: 5, w: 2, h: 2 }), []);
});
