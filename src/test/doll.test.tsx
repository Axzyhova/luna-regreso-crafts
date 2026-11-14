import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharacterDoll, dollPixels } from "@/components/game/CharacterDoll";
import { useGame, sim } from "@/game/store";
import { PAL } from "@/game/palette";

const count = (g: (number | null)[][], c: number) => g.flat().filter((x) => x === c).length;

describe("inventory paper doll", () => {
  it("draws each piece of gear as its own layer", () => {
    const base = dollPixels([]);
    expect(count(dollPixels(["traje_termico"]), PAL.alert)).toBeGreaterThan(count(base, PAL.alert) + 20); // orange suit
    expect(count(dollPixels(["escudo_radiacion"]), PAL.gold)).toBeGreaterThan(count(base, PAL.gold)); // riveted plate
    expect(dollPixels(["capa_reflectante"]).flat().filter((x) => x !== null).length).toBeGreaterThan(base.flat().filter((x) => x !== null).length); // cape behind the legs
  });

  it("dropping gear on the astronaut equips it; tapping the slot takes it off", () => {
    useGame.getState().newGame("realista", "normal");
    sim.inv.traje_termico = 1; useGame.getState().publish();
    render(<CharacterDoll />);
    const doll = document.querySelector("[data-doll]")!;
    fireEvent.drop(doll, { dataTransfer: { getData: (t: string) => (t === "text/item" ? "traje_termico" : "") } });
    expect(sim.equip).toContain("traje_termico");
    expect(screen.getByLabelText(/Thermal suit/)).toBeTruthy();
    fireEvent.click(screen.getByText("SUIT").closest("button")!);
    expect(sim.equip).not.toContain("traje_termico");
  });

  it("refuses items that aren't gear", () => {
    useGame.getState().newGame("realista", "normal");
    render(<CharacterDoll />);
    fireEvent.drop(document.querySelector("[data-doll]")!, { dataTransfer: { getData: () => "hielo" } });
    expect(sim.equip).toHaveLength(0);
    expect(screen.getByText("Only gear can be worn")).toBeTruthy();
  });
});
