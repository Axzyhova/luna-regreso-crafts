export function createFrame(w: number, h: number): {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint8ClampedArray;
  light: Uint8ClampedArray;
};
export function clearFrame(frame: unknown): void;
export function createFx(mod: unknown, opts?: Record<string, unknown>): {
  x: number;
  y: number;
  update(dt: number): void;
  draw(frame: unknown, layer: "back" | "front"): void;
  done(): boolean;
  stop?(): void;
};
export function composite(frame: unknown, out: Uint8ClampedArray, bg: null | number[]): void;
export const PAL: Record<string, string[]>;
