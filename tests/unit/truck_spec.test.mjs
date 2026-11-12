// SCREAM-204: Story starts with a weaker truck; Quick play keeps the full-strength one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.mjs';

const { truckSpec } = await game('state/TruckSpec');
const t = await game('config/tuning');

test("Quick play's truck is exactly the tuning values", () => {
  const full = truckSpec(false);
  assert.equal(full.weak, false);
  assert.equal(full.topSpeed, t.TRUCK_SPEED);
  assert.equal(full.accelerationSeconds, t.TRUCK_ACCELERATION_SECONDS);
  assert.equal(full.brakingSeconds, t.TRUCK_BRAKING_SECONDS);
  assert.equal(full.maxTurnDegrees, t.TRUCK_MAX_TURN_DEGREES_PER_SECOND);
  assert.equal(full.musicRadius, t.MUSIC_RING_RADIUS);
  assert.equal(full.coolerCrates, t.COOLER_CRATES);
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
  assert.ok(weak.maxTurnDegrees < full.maxTurnDegrees, 'turns less sharply at speed');
  assert.ok(weak.musicRadius < full.musicRadius, 'music reaches less far');
  assert.ok(weak.coolerCrates < full.coolerCrates, 'fewer crates');
  assert.equal(weak.coolerCapacity, weak.coolerCrates * t.CRATE_SIDE * t.CRATE_SIDE);
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
