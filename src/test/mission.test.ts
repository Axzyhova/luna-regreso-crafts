import { describe, it, expect } from "vitest";
import { createSim, CYCLE, UMBRAL_VERDE } from "@/game/sim";
import { shapeCells, canPlace, cubesatStats, cubesatIssues, relayBlock, launchRelay, currentWindow, nextWindow, windowsUntil, launchBlockers, launch, type Placed } from "@/game/mission";

const viable: Placed[] = [
  { uid: 1, id: "panel", x: 0, y: 0, rot: 0 },
  { uid: 2, id: "panel", x: 0, y: 1, rot: 0 },
  { uid: 3, id: "radio", x: 0, y: 2, rot: 0 },
  { uid: 4, id: "computadora", x: 2, y: 0, rot: 0 },
  { uid: 5, id: "bateria", x: 2, y: 1, rot: 0 },
];

describe("CubeSat relé", () => {
  it("girar una pieza 2x1 la vuelve 1x2", () => {
    expect(shapeCells([[1, 1]], 1).sort()).toEqual([[0, 0], [0, 1]]);
  });
  it("no se puede salir de la cuadrícula 3x6 ni encimar piezas", () => {
    expect(canPlace([], "estructura", 1, 0, 0)).toBe(false);
    expect(canPlace(viable, "computadora", 0, 0, 0)).toBe(false);
    expect(canPlace(viable, "computadora", 2, 5, 0)).toBe(true);
  });
  it("un diseño con radio, computadora, batería y paneles es viable", () => {
    expect(cubesatIssues(viable)).toEqual([]);
    expect(cubesatStats(viable).energia).toBeCloseTo(3.5);
  });
  it("sin paneles suficientes la energía queda negativa", () => {
    const sinPanel = viable.filter((p) => p.uid !== 2);
    expect(cubesatIssues(sinPanel).some((i) => i.startsWith("Energía negativa"))).toBe(true);
  });
  it("demasiadas estructuras superan el límite de masa", () => {
    const pesado: Placed[] = [...viable, { uid: 6, id: "estructura", x: 0, y: 4, rot: 0 }, { uid: 7, id: "estructura", x: 0, y: 5, rot: 0 }, { uid: 8, id: "estructura", x: 1, y: 3, rot: 1 }];
    expect(cubesatIssues(pesado).some((i) => i.startsWith("Demasiado pesado"))).toBe(true);
  });
  it("lanzar el relé gasta piezas y combustible y abre el contacto", () => {
    const s = createSim("realista", "normal");
    s.cubesat = viable; s.inv.metal = 10; s.inv.chatarra = 10; s.inv.regolito = 10;
    expect(relayBlock(s)).toMatch(/combustible/);
    s.lh2 = 10; s.lox = 60;
    expect(launchRelay(s)).toBe(true);
    expect(s.relay).toBe(true);
    expect(s.lh2).toBe(9); expect(s.lox).toBe(54);
    expect(s.logros).toContain("Contacto con la Tierra");
    expect(s.act).toBe(4);
  });
});

describe("ventanas de regreso", () => {
  it("V1 abre el día 3 al amanecer y se repite la última después", () => {
    const s = createSim("realista", "normal");
    s.day = 3; s.time = 2 * CYCLE + 10;
    expect(currentWindow(s)?.id).toBe("V1");
    s.time = 2 * CYCLE + 300;
    expect(currentWindow(s)).toBeNull();
    expect(nextWindow(s).id).toBe("V2");
    expect(windowsUntil(14).map((w) => w.abre_dia)).toEqual([3, 5, 8, 11, 14]);
  });
  it("solo se despega dentro de una ventana con el combustible que pide", () => {
    const s = createSim("realista", "normal");
    for (const k of Object.keys(s.rocket)) s.rocket[k] = UMBRAL_VERDE;
    s.relay = true; s.day = 5; s.time = 4 * CYCLE + 10;
    s.lh2 = 15; s.lox = 120;
    expect(launchBlockers(s).some((b) => b.startsWith("Tanques insuficientes para V2"))).toBe(true);
    s.lh2 = 20;
    expect(launchBlockers(s)).toEqual([]);
    expect(launch(s)).toBe(true);
    expect(s.result?.ventana).toBe("V2");
    expect(s.logros).toContain("Regreso a casa");
  });
});
