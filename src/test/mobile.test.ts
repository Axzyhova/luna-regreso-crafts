import { describe, it, expect } from "vitest";
import { gameSize } from "@/components/game/GameCanvas";

describe("controles móviles", () => {
  it("en vertical el lienzo es vertical y nunca supera el mapa (640x360)", () => {
    const p = gameSize(390, 520);
    expect(p.h).toBeGreaterThan(p.w);
    expect(p.h).toBeLessThanOrEqual(720);
    expect(gameSize(1280, 720)).toEqual({ w: 640, h: 360 });
  });
});
