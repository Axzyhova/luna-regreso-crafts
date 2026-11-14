import { describe, it, expect } from "vitest";
import { stickVector } from "@/game/touch";
import { gameSize } from "@/components/game/GameCanvas";

describe("controles móviles", () => {
  it("el joystick tiene zona muerta y se limita al círculo", () => {
    expect(stickVector(2, 0, 50)).toEqual({ vx: 0, vy: 0 });
    const v = stickVector(200, 0, 50);
    expect(v.vx).toBeCloseTo(1); expect(v.vy).toBeCloseTo(0);
    const h = stickVector(25, 0, 50);
    expect(h.vx).toBeCloseTo(0.5);
  });
  it("en vertical el lienzo es vertical y nunca supera el mapa (640x360)", () => {
    const p = gameSize(390, 520);
    expect(p.h).toBeGreaterThan(p.w);
    expect(p.h).toBeLessThanOrEqual(360);
    expect(gameSize(1280, 720)).toEqual({ w: 320, h: 180 });
  });
});
