// SCREAM-379 (PO, November 17): "the days people aren't home (marked in the residents sheet), they
// don't show up on their property ... those people slowly arrive home throughout the evening ...
// they should come from the edge of the map and make there way home. Starting at 5:30 they should
// start getting home, especially the adults." Once home they buy "like a ticked day"; "Some stay out".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents } = await game('state/Residents');
const { walkInRoute, arrivalMinute, awayDice } = await game('state/ComingHome');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');
const { TUTORIAL } = await game('config/tutorial');
const { WORCESTER } = await game('config/worcester');
const T = await game('config/tuning');

const perMinute = T.EVENING_LENGTH_SECONDS / ((T.EVENING_END_HOUR - T.EVENING_START_HOUR) * 60);
const weekday = (day) => (day - 1) % 5;
const walkIn = (r) => walkInRoute(r, TUTORIAL.roads, TUTORIAL);
const shouldBeAway = (r, day) => !r.visitor && !r.hardToFind && !r.park && !!r.days && !r.days.includes(weekday(day));

/** An evening's people with a clock the test moves: `at(minutes)` runs the evening on to that time. */
function evening(day, seed = 4242, away = true) {
  let n = (seed * 31 + day) >>> 0;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const people = new Residents(TUTORIAL_RESIDENTS, rnd, undefined, { day, seed });
  let seconds = 0;
  people.nowMinutes = () => T.EVENING_START_HOUR * 60 + seconds / perMinute;
  people.carsOn = true;
  people.openPark();
  if (away) people.sendAway(walkIn);
  const at = (minutes, ring) => {
    const until = (minutes - T.EVENING_START_HOUR * 60) * perMinute;
    while (seconds < until) {
      seconds += 0.25;
      people.update(0.25, ring);
    }
  };
  return { people, at };
}
const length = (pts) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

test('SCREAM-379: on a day not ticked for them, people start the evening away', () => {
  for (const day of [1, 2, 3, 4, 5]) {
    const { people } = evening(day);
    for (const p of people.all) {
      assert.equal(!!p.away, shouldBeAway(p.resident, day), `${p.resident.name} on day ${day}`);
      if (p.away) {
        assert.equal(p.outside, false, `${p.resident.name} is not on their property`);
        assert.equal(people.porchLit(p), false, 'no porch light while away');
      }
    }
    assert.ok(people.awayNow.length >= 10, `a good few are away on day ${day} (${people.awayNow.length})`);
    assert.ok(people.carsNow.every((c) => !shouldBeAway(TUTORIAL_RESIDENTS.find((r) => r.id === c.id), day)), 'no car outside for someone away');
  }
});

test('SCREAM-379: nobody is away without sendAway (Quick play, the uncle\'s evening), and the park and the hard-to-find are untouched', () => {
  assert.equal(evening(1, 4242, false).people.awayNow.length, 0);
  const { people } = evening(2);
  for (const p of people.all) if (p.resident.park || p.resident.hardToFind || p.resident.visitor) assert.ok(!p.away, p.resident.name);
});

test('SCREAM-379: someone away does not hear the truck', () => {
  const { people, at } = evening(1);
  const away = people.awayNow.map((p) => p.resident.id);
  // The truck's music over the whole map, with dice that would bring anyone out.
  at(T.AWAY_FIRST_HOME_MINUTE - 5, { x: 1500, y: 1250, radius: 5000, open: true });
  for (const p of people.all) if (away.includes(p.resident.id)) assert.equal(p.customer, 'none', `${p.resident.name} stayed away`);
  assert.equal(people.awayNow.length, away.length, 'nobody is back before 5:30');
});

test('SCREAM-379: from 5:30 they appear at the map\'s edge and walk home; some stay out', () => {
  const { people, at } = evening(1);
  const away = [...people.awayNow];
  const due = away.filter((p) => people.arrivesAt(p) !== null);
  const out = away.filter((p) => people.arrivesAt(p) === null);
  assert.ok(due.length > 0 && out.length > 0, `some come home (${due.length}) and some stay out (${out.length})`);
  for (const p of due) {
    const m = people.arrivesAt(p);
    assert.ok(m >= T.AWAY_FIRST_HOME_MINUTE && m <= T.AWAY_LAST_HOME_MINUTE, `${p.resident.name} at ${m}`);
  }
  const first = due.reduce((a, b) => (people.arrivesAt(a) <= people.arrivesAt(b) ? a : b));
  const when = people.arrivesAt(first);
  at(when + 0.5);
  assert.ok(first.comingHome && first.outside && !first.away && first.walking, `${first.resident.name} is walking home`);
  const { width, height } = TUTORIAL;
  assert.ok(first.x < 30 || first.y < 30 || first.x > width - 30 || first.y > height - 30, `...from the edge of the map (${Math.round(first.x)}, ${Math.round(first.y)})`);
  assert.equal(people.porchLit(first), false, 'no porch light until they are in');
  at(T.EVENING_END_HOUR * 60);
  for (const p of due) assert.ok(!p.away && !p.comingHome && Math.hypot(p.x - p.resident.door[0], p.y - p.resident.door[1]) < 200, `${p.resident.name} is home by 8:00 (indoors or in their yard)`);
  for (const p of out) assert.ok(p.away && !p.outside, `${p.resident.name} stayed out all evening`);
});

test('SCREAM-379: once home they are as likely as on a ticked day, and their car is outside', () => {
  const { people, at } = evening(1);
  const due = people.awayNow.filter((p) => people.arrivesAt(p) !== null);
  const someone = due.find((p) => p.resident.likelihood > 0 && p.resident.likelihood < 0.7);
  assert.equal(people.likelihoodNow(someone.resident), Math.min(1, someone.resident.likelihood * T.SCHEDULE_UNTICKED_FACTOR));
  const driver = due.find((p) => p.resident.car);
  assert.ok(driver, 'someone away today has a car');
  assert.ok(!people.carsNow.some((c) => c.id === driver.resident.id));
  at(T.EVENING_END_HOUR * 60 - 1);
  assert.equal(people.likelihoodNow(someone.resident), Math.min(1, someone.resident.likelihood * T.SCHEDULE_TICKED_FACTOR));
  assert.ok(people.carsNow.some((c) => c.id === driver.resident.id), `${driver.resident.name}'s car is outside once they are in`);
  assert.ok(people.porchLit(driver) || driver.outside, 'and their porch light is on (or they are out in the yard)');
});

test('SCREAM-379: someone walking home can be called to the truck, then goes home', () => {
  const { people, at } = evening(1);
  const due = people.awayNow.filter((p) => people.arrivesAt(p) !== null && p.resident.likelihood >= 0.3);
  const p = due[0];
  at(people.arrivesAt(p) + 2);
  assert.ok(p.comingHome);
  people.callNow(p);
  assert.equal(p.customer, 'waiting');
  people.startServing(p);
  people.finishServing(p);
  at(T.EVENING_END_HOUR * 60);
  assert.ok(!p.comingHome && !p.away && Math.hypot(p.x - p.resident.door[0], p.y - p.resident.door[1]) < 200, 'home after the sale');
});

test('SCREAM-379: adults mostly get home in the first hour, kids any time to 7:30; about 1 in 6 stay out', () => {
  const dice = awayDice(99, 3);
  const adults = Array.from({ length: 4000 }, () => arrivalMinute(false, dice));
  const kids = Array.from({ length: 4000 }, () => arrivalMinute(true, dice));
  const early = (list) => list.filter((m) => m <= T.AWAY_ADULT_EARLY_UNTIL_MINUTE).length / list.length;
  assert.ok(Math.abs(early(adults) - T.AWAY_ADULT_EARLY_SHARE) < 0.04, `adults early: ${early(adults)}`);
  assert.ok(Math.abs(early(kids) - 0.5) < 0.04, `kids early: ${early(kids)}`);
  for (const m of [...adults, ...kids]) assert.ok(m >= T.AWAY_FIRST_HOME_MINUTE && m <= T.AWAY_LAST_HOME_MINUTE);
  let away = 0;
  let stayed = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const day of [1, 2, 3, 4, 5]) {
      const { people } = evening(day, seed);
      // People with an Until they would miss stay out too: count the others.
      const list = people.awayNow.filter((p) => !p.resident.hours);
      away += list.length;
      stayed += list.filter((p) => people.arrivesAt(p) === null).length;
    }
  }
  assert.ok(Math.abs(stayed / away - T.AWAY_STAY_OUT_SHARE) < 0.04, `stay out: ${stayed / away}`);
  // The same evening is the same every time.
  const a = evening(3, 7).people.awayNow.map((p) => [p.resident.id, evening(3, 7).people.arrivesAt(p)]);
  const again = evening(3, 7).people;
  assert.deepEqual(a.map(([id]) => id), again.awayNow.map((p) => p.resident.id));
});

test('SCREAM-379: the walk home starts outside the map, ends at their curb, and is not too long (both maps)', () => {
  for (const [list, map, most] of [[TUTORIAL_RESIDENTS, TUTORIAL, 1400], [RESIDENTS, WORCESTER, 3600]]) {
    for (const r of list.filter((x) => !x.visitor)) {
      const route = walkInRoute(r, map.roads, map);
      const [x, y] = route[0];
      assert.ok(x < 0 || y < 0 || x > map.width || y > map.height, `${r.name} starts outside the map`);
      assert.deepEqual(route[route.length - 1], [r.curb[0], r.curb[1]], `${r.name} ends at their curb`);
      for (const [px, py] of route.slice(1)) assert.ok(px >= 0 && px <= map.width && py >= 0 && py <= map.height, `${r.name}'s other points are on the map`);
      assert.ok(length(route) < most, `${r.name}: ${Math.round(length(route))} px`);
    }
  }
  // Nobody walks through the middle of Elm Park's roundabout.
  const ring = TUTORIAL.roads.find((r) => r.ring).ring;
  for (const r of TUTORIAL_RESIDENTS.filter((x) => !x.visitor)) {
    const route = walkInRoute(r, TUTORIAL.roads, TUTORIAL);
    for (let i = 1; i < route.length; i++) {
      for (let k = 0; k <= 50; k++) {
        const x = route[i - 1][0] + ((route[i][0] - route[i - 1][0]) * k) / 50;
        const y = route[i - 1][1] + ((route[i][1] - route[i - 1][1]) * k) / 50;
        assert.ok(Math.hypot(x - ring.x, y - ring.y) > ring.r - 31, `${r.name} keeps out of the roundabout's middle`);
      }
    }
  }
});
