import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import modulos from "@/data/modulos.json";
import { createSim, usedSlots, addItem, meltIce, drinkWater, pourWater, dropItem, craft, moveToChest, moveFromChest, pickUpDrop, toolInfo, cleanupInventory, step, WATER_TANK_KG, CHEST_SLOTS, SLOTS, STACK, TIPOS, type Inv } from "@/game/sim";
import { applyConsumable, CONSUMIBLES } from "@/game/effects";
import { bestTool, canMine, NODE_TIER } from "@/game/tools";
import { footprint, overlaps } from "@/game/solids";

const fresh = () => createSim("realista", "normal");

describe("water no longer fills the inventory", () => {
  it("water takes no slots, so a full tank leaves every slot free", () => {
    const s = fresh(); s.inv.agua = WATER_TANK_KG;
    const before = usedSlots(s.inv);
    s.inv.agua = 0;
    expect(usedSlots(s.inv)).toBe(before);
  });

  it("melting ice stops at the tank cap and keeps the leftover ice", () => {
    const s = fresh(); s.inv.hielo = 200; s.inv.agua = WATER_TANK_KG - 50; // 50 kg of room = 10 ice
    expect(meltIce(s)).toBe(50); expect(s.inv.agua).toBe(WATER_TANK_KG); expect(s.inv.hielo).toBe(190);
    expect(meltIce(s)).toBe(0); // tank is full: nothing is wasted
    expect(s.inv.hielo).toBe(190);
  });

  it("there is something to spend water on: drinking, medkits and stimulants", () => {
    const s = fresh(); s.inv.agua = 30; s.hydration = 40;
    expect(drinkWater(s)).toMatchObject({ ok: true }); expect(s.hydration).toBe(65); expect(s.inv.agua).toBe(26);
    s.hydration = 95; expect(drinkWater(s).ok).toBe(false); // not thirsty: refuses, keeps the water
    expect(s.inv.agua).toBe(26);
    s.inv.agua = 2; s.hydration = 10; expect(drinkWater(s).ok).toBe(false);
    expect(CONSUMIBLES).toContain("agua");
    const r = recetas.filter((x) => x.ingredientes && "agua" in x.ingredientes).map((x) => x.id);
    expect(r).toEqual(expect.arrayContaining(["botiquin", "estimulante"]));
  });

  it("water can be poured out of the tank", () => {
    const s = fresh(); s.inv.agua = 80;
    expect(pourWater(s, 50)).toBe(50); expect(s.inv.agua).toBe(30);
    expect(pourWater(s, 999)).toBe(30); expect(s.inv.agua).toBe(0);
  });

  it("medkits and stimulants are craftable with water and work", () => {
    const s = fresh(); s.inv.agua = 20; s.inv.metal = 1; s.inv.regolito = 2; s.near.taller = true;
    expect(craft(s, recetas.find((x) => x.id === "botiquin")!)).toBe(true); expect(s.inv.botiquin).toBe(1); expect(s.inv.agua).toBe(10);
    expect(craft(s, recetas.find((x) => x.id === "estimulante")!)).toBe(true); expect(s.inv.agua).toBe(4);
    s.health = 50; expect(applyConsumable(s, "botiquin")).toMatchObject({ ok: true }); expect(s.health).toBe(90);
    expect(applyConsumable(s, "botiquin").ok).toBe(false); // none left
  });
});

describe("throwing things away", () => {
  it("dropped items leave the inventory and appear on the ground as a thrown bag, merging nearby", () => {
    const s = fresh(); s.inv.chatarra = 10;
    expect(dropItem(s, "chatarra", 4, 100, 100)).toBe(4);
    expect(dropItem(s, "chatarra", 3, 104, 101)).toBe(3); // lands next to the first: merges
    expect(s.drops).toHaveLength(1); expect(s.drops[0]!.items["chatarra"]).toBe(7); expect(s.drops[0]!.kind).toBe("thrown"); expect(s.inv.chatarra).toBe(3);
    dropItem(s, "chatarra", 1, 200, 100); expect(s.drops).toHaveLength(2); // far away: separate bag
  });

  it("you can't drop more than you have, and water can't be thrown", () => {
    const s = fresh(); s.inv.metal = 2; s.inv.agua = 50;
    expect(dropItem(s, "metal", 99, 10, 10)).toBe(2);
    expect(dropItem(s, "metal", 1, 10, 10)).toBe(0);
    expect(dropItem(s, "agua", 10, 10, 10)).toBe(0); expect(s.inv.agua).toBe(50);
  });

  it("picking a bag up respects the inventory size and leaves the rest on the ground", () => {
    const s = fresh(); s.inv.metal = 0;
    s.drops.push({ id: 99, x: 50, y: 50, items: { metal: STACK * 40 }, kind: "thrown" });
    expect(pickUpDrop(s, 99)).toBe(false); // can't carry 40 stacks
    expect(s.drops.find((d) => d.id === 99)!.items["metal"]).toBeGreaterThan(0);
    expect(usedSlots(s.inv)).toBeLessThanOrEqual(SLOTS);
  });
});

describe("things that used to get lost", () => {
  it("water can stay on the hotbar so you can tap it to drink", () => {
    const s = fresh(); s.inv.agua = 20; s.hotbarItems[3] = "agua";
    cleanupInventory(s); expect(s.hotbarItems[3]).toBe("agua");
    s.inv.agua = 0; cleanupInventory(s); expect(s.hotbarItems[3]).toBeNull();
  });

  it("a full inventory (and no chest) pauses the ice drill instead of throwing the ice away", () => {
    const s = fresh();
    s.modules = s.modules.filter((m) => m.tipo !== "cofre"); // with a chest the drill stores ice there
    s.modules.push({ uid: 999, tipo: "taladro", x: 640, y: 520, durabilidad: 100, activo: true });
    for (const k of Object.keys(s.inv) as (keyof Inv)[]) if (k !== "agua" && k !== "hielo") s.inv[k] = 0;
    const filler = (Object.keys(s.inv) as (keyof Inv)[]).filter((k) => k !== "agua" && k !== "hielo" && k !== "regolito").slice(0, SLOTS); // regolith is burnt by the furnace
    for (const k of filler) s.inv[k] = 1; // every slot taken by something else
    expect(usedSlots(s.inv)).toBe(SLOTS);
    for (let i = 0; i < 600; i++) step(s, 0.1, { inHabitat: true, inShadow: false });
    expect(s.inv.hielo).toBe(0); expect(s.drillAcc).toBe(1); // waiting, nothing lost
    s.inv[filler[0]!] = 0; // free one slot
    step(s, 0.1, { inHabitat: true, inShadow: false });
    expect(s.inv.hielo).toBe(1);
  });
});

describe("storage chest", () => {
  it("you start with a chest in the base, and one can be crafted", () => {
    expect(modulos.iniciales.some((m) => m.tipo === "cofre")).toBe(true);
    const s = fresh(); s.inv.metal = 20; s.inv.chatarra = 20; s.near.taller = true;
    const r = recetas.find((x) => x.resultado && "cofre" in x.resultado)!;
    expect(craft(s, r)).toBe(true); expect(s.inv.cofre).toBe(1); expect(TIPOS.cofre.item).toBe("cofre");
  });

  it("deposits and withdrawals conserve every item and respect the capacity", () => {
    const s = fresh(); const uid = s.modules.find((m) => m.tipo === "cofre")!.uid; s.chests[String(uid)] = {}; s.inv.metal = 40; // start empty (no starter seeds)
    expect(moveToChest(s, uid, "metal", 25)).toBe(25); expect(s.inv.metal).toBe(15);
    expect(moveFromChest(s, uid, "metal", 10)).toBe(10); expect(s.inv.metal).toBe(25);
    s.inv.metal = STACK * (CHEST_SLOTS + 2);
    expect(moveToChest(s, uid, "metal", STACK * (CHEST_SLOTS + 2))).toBeLessThanOrEqual(STACK * CHEST_SLOTS); // full: refuses the rest, loses nothing
    expect(s.inv.metal + Object.values(s.chests[String(uid)] ?? {}).reduce((a, b) => a + b, 0)).toBe(STACK * (CHEST_SLOTS + 2) + 15);
  });
});

describe("tools matter", () => {
  it("each tool is faster than the one before and gathers more per hit", () => {
    const hands = bestTool({}), shovel = bestTool({ pala_mejorada: 1 }), ti = bestTool({ pala_titanio: 1, pala_mejorada: 1 }), plasma = bestTool({ pico_plasma: 1, pala_titanio: 1 });
    expect(shovel.cooldown).toBeLessThan(hands.cooldown); expect(ti.cooldown).toBeLessThan(shovel.cooldown); expect(plasma.cooldown).toBeLessThan(ti.cooldown);
    expect(hands.yield).toBe(1); expect(shovel.yield).toBeGreaterThan(hands.yield); expect(ti.yield).toBeGreaterThan(shovel.yield); expect(plasma.yield).toBeGreaterThan(ti.yield);
    expect(ti.key).toBe("pala_titanio"); // the best one wins when you own several
  });

  it("the mining code and the inventory panel read the same table", () => {
    const s = fresh();
    expect(toolInfo(s)).toMatchObject({ name: "Bare hands", yield: 1 });
    s.inv.pala_mejorada = 1; expect(toolInfo(s)).toMatchObject({ name: bestTool(s.inv).name, yield: bestTool(s.inv).yield, cd: bestTool(s.inv).cooldown });
  });

  it("the Plasma cutter (rare cave loot) opens every resource by itself", () => {
    expect(canMine({ pico_plasma: 1 }, "titanio").ok).toBe(true);
    expect(canMine({ pico_plasma: 1 }, "aleacion").ok).toBe(true);
  });

  it("each tier opens the next resource", () => {
    expect(canMine({}, "hielo").ok).toBe(true);
    expect(canMine({}, "titanio")).toEqual({ ok: false, need: "Better shovel" });
    expect(canMine({ pala_mejorada: 1 }, "titanio").ok).toBe(true);
    expect(canMine({ pala_mejorada: 1 }, "aleacion")).toEqual({ ok: false, need: "Titanium shovel" });
    expect(canMine({ pala_titanio: 1 }, "aleacion").ok).toBe(true);
    expect(Math.max(...Object.values(NODE_TIER))).toBe(2);
  });

  it("owning the Ice drill module item is NOT a hand tool any more", () => {
    expect(bestTool({ taladro: 1 }).key).toBeNull();
  });

  it("the ladder is reachable: the shovel needs only Metal, and the Titanium shovel needs the Titanium that the shovel unlocks", () => {
    const shovel = recetas.find((x) => x.id === "pala_mejorada")!, ti = recetas.find((x) => x.id === "pala_titanio")!;
    expect(Object.keys(shovel.ingredientes)).toEqual(["metal"]);
    expect(Object.keys(ti.ingredientes)).toContain("titanio");
    expect(NODE_TIER["titanio"]).toBeLessThanOrEqual(1);
  });
});

describe("every recipe can actually be made", () => {
  it("each result is reachable from raw resources (nothing needs its own output, nothing is orphaned)", () => {
    const raw = new Set(["hielo", "agua", "regolito", "chatarra", "titanio", "cristal_hielo", "aleacion", "metal", "kits", "alga_lunar", "papa", "trigo"]); // crops come from the farm
    const have = new Set(raw);
    for (let pass = 0; pass < 30; pass++) for (const r of recetas) if (Object.keys(r.ingredientes).every((k) => have.has(k))) for (const k of Object.keys(r.resultado)) have.add(k);
    const stuck = recetas.filter((r) => !Object.keys(r.resultado).every((k) => have.has(k))).map((r) => r.id);
    expect(stuck).toEqual([]);
    for (const r of recetas) for (const k of Object.keys(r.resultado)) expect(Object.keys(r.ingredientes)).not.toContain(k);
  });

  it("the starting base has no overlapping modules", () => {
    const fps = modulos.iniciales.map((m) => { const t = modulos.tipos[m.tipo as keyof typeof modulos.tipos]; return footprint(m.x, m.y, t.w, t.h); });
    for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(overlaps(fps[i]!, fps[j]!), `${modulos.iniciales[i]!.tipo} vs ${modulos.iniciales[j]!.tipo}`).toBe(false);
  });

  it("addItem still refuses when the 20 slots are really full", () => {
    const s = fresh();
    for (const k of ["hielo", "regolito", "titanio", "cristal_hielo", "aleacion", "paneles", "baterias", "taladro", "horno", "torres_luz", "pieza_motor", "aislamiento", "criotanque", "planta_electrolisis", "botiquin", "estimulante", "pala_mejorada", "baton"] as (keyof Inv)[]) s.inv[k] = STACK;
    expect(usedSlots(s.inv)).toBeGreaterThanOrEqual(SLOTS - 2);
    s.inv.chatarra = STACK; s.inv.metal = STACK;
    expect(addItem(s, "kits", 1)).toBe(false);
  });
});
