import { ALIENS } from "./aliens";
import { ITEMS } from "./items";
import { BOSS_DEFS } from "./zones";

export interface MaterialGuideEntry {
  id: string;
  where: string;
  use: string;
}

export const MATERIAL_GUIDE: MaterialGuideEntry[] = [
  { id: "hielo", where: "Shadowed Crater (Landing Site) & Frozen Basin", use: "Melt at Habitat for Water -> Electrolysis into H2 & O2." },
  { id: "regolito", where: "Regolith Ridge (NW Landing Site) & Scorch Fields", use: "Smelt in Furnace for Metal + O2, or craft Insulation & Bridge." },
  { id: "chatarra", where: "Scrapyard Flats (NE Landing Site) & Supply Capsules", use: "Smelt into Metal, craft Sealant kits & modules." },
  { id: "metal", where: "Craft from Scrap (2 Scrap -> 1 Metal) or Supply Capsules", use: "Core building material for tools, modules, kits & bridge." },
  { id: "kits", where: "Craft in Inventory (2 Scrap + 1 Metal) or Supply Capsules", use: "Required to SEAL LEAKS and repair damaged modules (hold E)." },
  { id: "alga_lunar", where: "Shadowed Crater (Landing Site) & Deep Glacial Rift", use: "Cook into Space rations (Workshop) or Hot meals (Furnace)." },
  { id: "racion", where: "Craft at Workshop (2 Lunar algae + 1 Scrap) or Capsules", use: "Food: restores +25 Health, +15 Sanity, +10 Hydration." },
  { id: "comida_caliente", where: "Craft at Furnace (2 Lunar algae + 1 Metal)", use: "Food: restores +45 Health, +25 Sanity, clears Cold & Vertigo." },
  { id: "cristal_hielo", where: "Crystal Cavern & Deep Glacial Rift (Frozen Basin)", use: "Upgrade Cryotanks and Batteries to higher levels." },
  { id: "titanio", where: "Titanium Quarry & Far Scorch Caldera (Scorch Fields)", use: "Build Ravine Bridge, Titanium shovel & level-3 upgrades." },
  { id: "aleacion", where: "Alloy Spires, Hive Matriarch Lair & Hive Creatures", use: "Top-tier module upgrades." },
  { id: "pieza_motor", where: "Supply Capsules, Special Cases & Far-Zone Bosses", use: "Repairs the rocket's Propulsion subsystem." },
];

export interface CreatureGuideEntry {
  id: string;
  nombre: string;
  kind: "Night Alien" | "Hive Creature" | "Zone Boss";
  where: string;
  desc: string;
  loot: string;
}

export const CREATURE_GUIDE: CreatureGuideEntry[] = [
  { id: "abductor", nombre: ALIENS.tipos.abductor.nombre, kind: "Night Alien", where: "Landing Site at night (Fantasy/Horror)", desc: ALIENS.tipos.abductor.consejo, loot: "Drives off threat" },
  { id: "rastreador", nombre: ALIENS.tipos.rastreador.nombre, kind: "Night Alien", where: "Landing Site at night, near powered modules", desc: ALIENS.tipos.rastreador.consejo, loot: "Protects powered modules" },
  { id: "saboteador", nombre: ALIENS.tipos.saboteador.nombre, kind: "Night Alien", where: "Landing Site at night, targets Habitat & tanks", desc: ALIENS.tipos.saboteador.consejo, loot: "Prevents leaks & theft" },
  { id: "nodriza", nombre: ALIENS.tipos.nodriza.nombre, kind: "Night Alien", where: "Rocket pad during final launch countdown", desc: ALIENS.tipos.nodriza.consejo, loot: "Protects rocket" },
  { id: "criatura_colmena", nombre: "Hive Stalker", kind: "Hive Creature", where: "Alien Hive (SE region, all modes)", desc: "Aggressive territorial creature guarding Alloy Spires.", loot: "1 Alien alloy" },
  ...Object.values(BOSS_DEFS).map((b) => ({
    id: b.id,
    nombre: b.nombre,
    kind: "Zone Boss" as const,
    where: b.zona,
    desc: b.desc,
    loot: Object.entries(b.loot).map(([k, n]) => `${n}x ${ITEMS[k]?.nombre ?? k}`).join(", "),
  })),
];
