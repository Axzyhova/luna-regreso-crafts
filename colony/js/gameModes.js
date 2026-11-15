/**
 * gameModes.js — the three replayable modes. Each one changes the simulation rules, the events,
 * the wording and the procedural audio profile. The simulation reads `rules`; the UI reads the rest.
 *
 * The mode ids match the original game (realista / fantastico / terrorifico) so old data keeps its meaning.
 */

export const MODES = {
  realista: {
    id: "realista",
    name: "REALISTIC",
    codename: "Artemis Pioneer",
    tagline: "Pure NASA rigor: strict mass, energy and chemistry budgets.",
    description:
      "Every kilogram and every kilowatt-hour is accounted for. Solar storms (CME), ground subsidence and Houston research contracts decide whether the outpost survives.",
    palette: { bg: "#0b1020", panel: "#111a33", accent: "#4ea1ff", ok: "#4ee68a", warn: "#f2b84f", bad: "#ff5c5c", text: "#dfe8ff", grid: "#2a3a66" },
    audio: { profile: "telemetry", baseHz: 220, scale: [0, 2, 4, 7, 9], tempo: 72, noise: 0.02 },
    rules: {
      strictBudgets: true,        // resupply from Earth is expensive and slow
      resupplyCostMult: 1.5,
      eventMult: 1,               // frequency of CME / meteorites / leaks
      dustMult: 1,
      subsidenceMult: 1,
      contracts: true,            // Houston research contracts
      heliumPlasma: false,
      xenoflora: false,
      sanity: false,              // horror-only psychological system
      lightCone: false,
      hudGlitches: false,
      stressMult: 1,
      scienceMult: 1,
    },
    terms: { crisis: "ANOMALY REPORT", capcom: "HOUSTON CAPCOM", morale: "Crew morale", win: "Self-sufficient outpost" },
  },

  fantastico: {
    id: "fantastico",
    name: "FANTASY",
    codename: "Lunar Odyssey",
    tagline: "The same engineering, plus cosmic phenomena worth discovering.",
    description:
      "Helium-Plasma Crystals grow in the dark craters and can supercharge reactors. Bioluminescent xenoflora thrives in the biodomes and doubles oxygen and morale. A story of wonder.",
    palette: { bg: "#0d0a24", panel: "#1a1440", accent: "#b48cff", ok: "#5ff0d0", warn: "#ffd166", bad: "#ff6b9d", text: "#efe8ff", grid: "#3a2f77" },
    audio: { profile: "cosmic", baseHz: 174.6, scale: [0, 3, 5, 7, 10, 12], tempo: 54, noise: 0.01 },
    rules: {
      strictBudgets: false,
      resupplyCostMult: 1,
      eventMult: 0.85,
      dustMult: 0.9,
      subsidenceMult: 0.9,
      contracts: true,
      heliumPlasma: true,         // crystals appear in PSR cells; each one boosts power generation for a while
      xenoflora: true,            // biodomes: O2 x2, morale bonus
      sanity: false,
      lightCone: false,
      hudGlitches: false,
      stressMult: 0.8,
      scienceMult: 1.25,
    },
    terms: { crisis: "COSMIC EVENT", capcom: "ODYSSEY CONTROL", morale: "Crew wonder", win: "A garden under the stars" },
  },

  terrorifico: {
    id: "terrorifico",
    name: "HORROR",
    codename: "Dark Side Isolation",
    tagline: "Same physics. Less light. Something was here before you.",
    description:
      "Adds Sanity. You only see a short cone of light on a monochrome CRT display. Darkness, air leaks and electromagnetic anomalies make the HUD lie to you: false pressure readings, phantom alarms, and the logs of an expedition that never came back.",
    palette: { bg: "#020a04", panel: "#04140a", accent: "#35ff7a", ok: "#35ff7a", warn: "#c8ff5a", bad: "#ff4040", text: "#b6ffcf", grid: "#0f3d22" },
    audio: { profile: "dread", baseHz: 55, scale: [0, 1, 6, 7], tempo: 40, noise: 0.08, heartbeat: true },
    rules: {
      strictBudgets: true,
      resupplyCostMult: 1.75,
      eventMult: 1.3,
      dustMult: 1.1,
      subsidenceMult: 1.15,
      contracts: false,           // Houston goes quiet
      heliumPlasma: false,
      xenoflora: false,
      sanity: true,
      lightCone: true,            // the 3D view is limited to a short cone of light
      hudGlitches: true,          // low sanity produces false readings and phantom alerts
      stressMult: 1.4,
      scienceMult: 1,
    },
    terms: { crisis: "!! SIGNAL !!", capcom: "CAPCOM (NO CARRIER)", morale: "Sanity", win: "You kept the lights on" },
  },
};

export const MODE_IDS = Object.keys(MODES);

/** Difficulty only scales how fast things go wrong and how much the crew consumes (kept from the original game). */
export const DIFFICULTIES = {
  facil: { id: "facil", name: "Easy", events: 0.7, consumption: 0.85, startParts: 90, desc: "Fewer crises, a little more slack in the budgets." },
  normal: { id: "normal", name: "Normal", events: 1, consumption: 1, startParts: 60, desc: "The intended experience." },
  dificil: { id: "dificil", name: "Hard", events: 1.4, consumption: 1.15, startParts: 45, desc: "More crises, thinner margins." },
};

export function getMode(id) {
  return MODES[id] ?? MODES.realista;
}

export function getDifficulty(id) {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}

/** The numbers the simulation actually uses: mode rules combined with the difficulty. */
export function resolveRules(modeId, difficultyId) {
  const m = getMode(modeId).rules, d = getDifficulty(difficultyId);
  return {
    ...m,
    eventMult: m.eventMult * d.events,
    consumptionMult: d.consumption,
    startParts: d.startParts,
  };
}

/** CSS custom properties for a mode, applied by the UI on <html>. */
export function modeCssVars(modeId) {
  const p = getMode(modeId).palette;
  return { "--bg": p.bg, "--panel": p.panel, "--accent": p.accent, "--ok": p.ok, "--warn": p.warn, "--bad": p.bad, "--text": p.text, "--grid": p.grid };
}

/**
 * Horror mode: what the HUD should show for a reading. With high sanity it is the truth;
 * as sanity drops, readings named in `state.hudGlitches` are replaced by false values.
 * Pure function: the simulation decides which glitches exist, the UI only asks here.
 */
export function displayedReading(state, field, trueValue) {
  if (!state.rules.hudGlitches) return { value: trueValue, fake: false };
  const g = state.hudGlitches.find((x) => x.field === field && x.until > state.t);
  return g ? { value: g.value, fake: true } : { value: trueValue, fake: false };
}
