/**
 * simulation.js — the engine: time, power, ISRU chemistry, cryogenics, geotechnics, electrostatic dust,
 * atmosphere and life support (BLSS), crew, rovers, events, CapCom missions, the observatory and the
 * interplanetary endgame. No DOM and no Three.js here: the state is plain JSON, so it can be saved,
 * loaded and tested in Node.
 *
 * Time is in HOURS. Masses in kg, power in kW, energy in kWh, pressure in kPa.
 * Kept from the original game: the six NASA Goddard Mission Design Lab subsystems (green at 90%),
 * LH2/LOX tanks of 30 / 180 kg with boil-off cut to 30% by a powered liquefier, the 1:8 electrolysis
 * split, the ~6:1 engine mixture and the idea of return windows (values provisional, to be replaced by GMAT).
 */
import { resolveRules } from "./gameModes.js";
import { unlockedSet, researchBlock, getTech, techFor } from "./techTree.js";

// ───────────────────────────── constants ─────────────────────────────
export const C = {
  GRID_W: 28, GRID_H: 20,
  RIM_ROWS: 4, PSR_ROW: 13,                     // y < 4 rim · 4..12 plains · >= 13 permanently shadowed crater
  TUBE: { x0: 6, x1: 21, y0: 6, y1: 10 },       // lava tube under the plains (found with the seismic radar)
  LUNAR_CYCLE_H: 672,                           // 28 Earth days: 14 of light and 14 of night on the plains
  RIM_LIGHT_FRACTION: 0.88,
  PSR_TEMP_C: -173, TUBE_TEMP_C: -20,
  PSR_DRAIN_MULT: 4, BEAM_EFFICIENCY: 0.6,
  // chemistry (mass ratios from the molar masses)
  ELECTROLYSIS_KWH_PER_KG: 5.5, H2_PER_WATER: 1 / 9, O2_PER_WATER: 8 / 9,
  ILMENITE_FRACTION: 0.12, ILM_H2: 0.01329, ILM_FE: 0.368, ILM_TIO2: 0.5265, ILM_H2O: 0.1188,
  RFC_ROUND_TRIP: 0.55, RFC_WATER_CAP: 40, RFC_CHARGE_KW: 20, RFC_DISCHARGE_KW: 15,
  SABATIER_CO2: 5.46, SABATIER_CH4: 1.99, SABATIER_H2O: 4.47,   // per kg of H2:  CO2 + 4 H2 -> CH4 + 2 H2O
  // cryogenics (kept from the original game)
  LH2_TANK_KG: 30, LOX_TANK_KG: 180, MIX_RATIO: 6, BOILOFF_PER_H: 0.0004, BOILOFF_SUN_MULT: 4, BOILOFF_COOLED: 0.3,
  // crew, per person per hour (NASA: 0.84 kg O2, 1.0 kg CO2, 3.5 kg water, 0.62 kg dry food per day)
  CREW_O2: 0.035, CREW_CO2: 0.0417, CREW_WATER: 0.146, CREW_FOOD: 0.026, WATER_RECYCLE: 0.9,
  // atmosphere: kPa per (kg / m3) at ~295 K
  KPA_O2: 76.6, KPA_N2: 87.6, KPA_CO2: 55.7, TARGET_O2: 21, TARGET_N2: 79,
  // geotechnics and dust
  SUBSIDENCE_AT: 45, SUBSIDENCE_PILED: 25, EXCAVATE_REGOLITH: 20, EXCAVATE_ICE: 8,
  PAVE_KWH: 12, PAVE_REGOLITH: 5, PAVE_STABILITY: 25,
  EDS_RADIUS: 3, EDS_PEAK_KW: 60, EDS_COOLDOWN_H: 6, BATTERY_KWH: 200, BATTERY_PEAK_KW: 25,
  SUIT_HOURS: 8, UMBRAL_VERDE: 90, MAX_SUBSTEP_H: 0.25,
};

export const RES_KEYS = ["regolith", "ice", "water", "h2", "o2", "n2", "co2", "lh2", "lox", "iron", "tio2", "parts", "food", "soil", "ch4", "science", "funds", "heliumPlasma"];

/** Where each scenario differs. The Moon is the base game; Mars and Psyche are the endgame destinations. */
export const SCENARIOS = {
  moon: { id: "moon", name: "Shackleton Crater, lunar south pole", gravity: 0.165, solar: 1, cycleH: C.LUNAR_CYCLE_H, lightFraction: 0.5, hasIce: true, co2Air: false, dustStorms: false, metalRich: false },
  mars: { id: "mars", name: "Jezero Crater, Mars", gravity: 0.38, solar: 0.43, cycleH: 24.66, lightFraction: 0.5, hasIce: true, co2Air: true, dustStorms: true, metalRich: false },
  psyche: { id: "psyche", name: "Asteroid 16 Psyche", gravity: 0.015, solar: 0.12, cycleH: 4.2, lightFraction: 0.5, hasIce: false, co2Air: false, dustStorms: false, metalRich: true },
};

/**
 * Buildings. kw < 0 is demand, gen > 0 is nominal generation. `vol` = pressurized volume in m3.
 * zones: where it may stand (null = anywhere on the surface). layer "u" = only underground, "any" = both.
 * prio: who keeps power in a shortage (0 = life support, 1 = production, 2 = science).
 */
export const BUILDINGS = {
  habitat: { name: "Habitat", cat: "station", kw: -4, vol: 80, prio: 0, cost: { parts: 30 }, layer: "any", desc: "Pressurized crew module with the water recycler (90%) and a small emergency CO2 scrubber. The hub every network starts from." },
  tunnel: { name: "Pressurized tunnel", cat: "station", kw: -0.2, vol: 10, prio: 0, cost: { parts: 4 }, layer: "any", desc: "Connects modules. With bulkheads a breach only empties the damaged module." },
  airlock_n2: { name: "N2-purge airlock", cat: "dust", kw: -0.5, prio: 0, cost: { parts: 8 }, desc: "Removes 80% of the dust each EVA brings in. Uses 0.05 kg N2 per cycle." },
  suitport: { name: "Suitport", cat: "dust", kw: -0.2, prio: 0, cost: { parts: 14 }, desc: "Suits dock outside: no dust enters at all." },
  solar: { name: "Solar panel", cat: "power", gen: 6, cost: { parts: 6 }, desc: "6 kW in full light. Dust cuts up to 80% of it." },
  vsat: { name: "Vertical solar tower (VSAT)", cat: "power", gen: 30, zones: ["rim"], cost: { parts: 22 }, desc: "30 kW. Only on the Peaks of Eternal Light (lit 88% of the cycle)." },
  kilopower: { name: "Fission power unit", cat: "power", gen: 5, always: true, cost: { parts: 60, iron: 40 }, layer: "any", desc: "5 kW day and night, dust or no dust (NASA Kilopower class). The lander brings one: it keeps the habitat alive through the lunar night." },
  battery: { name: "Battery", cat: "power", cost: { parts: 8 }, layer: "any", desc: "Stores 200 kWh. Delivers at most 25 kW." },
  rfc: { name: "Regenerative fuel cell", cat: "power", cost: { parts: 26, iron: 10 }, layer: "any", desc: "Stores surplus power as H2 + O2 from 40 kg of water and gives 55% back at night." },
  laser_tx: { name: "Power-beam laser", cat: "power", kw: -1, prio: 1, zones: ["rim", "plains"], cost: { parts: 20 }, desc: "Beams power to a receiver in the dark crater (60% efficient)." },
  laser_rx: { name: "Power-beam receiver", cat: "power", prio: 1, zones: ["psr"], cost: { parts: 12 }, desc: "Powers everything piped to it on the crater floor." },
  radiator: { name: "Thermal radiator", cat: "power", cost: { parts: 5 }, desc: "Rejects 25 kW of heat. Dust insulates it." },
  ice_extractor: { name: "Thermal ice extractor", cat: "isru", kw: -8, prio: 1, zones: ["psr", "jezero"], cost: { parts: 18 }, desc: "Heats icy soil: up to 6 kg of ice per hour into water. Weakens the ground it mines." },
  regolith_mine: { name: "Regolith excavator", cat: "isru", kw: -5, prio: 1, zones: ["plains", "jezero", "psyche"], cost: { parts: 14 }, desc: "Digs 15 kg of regolith per hour. Weakens the ground around it." },
  electrolyzer: { name: "Electrolysis plant", cat: "isru", kw: -11, prio: 1, cost: { parts: 16 }, layer: "any", desc: "2 kg of water per hour into 0.22 kg H2 + 1.78 kg O2." },
  ilmenite_reactor: { name: "Ilmenite solar furnace", cat: "isru", kw: -4, prio: 1, zones: ["plains", "rim", "jezero", "psyche"], cost: { parts: 20 }, desc: "FeTiO3 + H2 -> Fe + TiO2 + H2O from 10 kg of regolith per hour. In the dark it needs 20 kW." },
  cryo_plant: { name: "Cryogenic liquefier", cat: "isru", kw: -6, prio: 1, cost: { parts: 16 }, layer: "any", desc: "Liquefies H2 and O2 (kept near 6:1) and keeps tanks cold: boil-off drops to 30%." },
  cryo_tank: { name: "Cryotank pair", cat: "isru", cost: { parts: 10 }, layer: "any", desc: "Holds 30 kg LH2 + 180 kg LOX." },
  fabricator: { name: "Metal fabricator", cat: "isru", kw: -6, prio: 1, cost: { parts: 20 }, layer: "any", desc: "1 kg iron + 0.5 kg TiO2 into 1.2 parts per hour." },
  sabatier: { name: "Sabatier reactor", cat: "isru", kw: -5, prio: 1, zones: ["jezero"], cost: { parts: 18 }, desc: "Mars only: CO2 from the air + H2 -> methane + water." },
  co2_scrubber: { name: "CO2 scrubber", cat: "blss", kw: -1.5, prio: 0, cost: { parts: 6 }, layer: "any", desc: "Removes up to 1.2 kg of CO2 per hour from the cabin air and stores it for the plants." },
  biodome: { name: "Agricultural biodome", cat: "blss", kw: -10, vol: 300, prio: 0, cost: { parts: 34 }, layer: "any", desc: "Crops turn CO2 and grey water into food, O2 and clean water. Needs 8 kW more of heat at night." },
  bioremediation: { name: "Bioremediation plant", cat: "blss", kw: -3, prio: 1, cost: { parts: 14 }, layer: "any", desc: "5 kg regolith + water + nitrogen into 4 kg of fertile soil per hour." },
  cupola: { name: "Observation cupola", cat: "blss", kw: -0.3, vol: 8, prio: 2, cost: { parts: 10 }, desc: "Earth on the horizon: the Overview Effect lowers crew stress." },
  geodesic_biosphere: { name: "Geodesic biosphere", cat: "station", kw: -25, vol: 3000, prio: 0, zones: ["plains", "jezero"], cost: { parts: 120, iron: 150, tio2: 60 }, desc: "A huge dome. At 100% habitability the crew lives without suits." },
  lab: { name: "Laboratory", cat: "science", kw: -5, prio: 2, cost: { parts: 14 }, layer: "any", desc: "Produces science points for the tech trees." },
  rover_bay: { name: "Rover bay", cat: "logistics", kw: -2, prio: 1, cost: { parts: 18 }, desc: "Holds and charges 2 autonomous rovers." },
  seismic_radar: { name: "Seismic radar", cat: "science", kw: -3, prio: 2, zones: ["plains"], cost: { parts: 12 }, desc: "Scans the subsurface for lava tubes." },
  lava_seal: { name: "Lava-tube airlock", cat: "station", kw: -1, prio: 0, layer: "u", cost: { parts: 40, iron: 60 }, desc: "Two of these seal the tube (5000 m3). Also the passage between surface and underground." },
  telescope: { name: "Cryogenic telescope", cat: "science", kw: -4, prio: 2, zones: ["psr"], cost: { parts: 30, tio2: 20 }, desc: "Forecasts solar storms, tracks asteroids for funding, surveys exoplanets for science." },
  eds: { name: "Electrodynamic Dust Shield", cat: "dust", kw: -0.2, prio: 1, cost: { parts: 12 }, desc: "Pulse: cleans every machine within 3 cells. Draws a 60 kW peak for 5 s." },
  sinter_laser: { name: "Sintering laser", cat: "dust", kw: -1, prio: 1, cost: { parts: 16 }, desc: "Lets you pave cells: no dust, +25 ground stability. 12 kWh and 5 kg of regolith each." },
  heavy_pad: { name: "Sintered heavy launch pad", cat: "deep", cost: { parts: 40, iron: 200 }, zones: ["plains"], desc: "Stops the engine plume from sandblasting the base. Needed for the interplanetary ship." },
  ntr_assembly: { name: "NTR vehicle assembly", cat: "deep", kw: -12, prio: 2, zones: ["plains"], cost: { parts: 60, iron: 120, tio2: 40 }, desc: "Assembles the nuclear-thermal ship, subsystem by subsystem." },
};

/** The six disciplines NASA Goddard's Mission Design Lab reviews (kept from the original game). */
export const SUBSYSTEMS = [
  { id: "Propulsion", cost: { parts: 40, iron: 60 }, gain: 40, why: "No engine, no departure. The reactor heats liquid hydrogen and expels it." },
  { id: "Power", cost: { parts: 25, iron: 10 }, gain: 30, why: "Runs the computers and valves when the ship is far from the Sun." },
  { id: "Thermal", cost: { parts: 20, tio2: 25 }, gain: 25, why: "Liquid hydrogen boils if it warms up: insulation and radiators keep the propellant." },
  { id: "Communications", cost: { parts: 20 }, gain: 20, capWithoutTelescope: 50, why: "Deep-space link. Past 50% it needs the crater telescope as a tracking station." },
  { id: "Attitude control", cost: { parts: 25, iron: 15 }, gain: 30, why: "Keeps the ship pointed. Without it the trajectory drifts." },
  { id: "Structure", cost: { parts: 20, iron: 50 }, gain: 25, why: "The hull must take the launch loads." },
];

/** Departure windows. PROVISIONAL game values, not real trajectories (to be replaced with GMAT output). */
export const DESTINATIONS = {
  mars: { id: "mars", name: "Mars — Jezero Crater", everyH: 2 * C.LUNAR_CYCLE_H, openH: 72, lh2: 240, lox: 180, note: "38% gravity, CO2 air for Sabatier reactors, dust storms." },
  psyche: { id: "psyche", name: "Asteroid 16 Psyche", everyH: 3 * C.LUNAR_CYCLE_H, openH: 96, lh2: 300, lox: 120, note: "Metal world in microgravity: iron straight from the ground, no ice at all." },
};

// ───────────────────────────── helpers ─────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const idx = (x, y) => y * C.GRID_W + x;
const inGrid = (x, y) => x >= 0 && y >= 0 && x < C.GRID_W && y < C.GRID_H;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inTube = (x, y) => x >= C.TUBE.x0 && x <= C.TUBE.x1 && y >= C.TUBE.y0 && y <= C.TUBE.y1;

/** Deterministic random numbers kept in the state, so a save replays the same and tests are stable. */
export function rnd(state) {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function zoneOf(scenario, x, y) {
  if (scenario === "mars") return "jezero";
  if (scenario === "psyche") return "psyche";
  return y < C.RIM_ROWS ? "rim" : y < C.PSR_ROW ? "plains" : "psr";
}
export const ZONE_INFO = {
  rim: { name: "Peaks of Eternal Light", note: "Sunlit 88% of the cycle. Little room; excavating here risks landslides." },
  plains: { name: "Ilmenite Plains", note: "Flat and rich in FeTiO3. 14 days of night and strong electrostatic charge." },
  psr: { name: "Permanently Shadowed Crater", note: "−173 °C, never lit. Water ice. Drains batteries 4× without a power beam." },
  tube: { name: "Lava Tube (underground)", note: "Stable −20 °C, shielded from radiation and meteorites." },
  jezero: { name: "Jezero Crater", note: "Ancient river delta. Thin CO2 air, dust storms, 38% gravity." },
  psyche: { name: "Psyche metal plains", note: "Iron-nickel ground in microgravity. No ice, weak sunlight." },
};

export function cellAt(state, x, y, layer = "s") {
  if (!inGrid(x, y)) return null;
  return (layer === "u" ? state.sub : state.grid)[idx(x, y)] ?? null;
}
export const buildingById = (state, id) => state.buildings.find((b) => b.id === id) ?? null;
export const countOf = (state, type, onlyWorking = false) => state.buildings.filter((b) => b.type === type && (!onlyWorking || b.running)).length;
const has = (state, unlock) => (unlock === "sabatier" ? SCENARIOS[state.scenario].co2Air : unlockedSet(state.techs).has(unlock));

function log(state, text, level = "info") {
  state.log.unshift({ t: state.t, text, level });
  if (state.log.length > 120) state.log.pop();
}
const dayOf = (state) => Math.floor(state.t / 24) + 1;

function makeGrid(scenario, state) {
  const grid = [], sub = [];
  for (let y = 0; y < C.GRID_H; y++) for (let x = 0; x < C.GRID_W; x++) {
    const zone = zoneOf(scenario, x, y);
    const sc = SCENARIOS[scenario];
    grid.push({
      zone,
      stability: zone === "rim" ? 70 + rnd(state) * 15 : zone === "psr" ? 78 + rnd(state) * 15 : 85 + rnd(state) * 12,
      dust: zone === "psr" ? 0 : 0.05,
      paved: false, piled: false, pipe: false, b: null,
      ice: sc.hasIce && (zone === "psr" || zone === "jezero") ? Math.round((zone === "psr" ? 400 : 120) + rnd(state) * 600) : 0,
    });
    sub.push({ zone: "tube", open: scenario === "moon" && inTube(x, y), pipe: false, b: null });
  }
  return { grid, sub };
}

// ───────────────────────────── state ─────────────────────────────
export function createState(modeId = "realista", difficultyId = "normal", seed = 20260) {
  const rules = resolveRules(modeId, difficultyId);
  const state = {
    v: 1, modeId, difficultyId, rules, scenario: "moon", seed, t: 0,
    res: Object.fromEntries(RES_KEYS.map((k) => [k, 0])),
    grid: [], sub: [], tubeFound: false,
    buildings: [], nextId: 1, rovers: [], nextRoverId: 1,
    techs: [], builtTypes: [],
    crew: { count: 4, health: 100, stress: 10, sanity: 100, dose: 0, suitless: false, fed: true, hydrated: true },
    player: { x: 13, y: 8, layer: "s", inside: true, suitO2: C.SUIT_HOURS, evas: 0 },
    air: { o2: 0, n2: 0, co2: 0, dust: 0, temp: 21, auto: false, volume: 0, pO2: 0, pN2: 0, pCO2: 0, total: 0, habitability: 0 },
    power: { gen: 0, demand: 0, stored: 120, cap: 0, blackout: 0, peak: 0, shed: 0 },
    rfc: { h2: 0, o2: 0 },
    thermal: { load: 0, reject: 0 },
    berm: false, autoEvaT: 12,
    flows: {}, alerts: [], log: [],
    events: { nextCME: 180, cme: null, forecastUntil: 0, nextMeteor: 300, nextAnomaly: 30, nextCrystal: 50, storm: null, nextStorm: 60 },
    crystals: [], plasmaBoostUntil: 0,
    missions: { active: [], done: [] },
    obs: { task: null, nea: 0, exoplanets: 0, cmeScans: 0 },
    vehicle: { subsystems: Object.fromEntries(SUBSYSTEMS.map((s) => [s.id, 0])) },
    hudGlitches: [], loreLogs: [], milestones: [], netDirty: true,
    stats: { excavations: 0, subsidences: 0, edsPulses: 0, blackouts: 0, breaches: 0, cmes: 0, nightsSurvived: 0, waterMade: 0, loxMade: 0, foodGrown: 0 },
  };
  Object.assign(state, makeGrid("moon", state));
  // What the lander brought.
  Object.assign(state.res, { parts: rules.startParts, water: 110, o2: 120, n2: 320, food: 140, funds: 500, regolith: 0, science: 6 });
  // The landed base: one habitat with air, two panels, a battery, a radiator.
  place(state, "habitat", 13, 8, "s", true);
  place(state, "solar", 12, 8, "s", true); place(state, "solar", 14, 8, "s", true);
  place(state, "battery", 13, 9, "s", true); place(state, "radiator", 13, 7, "s", true); place(state, "kilopower", 14, 7, "s", true);
  state.builtTypes = [];
  recomputeNetworks(state);
  const V = state.air.volume;
  state.air.o2 = (C.TARGET_O2 * V) / C.KPA_O2; state.air.n2 = (C.TARGET_N2 * V) / C.KPA_N2;
  state.events.nextCME = 280 + rnd(state) * 160;
  refreshMissions(state);
  log(state, "Touchdown on the rim of Shackleton Crater. Habitat pressurized. Systems nominal.");
  updateDerived(state);
  return state;
}

/** JSON in, JSON out. Rules are recomputed so a balance patch reaches old saves. */
export const serialize = (state) => JSON.stringify(state);
export function deserialize(json) {
  const s = typeof json === "string" ? JSON.parse(json) : json;
  if (!s || s.v !== 1 || !Array.isArray(s.grid)) throw new Error("Not a colony save");
  s.rules = resolveRules(s.modeId, s.difficultyId);
  s.netDirty = true;
  return s;
}

// ───────────────────────────── light ─────────────────────────────
/** Fraction of full sunlight on a surface cell right now (0 underground and in the shadowed crater). */
export function illumination(state, x, y, layer = "s") {
  if (layer === "u") return 0;
  const sc = SCENARIOS[state.scenario];
  const c = cellAt(state, x, y);
  if (!c || c.zone === "psr") return 0;
  const phase = (state.t % sc.cycleH) / sc.cycleH;
  let lit;
  if (c.zone === "rim") lit = phase < 0.5 || phase >= 0.5 + (1 - C.RIM_LIGHT_FRACTION) ? 1 : 0; // dark only 12% of the cycle
  else lit = phase < sc.lightFraction ? 1 : 0;
  if (!lit) return 0;
  let f = sc.solar;
  if (state.events.storm) f *= 0.2; // Mars dust storm
  return f;
}
export const isNight = (state) => illumination(state, 13, 8) === 0;
/** Hours until the plains change between day and night. */
export function hoursToTerminator(state) {
  const sc = SCENARIOS[state.scenario], p = state.t % sc.cycleH, half = sc.cycleH * sc.lightFraction;
  return p < half ? half - p : sc.cycleH - p;
}
/** Earth above the horizon: it wobbles by libration (about ±6.5° over the month) around a low elevation. */
export function earthElevationDeg(state) {
  return 5 + 6.5 * Math.sin((2 * Math.PI * state.t) / (27.3 * 24));
}

// ───────────────────────────── building ─────────────────────────────
const canAfford = (state, cost) => Object.entries(cost ?? {}).every(([k, v]) => (state.res[k] ?? 0) >= v);
const pay = (state, cost) => { for (const [k, v] of Object.entries(cost ?? {})) state.res[k] -= v; };

/** Why you can't build `type` at (x, y), or null if you can. */
export function buildBlock(state, type, x, y, layer = "s") {
  const def = BUILDINGS[type];
  if (!def) return "Unknown building";
  if (!has(state, type)) return type === "sabatier" ? "Needs a CO2 atmosphere: only on Mars" : `Locked: research "${techFor(type)?.name ?? type}"`;
  const cell = cellAt(state, x, y, layer);
  if (!cell) return "Outside the map";
  if (layer === "u") {
    if (!state.tubeFound) return "No underground found yet: scan with the seismic radar";
    if (!cell.open) return "Solid rock: build inside the lava tube";
    if (def.layer !== "u" && def.layer !== "any") return "This can't be built underground";
  } else {
    if (def.layer === "u") return "Only underground, inside the lava tube";
    if (def.zones && !def.zones.includes(cell.zone)) return `Only in: ${def.zones.map((z) => ZONE_INFO[z]?.name ?? z).join(" / ")}`;
  }
  if (cell.b) return "Cell occupied";
  if (!canAfford(state, def.cost)) return `Missing materials: ${Object.entries(def.cost).map(([k, v]) => `${v} ${k}`).join(", ")}`;
  return null;
}
function place(state, type, x, y, layer, free = false) {
  const def = BUILDINGS[type];
  if (!free) pay(state, def.cost);
  const b = { id: state.nextId++, type, x, y, layer, on: true, hp: 100, dust: 0, wear: 0, breached: false, isolated: false, connected: false, powered: false, running: false, status: "ok", buf: {}, edsReadyAt: 0, auto: type === "eds", crop: type === "biodome" ? 100 : 0, soil: false };
  state.buildings.push(b);
  cellAt(state, x, y, layer).b = b.id;
  if (!state.builtTypes.includes(type)) state.builtTypes.push(type);
  state.netDirty = true;
  if (type === "rover_bay") for (let i = 0; i < 2; i++) state.rovers.push({ id: state.nextRoverId++, bay: b.id, x, y, cargo: 0, res: null, route: null, leg: "idle", battery: 20, stuck: false });
  return b;
}

export function build(state, type, x, y, layer = "s") {
  const why = buildBlock(state, type, x, y, layer);
  if (why) return { ok: false, msg: why };
  const b = place(state, type, x, y, layer);
  log(state, `Built: ${BUILDINGS[type].name}.`);
  return { ok: true, msg: `${BUILDINGS[type].name} built`, building: b };
}

export function demolish(state, id) {
  const b = buildingById(state, id);
  if (!b) return { ok: false, msg: "Nothing there" };
  if (b.type === "habitat" && countOf(state, "habitat") === 1) return { ok: false, msg: "The last habitat can't be removed" };
  cellAt(state, b.x, b.y, b.layer).b = null;
  state.buildings = state.buildings.filter((x) => x !== b);
  state.rovers = state.rovers.filter((r) => r.bay !== b.id);
  state.res.parts += Math.floor((BUILDINGS[b.type].cost.parts ?? 0) / 2); // half the parts come back
  state.netDirty = true;
  log(state, `Removed: ${BUILDINGS[b.type].name}.`);
  return { ok: true, msg: "Removed (half the parts recovered)" };
}

export function toggle(state, id) {
  const b = buildingById(state, id);
  if (!b) return false;
  b.on = !b.on;
  return true;
}

/** Lay a utility corridor (pipes + cable) on a cell. Costs 1 part. */
export function layPipe(state, x, y, layer = "s") {
  const cell = cellAt(state, x, y, layer);
  if (!cell || (layer === "u" && !cell.open)) return { ok: false, msg: "Can't lay pipe there" };
  if (cell.pipe || cell.b) return { ok: false, msg: "Already connected" };
  if (state.res.parts < 1) return { ok: false, msg: "Needs 1 part" };
  state.res.parts -= 1; cell.pipe = true; state.netDirty = true;
  return { ok: true, msg: "Pipe laid" };
}

export function repair(state, id) {
  const b = buildingById(state, id);
  if (!b) return { ok: false, msg: "Nothing there" };
  if (b.hp >= 100 && !b.breached && b.wear < 0.05) return { ok: false, msg: "Nothing to repair" };
  if (state.res.parts < 2) return { ok: false, msg: "Needs 2 parts" };
  state.res.parts -= 2; b.hp = 100; b.breached = false; b.isolated = false; b.wear = 0; state.netDirty = true;
  log(state, `Repaired: ${BUILDINGS[b.type].name}.`);
  return { ok: true, msg: "Repaired" };
}

// ───────────────────────────── networks ─────────────────────────────
/**
 * Pipes carry fluids and power. A building works only if it is connected to a habitat through
 * buildings and pipe cells (4-neighbours). A lava-tube airlock links the surface with the underground.
 * A network on the crater floor with a beam receiver gets power (not fluids) when a beam laser is in the main network.
 */
export function recomputeNetworks(state) {
  const key = (x, y, l) => `${l}${x},${y}`;
  const conducts = (x, y, l) => { const c = cellAt(state, x, y, l); return !!c && (c.pipe || c.b !== null) && (l === "s" || c.open); };
  const comp = new Map();
  let n = 0;
  const flood = (sx, sy, sl) => {
    const id = ++n, stack = [[sx, sy, sl]];
    comp.set(key(sx, sy, sl), id);
    while (stack.length) {
      const [x, y, l] = stack.pop();
      const push = (nx, ny, nl) => { const k = key(nx, ny, nl); if (!comp.has(k) && conducts(nx, ny, nl)) { comp.set(k, id); stack.push([nx, ny, nl]); } };
      for (const [dx, dy] of N4) push(x + dx, y + dy, l);
      const c = cellAt(state, x, y, l);
      const b = c && c.b !== null ? buildingById(state, c.b) : null;
      if (b && b.type === "lava_seal") push(x, y, "s"); // the airlock shaft reaches the surface cell above it
      if (l === "s") { const below = cellAt(state, x, y, "u"); const bb = below && below.b !== null ? buildingById(state, below.b) : null; if (bb && bb.type === "lava_seal") push(x, y, "u"); }
    }
    return id;
  };
  for (const b of state.buildings) if (!comp.has(key(b.x, b.y, b.layer))) flood(b.x, b.y, b.layer);
  const main = new Set(state.buildings.filter((b) => b.type === "habitat").map((b) => comp.get(key(b.x, b.y, b.layer))));
  const txOk = state.buildings.some((b) => b.type === "laser_tx" && main.has(comp.get(key(b.x, b.y, b.layer))) && b.on && b.hp > 0);
  const beamed = new Set(state.buildings.filter((b) => b.type === "laser_rx" && b.hp > 0).map((b) => comp.get(key(b.x, b.y, b.layer))));
  for (const b of state.buildings) {
    b.net = comp.get(key(b.x, b.y, b.layer));
    b.connected = main.has(b.net);
    b.beamed = txOk && beamed.has(b.net);
  }
  state.beamActive = txOk && beamed.size > 0;
  // A surface cell with an airlock below it conducts too (so a pipe can end on it).
  const seals = state.buildings.filter((b) => b.type === "lava_seal" && b.hp > 0);
  state.tubeSealed = state.tubeFound && seals.length >= 2;
  state.air.volume = pressurizedVolume(state);
  state.netDirty = false;
}

function pressurizedVolume(state) {
  let v = 0;
  for (const b of state.buildings) if (BUILDINGS[b.type].vol && b.connected && !b.isolated && b.hp > 0) v += BUILDINGS[b.type].vol;
  if (state.tubeSealed && state.buildings.some((b) => b.type === "lava_seal" && b.connected)) v += 5000;
  return v;
}

// ───────────────────────────── player and manual work ─────────────────────────────
const isInside = (state, x, y, layer) => {
  const c = cellAt(state, x, y, layer);
  const b = c && c.b !== null ? buildingById(state, c.b) : null;
  if (b && BUILDINGS[b.type].vol && b.connected && !b.breached) return true;
  return layer === "u" && state.tubeSealed && state.air.habitability >= 100;
};

function dustIngress(state) {
  const mit = countOf(state, "suitport", true) ? 1 : countOf(state, "airlock_n2", true) && state.res.n2 >= 0.05 ? 0.8 : 0;
  if (mit === 0.8) state.res.n2 -= 0.05;
  state.air.dust = clamp(state.air.dust + 0.02 * (1 - mit) * state.rules.dustMult, 0, 1);
}

/** Move the astronaut. Going out starts an EVA on suit oxygen; coming back in brings dust with it. */
export function movePlayer(state, x, y, layer = state.player.layer) {
  const c = cellAt(state, x, y, layer);
  if (!c || (layer === "u" && (!state.tubeFound || !c.open))) return false;
  const p = state.player, was = p.inside;
  p.x = x; p.y = y; p.layer = layer;
  p.inside = isInside(state, x, y, layer);
  if (!was && p.inside) { p.evas++; p.suitO2 = C.SUIT_HOURS; dustIngress(state); }
  return true;
}

/** Hand excavation (the first minutes of the game). Each dig weakens the cell and its neighbours. */
export function excavate(state, x, y) {
  const c = cellAt(state, x, y);
  if (!c) return { ok: false, msg: "Outside the map" };
  if (c.b !== null) return { ok: false, msg: "There is a structure here" };
  if (c.paved) return { ok: false, msg: "This cell is paved" };
  if (Math.abs(state.player.x - x) > 1 || Math.abs(state.player.y - y) > 1 || state.player.layer !== "s") return { ok: false, msg: "Walk next to the cell first" };
  const ice = Math.min(c.ice, C.EXCAVATE_ICE);
  c.ice -= ice; state.res.ice += ice; state.res.regolith += C.EXCAVATE_REGOLITH;
  weaken(state, x, y, 6, 2);
  c.dust = clamp(c.dust + 0.08, 0, 1);
  for (const [dx, dy] of N4) { const n = cellAt(state, x + dx, y + dy); if (n) n.dust = clamp(n.dust + 0.03, 0, 1); }
  state.stats.excavations++;
  const warn = c.stability < C.SUBSIDENCE_AT ? " ⚠ Ground here is now unstable." : "";
  return { ok: true, msg: `+${C.EXCAVATE_REGOLITH} kg regolith${ice ? `, +${ice} kg ice` : ""}.${warn}` };
}
function weaken(state, x, y, own, around) {
  const c = cellAt(state, x, y);
  if (c && !c.paved) c.stability = clamp(c.stability - own * state.rules.subsidenceMult, 0, 100);
  for (const [dx, dy] of N4) { const n = cellAt(state, x + dx, y + dy); if (n && !n.paved) n.stability = clamp(n.stability - around * state.rules.subsidenceMult, 0, 100); }
}

/** Melt carried ice in the habitat (manual, early game). */
export function meltIce(state) {
  if (!state.player.inside) return { ok: false, msg: "Go inside the habitat" };
  const k = state.res.ice;
  if (k <= 0) return { ok: false, msg: "No ice to melt" };
  state.res.ice = 0; state.res.water += k * 0.9; state.stats.waterMade += k * 0.9;
  return { ok: true, msg: `+${(k * 0.9).toFixed(1)} kg water` };
}

export function pave(state, x, y) {
  if (!has(state, "action:pave") || !countOf(state, "sinter_laser", true)) return { ok: false, msg: "Needs a working sintering laser" };
  const c = cellAt(state, x, y);
  if (!c) return { ok: false, msg: "Outside the map" };
  if (c.paved) return { ok: false, msg: "Already paved" };
  if (c.b !== null) return { ok: false, msg: "There is a structure here: pave before you build (or drive piles)" };
  if (state.res.regolith < C.PAVE_REGOLITH) return { ok: false, msg: `Needs ${C.PAVE_REGOLITH} kg of regolith` };
  if (state.power.stored < C.PAVE_KWH) return { ok: false, msg: `Needs ${C.PAVE_KWH} kWh stored` };
  state.res.regolith -= C.PAVE_REGOLITH; state.power.stored -= C.PAVE_KWH;
  c.paved = true; c.dust = 0; c.stability = clamp(c.stability + C.PAVE_STABILITY, 0, 100);
  return { ok: true, msg: "Cell sintered: no dust, firmer ground" };
}

export function pile(state, x, y) {
  if (!has(state, "action:pile")) return { ok: false, msg: 'Locked: research "Deep pile foundations"' };
  const c = cellAt(state, x, y);
  if (!c) return { ok: false, msg: "Outside the map" };
  if (c.piled) return { ok: false, msg: "Already has piles" };
  if (state.res.parts < 4) return { ok: false, msg: "Needs 4 parts" };
  state.res.parts -= 4; c.piled = true;
  return { ok: true, msg: "Piles driven: this cell survives ground down to 25% stability" };
}

/** Pile a regolith berm over the habitat: shields the crew from solar storms. */
export function buildBerm(state) {
  if (state.berm) return { ok: false, msg: "The habitat already has a berm" };
  if (state.res.regolith < 300) return { ok: false, msg: "Needs 300 kg of regolith" };
  state.res.regolith -= 300; state.berm = true;
  log(state, "Regolith berm piled over the habitat: the crew is shielded from solar storms.");
  return { ok: true, msg: "Radiation berm built" };
}

/** Order supplies from Earth: expensive on purpose (stop depending on it). */
export function resupply(state, what) {
  const offers = { parts: { funds: 120, give: { parts: 20 } }, n2: { funds: 90, give: { n2: 150 } }, food: { funds: 80, give: { food: 60 } } };
  const o = offers[what];
  if (!o) return { ok: false, msg: "Unknown order" };
  const cost = Math.round(o.funds * state.rules.resupplyCostMult);
  if (state.res.funds < cost) return { ok: false, msg: `Needs ${cost} funds` };
  state.res.funds -= cost;
  for (const [k, v] of Object.entries(o.give)) state.res[k] += v;
  log(state, `Resupply from Earth: ${Object.entries(o.give).map(([k, v]) => `+${v} ${k}`).join(", ")} for ${cost} funds.`);
  return { ok: true, msg: `Delivered for ${cost} funds` };
}

export function research(state, id) {
  const why = researchBlock(state, id);
  if (why) return { ok: false, msg: why };
  const t = getTech(id);
  state.res.science -= t.cost.science; state.res.funds -= t.cost.funds ?? 0;
  state.techs.push(id);
  if (id === "atmosphere_control") state.air.auto = true;
  log(state, `Research complete: ${t.name}.`, "good");
  return { ok: true, msg: `Researched: ${t.name}`, tech: t };
}

/** Manually add gas to the cabin air from storage (before the automatic regulator is researched). */
export function addGas(state, gas, kg) {
  if (gas !== "o2" && gas !== "n2") return { ok: false, msg: "Unknown gas" };
  const k = Math.min(kg, state.res[gas]);
  if (k <= 0) return { ok: false, msg: `No ${gas.toUpperCase()} in storage` };
  state.res[gas] -= k; state.air[gas] += k;
  return { ok: true, msg: `+${k.toFixed(1)} kg ${gas.toUpperCase()} into the cabin air` };
}

// ───────────────────────────── dust shield ─────────────────────────────
/** Peak power the base can deliver right now: generation plus what batteries and fuel cells can discharge. */
export function peakCapacityKW(state) {
  const batt = countOf(state, "battery") * C.BATTERY_PEAK_KW * (state.power.stored > 1 ? 1 : 0);
  const rfc = countOf(state, "rfc") * C.RFC_DISCHARGE_KW * (state.rfc.h2 > 0.05 ? 1 : 0);
  return state.power.gen + batt + rfc;
}

/** Fire an EDS: cleans every machine and cell within 3 cells. A 60 kW peak the grid must be able to deliver. */
export function edsPulse(state, id) {
  const b = buildingById(state, id);
  if (!b || b.type !== "eds") return { ok: false, msg: "Not a dust shield" };
  if (!b.connected || b.hp <= 0) return { ok: false, msg: "The shield is not connected" };
  if (state.t < b.edsReadyAt) return { ok: false, msg: `Recharging: ${(b.edsReadyAt - state.t).toFixed(1)} h` };
  if (state.power.blackout > 0) return { ok: false, msg: "Base is in blackout" };
  b.edsReadyAt = state.t + C.EDS_COOLDOWN_H;
  state.stats.edsPulses++;
  if (peakCapacityKW(state) < state.power.demand + C.EDS_PEAK_KW) {
    state.power.blackout = 1; state.stats.blackouts++;
    log(state, "EDS pulse tripped the grid: the 60 kW peak was more than the base can deliver. Blackout for 1 hour.", "bad");
    return { ok: false, msg: "BLACKOUT: not enough peak power for the pulse. Add batteries or fire it in daylight." };
  }
  state.power.stored = Math.max(0, state.power.stored - (C.EDS_PEAK_KW * 5) / 3600);
  let cleaned = 0;
  for (const o of state.buildings) if (o.layer === "s" && Math.abs(o.x - b.x) <= C.EDS_RADIUS && Math.abs(o.y - b.y) <= C.EDS_RADIUS && o.dust > 0) { o.dust = 0; cleaned++; }
  for (let dy = -C.EDS_RADIUS; dy <= C.EDS_RADIUS; dy++) for (let dx = -C.EDS_RADIUS; dx <= C.EDS_RADIUS; dx++) { const c = cellAt(state, b.x + dx, b.y + dy); if (c) c.dust = 0; }
  return { ok: true, msg: `Pulse fired: ${cleaned} machine${cleaned === 1 ? "" : "s"} cleaned` };
}

// ───────────────────────────── rovers ─────────────────────────────
/** Program a rover: carry `res` from building `fromId` (its local buffer) to building `toId`, forever. */
export function setRoverRoute(state, roverId, fromId, toId, res) {
  const r = state.rovers.find((x) => x.id === roverId);
  if (!r) return { ok: false, msg: "No such rover" };
  if (!has(state, "action:rover_route")) return { ok: false, msg: 'Locked: research "Autonomous rovers"' };
  const a = buildingById(state, fromId), b = buildingById(state, toId);
  if (!a || !b || a === b) return { ok: false, msg: "Pick two different buildings" };
  if (a.layer !== "s" || b.layer !== "s") return { ok: false, msg: "Rovers drive on the surface" };
  r.route = { from: fromId, to: toId, res }; r.leg = "toSource"; r.res = res;
  return { ok: true, msg: `Rover ${r.id}: hauling ${res}` };
}
export function clearRoverRoute(state, roverId) {
  const r = state.rovers.find((x) => x.id === roverId);
  if (!r) return false;
  r.route = null; r.leg = "idle";
  return true;
}
export function rescueRover(state, roverId) {
  const r = state.rovers.find((x) => x.id === roverId);
  if (!r || !r.stuck) return { ok: false, msg: "That rover is not trapped" };
  if (state.res.parts < 3) return { ok: false, msg: "Needs 3 parts for the recovery" };
  state.res.parts -= 3; r.stuck = false; r.battery = 20;
  return { ok: true, msg: "Rover recovered" };
}

function stepRovers(state, h) {
  for (const r of state.rovers) {
    if (r.stuck || !r.route) continue;
    const src = buildingById(state, r.route.from), dst = buildingById(state, r.route.to);
    if (!src || !dst) { r.route = null; r.leg = "idle"; continue; }
    const target = r.leg === "toSource" ? src : dst;
    if (r.battery <= 0.5) { // crawl home on reserve: wait for a charge at a connected building
      const here = cellAt(state, Math.round(r.x), Math.round(r.y));
      const hb = here && here.b !== null ? buildingById(state, here.b) : null;
      if (hb && hb.connected && state.power.stored > 2) { const e = Math.min(20 - r.battery, 5 * h, state.power.stored); r.battery += e; state.power.stored -= e; }
      else r.battery = Math.min(r.battery + 0.1 * h * (illumination(state, Math.round(r.x), Math.round(r.y)) > 0 ? 1 : 0), 20); // small body-mounted panel
      continue;
    }
    let move = 2 * h; // cells per hour
    while (move > 0) {
      const dx = target.x - r.x, dy = target.y - r.y, d = Math.hypot(dx, dy);
      if (d < 0.05) break;
      const s = Math.min(move, d);
      const ox = Math.round(r.x), oy = Math.round(r.y);
      r.x += (dx / d) * s; r.y += (dy / d) * s; move -= s;
      const nx = Math.round(r.x), ny = Math.round(r.y);
      if (nx !== ox || ny !== oy) {
        r.battery = Math.max(0, r.battery - 0.5);
        const c = cellAt(state, nx, ny);
        if (c && !c.paved && c.b === null) {
          c.stability = clamp(c.stability - 0.3 * state.rules.subsidenceMult, 0, 100); // traffic erodes the crust
          c.dust = clamp(c.dust + 0.02 * state.rules.dustMult, 0, 1);                   // and charges dust by friction
          if (c.zone === "rim" && c.stability < C.SUBSIDENCE_AT && rnd(state) < 0.25) {
            r.stuck = true;
            log(state, `Slope collapse on the rim: rover ${r.id} is trapped. Pave the route or send a recovery.`, "bad");
            break;
          }
        }
      }
    }
    if (r.stuck) continue;
    if (Math.hypot(target.x - r.x, target.y - r.y) < 0.05) {
      if (r.leg === "toSource") {
        const take = Math.min(120, src.buf[r.route.res] ?? 0);
        if (take > 0) { src.buf[r.route.res] -= take; r.cargo = take; r.leg = "toDest"; }
      } else {
        if (dst.connected) state.res[r.route.res] += r.cargo; else dst.buf[r.route.res] = (dst.buf[r.route.res] ?? 0) + r.cargo;
        r.cargo = 0; r.leg = "toSource";
        if (dst.connected && state.power.stored > 2) { const e = Math.min(20 - r.battery, state.power.stored); r.battery += e; state.power.stored -= e; }
      }
    }
  }
}

// ───────────────────────────── power ─────────────────────────────
function demandOf(state, b) {
  const def = BUILDINGS[b.type];
  let kw = -(def.kw ?? 0);
  if (kw <= 0) return 0;
  const lit = illumination(state, b.x, b.y, b.layer) > 0;
  if (b.type === "biodome" && !lit) kw += 8;                        // heaters through the night
  if (b.type === "ilmenite_reactor" && !lit) kw = 20;               // no sunlight to concentrate
  if (b.layer === "s" && cellAt(state, b.x, b.y).zone === "psr") kw *= b.beamed ? 1 / C.BEAM_EFFICIENCY : C.PSR_DRAIN_MULT;
  return kw;
}

function stepPower(state, h) {
  const P = state.power;
  P.cap = 20 + countOf(state, "battery") * C.BATTERY_KWH;
  let gen = 0;
  const boost = state.t < state.plasmaBoostUntil ? 1.5 : 1;
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.gen || !b.on || !b.connected || b.hp <= 0) continue;
    gen += def.always ? def.gen * (b.hp / 100) : def.gen * illumination(state, b.x, b.y) * (1 - 0.8 * b.dust) * (b.hp / 100) * boost;
  }
  P.gen = gen;
  if (P.blackout > 0) {
    P.blackout = Math.max(0, P.blackout - h);
    for (const b of state.buildings) { b.powered = false; }
    P.stored = Math.min(P.cap, P.stored + gen * h);
    P.demand = 0; P.shed = 0;
    return;
  }
  const wants = state.buildings.filter((b) => b.on && b.hp > 0 && !b.breached && (b.connected || b.beamed) && demandOf(state, b) > 0)
    .sort((a, b) => (BUILDINGS[a.type].prio ?? 1) - (BUILDINGS[b.type].prio ?? 1));
  for (const b of state.buildings) b.powered = BUILDINGS[b.type].kw === undefined || (BUILDINGS[b.type].kw ?? 0) >= 0 ? b.connected || b.beamed : false;
  const rfcUnits = countOf(state, "rfc");
  const rfcOutMax = Math.min(rfcUnits * C.RFC_DISCHARGE_KW * h, state.rfc.h2 * 9 * C.ELECTROLYSIS_KWH_PER_KG * C.RFC_ROUND_TRIP);
  const battOutMax = Math.min(P.stored, Math.max(1, countOf(state, "battery")) * C.BATTERY_PEAK_KW * h);
  let avail = gen * h + battOutMax + rfcOutMax, used = 0, demand = 0, shed = 0;
  for (const b of wants) {
    const e = demandOf(state, b) * h;
    demand += e;
    if (avail - used >= e) { used += e; b.powered = true; } else { b.powered = false; shed++; }
  }
  P.demand = demand / h; P.shed = shed;
  let net = gen * h - used;
  if (net >= 0) {
    const toBatt = Math.min(net, P.cap - P.stored); P.stored += toBatt; net -= toBatt;
    if (net > 0 && rfcUnits) { // surplus becomes hydrogen and oxygen
      const room = rfcUnits * C.RFC_WATER_CAP - state.rfc.h2 * 9;
      const w = Math.max(0, Math.min(net / C.ELECTROLYSIS_KWH_PER_KG, (rfcUnits * C.RFC_CHARGE_KW * h) / C.ELECTROLYSIS_KWH_PER_KG, room, state.res.water));
      state.res.water -= w; state.rfc.h2 += w * C.H2_PER_WATER; state.rfc.o2 += w * C.O2_PER_WATER;
    }
  } else {
    let need = -net;
    const fromBatt = Math.min(need, battOutMax); P.stored -= fromBatt; need -= fromBatt;
    if (need > 0 && rfcOutMax > 0) { // recombine: electricity out, the same water back
      const e = Math.min(need, rfcOutMax), w = e / (C.ELECTROLYSIS_KWH_PER_KG * C.RFC_ROUND_TRIP);
      state.rfc.h2 = Math.max(0, state.rfc.h2 - w * C.H2_PER_WATER); state.rfc.o2 = Math.max(0, state.rfc.o2 - w * C.O2_PER_WATER);
      state.res.water += w;
    }
  }
}

// ───────────────────────────── production ─────────────────────────────
const tankCaps = (state) => { const n = countOf(state, "cryo_tank"); return { lh2: n * C.LH2_TANK_KG, lox: n * C.LOX_TANK_KG }; };
const flow = (state, k, v) => { state.flows[k] = (state.flows[k] ?? 0) + v; };

/** Output goes to the colony stores if the machine is piped in, otherwise to its own buffer for a rover. */
function output(state, b, res, kg) {
  if (kg <= 0) return;
  if (b.connected) { state.res[res] += kg; flow(state, res, kg); } else b.buf[res] = Math.min(400, (b.buf[res] ?? 0) + kg);
}

function stepProduction(state, h) {
  const sc = SCENARIOS[state.scenario];
  for (const b of state.buildings) {
    b.running = false;
    const def = BUILDINGS[b.type];
    if (!b.on) { b.status = "off"; continue; }
    if (b.hp <= 0) { b.status = "broken"; continue; }
    if (b.breached) { b.status = "breached"; continue; }
    if (!b.connected && !b.beamed) { b.status = "unconnected"; continue; }
    if ((def.kw ?? 0) < 0 && !b.powered) { b.status = "nopower"; continue; }
    const eff = b.hp / 100;
    b.status = "ok"; b.running = true;
    switch (b.type) {
      case "ice_extractor": {
        let want = 6 * h * eff, got = 0;
        for (const [dx, dy] of [[0, 0], ...N4]) {
          const c = cellAt(state, b.x + dx, b.y + dy);
          if (!c || c.ice <= 0 || want <= 0) continue;
          const k = Math.min(c.ice, want); c.ice -= k; want -= k; got += k;
          if (!c.paved) c.stability = clamp(c.stability - k * 0.02 * state.rules.subsidenceMult, 0, 100);
        }
        if (got <= 0) { b.status = "idle"; b.running = false; break; }
        weaken(state, b.x, b.y, 0, got * 0.006);
        output(state, b, "water", got * 0.9); output(state, b, "n2", got * 0.008); // a little nitrogen comes out with the volatiles
        state.stats.waterMade += got * 0.9;
        break;
      }
      case "regolith_mine": {
        const k = 15 * h * eff;
        weaken(state, b.x, b.y, 0, k * 0.01);
        output(state, b, "regolith", k);
        if (sc.metalRich) output(state, b, "iron", k * 0.4); // Psyche: metal straight from the ground
        break;
      }
      case "electrolyzer": {
        if (!b.connected) { b.status = "unconnected"; b.running = false; break; }
        const w = Math.min(state.res.water, 2 * h * eff);
        if (w <= 0) { b.status = "idle"; b.running = false; break; }
        state.res.water -= w; flow(state, "water", -w);
        state.res.h2 += w * C.H2_PER_WATER; state.res.o2 += w * C.O2_PER_WATER;
        flow(state, "h2", w * C.H2_PER_WATER); flow(state, "o2", w * C.O2_PER_WATER);
        break;
      }
      case "ilmenite_reactor": {
        if (!b.connected) { b.status = "unconnected"; b.running = false; break; }
        const reg = Math.min(state.res.regolith, 10 * h * eff), ilm = reg * C.ILMENITE_FRACTION;
        const h2 = ilm * C.ILM_H2;
        if (reg <= 0 || state.res.h2 < h2) { b.status = "idle"; b.running = false; break; }
        state.res.regolith -= reg; state.res.h2 -= h2;
        state.res.iron += ilm * C.ILM_FE; state.res.tio2 += ilm * C.ILM_TIO2; state.res.water += ilm * C.ILM_H2O;
        flow(state, "iron", ilm * C.ILM_FE); flow(state, "water", ilm * C.ILM_H2O); flow(state, "h2", -h2);
        break;
      }
      case "cryo_plant": {
        if (!b.connected) { b.status = "unconnected"; b.running = false; break; }
        const cap = tankCaps(state);
        const dh = Math.max(0, Math.min(state.res.h2, 0.25 * h * eff, cap.lh2 - state.res.lh2));
        state.res.h2 -= dh; state.res.lh2 += dh;
        const want = Math.max(0, C.MIX_RATIO * state.res.lh2 - state.res.lox); // keep the tanks near 6:1; spare O2 stays breathable
        const dox = Math.max(0, Math.min(state.res.o2 - 20, 1.5 * h * eff, want, cap.lox - state.res.lox));
        state.res.o2 -= dox; state.res.lox += dox; state.stats.loxMade += dox;
        flow(state, "lh2", dh); flow(state, "lox", dox);
        if (dh <= 0 && dox <= 0) b.status = "idle";
        break;
      }
      case "fabricator": {
        if (!b.connected) { b.status = "unconnected"; b.running = false; break; }
        const k = Math.min(1 * h * eff, state.res.iron, state.res.tio2 / 0.5);
        if (k <= 0) { b.status = "idle"; b.running = false; break; }
        state.res.iron -= k; state.res.tio2 -= k * 0.5; state.res.parts += k * 1.2; flow(state, "parts", k * 1.2);
        break;
      }
      case "sabatier": {
        if (!b.connected || !sc.co2Air) { b.status = "idle"; b.running = false; break; }
        const k = Math.min(state.res.h2, 0.2 * h * eff);
        if (k <= 0) { b.status = "idle"; b.running = false; break; }
        state.res.h2 -= k; state.res.ch4 += k * C.SABATIER_CH4; state.res.water += k * C.SABATIER_H2O;
        flow(state, "ch4", k * C.SABATIER_CH4); flow(state, "water", k * C.SABATIER_H2O);
        break;
      }
      case "co2_scrubber": {
        const k = Math.min(state.air.co2, 1.2 * h * eff);
        state.air.co2 -= k; state.res.co2 += k;
        break;
      }
      case "bioremediation": {
        if (!b.connected) { b.status = "unconnected"; b.running = false; break; }
        const k = Math.min(1, state.res.regolith / (5 * h), state.res.water / (0.2 * h), state.res.n2 / (0.02 * h)) * h * eff;
        if (k <= 0) { b.status = "idle"; b.running = false; break; }
        state.res.regolith -= 5 * k; state.res.water -= 0.2 * k; state.res.n2 -= 0.02 * k; state.res.soil += 4 * k;
        break;
      }
      case "biodome": stepBiodome(state, b, h, eff); break;
      case "lab": {
        const k = 0.4 * h * eff * state.rules.scienceMult * (state.crew.health > 30 ? 1 : 0.3);
        state.res.science += k; flow(state, "science", k);
        break;
      }
      default: break;
    }
  }
  // a biodome that is switched off, unpowered, cut off or breached is a cold dome: its crops die back
  for (const b of state.buildings) if (b.type === "biodome" && ["off", "broken", "breached", "unconnected", "nopower"].includes(b.status)) b.crop = clamp(b.crop - 4 * h, 0, 100);
  // boil-off: hydrogen warms up and leaves unless a powered liquefier keeps the tanks cold
  const cooled = countOf(state, "cryo_plant", true) > 0;
  const lit = !isNight(state);
  const rate = C.BOILOFF_PER_H * (lit ? C.BOILOFF_SUN_MULT : 1) * (cooled ? C.BOILOFF_COOLED : 1);
  const lost = state.res.lh2 * rate * h;
  state.res.lh2 -= lost; flow(state, "lh2", -lost);
  const cap = tankCaps(state);
  state.res.lh2 = Math.min(state.res.lh2, Math.max(cap.lh2, 0)); state.res.lox = Math.min(state.res.lox, Math.max(cap.lox, 0));
}

function stepBiodome(state, b, h, eff) {
  // Soil (from bioremediation) is loaded once; with it the dome needs far less water than hydroponics.
  if (!b.soil && state.res.soil >= 200) { state.res.soil -= 200; b.soil = true; log(state, "A biodome switched from hydroponics to remediated lunar soil: it now uses 60% less water."); }
  const waterNeed = 0.4 * (b.soil ? 0.4 : 1) * h;
  const co2Need = 0.22 * h;
  const co2Have = state.air.co2 + state.res.co2;
  const warm = b.powered; // powered includes the night heaters
  const ok = warm && state.res.water >= waterNeed && co2Have >= co2Need * 0.25;
  b.crop = clamp(b.crop + (ok ? 1.2 : -4) * h, 0, 100);
  if (!ok) b.status = !warm ? "cold" : state.res.water < waterNeed ? "dry" : "noCO2";
  if (b.crop <= 0) { if (b.status !== "dead") log(state, "A biodome's crops died. Fix the cause: they will regrow slowly.", "bad"); b.status = "dead"; b.running = false; b.crop = 0; }
  if (b.crop < 5) return;
  const g = (b.crop / 100) * eff * (co2Have >= co2Need ? 1 : 0.4);
  const co2 = Math.min(co2Have, co2Need * g);
  const fromAir = Math.min(state.air.co2, co2); state.air.co2 -= fromAir; state.res.co2 -= co2 - fromAir;
  state.res.water -= waterNeed * 0.1 * g;                 // transpired water is condensed and comes back: only 10% is really lost
  const o2 = 0.16 * h * g * (state.rules.xenoflora ? 2 : 1);
  state.air.o2 += o2; flow(state, "o2", o2);
  const food = 0.12 * h * g;
  state.res.food += food; state.stats.foodGrown += food; flow(state, "food", food);
}

// ───────────────────────────── atmosphere, thermal, crew ─────────────────────────────
function stepAtmosphere(state, h) {
  const A = state.air, V = Math.max(1, A.volume);
  const n = state.crew.count * state.rules.consumptionMult;
  // crew metabolism
  const o2 = Math.min(A.o2, C.CREW_O2 * n * h);
  A.o2 -= o2; A.co2 += C.CREW_CO2 * n * h; flow(state, "o2", -o2);
  const habOk = state.buildings.some((b) => b.type === "habitat" && b.powered && !b.breached);
  const water = C.CREW_WATER * n * h * (habOk ? 1 - C.WATER_RECYCLE : 1);
  state.crew.hydrated = state.res.water >= water; state.res.water = Math.max(0, state.res.water - water); flow(state, "water", -water);
  const food = C.CREW_FOOD * n * h;
  state.crew.fed = state.res.food >= food; state.res.food = Math.max(0, state.res.food - food); flow(state, "food", -food);
  // leaks: worn seals bleed slowly; an unisolated breach empties everything
  let leak = 0;
  for (const b of state.buildings) {
    if (!BUILDINGS[b.type].vol || !b.connected) continue;
    leak += 0.0006 * b.wear * (BUILDINGS[b.type].vol / V);
    if (b.breached && !b.isolated) leak += 0.03;
  }
  const f = Math.min(1, leak * h);
  A.o2 -= A.o2 * f; A.n2 -= A.n2 * f; A.co2 -= A.co2 * f;
  // the habitat always meters oxygen in from storage; balancing nitrogen automatically needs "Atmosphere pressure control"
  if (habOk) {
    const needO2 = Math.max(0, (C.TARGET_O2 * V) / C.KPA_O2 - A.o2), giveO2 = Math.min(needO2, state.res.o2, 6 * h);
    A.o2 += giveO2; state.res.o2 -= giveO2;
  }
  if (A.auto && habOk) {
    const needN2 = Math.max(0, (C.TARGET_N2 * V) / C.KPA_N2 - A.n2), giveN2 = Math.min(needN2, state.res.n2, 20 * h);
    A.n2 += giveN2; state.res.n2 -= giveN2;
  }
  // each habitat has a small emergency scrubber that vents CO2 to space (lost); CO2 scrubbers capture it for the crops
  // (it only switches on above 0.4 kPa, so plants get the CO2 first)
  if (habOk) A.co2 -= Math.min(Math.max(0, A.co2 - (0.4 * V) / C.KPA_CO2), 0.2 * h * state.buildings.filter((b) => b.type === "habitat" && b.powered && !b.breached).length);
  // cabin filters slowly clear dust
  if (habOk) A.dust = Math.max(0, A.dust - 0.01 * h);
  // thermal: electronics and people make heat; radiators (minus dust) reject it
  const T = state.thermal;
  T.load = 0.5 * state.buildings.reduce((a, b) => a + (b.powered && BUILDINGS[b.type].vol ? -(BUILDINGS[b.type].kw ?? 0) : 0), 0) + 0.1 * state.crew.count + 0.3 * state.buildings.reduce((a, b) => a + (b.running && ["electrolyzer", "fabricator", "cryo_plant", "ilmenite_reactor"].includes(b.type) ? -(BUILDINGS[b.type].kw ?? 0) : 0), 0);
  T.reject = state.buildings.reduce((a, b) => a + (b.type === "radiator" && b.connected && b.hp > 0 ? 25 * (1 - 0.9 * b.dust) * (b.hp / 100) : 0), 0);
  let target = 21;
  if (!habOk) target = state.tubeSealed && state.player.layer === "u" ? C.TUBE_TEMP_C : isNight(state) ? -40 : 35;
  else if (T.reject < T.load) target = 21 + Math.min(25, ((T.load - T.reject) / Math.max(1, T.load)) * 40);
  A.temp += (target - A.temp) * Math.min(1, 0.15 * h);
  refreshAir(state);
}

/** Partial pressures (kPa) from the gas masses and the pressurized volume, then the habitability score. */
function refreshAir(state) {
  const A = state.air, V = Math.max(1, A.volume);
  A.pO2 = (C.KPA_O2 * A.o2) / V; A.pN2 = (C.KPA_N2 * A.n2) / V; A.pCO2 = (C.KPA_CO2 * A.co2) / V; A.total = A.pO2 + A.pN2 + A.pCO2;
  A.habitability = habitability(state);
}

/** 0..100. The lowest of the individual scores decides: one bad factor is enough to make a place unlivable. */
export function habitabilityScores(state) {
  const A = state.air;
  const band = (v, lo0, lo1, hi1, hi0) => clamp(v <= lo1 ? (v - lo0) / (lo1 - lo0) : v >= hi1 ? (hi0 - v) / (hi0 - hi1) : 1, 0, 1) * 100;
  const shielded = state.berm || state.tubeSealed || countOf(state, "geodesic_biosphere", true) > 0;
  return {
    oxygen: band(A.pO2, 12, 19.5, 23.5, 30),
    pressure: band(A.total, 30, 95, 106, 130),
    co2: clamp((2 - A.pCO2) / 1.5, 0, 1) * 100,
    temperature: band(A.temp, 5, 18, 26, 38),
    cleanAir: clamp(1 - A.dust / 0.3, 0, 1) * 100,
    shielding: shielded ? 100 : 60,
    supplies: state.crew.fed && state.crew.hydrated ? 100 : 30,
  };
}
function habitability(state) {
  return Math.round(Math.min(...Object.values(habitabilityScores(state))));
}

function stepCrew(state, h) {
  const K = state.crew, A = state.air, R = state.rules, P = state.player;
  // the astronaut outside
  if (!P.inside) {
    const suitless = K.suitless && isInside(state, P.x, P.y, P.layer);
    if (!suitless) {
      P.suitO2 = Math.max(0, P.suitO2 - h);
      if (P.suitO2 <= 0) K.health = Math.max(0, K.health - 25 * h);
    }
  }
  // automatic maintenance EVAs bring dust in too
  state.autoEvaT -= h;
  if (state.autoEvaT <= 0) { state.autoEvaT = 12; dustIngress(state); }
  // health
  let dh = 0;
  if (A.habitability < 40) dh -= (40 - A.habitability) * 0.025;
  if (!K.fed) dh -= 0.4;
  if (!K.hydrated) dh -= 1.2;
  if (A.dust > 0.15) dh -= (A.dust - 0.15) * 4;
  if (K.dose >= 100) dh -= 1;
  if (dh === 0 && A.habitability >= 55) dh = 0.25;
  K.health = clamp(K.health + dh * h, 0, 100);
  K.dose = Math.max(0, K.dose - 0.05 * h);
  // stress
  let ds = 0;
  if (A.habitability < 70) ds += 0.3;
  if (state.alerts.some((a) => a.level === "bad" && !a.fake)) ds += 0.4;
  if (isNight(state)) ds += 0.05;
  if (state.buildings.some((b) => b.type === "cupola" && b.running) && earthElevationDeg(state) > 0) ds -= 0.5; // the Overview Effect
  if (R.xenoflora && state.buildings.some((b) => b.type === "biodome" && b.running)) ds -= 0.3;
  if (state.buildings.some((b) => b.type === "biodome" && b.running)) ds -= 0.15;
  if (K.suitless) ds -= 0.4;
  if (ds === 0) ds = -0.05;
  K.stress = clamp(K.stress + ds * h * R.stressMult, 0, 100);
  if (K.stress > 85) K.health = clamp(K.health - 0.2 * h, 0, 100);
  // sanity (horror): darkness, leaks and anomalies wear it down; light, company and a calm base restore it
  if (R.sanity) {
    let d = 0;
    const dark = !P.inside && illumination(state, P.x, P.y, P.layer) === 0;
    if (dark) d -= 1.5;
    if (state.buildings.some((b) => b.breached)) d -= 0.8;
    if (state.power.blackout > 0) d -= 2;
    if (K.stress > 60) d -= 0.3;
    if (d === 0) d = P.inside ? 0.4 : 0.1;
    K.sanity = clamp(K.sanity + d * h, 0, 100);
  } else K.sanity = 100;
  // living without a suit: the big milestone
  if (!K.suitless && A.habitability >= 100 && (state.tubeSealed || countOf(state, "geodesic_biosphere", true) > 0)) {
    K.suitless = true;
    milestone(state, "suitless", "Shirt-sleeve colony: habitability reached 100%. The crew lives without space suits.");
  }
}

// ───────────────────────────── dust and soil ─────────────────────────────
function stepDustAndSoil(state, h) {
  const R = state.rules, storm = state.events.storm ? 5 : 1;
  for (let y = 0; y < C.GRID_H; y++) for (let x = 0; x < C.GRID_W; x++) {
    const c = state.grid[idx(x, y)];
    if (c.paved) { c.dust = 0; continue; }
    const lit = illumination(state, x, y);
    // UV knocks electrons off the grains (photoelectric charging): sunlit dust levitates and spreads
    c.dust = clamp(c.dust + 0.0004 * lit * h * R.dustMult * storm - 0.0001 * h, 0, 1);
  }
  for (const b of state.buildings) {
    if (b.layer !== "s") continue;
    const c = cellAt(state, b.x, b.y);
    let around = c.dust, n = 1;
    for (const [dx, dy] of N4) { const k = cellAt(state, b.x + dx, b.y + dy); if (k) { around += k.dust; n++; } }
    const lit = illumination(state, b.x, b.y);
    b.dust = clamp(b.dust + h * R.dustMult * storm * (0.0006 * lit + 0.006 * (around / n)), 0, 1);
    if (BUILDINGS[b.type].vol) b.wear = clamp(b.wear + h * 0.0005 * b.dust, 0, 1); // grit eats the seals
    // automatic EDS: fire when something nearby is dirty
    if (b.type === "eds" && b.auto && b.connected && state.t >= b.edsReadyAt && state.power.blackout <= 0) {
      const dirty = state.buildings.some((o) => o.layer === "s" && Math.abs(o.x - b.x) <= C.EDS_RADIUS && Math.abs(o.y - b.y) <= C.EDS_RADIUS && o.dust > 0.3);
      if (dirty && peakCapacityKW(state) >= state.power.demand + C.EDS_PEAK_KW) edsPulse(state, b.id);
    }
  }
}

/** Once an hour: structures standing on weak ground may sink. */
function checkSubsidence(state) {
  for (const b of state.buildings) {
    if (b.layer !== "s" || b.hp <= 0) continue;
    const c = cellAt(state, b.x, b.y), limit = c.piled ? C.SUBSIDENCE_PILED : C.SUBSIDENCE_AT;
    if (c.stability >= limit) continue;
    if (rnd(state) < ((limit - c.stability) / limit) * 0.08 * state.rules.subsidenceMult) {
      b.hp = Math.max(0, b.hp - 35); state.stats.subsidences++;
      if (BUILDINGS[b.type].vol) breach(state, b, "subsidence");
      log(state, `Subsidence under ${BUILDINGS[b.type].name}: the foundations sank (ground stability ${Math.round(c.stability)}%). Drive piles or sinter the ground.`, "bad");
      state.netDirty = true;
    }
  }
}

function breach(state, b, cause) {
  if (b.breached) return;
  b.breached = true; state.stats.breaches++;
  if (has(state, "tunnel")) { // bulkheads: only this module's air is lost
    b.isolated = true;
    const share = BUILDINGS[b.type].vol / Math.max(1, state.air.volume);
    state.air.o2 *= 1 - share; state.air.n2 *= 1 - share; state.air.co2 *= 1 - share;
    log(state, `Breach in ${BUILDINGS[b.type].name} (${cause}). Bulkheads closed: only that module lost its air.`, "bad");
  } else log(state, `Breach in ${BUILDINGS[b.type].name} (${cause}). No bulkheads: the whole base is losing air. Repair it now!`, "bad");
  state.netDirty = true;
}

// ───────────────────────────── events ─────────────────────────────
function stepEvents(state, h) {
  const E = state.events, R = state.rules;
  // coronal mass ejection
  if (!E.cme && state.t >= E.nextCME) {
    E.cme = { until: state.t + 6 }; state.stats.cmes++;
    log(state, "SOLAR STORM (CME) has arrived: 6 hours of particle radiation. Stay under shielding.", "bad");
  }
  if (E.cme) {
    const shielded = state.berm || (state.player.layer === "u") || state.crew.suitless;
    if (!shielded || !state.player.inside) state.crew.dose += (state.player.inside ? 4 : 14) * h;
    for (const b of state.buildings) if (b.layer === "s" && BUILDINGS[b.type].gen) b.hp = Math.max(20, b.hp - 0.8 * h); // panels degrade
    if (state.t >= E.cme.until) { E.cme = null; E.nextCME = state.t + (220 + rnd(state) * 260) / R.eventMult; log(state, "The solar storm has passed."); }
  }
  // micrometeorites (the lava tube is safe)
  if (state.t >= E.nextMeteor) {
    E.nextMeteor = state.t + (110 + rnd(state) * 140) / R.eventMult;
    const targets = state.buildings.filter((b) => b.layer === "s");
    if (targets.length && !SCENARIOS[state.scenario].co2Air) {
      const b = targets[Math.floor(rnd(state) * targets.length)];
      b.hp = Math.max(0, b.hp - 20);
      if (BUILDINGS[b.type].vol && rnd(state) < 0.5) breach(state, b, "micrometeorite");
      else log(state, `Micrometeorite hit ${BUILDINGS[b.type].name}: −20% integrity.`, "warn");
    }
  }
  // Mars dust storms
  if (SCENARIOS[state.scenario].dustStorms) {
    if (!E.storm && state.t >= E.nextStorm) { E.storm = { until: state.t + 48 + rnd(state) * 150 }; log(state, "Dust storm over Jezero: sunlight down to 20% and dust falling 5× faster.", "bad"); }
    if (E.storm && state.t >= E.storm.until) { E.storm = null; E.nextStorm = state.t + 200 + rnd(state) * 300; log(state, "The dust storm has cleared."); }
  }
  // fantasy: Helium-Plasma crystals grow in the dark crater
  if (R.heliumPlasma && state.scenario === "moon" && state.t >= E.nextCrystal && state.crystals.length < 5) {
    E.nextCrystal = state.t + 50 + rnd(state) * 60;
    const x = Math.floor(rnd(state) * C.GRID_W), y = C.PSR_ROW + Math.floor(rnd(state) * (C.GRID_H - C.PSR_ROW));
    if (cellAt(state, x, y).b === null) { state.crystals.push({ x, y }); log(state, "A Helium-Plasma Crystal is glowing on the crater floor.", "good"); }
  }
  // horror: electromagnetic anomalies, false readings and the logs of the lost expedition
  if (R.sanity && state.t >= E.nextAnomaly) {
    E.nextAnomaly = state.t + (25 + rnd(state) * 35) / R.eventMult;
    state.crew.sanity = clamp(state.crew.sanity - 6, 0, 100);
    log(state, "Electromagnetic anomaly on all bands. It sounded almost like a voice.", "warn");
    const next = state.loreLogs.length;
    if (next < 8 && state.crew.sanity < 90 - next * 8) state.loreLogs.push(next);
  }
  if (R.hudGlitches) {
    state.hudGlitches = state.hudGlitches.filter((g) => g.until > state.t);
    const p = (100 - state.crew.sanity) / 100;
    if (p > 0.25 && rnd(state) < p * 0.5 * h) {
      const fields = [["pressure", () => Math.round(20 + rnd(state) * 30)], ["oxygen", () => Math.round(5 + rnd(state) * 8)], ["power", () => 0], ["crew", () => state.crew.count + 1], ["co2", () => +(2 + rnd(state) * 4).toFixed(1)]];
      const [field, make] = fields[Math.floor(rnd(state) * fields.length)];
      state.hudGlitches.push({ field, value: make(), until: state.t + 0.5 + rnd(state) * 1.5 });
    }
  }
}

/** Fantasy: pick up a crystal next to the astronaut, and burn one to overcharge every generator for 48 h. */
export function collectCrystal(state) {
  const p = state.player, i = state.crystals.findIndex((c) => Math.abs(c.x - p.x) <= 1 && Math.abs(c.y - p.y) <= 1);
  if (i < 0 || p.layer !== "s") return { ok: false, msg: "No crystal within reach" };
  state.crystals.splice(i, 1); state.res.heliumPlasma += 1;
  return { ok: true, msg: "Helium-Plasma Crystal collected" };
}
export function useCrystal(state) {
  if (state.res.heliumPlasma < 1) return { ok: false, msg: "You have no crystals" };
  state.res.heliumPlasma -= 1; state.plasmaBoostUntil = Math.max(state.t, state.plasmaBoostUntil) + 48;
  log(state, "Helium-Plasma Crystal fed to the grid: +50% generation for 48 hours.", "good");
  return { ok: true, msg: "Generation +50% for 48 h" };
}

// ───────────────────────────── observatory and radar ─────────────────────────────
export function seismicScan(state) {
  if (!countOf(state, "seismic_radar", true)) return { ok: false, msg: "Needs a working seismic radar" };
  if (state.tubeFound) return { ok: false, msg: "The lava tube is already mapped" };
  state.tubeFound = true;
  milestone(state, "tube_found", "Seismic echo: a lava tube runs under the plains. Stable −20 °C, shielded from radiation and meteorites.");
  return { ok: true, msg: "Lava tube found under the plains! Switch to the Underground view." };
}

export const OBS_TASKS = {
  cme: { name: "Solar limb watch", hours: 4, desc: "Forecast solar storms 24 h ahead for the next 10 days." },
  nea: { name: "Near-Earth asteroid tracking", hours: 6, desc: "Houston pays for every tracked orbit." },
  exo: { name: "Exoplanet survey", hours: 12, desc: "Transit spectra: a big science return." },
};
export function startObservation(state, kind) {
  if (!OBS_TASKS[kind]) return { ok: false, msg: "Unknown program" };
  if (!countOf(state, "telescope", true)) return { ok: false, msg: "Needs a powered telescope on the crater floor" };
  if (state.obs.task) return { ok: false, msg: "The telescope is busy" };
  state.obs.task = { kind, left: OBS_TASKS[kind].hours };
  return { ok: true, msg: `${OBS_TASKS[kind].name} started (${OBS_TASKS[kind].hours} h)` };
}
function stepObservatory(state, h) {
  const O = state.obs;
  if (!O.task || !countOf(state, "telescope", true)) return;
  O.task.left -= h;
  if (O.task.left > 0) return;
  const kind = O.task.kind; O.task = null;
  if (kind === "cme") { O.cmeScans++; state.events.forecastUntil = state.t + 240; log(state, "Telescope: solar storm forecasting active for 10 days.", "good"); }
  if (kind === "nea") { O.nea++; const pay = state.rules.contracts ? 120 : 0; state.res.funds += pay; log(state, pay ? `Asteroid orbit delivered to Houston: +${pay} funds.` : "Asteroid orbit computed. Nobody answered the downlink.", "good"); }
  if (kind === "exo") { O.exoplanets++; const s = 25 * state.rules.scienceMult; state.res.science += s; log(state, `Exoplanet spectrum recorded: +${s} science.`, "good"); }
}
/** How many hours of warning you get before the next storm. */
export const cmeWarningHours = (state) => (state.t < state.events.forecastUntil ? 24 : 2);

// ───────────────────────────── CapCom missions ─────────────────────────────
/** Dynamic contracts. `check` reads the state; rewards are paid once. Three are offered at a time, in order. */
export const MISSIONS = [
  { id: "m_ice", title: "First water", text: "Dig ice on the crater floor and melt it in the habitat.", check: (s) => s.stats.waterMade >= 5, reward: { science: 10, funds: 100 } },
  { id: "m_lab", title: "Science station", text: "Build a Laboratory and connect it.", check: (s) => countOf(s, "lab", true) > 0, reward: { science: 8, funds: 80 } },
  { id: "m_extract", title: "Stop digging by hand", text: "Run a Thermal ice extractor on the crater floor.", check: (s) => countOf(s, "ice_extractor", true) > 0, reward: { science: 14, funds: 150 } },
  { id: "m_split", title: "Split water", text: "Run an Electrolysis plant: water into hydrogen and oxygen.", check: (s) => countOf(s, "electrolyzer", true) > 0 && s.res.h2 >= 1, reward: { science: 14, funds: 120 } },
  { id: "m_dust", title: "Keep the dust out", text: "Build an N2-purge airlock.", check: (s) => countOf(s, "airlock_n2", true) > 0, reward: { science: 10, parts: 10 } },
  { id: "m_night", title: "Work through the night", text: "Get through a full 14-day lunar night with every machine powered.", check: (s) => s.stats.nightsSurvived >= 1, reward: { science: 25, funds: 300 } },
  { id: "m_lox", title: "Rocket propellant", text: "Store 30 kg of liquid oxygen.", check: (s) => s.res.lox >= 30, reward: { science: 20, funds: 250 } },
  { id: "m_road", title: "First road", text: "Sinter 6 cells.", check: (s) => s.grid.filter((c) => c.paved).length >= 6, reward: { science: 12, parts: 15 } },
  { id: "m_iron", title: "Metal from rock", text: "Produce 20 kg of iron by ilmenite reduction.", check: (s) => s.res.iron >= 20, reward: { science: 20, funds: 200 } },
  { id: "m_food", title: "First harvest", text: "Grow 10 kg of food in a biodome.", check: (s) => s.stats.foodGrown >= 10, reward: { science: 25, funds: 250 } },
  { id: "m_tube", title: "Underground", text: "Find the lava tube with the seismic radar.", check: (s) => s.tubeFound, reward: { science: 20, funds: 200 } },
  { id: "m_scope", title: "Eyes in the dark", text: "Complete one observation with the crater telescope.", check: (s) => s.obs.nea + s.obs.exoplanets + s.obs.cmeScans > 0, reward: { science: 20, funds: 300 } },
  { id: "m_suitless", title: "Shirt sleeves", text: "Reach 100% habitability in a biosphere or a sealed lava tube.", check: (s) => s.crew.suitless, reward: { science: 50, funds: 600 } },
  { id: "m_ship", title: "The ship", text: "Bring all six vehicle subsystems to 90%.", check: (s) => SUBSYSTEMS.every((x) => s.vehicle.subsystems[x.id] >= C.UMBRAL_VERDE), reward: { science: 40, funds: 500 } },
];
function refreshMissions(state) {
  const M = state.missions;
  M.active = MISSIONS.filter((m) => !M.done.includes(m.id)).slice(0, 3).map((m) => m.id);
}
function stepMissions(state) {
  const M = state.missions;
  let changed = false;
  for (const id of M.active) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m || !m.check(state)) continue;
    M.done.push(id); changed = true;
    const r = { ...m.reward };
    if (!state.rules.contracts) r.funds = 0; // horror: nobody is paying
    for (const [k, v] of Object.entries(r)) state.res[k] += k === "science" ? v * state.rules.scienceMult : v;
    log(state, `CAPCOM — mission complete: ${m.title}. ${Object.entries(r).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join(", ")}`, "good");
  }
  if (changed) refreshMissions(state);
}
export const activeMissions = (state) => state.missions.active.map((id) => MISSIONS.find((m) => m.id === id)).filter(Boolean);

function milestone(state, id, text) {
  if (state.milestones.includes(id)) return;
  state.milestones.push(id);
  log(state, `★ ${text}`, "good");
}

// ───────────────────────────── interplanetary endgame ─────────────────────────────
export function subsystemBlock(state, id) {
  const sub = SUBSYSTEMS.find((s) => s.id === id);
  if (!sub) return "Unknown subsystem";
  if (!countOf(state, "ntr_assembly", true)) return "Needs a powered NTR vehicle assembly building";
  if (!countOf(state, "heavy_pad")) return "Needs the sintered heavy launch pad";
  const v = state.vehicle.subsystems[id];
  if (v >= 100) return "At 100%";
  if (sub.capWithoutTelescope && v >= sub.capWithoutTelescope && !countOf(state, "telescope", true)) return "Past 50% needs the crater telescope as a tracking station";
  if (!canAfford(state, sub.cost)) return `Missing: ${Object.entries(sub.cost).map(([k, c]) => `${c} ${k}`).join(", ")}`;
  return null;
}
export function assembleSubsystem(state, id) {
  const why = subsystemBlock(state, id);
  if (why) return { ok: false, msg: why };
  const sub = SUBSYSTEMS.find((s) => s.id === id);
  pay(state, sub.cost);
  const cap = sub.capWithoutTelescope && !countOf(state, "telescope", true) ? sub.capWithoutTelescope : 100;
  state.vehicle.subsystems[id] = Math.min(cap, state.vehicle.subsystems[id] + sub.gain);
  log(state, `Vehicle: ${id} at ${state.vehicle.subsystems[id]}%.`);
  return { ok: true, msg: `${id}: ${state.vehicle.subsystems[id]}%` };
}

/** Is the departure window to `dest` open, and when does it open/close? */
export function windowInfo(state, dest) {
  const d = DESTINATIONS[dest];
  if (!d) return null;
  const p = state.t % d.everyH, open = p >= d.everyH - d.openH;
  return { open, opensIn: open ? 0 : d.everyH - d.openH - p, closesIn: open ? d.everyH - p : 0 };
}
export function launchBlockers(state, dest) {
  const d = DESTINATIONS[dest];
  if (!d) return ["Unknown destination"];
  const out = [];
  if (state.scenario !== "moon") out.push("The ship has already left the Moon");
  if (!has(state, "action:launch")) out.push('Research "Interplanetary navigation"');
  for (const s of SUBSYSTEMS) if (state.vehicle.subsystems[s.id] < C.UMBRAL_VERDE) out.push(`${s.id} below ${C.UMBRAL_VERDE}%`);
  if (state.res.lh2 < d.lh2) out.push(`Needs ${d.lh2} kg LH2 (you have ${Math.floor(state.res.lh2)})`);
  if (state.res.lox < d.lox) out.push(`Needs ${d.lox} kg LOX (you have ${Math.floor(state.res.lox)})`);
  if (!windowInfo(state, dest).open) out.push(`Window closed: opens in ${Math.ceil(windowInfo(state, dest).opensIn)} h`);
  if (state.crew.health < 50) out.push("The crew is not fit to fly");
  return out;
}

/** Leave the Moon. The colony's knowledge and some cargo travel; the new world has its own rules. */
export function launch(state, dest) {
  const why = launchBlockers(state, dest);
  if (why.length) return { ok: false, msg: why[0], blockers: why };
  const d = DESTINATIONS[dest];
  state.res.lh2 -= d.lh2; state.res.lox -= d.lox;
  const cargo = { parts: Math.min(state.res.parts, 150), water: Math.min(state.res.water, 150), food: Math.min(state.res.food, 150), n2: Math.min(state.res.n2, 300), o2: Math.min(state.res.o2, 100), h2: Math.min(state.res.h2, 30), science: state.res.science, funds: state.res.funds, iron: Math.min(state.res.iron, 80), tio2: Math.min(state.res.tio2, 40) };
  milestone(state, `launched_${dest}`, `Departure burn complete. Next stop: ${d.name}. Lunar escape only took 2.38 km/s.`);
  state.scenario = dest;
  state.res = Object.fromEntries(RES_KEYS.map((k) => [k, cargo[k] ?? 0]));
  state.buildings = []; state.rovers = []; state.crystals = [];
  state.tubeFound = false; state.tubeSealed = false; state.berm = false;
  state.crew.suitless = false; state.crew.dose = 0;
  state.t = 0; state.events = { nextCME: 400, cme: null, forecastUntil: 0, nextMeteor: 1e9, nextAnomaly: 30, nextCrystal: 1e9, storm: null, nextStorm: 60 };
  Object.assign(state, makeGrid(dest, state));
  state.player = { x: 13, y: 8, layer: "s", inside: true, suitO2: C.SUIT_HOURS, evas: 0 };
  place(state, "habitat", 13, 8, "s", true); place(state, "solar", 12, 8, "s", true); place(state, "solar", 14, 8, "s", true);
  place(state, "battery", 13, 9, "s", true); place(state, "radiator", 13, 7, "s", true); place(state, "kilopower", 14, 7, "s", true);
  state.power.stored = 150; state.power.blackout = 0;
  recomputeNetworks(state);
  const V = state.air.volume;
  state.air = { ...state.air, o2: (C.TARGET_O2 * V) / C.KPA_O2, n2: (C.TARGET_N2 * V) / C.KPA_N2, co2: 0, dust: 0, temp: 21 };
  log(state, dest === "mars" ? "Landed in Jezero Crater. The air here is CO2: Sabatier reactors can make methane and water from it." : "Anchored to 16 Psyche. Almost no gravity; the ground is metal.");
  updateDerived(state);
  return { ok: true, msg: `Arrived: ${d.name}` };
}

// ───────────────────────────── alerts, layers, derived ─────────────────────────────
function buildAlerts(state) {
  const A = state.air, P = state.power, out = [];
  const add = (level, code, text) => out.push({ level, code, text });
  if (P.blackout > 0) add("bad", "blackout", `BLACKOUT: ${P.blackout.toFixed(1)} h to restart`);
  if (state.buildings.some((b) => b.breached && !b.isolated)) add("bad", "breach", "BREACH: the base is losing air — repair the module");
  else if (state.buildings.some((b) => b.breached)) add("warn", "breach_iso", "A module is sealed off after a breach: repair it");
  if (A.pO2 < 16) add("bad", "o2", `Oxygen low: ${A.pO2.toFixed(1)} kPa`);
  if (A.pCO2 > 0.7) add(A.pCO2 > 2 ? "bad" : "warn", "co2", `CO2 high: ${A.pCO2.toFixed(2)} kPa — add scrubbers or plants`);
  if (A.total < 70 && A.pO2 >= 16) add("warn", "pressure", `Cabin pressure low: ${A.total.toFixed(0)} kPa — add nitrogen`);
  if (A.temp < 10) add("bad", "cold", `Habitat freezing: ${A.temp.toFixed(0)} °C — the habitat has no power`);
  if (A.dust > 0.15) add("warn", "dust_air", "Dust in the cabin air: build an airlock or a suitport");
  if (state.thermal.reject < state.thermal.load) add("warn", "heat", "Overheating: radiators can't reject the heat (clean them or add more)");
  if (P.shed > 0) add("warn", "shed", `${P.shed} machine${P.shed === 1 ? "" : "s"} without power`);
  if (state.res.food < state.crew.count * C.CREW_FOOD * 72) add(state.res.food <= 0 ? "bad" : "warn", "food", "Food for less than 3 days");
  if (state.res.water < 10) add("bad", "water", "Water almost gone");
  if (state.events.cme) add("bad", "cme", "SOLAR STORM in progress: stay shielded");
  else if (state.events.nextCME - state.t <= cmeWarningHours(state)) add("warn", "cme_warn", `Solar storm in ${Math.max(0, state.events.nextCME - state.t).toFixed(1)} h`);
  if (state.events.storm) add("warn", "storm", "Dust storm: sunlight at 20%");
  const dirty = state.buildings.filter((b) => b.dust > 0.5).length;
  if (dirty) add("warn", "dust", `${dirty} machine${dirty === 1 ? "" : "s"} covered in dust`);
  const weak = state.buildings.filter((b) => b.layer === "s" && cellAt(state, b.x, b.y).stability < (cellAt(state, b.x, b.y).piled ? C.SUBSIDENCE_PILED : C.SUBSIDENCE_AT)).length;
  if (weak) add("warn", "soil", `${weak} structure${weak === 1 ? "" : "s"} on unstable ground`);
  if (state.rovers.some((r) => r.stuck)) add("warn", "rover", "A rover is trapped");
  if (!state.player.inside && state.player.suitO2 < 2) add("bad", "suit", `Suit oxygen: ${(state.player.suitO2 * 60).toFixed(0)} min`);
  if (state.crew.health < 40) add("bad", "health", "Crew health critical");
  // horror: alarms that are not real
  if (state.rules.hudGlitches && state.crew.sanity < 55) {
    const phantom = ["BREACH IN MODULE 7", "UNKNOWN CREW MEMBER IN AIRLOCK", "PRESSURE 0 kPa", "MOVEMENT OUTSIDE", "IT IS IN THE WALLS"];
    const k = Math.floor((state.t * 7) % phantom.length);
    if (Math.floor(state.t * 2) % Math.max(2, Math.round(state.crew.sanity / 8)) === 0) out.push({ level: "bad", code: "phantom", text: phantom[k], fake: true });
  }
  state.alerts = out;
}

/** The four data layers (keys 1–4). Returns 0..1 (or null = no data) for a cell. */
export const LAYERS = {
  1: { id: "stability", name: "Ground stability", legend: "red = unstable (< 45%) · green = firm" },
  2: { id: "light", name: "Sunlight and crater shadow", legend: "yellow = lit now · blue = dark" },
  3: { id: "dust", name: "Electrostatic dust and EDS reach", legend: "orange = charged dust · cyan ring = EDS radius" },
  4: { id: "network", name: "Pipe and power networks", legend: "green = connected · amber = beamed power only · red = isolated" },
};
export function layerValue(state, layer, x, y, lyr = "s") {
  const c = cellAt(state, x, y, lyr);
  if (!c) return null;
  if (lyr === "u") return layer === 4 ? (c.pipe || c.b !== null ? 1 : null) : c.open ? 0.5 : null;
  if (layer === 1) return c.stability / 100;
  if (layer === 2) return illumination(state, x, y) > 0 ? 1 : 0;
  if (layer === 3) {
    const eds = state.buildings.some((b) => b.type === "eds" && b.connected && Math.abs(b.x - x) <= C.EDS_RADIUS && Math.abs(b.y - y) <= C.EDS_RADIUS);
    return eds ? -1 : c.dust; // -1 = protected by a shield
  }
  if (layer === 4) {
    if (c.b !== null) { const b = buildingById(state, c.b); return b.connected ? 1 : b.beamed ? 0.5 : 0; }
    return c.pipe ? 0.75 : null;
  }
  return null;
}

function updateDerived(state) {
  if (state.netDirty) recomputeNetworks(state);
  refreshAir(state);
  buildAlerts(state);
}

// ───────────────────────────── main step ─────────────────────────────
function substep(state, h) {
  const wasNight = isNight(state);
  const hourBefore = Math.floor(state.t);
  state.t += h;
  if (state.netDirty) recomputeNetworks(state);
  stepPower(state, h);
  stepProduction(state, h);
  stepAtmosphere(state, h);
  stepDustAndSoil(state, h);
  stepRovers(state, h);
  stepObservatory(state, h);
  stepEvents(state, h);
  buildAlerts(state);
  stepCrew(state, h);
  if (Math.floor(state.t) !== hourBefore) { checkSubsidence(state); stepMissions(state); }
  // a whole night without a blackout
  if (wasNight) state.nightClean = state.nightClean !== false && state.power.blackout <= 0 && state.power.shed === 0;
  if (wasNight && !isNight(state)) { if (state.nightClean) { state.stats.nightsSurvived++; milestone(state, "night", "The Sun is back. The base kept its power through the whole lunar night."); } state.nightClean = undefined; }
  if (!wasNight && isNight(state)) { state.nightClean = true; log(state, state.scenario === "moon" ? "Night falls on the plains: 14 Earth days on stored power." : "Night falls.", "warn"); }
  if (state.stats.waterMade >= 5) milestone(state, "water", "First water made from lunar ice.");
  if (state.res.lox >= 1) milestone(state, "lox", "First liquid oxygen in the tanks: propellant made on the Moon.");
}

/**
 * Advance the simulation by `dtHours`. Long steps are cut into pieces of at most 15 minutes so that
 * 20× speed gives the same result as 1×. Returns the state.
 */
export function step(state, dtHours) {
  if (!(dtHours > 0)) return state;
  let left = Math.min(dtHours, 48); // never simulate more than 2 days in one call
  const flows = {};
  state.flows = {};
  const total = left;
  while (left > 1e-9) {
    const h = Math.min(C.MAX_SUBSTEP_H, left);
    substep(state, h);
    left -= h;
    if (state.crew.health <= 0) break;
  }
  for (const [k, v] of Object.entries(state.flows)) flows[k] = v / total;
  state.flowsPerHour = flows; // net kg per hour of each resource during this call (for the network panel)
  state.lost = state.crew.health <= 0;
  return state;
}

/** Human-readable clock: lunar day number, hour, and whether the plains are lit. */
export function clock(state) {
  const sc = SCENARIOS[state.scenario];
  return { day: dayOf(state), hour: Math.floor(state.t % 24), cycle: Math.floor(state.t / sc.cycleH) + 1, night: isNight(state), toTerminator: hoursToTerminator(state) };
}

// ───────────────────────────── stress test ─────────────────────────────
/**
 * "Artemis Crisis Stress Test": a developed base dropped into the worst hour of its life.
 * Night has just fallen, a solar storm is two hours out, the panels are dusty, one module stands on
 * weak ground and a tunnel is breached. Used as the quick mode and by the tests.
 */
export function createStressTest(modeId = "realista", difficultyId = "normal") {
  const s = createState(modeId, difficultyId, 4242);
  s.techs = ["n2_airlock", "laser_sintering", "eds", "foundations", "tunnels", "thermal_mining", "electrolysis", "cryogenics", "co2_scrubbing", "atmosphere_control", "hydroponics", "vsat", "rovers"];
  s.air.auto = true;
  Object.assign(s.res, { parts: 60, water: 220, o2: 140, n2: 400, food: 60, funds: 300, regolith: 200, science: 20, h2: 4 });
  const put = (type, x, y) => place(s, type, x, y, "s", true);
  for (const x of [9, 10, 11]) put("solar", x, 7);
  put("battery", 12, 9); put("battery", 14, 9); put("tunnel", 13, 10); put("biodome", 13, 11); put("co2_scrubber", 12, 10);
  put("airlock_n2", 14, 10); put("eds", 11, 8); put("electrolyzer", 15, 8); put("cryo_plant", 16, 8); put("cryo_tank", 17, 8); put("lab", 15, 9); put("sinter_laser", 10, 8);
  for (let y = 9; y <= 14; y++) s.grid[idx(18, y)].pipe = true;
  s.grid[idx(17, 9)].pipe = true; s.grid[idx(16, 9)].pipe = true;
  put("ice_extractor", 18, 15);
  for (const b of s.buildings) if (b.type === "solar") b.dust = 0.7;
  s.grid[idx(13, 11)].stability = 38;                                   // the biodome is on weak ground
  s.t = C.LUNAR_CYCLE_H * 0.5 + 1;                                      // one hour into the night
  s.power.stored = 260;
  s.events.nextCME = s.t + 2;
  recomputeNetworks(s);
  const V = s.air.volume;
  s.air.o2 = (C.TARGET_O2 * V) / C.KPA_O2; s.air.n2 = (C.TARGET_N2 * V) / C.KPA_N2;
  const tunnel = s.buildings.find((b) => b.type === "tunnel");
  breach(s, tunnel, "stress test");
  s.builtTypes = [...new Set(s.buildings.map((b) => b.type))];
  s.stats.excavations = 12; s.stats.waterMade = 40; // this base is long past its first day
  log(s, "ARTEMIS CRISIS STRESS TEST: night, a breach, dusty panels, weak ground and a solar storm in 2 hours.", "bad");
  updateDerived(s);
  return s;
}
