import Phaser from "phaser";
import {
  BASE_AUTOPLATE_MS,
  COUNTER_MAX,
  GAME_W,
  GRILL_MAX,
  QUEUE_MAX,
  REVIEW_MS,
  REVIEW_MULT,
  RUSH_MULT,
  StallDef,
  VIP_MULT,
  WORLD_H,
} from "../config";
import { cookMs, effectivePrice, starsFromSales } from "../economy";
import type { StallState } from "../save";
import { sfx } from "../audio";
import { grillFire, lostSaleSting, makeSparkles, steamPlume } from "../fx";
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
  /** Per-sale payout after stars + prestige; refreshed via {@link setPrice}. */
  unitPrice: number;
  /** Global "service" upgrade level (formerly move-speed) — shortens the serve cooldown. */
  serviceLvl = 0;
  onTapped: () => void = () => {};
  onServe: () => void = () => {};
  onStar: (stall: Stall, stars: number) => void = () => {};
  /** Focus-mode diegetic taps: on the grill (cook), counter (serve), cash pile (collect). */
  onGrillTap: () => void = () => {};
  onCounterTap: () => void = () => {};
  onPileTap: () => void = () => {};
  /** Fired when a food critic is served in time (rave review earned). */
  onReview: (stall: Stall) => void = () => {};

  /** Wall-clock timestamps while a payout buff is live (rave review / tour-bus rush). */
  reviewUntil = 0;
  rushUntil = 0;

  private worker: Worker | null = null;
  private cookProgress = 0;
  private serveCooldown = 0;
  private autoPlateAcc = 0;
  private grillItems: Phaser.GameObjects.Sprite[] = [];
  private counterItems: Phaser.GameObjects.Sprite[] = [];
  private pileCoins: Phaser.GameObjects.Sprite[] = [];
  private liveGroup!: Phaser.GameObjects.Container;
  private lockGroup: Phaser.GameObjects.Container | null = null;
  private progressBar!: Phaser.GameObjects.Graphics;
  /** Last drawn cook-progress fraction; skips the per-frame graphics redraw when unchanged. */
  private lastProgress = -1;
  private pileMarker!: Phaser.GameObjects.Sprite;
  private lights: Phaser.GameObjects.Sprite[] = [];
  private glow!: Phaser.GameObjects.Sprite;
  private lightsAnimated = false;
  private fire: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private sparkles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Floating "cash ready" badge shown on the map overview (hidden while focused). */
  private mapBadge!: Phaser.GameObjects.Text;
  private mapMode = true;
  private focused = false;
  private lastBadgePile = -1;
  /** Whole-stall tap zone (enters focus on the map) + diegetic action zones (in focus). */
  private tapZone!: Phaser.GameObjects.Zone;
  private grillZone!: Phaser.GameObjects.Zone;
  private counterZone!: Phaser.GameObjects.Zone;
  private pileZone!: Phaser.GameObjects.Zone;
  private grillSprite!: Phaser.GameObjects.Sprite;
  private counterSprite!: Phaser.GameObjects.Sprite;
  private hintCollect!: Phaser.GameObjects.Text;
  /** Pulsing "×N boost" badge shown while a review/rush buff is live. */
  private buffBadge!: Phaser.GameObjects.Text;
  private lastBuffText = "";

  /** Lost-sale signal for GameScene to play feedback (read + cleared each frame). */
  lostSales = 0;

  constructor(
    private scene: Phaser.Scene,
    def: StallDef,
    state: StallState,
  ) {
    this.def = def;
    this.state = state;
    this.unitPrice = effectivePrice(def.price, state.stars, 0);
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
    // colour-tinted top band so the stall body reads its identity colour, not just the awning
    base.fillStyle(def.color, 0.16);
    base.fillRoundedRect(cx - BASE_W / 2, def.y - BASE_H / 2, BASE_W, 46, { tl: 14, tr: 14, bl: 0, br: 0 });
    base.lineStyle(3, def.color, 0.85);
    base.strokeRoundedRect(cx - BASE_W / 2, def.y - BASE_H / 2, BASE_W, BASE_H, 14);

    const awningY = def.y - BASE_H / 2 - 14;
    const awningBase = this.scene.add.sprite(cx, awningY, "awning_base").setTint(0xf4f1ea);
    const awningStripes = this.scene.add.sprite(cx, awningY, "awning_stripes").setTint(def.color);

    // Hanging sign board tucked just under the awning — kept high so the taller
    // cooking stations (wok / mortar pestle / hotpot dome) and food never cover it.
    const signY = def.y - 72;
    const signW = 200;
    const signH = 38;
    const sign = this.scene.add.graphics();
    sign.fillStyle(0x0e1126, 0.96);
    sign.fillRoundedRect(cx - signW / 2, signY - signH / 2, signW, signH, 11);
    sign.lineStyle(3, def.color, 1);
    sign.strokeRoundedRect(cx - signW / 2, signY - signH / 2, signW, signH, 11);
    // colour accent strip down the left of the sign
    sign.fillStyle(def.color, 1);
    sign.fillRoundedRect(cx - signW / 2 + 6, signY - signH / 2 + 7, 7, signH - 14, 4);
    const emoji = this.scene.add.text(cx - signW / 2 + 28, signY, def.emoji, { fontSize: "23px" }).setOrigin(0, 0.5);
    const name = this.scene.add
      .text(cx + 12, signY, def.name, {
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.grillSprite = this.scene.add.sprite(this.grillPos.x, this.grillPos.y, def.stationTex);
    this.counterSprite = this.scene.add.sprite(this.counterPos.x, this.counterPos.y, "counter");
    this.progressBar = this.scene.add.graphics();

    this.pileMarker = this.scene.add
      .sprite(this.pilePos.x, this.pilePos.y, "glow")
      .setScale(0.55)
      .setAlpha(0.3)
      .setTint(0xffd23f);
    const pileMarker = this.pileMarker;

    this.sparkles = makeSparkles(this.scene, this.pilePos.x, this.pilePos.y, def.y + 90);

    // "Cash ready" badge floating above the awning — at-a-glance "tend this stall" cue
    // while browsing the map. Hidden once you zoom into the stall.
    this.mapBadge = this.scene.add
      .text(cx, def.y - BASE_H / 2 - 30, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#1a1a2e",
        backgroundColor: "#ffd23f",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(def.y + 800)
      .setVisible(false);

    // Buff badge above the cash badge — visible on the map AND in focus, so a rush or
    // rave review reads at a glance wherever you are.
    this.buffBadge = this.scene.add
      .text(cx, def.y - BASE_H / 2 - 64, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        fontStyle: "bold",
        color: "#1a1a2e",
        backgroundColor: "#ff9a3c",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(def.y + 820)
      .setVisible(false);

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
      sign,
      emoji,
      name,
      this.grillSprite,
      this.counterSprite,
      this.progressBar,
      pileMarker,
      ...this.lights,
    ]);
    this.liveGroup.setDepth(def.y - 200);
    this.liveGroup.setAlpha(LOCKED_ALPHA);

    // Map mode: a whole-stall tap zone enters focus (release-fired so a flick to scroll
    // doesn't open it — GameScene ignores onTapped when the press became a drag).
    this.tapZone = this.scene.add.zone(cx, def.y, BASE_W + 20, BASE_H + 50).setInteractive();
    this.tapZone.on("pointerup", () => this.onTapped());

    // Focus mode: diegetic action zones over the station, counter and cash pile. Disabled
    // until this stall is focused (see setFocused).
    this.grillZone = this.scene.add.zone(this.grillPos.x, this.grillPos.y, 132, 150);
    this.grillZone.on("pointerup", () => this.onGrillTap());
    this.counterZone = this.scene.add.zone(this.counterPos.x, this.counterPos.y, 150, 150);
    this.counterZone.on("pointerup", () => this.onCounterTap());
    this.pileZone = this.scene.add.zone(this.pilePos.x, this.pilePos.y, 150, 120);
    this.pileZone.on("pointerup", () => this.onPileTap());

    // A single "tap the cash" cue floats over the pile when there's money to collect;
    // the grill & counter invite taps by gently pulsing while focused (see setFocused).
    this.hintCollect = this.scene.add
      .text(this.pilePos.x, this.pilePos.y - 42, "👆", { fontSize: "34px" })
      .setOrigin(0.5)
      .setDepth(def.y + 760)
      .setVisible(false);
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

    if (!this.fire && this.def.hasFire) {
      this.fire = grillFire(this.scene, this.grillPos.x, this.grillPos.y + 4, this.def.y - 120);
      steamPlume(this.scene, this.grillPos.x, this.grillPos.y - 16, this.def.y - 110);
    }
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

  /** Recompute the per-sale payout (call after a star is earned or after prestige). */
  setPrice(prestige: number): void {
    this.unitPrice = effectivePrice(this.def.price, this.state.stars, prestige);
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
    // While you're focused on this stall YOU serve it by hand (for combo); auto-serve
    // only runs on stalls you've left, so an active stall builds a queue worth serving.
    if (!this.focused && this.serveCooldown <= 0) this.tryServe();

    this.tickPatience(dt);
    this.worker?.update();

    // No hired helper and not being tended? Slowly self-plate so an un-tended stall still
    // trickles sales (auto-serve drains the counter) instead of bleeding every customer.
    if (!this.focused && this.state.workerLvl === 0 && this.grillStock > 0 && this.counterStock < COUNTER_MAX) {
      this.autoPlateAcc += dt;
      if (this.autoPlateAcc >= BASE_AUTOPLATE_MS) {
        this.autoPlateAcc = 0;
        this.plateUp(1);
      }
    }

    if (this.mapMode) this.refreshMapBadge();
    this.refreshBuffBadge();
    // The "collect" hint only makes sense when there's cash sitting in the pile.
    if (this.focused) this.hintCollect.setVisible(this.pileValue > 0);
  }

  /** Show/hide the boost badge; only touches the Text (and its tween) when state changes. */
  private refreshBuffBadge(): void {
    const now = Date.now();
    const rush = now < this.rushUntil;
    const rave = now < this.reviewUntil;
    const txt =
      rush && rave
        ? `🚌📰 ×${RUSH_MULT * REVIEW_MULT}`
        : rush
          ? `🚌 RUSH ×${RUSH_MULT}`
          : rave
            ? `📰 RAVE ×${REVIEW_MULT}`
            : "";
    if (txt === this.lastBuffText) return;
    this.lastBuffText = txt;
    this.scene.tweens.killTweensOf(this.buffBadge);
    this.buffBadge.setScale(1);
    if (!txt) {
      this.buffBadge.setVisible(false);
      return;
    }
    this.buffBadge.setText(txt).setVisible(true);
    this.scene.tweens.add({
      targets: this.buffBadge,
      scale: 1.08,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private refreshMapBadge(): void {
    const pile = Math.round(this.pileValue);
    if (pile === this.lastBadgePile) return;
    this.lastBadgePile = pile;
    if (pile > 0) this.mapBadge.setText(`💰 ฿${pile.toLocaleString()}`).setVisible(true);
    else this.mapBadge.setVisible(false);
  }

  /** Drain queued customers' patience; the impatient storm off (prevents deadlock). */
  private tickPatience(dt: number): void {
    let stormedOff = false;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const c = this.queue[i];
      if (c.tickPatience(dt)) {
        this.queue.splice(i, 1);
        c.loseTemper(360, WORLD_H + 60);
        this.lostSales++;
        stormedOff = true;
      }
    }
    if (stormedOff) {
      this.reflowQueue();
      lostSaleSting(this.scene);
      sfx.deny();
    }
  }

  /** Re-index the queue and slide everyone forward. Already-arrived customers KEEP their
   *  `atSlot` (stay servable) so you can chain serve-combos instead of waiting for the
   *  whole line to re-walk after every sale. */
  private reflowQueue(): void {
    this.queue.forEach((c, i) => {
      c.queueIndex = i;
      const slot = this.queueSlot(i);
      if (c.atSlot) c.walkTo(slot.x, slot.y, 220);
      else c.walkTo(slot.x, slot.y, 220, () => c.arriveAtSlot());
    });
  }

  /** Auto-serve (idle / helper): drains the counter at base price, no combo. */
  private tryServe(): void {
    const front = this.queue[0];
    if (!front || !front.atSlot || this.counterStock <= 0) return;
    this.counterStock--;
    this.refreshCounter();
    // "Service" upgrade speeds the throughput; floor keeps it from getting silly.
    this.serveCooldown = Math.max(120, 350 - this.serviceLvl * 25);
    this.recordSale(front, 1, false);
  }

  /**
   * Manual serve (focus, diegetic counter tap): instantly serve up to `n` waiting
   * customers, drawing food from the counter then the grill, paying `mult`× (combo).
   * Returns how many customers were served this tap (0 if nobody could be).
   */
  serveManual(n: number, mult: number): number {
    let served = 0;
    for (let i = 0; i < n; i++) {
      const front = this.queue[0];
      if (!front || !front.atSlot) break;
      if (this.counterStock > 0) {
        this.counterStock--;
        this.refreshCounter();
      } else if (this.grillStock > 0) {
        this.grillStock--;
        this.refreshGrill();
      } else {
        break; // nothing cooked to hand over
      }
      this.recordSale(front, mult, true);
      served++;
    }
    return served;
  }

  /** Bank a single sale to the cash pile (VIP + combo + rush/review buffs) and advance the queue. */
  private recordSale(front: Customer, mult: number, manual: boolean): void {
    const now = Date.now();
    let boost = 1;
    if (now < this.reviewUntil) boost *= REVIEW_MULT;
    if (now < this.rushUntil) boost *= RUSH_MULT;
    this.addToPile(this.unitPrice * mult * boost * (front.vip ? VIP_MULT : 1));
    // Only serving the critic YOURSELF earns the rave — helpers don't impress critics,
    // so idle income never silently inherits the ×2 buff.
    if (front.critic && manual) {
      this.reviewUntil = now + REVIEW_MS;
      this.onReview(this);
    }
    sfx.serve();
    front.served(360, WORLD_H + 60);
    this.queue.shift();
    this.reflowQueue();

    this.state.sales++;
    this.onServe();
    const stars = starsFromSales(this.state.sales);
    if (stars > this.state.stars) {
      this.state.stars = stars;
      this.onStar(this, stars);
    }
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

  /** Reward hook: top the grill straight to full. */
  fillGrill(): void {
    this.grillStock = GRILL_MAX;
    this.refreshGrill();
  }

  /**
   * Manual "cook" action (focus mode): fry one more item straight onto the grill, on
   * top of the idle cook timer. Returns false if the grill is already full.
   */
  cookTap(): boolean {
    if (this.grillStock >= GRILL_MAX) return false;
    this.cookProgress = 0;
    this.grillStock++;
    this.refreshGrill();
    return true;
  }

  /** Map mode: whole-stall tap zone (enter focus) + cash badge. */
  setMapMode(on: boolean): void {
    this.mapMode = on;
    if (on) {
      this.tapZone.setInteractive();
    } else {
      this.tapZone.disableInteractive();
      this.mapBadge.setVisible(false);
      this.lastBadgePile = -1;
    }
  }

  /** Focus mode: enable diegetic action zones + gently pulse the tappable parts. */
  setFocused(on: boolean): void {
    this.focused = on && this.state.unlocked;
    const live = this.focused;
    for (const z of [this.grillZone, this.counterZone, this.pileZone]) {
      if (live) z.setInteractive();
      else z.disableInteractive();
    }
    this.scene.tweens.killTweensOf([this.grillSprite, this.counterSprite, this.hintCollect]);
    this.grillSprite.setScale(1);
    this.counterSprite.setScale(1);
    this.hintCollect.setScale(1).setVisible(false);
    if (!live) return;
    this.hintCollect.setVisible(this.pileValue > 0);
    // Pulse the grill & counter so it's obvious they're tappable.
    this.scene.tweens.add({
      targets: [this.grillSprite, this.counterSprite],
      scale: 1.07,
      duration: 640,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.scene.tweens.add({
      targets: this.hintCollect,
      scale: 1.25,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  /**
   * Manual "serve" action (focus mode): plate up to `batch` cooked items from the
   * grill onto the counter. Auto-serve (tryServe) then drains the counter to the
   * queue. Returns how many were plated (0 if nothing to do).
   */
  plateUp(batch: number): number {
    const moved = this.depositToCounter(this.takeFromGrill(Math.max(1, batch)));
    return moved;
  }

  /** How many cooked items are ready to plate right now (for button state). */
  get readyToPlate(): number {
    return Math.min(this.grillStock, COUNTER_MAX - this.counterStock);
  }

  /** Dim everything but the focused stall so the active stall reads clearly. */
  setFocusDim(dim: boolean): void {
    // Locked stalls keep their faded look; unlocked ones return to full when undimmed.
    const a = dim ? 0.12 : this.state.unlocked ? 1 : LOCKED_ALPHA;
    this.liveGroup.setAlpha(a);
    this.buffBadge.setAlpha(dim ? 0.25 : 1);
    for (const s of this.grillItems) s.setAlpha(a);
    for (const s of this.counterItems) s.setAlpha(a);
    for (const s of this.pileCoins) s.setAlpha(a);
    this.fire?.setAlpha(a);
    this.sparkles?.setAlpha(a);
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
    this.sparkles?.explode(3, this.pilePos.x, this.pilePos.y);
    // Pulse the pile so a growing stack of cash reads as "worth grabbing".
    this.scene.tweens.killTweensOf(this.pileMarker);
    this.pileMarker.setScale(0.78).setAlpha(0.55);
    this.scene.tweens.add({
      targets: this.pileMarker,
      scale: 0.55,
      alpha: 0.3,
      duration: 300,
      ease: "Quad.Out",
    });
    for (const coin of this.pileCoins) {
      this.scene.tweens.killTweensOf(coin);
      coin.setScale(1.25);
      this.scene.tweens.add({ targets: coin, scale: 1, duration: 220, ease: "Back.Out" });
    }
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
        .sprite(p.x, p.y, this.def.foodTex)
        .setDepth(this.def.y - 100)
        .setScale(1.7);
      this.scene.tweens.add({ targets: s, scale: 1.1, duration: 120, ease: "Back.Out" });
      list.push(s);
    }
  }

  private drawProgress(p: number): void {
    // Redrawing a Graphics object every frame for 5 stalls is wasted GPU; the bar only
    // moves ~60px, so skip frames where the change is sub-pixel.
    if (Math.abs(p - this.lastProgress) < 1 / 60) return;
    this.lastProgress = p;
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
