// SCREAM-247 (PO, November 10; decision 064): customers mention their own schedule as they
// leave the window ("See you Thursday!"). Every line has to be true for the person saying it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { kindOfLine, dayList, daysUntilHome, kindFits, fillSchedule, assignScheduleLines, scheduleLineToday, assignNeighbourLines, neighbourLineToday, fillNeighbour, canBeToldAbout } = await game('state/ScheduleLines');
const { NEIGHBOUR_LINES } = await game('config/neighbourLines');
const { SCHEDULE_LINES } = await game('config/scheduleLines');
const { TUTORIAL_RESIDENTS } = await game('config/tutorialResidents');
const { RESIDENTS } = await game('config/residents');
const { STORY_DAYS } = await game('config/tuning');

const base = { id: 'X1', name: 'Test', kid: false, street: 'Test Street', likelihood: 0.3, look: 0, door: [0, 0], yard: [], curb: [0, 0, 0, 0, 0] };
const monThu = { ...base, days: [0, 3] };
const everyDay = { ...base, id: 'X2', days: [0, 1, 2, 3, 4, 5, 6] };
const notWed = { ...base, id: 'X3', kid: true, days: [0, 1, 3, 4, 5, 6] };
const weekend = { ...base, id: 'X4', days: [5, 6] };
const noDays = { ...base, id: 'X5', days: [] };
const noColumns = { ...base, id: 'X6' };

test('Lists of days read naturally, in the week\'s order', () => {
  assert.equal(dayList([3]), 'Thursday');
  assert.equal(dayList([3, 0]), 'Monday and Thursday');
  assert.equal(dayList([4, 0, 2]), 'Monday, Wednesday and Friday');
});

test('The next day home: Monday → Thursday for Mon+Thu; Thursday → Monday; a one-day person waits a week', () => {
  assert.equal(daysUntilHome([0, 3], 1), 3);
  assert.equal(daysUntilHome([0, 3], 4), 4);
  assert.equal(daysUntilHome([2], 3), 7);
  assert.equal(daysUntilHome([], 1), null);
});

test('PO\'s lines come out true: Mon+Thu on Monday', () => {
  assert.equal(fillSchedule('See you [Next]!', monThu, 1), 'See you Thursday!');
  assert.equal(fillSchedule('I have soccer until [Back].', monThu, 1), 'I have soccer until Thursday.');
  assert.equal(fillSchedule('I work every day except [Home].', monThu, 1), 'I work every day except Monday and Thursday.');
  assert.equal(fillSchedule('The best days to visit are [Home].', monThu, 2), 'The best days to visit are Monday and Thursday.');
  assert.equal(fillSchedule('Nobody is home on [Away].', notWed, 1), 'Nobody is home on Wednesday.');
});

test('A kind of line is only used when it is true and useful today', () => {
  // [Next]: only a day still to come in this 5-day run.
  assert.equal(kindFits('next', monThu, 1, 5), true);
  assert.equal(kindFits('next', monThu, 4, 5), false); // Thursday → next Monday is after the run
  assert.equal(kindFits('next', weekend, 1, 5), false); // Saturday never comes in a 5-day run
  // [Back] ("until Thursday"): only when they're away tomorrow.
  assert.equal(kindFits('back', monThu, 1, 5), true);
  assert.equal(kindFits('back', monThu, 3, 5), false); // Wednesday: home tomorrow
  assert.equal(kindFits('next', monThu, 3, 5), true);
  // Lists stop at three days: few days home → [Home]; few days out → [Away].
  assert.equal(kindFits('home', monThu, 1, 5), true);
  assert.equal(kindFits('away', monThu, 1, 5), false);
  assert.equal(kindFits('home', notWed, 1, 5), false);
  assert.equal(kindFits('away', notWed, 1, 5), true);
  // No tag: only people home all seven days, and they get nothing else.
  assert.equal(kindFits('every', everyDay, 1, 5), true);
  assert.equal(kindFits('every', monThu, 1, 5), false);
  for (const kind of ['next', 'back', 'home', 'away']) assert.equal(kindFits(kind, everyDay, 1, 5), false);
  // No ticks, or a sheet with no day columns: nothing to say.
  for (const kind of ['next', 'back', 'home', 'away', 'every']) {
    assert.equal(kindFits(kind, noDays, 1, 5), false);
    assert.equal(kindFits(kind, noColumns, 1, 5), false);
  }
});

test('Decision 063: each person keeps the same few lines all run (same seed), one per kind; kids and adults get their own', () => {
  const people = [monThu, everyDay, notWed, weekend, noDays, noColumns];
  const a = assignScheduleLines(people, SCHEDULE_LINES, 4242);
  const b = assignScheduleLines([...people].reverse(), SCHEDULE_LINES, 4242);
  const ids = (m, id) => (m.get(id) ?? []).map((l) => l.id).join(',');
  for (const p of people) assert.equal(ids(a, p.id), ids(b, p.id));
  assert.equal(a.has('X5'), false);
  assert.equal(a.has('X6'), false);
  for (const [id, own] of a) {
    const kinds = own.map((l) => kindOfLine(l.text)).filter((k) => k !== 'every');
    assert.equal(new Set(kinds).size, kinds.length, `${id}: one line per kind`);
    assert.equal(new Set(own.map((l) => l.id)).size, own.length, `${id}: no line twice`);
    const kid = people.find((p) => p.id === id).kid;
    for (const l of own) assert.ok(l.who === 'any' || (l.who === 'kid') === kid, `${id} ${l.id}`);
  }
});

test('PO (064): not repetitive: across a neighbourhood many different lines are in use', () => {
  const m = assignScheduleLines(TUTORIAL_RESIDENTS, SCHEDULE_LINES, 7);
  const used = new Set([...m.values()].flat().map((l) => l.id));
  assert.ok(used.size >= 12, `only ${used.size} different lines in use`);
});

test('Today\'s line is one of the person\'s own, filled in, and null when none fits', () => {
  const m = assignScheduleLines([monThu, weekend], SCHEDULE_LINES, 1);
  for (let i = 0; i < 50; i++) {
    const said = scheduleLineToday(m.get('X1'), monThu, 1, 5).text;
    assert.ok(m.get('X1').some((l) => fillSchedule(l.text, monThu, 1) === said), said);
    assert.equal(/\[/.test(said), false);
  }
  assert.equal(scheduleLineToday(undefined, monThu, 1, 5), null);
  // The weekend person on any Story day: only their list of days can be said, never "See you Saturday!".
  for (let day = 1; day <= 5; day++) {
    const said = scheduleLineToday(m.get('X4'), weekend, day, 5).text;
    assert.match(said, /Saturday and Sunday/);
  }
});

test('Every real resident with ticks has something true to say on every Story day, and it fits the bubble', () => {
  for (const list of [TUTORIAL_RESIDENTS, RESIDENTS]) {
    const m = assignScheduleLines(list, SCHEDULE_LINES, 99);
    for (const r of list) {
      if (!r.days || r.days.length === 0) { assert.equal(m.has(r.id), false); continue; }
      for (let day = 1; day <= STORY_DAYS; day++) {
        for (const l of m.get(r.id)) {
          if (!kindFits(kindOfLine(l.text), r, day, STORY_DAYS)) continue;
          const said = 'Thanks! ' + fillSchedule(l.text, r, day);
          assert.ok(said.length <= 120, `${l.id} with ${r.name}: ${said.length}`);
          assert.equal(/\[|\]|  /.test(said), false, said);
        }
        assert.notEqual(scheduleLineToday(m.get(r.id), r, day, STORY_DAYS), null, `${r.name} on day ${day}`);
      }
    }
  }
});

test('PO (testing, November 10): regulars are home every day, so each gets 3 different "every day" lines, and nobody else gets one', () => {
  const m = assignScheduleLines([monThu, everyDay], SCHEDULE_LINES, 5);
  assert.equal(m.get('X2').length, 3);
  assert.equal(new Set(m.get('X2').map((l) => l.id)).size, 3);
  assert.ok(m.get('X2').every((l) => kindOfLine(l.text) === 'every'));
  assert.ok(m.get('X1').every((l) => kindOfLine(l.text) !== 'every'));
  const everyLines = SCHEDULE_LINES.filter((l) => kindOfLine(l.text) === 'every');
  assert.ok(everyLines.length >= 12, `${everyLines.length} every-day lines`);
});

test('PO (testing): the same wording is never heard twice in an evening', () => {
  const m = assignScheduleLines([everyDay], SCHEDULE_LINES, 5);
  const heard = [];
  for (let i = 0; i < 3; i++) heard.push(scheduleLineToday(m.get('X2'), everyDay, 1, 5, Math.random, heard).id);
  assert.equal(new Set(heard).size, 3);
  assert.equal(scheduleLineToday(m.get('X2'), everyDay, 1, 5, Math.random, heard), null);
});

test('PO (testing): across Elm Park\'s regulars at least 8 different "every day" wordings are in use', () => {
  for (const seed of [1, 99, 123456]) {
    const m = assignScheduleLines(TUTORIAL_RESIDENTS, SCHEDULE_LINES, seed);
    const regs = TUTORIAL_RESIDENTS.filter((r) => r.days && r.days.length === 7);
    const used = new Set(regs.flatMap((r) => m.get(r.id).map((l) => l.id)));
    assert.ok(used.size >= 8, `seed ${seed}: ${used.size}`);
  }
});

// ---- SCREAM-248 (PO, November 10; decision 065): neighbours know each other's days ----
const joe = { ...base, id: 'N1', name: 'Joe Sullivan ', street: 'Lee Street', days: [0, 4] };
const ann = { ...base, id: 'N2', name: 'Ann Lee', street: 'Lee Street', kid: true, days: [0, 1, 2, 3, 4, 5, 6] };
const bob = { ...base, id: 'N3', name: 'Bob Far', street: 'Other Road', days: [1, 2] };
const never = { ...base, id: 'N4', name: 'Never Buys', street: 'Lee Street', likelihood: 0, days: [0, 1] };
const noTicks = { ...base, id: 'N5', name: 'No Ticks', street: 'Lee Street', days: [] };
const street = [joe, ann, bob, never, noTicks];

test('SCREAM-248: a neighbour line gets the name, the street and the days', () => {
  assert.equal(fillNeighbour('[Name] on [Street] is only home on [Home].', joe, 1), 'Joe Sullivan on Lee Street is only home on Monday and Friday.');
  assert.equal(fillNeighbour("You won't see [Name] until [Back].", joe, 1), "You won't see Joe Sullivan until Friday.");
});

test('SCREAM-248: only people who buy and have ticked days are talked about; one line per kind, the same all run', () => {
  assert.deepEqual(street.map(canBeToldAbout), [true, true, true, false, false]);
  const a = assignNeighbourLines(street, NEIGHBOUR_LINES, 77);
  const b = assignNeighbourLines([...street].reverse(), NEIGHBOUR_LINES, 77);
  assert.deepEqual([...a.keys()].sort(), ['N1', 'N2', 'N3']);
  for (const [id, own] of a) {
    assert.deepEqual(own.map((l) => l.id), b.get(id).map((l) => l.id));
    const kinds = own.map((l) => kindOfLine(l.text));
    assert.equal(new Set(kinds).size, kinds.length, `${id}: one line per kind`);
  }
  assert.deepEqual(a.get('N2').map((l) => kindOfLine(l.text)), ['every']);
});

test('SCREAM-248: a customer talks about someone else on their own street, truthfully', () => {
  const m = assignNeighbourLines(street, NEIGHBOUR_LINES, 77);
  for (let i = 0; i < 100; i++) {
    const said = neighbourLineToday(ann, street, m, 1, 5);
    assert.equal(said.about, 'N1'); // not herself, not Bob (another street), not the two who can't be talked about
    assert.ok(m.get('N1').some((l) => fillNeighbour(l.text, joe, 1) === said.text), said.text);
    assert.match(said.text, /Joe Sullivan/);
    assert.equal(/\[/.test(said.text), false);
  }
  assert.equal(neighbourLineToday(bob, street, m, 1, 5), null); // nobody else on Other Road
});

test('SCREAM-248: never the same neighbour or the same wording twice in an evening', () => {
  const m = assignNeighbourLines(street, NEIGHBOUR_LINES, 77);
  const first = neighbourLineToday(joe, street, m, 1, 5);
  assert.equal(first.about, 'N2');
  assert.equal(neighbourLineToday(joe, street, m, 1, 5, Math.random, [], ['N2']), null);
  assert.equal(neighbourLineToday(joe, street, m, 1, 5, Math.random, [first.id], []), null);
});

test('SCREAM-248: every real neighbour line is true-to-the-ticks text that fits the bubble (120 characters with "Thanks! ")', () => {
  for (const list of [TUTORIAL_RESIDENTS, RESIDENTS]) {
    const m = assignNeighbourLines(list, NEIGHBOUR_LINES, 99);
    for (const r of list) {
      assert.equal(m.has(r.id), canBeToldAbout(r), r.name);
      for (const l of m.get(r.id) ?? []) {
        for (let day = 1; day <= STORY_DAYS; day++) {
          if (!kindFits(kindOfLine(l.text), r, day, STORY_DAYS)) continue;
          const said = 'Thanks! ' + fillNeighbour(l.text, r, day);
          assert.ok(said.length <= 120, `${l.id} about ${r.name}: ${said.length}`);
          assert.equal(/\[|\]|  /.test(said), false, said);
        }
      }
    }
  }
});

test('SCREAM-248: many different neighbour wordings are in use across Elm Park', () => {
  const m = assignNeighbourLines(TUTORIAL_RESIDENTS, NEIGHBOUR_LINES, 7);
  const used = new Set([...m.values()].flat().map((l) => l.id));
  assert.ok(used.size >= 15, `only ${used.size}`);
});
