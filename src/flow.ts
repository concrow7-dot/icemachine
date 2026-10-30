import * as Phaser from 'phaser';
import { loadDifficulty } from './state/Difficulty';
import { EveningState } from './state/EveningState';

/** Scene names, kept in one place so a typo can't break the flow. */
export const SceneKeys = {
  Title: 'Title',
  Truck: 'Truck',
  Cooler: 'Cooler',
  Sales: 'Sales',
  Fill: 'Fill',
  Drive: 'Drive',
  Hud: 'Hud',
  Results: 'Results',
  Pause: 'Pause',
} as const;

/** Scenes that make up a running evening. New phases get added here. */
export const EVENING_SCENES: string[] = [
  SceneKeys.Truck,
  SceneKeys.Cooler,
  SceneKeys.Sales,
  SceneKeys.Fill,
  SceneKeys.Drive,
  SceneKeys.Hud,
];

const STATE_KEY = 'evening';

/** Starts a brand-new evening from any screen: fresh clock, $0, everything reset. */
export function startEvening(from: Phaser.Scene): void {
  const evening = new EveningState();
  // The difficulty picked on the title screen; a restart keeps it (change it on the title).
  evening.difficulty = loadDifficulty();
  from.registry.set(STATE_KEY, evening);
  // #66 (PO): the evening opens straight at the cooler, with the clock waiting.
  from.scene.start(SceneKeys.Cooler);
  from.scene.launch(SceneKeys.Hud);
}

/** Stops every evening scene and shows the results screen. */
export function endEvening(from: Phaser.Scene): void {
  for (const key of EVENING_SCENES) {
    if (key !== from.scene.key) from.scene.stop(key);
  }
  from.scene.start(SceneKeys.Results);
}

/**
 * Esc during an evening (#19): freezes every running evening screen (the HUD
 * too, which stops the clock) and opens the pause menu on top.
 */
export function pauseEvening(from: Phaser.Scene): void {
  if (from.scene.isActive(SceneKeys.Pause)) return;
  const paused = EVENING_SCENES.filter((key) => from.scene.isActive(key));
  for (const key of paused) from.scene.pause(key);
  from.scene.launch(SceneKeys.Pause, { paused });
  from.scene.bringToTop(SceneKeys.Pause);
}

/** The current evening. Only valid between startEvening and the next title screen. */
export function getEvening(scene: Phaser.Scene): EveningState {
  const state = scene.registry.get(STATE_KEY) as EveningState | undefined;
  if (!state) throw new Error('No evening is running');
  return state;
}

/** Stations inside the truck (issue #7). */
export type Station = 'cooler' | 'driver' | 'window';

/** Goes back to the truck interior with the given station highlighted. Leaving any station starts the clock (#66). */
export function returnToTruck(from: Phaser.Scene, station: Station): void {
  getEvening(from).startClock();
  from.scene.start(SceneKeys.Truck, { station });
}
