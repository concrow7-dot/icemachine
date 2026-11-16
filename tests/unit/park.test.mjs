// SCREAM-224 (PO, November 15): people at the park in Elm Park. "There should be a lot of people
// there like 13 at 5pm. Then after 5:45 it should start to empty out. so that by 7 there are only
// 1 or 2 people left." His answers: "A mix" (the residents who get home late, plus new visitors)
// and "Random each evening". Story only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { Residents, kindFor, buysTonight, parkDice } = await game('state/Residents');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');
const { TUTORIAL } = await game('config/tutorial');
const { PARK_VISITORS_TONIGHT, PARK_STAY_LATE, PARK_LEAVE_MINUTES, PARK_HOME_WALK_MINUTES, EVENING_LENGTH_SECONDS, EVENING_START_HOUR, EVENING_END_HOUR } =
  await game('config/tuning');

const visitors = TUTORIAL_RESIDENTS.filter((r) => r.visitor);
const parkResidents = TUTORIAL_RESIDENTS.filter((r) => r.park && !r.visitor);
const story = (day, seed = 4242) => ({ day, seed });

/** An evening's people with a clock the test moves: `at(minutes)` runs the evening on to that time. */
function evening(day, seed = 4242, open = true) {
  // The game's other dice (Math.random in the game), made repeatable for the tests.
  let n = (seed * 31 + day) >>> 0;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const people = new Residents(TUTORIAL_RESIDENTS, rnd, undefined, story(day, seed));
  let seconds = 0;
  const perMinute = EVENING_LENGTH_SECONDS / ((EVENING_END_HOUR - EVENING_START_HOUR) * 60);
  people.nowMinutes = () => EVENING_START_HOUR * 60 + seconds / perMinute;
  if (open) people.openPark();
  const at = (minutes, ring) => {
    const until = (minutes - EVENING_START_HOUR * 60) * perMinute;
    while (seconds < until) {
      seconds += 0.25;
      people.update(0.25, ring);
    }
  };
  return { people, at };
}
const names = (list) => list.map((p) => p.resident.name).sort();

test('the sheet: 13 park visitors with no house, and the three residents who get home late', () => {
  assert.equal(visitors.length, 13);
  assert.deepEqual(parkResidents.map((r) => r.name).sort(), ['Drake Maye', 'Joe Sullivan', 'Kathleen Scoopley']);
  for (const r of parkResidents) assert.ok(r.hours && r.hours[0] !== null, `${r.name} has a From time`);
  for (const r of TUTORIAL_RESIDENTS.filter((x) => x.park)) {
    assert.ok(r.park.spots.length >= 8, `${r.name} has at least 4 spots`);
    assert.ok(r.park.exit[1] > TUTORIAL.height, `${r.name} walks off the bottom of the map`);
  }
  assert.equal(RESIDENTS.filter((r) => r.park || r.visitor).length, 0, 'Foley Stadium has no park people');
});

test('the spots are on the court, in the sand or on the grass beside them (not on a hoop or a plaything)', () => {
  const court = TUTORIAL.objects.find((o) => o.key === 'court_basketball');
  const play = TUTORIAL.objects.find((o) => o.key === 'play_ground');
  assert.ok(court && play);
  for (const r of TUTORIAL_RESIDENTS.filter((x) => x.park)) {
    for (let i = 0; i < r.park.spots.length; i += 2) {
      const [x, y] = [r.park.spots[i], r.park.spots[i + 1]];
      assert.ok(Math.abs(x - court.x) < 330 && Math.abs(y - court.y) < 200, `${r.name}'s spot ${x},${y} is at the park`);
    }
  }
});

test('a visitor is a some-days customer, never a regular, and the chasing regulars are who they were', () => {
  for (const r of visitors) {
    assert.equal(kindFor(r, story(1)), 'sometimes');
    assert.equal(buysTonight(r, () => 0.99, story(1)), true);
    assert.equal(r.days, undefined);
  }
  const before = new Residents(TUTORIAL_RESIDENTS.filter((r) => !r.visitor), Math.random, undefined, story(1));
  const now = new Residents(TUTORIAL_RESIDENTS, Math.random, undefined, story(1));
  for (const r of TUTORIAL_RESIDENTS.filter((x) => !x.visitor)) assert.equal(now.isChaser(r), before.isChaser(r), r.name);
  for (const r of visitors) assert.equal(now.isChaser(r), false);
});

test('not Story, or the park not opened (the uncle\'s evening): no visitors anywhere, residents as before', () => {
  const quick = new Residents(TUTORIAL_RESIDENTS, Math.random);
  quick.openPark();
  assert.equal(quick.atParkNow.length, 0);
  assert.equal(quick.all.filter((p) => p.resident.visitor && p.outside).length, 0);
  const { people, at } = evening(1, 4242, false);
  at(17 * 60 + 30, { x: 2050, y: 2090, radius: 400, open: true });
  assert.equal(people.atParkNow.length, 0);
  assert.equal(people.all.filter((p) => p.resident.visitor && (p.outside || p.customer !== 'none')).length, 0);
});

test('PO: "a lot of people there like 13 at 5pm": 10 of the visitors and the 3 residents', () => {
  for (let day = 1; day <= 10; day++) {
    const { people } = evening(day);
    const here = people.atParkNow;
    assert.equal(here.length, PARK_VISITORS_TONIGHT + 3, `day ${day}`);
    assert.equal(here.length, 13);
    assert.equal(here.filter((p) => p.resident.visitor).length, PARK_VISITORS_TONIGHT);
    for (const p of here) assert.ok(p.outside && !p.walking);
    // Nobody stands on top of anybody else.
    for (const a of here) for (const b of here) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1, `${a.resident.name} and ${b.resident.name}`);
    assert.equal(people.all.filter((p) => p.gone).length, 3, 'the other three visitors are not on the map');
  }
});

test('PO: "after 5:45 it should start to empty out ... by 7 there are only 1 or 2 people left"', () => {
  for (const [day, seed] of [[1, 4242], [2, 4242], [3, 7], [6, 99], [9, 123456], [10, 5]]) {
    const { people, at } = evening(day, seed);
    at(17 * 60 + 35);
    assert.equal(people.atParkNow.length, 13, `day ${day}: nobody has left by 5:35`);
    at(17 * 60 + 44);
    assert.ok(people.atParkNow.length >= 12, `day ${day}: only Joe Sullivan may have set off before 5:45`);
    at(18 * 60 + 20);
    const half = people.atParkNow.length;
    assert.ok(half < 12 && half > 2, `day ${day}: emptying at 6:20 (${half} left)`);
    at(19 * 60);
    const left = people.atParkNow;
    assert.ok(left.length >= PARK_STAY_LATE[0] && left.length <= PARK_STAY_LATE[1], `day ${day}: ${left.length} left at 7:00`);
    assert.ok(left.every((p) => p.resident.visitor));
    // Everyone else who was there has walked right off the map by ten past seven.
    at(19 * 60 + 10);
    assert.equal(people.all.filter((p) => p.resident.visitor && p.outside).length, left.length, `day ${day}`);
    at(20 * 60);
    assert.deepEqual(names(people.atParkNow), names(left), 'the ones who stay are there to the end');
  }
});

test('a resident at the park sets off before their From time and is home by then', () => {
  const { people, at } = evening(1);
  for (const r of parkResidents) {
    const p = people.all.find((x) => x.resident.id === r.id);
    assert.equal(p.atPark, true);
    assert.equal(people.porchLit(p), false, `${r.name}'s porch light is off while they are at the park`);
  }
  for (const r of [...parkResidents].sort((a, b) => a.hours[0] - b.hours[0])) {
    const p = people.all.find((x) => x.resident.id === r.id);
    at(r.hours[0] - PARK_HOME_WALK_MINUTES - 1);
    assert.ok(p.atPark && !p.leaving, `${r.name} is still at the park`);
    at(r.hours[0] + 1);
    assert.ok(!p.atPark && !p.gone, `${r.name} has left the park by their From time`);
    assert.equal(people.homeNow(r), true);
    assert.ok(Math.hypot(p.x - r.door[0], p.y - r.door[1]) < 120, `${r.name} is at home`);
  }
});

test('PO: "Random each evening": who is there and when they leave changes from evening to evening', () => {
  const crowds = new Set();
  const stays = new Set();
  for (let day = 1; day <= 10; day++) {
    const { people } = evening(day);
    crowds.add(names(people.atParkNow.filter((p) => p.resident.visitor)).join());
    stays.add(people.all.filter((p) => p.atPark && p.resident.visitor && p.leaveAt === null).length);
    for (const p of people.all.filter((x) => x.atPark && x.resident.visitor && x.leaveAt !== null))
      assert.ok(p.leaveAt >= PARK_LEAVE_MINUTES[0] && p.leaveAt <= PARK_LEAVE_MINUTES[1]);
  }
  assert.ok(crowds.size >= 8, `${crowds.size} different crowds in 10 evenings`);
  assert.deepEqual([...stays].sort(), [1, 2], 'some evenings 1 stays, some evenings 2');
  // The same evening of the same run is always the same crowd; another run's is different.
  assert.deepEqual(names(evening(3).people.atParkNow), names(evening(3).people.atParkNow));
  assert.notDeepEqual(names(evening(3, 1).people.atParkNow), names(evening(3, 2).people.atParkNow));
  const dice = parkDice(1, 1);
  for (let i = 0; i < 100; i++) assert.ok(dice() >= 0 && dice() < 1);
});

test('the music reaches the park: people there come to the park\'s curb, then go back to the park', () => {
  const { people, at } = evening(1);
  const curb = visitors[0].curb;
  const ring = { x: curb[2], y: curb[3], radius: 400, open: true };
  const joe = people.all.find((p) => p.resident.name === 'Joe Sullivan');
  at(17 * 60 + 2, ring);
  assert.ok(joe.heard > 0 || joe.customer !== 'none', 'a resident who isn\'t home yet hears it too: he is out at the park');
  at(17 * 60 + 10, ring);
  const came = people.all.filter((p) => p.atPark && p.customer !== 'none');
  assert.ok(came.length >= 2, `${came.length} of the 13 wanted ice cream in 10 game minutes`);
  for (const p of people.waiting) assert.deepEqual([p.pickup[0], p.pickup[1]], [curb[2], curb[3]], `${p.resident.name} waits at the park's curb`);
  // Nobody hears it from now on; they give up waiting and walk back to the park, done for the evening.
  at(17 * 60 + 34);
  for (const p of came) {
    assert.equal(p.customer, 'done', p.resident.name);
    assert.ok(p.atPark, p.resident.name);
  }
  assert.equal(people.atParkNow.length, 13);
});

test('a visitor has no porch light and is never home', () => {
  const { people, at } = evening(1);
  at(20 * 60);
  for (const p of people.all.filter((x) => x.resident.visitor)) assert.equal(people.porchLit(p), false);
});
