import { ITEMS } from "./items";
import modos from "@/data/modos.json";
import modulos from "@/data/modulos.json";
import recetas from "@/data/recetas.json";
import subsistemas from "@/data/subsistemas_cohete.json";
import balance from "@/data/balance.json";
import mejoras from "@/data/mejoras.json";
import zonasCfg from "@/data/zonas.json";
import { bestTool } from "./tools";

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
export interface Module { uid: number; tipo: ModType; x: number; y: number; durabilidad: number; activo: boolean; level?: number; acc?: number; tick?: number;
  /** Rover trip state: live position, phase, chosen material and cargo. */
  rx?: number; ry?: number; rst?: "go" | "mine" | "back" | "idle"; mat?: string; load?: number; tx?: number; ty?: number; note?: string }
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

export interface Inv { hielo: number; agua: number; regolito: number; chatarra: number; metal: number; kits: number; baterias: number; pala_mejorada: number; aislamiento: number; paneles: number; taladro: number; taller: number; horno: number; torres_luz: number; planta_electrolisis: number; criotanque: number; pieza_motor: number; cofre: number; puente_kit: number; rover: number; biorreactor: number; hidroponia: number; robot_lab: number; vidrio_solar: number; cristal_estelar: number; semilla_papa: number; semilla_trigo: number; papa: number; trigo: number; papa_horneada: number; pan: number; galleta: number; cristal_hielo: number; titanio: number; aleacion: number; pala_titanio: number; baton: number; traje_termico: number; capa_reflectante: number; escudo_radiacion: number; botiquin: number; estimulante: number; alga_lunar: number; racion: number; comida_caliente: number; pico_plasma: number; armadura_lunar: number; botas_gravedad: number }

export function createSim(mode: Mode, difficulty: Difficulty) {
  return {
    mode, difficulty,
    time: 60, day: 1,
    suitO2: 100, health: 100, temp: 21,
    battery: 60, energyIn: 0, energyOut: 0,
    habitatO2: 80,
    lh2: 0, lox: 0, h2gas: 0, o2gas: 0,
    inv: { hielo: 0, agua: 0, regolito: 0, chatarra: 2, metal: 1, kits: difficulty === "facil" ? 3 : 1, baterias: 0, pala_mejorada: 0, aislamiento: 0, paneles: 0, taladro: 0, taller: 1, horno: 0, torres_luz: 0, planta_electrolisis: 0, criotanque: 0, pieza_motor: 0, cofre: 0, puente_kit: 0, rover: 0, biorreactor: 0, hidroponia: 0, robot_lab: 0, vidrio_solar: 0, cristal_estelar: 0, semilla_papa: 0, semilla_trigo: 0, papa: 0, trigo: 0, papa_horneada: 0, pan: 0, galleta: 0, cristal_hielo: 0, titanio: 0, aleacion: 0, pala_titanio: 0, baton: 0, traje_termico: 0, capa_reflectante: 0, escudo_radiacion: 0, botiquin: 0, estimulante: 0, alga_lunar: 0, racion: difficulty === "facil" ? 1 : 0, comida_caliente: 0, pico_plasma: 0, armadura_lunar: 0, botas_gravedad: 0 } as Inv,
    relay: false,
    // --- historia, efectos, eventos y botín ---
    effects: [] as string[],
    fatigue: 0,
    // Base tech: dust on the solar panels, the EDS shield, the Mars nav-core, historic sites visited, launch destination.
    dust: 0,
    eds: false,
    navcore: false,
    pois: [] as string[],
    scanner: false,
    destino: "earth" as "earth" | "mars",
    // The base chest starts with a few seeds for the hydroponic farm.
    chests: { [String(modulos.iniciales.findIndex((m) => m.tipo === "cofre") + 1)]: { semilla_papa: 2, semilla_trigo: 2 } } as Record<string, Record<string, number>>,
    modStatus: {} as Record<number, "ok" | "nopower" | "idle" | "off">,
    archive: [] as string[],
    // Exploration: fog-of-war cells (1 = seen), last position, zones visited, ravine bridge, hive creatures.
    explored: [] as number[],
    pos: { x: 110, y: 200 },
    worldW: zonasCfg.mundo.w, // map size this save was made on (the map shrank 30% once)
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
    drops: [] as { id: number; x: number; y: number; items: Record<string, number>; /** set on bags the player threw down on purpose */ kind?: "thrown" }[],
    nextDropId: 1,
    notices: [] as { id: number; kind: "achievement" | "mission"; title: string; text: string }[],
    nextNoticeId: 1,
    tut: { step: 0, skipped: false, moved: 0, invOpened: false, kitCrafted: false, seen: [] as string[], acks: [] as string[], built: false },
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
    stats: { hielo: 0, capsulas: 0, aliens: 0, reparaciones: 0, llamaradas: 0, noches: 0 },
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
    result: null as null | { ok: boolean; dia: number; ventana: string; lh2Sobra: number; loxSobra: number; destino?: "earth" | "mars" },
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
    shed: false,
    robertMet: false,
    robert: { level: 1, skills: [] as string[], mat: "regolito", skin: "gold" }, // upgrades from the Robert Station
    roverTech: { level: 1, skills: [] as string[], skin: "gold" }, // Auto-Miner Rover upgrades (Robert Station), shared by all rovers
    roverUid: null as number | null, // rover whose panel is open // saw Mini Robert's mandatory intro
    machineFx: [] as { x: number; y: number; text: string }[],
    farms: {} as Record<string, { crop: string | number; growth: number; water?: number }>,
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

/** Solar output multiplier from dust (set every step; the EDS keeps it at 1). */
let dustFactor = 1;
/** Heavy industry the base pauses on its own when the battery runs low at night, to keep life support alive. */
export const SHED = new Set<string>(["electrolisis", "licuefactor", "horno", "taladro"]);
let shedNow = false;
export function moduleEnergy(m: Module, day: boolean) {
  if (!isOn(m)) return 0;
  if (shedNow && SHED.has(m.tipo)) return 0;
  const t = TIPOS[m.tipo];
  if (t.solo_dia && !day) return 0;
  return t.energia * (t.energia > 0 && m.durabilidad < 30 ? 0.5 : 1) * (t.energia > 0 ? lvMult(m) : 1) * (m.tipo === "panel" ? dustFactor : 1);
}
export function energyBalance(s: Sim, day: boolean) {
  dustFactor = 1 - dustLoss(s); // this sim's dust, never a stale value from another game
  shedNow = !!s.shed;
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
  const t = bestTool(s.inv); // the table lives in tools.ts
  return { name: t.name, yield: t.yield + bonus, cd: t.cooldown };
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
  else s.drops.push({ id: s.nextDropId++, x: Math.round(x), y: Math.round(y + 6), items: { [key]: k }, kind: "thrown" });
  return k;
}

/** Real suits carry an in-suit drink bag (~0.9 L). Here: 4 kg of water from the tank restores 25 hydration. */
export const DRINK_KG = 4, DRINK_GAIN = 25;
export function drinkWater(s: Sim): { ok: boolean; msg: string } {
  if (s.inv.agua < DRINK_KG) return { ok: false, msg: `Not enough water (a drink takes ${DRINK_KG} kg)` };
  if (s.hydration >= 92) return { ok: false, msg: "You're not thirsty yet" };
  s.inv.agua -= DRINK_KG; s.hydration = Math.min(100, s.hydration + DRINK_GAIN);
  addLog(s, `You drank from the suit's drink bag: hydration ${Math.round(s.hydration)}%.`);
  return { ok: true, msg: `Hydration +${DRINK_GAIN}` };
}

/** Pour water out of the habitat tank (it can't be thrown on the ground). Returns the kg poured. */
export function pourWater(s: Sim, kg: number): number {
  const k = Math.min(Math.max(0, kg), s.inv.agua);
  if (k <= 0) return 0;
  s.inv.agua -= k;
  addLog(s, `You poured out ${Math.round(k)} kg of water.`);
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
/**
 * Give a reward: whatever fits goes to the inventory, the rest is left in a bag at your feet
 * (so a full inventory never eats loot). Returns how many went straight to the inventory.
 */
export function giveItem(s: Sim, key: keyof Inv, n = 1) {
  let got = 0;
  while (got < n && addItem(s, key, 1)) got++;
  const left = n - got;
  if (left > 0) {
    const bag = s.drops.find((d) => d.kind === "thrown" && Math.hypot(d.x - s.pos.x, d.y - (s.pos.y + 6)) < 12);
    if (bag) bag.items[key] = (bag.items[key] ?? 0) + left;
    else s.drops.push({ id: s.nextDropId++, x: Math.round(s.pos.x), y: Math.round(s.pos.y + 6), items: { [key]: left }, kind: "thrown" });
    addLog(s, `Inventory full: ${left} ${key.replace(/_/g, " ")} left on the ground next to you.`);
  }
  return got;
}
export type Receta = (typeof recetas)[number];
export function recipeBlock(s: Sim, r: Receta): string | null {
  if (!r.disponible) return "Coming soon";
  if (r.lugar === "taller" && !s.near.taller) return "Go to the Workshop";
  if (r.lugar === "horno" && !s.near.horno) return "Go to the Furnace";
  if (r.id === "navcore" && !marsReady(s)) return "Needs full tanks at a 6:1 LOX:LH2 mix";
  if ((r.id === "navcore" && s.navcore) || (r.id === "eds" && s.eds)) return "Already installed";
  if (!canCraft(s.inv, r.ingredientes)) return "Missing materials";
  return null;
}
export function craft(s: Sim, r: Receta) {
  if (recipeBlock(s, r)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(r.ingredientes)) inv[k] = (inv[k] ?? 0) - (v ?? 0);
  for (const [k, v] of Object.entries(r.resultado)) {
    if (k === "eds") { s.eds = true; s.dust = 0; addLog(s, "EDS Dust Shield installed on your solar panels."); continue; }
    if (k === "navcore") { s.navcore = true; addLog(s, "Interplanetary Nav-Core installed: Mars (Jezero Crater) is now a launch option."); continue; }
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
  if (s.suit.worn && !inHabitat) return "Outside there is no air! Take it off inside the habitat (press E at the habitat, or V next to it)";
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
  const sunny = day && ev !== "eclipse";
  // Smart power: below 30 % battery without sun, pause heavy machines; resume above 50 % or in daylight.
  const wasShed = s.shed;
  s.shed = !sunny && s.battery < batteryCap(s) * (s.shed ? 0.5 : 0.3);
  if (s.shed && !wasShed) addLog(s, "🔋 Low battery: electrolysis, liquefier, furnace and drill paused to keep the habitat warm and breathing.");
  const { inp: eIn, out: eOut } = energyBalance(s, sunny);
  const powered = s.battery > 0 || eIn > 0;
  const elecOn = powered && !s.shed && working(s, "electrolisis") && s.inv.agua > 0;
  const liqOn = powered && !s.shed && working(s, "licuefactor") && (s.h2gas > 0 || s.o2gas > 0);
  const hornoOn = powered && !s.shed && working(s, "horno") && s.inv.regolito > 0;
  s.energyIn = eIn; s.energyOut = eOut;
  // What each module is doing right now, so the player can see why things work or don't.
  for (const m of s.modules) {
    let st: "ok" | "nopower" | "idle" | "off" = "ok";
    if (!m.activo || m.durabilidad <= 0) st = "off";
    else if (m.tipo === "panel") st = day && ev !== "eclipse" ? "ok" : "idle";
    else if (TIPOS[m.tipo].energia < 0 && (!powered || (s.shed && SHED.has(m.tipo)))) st = "nopower";
    else if (m.tipo === "electrolisis" && s.inv.agua <= 0) st = "idle";
    else if (m.tipo === "licuefactor" && s.h2gas <= 0 && s.o2gas <= 0) st = "idle";
    else if (m.tipo === "horno" && s.inv.regolito <= 0) st = "idle";
    s.modStatus[m.uid] = st;
  }
  s.battery = Math.min(batteryCap(s), Math.max(0, s.battery + (eIn - eOut) * dt * BATTERY_RATE));
  if (powered && !s.shed) for (const m of s.modules) if (m.tipo === "taladro" && isOn(m)) {
    s.drillAcc = (s.drillAcc ?? 0) + (TIPOS.taladro.produce_hielo ?? 0) * lvMult(m) * dt;
    if (s.drillAcc >= 1) {
      const chest = s.modules.find((c) => c.tipo === "cofre" && moveIntoChest(s, c.uid, "hielo", 1));
      if (chest || addItem(s, "hielo", 1)) { s.drillAcc -= 1; s.machineFx.push({ x: m.x, y: m.y - 10, text: chest ? "+1 Ice → chest" : "+1 Ice" }); } else s.drillAcc = 1;
    }
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
    // Unsealed leaks drain base power and morale, and severe tank leaks degrade propulsion.
    s.battery = Math.max(0, s.battery - 0.6 * l.size * dt);
    s.sanity = Math.max(0, s.sanity - 0.35 * dt);
    if (l.target !== "habitat" && l.size >= 2) s.rocket["Propulsion"] = Math.max(0, (s.rocket["Propulsion"] ?? 0) - 0.12 * dt);
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
  } else if (s.battery <= 0) target = 14; // insulated walls hold heat even when batteries are empty
  s.temp += (target - s.temp) * Math.min(1, dt * 0.08);
  if (s.suitO2 <= 0 && suitWorking(s) && !ctx.inHabitat) {
    hurt(s, 7 * dt, "suffocated (O2 depleted)");
    s.sanity = Math.max(0, s.sanity - 3 * dt);
  }
  if (ctx.inHabitat && s.suitO2 > 40 && s.temp > 10) s.health = Math.min(100, s.health + 1.8 * dt);
  s.health = Math.max(0, s.health);

  // alerts
  s.alert = s.suitO2 <= 0 && !ctx.inHabitat ? "OXYGEN DEPLETED! SUFFOCATING — RETURN TO HABITAT!" : s.battery <= 0 && eIn <= 0 && s.modules.some((m) => TIPOS[m.tipo].energia < 0 && isOn(m)) ? "NO POWER: production stopped — wait for sunlight or add panels/batteries" : s.leaks.length ? `LEAK! ${s.leaks.map((l) => (l.target === "habitat" ? "HABITAT" : l.target.toUpperCase())).join(" · ")} — Need 1 Sealant kit (2 Scrap + 1 Metal) · Hold E` :
    s.suitO2 < 20 ? "SUIT O2 LOW" : s.temp < 5 ? "HYPOTHERMIA" : s.battery < 5 ? "BATTERIES DEPLETED" : s.sanity < 25 ? "CREW MORALE CRITICAL: return to habitat or eat food" : "";

  // acts
  if (s.act === 1 && s.inv.hielo + s.inv.agua >= 6 && s.inv.chatarra >= 4 && s.actFlags.leakFixed) advanceAct(s);
  if (s.act === 2 && s.lh2 >= balance.meta_acto2_lh2_kg) advanceAct(s);
  s.pickupFeed = s.pickupFeed.map((p) => ({ ...p, t: p.t - dt })).filter((p) => p.t > 0);
  stepBaseTech(s, dt, day);
  cleanupInventory(s);
}

/** Remove depleted items from the hotbar and gear that is no longer owned. */
export function cleanupInventory(s: Sim) {
  const inv = s.inv as unknown as Record<string, number>;
  s.hotbarItems = s.hotbarItems.map((k) => (k && (inv[k] ?? 0) >= 1 ? k : null));
  s.equip = s.equip.filter((g) => (inv[g] ?? 0) >= 1);
  if (s.buildMode && (inv[s.buildMode] ?? 0) < 1) s.buildMode = null;
}

export type DeathSacrifice = "agua" | "chatarra" | "metal";

/** How much of a reserve is lost to pay for an emergency rescue respawn. */
export function sacrificeCost(s: Sim, kind: DeathSacrifice): number {
  const cur = s.inv[kind] ?? 0;
  if (cur < 1) return 0;
  if (kind === "agua") return Math.min(Math.round(cur), Math.max(15, Math.ceil(cur * 0.6)));
  if (kind === "chatarra") return Math.min(Math.floor(cur), Math.max(4, Math.ceil(cur * 0.6)));
  return Math.min(Math.floor(cur), Math.max(3, Math.ceil(cur * 0.6)));
}

/** Emergency medical rest inside the habitat using 5 kg of water to restore +35 HP. */
export function healInHabitat(s: Sim): { ok: boolean; msg: string } {
  if (!s.near.habitat) return { ok: false, msg: "Return to the Habitat to use the medical bay." };
  if (s.health >= 100) return { ok: false, msg: "Health is already full." };
  if (s.inv.agua < 5) return { ok: false, msg: "Need 5 kg Water to run medical hydration." };
  s.inv.agua -= 5;
  s.health = Math.min(100, s.health + 35);
  s.hydration = Math.min(100, s.hydration + 25);
  addLog(s, "Medical rest in Habitat: -5 kg Water, +35 HP.");
  return { ok: true, msg: "+35 HP restored (-5 kg Water)" };
}

/** Respawn after death: everything you carried stays in a bag where you died; you wake in the habitat with the spare suit. */
export function respawn(s: Sim, hab: { x: number; y: number }, sacrifice?: DeathSacrifice) {
  const d = s.dead ?? { cause: "", x: hab.x, y: hab.y };
  if (sacrifice) {
    const cost = sacrificeCost(s, sacrifice);
    if (cost > 0) {
      s.inv[sacrifice] = Math.max(0, (s.inv[sacrifice] ?? 0) - cost);
      const label = sacrifice === "agua" ? `${cost} kg Water` : sacrifice === "chatarra" ? `${cost} Scrap` : `${cost} Metal`;
      addLog(s, `Emergency rescue cost: sacrificed ${label}.`);
    }
  }
  const inv = s.inv as unknown as Record<string, number>;
  const items: Record<string, number> = {};
  for (const [k, v] of Object.entries(inv)) { if (NOT_CARRIED.has(k)) continue; const n = Math.floor(v); if (n > 0) { items[k] = n; inv[k] = v - n; } }
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
  return applyBridgeKit(s);
}

// ---- Base automation and dust (Auto-Miner Rover, Algae Bioreactor, EDS) ----
export const DUST_PER_S = 1 / 1800;      // panels fully dusty after ~30 min without cleaning
export const ROVER_PERIOD_S = 20;        // one load every 20 s
export const BIO_RATION_S = 120;         // a Space ration every 2 min
export const marsReady = (s: Sim) => s.lh2 >= LH2_CAP * 0.99 && s.lox >= LOX_CAP * 0.99 && Math.abs(s.lox / Math.max(0.01, s.lh2) - 6) <= 0.3;
export const dustLoss = (s: Sim) => (s.eds ? 0 : s.dust * 0.5);

export function stepBaseTech(s: Sim, dt: number, day: boolean) {
  // Electrostatic lunar dust builds up on the panels (Apollo crews fought it); the EDS removes it.
  s.dust = s.eds ? 0 : Math.min(1, s.dust + DUST_PER_S * dt);
  dustFactor = 1 - dustLoss(s);
  void day;
  const powered = s.battery > 0 || s.energyIn > 0;
  const chests = s.modules.filter((m) => m.tipo === "cofre");
  const inv = s.inv as unknown as Record<string, number>;
  for (const m of s.modules) {
    if (!isOn(m)) continue;
    if (m.tipo === "rover") stepRover(s, m, dt, chests); // own radioisotope power: works day and night
    else if (m.tipo === "biorreactor") {
      if (!powered) { s.modStatus[m.uid] = "nopower"; continue; }
      const water = 0.02 * dt;
      if (s.inv.agua < water) { s.modStatus[m.uid] = "idle"; continue; }
      s.inv.agua -= water;
      s.habitatO2 = Math.min(100, s.habitatO2 + 0.06 * dt);
      m.acc = (m.acc ?? 0) + dt / BIO_RATION_S;
      if (m.acc >= 1) {
        m.acc -= 1;
        const chest = chests.find((c) => moveIntoChest(s, c.uid, "racion", 1));
        if (!chest && addItem(s, "racion" as keyof Inv, 1)) addLog(s, "The bioreactor grew a Space ration.");
        s.machineFx.push({ x: m.x, y: m.y - 10, text: "+1 Ration" });
      }
    } else if (m.tipo === "hidroponia") stepFarm(s, m, dt, powered);
  }
  // Med-bot skill: Mini Robert slowly patches you up while he rolls with you.
  if (s.robert?.skills.includes("medic") && !s.dead && s.health > 0 && s.health < 100) s.health = Math.min(100, s.health + ROBERT_MEDIC_HP_S * s.robert.level * dt);
  if (s.machineFx.length > 12) s.machineFx.splice(0, s.machineFx.length - 12);
}

// ---- Auto-Miner Rover: drives to where its material is, mines, drives back and fills the chest ----
export const ROVER_MATS = ["regolito", "hielo", "chatarra", "metal", "alga_lunar", "cristal_hielo", "titanio", "aleacion"] as const;
export const ROVER_SPEED = 45;   // world px per second
export const ROVER_MINE_S = 6;   // seconds digging at the site
export const ROVER_LOAD = 3;     // units per trip
type SubzonaCfg = { id: string; zona: string; nombre: string; x: number; y: number; recursos: string[] };
const SITES = (zonasCfg.subzonas ?? []) as SubzonaCfg[];
/** Nearest place (subzone) that has this material and that the rover can reach (the Hive needs the bridge). */
export function roverSite(s: Sim, mat: string, from: { x: number; y: number }) {
  let best: SubzonaCfg | undefined, bd = Infinity;
  for (const z of SITES) {
    if (!z.recursos.includes(mat) || (z.zona === "hive" && !s.bridge)) continue;
    const d = Math.hypot(z.x - from.x, z.y - from.y);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
/** Advance only the Auto-Miner Rovers (used while the map is open, so you can watch them live). */
export function stepRoversOnly(s: Sim, dt: number) {
  const chests = s.modules.filter((m) => m.tipo === "cofre");
  for (const m of s.modules) if (m.tipo === "rover" && isOn(m)) stepRover(s, m, dt, chests);
}
function stepRover(s: Sim, m: Module, dt: number, chests: Module[]) {
  m.rx ??= m.x; m.ry ??= m.y; m.rst ??= "idle"; m.mat ??= "regolito"; m.load ??= 0;
  const home = chests.reduce<Module | undefined>((b, c) => (!b || Math.hypot(c.x - m.x, c.y - m.y) < Math.hypot(b.x - m.x, b.y - m.y) ? c : b), undefined);
  if (!home) { m.rst = "idle"; m.note = "Needs a storage chest"; s.modStatus[m.uid] = "idle"; return; }
  const drive = (x: number, y: number) => {
    const dx = x - m.rx!, dy = y - m.ry!, d = Math.hypot(dx, dy), step = roverSpeed(s) * dt;
    if (d <= step) { m.rx = x; m.ry = y; return true; }
    m.rx! += (dx / d) * step; m.ry! += (dy / d) * step; return false;
  };
  s.modStatus[m.uid] = "ok";
  if (m.rst === "idle") {
    const site = roverSite(s, m.mat, { x: m.rx, y: m.ry });
    if (!site) { m.note = "That material is out of reach (build the bridge)"; s.modStatus[m.uid] = "idle"; return; }
    m.tx = site.x; m.ty = site.y; m.rst = "go"; m.note = `Heading to ${site.nombre}`;
  }
  if (m.rst === "go" && drive(m.tx!, m.ty!)) { m.rst = "mine"; m.acc = 0; m.note = "Mining…"; }
  else if (m.rst === "mine") {
    m.acc = (m.acc ?? 0) + dt;
    if (m.acc >= roverMineS(s)) { m.load = roverLoad(s); m.rst = "back"; m.note = "Returning to base"; }
  } else if (m.rst === "back" && drive(home.x, home.y + 10)) {
    const name = ITEMS[m.mat]?.nombre ?? m.mat;
    let put = 0;
    while (put < (m.load ?? 0) && moveIntoChest(s, home.uid, m.mat, 1)) put++;
    m.load = (m.load ?? 0) - put;
    if (put) { s.machineFx.push({ x: home.x, y: home.y - 10, text: `+${put} ${name} → chest` }); m.tick = (m.tick ?? 0) + put; }
    if (m.load > 0) { m.note = "Chest full: empty it"; s.modStatus[m.uid] = "idle"; return; }
    m.rst = "idle"; m.note = "Unloaded";
  }
}
// Auto-Miner upgrades (bought at the Robert Station; every rover shares them).
export const ROVER_MAX_LEVEL = 5;
export const ROVER_SKILLS: Record<string, { nombre: string; icon: string; desc: string; cost: Record<string, number> }> = {
  turbo: { nombre: "Turbo wheels", icon: "🛞", desc: "Drives 40% faster to the site and back.", cost: { metal: 4, baterias: 1 } },
  cargo: { nombre: "Cargo bay", icon: "📦", desc: "Carries 3 more units on every trip.", cost: { metal: 5, chatarra: 3 } },
  drill: { nombre: "Diamond drill", icon: "💎", desc: "Mines twice as fast at the site.", cost: { metal: 3, cristal_hielo: 2 } },
  lights: { nombre: "Headlights", icon: "🔦", desc: "Lights the ground around the rover at night.", cost: { metal: 2, chatarra: 2 } },
};
export function roverUpCost(level: number): Record<string, number> {
  return { metal: 4 * level, chatarra: 2 * level, ...(level >= 2 ? { baterias: 1 } : {}), ...(level >= 4 ? { titanio: 2 } : {}) };
}
const rt = (s: Sim) => s.roverTech ?? { level: 1, skills: [], skin: "gold" };
/** Rover stats from its level and skills. */
export const roverSpeed = (s: Sim) => ROVER_SPEED * (1 + 0.1 * (rt(s).level - 1)) * (rt(s).skills.includes("turbo") ? 1.4 : 1);
export const roverMineS = (s: Sim) => ROVER_MINE_S * (rt(s).skills.includes("drill") ? 0.5 : 1);
export const roverLoad = (s: Sim) => ROVER_LOAD + (rt(s).level - 1) + (rt(s).skills.includes("cargo") ? 3 : 0);
export function upgradeRovers(s: Sim) {
  if (s.roverTech.level >= ROVER_MAX_LEVEL || !payCost(s, roverUpCost(s.roverTech.level))) return false;
  s.roverTech.level++; addLog(s, `🚜 Auto-Miner Rovers upgraded to level ${s.roverTech.level}.`);
  return true;
}
export function unlockRoverSkill(s: Sim, id: string) {
  const sk = ROVER_SKILLS[id];
  if (!sk || s.roverTech.skills.includes(id) || !payCost(s, sk.cost)) return false;
  s.roverTech.skills.push(id); addLog(s, `🚜 Rovers got: ${sk.nombre}.`);
  return true;
}
export function setRoverSkin(s: Sim, skin: string) { if (!ROBERT_SKINS[skin]) return false; s.roverTech.skin = skin; return true; }

/** Pick the rover's material (from its panel); it heads out on the next trip. */
export function setRoverMat(s: Sim, m: Module, mat: string) {
  if (!(ROVER_MATS as readonly string[]).includes(mat)) return false;
  m.mat = mat; if (m.rst !== "back") m.rst = "idle";
  return true;
}

// ---- What each machine does and why it is or isn't working (E on a module) ----
const MODULE_DOES: Record<string, string> = {
  habitat: "Your home: refills O2, keeps you warm, bed, diary and water tank inside.",
  panel: "Makes power in daylight (dust lowers it: clean with E or build the EDS).",
  bateria: "Stores power for the night.",
  electrolisis: "Splits tank water into hydrogen + oxygen (needs power and water).",
  licuefactor: "Turns H2/O2 gas into rocket fuel LH2 + LOX (needs power).",
  horno: "Furnace: E to craft. With power it also turns regolith into O2 and metal.",
  taller: "Workshop: E to craft tools, gear and modules.",
  taladro: "Drills ice into the storage chest (must be inside the crater, needs power).",
  torre_luz: "Lights the area at night: keeps fear and aliens away (needs battery).",
  cofre: "Storage: 20 slots. Machines drop their output here.",
  rover: "Drives to its material, mines it and brings it to the chest.",
  biorreactor: "Uses tank water to add habitat O2 and grows a Space ration every 2 min (into the chest).",
  hidroponia: "Farm: plant seeds, water them, harvest.",
  robot_lab: "Upgrade Mini Robert and your rovers.",
};
export function moduleInfo(s: Sim, m: Module): string {
  const st = s.modStatus[m.uid];
  const why = m.durabilidad <= 0 ? "BROKEN — HOLD E with 1 Sealant kit to repair"
    : !m.activo ? "TURNED OFF — press E to turn it on"
    : st === "nopower" ? (s.shed ? "PAUSED: battery low at night (resumes at 50% or in daylight)" : "NO POWER: add solar panels / batteries or wait for daylight")
    : st === "idle" ? ({ electrolisis: "IDLE: the water tank is empty (melt ice inside the habitat)", licuefactor: "IDLE: no gas yet (needs electrolysis running)", horno: "IDLE: no regolith in your pockets", biorreactor: "IDLE: the water tank is empty (melt ice inside the habitat)", panel: "Resting: it's night", taladro: "IDLE: chest and pockets full", rover: m.note ?? "Waiting" } as Record<string, string>)[m.tipo] ?? "Idle"
    : "WORKING";
  return `${TIPOS[m.tipo].nombre} (${Math.round(m.durabilidad)}%): ${MODULE_DOES[m.tipo] ?? ""} — ${why}`;
}

// ---- Day / night resources and the habitat bed ----
/** Resources that only exist in one half of the lunar day (forces you to live through both). */
export const DAY_ONLY = ["vidrio_solar"] as const;
export const NIGHT_ONLY = ["cristal_estelar"] as const;
export const phaseOf = (item: string): "day" | "night" | null => ((DAY_ONLY as readonly string[]).includes(item) ? "day" : (NIGHT_ONLY as readonly string[]).includes(item) ? "night" : null);
/** Sleep in the habitat bed: only at night, with no open leaks. Skips to the next dawn and rests you. */
export function sleepUntilDawn(s: Sim): { ok: boolean; msg: string } {
  if (isDay(s)) return { ok: false, msg: "You can only sleep at night." };
  if (s.leaks.length) return { ok: false, msg: "There's a leak! Seal it before you sleep." };
  if (s.countdown !== null) return { ok: false, msg: "Not now: the launch countdown is running." };
  s.time = (Math.floor(s.time / CYCLE) + 1) * CYCLE + 1;
  s.day += 1; s.leaksToday = 0;
  s.fatigue = 0; s.sanity = Math.min(100, s.sanity + 30); s.health = Math.min(100, s.health + 15); s.hydration = Math.max(0, s.hydration - 10);
  s.aliens = []; s.abduction = 0;
  s.stats.noches += 1;
  addLog(s, `😴 You slept through the night. Day ${s.day} dawns. Fully rested.`);
  return { ok: true, msg: `Good morning! Day ${s.day}. Fatigue gone, +30 sanity, +15 health.` };
}
/** Diary pages and album photos unlock by day reached or main missions completed. */
export const personalUnlocked = (s: Sim, u: { day?: number; mission?: number }) => (u.day === undefined || s.day >= u.day) && (u.mission === undefined || s.quest.main >= u.mission);

// ---- Mini Robert upgrades (Robert Station) ----
export const ROBERT_MAX_LEVEL = 5;
export const ROBERT_MEDIC_HP_S = 0.04;
export const ROBERT_MATS = ["regolito", "hielo", "chatarra", "alga_lunar", "cristal_hielo", "titanio", "aleacion"] as const;
export const ROBERT_SKINS: Record<string, { nombre: string; tint: number }> = {
  gold: { nombre: "Classic gold", tint: 0xffffff }, silver: { nombre: "Lunar silver", tint: 0xd8e2ff },
  red: { nombre: "Mars red", tint: 0xff9a8a }, blue: { nombre: "Earth blue", tint: 0x8ab8ff }, green: { nombre: "Algae green", tint: 0x9ff0b4 },
};
export const ROBERT_SKILLS: Record<string, { nombre: string; icon: string; desc: string; cost: Record<string, number> }> = {
  forager: { nombre: "Forager", icon: "⛏", desc: "Robert rolls to resource nodes near you and gathers your chosen material.", cost: { metal: 4, baterias: 1 } },
  lamp: { nombre: "Headlamp", icon: "💡", desc: "Robert lights the area around him at night. Bigger with each level.", cost: { metal: 2, chatarra: 3 } },
  magnet: { nombre: "Magnet", icon: "🧲", desc: "Picks up items lying on the ground near you.", cost: { metal: 3, chatarra: 2 } },
  medic: { nombre: "Med-bot", icon: "➕", desc: "Slowly heals you while he is with you (faster with each level).", cost: { metal: 3, botiquin: 1 } },
};
/** Cost to raise Mini Robert to the next level. */
export function robertUpCost(level: number): Record<string, number> {
  return { metal: 3 * level, chatarra: 2 * level, ...(level >= 3 ? { baterias: 1 } : {}), ...(level >= 4 ? { titanio: 2 } : {}) };
}
/** Seconds between Forager trips (faster each level). */
export const robertForageEvery = (level: number) => Math.max(3, 9 - level * 1.2);
function payCost(s: Sim, cost: Record<string, number>) {
  const inv = s.inv as unknown as Record<string, number>;
  if (Object.entries(cost).some(([k, n]) => (inv[k] ?? 0) < n)) return false;
  for (const [k, n] of Object.entries(cost)) inv[k]! -= n;
  return true;
}
export function canPay(s: Sim, cost: Record<string, number>) {
  const inv = s.inv as unknown as Record<string, number>;
  return Object.entries(cost).every(([k, n]) => (inv[k] ?? 0) >= n);
}
export function upgradeRobert(s: Sim) {
  if (s.robert.level >= ROBERT_MAX_LEVEL || !payCost(s, robertUpCost(s.robert.level))) return false;
  s.robert.level++; addLog(s, `🤖 Mini Robert upgraded to level ${s.robert.level}.`);
  return true;
}
export function unlockRobertSkill(s: Sim, id: string) {
  const sk = ROBERT_SKILLS[id];
  if (!sk || s.robert.skills.includes(id) || !payCost(s, sk.cost)) return false;
  s.robert.skills.push(id); addLog(s, `🤖 Mini Robert learned: ${sk.nombre}.`);
  return true;
}
export function setRobertMat(s: Sim, mat: string) { if (!(ROBERT_MATS as readonly string[]).includes(mat)) return false; s.robert.mat = mat; return true; }
export function setRobertSkin(s: Sim, skin: string) { if (!ROBERT_SKINS[skin]) return false; s.robert.skin = skin; return true; }

// ---- Hydroponic farm: plant Lunar algae with E, it grows on water (and grow-lamp power), harvest with E ----
export const FARM_GROW_S = 90;          // algae: seconds to grow with power (half speed without)
export const FARM_HARVEST = 3;          // algae per harvest (plant 1, get 3)
export const FARM_WATER_S = 60;         // one watering lasts this long
export const FARM_WATER_KG = 2;         // tank water per watering
/** What a farm can grow: the seed you plant, what you cut, and how long it takes. */
export const CROPS: Record<string, { seed: string; out: string; n: number; back: number; grow: number; nombre: string }> = {
  alga_lunar: { seed: "alga_lunar", out: "alga_lunar", n: FARM_HARVEST, back: 0, grow: FARM_GROW_S, nombre: "Lunar algae" },
  papa: { seed: "semilla_papa", out: "papa", n: 3, back: 1, grow: 120, nombre: "Potatoes" },
  trigo: { seed: "semilla_trigo", out: "trigo", n: 4, back: 1, grow: 150, nombre: "Wheat" },
};
export function farmOf(s: Sim, uid: number) {
  const f = (s.farms[String(uid)] ??= { crop: "", growth: 0, water: 0 });
  if (f.crop === 1) f.crop = "alga_lunar"; else if (f.crop === 0) f.crop = ""; // older saves
  f.water ??= 1;
  return f as { crop: string; growth: number; water: number };
}
function stepFarm(s: Sim, m: Module, dt: number, powered: boolean) {
  const f = farmOf(s, m.uid), c = CROPS[f.crop];
  if (!c || f.growth >= 1) { s.modStatus[m.uid] = c ? "ok" : "idle"; return; }
  if (f.water <= 0) { s.modStatus[m.uid] = "idle"; return; } // dry: needs watering
  f.water = Math.max(0, f.water - dt / FARM_WATER_S);
  if (f.water === 0) s.machineFx.push({ x: m.x, y: m.y - 10, text: "Needs water!" });
  f.growth = Math.min(1, f.growth + (dt / c.grow) * (powered ? 1 : 0.5) * lvMult(m));
  s.modStatus[m.uid] = powered ? "ok" : "nopower";
  if (f.growth >= 1) s.machineFx.push({ x: m.x, y: m.y - 10, text: `${c.nombre} ready!` });
}
/** The seed E would plant now: the one in your hand if it is a seed, else potatoes, wheat, algae. */
export function seedToPlant(s: Sim, held?: string | null) {
  const inv = s.inv as unknown as Record<string, number>;
  const byHeld = Object.entries(CROPS).find(([, c]) => c.seed === held && (inv[c.seed] ?? 0) >= 1);
  if (byHeld) return byHeld[0];
  return ["papa", "trigo", "alga_lunar"].find((k) => (inv[CROPS[k]!.seed] ?? 0) >= 1);
}
/** E on a farm: plant if empty, water if dry, cut (harvest) if ripe. Returns a message for the player. */
export function tendFarm(s: Sim, m: Module, held?: string | null): string {
  const f = farmOf(s, m.uid);
  const inv = s.inv as unknown as Record<string, number>;
  const c = CROPS[f.crop];
  if (!c) {
    const k = seedToPlant(s, held);
    if (!k) return "No seeds: find Potato / Wheat seeds in capsules and chests, or use Lunar algae";
    inv[CROPS[k]!.seed]! -= 1; f.crop = k; f.growth = 0; f.water = 0;
    return `🌱 Planted ${CROPS[k]!.nombre}. Now WATER it (E, ${FARM_WATER_KG} kg from the tank).`;
  }
  if (f.growth < 1) {
    if (f.water < 0.5) {
      if (s.inv.agua < FARM_WATER_KG) return "💧 Not enough water in the tank: melt ice at the habitat";
      s.inv.agua -= FARM_WATER_KG; f.water = 1;
      return `💧 Watered. ${c.nombre} growing… ${Math.round(f.growth * 100)}%`;
    }
    return `🌱 ${c.nombre} growing… ${Math.round(f.growth * 100)}% · water ${Math.round(f.water * 100)}%`;
  }
  if (!addItem(s, c.out as keyof Inv, c.n)) return "Inventory full";
  if (c.back) giveItem(s, c.seed as keyof Inv, c.back);
  f.crop = ""; f.growth = 0; f.water = 0;
  return `✂ Harvested +${c.n} ${ITEMS[c.out]?.nombre ?? c.out}${c.back ? ` (+${c.back} seed back)` : ""}. Cook it at the Furnace!`;
}

/** Put an item straight into a chest (used by machines). */
export function moveIntoChest(s: Sim, uid: number, key: string, n: number) {
  const c = (s.chests[String(uid)] ??= {});
  const slots = Object.values(c).reduce((a, v) => a + Math.ceil(v / STACK), 0);
  const next = Math.ceil(((c[key] ?? 0) + n) / STACK) - Math.ceil((c[key] ?? 0) / STACK);
  if (slots + next > 20) return false;
  c[key] = (c[key] ?? 0) + n;
  return true;
}

/** Use a Bridge Kit at the ravine. */
export function applyBridgeKit(s: Sim) {
  if (s.bridge || s.inv.puente_kit < 1) return false;
  s.inv.puente_kit -= 1; s.bridge = true;
  addLog(s, "🌉 You assembled the Bridge Kit across the ravine. The Alien Hive is now reachable.");
  return true;
}

/** Visit a historic site once: reward, story text, and (for VIPER) the ground scanner. */
export function visitPoi(s: Sim, poi: { id: string; nombre: string; texto: string; reward: Record<string, number> }) {
  if (s.pois.includes(poi.id)) return false;
  s.pois.push(poi.id);
  for (const [k, n] of Object.entries(poi.reward)) giveItem(s, k as keyof Inv, n);
  if (poi.id === "viper") s.scanner = true;
  s.dialog.push({ quien: "ARIA", texto: poi.texto });
  addLog(s, `🏛 Historic site: ${poi.nombre}.`);
  notify(s, "mission", "Historic site found", poi.nombre);
  return true;
}
