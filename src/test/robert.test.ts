import { describe, it, expect } from "vitest";
import { createSim } from "@/game/sim";
import { ROBERT, robertAdvice } from "@/game/robert";

describe("Mini Robert", () => {
  it("has a mandatory 4-slide intro that explains the goal", () => {
    expect(ROBERT.intro).toHaveLength(4);
    expect(JSON.stringify(ROBERT.intro)).toMatch(/LAUNCH/);
  });
  it("organizes the guide as areas → subareas → points", () => {
    const ids = ROBERT.areas.map((a) => a.id);
    for (const id of ["goal", "controls", "hud", "menus", "items", "map", "enemies", "events", "effects", "base", "rocket", "extras", "tips"]) expect(ids).toContain(id);
    for (const a of ROBERT.areas) {
      expect(a.subs.length).toBeGreaterThan(0);
      for (const s of a.subs) for (const p of s.points) { expect(p.t.length).toBeGreaterThan(0); expect(p.d.length).toBeGreaterThan(0); }
    }
  });
  it("new games start with the intro pending", () => {
    expect(createSim("realista", "normal").robertMet).toBe(false);
  });
  it("tells you the tutorial step, the mission and urgent tips", () => {
    const s = createSim("realista", "normal");
    s.suitO2 = 10; s.inv.kits = 0;
    const a = robertAdvice(s);
    expect(a.now.join(" ")).toMatch(/Mission: Wake up/);
    expect(a.tips.join(" ")).toMatch(/Oxygen is low/);
    expect(a.tips.length).toBeLessThanOrEqual(4);
  });
});
