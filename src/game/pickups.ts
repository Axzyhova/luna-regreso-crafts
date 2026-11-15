/**
 * Visual emphasis for things lying on the ground (resources, supply capsules, the bag of lost items).
 * Pure helpers: the scene only loops over them and draws, so the maths is easy to test.
 */

/** Cheap deterministic hash in [0, 1), so every pickup gets its own timing. */
export const seed01 = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Star twinkle: each pickup flashes briefly once per `period` ms. Returns intensity 0…1 (0 = off). */
export function twinkle(timeMs: number, id: number, period = 2600, flash = 380): number {
  const t = (timeMs + seed01(id) * period) % period;
  return t < flash ? Math.sin((t / flash) * Math.PI) : 0;
}

/** Vertical bob in world px, snapped to `step` so sprites stay on the pixel grid. */
export function bobOffset(timeMs: number, phase: number, amp: number, step: number): number {
  return Math.round((Math.sin(timeMs / 380 + phase) * amp) / step) * step;
}

/** Expanding ring: 0 → 1 over `period` ms; `i` offsets multiple rings so they trail each other. */
export function ringPhase(timeMs: number, i: number, period = 1500, count = 2): number {
  return ((timeMs / period + i / count) % 1 + 1) % 1;
}

export interface Strip { x: number; y: number; w: number; h: number; a: number }

/** A vertical shaft of light: stacked strips from the ground up, fading to transparent at the top. */
export function beamStrips(x: number, baseY: number, height: number, count: number, maxAlpha: number, width: number): Strip[] {
  const h = height / count, out: Strip[] = [];
  for (let k = 0; k < count; k++) out.push({ x: x - width / 2, y: baseY - (k + 1) * h, w: width, h, a: maxAlpha * (1 - k / count) });
  return out;
}

/**
 * Where to draw a pointer at the edge of the visible area for a target that is off screen.
 * Returns null when the target is already visible (inside the view, inset by `margin`).
 * `angle` points from the view centre toward the target (radians, 0 = right).
 */
export function edgeMarker(view: { x: number; y: number; width: number; height: number }, target: { x: number; y: number }, margin = 6): { x: number; y: number; angle: number } | null {
  const cx = view.x + view.width / 2, cy = view.y + view.height / 2;
  const dx = target.x - cx, dy = target.y - cy;
  const hw = view.width / 2 - margin, hh = view.height / 2 - margin;
  if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return null;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx) };
}
