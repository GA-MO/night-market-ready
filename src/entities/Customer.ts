import Phaser from "phaser";
import { CRITIC_PATIENCE_MS, PATIENCE_MS } from "../config";

export class Customer {
  readonly obj: Phaser.GameObjects.Container;
  atSlot = false;
  queueIndex = -1;
  dead = false;
  /** VIP customers pay a multiple of the normal price — a juicy surprise in the queue. */
  vip = false;
  /** Food critics have a short fuse; serving them in time earns the stall a rave review. */
  critic = false;

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
    const parts: Phaser.GameObjects.GameObject[] = [shadow, body];

    // Cosmetic variety so the crowd doesn't look like clones.
    const rnd = Phaser.Math.RND;
    if (rnd.frac() < 0.7) {
      const key = rnd.pick(["acc_straw", "acc_bun", "acc_cap"]);
      const hat = scene.add.sprite(0, key === "acc_bun" ? -20 : -19, key).setScale(0.92);
      if (key === "acc_cap") hat.setTint(rnd.pick([0xef6351, 0x4895ef, 0xffd23f, 0x90be6d, 0xff70a6]));
      parts.push(hat);
    }
    if (rnd.frac() < 0.3) {
      parts.push(scene.add.sprite(0, -3, "acc_glasses").setScale(0.8));
    }

    this.obj = scene.add.container(x, y, parts);
    this.obj.setScale(rnd.realInRange(0.9, 1.12));
    this.obj.setDepth(y);
  }

  /** Mark this customer as a paying VIP: gold aura + crown. */
  makeVip(): void {
    if (this.vip || this.dead) return;
    this.vip = true;
    const aura = this.scene.add
      .sprite(0, 2, "glow")
      .setTint(0xffd23f)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setScale(0.85);
    this.obj.addAt(aura, 0);
    const crown = this.scene.add.text(0, -34, "👑", { fontSize: "22px" }).setOrigin(0.5);
    this.obj.add(crown);
    this.scene.tweens.add({
      targets: aura,
      alpha: 0.2,
      scale: 1.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  /** Mark this customer as a food critic: notepad badge, pale aura and a short fuse. */
  makeCritic(): void {
    if (this.critic || this.vip || this.dead) return;
    this.critic = true;
    this.patienceMax = CRITIC_PATIENCE_MS;
    const aura = this.scene.add
      .sprite(0, 2, "glow")
      .setTint(0xcfe7ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setScale(0.8);
    this.obj.addAt(aura, 0);
    const pad = this.scene.add.text(0, -34, "📰", { fontSize: "22px" }).setOrigin(0.5);
    this.obj.add(pad);
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
