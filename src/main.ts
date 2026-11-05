import * as Phaser from 'phaser';
import { HudScene } from './scenes/HudScene';
import { LoadingScene } from './scenes/LoadingScene';
import { PauseScene } from './scenes/PauseScene';
import { CoolerScene } from './scenes/CoolerScene';
import { PumpScene } from './scenes/PumpScene';
import { DriveScene } from './scenes/DriveScene';
import { FillScene } from './scenes/FillScene';
import { SalesScene } from './scenes/SalesScene';
import { ResultsScene } from './scenes/ResultsScene';
import { DayEndScene } from './scenes/DayEndScene';
import { StoryIntroScene } from './scenes/StoryIntroScene';
import { TitleScene } from './scenes/TitleScene';
import { TruckScene } from './scenes/TruckScene';
import { UncleIntroScene } from './scenes/UncleIntroScene';
import { TutorialCrawlScene } from './scenes/TutorialCrawlScene';

// Game-wide settings. Resolution is a placeholder until the
// camera/perspective spec is decided (roadmap item 4).
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1b2230',
  // Phaser 4 changed this default to false. Revisit when the art style is
  // chosen: pixel art usually needs true to keep sprites crisp.
  roundPixels: false,
  // SCREAM-115: one texture per draw batch. With several, the tilted truck picture
  // drew with a chunk missing (the map showed through) in the test browser.
  render: { maxTextures: 1 },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // The first scene listed starts automatically. HUD is listed last so it
  // draws on top of every evening phase.
  scene: [
    TitleScene,
    TruckScene,
    UncleIntroScene,
    TutorialCrawlScene,
    CoolerScene,
    SalesScene,
    FillScene,
    DriveScene,
    PumpScene,
    ResultsScene,
    DayEndScene,
    StoryIntroScene,
    HudScene,
    PauseScene,
    // SCREAM-75: listed last, so it draws over everything while a scene loads.
    LoadingScene,
  ],
};

new Phaser.Game(config);
