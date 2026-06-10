import Phaser from "phaser";

/** Reusable juice: camera grading, ambient atmosphere and per-event bursts. */

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Cinematic colour grade on the world camera (WebGL only — silently skipped on Canvas). */
export function applyCameraFx(scene: Phaser.Scene): void {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;
  const fx = scene.cameras.main.postFX;
  fx.addVignette(0.5, 0.5, 0.82, 0.4);
  // Gentler bloom: keeps the lantern/coin glow but stops washing out text & signage.
  fx.addBloom(0xffffff, 1, 1, 0.9, 0.55, 5);
}

/** Warm fireflies drifting through the market. */
export function ambientFireflies(scene: Phaser.Scene, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(40, 680);
    const y = Phaser.Math.Between(220, 1120);
    const fly = scene.add
      .sprite(x, y, "glow")
      .setScale(Phaser.Math.FloatBetween(0.12, 0.26))
      .setTint(Phaser.Math.RND.pick([0xffd27a, 0xffb04a, 0xfff1b0]))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(40);
    scene.tweens.add({
      targets: fly,
      x: x + Phaser.Math.Between(-90, 90),
      y: y + Phaser.Math.Between(-70, 70),
      duration: Phaser.Math.Between(4000, 8000),
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    scene.tweens.add({
      targets: fly,
      alpha: Phaser.Math.FloatBetween(0.35, 0.7),
      duration: Phaser.Math.Between(1200, 2600),
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 2000),
      ease: "Sine.InOut",
    });
  }
}

/** Embers rising off the grill coals. */
export function grillFire(scene: Phaser.Scene, x: number, y: number, depth: number): Emitter {
  return scene.add
    .particles(x, y, "dot", {
      x: { min: -16, max: 16 },
      y: { min: -3, max: 5 },
      speedY: { min: -95, max: -45 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 450, max: 950 },
      frequency: 120,
      quantity: 1,
      tint: [0xffe39a, 0xff9a3c, 0xff5a1e],
      blendMode: "ADD",
    })
    .setDepth(depth);
}

/** Lazy steam curling off a hot station. */
export function steamPlume(scene: Phaser.Scene, x: number, y: number, depth: number): Emitter {
  return scene.add
    .particles(x, y, "steam", {
      x: { min: -10, max: 10 },
      speedY: { min: -34, max: -16 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.22, end: 0.8 },
      alpha: { start: 0.16, end: 0 },
      lifespan: { min: 1200, max: 2200 },
      frequency: 360,
      quantity: 1,
      tint: 0xeae6ff,
      blendMode: "SCREEN",
    })
    .setDepth(depth);
}

/** Persistent (idle) sparkle emitter for a cash pile — burst with `.explode()`. */
export function makeSparkles(scene: Phaser.Scene, x: number, y: number, depth: number): Emitter {
  return scene.add
    .particles(x, y, "spark", {
      speed: { min: 18, max: 70 },
      angle: { min: 200, max: 340 },
      gravityY: 140,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 380, max: 620 },
      rotate: { min: 0, max: 360 },
      tint: [0xffe9a0, 0xfff6cf, 0xffd23f],
      blendMode: "ADD",
      emitting: false,
    })
    .setDepth(depth);
}

/** Floating "+฿N" that pops and drifts up — the payoff for collecting cash. */
export function floatMoney(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const label = scene.add
    .text(x, y, `+฿ ${amount.toLocaleString()}`, {
      fontFamily: "Arial, sans-serif",
      fontSize: "30px",
      fontStyle: "bold",
      color: "#ffe27a",
      stroke: "#5a3a00",
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(6000)
    .setScale(0.4);
  scene.tweens.add({ targets: label, scale: 1, duration: 180, ease: "Back.Out" });
  scene.tweens.add({
    targets: label,
    y: y - 80,
    alpha: 0,
    duration: 850,
    delay: 160,
    ease: "Cubic.In",
    onComplete: () => label.destroy(),
  });
}

/** Tiny tactile shake when a big chunk of cash lands. */
export function collectPunch(scene: Phaser.Scene, intensity = 0.004): void {
  scene.cameras.main.shake(110, intensity);
}

/** Red sting when a customer storms off without buying. */
export function lostSaleSting(scene: Phaser.Scene): void {
  scene.cameras.main.flash(160, 120, 10, 10, false);
}
