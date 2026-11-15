import { describe, it, expect } from "vitest";
import { createSim, step, usedSlots, meltIce, toolInfo, dropItem, moveToChest, moveFromChest, chestOf, WATER_TANK_KG, DAY_LEN } from "@/game/sim";
import { stepQuests } from "@/game/quests";

describe("inventory fixes", () => {
  it("water lives in the habitat tank and doesn't use inventory slots", () => {
    const s = createSim("realista", "normal");
    const before = usedSlots(s.inv);
    s.inv.agua = 600;
    expect(usedSlots(s.inv)).toBe(before);
  });
  it("melting ice stops when the tank is full and keeps the leftover ice", () => {
    const s = createSim("realista", "normal");
    s.inv.agua = WATER_TANK_KG - 10; s.inv.hielo = 10;
    expect(meltIce(s)).toBe(10);
    expect(s.inv.hielo).toBe(8);
    expect(meltIce(s)).toBe(0);
  });
  it("tools change how much each swing gathers", () => {
    const s = createSim("realista", "normal");
    expect(toolInfo(s).yield).toBe(1);
    s.inv.pala_mejorada = 1; expect(toolInfo(s).yield).toBe(2);
    s.inv.pala_titanio = 1; expect(toolInfo(s)).toMatchObject({ yield: 3, name: "Titanium shovel" });
  });
  it("dropping items leaves a bag on the ground (water can't be dropped)", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 5;
    expect(dropItem(s, "metal", 2, 200, 200)).toBe(2);
    expect(s.inv.metal).toBe(3);
    expect(s.drops[0]!.items).toMatchObject({ metal: 2 });
    s.inv.agua = 50;
    expect(dropItem(s, "agua", 10, 200, 200)).toBe(0);
  });
  it("storage chest holds items and gives them back", () => {
    const s = createSim("realista", "normal");
    s.inv.regolito = 30;
    expect(moveToChest(s, 77, "regolito", 30)).toBe(30);
    expect(s.inv.regolito).toBe(0);
    expect(chestOf(s, 77)["regolito"]).toBe(30);
    expect(moveFromChest(s, 77, "regolito", 10)).toBe(10);
    expect(s.inv.regolito).toBe(10);
  });
});

describe("visible usefulness", () => {
  it("machines report 'no power' when batteries are empty at night", () => {
    const s = createSim("realista", "normal");
    s.time = DAY_LEN + 10; s.battery = 0;
    step(s, 0.1, { inHabitat: true, inShadow: false });
    const plant = s.modules.find((m) => m.tipo === "electrolisis")!;
    expect(s.modStatus[plant.uid]).toBe("nopower");
    expect(s.alert).toMatch(/NO POWER/);
  });
});

describe("lunar missions archive", () => {
  it("starts with a few real missions and unlocks more with the story", () => {
    const s = createSim("realista", "normal");
    stepQuests(s);
    expect(s.archive).toContain("apollo11");
    expect(s.archive).not.toContain("apollo13");
    s.actFlags.leakFixed = true; stepQuests(s);
    expect(s.archive).toContain("apollo13");
    expect(s.notices.some((n) => n.text.startsWith("Apollo 13"))).toBe(true);
  });
});
