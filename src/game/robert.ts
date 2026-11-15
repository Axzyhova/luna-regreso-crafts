import data from "@/data/robert.json";
import { isDay, WATER_TANK_KG, type Sim } from "./sim";
import { tutorialStep } from "./tutorial";
import { currentMain } from "./quests";
import { aliensEnabled } from "./aliens";

/** Mini Robert: the guide's content (areas → subareas → points) and the mandatory intro slides. */
export const ROBERT = data;
export type RobertArea = (typeof data.areas)[number];

/**
 * "What should I do now?": the tutorial step, the current main mission and up to 4 tips
 * picked from the astronaut's state, most urgent first.
 */
export function robertAdvice(s: Sim, touch = false): { now: string[]; tips: string[] } {
  const now: string[] = [];
  const tut = tutorialStep(s);
  if (tut) now.push(`🎓 Tutorial: ${tut.title} — ${touch ? tut.touch : tut.text}`);
  const q = currentMain(s);
  if (q) now.push(`📜 Mission: ${q.titulo} — ${q.objetivo}`);
  else now.push("🚀 All main missions done: launch inside a return window!");

  const tips: string[] = [];
  if (!s.suit.worn && !s.dead) tips.push("🧑‍🚀 Put your space suit on before going outside (V / SUIT).");
  if (s.suitO2 < 35) tips.push("🫧 Oxygen is low: walk back to the habitat to refill.");
  if (s.health < 40) tips.push("♥ Health is low: eat a Space ration or use a Medkit.");
  if (s.temp < 5) tips.push("🥶 You're freezing: go inside, wear the Thermal suit or eat a Hot meal.");
  if (s.temp > 38) tips.push("🥵 Too hot: find shade or wear the Reflective cape.");
  if (s.hydration < 35) tips.push("💧 Thirsty: inside the habitat take the suit off to drink.");
  if (s.fatigue > 70) tips.push("😴 Very tired: rest inside the habitat.");
  if (s.sanity < 35) tips.push("🧠 Sanity is low: stay near light and eat something.");
  if (s.inv.kits < 1) tips.push("🧰 No Sealant kits: craft one (2 Scrap + 1 Metal) for the next leak.");
  const broken = s.modules.filter((m) => m.durabilidad < 25);
  if (broken.length) tips.push(`🔧 ${broken.length} module${broken.length > 1 ? "s are" : " is"} broken (faded on the map). Craft Sealant kits (2 Scrap + 1 Metal) and HOLD E on ${broken.length > 1 ? "them" : "it"}.`);
  if (s.leaks.length) tips.push("⚠ There's a leak: follow the GPS card and HOLD E on it with a kit.");
  if (s.inv.agua < 20 && s.inv.hielo > 0) tips.push(`💧 Melt your ice at the habitat (E): tank ${Math.round(s.inv.agua)}/${WATER_TANK_KG} kg.`);
  if (!isDay(s) && aliensEnabled(s)) tips.push("🌙 Night: aliens are out. Stay near the habitat and light towers.");
  if (!isDay(s) && !s.equip.includes("traje_termico")) tips.push("🌙 Nights are cold: a Thermal suit lets you keep working.");
  if (s.event?.phase === "activo" && s.event.id === "llamarada_solar") tips.push("☢ Solar flare: get inside now!");
  if (!tips.length) tips.push("💡 All good! Gather resources, fill the chest and keep repairing the rocket.");
  return { now, tips: tips.slice(0, 4) };
}
