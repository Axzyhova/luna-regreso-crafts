import modos from "@/data/modos.json";
import modulos from "@/data/modulos.json";
import recetas from "@/data/recetas.json";
import subsistemas from "@/data/subsistemas_cohete.json";
import balance from "@/data/balance.json";

/** Tunable game rates (see src/data/balance.json). */
export const BAL = balance;

export type Mode = "realista" | "fantastico" | "terrorifico";
export type Difficulty = "facil" | "normal" | "dificil";
export type LeakTarget = "habitat" | "lh2" | "lox";
export interface Leak { id: number; target: LeakTarget; x: number; y: number; size: number; progress: number; age: number }
export type ModType = keyof typeof modulos.tipos;
export interface TipoInfo { nombre: string; energia: number; desgaste: number; w: number; h: number; item: string | null; solo_dia?: boolean; capacidad?: number; produce_hielo?: number; en_crater?: boolean }
export const TIPOS = modulos.tipos as Record<ModType, TipoInfo>;
export type AlienTipo = "abductor" | "rastreador" | "saboteador" | "nodriza";
export interface Alien { id: number; tipo: AlienTipo; x: number; y: number; hp: number; stun: number; target?: LeakTarget | undefined }
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
export const LH2_CAP = balance.lh2_cap_kg;
export const LOX_CAP = balance.lox_cap_kg;

export interface Inv { hielo: number; agua: number; regolito: number; chatarra: number; metal: number; kits: number; baterias: number; pala_mejorada: number; aislamiento: number; paneles: number; taladro: number; taller: number; horno: number; torres_luz: number; planta_electrolisis: number; criotanque: number; pieza_motor: number; traje_termico: number; capa_reflectante: number; escudo_radiacion: number; botiquin: number; estimulante: number }

export function createSim(mode: Mode, difficulty: Difficulty) {
  return {
    mode, difficulty,
    time: 60, day: 1,
    suitO2: 100, health: 100, temp: 21,
    battery: 60, energyIn: 0, energyOut: 0,
    habitatO2: 80,
    lh2: 0, lox: 0, h2gas: 0, o2gas: 0,
    inv: { hielo: 0, agua: 0, regolito: 0, chatarra: 2, metal: 1, kits: 1, baterias: 0, pala_mejorada: 0, aislamiento: 0, paneles: 0, taladro: 0, taller: 1, horno: 0, torres_luz: 0, planta_electrolisis: 0, criotanque: 0, pieza_motor: 0, traje_termico: 0, capa_reflectante: 0, escudo_radiacion: 0, botiquin: 0, estimulante: 0 } as Inv,
    relay: false,
    // --- historia, efectos, eventos y botín ---
    effects: [] as string[],
    fatigue: 0,
    tut: { step: 0, skipped: false, moved: 0, invOpened: false, kitCrafted: false },
    leaksToday: 0,
    awayT: 0,
    coldT: 0,
    heatT: 0,
    dose: 0,
    equip: [] as string[],
    capsules: [] as { id: number; x: number; y: number }[],
    nextCapsuleId: 1,
    capsulesSpawned: false,
    event: null as null | { id: string; phase: "aviso" | "activo"; t: number; x: number; y: number; hits: number; maxDose: number },
    nextEventT: 150,
    impacts: [] as { x: number; y: number; t: number }[],
    quest: { main: 0, sideDone: [] as string[], started: false },
    stats: { hielo: 0, capsulas: 0, aliens: 0, reparaciones: 0, llamaradas: 0 },
    dialog: [] as { quien: string; texto: string }[],
    toast: null as null | { text: string; t: number },
    radar: [] as { k: string; dx: number; dy: number }[],
    aliens: [] as Alien[],
    nextAlienId: 1,
    alienT: 20,
    abduction: 0,
    alienSeen: [] as string[],
    countdown: null as number | null,
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
    rocket: { Propulsion: 20, Power: 45, Thermal: 60, Communications: 10, "Attitude control": 35, Structure: 55 } as Record<string, number>,
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
  return isDay(s) ? `DAY ${s.day} ${Math.floor((DAY_LEN - t) / 60)}:${String(Math.floor((DAY_LEN - t) % 60)).padStart(2, "0")}` : `NIGHT ${Math.floor((CYCLE - t) / 60)}:${String(Math.floor((CYCLE - t) % 60)).padStart(2, "0")}`;
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
  if (!r.disponible) return "Coming soon";
  if (r.lugar === "taller" && !s.near.taller) return "Go to the Workshop";
  if (r.lugar === "horno" && !s.near.horno) return "Go to the Furnace";
  if (!canCraft(s.inv, r.ingredientes)) return "Missing materials";
  return null;
}
export function craft(s: Sim, r: Receta) {
  if (recipeBlock(s, r)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(r.ingredientes)) inv[k] = (inv[k] ?? 0) - (v ?? 0);
  for (const [k, v] of Object.entries(r.resultado)) inv[k] = (inv[k] ?? 0) + (v ?? 0);
  if (r.resultado && "kits" in r.resultado) s.tut.kitCrafted = true;
  s.log.unshift({ t: stamp(s), text: `Day ${s.day}: you crafted ${r.nombre.replace(/ \((module|gear)\)/, "").toLowerCase()}` });
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
  if (v >= 100) return "At 100%";
  if (v >= subCap(s, sub)) return "Needs the CubeSat relay";
  if (sub.id === "Propulsion" && tankLeaks(s) > 0) return "Seal the tank leaks first";
  if (!canCraft(s.inv, sub.ingredientes)) return "Missing materials";
  return null;
}
export function repairSubsystem(s: Sim, sub: Subsistema) {
  if (repairBlock(s, sub)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(sub.ingredientes)) inv[k] = (inv[k] ?? 0) - (v ?? 0);
  s.rocket[sub.id] = Math.min(subCap(s, sub), (s.rocket[sub.id] ?? 0) + sub.sube);
  addLog(s, `Rocket: you repaired ${sub.id} (${s.rocket[sub.id]}%).`);
  return true;
}
/** Natural leaks: at most this many per lunar day/night cycle (saboteurs can add more). */
export const LEAKS_PER_DAY = 2;
export const leakAllowed = (s: Sim) => s.leaks.length < 4 && s.leaksToday < LEAKS_PER_DAY;
/** Seconds until the next natural leak check: roughly half a cycle, faster on harder settings. */
export function nextLeakDelay(s: Sim, r: number) {
  return ((CYCLE / LEAKS_PER_DAY) * (0.6 + r * 0.4)) / (diffCfg(s).eventos * s.eventScale);
}

export function addLog(s: Sim, text: string) {
  s.log.unshift({ t: stamp(s), text });
  if (s.log.length > 60) s.log.pop();
}
export function unlock(s: Sim, name: string) {
  if (s.logros.includes(name)) return false;
  s.logros.push(name);
  addLog(s, `ACHIEVEMENT: ${name}`);
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
  if (prevDay && !day) { addLog(s, "Night falls. Batteries only. LH2 boils off faster."); s.leakFreeNight = true; }
  if (!prevDay && day) {
    s.day += 1;
    s.leaksToday = 0;
    addLog(s, `Day ${s.day} dawns.`);
    if (s.leakFreeNight) unlock(s, "Leak-free night");
  }
  // durability
  for (const m of s.modules) if (m.activo) {
    const was = m.durabilidad;
    m.durabilidad = Math.max(0, m.durabilidad - dt * TIPOS[m.tipo].desgaste * d.consumo);
    if (was >= 25 && m.durabilidad < 25) addLog(s, `${TIPOS[m.tipo].nombre} needs maintenance.`);
  }

  // energy
  const ev = s.event?.phase === "activo" ? s.event.id : null;
  const { inp: eIn, out: eOut } = energyBalance(s, day && ev !== "eclipse");
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
    const w = Math.min(s.inv.agua, balance.electrolisis_agua_kg_s * dt);
    s.inv.agua -= w;
    const r = electrolyze(w);
    s.h2gas += r.h2; s.o2gas += r.o2;
  }
  if (liqOn) {
    const h = Math.min(s.h2gas, balance.licuefactor_h2_kg_s * dt, LH2_CAP - s.lh2);
    s.h2gas -= h; s.lh2 += h;
    const sp = splitO2(Math.min(s.o2gas, balance.licuefactor_o2_kg_s * dt), s.lh2, s.lox);
    const toLox = Math.min(sp.toLox, LOX_CAP - s.lox);
    s.o2gas -= toLox + sp.rest; s.lox += toLox;
    s.habitatO2 = Math.min(100, s.habitatO2 + sp.rest * 0.8);
    if (s.lh2 >= 1) unlock(s, "First liter of LH2");
    if (s.lh2 > balance.logro_mezcla_min_lh2_kg && Math.abs(s.lox / s.lh2 - 6) < 0.1) unlock(s, "Perfect 6:1 mix");
  }
  if (hornoOn) {
    const r = Math.min(s.inv.regolito, 0.05 * dt);
    s.inv.regolito -= r;
    s.inv.metal += r * 0.3;
    s.habitatO2 = Math.min(100, s.habitatO2 + r * 2);
  }
  // boil-off
  const boil = day ? balance.boiloff_dia_por_s : balance.boiloff_noche_por_s;
  s.lh2 = Math.max(0, s.lh2 - s.lh2 * boil * dt * (working(s, "licuefactor") ? balance.boiloff_factor_con_licuefactor : 1));

  // habitat
  s.habitatO2 = Math.max(0, s.habitatO2 - 0.02 * dt);

  // leaks
  for (const l of s.leaks) {
    l.age += dt;
    if (l.age > 30) { l.age = 0; l.size = Math.min(4, l.size + 1); addLog(s, "A leak got bigger."); }
    const rate = l.size * dt;
    if (l.target === "habitat") s.habitatO2 = Math.max(0, s.habitatO2 - rate * balance.fuga_habitat_o2_s_por_tamano);
    if (l.target === "lh2") s.lh2 = Math.max(0, s.lh2 - rate * balance.fuga_lh2_kg_s_por_tamano);
    if (l.target === "lox") s.lox = Math.max(0, s.lox - rate * balance.fuga_lox_kg_s_por_tamano);
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
    if (ev === "eclipse") target -= 30;
    if (ev === "pico_termico" && !ctx.inShadow) target = 62;
    if (s.equip.includes("traje_termico") && target < 15) target = Math.min(15, target + 30);
    if (s.equip.includes("capa_reflectante") && target > 30) target = Math.max(30, target - 35);
  } else if (s.battery <= 0) target = 0;
  s.temp += (target - s.temp) * Math.min(1, dt * 0.08);
  if (s.suitO2 <= 0) s.health -= 3 * dt;
  if (ctx.inHabitat && s.suitO2 > 50 && s.temp > 10) s.health = Math.min(100, s.health + 0.5 * dt);
  s.health = Math.max(0, s.health);

  // alerts
  s.alert = s.leaks.length ? `LEAK! ${s.leaks.map((l) => (l.target === "habitat" ? "HABITAT" : l.target.toUpperCase())).join(" · ")}` :
    s.suitO2 < 20 ? "SUIT O2 LOW" : s.temp < 5 ? "HYPOTHERMIA" : s.battery < 5 ? "BATTERIES DEPLETED" : "";

  // acts
  if (s.act === 1 && s.inv.hielo + s.inv.agua >= 6 && s.inv.chatarra >= 4 && s.actFlags.leakFixed) advanceAct(s);
  if (s.act === 2 && s.lh2 >= balance.meta_acto2_lh2_kg) advanceAct(s);
}

export function advanceAct(s: Sim) {
  s.act += 1; s.deathsInAct = 0; s.hint = "";
  addLog(s, `Act ${s.act} begins.`);
}
export function onDeath(s: Sim) {
  s.deathsInAct += 1;
  addLog(s, "You passed out. You wake up in the habitat.");
  s.suitO2 = 100; s.health = 60; s.temp = 18;
  if (s.deathsInAct >= 2) {
    s.eventScale *= 0.8;
    s.hint = "HINT: go back to the habitat to refill O2 and avoid the shadowed crater at night.";
    addLog(s, "Difficulty adjusted: events -20%.");
  }
}
