/** Shared virtual-input state written by the on-screen mobile controls and read by Phaser scenes. */
type Ev = "e-down" | "e-up" | "use" | "build" | "cycle";
const listeners = new Map<Ev, Set<() => void>>();
export const touch = {
  vx: 0, vy: 0, e: false, eSince: 0,
  on(ev: Ev, fn: () => void) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev)!.add(fn); return () => listeners.get(ev)!.delete(fn); },
  emit(ev: Ev) {
    if (ev === "e-down") { touch.e = true; touch.eSince = performance.now(); }
    if (ev === "e-up") touch.e = false;
    listeners.get(ev)?.forEach((f) => f());
  },
  eDuration() { return touch.e ? performance.now() - touch.eSince : 0; },
};
