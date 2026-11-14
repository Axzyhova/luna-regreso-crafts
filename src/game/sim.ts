import modos from "@/data/modos.json";

export type Mode = "realista" | "fantastico" | "terrorifico";
export type Difficulty = "facil" | "normal" | "dificil";
export type LeakTarget = "habitat" | "lh2" | "lox";
export interface Leak { id: number; target: LeakTarget; x: number; y: number; size: number; progress: number; age: number }
export interface Module { id: string; nombre: string; durabilidad: number; consumo: number; activo: boolean }

export const DAY_LEN = 360;
export const NIGHT_LEN = 240;
export const CYCLE = DAY_LEN + NIGHT_LEN;
export const LH2_CAP = 100;
export const LOX_CAP = 600;

export function createSim(mode: Mode, difficulty: Difficulty) {
  return {
    mode, difficulty,
    time: 60, day: 1,
    suitO2: 100, health: 100, temp: 21,
    battery: 60, energyIn: 0, energyOut: 0,
    habitatO2: 80,
    lh2: 0, lox: 0, h2gas: 0, o2gas: 0,
    inv: { hielo: 0, agua: 0, regolito: 0, chatarra: 2, metal: 1, kits: 1 } as Record<string, number>,
    hotbar: 1,
    act: 1,
    actFlags: { leakFixed: false },
    deathsInAct: 0, eventScale: 1, hint: "" as string,
    leaks: [] as Leak[],
    nextLeakId: 1,
    modules: [
      { id: "habitat", nombre: "Hábitat", durabilidad: 90, consumo: 2, activo: true },
      { id: "paneles", nombre: "Paneles solares", durabilidad: 85, consumo: 0, activo: true },
      { id: "baterias", nombre: "Baterías", durabilidad: 90, consumo: 0, activo: true },
      { id: "electrolisis", nombre: "Planta de electrólisis", durabilidad: 70, consumo: 4, activo: true },
      { id: "licuefactor", nombre: "Licuefactor / criotanques", durabilidad: 70, consumo: 3, activo: true },
      { id: "horno", nombre: "Horno de regolito", durabilidad: 60, consumo: 3, activo: true },
    ] as Module[],
    rocket: { Propulsión: 20, Energía: 45, Térmico: 60, Comunicaciones: 10, "Control de actitud": 35, Estructura: 55 } as Record<string, number>,
    log: [] as { t: string; text: string }[],
    logros: [] as string[],
    alert: "" as string,
    leakFreeNight: true,
  };
}
export type Sim = ReturnType<typeof createSim>;

export const isDay = (s: Sim) => s.time % CYCLE < DAY_LEN;
export const clock = (s: Sim) => {
  const t = s.time % CYCLE;
  return isDay(s) ? `DÍA ${s.day} ${Math.floor((DAY_LEN - t) / 60)}:${String(Math.floor((DAY_LEN - t) % 60)).padStart(2, "0")}` : `NOCHE ${Math.floor((CYCLE - t) / 60)}:${String(Math.floor((CYCLE - t) % 60)).padStart(2, "0")}`;
};
export const stamp = (s: Sim) => `D${s.day} ${isDay(s) ? "☀" : "☾"} ${String(Math.floor((s.time % CYCLE) / 60)).padStart(2, "0")}m`;
export const diffCfg = (s: Sim) => modos.dificultades[s.difficulty];
export const modeCfg = (s: Sim) => modos.modos[s.mode];
export const mod = (s: Sim, id: string) => s.modules.find((m) => m.id === id)!;
export const working = (s: Sim, id: string) => mod(s, id).durabilidad > 0 && mod(s, id).activo;

export function addLog(s: Sim, text: string) {
  s.log.unshift({ t: stamp(s), text });
  if (s.log.length > 60) s.log.pop();
}
export function unlock(s: Sim, name: string) {
  if (s.logros.includes(name)) return false;
  s.logros.push(name);
  addLog(s, `LOGRO: ${name}`);
  return true;
}

/** Electrolysis: water mass splits into H2:O2 = 1:8 by mass. */
export function electrolyze(water: number) {
  return { h2: water / 9, o2: (water * 8) / 9 };
}
/** O2 sent to LOX so tanks keep ~6:1 (LOX:LH2); the rest feeds the habitat. */
export function splitO2(o2: number, lh2: number, lox: number) {
  const want = Math.max(0, 6 * lh2 - lox);
  const toLox = Math.min(o2, want);
  return { toLox, rest: o2 - toLox };
}
export function canCraft(inv: Record<string, number>, ing: Record<string, number>) {
  return Object.entries(ing).every(([k, v]) => (inv[k] ?? 0) >= v);
}

/** Advance the simulation by dt seconds (excluding positional effects handled by the scene). */
export function step(s: Sim, dt: number, ctx: { inHabitat: boolean; inShadow: boolean }) {
  const d = diffCfg(s);
  const prevDay = isDay(s);
  s.time += dt;
  const day = isDay(s);
  if (prevDay && !day) { addLog(s, "Cae la noche. Solo baterías. El LH2 hierve más rápido."); s.leakFreeNight = true; }
  if (!prevDay && day) {
    s.day += 1;
    addLog(s, `Amanece el día ${s.day}.`);
    if (s.leakFreeNight) unlock(s, "Cero fugas en una noche");
  }
  // durability
  for (const m of s.modules) m.durabilidad = Math.max(0, m.durabilidad - dt * 0.03 * d.consumo);

  // energy
  const eIn = day && working(s, "paneles") ? 14 * (mod(s, "paneles").durabilidad > 30 ? 1 : 0.5) + (s.inv.paneles ?? 0) * 4 : 0;
  let eOut = working(s, "habitat") ? 2 : 0;
  const elecOn = working(s, "electrolisis") && s.inv.agua > 0 && s.battery > 5;
  const liqOn = working(s, "licuefactor") && (s.h2gas > 0 || s.o2gas > 0) && s.battery > 5;
  const hornoOn = working(s, "horno") && s.inv.regolito > 0 && s.battery > 10;
  if (elecOn) eOut += 4;
  if (liqOn) eOut += 3;
  if (hornoOn) eOut += 3;
  s.energyIn = eIn; s.energyOut = eOut;
  const cap = working(s, "baterias") ? 100 + (s.inv.baterias ?? 0) * 25 : 20;
  s.battery = Math.min(cap, Math.max(0, s.battery + (eIn - eOut) * dt * 0.12));

  // production
  if (elecOn) {
    const w = Math.min(s.inv.agua, 0.4 * dt);
    s.inv.agua -= w;
    const r = electrolyze(w);
    s.h2gas += r.h2; s.o2gas += r.o2;
  }
  if (liqOn) {
    const h = Math.min(s.h2gas, 0.1 * dt, LH2_CAP - s.lh2);
    s.h2gas -= h; s.lh2 += h;
    const sp = splitO2(Math.min(s.o2gas, 1 * dt), s.lh2, s.lox);
    const toLox = Math.min(sp.toLox, LOX_CAP - s.lox);
    s.o2gas -= toLox + sp.rest; s.lox += toLox;
    s.habitatO2 = Math.min(100, s.habitatO2 + sp.rest * 0.8);
    if (s.lh2 >= 1) unlock(s, "Primer litro de LH2");
    if (s.lh2 > 5 && Math.abs(s.lox / s.lh2 - 6) < 0.1) unlock(s, "Mezcla perfecta 6:1");
  }
  if (hornoOn) {
    const r = Math.min(s.inv.regolito, 0.05 * dt);
    s.inv.regolito -= r;
    s.inv.metal += r * 0.3;
    s.habitatO2 = Math.min(100, s.habitatO2 + r * 2);
  }
  // boil-off
  const boil = day ? 0.0008 : 0.003;
  s.lh2 = Math.max(0, s.lh2 - s.lh2 * boil * dt * (working(s, "licuefactor") ? 0.3 : 1));

  // habitat
  s.habitatO2 = Math.max(0, s.habitatO2 - 0.02 * dt);

  // leaks
  for (const l of s.leaks) {
    l.age += dt;
    if (l.age > 30) { l.age = 0; l.size = Math.min(4, l.size + 1); addLog(s, "Una fuga ha crecido."); }
    const rate = l.size * 0.25 * dt;
    if (l.target === "habitat") s.habitatO2 = Math.max(0, s.habitatO2 - rate);
    if (l.target === "lh2") s.lh2 = Math.max(0, s.lh2 - rate * 0.3);
    if (l.target === "lox") s.lox = Math.max(0, s.lox - rate * 1.5);
  }

  // suit / body
  if (ctx.inHabitat && s.habitatO2 > 0) {
    const r = Math.min(100 - s.suitO2, 6 * dt);
    s.suitO2 += r; s.habitatO2 = Math.max(0, s.habitatO2 - r * 0.05);
  } else {
    s.suitO2 = Math.max(0, s.suitO2 - 0.28 * dt * d.consumo);
  }
  const ins = (s.inv.aislamiento ?? 0) > 0 ? 0.5 : 1;
  let target = 21;
  if (!ctx.inHabitat) {
    if (!day) target = s.battery > 0 ? 8 : -20;
    if (ctx.inShadow) target -= 18 * ins;
  } else if (s.battery <= 0) target = 0;
  s.temp += (target - s.temp) * Math.min(1, dt * 0.08);
  if (s.suitO2 <= 0) s.health -= 3 * dt;
  if (s.temp < 5) s.health -= 0.8 * dt;
  if (ctx.inHabitat && s.suitO2 > 50 && s.temp > 10) s.health = Math.min(100, s.health + 0.5 * dt);
  s.health = Math.max(0, s.health);

  // alerts
  s.alert = s.leaks.length ? `¡FUGA! ${s.leaks.map((l) => (l.target === "habitat" ? "HÁBITAT" : l.target.toUpperCase())).join(" · ")}` :
    s.suitO2 < 20 ? "O2 DEL TRAJE BAJO" : s.temp < 5 ? "HIPOTERMIA" : s.battery < 5 ? "BATERÍAS AGOTADAS" : "";

  // acts
  if (s.act === 1 && s.inv.hielo + s.inv.agua >= 6 && s.inv.chatarra >= 4 && s.actFlags.leakFixed) advanceAct(s);
  if (s.act === 2 && s.lh2 >= 5) advanceAct(s);
}

export function advanceAct(s: Sim) {
  s.act += 1; s.deathsInAct = 0; s.hint = "";
  addLog(s, `Comienza el Acto ${s.act}.`);
}
export function onDeath(s: Sim) {
  s.deathsInAct += 1;
  addLog(s, "Perdiste el conocimiento. Te despiertas en el hábitat.");
  s.suitO2 = 100; s.health = 60; s.temp = 18;
  if (s.deathsInAct >= 2) {
    s.eventScale *= 0.8;
    s.hint = "PISTA: vuelve al hábitat para recargar O2 y evita el cráter en sombra de noche.";
    addLog(s, "Dificultad ajustada: eventos -20%.");
  }
}
