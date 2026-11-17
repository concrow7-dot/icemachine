// SCREAM-374 (PO, November 16): "On the chocolate éclair, spongepop and lil explorer, ake the price
// the max allowed when added fomr available ice cream." In Story those three go onto Today's Menu
// at the most a customer pays for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { CoolerOrder } = await game('state/CoolerOrder');
const { MENU_STARTS_AT_TOP, STORY_REFUSE_ABOVE_CENTS } = await game('config/tuning');

const top = (f) => STORY_REFUSE_ABOVE_CENTS[f] ?? 400;
const start = (f) => (MENU_STARTS_AT_TOP.includes(f) ? top(f) : null); // what Story's evening passes in
const order = (slots, addPrice = start) => new CoolerOrder(slots, () => 5000, [], () => true, top, undefined, addPrice);
const price = (o, f) => o.slots.find((s) => s.flavour === f).priceCents;

test('the three he named, and only those', () => {
  assert.deepEqual([...MENU_STARTS_AT_TOP], ['eclair', 'spongepop', 'explorer']);
});

test('added from Available Ice Cream, the eclair starts at $2.50 and SpongePop and the Explorer Pop at $3.00', () => {
  const o = order([{ flavour: 'eclair', quantity: 0, priceCents: 200 }, { flavour: 'spongepop', quantity: 0, priceCents: 250 }, { flavour: 'explorer', quantity: 0, priceCents: 250 }]);
  for (const f of ['eclair', 'spongepop', 'explorer']) o.addOne(f);
  assert.deepEqual(['eclair', 'spongepop', 'explorer'].map((f) => price(o, f)), [250, 300, 300]);
});

test('a second one changes nothing: a price the player lowered stays', () => {
  const o = order([{ flavour: 'eclair', quantity: 0, priceCents: 200 }]);
  o.addOne('eclair');
  o.changePrice('eclair', -50);
  o.addOne('eclair');
  assert.equal(price(o, 'eclair'), 200);
});

test('one already on the menu from yesterday keeps its price', () => {
  const o = order([{ flavour: 'spongepop', quantity: 2, priceCents: 225 }]);
  o.addOne('spongepop');
  assert.equal(price(o, 'spongepop'), 225);
});

test('the sandwich, and everything outside Story, keep their starting prices', () => {
  const o = order([{ flavour: 'cookie', quantity: 0, priceCents: 300 }]);
  o.addOne('cookie');
  assert.equal(price(o, 'cookie'), 300);
  const quick = order([{ flavour: 'eclair', quantity: 0, priceCents: 200 }], () => null);
  quick.addOne('eclair');
  assert.equal(price(quick, 'eclair'), 200);
});
