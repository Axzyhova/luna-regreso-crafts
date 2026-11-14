import { describe, it, expect } from "vitest";
import { createSim, DAY_LEN, UMBRAL_VERDE, type Sim } from "@/game/sim";
import { stepAliens, spawnAlien, hitAlien, inLight, trackerTarget, type World } from "@/game/aliens";
import { startLaunch, stepCountdown } from "@/game/mission";

const world = (over: Partial<World> = {}): World => ({ player: { x: 400, y: 300 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 640, h: 360, rnd: () => 0.5, ...over });
const night = (s: Sim) => { s.time = DAY_LEN + 10; };

describe("aliens", () => {
  it("no aparecen en modo Realista", () => {
    const s = createSim("realista", "normal"); night(s); s.alienT = 0;
    stepAliens(s, 1, world());
    expect(s.aliens).toHaveLength(0);
  });
  it("aparecen de noche en Fantástico y huyen al amanecer", () => {
    const s = createSim("fantastico", "normal"); night(s); s.alienT = 0;
    stepAliens(s, 0.1, world());
    expect(s.aliens.length).toBe(1);
    s.time = 10; // día
    stepAliens(s, 0.1, world());
    expect(s.aliens).toHaveLength(0);
  });
  it("el abductor llena la barra y te lleva si no estás en la luz", () => {
    const s = createSim("fantastico", "normal"); night(s); s.alienT = 99;
    const w = world();
    const a = spawnAlien(s, w, "abductor"); a.x = 400; a.y = 295;
    let abducted = false;
    for (let i = 0; i < 80 && !abducted; i++) abducted = stepAliens(s, 0.1, w).some((e) => e.type === "abducted");
    expect(abducted).toBe(true);
  });
  it("en el hábitat el abductor no puede llevarte", () => {
    const s = createSim("fantastico", "normal"); night(s); s.alienT = 99;
    const w = world({ inHabitat: true });
    const a = spawnAlien(s, w, "abductor"); a.x = 400; a.y = 295;
    for (let i = 0; i < 100; i++) stepAliens(s, 0.1, w);
    expect(s.abduction).toBe(0);
  });
  it("la luz del hábitat protege su radio", () => {
    const s = createSim("fantastico", "normal");
    expect(inLight(s, world(), 112, 172)).toBe(true);
    expect(inLight(s, world(), 400, 300)).toBe(false);
  });
  it("el rastreador ignora módulos apagados", () => {
    const s = createSim("fantastico", "normal");
    const a = spawnAlien(s, world(), "rastreador");
    for (const m of s.modules) m.activo = false;
    expect(trackerTarget(s, a)).toBeUndefined();
  });
  it("el saboteador que llega a un tanque causa una fuga", () => {
    const s = createSim("fantastico", "normal"); night(s); s.alienT = 99;
    const w = world();
    const a = spawnAlien(s, w, "saboteador"); a.target = "lox"; a.x = 565; a.y = 152;
    const ev = stepAliens(s, 0.2, w);
    expect(ev).toContainEqual({ type: "leak", target: "lox" });
  });
  it("tres golpes ahuyentan a un abductor", () => {
    const s = createSim("fantastico", "normal");
    const a = spawnAlien(s, world(), "abductor"); a.x = 100; a.y = 100;
    for (let i = 0; i < 3; i++) { const h = hitAlien(s, a.x + 5, a.y); expect(h).not.toBeNull(); }
    expect(s.aliens).toHaveLength(0);
  });
});

describe("cuenta regresiva", () => {
  const listo = (s: Sim) => { for (const k of Object.keys(s.rocket)) s.rocket[k] = 100; s.relay = true; s.day = 5; s.time = 4 * 600 + 10; s.lh2 = 25; s.lox = 150; };
  it("en Realista despega a los 10 s", () => {
    const s = createSim("realista", "normal"); listo(s);
    expect(startLaunch(s)).toBe(true);
    let r = null; for (let i = 0; i < 25 && !r; i++) { r = stepCountdown(s, 0.5); s.time += 0.5; }
    expect(r).toBe("launched");
  });
  it("con aliens aparece la Nodriza y su ataque puede abortar el despegue", () => {
    const s = createSim("fantastico", "normal"); listo(s);
    for (const k of Object.keys(s.rocket)) s.rocket[k] = UMBRAL_VERDE;
    expect(startLaunch(s)).toBe(true);
    const w = world({ rocket: { x: 540, y: 150 } });
    let r = null;
    for (let i = 0; i < 60 && !r; i++) { stepAliens(s, 0.5, w); r = stepCountdown(s, 0.5); s.time += 0.5; }
    expect(r).toBe("aborted");
  });
});
