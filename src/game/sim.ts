import modos from "@/data/modos.json";
import modulos from "@/data/modulos.json";
import recetas from "@/data/recetas.json";
import subsistemas from "@/data/subsistemas_cohete.json";

export type Mode = "realista" | "fantastico" | "terrorifico";
export type Difficulty = "facil" | "normal" | "dificil";
export type LeakTarget = "habitat" | "lh2" | "lox";
export interface Leak { id: number; target: LeakTarget; x: number; y: number; size: number; progress: number; age: number }
export type ModType = keyof typeof modulos.tipos;
export interface TipoInfo { nombre: string; energia: number; desgaste: number; w: number; h: number; item: string | null; solo_dia?: boolean; capacidad?: number; produce_hielo?: number; en_crater?: boolean }
export const TIPOS = modulos.tipos as Record<ModType, TipoInfo>;
export interface Module { uid: number; tipo: ModType; x: number; y: number; durabilidad: number; activo: boolean }
export const STACK = 50;
export const SLOTS = 20;
/** Inventory item -> module type it places. */
export const PLACEABLE: Record<string, ModType> = Object.fromEntries(
  Object.entries(TIPOS).filter(([, t]) => t.item).map(([k, t]) => [t.item!, k as ModType]),
);

export const DAY_LEN = 360;
export const NIGHT_LEN = 240;
export const CYCLE = DAY_LEN + NIGHT_LEN;
export const LH2_CAP = 100;
export const LOX_CAP = 600;

export interface Inv { hielo: number; agua: number; regolito: number; chatarra: number; metal: number; kits: number; baterias: number; pala_mejorada: number; aislamiento: number; paneles: number; taladro: number; taller: number; horno: number; torres_luz: number; planta_electrolisis: number; criotanque: number; pieza_motor: number }

export function createSim(mode: Mode, difficulty: Difficulty) {
  return {
    mode, difficulty,
    time: 60, day: 1,
    suitO2: 100, health: 100, temp: 21,
    battery: 60, energyIn: 0, energyOut: 0,
    habitatO2: 80,
    lh2: 0, lox: 0, h2gas: 0, o2gas: 0,
    inv: { hielo: 0, agua: 0, regolito: 0, chatarra: 2, metal: 1, kits: 1, baterias: 0, pala_mejorada: 0, aislamiento: 0, paneles: 0, taladro: 0, taller: 1, horno: 0, torres_luz: 0, planta_electrolisis: 0, criotanque: 0, pieza_motor: 0 } as Inv,
    relay: false,
    cubesat: [] as { uid: number; id: string; x: number; y: number; rot: number }[],
    result: null as null | { ok: boolean; dia: number; ventana: string; lh2Sobra: number; loxSobra: number },
    hotbarItems: ["kits", "chatarra", "metal", null, null] as (string | null)[],
    near: { taller: false, horno: false },
    buildMode: null as string | null,
    nextUid: 100,
    hotbar: 1,
    act: 1,
    actFlags: { leakFixed: false },
    deathsInAct: 0, eventScale: 1, hint: "" as string,
    leaks: [] as Leak[],
    nextLeakId: 1,
    modules: modulos.iniciales.map((m, i) => ({ uid: i + 1, tipo: m.tipo as ModType, x: m.x, y: m.y, durabilidad: m.durabilidad, activo: true })) as Module[],
    rocket: { Propulsión: 20, Energía: 45, Térmico: 60, Comunicaciones: 10, "Control de actitud": 35, Estructura: 55 } as Record<string, number>,
    log: [] as { t: string; text: string }[],
    logros: [] as string[],
    alert: "" as string,
    leakFreeNight: true,
    drillAcc: 0,
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
export const isOn = (m: Module) => m.activo && m.durabilidad > 0;
export const working = (s: Sim, tipo: ModType) => s.modules.some((m) => m.tipo === tipo && isOn(m));
/** Energy per second a module adds (+) or uses (-) right now. */
export function moduleEnergy(m: Module, day: boolean) {
  if (!isOn(m)) return 0;
  const t = TIPOS[m.tipo];
  if (t.solo_dia && !day) return 0;
  return t.energia * (t.energia > 0 && m.durabilidad < 30 ? 0.5 : 1);
}
export function energyBalance(s: Sim, day: boolean) {
  let inp = 0, out = 0;
  for (const m of s.modules) { const e = moduleEnergy(m, day); if (e > 0) inp += e; else out -= e; }
  return { inp, out };
}
export const BATTERY_RATE = 0.12;
export function batteryCap(s: Sim) {
  return 20 + s.modules.filter((m) => m.tipo === "bateria" && isOn(m)).length * (TIPOS.bateria.capacidad ?? 100);
}
/** Seconds the batteries last at night with the modules currently ON (Infinity if no drain). */
export function nightBatterySeconds(s: Sim) {
  const { inp, out } = energyBalance(s, false);
  const net = out - inp;
  return net <= 0 ? Infinity : s.battery / (net * BATTERY_RATE);
}
export function usedSlots(inv: Inv) {
  return Object.values(inv).reduce((n, v) => n + Math.ceil(Math.floor(v) / STACK), 0);
}
/** Adds items if the 4x5 inventory (stacks of 50) has room. */
export function addItem(s: Sim, key: keyof Inv, n = 1) {
  const next = { ...s.inv, [key]: s.inv[key] + n };
  if (usedSlots(next) > SLOTS) return false;
  s.inv[key] += n;
  return true;
}
export type Receta = (typeof recetas)[number];
export function recipeBlock(s: Sim, r: Receta): string | null {
  if (!r.disponible) return "Próximamente";
  if (r.lugar === "taller" && !s.near.taller) return "Acércate al Taller";
  if (r.lugar === "horno" && !s.near.horno) return "Acércate al Horno";
  if (!canCraft(s.inv, r.ingredientes)) return "Faltan materiales";
  return null;
}
export function craft(s: Sim, r: Receta) {
  if (recipeBlock(s, r)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(r.ingredientes)) inv[k] = (inv[k] ?? 0) - (v ?? 0);
  for (const [k, v] of Object.entries(r.resultado)) inv[k] = (inv[k] ?? 0) + (v ?? 0);
  s.log.unshift({ t: stamp(s), text: `Día ${s.day}: fabricaste ${r.nombre.replace(/ \(módulo\)/, "").toLowerCase()}` });
  return true;
}

// ---- Cohete: subsistemas (disciplinas del Mission Design Lab) ----
export type Subsistema = (typeof subsistemas.subsistemas)[number] & { tope_sin_relay?: number };
export const SUBSISTEMAS = subsistemas.subsistemas as Subsistema[];
export const UMBRAL_VERDE = subsistemas.umbral_verde;
const tankLeaks = (s: Sim) => s.leaks.filter((l) => l.target !== "habitat").length;
export const subCap = (s: Sim, sub: Subsistema) => (sub.tope_sin_relay && !s.relay ? sub.tope_sin_relay : 100);
/** Why a subsystem can't be repaired right now, or null if it can. */
export function repairBlock(s: Sim, sub: Subsistema): string | null {
  const v = s.rocket[sub.id] ?? 0;
  if (v >= 100) return "Al 100%";
  if (v >= subCap(s, sub)) return "Requiere el CubeSat relé";
  if (sub.id === "Propulsión" && tankLeaks(s) > 0) return "Sella primero las fugas de los tanques";
  if (!canCraft(s.inv, sub.ingredientes)) return "Faltan materiales";
  return null;
}
export function repairSubsystem(s: Sim, sub: Subsistema) {
  if (repairBlock(s, sub)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(sub.ingredientes)) inv[k] = (inv[k] ?? 0) - (v ?? 0);
  s.rocket[sub.id] = Math.min(subCap(s, sub), (s.rocket[sub.id] ?? 0) + sub.sube);
  addLog(s, `Cohete: reparaste ${sub.id} (${s.rocket[sub.id]}%).`);
  return true;
}
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
export function canCraft(inv: Inv, ing: Record<string, number | undefined>) {
  const m = inv as unknown as Record<string, number>;
  return Object.entries(ing).every(([k, v]) => (m[k] ?? 0) >= (v ?? 0));
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
  for (const m of s.modules) if (m.activo) {
    const was = m.durabilidad;
    m.durabilidad = Math.max(0, m.durabilidad - dt * TIPOS[m.tipo].desgaste * d.consumo);
    if (was >= 25 && m.durabilidad < 25) addLog(s, `${TIPOS[m.tipo].nombre} requiere mantenimiento.`);
  }

  // energy
  const { inp: eIn, out: eOut } = energyBalance(s, day);
  const powered = s.battery > 0 || eIn > 0;
  const elecOn = powered && working(s, "electrolisis") && s.inv.agua > 0;
  const liqOn = powered && working(s, "licuefactor") && (s.h2gas > 0 || s.o2gas > 0);
  const hornoOn = powered && working(s, "horno") && s.inv.regolito > 0;
  s.energyIn = eIn; s.energyOut = eOut;
  s.battery = Math.min(batteryCap(s), Math.max(0, s.battery + (eIn - eOut) * dt * BATTERY_RATE));
  if (powered) for (const m of s.modules) if (m.tipo === "taladro" && isOn(m)) {
    s.drillAcc = (s.drillAcc ?? 0) + (TIPOS.taladro.produce_hielo ?? 0) * dt;
    if (s.drillAcc >= 1) { s.drillAcc -= 1; addItem(s, "hielo", 1); }
  }

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
  const ins = s.inv.aislamiento > 0 ? 0.5 : 1;
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
