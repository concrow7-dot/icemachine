import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { placeNotes, nextNote } = await game('state/PowerUpBoard');
const { POWER_UP_TREES } = await game('config/powerUps');

const notes = placeNotes(POWER_UP_TREES);

test('SCREAM-267: three trees, Truck, Speaker and Sales, left to right', () => {
  assert.deepEqual(POWER_UP_TREES.map((t) => t.name), ['TRUCK', 'SPEAKER', 'SALES']);
  const middles = [0, 1, 2].map((t) => notes.filter((n) => n.tree === t).reduce((s, n) => s + n.x, 0));
  assert.ok(middles[0] < middles[1] && middles[1] < middles[2]);
});

test('every note has its own place, and hangs only from notes above it in its own tree', () => {
  const spots = new Set(notes.map((n) => `${n.x},${n.y}`));
  assert.equal(spots.size, notes.length);
  for (const note of notes) {
    for (const id of note.from) {
      const parent = notes.find((n) => n.id === id);
      assert.ok(parent, `${note.id} hangs from ${id}`);
      assert.equal(parent.tree, note.tree);
      assert.ok(parent.y < note.y, `${id} is above ${note.id}`);
    }
  }
});

test('the arrow keys move to the nearest note that way', () => {
  assert.equal(nextNote(notes, 'truck-1', 'down'), 'truck-5');
  assert.equal(nextNote(notes, 'truck-5', 'left'), 'truck-4');
  assert.equal(nextNote(notes, 'truck-5', 'right'), 'truck-6');
  assert.equal(nextNote(notes, 'truck-5', 'up'), 'truck-1');
});

test('...and cross from one tree to the next', () => {
  assert.equal(nextNote(notes, 'truck-6', 'right'), 'speaker-3');
  assert.equal(nextNote(notes, 'speaker-3', 'left'), 'truck-6');
});

test('...and stay put at the edge of the board', () => {
  assert.equal(nextNote(notes, 'truck-4', 'left'), 'truck-4');
  assert.equal(nextNote(notes, 'truck-1', 'up'), 'truck-1');
  assert.equal(nextNote(notes, 'sales-9', 'down'), 'sales-9');
});

test('every note can be reached with the arrow keys from the first one', () => {
  const seen = new Set(['truck-1']);
  const queue = ['truck-1'];
  while (queue.length) {
    const id = queue.pop();
    for (const d of ['left', 'right', 'up', 'down']) {
      const next = nextNote(notes, id, d);
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  assert.equal(seen.size, notes.length);
});
