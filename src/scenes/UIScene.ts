import Phaser from "phaser";
import {
  CAPS,
  CARRY_COST_BASE,
  SPEED_COST_BASE,
  carryCap,
  upgradeCost,
  workerCap,
} from "../economy";
import type { GameScene } from "./GameScene";
import type { Stall } from "../entities/Stall";

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

export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private moneyText!: Phaser.GameObjects.Text;
  private carryBtn!: UIButton;
  private speedBtn!: UIButton;
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private cookBtn!: UIButton;
  private workerBtn!: UIButton;
  private panelStall: Stall | null = null;

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

    const refresh = () => this.refresh();
    const onTap = (stall: Stall) => this.openPanel(stall);
    const onToast = (msg: string) => this.toast(msg);
    const onParty = () => this.celebrate();
    this.gs.events.on("money", refresh);
    this.gs.events.on("state-changed", refresh);
    this.gs.events.on("stall-tapped", onTap);
    this.gs.events.on("toast", onToast);
    this.gs.events.on("celebrate", onParty);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gs.events.off("money", refresh);
      this.gs.events.off("state-changed", refresh);
      this.gs.events.off("stall-tapped", onTap);
      this.gs.events.off("toast", onToast);
      this.gs.events.off("celebrate", onParty);
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
    bg.fillRoundedRect(-330, -110, 660, 220, 22);
    bg.lineStyle(3, 0x4a5390, 1);
    bg.strokeRoundedRect(-330, -110, 660, 220, 22);

    this.panelTitle = this.add
      .text(0, -76, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const close = this.add
      .text(296, -76, "✕", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#8f97c4",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.closePanel());

    this.cookBtn = new UIButton(this, -160, 30, 300, 96, 0xe76f51, () => {
      if (this.panelStall) this.gs.buyCook(this.panelStall);
    });
    this.workerBtn = new UIButton(this, 160, 30, 300, 96, 0x7b2cbf, () => {
      if (this.panelStall) this.gs.buyWorker(this.panelStall);
    });

    this.panel = this.add.container(360, 990, [
      bg,
      this.panelTitle,
      close,
      this.cookBtn.container,
      this.workerBtn.container,
    ]);
    this.panel.setSize(660, 220).setInteractive();
    this.panel.setVisible(false);
    // Re-anchor the buttons inside the panel (they were created in scene space).
    this.cookBtn.container.setPosition(-160, 30);
    this.workerBtn.container.setPosition(160, 30);
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

  // ---------- refresh ----------

  private refresh(): void {
    const st = this.gs.state;
    this.moneyText.setText(`฿ ${st.money.toLocaleString()}`);

    if (st.carryLvl >= CAPS.carry) {
      this.carryBtn.setText("👜 Carry MAX", "");
      this.carryBtn.setEnabled(false);
    } else {
      const cost = upgradeCost(CARRY_COST_BASE, st.carryLvl);
      this.carryBtn.setText(`👜 Carry ${carryCap(st.carryLvl)} → ${carryCap(st.carryLvl + 1)}`, `฿ ${cost.toLocaleString()}`);
      this.carryBtn.setEnabled(st.money >= cost);
    }

    if (st.speedLvl >= CAPS.speed) {
      this.speedBtn.setText("👟 Speed MAX", "");
      this.speedBtn.setEnabled(false);
    } else {
      const cost = upgradeCost(SPEED_COST_BASE, st.speedLvl);
      this.speedBtn.setText(`👟 Speed Lv ${st.speedLvl + 1}`, `฿ ${cost.toLocaleString()}`);
      this.speedBtn.setEnabled(st.money >= cost);
    }

    const stall = this.panelStall;
    if (stall && this.panel.visible) {
      this.panelTitle.setText(`${stall.def.emoji} ${stall.def.name}`);

      if (stall.state.cookLvl >= CAPS.cook) {
        this.cookBtn.setText("🔥 Cook MAX", "");
        this.cookBtn.setEnabled(false);
      } else {
        const cost = upgradeCost(stall.def.cookCostBase, stall.state.cookLvl);
        this.cookBtn.setText(`🔥 Cook Lv ${stall.state.cookLvl + 1}`, `฿ ${cost.toLocaleString()}`);
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
            : `🧑‍🍳 Helper carries ${workerCap(stall.state.workerLvl)} → ${workerCap(stall.state.workerLvl + 1)}`;
        this.workerBtn.setText(label, `฿ ${cost.toLocaleString()}`);
        this.workerBtn.setEnabled(st.money >= cost);
      }
    }
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
      .setScale(0);
    this.tweens.add({ targets: banner, scale: 1, ease: "Back.Out", duration: 600 });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 3800,
      duration: 700,
      onComplete: () => banner.destroy(),
    });
    const confetti = this.add.particles(360, 430, "dot", {
      speed: { min: 160, max: 420 },
      angle: { min: 0, max: 360 },
      gravityY: 500,
      lifespan: 1300,
      scale: { start: 0.7, end: 0 },
      quantity: 80,
      tint: [0xff6b35, 0xffd23f, 0x4ecdc4, 0xc77dff, 0xff70a6],
      emitting: false,
    });
    confetti.explode(80);
    this.time.delayedCall(1800, () => confetti.destroy());
  }
}
