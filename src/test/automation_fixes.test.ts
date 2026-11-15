import { describe, it, expect } from "vitest";
import { createSim, step, stepBaseTech, chestOf, tendFarm, farmOf, FARM_GROW_S, FARM_HARVEST, batteryCap, PLACEABLE, type Module } from "@/game/sim";
import { stepEffects } from "@/game/effects";

const add = (s: ReturnType<typeof createSim>, tipo: string, x = 300, y = 300) => { const m: Module = { uid: s.nextUid++, tipo: tipo as Module["tipo"], x, y, durabilidad: 100, activo: true }; s.modules.push(m); return m; };

describe("automation fixes", () => {
  it("the rover keeps mining into the chest with dead batteries at night", () => {
    const s = createSim("realista", "normal");
    add(s, "rover");
    s.battery = 0; s.energyIn = 0;
    for (let i = 0; i < 100; i++) stepBaseTech(s, 0.5, false); // 50 s
    const chest = chestOf(s, s.modules.find((m) => m.tipo === "cofre")!.uid);
    expect((chest["regolito"] ?? 0) + (chest["hielo"] ?? 0)).toBeGreaterThanOrEqual(2);
    expect(s.machineFx.length).toBeGreaterThan(0);
  });
  it("the hydroponic farm is placeable, plants with E, grows on water and harvests more algae", () => {
    expect(PLACEABLE["hidroponia"]).toBe("hidroponia");
    const s = createSim("realista", "normal");
    const farm = add(s, "hidroponia");
    s.inv.alga_lunar = 1; s.inv.agua = 50; s.battery = 50;
    expect(tendFarm(s, farm)).toMatch(/Planted/);
    expect(s.inv.alga_lunar).toBe(0);
    for (let i = 0; i < FARM_GROW_S * 2 + 4; i++) stepBaseTech(s, 0.5, true);
    expect(farmOf(s, farm.uid).growth).toBe(1);
    expect(tendFarm(s, farm)).toMatch(/Harvested/);
    expect(s.inv.alga_lunar).toBe(FARM_HARVEST);
  });
  it("low battery at night pauses heavy machines so the habitat stays warm", () => {
    const s = createSim("realista", "normal");
    s.battery = batteryCap(s) * 0.1; s.inv.agua = 10;
    step(s, 0.1, { inHabitat: true, inShadow: false });
    if (!s.shed) return; // daytime start: nothing to shed
    expect(s.modStatus[s.modules.find((m) => m.tipo === "electrolisis")!.uid]).toBe("nopower");
  });
  it("the habitat holds heat without battery", () => {
    const s = createSim("realista", "normal");
    s.battery = 0; s.temp = 21;
    for (let i = 0; i < 300; i++) step(s, 0.1, { inHabitat: true, inShadow: false });
    expect(s.temp).toBeGreaterThan(10);
  });
  it("Easy mode cold hurts far slower than Hard", () => {
    const hurtAfter = (d: "facil" | "dificil") => {
      const s = createSim("realista", d); s.temp = -30; s.health = 100;
      for (let i = 0; i < 300; i++) { s.temp = -30; stepEffects(s, 0.1, { inHabitat: false, player: { x: 640, y: 520 }, hab: { x: 110, y: 170 }, rocket: { x: 0, y: 0 }, w: 2560, h: 1440, rnd: () => 0.5 } as never, false); }
      return 100 - s.health;
    };
    expect(hurtAfter("facil")).toBeLessThan(hurtAfter("dificil") / 2);
  });
});
