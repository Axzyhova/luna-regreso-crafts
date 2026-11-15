import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { CRAFT_CATS, categoryOf, sortRecipes, recipeStars } from "@/game/craftCats";

const R = (id: string) => recetas.find((r) => r.id === id)!;

describe("crafting categories and difficulty", () => {
  it("every recipe belongs to exactly one category", () => {
    const listed = CRAFT_CATS.flatMap((c) => c.ids as readonly string[]);
    for (const r of recetas) expect(listed.filter((x) => x === r.id), r.id).toHaveLength(1);
  });
  it("essentials come first, easiest first; the rover is one of the hardest", () => {
    const sorted = sortRecipes(recetas);
    expect(categoryOf(sorted[0]!)).toBe("essentials");
    expect(recipeStars(R("kit"))).toBe(1);
    expect(recipeStars(R("rover"))).toBe(5);
    expect(recipeStars(R("navcore"))).toBe(5);
    const machines = sorted.filter((r) => categoryOf(r) === "machines").map((r) => r.id);
    expect(machines.at(-1)).toBe("rover");
  });
});
