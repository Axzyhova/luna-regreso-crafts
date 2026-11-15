import type { Sim } from "./sim";

/**
 * First-play tutorial: teaches the core loop (move → gather → craft → seal → ice → water)
 * one step at a time. Each step completes on its own when the player does it.
 */
export interface TutStep { id: string; title: string; text: string; touch: string; done: (s: Sim) => boolean }

export const TUTORIAL: TutStep[] = [
  { id: "move", title: "Move around", text: "Walk with WASD or the arrow keys.", touch: "Slide your thumb on the D-pad (bottom left).", done: (s) => s.tut.moved > 40 },
  { id: "scrap", title: "Gather scrap", text: "Walk up to the orange-grey scrap pieces and press SPACE until you have 4 Scrap.", touch: "Walk up to the orange-grey scrap pieces and tap ✋ ACTION until you have 4 Scrap.", done: (s) => s.inv.chatarra >= 4 },
  { id: "inventory", title: "Open your inventory", text: "Press TAB to see what you carry.", touch: "Tap the ⋯ button next to the hotbar.", done: (s) => s.tut.invOpened },
  { id: "craft", title: "Craft a Sealant kit", text: "In the inventory, open the Crafting tab and craft a Sealant kit (2 Scrap + 1 Metal). If you have no Metal, first craft 'Smelt scrap into metal'.", touch: "In the inventory, open Crafting and craft a Sealant kit (2 Scrap + 1 Metal). No Metal? Craft 'Smelt scrap into metal' first.", done: (s) => s.tut.kitCrafted },
  { id: "seal", title: "Seal a leak", text: "A leak is spraying (flashing orange). Stand next to it and HOLD E until the green ring fills.", touch: "A leak is spraying (flashing orange). Stand next to it and HOLD the E button until the green ring fills.", done: (s) => s.actFlags.leakFixed },
  { id: "ice", title: "Collect ice", text: "Go to the dark shadowed crater (follow the GPS card) and pick up 2 blue ice crystals.", touch: "Go to the dark shadowed crater (follow the GPS card) and pick up 2 blue ice crystals.", done: (s) => s.stats.hielo >= 2 },
  { id: "melt", title: "Make water", text: "Bring the ice to the habitat, press E to go inside and tap MELT ICE. The water goes to the habitat tank (it takes no inventory space) and later becomes fuel and oxygen.", touch: "Bring the ice to the habitat, tap E to go inside and tap MELT ICE. The water goes to the habitat tank (no inventory space) and later becomes fuel and oxygen.", done: (s) => s.inv.agua > 0 || s.lh2 > 0 },
];

export const tutorialStep = (s: Sim): TutStep | null => (s.tut.skipped ? null : TUTORIAL[s.tut.step] ?? null);

/** Advance through every step already satisfied. Returns true when a step was completed. */
export function stepTutorial(s: Sim): boolean {
  let advanced = false;
  for (let st = tutorialStep(s); st && st.done(s); st = tutorialStep(s)) { s.tut.step++; advanced = true; }
  return advanced;
}

/** The step that needs a leak to practice on (the scene makes sure one exists). */
export const tutorialWantsLeak = (s: Sim) => tutorialStep(s)?.id === "seal";
