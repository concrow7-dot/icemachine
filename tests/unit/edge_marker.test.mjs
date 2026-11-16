import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { edgeMarker } = await game('state/EdgeMarker');
const view = { x: 100, y: 200, right: 900, bottom: 600 };
const round = (m) => m && [Math.round(m.x), Math.round(m.y), Math.round((m.angle * 180) / Math.PI)];

test('SCREAM-341: a customer inside the view has no marker', () => {
  assert.equal(edgeMarker(view, 500, 400, 24), null);
  assert.equal(edgeMarker(view, 100, 200, 24), null);
});

test('SCREAM-341: a customer off screen gets a marker just inside the edge, pointing at them', () => {
  assert.deepEqual(round(edgeMarker(view, 1500, 400, 24)), [876, 400, 0]); // straight right
  assert.deepEqual(round(edgeMarker(view, -300, 400, 24)), [124, 400, 180]); // straight left
  assert.deepEqual(round(edgeMarker(view, 500, 0, 24)), [500, 224, -90]); // straight up
  assert.deepEqual(round(edgeMarker(view, 500, 2000, 24)), [500, 576, 90]); // straight down
});

test('SCREAM-341: toward a corner the marker stays inside the view on both sides', () => {
  const m = edgeMarker(view, 3000, 3000, 24);
  assert.ok(m.x <= 876 + 1e-9 && m.y <= 576 + 1e-9 && m.x > 500 && m.y > 400);
  assert.ok(m.angle > 0 && m.angle < Math.PI / 2);
});
