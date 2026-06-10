import Phaser from "phaser";

/** Generates every texture procedurally — the prototype ships zero art assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const g = this.add.graphics();

    // Small white disc — particles, fairy lights, joystick.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture("dot", 16, 16);
    g.clear();

    // Soft radial glow (additive-blended halos).
    for (let i = 10; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.028 * (11 - i));
      g.fillCircle(80, 80, i * 8);
    }
    g.generateTexture("glow", 160, 160);
    g.clear();

    // Player: vendor — orange body, white apron, red bandana.
    g.fillStyle(0x1c1024, 1);
    g.fillCircle(24, 24, 21);
    g.fillStyle(0xff8c42, 1);
    g.fillCircle(24, 24, 19);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(24, 31, 24, 14);
    g.fillStyle(0xd62828, 1);
    g.fillCircle(24, 12, 8);
    g.generateTexture("player", 48, 48);
    g.clear();

    // Customer base: white circle, tinted per spawn.
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(18, 18, 18);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(18, 18, 16);
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(13, 15, 2.4);
    g.fillCircle(23, 15, 2.4);
    g.generateTexture("npc", 36, 36);
    g.clear();

    // Food item: white rounded square, tinted per stall.
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(0, 2, 20, 14, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 20, 14, 5);
    g.generateTexture("food", 20, 16);
    g.clear();

    // Coin.
    g.fillStyle(0xcc8a00, 1);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0xffd23f, 1);
    g.fillCircle(10, 10, 8);
    g.fillStyle(0xffe89a, 1);
    g.fillCircle(7, 7, 3);
    g.generateTexture("coin", 20, 20);
    g.clear();

    // Grill / cooking station.
    g.fillStyle(0x14141f, 1);
    g.fillRoundedRect(0, 0, 96, 64, 10);
    g.fillStyle(0x3a3a4a, 1);
    g.fillRoundedRect(3, 3, 90, 58, 8);
    g.lineStyle(3, 0x1d1d2b, 1);
    for (let y = 14; y <= 50; y += 12) {
      g.lineBetween(8, y, 88, y);
    }
    g.fillStyle(0xff5714, 0.9);
    g.fillCircle(20, 56, 3);
    g.fillCircle(48, 58, 3);
    g.fillCircle(76, 56, 3);
    g.generateTexture("grill", 96, 64);
    g.clear();

    // Serving counter (wood).
    g.fillStyle(0x4a2c14, 1);
    g.fillRoundedRect(0, 0, 110, 52, 8);
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(3, 3, 104, 46, 6);
    g.fillStyle(0xa9743c, 1);
    g.fillRoundedRect(8, 8, 94, 16, 4);
    g.generateTexture("counter", 110, 52);
    g.clear();

    // Awning: white base + stripe overlay tinted with each stall's color.
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 280, 36, { tl: 10, tr: 10, bl: 4, br: 4 });
    g.generateTexture("awning_base", 280, 36);
    g.clear();

    for (let x = 0; x < 280; x += 40) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x, 0, 20, 36);
    }
    g.generateTexture("awning_stripes", 280, 36);
    g.destroy();

    this.scene.start("game");
    this.scene.launch("ui");
  }
}
