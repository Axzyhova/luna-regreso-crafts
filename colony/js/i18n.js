/**
 * i18n.js — English is the source language; Spanish is optional and falls back to English wherever a
 * translation is missing.
 *
 *   t("Build")            interface strings
 *   tr("Pipe laid")       text produced by the simulation (results, log lines, alerts): dictionary + patterns
 *   loc.building(id) …    structured content by id (buildings, techs, manuals, missions, story)
 */
import { ES } from "./lang/es.js";
import { BUILDINGS, ZONE_INFO, SUBSYSTEMS, DESTINATIONS, OBS_TASKS, MISSIONS, SCENARIOS, LAYERS } from "./simulation.js";
import { TREES, TECHS } from "./techTree.js";
import { MODES, DIFFICULTIES, getMode } from "./gameModes.js";
import { buildBriefing, CREW, LOST_EXPEDITION_LOGS, crewLine, endingText, FACTS } from "./lore.js";
import { PANELS } from "./tutorial.js";

export const LANGS = { en: "English", es: "Español" };
const KEY = "colony_lang_v1";
let lang = "en";

export function getLang() { return lang; }
export function setLang(l) {
  lang = LANGS[l] ? l : "en";
  try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  return lang;
}
/** Saved choice, otherwise English (the game's main language). */
export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  return setLang(saved ?? "en");
}
const es = () => lang === "es";

/** Interface string. `vars` fills {placeholders}. */
export function t(s, vars) {
  let out = es() ? ES.ui[s] ?? s : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

// ───────────────────────────── simulation text ─────────────────────────────
const NAME_ES = new Map(Object.entries(BUILDINGS).map(([id, b]) => [b.name, ES.buildings[id]?.name ?? b.name]));
const bn = (english) => NAME_ES.get(english) ?? english;
const rs = (k) => ES.resources[k] ?? k;
const list = (s) => s.split(", ").map((p) => p.replace(/^(\+?[\d.]+) (\w+)$/, (_m, n, k) => `${n} ${rs(k)}`)).join(", ");
const pl = (n, one, many) => (Number(n) === 1 ? one : many);

/** Messages with numbers or names in them: [pattern, Spanish]. First match wins. */
const PATTERNS = [
  [/^(.+) built$/, (m) => `${bn(m[1])}: construido`],
  [/^Built: (.+)\.$/, (m) => `Construido: ${bn(m[1])}.`],
  [/^Removed: (.+)\.$/, (m) => `Retirado: ${bn(m[1])}.`],
  [/^Repaired: (.+)\.$/, (m) => `Reparado: ${bn(m[1])}.`],
  [/^Locked: research "(.+)"$/, (m) => `Bloqueado: investiga "${techNameEs(m[1])}"`],
  [/^Only in: (.+)$/, (m) => `Solo en: ${m[1].split(" / ").map(zoneNameEs).join(" / ")}`],
  [/^Missing materials: (.+)$/, (m) => `Faltan materiales: ${list(m[1])}`],
  [/^Missing: (.+)$/, (m) => `Falta: ${list(m[1])}`],
  [/^Needs (\d+) science \(you have (\d+)\)$/, (m) => `Necesita ${m[1]} de ciencia (tienes ${m[2]})`],
  [/^Needs (\d+) funds \(you have (\d+)\)$/, (m) => `Necesita ${m[1]} fondos (tienes ${m[2]})`],
  [/^Requires: (.+)$/, (m) => `Requiere: ${m[1].split(", ").map(techNameEs).join(", ")}`],
  [/^Researched: (.+)$/, (m) => `Investigada: ${techNameEs(m[1])}`],
  [/^Research complete: (.+)\.$/, (m) => `Investigación completa: ${techNameEs(m[1])}.`],
  [/^\+([\d.]+) kg water$/, (m) => `+${m[1]} kg de agua`],
  [/^\+(\d+) kg regolith(?:, \+(\d+) kg ice)?\.( ⚠ Ground here is now unstable\.)?$/, (m) => `+${m[1]} kg de regolito${m[2] ? `, +${m[2]} kg de hielo` : ""}.${m[3] ? " ⚠ El suelo aquí ya es inestable." : ""}`],
  [/^\+([\d.]+) kg (O2|N2) into the cabin air$/, (m) => `+${m[1]} kg de ${m[2]} al aire de la cabina`],
  [/^No (O2|N2) in storage$/, (m) => `No hay ${m[1]} en el almacén`],
  [/^Needs (\d+) kWh stored$/, (m) => `Necesita ${m[1]} kWh almacenados`],
  [/^Needs (\d+) kg of regolith$/, (m) => `Necesita ${m[1]} kg de regolito`],
  [/^Needs (\d+) funds$/, (m) => `Necesita ${m[1]} fondos`],
  [/^Delivered for (\d+) funds$/, (m) => `Entregado por ${m[1]} fondos`],
  [/^Resupply from Earth: (.+) for (\d+) funds\.$/, (m) => `Reabastecimiento desde la Tierra: ${list(m[1])} por ${m[2]} fondos.`],
  [/^Pulse fired: (\d+) machines? cleaned$/, (m) => `Pulso disparado: ${m[1]} ${pl(m[1], "máquina limpia", "máquinas limpias")}`],
  [/^Recharging: ([\d.]+) h$/, (m) => `Recargando: ${m[1]} h`],
  [/^Rover (\d+): hauling (\w+)$/, (m) => `Rover ${m[1]}: acarreando ${rs(m[2])}`],
  [/^(.+) started \((\d+) h\)$/, (m) => `${obsNameEs(m[1])}: iniciado (${m[2]} h)`],
  [/^(.+): (\d+)%$/, (m) => `${ES.subsystems[m[1]]?.name ?? m[1]}: ${m[2]}%`],
  [/^Vehicle: (.+) at (\d+)%\.$/, (m) => `Vehículo: ${ES.subsystems[m[1]]?.name ?? m[1]} al ${m[2]}%.`],
  [/^(.+) below (\d+)%$/, (m) => `${ES.subsystems[m[1]]?.name ?? m[1]} por debajo de ${m[2]}%`],
  [/^Needs (\d+) kg (LH2|LOX) \(you have (\d+)\)$/, (m) => `Necesita ${m[1]} kg de ${m[2]} (tienes ${m[3]})`],
  [/^Window closed: opens in (\d+) h$/, (m) => `Ventana cerrada: abre en ${m[1]} h`],
  [/^Arrived: (.+)$/, (m) => `Llegada: ${destNameEs(m[1])}`],
  [/^Slope collapse on the rim: rover (\d+) is trapped\. Pave the route or send a recovery\.$/, (m) => `Colapso de talud en el borde: el rover ${m[1]} quedó atrapado. Pavimenta la ruta o envía un rescate.`],
  [/^Subsidence under (.+): the foundations sank \(ground stability (\d+)%\)\. Drive piles or sinter the ground\.$/, (m) => `Hundimiento bajo ${bn(m[1])}: los cimientos cedieron (estabilidad del suelo ${m[2]}%). Instala pilotes o sinteriza el suelo.`],
  [/^Breach in (.+) \((.+)\)\. Bulkheads closed: only that module lost its air\.$/, (m) => `Brecha en ${bn(m[1])} (${causeEs(m[2])}). Mamparos cerrados: solo ese módulo perdió su aire.`],
  [/^Breach in (.+) \((.+)\)\. No bulkheads: the whole base is losing air\. Repair it now!$/, (m) => `Brecha en ${bn(m[1])} (${causeEs(m[2])}). Sin mamparos: toda la base pierde aire. ¡Repárala ya!`],
  [/^Micrometeorite hit (.+): −20% integrity\.$/, (m) => `Un micrometeorito golpeó ${bn(m[1])}: −20% de integridad.`],
  [/^Exoplanet spectrum recorded: \+([\d.]+) science\.$/, (m) => `Espectro de exoplaneta registrado: +${m[1]} de ciencia.`],
  [/^Asteroid orbit delivered to Houston: \+(\d+) funds\.$/, (m) => `Órbita de asteroide entregada a Houston: +${m[1]} fondos.`],
  [/^CAPCOM — mission complete: (.+?)\. (.*)$/, (m) => `CAPCOM — misión cumplida: ${missionTitleEs(m[1])}. ${list(m[2])}`],
  [/^★ Departure burn complete\. Next stop: (.+)\. Lunar escape only took 2\.38 km\/s\.$/, (m) => `★ Encendido de partida completo. Próxima parada: ${destNameEs(m[1])}. Escapar de la Luna solo costó 2,38 km/s.`],
  // alerts
  [/^BLACKOUT: ([\d.]+) h to restart$/, (m) => `APAGÓN: ${m[1]} h para reiniciar`],
  [/^Oxygen low: ([\d.]+) kPa$/, (m) => `Oxígeno bajo: ${m[1]} kPa`],
  [/^CO2 high: ([\d.]+) kPa — add scrubbers or plants$/, (m) => `CO2 alto: ${m[1]} kPa — añade depuradores o plantas`],
  [/^Cabin pressure low: (\d+) kPa — add nitrogen$/, (m) => `Presión de cabina baja: ${m[1]} kPa — añade nitrógeno`],
  [/^Habitat freezing: (-?\d+) °C — the habitat has no power$/, (m) => `El hábitat se congela: ${m[1]} °C — el hábitat no tiene energía`],
  [/^(\d+) machines? without power$/, (m) => `${m[1]} ${pl(m[1], "máquina sin energía", "máquinas sin energía")}`],
  [/^Solar storm in ([\d.]+) h$/, (m) => `Tormenta solar en ${m[1]} h`],
  [/^(\d+) machines? covered in dust$/, (m) => `${m[1]} ${pl(m[1], "máquina cubierta de polvo", "máquinas cubiertas de polvo")}`],
  [/^(\d+) structures? on unstable ground$/, (m) => `${m[1]} ${pl(m[1], "estructura sobre suelo inestable", "estructuras sobre suelo inestable")}`],
  [/^Suit oxygen: (\d+) min$/, (m) => `Oxígeno del traje: ${m[1]} min`],
];
const reverse = (table, field) => { const m = new Map(); for (const [id, v] of Object.entries(table)) m.set(v[field] ?? v, id); return m; };
const TECH_NAME = new Map(TECHS.map((tech) => [tech.name, ES.techs[tech.id]?.name ?? tech.name]));
const techNameEs = (english) => TECH_NAME.get(english) ?? english;
const ZONE_BY_NAME = reverse(ZONE_INFO, "name");
const zoneNameEs = (english) => ES.zones[ZONE_BY_NAME.get(english)]?.name ?? english;
const DEST_BY_NAME = reverse(DESTINATIONS, "name");
const destNameEs = (english) => ES.destinations[DEST_BY_NAME.get(english)]?.name ?? english;
const OBS_BY_NAME = reverse(OBS_TASKS, "name");
const obsNameEs = (english) => ES.obsTasks[OBS_BY_NAME.get(english)]?.name ?? english;
const MISSION_BY_TITLE = new Map(MISSIONS.map((m) => [m.title, m.id]));
const missionTitleEs = (english) => ES.missions[MISSION_BY_TITLE.get(english)]?.title ?? english;
const causeEs = (c) => ({ subsidence: "hundimiento", micrometeorite: "micrometeorito", "stress test": "prueba de estrés" }[c] ?? c);

/** Translate a text produced by the simulation. Unknown text comes back unchanged (English). */
export function tr(s) {
  if (!es() || typeof s !== "string") return s;
  const exact = ES.exact[s] ?? ES.objectives[s];
  if (exact) return exact;
  for (const [re, fn] of PATTERNS) { const m = re.exec(s); if (m) return fn(m); }
  return s;
}

// ───────────────────────────── structured content ─────────────────────────────
export const loc = {
  building: (id) => { const b = BUILDINGS[id]; const e = es() ? ES.buildings[id] : null; return { ...b, name: e?.name ?? b.name, desc: e?.desc ?? b.desc }; },
  category: (cat) => (es() ? ES.cats[cat] ?? cat : { station: "Station", dust: "Dust", power: "Power", isru: "ISRU", blss: "Life support", science: "Science", logistics: "Logistics", deep: "Deep space" }[cat] ?? cat),
  tech: (tech) => { const e = es() ? ES.techs[tech.id] : null; return { ...tech, name: e?.name ?? tech.name, card: { ...tech.card, title: e?.title ?? tech.card.title, text: e?.text ?? tech.card.text } }; },
  tree: (id) => { const e = es() ? ES.trees[id] : null; return { ...TREES[id], name: e?.name ?? TREES[id].name, blurb: e?.blurb ?? TREES[id].blurb }; },
  manual: (m) => (es() && ES.manuals[m.id] ? { ...m, ...ES.manuals[m.id] } : m),
  mission: (m) => (es() && ES.missions[m.id] ? { ...m, ...ES.missions[m.id] } : m),
  zone: (id) => (es() && ES.zones[id] ? ES.zones[id] : ZONE_INFO[id] ?? { name: id, note: "" }),
  scenario: (id) => (es() ? ES.scenarios[id] ?? SCENARIOS[id].name : SCENARIOS[id].name),
  layer: (n) => (es() && ES.layers[n] ? { ...LAYERS[n], ...ES.layers[n] } : LAYERS[n]),
  mode: (id) => { const m = MODES[id]; return es() && ES.modes[id] ? { ...m, ...ES.modes[id] } : m; },
  difficulty: (id) => { const d = DIFFICULTIES[id]; return es() && ES.difficulties[id] ? { ...d, ...ES.difficulties[id] } : d; },
  subsystem: (s) => { const e = es() ? ES.subsystems[s.id] : null; return { ...s, name: e?.name ?? s.id, why: e?.why ?? s.why }; },
  subsystems: () => SUBSYSTEMS.map((s) => loc.subsystem(s)),
  destination: (id) => (es() && ES.destinations[id] ? { ...DESTINATIONS[id], ...ES.destinations[id] } : DESTINATIONS[id]),
  obsTask: (kind) => (es() && ES.obsTasks[kind] ? { ...OBS_TASKS[kind], ...ES.obsTasks[kind] } : OBS_TASKS[kind]),
  resource: (k) => (es() ? ES.resources[k] ?? k : { h2: "H₂", o2: "O₂", n2: "N₂", co2: "CO₂", lh2: "LH₂", lox: "LOX", tio2: "TiO₂", ch4: "methane", heliumPlasma: "crystals" }[k] ?? k),
  status: (code) => (es() ? ES.status[code] ?? code : { ok: "working", off: "off", broken: "broken", breached: "breached", unconnected: "not connected", nopower: "no power", idle: "idle", cold: "cold", dry: "no water", noCO2: "no CO₂", dead: "crops dead" }[code] ?? code),
  panel: (id) => { const p = PANELS.find((x) => x.id === id); return es() && ES.panels[id] ? { ...p, ...ES.panels[id] } : p; },

  /** The four briefing screens, in the current language (the SVG art is shared). */
  briefing(modeId) {
    const screens = buildBriefing(modeId);
    if (!es()) return screens;
    const m = getMode(modeId), B = ES.briefing;
    return screens.map((s) => {
      const e = B[s.id];
      if (!e) return s;
      const out = { ...s, title: s.id === "crew" ? `${m.codename.toUpperCase()} — ${e.title}` : e.title, paragraphs: s.id === "purpose" ? [B.opening[m.id], ...e.paragraphs] : e.paragraphs, bullets: e.bullets ?? s.bullets };
      if (e.footer) out.footer = e.footer[m.id] ?? e.footer.default;
      if (s.transmissions) out.transmissions = CREW[m.id].map((c) => ({ name: c.name, role: ES.crewRoles[c.role] ?? c.role, agency: c.agency, color: c.color, line: ES.crewLines[m.id]?.[c.id] ?? c.line }));
      return out;
    });
  },
  crewLine(code, modeId) {
    const id = getMode(modeId).id;
    if (es() && ES.chatter[code]) return ES.chatter[code][id] ?? ES.chatter[code].realista;
    return crewLine(code, modeId);
  },
  lostLogs(state) {
    return state.loreLogs.map((i) => { const l = LOST_EXPEDITION_LOGS[i]; return l ? { ...l, text: es() ? ES.lostLogs[i] ?? l.text : l.text } : null; }).filter(Boolean);
  },
  ending(state) {
    const e = endingText(state);
    if (!e || !es()) return e;
    const id = getMode(state.modeId).id, E = ES.endings;
    if (state.lost) return id === "terrorifico" ? E.lostHorror : E.lost;
    if (state.scenario === "mars") return E.mars;
    if (state.scenario === "psyche") return E.psyche;
    return { title: ES.wins[id], text: E.suitless.text };
  },
  fact: (i) => (es() ? ES.facts : FACTS)[i % FACTS.length],
};
