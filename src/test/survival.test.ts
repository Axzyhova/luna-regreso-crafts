import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { createSim, step, craft, respawn, pickUpDrop, toggleSuit, unlock, cleanupInventory, VACUUM_DMG_S } from "@/game/sim";

const outside = { inHabitat: false, inShadow: false };
const inside = { inHabitat: true, inShadow: false };

describe("space suit", () => {
  it("outside without a suit the vacuum hurts fast and records the cause", () => {
    const s = createSim("realista", "normal");
    s.suit.worn = false;
    step(s, 1, outside);
    expect(s.health).toBeLessThanOrEqual(100 - VACUUM_DMG_S + 0.01);
    expect(s.lastHurt).toMatch(/vacuum/);
  });
  it("the suit wears out outside and refuses to come off outside", () => {
    const s = createSim("realista", "normal");
    const before = s.suit.integrity;
    for (let i = 0; i < 60; i++) step(s, 1, outside);
    expect(s.suit.integrity).toBeLessThan(before);
    expect(toggleSuit(s, false)).toMatch(/inside the habitat/);
    expect(s.suit.worn).toBe(true);
    expect(toggleSuit(s, true)).toBe("Suit off");
  });
  it("wearing it makes you thirsty; inside with it off you drink stored water", () => {
    const s = createSim("realista", "normal");
    for (let i = 0; i < 120; i++) step(s, 1, inside);
    expect(s.hydration).toBeLessThan(100);
    const thirsty = s.hydration;
    toggleSuit(s, true); s.inv.agua = 10;
    for (let i = 0; i < 10; i++) step(s, 1, inside);
    expect(s.hydration).toBeGreaterThan(thirsty);
    expect(s.inv.agua).toBeLessThan(10);
  });
  it("crafting a space suit at the workshop restores it to 100%", () => {
    const s = createSim("realista", "normal");
    s.suit.integrity = 10; s.near.taller = true;
    Object.assign(s.inv, { metal: 4, aislamiento: 2, chatarra: 3 });
    expect(craft(s, recetas.find((r) => r.id === "traje_espacial")!)).toBe(true);
    expect(s.suit.integrity).toBe(100);
    expect((s.inv as unknown as Record<string, number>)["traje_espacial"] ?? 0).toBe(0);
  });
});

describe("death and respawn", () => {
  it("respawning drops everything in a bag where you died and gives the spare suit", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 5; s.inv.kits = 2;
    s.dead = { cause: "froze to death", x: 300, y: 200 };
    respawn(s, { x: 110, y: 170 });
    expect(s.dead).toBeNull();
    expect(s.inv.metal).toBe(0);
    expect(s.drops).toHaveLength(1);
    expect(s.drops[0]).toMatchObject({ x: 300, y: 200 });
    expect(s.drops[0]!.items).toMatchObject({ metal: 5, kits: 2 });
    expect(s.suit).toMatchObject({ owned: true, worn: true, integrity: 40 });
    expect(pickUpDrop(s, s.drops[0]!.id)).toBe(true);
    expect(s.inv.metal).toBe(5);
    expect(s.drops).toHaveLength(0);
  });
});

describe("inventory and notifications", () => {
  it("items that run out leave the hotbar", () => {
    const s = createSim("realista", "normal");
    expect(s.hotbarItems[0]).toBe("kits");
    s.inv.kits = 0; cleanupInventory(s);
    expect(s.hotbarItems[0]).toBeNull();
  });
  it("unlocking an achievement queues a pop-up notice", () => {
    const s = createSim("realista", "normal");
    unlock(s, "First liter of LH2");
    expect(s.notices[0]).toMatchObject({ kind: "achievement", title: "Achievement unlocked", text: "First liter of LH2" });
  });
});
