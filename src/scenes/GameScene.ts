import Phaser from "phaser";
import {
  COUNTER_MAX,
  ENTRANCE,
  GAME_W,
  LANE_X,
  MAX_CUSTOMERS,
  QUEUE_MAX,
  STALLS,
  WORLD_H,
} from "../config";
import {
  CAPS,
  CARRY_COST_BASE,
  SPEED_COST_BASE,
  dailyReward,
  effectivePrice,
  moveSpeed,
  offlineEarnings,
  ratePerSecond,
  streakForToday,
  upgradeCost,
} from "../economy";
import { loadState, saveState, SaveState } from "../save";
import { sfx } from "../audio";
import { ambientFireflies, applyCameraFx, collectPunch, floatMoney } from "../fx";
import { track } from "../analytics";
import { AdProvider, MockAdProvider } from "../ads";
import { Player } from "../entities/Player";
import { Stall } from "../entities/Stall";
import { Customer } from "../entities/Customer";

/** Local calendar day as YYYY-MM-DD (for daily-streak comparisons). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NPC_TINTS = [
  0xf94144, 0xf3722c, 0xf8961e, 0xf9c74f, 0x90be6d, 0x43aa8b, 0x577590, 0xff70a6, 0x70d6ff,
];

const JOY_RADIUS = 64;

export class GameScene extends Phaser.Scene {
  state!: SaveState;
  stalls: Stall[] = [];
  readonly ads: AdProvider = new MockAdProvider();
  /** Offline ฿ granted on this load — used by the "double it" ad reward. */
  lastOfflineEarned = 0;

  player!: Player;
  private customers: Customer[] = [];
  private sessionStartMs = 0;
  private sessionStartEarned = 0;
  private earnBoostUntil = 0;
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

    this.sessionStartMs = this.time.now;
    this.sessionStartEarned = this.state.totalEarned;

    this.drawAmbient();

    for (const def of STALLS) {
      const stall = new Stall(this, def, this.state.stalls[def.id]);
      stall.setPrice(this.state.prestige);
      stall.onTapped = () => this.stallTapped(stall);
      stall.onServe = () => {
        this.state.totalServed++;
      };
      stall.onStar = (s, stars) => this.onStarEarned(s, stars);
      stall.ensureWorker();
      this.stalls.push(stall);
    }
    this.player = new Player(this, LANE_X, 480);

    this.setupInput();

    // World is taller than the viewport — follow the player down the market lane.
    this.cameras.main.setBounds(0, 0, GAME_W, WORLD_H);
    this.cameras.main.startFollow(this.player.obj, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(GAME_W, 260);

    applyCameraFx(this);
    ambientFireflies(this, 20);

    const persist = () => saveState(this.state);
    window.addEventListener("pagehide", persist);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener("pagehide", persist),
    );

    track("session_start", { prestige: this.state.prestige, money: this.state.money });
    this.grantOfflineEarnings();
    this.checkDailyStreak();

    // Sync the HUD (matters after a prestige scene restart — UIScene stays alive).
    this.events.emit("money", this.state.money);
    this.events.emit("world-reset");
    this.events.emit("state-changed");
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

    if (this.earnBoostUntil > 0 && Date.now() >= this.earnBoostUntil) {
      this.earnBoostUntil = 0;
      this.refreshPrices();
      this.events.emit("toast", "2× earnings boost ended.");
      this.events.emit("state-changed");
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
    track("upgrade", { money: this.state.money });
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
    if (n > 0) this.state.totalEarned += n;
    this.events.emit("money", this.state.money);
  }

  private stallTapped(stall: Stall): void {
    if (!stall.state.unlocked) {
      if (this.spend(stall.def.unlockCost)) {
        stall.setUnlocked(true);
        track("unlock", { stall: stall.def.id, cost: stall.def.unlockCost });
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
        p.addItem(stall.def.id, stall.def.foodTex);
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
        floatMoney(this, stall.pilePos.x, stall.pilePos.y - 10, amount);
        if (amount >= 60) collectPunch(this);
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
      WORLD_H + 30,
      Phaser.Math.RND.pick(NPC_TINTS),
    );
    this.customers.push(c);
    if (stall.join(c) < 0) {
      c.leave(ENTRANCE.x, WORLD_H + 60);
      return;
    }
    const midX = LANE_X + Phaser.Math.Between(-50, 50);
    const midY = stall.def.y + 150;
    c.walkTo(midX, midY, 165, () => {
      const slot = stall.queueSlot(c.queueIndex);
      c.walkTo(slot.x, slot.y, 165, () => c.arriveAtSlot());
    });
  }

  // ---------- setup ----------

  /** Per-stall info for the pure economy helpers, with prices already raised by stars/prestige. */
  private stallInfos() {
    return STALLS.map((def) => {
      const st = this.state.stalls[def.id];
      return {
        unlocked: st.unlocked,
        workerLvl: st.workerLvl,
        cookLvl: st.cookLvl,
        price: effectivePrice(def.price, st.stars, this.state.prestige),
        baseCookMs: def.baseCookMs,
      };
    });
  }

  /** Re-apply prestige + active boost to every stall's per-sale payout. */
  private refreshPrices(): void {
    const boost = this.earnBoostUntil > Date.now() ? 2 : 1;
    for (const s of this.stalls) {
      s.setPrice(this.state.prestige);
      s.unitPrice *= boost;
    }
  }

  private onStarEarned(stall: Stall, stars: number): void {
    this.refreshPrices();
    track("star_earned", { stall: stall.def.id, stars });
    saveState(this.state);
    this.events.emit("toast", `⭐ ${stall.def.name} hit ${stars}★ — permanent +${stars * 10}% price!`);
    this.events.emit("state-changed");
    sfx.unlock();
  }

  private grantOfflineEarnings(): void {
    const elapsed = Date.now() - (this.state.lastSeen || Date.now());
    if (elapsed < 60_000) return;
    const earned = offlineEarnings(elapsed, this.stallInfos());
    if (earned <= 0) return;
    this.lastOfflineEarned = earned;
    this.time.delayedCall(700, () => {
      this.addMoney(earned);
      sfx.coin();
      this.events.emit("offline-earned", earned);
    });
  }

  private checkDailyStreak(): void {
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const day = streakForToday(this.state.streak, this.state.lastDailyClaim, today, yesterday);
    if (day <= 0) return; // already claimed today
    const reward = dailyReward(day, ratePerSecond(this.stallInfos()));
    this.time.delayedCall(1100, () => this.events.emit("daily-available", { day, reward }));
  }

  // ---------- public API used by UIScene ----------

  claimDaily(day: number, reward: number): void {
    this.state.streak = day;
    this.state.lastDailyClaim = dayKey(new Date());
    this.addMoney(reward);
    track("daily_claim", { day, reward });
    saveState(this.state);
    this.events.emit("state-changed");
    sfx.coin();
  }

  sessionStats(): { served: number; earned: number; perMin: number; prestige: number; boostMin: number } {
    const minutes = Math.max(1 / 60, (this.time.now - this.sessionStartMs) / 60_000);
    const perMin = (this.state.totalEarned - this.sessionStartEarned) / minutes;
    return {
      served: this.state.totalServed,
      earned: this.state.totalEarned,
      perMin: Math.round(perMin),
      prestige: this.state.prestige,
      boostMin: this.earnBoostUntil > Date.now() ? Math.ceil((this.earnBoostUntil - Date.now()) / 60_000) : 0,
    };
  }

  earnBoostActive(): boolean {
    return this.earnBoostUntil > Date.now();
  }

  /** Reward: 2× earnings for 4 hours. */
  rewardEarnBoost(): void {
    this.earnBoostUntil = Date.now() + 4 * 3_600_000;
    this.refreshPrices();
    track("ad_watched", { placement: "double_earnings" });
    this.events.emit("toast", "📺 2× earnings for 4 hours!");
    this.events.emit("state-changed");
  }

  /** Reward: instantly fill every unlocked grill. */
  rewardFillGrills(): void {
    for (const s of this.stalls) {
      if (s.state.unlocked) s.fillGrill();
    }
    track("ad_watched", { placement: "instant_grill" });
    this.events.emit("toast", "📺 Grills topped up!");
    sfx.drop();
  }

  /** Reward: double the offline earnings granted this load (one-time). */
  rewardDoubleOffline(): void {
    if (this.lastOfflineEarned <= 0) return;
    const bonus = this.lastOfflineEarned;
    this.lastOfflineEarned = 0;
    this.addMoney(bonus);
    track("ad_watched", { placement: "double_offline" });
    this.events.emit("toast", `📺 Offline earnings doubled!  +฿ ${bonus.toLocaleString()}`);
    sfx.coin();
  }

  canPrestige(): boolean {
    return this.stalls.length > 0 && this.stalls.every((s) => s.state.unlocked);
  }

  /** "Move to the Floating Market": reset stalls/upgrades, keep the collection book, +25%. */
  doPrestige(): void {
    if (!this.canPrestige()) return;
    this.state.prestige++;
    this.state.money = 0;
    this.state.carryLvl = 0;
    this.state.speedLvl = 0;
    for (const def of STALLS) {
      const st = this.state.stalls[def.id];
      st.unlocked = def.unlockCost === 0;
      st.cookLvl = 0;
      st.workerLvl = 0;
      // sales + stars are intentionally kept (the collection book persists).
    }
    this.earnBoostUntil = 0;
    track("prestige", { prestige: this.state.prestige });
    saveState(this.state);
    this.scene.restart();
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;

    // scrollFactor 0 keeps the joystick pinned to the screen as the camera follows.
    this.joyBaseSpr = this.add
      .sprite(0, 0, "dot")
      .setScale(5.5)
      .setAlpha(0.12)
      .setScrollFactor(0)
      .setDepth(6000)
      .setVisible(false);
    this.joyThumbSpr = this.add
      .sprite(0, 0, "dot")
      .setScale(2.4)
      .setAlpha(0.3)
      .setScrollFactor(0)
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
    bg.fillRect(0, 0, GAME_W, WORLD_H);

    // Stars.
    for (let i = 0; i < 70; i++) {
      const star = this.add
        .sprite(Phaser.Math.Between(10, GAME_W - 10), Phaser.Math.Between(10, WORLD_H - 10), "dot")
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

    // Market lane — wooden walkway with plank seams and a centre runner.
    const laneX = LANE_X - 140;
    const laneY = 150;
    const laneW = 280;
    const laneH = WORLD_H - laneY - 30;
    const lane = this.add.graphics().setDepth(-800);
    lane.fillStyle(0x20243f, 1);
    lane.fillRoundedRect(laneX, laneY, laneW, laneH, 26);
    lane.lineStyle(2, 0x2b3157, 0.8);
    for (let y = laneY + 64; y < laneY + laneH; y += 66) {
      lane.lineBetween(laneX + 12, y, laneX + laneW - 12, y);
    }
    lane.fillStyle(0x262c52, 0.55);
    lane.fillRoundedRect(LANE_X - 72, laneY + 12, 144, laneH - 24, 20);
    lane.lineStyle(2, 0x3a4170, 1);
    lane.strokeRoundedRect(laneX, laneY, laneW, laneH, 26);

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
    // Tap the title to toggle the tuning/stats overlay.
    title.setInteractive({ useHandCursor: true });
    title.on("pointerdown", () => this.events.emit("toggle-stats"));

    // Swaying paper lanterns, each with a flickering halo.
    for (const [lx, ly] of [[96, 84], [624, 84], [150, 470], [570, 700], [150, 1110], [570, 1340]] as const) {
      const halo = this.add
        .sprite(lx, ly + 12, "glow")
        .setScale(1.1)
        .setTint(0xff6b2b)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.5)
        .setDepth(-750);
      const lantern = this.add
        .sprite(lx, ly, "lantern")
        .setOrigin(0.5, 0.08)
        .setScale(0.9)
        .setDepth(-700);
      this.tweens.add({
        targets: lantern,
        angle: { from: -6, to: 6 },
        duration: Phaser.Math.Between(1300, 1700),
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: halo,
        alpha: { from: 0.32, to: 0.62 },
        scale: { from: 1.0, to: 1.25 },
        duration: Phaser.Math.Between(700, 1100),
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
