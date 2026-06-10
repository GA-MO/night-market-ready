import Phaser from "phaser";
import { COUNTER_MAX, ENTRANCE, GAME_H, GAME_W, LANE_X, MAX_CUSTOMERS, QUEUE_MAX, STALLS } from "../config";
import {
  CAPS,
  CARRY_COST_BASE,
  SPEED_COST_BASE,
  moveSpeed,
  offlineEarnings,
  upgradeCost,
} from "../economy";
import { loadState, saveState, SaveState } from "../save";
import { sfx } from "../audio";
import { Player } from "../entities/Player";
import { Stall } from "../entities/Stall";
import { Customer } from "../entities/Customer";

const NPC_TINTS = [
  0xf94144, 0xf3722c, 0xf8961e, 0xf9c74f, 0x90be6d, 0x43aa8b, 0x577590, 0xff70a6, 0x70d6ff,
];

const JOY_RADIUS = 64;

export class GameScene extends Phaser.Scene {
  state!: SaveState;
  stalls: Stall[] = [];

  private player!: Player;
  private customers: Customer[] = [];
  private spawnAcc = 0;
  private actionAcc = 0;
  private saveAcc = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private joyActive = false;
  private joyBase = new Phaser.Math.Vector2();
  private joyVec = new Phaser.Math.Vector2();
  private joyBaseSpr!: Phaser.GameObjects.Sprite;
  private joyThumbSpr!: Phaser.GameObjects.Sprite;

  constructor() {
    super("game");
  }

  create(): void {
    this.state = loadState();
    this.stalls = [];
    this.customers = [];

    this.drawAmbient();

    for (const def of STALLS) {
      const stall = new Stall(this, def, this.state.stalls[def.id]);
      stall.onTapped = () => this.stallTapped(stall);
      stall.ensureWorker();
      this.stalls.push(stall);
    }
    this.player = new Player(this, LANE_X, 980);

    this.setupInput();

    const persist = () => saveState(this.state);
    window.addEventListener("pagehide", persist);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener("pagehide", persist),
    );

    this.grantOfflineEarnings();
  }

  update(_time: number, delta: number): void {
    const dtSec = delta / 1000;

    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    if (this.joyActive && (this.joyVec.x !== 0 || this.joyVec.y !== 0)) {
      vx = this.joyVec.x;
      vy = this.joyVec.y;
    }
    this.player.update(dtSec, vx, vy, moveSpeed(this.state.speedLvl));

    this.actionAcc += delta;
    if (this.actionAcc >= 150) {
      this.actionAcc = 0;
      this.zoneActions();
    }

    for (const stall of this.stalls) stall.update(delta);

    this.spawnAcc += delta;
    const unlocked = this.stalls.filter((s) => s.state.unlocked).length;
    const interval = Math.max(1100, 2600 - (unlocked - 1) * 500);
    if (this.spawnAcc >= interval) {
      this.spawnAcc = 0;
      this.spawnCustomer();
    }
    this.customers = this.customers.filter((c) => !c.dead);

    this.saveAcc += delta;
    if (this.saveAcc >= 4000) {
      this.saveAcc = 0;
      saveState(this.state);
    }
  }

  // ---------- economy actions (called from UIScene) ----------

  buyCarry(): void {
    if (this.state.carryLvl >= CAPS.carry) return;
    if (!this.spend(upgradeCost(CARRY_COST_BASE, this.state.carryLvl))) return;
    this.state.carryLvl++;
    this.afterPurchase();
  }

  buySpeed(): void {
    if (this.state.speedLvl >= CAPS.speed) return;
    if (!this.spend(upgradeCost(SPEED_COST_BASE, this.state.speedLvl))) return;
    this.state.speedLvl++;
    this.afterPurchase();
  }

  buyCook(stall: Stall): void {
    if (stall.state.cookLvl >= CAPS.cook) return;
    if (!this.spend(upgradeCost(stall.def.cookCostBase, stall.state.cookLvl))) return;
    stall.state.cookLvl++;
    this.afterPurchase();
  }

  buyWorker(stall: Stall): void {
    if (stall.state.workerLvl >= CAPS.worker) return;
    if (!this.spend(upgradeCost(stall.def.workerCostBase, stall.state.workerLvl))) return;
    stall.state.workerLvl++;
    stall.ensureWorker();
    this.afterPurchase();
  }

  private afterPurchase(): void {
    sfx.upgrade();
    saveState(this.state);
    this.events.emit("state-changed");
  }

  private spend(cost: number): boolean {
    if (this.state.money < cost) {
      sfx.deny();
      return false;
    }
    this.state.money -= cost;
    this.events.emit("money", this.state.money);
    return true;
  }

  private addMoney(n: number): void {
    this.state.money += n;
    this.events.emit("money", this.state.money);
  }

  private stallTapped(stall: Stall): void {
    if (!stall.state.unlocked) {
      if (this.spend(stall.def.unlockCost)) {
        stall.setUnlocked(true);
        saveState(this.state);
        this.events.emit("state-changed");
        if (this.stalls.every((s) => s.state.unlocked)) {
          this.events.emit("celebrate");
        }
      } else {
        this.events.emit("toast", `Need ฿ ${stall.def.unlockCost.toLocaleString()} to open ${stall.def.name}!`);
      }
      return;
    }
    this.events.emit("stall-tapped", stall);
  }

  // ---------- per-tick interactions ----------

  private zoneActions(): void {
    const p = this.player;
    for (const stall of this.stalls) {
      if (!stall.state.unlocked) continue;

      if (
        Phaser.Math.Distance.Between(p.x, p.y, stall.grillPos.x, stall.grillPos.y) < 64 &&
        stall.grillStock > 0 &&
        p.room(this.state.carryLvl) > 0
      ) {
        stall.takeFromGrill(1);
        p.addItem(stall.def.id, stall.def.foodColor);
        sfx.pickup();
      }

      if (
        Phaser.Math.Distance.Between(p.x, p.y, stall.counterPos.x, stall.counterPos.y) < 64 &&
        stall.counterStock < COUNTER_MAX &&
        p.takeFor(stall.def.id, 1) > 0
      ) {
        stall.depositToCounter(1);
        sfx.drop();
      }

      if (
        stall.pileValue > 0 &&
        Phaser.Math.Distance.Between(p.x, p.y, stall.pilePos.x, stall.pilePos.y) < 60
      ) {
        const amount = stall.collectPile(p.x, p.y);
        this.addMoney(amount);
        sfx.coin();
      }
    }
  }

  private spawnCustomer(): void {
    if (this.customers.length >= MAX_CUSTOMERS) return;
    const open = this.stalls.filter((s) => s.state.unlocked && s.queue.length < QUEUE_MAX);
    if (open.length === 0) return;
    const shortest = Math.min(...open.map((s) => s.queue.length));
    const stall = Phaser.Math.RND.pick(open.filter((s) => s.queue.length === shortest));

    const c = new Customer(
      this,
      ENTRANCE.x + Phaser.Math.Between(-40, 40),
      GAME_H + 30,
      Phaser.Math.RND.pick(NPC_TINTS),
    );
    this.customers.push(c);
    if (stall.join(c) < 0) {
      c.leave(ENTRANCE.x, GAME_H + 60);
      return;
    }
    const midX = LANE_X + Phaser.Math.Between(-50, 50);
    const midY = stall.def.y + 150;
    c.walkTo(midX, midY, 165, () => {
      const slot = stall.queueSlot(c.queueIndex);
      c.walkTo(slot.x, slot.y, 165, () => {
        c.atSlot = true;
      });
    });
  }

  // ---------- setup ----------

  private grantOfflineEarnings(): void {
    const elapsed = Date.now() - (this.state.lastSeen || Date.now());
    if (elapsed < 60_000) return;
    const earned = offlineEarnings(
      elapsed,
      STALLS.map((def) => ({
        unlocked: this.state.stalls[def.id].unlocked,
        workerLvl: this.state.stalls[def.id].workerLvl,
        cookLvl: this.state.stalls[def.id].cookLvl,
        price: def.price,
        baseCookMs: def.baseCookMs,
      })),
    );
    if (earned <= 0) return;
    this.time.delayedCall(700, () => {
      this.addMoney(earned);
      this.events.emit("toast", `Your helpers kept selling!  +฿ ${earned.toLocaleString()}`);
      sfx.coin();
    });
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;

    this.joyBaseSpr = this.add
      .sprite(0, 0, "dot")
      .setScale(5.5)
      .setAlpha(0.12)
      .setDepth(6000)
      .setVisible(false);
    this.joyThumbSpr = this.add
      .sprite(0, 0, "dot")
      .setScale(2.4)
      .setAlpha(0.3)
      .setDepth(6001)
      .setVisible(false);

    this.input.once("pointerdown", () => sfx.unlockAudio());

    this.input.on(
      "pointerdown",
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length > 0) return;
        const ui = this.scene.get("ui");
        if (ui && ui.input.hitTestPointer(p).length > 0) return;
        this.joyActive = true;
        this.joyBase.set(p.x, p.y);
        this.joyVec.set(0, 0);
        this.joyBaseSpr.setPosition(p.x, p.y).setVisible(true);
        this.joyThumbSpr.setPosition(p.x, p.y).setVisible(true);
      },
    );
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.joyActive || !p.isDown) return;
      const dx = p.x - this.joyBase.x;
      const dy = p.y - this.joyBase.y;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        const m = Math.min(d, JOY_RADIUS);
        this.joyVec.set((dx / d) * (m / JOY_RADIUS), (dy / d) * (m / JOY_RADIUS));
        this.joyThumbSpr.setPosition(this.joyBase.x + (dx / d) * m, this.joyBase.y + (dy / d) * m);
      } else {
        this.joyVec.set(0, 0);
      }
    });
    const endJoy = () => {
      this.joyActive = false;
      this.joyVec.set(0, 0);
      this.joyBaseSpr.setVisible(false);
      this.joyThumbSpr.setVisible(false);
    };
    this.input.on("pointerup", endJoy);
    this.input.on("pointerupoutside", endJoy);
  }

  private drawAmbient(): void {
    const bg = this.add.graphics().setDepth(-1000);
    bg.fillGradientStyle(0x0a0c20, 0x0a0c20, 0x161d3c, 0x161d3c, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);

    // Stars.
    for (let i = 0; i < 50; i++) {
      const star = this.add
        .sprite(Phaser.Math.Between(10, GAME_W - 10), Phaser.Math.Between(10, GAME_H - 10), "dot")
        .setScale(Phaser.Math.FloatBetween(0.1, 0.22))
        .setAlpha(Phaser.Math.FloatBetween(0.08, 0.35))
        .setDepth(-900);
      this.tweens.add({
        targets: star,
        alpha: 0.05,
        duration: Phaser.Math.Between(900, 2200),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
    }

    // Market lane.
    const lane = this.add.graphics().setDepth(-800);
    lane.fillStyle(0x232746, 1);
    lane.fillRoundedRect(LANE_X - 130, 150, 260, GAME_H - 180, 26);
    lane.lineStyle(2, 0x33395f, 1);
    lane.strokeRoundedRect(LANE_X - 130, 150, 260, GAME_H - 180, 26);

    // Title arch.
    const title = this.add
      .text(LANE_X, 122, "NIGHT MARKET", {
        fontFamily: "Arial, sans-serif",
        fontSize: "44px",
        fontStyle: "bold",
        color: "#ffd23f",
        stroke: "#311b00",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(-700);
    this.add
      .text(LANE_X, 160, "~ READY! ~", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        color: "#cfd6ff",
      })
      .setOrigin(0.5)
      .setDepth(-700);
    this.add
      .sprite(LANE_X, 124, "glow")
      .setScale(2.6, 1.4)
      .setTint(0xffb703)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setDepth(-750);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1600, yoyo: true, repeat: -1 });

    // Swaying lanterns.
    for (const lx of [120, 600]) {
      const lantern = this.add.text(lx, 88, "🏮", { fontSize: "40px" }).setOrigin(0.5).setDepth(-700);
      this.add
        .sprite(lx, 92, "glow")
        .setScale(1)
        .setTint(0xff5714)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.55)
        .setDepth(-750);
      this.tweens.add({
        targets: lantern,
        angle: { from: -7, to: 7 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }

    // Entrance marker at the bottom of the lane.
    this.add
      .text(LANE_X, ENTRANCE.y, "⬆ customers ⬆", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#7d87b8",
      })
      .setOrigin(0.5)
      .setDepth(-700);
  }
}
