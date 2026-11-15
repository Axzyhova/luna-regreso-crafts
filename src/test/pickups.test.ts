import { describe, it, expect } from "vitest";
import { twinkle, bobOffset, ringPhase, beamStrips, edgeMarker, seed01 } from "@/game/pickups";

describe("pickup emphasis maths", () => {
  it("twinkles briefly, then rests, and each pickup has its own rhythm", () => {
    let lit = 0, total = 0;
    for (let ms = 0; ms < 26000; ms += 20) { const v = twinkle(ms, 7); total++; if (v > 0) lit++; expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(lit / total).toBeGreaterThan(0.08); expect(lit / total).toBeLessThan(0.25); // ~380 ms of every 2600 ms
    expect(twinkle(1234, 1)).toBe(twinkle(1234, 1)); // deterministic
    expect(seed01(1)).not.toBe(seed01(2));
  });

  it("bob stays within its amplitude and on the pixel grid", () => {
    for (let ms = 0; ms < 5000; ms += 37) {
      const b = bobOffset(ms, 1.3, 1.5, 0.5);
      expect(Math.abs(b)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.abs(b / 0.5 - Math.round(b / 0.5))).toBeLessThan(1e-9);
    }
  });

  it("rings expand 0→1 and trail each other", () => {
    expect(ringPhase(0, 0)).toBe(0);
    expect(ringPhase(0, 1)).toBeCloseTo(0.5);
    for (let ms = 0; ms < 6000; ms += 91) { const p = ringPhase(ms, 1); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThan(1); }
  });

  it("a light beam rises from the ground and fades out toward the top", () => {
    const s = beamStrips(100, 50, 30, 6, 0.4, 3);
    expect(s).toHaveLength(6);
    expect(s[0]!.y + s[0]!.h).toBe(50); // starts at the ground
    expect(s.at(-1)!.y).toBeCloseTo(20); // ends `height` above it
    for (let i = 1; i < s.length; i++) expect(s[i]!.a).toBeLessThan(s[i - 1]!.a);
    expect(s[0]!.x).toBe(98.5); // centred
  });

  it("edge marker: none when visible, otherwise on the border pointing at the target", () => {
    const view = { x: 100, y: 100, width: 160, height: 90 };
    expect(edgeMarker(view, { x: 180, y: 145 })).toBeNull(); // centre
    expect(edgeMarker(view, { x: 250, y: 110 })).toBeNull(); // inside, near the corner
    const right = edgeMarker(view, { x: 500, y: 145 })!; // far to the right, same height
    expect(right.x).toBeCloseTo(100 + 160 - 6); expect(right.y).toBeCloseTo(145); expect(right.angle).toBeCloseTo(0);
    const upLeft = edgeMarker(view, { x: -200, y: -300 })!;
    expect(upLeft.x).toBeGreaterThanOrEqual(100 + 6 - 1e-6); expect(upLeft.y).toBeCloseTo(100 + 6);
    expect(upLeft.angle).toBeLessThan(-Math.PI / 2); // up and to the left
    const down = edgeMarker(view, { x: 180, y: 900 })!;
    expect(down.y).toBeCloseTo(100 + 90 - 6); expect(down.angle).toBeCloseTo(Math.PI / 2);
  });
});
