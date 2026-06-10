import Phaser from "phaser";
import { PATIENCE_MS } from "../config";

export class Customer {
  readonly obj: Phaser.GameObjects.Container;
  atSlot = false;
  queueIndex = -1;
  dead = false;

  private tw: Phaser.Tweens.Tween | null = null;
  private patienceMax = PATIENCE_MS;
  private patienceLeft = 0;
  private patienceStarted = false;
  private bar: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    tint: number,
  ) {
    const shadow = scene.add.ellipse(0, 16, 30, 11, 0x000000, 0.3);
    const body = scene.add.sprite(0, 0, "npc").setTint(tint);
    this.obj = scene.add.container(x, y, [shadow, body]);
    this.obj.setDepth(y);
  }

  walkTo(x: number, y: number, speed: number, onArrive?: () => void): void {
    if (this.dead) return;
    this.tw?.stop();
    const d = Phaser.Math.Distance.Between(this.obj.x, this.obj.y, x, y);
    this.tw = this.scene.tweens.add({
      targets: this.obj,
      x,
      y,
      duration: Math.max(80, (d / speed) * 1000),
      onUpdate: () => this.obj.setDepth(this.obj.y),
      onComplete: () => onArrive?.(),
    });
  }

  /** Reached the front-of-queue slot — start (or keep) the patience countdown. */
  arriveAtSlot(): void {
    if (this.dead) return;
    this.atSlot = true;
    if (this.patienceStarted) return;
    this.patienceStarted = true;
    this.patienceLeft = this.patienceMax;
    this.bar = this.scene.add.graphics();
    this.obj.add(this.bar);
    this.drawBar();
  }

  /** Returns true on the frame the customer's patience finally runs out. */
  tickPatience(dt: number): boolean {
    if (this.dead || !this.atSlot || !this.patienceStarted) return false;
    this.patienceLeft -= dt;
    this.drawBar();
    if (this.patienceLeft <= 0) {
      this.patienceStarted = false;
      return true;
    }
    return false;
  }

  private drawBar(): void {
    if (!this.bar) return;
    const frac = Phaser.Math.Clamp(this.patienceLeft / this.patienceMax, 0, 1);
    const w = 32, h = 6, x = -w / 2, y = -36;
    this.bar.clear();
    this.bar.fillStyle(0x05060f, 0.55);
    this.bar.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    const col = frac > 0.5 ? 0x6ee76e : frac > 0.25 ? 0xffd23f : 0xff5a4a;
    this.bar.fillStyle(col, 1);
    this.bar.fillRoundedRect(x, y, Math.max(0, w * frac), h, 3);
  }

  served(exitX: number, exitY: number): void {
    this.atSlot = false;
    this.patienceStarted = false;
    this.bar?.destroy();
    this.bar = null;
    const heart = this.scene.add
      .text(this.obj.x, this.obj.y - 34, "💛", { fontSize: "24px" })
      .setOrigin(0.5)
      .setDepth(5000);
    this.scene.tweens.add({
      targets: heart,
      y: heart.y - 36,
      alpha: 0,
      duration: 700,
      onComplete: () => heart.destroy(),
    });
    this.leave(exitX, exitY);
  }

  /** Stomp off without buying. */
  loseTemper(exitX: number, exitY: number): void {
    this.atSlot = false;
    this.patienceStarted = false;
    this.bar?.destroy();
    this.bar = null;
    const mad = this.scene.add
      .text(this.obj.x, this.obj.y - 34, "💢", { fontSize: "26px" })
      .setOrigin(0.5)
      .setDepth(5000);
    this.scene.tweens.add({
      targets: mad,
      y: mad.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => mad.destroy(),
    });
    this.leave(exitX, exitY);
  }

  leave(x: number, y: number): void {
    this.atSlot = false;
    this.walkTo(x, y, 180, () => this.destroy());
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.tw?.stop();
    this.obj.destroy();
  }
}
