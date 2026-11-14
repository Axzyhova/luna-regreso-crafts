import cfg from "@/data/aliens.json";
import { addLog, isDay, isOn, diffCfg, modeCfg, SUBSISTEMAS, TIPOS, type Alien, type AlienTipo, type LeakTarget, type Sim } from "./sim";

/** World positions the alien AI needs; the Phaser scene owns them. */
export interface World { player: { x: number; y: number }; inHabitat: boolean; hab: { x: number; y: number }; rocket: { x: number; y: number }; w: number; h: number; rnd: () => number }
export type AlienEvent = { type: "leak"; target: LeakTarget } | { type: "abducted" };

export const ALIENS = cfg;
const T = cfg.tipos;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export const aliensEnabled = (s: Sim) => modeCfg(s).aliens;
const spawnCfg = (s: Sim) => (s.mode === "terrorifico" ? cfg.spawn.terrorifico : cfg.spawn.fantastico);

/** Light points: lit tower lamps (need battery) and the habitat. */
export function lights(s: Sim, w: World) {
  const pts = s.modules.filter((m) => m.tipo === "torre_luz" && isOn(m) && s.battery > 0).map((m) => ({ x: m.x, y: m.y }));
  pts.push(w.hab);
  return pts;
}
export const inLight = (s: Sim, w: World, x: number, y: number) => lights(s, w).some((p) => dist(p.x, p.y, x, y) < cfg.luz_radio);

/** Where a saboteur heads to for each target. */
export function sabotagePoint(target: LeakTarget, w: World) {
  return target === "habitat" ? { x: w.hab.x, y: w.hab.y - 12 } : { x: w.rocket.x + (target === "lh2" ? -25 : 25), y: w.rocket.y };
}

export function spawnAlien(s: Sim, w: World, tipo: AlienTipo): Alien {
  const side = Math.floor(w.rnd() * 4);
  const r = w.rnd();
  const pos = tipo === "nodriza" ? { x: w.rocket.x, y: w.rocket.y - 70 }
    : side === 0 ? { x: r * w.w, y: 4 } : side === 1 ? { x: w.w - 4, y: r * w.h } : side === 2 ? { x: r * w.w, y: w.h - 4 } : { x: 4, y: r * w.h };
  const targets: LeakTarget[] = ["habitat", "lh2", "lox"];
  const a: Alien = { id: s.nextAlienId++, tipo, ...pos, hp: T[tipo].vida, stun: 0, target: tipo === "saboteador" ? targets[Math.floor(w.rnd() * 3)] : undefined };
  s.aliens.push(a);
  if (!s.alienSeen.includes(tipo)) { s.alienSeen.push(tipo); addLog(s, T[tipo].consejo); }
  return a;
}

function pickTipo(rnd: () => number): AlienTipo {
  const pool = (["abductor", "rastreador", "saboteador"] as const).flatMap((t) => Array(T[t].peso).fill(t) as AlienTipo[]);
  return pool[Math.floor(rnd() * pool.length)]!;
}

/** Move toward (tx, ty) unless the next step would enter a light. Returns distance left. */
function moveTo(s: Sim, w: World, a: Alien, tx: number, ty: number, speed: number, dt: number) {
  const d = dist(a.x, a.y, tx, ty);
  if (d < 0.5) return d;
  const k = Math.min(1, (speed * dt) / d);
  const nx = a.x + (tx - a.x) * k, ny = a.y + (ty - a.y) * k;
  if (!inLight(s, w, nx, ny) || inLight(s, w, a.x, a.y)) { a.x = nx; a.y = ny; }
  return dist(a.x, a.y, tx, ty);
}

/** The module a tracker is drawn to: the closest one that is ON and consuming energy (heat). */
export function trackerTarget(s: Sim, a: Alien) {
  let best: Sim["modules"][number] | undefined, bd = Infinity;
  for (const m of s.modules) {
    if (!isOn(m) || TIPOS[m.tipo].energia >= 0 || m.tipo === "torre_luz") continue;
    const d = dist(a.x, a.y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Towers lit within reach of the rocket reduce the mothership's damage. */
export function towersNearRocket(s: Sim, w: World) {
  return s.modules.filter((m) => m.tipo === "torre_luz" && isOn(m) && s.battery > 0 && dist(m.x, m.y, w.rocket.x, w.rocket.y) < T.nodriza.radio_torres).length;
}

export function stepAliens(s: Sim, dt: number, w: World): AlienEvent[] {
  const ev: AlienEvent[] = [];
  if (!aliensEnabled(s)) { s.aliens = []; s.abduction = 0; return ev; }
  const night = !isDay(s);
  // Dawn: the creatures flee (the mothership only leaves when the countdown ends).
  if (!night && s.aliens.some((a) => a.tipo !== "nodriza")) {
    s.aliens = s.aliens.filter((a) => a.tipo === "nodriza");
    addLog(s, "Amanece: los aliens huyen de la luz del Sol.");
  }
  if (s.countdown === null) s.aliens = s.aliens.filter((a) => a.tipo !== "nodriza");
  // Spawning
  const sc = spawnCfg(s);
  if (night && s.aliens.filter((a) => a.tipo !== "nodriza").length < sc.max) {
    s.alienT -= dt * diffCfg(s).eventos * s.eventScale;
    if (s.alienT <= 0) { spawnAlien(s, w, pickTipo(w.rnd)); s.alienT = sc.cada_s * (0.7 + w.rnd() * 0.6); }
  }
  if (s.countdown !== null && !s.aliens.some((a) => a.tipo === "nodriza")) spawnAlien(s, w, "nodriza");

  let abducting = false;
  for (const a of [...s.aliens]) {
    if (a.stun > 0) { a.stun -= dt; continue; }
    const v = (a.tipo === "nodriza" ? 0 : T[a.tipo].velocidad) * sc.velocidad;
    if (a.tipo === "abductor") {
      const safe = w.inHabitat || inLight(s, w, w.player.x, w.player.y);
      if (safe) continue;
      const d = moveTo(s, w, a, w.player.x, w.player.y, v, dt);
      if (d < T.abductor.rango) {
        abducting = true;
        s.abduction = Math.min(100, s.abduction + (100 / T.abductor.abduccion_s) * dt);
        if (s.abduction >= 100) {
          ev.push({ type: "abducted" });
          s.abduction = 0;
          s.aliens = s.aliens.filter((x) => x !== a);
          addLog(s, "Un abductor te llevó. Despiertas en el hábitat, aturdido.");
        }
      }
    } else if (a.tipo === "rastreador") {
      const m = trackerTarget(s, a);
      if (!m) { moveTo(s, w, a, w.player.x, w.player.y, v * 0.4, dt); continue; }
      const d = moveTo(s, w, a, m.x, m.y, v, dt);
      if (d < T.rastreador.rango + Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2) {
        const was = m.durabilidad;
        m.durabilidad = Math.max(0, m.durabilidad - T.rastreador.dano_modulo_s * dt);
        if (was > 0 && m.durabilidad === 0) addLog(s, `Un rastreador inutilizó: ${TIPOS[m.tipo].nombre}.`);
      }
    } else if (a.tipo === "saboteador" && a.target) {
      const p = sabotagePoint(a.target, w);
      if (moveTo(s, w, a, p.x, p.y, v, dt) < 6) {
        ev.push({ type: "leak", target: a.target });
        s.aliens = s.aliens.filter((x) => x !== a);
      }
    } else if (a.tipo === "nodriza" && s.countdown !== null) {
      const red = Math.max(0.1, 1 - towersNearRocket(s, w) * T.nodriza.reduccion_por_torre);
      const sub = SUBSISTEMAS[Math.floor(s.time / 2) % SUBSISTEMAS.length]!;
      s.rocket[sub.id] = Math.max(0, (s.rocket[sub.id] ?? 0) - T.nodriza.dano_cohete_s * red * dt);
    }
  }
  if (!abducting) s.abduction = Math.max(0, s.abduction - 25 * dt);
  return ev;
}

/** Tool strike on the nearest alien in range. Returns the alien hit, if any. */
export function hitAlien(s: Sim, px: number, py: number): Alien | null {
  let best: Alien | null = null, bd = Infinity;
  for (const a of s.aliens) {
    const reach = a.tipo === "nodriza" ? cfg.golpe.rango * 2.5 : cfg.golpe.rango; // the mothership hovers above the rocket
    const d = dist(a.x, a.y, px, py);
    if (d < reach && d < bd) { bd = d; best = a; }
  }
  if (!best) return null;
  best.hp -= 1;
  best.stun = best.tipo === "nodriza" ? 1.5 : cfg.golpe.aturdir_s;
  if (best.tipo !== "nodriza") {
    const d = dist(best.x, best.y, px, py) || 1;
    best.x += ((best.x - px) / d) * cfg.golpe.empuje; best.y += ((best.y - py) / d) * cfg.golpe.empuje;
  }
  if (best.hp <= 0) {
    s.aliens = s.aliens.filter((a) => a !== best);
    addLog(s, best.tipo === "nodriza" ? "¡Derribaste la Nodriza!" : `Ahuyentaste a un ${T[best.tipo].nombre.toLowerCase()}.`);
  }
  return best;
}
