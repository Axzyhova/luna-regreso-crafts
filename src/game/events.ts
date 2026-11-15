import cfg from "@/data/eventos.json";
import { addItem, addLog, diffCfg, isDay, isOn, hurt, notify, TIPOS, CYCLE, DAY_LEN, type Inv, type Sim, giveItem } from "./sim";
import { aliensEnabled, type World } from "./aliens";
import { spawnCapsule } from "./loot";

export type EventId = keyof typeof cfg.eventos;
export const EVENTOS = cfg.eventos as Record<EventId, { nombre: string; icono: string; aviso_s: number; dura_s: number; solo_dia: boolean; texto_aviso: string; texto_activo: string; realismo: string; radio_zona?: number; impactos?: number; radio_impacto?: number; dano_jugador?: number; dano_modulo?: number }>;
const IDS = Object.keys(cfg.eventos) as EventId[];
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function toast(s: Sim, text: string, t = 5) { s.toast = { text, t }; }

/** Text for the alert banner (with countdown), or null. */
export function eventBanner(s: Sim): { icono: string; texto: string; activo: boolean } | null {
  if (!s.event) return null;
  const e = EVENTOS[s.event.id as EventId];
  if (s.event.phase === "aviso") return { icono: e.icono, texto: e.texto_aviso.replace("{t}", String(Math.ceil(s.event.t))), activo: false };
  return { icono: e.icono, texto: `${e.texto_activo} (${Math.ceil(s.event.t)} s)`, activo: true };
}

function pickEvent(s: Sim, rnd: () => number): EventId | null {
  const dayLeft = isDay(s) ? DAY_LEN - (s.time % CYCLE) : 0;
  const options = IDS.filter((id) => { const e = EVENTOS[id]; return !e.solo_dia || dayLeft > e.aviso_s + e.dura_s; });
  return options.length ? options[Math.floor(rnd() * options.length)]! : null;
}

export function startEvent(s: Sim, id: EventId, w: World) {
  const e = EVENTOS[id];
  // Meteor zone: near the player or the base, inside the map.
  const near = w.rnd() < 0.5 ? w.player : w.hab;
  const r = e.radio_zona ?? 0;
  const x = Math.max(r, Math.min(w.w - r, near.x + (w.rnd() - 0.5) * 120));
  const y = Math.max(r, Math.min(w.h - r, near.y + (w.rnd() - 0.5) * 80));
  s.event = { id, phase: "aviso", t: e.aviso_s, x, y, hits: 0, maxDose: 0 };
  addLog(s, `ALERT ${e.icono} ${e.nombre}: ${e.texto_aviso.replace("{t}", String(e.aviso_s))}`);
}

/** Advance the natural-event scheduler. Returns meteor impacts for the scene to draw. */
export function stepEvents(s: Sim, dt: number, w: World): { x: number; y: number }[] {
  const impacts: { x: number; y: number }[] = [];
  s.impacts = s.impacts.map((i) => ({ ...i, t: i.t - dt })).filter((i) => i.t > 0);
  if (s.toast) { s.toast.t -= dt; if (s.toast.t <= 0) s.toast = null; }

  // Dusk warning in modes with aliens.
  const night = !isDay(s);
  if (aliensEnabled(s) && night && (s.time - dt) % CYCLE < DAY_LEN) toast(s, "🌒 Night falls: alien activity. Stay close to the light.", 7);

  if (!s.event) {
    if (s.countdown !== null) return impacts;
    s.nextEventT -= dt;
    if (s.nextEventT <= 0) {
      const id = pickEvent(s, w.rnd);
      s.nextEventT = cfg.cada_s[0]! + w.rnd() * (cfg.cada_s[1]! - cfg.cada_s[0]!);
      if (id) startEvent(s, id, w);
    }
    return impacts;
  }
  const ev = s.event;
  const e = EVENTOS[ev.id as EventId];
  ev.t -= dt;
  if (ev.phase === "aviso") {
    if (ev.t <= 0) { ev.phase = "activo"; ev.t = e.dura_s; addLog(s, `${e.icono} ${e.texto_activo}`); }
    return impacts;
  }
  if (ev.id === "meteoritos" || ev.id === "lluvia_androides") {
    const total = e.impactos ?? 0;
    const due = Math.floor(((e.dura_s - ev.t) / e.dura_s) * total);
    while (ev.hits < Math.min(total, due)) {
      ev.hits++;
      const a = w.rnd() * Math.PI * 2, rr = Math.sqrt(w.rnd()) * (e.radio_zona ?? 0);
      const p = { x: ev.x + Math.cos(a) * rr, y: ev.y + Math.sin(a) * rr };
      impacts.push(p); s.impacts.push({ ...p, t: 1.2 });
      const ri = e.radio_impacto ?? 0;
      if (dist(p.x, p.y, w.player.x, w.player.y) < ri && !w.inHabitat) { hurt(s, e.dano_jugador ?? 0, ev.id === "lluvia_androides" ? "was struck by a falling android" : "was hit by a micrometeorite"); if (s.suit.worn) s.suit.integrity = Math.max(0, s.suit.integrity - 15); addLog(s, `${e.icono} Direct impact near you!`); }
      for (const m of s.modules) {
        if (dist(p.x, p.y, m.x, m.y) < ri + Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2 && isOn(m)) {
          m.durabilidad = Math.max(0, m.durabilidad - (e.dano_modulo ?? 0));
          addLog(s, `${e.icono} Impact on ${TIPOS[m.tipo].nombre}.`);
        }
      }
      if (ev.id === "lluvia_androides") {
        s.androids.push({ id: s.nextAndroidId++, x: Math.round(p.x), y: Math.round(p.y), hp: 3, stun: 0 });
      }
    }
  }
  if (ev.t <= 0) {
    if (ev.id === "llamarada_solar") {
      if (ev.maxDose <= 40) s.stats.llamaradas++;
      if (ev.maxDose > 55) {
        s.rocket["Communications"] = Math.max(0, (s.rocket["Communications"] ?? 0) - 4);
        for (const m of s.modules) if (m.tipo === "panel" && isOn(m)) m.durabilidad = Math.max(0, m.durabilidad - 8);
        addLog(s, "☀️ Solar flare radiation damaged unshielded electronics! (-4% Communications, solar panels worn)");
        toast(s, "☀️ Solar flare nerfed Communications (-4%)!", 5);
      }
    }
    if (ev.id === "meteoritos") {
      spawnCapsule(s, ev.x, ev.y);
      spawnCave(s, ev.x + 14, ev.y + 8, w.rnd);
      addLog(s, "A supply capsule and a Meteor Cave entrance were left among the impact debris!");
    }
    addLog(s, `${e.nombre}: over.`);
    s.event = null;
  }
  return impacts;
}

const SPECIAL_CASES = [
  { id: "caso_sonda", title: "SOS Probe Signal", desc: "A crashed survey probe is pinging from afar. Reach it and press E to recover parts.", x: 644, y: 112, reward: { pieza_motor: 1, racion: 2, metal: 3 } },
  { id: "caso_crio", title: "Cryo-Vein Surge", desc: "A temporary cryo-fissure opened! Investigate (E) before it seals.", x: 210, y: 560, reward: { cristal_hielo: 3, hielo: 4, alga_lunar: 2 } },
  { id: "caso_anomalia", title: "Thermal Anomaly", desc: "Strange heat signature in the Scorch Fields. Scan it (E) for rare salvage.", x: 980, y: 140, reward: { titanio: 3, kits: 2, comida_caliente: 1 } },
  { id: "caso_suministros", title: "Orbital Drop Pod", desc: "An emergency food & medical pod landed. Collect it (E).", x: 95, y: 75, reward: { racion: 2, botiquin: 1, estimulante: 1 } },
];

/** Spawn and tick timed special expedition cases (not just base supervision). */
export function stepSpecialCases(s: Sim, dt: number, rnd: () => number) {
  if (s.specialCase) {
    s.specialCase.t -= dt;
    if (s.specialCase.t <= 0) {
      addLog(s, `⭐ Special case expired: ${s.specialCase.title}`);
      s.specialCase = null;
    }
    return;
  }
  if (s.countdown !== null) return;
  s.nextCaseT -= dt;
  if (s.nextCaseT <= 0) {
    s.nextCaseT = 105 + rnd() * 60;
    const c = SPECIAL_CASES[Math.floor(rnd() * SPECIAL_CASES.length)]!;
    s.specialCase = { id: c.id, title: c.title, desc: c.desc, x: c.x, y: c.y, reward: { ...c.reward }, t: 110 };
    addLog(s, `⭐ SPECIAL CASE: ${c.title} — ${c.desc}`);
    toast(s, `⭐ Special case on Map: ${c.title}`, 6);
  }
}

export function resolveSpecialCase(s: Sim) {
  const sc = s.specialCase;
  if (!sc) return false;
  for (const [k, n] of Object.entries(sc.reward)) giveItem(s, k as keyof Inv, n);
  s.casesDone++;
  s.sanity = Math.min(100, s.sanity + 10);
  addLog(s, `✔ Special case resolved (${sc.title}): ${Object.entries(sc.reward).map(([k, n]) => `+${n} ${k}`).join(", ")}`);
  notify(s, "mission", "Special Case Complete", sc.title);
  s.specialCase = null;
  return true;
}

export const CAVE_ALIENS: Record<string, { nombre: string; hp: number; dmg: number; desc: string; loot: Record<string, number> }> = {
  escarabajo_vacio: { nombre: "Void Beetle", hp: 6, dmg: 7, desc: "Carapace-armored subterranean alien drawn to meteor impacts.", loot: { titanio: 2, aleacion: 1, racion: 1 } },
  acechador_cristal: { nombre: "Crystal Lurker", hp: 7, dmg: 8, desc: "Silicate cave predator that ambushes explorers near relics.", loot: { cristal_hielo: 2, pieza_motor: 1 } },
  centinela_lunar: { nombre: "Lunar Sentinel", hp: 8, dmg: 9, desc: "Ancient subterranean guardian protecting rare gear caches.", loot: { aleacion: 2, comida_caliente: 1 } },
};

const CAVE_ALIEN_IDS = Object.keys(CAVE_ALIENS);
const RARE_CAVE_LOOT = ["pico_plasma", "armadura_lunar", "botas_gravedad"] as const;
const PERK_POOL = ["salto_gravedad", "escudo_bio", "vista_lunar", "mente_acero"] as const;

export function spawnCave(s: Sim, x: number, y: number, rnd: () => number = Math.random) {
  const alienType = CAVE_ALIEN_IDS[Math.floor(rnd() * CAVE_ALIEN_IDS.length)]!;
  const def = CAVE_ALIENS[alienType]!;
  const cave = { id: s.nextCaveId++, x: Math.round(x), y: Math.round(y), explored: false, chestOpened: false, alienHp: def.hp, alienMaxHp: def.hp, alienType, relicDone: false };
  s.caves.push(cave);
  return cave;
}

export function strikeCaveAlien(s: Sim, caveId: number, dmg: number): { killed: boolean; counterDmg: number } {
  const cave = s.caves.find((c) => c.id === caveId);
  if (!cave || cave.alienHp <= 0) return { killed: false, counterDmg: 0 };
  if (!s.creaturesSeen.includes(cave.alienType)) s.creaturesSeen.push(cave.alienType);
  cave.alienHp = Math.max(0, cave.alienHp - dmg);
  const def = CAVE_ALIENS[cave.alienType]!;
  if (cave.alienHp <= 0) {
    s.stats.aliens++;
    for (const [k, n] of Object.entries(def.loot)) giveItem(s, k as keyof Inv, n);
    addLog(s, `🕳 Defeated ${def.nombre} inside the cave! Looted: ${Object.entries(def.loot).map(([k, n]) => `+${n} ${k}`).join(", ")}`);
    return { killed: true, counterDmg: 0 };
  }
  hurt(s, def.dmg, `was injured by a ${def.nombre} in a meteor cave`);
  return { killed: false, counterDmg: def.dmg };
}

export function openCaveChest(s: Sim, caveId: number, rnd: () => number = Math.random): string[] {
  const cave = s.caves.find((c) => c.id === caveId);
  if (!cave || cave.chestOpened || cave.alienHp > 0) return [];
  cave.chestOpened = true;
  cave.explored = true;
  const rare = RARE_CAVE_LOOT[Math.floor(rnd() * RARE_CAVE_LOOT.length)]!;
  const got: string[] = [];
  giveItem(s, rare, 1); giveItem(s, "racion", 1); giveItem(s, "titanio", 2); // what doesn't fit stays at your feet
  got.push(rare, "racion", "titanio");
  addLog(s, `💎 Cave chest opened: found rare ${rare.replace(/_/g, " ")}!`);
  return got;
}

export function unlockCavePerk(s: Sim, caveId: number, rnd: () => number = Math.random): string | null {
  const cave = s.caves.find((c) => c.id === caveId);
  if (!cave || cave.relicDone) return null;
  cave.relicDone = true;
  cave.explored = true;
  const avail = PERK_POOL.filter((p) => !s.perks.includes(p));
  const pick = (avail.length ? avail : PERK_POOL)[Math.floor(rnd() * (avail.length || PERK_POOL.length))]!;
  if (!s.perks.includes(pick)) s.perks.push(pick);
  addLog(s, `✨ Relic calibrated! Unlocked superpower: ${pick.replace(/_/g, " ")}.`);
  notify(s, "achievement", "Superpower Unlocked", pick.replace(/_/g, " "));
  return pick;
}

/** Rogue androids from Android Drop events chase the player and drain durability if ignored. */
export function stepAndroids(s: Sim, dt: number, w: World) {
  for (const a of s.androids) {
    if (a.stun > 0) { a.stun -= dt; continue; }
    const d = dist(a.x, a.y, w.player.x, w.player.y);
    const k = Math.min(1, (22 * dt) / (d || 1));
    a.x += (w.player.x - a.x) * k;
    a.y += (w.player.y - a.y) * k;
    if (d < 10 && !w.inHabitat) hurt(s, 6 * dt, "was attacked by a rogue android");
  }
}

export function hitAndroid(s: Sim, px: number, py: number, dmg = 1) {
  let best: Sim["androids"][number] | null = null, bd = 18;
  for (const a of s.androids) { const d = dist(a.x, a.y, px, py); if (d < bd) { bd = d; best = a; } }
  if (!best) return null;
  best.hp -= dmg; best.stun = 0.5;
  const d = dist(best.x, best.y, px, py) || 1;
  best.x += ((best.x - px) / d) * 10; best.y += ((best.y - py) / d) * 10;
  if (best.hp <= 0) {
    s.androids = s.androids.filter((a) => a !== best);
    giveItem(s, "chatarra", 2);
    giveItem(s, "metal", 1);
    addLog(s, "🤖 Cleared rogue android: +2 Scrap, +1 Metal.");
  }
  return best;
}

/** Emerging operational problems that appear periodically during the mission. */
export function stepEmergingProblems(s: Sim, dt: number, rnd: () => number) {
  if (s.countdown !== null) return;
  s.problemT -= dt * diffCfg(s).eventos;
  if (s.problemT > 0) return;
  s.problemT = 85 + rnd() * 55;
  const roll = rnd();
  if (roll < 0.35) {
    for (const m of s.modules) if (m.tipo === "panel" && isOn(m)) m.durabilidad = Math.max(0, m.durabilidad - 10);
    addLog(s, "⚠ PROBLEM: Electrostatic lunar dust coated solar panels (-10% durability).");
    toast(s, "⚠ Problem: Dust on Solar Panels! Check Base (B)", 5);
  } else if (roll < 0.7) {
    const m = s.modules.find((x) => isOn(x) && x.tipo !== "habitat" && x.tipo !== "cofre");
    if (m) {
      m.activo = false;
      addLog(s, `⚠ PROBLEM: Power surge tripped ${TIPOS[m.tipo].nombre} OFF! Turn it back ON in Base (B).`);
      toast(s, `⚠ Surge tripped ${TIPOS[m.tipo].nombre} OFF!`, 5);
    }
  } else {
    s.battery = Math.max(0, s.battery - 12);
    addLog(s, "⚠ PROBLEM: Battery cell voltage drop (-12 power).");
    toast(s, "⚠ Problem: Battery voltage drop (-12 power)", 5);
  }
}
