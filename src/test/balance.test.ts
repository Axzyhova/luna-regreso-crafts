import { describe, it, expect } from "vitest";
import { createSim, step, BAL, LH2_CAP, LOX_CAP } from "@/game/sim";
import ventanas from "@/data/ventanas_regreso.json";

/** Runs the production chain with the starting base, as if the player stayed by the habitat. */
function produce(hielo: number, maxSeconds: number, untilLh2: number) {
  const s = createSim("realista", "normal");
  s.inv.agua = hielo * BAL.hielo_a_agua_kg;
  let t = 0;
  while (t < maxSeconds && s.lh2 < untilLh2) { step(s, 0.5, { inHabitat: true, inShadow: false }); t += 0.5; }
  return { s, t };
}

describe("balance: el regreso es alcanzable", () => {
  const masBarata = Math.min(...ventanas.ventanas.map((w) => w.lh2_kg));
  const masCara = Math.max(...ventanas.ventanas.map((w) => w.lh2_kg));
  it("las ventanas caben en los tanques", () => {
    for (const w of ventanas.ventanas) { expect(w.lh2_kg).toBeLessThanOrEqual(LH2_CAP); expect(w.lox_kg).toBeLessThanOrEqual(LOX_CAP); }
  });
  it("el hielo inicial del mapa (~36) alcanza para la ventana más barata", () => {
    const aguaNecesaria = masBarata * 9; // 1:8 en masa => 9 kg de agua por kg de H2
    expect(36 * BAL.hielo_a_agua_kg).toBeGreaterThanOrEqual(aguaNecesaria);
  });
  it(`con 45 hielos se llena la ventana más cara (${masCara} kg) en menos de 2 ciclos día/noche`, () => {
    const { s, t } = produce(45, 1200, masCara);
    expect(s.lh2).toBeGreaterThanOrEqual(masCara);
    expect(t).toBeLessThan(1200);
    expect(s.lox / s.lh2).toBeCloseTo(6, 0); // la mezcla se mantiene ~6:1
  });
});
