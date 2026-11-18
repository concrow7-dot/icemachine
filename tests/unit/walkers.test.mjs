// SCREAM-394 (PO, November 17): "a few people who are randomly walking up and down the streets of the
// elm park map ... random chances of buying ice cream ... come from the edge map and walk around awhile
// before they leave." His answers: "20 people total in the evening. A few wandering around most of the
// time, others only around for an hour or so"; "Random 10% to 50% each"; "Engineering drafts, I adjust".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents } = await game('state/Residents');
const { StreetNet } = await game('state/StreetWalk');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { TUTORIAL_WALKERS } = await game('config/tutorialWalkers');
const { RESIDENTS } = await game('config/residents');
const { TUTORIAL } = await game('config/tutorial');
const { MAPS } = await game('config/maps');
const T = await game('config/tuning');

const perMinute = T.EVENING_LENGTH_SECONDS / ((T.EVENING_END_HOUR - T.EVENING_START_HOUR) * 60);
const net = () => new StreetNet(TUTORIAL.roads, TUTORIAL);

/** A Story evening in Elm Park with the walkers, with a clock the test moves. */
function evening(day, seed) {
  let n = (seed * 31 + day) >>> 0;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const people = new Residents([...TUTORIAL_RESIDENTS, ...TUTORIAL_WALKERS], rnd, undefined, { day, seed }, true);
  let seconds = 0;
  people.nowMinutes = () => T.EVENING_START_HOUR * 60 + seconds / perMinute;
  people.openStreets(net());
  const step = (dt, ring) => { seconds += dt; people.update(dt, ring); };
  return { people, step, seconds: () => seconds };
}

test('the sheet: 20 walkers with no house, each with their own 10% to 50%, and looks nobody else has', () => {
  assert.equal(TUTORIAL_WALKERS.length, 20);
  assert.equal(TUTORIAL_RESIDENTS.length, 53, 'the residents list is unchanged');
  for (const w of TUTORIAL_WALKERS) {
    assert.ok(w.walker && !w.visitor && !w.park && !w.days && !w.hours && !w.car, `${w.name} is only a walker`);
    assert.ok(w.likelihood >= 0.1 && w.likelihood <= 0.5, `${w.name}: ${w.likelihood}`);
  }
  const looks = [...TUTORIAL_RESIDENTS, ...TUTORIAL_WALKERS].map((r) => r.look);
  assert.equal(new Set(TUTORIAL_WALKERS.map((r) => r.look)).size, 20);
  assert.equal(TUTORIAL_WALKERS.filter((w) => TUTORIAL_RESIDENTS.some((r) => r.look === w.look)).length, 0);
  assert.equal(Math.max(...looks), 72);
  assert.equal(TUTORIAL_WALKERS.filter((w) => w.kid).length, 5);
  assert.equal(MAPS.tutorial.walkers, TUTORIAL_WALKERS);
  assert.equal(MAPS.worcester.walkers, undefined, 'Foley Stadium has none');
  assert.equal(RESIDENTS.filter((r) => r.walker).length, 0);
});

test('the sidewalks: corners where streets meet, ways in and out near the map\'s edge, nothing in the roundabout', () => {
  const n = net();
  assert.equal(n.streets.length, 10);
  assert.equal(n.exits.length, 12);
  const ring = TUTORIAL.roads.find((r) => r.ring).ring;
  for (const [i, s] of n.streets.entries()) {
    for (const t of s.stops) {
      const [x, y] = n.middle(i, t);
      assert.ok(Math.hypot(x - ring.x, y - ring.y) >= ring.r + T.WALKER_RING_CLEAR, `no corner in the roundabout (street ${i} at ${t})`);
    }
  }
  // Someone on a sidewalk stands off the asphalt: 67 px from the middle of a one-lane street, 127 px from Park Avenue's.
  const off = (road) => { const m = n.middle(road, 100); const p = n.stand({ road, t: 100, side: 1 }); return Math.round(Math.hypot(p[0] - m[0], p[1] - m[1])); };
  assert.deepEqual([off(3), off(2)], [67, 127]);
  // Coming in: they appear just off the map and walk to a street's end.
  let k = 7;
  const dice = () => ((k = (Math.imul(k, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 30; i++) {
    const { from, leg } = n.enter(dice);
    assert.ok(from[0] < 0 || from[1] < 0 || from[0] > TUTORIAL.width || from[1] > TUTORIAL.height, 'starts off the map');
    const [x, y] = leg.route.at(-1);
    assert.ok(x > 0 && y > 0 && x < TUTORIAL.width && y < TUTORIAL.height, 'walks onto it');
  }
});

test('an evening: four are out from the start, all 20 come, they keep moving, and they leave by the edge', () => {
  for (const seed of [11, 222, 3333]) {
    const { people, step, seconds } = evening(2, seed);
    assert.equal(people.walkersNow.length, T.WALKER_LONG_STAY, 'the long-stayers are on the streets at 4:00');
    const seen = new Set();
    const still = new Map();
    let most = 0;
    while (seconds() < T.EVENING_LENGTH_SECONDS) {
      step(0.25);
      most = Math.max(most, people.walkersNow.length);
      for (const p of people.walkersNow) {
        seen.add(p.resident.id);
        assert.ok(p.outside && !people.hasPorchLight?.(p), 'on the map, outside');
        const was = still.get(p.resident.id);
        if (was && Math.hypot(was[0] - p.x, was[1] - p.y) < 0.01) {
          was[2] += 0.25;
          assert.ok(was[2] <= 8, `${p.resident.name} stood still for more than a pause`);
        } else still.set(p.resident.id, [p.x, p.y, 0]);
      }
    }
    assert.equal(seen.size, 20, 'all 20 came by');
    assert.ok(most >= 6 && most <= 18, `at most ${most} at once`);
    // Everyone who came in before 6:00 and was due to leave has left by 8:00, off the map.
    const gone = [...seen].filter((id) => !people.walkersNow.some((p) => p.resident.id === id));
    assert.ok(gone.length >= 8, `${gone.length} have left by 8:00`);
  }
});

test('a walker who hears the truck can become a customer, then carries on walking; no walkers without openStreets', () => {
  const { people, step } = evening(1, 5);
  const w = people.walkersNow[0];
  people.callNow(w);
  assert.notEqual(w.customer, 'none');
  for (let i = 0; i < 40; i++) step(0.25);
  assert.equal(w.customer, 'waiting', 'with no curb finder they wait where they stand');
  // Their patience runs out: back to the walk.
  for (let i = 0; i < 4 * 200; i++) step(0.25);
  assert.equal(w.customer, 'done');
  const at = [w.x, w.y];
  for (let i = 0; i < 4 * 30; i++) step(0.25);
  assert.ok(Math.hypot(w.x - at[0], w.y - at[1]) > 20 || w.gone, 'walking again');
  // The uncle's evening and Quick play never call openStreets: nobody walks.
  const quiet = new Residents([...TUTORIAL_RESIDENTS, ...TUTORIAL_WALKERS], Math.random, undefined, { day: 1, seed: 5 });
  quiet.update(1);
  assert.equal(quiet.walkersNow.length, 0);
});
