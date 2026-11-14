import { describe, it, expect } from "vitest";
import { electrolyze, splitO2, createSim, onDeath, DAY_LEN, NIGHT_LEN } from "@/game/sim";

describe("reglas de VARADOS", () => {
  it("la electrólisis separa H2:O2 en masa 1:8", () => {
    const r = electrolyze(9);
    expect(r.h2).toBeCloseTo(1);
    expect(r.o2).toBeCloseTo(8);
  });
  it("el O2 se envía al LOX hasta la mezcla 6:1", () => {
    expect(splitO2(8, 1, 0)).toEqual({ toLox: 6, rest: 2 });
  });
  it("día de 6 min y noche de 4 min", () => {
    expect(DAY_LEN).toBe(360);
    expect(NIGHT_LEN).toBe(240);
  });
  it("dos muertes en un acto reducen eventos 20% y dan pista", () => {
    const s = createSim("realista", "normal");
    onDeath(s); onDeath(s);
    expect(s.eventScale).toBeCloseTo(0.8);
    expect(s.hint).not.toBe("");
  });
});

import recetas from "@/data/recetas.json";
import { craft, recipeBlock, addItem, energyBalance, usedSlots } from "@/game/sim";
const R = (id: string) => recetas.find((r) => r.id === id)!;

describe("crafteo y módulos", () => {
  it("kit de reparación a mano: 2 chatarra + 1 metal", () => {
    const s = createSim("realista", "normal");
    s.inv.chatarra = 2; s.inv.metal = 1; s.inv.kits = 0;
    expect(craft(s, R("kit"))).toBe(true);
    expect(s.inv).toMatchObject({ chatarra: 0, metal: 0, kits: 1 });
    expect(s.log[0]!.text).toBe(`Día ${s.day}: fabricaste kit de reparación`);
  });
  it("recetas de taller requieren estar cerca del Taller", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 10; s.inv.chatarra = 10;
    expect(recipeBlock(s, R("bateria"))).toBe("Acércate al Taller");
    s.near.taller = true;
    expect(recipeBlock(s, R("bateria"))).toBeNull();
  });
  it("aislamiento (3 regolito + 1 chatarra) solo junto al Horno", () => {
    const s = createSim("realista", "normal");
    s.inv.regolito = 3; s.inv.chatarra = 1;
    expect(recipeBlock(s, R("aislamiento"))).toBe("Acércate al Horno");
    s.near.horno = true;
    expect(craft(s, R("aislamiento"))).toBe(true);
    expect(s.inv.aislamiento).toBe(1);
  });
  it("las pilas son de 50 y hay 20 espacios", () => {
    const s = createSim("realista", "normal");
    for (const k of Object.keys(s.inv) as (keyof typeof s.inv)[]) s.inv[k] = 0;
    s.inv.hielo = 51;
    expect(usedSlots(s.inv)).toBe(2);
    s.inv.hielo = 1000;
    expect(addItem(s, "hielo", 1)).toBe(false);
  });
  it("apagar un módulo quita su consumo del balance", () => {
    const s = createSim("realista", "normal");
    const before = energyBalance(s, false).out;
    s.modules.find((m) => m.tipo === "horno")!.activo = false;
    expect(energyBalance(s, false).out).toBe(before - 3);
  });
});

import { gainXp, toolFor, xpNeeded, toolCooldown } from "@/game/tools";
describe("herramientas", () => {
  it("cada material usa su herramienta", () => {
    expect(toolFor("hielo")).toBe("pala");
    expect(toolFor("ilmenita")).toBe("pico");
    expect(toolFor("chatarra")).toBe("cortador");
  });
  it("las herramientas suben de nivel al recolectar y se vuelven más rápidas", () => {
    const s = createSim("realista", "normal");
    for (let i = 0; i < xpNeeded(1); i++) gainXp(s, "pala");
    expect(s.tools.pala.nivel).toBe(2);
    expect(toolCooldown(2)).toBeLessThan(toolCooldown(1));
  });
  it("el pico se fabrica y luego se mejora", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 4; s.inv.chatarra = 2;
    expect(s.tools.pico.tiene).toBe(false);
    craft(s, R("pico")); expect(s.tools.pico.tiene).toBe(true);
    craft(s, R("pico")); expect(s.tools.pico.nivel).toBe(2);
  });
});
