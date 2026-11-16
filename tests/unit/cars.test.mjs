// SCREAM-252 (PO, November 15): a resident's car on the street in front of their house while they
// are home (Story, Elm Park). His answers: "A Car column in the sheet", on the street in front
// ("1, lets remove the old parked cars"), and the truck can hit them "like parked cars".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents, weekdayOf } = await game('state/Residents');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');
const { MAPS, fixedParkedCars } = await game('config/maps');
const { RESIDENT_CAR_ARRIVE_CLEAR } = await game('config/tuning');

const withCar = TUTORIAL_RESIDENTS.filter((r) => r.car);
const evening = (day, list = TUTORIAL_RESIDENTS, minutes = 17 * 60) => {
  const r = new Residents(list, () => 0.5, undefined, { day, seed: 1 });
  r.carsOn = true;
  r.nowMinutes = () => minutes;
  return r;
};

test('the sheet: 14 adults with a house have a car (engineering\'s draft); Foley Stadium has none', () => {
  assert.equal(withCar.length, 14);
  for (const r of withCar) assert.ok(!r.kid && !r.visitor, r.name);
  assert.equal(RESIDENTS.filter((r) => r.car).length, 0);
});

test('"lets remove the old parked cars": Elm Park has no parked cars of its own; Foley Stadium keeps its', () => {
  assert.equal(fixedParkedCars(MAPS.tutorial).length, 0);
  assert.ok(MAPS.tutorial.data.parkedCars.length > 0, '(still in the map file, but not used)');
  assert.equal(fixedParkedCars(MAPS.worcester).length, MAPS.worcester.data.parkedCars.length);
});

test('each car parks on its owner\'s street, near their pink square, clear of every pink square and of the other cars', () => {
  const squares = TUTORIAL_RESIDENTS.flatMap((r) => [[r.curb[2], r.curb[3]], ...(r.park ? [[r.park.curb[2], r.park.curb[3]]] : [])]);
  for (const r of withCar) {
    const [x, y, angle] = r.car;
    const own = Math.hypot(x - r.curb[2], y - r.curb[3]);
    assert.ok(own >= 80 && own <= 410, `${r.name}: ${own.toFixed(0)} px from their pink square`);
    assert.equal(angle, r.curb[4], 'along the road');
    for (const [sx, sy] of squares) assert.ok(Math.hypot(x - sx, y - sy) >= 80, `${r.name}'s car is clear of the pink square at ${sx},${sy}`);
    for (const o of withCar) if (o !== r) assert.ok(Math.hypot(x - o.car[0], y - o.car[1]) >= 80, `${r.name} and ${o.name}`);
  }
});

test('a car is out on the days its owner is home (their ticks), and not on the others', () => {
  for (let day = 1; day <= 5; day++) {
    const r = evening(day);
    r.update(0.1);
    const out = new Set(r.carsNow.map((c) => c.id));
    for (const res of withCar) {
      const home = res.days.includes(weekdayOf(day)) && (!res.hours || !!res.hardToFind || !!res.park || r.homeNow(res));
      assert.equal(out.has(res.id), home, `day ${day}: ${res.name}`);
    }
    assert.ok(out.size > 2 && out.size < withCar.length, `day ${day}: ${out.size} cars out`);
  }
});

test('each owner always has the same car colour', () => {
  const a = evening(1); a.update(0.1);
  const b = evening(4); b.update(0.1);
  for (const c of a.carsNow) {
    const d = b.carsNow.find((x) => x.id === c.id);
    if (d) assert.equal(d.colour, c.colour);
  }
});

test('outside Story, or in the uncle\'s evening (carsOn false), no residents\' cars', () => {
  const quick = new Residents(TUTORIAL_RESIDENTS, () => 0.5);
  quick.carsOn = true;
  quick.update(0.1);
  assert.equal(quick.carsNow.length, 0);
  const uncle = evening(1);
  uncle.carsOn = false;
  uncle.update(0.1);
  assert.equal(uncle.carsNow.length, 0);
});

test('someone who gets home later: the car pulls up when they do, but never onto the truck; it goes when they leave', () => {
  const base = withCar[0];
  const late = { ...base, id: 'X1', days: [0, 1, 2, 3, 4, 5, 6], hours: [18 * 60, 19 * 60] };
  let minutes = 17 * 60;
  const r = new Residents([late], () => 0.5, undefined, { day: 1, seed: 1 });
  r.carsOn = true;
  r.nowMinutes = () => minutes;
  r.update(0.1);
  assert.equal(r.carsNow.length, 0, 'not home yet: no car');
  minutes = 18 * 60 + 1;
  r.update(0.1, { x: late.car[0], y: late.car[1], radius: 0, open: false });
  assert.equal(r.carsNow.length, 0, 'the truck is sitting on the spot: the car waits');
  r.update(0.1, { x: late.car[0] + RESIDENT_CAR_ARRIVE_CLEAR + 1, y: late.car[1], radius: 0, open: false });
  assert.equal(r.carsNow.length, 1, 'the truck moved off: the car pulls up');
  minutes = 19 * 60 + 1;
  r.update(0.1, { x: 0, y: 0, radius: 0, open: false });
  assert.equal(r.carsNow.length, 0, 'gone out again after their Until');
});
