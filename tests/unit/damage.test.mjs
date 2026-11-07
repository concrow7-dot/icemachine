import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { hitCostCents } = await game('state/Damage');

test('a hit at top speed costs the full price; the slowest hit that counts costs half', () => {
  assert.equal(hitCostCents(1000, 300, 300), 1000);
  assert.equal(hitCostCents(1000, 75, 300), 500);
  assert.equal(hitCostCents(1000, 10, 300), 500, 'never below half');
  assert.equal(hitCostCents(1000, 900, 300), 1000, 'never above full');
});

test('in between it climbs in a straight line, rounded to the nearest quarter', () => {
  const mid = hitCostCents(1000, 187.5, 300); // halfway between a quarter and full speed
  assert.equal(mid, 750);
  assert.equal(hitCostCents(500, 150, 300) % 25, 0);
});
