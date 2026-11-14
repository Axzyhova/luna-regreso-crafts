/**
 * Shared touch input. React's on-screen controls write here; the Phaser scene reads it
 * every frame (movement, held "E") and registers the one-shot actions.
 */
export const touch = {
  vx: 0,
  vy: 0,
  /** "E" held down (seal leaks / repair modules). */
  e: false,
  /** Sprint toggle (the RUN button). Keyboard players hold Shift instead. */
  run: false,
  act: {
    use: () => {},
    interact: () => {},
    build: () => {},
    cycle: () => {},
    suit: () => {},
  },
};

/** Clamp a joystick drag (dx, dy) to the unit circle, with a small dead zone. */
export function stickVector(dx: number, dy: number, radius: number) {
  const len = Math.hypot(dx, dy);
  if (len < radius * 0.15) return { vx: 0, vy: 0 };
  const k = Math.min(1, len / radius) / len;
  return { vx: dx * k, vy: dy * k };
}
