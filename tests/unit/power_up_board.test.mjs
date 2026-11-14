import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { placeNotes, nextNote, buyStatus } = await game('state/PowerUpBoard');
const { POWER_UP_TREES, FREE_NOTE_IDS, storyRefuseAboveCents } = await game('config/powerUps');

const notes = placeNotes(POWER_UP_TREES);

test('SCREAM-267, SCREAM-271: four trees, Truck, Ice Cream, Speaker and Sales, left to right', () => {
  assert.deepEqual(POWER_UP_TREES.map((t) => t.name), ['TRUCK', 'ICE CREAM', 'SPEAKER', 'SALES']);
  const middles = [0, 1, 2, 3].map((t) => notes.filter((n) => n.tree === t).reduce((s, n) => s + n.x, 0));
  assert.ok(middles[0] < middles[1] && middles[1] < middles[2] && middles[2] < middles[3]);
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
  assert.equal(nextNote(notes, 'temp-gas-can', 'down'), 'truck-5');
  assert.equal(nextNote(notes, 'truck-5', 'left'), 'truck-4');
  assert.equal(nextNote(notes, 'truck-5', 'right'), 'truck-6');
  assert.equal(nextNote(notes, 'truck-5', 'up'), 'temp-gas-can');
});

test('...and cross from one tree to the next', () => {
  assert.equal(nextNote(notes, 'truck-6', 'right'), 'icecream-explorer');
  assert.equal(nextNote(notes, 'icecream-explorer', 'left'), 'truck-6');
  assert.equal(nextNote(notes, 'icecream-explorer', 'right'), 'speaker-3');
});

test('...and stay put at the edge of the board', () => {
  assert.equal(nextNote(notes, 'truck-4', 'left'), 'truck-4');
  assert.equal(nextNote(notes, 'temp-gas-can', 'up'), 'temp-gas-can');
  assert.equal(nextNote(notes, 'sales-9', 'down'), 'sales-9');
});

test('every note can be reached with the arrow keys from the first one', () => {
  const seen = new Set(['temp-gas-can']);
  const queue = ['temp-gas-can'];
  while (queue.length) {
    const id = queue.pop();
    for (const d of ['left', 'right', 'up', 'down']) {
      const next = nextNote(notes, id, d);
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  assert.equal(seen.size, notes.length);
});

test('SCREAM-296: every note has a name and a price', () => {
  assert.equal(notes.find((n) => n.id === 'speaker-3').name, 'SPEAKER 3');
  assert.ok(notes.every((n) => Number.isInteger(n.priceCents) && (n.priceCents > 0 || n.id === 'icecream-eclair'))); // SCREAM-271: the eclair is free
});

test('SCREAM-296: when a note can be bought', () => {
  const top = notes.find((n) => n.id === 'temp-gas-can');
  const below = notes.find((n) => n.id === 'truck-5'); // hangs from truck-2 and truck-3
  assert.equal(buyStatus(top, [], top.priceCents, true), 'ok');
  assert.equal(buyStatus(top, [], top.priceCents - 1, true), 'poor', 'a cent short');
  assert.equal(buyStatus(top, [], 99999, false), 'away', 'not at home');
  assert.equal(buyStatus(top, ['temp-gas-can'], 0, false), 'owned', 'owned wins over everything');
  assert.equal(buyStatus(below, ['temp-gas-can'], 99999, true), 'locked', 'neither note above is owned');
  assert.equal(buyStatus(below, ['temp-gas-can', 'truck-3'], 99999, true), 'ok', 'one of the notes above is enough');
  assert.equal(buyStatus(below, [], 0, false), 'locked', 'locked is said before away or poor');
});

test('SCREAM-122: the Temporary Gas Can is the top Truck note, $15, with its own name and picture', () => {
  const can = notes.find((n) => n.id === 'temp-gas-can');
  assert.deepEqual([can.tree, can.number, can.name, can.priceCents, can.logo], [0, 1, 'TEMPORARY GAS CAN', 1500, 'gas-can']);
  assert.match(can.description, /fifth of a tank/);
  const dummy = notes.find((n) => n.id === 'truck-2');
  assert.deepEqual([dummy.name, dummy.logo, dummy.from], ['TRUCK 2', 'truck', ['temp-gas-can']]);
});

test('SCREAM-271: the ice creams hang top down from the free Chocolate Eclair, $15 each', () => {
  const tree = POWER_UP_TREES.find((t) => t.id === 'icecream');
  assert.deepEqual(tree.notes.map((n) => n.id), ['icecream-eclair', 'icecream-spongepop', 'icecream-explorer', 'icecream-cookie', 'icecream-5', 'icecream-6']);
  assert.deepEqual(FREE_NOTE_IDS, ['icecream-eclair']);
  assert.deepEqual(tree.notes.map((n) => n.priceCents), [0, 1500, 1500, 1500, 1500, 1500]);
  assert.deepEqual(tree.notes.slice(0, 4).map((n) => n.row), [0, 1, 2, 3]);
  const [, sponge, explorer] = tree.notes;
  assert.equal(buyStatus(sponge, FREE_NOTE_IDS, 1500, true), 'ok');
  assert.equal(buyStatus(explorer, FREE_NOTE_IDS, 1500, true), 'locked');
  assert.equal(buyStatus(explorer, [...FREE_NOTE_IDS, sponge.id], 1500, true), 'ok');
  assert.match(tree.notes[0].description, /won't pay more than \$2\.50/);
  assert.equal(storyRefuseAboveCents('eclair'), 250);
  assert.equal(storyRefuseAboveCents('cookie'), 400);
});
