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
    expect(s.log[0]!.text).toBe(`Day ${s.day}: you crafted sealant kit`);
  });
  it("recetas de taller requieren estar cerca del Taller", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 10; s.inv.chatarra = 10;
    expect(recipeBlock(s, R("bateria"))).toBe("Go to the Workshop");
    s.near.taller = true;
    expect(recipeBlock(s, R("bateria"))).toBeNull();
  });
  it("aislamiento (3 regolito + 1 chatarra) solo junto al Horno", () => {
    const s = createSim("realista", "normal");
    s.inv.regolito = 3; s.inv.chatarra = 1;
    expect(recipeBlock(s, R("aislamiento"))).toBe("Go to the Furnace");
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

import { SUBSISTEMAS, repairSubsystem, repairBlock } from "@/game/sim";
import { launchBlockers } from "@/game/mission";
const SUB = (id: string) => SUBSISTEMAS.find((x) => x.id === id)!;

describe("reparación del cohete", () => {
  it("las recetas de planta, criotanque y pieza de motor están disponibles", () => {
    for (const id of ["planta_electrolisis", "criotanque", "pieza_motor"]) expect(R(id).disponible).toBe(true);
  });
  it("reparar Estructura consume 4 metal y sube 25%", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 4;
    const before = s.rocket["Structure"]!;
    expect(repairSubsystem(s, SUB("Structure"))).toBe(true);
    expect(s.inv.metal).toBe(0);
    expect(s.rocket["Structure"]).toBe(before + 25);
  });
  it("Propulsión no se repara con fugas en los tanques", () => {
    const s = createSim("realista", "normal");
    s.inv.pieza_motor = 1;
    s.leaks.push({ id: 1, target: "lh2", x: 0, y: 0, size: 1, progress: 0, age: 0 });
    expect(repairBlock(s, SUB("Propulsion"))).toBe("Seal the tank leaks first");
    s.leaks = [];
    expect(repairSubsystem(s, SUB("Propulsion"))).toBe(true);
  });
  it("Comunicaciones se topa en 50% sin CubeSat relé", () => {
    const s = createSim("realista", "normal");
    s.inv.metal = 20; s.inv.chatarra = 20; s.inv.vidrio_solar = 10; // ☀ day-only glass is part of the repair now
    while (repairSubsystem(s, SUB("Communications")));
    expect(s.rocket["Communications"]).toBe(50);
    expect(repairBlock(s, SUB("Communications"))).toBe("Needs the CubeSat relay");
    s.relay = true;
    expect(repairSubsystem(s, SUB("Communications"))).toBe(true);
  });
  it("el despegue lista todo lo que falta", () => {
    const s = createSim("realista", "normal");
    const b = launchBlockers(s);
    expect(b.some((x) => x.startsWith("Subsystems"))).toBe(true);
        expect(b.some((x) => x.includes("CubeSat"))).toBe(true);
  });
});
