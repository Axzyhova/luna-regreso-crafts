import { PAL } from "./palette";

export interface ItemInfo { nombre: string; desc: string; icon: string[]; colors: Record<string, number> }
const c = PAL;
export const ITEMS: Record<string, ItemInfo> = {
  hielo: { nombre: "Hielo", desc: "Agua congelada del cráter. Derrítela en el hábitat (E) para obtener agua.", icon: ["..cc....", ".cwcc...", "ccccwc..", "cwcccc..", ".cccwcc.", "..ccccc.", "...ccc..", "........"], colors: { c: c.ice, w: c.white } },
  agua: { nombre: "Agua", desc: "La planta de electrólisis la separa en hidrógeno y oxígeno.", icon: ["...c....", "...c....", "..ccc...", ".ccwcc..", ".cccwc..", ".ccccc..", "..ccc...", "........"], colors: { c: c.suitL, w: c.white } },
  regolito: { nombre: "Regolito", desc: "Polvo y roca lunar. El horno lo convierte en O2 y metal.", icon: ["........", "..mmm...", ".mlmmm..", "mmmmlmm.", "mlmmmmm.", ".mmmlm..", "........", "........"], colors: { m: c.moon2, l: c.moon3 } },
  chatarra: { nombre: "Chatarra", desc: "Restos del cohete. Base para metal, kits y módulos.", icon: ["o...gg..", ".g.gog..", "..ggg...", ".gog.g..", "gg...o..", "g..g....", "........", "........"], colors: { o: c.alert, g: c.moon4 } },
  metal: { nombre: "Metal", desc: "Material para fabricar herramientas y módulos.", icon: ["........", "........", ".llllll.", "lwwwwwml", "lmmmmmml", ".llllll.", "........", "........"], colors: { l: c.moon3, w: c.white, m: c.moon4 } },
  kits: { nombre: "Kit de reparación", desc: "Sella fugas y repara módulos (mantén E junto a ellos).", icon: ["........", ".rrrrrr.", "rrrwwrrr", "rrwwwwrr", "rrwwwwrr", "rrrwwrrr", ".rrrrrr.", "........"], colors: { r: c.red, w: c.white } },
  baterias: { nombre: "Batería", desc: "Módulo: guarda energía para la noche. Colócalo con C.", icon: ["..gg....", ".gggg...", ".gokg...", ".gokg...", ".gkkg...", ".gkkg...", ".gggg...", "........"], colors: { g: c.moon3, o: c.ok, k: c.moon0 } },
  paneles: { nombre: "Panel solar", desc: "Módulo: genera energía de día. Colócalo con C.", icon: ["bbbbbbb.", "blblblb.", "bbbbbbb.", "blblblb.", "bbbbbbb.", "...g....", "...g....", "..ggg..."], colors: { b: c.suit, l: c.suitL, g: c.moon3 } },
  taladro: { nombre: "Taladro de hielo", desc: "Módulo: extrae hielo solo. Debe ir dentro del cráter.", icon: ["..ooo...", "..ogo...", "..ogo...", "...g....", "...g....", "..ggg...", "...g....", "........"], colors: { o: c.alert, g: c.moon4 } },
  taller: { nombre: "Taller", desc: "Módulo: junto a él puedes fabricar herramientas y módulos.", icon: ["........", "gggggggg", "g.o..o.g", "gggggggg", "g......g", "g......g", "........", "........"], colors: { g: c.moon3, o: c.alert } },
  horno: { nombre: "Horno de regolito", desc: "Módulo: convierte regolito y energía en O2 y metal.", icon: ["..mmmm..", ".mmmmmm.", ".moooom.", ".moyyom.", ".moooom.", ".mmmmmm.", "........", "........"], colors: { m: c.moon2, o: c.alert, y: c.gold } },
  torres_luz: { nombre: "Torre de luz", desc: "Módulo: ilumina de noche alrededor.", icon: ["..yyy...", "..yyy...", "...g....", "...g....", "...g....", "...g....", "..ggg...", "........"], colors: { y: c.gold, g: c.moon3 } },
  pala_mejorada: { nombre: "Pala mejorada", desc: "Recolectas más rápido.", icon: ["....ll..", "...lll..", "....l...", "...g....", "..g.....", ".g......", "g.......", "........"], colors: { l: c.moon4, g: c.alert } },
  aislamiento: { nombre: "Aislamiento", desc: "Reduce el frío del cráter en sombra y repara el subsistema Térmico del cohete.", icon: ["........", "yyyyyyy.", "y.y.y.y.", "yyyyyyy.", "y.y.y.y.", "yyyyyyy.", "........", "........"], colors: { y: c.gold } },
  planta_electrolisis: { nombre: "Planta de electrólisis", desc: "Módulo: separa el agua en H2 y O2 (1:8 en masa). Colócalo con C.", icon: ["........", ".b..w...", ".b..w...", ".mmmmm..", ".mmmmm..", ".mmmmm..", "........", "........"], colors: { b: c.suitL, w: c.white, m: c.moon2 } },
  criotanque: { nombre: "Criotanque", desc: "Módulo: licúa y guarda H2 y O2. De noche el LH2 hierve más. Colócalo con C.", icon: ["..mmm...", ".mcccm..", ".mcwcm..", ".mcccm..", ".mcccm..", "..mmm...", "........", "........"], colors: { m: c.moon4, c: c.ice, w: c.white } },
  pieza_motor: { nombre: "Pieza de motor", desc: "Repara el subsistema de Propulsión del cohete.", icon: ["..gggg..", ".gooog..", ".goyog..", ".gooog..", "..gggg..", "...gg...", "..g..g..", "........"], colors: { g: c.moon3, o: c.alert, y: c.gold } },
};
