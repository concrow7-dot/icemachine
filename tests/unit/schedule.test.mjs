// SCREAM-221 (PO, decision 057): customers' weekly schedules. In Story the sheet's Mon to Sun
// ticks decide who buys each evening; Quick play keeps using Likelihood.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { weekdayOf, weekdayName, kindFor, buysTonight, buyerKind } = await game('state/Residents');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');

const base = { id: 'X1', name: 'Test', kid: false, street: 'Test Street', look: 0, door: [0, 0], yard: [], curb: [0, 0, 0, 0, 0] };
const monThu = { ...base, likelihood: 0.3, days: [0, 3] };
const everyDay = { ...base, likelihood: 0.15, days: [0, 1, 2, 3, 4, 5, 6] };
const noDays = { ...base, likelihood: 0.8, days: [] };
const story = (day) => ({ day, seed: 99 });
const never = () => { throw new Error('Story with ticks must not roll the dice'); };

test('Story starts on a Monday: Day 1 Monday ... Day 5 Friday, Day 8 Monday again', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(weekdayName), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.equal(weekdayOf(8), 0);
  assert.equal(weekdayName(14), 'Sunday');
});

test('Story: someone ticked Mon and Thu buys on Day 1 and Day 4 only, every run', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => buysTonight(monThu, never, story(d))), [true, false, false, true, false]);
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => buysTonight(monThu, never, { day: d, seed: 7 })), [true, false, false, true, false]);
});

test('Story: the ticks decide the kind, not Likelihood (all 7 = regular, none = never)', () => {
  assert.equal(kindFor(everyDay, story(1)), 'regular');   // 15% would be "sometimes" in Quick play
  assert.equal(kindFor(noDays, story(1)), 'never');       // 80% would be a regular in Quick play
  assert.equal(kindFor(monThu, story(1)), 'sometimes');
  assert.equal(buysTonight(everyDay, never, story(3)), true);
  assert.equal(buysTonight(noDays, never, story(3)), false);
});

test('Quick play ignores the ticks: Likelihood decides as before', () => {
  assert.equal(kindFor(everyDay), buyerKind(0.15));
  assert.equal(kindFor(noDays), 'regular');
  assert.equal(buysTonight(noDays, () => 0.99), true);
  let n = 0;
  for (let i = 0; i < 3000; i++) if (buysTonight(monThu, Math.random)) n++;
  assert.ok(n > 850 && n < 1150, `about 1 evening in 3, got ${n}`);
});

test('Without ticks, Story falls back to Likelihood (as before SCREAM-221)', () => {
  const old = { ...base, likelihood: 0.3 };
  assert.equal(kindFor(old, story(1)), 'sometimes');
  assert.equal([1, 2, 3].filter((d) => buysTonight(old, Math.random, story(d))).length, 1);
});

test('Both maps have ticks for everyone, from the Residents sheet', () => {
  for (const list of [TUTORIAL_RESIDENTS, RESIDENTS]) {
    assert.ok(list.every((r) => Array.isArray(r.days) && r.days.every((d) => d >= 0 && d <= 6)));
  }
  // Chloe Hogan, the uncle's regular on Day 1 (Monday), is home every day.
  assert.equal(TUTORIAL_RESIDENTS.find((r) => r.id === 'T008').days.length, 7);
});

test('Each weekday has a different crowd (decision 057: neighbourhoods differ through the week)', () => {
  const crowd = (d) => TUTORIAL_RESIDENTS.filter((r) => buysTonight(r, never, story(d))).map((r) => r.id).join();
  const days = [1, 2, 3, 4, 5].map(crowd);
  assert.equal(new Set(days).size, 5);
});
