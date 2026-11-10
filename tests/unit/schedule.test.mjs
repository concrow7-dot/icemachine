// SCREAM-221 (PO, decision 057) and SCREAM-232 (PO, November 10): customers' weekly schedules.
// In Story the sheet's Mon to Sun ticks make someone a bit likelier to come out on their ticked
// days and much less likely on the others; Quick play keeps using Likelihood alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { weekdayOf, weekdayName, kindFor, buysTonight, buyerKind, scheduleFactor } = await game('state/Residents');
const { SCHEDULE_TICKED_FACTOR, SCHEDULE_UNTICKED_FACTOR } = await game('config/tuning');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');

const base = { id: 'X1', name: 'Test', kid: false, street: 'Test Street', look: 0, door: [0, 0], yard: [], curb: [0, 0, 0, 0, 0] };
const monThu = { ...base, likelihood: 0.3, days: [0, 3] };
const everyDay = { ...base, likelihood: 0.15, days: [0, 1, 2, 3, 4, 5, 6] };
const noDays = { ...base, likelihood: 0.8, days: [] };
const zero = { ...base, likelihood: 0, days: [0] };
const story = (day) => ({ day, seed: 99 });
const never = () => { throw new Error('Story with ticks must not roll the dice'); };

test('Story starts on a Monday: Day 1 Monday ... Day 5 Friday, Day 8 Monday again', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(weekdayName), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(weekdayOf(8), 0);
  assert.equal(weekdayName(14), 'Sunday');
});

test('PO: ticked days a bit likelier, other days much less likely (Mon and Thu ticked)', () => {
  assert.ok(SCHEDULE_TICKED_FACTOR > 1 && SCHEDULE_UNTICKED_FACTOR < 0.5);
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => scheduleFactor(monThu, story(d))),
    [SCHEDULE_TICKED_FACTOR, SCHEDULE_UNTICKED_FACTOR, SCHEDULE_UNTICKED_FACTOR, SCHEDULE_TICKED_FACTOR, SCHEDULE_UNTICKED_FACTOR]);
});

test('Story: anyone but 0% may come out on any evening (no dice for the evening)', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => buysTonight(monThu, never, story(d))), [true, true, true, true, true]);
  assert.equal(buysTonight(noDays, never, story(2)), true);
  assert.equal(buysTonight(zero, never, story(1)), false);
});

test('Story kinds: ticked all 7 days = regular (even at 15%); 0% = never; anyone else sometimes', () => {
  assert.equal(kindFor(everyDay, story(1)), 'regular');
  assert.equal(kindFor(monThu, story(1)), 'sometimes');
  assert.equal(kindFor(noDays, story(1)), 'sometimes');   // 80% would be a regular in Quick play
  assert.equal(kindFor(zero, story(1)), 'never');
});

test('Quick play ignores the ticks: Likelihood decides as before', () => {
  assert.equal(scheduleFactor(monThu), 1);
  assert.equal(kindFor(everyDay), buyerKind(0.15));
  assert.equal(kindFor(noDays), 'regular');
  let n = 0;
  for (let i = 0; i < 3000; i++) if (buysTonight(monThu, Math.random)) n++;
  assert.ok(n > 850 && n < 1150, `about 1 evening in 3, got ${n}`);
});

test('Without ticks, Story falls back to Likelihood (as before SCREAM-221)', () => {
  const old = { ...base, likelihood: 0.3 };
  assert.equal(kindFor(old, story(1)), 'sometimes');
  assert.equal(scheduleFactor(old, story(1)), 1);
  assert.equal([1, 2, 3].filter((d) => buysTonight(old, Math.random, story(d))).length, 1);
});

test('Both maps have ticks for everyone, from the Residents sheet', () => {
  for (const list of [TUTORIAL_RESIDENTS, RESIDENTS]) {
    assert.ok(list.every((r) => Array.isArray(r.days) && r.days.every((d) => d >= 0 && d <= 6)));
  }
  // Chloe Hogan, the uncle's regular on Day 1 (Monday), is ticked every day.
  assert.equal(TUTORIAL_RESIDENTS.find((r) => r.id === 'T008').days.length, 7);
});

test('Each weekday favours a different crowd (decision 057: neighbourhoods differ through the week)', () => {
  const crowd = (d) => TUTORIAL_RESIDENTS.filter((r) => scheduleFactor(r, story(d)) > 1).map((r) => r.id).join();
  assert.equal(new Set([1, 2, 3, 4, 5].map(crowd)).size, 5);
});
