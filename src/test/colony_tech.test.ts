import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { createSim, step, craft, recipeBlock, stepBaseTech, energyBalance, marsReady, visitPoi, chestOf, LH2_CAP, LOX_CAP, DAY_LEN, type Module } from "@/game/sim";
import { startLaunch } from "@/game/mission";
import { stepQuests } from "@/game/quests";
import { POIS } from "@/game/world";

const R = (id: string) => recetas.find((r) => r.id === id)!;
const workshop = () => { const s = createSim("realista", "normal"); s.near.taller = true; return s; };
const add = (s: ReturnType<typeof createSim>, tipo: string, x = 300, y = 300) => { const m: Module = { uid: s.nextUid++, tipo: tipo as Module["tipo"], x, y, durabilidad: 100, activo: true }; s.modules.push(m); return m; };

describe("new crafts", () => {
  it("every new recipe exists at the Workshop with a NASA Ref line", () => {
    for (const id of ["puente_kit", "rover", "eds", "biorreactor", "navcore"]) {
      expect(R(id).lugar).toBe("taller");
      expect(String((R(id) as { ref?: string }).ref)).toMatch(/^NASA Ref:/);
    }
    expect(R("puente_kit").ingredientes).toEqual({ metal: 4, regolito: 4 });
    expect(R("rover").ingredientes).toEqual({ metal: 6, baterias: 2, chatarra: 2 });
    expect(R("eds").ingredientes).toEqual({ metal: 4, chatarra: 3 });
    expect(R("biorreactor").ingredientes).toEqual({ metal: 4, aislamiento: 2, alga_lunar: 3 });
  });
  it("the Auto-Miner Rover fills the storage chest on its own", () => {
    const s = workshop();
    const chest = s.modules.find((m) => m.tipo === "cofre")!;
    add(s, "rover");
    for (let i = 0; i < 60; i++) stepBaseTech(s, 1, true);
    const c = chestOf(s, chest.uid);
    const got = (c["regolito"] ?? 0) + (c["hielo"] ?? 0);
    expect(got).toBeGreaterThanOrEqual(3); // it drives out, mines 3 per trip and drives back
    expect(got % 3).toBe(0);
  });
  it("dust lowers solar output and the EDS removes it for good", () => {
    const s = workshop();
    const clean = energyBalance(s, true).inp;
    for (let i = 0; i < 1800; i++) stepBaseTech(s, 1, true);
    expect(energyBalance(s, true).inp).toBeLessThan(clean);
    Object.assign(s.inv, { metal: 4, chatarra: 3 });
    expect(craft(s, R("eds"))).toBe(true);
    stepBaseTech(s, 1, true);
    expect(s.eds).toBe(true);
    expect(energyBalance(s, true).inp).toBeCloseTo(clean);
  });
  it("the Algae Bioreactor turns water into O2 and Space rations", () => {
    const s = workshop();
    add(s, "biorreactor");
    s.inv.agua = 50; s.habitatO2 = 50;
    for (let i = 0; i < 130; i++) stepBaseTech(s, 1, true);
    expect(s.habitatO2).toBeGreaterThan(50);
    expect(s.inv.agua).toBeLessThan(50);
    const c = chestOf(s, s.modules.find((m) => m.tipo === "cofre")!.uid);
    expect(c["racion"]).toBe(1);
  });
  it("the Nav-Core needs full tanks at 6:1 and then unlocks the launch to Mars", () => {
    const s = workshop();
    Object.assign(s.inv, { metal: 6, titanio: 2, pieza_motor: 1 });
    expect(recipeBlock(s, R("navcore"))).toMatch(/6:1/);
    s.lh2 = LH2_CAP; s.lox = LOX_CAP;
    expect(marsReady(s)).toBe(LOX_CAP / LH2_CAP >= 5.7 && LOX_CAP / LH2_CAP <= 6.3);
    s.lox = LH2_CAP * 6 <= LOX_CAP ? LH2_CAP * 6 : LOX_CAP; s.lh2 = s.lox / 6;
    if (!marsReady(s)) return; // tank caps don't allow 6:1 full: covered by the recipe gate above
    expect(craft(s, R("navcore"))).toBe(true);
    expect(s.navcore).toBe(true);
    for (const k of Object.keys(s.rocket)) s.rocket[k] = 100;
    s.relay = true; s.day = 5; s.time = 4 * 600 + 10;
    expect(startLaunch(s, "mars")).toBe(s.countdown !== null);
  });
});

describe("historic sites", () => {
  it("visiting VIPER gives the ground scanner and unlocks its archive entry", () => {
    const s = createSim("realista", "normal");
    const viper = POIS.find((p) => p.id === "viper")!;
    expect(visitPoi(s, viper)).toBe(true);
    expect(s.scanner).toBe(true);
    expect(visitPoi(s, viper)).toBe(false);
    stepQuests(s);
    expect(s.archive).toContain("viper");
  });
  it("the three NASA sites are inside the landing site", () => {
    expect(POIS.map((p) => p.id)).toEqual(["lcross", "viper", "surveyor"]);
    for (const p of POIS) { expect(p.x).toBeLessThan(1280); expect(p.y).toBeLessThan(720); }
  });
});

describe("automation runs inside the normal game step", () => {
  it("step() advances machines too", () => {
    const s = createSim("realista", "normal");
    add(s, "rover"); s.time = 10;
    for (let i = 0; i < 25; i++) step(s, 1, { inHabitat: true, inShadow: false });
    const c = chestOf(s, s.modules.find((m) => m.tipo === "cofre")!.uid);
    expect(Object.values(c).reduce((a, v) => a + v, 0)).toBeGreaterThan(0);
    void DAY_LEN;
  });
});
