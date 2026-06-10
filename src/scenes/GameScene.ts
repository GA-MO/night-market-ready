import Phaser from "phaser";
import {
  CAT_GAP_MAX_MS,
  CAT_GAP_MIN_MS,
  CAT_MAX_REWARD,
  CAT_MIN_REWARD,
  CAT_REWARD_SEC,
  COMBO_WINDOW_MS,
  CRITIC_CHANCE,
  ENTRANCE,
  FRENZY_COMBO,
  FRENZY_COOLDOWN_MS,
  FRENZY_MS,
  FRENZY_MULT,
  GAME_W,
  LANE_X,
  MAX_CUSTOMERS,
  QUEUE_MAX,
  REVIEW_MS,
  REVIEW_MULT,
  RUSH_DURATION_MS,
  RUSH_GAP_MAX_MS,
  RUSH_GAP_MIN_MS,
  RUSH_MULT,
  RUSH_SPAWN_MS,
  STALLS,
  VIP_CHANCE,
  WORLD_H,
} from "../config";
import {
  CAPS,
  CARRY_COST_BASE,
  Goal,
  SPEED_COST_BASE,
  carryCap,
  comboMultiplier,
  dailyReward,
  effectivePrice,
  goalForIndex,
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
import { Stall } from "../entities/Stall";
import { Customer } from "../entities/Customer";

/** Local calendar day as YYYY-MM-DD (for daily-streak comparisons). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NPC_TINTS = [
  0xf94144, 0xf3722c, 0xf8961e, 0xf9c74f, 0x90be6d, 0x43aa8b, 0x577590, 0xff70a6, 0x70d6ff,
];

/** Browsable map zoom (stalls big & readable) vs. a single focused stall filling the screen. */
const MAP_ZOOM = 1;
const FOCUS_ZOOM = 1.5;
const CAM_TWEEN_MS = 360;
/** A press that moves more than this many screen px counts as a scroll, not a tap. */
const DRAG_TAP = 12;
/** Per-frame velocity decay for flick-scrolling the map (1 = no friction). */
const SCROLL_FRICTION = 0.9;
/** Downward swipe (screen px) inside a focused stall that pops back to the map. */
const SWIPE_BACK = 110;

export class GameScene extends Phaser.Scene {
  state!: SaveState;
  stalls: Stall[] = [];
  readonly ads: AdProvider = new MockAdProvider();
  /** Offline ฿ granted on this load — used by the "double it" ad reward. */
  lastOfflineEarned = 0;
  /** The stall the camera is zoomed into, or null in the market overview. */
  focusStall: Stall | null = null;

  private customers: Customer[] = [];
  private sessionStartMs = 0;
  private sessionStartEarned = 0;
  private earnBoostUntil = 0;
  private spawnAcc = 0;
  private saveAcc = 0;

  // Serve-combo state (manual serving on a streak pays a rising multiplier).
  private combo = 0;
  private lastServeMs = -99999;
  /** Scene-time when the current Frenzy burns out (0 = not frenzied). */
  private frenzyUntilMs = 0;
  /** Scene-time when Frenzy may ignite again (cooldown keeps it a climax). */
  private frenzyReadyAt = 0;

  // Tour-bus rush hour: a timed crowd surge onto one stall with boosted payouts.
  private nextRushAt = 0;
  private rushStall: Stall | null = null;
  private rushEndMs = 0;

  // Lucky cat stroll + rotating session goal.
  private nextCatAt = 0;
  private cat: Phaser.GameObjects.Text | null = null;
  /** Highest combo reached since the current goal started (for "combo" goals). */
  private bestComboThisGoal = 0;

  // Map drag-scroll state.
  private dragging = false;
  /** True once the current press moved far enough to be a scroll (suppresses the tap). */
  private pointerDragged = false;
  private lastDragY = 0;
  private scrollVel = 0;
  /** Map scroll position remembered while focused, so Back returns you where you were. */
  private mapScrollY = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.state = loadState();
    this.stalls = [];
    this.customers = [];
    this.focusStall = null;
    // Event state must reset on a prestige scene.restart() — the instance survives.
    this.combo = 0;
    this.frenzyUntilMs = 0;
    this.frenzyReadyAt = 0;
    this.rushStall = null;
    this.rushEndMs = 0;
    this.cat = null;
    this.bestComboThisGoal = 0;

    this.sessionStartMs = this.time.now;
    this.sessionStartEarned = this.state.totalEarned;

    this.drawAmbient();

    for (const def of STALLS) {
      const stall = new Stall(this, def, this.state.stalls[def.id]);
      stall.setPrice(this.state.prestige);
      stall.serviceLvl = this.state.speedLvl;
      // Ignore the tap if the press was a scroll/flick (the player was browsing).
      stall.onTapped = () => {
        if (!this.pointerDragged) this.stallTapped(stall);
      };
      // Diegetic actions inside a focused stall: tap the station / counter / cash directly.
      stall.onGrillTap = () => this.cookFocus();
      stall.onCounterTap = () => this.serveFocus();
      stall.onPileTap = () => this.collectFocus();
      stall.onServe = () => {
        this.state.totalServed++;
      };
      stall.onStar = (s, stars) => this.onStarEarned(s, stars);
      stall.onReview = (s) => this.onRaveReview(s);
      stall.ensureWorker();
      this.stalls.push(stall);
    }

    // A browsable map: drag to scroll the lane, tap a stall to zoom in and manage it.
    // No follow target and no roaming player — you manage one stall at a time.
    this.cameras.main.setBounds(0, 0, GAME_W, WORLD_H);
    this.cameras.main.setZoom(MAP_ZOOM);
    this.cameras.main.setScroll(0, 0);
    for (const s of this.stalls) s.setMapMode(true);

    applyCameraFx(this);
    ambientFireflies(this, 12);

    this.setupInput();

    const persist = () => saveState(this.state);
    window.addEventListener("pagehide", persist);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener("pagehide", persist),
    );

    track("session_start", { prestige: this.state.prestige, money: this.state.money });
    this.grantOfflineEarnings();
    this.checkDailyStreak();
    this.startTutorial();
    this.ensureGoal();
    this.nextRushAt = this.time.now + Phaser.Math.Between(RUSH_GAP_MIN_MS, RUSH_GAP_MAX_MS);
    this.nextCatAt = this.time.now + Phaser.Math.Between(CAT_GAP_MIN_MS, CAT_GAP_MAX_MS);

    // Sync the HUD (matters after a prestige scene restart — UIScene stays alive).
    this.events.emit("money", this.state.money);
    this.events.emit("world-reset");
    this.events.emit("state-changed");
  }

  update(_time: number, delta: number): void {
    // Flick-scroll inertia on the map (skipped while focused or actively dragging).
    if (!this.focusStall && !this.dragging && Math.abs(this.scrollVel) > 0.2) {
      this.cameras.main.scrollY += this.scrollVel;
      this.scrollVel *= SCROLL_FRICTION;
    }

    // Serve combo decays if you stop serving (paused during Frenzy — it's a celebration).
    if (this.frenzyUntilMs === 0 && this.combo > 0 && this.time.now - this.lastServeMs >= COMBO_WINDOW_MS) {
      this.combo = 0;
      this.events.emit("combo", 0, 1);
    }
    if (this.frenzyUntilMs > 0 && this.time.now >= this.frenzyUntilMs) this.endFrenzy();

    // Tour-bus rush lifecycle.
    if (this.rushStall) {
      if (this.time.now >= this.rushEndMs) this.endRush();
    } else if (
      this.state.tutorialDone &&
      this.time.now >= this.nextRushAt &&
      this.stalls.some((s) => s.state.unlocked)
    ) {
      this.startRush();
    }

    // A lucky cat occasionally strolls across the screen (map AND focus — playtest
    // showed engaged players never leave focus, so a map-only cat never appeared).
    if (!this.cat && this.time.now >= this.nextCatAt) this.spawnCat();

    this.tickGoal();

    for (const stall of this.stalls) stall.update(delta);

    this.spawnAcc += delta;
    const unlocked = this.stalls.filter((s) => s.state.unlocked).length;
    let interval = Math.max(1100, 2600 - (unlocked - 1) * 500);
    // A focused stall draws a steady crowd so you can chain serve-combos.
    if (this.focusStall) interval = Math.min(interval, 750);
    if (this.rushStall) interval = Math.min(interval, RUSH_SPAWN_MS);
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
    for (const s of this.stalls) s.serviceLvl = this.state.speedLvl;
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

  // ---------- focus mode ----------

  private stallTapped(stall: Stall): void {
    if (!stall.state.unlocked) {
      if (this.spend(stall.def.unlockCost)) {
        stall.setUnlocked(true);
        stall.serviceLvl = this.state.speedLvl;
        track("unlock", { stall: stall.def.id, cost: stall.def.unlockCost });
        saveState(this.state);
        this.events.emit("state-changed");
        if (this.stalls.every((s) => s.state.unlocked)) {
          this.events.emit("celebrate");
        }
        this.enterFocus(stall);
      } else {
        this.events.emit("toast", `Need ฿ ${stall.def.unlockCost.toLocaleString()} to open ${stall.def.name}!`);
      }
      return;
    }
    this.enterFocus(stall);
  }

  /** Zoom the camera into a stall and dim the rest; opens its control panel in the UI. */
  enterFocus(stall: Stall): void {
    this.mapScrollY = this.cameras.main.scrollY;
    this.scrollVel = 0;
    this.focusStall = stall;
    if (this.cat) this.dismissCat();
    for (const s of this.stalls) {
      s.setFocusDim(s !== stall);
      s.setMapMode(false);
      s.setFocused(s === stall);
    }
    const cam = this.cameras.main;
    // Centre on the stall's own action area (station + counter + the queue that extends
    // toward the lane), not the lane centre — otherwise a side stall gets cut off. Frame
    // it in the upper screen so the slim control bar below never covers it.
    cam.pan(stall.cx + stall.dir * 80, stall.def.y + 150, CAM_TWEEN_MS, "Sine.easeInOut");
    cam.zoomTo(FOCUS_ZOOM, CAM_TWEEN_MS, "Sine.easeInOut");
    this.events.emit("focus-enter", stall);
    if (!this.state.tutorialDone) {
      this.events.emit("toast", "Tap the grill to cook 🍳 · counter to serve 🍽️ · cash to collect 💰");
    }
  }

  /** Return to the browsable map, restoring the scroll position you left from. */
  exitFocus(): void {
    if (!this.focusStall) return;
    this.focusStall = null;
    for (const s of this.stalls) {
      s.setFocusDim(false);
      s.setFocused(false);
      s.setMapMode(true);
    }
    const cam = this.cameras.main;
    cam.zoomTo(MAP_ZOOM, CAM_TWEEN_MS, "Sine.easeInOut");
    cam.pan(GAME_W / 2, this.mapScrollY + cam.height / MAP_ZOOM / 2, CAM_TWEEN_MS, "Sine.easeInOut");
    this.events.emit("focus-exit");
  }

  /** Manual cook: tap to fry one more skewer onto the grill (on top of the idle timer). */
  cookFocus(): void {
    const s = this.focusStall;
    if (!s) return;
    if (s.cookTap()) sfx.pickup();
    else sfx.deny();
  }

  /** Manual serve: serve a tray of waiting customers on a combo for bonus ฿. */
  serveFocus(): void {
    const s = this.focusStall;
    if (!s) return;
    const frenzied = this.frenzyUntilMs > 0;
    const onStreak = frenzied || this.time.now - this.lastServeMs < COMBO_WINDOW_MS;
    const streak = onStreak ? this.combo : 0;
    // During Frenzy every plate pays a flat ×FRENZY_MULT instead of the combo curve.
    const mult = frenzied ? FRENZY_MULT : comboMultiplier(streak);
    const before = s.pileValue;
    const served = s.serveManual(carryCap(this.state.carryLvl), mult);
    if (served <= 0) {
      // Empty tap (queue briefly drained) — keep the combo alive; it only decays after
      // COMBO_WINDOW_MS of no successful serve (handled in update()).
      sfx.deny();
      return;
    }
    const gross = Math.round(s.pileValue - before);
    this.combo = streak + served; // each customer served extends the combo
    this.bestComboThisGoal = Math.max(this.bestComboThisGoal, this.combo);
    this.lastServeMs = this.time.now;
    floatMoney(this, s.counterPos.x, s.counterPos.y - 18, gross);
    if (gross >= 60) collectPunch(this);
    sfx.comboTick(this.combo);
    this.tutorialHint();
    this.events.emit("combo", this.combo, frenzied ? FRENZY_MULT : comboMultiplier(this.combo));
    if (!frenzied && this.combo >= FRENZY_COMBO && this.time.now >= this.frenzyReadyAt) {
      this.startFrenzy();
    }
  }

  /** False while the post-frenzy cooldown is running (the HUD meter greys out). */
  frenzyReady(): boolean {
    return this.time.now >= this.frenzyReadyAt;
  }

  /** Manual collect: scoop the focused stall's cash pile. */
  collectFocus(): void {
    const s = this.focusStall;
    if (!s || s.pileValue <= 0) {
      sfx.deny();
      return;
    }
    const amount = s.collectPile(s.pilePos.x, s.pilePos.y - 40);
    this.addMoney(amount);
    floatMoney(this, s.pilePos.x, s.pilePos.y - 10, amount);
    if (amount >= 60) collectPunch(this);
    sfx.coin();
  }

  // ---------- frenzy ----------

  /** Combo hit FRENZY_COMBO: short burst where every manual plate pays ×FRENZY_MULT. */
  private startFrenzy(): void {
    this.frenzyUntilMs = this.time.now + FRENZY_MS;
    this.cameras.main.flash(280, 255, 200, 60, false);
    collectPunch(this, 0.006);
    sfx.frenzy();
    track("frenzy", { stall: this.focusStall?.def.id });
    this.events.emit("frenzy", true, FRENZY_MS);
  }

  private endFrenzy(): void {
    this.frenzyUntilMs = 0;
    this.frenzyReadyAt = this.time.now + FRENZY_COOLDOWN_MS;
    this.combo = 0;
    this.events.emit("combo", 0, 1);
    this.events.emit("frenzy", false, 0);
    this.events.emit("toast", "Frenzy over — the wok needs a minute to recharge!");
  }

  // ---------- tour-bus rush hour ----------

  /** A tour bus floods one stall (the focused one if any) with ×RUSH_MULT customers. */
  private startRush(): void {
    const open = this.stalls.filter((s) => s.state.unlocked);
    if (open.length === 0) return;
    const stall = this.focusStall ?? Phaser.Math.RND.pick(open);
    this.rushStall = stall;
    this.rushEndMs = this.time.now + RUSH_DURATION_MS;
    stall.rushUntil = Date.now() + RUSH_DURATION_MS;
    sfx.rush();
    track("rush_start", { stall: stall.def.id });
    this.events.emit("rush", stall, RUSH_DURATION_MS);
    this.events.emit("toast", `🚌 Tour bus! ${stall.def.emoji} ${stall.def.name} pays ×${RUSH_MULT} — serve fast!`);
  }

  private endRush(): void {
    if (this.rushStall) this.rushStall.rushUntil = 0;
    this.rushStall = null;
    this.nextRushAt = this.time.now + Phaser.Math.Between(RUSH_GAP_MIN_MS, RUSH_GAP_MAX_MS);
    this.events.emit("rush-end");
  }

  // ---------- lucky cat ----------

  /** A lucky cat strolls across the visible screen; tap it for a pile of ฿. */
  private spawnCat(): void {
    const cam = this.cameras.main;
    const fromLeft = Phaser.Math.RND.frac() < 0.5;
    // In focus the upper frame (above the stall sign) is the only clear strip — the cat
    // crosses there so it never sits over the grill/counter/cash tap zones.
    const y = this.focusStall
      ? this.focusStall.def.y - 230 + Phaser.Math.Between(-20, 20)
      : Phaser.Math.Clamp(cam.scrollY + Phaser.Math.Between(380, 900), 260, WORLD_H - 160);
    const cat = this.add
      .text(fromLeft ? -40 : GAME_W + 40, y, "🐈", { fontSize: "46px" })
      .setOrigin(0.5)
      .setDepth(7000)
      .setInteractive({ useHandCursor: true });
    if (!fromLeft) cat.setFlipX(true);
    this.cat = cat;
    this.tweens.add({ targets: cat, y: y - 14, duration: 320, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({
      targets: cat,
      x: fromLeft ? GAME_W + 40 : -40,
      duration: 7000,
      onComplete: () => this.dismissCat(),
    });
    cat.once("pointerdown", () => {
      const reward = Phaser.Math.Clamp(
        Math.floor(ratePerSecond(this.stallInfos()) * CAT_REWARD_SEC),
        CAT_MIN_REWARD,
        CAT_MAX_REWARD,
      );
      this.addMoney(reward);
      floatMoney(this, cat.x, cat.y - 30, reward);
      collectPunch(this);
      sfx.meow();
      sfx.coin();
      track("cat_collect", { reward });
      this.events.emit("toast", "🐈 Lucky cat! Fortune smiles on you.");
      this.dismissCat();
    });
  }

  private dismissCat(): void {
    if (!this.cat) return;
    this.tweens.killTweensOf(this.cat);
    this.cat.destroy();
    this.cat = null;
    this.nextCatAt = this.time.now + Phaser.Math.Between(CAT_GAP_MIN_MS, CAT_GAP_MAX_MS);
  }

  // ---------- food critic ----------

  private onRaveReview(stall: Stall): void {
    sfx.star();
    collectPunch(this);
    track("critic_review", { stall: stall.def.id });
    this.events.emit("toast", `📰 RAVE REVIEW! ${stall.def.name} pays ×${REVIEW_MULT} for ${REVIEW_MS / 1000}s!`);
  }

  // ---------- rotating session goals ----------

  /** The in-flight goal plus live progress, for the HUD card (null only before first init). */
  goalInfo(): { kind: Goal["kind"]; target: number; reward: number; progress: number } | null {
    const g = this.state.goal;
    if (!g) return null;
    return { ...g, progress: Math.min(this.goalProgress(g), g.target) };
  }

  private ensureGoal(): void {
    if (this.state.goal) return;
    this.state.goal = goalForIndex(this.state.goalIdx, ratePerSecond(this.stallInfos()));
    this.state.goalBase = this.state.goal.kind === "earn" ? this.state.totalEarned : this.state.totalServed;
  }

  private goalProgress(g: Goal): number {
    if (g.kind === "serve") return this.state.totalServed - this.state.goalBase;
    if (g.kind === "earn") return Math.round(this.state.totalEarned - this.state.goalBase);
    return this.bestComboThisGoal;
  }

  private tickGoal(): void {
    const g = this.state.goal;
    if (!g) return;
    if (this.goalProgress(g) < g.target) return;
    this.addMoney(g.reward);
    sfx.star();
    track("goal_complete", { idx: this.state.goalIdx, kind: g.kind });
    this.events.emit("toast", `🎯 Goal complete!  +฿ ${g.reward.toLocaleString()}`);
    this.state.goalIdx++;
    this.state.goal = null;
    this.bestComboThisGoal = 0;
    this.ensureGoal();
    saveState(this.state);
    this.events.emit("goal-done");
  }

  // ---------- spawning ----------

  private spawnCustomer(): void {
    if (this.customers.length >= MAX_CUSTOMERS) return;
    const open = this.stalls.filter((s) => s.state.unlocked && s.queue.length < QUEUE_MAX);
    if (open.length === 0) return;
    // During a rush the tour bus floods one stall; otherwise most customers head for
    // the stall you're actively running and the rest fill the shortest queue elsewhere.
    let stall: Stall;
    const focus = this.focusStall;
    const rush = this.rushStall;
    if (rush && rush.queue.length < QUEUE_MAX && Phaser.Math.RND.frac() < 0.85) {
      stall = rush;
    } else if (focus && focus.state.unlocked && focus.queue.length < QUEUE_MAX && Phaser.Math.RND.frac() < 0.8) {
      stall = focus;
    } else {
      const shortest = Math.min(...open.map((s) => s.queue.length));
      stall = Phaser.Math.RND.pick(open.filter((s) => s.queue.length === shortest));
    }

    // Customers for the focused (or rushed) stall appear just below it so they reach the
    // counter in ~1.5s and a real queue forms to combo-serve; everyone else walks up the
    // lane from the entrance as usual.
    const near = stall === this.focusStall || stall === this.rushStall;
    const spawnX = (near ? LANE_X : ENTRANCE.x) + Phaser.Math.Between(-40, 40);
    const spawnY = near ? stall.def.y + 440 : WORLD_H + 30;
    const c = new Customer(this, spawnX, spawnY, Phaser.Math.RND.pick(NPC_TINTS));
    const roll = Phaser.Math.RND.frac();
    if (roll < VIP_CHANCE) c.makeVip();
    else if (roll < VIP_CHANCE + CRITIC_CHANCE) c.makeCritic();
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
    sfx.star();
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
    sfx.prestige();
    saveState(this.state);
    this.scene.restart();
  }

  // ---------- onboarding ----------

  private startTutorial(): void {
    if (this.state.tutorialDone || this.state.prestige > 0) return;
    this.events.emit("toast", "👆 Tap a stall to manage it!");
  }

  /** Mark the loop learned the first time the player serves. */
  private tutorialHint(): void {
    if (this.state.tutorialDone) return;
    this.state.tutorialDone = true;
    saveState(this.state);
    this.events.emit("toast", "Nice! Serve customers, then tap 💰 to collect.");
  }

  private setupInput(): void {
    this.input.once("pointerdown", () => sfx.unlockAudio());
    // Back / Escape leaves the focused stall (handy on desktop).
    this.input.keyboard?.on("keydown-ESC", () => this.exitFocus());

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const ui = this.scene.get("ui");
      if (ui && ui.input.hitTestPointer(p).length > 0) return; // never drag from the HUD
      this.dragging = true;
      this.pointerDragged = false;
      this.lastDragY = p.y;
      this.scrollVel = 0;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      if (Math.abs(p.y - p.downY) > DRAG_TAP || Math.abs(p.x - p.downX) > DRAG_TAP) {
        this.pointerDragged = true;
      }
      const dy = p.y - this.lastDragY;
      this.lastDragY = p.y;
      if (this.focusStall) return; // no scrolling while focused (swipe-down exits on release)
      const cam = this.cameras.main;
      cam.scrollY -= dy / cam.zoom; // content follows the finger; bounds clamp it
      this.scrollVel = -dy / cam.zoom;
    });

    const end = (p: Phaser.Input.Pointer) => {
      // A clear downward swipe inside a focused stall pops back to the map.
      if (this.dragging && this.focusStall && this.pointerDragged) {
        if (p.y - p.downY > SWIPE_BACK && Math.abs(p.x - p.downX) < 90) this.exitFocus();
      }
      this.dragging = false;
    };
    this.input.on("pointerup", end);
    this.input.on("pointerupoutside", end);
  }

  private drawAmbient(): void {
    const bg = this.add.graphics().setDepth(-1000);
    bg.fillGradientStyle(0x0a0c20, 0x0a0c20, 0x161d3c, 0x161d3c, 1);
    bg.fillRect(0, 0, GAME_W, WORLD_H);

    // Stars.
    for (let i = 0; i < 40; i++) {
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
    // Tap (not scroll) the title to toggle the tuning/stats overlay.
    title.setInteractive({ useHandCursor: true });
    title.on("pointerup", () => {
      if (!this.pointerDragged) this.events.emit("toggle-stats");
    });

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
