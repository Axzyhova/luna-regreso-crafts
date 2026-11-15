/**
 * Throwing items on the ground and storing them in chests. Pure game logic (no Phaser), so it is tested directly.
 *
 * Rules that keep inventories honest:
 *  - nothing is ever lost or duplicated: every move removes exactly what it adds
 *  - water lives in the habitat tank, so it is poured out instead of thrown or stored
 *  - a chest has CHEST_SLOTS slots of CHEST_STACK each; deposits that don't fit leave the rest in the inventory
 */
import { addItem, addLog, type GroundItem, type Inv, type Module, type Sim } from "./sim";

export const CHEST_SLOTS = 24;
export const CHEST_STACK = 100;
/** How close a thrown stack must land to an existing one of the same item to merge into it. */
export const MERGE_RADIUS = 9;
export const PICKUP_RADIUS = 14;

const invOf = (s: Sim) => s.inv as unknown as Record<string, number>;
export const have = (s: Sim, key: string) => Math.floor(invOf(s)[key] ?? 0);

/** Slots used by the contents of a chest. */
export const chestUsed = (st: Record<string, number> | undefined) =>
  Object.values(st ?? {}).reduce((n, v) => n + Math.ceil(Math.floor(v) / CHEST_STACK), 0);

/** How many of `key` still fit in this chest. */
export function chestRoom(st: Record<string, number> | undefined, key: string): number {
  const cur = Math.floor(st?.[key] ?? 0);
  const freeSlots = CHEST_SLOTS - chestUsed(st);
  const spareInLastStack = cur > 0 && cur % CHEST_STACK !== 0 ? CHEST_STACK - (cur % CHEST_STACK) : 0;
  return spareInLastStack + freeSlots * CHEST_STACK;
}

// ---------------------------------------------------------------- ground items

/** Throw `n` of `key` on the ground at (x, y). Water is poured out. Returns how many left your inventory. */
export function dropItem(s: Sim, key: string, n: number, at: { x: number; y: number }): { dropped: number; msg: string } {
  const inv = invOf(s);
  const amount = key === "agua" ? Math.min(n, inv[key] ?? 0) : Math.min(Math.floor(n), have(s, key));
  if (!(amount > 0)) return { dropped: 0, msg: "You have none to drop" };
  inv[key] = (inv[key] ?? 0) - amount;
  if (key === "agua") { addLog(s, `You poured out ${Math.round(amount)} kg of water.`); return { dropped: amount, msg: `Poured out ${Math.round(amount)} kg of water` }; }
  const near = s.ground.find((g) => g.key === key && Math.hypot(g.x - at.x, g.y - at.y) <= MERGE_RADIUS);
  if (near) near.n += amount;
  else s.ground.push({ id: s.nextGroundId++, x: Math.round(at.x), y: Math.round(at.y), key, n: amount });
  return { dropped: amount, msg: `Dropped ${amount}` };
}

export const nearestGround = (s: Sim, x: number, y: number, r = PICKUP_RADIUS): GroundItem | undefined =>
  s.ground.map((g) => ({ g, d: Math.hypot(g.x - x, g.y - y) })).filter((e) => e.d <= r).sort((a, b) => a.d - b.d)[0]?.g;

/** Pick up a thrown stack (as much as fits). Returns how many you got. */
export function pickUpGround(s: Sim, id: number): number {
  const g = s.ground.find((x) => x.id === id);
  if (!g) return 0;
  let got = 0;
  while (got < g.n && addItem(s, g.key as keyof Inv, 1)) got++;
  g.n -= got;
  if (g.n <= 0) s.ground = s.ground.filter((x) => x !== g);
  return got;
}

// ---------------------------------------------------------------- chests

export const isChest = (m: Module | undefined): m is Module => !!m && m.tipo === "cofre";
export const chestByUid = (s: Sim, uid: number) => s.modules.find((m) => m.uid === uid && isChest(m));

/** Move up to `n` of `key` from the inventory into the chest. Returns how many moved. */
export function deposit(s: Sim, uid: number, key: string, n: number): number {
  const c = chestByUid(s, uid);
  if (!c || key === "agua") return 0;
  c.storage ??= {};
  const move = Math.min(Math.floor(n), have(s, key), chestRoom(c.storage, key));
  if (move <= 0) return 0;
  invOf(s)[key] = (invOf(s)[key] ?? 0) - move;
  c.storage[key] = (c.storage[key] ?? 0) + move;
  return move;
}

/** Move up to `n` of `key` from the chest into the inventory (as much as fits). Returns how many moved. */
export function withdraw(s: Sim, uid: number, key: string, n: number): number {
  const c = chestByUid(s, uid);
  if (!c?.storage) return 0;
  let moved = 0;
  const want = Math.min(Math.floor(n), Math.floor(c.storage[key] ?? 0));
  while (moved < want && addItem(s, key as keyof Inv, 1)) moved++;
  if (moved > 0) { c.storage[key] = (c.storage[key] ?? 0) - moved; if (c.storage[key]! <= 0) delete c.storage[key]; }
  return moved;
}

/** Deposit everything that isn't a tool/gear you'd want at hand. Returns the number of items moved. */
export const KEEP_ON_HAND = ["kits", "botiquin", "estimulante", "pala_mejorada", "pala_titanio", "baton", "traje_termico", "capa_reflectante", "escudo_radiacion", "cofre"];
export function depositAll(s: Sim, uid: number): number {
  let total = 0;
  for (const k of Object.keys(invOf(s))) if (k !== "agua" && !KEEP_ON_HAND.includes(k)) total += deposit(s, uid, k, have(s, k));
  return total;
}
export function withdrawAll(s: Sim, uid: number): number {
  const c = chestByUid(s, uid);
  let total = 0;
  for (const k of Object.keys(c?.storage ?? {})) total += withdraw(s, uid, k, Math.floor(c!.storage![k] ?? 0));
  return total;
}

/** Where something dropped from a menu lands: right next to the astronaut. */
export const dropPoint = (s: Sim) => ({ x: s.pos.x + 11, y: s.pos.y + 3 });
