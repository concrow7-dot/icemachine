// SCREAM-204: Story starts with a weaker truck; Quick play keeps the full-strength one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { truckSpec, coolerCellOpen } = await game('state/TruckSpec');
const t = await game('config/tuning');

test("Quick play's truck is exactly the tuning values", () => {
  const full = truckSpec(false);
  assert.equal(full.weak, false);
  assert.equal(full.topSpeed, t.TRUCK_SPEED);
  assert.equal(full.accelerationSeconds, t.TRUCK_ACCELERATION_SECONDS);
  assert.equal(full.brakingSeconds, t.TRUCK_BRAKING_SECONDS);
  assert.equal(full.creepSpeed, t.TRUCK_CREEP_SPEED);
  assert.equal(full.reverseSpeed, t.TRUCK_REVERSE_SPEED);
  assert.equal(full.reverseAccelerationSeconds, t.TRUCK_REVERSE_ACCELERATION_SECONDS);
  assert.equal(full.maxTurnDegrees, t.TRUCK_MAX_TURN_DEGREES_PER_SECOND);
  assert.equal(full.musicRadius, t.MUSIC_RING_RADIUS);
  assert.equal(full.coolerHalfCovered, false);
  assert.equal(full.coolerCapacity, t.COOLER_CAPACITY);
  assert.equal(full.fuelTankPx, t.FUEL_TANK_PX);
});

test("Story's truck is worse at everything the PO listed", () => {
  const full = truckSpec(false);
  const weak = truckSpec(true);
  assert.equal(weak.weak, true);
  assert.ok(weak.topSpeed < full.topSpeed, 'slower');
  assert.ok(weak.accelerationSeconds > full.accelerationSeconds, 'slower to speed up');
  assert.ok(weak.brakingSeconds > full.brakingSeconds, 'slower to stop');
  assert.ok(weak.creepSpeed < full.creepSpeed, 'rolls more slowly');
  // PO, November 12, two rounds: braking 4 then 8 times as long, acceleration 2 then 4 times as long,
  // roll speed down 75% then by another third, music at 85% then 70%, reverse a third as fast and
  // twice as long to get there.
  assert.equal(weak.brakingSeconds, full.brakingSeconds * 16); // third round: 2x worse again
  assert.equal(weak.turnAboveRoll, 0.5); // third round: above roll speed, turns are twice as wide
  assert.equal(full.turnAboveRoll, 1);
  // PO, 02:49: the roll from top speed down to the creep takes 4 seconds in Story (about 10 in Quick play).
  assert.equal(full.coastKeep, t.TRUCK_COAST_KEEP);
  const rollSeconds = (sp) => (Math.log(sp.creepSpeed / sp.topSpeed) / Math.log(sp.coastKeep)) * t.TRUCK_COAST_KEEP_SECONDS;
  assert.ok(Math.abs(rollSeconds(weak) - 4) < 1e-6, 'Story rolls down in 4 s');
  assert.ok(rollSeconds(full) > 9 && rollSeconds(full) < 10.5, 'Quick play still about 10 s');
  assert.equal(weak.accelerationSeconds, full.accelerationSeconds * 4);
  assert.ok(Math.abs(weak.creepSpeed - full.creepSpeed / 6) < 1e-9);
  assert.ok(Math.abs(weak.musicRadius - full.musicRadius * 0.55) < 1e-9); // 85%, 70%, then 55%
  assert.ok(Math.abs(weak.reverseSpeed - full.reverseSpeed / 3) < 1e-9);
  assert.equal(weak.reverseAccelerationSeconds, full.reverseAccelerationSeconds * 2);
  assert.ok(weak.maxTurnDegrees < full.maxTurnDegrees, 'turns less sharply at speed');
  assert.ok(weak.musicRadius < full.musicRadius, 'music reaches less far');
  // SCREAM-269 (PO: "24 to start"): half of every crate is covered.
  assert.equal(weak.coolerHalfCovered, true);
  assert.equal(weak.coolerCapacity, 24);
  assert.ok(weak.fuelTankPx < full.fuelTankPx, 'a tank goes less far');
});

test('the weaker truck can still reach a gas station from where a Story day can start', () => {
  const weak = truckSpec(true);
  // The farthest road is about 2,600 px from a gas station in a straight line (tuning.ts);
  // allow double that for the drive along the roads.
  const reach = (share) => share * weak.fuelTankPx;
  assert.ok(reach(t.FUEL_STORY_MIN_START) > 2600, 'the 1/6 floor reaches a station in a straight line');
  assert.ok(reach(t.FUEL_STORY_START) > 5200, "Day 1's quarter tank");
  assert.ok(reach(t.FUEL_STORY_OUT_OF_GAS_START) > 5200, 'the third of a tank after running out');
  assert.ok(t.FUEL_STORY_OUT_OF_GAS_START > t.FUEL_STORY_MIN_START);
});

test('SCREAM-269: with the halves covered, the left two columns of each crate are open: 24 squares', () => {
  const all = Array.from({ length: t.COOLER_CAPACITY }, (_, i) => i);
  assert.equal(all.filter((i) => coolerCellOpen(false, i)).length, 48);
  const open = all.filter((i) => coolerCellOpen(true, i));
  assert.equal(open.length, 24);
  assert.deepEqual(open.slice(0, 8), [0, 1, 4, 5, 8, 9, 12, 13], 'crate 1: columns 1 and 2 of each row');
  for (const crate of [0, 1, 2]) assert.equal(open.filter((i) => Math.floor(i / 16) === crate).length, 8, 'eight in every crate');
  assert.equal(coolerCellOpen(true, -1), false);
  assert.equal(coolerCellOpen(false, 48), false);
});
