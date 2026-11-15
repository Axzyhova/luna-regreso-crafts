import cfg from "@/data/efectos.json";
import { addLog, isDay, hurt, drinkWater, type Sim } from "./sim";
import { inLight, type World } from "./aliens";

export type EffectId = keyof typeof cfg.efectos;
export const EFECTOS = cfg.efectos as Record<EffectId, { nombre: string; icono: string; desc: string; velocidad: number; recoleccion: number; reparar?: number; salud_s?: number; o2_extra?: number; protege?: string; remedio: string }>;
export const UMBRALES = cfg.umbrales;
export const EQUIPO_MAX = cfg.equipo_max;
export const GEAR = ["traje_termico", "capa_reflectante", "escudo_radiacion"];
/** Items you use up from the inventory or the hotbar. Water is drunk from the suit's drink bag. */
export const CONSUMIBLES = ["botiquin", "estimulante", "agua"];

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const has = (s: Sim, item: string) => s.equip.includes(item);

/** Which negative states apply right now (pure: reads the sim, changes nothing). */
export function activeEffects(s: Sim, w: World, inShadow: boolean): EffectId[] {
  const out: EffectId[] = [];
  if (s.temp < UMBRALES.frio_temp && !has(s, "traje_termico")) out.push("frio");
  if (s.temp > UMBRALES.calor_temp && !has(s, "capa_reflectante")) out.push("calor");
  if (s.dose > UMBRALES.radiacion_dosis) out.push("radiacion");
  const dark = !isDay(s) || s.event?.id === "eclipse" && s.event.phase === "activo";
  const lit = w.inHabitat || inLight(s, w, w.player.x, w.player.y);
  const alienNear = s.aliens.some((a) => dist(a.x, a.y, w.player.x, w.player.y) < UMBRALES.miedo_radio);
  if (dark && !lit && (alienNear || s.abduction > 0 || inShadow)) out.push("miedo");
  if (s.fatigue > UMBRALES.cansancio) out.push("cansancio");
  return out;
}

/** Advance fatigue and radiation dose, apply health/O2 penalties, and refresh `s.effects`. */
export function stepEffects(s: Sim, dt: number, w: World, inShadow: boolean) {
  // Fatigue: grows while working outside, recovers inside the habitat.
  s.fatigue = w.inHabitat ? Math.max(0, s.fatigue - 4 * dt) : Math.min(100, s.fatigue + 0.25 * dt);
  // Radiation: only during an active solar flare, outside, and reduced by the regolith shield.
  const flare = s.event?.id === "llamarada_solar" && s.event.phase === "activo";
  if (flare && !w.inHabitat) s.dose = Math.min(100, s.dose + (has(s, "escudo_radiacion") ? 0.6 : 3) * dt);
  else s.dose = Math.max(0, s.dose - (w.inHabitat ? 2 : 0.4) * dt);
  if (flare && s.event) s.event.maxDose = Math.max(s.event.maxDose, s.dose);

  // Exposure: time spent with the suit in the blue (cold) or orange (hot) zone.
  // Health only starts dropping after a grace period, then faster the longer it lasts.
  const cold = s.temp < UMBRALES.frio_temp && !has(s, "traje_termico");
  const hot = s.temp > UMBRALES.calor_temp && !has(s, "capa_reflectante");
  s.coldT = cold ? s.coldT + dt : Math.max(0, s.coldT - 2 * dt);
  s.heatT = hot ? s.heatT + dt : Math.max(0, s.heatT - 2 * dt);

  const before = new Set(s.effects);
  const now = activeEffects(s, w, inShadow);
  for (const e of now) {
    const c = EFECTOS[e];
    const exposure = e === "frio" ? s.coldT : e === "calor" ? s.heatT : null;
    if (c.salud_s && exposure !== null) {
      const over = exposure - UMBRALES.gracia_s;
      if (over > 0) hurt(s, c.salud_s * Math.min(3, 1 + over / 10) * dt, e === "frio" ? "froze to death" : "overheated");
    } else if (c.salud_s) hurt(s, c.salud_s * dt, e === "radiacion" ? "got radiation sickness from a solar flare" : "succumbed to the elements");
    if (c.o2_extra && !w.inHabitat) s.suitO2 = Math.max(0, s.suitO2 - c.o2_extra * dt);
    if (!before.has(e)) addLog(s, `${c.icono} ${c.nombre}: ${c.remedio}`);
  }
  s.effects = now;
}

/** Combined multipliers the scene applies to movement, gathering cooldown and repair time. */
export function effectMods(s: Sim) {
  let speed = 1, gather = 1, repair = 1;
  for (const e of s.effects as EffectId[]) {
    const c = EFECTOS[e];
    if (!c) continue;
    speed *= c.velocidad; gather *= c.recoleccion; repair *= c.reparar ?? 1;
  }
  return { speed, gather, repair };
}

/** Equip or unequip a piece of gear (max slots). Returns a message for the player. */
export function toggleEquip(s: Sim, item: string): string {
  if (!GEAR.includes(item)) return "Not gear";
  if (s.equip.includes(item)) { s.equip = s.equip.filter((x) => x !== item); return "Gear removed"; }
  if ((s.inv as unknown as Record<string, number>)[item]! < 1) return "You don't have it";
  if (s.equip.length >= EQUIPO_MAX) return `Max ${EQUIPO_MAX} pieces of gear`;
  s.equip.push(item);
  addLog(s, `Equipped: ${item.replace(/_/g, " ")}.`);
  return "Equipped";
}

/** Use a consumable. Returns whether it worked and a short message for the player. */
export function useConsumable(s: Sim, item: string): { ok: boolean; msg: string } {
  const inv = s.inv as unknown as Record<string, number>;
  if (!CONSUMIBLES.includes(item)) return { ok: false, msg: "You can't use that" };
  if (item === "agua") return drinkWater(s);
  if ((inv[item] ?? 0) < 1) return { ok: false, msg: "You have none" };
  if (item === "botiquin") {
    if (s.health >= 100) return { ok: false, msg: "Your health is already full" };
    inv[item]! -= 1; s.health = Math.min(100, s.health + 40); addLog(s, "You used a medkit: +40 health."); return { ok: true, msg: "Health +40" };
  }
  inv[item]! -= 1; s.fatigue = 0; addLog(s, "You used a stimulant: fatigue is gone."); return { ok: true, msg: "Fatigue gone" };
}
export const consumeItem = (s: Sim, item: string): boolean => useConsumable(s, item).ok;
