import * as Phaser from 'phaser';
import { SceneKeys } from '../flow';
import { MAPS } from '../config/maps';
import { LOAD_AHEAD_LOADING_AFTER_MS, SCREEN_FADE_MS } from '../config/tuning';
import { STORY_MAP } from '../state/StoryRun';
import { loadTruckInterior } from '../ui/truckInterior';
import { loadCoolerArt } from './CoolerScene';
import { loadCreditsArt } from './TutorialCrawlScene';
import { loadUncleArt } from './UncleIntroScene';

/**
 * SCREAM-243 (PO, November 12: "load the next screen's pictures earlier ... so nothing shows in
 * between, plus a short fade between screens"). Starting Story used to flash the loading screen
 * for a split second while the next screen fetched its pictures.
 *
 * `loadStoryAhead` is called by the title and the New Bike screen once they are on screen: it
 * fetches, in the background, what the first screens of a Story need (the cooler, the ice cream
 * pictures and their font, the inside of the truck, and for a new player the uncle and his
 * credits). Each of those screens still checks for itself, so nothing breaks if this didn't run.
 *
 * `withUncle` adds the uncle's credits (their map and tune) and his picture: the title asks for
 * them for a new player, whose Story always starts with him, and when it asks "Bring your uncle
 * along again?". Everyone else is spared that download (about half a megabyte).
 */
export function loadStoryAhead(scene: Phaser.Scene, withUncle = false): void {
  loadCoolerArt(scene);
  loadTruckInterior(scene);
  if (withUncle) {
    loadCreditsArt(scene, MAPS[STORY_MAP]);
    loadUncleArt(scene);
  }
  if (scene.load.list.size > 0 && !scene.load.isLoading()) scene.load.start();
}

/**
 * SCREAM-243: leaves a screen with a short fade to black; `go` then starts the next screens,
 * and each of `arriving` fades in as it opens. If the pictures loaded ahead are still on their
 * way (a click in the title's first moments, or a slow connection) it waits for them under the
 * black, so two screens never fetch the same picture at once; the loading screen comes up only
 * if that wait is a long one.
 *
 * With `fade` false there is no fade (Quick play, which is left as it was: decision 076); it only
 * waits for anything still loading.
 */
export function fadeTo(from: Phaser.Scene, arriving: readonly string[], go: () => void, fade = true): void {
  const camera = from.cameras.main;
  let faded = false;
  let loaded = !from.load.isLoading();
  let left = false;
  const leave = (): void => {
    if (left || !faded || !loaded) return;
    left = true;
    if (from.scene.isActive(SceneKeys.Loading)) from.scene.stop(SceneKeys.Loading);
    const leftAt = performance.now();
    go();
    for (const key of arriving) {
      const next = from.scene.get(key);
      next.events.once(Phaser.Scenes.Events.CREATE, () => {
        // Only the screen opened by this fade (not one of the same name opened much later).
        if (performance.now() - leftAt < 3000) next.cameras.main.fadeIn(SCREEN_FADE_MS);
      });
    }
  };
  if (!loaded) {
    from.load.once(Phaser.Loader.Events.COMPLETE, () => {
      loaded = true;
      leave();
    });
  }
  const onFaded = (): void => {
    faded = true;
    leave();
    if (!left) {
      from.time.delayedCall(LOAD_AHEAD_LOADING_AFTER_MS, () => {
        if (!left) from.scene.launch(SceneKeys.Loading);
      });
    }
  };
  if (!fade) return onFaded();
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onFaded);
  camera.fadeOut(SCREEN_FADE_MS);
}
