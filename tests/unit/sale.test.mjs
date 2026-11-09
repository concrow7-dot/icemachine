import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { pickOrderSize, generateOrder, orderTotalCents, tipPercentAt, describeOrder } = await game('state/Sale');
const { ORDER_SIZE_WEIGHTS, REFUSE_ABOVE_CENTS, TIP_COUNTDOWN_SECONDS } = await game('config/tuning');

const slots = [
  { flavour: 'eclair', quantity: 5, priceCents: 200 },
  { flavour: 'spongepop', quantity: 3, priceCents: 150 },
  { flavour: 'explorer', quantity: 0, priceCents: 150 },
  { flavour: 'cookie', quantity: 4, priceCents: REFUSE_ABOVE_CENTS + 25 },
];
/** A fixed sequence of "random" numbers. */
const rolls = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('order sizes follow the PO\'s weights: the lowest roll is 1, the highest is 6', () => {
  assert.equal(pickOrderSize(0), 1);
  assert.equal(pickOrderSize(0.999), ORDER_SIZE_WEIGHTS.length);
  const first = ORDER_SIZE_WEIGHTS[0] / ORDER_SIZE_WEIGHTS.reduce((a, b) => a + b, 0);
  assert.equal(pickOrderSize(first - 0.001), 1);
  assert.equal(pickOrderSize(first + 0.001), 2);
});

test('customers never order a flavour over $4.00, one that is sold out, or more than is left', () => {
  for (let i = 0; i < 50; i++) {
    const order = generateOrder(slots, Math.random);
    for (const line of order) {
      assert.notEqual(line.flavour, 'cookie', 'too expensive');
      assert.notEqual(line.flavour, 'explorer', 'sold out');
      assert.ok(line.count <= slots[line.slot].quantity);
    }
  }
});

test('everything too expensive: an empty order', () => {
  assert.deepEqual(generateOrder([{ flavour: 'eclair', quantity: 5, priceCents: 500 }]), []);
});

test('SCREAM-189: a set order size (Big Kev\'s 7) is capped by what is in stock', () => {
  const total = (o) => o.reduce((n, l) => n + l.count, 0);
  assert.equal(total(generateOrder(slots, rolls(0.5), 7)), 7);
  assert.equal(total(generateOrder(slots, rolls(0.5), 20)), 8, 'only 8 affordable ice creams in stock');
  assert.equal(total(generateOrder(slots, rolls(0.5), 2)), 2);
});

test('the real total uses the player\'s own prices', () => {
  const order = [{ slot: 0, flavour: 'eclair', count: 2 }, { slot: 1, flavour: 'spongepop', count: 1 }];
  assert.equal(orderTotalCents(order, slots), 550);
  assert.equal(describeOrder(order), '2 Chocolate Eclair, 1 SpongePop');
});

test('the tip steps down 20, 15, 10, 5, then 0 over the countdown', () => {
  assert.equal(tipPercentAt(0), 20);
  assert.equal(tipPercentAt(9.9), 20);
  assert.equal(tipPercentAt(10), 15);
  assert.equal(tipPercentAt(25), 10);
  assert.equal(tipPercentAt(35), 5);
  assert.equal(tipPercentAt(TIP_COUNTDOWN_SECONDS), 0);
  assert.equal(tipPercentAt(-3), 20);
});

test('SCREAM-103: a hint follows the thanks, only after a paid sale', async () => {
  const { Sale } = await game('state/Sale');
  const paid = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
  paid.phase = 'over'; paid.outcome = { kind: 'paid', priceCents: 200, tipCents: 20, tipPercent: 10 }; paid.line = 'Thanks!';
  paid.addHint('T034', 'Big Kev on Institute Road buys a ton of ice cream.');
  assert.equal(paid.line, 'Thanks! Big Kev on Institute Road buys a ton of ice cream.');
  assert.equal(paid.hintAbout, 'T034');
  const lost = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
  lost.addHint('T034', 'Anything.');
  assert.equal(lost.hintAbout, null);
});
