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
  it("death screen requires choosing a reserve to sacrifice on normal mode", () => {
    useGame.getState().newGame("realista", "normal");
    sim.inv.metal = 3;
    sim.inv.racion = 1;
    sim.dead = { cause: "froze to death", x: 300, y: 200 }; useGame.getState().publish();
    render(<DeathScreen />);
    expect(screen.getByText("YOU DIED!")).toBeTruthy();
    expect(screen.getByText(/froze to death/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sacrifice Metal/i }));
    expect(sim.dead).toBeNull();
    expect(sim.inv.metal).toBe(0);
    expect(sim.drops).toHaveLength(1);
  });

  it("hard mode death screen is total loss game over with no respawn", () => {
    useGame.getState().newGame("realista", "dificil");
    sim.dead = { cause: "suffocated", x: 300, y: 200 }; useGame.getState().publish();
    render(<DeathScreen />);
    expect(screen.getByText(/GAME OVER — TOTAL LOSS/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sacrifice/i })).toBeNull();
  });
});
