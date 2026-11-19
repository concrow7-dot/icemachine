// SCREAM-245 (PO, November 14): the Handy Notebook. "Hints given by customers are written down."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { addNotebookEntry, notebookPages, readNotebook, NOTEBOOK_MAX_ENTRIES } = await game('state/Notebook');
const { POWER_UP_TREES } = await game('config/powerUps');
const { placeNotes, buyStatus } = await game('state/PowerUpBoard');
const { NOTEBOOK_ENTRIES_PER_PAGE } = await game('config/tuning');

test('SCREAM-245: Handy Notebook; SCREAM-395: an XP note; SCREAM-398: under the Calculator or Brakes', () => {
  const n = placeNotes(POWER_UP_TREES).find((x) => x.id === 'handy-notebook');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [1, 'HANDY NOTEBOOK', 0, 'notepad', ['calculator', 'brakes-made-this-century'], 'Hints given by customers are written down.']);
  assert.equal(buyStatus(n, [], 0, true, 999), 'locked');
  assert.equal(buyStatus(n, ['calculator'], 0, true, n.xp), 'ok');
  assert.equal(buyStatus(n, ['calculator'], 4000, true, n.xp - 1), 'poor');
});

test('entries are written at the end, with the day and who said it', () => {
  const book = [];
  assert.equal(addNotebookEntry(book, { day: 1, who: 'Big Kev', text: 'See you tomorrow!' }), true);
  assert.equal(addNotebookEntry(book, { day: 2, who: 'Mary Poppsicles', text: ' I\'m home Mondays. ' }), true);
  assert.deepEqual(book, [{ day: 1, who: 'Big Kev', text: 'See you tomorrow!' }, { day: 2, who: 'Mary Poppsicles', text: 'I\'m home Mondays.' }]);
});

test('the same words from the same person are not written twice; the same words from someone else are', () => {
  const book = [{ day: 1, who: 'Big Kev', text: 'See you tomorrow!' }];
  assert.equal(addNotebookEntry(book, { day: 3, who: 'Big Kev', text: 'See you tomorrow!' }), false);
  assert.equal(addNotebookEntry(book, { day: 3, who: 'Pizza Joe', text: 'See you tomorrow!' }), true);
  assert.equal(addNotebookEntry(book, { day: 3, who: 'Pizza Joe', text: '   ' }), false, 'nothing said');
  assert.equal(book.length, 2);
});

test('pages: newest first, a few to a page, and one empty page when nothing is written', () => {
  assert.deepEqual(notebookPages([], NOTEBOOK_ENTRIES_PER_PAGE), [[]]);
  const book = [];
  for (let i = 1; i <= NOTEBOOK_ENTRIES_PER_PAGE + 1; i++) addNotebookEntry(book, { day: 1, who: 'A', text: `line ${i}` });
  const pages = notebookPages(book, NOTEBOOK_ENTRIES_PER_PAGE);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].text, `line ${NOTEBOOK_ENTRIES_PER_PAGE + 1}`);
  assert.deepEqual(pages[1].map((e) => e.text), ['line 1']);
});

test('a full notebook drops its oldest entry', () => {
  const book = [];
  for (let i = 0; i < NOTEBOOK_MAX_ENTRIES + 3; i++) addNotebookEntry(book, { day: 1, who: 'A', text: `line ${i}` });
  assert.equal(book.length, NOTEBOOK_MAX_ENTRIES);
  assert.equal(book[0].text, 'line 3');
});

test('reading a save: only real entries are kept; a save from before the notebook has none', () => {
  assert.deepEqual(readNotebook(undefined), []);
  assert.deepEqual(readNotebook('nope'), []);
  assert.deepEqual(readNotebook([{ day: 2, who: 'Big Kev', text: 'Hi' }, { day: 0, who: 'x', text: 'y' }, { day: 2, who: 5, text: 'y' }, null, { day: 2, who: 'x', text: '' }]), [{ day: 2, who: 'Big Kev', text: 'Hi' }]);
});

test('SCREAM-330: This Century Register; SCREAM-395: an XP note; SCREAM-398: last, under Gitty Up or Speedy Neighbors', () => {
  const notes = placeNotes(POWER_UP_TREES);
  const n = notes.find((x) => x.id === 'this-century-register');
  assert.deepEqual([n.tree, n.name, n.priceCents, n.logo, n.from, n.description], [1, 'THIS CENTURY REGISTER', 0, 'tablet', ['gitty-up', 'speedy-neighbors'], 'Click the icons of the ice cream to calculate price.']);
  assert.equal(buyStatus(n, [], 0, true, 999), 'locked');
  assert.equal(buyStatus(n, ['calculator'], 0, true, 999), 'locked');
  assert.equal(buyStatus(n, ['speedy-neighbors'], 0, true, n.xp), 'ok');
  assert.equal(n.y, Math.max(...notes.filter((x) => x.tree === 1).map((x) => x.y)));
});
