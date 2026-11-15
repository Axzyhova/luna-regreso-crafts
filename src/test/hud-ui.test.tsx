import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavCard, AlertsPanel, unwrapAngle } from "@/components/game/StoryUI";
import { useGame, sim } from "@/game/store";

describe("unified HUD", () => {
  it("the compass needle takes the short way round (350° → 10° is +20°, not -340°)", () => {
    expect(unwrapAngle(350, 10)).toBe(370);
    expect(unwrapAngle(10, 350)).toBe(-10);
    expect(unwrapAngle(720, 90)).toBe(810);
  });

  it("the navigation chip points to a leak and switches to the alert tone", () => {
    useGame.getState().newGame("realista", "normal");
    sim.leaks.push({ id: 1, target: "habitat", x: 120, y: 178, size: 1, progress: 0, age: 0 });
    sim.radar = [{ k: "fuga", dx: 40, dy: 0 }, { k: "base", dx: 0, dy: -20 }];
    useGame.getState().publish();
    const { container } = render(<NavCard />);
    expect(screen.getByText(/LEAK/)).toBeTruthy();
    expect(container.firstElementChild!.className).toContain("tr-hud-alert");
  });

  it("alerts panel lists warnings and collapses to its badge", () => {
    useGame.getState().newGame("realista", "normal");
    sim.alert = "LEAK! HABITAT"; useGame.getState().publish();
    render(<AlertsPanel />);
    const toggle = screen.getByRole("button", { name: /ALERTS/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/LEAK! HABITAT/)).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
