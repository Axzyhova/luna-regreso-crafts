import { create } from "zustand";
import { createSim, LH2_CAP, LOX_CAP, type Sim, type Mode, type Difficulty } from "./sim";

export type Screen = "intro" | "rechazo" | "modo" | "cinematica" | "juego" | "fuentes" | "final";
export type Overlay = null | "inv" | "base" | "log" | "pausa" | "cohete" | "cubesat" | "misiones" | "estacion" | "mapa" | "cofre" | "archivo";

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
const KEY = "varados_save_v3";

export const useGame = create<State>((set, get) => ({
  screen: "intro",
  overlay: null,
  snap: structuredClone(sim),
  go: (screen) => set({ screen }),
  setOverlay: (overlay) => { if (overlay === "inv") sim.tut.invOpened = true; set({ overlay }); },
  newGame: (m, d) => { sim = createSim(m, d); get().publish(); },
  loadGame: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const base = createSim("realista", "normal");
      const saved = JSON.parse(raw);
      // Merge nested records so saves from older versions get new items/subsystems.
      sim = { ...base, ...saved, inv: { ...base.inv, ...saved.inv }, rocket: { ...base.rocket, ...saved.rocket }, leaks: [], aliens: [], abduction: 0, countdown: null,
        stats: { ...base.stats, ...saved.stats }, quest: { ...base.quest, ...saved.quest }, tut: { ...base.tut, ...saved.tut }, hive: [], chests: saved.chests ?? {}, archive: saved.archive ?? [], event: null, impacts: [], dialog: [] };
      sim.lh2 = Math.min(sim.lh2, LH2_CAP); sim.lox = Math.min(sim.lox, LOX_CAP);
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
