import zonas from "@/data/zonas.json";
import recetas from "@/data/recetas.json";
import loot from "@/data/loot.json";
import { CAVE_ALIENS } from "./events";
import { CROPS, ROVER_MATS } from "./sim";

const ZONE_NAME: Record<string, string> = Object.fromEntries(zonas.zonas.map((z) => [z.id, z.nombre]));
const STATION: Record<string, string> = { taller: "Workshop", horno: "Furnace", mano: "by hand (inventory)" };
const EXTRA: Record<string, string[]> = {
  agua: ["Melt ice at the habitat (E): it goes to the water tank"],
  regolito: ["Everywhere on the ground"],
  chatarra: ["Wreckage around the crash site"],
  alga_lunar: ["Grow it in a Hydroponic farm"],
};

/** Where an item comes from: zones where you mine it, capsules, caves, farms, machines and recipes. */
export function itemSources(item: string): string[] {
  const out: string[] = [...(EXTRA[item] ?? [])];
  for (const z of zonas.subzonas as { nombre: string; zona: string; recursos: string[]; tipo: string }[]) {
    if (z.recursos.includes(item)) out.push(`Mine at ${z.nombre} (${ZONE_NAME[z.zona] ?? z.zona}${z.tipo === "jefe" ? ", boss lair" : ""})`);
  }
  if (loot.tabla.some((l) => l.item === item)) out.push("Supply capsules (open with E)");
  if (Object.values(CAVE_ALIENS).some((a) => item in a.loot)) out.push("Meteor caves (cave creatures drop it)");
  for (const c of Object.values(CROPS)) if (c.out === item && c.seed !== item) out.push(`Harvest from a Hydroponic farm (plant ${c.seed.replace("semilla_", "").replace("papa", "potato").replace("trigo", "wheat")} seeds)`);
  if (item.startsWith("semilla_")) out.push("The base storage chest has a few to start", "Harvesting gives 1 seed back");
  if ((ROVER_MATS as readonly string[]).includes(item)) out.push("The Auto-Miner Rover can fetch it for you");
  for (const r of recetas) if (item in r.resultado) out.push(`Craft at the ${STATION[r.lugar] ?? r.lugar}`);
  return [...new Set(out)];
}
