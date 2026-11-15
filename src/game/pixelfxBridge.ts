import type Phaser from "phaser";
import { createFrame, clearFrame, createFx, composite } from "./pixelfx/core/index.js";
import * as energyCore from "./pixelfx/fx/scifi/energy-core.js";
import * as empBlast from "./pixelfx/fx/scifi/emp-blast.js";
import * as collectBurst from "./pixelfx/fx/pickups/collect-burst.js";
import * as crystalShard from "./pixelfx/fx/pickups/crystal-shard.js";
import * as critHit from "./pixelfx/fx/impacts/crit-hit.js";
import * as groundSlam from "./pixelfx/fx/impacts/ground-slam.js";
import * as bigExplosion from "./pixelfx/fx/explosions/big-explosion.js";
import * as frostNova from "./pixelfx/fx/ice/frost-nova.js";
import * as brazier from "./pixelfx/fx/fire/brazier.js";

export const FX_CATALOG = {
  energyCore,
  empBlast,
  collectBurst,
  crystalShard,
  critHit,
  groundSlam,
  bigExplosion,
  frostNova,
  brazier,
} as const;

export type FxKind = keyof typeof FX_CATALOG;

interface ActiveFx {
  wx: number;
  wy: number;
  fx: ReturnType<typeof createFx>;
}

const FX_W = 320;
const FX_H = 180;

/**
 * Renders live `patch-gg/pixelfx` procedural pixel-art VFX + additive light
 * onto a 320×180 CanvasTexture scaled 2× over the 640×360 camera viewport.
 */
export class PixelfxOverlay {
  frame = createFrame(FX_W, FX_H);
  tex: Phaser.Textures.CanvasTexture | null = null;
  imgData: ImageData | null = null;
  sprite: Phaser.GameObjects.Image | null = null;
  active: ActiveFx[] = [];

  constructor(scene: Phaser.Scene) {
    if (scene.textures.exists("pixelfx_canvas")) scene.textures.remove("pixelfx_canvas");
    this.tex = scene.textures.createCanvas("pixelfx_canvas", FX_W, FX_H);
    if (this.tex) {
      this.imgData = new ImageData(FX_W, FX_H);
      this.sprite = scene.add.image(0, 0, "pixelfx_canvas").setOrigin(0).setScale(2).setDepth(23.5);
    }
  }

  spawn(kind: FxKind, wx: number, wy: number, opts: Record<string, unknown> = {}) {
    if (this.active.length > 24) this.active.shift();
    const mod = FX_CATALOG[kind];
    const fx = createFx(mod, { x: 0, y: 0, ...opts });
    this.active.push({ wx, wy, fx });
  }

  update(scene: Phaser.Scene, dt: number) {
    if (!this.tex || !this.imgData || !this.sprite) return;
    const v = scene.cameras.main.worldView;
    const rx = Math.floor(v.x);
    const ry = Math.floor(v.y);
    this.sprite.setPosition(rx, ry);

    for (const item of this.active) {
      item.fx.x = Math.round((item.wx - rx) / 2);
      item.fx.y = Math.round((item.wy - ry) / 2);
      item.fx.update(dt);
    }
    this.active = this.active.filter((item) => !item.fx.done());

    if (!this.active.length) {
      this.sprite.setVisible(false);
      return;
    }
    this.sprite.setVisible(true);
    clearFrame(this.frame);
    for (const item of this.active) {
      if (item.fx.x < -48 || item.fx.x > FX_W + 48 || item.fx.y < -48 || item.fx.y > FX_H + 48) continue;
      item.fx.draw(this.frame, "back");
      item.fx.draw(this.frame, "front");
    }
    composite(this.frame, this.imgData.data, null);
    this.tex.getContext().putImageData(this.imgData, 0, 0);
    this.tex.refresh();
  }
}
