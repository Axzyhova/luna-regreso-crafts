import { describe, it, expect } from "vitest";
import { feetBox, footprint, moveWithCollision, overlaps, sortDepth } from "@/game/solids";
import modulos from "@/data/modulos.json";

const B = { minX: 4, minY: 4, maxX: 636, maxY: 356 };
const wall = { x: 100, y: 100, w: 20, h: 10 };

describe("solid structures", () => {
  it("the astronaut cannot walk through a structure", () => {
    // walking right into the wall's left side
    let p = { x: 90, y: 102 };
    for (let i = 0; i < 20; i++) p = moveWithCollision(p.x, p.y, 1, 0, [wall], B);
    expect(feetBox(p.x, p.y).x + 6).toBeLessThanOrEqual(wall.x);
  });

  it("slides along a wall when moving diagonally", () => {
    const r = moveWithCollision(96.5, 102, 1, 1, [wall], B);
    expect(r.blocked).toBe(true);
    expect(r.y).toBe(103); // the free axis still moves
  });

  it("can walk out if it is already inside (old save / module placed on top)", () => {
    const r = moveWithCollision(110, 103, 0, 1, [wall], B);
    expect(r.y).toBe(104);
  });

  it("the footprint is the lower half, so you can stand behind the top of a tall sprite", () => {
    const f = footprint(540, 150, 20, 40);
    expect(f.y).toBe(150);
    expect(overlaps(feetBox(540, 140), f)).toBe(false);
  });

  it("the starting base leaves walkable gaps between modules", () => {
    const fps = modulos.iniciales.map((m) => { const t = modulos.tipos[m.tipo as keyof typeof modulos.tipos]; return footprint(m.x, m.y, t.w, t.h); });
    // walk straight up through the gap between the two batteries (x≈158)
    let p = { x: 158, y: 160 };
    for (let i = 0; i < 30; i++) p = moveWithCollision(p.x, p.y, 0, -1, fps, B);
    expect(p.y).toBe(130);
  });

  it("objects lower on screen are drawn on top", () => {
    expect(sortDepth(200, 360)).toBeGreaterThan(sortDepth(100, 360));
    expect(sortDepth(360, 360)).toBeLessThan(12); // stays under leak markers
  });
});
