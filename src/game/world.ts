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
