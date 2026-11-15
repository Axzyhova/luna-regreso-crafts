import modos from "@/data/modos.json";
import modulos from "@/data/modulos.json";
import recetas from "@/data/recetas.json";
import subsistemas from "@/data/subsistemas_cohete.json";
import balance from "@/data/balance.json";
import mejoras from "@/data/mejoras.json";
import zonasCfg from "@/data/zonas.json";

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
export interface Module { uid: number; tipo: ModType; x: number; y: number; durabilidad: number; activo: boolean; level?: number }
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

export interface Inv { hielo: number; agua: number; regolito: number; chatarra: number; metal: number; kits: number; baterias: number; pala_mejorada: number; aislamiento: number; paneles: number; taladro: number; taller: number; horno: number; torres_luz: number; planta_electrolisis: number; criotanque: number; pieza_motor: number; cofre: number; cristal_hielo: number; titanio: number; aleacion: number; pala_titanio: number; baton: number; traje_termico: number; capa_reflectante: number; escudo_radiacion: number; botiquin: number; estimulante: number; alga_lunar: number; racion: number; comida_caliente: number; pico_plasma: number; armadura_lunar: number; botas_gravedad: number }

export function createSim(mode: Mode, difficulty: Difficulty) {
  return {
    mode, difficulty,
    time: 60, day: 1,
    suitO2: 100, health: 100, temp: 21,
    battery: 60, energyIn: 0, energyOut: 0,
    habitatO2: 80,
    lh2: 0, lox: 0, h2gas: 0, o2gas: 0,
    inv: { hielo: 0, agua: 0, regolito: 0, chatarra: 2, metal: 1, kits: difficulty === "facil" ? 3 : 1, baterias: 0, pala_mejorada: 0, aislamiento: 0, paneles: 0, taladro: 0, taller: 1, horno: 0, torres_luz: 0, planta_electrolisis: 0, criotanque: 0, pieza_motor: 0, cofre: 0, cristal_hielo: 0, titanio: 0, aleacion: 0, pala_titanio: 0, baton: 0, traje_termico: 0, capa_reflectante: 0, escudo_radiacion: 0, botiquin: 0, estimulante: 0, alga_lunar: 0, racion: difficulty === "facil" ? 1 : 0, comida_caliente: 0, pico_plasma: 0, armadura_lunar: 0, botas_gravedad: 0 } as Inv,
    relay: false,
    // --- historia, efectos, eventos y botín ---
    effects: [] as string[],
    fatigue: 0,
    chests: {} as Record<string, Record<string, number>>,
    modStatus: {} as Record<number, "ok" | "nopower" | "idle" | "off">,
    archive: [] as string[],
    // Exploration: fog-of-war cells (1 = seen), last position, zones visited, ravine bridge, hive creatures.
    explored: [] as number[],
    pos: { x: 110, y: 200 },
    visited: ["base"] as string[],
    subzonesVisited: [] as string[],
    bridge: false,
    hive: [] as { id: number; x: number; y: number; hp: number; stun: number }[],
    nextHiveId: 1,
    bosses: [] as { id: string; tipo: string; x: number; y: number; hp: number; maxHp: number; stun: number; homeX: number; homeY: number }[],
    bossesDefeated: [] as string[],
    discoveredItems: ["chatarra", "metal", "kits"] as string[],
    creaturesSeen: [] as string[],
    // Crew psychology & lunar gravity (0.165g) + far-from-base neglect + special expedition cases.
    sanity: 100,
    psychCheckT: 25,
    psychEffect: null as null | { id: string; t: number },
    farNeglectT: 0,
    specialCase: null as null | { id: string; title: string; desc: string; x: number; y: number; reward: Record<string, number>; t: number },
    nextCaseT: 95,
    casesDone: 0,
    // Pickup feed, exploration perks (superpowers), and meteor caves.
    pickupFeed: [] as { item: string; n: number; t: number }[],
    perks: [] as string[],
    caves: [] as { id: number; x: number; y: number; explored: boolean; chestOpened: boolean; alienHp: number; alienMaxHp: number; alienType: string; relicDone: boolean }[],
    nextCaveId: 1,
    activeCaveId: null as number | null,
    androids: [] as { id: number; x: number; y: number; hp: number; stun: number }[],
    nextAndroidId: 1,
    problemT: 80,
    // Space suit: indispensable outside. Integrity wears down with use; wearing it all the time makes you thirsty.
    suit: { owned: true, worn: true, integrity: 80 },
    hydration: 100,
    lastHurt: "" as string,
    dead: null as null | { cause: string; x: number; y: number },
    respawned: false,
    drops: [] as { id: number; x: number; y: number; items: Record<string, number> }[],
    nextDropId: 1,
    notices: [] as { id: number; kind: "achievement" | "mission"; title: string; text: string }[],
    nextNoticeId: 1,
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
    near: { taller: false, horno: false, habitat: false },
    station: null as null | "taller" | "horno",
    stationUid: 0,
    chestUid: 0,
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
// ---- Upgrades ----
export const lvl = (m: Module) => m.level ?? 1;
export const lvMult = (m: Module) => 1 + mejoras.efecto_por_nivel * (lvl(m) - 1);
type Cost = Record<string, number>;
export const UPGRADES = mejoras.mejoras as Record<string, { efecto: string; costos: Cost[] }>;
/** Cost to reach the next level, or null at max level / not upgradable. */
export function upgradeCost(m: Module): Cost | null {
  return UPGRADES[m.tipo]?.costos[lvl(m) - 1] ?? null;
}
export function canUpgrade(s: Sim, m: Module) {
  const c = upgradeCost(m);
  return !!c && canCraft(s.inv, c);
}
export function upgradeModule(s: Sim, m: Module) {
  const c = upgradeCost(m);
  if (!c || !canCraft(s.inv, c)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(c)) inv[k] = (inv[k] ?? 0) - v;
  m.level = lvl(m) + 1;
  addLog(s, `⬆ ${TIPOS[m.tipo].nombre} upgraded to level ${m.level}.`);
  return true;
}
const bestMult = (s: Sim, tipo: ModType) => Math.max(1, ...s.modules.filter((m) => m.tipo === tipo && isOn(m)).map(lvMult));

export function moduleEnergy(m: Module, day: boolean) {
  if (!isOn(m)) return 0;
  const t = TIPOS[m.tipo];
  if (t.solo_dia && !day) return 0;
  return t.energia * (t.energia > 0 && m.durabilidad < 30 ? 0.5 : 1) * (t.energia > 0 ? lvMult(m) : 1);
}
export function energyBalance(s: Sim, day: boolean) {
  let inp = 0, out = 0;
  for (const m of s.modules) { const e = moduleEnergy(m, day); if (e > 0) inp += e; else out -= e; }
  return { inp, out };
}
export const BATTERY_RATE = 0.12;
export function batteryCap(s: Sim) {
  return 20 + s.modules.filter((m) => m.tipo === "bateria" && isOn(m)).reduce((a, m) => a + (TIPOS.bateria.capacidad ?? 100) * lvMult(m), 0);
}
/** Seconds the batteries last at night with the modules currently ON (Infinity if no drain). */
export function nightBatterySeconds(s: Sim) {
  const { inp, out } = energyBalance(s, false);
  const net = out - inp;
  return net <= 0 ? Infinity : s.battery / (net * BATTERY_RATE);
}
/** Items that live in base storage (tanks), not in your pockets. */
export const NOT_CARRIED = new Set(["agua"]);
export const WATER_TANK_KG = 400;
export function usedSlots(inv: Inv) {
  return Object.entries(inv).reduce((n, [k, v]) => (NOT_CARRIED.has(k) ? n : n + Math.ceil(Math.floor(v) / STACK)), 0);
}

// ---- Tools: what you hold decides how much each swing gathers and how fast ----
export function toolInfo(s: Sim) {
  const bonus = s.perks.includes("vista_lunar") ? 1 : 0;
  if (s.inv.pico_plasma > 0) return { name: "Plasma cutter", yield: 4 + bonus, cd: 0.18 };
  if (s.inv.pala_titanio > 0) return { name: "Titanium shovel", yield: 3 + bonus, cd: 0.22 };
  if (s.inv.pala_mejorada > 0) return { name: "Better shovel", yield: 2 + bonus, cd: 0.32 };
  return { name: "Bare hands", yield: 1 + bonus, cd: 0.5 };
}

/** Melt carried ice into the habitat water tank (only as much as fits). Returns kg added. */
export function meltIce(s: Sim) {
  const room = Math.max(0, WATER_TANK_KG - s.inv.agua);
  const ice = Math.min(Math.floor(s.inv.hielo), Math.floor(room / balance.hielo_a_agua_kg));
  if (ice <= 0) return 0;
  s.inv.hielo -= ice;
  const w = ice * balance.hielo_a_agua_kg;
  s.inv.agua += w;
  return w;
}

/** Drop items on the ground as a bag you can pick up later. */
export function dropItem(s: Sim, key: string, n: number, x: number, y: number) {
  const inv = s.inv as unknown as Record<string, number>;
  const k = Math.min(Math.floor(inv[key] ?? 0), n);
  if (k <= 0 || NOT_CARRIED.has(key)) return 0;
  inv[key] = (inv[key] ?? 0) - k;
  const bag = s.drops.find((d) => Math.hypot(d.x - x, d.y - y) < 12);
  if (bag) bag.items[key] = (bag.items[key] ?? 0) + k;
  else s.drops.push({ id: s.nextDropId++, x: Math.round(x), y: Math.round(y + 6), items: { [key]: k } });
  return k;
}

// ---- Storage chests ----
export const CHEST_SLOTS = 20;
const chestSlots = (c: Record<string, number>) => Object.values(c).reduce((n, v) => n + Math.ceil(v / STACK), 0);
export function chestOf(s: Sim, uid: number) { return (s.chests[String(uid)] ??= {}); }
/** Move up to n of an item between your inventory and a chest. */
export function moveToChest(s: Sim, uid: number, key: string, n: number) {
  const inv = s.inv as unknown as Record<string, number>;
  const c = chestOf(s, uid);
  let moved = 0;
  while (moved < n && Math.floor(inv[key] ?? 0) > 0) {
    const next = { ...c, [key]: (c[key] ?? 0) + 1 };
    if (chestSlots(next) > CHEST_SLOTS) break;
    c[key] = next[key]!; inv[key]! -= 1; moved++;
  }
  return moved;
}
export function moveFromChest(s: Sim, uid: number, key: string, n: number) {
  const c = chestOf(s, uid);
  let moved = 0;
  while (moved < n && (c[key] ?? 0) > 0 && addItem(s, key as keyof Inv, 1)) { c[key]! -= 1; moved++; }
  if ((c[key] ?? 0) <= 0) delete c[key];
  return moved;
}
/** Adds items if the 4x5 inventory (stacks of 50) has room. */
export function addItem(s: Sim, key: keyof Inv, n = 1) {
  const next = { ...s.inv, [key]: s.inv[key] + n };
  if (usedSlots(next) > SLOTS) return false;
  s.inv[key] += n;
  if (n > 0) {
    if (!s.discoveredItems.includes(key)) s.discoveredItems.push(key);
    const existing = s.pickupFeed.find((p) => p.item === key);
    if (existing) { existing.n += n; existing.t = 4.5; }
    else { s.pickupFeed.unshift({ item: key, n, t: 4.5 }); if (s.pickupFeed.length > 4) s.pickupFeed.pop(); }
  }
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
  for (const [k, v] of Object.entries(r.resultado)) {
    if (k === "traje_espacial") { s.suit = { owned: true, worn: s.suit.worn && s.suit.owned, integrity: 100 }; continue; }
    inv[k] = (inv[k] ?? 0) + (v ?? 0);
  }
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
  notify(s, "achievement", "Achievement unlocked", name);
  return true;
}

/** Queue a pop-up notification (achievement / mission), shown one at a time by the UI. */
export function notify(s: Sim, kind: "achievement" | "mission", title: string, text: string) {
  s.notices.push({ id: s.nextNoticeId++, kind, title, text });
  if (s.notices.length > 6) s.notices.shift();
}

/** Apply damage and remember what caused it (shown on the death screen). */
export function hurt(s: Sim, amount: number, cause: string) {
  if (amount <= 0) return;
  const mult = s.equip.includes("armadura_lunar") ? 0.6 : 1;
  s.health = Math.max(0, s.health - amount * mult);
  s.lastHurt = cause;
}

export const SUIT_WEAR_S = 100 / 1200;   // integrity per second outside: a full suit lasts ~2 day/night cycles
export const THIRST_S = 100 / 480;       // hydration per second while wearing the suit (~8 min)
export const VACUUM_DMG_S = 8;           // health per second outside without a working suit
export const suitWorking = (s: Sim) => s.suit.owned && s.suit.worn && s.suit.integrity > 0;

/** Put the suit on / take it off. Outside the habitat taking it off is deadly, so it's refused. */
export function toggleSuit(s: Sim, inHabitat: boolean): string {
  if (!s.suit.owned) return "You have no space suit: craft one at the Workshop";
  if (s.suit.worn && !inHabitat) return "Take the suit off only inside the habitat";
  s.suit.worn = !s.suit.worn;
  addLog(s, s.suit.worn ? "You put on the space suit." : "You took off the space suit. Drink and rest.");
  return s.suit.worn ? "Suit on" : "Suit off";
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
export function step(s: Sim, dt: number, ctx: { inHabitat: boolean; inShadow: boolean; zoneTemp?: number | undefined; distFromHab?: number | undefined }) {
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
  // What each module is doing right now, so the player can see why things work or don't.
  for (const m of s.modules) {
    let st: "ok" | "nopower" | "idle" | "off" = "ok";
    if (!m.activo || m.durabilidad <= 0) st = "off";
    else if (m.tipo === "panel") st = day && ev !== "eclipse" ? "ok" : "idle";
    else if (TIPOS[m.tipo].energia < 0 && !powered) st = "nopower";
    else if (m.tipo === "electrolisis" && s.inv.agua <= 0) st = "idle";
    else if (m.tipo === "licuefactor" && s.h2gas <= 0 && s.o2gas <= 0) st = "idle";
    else if (m.tipo === "horno" && s.inv.regolito <= 0) st = "idle";
    s.modStatus[m.uid] = st;
  }
  s.battery = Math.min(batteryCap(s), Math.max(0, s.battery + (eIn - eOut) * dt * BATTERY_RATE));
  if (powered) for (const m of s.modules) if (m.tipo === "taladro" && isOn(m)) {
    s.drillAcc = (s.drillAcc ?? 0) + (TIPOS.taladro.produce_hielo ?? 0) * lvMult(m) * dt;
    if (s.drillAcc >= 1) { s.drillAcc -= 1; addItem(s, "hielo", 1); }
  }

  // production
  if (elecOn) {
    const w = Math.min(s.inv.agua, balance.electrolisis_agua_kg_s * bestMult(s, "electrolisis") * dt);
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
    const r = Math.min(s.inv.regolito, 0.05 * bestMult(s, "horno") * dt);
    s.inv.regolito -= r;
    s.inv.metal += r * 0.3;
    s.habitatO2 = Math.min(100, s.habitatO2 + r * 2);
  }
  // boil-off
  const boil = day ? balance.boiloff_dia_por_s : balance.boiloff_noche_por_s;
  s.lh2 = Math.max(0, s.lh2 - s.lh2 * boil * dt * (working(s, "licuefactor") ? balance.boiloff_factor_con_licuefactor * Math.pow(0.7, bestMult(s, "licuefactor") / mejoras.efecto_por_nivel - 1 / mejoras.efecto_por_nivel) : 1));

  // habitat
  s.habitatO2 = Math.max(0, s.habitatO2 - (0.02 / bestMult(s, "habitat")) * dt);

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
  } else if (suitWorking(s)) {
    const farMult = (ctx.distFromHab ?? 0) > 340 ? 1.25 : 1;
    s.suitO2 = Math.max(0, s.suitO2 - 0.28 * dt * d.consumo * farMult);
  }
  // Neglecting base crises while far from base causes system/rocket degradation.
  if ((ctx.distFromHab ?? 0) > 340 && (s.leaks.length > 0 || s.aliens.length > 0)) {
    s.farNeglectT += dt;
    if (s.farNeglectT >= 25) {
      s.farNeglectT = 0;
      const targetSub = s.leaks.some((l) => l.target !== "habitat") ? "Propulsion" : "Structure";
      s.rocket[targetSub] = Math.max(0, (s.rocket[targetSub] ?? 0) - 2);
      const activeMod = s.modules.find((m) => isOn(m) && m.tipo !== "cofre");
      if (activeMod) activeMod.durabilidad = Math.max(0, activeMod.durabilidad - 6);
      addLog(s, `⚠ Base neglected from afar: ${targetSub} -2% and module wear!`);
    }
  } else {
    s.farNeglectT = Math.max(0, s.farNeglectT - dt * 2);
  }
  if (!ctx.inHabitat) {
    if (suitWorking(s)) {
      const before = s.suit.integrity;
      s.suit.integrity = Math.max(0, s.suit.integrity - SUIT_WEAR_S * dt);
      if (before >= 25 && s.suit.integrity < 25) addLog(s, "⚠ Space suit integrity low: repair it at the Workshop.");
      if (before > 0 && s.suit.integrity === 0) addLog(s, "⚠ Your space suit failed! Get back to the habitat.");
    } else hurt(s, VACUUM_DMG_S * dt, s.suit.owned && s.suit.worn ? "had a suit failure in the vacuum" : "was exposed to the vacuum without a suit");
  }
  // Thirst: you can't drink with the helmet on. Inside the habitat, suit off, you drink stored water.
  if (s.suit.worn) s.hydration = Math.max(0, s.hydration - THIRST_S * dt);
  else if (ctx.inHabitat) {
    const sip = Math.min(100 - s.hydration, 6 * dt);
    if (s.inv.agua > 0) { s.hydration += sip; s.inv.agua = Math.max(0, s.inv.agua - sip * 0.05); }
    else s.hydration = Math.min(100, s.hydration + sip / 6); // a little recycled water from the habitat
  }
  if (s.hydration <= 0) hurt(s, 1.2 * dt, "died of thirst");
  const ins = s.inv.aislamiento > 0 ? 0.5 : 1;
  let target = 21;
  if (!ctx.inHabitat) {
    if (!day) target = s.battery > 0 ? 8 : -20;
    if (ctx.zoneTemp !== undefined) target = ctx.zoneTemp;
    if (ctx.inShadow) target -= 18 * ins;
    if (ev === "eclipse") target -= 30;
    if (ev === "pico_termico" && !ctx.inShadow) target = 62;
    if (s.equip.includes("traje_termico") && target < 15) target = Math.max(target, 10); // insulated suit holds ~10 °C
    if (s.equip.includes("capa_reflectante") && target > 30) target = Math.min(target, 30); // reflective cape caps ~30 °C
  } else if (s.battery <= 0) target = 0;
  s.temp += (target - s.temp) * Math.min(1, dt * 0.08);
  if (s.suitO2 <= 0 && suitWorking(s) && !ctx.inHabitat) hurt(s, 3 * dt, "ran out of oxygen");
  if (ctx.inHabitat && s.suitO2 > 50 && s.temp > 10) s.health = Math.min(100, s.health + 0.5 * dt);
  s.health = Math.max(0, s.health);

  // alerts
  s.alert = s.battery <= 0 && eIn <= 0 && s.modules.some((m) => TIPOS[m.tipo].energia < 0 && isOn(m)) ? "NO POWER: production stopped — wait for sunlight or add panels/batteries" : s.leaks.length ? `LEAK! ${s.leaks.map((l) => (l.target === "habitat" ? "HABITAT" : l.target.toUpperCase())).join(" · ")} — Need 1 Sealant kit (2 Scrap + 1 Metal) · Hold E` :
    s.suitO2 < 20 ? "SUIT O2 LOW" : s.temp < 5 ? "HYPOTHERMIA" : s.battery < 5 ? "BATTERIES DEPLETED" : s.sanity < 25 ? "CREW MORALE CRITICAL: return to habitat or eat food" : "";

  // acts
  if (s.act === 1 && s.inv.hielo + s.inv.agua >= 6 && s.inv.chatarra >= 4 && s.actFlags.leakFixed) advanceAct(s);
  if (s.act === 2 && s.lh2 >= balance.meta_acto2_lh2_kg) advanceAct(s);
  s.pickupFeed = s.pickupFeed.map((p) => ({ ...p, t: p.t - dt })).filter((p) => p.t > 0);
  cleanupInventory(s);
}

/** Remove depleted items from the hotbar and gear that is no longer owned. */
export function cleanupInventory(s: Sim) {
  const inv = s.inv as unknown as Record<string, number>;
  s.hotbarItems = s.hotbarItems.map((k) => (k && !NOT_CARRIED.has(k) && (inv[k] ?? 0) >= 1 ? k : null));
  s.equip = s.equip.filter((g) => (inv[g] ?? 0) >= 1);
  if (s.buildMode && (inv[s.buildMode] ?? 0) < 1) s.buildMode = null;
}

/** Respawn after death: everything you carried stays in a bag where you died; you wake in the habitat with the spare suit. */
export function respawn(s: Sim, hab: { x: number; y: number }) {
  const d = s.dead ?? { cause: "", x: hab.x, y: hab.y };
  const inv = s.inv as unknown as Record<string, number>;
  const items: Record<string, number> = {};
  for (const [k, v] of Object.entries(inv)) { const n = Math.floor(v); if (n > 0) { items[k] = n; inv[k] = v - n; } }
  if (Object.keys(items).length) s.drops.push({ id: s.nextDropId++, x: Math.round(d.x), y: Math.round(d.y), items });
  s.equip = [];
  s.hotbarItems = s.hotbarItems.map(() => null);
  s.suit = { owned: true, worn: true, integrity: 40 };
  s.dead = null; s.respawned = true;
  onDeath(s);
  s.hydration = 70; s.lastHurt = "";
  addLog(s, "You respawned in the habitat with the spare suit (40%). Your items are in a bag where you died.");
}

/** Pick up a death bag (as much as fits). Returns true if the bag is now empty. */
export function pickUpDrop(s: Sim, id: number) {
  const b = s.drops.find((x) => x.id === id);
  if (!b) return false;
  for (const [k, n] of Object.entries(b.items)) {
    let left = n;
    while (left > 0 && addItem(s, k as keyof Inv, 1)) left--;
    if (left > 0) b.items[k] = left; else delete b.items[k];
  }
  if (!Object.keys(b.items).length) { s.drops = s.drops.filter((x) => x !== b); addLog(s, "You recovered all your items."); return true; }
  addLog(s, "Inventory full: some items are still in the bag.");
  return false;
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

// ---- Zones ----
export type Zona = (typeof zonasCfg.zonas)[number] & { temp?: number; req?: { equip?: string; puente?: boolean }; bloqueo?: string; recurso?: string };
export const ZONAS = zonasCfg.zonas as Zona[];
export const WORLD = zonasCfg.mundo;
export const FOG_CELL = zonasCfg.celda_niebla;
export const FOG_COLS = Math.ceil(WORLD.w / FOG_CELL), FOG_ROWS = Math.ceil(WORLD.h / FOG_CELL);
export const zoneAt = (x: number, y: number): Zona => ZONAS.find((z) => x >= z.rect[0]! && y >= z.rect[1]! && x < z.rect[0]! + z.rect[2]! && y < z.rect[1]! + z.rect[3]!) ?? ZONAS[0]!;
/** Why you can't enter a zone yet (null = you can). */
export function zoneBlock(s: Sim, z: Zona): string | null {
  if (z.req?.equip && !s.equip.includes(z.req.equip)) return z.bloqueo ?? "You can't go there yet";
  if (z.req?.puente && !s.bridge) return z.bloqueo ?? "You can't go there yet";
  return null;
}
/** Mark fog cells around (x, y) as explored. */
export function reveal(s: Sim, x: number, y: number, r = zonasCfg.radio_vision) {
  if (s.explored.length !== FOG_COLS * FOG_ROWS) s.explored = new Array(FOG_COLS * FOG_ROWS).fill(0);
  const c0 = Math.max(0, Math.floor((x - r) / FOG_CELL)), c1 = Math.min(FOG_COLS - 1, Math.floor((x + r) / FOG_CELL));
  const r0 = Math.max(0, Math.floor((y - r) / FOG_CELL)), r1 = Math.min(FOG_ROWS - 1, Math.floor((y + r) / FOG_CELL));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const mx = cx * FOG_CELL + FOG_CELL / 2, my = cy * FOG_CELL + FOG_CELL / 2;
    if ((mx - x) ** 2 + (my - y) ** 2 <= (r + FOG_CELL / 2) ** 2) s.explored[cy * FOG_COLS + cx] = 1;
  }
}
export const BRIDGE = zonasCfg.puente;
export function buildBridge(s: Sim) {
  if (s.bridge || !canCraft(s.inv, BRIDGE.costo)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(BRIDGE.costo)) inv[k] = (inv[k] ?? 0) - v;
  s.bridge = true;
  addLog(s, "🌉 You built the ravine bridge. The Alien Hive is now reachable.");
  return true;
}
