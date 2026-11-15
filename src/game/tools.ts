/**
 * Gathering tools. Each tier of tool opens the next tier of resource (the survival-crafting ladder):
 *
 *   hands            → ice, regolith, scrap
 *   Better shovel    → + Frost crystals, Titanium ore            (cheap: 3 Metal)
 *   Titanium shovel  → + Alien alloy                             (needs Titanium from the Scorch Fields)
 *
 * and every tool is also faster and has a chance of an extra unit per hit, so owning one is always felt.
 * The module "Ice drill" is NOT a hand tool: it has to be placed in the crater.
 */
import type { Inv } from "./sim";

export interface ToolStats { key: string | null; name: string; tier: number; cooldown: number; bonusChance: number; blurb: string }

export const HANDS: ToolStats = { key: null, name: "Bare hands", tier: 0, cooldown: 0.5, bonusChance: 0, blurb: "1 unit per hit" };
/** Best tool first. */
export const TOOLS: ToolStats[] = [
  { key: "pala_titanio", name: "Titanium shovel", tier: 2, cooldown: 0.2, bonusChance: 0.6, blurb: "2.5× faster · 60% chance of +1 unit" },
  { key: "pala_mejorada", name: "Better shovel", tier: 1, cooldown: 0.33, bonusChance: 0.3, blurb: "1.5× faster · 30% chance of +1 unit" },
];

/** What you currently gather with: the best tool in your inventory. */
export function bestTool(inv: Partial<Inv>): ToolStats {
  const m = inv as Record<string, number>;
  return TOOLS.find((t) => (m[t.key!] ?? 0) >= 1) ?? HANDS;
}

/** Tool tier each kind of resource node needs. */
export const NODE_TIER: Record<string, number> = { hielo: 0, regolito: 0, chatarra: 0, cristal_hielo: 1, titanio: 1, aleacion: 2 };

export function tierName(tier: number) {
  return tier >= 2 ? "Titanium shovel" : tier === 1 ? "Better shovel" : "bare hands";
}

/** Can you mine this node with what you carry? Otherwise says what's missing. */
export function canMine(inv: Partial<Inv>, node: string): { ok: boolean; need?: string } {
  const need = NODE_TIER[node] ?? 0;
  return bestTool(inv).tier >= need ? { ok: true } : { ok: false, need: tierName(need) };
}

/** Result of one hit: how many units you get and the cooldown until the next hit (before fatigue). */
export function mineHit(inv: Partial<Inv>, rnd: () => number): { amount: number; cooldown: number; bonus: boolean; tool: ToolStats } {
  const tool = bestTool(inv);
  const bonus = rnd() < tool.bonusChance;
  return { amount: 1 + (bonus ? 1 : 0), cooldown: tool.cooldown, bonus, tool };
}
