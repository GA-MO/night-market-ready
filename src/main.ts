import Phaser from "phaser";
import { GAME_H, GAME_W } from "./config";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b0d22",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [BootScene, GameScene, UIScene],
});

// Exposed for debugging and automated playtesting.
(window as unknown as { __game: Phaser.Game }).__game = game;
