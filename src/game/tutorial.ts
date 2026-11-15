import type { Sim } from "./sim";

/**
 * First-play tutorial: teaches the core loop (move → gather → craft → seal → ice → water)
 * one step at a time. Each step completes on its own when the player does it.
 */
export interface TutStep { id: string; title: string; text: string; touch: string; done: (s: Sim) => boolean; /** info step: finished with the GOT IT button */ ack?: boolean }

export const TUTORIAL: TutStep[] = [
  { id: "goal", ack: true, title: "Your mission", text: "You crashed on the Moon with no fuel. GOAL: gather resources, survive (O2, cold, water, food), repair the rocket and launch home inside a return window. Mini Robert (H or E next to him) explains anything.", touch: "You crashed on the Moon with no fuel. GOAL: gather resources, survive (O2, cold, water, food), repair the rocket and launch home inside a return window. Tap E next to Mini Robert for help anytime.", done: (s) => !!s.tut.acks?.includes("goal") },
  { id: "move", title: "Move around", text: "Walk with WASD or the arrow keys.", touch: "Slide your thumb on the D-pad (bottom left).", done: (s) => s.tut.moved > 40 },
  { id: "suit", ack: true, title: "Your Space suit", text: "You have worn the Space suit since launch: it gives you oxygen outside. Keep it ON outside. You can only take it OFF inside the habitat (E at the habitat → Take suit off, or V next to it) to drink and rest — then put it back on before going out.", touch: "You have worn the Space suit since launch: it gives you oxygen outside. Keep it ON outside. You can only take it OFF inside the habitat (E at the habitat → Take suit off, or the SUIT button next to it) to drink and rest — then put it back on.", done: (s) => !!s.tut.acks?.includes("suit") },
  { id: "scrap", title: "Gather scrap", text: "Walk up to the orange-grey scrap pieces and press SPACE until you have 4 Scrap.", touch: "Walk up to the orange-grey scrap pieces and tap ✋ ACTION until you have 4 Scrap.", done: (s) => s.inv.chatarra >= 4 },
  { id: "inventory", title: "Open your inventory", text: "Press TAB to see what you carry.", touch: "Tap the ⋯ button next to the hotbar.", done: (s) => s.tut.invOpened },
  { id: "craft", title: "Craft a Sealant kit", text: "In the inventory, open the Crafting tab and craft a Sealant kit (2 Scrap + 1 Metal). If you have no Metal, first craft 'Smelt scrap into metal'.", touch: "In the inventory, open Crafting and craft a Sealant kit (2 Scrap + 1 Metal). No Metal? Craft 'Smelt scrap into metal' first.", done: (s) => s.tut.kitCrafted },
  { id: "seal", title: "Seal a leak", text: "A leak is spraying (flashing orange). Stand next to it and HOLD E until the green ring fills.", touch: "A leak is spraying (flashing orange). Stand next to it and HOLD the E button until the green ring fills.", done: (s) => s.actFlags.leakFixed },
  { id: "map", title: "Open the map", text: "Press M (or the 🗺 MAP button) to see the zones, your position, resource sites and your rovers.", touch: "Tap the 🗺 map button at the top to see the zones, your position, resource sites and your rovers.", done: (s) => !!s.tut.seen?.includes("mapa") },
  { id: "missions", title: "Check your missions", text: "Press J or click the MISSION bar at the bottom: it lists the 7 main missions to get home plus side missions with rewards.", touch: "Tap the MISSION bar at the bottom: it lists the 7 main missions to get home plus side missions with rewards.", done: (s) => !!s.tut.seen?.includes("misiones") },
  { id: "base", title: "Look at your base", text: "Press B (or the 🏠 button): see power, batteries, the status of every module, turn machines on/off and upgrade them (a green ^ means you can).", touch: "Tap the 🏠 button: see power, batteries, the status of every module, turn machines on/off and upgrade them (a green ^ means you can).", done: (s) => !!s.tut.seen?.includes("base") },
  { id: "build", title: "Build something", text: "Craft a module (e.g. a Storage chest: 3 Metal + 4 Scrap), press C to enter BUILD mode, Q to switch module, and click (or SPACE) to place it. Green = valid spot.", touch: "Craft a module (e.g. a Storage chest: 3 Metal + 4 Scrap). The 🔨 BUILD button appears: tap it, then ACTION places it in front of you (⟳ switches module, ✕ exits). Green = valid spot.", done: (s) => !!s.tut.built },
  { id: "ice", title: "Collect ice", text: "Go to the dark shadowed crater (follow the GPS card) and pick up 2 blue ice crystals.", touch: "Go to the dark shadowed crater (follow the GPS card) and pick up 2 blue ice crystals.", done: (s) => s.stats.hielo >= 2 },
  { id: "melt", title: "Make water", text: "Bring the ice to the habitat, press E to go inside and tap MELT ICE. The water goes to the habitat tank (it takes no inventory space) and later becomes fuel and oxygen.", touch: "Bring the ice to the habitat, tap E to go inside and tap MELT ICE. The water goes to the habitat tank (no inventory space) and later becomes fuel and oxygen.", done: (s) => s.inv.agua > 0 || s.lh2 > 0 },
  { id: "thermal", ack: true, title: "The Thermal suit", text: "Nights and the Frozen Basin are freezing. Craft the Thermal suit at the Workshop (2 Insulation + 1 Metal) and equip it from the inventory (click it / drag it onto your character). Unlike the Space suit, you CAN put it on and take it off outside. The Reflective cape does the same for heat.", touch: "Nights and the Frozen Basin are freezing. Craft the Thermal suit at the Workshop (2 Insulation + 1 Metal) and equip it from the inventory (tap it / drag it onto your character). Unlike the Space suit, you CAN put it on and take it off outside. The Reflective cape does the same for heat.", done: (s) => !!s.tut.acks?.includes("thermal") },
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
