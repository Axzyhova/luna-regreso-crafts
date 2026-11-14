import { describe, it, expect } from "vitest";
import { createSim, DAY_LEN, type Sim } from "@/game/sim";
import type { World } from "@/game/aliens";
import { activeEffects, stepEffects, effectMods, toggleEquip, consumeItem } from "@/game/effects";
import { startEvent, stepEvents } from "@/game/events";
import { initCapsules, openCapsule, rollLoot, spawnCapsule } from "@/game/loot";
import { stepQuests, PRINCIPALES } from "@/game/quests";

const world = (over: Partial<World> = {}): World => ({ player: { x: 400, y: 300 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 640, h: 360, rnd: () => 0.3, ...over });

describe("efectos negativos y equipo", () => {
  it("el frío aparece bajo 5 °C y el traje térmico lo evita", () => {
    const s = createSim("realista", "normal"); s.temp = -10;
    expect(activeEffects(s, world(), false)).toContain("frio");
    s.inv.traje_termico = 1; toggleEquip(s, "traje_termico");
    expect(activeEffects(s, world(), false)).not.toContain("frio");
  });
  it("el cansancio crece afuera, frena y se cura en el hábitat o con estimulante", () => {
    const s = createSim("realista", "normal");
    for (let i = 0; i < 300; i++) stepEffects(s, 1, world(), false);
    expect(s.effects).toContain("cansancio");
    expect(effectMods(s).speed).toBeLessThan(1);
    s.inv.estimulante = 1;
    expect(consumeItem(s, "estimulante")).toBe(true);
    expect(s.fatigue).toBe(0);
  });
  it("el miedo aparece de noche, a oscuras, con un alien cerca", () => {
    const s = createSim("fantastico", "normal"); s.time = DAY_LEN + 10;
    s.aliens.push({ id: 1, tipo: "abductor", x: 410, y: 300, hp: 3, stun: 0 });
    expect(activeEffects(s, world(), false)).toContain("miedo");
    expect(activeEffects(s, world({ inHabitat: true }), false)).not.toContain("miedo");
  });
  it("como máximo 3 piezas de equipo", () => {
    const s = createSim("realista", "normal");
    Object.assign(s.inv, { traje_termico: 1, capa_reflectante: 1, escudo_radiacion: 1 });
    toggleEquip(s, "traje_termico"); toggleEquip(s, "capa_reflectante"); toggleEquip(s, "escudo_radiacion");
    expect(s.equip).toHaveLength(3);
  });
});

describe("eventos con aviso", () => {
  it("la llamarada avisa antes y luego da radiación afuera; el escudo la reduce", () => {
    const run = (shield: boolean) => {
      const s = createSim("realista", "normal");
      if (shield) { s.inv.escudo_radiacion = 1; toggleEquip(s, "escudo_radiacion"); }
      const w = world();
      startEvent(s, "llamarada_solar", w);
      expect(s.event?.phase).toBe("aviso");
      for (let i = 0; i < 60 && s.event; i++) { stepEvents(s, 1, w); stepEffects(s, 1, w, false); }
      return s;
    };
    const sin = run(false), con = run(true);
    expect(sin.stats.llamaradas).toBe(0);
    expect(con.stats.llamaradas).toBe(1);
  });
  it("la lluvia de micrometeoritos impacta en su zona y deja una cápsula", () => {
    const s = createSim("realista", "normal");
    const w = world();
    startEvent(s, "meteoritos", w);
    let impacts = 0;
    for (let i = 0; i < 80 && s.event; i++) impacts += stepEvents(s, 0.5, w).length;
    expect(impacts).toBe(6);
    expect(s.capsules).toHaveLength(1);
  });
});

describe("cápsulas de suministro", () => {
  it("hay 4 cápsulas al empezar, lejos del hábitat", () => {
    const s = createSim("realista", "normal");
    let k = 0; initCapsules(s, { w: 640, h: 360, hab: { x: 110, y: 170 }, rnd: () => ((k = (k * 9301 + 49297) % 233280) / 233280) });
    expect(s.capsules).toHaveLength(4);
    initCapsules(s, { w: 640, h: 360, hab: { x: 110, y: 170 }, rnd: () => 0.5 });
    expect(s.capsules).toHaveLength(4);
  });
  it("abrir una cápsula da objetos y cuenta para la misión", () => {
    const s = createSim("realista", "normal");
    const c = spawnCapsule(s, 300, 200);
    const found = openCapsule(s, c.id, () => 0.01);
    expect(found.length).toBeGreaterThan(0);
    expect(s.stats.capsulas).toBe(1);
    expect(rollLoot(() => 0.999).item).toBe("baterias");
  });
});

describe("historia y misiones", () => {
  const fresh = (): Sim => { const s = createSim("realista", "normal"); stepQuests(s); s.dialog = []; return s; };
  it("empieza con la introducción de ARIA y la misión 1", () => {
    const s = createSim("realista", "normal");
    stepQuests(s);
    expect(s.dialog[0]?.quien).toBe("ARIA");
    expect(s.quest.main).toBe(0);
  });
  it("las misiones principales avanzan en orden", () => {
    const s = fresh();
    s.actFlags.leakFixed = true; stepQuests(s);
    expect(s.quest.main).toBe(1);
    s.lh2 = 5; stepQuests(s); // M3 aún no: falta el hielo de M2
    expect(s.quest.main).toBe(1);
    s.stats.hielo = 6; stepQuests(s);
    expect(PRINCIPALES[s.quest.main]?.id).toBe("M4");
  });
  it("las secundarias dan recompensa una sola vez", () => {
    const s = fresh();
    s.stats.capsulas = 3; stepQuests(s); stepQuests(s);
    expect(s.quest.sideDone).toContain("S1");
    expect(s.inv.traje_termico).toBe(1);
  });
  it("Cazador de sombras no existe en modo Realista", () => {
    const s = fresh();
    s.stats.aliens = 10; stepQuests(s);
    expect(s.quest.sideDone).not.toContain("S5");
  });
});
