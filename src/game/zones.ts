import cfg from "@/data/zonas.json";
import { addItem, addLog, hurt, ZONAS, type Sim } from "./sim";

/**
 * Alien Hive creatures. Unlike the night aliens, they exist in every mode (Realistic
 * included) but never leave the Hive zone: it's a place you choose to enter.
 */
const H = cfg.colmena;
const HIVE = ZONAS.find((z) => z.id === "hive")!;
const [hx, hy, hw, hh] = HIVE.rect as [number, number, number, number];
const inHive = (x: number, y: number) => x >= hx && y >= hy && x < hx + hw && y < hy + hh;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export function stepHive(s: Sim, dt: number, player: { x: number; y: number }, rnd: () => number) {
  while (s.hive.length < H.max) s.hive.push({ id: s.nextHiveId++, x: hx + 40 + rnd() * (hw - 80), y: hy + 40 + rnd() * (hh - 80), hp: H.vida, stun: 0 });
  const playerIn = inHive(player.x, player.y);
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
