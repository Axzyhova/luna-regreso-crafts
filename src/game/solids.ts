/**
 * Solid world objects (top-down 3/4 view).
 *
 * Every structure blocks only its "footprint": the lower part of its sprite that touches the ground.
 * The astronaut collides with its feet, so it can walk up to a wall, slide along it, and pass
 * behind the upper part of tall things (rocket, tanks) — the scene sorts depth by the feet line.
 */

export interface Box { x: number; y: number; w: number; h: number } // top-left corner + size

/** Astronaut collision box: 6×3 px at the feet (the sprite is 10×12, centred on x/y, so its feet end at y+6). */
export const FEET = { w: 6, h: 3, dy: 3 } as const;
/** Where the astronaut's feet touch the ground, for depth sorting. */
export const PLAYER_FOOT_Y = 6;

export function feetBox(x: number, y: number): Box {
  return { x: x - FEET.w / 2, y: y + FEET.dy, w: FEET.w, h: FEET.h };
}

/** Strict overlap: boxes that only touch edges do not collide, so 6 px gaps stay walkable. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Ground footprint of a sprite of size w×h centred on (cx, cy): its lower half, 1 px inset at the sides. */
export function footprint(cx: number, cy: number, w: number, h: number): Box {
  const fh = Math.max(4, Math.round(h * 0.5));
  return { x: cx - w / 2 + 1, y: cy + h / 2 - fh, w: Math.max(2, w - 2), h: fh };
}

/** The y of the line where a sprite touches the ground — used for depth sorting. */
export const groundLine = (cy: number, h: number) => cy + h / 2;

/** Depth band for y-sorted world objects (between resource nodes and leak markers). */
export const sortDepth = (groundY: number, worldH: number) => 6 + (Math.max(0, Math.min(worldH, groundY)) / worldH) * 4;

/**
 * Move from (x, y) by (dx, dy), one axis at a time so the astronaut slides along walls.
 * A step is only refused if it enters a solid it was not already inside — so a player who ends up
 * overlapping something (old save, module placed on them) can always walk out.
 */
export function moveWithCollision(
  x: number, y: number, dx: number, dy: number, solids: Box[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): { x: number; y: number; blocked: boolean } {
  const clampX = (v: number) => Math.min(bounds.maxX, Math.max(bounds.minX, v));
  const clampY = (v: number) => Math.min(bounds.maxY, Math.max(bounds.minY, v));
  const hits = (px: number, py: number) => { const f = feetBox(px, py); return solids.filter((s) => overlaps(f, s)); };
  let blocked = false;
  const nx = clampX(x + dx);
  if (nx !== x) {
    const before = new Set(hits(x, y));
    if (hits(nx, y).some((s) => !before.has(s))) blocked = true; else x = nx;
  }
  const ny = clampY(y + dy);
  if (ny !== y) {
    const before = new Set(hits(x, y));
    if (hits(x, ny).some((s) => !before.has(s))) blocked = true; else y = ny;
  }
  return { x, y, blocked };
}
