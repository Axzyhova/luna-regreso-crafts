import cfg from "@/data/zonas.json";
import { addItem, addLog, hurt, notify, ZONAS, type Inv, type Sim } from "./sim";

/**
 * Alien Hive creatures. Unlike the night aliens, they exist in every mode (Realistic
 * included) but never leave the Hive zone: it's a place you choose to enter.
 */
const H = cfg.colmena;
const HIVE = ZONAS.find((z) => z.id === "hive")!;
const [hx, hy, hw, hh] = HIVE.rect as [number, number, number, number];
const inHive = (x: number, y: number) => x >= hx && y >= hy && x < hx + hw && y < hy + hh;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export interface Subzona {
  id: string;
  zona: string;
  nombre: string;
  tipo: "recurso" | "jefe";
  x: number;
  y: number;
  radio: number;
  recursos: string[];
  jefe?: string;
  enemigos?: number;
  desc: string;
}
export const SUBZONAS = (cfg.subzonas ?? []) as Subzona[];

export interface BossDef {
  id: string;
  nombre: string;
  zona: string;
  hp: number;
  velocidad: number;
  dano_s: number;
  vision: number;
  loot: Record<string, number>;
  desc: string;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  espectro_crio: {
    id: "espectro_crio",
    nombre: "Cryo Warden",
    zona: "Deep Glacial Rift (Frozen Basin)",
    hp: 8,
    velocidad: 24,
    dano_s: 9,
    vision: 120,
    loot: { cristal_hielo: 4, pieza_motor: 1, racion: 1 },
    desc: "Armored ice-zone guardian patrolling the Deep Glacial Rift.",
  },
  coloso_termico: {
    id: "coloso_termico",
    nombre: "Scorch Colossus",
    zona: "Far Scorch Caldera (Scorch Fields)",
    hp: 10,
    velocidad: 22,
    dano_s: 11,
    vision: 125,
    loot: { titanio: 4, pieza_motor: 1, comida_caliente: 1 },
    desc: "Superheated sentinel guarding the richest Titanium & engine-part cache.",
  },
  matriarca_colmena: {
    id: "matriarca_colmena",
    nombre: "Hive Matriarch",
    zona: "Hive Matriarch Lair (Alien Hive)",
    hp: 12,
    velocidad: 26,
    dano_s: 12,
    vision: 140,
    loot: { aleacion: 4, racion: 2, pieza_motor: 1 },
    desc: "Apex Hive boss guarding the far SE Alloy & Ration cache.",
  },
};

export function stepHive(s: Sim, dt: number, player: { x: number; y: number }, rnd: () => number) {
  while (s.hive.length < H.max) s.hive.push({ id: s.nextHiveId++, x: hx + 40 + rnd() * (hw - 80), y: hy + 40 + rnd() * (hh - 80), hp: H.vida, stun: 0 });
  const playerIn = inHive(player.x, player.y);
  if (playerIn && !s.creaturesSeen.includes("criatura_colmena")) s.creaturesSeen.push("criatura_colmena");
  for (const c of s.hive) {
    if (c.stun > 0) { c.stun -= dt; continue; }
    const d = dist(c.x, c.y, player.x, player.y);
    let tx: number, ty: number, v = H.velocidad;
    if (playerIn && d < H.vision) { tx = player.x; ty = player.y; }
    else { tx = c.x + Math.sin(s.time * 0.7 + c.id) * 20; ty = c.y + Math.cos(s.time * 0.5 + c.id * 2) * 20; v *= 0.35; }
    const k = Math.min(1, (v * dt) / (Math.hypot(tx - c.x, ty - c.y) || 1));
    const nx = c.x + (tx - c.x) * k, ny = c.y + (ty - c.y) * k;
    if (inHive(nx, ny)) { c.x = nx; c.y = ny; }
    if (playerIn && d < 9) hurt(s, H.dano_s * dt, "was mauled in the Alien Hive");
  }
}

/** Strike the nearest hive creature. Killing one drops Alien alloy. */
export function hitHive(s: Sim, px: number, py: number, dmg = 1) {
  let best: Sim["hive"][number] | null = null, bd = 16;
  for (const c of s.hive) { const d = dist(c.x, c.y, px, py); if (d < bd) { bd = d; best = c; } }
  if (!best) return null;
  best.hp -= dmg; best.stun = 0.6;
  const d = dist(best.x, best.y, px, py) || 1;
  best.x += ((best.x - px) / d) * 12; best.y += ((best.y - py) / d) * 12;
  if (best.hp <= 0) {
    s.hive = s.hive.filter((c) => c !== best);
    s.stats.aliens++;
    if (addItem(s, "aleacion", 1)) addLog(s, "You drove off a hive creature: +1 Alien alloy.");
  }
  return best;
}

/** Ensure undefeated far-zone bosses are spawned at their subzones. */
export function initBosses(s: Sim) {
  for (const sz of SUBZONAS) {
    if (!sz.jefe || s.bossesDefeated.includes(sz.jefe) || s.bosses.some((b) => b.tipo === sz.jefe)) continue;
    const def = BOSS_DEFS[sz.jefe];
    if (!def) continue;
    s.bosses.push({ id: sz.jefe, tipo: sz.jefe, x: sz.x, y: sz.y, hp: def.hp, maxHp: def.hp, stun: 0, homeX: sz.x, homeY: sz.y });
  }
}

export function stepBosses(s: Sim, dt: number, player: { x: number; y: number }) {
  initBosses(s);
  for (const b of s.bosses) {
    const def = BOSS_DEFS[b.tipo];
    if (!def) continue;
    if (b.stun > 0) { b.stun -= dt; continue; }
    const d = dist(b.x, b.y, player.x, player.y);
    if (d < def.vision && !s.creaturesSeen.includes(b.tipo)) {
      s.creaturesSeen.push(b.tipo);
      addLog(s, `⚠ Boss spotted: ${def.nombre} (${def.zona})`);
    }
    const tx = d < def.vision ? player.x : b.homeX + Math.sin(s.time * 0.6) * 28;
    const ty = d < def.vision ? player.y : b.homeY + Math.cos(s.time * 0.5) * 28;
    const v = d < def.vision ? def.velocidad : def.velocidad * 0.4;
    const k = Math.min(1, (v * dt) / (dist(b.x, b.y, tx, ty) || 1));
    const nx = b.x + (tx - b.x) * k, ny = b.y + (ty - b.y) * k;
    if (dist(nx, ny, b.homeX, b.homeY) <= 105) { b.x = nx; b.y = ny; }
    if (d < 12) hurt(s, def.dano_s * dt, `was defeated by ${def.nombre}`);
  }
}

export function hitBoss(s: Sim, px: number, py: number, dmg = 1) {
  let best: Sim["bosses"][number] | null = null, bd = 20;
  for (const b of s.bosses) { const d = dist(b.x, b.y, px, py); if (d < bd) { bd = d; best = b; } }
  if (!best) return null;
  best.hp -= dmg; best.stun = 0.55;
  const d = dist(best.x, best.y, px, py) || 1;
  best.x += ((best.x - px) / d) * 10; best.y += ((best.y - py) / d) * 10;
  if (best.hp <= 0) {
    const def = BOSS_DEFS[best.tipo];
    s.bosses = s.bosses.filter((b) => b !== best);
    if (!s.bossesDefeated.includes(best.tipo)) s.bossesDefeated.push(best.tipo);
    s.stats.aliens++;
    if (def) {
      for (const [k, n] of Object.entries(def.loot)) addItem(s, k as Inv[keyof Inv] extends number ? keyof Inv : never, n);
      addLog(s, `🏆 Defeated ${def.nombre}! Looted: ${Object.entries(def.loot).map(([k, n]) => `+${n} ${k}`).join(", ")}`);
      notify(s, "achievement", "Boss Defeated", def.nombre);
    }
  }
  return best;
}

/** Track when the player enters any dedicated resource land or far boss subzone. */
export function checkSubzoneVisit(s: Sim, x: number, y: number): Subzona | null {
  for (const sz of SUBZONAS) {
    if (dist(x, y, sz.x, sz.y) <= sz.radio) {
      if (!s.subzonesVisited.includes(sz.id)) {
        s.subzonesVisited.push(sz.id);
        addLog(s, `📍 Discovered ${sz.nombre}: ${sz.desc}`);
      }
      return sz;
    }
  }
  return null;
}
