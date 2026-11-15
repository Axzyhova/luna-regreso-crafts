/**
 * Fixed landmarks of the world, in world pixels. One place for them, so the scene, the map and the
 * mission hints can never disagree again when the world is resized.
 */
import modulos from "@/data/modulos.json";
import zonas from "@/data/zonas.json";

const hab = modulos.iniciales.find((m) => m.tipo === "habitat")!;
/** The habitat (first module of the base). */
export const HAB = { x: hab.x, y: hab.y };
/** The rocket and its two tanks. */
export const ROCKET = { x: 760, y: 220 };
/** The permanently shadowed crater where the ice is (an ellipse). */
export const SHADOW = { x: 640, y: 520, rx: 180, ry: 90 };

const hive = zonas.zonas.find((z) => z.id === "hive")!.rect as [number, number, number, number];
/** The ravine that walls off the Alien Hive: one strip along its top edge and one along its left edge. */
export const RAVINE = [
  { x: hive[0], y: hive[1] - 4, w: hive[2], h: 8 },
  { x: hive[0] - 4, y: hive[1], w: 8, h: hive[3] },
] as const;
/** The deck of the bridge that crosses the ravine at the marked spot. */
export const BRIDGE_DECK = { x: zonas.puente.x - 12, y: hive[1] - 14, w: 24, h: 20 };

/**
 * Historic sites you can visit (E). The history is real; their presence at this exact spot is
 * part of the Selene-7 story. Each gives a reward and unlocks an Archive entry.
 */
export const POIS = [
  { id: "lcross", nombre: "LCROSS impact debris", x: 600, y: 548, reward: { chatarra: 3, metal: 2 } as Record<string, number>,
    texto: "On 9 Oct 2009 NASA crashed a spent Centaur rocket stage into Cabeus crater, near the south pole. The LCROSS spacecraft flew through the plume and detected water. In our story, twisted pieces ended up here — and you salvage 3 Scrap and 2 Metal." },
  { id: "viper", nombre: "VIPER rover test unit", x: 905, y: 592, reward: { baterias: 1 } as Record<string, number>,
    texto: "NASA built VIPER to map south-pole ice with a neutron spectrometer and a drill, but cancelled the mission in July 2024 before launch. In our story a test unit made it here. Its ground data becomes your Ground Scanner: no more regolith collapses when you dig in the crater." },
  { id: "surveyor", nombre: "Surveyor / Apollo 12 beacon", x: 240, y: 612, reward: { pieza_motor: 1, metal: 2 } as Record<string, number>,
    texto: "Surveyor 3 landed in 1967. In Nov 1969 Apollo 12's Pete Conrad and Alan Bean landed within walking distance and brought its camera back to Earth to study how parts survive on the Moon. This tribute beacon (the real site is in the Ocean of Storms) holds spare electronics: +1 Engine part, +2 Metal." },
] as const;
