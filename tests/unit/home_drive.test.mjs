// SCREAM-380 (PO, November 17): car owners who are away "Drive in by car": along the road from the
// edge of the map to their parking spot. "The car stops and waits" for the truck; bumping it costs
// the same as a parked car. People without a car "walk in" (SCREAM-379).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents } = await game('state/Residents');
const { RoadGraph, asphaltAtEdge } = await game('state/RoadGraph');
const { HomeDrive } = await game('state/HomeDrive');
const { RoadNetwork } = await game('state/RoadGeometry');
const { walkInRoute } = await game('state/ComingHome');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { TUTORIAL } = await game('config/tutorial');
const { WORCESTER } = await game('config/worcester');
const T = await game('config/tuning');

const graph = new RoadGraph(TUTORIAL.roads, TUTORIAL, TUTORIAL.roadMask);
const net = new RoadNetwork(TUTORIAL.roads, TUTORIAL.roadMask);
const owners = TUTORIAL_RESIDENTS.filter((r) => r.car);
const spotOf = (r) => ({ x: r.car[0], y: r.car[1], angle: r.car[2] });
const ring = TUTORIAL.roads.find((r) => r.ring).ring;
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

test('SCREAM-380: Elm Park has one way in for cars: the road west of the roundabout', () => {
  const edges = asphaltAtEdge(TUTORIAL.roadMask, TUTORIAL);
  assert.equal(edges.length, 1);
  assert.deepEqual(edges[0][1], [-1, 0], 'it runs off the left edge');
  assert.ok(Math.abs(edges[0][0][1] - ring.y) < 20, 'level with the roundabout');
  assert.equal(graph.entries.length, 1);
  assert.ok(graph.nodes[graph.entries[0]][0] < 0, 'a car starts outside the map');
});

test('SCREAM-380: every car owner in Elm Park has a way home along the asphalt, ending in their spot facing the right way', () => {
  assert.ok(owners.length >= 10);
  for (const r of owners) {
    const corners = graph.driveIn(spotOf(r));
    assert.ok(corners && corners.length >= 3, `${r.name} has a way home`);
    assert.ok(corners[0][0] < 0, `${r.name} starts outside the map`);
    const drive = new HomeDrive(corners, spotOf(r), 30);
    let south = false;
    for (let s = 0; s <= drive.length; s += 5) {
      const p = drive.at(s);
      if (p.x > 4) assert.ok(net.onRoad(p.x, p.y), `${r.name} is on the road ${Math.round(s)} px along (${Math.round(p.x)}, ${Math.round(p.y)})`);
      const fromRing = Math.hypot(p.x - ring.x, p.y - ring.y);
      // Round the roundabout the way traffic that keeps right goes: in from the west, round the south side.
      if (fromRing < ring.r + 60) {
        assert.ok(fromRing > ring.r - 60 + 10, `${r.name} keeps off the island`);
        assert.ok(!(p.x < ring.x && p.y < ring.y - 40), `${r.name} does not go round the north-west side`);
        if (p.y > ring.y + 80) south = true;
      }
    }
    assert.ok(south, `${r.name} goes round the south side of the roundabout`);
    const end = drive.at(drive.length);
    assert.ok(Math.hypot(end.x - r.car[0], end.y - r.car[1]) < 0.5, `${r.name} ends in their spot`);
    assert.ok(Math.abs(wrap(end.angle - r.car[2])) < 0.5, `${r.name} ends facing the way the car is parked`);
    // In the lane on the way, the car is clear of the cars parked at the curb.
    const before = drive.route.at(drive.length - 10);
    assert.ok(Math.abs(wrap(before.heading - r.car[2])) < 12, `${r.name} comes up the street the way they park`);
  }
});

test('SCREAM-380: Foley Stadium\'s streets make a web too (no cars in its sheet yet)', () => {
  const g = new RoadGraph(WORCESTER.roads, WORCESTER, WORCESTER.roadMask);
  assert.ok(g.nodes.length > 20);
});

test('SCREAM-380: a car drives home and parks; it stops for something in its way and carries on once clear', () => {
  const r = owners.find((o) => o.name === 'Itty Glitty');
  const corners = graph.driveIn(spotOf(r));
  const free = new HomeDrive(corners, spotOf(r), 30);
  let t = 0;
  while (!free.parked && t < 120) {
    free.step(0.05, () => false);
    t += 0.05;
    assert.ok(free.v <= T.HOME_DRIVE_PROFILE.cruise + 0.001);
  }
  assert.ok(free.parked && t < 40, `parked after ${t.toFixed(1)} s`);
  assert.deepEqual([free.x, free.y, free.angle], [r.car[0], r.car[1], r.car[2]]);

  // Something stands in the road 600 px along.
  const drive = new HomeDrive(corners, spotOf(r), 30);
  const wall = drive.at(600);
  let blocking = true;
  const blocked = (x, y) => blocking && Math.hypot(x - wall.x, y - wall.y) < 20;
  for (let i = 0; i < 600; i++) drive.step(0.05, blocked);
  assert.ok(drive.waiting && drive.v === 0, 'stopped and waiting');
  const gap = 600 - drive.s;
  assert.ok(gap >= 30 + 20 && gap < 30 + 20 + T.HOME_DRIVE_GAP + 20, `stopped short of it with a gap (${gap.toFixed(1)} px from its middle)`);
  const stoppedAt = drive.s;
  for (let i = 0; i < 100; i++) drive.step(0.05, blocked);
  assert.equal(drive.s, stoppedAt, 'it stays put while the way is blocked');
  blocking = false;
  for (let i = 0; i < 1200 && !drive.parked; i++) drive.step(0.05, blocked);
  assert.ok(drive.parked, 'carries on and parks once the way is clear');
});

/** A Story evening in Elm Park with a clock the test moves, where car owners drive home. */
function evening(day, seed = 4242) {
  let n = (seed * 31 + day) >>> 0;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const people = new Residents(TUTORIAL_RESIDENTS, rnd, undefined, { day, seed });
  const perMinute = T.EVENING_LENGTH_SECONDS / ((T.EVENING_END_HOUR - T.EVENING_START_HOUR) * 60);
  let seconds = 0;
  people.nowMinutes = () => T.EVENING_START_HOUR * 60 + seconds / perMinute;
  people.carsOn = true;
  people.hearingOff = true;
  people.openPark();
  people.sendAway(
    (r) => walkInRoute(r, TUTORIAL.roads, TUTORIAL),
    (r) => (r.car ? graph.driveIn(spotOf(r)) : null),
  );
  const at = (minutes, ring, each) => {
    const until = (minutes - T.EVENING_START_HOUR * 60) * perMinute;
    while (seconds < until) {
      seconds += 0.1;
      people.update(0.1, ring);
      each?.();
    }
  };
  return { people, at };
}

/** An evening (some day and seed) on which a car owner who is away comes home. */
function eveningWithDriver() {
  for (let seed = 1; seed < 60; seed++) {
    for (const day of [1, 2, 3, 4, 5]) {
      const e = evening(day, seed);
      const driver = e.people.awayNow.find((p) => p.resident.car && e.people.arrivesAt(p) !== null);
      if (driver) return { ...e, driver, when: e.people.arrivesAt(driver) };
    }
  }
  throw new Error('no evening with a car owner coming home');
}

test('SCREAM-380: a car owner who is away comes home by car, parks, gets out and walks to their door', () => {
  const { people, at, driver, when } = eveningWithDriver();
  const id = driver.resident.id;
  const car = () => people.carsNow.find((c) => c.id === id);
  at(when - 1);
  assert.ok(!car() && driver.away, 'before their time: no car, not on the map');
  at(when + 0.3);
  assert.ok(people.drivingHome(driver), 'in the car');
  assert.ok(car()?.moving && car().x < 200, `the car comes in at the edge of the map (x ${Math.round(car().x)})`);
  assert.ok(driver.away && !driver.outside && !people.porchLit(driver), 'the owner is not on the map while driving');
  // The truck far away: nothing in the car's way. No two moving cars ever touch.
  let parkedAt = null;
  at(when + 45, { x: 2600, y: 600, radius: 100, open: false, heading: 0 }, () => {
    const moving = people.carsNow.filter((c) => c.moving);
    for (const a of moving) for (const b of moving) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 40, 'moving cars keep apart');
    if (parkedAt === null && !people.drivingHome(driver)) parkedAt = people.nowMinutes();
  });
  assert.ok(parkedAt !== null && parkedAt - when < 40, `parked ${Math.round(parkedAt - when)} game minutes after coming in`);
  const parked = car();
  assert.ok(parked && !parked.moving, 'the car is an ordinary parked car now');
  assert.deepEqual([parked.x, parked.y, parked.angle], driver.resident.car.slice(0, 3));
  assert.ok(!driver.away, 'the owner got out');
  at(when + 75);
  assert.ok(!driver.comingHome && people.carsNow.some((c) => c.id === id), 'home, the car still outside');
});

test('SCREAM-380: the car stops and waits for the truck in its way, and carries on once it has gone', () => {
  const { people, at, driver, when } = eveningWithDriver();
  const id = driver.resident.id;
  const corners = graph.driveIn(spotOf(driver.resident));
  const path = new HomeDrive(corners, spotOf(driver.resident), 30);
  // The truck stopped across the car's lane, 900 px along its way.
  const here = path.at(900);
  const truck = { x: here.x, y: here.y, radius: 100, open: false, heading: here.angle + 90 };
  const box = (c) => {
    const h = (truck.heading * Math.PI) / 180;
    const dx = c.x - truck.x;
    const dy = c.y - truck.y;
    return [Math.abs(dx * Math.cos(h) + dy * Math.sin(h)), Math.abs(-dx * Math.sin(h) + dy * Math.cos(h))];
  };
  at(when + 30, truck, () => {
    const c = people.carsNow.find((x) => x.id === id);
    if (!c?.moving) return;
    const [fore, side] = box(c);
    assert.ok(fore > T.TRUCK_LENGTH / 2 + 10 || side > T.TRUCK_WIDTH / 2 + 10, 'the car never touches the truck');
  });
  assert.ok(people.drivingHome(driver), 'still on its way: waiting for the truck');
  const waitingAt = people.carsNow.find((c) => c.id === id);
  // (Other cars may have come in first: they queue behind the truck, this one behind them.)
  const queue = people.carsNow.filter((c) => c.moving).map((c) => Math.hypot(c.x - truck.x, c.y - truck.y)).sort((a, b) => a - b);
  assert.ok(queue[0] < 120, `the first car stopped just short of the truck (${Math.round(queue[0])} px from its middle)`);
  queue.forEach((d, i) => i && assert.ok(d - queue[i - 1] > 55 && d - queue[i - 1] < 110, `the cars behind queue up (${Math.round(d - queue[i - 1])} px apart)`));
  assert.ok(waitingAt.moving);
  at(when + 75, { ...truck, x: 2600, y: 600 });
  assert.ok(!people.drivingHome(driver) && !people.carsNow.find((c) => c.id === id).moving, 'parked once the truck had gone');
});

test('SCREAM-380: people without a car still walk in from the edge', () => {
  for (let seed = 1; seed < 20; seed++) {
    const { people, at } = evening(1, seed);
    const walker = people.awayNow.find((p) => !p.resident.car && people.arrivesAt(p) !== null);
    if (!walker) continue;
    at(people.arrivesAt(walker) + 0.5);
    assert.ok(walker.comingHome && walker.outside && !people.drivingHome(walker));
    return;
  }
  assert.fail('no walker found');
});
