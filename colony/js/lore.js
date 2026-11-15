/**
 * lore.js — the welcome sequence and the story text.
 *
 * Four briefing screens, each with an illustration drawn as SVG in code (no image files):
 *   1. The real purpose      2. Crew transmissions      3. The landing site      4. Your first day
 * plus the crew of each mode, the lost-expedition logs of Horror mode and the endings.
 * Everything here is data and strings: ui.js puts it on screen.
 */
import { getMode } from "./gameModes.js";

// ───────────────────────────── SVG illustrations ─────────────────────────────
const svg = (w, h, body, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
/** Deterministic star field so the same screen always looks the same. */
function stars(w, h, n, seed = 7) {
  let s = seed, out = "";
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.3 + r() * 0.9).toFixed(2)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
  return out;
}

/** Round mission patch. The colours and the motto change with the mode. */
export function missionPatchSvg(modeId) {
  const m = getMode(modeId), p = m.palette;
  const motto = { realista: "IN SITU · IN TIME", fantastico: "PER ASPERA AD LUMEN", terrorifico: "KEEP THE LIGHTS ON" }[m.id];
  return svg(200, 200, `
    <defs><clipPath id="pc"><circle cx="100" cy="100" r="78"/></clipPath></defs>
    <circle cx="100" cy="100" r="96" fill="${p.panel}" stroke="${p.accent}" stroke-width="4"/>
    <circle cx="100" cy="100" r="78" fill="${p.bg}" stroke="${p.text}" stroke-width="1.5"/>
    <g clip-path="url(#pc)">${stars(200, 200, 40, 11)}
      <circle cx="146" cy="62" r="13" fill="#3b7bd6"/><path d="M137 60q6-8 14-2q-4 6-14 2z" fill="#4ee68a" opacity=".8"/>
      <path d="M22 150 Q60 118 100 132 T178 128 V180 H22z" fill="#8a8f9c"/>
      <path d="M22 160 Q70 138 110 150 T178 146 V180 H22z" fill="#5d6270"/>
      <ellipse cx="96" cy="150" rx="34" ry="9" fill="#05070d"/>
      <path d="M62 132 l8-46 l8 46z" fill="${p.accent}"/><rect x="66" y="80" width="8" height="8" fill="${p.warn}"/>
    </g>
    <path id="arcT" d="M30 100 A70 70 0 0 1 170 100" fill="none"/><path id="arcB" d="M26 104 A74 74 0 0 0 174 104" fill="none"/>
    <text font-family="monospace" font-size="11" font-weight="700" fill="${p.text}" letter-spacing="2"><textPath href="#arcT" startOffset="50%" text-anchor="middle">${m.codename.toUpperCase()}</textPath></text>
    <text font-family="monospace" font-size="8" fill="${p.accent}" letter-spacing="1.5"><textPath href="#arcB" startOffset="50%" text-anchor="middle">${motto}</textPath></text>`, `${m.codename} mission patch`);
}

/** Screen 1: an equation sheet over the lunar horizon — the game is built on real numbers. */
export function purposeSvg(modeId) {
  const p = getMode(modeId).palette;
  const lines = ["2 H₂O → 2 H₂ + O₂", "FeTiO₃ + H₂ → Fe + TiO₂ + H₂O", "Δv(Moon) = 2.38 km/s", "O₂ 21 kPa + N₂ 79 kPa", "−0.84 kg O₂ · person⁻¹ · day⁻¹"];
  return svg(400, 220, `
    <rect width="400" height="220" fill="${p.bg}"/>${stars(400, 150, 70, 3)}
    <path d="M0 170 Q100 140 200 158 T400 150 V220 H0z" fill="#7d8290"/><path d="M0 190 Q120 168 240 184 T400 176 V220 H0z" fill="#555a67"/>
    <rect x="34" y="26" width="212" height="118" rx="6" fill="${p.panel}" stroke="${p.accent}" stroke-width="1.5"/>
    ${lines.map((t, i) => `<text x="46" y="${50 + i * 20}" font-family="monospace" font-size="11" fill="${i % 2 ? p.text : p.ok}">${t}</text>`).join("")}
    <g transform="translate(300 96)"><rect x="-13" y="-6" width="26" height="34" rx="7" fill="#e8ecf5"/><circle cy="-16" r="13" fill="#e8ecf5"/><rect x="-9" y="-22" width="18" height="11" rx="5" fill="${p.accent}"/>
      <rect x="-22" y="-2" width="9" height="22" rx="4" fill="#cfd5e3"/><rect x="13" y="-2" width="9" height="22" rx="4" fill="#cfd5e3"/><rect x="-11" y="28" width="9" height="20" rx="3" fill="#cfd5e3"/><rect x="2" y="28" width="9" height="20" rx="3" fill="#cfd5e3"/></g>`, "Real equations over the lunar horizon");
}

/** Screen 2: the crew on the comms panel (one tile per person, drawn from their initials and colour). */
export function crewSvg(modeId) {
  const p = getMode(modeId).palette, crew = CREW[getMode(modeId).id];
  const tile = (c, i) => { const x = 14 + i * 96; return `
    <rect x="${x}" y="20" width="84" height="110" rx="6" fill="${p.panel}" stroke="${c.color}" stroke-width="2"/>
    <circle cx="${x + 42}" cy="58" r="20" fill="${c.color}" opacity=".25"/><circle cx="${x + 42}" cy="54" r="11" fill="${c.color}"/><path d="M${x + 22} 86 q20-22 40 0z" fill="${c.color}"/>
    <text x="${x + 42}" y="104" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="${p.text}">${c.name.split(" ").slice(-1)[0].toUpperCase()}</text>
    <text x="${x + 42}" y="118" text-anchor="middle" font-family="monospace" font-size="7" fill="${p.accent}">${c.agency}</text>`; };
  return svg(400, 150, `<rect width="400" height="150" fill="${p.bg}"/>${crew.map(tile).join("")}
    <path d="M14 140 h372" stroke="${p.grid}" stroke-width="1"/><path d="M14 140 l8-5 8 9 8-12 8 10 8-6 8 4" fill="none" stroke="${p.ok}" stroke-width="1.5"/>`, "Crew transmission panel");
}

/** Screen 3: cross-section of Shackleton Crater with the four zones the player will use. */
export function shackletonSvg(modeId) {
  const p = getMode(modeId).palette;
  const tag = (x, y, t, c) => `<text x="${x}" y="${y}" font-family="monospace" font-size="9" fill="${c}">${t}</text>`;
  return svg(400, 230, `
    <rect width="400" height="230" fill="${p.bg}"/>${stars(400, 90, 50, 5)}
    <circle cx="352" cy="34" r="12" fill="#3b7bd6"/><path d="M344 32q5-7 13-2q-4 6-13 2z" fill="#4ee68a" opacity=".8"/>
    <path d="M0 96 L70 70 L104 84 L210 92 L250 108 L300 168 L360 176 L400 150 V230 H0z" fill="#6f7482"/>
    <path d="M250 108 L300 168 L360 176 L400 150 V230 H250z" fill="#0a0d16"/>
    <path d="M70 70 L104 84 L96 60z" fill="${p.warn}" opacity=".9"/>
    <path d="M0 40 L96 60" stroke="${p.warn}" stroke-width="1" stroke-dasharray="3 3"/>
    <rect x="120" y="130" width="150" height="20" rx="10" fill="#0a0d16" stroke="${p.accent}" stroke-width="1" stroke-dasharray="4 3"/>
    <rect x="150" y="82" width="16" height="9" fill="${p.text}"/><rect x="170" y="80" width="10" height="11" fill="${p.accent}"/>
    <path d="M312 172l4-8 4 8z" fill="#bfe6ff"/><path d="M330 174l4-8 4 8z" fill="#bfe6ff"/>
    ${tag(6, 58, "1 PEAKS OF ETERNAL LIGHT · 88% sun", p.warn)}
    ${tag(112, 76, "2 ILMENITE PLAINS · 14-day night", p.text)}
    ${tag(258, 198, "3 SHADOWED CRATER · −173 °C · ICE", "#bfe6ff")}
    ${tag(124, 164, "4 LAVA TUBE · −20 °C · shielded", p.accent)}`, "Cross-section of Shackleton Crater with its four zones");
}

/** Screen 4: the three things to do on day one. */
export function firstDaySvg(modeId) {
  const p = getMode(modeId).palette;
  const card = (i, title, icon) => { const x = 12 + i * 130; return `
    <rect x="${x}" y="16" width="116" height="118" rx="8" fill="${p.panel}" stroke="${p.accent}" stroke-width="1.5"/>
    <circle cx="${x + 20}" cy="34" r="10" fill="${p.accent}"/><text x="${x + 20}" y="38" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="${p.bg}">${i + 1}</text>
    <g transform="translate(${x + 58} 78)">${icon}</g>
    <text x="${x + 58}" y="124" text-anchor="middle" font-family="monospace" font-size="9" fill="${p.text}">${title}</text>`; };
  const ice = `<path d="M-16 12 l8-26 l8 26z" fill="#bfe6ff"/><path d="M0 12 l7-18 l7 18z" fill="#8fc8ee"/><path d="M-22 12h44" stroke="${p.text}" stroke-width="2"/>`;
  const drop = `<path d="M0-20 C14-2 14 14 0 18 C-14 14 -14-2 0-20z" fill="#4ea1ff"/><rect x="-22" y="20" width="44" height="4" fill="${p.text}"/>`;
  const flask = `<path d="M-6-20h12v12l12 24h-36l12-24z" fill="none" stroke="${p.ok}" stroke-width="2.5"/><path d="M-12 8h24l4 8h-32z" fill="${p.ok}"/>`;
  return svg(400, 150, `<rect width="400" height="150" fill="${p.bg}"/>${card(0, "DIG ICE", ice)}${card(1, "MELT IT", drop)}${card(2, "BUILD A LAB", flask)}`, "The three tasks of the first day");
}

// ───────────────────────────── crew ─────────────────────────────
/** The crew is fiction. Each mode has its own voices; the roles map to the systems the player will run. */
export const CREW = {
  realista: [
    { id: "cdr", name: "Cmdr. Alex Rivera", role: "Commander", agency: "NASA", color: "#4ea1ff", line: "Welcome to Shackleton Base. Nothing here is free: every kilogram we use, we will have to make. I'll keep the priorities straight — you keep us alive." },
    { id: "isru", name: "Dr. Aiko Tanaka", role: "ISRU chemist", agency: "JAXA", color: "#4ee68a", line: "There is ice in the crater below us. Give me power and I will turn it into water, oxygen and propellant. Give me dust in my seals and I will give you leaks." },
    { id: "geo", name: "Jonas Weber", role: "Geotechnical engineer", agency: "ESA", color: "#f2b84f", line: "The ground looks solid. It is not. Dig in one place too long and it will take a module with it. Watch the stability layer — key 1." },
    { id: "cap", name: "Ana Ortega", role: "Flight Director (CapCom)", agency: "HOUSTON", color: "#b48cff", line: "Houston is with you, with a 1.3-second delay. I'll send contracts when science wants something. Fulfil them and I can fund your next resupply." },
  ],
  fantastico: [
    { id: "cdr", name: "Cmdr. Alex Rivera", role: "Commander", agency: "ODYSSEY", color: "#b48cff", line: "We came to build an outpost. I think we are going to find something older than outposts. Keep your eyes on the dark floor of the crater." },
    { id: "isru", name: "Dr. Aiko Tanaka", role: "Plasma chemist", agency: "JAXA", color: "#5ff0d0", line: "The spectrometer keeps showing helium lines down there, in crystals. If they are what I think, one of them could run this base for two days." },
    { id: "bio", name: "Dr. Imani Okafor", role: "Xenobotanist", agency: "ESA", color: "#ffd166", line: "My seedlings glow at night. They should not. They also make twice the oxygen. I have decided not to worry and to plant more." },
    { id: "cap", name: "Ana Ortega", role: "Odyssey Control", agency: "EARTH", color: "#4ea1ff", line: "Odyssey Control here. The whole world is watching your feed. Show us something wonderful — and please also keep the pressure at one atmosphere." },
  ],
  terrorifico: [
    { id: "cdr", name: "Cmdr. Alex Rivera", role: "Commander", agency: "NASA", color: "#35ff7a", line: "Shackleton Base is ours now. The last crew left everything running. They left their logs too. I have asked for them not to be read. Read them anyway." },
    { id: "isru", name: "Dr. Aiko Tanaka", role: "ISRU chemist", agency: "JAXA", color: "#c8ff5a", line: "The extractor logs show 400 hours of operation after the previous crew stopped answering. Someone kept feeding it ice. Keep the lights on down there." },
    { id: "geo", name: "Jonas Weber", role: "Geotechnical engineer", agency: "ESA", color: "#7dffb0", line: "The seismometer picks up footsteps in the lava tube. It is thermal cracking. It is always thermal cracking. Don't go below in the dark." },
    { id: "cap", name: "CapCom", role: "Flight Director", agency: "NO CARRIER", color: "#ff4040", line: "…ackleton, Houston. We read you thr— by five. Do not tr— the pressure gauge if you have been outsi— long. Say again, do not —" },
  ],
};

// ───────────────────────────── briefing ─────────────────────────────
/**
 * The four screens shown before a new game.
 * @returns {{id:string, title:string, svg:string, paragraphs:string[], bullets?:string[], transmissions?:{name:string, role:string, agency:string, color:string, line:string}[]}[]}
 */
export function buildBriefing(modeId) {
  const m = getMode(modeId);
  const opening = {
    realista: "This story is fiction. The engineering is not.",
    fantastico: "This story is a fable. The engineering under it is real.",
    terrorifico: "The fear is invented. The physics that can kill you here is not.",
  }[m.id];
  return [
    {
      id: "purpose", title: "WHY THIS MISSION IS REAL", svg: purposeSvg(modeId),
      paragraphs: [
        opening,
        "Every number you will manage — how much oxygen a person breathes, how water splits into hydrogen and oxygen, how charged dust ruins a solar panel, how the ground gives way when you dig too much — comes from NASA research and real lunar engineering.",
        "You will feel what an astronaut living on the Moon has to solve every day. When something fails, there will be a reason, and a way to engineer around it.",
      ],
      bullets: ["Each upgrade comes with a “Real NASA Science” card: the formula and where it comes from.", "Nothing is random punishment: every crisis has a cause you can see on the data layers."],
    },
    {
      id: "crew", title: `${m.codename.toUpperCase()} — CREW TRANSMISSIONS`, svg: crewSvg(modeId),
      paragraphs: ["Incoming transmissions from your crew. They will speak up again when their systems need you."],
      transmissions: CREW[m.id].map((c) => ({ name: c.name, role: c.role, agency: c.agency, color: c.color, line: c.line })),
    },
    {
      id: "site", title: "LANDING SITE: RIM OF SHACKLETON CRATER", svg: shackletonSvg(modeId),
      paragraphs: ["You have landed on the rim of Shackleton Crater, at the Moon's south pole. Four very different places are within reach, and you will need all of them:"],
      bullets: [
        "Peaks of Eternal Light — sunlit 88% of the time. Best power, least room, unstable slopes.",
        "Ilmenite Plains — flat ground for the base, but night lasts 14 Earth days.",
        "Permanently Shadowed Crater — −173 °C, never lit. The water ice is here.",
        "Lava tubes — somewhere below. Shielded and stable. You will have to find them first.",
      ],
    },
    {
      id: "firstday", title: "YOUR FIRST DAY: THREE THINGS", svg: firstDaySvg(modeId),
      paragraphs: ["Ignore everything else for now. The base has air, power and food for the first days. Today you only need to do this:"],
      bullets: [
        "1. Walk down to the crater floor and dig some ice by hand.",
        "2. Bring it back and melt it in the habitat console: that is your first water.",
        "3. Build a Laboratory next to the habitat. Science unlocks the machines that will do the digging for you.",
      ],
      footer: m.id === "terrorifico" ? "One more thing: get back inside before the Sun goes. Night here lasts two weeks." : "The lander's small fission unit keeps the habitat alive day and night. Everything else you build will need stored power when the 14-day night comes.",
    },
  ];
}

// ───────────────────────────── horror: the previous expedition ─────────────────────────────
/** Unlocked one by one as sanity falls (simulation.js pushes indexes into state.loreLogs). */
export const LOST_EXPEDITION_LOGS = [
  { day: 3, author: "Cmdr. H. Vasquez", text: "Base nominal. Okonkwo jokes that the crater is looking back at us. I told him craters don't have eyes. He said that is why it uses ours." },
  { day: 9, author: "Dr. L. Okonkwo", text: "Extractor 2 reports more water than the ice it mined. I recalibrated twice. The mass balance does not close. Something is being added." },
  { day: 14, author: "Cmdr. H. Vasquez", text: "First night. The pressure gauge in Module 3 read 0 kPa for six seconds while four of us were breathing in it. Logged as sensor fault. It was not a sensor fault." },
  { day: 17, author: "Eng. P. Sato", text: "I counted five suits on the rack tonight. We are four. I counted again in the morning and there were four. I am not going to count at night any more." },
  { day: 21, author: "Dr. L. Okonkwo", text: "The dust does not fall the way charged dust should. It gathers. It gathers where the light ends. Keep the towers on. KEEP THE TOWERS ON." },
  { day: 24, author: "Eng. P. Sato", text: "Vasquez went down to the tube to check the 'thermal cracking'. Her transponder says she is still walking. It has said that for three days." },
  { day: 27, author: "(unsigned)", text: "if you are reading this the readings are lying to you already. trust the mass. count the kilograms. the kilograms do not lie." },
  { day: 28, author: "Cmdr. H. Vasquez", text: "This is Vasquez. Day 28. I am fine. Everyone is fine. Open the lower airlock. Open the lower airlock. Open the lower airlock. Open —" },
];
export const unlockedLogs = (state) => state.loreLogs.map((i) => LOST_EXPEDITION_LOGS[i]).filter(Boolean);

// ───────────────────────────── crew chatter during play ─────────────────────────────
/** One-line reactions when something happens (keyed by alert code or milestone id). Falls back to the Realistic line. */
const CHATTER = {
  breach: { realista: "Tanaka: We're venting! Get parts to that module.", fantastico: "Okafor: The dome is hissing — my plants!", terrorifico: "Tanaka: It opened from the inside." },
  blackout: { realista: "Rivera: Grid's down. Shed everything but life support.", fantastico: "Rivera: Lights out. Even the seedlings went dark.", terrorifico: "Rivera: Don't move. Wait for the lights." },
  cme_warn: { realista: "Ortega: Solar storm inbound. Get everyone under shielding.", fantastico: "Ortega: The Sun is putting on a show. Watch it from inside.", terrorifico: "CapCom: …torm… do not look at the …" },
  soil: { realista: "Weber: That structure is on failing ground. Piles or sinter, now.", fantastico: "Weber: The ground is singing under Module 2. I don't like the song.", terrorifico: "Weber: It's hollow under there. It wasn't yesterday." },
  dust: { realista: "Tanaka: Panels are caked. Fire the dust shield if the grid can take the peak.", fantastico: "Tanaka: The dust is glowing on the panels. Pretty. Clean it.", terrorifico: "Tanaka: The dust has handprints in it." },
  water: { realista: "First water from lunar ice. That is the whole mission in a cup.", fantastico: "Okafor: Four-billion-year-old water. My plants will be honoured.", terrorifico: "Tanaka: It tastes of metal. They all said that, in the logs." },
  night: { realista: "Rivera: We made it through the night. Fourteen days on what we stored.", fantastico: "Rivera: Sunrise on the rim. I have never seen anything like it.", terrorifico: "Rivera: Light. Count heads. …Count them again." },
  suitless: { realista: "Rivera: Helmets off. Take a breath of air we made ourselves.", fantastico: "Okafor: Barefoot on lunar soil, under glowing leaves. Write that down.", terrorifico: "Rivera: Helmets off. If you hear breathing that isn't yours, put it back on." },
  tube_found: { realista: "Weber: Radar echo! There's a tube under the plains, big enough for a city.", fantastico: "Weber: A cathedral under our feet, waiting since the Moon was molten.", terrorifico: "Weber: The tube is there. So is something the radar calls 'four, walking'." },
};
export function crewLine(code, modeId) {
  const c = CHATTER[code];
  return c ? c[getMode(modeId).id] ?? c.realista : null;
}

// ───────────────────────────── endings ─────────────────────────────
export function endingText(state) {
  const mode = getMode(state.modeId).id;
  if (state.lost) return {
    title: mode === "terrorifico" ? "THE LIGHTS WENT OUT" : "OUTPOST LOST",
    text: mode === "terrorifico"
      ? "The next crew will find the base running, the extractor fed, and your logs on the console. They will be asked not to read them."
      : "The crew did not survive. On the Moon the margin is always thin: find which budget broke first — air, power, water or ground — and engineer it wider next time.",
  };
  if (state.scenario === "mars") return { title: "JEZERO CRATER, MARS", text: "A ship fuelled entirely with propellant made on the Moon has landed on Mars. The air here is CO₂: the same chemistry you learned, with one more reactor. Begin again." };
  if (state.scenario === "psyche") return { title: "16 PSYCHE", text: "You are anchored to the exposed core of a dead world. The ground is iron and nickel. Nothing weighs anything. Everything you build from here is made of asteroid." };
  if (state.crew.suitless) return { title: getMode(state.modeId).terms.win.toUpperCase(), text: "People are living on the Moon without space suits, breathing oxygen from lunar ice and eating food grown in lunar soil. The ship on the pad is next." };
  return null;
}

/** Short "did you know" lines for loading and pause screens. All real. */
export const FACTS = [
  "Lunar gravity is 16.5% of Earth's: leaving the Moon needs only 2.38 km/s, against 11.2 km/s from Earth.",
  "Shackleton Crater's floor has not seen sunlight for billions of years and stays near −173 °C.",
  "LCROSS (2009) crashed a rocket stage into a shadowed crater and found water in the plume.",
  "Apollo astronauts called lunar dust the biggest surprise of the missions: it wore through suit layers in days.",
  "A person needs about 0.84 kg of oxygen, 3.5 kg of water and 0.62 kg of dry food per day.",
  "NASA's Electrodynamic Dust Shield lifted lunar dust on the Moon's surface for the first time in 2025.",
  "In 2022 plants were grown in real Apollo regolith for the first time. They sprouted — and were stressed.",
  "Liquid hydrogen boils at −253 °C. Keeping it liquid for months is one of the hard problems of Mars missions.",
  "Lunar lava tubes can be hundreds of metres wide because of the low gravity.",
  "A nuclear thermal rocket is about twice as efficient as the best chemical engine.",
];
