// SCREAM-312 (PO, November 14): the Lil Explorer Pop's exploration tip, by straight-line distance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { explorationTipCents } = await game('state/ExplorationTip');
const { MAPS } = await game('config/maps');

const elm = MAPS.tutorial.data;
const elmRing = elm.roads.find((r) => r.ring).ring;
const foleyRing = MAPS.worcester.data.roads.find((r) => r.ring).ring;
const foleyFarthest = MAPS.worcester.residents.reduce((far, r) =>
  Math.hypot(r.curb[2] - foleyRing.x, r.curb[3] - foleyRing.y) > Math.hypot(far.curb[2] - foleyRing.x, far.curb[3] - foleyRing.y) ? r : far);

test('Elm Park (home): $0 at home, $1.00 at the roundabout, never more', () => {
  assert.equal(explorationTipCents('tutorial', 'tutorial', elm.homeStart.x, elm.homeStart.y), 0);
  assert.equal(explorationTipCents('tutorial', 'tutorial', elmRing.x, elmRing.y), 100);
  assert.equal(explorationTipCents('tutorial', 'tutorial', elmRing.x - 500, elmRing.y + 500), 100);
});

test('Elm Park: in $0.10 steps, rounded down, halfway is $0.50', () => {
  const mid = (a, b) => a + (b - a) * 0.5;
  assert.equal(explorationTipCents('tutorial', 'tutorial', mid(elm.homeStart.x, elmRing.x), mid(elm.homeStart.y, elmRing.y)), 50);
  const just = (a, b) => a + (b - a) * 0.29;
  assert.equal(explorationTipCents('tutorial', 'tutorial', just(elm.homeStart.x, elmRing.x), just(elm.homeStart.y, elmRing.y)), 20);
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    assert.equal(explorationTipCents('tutorial', 'tutorial', elm.homeStart.x + (elmRing.x - elm.homeStart.x) * f, elm.homeStart.y + (elmRing.y - elm.homeStart.y) * f) % 10, 0);
  }
});

test('Foley Stadium (away): $1.50 at Newton Square, $5.00 at the farthest customer, and more beyond', () => {
  assert.equal(explorationTipCents('worcester', 'tutorial', foleyRing.x, foleyRing.y), 150);
  assert.equal(explorationTipCents('worcester', 'tutorial', foleyFarthest.curb[2], foleyFarthest.curb[3]), 500);
  const beyond = { x: foleyRing.x + (foleyFarthest.curb[2] - foleyRing.x) * 1.2, y: foleyRing.y + (foleyFarthest.curb[3] - foleyRing.y) * 1.2 };
  assert.equal(explorationTipCents('worcester', 'tutorial', beyond.x, beyond.y), 570);
});
