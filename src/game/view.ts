/**
 * How close the camera is to the astronaut. 1 = the standard view, bigger = more zoom.
 * Phones start more zoomed in (the character reads better and the screen feels less crowded);
 * the player can change it from the pause menu and it is remembered.
 */
const KEY = "varados_zoom_v1";
export const ZOOM_MIN = 0.8, ZOOM_MAX = 2, ZOOM_STEP = 0.2;
export const PHONE_ZOOM = 1.4;

export const view = { zoom: 1, fx: "high" as "high" | "low" };

/** Visual effects quality (glows, particles). Saved; the game may drop to LOW on its own if it stutters. */
const FX_KEY = "varados_fx_v1";
export function loadFx() { try { const v = localStorage.getItem(FX_KEY); if (v === "low" || v === "high") view.fx = v; } catch { /* storage unavailable */ } return view.fx; }
export function setFx(q: "high" | "low") { view.fx = q; try { localStorage.setItem(FX_KEY, q); } catch { /* storage unavailable */ } }

export const clampZoom = (z: number) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 10) / 10;
export const defaultZoom = (coarsePointer: boolean, shortScreen: boolean) => (coarsePointer || shortScreen ? PHONE_ZOOM : 1);

/** Saved zoom if there is one, otherwise the default for this device. */
export function loadZoom(coarsePointer: boolean, shortScreen: boolean): number {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw === null ? NaN : Number(raw);
    if (Number.isFinite(v)) return clampZoom(v);
  } catch { /* storage unavailable */ }
  return defaultZoom(coarsePointer, shortScreen);
}

export function setZoom(z: number) {
  view.zoom = clampZoom(z);
  try { localStorage.setItem(KEY, String(view.zoom)); } catch { /* storage unavailable */ }
}
