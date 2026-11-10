import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { LapCounter, arrivalSpot, ringOf } = await game('state/RingLaps');
const ring = { x: 1000, y: 1000, r: 120 };
const at = (deg, r = 120) => [ring.x + r * Math.cos((deg * Math.PI) / 180), ring.y + r * Math.sin((deg * Math.PI) / 180)];

function drive(c, from, to, step = 10) {
  let done = false;
  for (let d = from; step > 0 ? d <= to : d >= to; d += step) done = c.update(...at(d)) || done;
  return done;
}

test('three laps round the ring completes it, on the last frame', () => {
  const c = new LapCounter(ring, 3);
  assert.equal(drive(c, 0, 3 * 360 - 10), false);
  assert.equal(c.laps, 2);
  assert.equal(c.update(...at(3 * 360)), true);
  assert.equal(c.laps, 3);
});

test('laps count the other way round too', () => {
  const c = new LapCounter(ring, 3);
  assert.equal(drive(c, 0, -3 * 360, -10), true);
});

test('leaving the ring starts the count again', () => {
  const c = new LapCounter(ring, 3);
  drive(c, 0, 720);
  assert.equal(c.laps, 2);
  c.update(ring.x + 400, ring.y); // off down a street
  assert.equal(c.laps, 0);
  assert.equal(c.onRing, false);
  assert.equal(drive(c, 0, 1080), true, 'three fresh laps are still needed');
});

test('turning round on the ring starts the count again', () => {
  const c = new LapCounter(ring, 3);
  drive(c, 0, 720);
  drive(c, 720, 700, -10);
  assert.equal(c.laps, 0);
  assert.equal(drive(c, 700, -380, -10), true);
});

test('wobbling across the road width still counts (the truck is not on the centre line)', () => {
  const c = new LapCounter(ring, 1);
  let done = false;
  for (let d = 0; d <= 360; d += 5) done = c.update(...at(d, 120 + 50 * Math.sin(d))) || done;
  assert.equal(done, true);
});

test('arrivalSpot: on the ring, opposite the street in, facing clockwise', () => {
  const roads = [
    { name: 'Ring', points: [], ring },
    { name: 'High Street', points: [2000, 1000, ring.x, ring.y] }, // comes in from the east
  ];
  assert.deepEqual(ringOf(roads), ring);
  const s = arrivalSpot(roads);
  assert.equal(s.x, 880); // west side
  assert.equal(s.y, 1000);
  assert.equal(s.angle, -90); // heading up (clockwise on screen, going round the west side)
  assert.equal(arrivalSpot([{ name: 'x', points: [0, 0, 1, 1] }]), null);
});

// ---- SCREAM-229: the portal's strength follows the laps ----
const { portalStrength } = await game('state/RingLaps');

test('the portal: nothing on the first lap, then it grows until the last lap is done', () => {
  assert.equal(portalStrength(0, 3), 0);
  assert.equal(portalStrength(0.99, 3), 0);
  assert.equal(portalStrength(1, 3), 0);
  assert.equal(portalStrength(1.5, 3), 0.25);
  assert.equal(portalStrength(2, 3), 0.5);
  assert.equal(portalStrength(3, 3), 1);
  assert.equal(portalStrength(5, 3), 1);
});

test('the portal follows the counter: turns grows lap by lap and drops back when the truck leaves', () => {
  const c = new LapCounter(ring, 3);
  drive(c, 0, 540);
  assert.ok(Math.abs(c.turns - 1.5) < 0.01);
  assert.ok(portalStrength(c.turns, 3) > 0.24);
  c.update(ring.x + 600, ring.y);
  assert.equal(portalStrength(c.turns, 3), 0);
});
