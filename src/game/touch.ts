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
  /** ACTION button held down: keep using the tool (mining repeats at the tool's pace). */
  useHeld: false,
  act: {
    use: () => {},
    interact: () => {},
    build: () => {},
    cycle: () => {},
    suit: () => {},
    /** Drop one of the item selected on the hotbar. */
    drop: () => {},
  },
};
