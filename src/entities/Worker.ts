import Phaser from "phaser";
import { COUNTER_MAX } from "../config";
import { workerCap } from "../economy";
import type { Stall } from "./Stall";

const STACK_BASE_Y = -34;
const STACK_STEP = 10;

/** Hired helper: shuttles cooked food from the grill to the serving counter. */
export class Worker {
  readonly obj: Phaser.GameObjects.Container;
  private carried: Phaser.GameObjects.Sprite[] = [];
  private busy = false;

  constructor(
    private scene: Phaser.Scene,
    private stall: Stall,
  ) {
    const shadow = scene.add.ellipse(0, 13, 26, 9, 0x000000, 0.3);
    const body = scene.add.sprite(0, 0, "npc").setTint(stall.def.color);
    const hat = scene.add.sprite(0, -13, "dot").setScale(0.7).setTint(0xffffff);
    this.obj = scene.add.container(stall.grillPos.x, stall.grillPos.y + 42, [shadow, body, hat]);
    this.obj.setDepth(this.obj.y);
    this.obj.setScale(0);
    scene.tweens.add({ targets: this.obj, scale: 1, duration: 300, ease: "Back.Out" });
  }

  update(): void {
    if (this.busy) return;
    const space = COUNTER_MAX - this.stall.counterStock;
    const want = Math.min(workerCap(this.stall.state.workerLvl), this.stall.grillStock, space);
    if (want <= 0) return;
    this.busy = true;
    this.walkTo(this.stall.grillPos.x, this.stall.grillPos.y + 42, () => {
      const got = this.stall.takeFromGrill(want);
      for (let i = 0; i < got; i++) this.addCarried();
      this.walkTo(this.stall.counterPos.x, this.stall.counterPos.y + 42, () => {
        const deposited = this.stall.depositToCounter(this.carried.length);
        this.removeCarried(deposited);
        this.busy = false;
      });
    });
  }

  private speed(): number {
    return 140 + this.stall.state.workerLvl * 18;
  }

  private walkTo(x: number, y: number, onArrive: () => void): void {
    const d = Phaser.Math.Distance.Between(this.obj.x, this.obj.y, x, y);
    this.scene.tweens.add({
      targets: this.obj,
      x,
      y,
      duration: Math.max(60, (d / this.speed()) * 1000),
      onUpdate: () => this.obj.setDepth(this.obj.y),
      onComplete: onArrive,
    });
  }

  private addCarried(): void {
    const item = this.scene.add.sprite(0, 0, "food").setTint(this.stall.def.foodColor);
    this.obj.add(item);
    this.carried.push(item);
    this.carried.forEach((s, i) => s.setPosition(0, STACK_BASE_Y - i * STACK_STEP));
  }

  private removeCarried(n: number): void {
    for (let i = 0; i < n; i++) {
      const item = this.carried.pop();
      item?.destroy();
    }
  }
}
