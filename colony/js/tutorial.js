/**
 * tutorial.js — progressive unlocking of the interface and the Field Manual.
 *
 * Minute 0 shows only: movement, hand digging, suit status and the habitat console.
 * Panels appear when the player reaches the milestone that makes them useful.
 * The first time a device is built (or its tech researched) a short "Operating Manual" card opens,
 * with a flow diagram of how to connect it, how to automate it and how it fails.
 * Every card stays available behind the FIELD MANUAL button.
 *
 * No DOM here: `visiblePanels`, `tutorialUpdate` and `flowSvg` return data and strings for ui.js.
 */
import { BUILDINGS, countOf } from "./simulation.js";

// ───────────────────────────── interface stages ─────────────────────────────
/** Panels of the interface and the condition that reveals each one. Order = order they usually appear. */
export const PANELS = [
  { id: "move", name: "Movement", when: () => true, hint: "Click a cell or use WASD to walk." },
  { id: "gather", name: "Dig by hand", when: () => true, hint: "Stand next to a cell and press E to dig." },
  { id: "suit", name: "Suit status", when: () => true, hint: "Outside you have 8 hours of suit oxygen." },
  { id: "console", name: "Habitat console", when: () => true, hint: "Inside the habitat: melt ice, read the air." },
  { id: "build", name: "Build menu", when: (s) => s.stats.waterMade > 0 || s.res.regolith >= 20 || s.builtTypes.length > 0, hint: "You have materials: build your first machine." },
  { id: "capcom", name: "CapCom missions", when: (s) => s.stats.excavations >= 1 || s.builtTypes.length > 0, hint: "Houston has work for you." },
  { id: "techtree", name: "Tech trees", when: (s) => s.builtTypes.includes("lab") || s.techs.length > 0, hint: "The Laboratory makes science. Spend it here." },
  { id: "timecontrol", name: "Time control", when: (s) => s.builtTypes.includes("lab") || s.t > 12, hint: "Pause, 1×, 5×, 20×: a lunar cycle is 28 days." },
  { id: "power", name: "Power panel", when: (s) => s.builtTypes.some((t) => ["solar", "battery", "vsat"].includes(t)) || s.t > 24, hint: "Generation, demand and what the batteries hold." },
  { id: "layers", name: "Data layers (1–4)", when: (s) => s.techs.length >= 1 || s.stats.excavations >= 6, hint: "Keys 1–4 colour the ground: stability, sunlight, dust, networks." },
  { id: "networks", name: "Pipes and flows", when: (s) => s.builtTypes.some((t) => ["ice_extractor", "electrolyzer", "regolith_mine"].includes(t)), hint: "Machines only work when a pipe connects them to the habitat." },
  { id: "atmosphere", name: "Atmosphere", when: (s) => s.techs.includes("co2_scrubbing") || s.builtTypes.includes("tunnel") || s.air.habitability < 55, hint: "Oxygen, nitrogen, CO2 and pressure of the cabin air." },
  { id: "rovers", name: "Rovers", when: (s) => s.builtTypes.includes("rover_bay"), hint: "Program a route once; the rover repeats it." },
  { id: "blss", name: "Agriculture", when: (s) => s.builtTypes.includes("biodome"), hint: "Crops, soil and the closed loop." },
  { id: "underground", name: "Surface / Underground", when: (s) => s.tubeFound, hint: "Switch the view to build inside the lava tube." },
  { id: "observatory", name: "Observatory", when: (s) => s.builtTypes.includes("telescope"), hint: "Storm forecasts, asteroids and exoplanets." },
  { id: "shipyard", name: "Interplanetary shipyard", when: (s) => s.builtTypes.includes("ntr_assembly") || s.techs.includes("ntr"), hint: "Six subsystems, propellant and a window." },
];
export function visiblePanels(state) {
  return PANELS.filter((p) => p.when(state)).map((p) => p.id);
}

/** The single next thing to do, in plain words (shown as the objective line). */
export function currentObjective(state) {
  const s = state;
  if (s.stats.excavations === 0 && s.stats.waterMade === 0) return "Walk down to the dark crater floor (bottom of the map) and dig ice: stand next to a cell and press E.";
  if (s.stats.waterMade === 0 && s.res.ice > 0) return "Carry the ice back into the habitat and melt it at the console.";
  if (s.stats.waterMade === 0) return "Dig on the crater floor: only the shadowed crater has ice.";
  if (!s.builtTypes.includes("lab")) return "Build a Laboratory next to the habitat (it must touch the habitat or a pipe).";
  if (!s.techs.length) return "Wait for science points and research your first technology.";
  if (!s.builtTypes.includes("ice_extractor") && s.techs.includes("thermal_mining")) return "Build a Thermal ice extractor on the crater floor and pipe it to the base.";
  if (s.stats.nightsSurvived === 0) return "Keep your machines running through the 14-day night: towers on the sunlit rim, batteries, or a regenerative fuel cell. (The habitat itself is safe on the fission unit.)";
  if (!s.crew.suitless) return "Grow the base: clean air at one atmosphere, food, shielding. Reach 100% habitability.";
  return "Assemble the interplanetary ship and fill its tanks before the window opens.";
}

// ───────────────────────────── operating manuals ─────────────────────────────
/**
 * @typedef {Object} Manual
 * @property {string} id            building id or tech id that triggers it
 * @property {string} title
 * @property {string} summary       one sentence: what it is for
 * @property {string[]} flow        boxes of the flow diagram, left to right
 * @property {string[]} connect     how to hook it up
 * @property {string[]} automate    how to stop doing it by hand
 * @property {string[]} failures    how it goes wrong and how to prevent it
 */
/** @type {Manual[]} */
export const MANUALS = [
  {
    id: "lab", title: "Laboratory", summary: "Turns crew time and power into science points for the tech trees.",
    flow: ["Habitat", "pipe", "Laboratory", "science"],
    connect: ["Build it touching the habitat, another connected machine, or a pipe cell.", "It needs 5 kW: check the power panel before the night."],
    automate: ["It works by itself while it has power. More labs = more science."],
    failures: ["In a power shortage the lab is the first thing switched off (lowest priority).", "A sick crew (health below 30%) produces only 30% of the science."],
  },
  {
    id: "airlock_n2", title: "N₂-purge airlock", summary: "Blows 80% of the dust off the suits before the inner hatch opens.",
    flow: ["EVA ends", "N₂ jet (0.05 kg)", "dust −80%", "cabin"],
    connect: ["Build one anywhere connected to the base.", "Keep nitrogen in storage: each cycle uses 0.05 kg."],
    automate: ["Used automatically on every EVA, yours and the crew's maintenance EVAs (one every 12 hours)."],
    failures: ["With no nitrogen in storage it stops working and all the dust comes in.", "Cabin dust above 15% hurts the crew: watch the Atmosphere panel."],
  },
  {
    id: "sinter_laser", title: "Sintering laser", summary: "Melts loose regolith into glassy pavement.",
    flow: ["Regolith 5 kg", "Laser 12 kWh", "Paved cell", "0 dust · +25 stability"],
    connect: ["One working laser anywhere in the base lets you pave any cell.", "Each cell takes 12 kWh from the batteries and 5 kg of regolith."],
    automate: ["Pave the routes your rovers drive: paved cells are never eroded and raise no dust."],
    failures: ["Paving with empty batteries is refused: do it in daylight.", "Pave BEFORE you build on weak ground — a building can't be paved under."],
  },
  {
    id: "eds", title: "Electrodynamic Dust Shield (EDS)", summary: "A 5-second electric pulse that throws the dust off every machine within 3 cells.",
    flow: ["Dust on panels", "EDS pulse 60 kW", "Clean within 3 cells", "6 h recharge"],
    connect: ["Place it in the middle of your panels and radiators (3-cell reach).", "It needs the grid to deliver a 60 kW peak on top of everything already running."],
    automate: ["Automatic by default: it fires when something in reach is more than 30% dusty — but only if the peak is safe.", "Peak capacity = generation now + 25 kW per battery + 15 kW per fuel cell."],
    failures: ["Fired by hand without enough peak capacity it trips the grid: 1 hour of BLACKOUT.", "At night with few batteries the automatic mode waits. Add batteries or fire it at noon."],
  },
  {
    id: "ice_extractor", title: "Thermal ice extractor", summary: "Heats the icy soil of the crater floor and collects the water. Ends hand digging.",
    flow: ["Icy soil", "Heat 8 kW", "Vapour → cold trap", "Water 5.4 kg/h"],
    connect: ["Only on the crater floor (bottom zone).", "Either pipe it all the way to the base, or give it a Power-beam receiver and send a rover for the water.", "Without a power beam, everything in the crater uses 4× the power."],
    automate: ["Mines its own cell and the four around it until the ice is gone, then goes idle: move it.", "Unpiped, the water waits inside the machine (up to 400 kg) for a rover route."],
    failures: ["It weakens the ground it mines. Never put a habitat or tunnel next to it.", "Watch layer 1: below 45% stability, structures nearby start to sink."],
  },
  {
    id: "electrolyzer", title: "Electrolysis plant", summary: "Splits water into hydrogen and oxygen.",
    flow: ["Water 2 kg/h", "11 kW", "H₂ 0.22 kg/h", "O₂ 1.78 kg/h"],
    connect: ["Must be piped to the base (it draws water from storage).", "It is your biggest power consumer: 11 kW."],
    automate: ["Runs whenever there is water. Switch it off (click it) to save water for the crew.", "Oxygen goes to storage; the habitat meters it into the air by itself."],
    failures: ["It will happily electrolyze the crew's drinking water. Keep a reserve.", "Hydrogen has nowhere to go until you build a liquefier or a furnace that uses it."],
  },
  {
    id: "cryo_plant", title: "Cryogenic liquefier and tanks", summary: "Makes rocket propellant and keeps it from boiling away.",
    flow: ["H₂ + O₂ gas", "Liquefier 6 kW", "LH₂ : LOX ≈ 1 : 6", "Tanks 30 + 180 kg"],
    connect: ["Build at least one Cryotank pair: with no tank there is nowhere to put the liquid.", "Liquefier and tanks must be piped to the base."],
    automate: ["It keeps the tanks near the 6 : 1 engine mixture and leaves the spare oxygen for breathing.", "A powered liquefier cuts boil-off to 30%."],
    failures: ["If the liquefier loses power, hydrogen boils off — four times faster in sunlight.", "It always leaves 20 kg of oxygen in storage for the crew."],
  },
  {
    id: "ilmenite_reactor", title: "Ilmenite solar furnace", summary: "Gets iron, titanium dioxide and water out of dry rock.",
    flow: ["Regolith 10 kg/h", "+ H₂ 16 g/h", "900 °C", "Fe · TiO₂ · H₂O"],
    connect: ["Needs regolith in storage (dig it, or build a Regolith excavator) and a little hydrogen.", "In sunlight it needs 4 kW; in the dark 20 kW."],
    automate: ["Pair it with a Regolith excavator and an Electrolysis plant: the water it makes gives the hydrogen back."],
    failures: ["No hydrogen, no reaction: it goes idle.", "The excavator that feeds it weakens the ground around itself."],
  },
  {
    id: "rfc", title: "Regenerative fuel cell", summary: "A battery made of water, for the 14-day night.",
    flow: ["Day: surplus kW", "Water → H₂ + O₂", "Night: H₂ + O₂ → kW", "Water returns"],
    connect: ["Any connected spot. Each unit cycles up to 40 kg of water.", "It charges only with power left over after the batteries are full."],
    automate: ["Fully automatic: charges by day, discharges by night (up to 15 kW per unit)."],
    failures: ["It gives back 55% of the energy: plan for the loss.", "It borrows the colony's water to charge. With no spare water it can't store anything."],
  },
  {
    id: "laser_tx", title: "Power beaming", summary: "Sends power from the sunlit side down into the dark crater.",
    flow: ["Rim / plains grid", "Laser", "60% arrives", "Receiver in the crater"],
    connect: ["Laser: connected to the base, on the rim or the plains.", "Receiver: on the crater floor, touching (or piped to) the machines it should power."],
    automate: ["Once both exist, every machine in the receiver's network runs without a pipe to the base."],
    failures: ["Beamed power carries no water: send a rover for what the crater machines produce.", "If the laser is switched off or broken, the crater network stops."],
  },
  {
    id: "rover_bay", title: "Autonomous rovers", summary: "Haul material between machines that no pipe connects.",
    flow: ["Source buffer", "Rover 120 kg", "Drive", "Unload at base"],
    connect: ["Each bay brings 2 rovers.", "A route is: FROM a machine with a full buffer, TO any connected building."],
    automate: ["Set the route once in the Rovers panel; the rover repeats it and recharges when it unloads."],
    failures: ["Off-road driving erodes the ground and raises charged dust: pave the route.", "On the rim, weak ground can collapse and trap the rover (3 parts to recover it)."],
  },
  {
    id: "biodome", title: "Agricultural biodome", summary: "Crops turn the crew's CO₂ and grey water into food, oxygen and clean water.",
    flow: ["CO₂ + water + light", "Crops", "Food 2.9 kg/day", "O₂ + clean water"],
    connect: ["It is a pressurized module: connecting it lowers the cabin pressure until gas is added.", "10 kW of lights, plus 8 kW of heaters at night."],
    automate: ["A CO₂ scrubber stores the crew's CO₂ so the plants never run short.", "Load 200 kg of remediated soil (Bioremediation plant) and it uses 60% less water."],
    failures: ["No heat at night = dead crops. They regrow slowly.", "Raw regolith can't be used as soil: it is toxic and has no nitrogen."],
  },
  {
    id: "tunnel", title: "Pressurized tunnels and bulkheads", summary: "Connect modules and contain breaches.",
    flow: ["Breach", "Hatches close", "1 module lost", "Repair (2 parts)"],
    connect: ["Tunnels carry people, pipes and power between modules.", "Every tunnel adds 10 m³: top up the air."],
    automate: ["Hatches close by themselves when a module is breached."],
    failures: ["Before this research, a single breach drains the whole base at 3% per hour."],
  },
  {
    id: "seismic_radar", title: "Seismic radar", summary: "Listens for hollow spaces under the plains.",
    flow: ["Radar pulse", "Echo", "Lava tube mapped", "Underground view"],
    connect: ["Build it on the plains, connected and powered, then run a scan from its panel."],
    automate: ["One scan is enough: the tube stays mapped."],
    failures: ["Underground you can only build inside the tube itself."],
  },
  {
    id: "lava_seal", title: "Lava-tube airlocks", summary: "Two of them turn the tube into a 5000 m³ shielded habitat.",
    flow: ["Airlock A", "5000 m³ of tube", "Airlock B", "Fill with O₂ + N₂"],
    connect: ["Build both inside the tube (Underground view).", "An airlock links to the surface cell directly above it: run a pipe to that cell."],
    automate: ["Once sealed, the atmosphere regulator fills it from storage. It needs a LOT of nitrogen."],
    failures: ["Pressure across the whole base drops sharply when the tube is sealed: stockpile gas first."],
  },
  {
    id: "telescope", title: "Cryogenic telescope", summary: "Three observing programs from the coldest, quietest place on the Moon.",
    flow: ["Crater floor −173 °C", "Telescope", "Program runs", "Forecast · funds · science"],
    connect: ["Only on the crater floor. It needs power there: pipe or beam."],
    automate: ["Solar watch gives 24 hours of storm warning for 10 days (instead of 2 hours).", "Asteroid tracking pays funds; exoplanet surveys pay science."],
    failures: ["One program at a time. If the power drops, the program pauses."],
  },
  {
    id: "ntr_assembly", title: "Interplanetary shipyard", summary: "Assemble the nuclear-thermal ship, fill it with lunar propellant and leave.",
    flow: ["6 subsystems ≥ 90%", "LH₂ + LOX in tanks", "Window open", "Launch"],
    connect: ["Needs the Sintered heavy launch pad and a powered assembly building.", "You need many Cryotank pairs: Mars takes 240 kg LH₂ + 180 kg LOX."],
    automate: ["Keep a liquefier powered or the hydrogen will boil away while you wait for the window."],
    failures: ["Communications stops at 50% without the crater telescope (tracking station).", "Windows are short. Miss one and the next is months away."],
  },
];
const MANUAL_BY_ID = new Map(MANUALS.map((m) => [m.id, m]));
export const getManual = (id) => MANUAL_BY_ID.get(id) ?? null;
/** Building id → manual id, for devices that share a card. */
const ALIAS = { cryo_tank: "cryo_plant", laser_rx: "laser_tx", suitport: "airlock_n2", regolith_mine: "ilmenite_reactor", bioremediation: "biodome", geodesic_biosphere: "biodome", heavy_pad: "ntr_assembly" };
export const manualFor = (buildingId) => getManual(ALIAS[buildingId] ?? buildingId);

// ───────────────────────────── tracker ─────────────────────────────
/** Serializable tutorial progress. Keep it next to the save. */
export function createTutorial() {
  return { seen: [], queue: [], panels: [], dismissedObjective: false };
}

/**
 * Call after every simulation step and every player action.
 * Returns what just happened so the UI can react:
 *   { newPanels: string[], newManuals: Manual[] }
 */
export function tutorialUpdate(state, tut) {
  const now = visiblePanels(state);
  const newPanels = now.filter((p) => !tut.panels.includes(p));
  tut.panels = now;
  const newManuals = [];
  for (const type of state.builtTypes) {
    const m = manualFor(type);
    if (m && !tut.seen.includes(m.id)) { tut.seen.push(m.id); tut.queue.push(m.id); newManuals.push(m); }
  }
  return { newPanels: newPanels.map((id) => PANELS.find((p) => p.id === id)), newManuals };
}
/** Next manual card to show (first in, first out), or null. */
export function nextManual(tut) {
  const id = tut.queue.shift();
  return id ? getManual(id) : null;
}
/** Everything in the FIELD MANUAL: seen cards are readable, the rest are listed as locked. */
export function fieldManualIndex(tut) {
  return MANUALS.map((m) => ({ id: m.id, title: m.title, unlocked: tut.seen.includes(m.id) }));
}

// ───────────────────────────── flow diagram ─────────────────────────────
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** A left-to-right flow diagram of a manual's `flow` boxes, as an SVG string. Colours come from CSS variables. */
export function flowSvg(manual) {
  const n = manual.flow.length, bw = 118, gap = 26, h = 64, w = n * bw + (n - 1) * gap + 8;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(manual.title)}: ${esc(manual.flow.join(" then "))}">`;
  out += `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent, #4ea1ff)"/></marker></defs>`;
  manual.flow.forEach((label, i) => {
    const x = 4 + i * (bw + gap);
    const last = i === n - 1;
    out += `<rect x="${x}" y="10" width="${bw}" height="44" rx="6" fill="var(--panel, #111a33)" stroke="${last ? "var(--ok, #4ee68a)" : "var(--accent, #4ea1ff)"}" stroke-width="1.5"/>`;
    const words = label.split(" "), lines = [""];
    for (const wd of words) { if ((lines[lines.length - 1] + " " + wd).trim().length > 16) lines.push(wd); else lines[lines.length - 1] = (lines[lines.length - 1] + " " + wd).trim(); }
    lines.slice(0, 2).forEach((ln, k) => { out += `<text x="${x + bw / 2}" y="${(lines.length > 1 ? 28 : 36) + k * 13}" text-anchor="middle" font-family="monospace" font-size="10" fill="var(--text, #dfe8ff)">${esc(ln)}</text>`; });
    if (!last) out += `<path d="M${x + bw + 2} 32 H${x + bw + gap - 3}" stroke="var(--accent, #4ea1ff)" stroke-width="1.5" marker-end="url(#ah)"/>`;
  });
  return out + "</svg>";
}

/** Self-check used by the tests: every manual points at a real building and is complete. */
export function validateManuals() {
  const errors = [];
  for (const m of MANUALS) {
    if (!BUILDINGS[m.id]) errors.push(`${m.id}: not a building`);
    if (m.flow.length < 3) errors.push(`${m.id}: flow too short`);
    for (const k of ["connect", "automate", "failures"]) if (!m[k].length) errors.push(`${m.id}: no ${k}`);
  }
  for (const [a, b] of Object.entries(ALIAS)) { if (!BUILDINGS[a]) errors.push(`alias ${a}: not a building`); if (!MANUAL_BY_ID.has(b)) errors.push(`alias ${a}: no manual ${b}`); }
  return errors;
}

/** True when the manual's device is currently working (for a green tick in the Field Manual). */
export const deviceWorking = (state, manualId) => countOf(state, manualId, true) > 0;
