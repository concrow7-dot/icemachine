import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { pressPriceKey, priceEntryCents } = await game('state/PriceEntry');

test('SCREAM-12: typed left to right like a calculator: 7 . 2 5 reads $7.25', () => {
  const typed = ['7', '.', '2', '5'].reduce(pressPriceKey, '');
  assert.equal(typed, '7.25');
  assert.equal(priceEntryCents(typed), 725);
});

test('no decimal point means whole dollars', () => {
  assert.equal(priceEntryCents('7'), 700);
  assert.equal(priceEntryCents('12'), 1200);
});

test('at most three dollar digits and two cent digits', () => {
  assert.equal(['1', '2', '3', '4'].reduce(pressPriceKey, ''), '123');
  assert.equal(['1', '.', '2', '3', '4'].reduce(pressPriceKey, ''), '1.23');
});

test('a leading zero is replaced; a second point is ignored; 00 is two zeros', () => {
  assert.equal(pressPriceKey('0', '5'), '5');
  assert.equal(pressPriceKey('1.5', '.'), '1.5');
  assert.equal(pressPriceKey('1', '00'), '100');
  assert.equal(pressPriceKey('', '.'), '0.');
});

test('nothing typed, or only zero, is no price', () => {
  assert.equal(priceEntryCents(''), null);
  assert.equal(priceEntryCents('0'), null);
  assert.equal(priceEntryCents('0.0'), null);
  assert.equal(priceEntryCents('.5'), 50);
});
