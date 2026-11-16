// SCREAM-182 (PO, November 6, his drawing "Customer Likelihood"): in Story, once someone hears the
// truck, their chance of coming out rises, peaks at about 7 seconds, then fades by 30. His answer
// (November 15): "Height and peak time" change per customer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { curveChance, peakTimeOf, customerChance, Residents } = await game('state/Residents');
const { CUSTOMER_CURVE_SCALE, CUSTOMER_DECIDE_SECONDS } = await game('config/tuning');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');

const curve = (peak, L = 1) => Array.from({ length: 31 }, (_, h) => curveChance(h, L, false, peak));
const over30 = (f) => 1 - Array.from({ length: 30 }, (_, i) => 1 - f(i + 1)).reduce((a, b) => a * b, 1);

test('his drawing: starts partway up, peaks near the top at about 7 s, fades to just above nothing by 30 s', () => {
  const c = curve(7);
  const top = Math.max(...c);
  assert.equal(c.indexOf(top), 7);
  assert.ok(c[0] > top * 0.4 && c[0] < top * 0.55, 'starts at about half way');
  assert.ok(c[30] > 0 && c[30] < top * 0.05, 'just above nothing at 30 s');
  for (let h = 1; h <= 7; h++) assert.ok(c[h] > c[h - 1], `rises at ${h}`);
  for (let h = 8; h <= 30; h++) assert.ok(c[h] < c[h - 1], `falls at ${h}`);
  assert.equal(curveChance(CUSTOMER_DECIDE_SECONDS + 1, 1, false, 7), 0, 'after 30 s they have decided');
  assert.ok(Math.abs(top - 0.93 * CUSTOMER_CURVE_SCALE) < 1e-9);
});

test('"Height": their Likelihood scales it; indoors halves it (as before)', () => {
  assert.ok(Math.abs(curveChance(7, 0.4, false, 7) - 0.4 * curveChance(7, 1, false, 7)) < 1e-12);
  assert.ok(Math.abs(curveChance(7, 0.4, true, 7) - 0.5 * curveChance(7, 0.4, false, 7)) < 1e-12);
});

test('"peak time": each resident peaks a little earlier or later, between 5 and 9 s, the same every time', () => {
  const peaks = TUTORIAL_RESIDENTS.map((r) => peakTimeOf(r.id));
  for (const p of peaks) assert.ok(p >= 5 && p <= 9);
  assert.ok(Math.max(...peaks) - Math.min(...peaks) > 2.5, 'spread out');
  assert.equal(peakTimeOf('T001'), peakTimeOf('T001'));
  const c = curve(5);
  assert.equal(c.indexOf(Math.max(...c)), 5);
  assert.ok(c[30] < c[29], 'a curve that peaks early still fades by 30 s');
});

test('engineering\'s call: as many people come out over the 30 seconds as with the old falling chance', () => {
  for (const L of [0.15, 0.35, 0.6, 0.9]) {
    const old = over30((h) => customerChance(h, L, false, false));
    const now = over30((h) => curveChance(h, L, false, 7));
    assert.ok(Math.abs(now - old) < 0.01, `Likelihood ${L}: ${now.toFixed(3)} vs ${old.toFixed(3)}`);
  }
});

test('Story uses the curve, Quick play the old falling chance: in Story more of the some-days people come out at 6 to 8 s than in the first two seconds', () => {
  // Regulars keep their steady chance (decision 034), so they're left out here.
  const people = TUTORIAL_RESIDENTS.filter((r) => !r.visitor && r.likelihood > 0 && r.days && r.days.length < 7);
  const firstSecondOut = (story) => {
    let early = 0, peak = 0;
    for (let run = 0; run < 300; run++) {
      let n = run * 7919 + 1;
      const dice = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); // the same every test run
      const rs = new Residents(people, dice, undefined, story ? { day: 2, seed: run } : undefined);
      for (const p of rs.all) p.outside = true;
      const ring = { x: 0, y: 0, radius: 1e9, open: true };
      for (let s = 1; s <= 8; s++) {
        const before = rs.all.filter((p) => p.customer !== 'none').length;
        rs.update(1, ring);
        const came = rs.all.filter((p) => p.customer !== 'none').length - before;
        if (s <= 2) early += came; else if (s >= 6) peak += came;
      }
    }
    return [early, peak];
  };
  const [sEarly, sPeak] = firstSecondOut(true);
  const [qEarly, qPeak] = firstSecondOut(false);
  // Per second: seconds 1 and 2 against seconds 6, 7 and 8.
  assert.ok(sPeak / 3 > (sEarly / 2) * 1.1, `Story: ${sEarly} in seconds 1-2, ${sPeak} in 6-8`);
  assert.ok(qEarly / 2 > qPeak / 3, `Quick play keeps the falling chance: ${qEarly} in 1-2, ${qPeak} in 6-8`);
});
