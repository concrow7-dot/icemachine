// SCREAM-317: the Calculator power-up's pad: + − × ÷ and =, worked left to right, in cents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { CalcSum, applyOp, formatCalc } = await game('state/CalcSum');

const press = (c, keys) => {
  for (const k of keys) {
    if (k === '=') c.equals();
    else if (['+', '-', '*', '/'].includes(k)) c.operator(k);
    else if (k === '<') c.back();
    else c.digit(k);
  }
  return c;
};

test('adding up an order: 2.50 + 2.50 + 3 = 8.00', () => {
  const c = press(new CalcSum(), ['2', '.', '5', '+', '2', '.', '5', '+', '3']);
  assert.equal(c.display(), '3');
  assert.equal(c.op, '+');
  press(c, ['=']);
  assert.equal(c.display(), '8.00');
  assert.equal(c.chargeCents(), 800);
});

test('the running total shows after each sign, left to right', () => {
  const c = press(new CalcSum(), ['2', '+', '3', '*']);
  assert.equal(c.display(), '5.00');
  press(c, ['2', '=']);
  assert.equal(c.display(), '10.00'); // (2 + 3) x 2, like a desk calculator
});

test('times and divide: 3 x 2.50 = 7.50; 10 / 4 = 2.50; divide by 0 leaves it alone', () => {
  assert.equal(press(new CalcSum(), ['3', '*', '2', '.', '5', '=']).display(), '7.50');
  assert.equal(press(new CalcSum(), ['1', '0', '/', '4', '=']).display(), '2.50');
  assert.equal(press(new CalcSum(), ['5', '/', '0', '=']).display(), '5.00');
  assert.equal(applyOp(250, '*', 300), 750);
});

test('CHARGE in the middle of a sum works it out first; nothing or below zero charges nothing', () => {
  assert.equal(press(new CalcSum(), ['4', '+', '1', '.', '2', '5']).chargeCents(), 525);
  assert.equal(new CalcSum().chargeCents(), null);
  assert.equal(press(new CalcSum(), ['2', '-', '5']).chargeCents(), null);
  assert.equal(formatCalc(-300), '-3.00');
});

test('a plain price still works with no signs; a sign first does nothing', () => {
  assert.equal(press(new CalcSum(), ['7', '.', '2', '5']).chargeCents(), 725);
  const c = press(new CalcSum(), ['+', '6']);
  assert.equal(c.op, null);
  assert.equal(c.chargeCents(), 600);
});

test('after =, a digit starts a new sum and a sign carries on from the total', () => {
  const c = press(new CalcSum(), ['2', '+', '2', '=', '9']);
  assert.equal(c.display(), '9');
  assert.equal(c.chargeCents(), 900);
  const d = press(new CalcSum(), ['2', '+', '2', '=', '+', '1', '=']);
  assert.equal(d.display(), '5.00');
});

test('back takes off a digit; C clears everything', () => {
  const c = press(new CalcSum(), ['1', '2', '<']);
  assert.equal(c.display(), '1');
  press(c, ['+', '3']);
  c.clear();
  assert.deepEqual([c.display(), c.op, c.total], ['0', null, null]);
});

test('SCREAM-330: the register rings up ice creams: each adds its price to what the pad shows', () => {
  const sum = new CalcSum();
  sum.addItem(250);
  sum.addItem(250);
  sum.addItem(300);
  assert.equal(sum.display(), '8.00');
  assert.equal(sum.chargeCents(), 800);
  // In the middle of a sum, the sum is worked out first.
  const mid = new CalcSum();
  for (const k of ['1', '.', '5']) mid.digit(k);
  mid.operator('+');
  mid.digit('2');
  mid.addItem(250);
  assert.equal(mid.display(), '6.00');
  assert.equal(mid.op, null);
  // The pad still works afterwards: + 1 = one dollar more.
  mid.operator('+');
  mid.digit('1');
  assert.equal(mid.chargeCents(), 700);
  // C clears it.
  mid.clear();
  mid.addItem(300);
  assert.equal(mid.display(), '3.00');
});
