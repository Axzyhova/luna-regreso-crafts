import type { Sim } from "./sim";

export type ToolId = "pala" | "pico" | "cortador";
export const MAX_LVL = 5;
export const TOOLS: Record<ToolId, { nombre: string; materiales: string[]; desc: string }> = {
  pala: { nombre: "Pala", materiales: ["hielo", "regolito"], desc: "Cava hielo y regolito." },
  pico: { nombre: "Pico", materiales: ["ilmenita", "silicio"], desc: "Rompe rocas duras: ilmenita y silicio." },
  cortador: { nombre: "Cortador", materiales: ["chatarra"], desc: "Corta chatarra de los restos." },
};
export const toolFor = (material: string) => (Object.keys(TOOLS) as ToolId[]).find((t) => TOOLS[t].materiales.includes(material))!;
export const xpNeeded = (lvl: number) => 8 * lvl;
/** Seconds between hits: faster at higher level. */
export const toolCooldown = (lvl: number) => Math.max(0.15, 0.6 - 0.1 * (lvl - 1));
/** Chance of an extra unit per hit. */
export const bonusChance = (lvl: number) => 0.12 * (lvl - 1);

export function createTools() {
  return {
    pala: { nivel: 1, xp: 0, tiene: true },
    pico: { nivel: 1, xp: 0, tiene: false },
    cortador: { nivel: 1, xp: 0, tiene: true },
  } as Record<ToolId, { nivel: number; xp: number; tiene: boolean }>;
}

/** Gain XP with a tool; returns true if it leveled up. */
export function gainXp(s: Sim, id: ToolId, n = 1) {
  const t = s.tools[id];
  if (t.nivel >= MAX_LVL) return false;
  t.xp += n;
  if (t.xp >= xpNeeded(t.nivel)) { t.xp = 0; t.nivel += 1; return true; }
  return false;
}
/** Crafting an upgrade/unlock: first gives the tool, then +1 level. */
export function upgradeTool(s: Sim, id: ToolId) {
  const t = s.tools[id];
  if (!t.tiene) { t.tiene = true; return; }
  t.nivel = Math.min(MAX_LVL, t.nivel + 1); t.xp = 0;
}
