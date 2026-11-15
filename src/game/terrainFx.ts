import type Phaser from "phaser";
import { ZONAS } from "./sim";

type PhaserLib = typeof Phaser;
type Rect = [number, number, number, number];

/**
 * Phase 2 — living terrain. Static detail is painted once by paintRichTerrain; this adds a cheap
 * animated layer on top: pulsing lava cracks (Scorch Fields), translucent ice veins with twinkling
 * frost (Frozen Basin + Shadowed Crater), breathing bioluminescence (Alien Hive) and drifting dust
 * motes around the camera. Everything is a handful of Graphics + pooled images driven by tweens.
 */
export class TerrainFx {
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(P: PhaserLib, scene: Phaser.Scene, crater: { x: number; y: number; rx: number; ry: number }) {
    const R = P.Math.Between, F = P.Math.FloatBetween;
    const rect = (id: string) => ZONAS.find((z) => z.id === id)?.rect as Rect | undefined;

    // Scorch Fields: branching lava veins + embers on an additive layer that breathes.
    const fire = rect("fire");
    if (fire) {
      const [x, y, w, h] = fire;
      const glow = scene.add.graphics().setDepth(2).setBlendMode(P.BlendModes.ADD);
      const core = scene.add.graphics().setDepth(2.1);
      for (let i = 0; i < 46; i++) {
        let cx = R(x + 20, x + w - 20), cy = R(y + 20, y + h - 20);
        const pts: [number, number][] = [[cx, cy]];
        for (let k = 0; k < 6; k++) { cx += R(-16, 16); cy += R(-10, 10); pts.push([cx, cy]); }
        for (const [lw, col, a] of [[5, 0xff5a1a, 0.18], [2.4, 0xff8a24, 0.35]] as const) {
          glow.lineStyle(lw, col, a).beginPath(); glow.moveTo(pts[0]![0], pts[0]![1]);
          for (const p of pts.slice(1)) glow.lineTo(p[0], p[1]);
          glow.strokePath();
        }
        core.lineStyle(0.6, 0xffe08a, 0.9).beginPath(); core.moveTo(pts[0]![0], pts[0]![1]);
        for (const p of pts.slice(1)) core.lineTo(p[0], p[1]);
        core.strokePath();
      }
      for (let i = 0; i < 90; i++) glow.fillStyle(0xff7a2a, F(0.15, 0.4)).fillCircle(R(x, x + w), R(y, y + h), F(0.6, 1.6));
      scene.tweens.add({ targets: glow, alpha: { from: 0.55, to: 1 }, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      scene.tweens.add({ targets: core, alpha: { from: 0.6, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: 300 });
    }

    // Frozen Basin + Shadowed Crater: translucent ice veins and twinkling frost glints.
    const ice = rect("ice");
    const veins = scene.add.graphics().setDepth(1.5);
    const twinkle = (cx: number, cy: number, n: number, spread: (i: number) => [number, number]) => {
      for (let i = 0; i < n; i++) {
        const [dx, dy] = spread(i);
        const s = scene.add.image(cx + dx, cy + dy, "fx_light").setDepth(2.2).setBlendMode(P.BlendModes.ADD)
          .setTint(P.Math.RND.pick([0xcfefff, 0x9fd8ff, 0xffffff])).setScale(F(0.03, 0.07)).setAlpha(0);
        scene.tweens.add({ targets: s, alpha: { from: 0, to: F(0.5, 0.9) }, scale: s.scale * 1.6, duration: R(500, 1100), yoyo: true, repeat: -1, delay: R(0, 4000), repeatDelay: R(1200, 4200) });
      }
    };
    if (ice) {
      const [x, y, w, h] = ice;
      for (let i = 0; i < 38; i++) {
        let cx = R(x + 20, x + w - 20), cy = R(y + 20, y + h - 20);
        veins.lineStyle(R(2, 4), 0xbfe8ff, 0.22).beginPath(); veins.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) { cx += R(-22, 22); cy += R(-8, 8); veins.lineTo(cx, cy); }
        veins.strokePath();
        veins.lineStyle(0.5, 0xffffff, 0.45).strokePath();
      }
      twinkle(x, y, 70, () => [R(10, w - 10), R(10, h - 10)]);
    }
    twinkle(crater.x, crater.y, 28, () => { const a = F(0, Math.PI * 2), r = Math.sqrt(Math.random()); return [Math.cos(a) * crater.rx * 0.9 * r, Math.sin(a) * crater.ry * 0.9 * r]; });

    // Alien Hive: organic veins and bioluminescent pods that slowly breathe.
    const hive = rect("hive");
    if (hive) {
      const [x, y, w, h] = hive;
      const org = scene.add.graphics().setDepth(1.6);
      for (let i = 0; i < 34; i++) {
        let cx = R(x + 20, x + w - 20), cy = R(y + 20, y + h - 20);
        org.lineStyle(R(2, 3), 0x2a1238, 0.85).beginPath(); org.moveTo(cx, cy);
        for (let k = 0; k < 5; k++) { cx += R(-18, 18); cy += R(-12, 12); org.lineTo(cx, cy); }
        org.strokePath();
      }
      for (let group = 0; group < 3; group++) {
        const bio = scene.add.graphics().setDepth(2.1).setBlendMode(P.BlendModes.ADD);
        for (let i = 0; i < 26; i++) {
          const px = R(x + 15, x + w - 15), py = R(y + 15, y + h - 15), c = P.Math.RND.pick([0x4fc26a, 0x9b4fd6, 0x5fe0c8]);
          bio.fillStyle(c, 0.16).fillCircle(px, py, R(5, 9));
          bio.fillStyle(c, 0.5).fillCircle(px, py, R(1, 2));
        }
        scene.tweens.add({ targets: bio, alpha: { from: 0.25, to: 1 }, duration: 2200 + group * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: group * 700 });
      }
    }

    // Floating regolith dust around the camera (very light).
    if ((scene.add as unknown as { particles?: unknown }).particles) {
      this.dust = scene.add.particles(0, 0, "fx_light", {
        x: { min: 0, max: 640 }, y: { min: 0, max: 400 }, lifespan: 7000, frequency: 260, quantity: 1,
        speedX: { min: 2, max: 9 }, speedY: { min: -3, max: 2 }, scale: { start: 0.025, end: 0.01 },
        alpha: { start: 0.35, end: 0 },
        tint: 0xd8d8e0, blendMode: P.BlendModes.ADD,
      }).setDepth(19);
    }
  }

  /** Keep the dust emitter over the visible area. */
  update(cam: Phaser.Cameras.Scene2D.Camera) {
    if (this.dust) { const v = cam.worldView; this.dust.setPosition(v.x, v.y); }
  }
}
