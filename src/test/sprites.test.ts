import { describe, it, expect } from "vitest";
import { makeSprites, HD } from "@/game/sprites";
import modulos from "@/data/modulos.json";

describe("HD sprites", () => {
  it("builds every texture at HD× its world size without errors", () => {
    const made: Record<string, [number, number]> = {};
    const g: Record<string, unknown> = {};
    const chain = () => g;
    for (const k of ["fillStyle", "fillRect", "fillCircle", "fillEllipse", "fillTriangle", "fillPoints", "lineStyle", "strokePoints", "strokeRect", "strokeCircle", "lineBetween"]) g[k] = chain;
    g["generateTexture"] = (key: string, w: number, h: number) => { made[key] = [w, h]; return g; };
    g["destroy"] = () => {};
    const scene = { add: { graphics: () => g } } as unknown as Phaser.Scene;
    makeSprites(scene);
    for (const key of ["astro", "ice", "reg", "scrap", "leak", "capsule", "al_abductor", "al_rastreador", "al_saboteador", "al_nodriza"]) expect(made[key]).toBeDefined();
    // module textures must match the footprint the game uses for placement
    for (const [tipo, t] of Object.entries(modulos.tipos)) expect(made[`m_${tipo}`]).toEqual([t.w * HD, t.h * HD]);
    // capsules are much bigger than scrap so they can't be confused
    expect(made["capsule"]![0] * made["capsule"]![1]).toBeGreaterThan(made["scrap"]![0] * made["scrap"]![1] * 4);
  });
});
