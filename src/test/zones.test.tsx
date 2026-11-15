import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createSim, zoneAt, zoneBlock, reveal, buildBridge, upgradeModule, canUpgrade, moduleEnergy, batteryCap, step, FOG_COLS, FOG_ROWS, ZONAS } from "@/game/sim";
import { toggleEquip } from "@/game/effects";
import { stepHive, hitHive } from "@/game/zones";
import { MapPanel } from "@/components/game/MapPanel";
import { useGame, sim } from "@/game/store";

const Z = (id: string) => ZONAS.find((z) => z.id === id)!;

describe("zones and access", () => {
  it("finds the zone for a position", () => {
    expect(zoneAt(100, 100).id).toBe("base");
    expect(zoneAt(100, 900).id).toBe("ice");
    expect(zoneAt(1500, 100).id).toBe("fire");
    expect(zoneAt(1500, 900).id).toBe("hive");
  });
  it("the Scorch Fields need the Reflective cape; the Frozen Basin the Thermal suit", () => {
    const s = createSim("realista", "normal");
    expect(zoneBlock(s, Z("fire"))).toMatch(/Reflective cape/);
    s.inv.capa_reflectante = 1; toggleEquip(s, "capa_reflectante");
    expect(zoneBlock(s, Z("fire"))).toBeNull();
    expect(zoneBlock(s, Z("ice"))).toMatch(/Thermal suit/);
  });
  it("the Hive opens once a Bridge Kit is used at the ravine", () => {
    const s = createSim("realista", "normal");
    expect(zoneBlock(s, Z("hive"))).toMatch(/Bridge Kit/);
    expect(buildBridge(s)).toBe(false);
    s.inv.puente_kit = 1;
    expect(buildBridge(s)).toBe(true);
    expect(zoneBlock(s, Z("hive"))).toBeNull();
    expect(s.inv.puente_kit).toBe(0);
  });
  it("zone temperature makes the Frozen Basin freezing, and the thermal suit keeps you warm", () => {
    const s = createSim("realista", "normal");
    for (let i = 0; i < 60; i++) step(s, 1, { inHabitat: false, inShadow: false, zoneTemp: -45 });
    expect(s.temp).toBeLessThan(-30);
    s.inv.traje_termico = 1; toggleEquip(s, "traje_termico");
    for (let i = 0; i < 120; i++) step(s, 1, { inHabitat: false, inShadow: false, zoneTemp: -45 });
    expect(s.temp).toBeGreaterThan(5);
  });
  it("fog of war reveals cells around the player", () => {
    const s = createSim("realista", "normal");
    reveal(s, 110, 200);
    expect(s.explored).toHaveLength(FOG_COLS * FOG_ROWS);
    expect(s.explored.filter((v) => v === 1).length).toBeGreaterThan(5);
    expect(s.explored[FOG_COLS * FOG_ROWS - 1]).toBe(0);
  });
});

describe("hive creatures (every mode)", () => {
  it("exist even in Realistic mode, hurt you only inside the Hive, and drop alloy", () => {
    const s = createSim("realista", "normal");
    stepHive(s, 0.1, { x: 100, y: 100 }, () => 0.5);
    expect(s.hive.length).toBeGreaterThan(0);
    const c = s.hive[0]!;
    stepHive(s, 1, { x: 100, y: 100 }, () => 0.5); // player far away, in the landing site
    expect(s.health).toBe(100);
    stepHive(s, 1, { x: c.x + 2, y: c.y }, () => 0.5);
    expect(s.health).toBeLessThan(100);
    for (let i = 0; i < 3; i++) hitHive(s, c.x + 2, c.y);
    expect(s.inv.aleacion).toBe(1);
  });
});

describe("upgrades", () => {
  it("a level-2 solar panel makes 50% more power; batteries store more", () => {
    const s = createSim("realista", "normal");
    const panel = s.modules.find((m) => m.tipo === "panel")!;
    const before = moduleEnergy(panel, true);
    Object.assign(s.inv, { metal: 10, regolito: 10, chatarra: 10 });
    expect(canUpgrade(s, panel)).toBe(true);
    expect(upgradeModule(s, panel)).toBe(true);
    expect(moduleEnergy(panel, true)).toBeCloseTo(before * 1.5);
    const cap = batteryCap(s);
    expect(upgradeModule(s, s.modules.find((m) => m.tipo === "bateria")!)).toBe(true);
    expect(batteryCap(s)).toBeGreaterThan(cap);
  });
  it("level 3 needs materials from the new zones", () => {
    const s = createSim("realista", "normal");
    const panel = s.modules.find((m) => m.tipo === "panel")!;
    Object.assign(s.inv, { metal: 20, regolito: 20 });
    upgradeModule(s, panel);
    expect(canUpgrade(s, panel)).toBe(false); // needs titanium
    s.inv.titanio = 2;
    expect(upgradeModule(s, panel)).toBe(true);
    expect(panel.level).toBe(3);
  });
});

describe("map", () => {
  it("renders with explored percentage and locked zones", () => {
    useGame.getState().newGame("realista", "normal");
    reveal(sim, 110, 200); useGame.getState().publish();
    render(<MapPanel />);
    expect(screen.getByText("MAP")).toBeTruthy();
    expect(screen.getByText(/Explored \d+%/)).toBeTruthy();
    expect(screen.getByLabelText("World map")).toBeTruthy();
  });
});
