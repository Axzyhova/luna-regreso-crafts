import recetas from "@/data/recetas.json";

type Receta = (typeof recetas)[number];

/** Crafting categories, in the order a new player needs them. Inside each one, easiest first. */
export const CRAFT_CATS = [
  { id: "essentials", nombre: "Essentials", icon: "⭐", ids: ["metal", "kit", "aislamiento", "cofre", "taller", "horno"] },
  { id: "suits", nombre: "Suits & gear", icon: "🧑‍🚀", ids: ["traje_espacial", "traje_termico", "capa_reflectante", "escudo_radiacion"] },
  { id: "tools", nombre: "Tools", icon: "⛏", ids: ["pala_mejorada", "baton", "pala_titanio"] },
  { id: "food", nombre: "Food & medicine", icon: "🍞", ids: ["racion", "comida_caliente", "papa_horneada", "pan", "galleta", "botiquin", "estimulante"] },
  { id: "base", nombre: "Base & power", icon: "🏠", ids: ["panel_solar", "bateria", "torre_luz", "eds", "hidroponia", "biorreactor", "robot_lab"] },
  { id: "machines", nombre: "Machines", icon: "⚙", ids: ["taladro", "planta_electrolisis", "criotanque", "rover"] },
  { id: "rocket", nombre: "Rocket & exploring", icon: "🚀", ids: ["pieza_motor", "puente_kit", "navcore"] },
] as const;
export type CraftCat = (typeof CRAFT_CATS)[number]["id"];

/** How hard a raw material is to get (time / risk / zones it needs). */
const RAW: Record<string, number> = {
  chatarra: 1, regolito: 1, hielo: 1.5, agua: 0.3, alga_lunar: 3, papa: 3, trigo: 3,
  vidrio_solar: 3, cristal_estelar: 3, cristal_hielo: 5, titanio: 6, aleacion: 8,
};
const byResult = new Map<string, Receta>();
for (const r of recetas) for (const k of Object.keys(r.resultado)) if (!byResult.has(k)) byResult.set(k, r);

/** Effort to get one unit of an item: raw value, or the cost of the recipe that makes it. */
export function itemCost(item: string, depth = 0): number {
  if (item in RAW) return RAW[item]!;
  const r = byResult.get(item);
  if (!r || depth > 6) return 4;
  const out = Object.values(r.resultado)[0] ?? 1;
  return recipeCost(r, depth + 1) / out;
}
export function recipeCost(r: Receta, depth = 0): number {
  return Object.entries(r.ingredientes).reduce((a, [k, n]) => a + (n ?? 0) * itemCost(k, depth), 0);
}
/** 1 (easy) … 5 (hard). */
export function recipeStars(r: Receta): number {
  const c = recipeCost(r);
  return c <= 4 ? 1 : c <= 9 ? 2 : c <= 16 ? 3 : c <= 26 ? 4 : 5;
}
export const starText = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
export const STAR_LABEL = ["", "Very easy", "Easy", "Medium", "Hard", "Very hard"];

export function categoryOf(r: Receta): CraftCat {
  return (CRAFT_CATS.find((c) => (c.ids as readonly string[]).includes(r.id))?.id ?? "base") as CraftCat;
}
/** Recipes ordered by category (as above), then easiest first. */
export function sortRecipes<T extends Receta>(list: T[]): T[] {
  const ci = (r: T) => CRAFT_CATS.findIndex((c) => c.id === categoryOf(r));
  return [...list].sort((a, b) => ci(a) - ci(b) || recipeCost(a) - recipeCost(b));
}
