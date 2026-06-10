import Phaser from "phaser";
import { WORLD_H } from "../config";
import { carryCap } from "../economy";

const STACK_BASE_Y = -40;
const STACK_STEP = 11;

export class Player {
  readonly obj: Phaser.GameObjects.Container;
  private carried: Phaser.GameObjects.Sprite[] = [];

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    const shadow = scene.add.ellipse(0, 18, 34, 12, 0x000000, 0.35);
    const body = scene.add.sprite(0, 0, "player");
    this.obj = scene.add.container(x, y, [shadow, body]);
    this.obj.setDepth(y);
  }

  get x(): number {
    return this.obj.x;
  }

  get y(): number {
    return this.obj.y;
  }

  update(dtSec: number, vx: number, vy: number, speed: number): void {
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    this.obj.x = Phaser.Math.Clamp(this.obj.x + vx * speed * dtSec, 70, 650);
    this.obj.y = Phaser.Math.Clamp(this.obj.y + vy * speed * dtSec, 200, WORLD_H - 90);
    this.obj.setDepth(this.obj.y);
  }

  room(carryLvl: number): number {
    return carryCap(carryLvl) - this.carried.length;
  }

  addItem(stallId: string, tex: string): void {
    const item = this.scene.add.sprite(0, 0, tex);
    item.setData("stallId", stallId);
    this.obj.add(item);
    this.carried.push(item);
    this.restack();
    item.setScale(1.6);
    this.scene.tweens.add({ targets: item, scale: 1.1, duration: 130, ease: "Back.Out" });
  }

  /** Remove up to `max` carried items belonging to a stall; returns how many were removed. */
  takeFor(stallId: string, max: number): number {
    let n = 0;
    for (let i = this.carried.length - 1; i >= 0 && n < max; i--) {
      if (this.carried[i].getData("stallId") === stallId) {
        this.carried[i].destroy();
        this.carried.splice(i, 1);
        n++;
      }
    }
    if (n > 0) this.restack();
    return n;
  }

  private restack(): void {
    this.carried.forEach((s, i) => s.setPosition(0, STACK_BASE_Y - i * STACK_STEP));
  }
}
