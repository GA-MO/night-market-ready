import Phaser from "phaser";
import { STALLS, STAR_SALES } from "../config";
import {
  CAPS,
  CARRY_COST_BASE,
  SPEED_COST_BASE,
  carryCap,
  upgradeCost,
  workerCap,
} from "../economy";
import type { AdPlacement } from "../ads";
import type { GameScene } from "./GameScene";
import type { Stall } from "../entities/Stall";

const money = (n: number): string => `฿ ${Math.round(n).toLocaleString()}`;

class UIButton {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private main: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private w: number,
    private h: number,
    private color: number,
    onClick: () => void,
  ) {
    this.bg = scene.add.graphics();
    this.main = scene.add
      .text(0, -14, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.sub = scene.add
      .text(0, 18, "", { fontFamily: "Arial, sans-serif", fontSize: "20px", color: "#ffe9a8" })
      .setOrigin(0.5);
    this.container = scene.add.container(x, y, [this.bg, this.main, this.sub]);
    this.container.setSize(w, h).setInteractive();
    this.container.on("pointerdown", () => {
      if (this.enabled) onClick();
    });
    this.draw();
  }

  setText(main: string, sub: string): void {
    this.main.setText(main);
    this.sub.setText(sub);
    this.sub.setVisible(sub.length > 0);
    this.main.setY(sub.length > 0 ? -14 : 0);
  }

  setEnabled(b: boolean): void {
    if (b !== this.enabled) {
      this.enabled = b;
      this.draw();
    }
  }

  private draw(): void {
    this.bg.clear();
    this.bg.fillStyle(this.enabled ? this.color : 0x3a3f55, 1);
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 18);
    this.bg.lineStyle(3, 0xffffff, this.enabled ? 0.25 : 0.08);
    this.bg.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 18);
  }
}

/** Small round icon button used for the HUD (book / boost). */
class IconButton {
  readonly container: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, icon: string, color: number, onClick: () => void) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x141830, 0.92);
    bg.fillCircle(0, 0, 32);
    bg.lineStyle(3, color, 0.8);
    bg.strokeCircle(0, 0, 32);
    this.label = scene.add.text(0, 0, icon, { fontSize: "30px" }).setOrigin(0.5);
    this.container = scene.add.container(x, y, [bg, this.label]);
    this.container.setSize(64, 64).setInteractive({ useHandCursor: true });
    this.container.on("pointerdown", onClick);
  }

  setIcon(icon: string): void {
    this.label.setText(icon);
  }
}

export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private moneyText!: Phaser.GameObjects.Text;
  private carryBtn!: UIButton;
  private speedBtn!: UIButton;
  private boostBtn!: IconButton;
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private cookBtn!: UIButton;
  private workerBtn!: UIButton;
  private adFillBtn!: UIButton;
  private panelStall: Stall | null = null;
  private lastMoney = 0;

  private statsPanel!: Phaser.GameObjects.Container;
  private statsText!: Phaser.GameObjects.Text;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalQueue: Array<() => void> = [];
  private adOverlay: Phaser.GameObjects.Container | null = null;
  private adBusy = false;

  constructor() {
    super("ui");
  }

  create(): void {
    this.gs = this.scene.get("game") as GameScene;

    // Money pill.
    const pill = this.add.graphics();
    pill.fillStyle(0x141830, 0.92);
    pill.fillRoundedRect(360 - 130, 24, 260, 60, 30);
    pill.lineStyle(3, 0xffd23f, 0.6);
    pill.strokeRoundedRect(360 - 130, 24, 260, 60, 30);
    this.moneyText = this.add
      .text(360, 54, "฿ 0", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffd23f",
      })
      .setOrigin(0.5);

    // HUD icon buttons.
    new IconButton(this, 56, 54, "📖", 0x7b2cbf, () => this.openBook());
    this.boostBtn = new IconButton(this, 664, 54, "📺", 0x2a9d8f, () =>
      this.runAd("double_earnings", "2× earnings · 4h", () => this.gs.rewardEarnBoost()),
    );

    // Bottom upgrade bar.
    const bar = this.add.graphics();
    bar.fillStyle(0x10142c, 0.94);
    bar.fillRoundedRect(16, 1146, 688, 122, 24);
    bar.lineStyle(2, 0x3a4170, 1);
    bar.strokeRoundedRect(16, 1146, 688, 122, 24);
    this.add.zone(360, 1207, 688, 122).setInteractive(); // absorb taps so the joystick ignores the bar
    this.carryBtn = new UIButton(this, 190, 1207, 320, 94, 0x2a9d8f, () => this.gs.buyCarry());
    this.speedBtn = new UIButton(this, 530, 1207, 320, 94, 0x457b9d, () => this.gs.buySpeed());

    this.buildPanel();
    this.buildStatsPanel();

    const refresh = () => this.refresh();
    const onTap = (stall: Stall) => this.openPanel(stall);
    const onToast = (msg: string) => this.toast(msg);
    const onParty = () => this.celebrate();
    const onStats = () => this.toggleStats();
    // Auto modals queue behind one another so welcome-back isn't clobbered by daily.
    const onDaily = (d: { day: number; reward: number }) => this.enqueueModal(() => this.showDaily(d));
    const onOffline = (amount: number) => this.enqueueModal(() => this.showOffline(amount));
    const onReset = () => this.onWorldReset();
    this.gs.events.on("money", refresh);
    this.gs.events.on("state-changed", refresh);
    this.gs.events.on("stall-tapped", onTap);
    this.gs.events.on("toast", onToast);
    this.gs.events.on("celebrate", onParty);
    this.gs.events.on("toggle-stats", onStats);
    this.gs.events.on("daily-available", onDaily);
    this.gs.events.on("offline-earned", onOffline);
    this.gs.events.on("world-reset", onReset);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gs.events.off("money", refresh);
      this.gs.events.off("state-changed", refresh);
      this.gs.events.off("stall-tapped", onTap);
      this.gs.events.off("toast", onToast);
      this.gs.events.off("celebrate", onParty);
      this.gs.events.off("toggle-stats", onStats);
      this.gs.events.off("daily-available", onDaily);
      this.gs.events.off("offline-earned", onOffline);
      this.gs.events.off("world-reset", onReset);
    });

    this.refresh();

    // First-run hint.
    const hint = this.add
      .text(
        360,
        210,
        "Drag anywhere to move\n🔥 grab food at the grill → 🛎 stock the counter → 💰 scoop up the cash!",
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "21px",
          color: "#cfd6ff",
          align: "center",
          wordWrap: { width: 620 },
        },
      )
      .setOrigin(0.5);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      delay: 8000,
      duration: 800,
      onComplete: () => hint.destroy(),
    });
  }

  // ---------- stall panel ----------

  private buildPanel(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x141830, 0.97);
    bg.fillRoundedRect(-330, -150, 660, 300, 22);
    bg.lineStyle(3, 0x4a5390, 1);
    bg.strokeRoundedRect(-330, -150, 660, 300, 22);

    this.panelTitle = this.add
      .text(0, -116, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const close = this.add
      .text(296, -116, "✕", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#8f97c4",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.closePanel());

    this.cookBtn = new UIButton(this, -160, -10, 300, 96, 0xe76f51, () => {
      if (this.panelStall) this.gs.buyCook(this.panelStall);
    });
    this.workerBtn = new UIButton(this, 160, -10, 300, 96, 0x7b2cbf, () => {
      if (this.panelStall) this.gs.buyWorker(this.panelStall);
    });
    this.adFillBtn = new UIButton(this, 0, 100, 620, 70, 0x2a9d8f, () =>
      this.runAd("instant_grill", "Instant-fill grills", () => this.gs.rewardFillGrills()),
    );
    this.adFillBtn.setText("📺 Instant-fill grills", "free");

    this.panel = this.add.container(360, 900, [
      bg,
      this.panelTitle,
      close,
      this.cookBtn.container,
      this.workerBtn.container,
      this.adFillBtn.container,
    ]);
    this.panel.setSize(660, 300).setInteractive();
    this.panel.setVisible(false);
    this.cookBtn.container.setPosition(-160, -10);
    this.workerBtn.container.setPosition(160, -10);
    this.adFillBtn.container.setPosition(0, 100);
  }

  private openPanel(stall: Stall): void {
    this.panelStall = stall;
    this.panel.setVisible(true);
    this.refresh();
  }

  private closePanel(): void {
    this.panelStall = null;
    this.panel.setVisible(false);
  }

  // ---------- stats overlay ----------

  private buildStatsPanel(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x05060f, 0.82);
    bg.fillRoundedRect(0, 0, 300, 150, 16);
    bg.lineStyle(2, 0x3a4170, 1);
    bg.strokeRoundedRect(0, 0, 300, 150, 16);
    this.statsText = this.add.text(16, 14, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#cfe7ff",
      lineSpacing: 6,
    });
    this.statsPanel = this.add.container(28, 100, [bg, this.statsText]).setVisible(false).setDepth(50);
  }

  private toggleStats(): void {
    this.statsPanel.setVisible(!this.statsPanel.visible);
    if (this.statsPanel.visible) this.refreshStats();
  }

  private refreshStats(): void {
    if (!this.statsPanel.visible) return;
    const s = this.gs.sessionStats();
    this.statsText.setText(
      [
        `Served : ${s.served.toLocaleString()}`,
        `Earned : ${money(s.earned)}`,
        `฿/min  : ${s.perMin.toLocaleString()}`,
        `Prestige: ${s.prestige}  (+${s.prestige * 25}%)`,
        `Boost  : ${s.boostMin > 0 ? s.boostMin + "m left" : "off"}`,
      ].join("\n"),
    );
  }

  // ---------- refresh ----------

  private refresh(): void {
    const st = this.gs.state;
    this.moneyText.setText(money(st.money));
    if (st.money > this.lastMoney) {
      this.tweens.killTweensOf(this.moneyText);
      this.moneyText.setScale(1.18);
      this.tweens.add({ targets: this.moneyText, scale: 1, duration: 220, ease: "Back.Out" });
    }
    this.lastMoney = st.money;

    this.boostBtn.setIcon(this.gs.earnBoostActive() ? "⚡" : "📺");

    if (st.carryLvl >= CAPS.carry) {
      this.carryBtn.setText("👜 Carry MAX", "");
      this.carryBtn.setEnabled(false);
    } else {
      const cost = upgradeCost(CARRY_COST_BASE, st.carryLvl);
      this.carryBtn.setText(`👜 Carry ${carryCap(st.carryLvl)} → ${carryCap(st.carryLvl + 1)}`, money(cost));
      this.carryBtn.setEnabled(st.money >= cost);
    }

    if (st.speedLvl >= CAPS.speed) {
      this.speedBtn.setText("👟 Speed MAX", "");
      this.speedBtn.setEnabled(false);
    } else {
      const cost = upgradeCost(SPEED_COST_BASE, st.speedLvl);
      this.speedBtn.setText(`👟 Speed Lv ${st.speedLvl + 1}`, money(cost));
      this.speedBtn.setEnabled(st.money >= cost);
    }

    const stall = this.panelStall;
    if (stall && this.panel.visible) {
      const starStr = "★".repeat(stall.state.stars) + "☆".repeat(3 - stall.state.stars);
      this.panelTitle.setText(`${stall.def.emoji} ${stall.def.name}   ${starStr}`);

      if (stall.state.cookLvl >= CAPS.cook) {
        this.cookBtn.setText("🔥 Cook MAX", "");
        this.cookBtn.setEnabled(false);
      } else {
        const cost = upgradeCost(stall.def.cookCostBase, stall.state.cookLvl);
        this.cookBtn.setText(`🔥 Cook Lv ${stall.state.cookLvl + 1}`, money(cost));
        this.cookBtn.setEnabled(st.money >= cost);
      }

      if (stall.state.workerLvl >= CAPS.worker) {
        this.workerBtn.setText("🧑‍🍳 Helper MAX", "");
        this.workerBtn.setEnabled(false);
      } else {
        const cost = upgradeCost(stall.def.workerCostBase, stall.state.workerLvl);
        const label =
          stall.state.workerLvl === 0
            ? "🧑‍🍳 Hire Helper"
            : `🧑‍🍳 Helper ${workerCap(stall.state.workerLvl)} → ${workerCap(stall.state.workerLvl + 1)}`;
        this.workerBtn.setText(label, money(cost));
        this.workerBtn.setEnabled(st.money >= cost);
      }
    }

    this.refreshStats();
  }

  // ---------- daily streak ----------

  private showDaily(d: { day: number; reward: number }): void {
    const { panel, content } = this.makeModal(560);
    content.add(
      this.add.text(0, -150, "🔥 Daily Streak", {
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffd23f",
      }).setOrigin(0.5),
    );
    content.add(
      this.add.text(0, -108, `Day ${d.day}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "22px",
        color: "#cfd6ff",
      }).setOrigin(0.5),
    );
    // 7-day strip (centred: 7 cells at 88px spacing → ±264, within the ±340 card).
    for (let i = 0; i < 7; i++) {
      const dx = (i - 3) * 88;
      const done = i + 1 < d.day;
      const today = i + 1 === d.day;
      const cell = this.add.graphics();
      cell.fillStyle(today ? 0xffd23f : done ? 0x2a9d8f : 0x222748, 1);
      cell.fillRoundedRect(dx - 38, -60, 76, 76, 12);
      content.add(cell);
      content.add(
        this.add.text(dx, -22, `${i + 1}`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "26px",
          fontStyle: "bold",
          color: today ? "#1a1a2e" : "#cfd6ff",
        }).setOrigin(0.5),
      );
    }
    content.add(
      this.add.text(0, 70, `Reward:  ${money(d.reward)}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#ffe9a8",
      }).setOrigin(0.5),
    );
    const claim = new UIButton(this, 0, 150, 360, 80, 0x2a9d8f, () => {
      this.gs.claimDaily(d.day, d.reward);
      this.closeModal();
    });
    claim.setText("Claim", "");
    content.add(claim.container);
    claim.container.setPosition(0, 150);
    panel.setVisible(true);
  }

  // ---------- welcome-back (offline) ----------

  private showOffline(amount: number): void {
    const { panel, content } = this.makeModal(420);
    content.add(
      this.add.text(0, -110, "🌙 Welcome back!", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffd23f",
      }).setOrigin(0.5),
    );
    content.add(
      this.add.text(0, -52, `Your helpers kept selling.\nYou earned ${money(amount)}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "23px",
        color: "#cfd6ff",
        align: "center",
      }).setOrigin(0.5),
    );
    const dbl = new UIButton(this, -160, 70, 300, 80, 0x2a9d8f, () => {
      this.closeModal();
      this.runAd("double_offline", "Double offline earnings", () => this.gs.rewardDoubleOffline());
    });
    dbl.setText("📺 Double it", "");
    content.add(dbl.container);
    dbl.container.setPosition(-160, 70);
    const ok = new UIButton(this, 160, 70, 300, 80, 0x457b9d, () => this.closeModal());
    ok.setText("Thanks!", "");
    content.add(ok.container);
    ok.container.setPosition(160, 70);
    panel.setVisible(true);
  }

  // ---------- collection book ----------

  private openBook(): void {
    if (this.modal) return;
    const { panel, content } = this.makeModal(720);
    content.add(
      this.add.text(0, -300, "📖 Menu Collection", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffd23f",
      }).setOrigin(0.5),
    );
    STALLS.forEach((def, i) => {
      const st = this.gs.state.stalls[def.id];
      const row = -230 + i * 86;
      const starStr = "★".repeat(st.stars) + "☆".repeat(3 - st.stars);
      const next = st.stars < 3 ? `${st.sales}/${STAR_SALES[st.stars]} to next` : "complete";
      content.add(
        this.add.text(-310, row, `${def.emoji} ${def.name}`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "26px",
          fontStyle: "bold",
          color: st.unlocked ? "#ffffff" : "#5a5f82",
        }).setOrigin(0, 0.5),
      );
      content.add(
        this.add.text(120, row - 12, starStr, { fontSize: "26px", color: "#ffd23f" }).setOrigin(0, 0.5),
      );
      content.add(
        this.add.text(120, row + 16, next, {
          fontFamily: "monospace",
          fontSize: "17px",
          color: "#9aa3d0",
        }).setOrigin(0, 0.5),
      );
    });

    // Prestige.
    const can = this.gs.canPrestige();
    const next = this.gs.state.prestige + 1;
    const prestige = new UIButton(this, 0, 300, 600, 82, can ? 0xc1121f : 0x3a3f55, () => {
      if (!can) return;
      this.confirmPrestige();
    });
    prestige.setText(
      can ? "🌊 Move to Floating Market" : "🌊 Unlock all stalls first",
      can ? `Reset stalls · keep stars · +25% (→ +${next * 25}%)` : "",
    );
    prestige.setEnabled(can);
    content.add(prestige.container);
    prestige.container.setPosition(0, 300);
    panel.setVisible(true);
  }

  private confirmPrestige(): void {
    this.closeModal();
    const { panel, content } = this.makeModal(360);
    content.add(
      this.add.text(0, -90, "Move to the Floating Market?", {
        fontFamily: "Arial, sans-serif",
        fontSize: "27px",
        fontStyle: "bold",
        color: "#ffd23f",
        align: "center",
        wordWrap: { width: 560 },
      }).setOrigin(0.5),
    );
    content.add(
      this.add.text(0, -24, "Stalls & upgrades reset.\nStars kept. +25% earnings forever.", {
        fontFamily: "Arial, sans-serif",
        fontSize: "21px",
        color: "#cfd6ff",
        align: "center",
      }).setOrigin(0.5),
    );
    const yes = new UIButton(this, -150, 70, 280, 80, 0xc1121f, () => {
      this.closeModal();
      this.gs.doPrestige();
    });
    yes.setText("Yes, prestige", "");
    content.add(yes.container);
    yes.container.setPosition(-150, 70);
    const no = new UIButton(this, 150, 70, 280, 80, 0x457b9d, () => this.closeModal());
    no.setText("Cancel", "");
    content.add(no.container);
    no.container.setPosition(150, 70);
    panel.setVisible(true);
  }

  // ---------- generic modal ----------

  /** Run `builder` now if no modal is up, otherwise after the current one closes. */
  private enqueueModal(builder: () => void): void {
    if (this.modal) this.modalQueue.push(builder);
    else builder();
  }

  private makeModal(height: number): { panel: Phaser.GameObjects.Container; content: Phaser.GameObjects.Container } {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x03040c, 0.72);
    backdrop.fillRect(0, 0, 720, 1280);
    const blocker = this.add.zone(360, 640, 720, 1280).setInteractive();
    blocker.on("pointerdown", () => {}); // swallow taps behind the modal

    const card = this.add.graphics();
    card.fillStyle(0x141830, 0.99);
    card.fillRoundedRect(-340, -height / 2, 680, height, 26);
    card.lineStyle(3, 0x4a5390, 1);
    card.strokeRoundedRect(-340, -height / 2, 680, height, 26);
    const closeX = this.add
      .text(305, -height / 2 + 30, "✕", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#8f97c4",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeX.on("pointerdown", () => this.closeModal());

    const content = this.add.container(0, 0, [card, closeX]);
    const panel = this.add.container(360, 640, [backdrop, blocker, content]).setDepth(100).setVisible(false);
    panel.setScale(0.9);
    this.tweens.add({ targets: panel, scale: 1, duration: 220, ease: "Back.Out" });
    this.modal = panel;
    return { panel, content };
  }

  private closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
    const next = this.modalQueue.shift();
    if (next) next();
  }

  private onWorldReset(): void {
    this.closeModal();
    this.closePanel();
    this.refresh();
  }

  // ---------- rewarded ads ----------

  private async runAd(placement: AdPlacement, label: string, reward: () => void): Promise<void> {
    if (this.adBusy) return;
    if (!this.gs.ads.isReady(placement)) {
      this.toast("No ad available right now.");
      return;
    }
    this.adBusy = true;
    const count = this.showAdOverlay(label);
    const ok = await this.gs.ads.show(placement, (sec) => count.setText(String(sec)));
    this.hideAdOverlay();
    this.adBusy = false;
    if (ok) reward();
  }

  private showAdOverlay(label: string): Phaser.GameObjects.Text {
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x03040c, 0.9);
    backdrop.fillRect(0, 0, 720, 1280);
    const blocker = this.add.zone(360, 640, 720, 1280).setInteractive();
    blocker.on("pointerdown", () => {});
    const tag = this.add
      .text(360, 470, "AD", {
        fontFamily: "Arial, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#8f97c4",
      })
      .setOrigin(0.5);
    const title = this.add
      .text(360, 560, label, {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffd23f",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);
    const count = this.add
      .text(360, 680, "3", {
        fontFamily: "Arial, sans-serif",
        fontSize: "96px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: count, scale: { from: 1.3, to: 1 }, duration: 400, repeat: -1 });
    this.adOverlay = this.add.container(0, 0, [backdrop, blocker, tag, title, count]).setDepth(200);
    return count;
  }

  private hideAdOverlay(): void {
    this.adOverlay?.destroy();
    this.adOverlay = null;
  }

  // ---------- feedback ----------

  private toast(msg: string): void {
    const t = this.add
      .text(360, 300, msg, {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#141830ee",
        padding: { x: 22, y: 12 },
        align: "center",
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 282, duration: 250 });
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2800,
      duration: 450,
      onComplete: () => t.destroy(),
    });
  }

  private celebrate(): void {
    const banner = this.add
      .text(360, 560, "🎉 MARKET FULLY LIT! 🎉", {
        fontFamily: "Arial, sans-serif",
        fontSize: "46px",
        fontStyle: "bold",
        color: "#ffd23f",
        stroke: "#311b00",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(80);
    this.tweens.add({ targets: banner, scale: 1, ease: "Back.Out", duration: 600 });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 3800,
      duration: 700,
      onComplete: () => banner.destroy(),
    });
    const confetti = this.add.particles(360, 430, "spark", {
      speed: { min: 160, max: 420 },
      angle: { min: 0, max: 360 },
      gravityY: 500,
      lifespan: 1300,
      scale: { start: 0.7, end: 0 },
      quantity: 80,
      tint: [0xff6b35, 0xffd23f, 0x4ecdc4, 0xc77dff, 0xff70a6],
      blendMode: "ADD",
      emitting: false,
    }).setDepth(80);
    confetti.explode(80);
    this.time.delayedCall(1800, () => confetti.destroy());
  }
}
