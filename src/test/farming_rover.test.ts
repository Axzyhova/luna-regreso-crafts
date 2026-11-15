import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { createSim, stepBaseTech, chestOf, tendFarm, farmOf, setRoverMat, roverSite, craft, WORLD, type Module } from "@/game/sim";
import { consumeItem } from "@/game/effects";
import { itemSources } from "@/game/sources";

const add = (s: ReturnType<typeof createSim>, tipo: string, x = 140, y = 230) => { const m: Module = { uid: s.nextUid++, tipo: tipo as Module["tipo"], x, y, durabilidad: 100, activo: true }; s.modules.push(m); return m; };
const R = (id: string) => recetas.find((r) => r.id === id)!;

describe("map", () => {
  it("is 30% smaller than before (2560x1440 → 1792x1008)", () => {
    expect(WORLD).toEqual({ w: 1792, h: 1008 });
  });
});

describe("Auto-Miner Rover trips", () => {
  it("drives out to the material, mines and brings it back to the chest", () => {
    const s = createSim("realista", "normal");
    const rover = add(s, "rover");
    expect(setRoverMat(s, rover, "chatarra")).toBe(true);
    const chest = s.modules.find((m) => m.tipo === "cofre")!;
    let left = false;
    for (let i = 0; i < 400; i++) { stepBaseTech(s, 0.25, true); if (Math.hypot(rover.rx! - rover.x, rover.ry! - rover.y) > 100) left = true; }
    expect(left).toBe(true); // it really travelled to the Scrapyard
    expect(chestOf(s, chest.uid)["chatarra"] ?? 0).toBeGreaterThanOrEqual(3);
  });
  it("can't reach the Hive's alloy until the bridge exists", () => {
    const s = createSim("realista", "normal");
    expect(roverSite(s, "aleacion", { x: 110, y: 170 })).toBeUndefined();
    s.bridge = true;
    expect(roverSite(s, "aleacion", { x: 110, y: 170 })?.zona).toBe("hive");
  });
});

describe("crops", () => {
  it("the base chest starts with seeds", () => {
    const s = createSim("realista", "normal");
    const chest = s.modules.find((m) => m.tipo === "cofre")!;
    expect(chestOf(s, chest.uid)["semilla_papa"]).toBe(2);
  });
  it("potatoes need watering, give seeds back and bake into food", () => {
    const s = createSim("realista", "normal");
    const farm = add(s, "hidroponia");
    s.inv.semilla_papa = 1; s.inv.agua = 40; s.battery = 50;
    expect(tendFarm(s, farm, "semilla_papa")).toMatch(/Planted Potatoes/);
    for (let i = 0; i < 40; i++) stepBaseTech(s, 1, true);
    expect(farmOf(s, farm.uid).growth).toBe(0); // dry
    for (let i = 0; i < 300 && farmOf(s, farm.uid).growth < 1; i++) { if (farmOf(s, farm.uid).water < 0.5) tendFarm(s, farm); stepBaseTech(s, 1, true); }
    expect(tendFarm(s, farm)).toMatch(/Harvested \+3 Potato/);
    expect(s.inv.papa).toBe(3);
    expect(s.inv.semilla_papa).toBe(1);
    s.near.horno = true;
    expect(craft(s, R("papa_horneada"))).toBe(true);
    s.health = 50;
    expect(consumeItem(s, "papa_horneada")).toBe(true);
    expect(s.health).toBe(80);
  });
  it("wheat becomes bread and cookies at the furnace", () => {
    expect(R("pan").lugar).toBe("horno");
    expect(R("galleta").ingredientes).toEqual({ trigo: 2, alga_lunar: 1 });
  });
});

describe("where materials come from", () => {
  it("names zones, caves, capsules, farms and recipes", () => {
    expect(itemSources("titanio").join(" ")).toMatch(/Titanium Quarry.*Scorch Fields/);
    expect(itemSources("titanio").join(" ")).toMatch(/Meteor caves/);
    expect(itemSources("hielo").join(" ")).toMatch(/Shadowed Crater/);
    expect(itemSources("semilla_trigo").join(" ")).toMatch(/Supply capsules/);
    expect(itemSources("trigo").join(" ")).toMatch(/Hydroponic farm/);
    expect(itemSources("kits").join(" ")).toMatch(/Craft at/);
  });
});

describe("rovers on the live map", () => {
  it("keep driving while only the rovers are stepped", async () => {
    const { stepRoversOnly } = await import("@/game/sim");
    const s = createSim("realista", "normal");
    const rover = add(s, "rover");
    const t0 = s.time;
    for (let i = 0; i < 20; i++) stepRoversOnly(s, 0.25);
    expect(Math.hypot(rover.rx! - rover.x, rover.ry! - rover.y)).toBeGreaterThan(50);
    expect(s.time).toBe(t0); // the rest of the world stays paused
  });
});
