import Phaser from 'phaser';
import { TestRoomScene } from './scenes/TestRoomScene.js';

// Game-wide settings. Resolution is a placeholder until the
// camera/perspective spec is decided (roadmap item 4).
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1b2230',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TestRoomScene],
};

new Phaser.Game(config);
