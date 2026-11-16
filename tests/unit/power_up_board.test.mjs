import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { placeNotes, nextNote, buyStatus } = await game('state/PowerUpBoard');
const { POWER_UP_TREES, FREE_NOTE_IDS, storyRefuseAboveCents } = await game('config/powerUps');

const notes = placeNotes(POWER_UP_TREES);

test('SCREAM-267, SCREAM-271: three trees, Truck, Ice Cream and Customer, left to right', () => {
  assert.deepEqual(POWER_UP_TREES.map((t) => t.name), ['TRUCK', 'ICE CREAM', 'CUSTOMER']);
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
  assert.equal(nextNote(notes, 'temp-gas-can', 'down'), 'brakes-made-this-century');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'left'), 'train-off-the-tracks');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'right'), 'steam-engine');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'up'), 'temp-gas-can');
});

test('...and cross from one tree to the next', () => {
  // SCREAM-333: the Ice Cream tree's third row has a note on each side.
  assert.equal(nextNote(notes, 'steam-engine', 'right'), 'icecream-louball');
  assert.equal(nextNote(notes, 'icecream-louball', 'left'), 'steam-engine');
  assert.equal(nextNote(notes, 'icecream-louball', 'right'), 'icecream-drumcone');
  assert.equal(nextNote(notes, 'icecream-drumcone', 'right'), 'heavier-bass');
});

test('...and stay put at the edge of the board', () => {
  assert.equal(nextNote(notes, 'train-off-the-tracks', 'left'), 'train-off-the-tracks');
  assert.equal(nextNote(notes, 'temp-gas-can', 'up'), 'temp-gas-can');
  assert.equal(nextNote(notes, 'customer-9', 'down'), 'customer-9');
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
  assert.equal(notes.find((n) => n.id === 'customer-9').name, 'CUSTOMER 9');
  // SCREAM-341: Customer 7 is Better Mirrors now, under the Handy Notebook.
  const mirrors = notes.find((n) => n.id === 'better-mirrors');
  assert.deepEqual([mirrors.name, mirrors.priceCents, mirrors.from, mirrors.logo], ['BETTER MIRRORS', 5000, ['handy-notebook'], 'mirror']);
  // SCREAM-342: Customer 8 is Speedy Neighbors now, under Better Mirrors.
  const speedy = notes.find((n) => n.id === 'speedy-neighbors');
  assert.deepEqual([speedy.name, speedy.priceCents, speedy.from, speedy.logo, speedy.description], ['SPEEDY NEIGHBORS', 6000, ['handy-notebook'], 'sneaker', 'Most customers run after the truck faster.']);
  assert.ok(notes.every((n) => Number.isInteger(n.priceCents) && (n.priceCents > 0 || n.id === 'icecream-eclair'))); // SCREAM-271: the eclair is free
});

test('SCREAM-296: when a note can be bought', () => {
  const top = notes.find((n) => n.id === 'temp-gas-can');
  const below = notes.find((n) => n.id === 'brakes-made-this-century'); // hangs from Gitty Up and Trot
  assert.equal(buyStatus(top, [], top.priceCents, true), 'ok');
  assert.equal(buyStatus(top, [], top.priceCents - 1, true), 'poor', 'a cent short');
  assert.equal(buyStatus(top, [], 99999, false), 'away', 'not at home');
  assert.equal(buyStatus(top, ['temp-gas-can'], 0, false), 'owned', 'owned wins over everything');
  assert.equal(buyStatus(below, ['temp-gas-can'], 99999, true), 'locked', 'neither note above is owned');
  assert.equal(buyStatus(below, ['temp-gas-can', 'trot'], 99999, true), 'ok', 'one of the notes above is enough');
  assert.equal(buyStatus(below, [], 0, false), 'locked', 'locked is said before away or poor');
});

test('SCREAM-122: the Temporary Gas Can is the top Truck note, $15, with its own name and picture', () => {
  const can = notes.find((n) => n.id === 'temp-gas-can');
  assert.deepEqual([can.tree, can.number, can.name, can.priceCents, can.logo], [0, 1, 'TEMPORARY GAS CAN', 1500, 'gas-can']);
  assert.match(can.description, /a splash to get you going/);
  const dummy = notes.find((n) => n.id === 'truck-9');
  assert.deepEqual([dummy.name, dummy.logo, dummy.from], ['TRUCK 9', 'truck', ['back-it-up', 'gitty-up']]);
  // SCREAM-364 (PO, November 16): More Space for Scream is the left note under the gas can, $20.
  const junk = notes.find((n) => n.id === 'more-junk');
  assert.deepEqual([junk.name, junk.priceCents, junk.from, junk.logo], ['MORE SPACE FOR SCREAM', 2000, ['temp-gas-can'], 'more-junk']);
});

test('SCREAM-364 (PO: "switch "more space for scream" with "gitty up" in both location and price"): Gitty Up is the right note under Brakes, $50', () => {
  const gitty = notes.find((n) => n.id === 'gitty-up');
  assert.deepEqual([gitty.tree, gitty.name, gitty.priceCents, gitty.logo, gitty.from], [0, 'GITTY UP', 5000, 'gitty-up', ['brakes-made-this-century']]);
  assert.match(gitty.description, /Increase acceleration\./);
  assert.deepEqual(notes.find((n) => n.id === 'brakes-made-this-century').from, ['more-junk', 'trot']);
  const junk = notes.find((n) => n.id === 'more-junk');
  const trot = notes.find((n) => n.id === 'trot');
  assert.ok(junk.y === trot.y && junk.x < trot.x, 'More Space for Scream sits where Gitty Up was, left of Trot');
});

test('SCREAM-310: Trot is the right note under the gas can, $20, with its own name and picture', () => {
  const trot = notes.find((n) => n.id === 'trot');
  assert.deepEqual([trot.tree, trot.name, trot.priceCents, trot.logo, trot.from], [0, 'TROT', 2000, 'trot', ['temp-gas-can']]);
  assert.match(trot.description, /without any gas pedal/);
  assert.deepEqual(notes.find((n) => n.id === 'steam-engine').from, ['trot']);
});

test('SCREAM-333: the eclair on top, SpongePop and the Explorer Pop side by side, a third-row note under each, the sandwich under both; SpongePop $20, Explorer $25, the Two Ball Lou Ball and the Drum Cone $30, the sandwich $15', () => {
  const tree = POWER_UP_TREES.find((t) => t.id === 'icecream');
  assert.deepEqual(tree.notes.map((n) => n.id), ['icecream-eclair', 'icecream-spongepop', 'icecream-explorer', 'icecream-louball', 'icecream-drumcone', 'icecream-cookie']);
  assert.deepEqual(FREE_NOTE_IDS, ['icecream-eclair']);
  assert.deepEqual(tree.notes.map((n) => n.priceCents), [0, 2000, 2500, 3000, 3000, 1500]);
  assert.deepEqual(tree.notes.map((n) => [n.col, n.row]), [[1, 0], [0, 1], [2, 1], [0, 2], [2, 2], [1, 3]]);
  assert.deepEqual(tree.notes.map((n) => n.from), [[], ['icecream-eclair'], ['icecream-eclair'], ['icecream-spongepop'], ['icecream-explorer'], ['icecream-louball', 'icecream-drumcone']]);
  const [, sponge, explorer, left, right, cookie] = tree.notes;
  assert.equal(buyStatus(sponge, FREE_NOTE_IDS, 2000, true), 'ok');
  // The Explorer Pop no longer waits for SpongePop.
  assert.equal(buyStatus(explorer, FREE_NOTE_IDS, 2500, true), 'ok');
  assert.equal(buyStatus(left, FREE_NOTE_IDS, 3000, true), 'locked');
  // SCREAM-334: the Two Ball Lou Ball, $30, the PO's line, $3.00 at most (PO, November 15: "can be sold for $3").
  assert.deepEqual([left.name, left.flavour, left.logo], ['TWO BALL LOU BALL', 'louball', 'louball']);
  assert.equal(left.description, "High upside, crazy downside. The average person won't pay more than $3.00 for one. Costs you $0.75 each to stock."); // SCREAM-365: $0.75 (was $1.00)
  assert.equal(storyRefuseAboveCents('louball'), 300);
  assert.equal(buyStatus(right, [...FREE_NOTE_IDS, explorer.id], 3000, true), 'ok');
  // SCREAM-335: the Drum Cone, $30, the PO's line, $3.00 at most.
  assert.deepEqual([right.name, right.flavour, right.logo], ['DRUM CONE', 'drumcone', 'drumcone']);
  assert.equal(storyRefuseAboveCents('drumcone'), 300);
  assert.equal(right.description, "Drum solo reaches more of the neighborhood. The average person won't pay more than $3.00 for one. Costs you $0.75 each to stock.");
  // SCREAM-352: the opened note shows these as paragraphs with an empty line between.
  assert.deepEqual(right.paragraphs, ['Drum solo reaches more of the neighborhood.', "The average person won't pay more than $3.00 for one.", 'Costs you $0.75 each to stock.']);
  // The sandwich needs either third-row note.
  assert.equal(buyStatus(cookie, [...FREE_NOTE_IDS, sponge.id, explorer.id], 1500, true), 'locked');
  assert.equal(buyStatus(cookie, [...FREE_NOTE_IDS, explorer.id, right.id], 1500, true), 'ok');
  assert.match(tree.notes[0].description, /won't pay more than \$2\.50/);
  assert.equal(storyRefuseAboveCents('eclair'), 250);
  assert.equal(storyRefuseAboveCents('cookie'), 400);
});

test('SCREAM-303: Service With A Smile is the only top note of the Customer tree, in the middle', () => {
  const tops = notes.filter((n) => n.tree === 2 && n.from.length === 0).map((n) => n.id);
  assert.deepEqual(tops, ['service-with-a-smile']);
  assert.deepEqual(notes.filter((n) => n.from.includes('service-with-a-smile')).map((n) => n.id), ['upgrade-speaker', 'calculator']);
  // SCREAM-317: the right one is Calculator, $30.
  const calc = notes.find((n) => n.id === 'calculator');
  assert.deepEqual([calc.name, calc.priceCents, calc.description], ['CALCULATOR', 3000, 'Get a calculator to use at the sales window.']);
  // SCREAM-81: the left one is Upgrade Speaker, $30.
  const speaker = notes.find((n) => n.id === 'upgrade-speaker');
  assert.deepEqual([speaker.name, speaker.priceCents, speaker.description], ['UPGRADE SPEAKER', 3000, 'Increase the reach of the speaker.']);
});

test('SCREAM-80: Train Off The Tracks is the Truck tree\'s left third-row note, under Gitty Up, $30', () => {
  const n = notes.find((x) => x.id === 'train-off-the-tracks');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [0, 'TRAIN OFF THE TRACKS', 3000, 'train-off-tracks', ['more-junk'], 'Max velocity increased.']);
});

test('SCREAM-325: Brakes Made This Century is the middle third-row note, under Gitty Up or Trot, $30; Truck 7 hangs from it', () => {
  const n = notes.find((x) => x.id === 'brakes-made-this-century');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [0, 'BRAKES MADE THIS CENTURY', 3000, 'brake-disc', ['more-junk', 'trot'], 'Brakes are better.']);
  // SCREAM-340: Truck 7 is Back It Up now.
  const back = notes.find((x) => x.id === 'back-it-up');
  assert.deepEqual([back.name, back.priceCents, back.from, back.logo, back.description], ['BACK IT UP', 4000, ['brakes-made-this-century'], 'back-it-up', 'Increase the speed of the truck in reverse.']);
});

test('SCREAM-326: Steam Engine is the right third-row note, under Trot, $30', () => {
  const n = notes.find((x) => x.id === 'steam-engine');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [0, 'STEAM ENGINE', 3000, 'steam-engine', ['trot'], 'Increase the speed of the truck as it rolls.']);
});

test('SCREAM-329: Speaker with Heavier Bass is the Customer tree\'s left third-row note, under Upgrade Speaker, $40', () => {
  const n = notes.find((x) => x.id === 'heavier-bass');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [2, 'SPEAKER WITH HEAVIER BASS', 4000, 'bass-guitar', ['upgrade-speaker'], 'More likely to get customers in their home.']);
  assert.equal(buyStatus(n, ['service-with-a-smile'], 4000, true), 'locked');
  assert.equal(buyStatus(n, ['service-with-a-smile', 'upgrade-speaker'], 4000, true), 'ok');
});

test('PO, November 15 (03:28): two notes come out of Brakes Made This Century and two out of the Handy Notebook, side by side', () => {
  const at = (id) => notes.find((n) => n.id === id);
  for (const [parent, left, right, last] of [['brakes-made-this-century', 'back-it-up', 'gitty-up', 'truck-9'], ['handy-notebook', 'better-mirrors', 'speedy-neighbors', 'customer-9']]) {
    assert.deepEqual([at(left).from, at(right).from], [[parent], [parent]]);
    assert.equal(at(left).y, at(right).y); // level with each other
    assert.ok(at(left).y > at(parent).y && at(left).x < at(parent).x && at(right).x > at(parent).x); // below it, left and right
    assert.deepEqual(at(last).from, [left, right]);
    assert.ok(at(last).y > at(left).y && at(last).x === at(parent).x); // the dummy below, in the middle
  }
});
