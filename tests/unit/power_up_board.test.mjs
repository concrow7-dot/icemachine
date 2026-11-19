import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { placeNotes, nextNote, buyStatus, BOARD_LAYOUT, BOARD_VIEW, maxScrollOf, clampScroll, scrollToShow, inBoardView } = await game('state/PowerUpBoard');
const { POWER_UP_TREES, FREE_NOTE_IDS, storyRefuseAboveCents } = await game('config/powerUps');
const { XP_NOTE_PRICES } = await game('config/tuning');

const notes = placeNotes(POWER_UP_TREES);
const at = (id) => notes.find((n) => n.id === id);
const money = POWER_UP_TREES.find((t) => t.id === 'money');
const xp = POWER_UP_TREES.find((t) => t.id === 'xp');

test('SCREAM-395 (PO: "completely separate the two. tracks. Some are earned through xp the other tree money"): two trees, Money and XP, left to right, and no dummies', () => {
  assert.deepEqual(POWER_UP_TREES.map((t) => t.name), ['MONEY', 'XP']);
  assert.ok(Math.max(...notes.filter((n) => n.tree === 0).map((n) => n.x)) < Math.min(...notes.filter((n) => n.tree === 1).map((n) => n.x)));
  assert.equal(notes.length, 21); // SCREAM-396: the sandwich is off the board
  assert.ok(notes.every((n) => n.description && !/^(MONEY|XP) \d+$/.test(n.name)), 'every note is a real power-up');
  // Every note is on the cork, clear of its edges (the cork is x 16 to 944).
  assert.ok(notes.every((n) => n.x - BOARD_LAYOUT.note / 2 > 30 && n.x + BOARD_LAYOUT.note / 2 < 930));
});

test('SCREAM-395: the Money tree keeps the ice creams and the notes the PO ticked "money"; everything else is in the XP tree', () => {
  assert.deepEqual(money.notes.map((n) => n.id).sort(), ['heavier-bass', 'icecream-drumcone', 'icecream-eclair', 'icecream-explorer', 'icecream-louball', 'icecream-spongepop', 'more-junk', 'service-with-a-smile', 'temp-gas-can', 'upgrade-speaker']);
  assert.deepEqual(xp.notes.map((n) => n.id).sort(), ['back-it-up', 'better-mirrors', 'brakes-made-this-century', 'calculator', 'gitty-up', 'handy-notebook', 'speedy-neighbors', 'steam-engine', 'this-century-register', 'train-off-the-tracks', 'trot']);
  assert.ok(money.notes.every((n) => !n.xp), 'no money note costs XP');
  assert.ok(xp.notes.every((n) => n.xp > 0 && n.priceCents === 0), 'every XP note costs XP and no cash');
});

test('SCREAM-395 (PO: "put items next to each other that are the same cost", "Leave them priced as is for now"): each row of a tree costs the same', () => {
  const rows = (tree) => [0, 1, 2, 3].map((r) => [...new Set(tree.notes.filter((n) => n.row === r && !n.free).map((n) => n.xp ?? n.priceCents))]);
  // SCREAM-396: the Money tree follows the PO's sketch and every note keeps its price (engineering's
  // call), so the two speakers sit side by side at $15 and $20: its rows no longer cost the same.
  const moneyRows = [0, 1, 2, 3, 4, 5, 6].map((r) => money.notes.filter((n) => n.row === r && !n.free).map((n) => n.priceCents));
  assert.deepEqual(moneyRows, [[], [1000], [1500, 2000], [1500, 1500], [1000], [1500], [2000, 2000]]);
  // SCREAM-398 (PO: "Rise by row"): the XP tree has six rows, each dearer than the one above.
  const xpRows = [0, 1, 2, 3, 4, 5].map((r) => [...new Set(xp.notes.filter((n) => n.row === r).map((n) => n.xp))]);
  assert.deepEqual(xpRows, XP_NOTE_PRICES.map((price) => [price]));
  assert.deepEqual(XP_NOTE_PRICES, [40, 50, 60, 80, 100, 120]);
  assert.ok(XP_NOTE_PRICES.every((price, i) => i === 0 || price > XP_NOTE_PRICES[i - 1]));
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
  assert.equal(nextNote(notes, 'temp-gas-can', 'up'), 'icecream-eclair');
  assert.equal(nextNote(notes, 'upgrade-speaker', 'down'), 'icecream-spongepop');
  assert.equal(nextNote(notes, 'icecream-spongepop', 'right'), 'icecream-drumcone');
  assert.equal(nextNote(notes, 'more-junk', 'up'), 'service-with-a-smile');
  assert.equal(nextNote(notes, 'icecream-louball', 'right'), 'icecream-explorer');
  assert.equal(nextNote(notes, 'brakes-made-this-century', 'left'), 'calculator');
  assert.equal(nextNote(notes, 'handy-notebook', 'down'), 'steam-engine');
  assert.equal(nextNote(notes, 'steam-engine', 'up'), 'handy-notebook');
  assert.equal(nextNote(notes, 'gitty-up', 'right'), 'speedy-neighbors');
});

test('...and cross from one tree to the other', () => {
  assert.equal(notes.find((n) => n.id === nextNote(notes, 'heavier-bass', 'right')).tree, 1);
  assert.equal(notes.find((n) => n.id === nextNote(notes, 'train-off-the-tracks', 'left')).tree, 0);
});

test('...and stay put at the edge of the board', () => {
  assert.equal(nextNote(notes, 'upgrade-speaker', 'left'), 'upgrade-speaker');
  assert.equal(nextNote(notes, 'icecream-eclair', 'up'), 'icecream-eclair');
  assert.equal(nextNote(notes, 'icecream-louball', 'down'), 'icecream-louball');
  assert.equal(nextNote(notes, 'back-it-up', 'right'), 'back-it-up');
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
  assert.deepEqual([mirrors.name, mirrors.priceCents, mirrors.xp, mirrors.from, mirrors.logo], ['BETTER MIRRORS', 0, XP_NOTE_PRICES[5], ['speedy-neighbors'], 'mirror']);
  const speedy = at('speedy-neighbors');
  assert.deepEqual([speedy.name, speedy.xp, speedy.from, speedy.logo, speedy.description], ['SPEEDY NEIGHBORS', XP_NOTE_PRICES[4], ['steam-engine'], 'sneaker', 'Most customers run after the truck faster.']);
  assert.ok(notes.every((n) => Number.isInteger(n.priceCents) && Number.isInteger(n.xp) && (n.priceCents > 0 || n.xp > 0 || n.id === 'icecream-eclair'))); // SCREAM-271: the eclair is free
});

test('SCREAM-296: when a note can be bought', () => {
  const top = at('temp-gas-can'); // SCREAM-396: hangs from the eclair, which is owned from the start
  const below = at('service-with-a-smile'); // SCREAM-396: hangs from SpongePop and the Drum Cone
  assert.equal(buyStatus(top, FREE_NOTE_IDS, top.priceCents, true), 'ok');
  assert.equal(buyStatus(top, FREE_NOTE_IDS, top.priceCents - 1, true), 'poor', 'a cent short');
  assert.equal(buyStatus(top, FREE_NOTE_IDS, 99999, false), 'away', 'not at home');
  assert.equal(buyStatus(top, ['temp-gas-can'], 0, false), 'owned', 'owned wins over everything');
  assert.equal(buyStatus(below, ['upgrade-speaker'], 99999, true), 'locked', 'neither note above is owned');
  assert.equal(buyStatus(below, ['icecream-drumcone'], 99999, true), 'ok', 'one of the notes above is enough');
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
  assert.equal(buyStatus(at('temp-gas-can'), FREE_NOTE_IDS, 0, true, 999), 'poor');
});

test('SCREAM-122, SCREAM-396: the Temporary Gas Can hangs under the eclair, $10 (SCREAM-369), with its own name and picture; both speakers hang from it', () => {
  const can = at('temp-gas-can');
  assert.deepEqual([can.tree, can.number, can.name, can.priceCents, can.logo, can.from], [0, 1, 'TEMPORARY GAS CAN', 1000, 'gas-can', ['icecream-eclair']]);
  assert.match(can.description, /a splash to get you going/);
  const eclair = at('icecream-eclair');
  assert.ok(can.x === eclair.x && can.y > eclair.y);
  assert.deepEqual(notes.filter((n) => n.from.includes('temp-gas-can')).map((n) => n.id), ['upgrade-speaker', 'heavier-bass']);
});

test('SCREAM-396 (the PO\'s sketches, November 18): the Money tree, top to bottom', () => {
  const ice = money.notes.filter((n) => n.flavour);
  assert.deepEqual(ice.map((n) => n.id), ['icecream-eclair', 'icecream-spongepop', 'icecream-drumcone', 'icecream-louball', 'icecream-explorer']);
  assert.deepEqual(FREE_NOTE_IDS, ['icecream-eclair']);
  assert.deepEqual(ice.map((n) => n.priceCents), [0, 1500, 1500, 2000, 2000]);
  const place = (id) => { const n = money.notes.find((m) => m.id === id); return [n.col, n.row, n.from]; };
  assert.deepEqual(place('icecream-eclair'), [2, 0, []]);
  assert.deepEqual(place('temp-gas-can'), [2, 1, ['icecream-eclair']]);
  assert.deepEqual(place('upgrade-speaker'), [1, 2, ['temp-gas-can']]);
  assert.deepEqual(place('heavier-bass'), [3, 2, ['temp-gas-can']]);
  assert.deepEqual(place('icecream-spongepop'), [1, 3, ['upgrade-speaker']]);
  assert.deepEqual(place('icecream-drumcone'), [3, 3, ['heavier-bass']]);
  assert.deepEqual(place('service-with-a-smile'), [2, 4, ['icecream-spongepop', 'icecream-drumcone']]);
  assert.deepEqual(place('more-junk'), [2, 5, ['service-with-a-smile']]);
  assert.deepEqual(place('icecream-louball'), [1, 6, ['more-junk']]);
  assert.deepEqual(place('icecream-explorer'), [3, 6, ['more-junk']]);
  const [eclair, sponge, drum, left, explorer] = ice;
  // Either speaker opens a way down; the other one can be bypassed.
  const speakerWay = [...FREE_NOTE_IDS, 'temp-gas-can', 'upgrade-speaker'];
  const bassWay = [...FREE_NOTE_IDS, 'temp-gas-can', 'heavier-bass'];
  assert.equal(buyStatus(at('upgrade-speaker'), FREE_NOTE_IDS, 9999, true), 'locked');
  assert.equal(buyStatus(at('heavier-bass'), [...FREE_NOTE_IDS, 'temp-gas-can'], 9999, true), 'ok', 'the bass no longer needs the speaker');
  assert.equal(buyStatus(sponge, speakerWay, 1500, true), 'ok');
  assert.equal(buyStatus(drum, speakerWay, 1500, true), 'locked');
  assert.equal(buyStatus(drum, bassWay, 1500, true), 'ok');
  assert.equal(buyStatus(at('service-with-a-smile'), [...bassWay, drum.id], 1000, true), 'ok');
  assert.equal(buyStatus(left, [...bassWay, drum.id, 'service-with-a-smile'], 2000, true), 'locked');
  assert.equal(buyStatus(left, ['more-junk'], 2000, true), 'ok');
  assert.equal(buyStatus(explorer, ['more-junk'], 2000, true), 'ok');
  assert.deepEqual([left.name, left.flavour, left.logo], ['TWO BALL LOU BALL', 'louball', 'louball']);
  assert.equal(left.description, "High upside, crazy downside. The average person won't pay more than $3.00 for one. Costs you $0.75 each to stock."); // SCREAM-365
  assert.equal(storyRefuseAboveCents('louball'), 300);
  assert.deepEqual([drum.name, drum.flavour, drum.logo], ['DRUM CONE', 'drumcone', 'drumcone']);
  assert.equal(storyRefuseAboveCents('drumcone'), 300);
  // SCREAM-352: the opened note shows these as paragraphs with an empty line between.
  assert.deepEqual(drum.paragraphs, ['Drum solo reaches more of the neighborhood.', "The average person won't pay more than $3.00 for one.", 'Costs you $0.75 each to stock.']);
  assert.match(eclair.description, /won't pay more than \$2\.50/);
  assert.equal(storyRefuseAboveCents('eclair'), 250);
  // The sandwich is off the board; its flavour is still in the game's list.
  assert.equal(at('icecream-cookie'), undefined);
  assert.equal(storyRefuseAboveCents('cookie'), 400);
});

test('SCREAM-303, SCREAM-81, SCREAM-329: Service With A Smile and the two speakers keep their names, prices and words', () => {
  const [smile, speaker, bass] = ['service-with-a-smile', 'upgrade-speaker', 'heavier-bass'].map(at);
  assert.deepEqual([smile.name, smile.priceCents], ['SERVICE WITH A SMILE', 1000]);
  assert.deepEqual([speaker.name, speaker.priceCents, speaker.description], ['UPGRADE SPEAKER', 1500, 'Increase the reach of the speaker.']);
  assert.deepEqual([bass.tree, bass.name, bass.priceCents, bass.logo, bass.description], [0, 'SPEAKER WITH HEAVIER BASS', 2000, 'bass-guitar', 'More likely to get customers in their home.']);
  assert.ok(speaker.y === bass.y && speaker.x < bass.x && smile.y > speaker.y);
});

test('SCREAM-398 (the PO\'s sketch, November 18): the XP tree, top to bottom', () => {
  assert.deepEqual(notes.filter((n) => n.tree === 1 && n.from.length === 0).map((n) => n.id), ['trot']);
  const place = (id) => { const n = xp.notes.find((m) => m.id === id); return [n.col, n.row, n.from]; };
  assert.deepEqual(place('trot'), [2, 0, []]);
  assert.deepEqual(place('calculator'), [1, 1, ['trot']]);
  assert.deepEqual(place('brakes-made-this-century'), [3, 1, ['trot']]);
  assert.deepEqual(place('train-off-the-tracks'), [0, 2, ['calculator']]); // his "Max Velocity"
  assert.deepEqual(place('handy-notebook'), [2, 2, ['calculator', 'brakes-made-this-century']]);
  assert.deepEqual(place('back-it-up'), [4, 2, ['brakes-made-this-century']]);
  assert.deepEqual(place('steam-engine'), [2, 3, ['handy-notebook']]);
  assert.deepEqual(place('gitty-up'), [1, 4, ['steam-engine']]);
  assert.deepEqual(place('speedy-neighbors'), [3, 4, ['steam-engine']]);
  // His second page (21:58): the last row.
  assert.deepEqual(place('this-century-register'), [1, 5, ['gitty-up']]);
  assert.deepEqual(place('better-mirrors'), [3, 5, ['speedy-neighbors']]);
  const trot = at('trot');
  assert.deepEqual([trot.name, trot.logo], ['TROT', 'trot']);
  assert.match(trot.description, /without any gas pedal/);
  const calc = at('calculator');
  assert.deepEqual([calc.name, calc.description], ['CALCULATOR', 'Get a calculator to use at the sales window.']);
  for (const [id, name, logo, description] of [
    ['train-off-the-tracks', 'TRAIN OFF THE TRACKS', 'train-off-tracks', 'Max velocity increased.'],
    ['brakes-made-this-century', 'BRAKES MADE THIS CENTURY', 'brake-disc', 'Brakes are better.'],
    ['steam-engine', 'STEAM ENGINE', 'steam-engine', 'Increase the speed of the truck as it rolls.'],
    ['back-it-up', 'BACK IT UP', 'back-it-up', 'Increase the speed of the truck in reverse.'],
  ]) assert.deepEqual([at(id).tree, at(id).name, at(id).logo, at(id).description], [1, name, logo, description]);
  assert.match(at('gitty-up').description, /Increase acceleration\./);
});

test('SCREAM-397 (PO: "making this screen scroll down within the cork board"): the rows are 60 px apart again and the lowest are reached by scrolling', () => {
  assert.equal(BOARD_LAYOUT.rowGap, 60);
  const ys = notes.map((n) => n.y);
  const max = maxScrollOf(ys);
  const lowest = Math.max(...ys);
  assert.ok(lowest + BOARD_LAYOUT.note / 2 > BOARD_VIEW.bottom, 'the last row does not fit in the view');
  assert.equal(max, lowest + BOARD_LAYOUT.note / 2 + BOARD_VIEW.margin - BOARD_VIEW.bottom);
  assert.ok(lowest - max + BOARD_LAYOUT.note / 2 < BOARD_VIEW.bottom, 'scrolled all the way, the last row is in the view');
  assert.equal(maxScrollOf([136, 196, 256]), 0, 'a short tree does not scroll');
  assert.equal(maxScrollOf([]), 0);
  assert.deepEqual([clampScroll(-5, max), clampScroll(30, max), clampScroll(9999, max)], [0, 30, max]);
});

test('SCREAM-397: the board scrolls just far enough to show a note whole, and stays put when it already is', () => {
  const max = maxScrollOf(notes.map((n) => n.y));
  const top = 136; // the first row
  const low = Math.max(...notes.map((n) => n.y));
  assert.equal(scrollToShow(top, 0, max), 0);
  assert.equal(scrollToShow(low, 0, max), max);
  assert.equal(scrollToShow(top, max, max), 0, 'back up: the first row sits just under the labels at scroll 0');
  assert.equal(scrollToShow(256, 40, max), 40, 'a note already in view does not move the board');
  const half = BOARD_LAYOUT.note / 2 + BOARD_VIEW.margin;
  const partly = scrollToShow(436, 0, max);
  assert.equal(436 + half - partly, BOARD_VIEW.bottom, 'a note just below the view comes up to its bottom edge');
  assert.deepEqual([inBoardView(BOARD_VIEW.top - 1), inBoardView(BOARD_VIEW.top), inBoardView(300), inBoardView(BOARD_VIEW.bottom + 1)], [false, true, true, false]);
});
