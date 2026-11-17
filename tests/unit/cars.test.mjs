// SCREAM-252 (PO, November 15): a resident's car on the street in front of their house while they
// are home (Story, Elm Park). His answers: "A Car column in the sheet", on the street in front
// ("1, lets remove the old parked cars"), and the truck can hit them "like parked cars".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents, weekdayOf, carFootprint } = await game('state/Residents');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');
const { MAPS, fixedParkedCars } = await game('config/maps');
const { RESIDENT_CAR_ARRIVE_CLEAR, RESIDENT_CAR_TRUCK_ROOM, RESIDENT_CAR_BOX_INSET, TRUCK_WIDTH } = await game('config/tuning');
const { CAR_MODELS } = await game('config/carModels');

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

test('each car parks on its owner\'s street, near their pink square, with room for the truck, clear of the other cars', () => {
  const squares = TUTORIAL_RESIDENTS.flatMap((r) => [[r.curb[2], r.curb[3]], ...(r.park ? [[r.park.curb[2], r.park.curb[3]]] : [])]);
  const half = (r) => CAR_MODELS.find((m) => m.model === r.car[3]).right[0] / 2;
  for (const r of withCar) {
    const [x, y, angle] = r.car;
    const own = Math.hypot(x - r.curb[2], y - r.curb[3]);
    assert.ok(own >= 70 && own <= 470, `${r.name}: ${own.toFixed(0)} px from their pink square`);
    const off = Math.abs(((angle - r.curb[4]) % 360 + 540) % 360 - 180);
    assert.ok(off < 0.2 || Math.abs(off - 180) < 0.2, `${r.name}: along the road, one way or the other`);
    for (const [sx, sy] of squares) assert.ok(Math.hypot(x - sx, y - sy) >= half(r) + RESIDENT_CAR_TRUCK_ROOM - 0.5, `${r.name}'s car leaves the truck room at the pink square at ${sx},${sy}`);
    for (const o of withCar) if (o !== r) assert.ok(Math.hypot(x - o.car[0], y - o.car[1]) >= half(r) + half(o), `${r.name} and ${o.name}`);
  }
});

test('SCREAM-361, "as much variety in the cars as possible": every owner has a different one of the pack\'s 26 cars', () => {
  assert.equal(CAR_MODELS.length, 26);
  const models = withCar.map((r) => r.car[3]);
  assert.equal(new Set(models).size, models.length);
  for (const m of models) assert.ok(CAR_MODELS.some((c) => c.model === m));
});

test('SCREAM-361: "30% smaller" than the pack, then "15% smaller" (PO, November 16, 13:05): the shortest car (183 px) is 56 px long; "The hitbox should match the car"', () => {
  const lengths = CAR_MODELS.map((m) => m.right[0]);
  assert.equal(Math.min(...lengths), 56);
  const r = evening(1); r.update(0.1);
  for (const c of r.carsNow) {
    const m = CAR_MODELS.find((x) => x.model === c.model);
    // SCREAM-372: the box is the picture the car is drawn with (nose-down or nose-up on Elm Park's
    // streets that run up the map), pulled in on every side.
    const [length, width] = carFootprint(c.model, c.angle);
    assert.equal(c.halfLength, length / 2 - RESIDENT_CAR_BOX_INSET);
    assert.equal(c.halfWidth, width / 2 - RESIDENT_CAR_BOX_INSET);
    assert.equal(width, m.down[0], 'never wider than the car seen nose-on');
    assert.ok(c.halfWidth * 2 < m.right[1], 'narrower than the old box (the side-on picture)');
  }
});

test('SCREAM-372 (PO: "I can\'t pass between them"): two cars across the street from each other leave room for the truck', () => {
  assert.deepEqual(carFootprint(1, 95.9), [52, 29], 'nose-down: the nose-down picture');
  assert.deepEqual(carFootprint(1, -175.4), [56, 29], 'side-on: as long as the side-on picture, as wide as the car');
  const cars = withCar.map((r) => ({ name: r.name, x: r.car[0], y: r.car[1], angle: r.car[2], half: carFootprint(r.car[3], r.car[2])[1] / 2 - RESIDENT_CAR_BOX_INSET }));
  const pairs = [];
  for (const a of cars) for (const b of cars) {
    if (a.name >= b.name) continue;
    const t = (a.angle * Math.PI) / 180;
    const dx = b.x - a.x, dy = b.y - a.y;
    const along = Math.abs(dx * Math.cos(t) + dy * Math.sin(t)), across = Math.abs(-dx * Math.sin(t) + dy * Math.cos(t));
    if (along > 60 || across < 40 || across > 130) continue; // not beside each other, or on the same side, or another street
    pairs.push(`${a.name} + ${b.name}`);
    assert.ok(across - a.half - b.half >= TRUCK_WIDTH + 12, `${a.name} and ${b.name}: ${Math.round(across - a.half - b.half)} px between them for a ${TRUCK_WIDTH} px truck`);
  }
  assert.ok(pairs.includes('Kathleen Scoopley + Susie Parlor'), 'the pair the PO met on Haviland Street is still there (he likes the challenge)');
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

test('each owner always has the same car', () => {
  const a = evening(1); a.update(0.1);
  const b = evening(4); b.update(0.1);
  for (const c of a.carsNow) {
    const d = b.carsNow.find((x) => x.id === c.id);
    if (d) assert.equal(d.model, c.model);
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

test('SCREAM-361 (PO, November 16, 13:01: "next to the curb parked"): every car sits against the curb, its side within 6 px of where the asphalt ends; SCREAM-372 ("closer to the curb or edge of the street"): within 3 px, measured from the picture it is drawn with', () => {
  const mask = MAPS.tutorial.data.roadMask;
  const onAsphalt = (x, y) => {
    const runs = mask.rows[Math.floor(y / mask.scale)] || [];
    const col = Math.floor(x / mask.scale);
    for (let k = 0; k < runs.length; k += 2) if (runs[k] <= col && col < runs[k + 1]) return true;
    return false;
  };
  for (const res of withCar) {
    const [x, y, facing, model] = res.car;
    const m = CAR_MODELS.find((c) => c.model === model);
    const rad = (facing * Math.PI) / 180;
    const nx = -Math.sin(rad), ny = Math.cos(rad);
    // Out from the car's middle, sideways both ways: the nearer curb is just past its side.
    const gap = Math.min(...[1, -1].map((sgn) => {
      let d = 0;
      while (d < 200 && onAsphalt(x + sgn * nx * d, y + sgn * ny * d)) d++;
      const sideOn = Math.round((((facing % 360) + 360) % 360) / 90) % 2 === 0;
      return d - (sideOn ? m.right[1] : m.down[0]) / 2;
    }));
    assert.ok(gap >= 0 && gap <= 3, `${res.name}: ${gap} px from the curb`);
  }
});
