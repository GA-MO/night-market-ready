import Phaser from "phaser";
import { COUNTER_MAX, GAME_H, GAME_W, GRILL_MAX, QUEUE_MAX, StallDef } from "../config";
import { cookMs } from "../economy";
import type { StallState } from "../save";
import { sfx } from "../audio";
import { Customer } from "./Customer";
import { Worker } from "./Worker";

const BASE_W = 270;
const BASE_H = 150;
const LOCKED_ALPHA = 0.28;

export class Stall {
  readonly def: StallDef;
  readonly state: StallState;
  readonly grillPos: Phaser.Math.Vector2;
  readonly counterPos: Phaser.Math.Vector2;
  readonly pilePos: Phaser.Math.Vector2;
  /** +1 = stall on the left (queue extends rightward into the lane), -1 = mirrored. */
  readonly dir: number;
  readonly cx: number;

  grillStock = 0;
  counterStock = 0;
  pileValue = 0;
  queue: Customer[] = [];
  onTapped: () => void = () => {};

  private worker: Worker | null = null;
  private cookProgress = 0;
  private serveCooldown = 0;
  private grillItems: Phaser.GameObjects.Sprite[] = [];
  private counterItems: Phaser.GameObjects.Sprite[] = [];
  private pileCoins: Phaser.GameObjects.Sprite[] = [];
  private liveGroup!: Phaser.GameObjects.Container;
  private lockGroup: Phaser.GameObjects.Container | null = null;
  private progressBar!: Phaser.GameObjects.Graphics;
  private lights: Phaser.GameObjects.Sprite[] = [];
  private glow!: Phaser.GameObjects.Sprite;
  private lightsAnimated = false;

  constructor(
    private scene: Phaser.Scene,
    def: StallDef,
    state: StallState,
  ) {
    this.def = def;
    this.state = state;
    const left = def.side === "left";
    this.dir = left ? 1 : -1;
    this.cx = left ? 165 : GAME_W - 165;
    this.grillPos = new Phaser.Math.Vector2(left ? 95 : GAME_W - 95, def.y - 10);
    this.counterPos = new Phaser.Math.Vector2(left ? 250 : GAME_W - 250, def.y - 10);
    this.pilePos = new Phaser.Math.Vector2(this.counterPos.x - this.dir * 55, def.y + 88);
    this.buildVisuals();
    if (state.unlocked) {
      this.setUnlocked(false);
    } else {
      this.buildLockOverlay();
    }
  }

  // ---------- visuals ----------

  private buildVisuals(): void {
    const { def, cx } = this;
    const base = this.scene.add.graphics();
    base.fillStyle(0x1c1f3a, 1);
    base.fillRoundedRect(cx - BASE_W / 2, def.y - BASE_H / 2, BASE_W, BASE_H, 14);
    base.lineStyle(3, def.color, 0.5);
    base.strokeRoundedRect(cx - BASE_W / 2, def.y - BASE_H / 2, BASE_W, BASE_H, 14);

    const awningY = def.y - BASE_H / 2 - 14;
    const awningBase = this.scene.add.sprite(cx, awningY, "awning_base").setTint(0xf4f1ea);
    const awningStripes = this.scene.add.sprite(cx, awningY, "awning_stripes").setTint(def.color);
    const name = this.scene.add
      .text(cx, awningY, `${def.emoji} ${def.name}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "23px",
        fontStyle: "bold",
        color: "#1a1a2e",
      })
      .setOrigin(0.5);

    const grill = this.scene.add.sprite(this.grillPos.x, this.grillPos.y, "grill");
    const counter = this.scene.add.sprite(this.counterPos.x, this.counterPos.y, "counter");
    this.progressBar = this.scene.add.graphics();

    const pileMarker = this.scene.add
      .sprite(this.pilePos.x, this.pilePos.y, "glow")
      .setScale(0.55)
      .setAlpha(0.3)
      .setTint(0xffd23f);

    this.glow = this.scene.add
      .sprite(cx, def.y, "glow")
      .setScale(2.4)
      .setTint(def.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setVisible(false);

    this.lights = [];
    for (let i = 0; i < 8; i++) {
      const light = this.scene.add
        .sprite(cx - 122 + i * 35, awningY - 26, "dot")
        .setScale(0.45)
        .setTint(0xffd97d)
        .setAlpha(0.15);
      this.lights.push(light);
    }

    this.liveGroup = this.scene.add.container(0, 0, [
      this.glow,
      base,
      awningBase,
      awningStripes,
      name,
      grill,
      counter,
      this.progressBar,
      pileMarker,
      ...this.lights,
    ]);
    this.liveGroup.setDepth(def.y - 200);
    this.liveGroup.setAlpha(LOCKED_ALPHA);

    const zone = this.scene.add.zone(cx, def.y, BASE_W + 20, BASE_H + 50).setInteractive();
    zone.on("pointerdown", () => this.onTapped());
  }

  private buildLockOverlay(): void {
    const { def, cx } = this;
    const shade = this.scene.add.graphics();
    shade.fillStyle(0x05060f, 0.55);
    shade.fillRoundedRect(cx - BASE_W / 2, def.y - BASE_H / 2, BASE_W, BASE_H, 14);
    const lock = this.scene.add.text(cx, def.y - 26, "🔒", { fontSize: "42px" }).setOrigin(0.5);
    const price = this.scene.add
      .text(cx, def.y + 18, `฿ ${def.unlockCost.toLocaleString()}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffd23f",
      })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(cx, def.y + 50, "TAP TO UNLOCK", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#cfd6ff",
      })
      .setOrigin(0.5);
    this.lockGroup = this.scene.add.container(0, 0, [shade, lock, price, hint]);
    this.lockGroup.setDepth(def.y + 300);
  }

  setUnlocked(animate: boolean): void {
    this.state.unlocked = true;
    this.lockGroup?.destroy();
    this.lockGroup = null;
    this.glow.setVisible(true);
    if (animate) {
      this.scene.tweens.add({ targets: this.liveGroup, alpha: 1, duration: 450 });
      const confetti = this.scene.add.particles(this.cx, this.def.y, "dot", {
        speed: { min: 120, max: 330 },
        angle: { min: 200, max: 340 },
        gravityY: 600,
        lifespan: 900,
        scale: { start: 0.6, end: 0 },
        quantity: 50,
        tint: [0xff6b35, 0xffd23f, 0x4ecdc4, 0xc77dff, 0xff70a6],
        emitting: false,
      });
      confetti.setDepth(4000);
      confetti.explode(50);
      this.scene.time.delayedCall(1400, () => confetti.destroy());
      sfx.unlock();
    } else {
      this.liveGroup.setAlpha(1);
    }
    if (!this.lightsAnimated) {
      this.lightsAnimated = true;
      this.lights.forEach((light, i) => {
        this.scene.tweens.add({
          targets: light,
          alpha: { from: 0.45, to: 1 },
          duration: 550 + i * 40,
          delay: i * 90,
          yoyo: true,
          repeat: -1,
        });
      });
    }
  }

  ensureWorker(): void {
    if (this.state.workerLvl > 0 && !this.worker) {
      this.worker = new Worker(this.scene, this);
    }
  }

  // ---------- simulation ----------

  update(dt: number): void {
    if (!this.state.unlocked) return;

    if (this.grillStock < GRILL_MAX) {
      this.cookProgress += dt;
      const need = cookMs(this.def.baseCookMs, this.state.cookLvl);
      if (this.cookProgress >= need) {
        this.cookProgress = 0;
        this.grillStock++;
        this.refreshGrill();
      }
      this.drawProgress(Math.min(1, this.cookProgress / need));
    } else {
      this.drawProgress(1);
    }

    this.serveCooldown -= dt;
    if (this.serveCooldown <= 0) this.tryServe();

    this.worker?.update();
  }

  private tryServe(): void {
    const front = this.queue[0];
    if (!front || !front.atSlot || this.counterStock <= 0) return;
    this.counterStock--;
    this.refreshCounter();
    this.addToPile(this.def.price);
    this.serveCooldown = 350;
    sfx.serve();
    front.served(360, GAME_H + 60);
    this.queue.shift();
    this.queue.forEach((c, i) => {
      c.queueIndex = i;
      c.atSlot = false;
      const slot = this.queueSlot(i);
      c.walkTo(slot.x, slot.y, 150, () => {
        c.atSlot = true;
      });
    });
  }

  join(c: Customer): number {
    if (!this.state.unlocked || this.queue.length >= QUEUE_MAX) return -1;
    this.queue.push(c);
    c.queueIndex = this.queue.length - 1;
    return c.queueIndex;
  }

  queueSlot(i: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.counterPos.x + this.dir * (60 + i * 50), this.def.y + 16);
  }

  takeFromGrill(n: number): number {
    const k = Math.min(n, this.grillStock);
    this.grillStock -= k;
    if (k > 0) this.refreshGrill();
    return k;
  }

  depositToCounter(n: number): number {
    const k = Math.min(n, COUNTER_MAX - this.counterStock);
    this.counterStock += k;
    if (k > 0) this.refreshCounter();
    return k;
  }

  addToPile(amount: number): void {
    this.pileValue += amount;
    if (this.pileCoins.length < 12) {
      const coin = this.scene.add
        .sprite(
          this.pilePos.x + Phaser.Math.Between(-14, 14),
          this.pilePos.y + Phaser.Math.Between(-8, 8) - this.pileCoins.length * 2,
          "coin",
        )
        .setDepth(this.def.y + 80)
        .setScale(0);
      this.scene.tweens.add({ targets: coin, scale: 1, duration: 160, ease: "Back.Out" });
      this.pileCoins.push(coin);
    }
  }

  /** Scoop the cash pile: coins fly toward the collector, returns the amount. */
  collectPile(towardX: number, towardY: number): number {
    const v = this.pileValue;
    this.pileValue = 0;
    for (const coin of this.pileCoins) {
      this.scene.tweens.add({
        targets: coin,
        x: towardX,
        y: towardY - 20,
        scale: 0.3,
        alpha: 0,
        duration: 220,
        onComplete: () => coin.destroy(),
      });
    }
    this.pileCoins = [];
    return v;
  }

  // ---------- stock visuals ----------

  private refreshGrill(): void {
    this.syncItems(this.grillItems, this.grillStock, (i) => ({
      x: this.grillPos.x - 14 + (i % 2) * 28,
      y: this.grillPos.y - 12 + Math.floor(i / 2) * 18,
    }));
  }

  private refreshCounter(): void {
    this.syncItems(this.counterItems, this.counterStock, (i) => ({
      x: this.counterPos.x - 28 + (i % 4) * 19,
      y: this.counterPos.y - 12 + Math.floor(i / 4) * 14,
    }));
  }

  private syncItems(
    list: Phaser.GameObjects.Sprite[],
    count: number,
    pos: (i: number) => { x: number; y: number },
  ): void {
    while (list.length > count) {
      const s = list.pop();
      s?.destroy();
    }
    while (list.length < count) {
      const i = list.length;
      const p = pos(i);
      const s = this.scene.add
        .sprite(p.x, p.y, "food")
        .setTint(this.def.foodColor)
        .setDepth(this.def.y - 100)
        .setScale(1.4);
      this.scene.tweens.add({ targets: s, scale: 1, duration: 120 });
      list.push(s);
    }
  }

  private drawProgress(p: number): void {
    const x = this.grillPos.x - 30;
    const y = this.def.y + 30;
    this.progressBar.clear();
    this.progressBar.fillStyle(0x000000, 0.5);
    this.progressBar.fillRoundedRect(x, y, 60, 8, 4);
    if (p > 0.02) {
      this.progressBar.fillStyle(p >= 1 ? 0x6ee76e : 0xffd23f, 1);
      this.progressBar.fillRoundedRect(x, y, 60 * p, 8, 4);
    }
  }
}
