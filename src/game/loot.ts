import cfg from "@/data/loot.json";
import { addLog, addItem, type Inv, type Sim } from "./sim";
import { ITEMS } from "./items";

export const RADIO_CAPSULA = cfg.radio_apertura;

export function spawnCapsule(s: Sim, x: number, y: number) {
  const c = { id: s.nextCapsuleId++, x: Math.round(x), y: Math.round(y) };
  s.capsules.push(c);
  return c;
}

/** Scatter the starting supply capsules away from the base (once per game). */
export function initCapsules(s: Sim, w: { w: number; h: number; hab: { x: number; y: number }; rnd: () => number }) {
  if (s.capsulesSpawned) return;
  s.capsulesSpawned = true;
  for (let i = 0; i < cfg.capsulas_iniciales; i++) {
    let x = 0, y = 0, tries = 0;
    do { x = 20 + w.rnd() * (w.w - 40); y = 20 + w.rnd() * (w.h - 40); tries++; } while (Math.hypot(x - w.hab.x, y - w.hab.y) < 90 && tries < 30);
    spawnCapsule(s, x, y);
  }
}

/** Weighted loot roll. */
export function rollLoot(rnd: () => number): { item: string; n: number } {
  const total = cfg.tabla.reduce((a, r) => a + r.peso, 0);
  let x = rnd() * total;
  for (const r of cfg.tabla) { x -= r.peso; if (x <= 0) return { item: r.item, n: r.min + Math.floor(rnd() * (r.max - r.min + 1)) }; }
  const last = cfg.tabla[cfg.tabla.length - 1]!;
  return { item: last.item, n: last.min };
}

export function nearestCapsule(s: Sim, x: number, y: number) {
  return s.capsules.find((c) => Math.hypot(c.x - x, c.y - y) < RADIO_CAPSULA);
}

/** Open a capsule: roll its loot into the inventory. Returns what was found. */
export function openCapsule(s: Sim, id: number, rnd: () => number) {
  const c = s.capsules.find((k) => k.id === id);
  if (!c) return [];
  s.capsules = s.capsules.filter((k) => k !== c);
  const found: { item: string; n: number }[] = [];
  for (let i = 0; i < cfg.tirada_por_capsula; i++) {
    const r = rollLoot(rnd);
    if (addItem(s, r.item as keyof Inv, r.n)) found.push(r);
  }
  s.stats.capsulas++;
  addLog(s, `Capsule opened: ${found.map((f) => `${f.n} ${ITEMS[f.item]?.nombre ?? f.item}`).join(", ") || "inventory full"}.`);
  return found;
}
