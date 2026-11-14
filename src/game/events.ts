import cfg from "@/data/eventos.json";
import { addLog, isDay, isOn, TIPOS, CYCLE, DAY_LEN, type Sim } from "./sim";
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
  if (ev.id === "meteoritos") {
    const total = e.impactos ?? 0;
    const due = Math.floor(((e.dura_s - ev.t) / e.dura_s) * total);
    while (ev.hits < Math.min(total, due)) {
      ev.hits++;
      const a = w.rnd() * Math.PI * 2, rr = Math.sqrt(w.rnd()) * (e.radio_zona ?? 0);
      const p = { x: ev.x + Math.cos(a) * rr, y: ev.y + Math.sin(a) * rr };
      impacts.push(p); s.impacts.push({ ...p, t: 1.2 });
      const ri = e.radio_impacto ?? 0;
      if (dist(p.x, p.y, w.player.x, w.player.y) < ri && !w.inHabitat) { s.health = Math.max(0, s.health - (e.dano_jugador ?? 0)); addLog(s, "☄️ A micrometeorite hit you."); }
      for (const m of s.modules) {
        if (dist(p.x, p.y, m.x, m.y) < ri + Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2 && isOn(m)) {
          m.durabilidad = Math.max(0, m.durabilidad - (e.dano_modulo ?? 0));
          addLog(s, `☄️ Impact on ${TIPOS[m.tipo].nombre}.`);
        }
      }
    }
  }
  if (ev.t <= 0) {
    if (ev.id === "llamarada_solar" && ev.maxDose <= 40) s.stats.llamaradas++;
    if (ev.id === "meteoritos") { spawnCapsule(s, ev.x, ev.y); addLog(s, "A supply capsule was left among the impact debris."); }
    addLog(s, `${e.nombre}: over.`);
    s.event = null;
  }
  return impacts;
}
