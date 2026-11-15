import { ITEMS } from "./items";

/** What each item is for and where it comes from, shown in the inventory so nothing feels pointless. */
export const ITEM_GUIDE: Record<string, { uso: string; origen: string }> = {
  hielo: { uso: "Melt it in the habitat (E) to fill the water tank.", origen: "Ice crystals in the shadowed crater · Ice drill." },
  agua: { uso: "Electrolysis makes fuel and oxygen · drink it · medkits and stimulants.", origen: "Melting ice at the habitat." },
  regolito: { uso: "Furnace: metal + oxygen · solar panels, insulation, radiation shield, bridge.", origen: "Grey rocks lying around the base." },
  chatarra: { uso: "Sealant kits, metal, and almost every module.", origen: "Rocket debris · supply capsules." },
  metal: { uso: "Nearly every craft and every upgrade.", origen: "Smelt scrap by hand · the regolith furnace." },
  kits: { uso: "Seal leaks (hold E) · repair modules and rocket systems.", origen: "Craft: 2 scrap + 1 metal." },
  baterias: { uso: "Place to store power for the night · stun baton · rocket Power.", origen: "Workshop: 3 metal + 2 scrap." },
  paneles: { uso: "Place on the ground: +5 power/s in daylight. More panels = more machines and longer nights.", origen: "Workshop: 3 metal + 2 regolith." },
  taladro: { uso: "Place inside the shadowed crater: it mines ice by itself.", origen: "Workshop: 4 metal + 2 scrap." },
  taller: { uso: "Place it: the crafting station (press E next to it).", origen: "By hand: 4 scrap + 2 metal." },
  horno: { uso: "Place it: turns regolith into metal and oxygen, and bakes insulation.", origen: "By hand: 5 regolith + 3 metal + 2 scrap." },
  torres_luz: { uso: "Place: light at night keeps aliens away and calms fear.", origen: "Workshop: 2 metal + 2 scrap." },
  pala_mejorada: { uso: "Works while carried: faster mining, sometimes +1 unit, and opens Frost crystals and Titanium.", origen: "Workshop: 3 metal." },
  aislamiento: { uso: "Cryotanks · thermal suit · rocket Thermal system · halves the crater's cold.", origen: "Furnace: 3 regolith + 1 scrap." },
  planta_electrolisis: { uso: "Place: splits water into hydrogen and oxygen (fuel).", origen: "Workshop: 6 metal + 4 scrap." },
  criotanque: { uso: "Place: liquefies and stores the fuel (LH2 and LOX).", origen: "Workshop: 5 metal + 2 insulation." },
  pieza_motor: { uso: "Repairs the rocket's Propulsion system.", origen: "Workshop: 6 metal + 3 scrap." },
  traje_termico: { uso: "Equip it to enter the Frozen Basin and to hold off the cold.", origen: "Workshop: 2 insulation + 1 metal · capsules." },
  capa_reflectante: { uso: "Equip it to enter the Scorch Fields and to survive heat peaks.", origen: "Workshop: 2 metal + 2 scrap." },
  escudo_radiacion: { uso: "Equip it during a solar flare to cut the radiation.", origen: "Workshop: 6 regolith + 2 metal." },
  botiquin: { uso: "Use: +40 health.", origen: "Workshop: 10 water + 1 metal · capsules." },
  estimulante: { uso: "Use: removes fatigue so you can run again.", origen: "Workshop: 6 water + 2 regolith · capsules." },
  cristal_hielo: { uso: "Upgrades for batteries and cryotanks.", origen: "Frozen Basin (needs a shovel)." },
  titanio: { uso: "Titanium shovel · the ravine bridge · high-level upgrades.", origen: "Scorch Fields (needs a shovel)." },
  aleacion: { uso: "The best module upgrades.", origen: "Alien Hive (needs the Titanium shovel)." },
  pala_titanio: { uso: "Works while carried: fastest mining, often +1 unit, and opens Alien alloy.", origen: "Workshop: 3 titanium + 2 metal." },
  baton: { uso: "Hits deal double damage to aliens and hive creatures.", origen: "Workshop: 3 metal + 1 battery." },
  cofre: { uso: "Place in the base, then press E next to it to store items.", origen: "Workshop: 3 metal + 3 scrap." },
};

/** Order of the inventory grid. Anything not listed is appended, so a new item can never be invisible. */
const PREFERRED = ["hielo", "regolito", "chatarra", "metal", "kits", "botiquin", "estimulante", "pala_mejorada", "pala_titanio", "baton", "titanio", "cristal_hielo", "aleacion", "paneles", "baterias", "taladro", "taller", "horno", "torres_luz", "planta_electrolisis", "criotanque", "cofre", "aislamiento", "pieza_motor", "traje_termico", "capa_reflectante", "escudo_radiacion"];
export const INV_ORDER: string[] = [...PREFERRED, ...Object.keys(ITEMS).filter((k) => k !== "agua" && !PREFERRED.includes(k))];
