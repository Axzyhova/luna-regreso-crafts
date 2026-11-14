import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CubeSatDesigner } from "@/components/game/CubeSatDesigner";
import { useGame, sim } from "@/game/store";

const cell = (x: number, y: number) => screen.getAllByRole("button").filter((b) => b.title === "Click to place" || b.title.includes("click to remove"))[y * 3 + x]!;
const pick = (name: string) => fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent?.startsWith(name))!);

describe("diseñador del CubeSat relé", () => {
  it("colocar piezas hasta un diseño viable y lanzarlo", () => {
    useGame.getState().newGame("realista", "normal");
    Object.assign(sim.inv, { metal: 10, chatarra: 10, regolito: 10 });
    sim.lh2 = 10; sim.lox = 60;
    useGame.getState().publish();
    render(<CubeSatDesigner />);
    expect(screen.getByText(/Needs a radio/)).toBeTruthy();
    pick("Solar panel"); fireEvent.click(cell(0, 0)); fireEvent.click(cell(0, 1));
    pick("Radio"); fireEvent.click(cell(0, 2));
    pick("Computer"); fireEvent.click(cell(2, 0));
    pick("Battery"); fireEvent.click(cell(2, 1));
    expect(sim.cubesat).toHaveLength(5);
    expect(screen.getByText("✔ Viable design")).toBeTruthy();
    fireEvent.click(screen.getByText("Launch relay"));
    expect(sim.relay).toBe(true);
    expect(screen.getByText(/The relay is in orbit/)).toBeTruthy();
  });
});
