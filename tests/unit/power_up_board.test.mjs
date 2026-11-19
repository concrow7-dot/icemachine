import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { placeNotes, nextNote, buyStatus, BOARD_LAYOUT } = await game('state/PowerUpBoard');
const { POWER_UP_TREES, FREE_NOTE_IDS, storyRefuseAboveCents } = await game('config/powerUps');
const { XP_NOTE_PRICES } = await game('config/tuning');

const notes = placeNotes(POWER_UP_TREES);
const at = (id) => notes.find((n) => n.id === id);
const money = POWER_UP_TREES.find((t) => t.id === 'money');
const xp = POWER_UP_TREES.find((t) => t.id === 'xp');

test('SCREAM-395 (PO: "completely separate the two. tracks. Some are earned through xp the other tree money"): two trees, Money and XP, left to right, and no dummies', () => {
  assert.deepEqual(POWER_UP_TREES.map((t) => t.name), ['MONEY', 'XP']);
  assert.ok(Math.max(...notes.filter((n) => n.tree === 0).map((n) => n.x)) < Math.min(...notes.filter((n) => n.tree === 1).map((n) => n.x)));
  assert.equal(notes.length, 22);
  assert.ok(notes.every((n) => n.description && !/^(MONEY|XP) \d+$/.test(n.name)), 'every note is a real power-up');
  // Every note is on the cork, clear of its edges (the cork is x 16 to 944).
  assert.ok(notes.every((n) => n.x - BOARD_LAYOUT.note / 2 > 30 && n.x + BOARD_LAYOUT.note / 2 < 930));
});

test('SCREAM-395: the Money tree keeps the ice creams and the notes the PO ticked "money"; everything else is in the XP tree', () => {
  assert.deepEqual(money.notes.map((n) => n.id).sort(), ['heavier-bass', 'icecream-cookie', 'icecream-drumcone', 'icecream-eclair', 'icecream-explorer', 'icecream-louball', 'icecream-spongepop', 'more-junk', 'service-with-a-smile', 'temp-gas-can', 'upgrade-speaker']);
  assert.deepEqual(xp.notes.map((n) => n.id).sort(), ['back-it-up', 'better-mirrors', 'brakes-made-this-century', 'calculator', 'gitty-up', 'handy-notebook', 'speedy-neighbors', 'steam-engine', 'this-century-register', 'train-off-the-tracks', 'trot']);
  assert.ok(money.notes.every((n) => !n.xp), 'no money note costs XP');
  assert.ok(xp.notes.every((n) => n.xp > 0 && n.priceCents === 0), 'every XP note costs XP and no cash');
});

test('SCREAM-395 (PO: "put items next to each other that are the same cost", "Leave them priced as is for now"): each row of a tree costs the same', () => {
  const rows = (tree) => [0, 1, 2, 3].map((r) => [...new Set(tree.notes.filter((n) => n.row === r && !n.free).map((n) => n.xp ?? n.priceCents))]);
  assert.deepEqual(rows(money), [[1000], [1500], [2000], [1500]]); // $10; $15; $20; the sandwich's $15
  assert.deepEqual(rows(xp), [[XP_NOTE_PRICES[0]], [XP_NOTE_PRICES[1]], [XP_NOTE_PRICES[2]], []]);
  assert.ok(XP_NOTE_PRICES[0] < XP_NOTE_PRICES[1] && XP_NOTE_PRICES[1] < XP_NOTE_PRICES[2]);
});

test('every note has its own place, and hangs only from notes above it in its own tree', () => {
  const spots = new Set(notes.map((n) => `${n.x},${n.y}`));
  assert.equal(spots.size, notes.length);
  for (const note of notes) {
    for (const id of note.from) {
      const parent = at(id);
      assert.ok(parent, `${note.id} hangs from ${id}`);
      assert.equal(parent.tree, note.tree);
      assert.ok(parent.y < note.y, `${id} is above ${note.id}`);
    }
  }
});

test('the arrow keys move to the nearest note that way', () => {
  assert.equal(nextNote(notes, 'temp-gas-can', 'down'), 'more-junk');
  assert.equal(nextNote(notes, 'icecream-spongepop', 'left'), 'more-junk');
  assert.equal(nextNote(notes, 'icecream-spongepop', 'right'), 'icecream-drumcone');
  assert.equal(nextNote(notes, 'more-junk', 'up'), 'temp-gas-can');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'left'), 'train-off-the-tracks');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'right'), 'steam-engine');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'up'), 'trot');
});

test('...and cross from one tree to the other', () => {
  assert.equal(nextNote(notes, 'upgrade-speaker', 'right'), 'train-off-the-tracks');
  assert.equal(nextNote(notes, 'train-off-the-tracks', 'left'), 'upgrade-speaker');
  assert.equal(nextNote(notes, 'heavier-bass', 'right'), 'back-it-up');
});

test('...and stay put at the edge of the board', () => {
  assert.equal(nextNote(notes, 'temp-gas-can', 'left'), 'temp-gas-can');
  assert.equal(nextNote(notes, 'temp-gas-can', 'up'), 'temp-gas-can');
  assert.equal(nextNote(notes, 'icecream-cookie', 'down'), 'icecream-cookie');
  assert.equal(nextNote(notes, 'speedy-neighbors', 'right'), 'speedy-neighbors');
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

test('SCREAM-296: every note has a name and a price (in cash, or SCREAM-395 in XP)', () => {
  const mirrors = at('better-mirrors');
  assert.deepEqual([mirrors.name, mirrors.priceCents, mirrors.xp, mirrors.from, mirrors.logo], ['BETTER MIRRORS', 0, XP_NOTE_PRICES[2], ['handy-notebook'], 'mirror']);
  const speedy = at('speedy-neighbors');
  assert.deepEqual([speedy.name, speedy.xp, speedy.from, speedy.logo, speedy.description], ['SPEEDY NEIGHBORS', XP_NOTE_PRICES[2], ['handy-notebook'], 'sneaker', 'Most customers run after the truck faster.']);
  assert.ok(notes.every((n) => Number.isInteger(n.priceCents) && Number.isInteger(n.xp) && (n.priceCents > 0 || n.xp > 0 || n.id === 'icecream-eclair'))); // SCREAM-271: the eclair is free
});

test('SCREAM-296: when a note can be bought', () => {
  const top = at('temp-gas-can');
  const below = at('icecream-cookie'); // hangs from the Lou Ball and the Explorer Pop
  assert.equal(buyStatus(top, [], top.priceCents, true), 'ok');
  assert.equal(buyStatus(top, [], top.priceCents - 1, true), 'poor', 'a cent short');
  assert.equal(buyStatus(top, [], 99999, false), 'away', 'not at home');
  assert.equal(buyStatus(top, ['temp-gas-can'], 0, false), 'owned', 'owned wins over everything');
  assert.equal(buyStatus(below, ['icecream-spongepop'], 99999, true), 'locked', 'neither note above is owned');
  assert.equal(buyStatus(below, ['icecream-explorer'], 99999, true), 'ok', 'one of the notes above is enough');
  assert.equal(buyStatus(below, [], 0, false), 'locked', 'locked is said before away or poor');
});

test('SCREAM-395: an XP note is bought with XP, however much cash there is', () => {
  const trot = at('trot');
  assert.equal(buyStatus(trot, [], 99999, true, trot.xp - 1), 'poor', 'one XP short, with plenty of cash');
  assert.equal(buyStatus(trot, [], 99999, true), 'poor', 'no XP given is no XP');
  assert.equal(buyStatus(trot, [], 0, true, trot.xp), 'ok', 'enough XP and no cash');
  assert.equal(buyStatus(trot, [], 0, false, trot.xp), 'away');
  const brakes = at('brakes-made-this-century');
  assert.equal(buyStatus(brakes, [], 0, true, 999), 'locked');
  assert.equal(buyStatus(brakes, ['trot'], 0, true, brakes.xp), 'ok');
  // A money note takes no notice of XP.
  assert.equal(buyStatus(at('temp-gas-can'), [], 0, true, 999), 'poor');
});

test('SCREAM-122: the Temporary Gas Can is a top Money note, $10 (SCREAM-369), with its own name and picture; More Space for Scream hangs under it', () => {
  const can = at('temp-gas-can');
  assert.deepEqual([can.tree, can.number, can.name, can.priceCents, can.logo, can.from], [0, 1, 'TEMPORARY GAS CAN', 1000, 'gas-can', []]);
  assert.match(can.description, /a splash to get you going/);
  const junk = at('more-junk');
  assert.deepEqual([junk.name, junk.priceCents, junk.from, junk.logo], ['MORE SPACE FOR SCREAM', 1500, ['temp-gas-can'], 'more-junk']);
  assert.ok(junk.x === can.x && junk.y > can.y);
});

test('SCREAM-333, SCREAM-376: the ice creams hang as before, in the middle of the Money tree', () => {
  const ice = money.notes.filter((n) => n.flavour);
  assert.deepEqual(ice.map((n) => n.id), ['icecream-eclair', 'icecream-spongepop', 'icecream-drumcone', 'icecream-louball', 'icecream-explorer', 'icecream-cookie']);
  assert.deepEqual(FREE_NOTE_IDS, ['icecream-eclair']);
  assert.deepEqual(ice.map((n) => n.priceCents), [0, 1500, 1500, 2000, 2000, 1500]);
  assert.deepEqual(ice.map((n) => [n.col, n.row]), [[2, 0], [1, 1], [3, 1], [1, 2], [3, 2], [2, 3]]);
  assert.deepEqual(ice.map((n) => n.from), [[], ['icecream-eclair'], ['icecream-eclair'], ['icecream-spongepop'], ['icecream-drumcone'], ['icecream-louball', 'icecream-explorer']]);
  const [eclair, sponge, drum, left, explorer, cookie] = ice;
  assert.equal(buyStatus(sponge, FREE_NOTE_IDS, 1500, true), 'ok');
  assert.equal(buyStatus(drum, FREE_NOTE_IDS, 1500, true), 'ok');
  assert.equal(buyStatus(explorer, FREE_NOTE_IDS, 2000, true), 'locked');
  assert.equal(buyStatus(explorer, [...FREE_NOTE_IDS, drum.id], 2000, true), 'ok');
  assert.equal(buyStatus(left, FREE_NOTE_IDS, 2000, true), 'locked');
  assert.deepEqual([left.name, left.flavour, left.logo], ['TWO BALL LOU BALL', 'louball', 'louball']);
  assert.equal(left.description, "High upside, crazy downside. The average person won't pay more than $3.00 for one. Costs you $0.75 each to stock."); // SCREAM-365
  assert.equal(storyRefuseAboveCents('louball'), 300);
  assert.equal(buyStatus(left, [...FREE_NOTE_IDS, sponge.id], 2000, true), 'ok');
  assert.deepEqual([drum.name, drum.flavour, drum.logo], ['DRUM CONE', 'drumcone', 'drumcone']);
  assert.equal(storyRefuseAboveCents('drumcone'), 300);
  // SCREAM-352: the opened note shows these as paragraphs with an empty line between.
  assert.deepEqual(drum.paragraphs, ['Drum solo reaches more of the neighborhood.', "The average person won't pay more than $3.00 for one.", 'Costs you $0.75 each to stock.']);
  assert.equal(buyStatus(cookie, [...FREE_NOTE_IDS, sponge.id, drum.id], 1500, true), 'locked');
  assert.equal(buyStatus(cookie, [...FREE_NOTE_IDS, drum.id, explorer.id], 1500, true), 'ok');
  assert.match(eclair.description, /won't pay more than \$2\.50/);
  assert.equal(storyRefuseAboveCents('eclair'), 250);
  assert.equal(storyRefuseAboveCents('cookie'), 400);
});

test('SCREAM-303, SCREAM-81, SCREAM-329: Service With A Smile, Upgrade Speaker and Speaker with Heavier Bass hang one under the other at the Money tree\'s right', () => {
  const [smile, speaker, bass] = ['service-with-a-smile', 'upgrade-speaker', 'heavier-bass'].map(at);
  assert.deepEqual([smile.name, smile.priceCents, smile.from], ['SERVICE WITH A SMILE', 1000, []]);
  assert.deepEqual([speaker.name, speaker.priceCents, speaker.description, speaker.from], ['UPGRADE SPEAKER', 1500, 'Increase the reach of the speaker.', ['service-with-a-smile']]);
  assert.deepEqual([bass.tree, bass.name, bass.priceCents, bass.logo, bass.from, bass.description], [0, 'SPEAKER WITH HEAVIER BASS', 2000, 'bass-guitar', ['upgrade-speaker'], 'More likely to get customers in their home.']);
  assert.ok(smile.x === speaker.x && speaker.x === bass.x && smile.y < speaker.y && speaker.y < bass.y);
  assert.equal(buyStatus(bass, ['service-with-a-smile'], 4000, true), 'locked');
  assert.equal(buyStatus(bass, ['service-with-a-smile', 'upgrade-speaker'], 4000, true), 'ok');
});

test('SCREAM-395: the XP tree starts with Trot (the truck\'s side) and the Calculator (the window\'s side)', () => {
  assert.deepEqual(notes.filter((n) => n.tree === 1 && n.from.length === 0).map((n) => n.id), ['trot', 'calculator']);
  const trot = at('trot');
  assert.deepEqual([trot.name, trot.logo], ['TROT', 'trot']);
  assert.match(trot.description, /without any gas pedal/);
  const calc = at('calculator');
  assert.deepEqual([calc.name, calc.description], ['CALCULATOR', 'Get a calculator to use at the sales window.']);
  assert.deepEqual(notes.filter((n) => n.from.includes('trot')).map((n) => n.id), ['train-off-the-tracks', 'brakes-made-this-century', 'steam-engine']);
  assert.deepEqual(notes.filter((n) => n.from.includes('calculator')).map((n) => n.id), ['handy-notebook', 'this-century-register']);
  for (const [id, name, logo, description] of [
    ['train-off-the-tracks', 'TRAIN OFF THE TRACKS', 'train-off-tracks', 'Max velocity increased.'],
    ['brakes-made-this-century', 'BRAKES MADE THIS CENTURY', 'brake-disc', 'Brakes are better.'],
    ['steam-engine', 'STEAM ENGINE', 'steam-engine', 'Increase the speed of the truck as it rolls.'],
    ['back-it-up', 'BACK IT UP', 'back-it-up', 'Increase the speed of the truck in reverse.'],
  ]) assert.deepEqual([at(id).tree, at(id).name, at(id).logo, at(id).description], [1, name, logo, description]);
  assert.match(at('gitty-up').description, /Increase acceleration\./);
});

test('PO, November 15 (03:28): two notes come out of Brakes Made This Century and two out of the Handy Notebook, side by side', () => {
  for (const [parent, left, right] of [['brakes-made-this-century', 'back-it-up', 'gitty-up'], ['handy-notebook', 'better-mirrors', 'speedy-neighbors']]) {
    assert.deepEqual([at(left).from, at(right).from], [[parent], [parent]]);
    assert.equal(at(left).y, at(right).y); // level with each other
    assert.ok(at(left).y > at(parent).y && at(left).x < at(right).x); // below it, side by side
  }
});
