import { describe, it, expect } from "vitest";
import zonas from "@/data/zonas.json";
import modulos from "@/data/modulos.json";
import { HAB, ROCKET, SHADOW, RAVINE, BRIDGE_DECK } from "@/game/world";
import { missionHelp } from "@/game/nav";
import { createSim, zoneAt, WORLD } from "@/game/sim";

const rectOf = (id: string) => zonas.zonas.find((z) => z.id === id)!.rect as [number, number, number, number];

describe("world landmarks stay in step with the world size", () => {
  it("the habitat, rocket and crater are inside the landing site", () => {
    for (const p of [HAB, ROCKET, SHADOW]) expect(zoneAt(p.x, p.y).id).toBe("base");
    expect(HAB).toEqual({ x: modulos.iniciales[0]!.x, y: modulos.iniciales[0]!.y });
  });

  it("the ravine runs along the Alien Hive's edges, not through the landing site", () => {
    const [hx, hy, hw, hh] = rectOf("hive");
    expect(RAVINE[0]).toMatchObject({ x: hx, w: hw }); expect(RAVINE[0].y + RAVINE[0].h / 2).toBe(hy);
    expect(RAVINE[1]).toMatchObject({ y: hy, h: hh }); expect(RAVINE[1].x + RAVINE[1].w / 2).toBe(hx);
    for (const r of RAVINE) { expect(r.x + r.w).toBeLessThanOrEqual(WORLD.w + 4); expect(r.y + r.h).toBeLessThanOrEqual(WORLD.h + 4); }
  });

  it("the bridge deck crosses the ravine at the marked spot", () => {
    expect(BRIDGE_DECK.x + BRIDGE_DECK.w / 2).toBe(zonas.puente.x);
    expect(BRIDGE_DECK.y).toBeLessThan(RAVINE[0].y); expect(BRIDGE_DECK.y + BRIDGE_DECK.h).toBeGreaterThan(RAVINE[0].y + RAVINE[0].h);
  });

  it("mission hints quote the real coordinates", () => {
    const s = createSim("realista", "normal");
    s.quest.main = 3;
    expect(missionHelp(s)).toContain(`(${ROCKET.x}, ${ROCKET.y})`);
  });
});
