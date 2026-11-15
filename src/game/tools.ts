/**
 * Gathering tools: the single table every other part of the game reads (mining, the inventory panel, the guide).
 * Each tier of tool opens the next tier of resource (the survival-crafting ladder):
 *
 *   hands            → ice, regolith, scrap, lunar algae
 *   Better shovel    → + Frost crystals, Titanium ore            (cheap: 3 Metal)
 *   Titanium shovel  → + Alien alloy                             (needs Titanium from the Scorch Fields)
 *   Plasma cutter    → everything, fastest                        (rare: meteor cave chests)
 *
 * and every tool gathers more per hit and swings faster, so owning one is always felt.
 * The module "Ice drill" is NOT a hand tool: it has to be placed in the crater.
 */
import type { Inv } from "./sim";

export interface ToolStats { key: string | null; name: string; tier: number; yield: number; cooldown: number; blurb: string }

const blurb = (y: number, cd: number) => `${y} unit${y === 1 ? "" : "s"} per hit${cd < 0.5 ? ` · ${(0.5 / cd).toFixed(1)}× faster` : ""}`;
const tool = (key: string | null, name: string, tier: number, y: number, cooldown: number): ToolStats => ({ key, name, tier, yield: y, cooldown, blurb: blurb(y, cooldown) });

export const HANDS = tool(null, "Bare hands", 0, 1, 0.5);
/** Best tool first. */
export const TOOLS: ToolStats[] = [
  tool("pico_plasma", "Plasma cutter", 2, 4, 0.18),
  tool("pala_titanio", "Titanium shovel", 2, 3, 0.22),
  tool("pala_mejorada", "Better shovel", 1, 2, 0.32),
];

/** What you currently gather with: the best tool in your inventory. */
export function bestTool(inv: Partial<Inv>): ToolStats {
  const m = inv as Record<string, number>;
  return TOOLS.find((t) => (m[t.key!] ?? 0) >= 1) ?? HANDS;
}

/** Tool tier each kind of resource node needs. */
export const NODE_TIER: Record<string, number> = { hielo: 0, regolito: 0, chatarra: 0, alga_lunar: 0, cristal_hielo: 1, titanio: 1, aleacion: 2 };

export function tierName(tier: number) {
  return tier >= 2 ? "Titanium shovel" : tier === 1 ? "Better shovel" : "bare hands";
}

/** Can you mine this node with what you carry? Otherwise says what's missing. */
export function canMine(inv: Partial<Inv>, node: string): { ok: boolean; need?: string } {
  const need = NODE_TIER[node] ?? 0;
  return bestTool(inv).tier >= need ? { ok: true } : { ok: false, need: tierName(need) };
}
