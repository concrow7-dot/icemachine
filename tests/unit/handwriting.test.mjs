import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { writingFor, handSize, ADULT_HANDS, KID_HANDS, UNCLE_HAND, ALL_HANDS } = await game('state/Handwriting');
const { bubbleOutline } = await game('state/BubbleOutline');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');

test('SCREAM-378: adults write in a neat adult hand, kids in a kid hand', () => {
  for (const r of [...TUTORIAL_RESIDENTS, ...RESIDENTS]) {
    const w = writingFor(r);
    assert.ok((r.kid ? KID_HANDS : ADULT_HANDS).includes(w.hand), `${r.name}: ${w.hand.font}`);
    assert.ok(Math.abs(w.tilt) <= w.hand.maxTilt, `${r.name} leans no more than their hand allows`);
    if (!r.kid) assert.equal(w.tilt, 0, 'adults write level');
  }
});

test('SCREAM-378: a person keeps the same handwriting', () => {
  const kev = TUTORIAL_RESIDENTS.find((r) => r.name === 'Big Kev');
  assert.deepEqual(writingFor(kev), writingFor({ id: kev.id, kid: true }));
});

test('SCREAM-378: some kids are near perfect, others messy (both maps)', () => {
  for (const list of [TUTORIAL_RESIDENTS, RESIDENTS]) {
    const used = new Set(list.filter((r) => r.kid).map((r) => KID_HANDS.indexOf(writingFor(r).hand)));
    assert.ok(used.has(0) || used.has(1), 'a neat kid');
    assert.ok(used.has(KID_HANDS.length - 1) || used.has(KID_HANDS.length - 2), 'a messy kid');
    assert.ok(used.size >= 4, `at least four different kids' hands (${used.size})`);
  }
});

test('SCREAM-378: every hand has its own font file, and a size', () => {
  assert.equal(new Set(ALL_HANDS.map((h) => h.file)).size, ALL_HANDS.length);
  assert.ok(ALL_HANDS.includes(UNCLE_HAND));
  assert.equal(handSize({ ...UNCLE_HAND, size: 1.5 }, 20), 30);
});

test('SCREAM-378: the bubble outline stays close to its box and is the same every time', () => {
  const shape = { w: 480, h: 150, radius: 22, wobble: 1.6, seed: 7 };
  const pts = bubbleOutline(shape);
  assert.deepEqual(pts, bubbleOutline(shape));
  assert.notDeepEqual(pts, bubbleOutline({ ...shape, seed: 8 }));
  for (const [x, y] of pts) {
    assert.ok(x >= -1.7 && x <= 481.7 && y >= -1.7 && y <= 151.7, `(${x}, ${y}) is within the wobble of the box`);
  }
  // A hand-drawn line is not dead straight: the top edge wanders.
  const top = pts.filter(([x, y]) => x > 40 && x < 440 && y < 10).map(([, y]) => y);
  assert.ok(Math.max(...top) - Math.min(...top) > 0.8);
});

test('SCREAM-378: the tail reaches its tip, to the right or downwards', () => {
  const base = { w: 480, h: 150, radius: 22, wobble: 1.6, seed: 7 };
  const right = bubbleOutline({ ...base, tail: { side: 'right', at: 92, width: 38, length: 78, lean: 14 } });
  const tipR = right.reduce((a, b) => (b[0] > a[0] ? b : a));
  assert.deepEqual(tipR.map(Math.round), [558, 106]);
  const down = bubbleOutline({ ...base, tail: { side: 'down', at: 232, width: 40, length: 54, lean: -22 } });
  const tipD = down.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.deepEqual(tipD.map(Math.round), [210, 204]);
  // The box's other sides are untouched by the tail.
  assert.ok(down.every(([x]) => x < 482));
});
