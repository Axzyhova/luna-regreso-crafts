import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { boardingTimeline, boardingAt, ladderBase, hatchPos, BOARD_STEPS } from "@/game/ending";
import { ROCKET } from "@/game/world";
import { Regreso, Final } from "@/components/game/Screens";
import { ENDING_PANELS, ENDING_SCENES } from "@/components/game/scenes";
import { useGame, sim } from "@/game/store";

afterEach(() => cleanup());

describe("launch ending: boarding the rocket", () => {
  const tl = boardingTimeline({ x: ROCKET.x - 80, y: ROCKET.y + 60 }, ROCKET);

  it("walks to the ladder, climbs to the hatch, goes inside, then the rocket lifts off", () => {
    const at = (t: number) => boardingAt(t, tl);
    expect(at(0).phase).toBe("walk");
    expect(at(tl.walk - 0.01).px).toBeCloseTo(ladderBase(ROCKET).x, 0);
    const c0 = at(tl.walk + 0.01), c1 = at(tl.walk + BOARD_STEPS.climb - 0.01);
    expect(c0.phase).toBe("climb");
    expect(c1.py).toBeLessThan(c0.py); // going up the ladder
    expect(c1.py).toBeCloseTo(hatchPos(ROCKET).y, 0);
    const inside = at(tl.walk + BOARD_STEPS.climb + BOARD_STEPS.hatch - 0.01);
    expect(inside.alpha).toBe(0);
    expect(inside.hatch).toBeLessThan(0.05); // hatch shut behind you
    const ign = at(tl.walk + BOARD_STEPS.climb + BOARD_STEPS.hatch + 1);
    expect(ign.phase).toBe("ignite");
    expect(ign.flame).toBeGreaterThan(0);
    expect(ign.rocketDy).toBe(0); // still on the pad
    const rise = at(tl.total - 1);
    expect(rise.phase).toBe("rise");
    expect(rise.rocketDy).toBeLessThan(-150);
    expect(at(tl.total + 0.1).phase).toBe("done");
    expect(at(tl.total + 0.1).fade).toBe(1);
  });

  it("the walk takes longer from farther away, but is capped", () => {
    const near = boardingTimeline({ x: ROCKET.x, y: ROCKET.y + 34 }, ROCKET).walk;
    const far = boardingTimeline({ x: ROCKET.x - 400, y: ROCKET.y + 200 }, ROCKET).walk;
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(4.5);
  });
});

describe("the way home: Earth return panels", () => {
  it("tells reentry, parachutes, splashdown off Arriaga–Tonalá and the recovery, in order", () => {
    expect(ENDING_PANELS.map((p) => p.art)).toEqual(ENDING_SCENES);
    const all = ENDING_PANELS.map((p) => p.text).join(" ");
    for (const w of ["Chiapas", "Arriaga", "Tonalá", "Pacific", "Splashdown", "recovery ship", "rescue team", "divers"]) expect(all).toContain(w);
  });

  it("plays the panels and then shows the final report", () => {
    useGame.setState({ screen: "regreso" });
    render(<Regreso />);
    expect(screen.getByAltText("Animated scene: reentry")).toBeTruthy();
    for (let i = 0; i < ENDING_PANELS.length - 1; i++) act(() => { fireEvent.click(screen.getByText("Next")); });
    expect(screen.getByAltText("Animated scene: ship")).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText("Mission report")); });
    expect(useGame.getState().screen).toBe("final");
  });

  it("the final report names the splashdown and can replay the way home", () => {
    sim.result = { ok: true, dia: 3, ventana: "V1", lh2Sobra: 6, loxSobra: 38, destino: "earth" };
    useGame.getState().publish();
    render(<Final />);
    expect(screen.getByText(/Arriaga–Tonalá \(Chiapas, Mexico\)/)).toBeTruthy();
    act(() => { fireEvent.click(screen.getByText("Watch the way home")); });
    expect(useGame.getState().screen).toBe("regreso");
  });
});
