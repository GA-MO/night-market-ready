import Phaser from "phaser";

export class Customer {
  readonly obj: Phaser.GameObjects.Container;
  atSlot = false;
  queueIndex = -1;
  dead = false;
  private tw: Phaser.Tweens.Tween | null = null;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    tint: number,
  ) {
    const shadow = scene.add.ellipse(0, 14, 28, 10, 0x000000, 0.3);
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

  served(exitX: number, exitY: number): void {
    this.atSlot = false;
    const heart = this.scene.add
      .text(this.obj.x, this.obj.y - 32, "🩷", { fontSize: "22px" })
      .setOrigin(0.5)
      .setDepth(5000);
    this.scene.tweens.add({
      targets: heart,
      y: heart.y - 34,
      alpha: 0,
      duration: 700,
      onComplete: () => heart.destroy(),
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
