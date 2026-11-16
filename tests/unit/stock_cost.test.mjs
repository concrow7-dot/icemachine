// SCREAM-365 (PO, November 16): "The spongepop and explorer pop ice cream should reduce to $1.25 each.
// The 2 ball lou ball and drumcone should be $0.75 each" (the cooler's clipboard; Story).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { stockCostOf } = await game('config/flavours');
const { CoolerOrder } = await game('state/CoolerOrder');

test('Story: SpongePop and the Explorer Pop $1.25, the Lou Ball and the Drum Cone $0.75; the eclair and the sandwich as before', () => {
  assert.deepEqual(['spongepop', 'explorer', 'louball', 'drumcone', 'eclair', 'cookie'].map((f) => stockCostOf(f, true)), [125, 125, 75, 75, 100, 200]);
});

test('Quick play keeps its prices (the standing Story-only rule)', () => {
  assert.deepEqual(['spongepop', 'explorer', 'eclair', 'cookie'].map((f) => stockCostOf(f, false)), [150, 150, 100, 200]);
});

test('the cooler charges Story\'s price', () => {
  const order = new CoolerOrder([{ flavour: 'spongepop', quantity: 0, priceCents: 250 }], () => 1000, [], () => true, undefined, (f) => stockCostOf(f, true));
  order.addOne('spongepop');
  order.addOne('spongepop');
  assert.equal(order.costCents, 250);
});
