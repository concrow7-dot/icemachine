import * as Phaser from 'phaser';
import { EveningState } from './state/EveningState';
import { StoryRun } from './state/StoryRun';
import { clearStorySave, loadStory } from './state/StorySave';

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
  DayEnd: 'DayEnd',
  StoryIntro: 'StoryIntro',
  Pump: 'Pump',
  Loading: 'Loading',
} as const;

/** Scenes that make up a running evening. New phases get added here. */
export const EVENING_SCENES: string[] = [
  SceneKeys.Truck,
  SceneKeys.Cooler,
  SceneKeys.Sales,
  SceneKeys.Fill,
  SceneKeys.Drive,
  SceneKeys.Pump,
  SceneKeys.Hud,
];

const STATE_KEY = 'evening';
/** SCREAM-19: the Story run in progress, or null in Quick play. */
const STORY_KEY = 'story';

/** Quick play: starts a brand-new evening from any screen, everything reset. */
export function startEvening(from: Phaser.Scene): void {
  from.registry.set(STORY_KEY, null);
  beginEvening(from, new EveningState());
}

/** Story mode (SCREAM-19): starts a new run at day 1, replacing any save (SCREAM-17). */
export function startStory(from: Phaser.Scene): void {
  clearStorySave();
  from.registry.set(STORY_KEY, new StoryRun());
  // SCREAM-18: a new run opens with the story's intro; Enter there starts day 1.
  from.scene.start(SceneKeys.StoryIntro);
}

/** SCREAM-17: carries on a saved run, at the start of the next evening. Returns false if there's no save. */
export function continueStory(from: Phaser.Scene): boolean {
  const save = loadStory();
  if (!save) return false;
  from.registry.set(STORY_KEY, new StoryRun(save));
  startStoryEvening(from);
  return true;
}

/** Story mode: starts tonight's evening with the cash and stock carried over. */
export function startStoryEvening(from: Phaser.Scene): void {
  beginEvening(from, getStory(from)?.newEvening() ?? new EveningState());
}

/** Restart evening (pause menu): Quick play starts fresh; Story goes back to how tonight started. */
export function restartEvening(from: Phaser.Scene): void {
  if (getStory(from)) startStoryEvening(from);
  else startEvening(from);
}

/** The Story run in progress, or null in Quick play. */
export function getStory(scene: Phaser.Scene): StoryRun | null {
  return (scene.registry.get(STORY_KEY) as StoryRun | null | undefined) ?? null;
}

/** Leaves Story mode (back to the title after a run, or quitting). */
export function clearStory(scene: Phaser.Scene): void {
  scene.registry.set(STORY_KEY, null);
}

function beginEvening(from: Phaser.Scene, evening: EveningState): void {
  from.registry.set(STATE_KEY, evening);
  // #66 (PO): the evening opens straight at the cooler, with the clock waiting.
  from.scene.start(SceneKeys.Cooler);
  from.scene.launch(SceneKeys.Hud);
}

/** Stops every evening scene and shows the results screen (Quick play) or the end-of-day screen (Story). */
export function endEvening(from: Phaser.Scene): void {
  for (const key of EVENING_SCENES) {
    if (key !== from.scene.key) from.scene.stop(key);
  }
  from.scene.start(getStory(from) ? SceneKeys.DayEnd : SceneKeys.Results);
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
export type Station = 'menu' | 'cooler' | 'driver' | 'window';

/** Goes back to the truck interior with the given station highlighted. Leaving any station starts the clock (#66). */
export function returnToTruck(from: Phaser.Scene, station: Station): void {
  getEvening(from).startClock();
  from.scene.start(SceneKeys.Truck, { station });
}
