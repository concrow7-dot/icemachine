import * as Phaser from 'phaser';
import type { MapId } from './config/maps';
import { EveningState } from './state/EveningState';
import { StoryRun } from './state/StoryRun';
import { clearStorySave, loadStory } from './state/StorySave';
import { count } from './state/Counter';

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
  UncleIntro: 'UncleIntro',
  TutorialCrawl: 'TutorialCrawl',
  PowerUps: 'PowerUps',
  GasCan: 'GasCan',
  KeyBindings: 'KeyBindings',
  HowToDrive: 'HowToDrive',
} as const;

/** Scenes that make up a running evening. New phases get added here. */
export const EVENING_SCENES: string[] = [
  SceneKeys.TutorialCrawl,
  SceneKeys.UncleIntro,
  SceneKeys.Truck,
  SceneKeys.Cooler,
  SceneKeys.PowerUps,
  SceneKeys.Sales,
  SceneKeys.Fill,
  SceneKeys.Drive,
  SceneKeys.Pump,
  SceneKeys.Hud,
];

const STATE_KEY = 'evening';
/** SCREAM-19: the Story run in progress, or null in Quick play. */
const STORY_KEY = 'story';

/**
 * Quick play: starts a brand-new evening from any screen, everything reset. SCREAM-146: on either map.
 * SCREAM-169: `guided` brings the uncle along (tutorial map only).
 */
export function startEvening(from: Phaser.Scene, map: MapId = 'worcester', guided = false): void {
  from.registry.set(STORY_KEY, null);
  beginEvening(from, new EveningState(undefined, map, guided));
}

/**
 * Story mode (SCREAM-19): starts a new run at day 1, replacing any save (SCREAM-17).
 * SCREAM-205: `withUncle` makes Day 1 the uncle's tutorial evening (credits, then him in the truck).
 */
export function startStory(from: Phaser.Scene, withUncle = false): void {
  clearStorySave();
  const run = new StoryRun(undefined, withUncle);
  from.registry.set(STORY_KEY, run);
  // SCREAM-235 (PO, November 10): With Uncle goes straight into his evening, with no New Bike screen;
  // the credits' scroll sets up the bike instead (SCREAM-236).
  if (run.withUncle) return startStoryEvening(from);
  // SCREAM-18: On My Own opens with the story's intro (the New Bike screen); Enter there starts day 1.
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
  else startEvening(from, getEvening(from).mapId, !!getEvening(from).tutorial);
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
  if (evening.tutorial) count('tutorial-started', 'tutorial'); // SCREAM-201
  // #66 (PO): the evening opens straight at the cooler, with the clock waiting.
  // SCREAM-169, 176: with the uncle, it opens with the credits, then him in the truck (the clock still waiting).
  from.scene.start(evening.tutorial ? SceneKeys.TutorialCrawl : SceneKeys.Cooler);
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

/**
 * SCREAM-122 (PO, November 13): the Temporary Gas Can has just poured itself in. The game
 * stops like a pause (the clock too) while the can pops onto the screen, pulses and goes away.
 */
export function showGasCan(from: Phaser.Scene): void {
  if (from.scene.isActive(SceneKeys.GasCan)) return;
  const paused = EVENING_SCENES.filter((key) => from.scene.isActive(key));
  for (const key of paused) from.scene.pause(key);
  from.scene.launch(SceneKeys.GasCan, { paused });
  from.scene.bringToTop(SceneKeys.GasCan);
}

/** SCREAM-207: a switch for the test suites (set to '1' in browser storage): no "How To Drive" pop-up, so a test that drives isn't frozen by it. Players never set it. */
export const HOW_TO_DRIVE_OFF_KEY = 'icemachine.howtodrive.off.v1';

function howToDriveOff(): boolean {
  try {
    return localStorage.getItem(HOW_TO_DRIVE_OFF_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * SCREAM-207: the player has the wheel for the first time (Day 1, after the uncle's drive, after
 * skipping him, or On My Own). The game stops like a pause (the clock too) while the "How To
 * Drive" pop-up shows the keys; closing it starts the player's driving.
 */
export function showHowToDrive(from: Phaser.Scene): void {
  if (howToDriveOff()) return;
  if (from.scene.isActive(SceneKeys.HowToDrive)) return;
  const paused = EVENING_SCENES.filter((key) => from.scene.isActive(key));
  for (const key of paused) from.scene.pause(key);
  from.scene.launch(SceneKeys.HowToDrive, { paused });
  from.scene.bringToTop(SceneKeys.HowToDrive);
}

/**
 * SCREAM-181: Esc on the high score screen while it asks for initials. The screen freezes as it
 * is (letters typed so far stay) and the pause menu opens with a warning and no Restart.
 */
export function pauseResults(from: Phaser.Scene): void {
  if (from.scene.isActive(SceneKeys.Pause)) return;
  from.scene.pause(SceneKeys.Results);
  from.scene.launch(SceneKeys.Pause, { paused: [SceneKeys.Results], fromResults: true });
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
  const evening = getEvening(from);
  evening.startClock();
  // SCREAM-171: in the guided tutorial, after Buy Stock the uncle has a word in the truck, then
  // walks to the cab and drives (UncleIntroScene, then the drive scene).
  if (evening.tutorial?.legToDrive === 'toRegular' && !evening.isPrepLocked) {
    from.scene.start(SceneKeys.UncleIntro);
    return;
  }
  from.scene.start(SceneKeys.Truck, { station });
}
