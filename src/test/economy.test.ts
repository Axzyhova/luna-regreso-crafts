import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import modulos from "@/data/modulos.json";
import { createSim, usedSlots, addItem, meltIce, drinkWater, craft, WATER_CAP, SLOTS, STACK, TIPOS, type Inv } from "@/game/sim";
import { applyConsumable, CONSUMIBLES } from "@/game/effects";
import { dropItem, nearestGround, pickUpGround, deposit, withdraw, depositAll, withdrawAll, chestRoom, chestUsed, CHEST_SLOTS, CHEST_STACK, chestByUid } from "@/game/storage";
import { bestTool, canMine, mineHit, NODE_TIER } from "@/game/tools";
import { footprint, overlaps } from "@/game/solids";

const fresh = () => createSim("realista", "normal");
const total = (s: ReturnType<typeof fresh>, k: string) => ((s.inv as unknown as Record<string, number>)[k] ?? 0) + s.ground.filter((g) => g.key === k).reduce((a, g) => a + g.n, 0) + s.modules.reduce((a, m) => a + (m.storage?.[k] ?? 0), 0);

describe("water no longer fills the inventory", () => {
  it("water takes no slots, so a full tank leaves every slot free", () => {
    const s = fresh(); s.inv.agua = WATER_CAP;
    const before = usedSlots(s.inv);
    s.inv.agua = 0;
    expect(usedSlots(s.inv)).toBe(before);
  });

  it("melting ice stops at the tank cap and keeps the leftover ice", () => {
    const s = fresh(); s.inv.hielo = 40; s.inv.agua = 100; // 50 kg of room = 10 ice
    const r = meltIce(s);
    expect(r.ice).toBe(10); expect(s.inv.agua).toBe(150); expect(s.inv.hielo).toBe(30); expect(r.full).toBe(true);
    expect(meltIce(s).ice).toBe(0); // tank is full: nothing is wasted
    expect(s.inv.hielo).toBe(30);
  });

  it("melting with room for everything uses all the ice", () => {
    const s = fresh(); s.inv.hielo = 6;
    const r = meltIce(s);
    expect(r).toMatchObject({ ice: 6, water: 30, full: false }); expect(s.inv.hielo).toBe(0);
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

  it("medkits and stimulants are craftable with water and work", () => {
    const s = fresh(); s.inv.agua = 20; s.inv.metal = 1; s.inv.regolito = 2; s.near.taller = true;
    expect(craft(s, recetas.find((x) => x.id === "botiquin")!)).toBe(true); expect(s.inv.botiquin).toBe(1); expect(s.inv.agua).toBe(10);
    expect(craft(s, recetas.find((x) => x.id === "estimulante")!)).toBe(true); expect(s.inv.agua).toBe(4);
    s.health = 50; expect(applyConsumable(s, "botiquin")).toMatchObject({ ok: true }); expect(s.health).toBe(90);
    expect(applyConsumable(s, "botiquin").ok).toBe(false); // none left
    s.health = 100; s.inv.botiquin = 1; expect(applyConsumable(s, "botiquin").ok).toBe(false); expect(s.inv.botiquin).toBe(1); // already healthy: not wasted
  });
});

describe("throwing things away", () => {
  it("dropped items leave the inventory and appear on the ground, merging nearby stacks", () => {
    const s = fresh(); s.inv.chatarra = 10;
    expect(dropItem(s, "chatarra", 4, { x: 100, y: 100 }).dropped).toBe(4);
    expect(dropItem(s, "chatarra", 3, { x: 104, y: 101 }).dropped).toBe(3); // lands next to the first: merges
    expect(s.ground).toHaveLength(1); expect(s.ground[0]!.n).toBe(7); expect(s.inv.chatarra).toBe(3);
    dropItem(s, "chatarra", 1, { x: 200, y: 100 }); expect(s.ground).toHaveLength(2); // far away: separate stack
  });

  it("you can't drop more than you have, and nothing is created from nothing", () => {
    const s = fresh(); s.inv.metal = 2;
    expect(dropItem(s, "metal", 99, { x: 10, y: 10 }).dropped).toBe(2);
    expect(dropItem(s, "metal", 1, { x: 10, y: 10 }).dropped).toBe(0);
    expect(total(s, "metal")).toBe(2);
  });

  it("water is poured out instead of thrown", () => {
    const s = fresh(); s.inv.agua = 80;
    const r = dropItem(s, "agua", 50, { x: 1, y: 1 });
    expect(r.dropped).toBe(50); expect(s.inv.agua).toBe(30); expect(s.ground).toHaveLength(0);
  });

  it("picking up respects the inventory size and leaves the rest on the ground", () => {
    const s = fresh(); s.inv.metal = 0; s.inv.chatarra = 0; s.inv.kits = 0;
    s.ground.push({ id: 1, x: 50, y: 50, key: "metal", n: STACK * 3 });
    // fill almost every slot with other things
    const slotsToFill = SLOTS - usedSlots(s.inv) - 1; // leave a single free slot
    for (let i = 0; i < slotsToFill; i++) { const k = (["hielo", "regolito", "titanio", "cristal_hielo", "aleacion", "paneles", "baterias", "taladro", "horno", "torres_luz", "pieza_motor", "aislamiento", "criotanque", "planta_electrolisis", "botiquin", "estimulante", "pala_mejorada"] as (keyof Inv)[])[i]!; s.inv[k] = STACK; }
    expect(usedSlots(s.inv)).toBe(SLOTS - 1);
    const got = pickUpGround(s, 1);
    expect(got).toBe(STACK); expect(s.ground[0]!.n).toBe(STACK * 2); // one slot's worth fit; the rest waits
    expect(nearestGround(s, 52, 52)?.id).toBe(1); expect(nearestGround(s, 400, 400)).toBeUndefined();
  });
});

describe("storage chest", () => {
  const withChest = () => { const s = fresh(); return { s, uid: s.modules.find((m) => m.tipo === "cofre")!.uid }; };

  it("you start with a chest in the base", () => {
    const { s, uid } = withChest();
    expect(chestByUid(s, uid)).toBeTruthy();
    expect(modulos.iniciales.some((m) => m.tipo === "cofre")).toBe(true);
  });

  it("deposits and withdrawals conserve every item", () => {
    const { s, uid } = withChest(); s.inv.metal = 40; s.inv.regolito = 30;
    const before = total(s, "metal") + total(s, "regolito");
    expect(deposit(s, uid, "metal", 25)).toBe(25); expect(s.inv.metal).toBe(15);
    expect(withdraw(s, uid, "metal", 10)).toBe(10); expect(s.inv.metal).toBe(25);
    expect(deposit(s, uid, "regolito", 999)).toBe(30);
    expect(total(s, "metal") + total(s, "regolito")).toBe(before);
    withdrawAll(s, uid); expect(chestUsed(chestByUid(s, uid)!.storage)).toBe(0); expect(s.inv.regolito).toBe(30);
  });

  it("has a capacity: it fills up and refuses more instead of eating items", () => {
    const { s, uid } = withChest();
    const c = chestByUid(s, uid)!; c.storage = {};
    const kinds = ["metal", "chatarra", "regolito", "hielo", "titanio", "aleacion", "paneles", "baterias", "taladro", "horno", "torres_luz", "pieza_motor"] as (keyof Inv)[];
    for (const k of kinds) s.inv[k] = CHEST_STACK * 2; // 2 slots each = 24 slots
    for (const k of kinds) expect(deposit(s, uid, k, CHEST_STACK * 2)).toBe(CHEST_STACK * 2);
    expect(chestUsed(c.storage)).toBe(CHEST_SLOTS);
    s.inv.kits = 5; expect(deposit(s, uid, "kits", 5)).toBe(0); expect(s.inv.kits).toBe(5); // full: nothing lost
    expect(chestRoom(c.storage, "metal")).toBe(0);
  });

  it("water can't go in a chest and 'deposit all' keeps your tools at hand", () => {
    const { s, uid } = withChest(); s.inv.agua = 50; s.inv.pala_mejorada = 1; s.inv.baton = 1; s.inv.metal = 5; s.inv.hielo = 3;
    expect(deposit(s, uid, "agua", 50)).toBe(0);
    depositAll(s, uid);
    expect(s.inv.agua).toBe(50); expect(s.inv.pala_mejorada).toBe(1); expect(s.inv.baton).toBe(1);
    expect(s.inv.metal).toBe(0); expect(s.inv.hielo).toBe(0);
    expect(chestByUid(s, uid)!.storage).toMatchObject({ metal: 5, hielo: 3 });
  });

  it("survives saving and loading", () => {
    const { s, uid } = withChest(); s.inv.metal = 12; deposit(s, uid, "metal", 12); dropItem(s, "chatarra", 1, { x: 5, y: 5 });
    const back = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(back.modules.find((m) => m.uid === uid)!.storage).toEqual({ metal: 12 });
  });

  it("a chest can be crafted at the workshop and placed like any module", () => {
    const s = fresh(); s.inv.metal = 3; s.inv.chatarra = 3; s.near.taller = true;
    expect(craft(s, recetas.find((x) => x.id === "cofre")!)).toBe(true);
    expect(s.inv.cofre).toBe(1); expect(TIPOS.cofre.item).toBe("cofre");
  });
});

describe("tools matter", () => {
  it("each tool is faster than the one before and gives a chance of a bonus unit", () => {
    const hands = bestTool({}), shovel = bestTool({ pala_mejorada: 1 }), ti = bestTool({ pala_titanio: 1, pala_mejorada: 1 });
    expect(shovel.cooldown).toBeLessThan(hands.cooldown); expect(ti.cooldown).toBeLessThan(shovel.cooldown);
    expect(hands.bonusChance).toBe(0); expect(shovel.bonusChance).toBeGreaterThan(0); expect(ti.bonusChance).toBeGreaterThan(shovel.bonusChance);
    expect(ti.key).toBe("pala_titanio"); // the best one wins when you own several
  });

  it("the shovel really yields more over many hits, and bare hands never do", () => {
    const rolls = (inv: Partial<Inv>) => { let n = 0; for (let i = 0; i < 1000; i++) n += mineHit(inv, () => (i % 100) / 100).amount; return n; };
    const hands = rolls({}), shovel = rolls({ pala_mejorada: 1 }), ti = rolls({ pala_titanio: 1 });
    expect(hands).toBe(1000); expect(shovel).toBeGreaterThan(1250); expect(ti).toBeGreaterThan(shovel);
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
    const raw = new Set(["hielo", "agua", "regolito", "chatarra", "titanio", "cristal_hielo", "aleacion", "metal", "kits"]);
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
