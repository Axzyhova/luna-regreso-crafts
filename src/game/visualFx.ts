import type Phaser from "phaser";
import { CYCLE, DAY_LEN, ZONAS, BRIDGE, type Sim } from "./sim";

export interface ShadowVec {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  alpha: number;
}

/** Position a 2.5D cast silhouette shadow under a sprite using the solar vector. */
export function updateSilhouetteShadow(
  spr: Phaser.GameObjects.Image,
  baseX: number,
  baseY: number,
  sh: ShadowVec,
  hd: number,
) {
  spr
    .setPosition(baseX + sh.ox * 1.4, baseY + sh.oy * 0.6)
    .setScale(sh.sx / hd, -0.42 * sh.sy / hd)
    .setTint(0x050814)
    .setAlpha(sh.alpha * 0.78);
}

/** Compute dynamic directional sun/moon shadow offset & scale from lunar time. */
export function sunShadow(time: number): ShadowVec {
  const t = time % CYCLE;
  if (t < DAY_LEN) {
    const p = t / DAY_LEN; // 0 = dawn (east sun -> west shadow), 0.5 = noon, 1 = dusk
    const angle = (p - 0.5) * 2; // -1 .. +1
    const k = Math.abs(angle) ** 1.4;
    const len = 0.85 + k * 1.5;            // short at noon, long at dawn/dusk
    // Fade in at sunrise and out at sunset so shadows don't pop.
    const edge = Math.min(1, t / 12, (DAY_LEN - t) / 12);
    return {
      ox: -angle * 9,
      oy: 1.5 + k * 1.5,
      sx: len,
      sy: 0.75 + k * 0.2,
      alpha: (0.5 - k * 0.12) * edge,
    };
  }
  // Night: only a faint moonlight shadow.
  return { ox: 1.5, oy: 1.5, sx: 0.95, sy: 0.8, alpha: 0.1 };
}

/** Generate soft radial light & directional flashlight cone textures procedurally. */
export function createFxTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists("fx_light")) {
    const c = scene.textures.createCanvas("fx_light", 128, 128);
    if (c) {
      const ctx = c.getContext();
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      c.refresh();
    }
  }
  if (!scene.textures.exists("fx_cone")) {
    const c = scene.textures.createCanvas("fx_cone", 160, 120);
    if (c) {
      const ctx = c.getContext();
      const grad = ctx.createRadialGradient(12, 60, 4, 90, 60, 130);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.6, "rgba(255,255,255,0.4)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(8, 60);
      ctx.lineTo(156, 8);
      ctx.lineTo(156, 112);
      ctx.closePath();
      ctx.fill();
      c.refresh();
    }
  }
  if (!scene.textures.exists("fx_spark")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
    g.generateTexture("fx_spark", 2, 2);
    g.destroy();
  }
}

/** Paint multi-layered lunar terrain, craters, magma fissures, ice veins, and hive spores. */
export function paintRichTerrain(
  PhaserLib: typeof Phaser,
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  W: number,
  H: number,
  SHADOW: { x: number; y: number; rx: number; ry: number },
  PAL: { moon0: number; moon1: number; moon2: number; moon3: number; space: number },
  fontKey: string,
  toFont: (s: string) => string,
) {
  const R = PhaserLib.Math.Between;
  const pick = <T,>(arr: T[]) => PhaserLib.Math.RND.pick(arr);

  // Landing Site base regolith layers
  g.fillStyle(PAL.moon1!).fillRect(0, 0, W, H);
  for (let i = 0; i < 45; i++) {
    g.fillStyle(pick([PAL.moon0!, PAL.moon2!, 0x3b3b47]), 0.25).fillEllipse(R(20, W - 20), R(20, H - 20), R(40, 120), R(20, 60));
  }
  for (let i = 0; i < 2400; i++) {
    g.fillStyle(pick([PAL.moon0!, PAL.moon2!, 0x55555f, 0x3a3a44]));
    g.fillRect(R(0, W * 2) / 2, R(0, H * 2) / 2, pick([0.5, 1, 1.5]), 0.5);
  }
  for (let i = 0; i < 120; i++) {
    const x = R(4, W - 4), y = R(4, H - 4), s = pick([1, 1.5, 2]);
    g.fillStyle(0x14141c).fillEllipse(x, y + 0.5, s * 2 + 1, s + 1);
    g.fillStyle(PAL.moon2!).fillEllipse(x, y, s * 2, s);
    g.fillStyle(PAL.moon3!).fillRect(x - s / 2, y - s / 2, s / 2, 0.5);
  }
  for (let i = 0; i < 32; i++) {
    const x = R(20, W - 20), y = R(20, H - 20), r = R(8, 20);
    g.fillStyle(PAL.moon0!).fillEllipse(x, y, r * 2, r * 1.4);
    g.fillStyle(PAL.moon2!).fillEllipse(x + 1, y - 1, r * 1.6, r);
    g.fillStyle(PAL.moon1!).fillEllipse(x + 2, y, r * 1.5, r * 0.9);
    g.fillStyle(PAL.moon3!, 0.6).fillEllipse(x - r * 0.35, y - r * 0.45, r * 0.9, 0.8);
    g.fillStyle(0x2a2a36, 0.7).fillEllipse(x + 1.5, y + r * 0.2, r * 1.1, r * 0.35);
  }

  // Shadowed Crater
  g.fillStyle(PAL.moon0!).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2 + 16, SHADOW.ry * 2 + 10);
  g.fillStyle(PAL.space!).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2, SHADOW.ry * 2);
  g.fillStyle(0x0b0b18).fillEllipse(SHADOW.x + 6, SHADOW.y + 4, SHADOW.rx * 1.6, SHADOW.ry * 1.5);
  g.lineStyle(1, PAL.moon3!, 0.5).strokeEllipse(SHADOW.x, SHADOW.y - 1, SHADOW.rx * 2 + 14, SHADOW.ry * 2 + 8);

  // Outer biomes
  for (const z of ZONAS) {
    if (z.id === "base") continue;
    const [x, y, w, h] = z.rect as [number, number, number, number];
    g.fillStyle(PhaserLib.Display.Color.HexStringToColor(z.suelo).color).fillRect(x, y, w, h);
    for (let i = 0; i < 1600; i++) {
      const c = z.id === "ice" ? pick([0x4a76a8, 0x9fd0ff, 0x223f66]) : z.id === "fire" ? pick([0x5a2a12, 0x9a4a20, 0x3a1a0a]) : pick([0x2a1838, 0x553366, 0x1e1028]);
      g.fillStyle(c).fillRect(x + R(0, w * 2) / 2, y + R(0, h * 2) / 2, pick([0.5, 1, 1.5]), 0.5);
    }
    if (z.id === "ice") {
      for (let i = 0; i < 42; i++) {
        const px = R(x + 14, x + w - 14), py = R(y + 14, y + h - 14);
        if (i % 3 === 0) {
          g.fillStyle(0x7fb8e8, 0.55).fillEllipse(px, py, R(24, 60), R(10, 22));
          g.lineStyle(0.6, 0xd8f2ff, 0.75).strokeEllipse(px, py, R(24, 60), R(10, 22));
        } else {
          g.fillStyle(0x14141c).fillTriangle(px - 4, py + 1, px + 4, py + 1, px, py - 11);
          g.fillStyle(0xbfe6ff).fillTriangle(px - 3, py, px + 3, py, px, py - 10);
          g.fillStyle(0xffffff).fillRect(px - 1, py - 7, 0.5, 5);
        }
      }
    }
    if (z.id === "fire") {
      for (let i = 0; i < 65; i++) {
        let cx = R(x + 14, x + w - 14), cy = R(y + 14, y + h - 14);
        g.lineStyle(2.2, 0x3a1a0a);
        g.beginPath(); g.moveTo(cx, cy);
        for (let k = 0; k < 5; k++) { cx += R(-14, 14); cy += R(-9, 9); g.lineTo(cx, cy); }
        g.strokePath();
        g.lineStyle(0.7, pick([0xf08a24, 0xf2d24f]), 0.95);
        g.strokePath();
      }
    }
    if (z.id === "hive") {
      for (let i = 0; i < 50; i++) {
        const px = R(x + 20, x + w - 20), py = R(y + 20, y + h - 20);
        g.fillStyle(0x14141c).fillEllipse(px, py, 9, 11);
        g.fillStyle(0x6a3a7a).fillEllipse(px, py, 7, 9);
        g.fillStyle(0x4fc26a, 0.65).fillEllipse(px - 1, py - 1, 3, 4);
      }
    }
    g.lineStyle(1, 0x000000, 0.35).strokeRect(x, y, w, h);
    scene.add.bitmapText(x + 12, y + 10, fontKey, toFont(z.nombre)).setScale(1.5).setTint(z.id === "ice" ? 0xcfe9ff : z.id === "fire" ? 0xffd0a0 : 0xd8b0ff).setDepth(3);
  }

  // Ravine around the Hive (aligned with 2560x1440 world borders W=1280, H=720)
  g.fillStyle(0x07070c).fillRect(W, H - 4, W, 8).fillRect(W - 4, H, 8, H);
  g.fillStyle(0x2a2a36).fillRect(W, H - 5, W, 1).fillRect(W - 5, H, 1, H);
  scene.add.image(BRIDGE.x + 16, BRIDGE.y - 12, "gate").setDepth(5).setScale(1 / 2);
}

/** Real-time RenderTexture night/crater darkness + always-on colored shader glows & god-rays. */
export class NightLighting {
  rt: Phaser.GameObjects.RenderTexture;
  brush: Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Image;
  flashlight: Phaser.GameObjects.Image;
  godRays: Phaser.GameObjects.Graphics;
  glowPool: Phaser.GameObjects.Image[] = [];
  // Sun-ray motion state: parallax anchor, spring lean from camera motion.
  private rayLastX = NaN; private rayLastY = NaN; private rayLean = 0; private rayLeanVel = 0;

  constructor(scene: Phaser.Scene) {
    this.rt = scene.add.renderTexture(0, 0, 640, 360).setOrigin(0).setDepth(20);
    // Off-screen helper stamps (never rendered directly on their own)
    this.brush = scene.make.image({ key: "fx_light", add: false });
    this.cone = scene.make.image({ key: "fx_cone", add: false }).setOrigin(0.08, 0.5);
    this.flashlight = scene.add.image(0, 0, "fx_cone").setOrigin(0.08, 0.5).setDepth(20.5).setBlendMode(1 /* ADD */).setTint(0xdbeeff).setAlpha(0);
    this.godRays = scene.add.graphics().setDepth(20.2).setBlendMode(1 /* ADD */);
    for (let i = 0; i < 18; i++) {
      this.glowPool.push(scene.add.image(0, 0, "fx_light").setDepth(20.4).setBlendMode(1 /* ADD */).setVisible(false));
    }
  }

  update(
    scene: Phaser.Scene,
    s: Sim,
    darkAlpha: number,
    inShadow: boolean,
    playerX: number,
    playerY: number,
    aimRad: number,
    lights: { x: number; y: number; r: number; color?: number; dayAlpha?: number }[],
  ) {
    const eclipse = s.event?.id === "eclipse" && s.event.phase === "activo";
    // Night is properly dark (a bit less on Realistic's softer setting); crater and eclipse darken day too.
    const night = darkAlpha > 0 ? Math.min(1, darkAlpha / 0.55) : 0;
    const effAlpha = Math.min(0.9, Math.max(night * 0.84, inShadow ? 0.55 : 0, eclipse ? 0.78 : 0));
    const v = scene.cameras.main.worldView;
    const rx = Math.floor(v.x) - 2, ry = Math.floor(v.y) - 2;
    const vw = Math.ceil(v.width) + 4, vh = Math.ceil(v.height) + 4;
    if (this.rt.width !== vw || this.rt.height !== vh) this.rt.resize(vw, vh); // always cover the whole view
    this.rt.setPosition(rx, ry);
    const inView = (x: number, y: number, pad: number) => x > rx - pad && x < rx + vw + pad && y > ry - pad && y < ry + vh + pad;

    // Daytime sun shafts: faint, only when it's bright.
    this.godRays.clear();
    const cycleT = s.time % CYCLE;
    if (cycleT < DAY_LEN && effAlpha < 0.3) {
      const p = cycleT / DAY_LEN;
      const warm = p < 0.15 || p > 0.85;
      this.godRays.fillStyle(warm ? 0xffb86b : 0xfff4d8, (warm ? 0.06 : 0.035) * (1 - effAlpha));
      const now = scene.time.now / 1000;
      // Camera motion this frame drives a damped spring: the shafts lean against your movement and settle back.
      const dx = Number.isNaN(this.rayLastX) ? 0 : rx - this.rayLastX, dy = Number.isNaN(this.rayLastY) ? 0 : ry - this.rayLastY;
      const target = Math.max(-45, Math.min(45, -dx * 6 - dy * 1.5));
      this.rayLeanVel = (this.rayLeanVel + (target - this.rayLean) * 0.06) * 0.86;
      this.rayLean += this.rayLeanVel;
      // Parallax: the shafts are "high above", so they slide at 55 % of the ground speed, and drift slowly.
      const spacing = 175, drift = now * 5;
      const offset = (((drift - rx * 0.55) % spacing) + spacing) % spacing;
      const skew = (p - 0.5) * 180 + this.rayLean;
      const base = (warm ? 0.06 : 0.035) * (1 - effAlpha);
      for (let i = -1; i * spacing < vw + spacing; i++) {
        const bx = rx + offset + i * spacing, wdt = 46 + 14 * Math.sin(i * 1.7 + now * 0.4);
        this.godRays.fillStyle(warm ? 0xffb86b : 0xfff4d8, base * (0.75 + 0.35 * Math.sin(now * 0.9 + i * 2.1)));
        this.godRays.fillTriangle(bx, ry - 10, bx + wdt, ry - 10, bx + wdt * 2 - skew, ry + vh + 10);
      }
    }
    this.rayLastX = rx; this.rayLastY = ry;

    // Coloured light pools: barely there by day, warm/cold halos at night.
    let gi = 0;
    for (const l of lights) {
      if (gi >= this.glowPool.length) break;
      if (!inView(l.x, l.y, l.r)) continue;
      const spr = this.glowPool[gi++]!;
      spr.setPosition(l.x, l.y).setScale((l.r * 0.9) / 64).setTint(l.color ?? 0xffc878)
        .setAlpha(effAlpha > 0.05 ? 0.1 + effAlpha * 0.16 : Math.min(0.05, l.dayAlpha ?? 0.05)).setVisible(true);
    }
    for (; gi < this.glowPool.length; gi++) this.glowPool[gi]!.setVisible(false);

    // Helmet flashlight: a visible pale-blue beam only when it's dark.
    this.flashlight.setPosition(playerX, playerY).setRotation(aimRad).setScale(0.8, 0.55).setAlpha(effAlpha > 0.1 ? 0.06 + effAlpha * 0.12 : 0);

    if (effAlpha <= 0.02) { this.rt.setVisible(false); return; }
    this.rt.setVisible(true);
    this.rt.clear();
    this.rt.fill(0x03050f, effAlpha);
    // Small halo around the astronaut (you can always see your feet)…
    this.brush.setScale(0.42).setAlpha(0.7);
    this.rt.erase(this.brush, playerX - rx, playerY - ry);
    // …and a long cone where the flashlight points.
    this.cone.setRotation(aimRad).setScale(0.9, 0.62).setAlpha(0.95);
    this.rt.erase(this.cone, playerX - rx, playerY - ry);
    // Base lights, towers, crystals, capsules: soft partial pools (night stays night).
    for (const l of lights) {
      if (!inView(l.x, l.y, l.r)) continue;
      this.brush.setScale((l.r * 0.62) / 64).setAlpha(0.78);
      this.rt.erase(this.brush, l.x - rx, l.y - ry);
    }
  }
}
