import Phaser from "phaser";

/**
 * Generates every texture procedurally — the prototype ships zero art assets.
 * Aim: studio-grade readability via soft shading, rim light, gloss highlights and
 * radial gradients, all built from Graphics primitives so it stays asset-free.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const g = this.add.graphics();

    // ---- colour helpers -------------------------------------------------
    const lerp = (a: number, b: number, t: number): number => {
      const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
      const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
      const r = Math.round(ar + (br - ar) * t);
      const gn = Math.round(ag + (bg - ag) * t);
      const bl = Math.round(ab + (bb - ab) * t);
      return (r << 16) | (gn << 8) | bl;
    };
    /** Filled radial gradient: inner colour at centre → outer colour at radius r. */
    const radial = (cx: number, cy: number, r: number, inner: number, outer: number, steps = 20): void => {
      for (let i = steps; i >= 1; i--) {
        const frac = (i - 1) / (steps - 1);
        g.fillStyle(lerp(inner, outer, frac), 1);
        g.fillCircle(cx, cy, (r * i) / steps);
      }
    };
    const make = (key: string, w: number, h: number): void => {
      g.generateTexture(key, w, h);
      g.clear();
    };

    // ---- particles / lighting ------------------------------------------
    // Crisp white disc — joystick, coins-in-flight, generic particles.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    make("dot", 16, 16);

    // Soft radial glow (additive halos for lanterns, stall light, pile).
    for (let i = 22; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.025 * (23 - i) * 0.5 + 0.01);
      g.fillCircle(80, 80, (i / 22) * 80);
    }
    make("glow", 160, 160);

    // Soft fuzzy blob — steam / smoke.
    for (let i = 14; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.05);
      g.fillCircle(24, 24, (i / 14) * 24);
    }
    make("steam", 48, 48);

    // 4-point sparkle for cash + celebrations.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 3.2);
    const star = (rot: number) => {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      const spikes = [13, 3, 13, 3];
      for (let k = 0; k < 4; k++) {
        const a = rot + (k * Math.PI) / 2;
        pts.push({ x: 16 + Math.cos(a) * spikes[k], y: 16 + Math.sin(a) * spikes[k] });
      }
      return pts;
    };
    g.fillStyle(0xffffff, 0.95);
    g.fillPoints(star(0), true);
    g.fillStyle(0xffffff, 0.6);
    g.fillPoints(star(Math.PI / 4), true);
    make("spark", 32, 32);

    // ---- vendor (player) -----------------------------------------------
    // 56×64, origin-centred. A cheerful street-food chef.
    {
      const cx = 28;
      // grounding shadow halo
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(cx, 58, 36, 10);
      // legs
      g.fillStyle(0x2a2438, 1);
      g.fillRoundedRect(20, 44, 7, 15, 3);
      g.fillRoundedRect(31, 44, 7, 15, 3);
      // shirt / torso
      g.fillStyle(0xff8c42, 1);
      g.fillRoundedRect(13, 29, 30, 23, 11);
      // torso core shading + rim light
      g.fillStyle(0xffa867, 0.7);
      g.fillRoundedRect(15, 30, 12, 18, 8);
      // arms
      g.fillStyle(0xf07a30, 1);
      g.fillCircle(13, 39, 6);
      g.fillCircle(43, 39, 6);
      // apron
      g.fillStyle(0xf4f1ea, 1);
      g.fillRoundedRect(19, 33, 18, 19, 7);
      g.fillStyle(0xdfd9cb, 1);
      g.fillRoundedRect(24, 44, 8, 7, 2); // pocket
      // head
      radial(cx, 18, 12, 0xffd9a8, 0xe8a86f, 14);
      // bandana cap
      g.fillStyle(0xd62828, 1);
      g.slice(cx, 18, 12, Math.PI, Math.PI * 2, false);
      g.fillPath();
      g.fillStyle(0xb71d1d, 1);
      g.fillTriangle(16, 14, 12, 9, 18, 9); // knot tail
      // face
      g.fillStyle(0x2a2233, 1);
      g.fillCircle(24, 19, 2);
      g.fillCircle(32, 19, 2);
      g.fillStyle(0xe87b5a, 0.6);
      g.fillCircle(22, 23, 2.2);
      g.fillCircle(34, 23, 2.2);
      // rim highlight
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(14, 30, 4, 18, 2);
      make("player", 56, 64);
    }

    // ---- customer (tintable; whites become the tint) -------------------
    // 44×48, origin-centred. Built so tint multiplies cleanly.
    {
      const cx = 22, cy = 22;
      g.fillStyle(0x000000, 0.22); // rim/edge darkening
      g.fillCircle(cx, cy, 17);
      g.fillStyle(0xffffff, 1); // body (takes the tint)
      g.fillCircle(cx, cy, 15.5);
      g.fillStyle(0x000000, 0.16); // soft bottom shading
      g.fillEllipse(cx + 3, cy + 6, 22, 16);
      g.fillStyle(0xffffff, 0.55); // top-left sheen (light tint)
      g.fillCircle(cx - 5, cy - 6, 6);
      g.fillStyle(0x241b14, 1); // eyes
      g.fillCircle(cx - 4, cy - 1, 2.6);
      g.fillCircle(cx + 4, cy - 1, 2.6);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx - 3.2, cy - 1.8, 0.9);
      g.fillCircle(cx + 4.8, cy - 1.8, 0.9);
      g.lineStyle(2, 0x241b14, 0.85); // smile
      g.beginPath();
      g.arc(cx, cy + 3, 5, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
      make("npc", 44, 48);
    }

    // ---- coin -----------------------------------------------------------
    {
      g.fillStyle(0x9c6a00, 1);
      g.fillCircle(12, 12, 11);
      radial(12, 12, 9.5, 0xffe27a, 0xe0a000, 12);
      g.fillStyle(0xfff4c2, 0.9); // gloss
      g.fillEllipse(9, 8, 7, 4);
      g.lineStyle(1.5, 0xffe9a0, 0.7);
      g.strokeCircle(12, 12, 7);
      make("coin", 24, 24);
    }

    // ---- food tokens (full colour, not tinted) -------------------------
    // Grilled pork skewer.
    {
      g.lineStyle(3, 0xb98a55, 1); // stick
      g.lineBetween(5, 26, 25, 4);
      g.lineStyle(3, 0xd9b27e, 0.6);
      g.lineBetween(6, 25, 26, 3);
      const chunk = (x: number, y: number) => {
        g.fillStyle(0x7a4423, 1);
        g.fillCircle(x, y, 5.5);
        g.fillStyle(0x9c5a2c, 1);
        g.fillCircle(x - 1, y - 1, 4);
        g.fillStyle(0xc77a3a, 0.8);
        g.fillCircle(x - 2, y - 2, 1.8);
        g.lineStyle(1, 0x3c2110, 0.7); // char mark
        g.lineBetween(x - 3, y + 1, x + 3, y + 1);
      };
      chunk(9, 21);
      chunk(15, 15);
      chunk(21, 9);
      make("food_skewer", 30, 30);
    }
    // Pad Thai noodle bowl.
    {
      g.fillStyle(0xe4ddcf, 1); // bowl
      g.slice(15, 14, 12, 0, Math.PI, false);
      g.fillPath();
      g.fillStyle(0xcfc6b4, 1);
      g.fillRect(3, 13, 24, 3);
      g.fillStyle(0xf2c14e, 1); // noodles
      for (let i = 0; i < 5; i++) {
        g.fillCircle(7 + i * 4, 12 - (i % 2), 2.6);
      }
      g.fillStyle(0xe05a3a, 1); // chilli / shrimp
      g.fillCircle(11, 10, 1.8);
      g.fillStyle(0x6cae54, 1); // spring onion
      g.fillCircle(19, 11, 1.8);
      g.fillStyle(0xffffff, 0.4); // steam-rim gloss
      g.fillEllipse(15, 9, 16, 4);
      make("food_noodle", 30, 30);
    }
    // Thai iced tea cup.
    {
      g.fillStyle(0xb86a2e, 1); // tea
      g.fillRoundedRect(8, 8, 14, 18, { tl: 2, tr: 2, bl: 5, br: 5 });
      g.fillStyle(0xd98b3e, 1);
      g.fillRoundedRect(9, 9, 12, 16, { tl: 2, tr: 2, bl: 4, br: 4 });
      g.fillStyle(0xf4e3c4, 1); // condensed-milk top
      g.fillRoundedRect(9, 9, 12, 5, 2);
      g.fillStyle(0xffffff, 0.35); // cup gloss
      g.fillRect(11, 12, 2, 12);
      g.lineStyle(3, 0xf06fae, 1); // straw
      g.lineBetween(18, 3, 14, 24);
      make("food_tea", 30, 30);
    }
    // Som Tam (papaya salad).
    {
      g.fillStyle(0x6b3f1d, 1); // clay plate
      g.slice(15, 15, 12, 0, Math.PI, false);
      g.fillPath();
      g.fillStyle(0x86511f, 1);
      g.fillRect(3, 14, 24, 3);
      g.fillStyle(0xc9d65a, 1); // shredded papaya
      for (let i = 0; i < 7; i++) g.fillRect(5 + i * 3, 8 + (i % 3), 2, 6);
      g.fillStyle(0xe5532f, 1); // chilli
      g.fillCircle(10, 11, 1.6);
      g.fillCircle(20, 12, 1.6);
      g.fillStyle(0xf28c8c, 1); // tomato
      g.fillCircle(16, 9, 2);
      g.fillStyle(0x4f7a2e, 1); // long bean
      g.fillRect(8, 7, 9, 1.6);
      make("food_somtam", 30, 30);
    }
    // Moo Krata (domed BBQ hotpot).
    {
      g.fillStyle(0x2b2b3a, 1); // broth moat
      g.fillEllipse(15, 18, 26, 9);
      g.fillStyle(0xc98a3a, 0.7);
      g.fillEllipse(15, 18, 22, 6);
      radial(15, 13, 12, 0x8a8a9c, 0x3c3c50, 12); // metal dome
      g.fillStyle(0x6b3320, 1); // meat
      g.fillCircle(11, 11, 2.6);
      g.fillCircle(19, 12, 2.6);
      g.fillCircle(15, 8, 2.4);
      g.fillStyle(0xffffff, 0.3); // dome gloss
      g.fillEllipse(12, 7, 7, 3);
      make("food_krata", 30, 30);
    }

    // ---- customer cosmetics (origin-centred; cap is white → tintable) --
    // Conical straw hat.
    {
      g.fillStyle(0x6b4a22, 1); // brim shade
      g.fillEllipse(20, 22, 38, 11);
      g.fillStyle(0xd9b56b, 1); // brim
      g.fillEllipse(20, 21, 34, 9);
      g.fillTriangle(8, 21, 32, 21, 20, 4); // cone
      g.fillStyle(0xe8cb8c, 1);
      g.fillTriangle(12, 20, 20, 20, 18, 7); // cone highlight
      make("acc_straw", 40, 30);
    }
    // Top hair bun.
    {
      g.fillStyle(0x241b2e, 1);
      g.slice(20, 24, 13, Math.PI, Math.PI * 2, false); // hair cap (top half)
      g.fillPath();
      g.fillCircle(20, 8, 6); // bun
      g.fillStyle(0x3a2c44, 1);
      g.fillCircle(18, 6, 2.2); // bun highlight
      make("acc_bun", 40, 30);
    }
    // Baseball cap (white base; tinted per customer).
    {
      g.fillStyle(0xffffff, 1);
      g.slice(20, 20, 12, Math.PI, Math.PI * 2, false); // dome
      g.fillPath();
      g.fillEllipse(30, 20, 16, 6); // brim
      g.fillStyle(0xdddddd, 1);
      g.fillCircle(20, 9, 1.6); // button
      make("acc_cap", 40, 30);
    }
    // Round glasses.
    {
      g.lineStyle(2.5, 0x2a2233, 1);
      g.strokeCircle(11, 8, 6);
      g.strokeCircle(29, 8, 6);
      g.lineBetween(17, 8, 23, 8); // bridge
      g.fillStyle(0xbfe6ff, 0.35); // lens glint
      g.fillCircle(11, 8, 5);
      g.fillCircle(29, 8, 5);
      make("acc_glasses", 40, 16);
    }

    // ---- grill ----------------------------------------------------------
    // 100×68, origin-centred.
    {
      g.fillStyle(0x16161f, 1); // legs
      g.fillRect(10, 56, 6, 10);
      g.fillRect(84, 56, 6, 10);
      g.fillStyle(0x2d2d3c, 1); // body
      g.fillRoundedRect(4, 6, 92, 54, 12);
      g.fillStyle(0x3c3c50, 1);
      g.fillRoundedRect(8, 10, 84, 30, 8); // coal pit rim
      // glowing coal bed — flat ellipses (reads as a grill, not a bowl/wok)
      for (let i = 12; i >= 1; i--) {
        const f = i / 12;
        g.fillStyle(lerp(0xffb13a, 0x3a1304, (i - 1) / 11), 1);
        g.fillEllipse(50, 25, 82 * f, 26 * f);
      }
      g.fillStyle(0xffe08a, 0.6);
      g.fillCircle(40, 23, 3.5);
      g.fillCircle(58, 27, 2.6);
      g.fillCircle(68, 22, 2);
      // grill bars
      g.fillStyle(0x52525f, 1);
      for (let x = 14; x <= 86; x += 9) g.fillRoundedRect(x, 10, 3, 30, 1.5);
      g.fillStyle(0x6e6e80, 0.8);
      for (let x = 14; x <= 86; x += 9) g.fillRect(x, 10, 1.4, 30);
      // top metal highlight
      g.fillStyle(0x55556a, 1);
      g.fillRoundedRect(4, 6, 92, 5, 6);
      make("grill", 100, 68);
    }

    // ---- serving counter (wood) ----------------------------------------
    // 112×54, origin-centred.
    {
      g.fillStyle(0x3a230f, 1); // body shadow
      g.fillRoundedRect(0, 4, 112, 50, 9);
      g.fillStyle(0x6e421f, 1); // planks
      g.fillRoundedRect(2, 6, 108, 44, 7);
      g.lineStyle(2, 0x4f2f15, 1); // grain seams
      g.lineBetween(6, 24, 106, 24);
      g.lineBetween(6, 38, 106, 38);
      g.fillStyle(0x9c6b3f, 1); // top lip
      g.fillRoundedRect(6, 7, 100, 13, 5);
      g.fillStyle(0xb9854f, 0.8); // lip gloss
      g.fillRoundedRect(10, 9, 92, 4, 2);
      g.lineStyle(1, 0x5b3417, 0.5); // fine grain
      g.lineBetween(20, 30, 95, 30);
      g.lineBetween(14, 44, 100, 44);
      make("counter", 112, 54);
    }

    // ---- awning (scalloped; base cream + tintable stripes) -------------
    const AW_W = 280, AW_BODY = 30, SC_R = 14, AW_H = AW_BODY + SC_R;
    const scallopCount = AW_W / (SC_R * 2);
    {
      g.fillStyle(0xf6f1e6, 1);
      g.fillRoundedRect(0, 0, AW_W, AW_BODY, { tl: 12, tr: 12, bl: 0, br: 0 });
      for (let i = 0; i < scallopCount; i++) {
        g.fillCircle(SC_R + i * SC_R * 2, AW_BODY, SC_R);
      }
      make("awning_base", AW_W, AW_H);
    }
    {
      for (let i = 0; i < scallopCount; i += 2) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(i * SC_R * 2, 0, SC_R * 2, AW_BODY);
        g.fillCircle(SC_R + i * SC_R * 2, AW_BODY, SC_R);
      }
      g.fillStyle(0x000000, 0.12); // soft underside shade
      g.fillRect(0, AW_BODY - 6, AW_W, 6);
      make("awning_stripes", AW_W, AW_H);
    }

    // ---- paper lantern --------------------------------------------------
    // 56×74, origin-centred.
    {
      g.lineStyle(2, 0x4a2c0c, 1); // hanging string
      g.lineBetween(28, 0, 28, 8);
      g.fillStyle(0xe0a800, 1); // top cap
      g.fillRoundedRect(20, 6, 16, 6, 2);
      radial(28, 38, 22, 0xff6b3a, 0xc01818, 18); // body glow
      // ribs
      g.fillStyle(0x9c1414, 0.5);
      for (const rx of [16, 28, 40]) g.fillEllipse(rx, 38, 4, 44);
      g.fillStyle(0xffd27a, 0.4); // centre hot-spot
      g.fillEllipse(28, 36, 12, 26);
      g.fillStyle(0xe0a800, 1); // bottom cap
      g.fillRoundedRect(20, 62, 16, 6, 2);
      g.lineStyle(2, 0xe0a800, 1); // tassel
      g.lineBetween(28, 68, 28, 74);
      make("lantern", 56, 74);
    }

    g.destroy();

    this.scene.start("game");
    this.scene.launch("ui");
  }
}
