import * as Phaser from 'phaser';
import { HudScene } from './scenes/HudScene';
import { CoolerScene } from './scenes/CoolerScene';
import { DriveScene } from './scenes/DriveScene';
import { WindowScene } from './scenes/PlaceholderStationScene';
import { ResultsScene } from './scenes/ResultsScene';
import { TitleScene } from './scenes/TitleScene';
import { TruckScene } from './scenes/TruckScene';

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
    CoolerScene,
    WindowScene,
    DriveScene,
    ResultsScene,
    HudScene,
  ],
};

new Phaser.Game(config);
