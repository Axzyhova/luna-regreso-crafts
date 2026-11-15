import type Phaser from "phaser";
import type { Sim } from "./sim";
import { view, setFx } from "./view";

type PhaserLib = typeof Phaser;
const RARE: Record<string, number> = { cristal_hielo: 0x9fe8ff, titanio: 0xd8e2ff, aleacion: 0xc77dff, alga_lunar: 0x7fffb0 };

/**
 * Phase 3 — post-processing & particles:
 *  - coloured danger vignette (red hypoxia, green radiation, blue cold, orange heat),
 *  - dust puffs under the boots (more when running), meteor streaks + impact sparks, android afterimages,
 *  - soft WebGL glow on rare resources,
 *  - automatic quality: if the game drops under ~40 FPS for a few seconds it switches to LOW.
 */
export class Phase3Fx {
  private vig: Phaser.GameObjects.Image;
  private glowed: Phaser.GameObjects.Image[] = [];
  private glowSeen = new WeakSet<object>();
  private impactSeen = new WeakSet<object>();
  private dustT = 0; private trailT = 0; private slowT = 0;
  private lastX = NaN; private lastY = NaN;
  private lastQ = view.fx;
  onAutoLow: (() => void) | null = null;

  constructor(private P: PhaserLib, private scene: Phaser.Scene) {
    if (!scene.textures.exists("fx_vig")) {
      const c = scene.textures.createCanvas("fx_vig", 256, 256);
      if (c) {
        const ctx = c.getContext();
        const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.55, "rgba(255,255,255,0.25)");
        grad.addColorStop(1, "rgba(255,255,255,1)");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256); c.refresh();
      }
    }
    this.vig = scene.add.image(0, 0, "fx_vig").setDepth(25.5).setAlpha(0);
  }

  get high() { return view.fx === "high"; }

  update(dt: number, s: Sim, player: { x: number; y: number }, running: boolean, nodes: { type: string; spr: Phaser.GameObjects.Image }[], androids: Iterable<Phaser.GameObjects.Image>) {
    const sc = this.scene, P = this.P, v = sc.cameras.main.worldView;
    if (this.lastQ !== view.fx) { this.lastQ = view.fx; this.setQuality(); } // changed from the Pause menu

    // Danger vignette, coloured by the worst condition, pulsing.
    const e = s.effects;
    const col = s.suitO2 < 25 ? 0xff2a2a : e.includes("radiacion") ? 0x4fff6a : e.includes("frio") ? 0x5ab8ff : e.includes("calor") ? 0xff8a24 : e.includes("miedo") ? 0x9b4fd6 : e.includes("aislamiento") ? 0x8a8a99 : e.includes("vertigo_gravedad") ? 0x5fe0c8 : e.includes("panico") ? 0xff5a8a : null;
    const pulse = (Math.sin(sc.time.now / 380) + 1) / 2;
    this.vig.setPosition(v.centerX, v.centerY).setDisplaySize(v.width + 4, v.height + 4)
      .setTint(col ?? 0x000000).setAlpha(col === null ? 0 : 0.35 + pulse * 0.3);

    // Auto quality.
    const fps = sc.game.loop.actualFps;
    if (this.high && fps > 0 && fps < 40) { this.slowT += dt; if (this.slowT > 4) { setFx("low"); this.lastQ = "low"; this.setQuality(); this.onAutoLow?.(); } } else this.slowT = 0;
    if (!this.high) { this.lastX = player.x; this.lastY = player.y; return; }

    // Boot dust.
    const moved = Number.isNaN(this.lastX) ? 0 : Math.hypot(player.x - this.lastX, player.y - this.lastY);
    this.lastX = player.x; this.lastY = player.y;
    this.dustT -= dt;
    if (moved > 0.15 && this.dustT <= 0) {
      this.dustT = running ? 0.06 : 0.14;
      const d = sc.add.image(player.x + P.Math.FloatBetween(-2, 2), player.y + 6, "fx_light").setTint(0xb8b8c4).setDepth(9).setScale(0.03).setAlpha(running ? 0.55 : 0.4);
      sc.tweens.add({ targets: d, y: d.y - P.Math.FloatBetween(1, 3), x: d.x + P.Math.FloatBetween(-3, 3), scale: 0.08, alpha: 0, duration: running ? 520 : 420, onComplete: () => d.destroy() });
    }

    // Meteor streaks: each new impact gets a falling trail and a burst of sparks.
    for (const imp of s.impacts as { x: number; y: number; t: number }[]) {
      if (this.impactSeen.has(imp)) continue;
      this.impactSeen.add(imp);
      const g = sc.add.graphics().setDepth(24).setBlendMode(P.BlendModes.ADD);
      const sx = imp.x - 46, sy = imp.y - 70;
      const o = { k: 0 };
      sc.tweens.add({ targets: o, k: 1, duration: 260, onUpdate: () => {
        const hx = sx + (imp.x - sx) * o.k, hy = sy + (imp.y - sy) * o.k;
        g.clear().lineStyle(2, 0xffb84a, 0.35).lineBetween(sx + (imp.x - sx) * Math.max(0, o.k - 0.35), sy + (imp.y - sy) * Math.max(0, o.k - 0.35), hx, hy);
        g.lineStyle(0.8, 0xfff0c0, 0.9).lineBetween(sx + (imp.x - sx) * Math.max(0, o.k - 0.15), sy + (imp.y - sy) * Math.max(0, o.k - 0.15), hx, hy);
      }, onComplete: () => {
        sc.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2, sp = sc.add.image(imp.x, imp.y, "fx_spark").setTint(P.Math.RND.pick([0xf2d24f, 0xf08a24, 0xffffff])).setDepth(24).setScale(0.5);
          sc.tweens.add({ targets: sp, x: imp.x + Math.cos(a) * P.Math.Between(6, 13), y: imp.y + Math.sin(a) * P.Math.Between(3, 8), alpha: 0, duration: 420, onComplete: () => sp.destroy() });
        }
      } });
    }

    // Android afterimages (cyan ghost trail).
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.09;
      for (const a of androids) {
        const ghost = sc.add.image(a.x, a.y, a.texture.key).setScale(a.scaleX, a.scaleY).setFlipX(a.flipX).setTint(0x66e0ff).setAlpha(0.35).setDepth(a.depth - 0.01).setBlendMode(P.BlendModes.ADD);
        sc.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
      }
    }

    // Soft glow on rare resource nodes (WebGL only).
    for (const n of nodes) {
      if (this.glowSeen.has(n.spr) || !(n.type in RARE)) continue;
      this.glowSeen.add(n.spr);
      const fx = (n.spr as unknown as { preFX?: { addGlow: (c: number, o: number, i: number, k: boolean, q: number, d: number) => unknown } }).preFX;
      if (fx) { fx.addGlow(RARE[n.type]!, 2, 0, false, 0.1, 6); this.glowed.push(n.spr); }
    }
  }

  /** Apply the current quality setting (LOW removes glows; particles stop in update()). */
  setQuality() {
    if (this.high) { this.glowSeen = new WeakSet(); return; }
    for (const spr of this.glowed) (spr as unknown as { preFX?: { clear: () => void } }).preFX?.clear();
    this.glowed = [];
  }
}
