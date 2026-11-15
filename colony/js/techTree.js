/**
 * techTree.js — the five progress trees and the "Real NASA Science" card that comes with every upgrade.
 *
 * A tech costs science points (earned in the Lab, with the telescope and from CapCom contracts) and
 * sometimes funds. Researching it unlocks buildings and actions in the simulation.
 * The numbers on the cards are the same ones simulation.js uses, so the card is the manual.
 */

export const TREES = {
  dust: { id: "dust", name: "Dust & Surface Ops", icon: "✦", color: "#f2b84f", blurb: "Charged lunar dust destroys seals, panels and radiators. Keep it out." },
  geotech: { id: "geotech", name: "Geotechnics & Construction", icon: "▲", color: "#c9a27a", blurb: "The ground is a structure too. Dig carelessly and it fails." },
  isru: { id: "isru", name: "ISRU Chemistry", icon: "⚗", color: "#4ea1ff", blurb: "Turn rock and ice into water, oxygen, metal and rocket propellant." },
  blss: { id: "blss", name: "Life Support & Agriculture", icon: "❋", color: "#4ee68a", blurb: "Close the loop: air, water and food recycled by plants and machines." },
  deep: { id: "deep", name: "Power & Deep Space", icon: "☄", color: "#b48cff", blurb: "Survive the 14-day night, watch the sky, and leave for Mars." },
};

/**
 * @typedef {Object} Tech
 * @property {string} id
 * @property {keyof typeof TREES} tree
 * @property {number} tier            position in its tree (1 = first)
 * @property {string} name
 * @property {{science:number, funds?:number}} cost
 * @property {string[]} requires      tech ids
 * @property {string[]} unlocks       building ids / action ids used by simulation.js
 * @property {{title:string, formula:string, text:string, source:string}} card
 */

/** @type {Tech[]} */
export const TECHS = [
  // ───────────── Dust & Surface Ops ─────────────
  {
    id: "n2_airlock", tree: "dust", tier: 1, name: "Nitrogen-purge airlock", cost: { science: 8 }, requires: [], unlocks: ["airlock_n2"],
    card: {
      title: "Why lunar dust is dangerous",
      formula: "Grain size ≈ 20–70 µm · sharp, glassy, electrostatically charged",
      text: "Apollo crews reported dust that smelled of gunpowder, clogged suit joints and irritated eyes and lungs. A jet of dry nitrogen blows it off the suit before the inner hatch opens. In the game an airlock removes 80% of the dust each EVA would bring inside and uses 0.05 kg of N₂ per cycle.",
      source: "NASA Apollo mission reports; NASA Lunar Dust Mitigation studies",
    },
  },
  {
    id: "laser_sintering", tree: "dust", tier: 2, name: "Laser sintering of roads", cost: { science: 18 }, requires: ["n2_airlock"], unlocks: ["sinter_laser", "action:pave"],
    card: {
      title: "Melting regolith into pavement",
      formula: "Regolith sinters at ≈ 1100–1200 °C → glassy ceramic tile",
      text: "Concentrated light or a laser fuses loose grains into a solid surface. A paved cell produces no dust when rovers drive on it and its ground stability rises by 25 points. Each cell costs 12 kWh and 5 kg of regolith.",
      source: "ESA PAVER project; NASA Moon-to-Mars Planetary Autonomous Construction Technologies (MMPACT)",
    },
  },
  {
    id: "eds", tree: "dust", tier: 3, name: "Electrodynamic Dust Shield (EDS)", cost: { science: 30, funds: 150 }, requires: ["laser_sintering"], unlocks: ["eds", "action:eds_pulse"],
    card: {
      title: "Repelling dust with travelling electric fields",
      formula: "Multi-phase AC on embedded electrodes → travelling wave lifts and carries charged grains",
      text: "Developed at NASA's Kennedy Space Center and flown on the Moon in 2025. No moving parts. In the game a pulse cleans every machine within 3 cells in 5 seconds but draws a 60 kW peak: fire it without enough generation and battery discharge capacity and the whole base browns out.",
      source: "NASA Kennedy Space Center Electrostatics and Surface Physics Laboratory",
    },
  },
  {
    id: "suitport", tree: "dust", tier: 4, name: "Suitport docking", cost: { science: 40 }, requires: ["eds"], unlocks: ["suitport"],
    card: {
      title: "The suit never comes inside",
      formula: "Rear-entry suit docked to the outer hull → dust ingress ≈ 0",
      text: "The astronaut climbs into the suit through a hatch in its back while the suit stays outside. Nothing dusty ever enters the cabin, and no air is lost cycling an airlock.",
      source: "NASA Ames suitport concept; NASA Space Exploration Vehicle tests",
    },
  },

  // ───────────── Geotechnics & Construction ─────────────
  {
    id: "foundations", tree: "geotech", tier: 1, name: "Deep pile foundations", cost: { science: 10 }, requires: [], unlocks: ["action:pile"],
    card: {
      title: "Building on loose soil",
      formula: "Subsidence when soil stability < 45% (with piles: < 25%)",
      text: "The top centimetres of regolith are fluffy; below that it is densely packed. Digging nearby loosens it. Piles carry the load down to the compact layer, so a structure survives much weaker ground.",
      source: "NASA Lunar Sourcebook (regolith geotechnical properties)",
    },
  },
  {
    id: "tunnels", tree: "geotech", tier: 2, name: "Pressurized tunnels & bulkheads", cost: { science: 16 }, requires: ["foundations"], unlocks: ["tunnel"],
    card: {
      title: "Compartments save crews",
      formula: "Breach → automatic hatches isolate one module, not the base",
      text: "Like a submarine or the ISS, every module can be sealed off. With bulkheads a breach only loses the air of the damaged module. Without them the whole connected volume leaks.",
      source: "ISS emergency depressurization procedures (NASA)",
    },
  },
  {
    id: "seismic_radar", tree: "geotech", tier: 3, name: "Seismic & ground-penetrating radar", cost: { science: 26 }, requires: ["tunnels"], unlocks: ["seismic_radar", "action:seismic_scan"],
    card: {
      title: "Finding caves from the surface",
      formula: "Lava tubes: stable ≈ −20 °C, metres of rock overhead",
      text: "Lunar Reconnaissance Orbiter imaged collapsed 'skylights' and radar data points to open lava tubes. Inside, radiation and micrometeorites are blocked and the temperature barely changes.",
      source: "NASA LRO; JAXA SELENE/Kaguya radar sounder",
    },
  },
  {
    id: "lava_sealing", tree: "geotech", tier: 4, name: "Lava-tube sealing", cost: { science: 45, funds: 300 }, requires: ["seismic_radar"], unlocks: ["lava_seal"],
    card: {
      title: "A city inside the rock",
      formula: "Two giant airlocks seal ≈ 5000 m³ of tube",
      text: "Seal both ends of a tube section and you have a huge shielded volume to pressurize. It needs a lot of nitrogen and oxygen to fill, but once habitable the crew can live without suits.",
      source: "NASA NIAC lava-tube habitat studies",
    },
  },
  {
    id: "heavy_pad", tree: "geotech", tier: 5, name: "Sintered heavy launch pad", cost: { science: 55, funds: 400 }, requires: ["lava_sealing", "laser_sintering"], unlocks: ["heavy_pad"],
    card: {
      title: "Rockets sandblast everything nearby",
      formula: "Lunar escape: Δv ≈ 2.38 km/s (Earth: 11.2 km/s)",
      text: "Engine plumes throw regolith at several km/s. A thick sintered pad stops the blast. Because the Moon's gravity well is shallow, a ship fuelled here leaves with far less propellant than one launched from Earth.",
      source: "NASA Plume-Surface Interaction project; Apollo 12 / Surveyor 3 dust damage",
    },
  },

  // ───────────── ISRU Chemistry ─────────────
  {
    id: "thermal_mining", tree: "isru", tier: 1, name: "Thermal ice mining", cost: { science: 10 }, requires: [], unlocks: ["ice_extractor"],
    card: {
      title: "Water from permanently shadowed craters",
      formula: "Heat icy regolith → water vapour → cold trap",
      text: "LCROSS (2009) found water ice in a permanently shadowed crater near the south pole. Heating the soil releases vapour that is captured and condensed. The extractor only works on the crater floor and weakens the ground it mines.",
      source: "NASA LCROSS; NASA Lunar Prospector",
    },
  },
  {
    id: "electrolysis", tree: "isru", tier: 2, name: "Water electrolysis", cost: { science: 14 }, requires: ["thermal_mining"], unlocks: ["electrolyzer"],
    card: {
      title: "Splitting water",
      formula: "2 H₂O → 2 H₂ + O₂   (mass 9 : 1 : 8, ≈ 5.5 kWh per kg of water)",
      text: "Nine kilograms of water give one kilogram of hydrogen and eight of oxygen. The oxygen is breathable and, liquefied, it is the heaviest part of rocket propellant.",
      source: "NASA ISRU technology roadmaps; ISS Oxygen Generation Assembly",
    },
  },
  {
    id: "cryogenics", tree: "isru", tier: 3, name: "Cryogenic liquefaction", cost: { science: 22 }, requires: ["electrolysis"], unlocks: ["cryo_plant", "cryo_tank"],
    card: {
      title: "Keeping propellant cold",
      formula: "LH₂ boils at −253 °C · LOX at −183 °C · engines burn ≈ 6 : 1 (O : H)",
      text: "Liquid hydrogen warms up and boils away ('boil-off') unless it is actively cooled. A powered liquefier cuts the loss to 30%. Tanks standing in sunlight lose four times more than tanks at night.",
      source: "NASA Cryogenic Fluid Management program",
    },
  },
  {
    id: "ilmenite", tree: "isru", tier: 3, name: "Ilmenite hydrogen reduction", cost: { science: 24 }, requires: ["electrolysis"], unlocks: ["ilmenite_reactor", "regolith_mine"],
    card: {
      title: "Oxygen and iron from dry rock",
      formula: "FeTiO₃ + H₂ → Fe + TiO₂ + H₂O   (≈ 900 °C)",
      text: "Per kilogram of ilmenite: 13 g of hydrogen in, 368 g of iron, 527 g of titanium dioxide and 119 g of water out. Electrolyze that water and the hydrogen comes back: it is only a carrier. This works where there is no ice.",
      source: "NASA ISRU hydrogen-reduction demonstrations (PILOT, ROxygen)",
    },
  },
  {
    id: "fabrication", tree: "isru", tier: 4, name: "Metal fabrication", cost: { science: 28 }, requires: ["ilmenite"], unlocks: ["fabricator"],
    card: {
      title: "Stop shipping spare parts",
      formula: "Fe + TiO₂ → structural parts (additive manufacturing)",
      text: "Launching one kilogram to the Moon costs a fortune. Printing parts from local iron removes the outpost's biggest dependency on Earth.",
      source: "NASA In-Space Manufacturing project",
    },
  },
  {
    id: "regen_fuel_cells", tree: "isru", tier: 5, name: "Regenerative fuel cells", cost: { science: 36, funds: 200 }, requires: ["cryogenics"], unlocks: ["rfc"],
    card: {
      title: "A battery made of water",
      formula: "Day: 2 H₂O + energy → 2 H₂ + O₂ · Night: 2 H₂ + O₂ → 2 H₂O + energy (≈ 55% round trip)",
      text: "For a 14-day night, batteries are far too heavy. A regenerative fuel cell stores surplus solar power as hydrogen and oxygen and recombines them at night, giving back electricity and the same water.",
      source: "NASA Glenn Research Center regenerative fuel cell program",
    },
  },

  // ───────────── Life Support & Agriculture ─────────────
  {
    id: "co2_scrubbing", tree: "blss", tier: 1, name: "CO₂ scrubbing", cost: { science: 8 }, requires: [], unlocks: ["co2_scrubber"],
    card: {
      title: "What you breathe out",
      formula: "One person: −0.84 kg O₂ / day, +1.0 kg CO₂ / day",
      text: "Carbon dioxide above about 0.5 kPa causes headaches; above 2 kPa it is dangerous. Scrubbers capture it. Later the captured CO₂ becomes food: plants need it.",
      source: "NASA Human Integration Design Handbook; ISS CDRA",
    },
  },
  {
    id: "atmosphere_control", tree: "blss", tier: 2, name: "Atmosphere pressure control", cost: { science: 14 }, requires: ["co2_scrubbing"], unlocks: ["action:auto_atmosphere"],
    card: {
      title: "Air is mostly nitrogen for a reason",
      formula: "Target: O₂ 21 kPa + N₂ 79 kPa ≈ 101 kPa (sea level)",
      text: "Pure oxygen at full pressure is a severe fire hazard (Apollo 1). Nitrogen is the buffer gas. Every new module you connect adds volume, so the pressure drops until you add more gas.",
      source: "NASA Apollo 1 review board; ISS Environmental Control and Life Support System",
    },
  },
  {
    id: "hydroponics", tree: "blss", tier: 3, name: "Hydroponic biodome", cost: { science: 22 }, requires: ["atmosphere_control"], unlocks: ["biodome"],
    card: {
      title: "Plants as life support",
      formula: "CO₂ + H₂O + light → food + O₂",
      text: "Raw regolith is toxic and has no nitrogen, so the first crops grow in water. The plants take the crew's CO₂ and grey water and return oxygen, clean water and food. They need heat through the lunar night or they die.",
      source: "NASA Veggie and Advanced Plant Habitat (ISS); NASA CELSS program",
    },
  },
  {
    id: "bioremediation", tree: "blss", tier: 4, name: "Regolith bioremediation", cost: { science: 30 }, requires: ["hydroponics"], unlocks: ["bioremediation"],
    card: {
      title: "Making soil out of moondust",
      formula: "Regolith + water + nitrogen + microbes → fertile soil",
      text: "In 2022 plants were grown in real Apollo regolith for the first time: they sprouted but were stressed. Washing out toxic compounds and adding nitrogen and microbes makes a usable soil that needs much less water than hydroponics.",
      source: "University of Florida / NASA Apollo-sample plant growth experiment (2022)",
    },
  },
  {
    id: "cupola", tree: "blss", tier: 4, name: "Observation cupola", cost: { science: 20 }, requires: ["atmosphere_control"], unlocks: ["cupola"],
    card: {
      title: "The Overview Effect",
      formula: "Earth seen from the Moon: ≈ 2° wide, wobbling a few degrees by libration",
      text: "Astronauts describe a deep shift when they see the whole Earth. From the south pole the Earth hangs low and rocks slowly above the horizon. Crews who can watch it carry less stress.",
      source: "Frank White, 'The Overview Effect'; NASA astronaut oral histories",
    },
  },
  {
    id: "geodesic_biosphere", tree: "blss", tier: 5, name: "Geodesic biosphere", cost: { science: 50, funds: 350 }, requires: ["bioremediation", "tunnels"], unlocks: ["geodesic_biosphere"],
    card: {
      title: "Living without a suit",
      formula: "Habitability 100% = air + pressure + temperature + shielding + clean air",
      text: "A large dome with balanced oxygen and nitrogen, plants, heat and enough shielding becomes a place where people simply live. Reaching 100% habitability here ends the suit era of the colony.",
      source: "NASA lunar surface habitat architecture studies",
    },
  },

  // ───────────── Power & Deep Space ─────────────
  {
    id: "vsat", tree: "deep", tier: 1, name: "Vertical solar array towers (VSAT)", cost: { science: 12 }, requires: [], unlocks: ["vsat"],
    card: {
      title: "Chasing a Sun that never rises",
      formula: "South-pole ridges: sunlight ≈ 88% of the lunar cycle, always near the horizon",
      text: "At the pole the Sun circles low, so panels must stand upright on tall masts. On the high rim they see the Sun most of the month. On the plains, night lasts 14 Earth days.",
      source: "NASA Vertical Solar Array Technology (VSAT) project",
    },
  },
  {
    id: "rovers", tree: "deep", tier: 2, name: "Autonomous rovers", cost: { science: 16 }, requires: ["vsat"], unlocks: ["rover_bay", "action:rover_route"],
    card: {
      title: "Robots do the hauling",
      formula: "Unpaved traffic erodes the crust and raises charged dust",
      text: "Rovers carry material between machines that are not connected by pipe. Program a route once and they repeat it. Off-road they wear the ground and kick up dust; on sintered roads they do neither.",
      source: "NASA VIPER; NASA Lunar Terrain Vehicle",
    },
  },
  {
    id: "laser_power", tree: "deep", tier: 3, name: "Laser power beaming", cost: { science: 26, funds: 150 }, requires: ["rovers"], unlocks: ["laser_tx", "laser_rx"],
    card: {
      title: "Sending sunlight into the dark",
      formula: "Beam efficiency ≈ 60% · unpowered crater equipment drains batteries 4× faster",
      text: "The crater floor is at −173 °C and never sees the Sun. A laser on the sunlit rim can beam power down to a receiver. Without it, heaters empty the batteries four times faster.",
      source: "NASA Lunar Surface Innovation Initiative power beaming studies",
    },
  },
  {
    id: "cryo_telescope", tree: "deep", tier: 4, name: "Cryogenic crater telescope", cost: { science: 34, funds: 200 }, requires: ["laser_power"], unlocks: ["telescope", "action:observe"],
    card: {
      title: "The quietest, coldest observatory",
      formula: "Crater floor ≈ −173 °C: infrared detectors cool passively",
      text: "A permanently shadowed crater is naturally cold and shielded from Earth's radio noise. From here you can watch the Sun's far limb for storms hours ahead, track near-Earth asteroids and survey exoplanets.",
      source: "NASA NIAC Lunar Crater Radio Telescope; JWST passive cooling design",
    },
  },
  {
    id: "ntr", tree: "deep", tier: 5, name: "Nuclear thermal propulsion", cost: { science: 60, funds: 500 }, requires: ["cryo_telescope", "heavy_pad", "cryogenics"], unlocks: ["ntr_assembly"],
    card: {
      title: "Twice the efficiency of chemical rockets",
      formula: "Isp ≈ 900 s (hydrogen heated by a reactor) vs ≈ 450 s (LH₂/LOX)",
      text: "A reactor heats liquid hydrogen and expels it. The ship is checked the way NASA Goddard's Mission Design Lab reviews any mission: propulsion, power, thermal, communications, attitude control and structures.",
      source: "NASA / DARPA DRACO program; NASA Goddard Mission Design Lab",
    },
  },
  {
    id: "interplanetary", tree: "deep", tier: 6, name: "Interplanetary navigation", cost: { science: 70 }, requires: ["ntr"], unlocks: ["action:launch"],
    card: {
      title: "Windows open and close",
      formula: "Earth–Mars transfer window: every ≈ 26 months",
      text: "Planets move, so cheap trajectories only exist at certain times. Trajectories like these are designed with NASA's General Mission Analysis Tool (GMAT). In the game the window values are simplified.",
      source: "NASA GMAT (GSC-19468-1); NASA Mars 2020 and Psyche mission designs",
    },
  },
];

const BY_ID = new Map(TECHS.map((t) => [t.id, t]));

export function getTech(id) {
  return BY_ID.get(id) ?? null;
}

export function techsOfTree(treeId) {
  return TECHS.filter((t) => t.tree === treeId).sort((a, b) => a.tier - b.tier);
}

/** What the player always has, before any research. */
export const STARTING_UNLOCKS = ["habitat", "solar", "battery", "kilopower", "pipe", "radiator", "lab", "action:excavate", "action:resupply"];

/** Why a tech can't be researched right now, or null if it can. `state` needs { techs:string[], res:{science, funds} }. */
export function researchBlock(state, id) {
  const t = getTech(id);
  if (!t) return "Unknown technology";
  if (state.techs.includes(id)) return "Already researched";
  const missing = t.requires.filter((r) => !state.techs.includes(r));
  if (missing.length) return `Requires: ${missing.map((r) => getTech(r)?.name ?? r).join(", ")}`;
  if (state.res.science < t.cost.science) return `Needs ${t.cost.science} science (you have ${Math.floor(state.res.science)})`;
  if ((t.cost.funds ?? 0) > state.res.funds) return `Needs ${t.cost.funds} funds (you have ${Math.floor(state.res.funds)})`;
  return null;
}

export function availableTechs(state) {
  return TECHS.filter((t) => !state.techs.includes(t.id) && t.requires.every((r) => state.techs.includes(r)));
}

/** Everything unlocked by the techs in `techIds` (plus the starting set). */
export function unlockedSet(techIds) {
  const out = new Set(STARTING_UNLOCKS);
  for (const id of techIds) for (const u of getTech(id)?.unlocks ?? []) out.add(u);
  return out;
}

/** Which tech unlocks a building or action (for "locked" tooltips). */
export function techFor(unlockId) {
  return TECHS.find((t) => t.unlocks.includes(unlockId)) ?? null;
}

/** Progress per tree, 0..1, for the tree headers. */
export function treeProgress(techIds) {
  const out = {};
  for (const tree of Object.keys(TREES)) {
    const all = TECHS.filter((t) => t.tree === tree);
    out[tree] = all.filter((t) => techIds.includes(t.id)).length / all.length;
  }
  return out;
}

/** Internal consistency check, used by the tests: every requirement exists and there are no cycles. */
export function validateTechTree() {
  const errors = [];
  for (const t of TECHS) {
    if (!TREES[t.tree]) errors.push(`${t.id}: unknown tree ${t.tree}`);
    for (const r of t.requires) if (!BY_ID.has(r)) errors.push(`${t.id}: unknown requirement ${r}`);
  }
  const done = new Set();
  for (let pass = 0; pass < TECHS.length + 1; pass++) for (const t of TECHS) if (t.requires.every((r) => done.has(r))) done.add(t.id);
  for (const t of TECHS) if (!done.has(t.id)) errors.push(`${t.id}: unreachable (cycle or missing requirement)`);
  return errors;
}
