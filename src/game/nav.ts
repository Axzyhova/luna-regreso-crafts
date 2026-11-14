import type { Sim } from "./sim";
import { effectMods } from "./effects";

/** World px per in-game meter (the astronaut is ~4 px tall). */
export const PX_PER_M = 4;
const WALK_PX_S = 60;

export const NAV_LABEL: Record<string, string> = {
  fuga: "Fuga", hielo: "Hielo del cráter", base: "Hábitat", cohete: "Cohete", capsula: "Cápsula de suministro",
  alien: "¡Alien cerca!", jefe: "¡Nodriza!", meteoritos: "Zona de impactos",
};
const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

export interface NavTarget { k: string; label: string; dx: number; dy: number; m: number; deg: number; dir: string; warn: boolean }

function toTarget(r: { k: string; dx: number; dy: number }, warn = false): NavTarget {
  const deg = (Math.atan2(r.dx, -r.dy) * 180) / Math.PI; // 0° = north (up), clockwise
  return { k: r.k, label: NAV_LABEL[r.k] ?? r.k, dx: r.dx, dy: r.dy, m: Math.round(Math.hypot(r.dx, r.dy) / PX_PER_M), deg, dir: DIRS[(Math.round(((deg + 360) % 360) / 45)) % 8]!, warn };
}

/** What the current main mission wants you to walk to. */
export function missionKind(s: Sim): string {
  switch (s.quest.main) {
    case 0: return s.leaks.length ? "fuga" : "base";
    case 1: return "hielo";
    case 2: return "base";
    default: return "cohete";
  }
}

const nearest = (s: Sim, kinds: string[]) =>
  s.radar.filter((r) => kinds.includes(r.k)).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy))[0];

/**
 * GPS-style guidance: the main instruction is the mission target; "y luego" is a nearby
 * threat (if any) or the closest supply capsule. ETA uses the current walking speed.
 */
export function navigation(s: Sim) {
  const kind = missionKind(s);
  const main = nearest(s, [kind]);
  const threat = nearest(s, ["jefe", "meteoritos", "alien"]);
  const threatNear = threat && Math.hypot(threat.dx, threat.dy) < 140 ? toTarget(threat, true) : null;
  const cap = nearest(s, ["capsula"]);
  const then = threatNear ?? (cap ? toTarget(cap) : null);
  const primary = main ? toTarget(main) : null;
  const speed = WALK_PX_S * effectMods(s).speed;
  const etaS = primary ? Math.round((primary.m * PX_PER_M) / speed) : 0;
  return { primary, then, etaS };
}
