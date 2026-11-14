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
