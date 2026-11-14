import { describe, it, expect } from "vitest";
import { runState, strideFrame, WINDED_AT, RECOVER_AT } from "@/game/movement";
import { GLYPHS, toFont } from "@/game/pixelfont";

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
  it("cycles 4 frames, faster when running, lifting the body on passing frames", () => {
    expect([0, 0.13, 0.26, 0.38].map((t) => strideFrame(t, false).frame)).toEqual([0, 1, 2, 3]);
    expect(strideFrame(0.1, true).frame).toBe(1);
    expect(strideFrame(0.13, false).lift).toBe(1);
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
