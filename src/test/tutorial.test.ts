import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { createSim, craft, leakAllowed, nextLeakDelay, CYCLE, LEAKS_PER_DAY, DAY_LEN } from "@/game/sim";
import { stepTutorial, tutorialStep, TUTORIAL } from "@/game/tutorial";
import { stepAliens, spawnAlien, baseProtected, stealFromBase, ABANDON_S, type World } from "@/game/aliens";

const world = (over: Partial<World> = {}): World => ({ player: { x: 600, y: 330 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 640, h: 360, rnd: () => 0.5, ...over });

describe("tutorial", () => {
  it("walks through goal → move → suit → scrap → inventory → craft → seal → map → missions → base → build → ice → water → thermal suit", () => {
    const s = createSim("realista", "normal");
    expect(tutorialStep(s)?.id).toBe("goal");
    expect(tutorialStep(s)?.ack).toBe(true); // info step: GOT IT button
    s.tut.acks.push("goal"); stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("move");
    s.tut.moved = 50; stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("suit");
    s.tut.acks.push("suit"); stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("scrap");
    s.inv.chatarra = 4; stepTutorial(s);
    s.tut.invOpened = true; stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("craft");
    expect(craft(s, recetas.find((r) => r.id === "kit")!)).toBe(true);
    stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("seal");
    s.actFlags.leakFixed = true; stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("map");
    s.tut.seen.push("mapa", "misiones", "base"); stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("build");
    s.tut.built = true; s.stats.hielo = 2; s.inv.agua = 10; stepTutorial(s);
    expect(tutorialStep(s)?.id).toBe("thermal");
    s.tut.acks.push("thermal"); stepTutorial(s);
    expect(s.tut.step).toBe(TUTORIAL.length);
    expect(tutorialStep(s)).toBeNull();
  });
  it("can be skipped", () => {
    const s = createSim("realista", "normal");
    s.tut.skipped = true;
    expect(tutorialStep(s)).toBeNull();
  });
});

describe("maintenance pacing", () => {
  it("at most 2 natural leaks per day, spaced about half a cycle apart", () => {
    const s = createSim("realista", "normal");
    expect(leakAllowed(s)).toBe(true);
    s.leaksToday = LEAKS_PER_DAY;
    expect(leakAllowed(s)).toBe(false);
    expect(nextLeakDelay(s, 0)).toBeGreaterThanOrEqual((CYCLE / 2) * 0.6 - 1);
  });
});

describe("theft from an unprotected base", () => {
  it("a saboteur reaching a tank steals fuel and supplies if no light tower guards the base", () => {
    const s = createSim("fantastico", "normal"); s.time = DAY_LEN + 10; s.alienT = 99;
    s.lox = 100; s.inv.metal = 5;
    const w = world();
    expect(baseProtected(s, w)).toBe(false);
    const a = spawnAlien(s, w, "saboteador"); a.target = "lox"; a.x = 565; a.y = 152;
    const ev = stepAliens(s, 0.2, w);
    expect(ev.some((e) => e.type === "steal")).toBe(true);
    expect(s.lox).toBeLessThan(100);
  });
  it("a lit light tower next to the habitat protects it", () => {
    const s = createSim("fantastico", "normal");
    s.modules.push({ uid: 999, tipo: "torre_luz", x: 130, y: 170, durabilidad: 100, activo: true });
    expect(baseProtected(s, world())).toBe(true);
  });
  it("leaving the base alone at night for too long gets it raided", () => {
    const s = createSim("fantastico", "normal"); s.time = DAY_LEN + 10; s.alienT = 999;
    s.inv.metal = 9; s.lh2 = 10;
    let stolen = false;
    for (let i = 0; i < ABANDON_S + 5 && !stolen; i++) stolen = stepAliens(s, 1, world()).some((e) => e.type === "steal");
    expect(stolen).toBe(true);
  });
  it("steals nothing when there is nothing to take", () => {
    const s = createSim("fantastico", "normal");
    for (const k of Object.keys(s.inv) as (keyof typeof s.inv)[]) s.inv[k] = 0;
    expect(stealFromBase(s, () => 0.5)).toBe("");
  });
});
