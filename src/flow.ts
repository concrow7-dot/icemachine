import * as Phaser from 'phaser';
import { EveningState } from './state/EveningState';

/** Scene names, kept in one place so a typo can't break the flow. */
export const SceneKeys = {
  Title: 'Title',
  TestRoom: 'TestRoom',
  Hud: 'Hud',
  Results: 'Results',
} as const;

/** Scenes that make up a running evening. Later phases (truck, driving) get added here. */
const EVENING_SCENES: string[] = [SceneKeys.TestRoom, SceneKeys.Hud];

const STATE_KEY = 'evening';

/** Starts a brand-new evening from any screen: fresh clock, $0, everything reset. */
export function startEvening(from: Phaser.Scene): void {
  from.registry.set(STATE_KEY, new EveningState());
  from.scene.start(SceneKeys.TestRoom);
  from.scene.launch(SceneKeys.Hud);
}

/** Stops every evening scene and shows the results screen. */
export function endEvening(from: Phaser.Scene): void {
  for (const key of EVENING_SCENES) {
    if (key !== from.scene.key) from.scene.stop(key);
  }
  from.scene.start(SceneKeys.Results);
}

/** The current evening. Only valid between startEvening and the next title screen. */
export function getEvening(scene: Phaser.Scene): EveningState {
  const state = scene.registry.get(STATE_KEY) as EveningState | undefined;
  if (!state) throw new Error('No evening is running');
  return state;
}
