import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoticeToast, DeathScreen, AchievementList } from "@/components/game/SurvivalUI";
import { useGame, sim } from "@/game/store";
import { unlock } from "@/game/sim";

describe("survival UI", () => {
  it("shows an achievement pop-up", () => {
    useGame.getState().newGame("realista", "normal");
    unlock(sim, "Leak-free night"); useGame.getState().publish();
    render(<NoticeToast />);
    expect(screen.getByText("Achievement unlocked")).toBeTruthy();
    expect(screen.getByText("Leak-free night")).toBeTruthy();
  });
  it("lists achievements with a counter", () => {
    render(<AchievementList />);
    expect(screen.getByText(/1 of 5/)).toBeTruthy();
  });
  it("death screen respawns the player", () => {
    useGame.getState().newGame("realista", "normal");
    sim.inv.metal = 3;
    sim.dead = { cause: "froze to death", x: 300, y: 200 }; useGame.getState().publish();
    render(<DeathScreen />);
    expect(screen.getByText("YOU DIED!")).toBeTruthy();
    expect(screen.getByText(/froze to death/)).toBeTruthy();
    fireEvent.click(screen.getByText("RESPAWN"));
    expect(sim.dead).toBeNull();
    expect(sim.drops).toHaveLength(1);
  });
});
