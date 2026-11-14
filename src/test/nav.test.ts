import { describe, it, expect } from "vitest";
import { createSim } from "@/game/sim";
import { navigation, missionKind } from "@/game/nav";
import { drawScene } from "@/components/game/StoryAnimation";

describe("navegación tipo GPS", () => {
  it("apunta al objetivo de la misión con distancia en metros y dirección", () => {
    const s = createSim("realista", "normal");
    s.quest.main = 1; // Agua del abismo -> hielo
    s.radar = [{ k: "hielo", dx: 0, dy: -80 }, { k: "hielo", dx: 200, dy: 0 }, { k: "capsula", dx: 40, dy: 0 }];
    const n = navigation(s);
    expect(missionKind(s)).toBe("hielo");
    expect(n.primary?.m).toBe(20);
    expect(n.primary?.dir).toBe("N");
    expect(n.then?.k).toBe("capsula");
    expect(n.etaS).toBeGreaterThan(0);
  });
  it("un alien cercano pasa a 'y luego' como advertencia", () => {
    const s = createSim("fantastico", "normal");
    s.quest.main = 3;
    s.radar = [{ k: "cohete", dx: 100, dy: 0 }, { k: "alien", dx: -30, dy: 10 }, { k: "capsula", dx: 10, dy: 0 }];
    const n = navigation(s);
    expect(n.primary?.k).toBe("cohete");
    expect(n.primary?.dir).toBe("E");
    expect(n.then?.warn).toBe(true);
  });
});

describe("cinemática animada", () => {
  it("dibuja cada una de las 4 escenas en varios momentos sin fallar", () => {
    const calls: string[] = [];
    const gradient = { addColorStop: () => {} };
    const g = new Proxy({}, {
      get: (_t, k) => (["fillStyle", "strokeStyle", "font", "globalAlpha", "globalCompositeOperation", "lineWidth"].includes(String(k)) ? "" : (..._a: unknown[]) => { calls.push(String(k)); return gradient; }),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    for (const sc of ["launch", "fail", "fall", "land"] as const) for (const t of [0, 1, 2.5, 4, 6.9]) drawScene(g, sc, t);
    expect(calls.filter((c) => c === "fillRect").length).toBeGreaterThan(100);
    expect(calls.filter((c) => c === "arc").length).toBeGreaterThan(500); // fire, smoke and dust particles
  });
});
