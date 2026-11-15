import cfg from "@/data/efectos.json";
import { addLog, isDay, hurt, type Sim, drinkWater, diffCfg } from "./sim";
import { inLight, type World } from "./aliens";

export type EffectId = keyof typeof cfg.efectos;
export const EFECTOS = cfg.efectos as Record<EffectId, { nombre: string; icono: string; desc: string; velocidad: number; recoleccion: number; reparar?: number; salud_s?: number; o2_extra?: number; protege?: string; remedio: string }>;
export const UMBRALES = cfg.umbrales;
export const EQUIPO_MAX = cfg.equipo_max;
export const GEAR = ["traje_termico", "capa_reflectante", "escudo_radiacion", "armadura_lunar", "botas_gravedad"];
/** Items you use up from the inventory or the hotbar. Water is drunk from the suit's drink bag. */
export const CONSUMIBLES = ["botiquin", "estimulante", "racion", "comida_caliente", "papa_horneada", "pan", "galleta", "agua"];
const PSYCH_EFFECTS: EffectId[] = ["vertigo_gravedad", "aislamiento", "panico"];

export const PERKS: Record<string, { nombre: string; icono: string; desc: string }> = {
  salto_gravedad: { nombre: "Low-G Thrusters", icono: "🚀", desc: "+25% movement speed on the lunar surface." },
  escudo_bio: { nombre: "Bio-Regen Field", icono: "💚", desc: "Passive +0.4 HP/s regeneration even outside." },
  vista_lunar: { nombre: "Deep Scanner", icono: "🔭", desc: "+1 bonus gathering yield & wider fog reveal." },
  mente_acero: { nombre: "Astronaut Focus", icono: "🧘", desc: "-50% sanity drain from isolation and gravity." },
};

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
  if (s.psychEffect && s.psychEffect.t > 0) out.push(s.psychEffect.id as EffectId);
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
      // Easy mode gives a much longer grace and softer damage, so there is time to craft a thermal suit.
      const dc = diffCfg(s) as { frio_gracia?: number; frio_dano?: number } | undefined;
      const over = exposure - UMBRALES.gracia_s * (dc?.frio_gracia ?? 1);
      if (over > 0) hurt(s, c.salud_s * (dc?.frio_dano ?? 1) * Math.min(3, 1 + over / 20) * dt, e === "frio" ? "froze to death" : "overheated");
    } else if (c.salud_s) hurt(s, c.salud_s * dt, e === "radiacion" ? "got radiation sickness from a solar flare" : "succumbed to the elements");
    if (c.o2_extra && !w.inHabitat) s.suitO2 = Math.max(0, s.suitO2 - c.o2_extra * dt);
    if (!before.has(e)) { addLog(s, `${c.icono} ${c.nombre}: ${c.remedio}`); s.toast = { text: `${c.icono} ${c.nombre}! ${(c as { consecuencia?: string }).consecuencia ?? ""} — ${c.remedio}`, t: 5 }; }
  }
  if (s.perks.includes("escudo_bio") && s.health > 0) s.health = Math.min(100, s.health + 0.4 * dt);
  s.effects = now;
}

/**
 * Crew psychology & lunar gravity (0.165g) formula:
 * Sanity drains faster when far from base, in darkness, near aliens, or with low hydration/leaks.
 * Every psychCheckT seconds, a probabilistic formula rolls a random psychological/gravity effect.
 */
export function stepPsychology(s: Sim, dt: number, w: World, rnd: () => number) {
  const dHab = dist(w.player.x, w.player.y, w.hab.x, w.hab.y);
  const far = dHab > (UMBRALES.distancia_lejos ?? 340);
  const dark = !isDay(s) && !w.inHabitat && !inLight(s, w, w.player.x, w.player.y);
  if (w.inHabitat) {
    s.sanity = Math.min(100, s.sanity + 3.0 * dt);
    if (s.psychEffect) s.psychEffect.t = Math.max(0, s.psychEffect.t - 3 * dt);
  } else {
    const drain = ((far ? 0.38 : 0.08) + (dark ? 0.25 : 0) + (s.aliens.length ? 0.2 : 0) + (s.leaks.length ? 0.15 : 0) + (s.hydration < 30 ? 0.2 : 0)) * (s.perks.includes("mente_acero") ? 0.5 : 1);
    s.sanity = Math.max(0, s.sanity - drain * (s.effects.includes("aislamiento") ? 1.8 : 1) * dt); // isolation feeds on itself
  }
  if (s.psychEffect) {
    s.psychEffect.t -= dt;
    if (s.psychEffect.t <= 0) s.psychEffect = null;
  }
  s.psychCheckT -= dt;
  if (s.psychCheckT <= 0) {
    s.psychCheckT = 25 + rnd() * 15;
    if (!w.inHabitat && !s.psychEffect) {
      const p = Math.max(0, Math.min(0.75, 0.05 + Math.max(0, 75 - s.sanity) / 100 * 0.45 + (far ? 0.15 : 0) + (dark ? 0.1 : 0)));
      if (rnd() < p) {
        let pick = far && rnd() < 0.5 ? "vertigo_gravedad" : PSYCH_EFFECTS[Math.floor(rnd() * PSYCH_EFFECTS.length)]!;
        if (pick === "vertigo_gravedad" && s.equip.includes("botas_gravedad")) pick = "aislamiento";
        s.psychEffect = { id: pick, t: 20 };
        const ef = EFECTOS[pick];
        addLog(s, `${ef.icono} ${ef.nombre}: ${ef.desc}`);
      }
    }
  }
}

/** Combined multipliers the scene applies to movement, gathering cooldown and repair time. */
export function effectMods(s: Sim) {
  let speed = 1, gather = 1, repair = 1;
  for (const e of s.effects as EffectId[]) {
    const c = EFECTOS[e];
    if (!c) continue;
    speed *= c.velocidad; gather *= c.recoleccion; repair *= c.reparar ?? 1;
  }
  if (s.perks.includes("salto_gravedad")) speed *= 1.25;
  if (s.equip.includes("botas_gravedad")) speed *= 1.15;
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

/** Use a consumable from the inventory. */
export function consumeItem(s: Sim, item: string): boolean {
  if (item === "agua") return drinkWater(s).ok;
  const inv = s.inv as unknown as Record<string, number>;
  if (!CONSUMIBLES.includes(item) || (inv[item] ?? 0) < 1) return false;
  inv[item]! -= 1;
  if (item === "botiquin") { s.health = Math.min(100, s.health + 40); addLog(s, "You used a medkit: +40 health."); }
  if (item === "estimulante") { s.fatigue = 0; addLog(s, "You used a stimulant: fatigue is gone."); }
  if (item === "racion") {
    s.health = Math.min(100, s.health + 25);
    s.sanity = Math.min(100, s.sanity + 15);
    s.hydration = Math.min(100, s.hydration + 10);
    addLog(s, "🍱 You ate a Space ration: +25 health, +15 sanity.");
  }
  if (item === "comida_caliente") {
    s.health = Math.min(100, s.health + 45);
    s.sanity = Math.min(100, s.sanity + 25);
    s.hydration = Math.min(100, s.hydration + 15);
    s.coldT = 0;
    if (s.psychEffect && (s.psychEffect.id === "vertigo_gravedad" || s.psychEffect.id === "aislamiento")) s.psychEffect = null;
    addLog(s, "🍲 You ate a Hot meal: +45 health, +25 sanity, Cold & Vertigo cleared.");
  }
  const FARM_FOOD: Record<string, [number, number, number, string]> = { papa_horneada: [30, 15, 10, "🥔 Baked potato"], pan: [35, 15, 0, "🍞 Bread"], galleta: [15, 25, 0, "🍪 Space cookies"] };
  const ff = FARM_FOOD[item];
  if (ff) {
    s.health = Math.min(100, s.health + ff[0]); s.sanity = Math.min(100, s.sanity + ff[1]); s.hydration = Math.min(100, s.hydration + ff[2]);
    if (item === "papa_horneada") s.coldT = 0;
    addLog(s, `${ff[3]}: +${ff[0]} health, +${ff[1]} sanity.`);
  }
  return true;
}

const CONSUME_MSG: Record<string, string> = { botiquin: "Health +40", estimulante: "Fatigue gone", racion: "Health +25 · sanity +15", comida_caliente: "Health +45 · sanity +25 · warm again", papa_horneada: "Health +30 · sanity +15 · warm", pan: "Health +35 · sanity +15", galleta: "Health +15 · sanity +25" };
/** Use a consumable and say what happened, for the on-screen message. */
export function applyConsumable(s: Sim, item: string): { ok: boolean; msg: string } {
  if (item === "agua") return drinkWater(s);
  if (!CONSUMIBLES.includes(item)) return { ok: false, msg: "You can't use that" };
  const ok = consumeItem(s, item);
  return ok ? { ok, msg: CONSUME_MSG[item] ?? "Used" } : { ok, msg: "You have none" };
}
