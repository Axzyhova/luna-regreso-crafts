import { create } from "zustand";
import { createSim, type Sim, type Mode, type Difficulty } from "./sim";

export type Screen = "intro" | "rechazo" | "modo" | "cinematica" | "juego" | "fuentes";
export type Overlay = null | "inv" | "base" | "log" | "pausa" | "cohete";

/** Mutable simulation owned by the Phaser scene; UI reads `snap`, a copy published ~8x/s. */
export let sim: Sim = createSim("realista", "normal");

interface State {
  screen: Screen;
  overlay: Overlay;
  snap: Sim;
  go: (s: Screen) => void;
  setOverlay: (o: Overlay) => void;
  newGame: (m: Mode, d: Difficulty) => void;
  loadGame: () => boolean;
  publish: () => void;
}
const KEY = "varados_save_v2";

export const useGame = create<State>((set, get) => ({
  screen: "intro",
  overlay: null,
  snap: structuredClone(sim),
  go: (screen) => set({ screen }),
  setOverlay: (overlay) => set({ overlay }),
  newGame: (m, d) => { sim = createSim(m, d); get().publish(); },
  loadGame: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const base = createSim("realista", "normal");
      const saved = JSON.parse(raw);
      // Merge nested records so saves from older versions get new items/subsystems.
      sim = { ...base, ...saved, inv: { ...base.inv, ...saved.inv }, rocket: { ...base.rocket, ...saved.rocket }, leaks: [] };
      get().publish();
      return true;
    } catch { return false; }
  },
  publish: () => set({ snap: structuredClone(sim) }),
}));

export function saveGame() {
  try { localStorage.setItem(KEY, JSON.stringify(sim)); } catch { /* storage unavailable */ }
}
export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
