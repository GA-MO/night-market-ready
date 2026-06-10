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
  // Cap the loop at 60fps. Without this, 120Hz phones render twice the frames —
  // a major cause of the device heating up. forceSetTimeOut makes the cap actually
  // bind (RAF alone follows the display refresh rate).
  fps: { target: 60, forceSetTimeOut: true },
  // Ask the GPU for its low-power profile. Antialias stays ON — the procedural art has
  // lots of rounded/rotated edges that look jagged without it, and the big thermal wins
  // came from killing the bloom shader + capping fps, not from MSAA.
  render: { powerPreference: "low-power", antialias: true, roundPixels: true },
  scene: [BootScene, GameScene, UIScene],
});

// Exposed for debugging and automated playtesting.
(window as unknown as { __game: Phaser.Game }).__game = game;
