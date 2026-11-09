import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { assignHints, fillHint } = await game('state/Hints');
const { HINT_LINES } = await game('config/hintLines');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');

const kev = { id: 'T034', name: 'Big Kev', kid: true, street: 'Institute Road', hinted: true };
const julia = { id: 'T024', name: 'Julia Crowley', kid: false, street: 'Germain Street', hinted: true };
const lines = [
  { id: 'H1', tone: 'average', who: 'any', text: '[Name] on [Street] loves ice cream.' },
  { id: 'H2', tone: 'dark', who: 'adult', text: '[Name] on [Street] lost their job.' },
  { id: 'H3', tone: 'funny', who: 'kid', text: '[Name] found their birthday money.' },
];

test('SCREAM-103: a hint line gets the regular\'s name and street', () => {
  assert.equal(fillHint(lines[0].text, kev), 'Big Kev on Institute Road loves ice cream.');
});

test('SCREAM-103 (PO): one line per regular for the whole run, the same from the same seed', () => {
  const a = assignHints([kev, julia], HINT_LINES, 12345);
  const b = assignHints([julia, kev], HINT_LINES, 12345);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.equal(a.size, 2);
  assert.notEqual(a.get('T034'), a.get('T024'));
});

test('SCREAM-103: kids only get Any or Kid lines, adults only Any or Adult; nobody shares a line', () => {
  for (let seed = 0; seed < 200; seed++) {
    const m = assignHints([kev, julia], lines, seed);
    assert.notEqual(m.get('T034'), 'Big Kev on Institute Road lost their job.');
    assert.notEqual(m.get('T024'), 'Julia Crowley found their birthday money.');
    assert.notEqual(m.get('T034'), m.get('T024'));
  }
});

test('SCREAM-103: residents not marked Hinted get no line', () => {
  assert.equal(assignHints([{ ...kev, hinted: false }], lines, 1).size, 0);
});

test('SCREAM-103: every hint line fits the bubble with every hinted tutorial regular (120 characters with "Thanks! ")', () => {
  for (const r of TUTORIAL_RESIDENTS.filter((r) => r.hinted)) {
    for (const l of HINT_LINES) {
      if (l.who !== 'any' && (l.who === 'kid') !== r.kid) continue;
      const said = 'Thanks! ' + fillHint(l.text, r);
      assert.ok(said.length <= 120, `${l.id} with ${r.name}: ${said.length}`);
    }
  }
});
