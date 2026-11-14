import { describe, it, expect } from "vitest";
import { runState, strideFrame, WINDED_AT, RECOVER_AT } from "@/game/movement";
import { GLYPHS, toFont } from "@/game/pixelfont";
import { astroPose, ASTRO_FRAMES } from "@/game/sprites";

describe("running", () => {
  it("runs when asked and rested", () => {
    expect(runState(0, true, false)).toEqual({ running: true, winded: false });
    expect(runState(0, false, false).running).toBe(false);
  });
  it("gets winded at the limit and only runs again after recovering", () => {
    let st = runState(WINDED_AT, true, false);
    expect(st).toEqual({ running: false, winded: true });
    st = runState(RECOVER_AT + 5, true, st.winded);
    expect(st.running).toBe(false);
    st = runState(RECOVER_AT - 1, true, st.winded);
    expect(st.running).toBe(true);
  });
  it("cycles 8 frames, faster when running", () => {
    expect([0, 0.09, 0.17, 0.26, 0.34, 0.42, 0.51, 0.59, 0.67].map((t) => strideFrame(t, false))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(strideFrame(0.07, true)).toBe(1);
  });
  it("walk cycle: legs alternate, the forward-swinging leg lifts, the body dips at full stride", () => {
    const poses = Array.from({ length: ASTRO_FRAMES }, (_, i) => astroPose("walk", i));
    expect(poses[2]!.nearDx).toBeGreaterThan(0); expect(poses[6]!.nearDx).toBeLessThan(0); // near leg front, then back
    expect(poses.every((p) => p.farDx === -p.nearDx)).toBe(true);
    expect(poses[0]!.nearLift).toBeGreaterThan(0); expect(poses[4]!.farLift).toBeGreaterThan(0); // passing frames
    expect(poses.filter((p) => p.dip).length).toBe(2);
    expect(astroPose("run", 2).nearDx).toBeGreaterThan(poses[2]!.nearDx); // longer stride when running
  });
});

describe("pixel font", () => {
  it("every glyph is 3×5", () => {
    for (const [c, g] of Object.entries(GLYPHS)) { expect(g, c).toHaveLength(5); for (const r of g) expect(r, c).toHaveLength(3); }
  });
  it("upper-cases and replaces characters it doesn't have", () => {
    expect(toFont("Hold E: seal leak (3 kits)")).toBe("HOLD E: SEAL LEAK (3 KITS)");
    expect(toFont("Cráter…📦")).toBe("CRATER... ");
  });
});
