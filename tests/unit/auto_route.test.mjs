import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { AutoRoute, nextSpeed } = await game('state/AutoRoute');

// An L: right along y = 0 for 400 px, then down x = 400 for 400 px, driving 20 px right of the centre line.
const route = new AutoRoute({ corners: [[0, 0], [400, 0], [400, 400]], lanes: [20, 20], radius: 40 });
const profile = { cruise: 100, accel: 50, brake: 100, bendSpeed: 30 };

test('SCREAM-171: the path keeps to the lane on the straights and turns the corner', () => {
  const start = route.at(0);
  assert.ok(Math.abs(start.heading) < 1, 'heading right');
  assert.ok(Math.abs(start.y - 20) < 1, 'in the lane, 20 px right of the centre');
  const end = route.at(route.length);
  assert.ok(Math.abs(end.heading - 90) < 1, 'heading down at the end');
  assert.ok(Math.abs(end.x - 380) < 1, 'in the lane on the way down (right of the line is west)');
  assert.ok(route.length > 700 && route.length < 800, `an L of two 400 px legs, rounded: ${route.length}`);
});

test('distanceAlong finds where a point sits on the path', () => {
  const s = route.distanceAlong(200, 20);
  assert.ok(Math.abs(s - 200) < 6, `${s}`);
  const p = route.at(s);
  assert.ok(Math.hypot(p.x - 200, p.y - 20) < 6);
});

test('nextSpeed accelerates to cruise, slows for the bend, and stops at the end', () => {
  let v = 0;
  for (let i = 0; i < 20; i++) v = nextSpeed(route, 10, route.length, v, 0.1, profile);
  assert.equal(v, profile.cruise, 'up to cruise on the straight');
  const corner = route.distanceAlong(400, 0) - 30;
  assert.ok(nextSpeed(route, corner, route.length, 100, 0.1, profile) < 100, 'braking before the bend');
  v = 100;
  let s = route.length - 60;
  for (let i = 0; i < 400 && route.length - s > 0.5; i++) {
    v = nextSpeed(route, s, route.length, v, 0.02, profile);
    s = Math.min(route.length, s + v * 0.02);
  }
  assert.ok(v < 25, `down to a crawl by the end (the drive scene calls under 2 px/s within 6 px arrived): ${v}`);
});

test('a parked car in the lane is passed by swinging out toward the centre line', () => {
  const clear = new AutoRoute({ corners: [[0, 0], [1000, 0]], lanes: [20], radius: 40 });
  // passOffset is where to drive (right of the centre) while passing: nearer the centre than the lane.
  const withCar = new AutoRoute({ corners: [[0, 0], [1000, 0]], lanes: [20], radius: 40, cars: [[500, 20]], passOffset: -20 });
  const other = new AutoRoute({ corners: [[0, 0], [1000, 0]], lanes: [20], radius: 40, cars: [[500, -40]], passOffset: -20 });
  assert.ok(Math.abs(clear.at(500).y - 20) < 1);
  assert.ok(Math.abs(withCar.at(500).y + 20) < 2, `swung out to the pass offset: ${withCar.at(500).y}`);
  assert.ok(Math.abs(withCar.at(100).y - 20) < 1, 'in the lane well before the car');
  assert.ok(Math.abs(other.at(500).y - 20) < 1, 'a car on the other side of the road is ignored');
});
