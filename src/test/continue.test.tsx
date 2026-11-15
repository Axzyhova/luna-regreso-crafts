import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Intro } from "@/components/game/Screens";
import { useGame, sim, saveGame } from "@/game/store";
import { createSim, giveItem, usedSlots, SLOTS, type Inv } from "@/game/sim";
import { resolveSpecialCase } from "@/game/events";
import { zoneAt } from "@/game/sim";

beforeEach(() => { cleanup(); localStorage.clear(); useGame.setState({ screen: "intro", overlay: null }); });

describe("saved games can be loaded again", () => {
  it("the title offers no Continue without a save", () => {
    render(<Intro />);
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
    expect(screen.getByRole("button", { name: /accept/i })).toBeTruthy();
  });

  it("Continue restores the saved game and enters play", () => {
    useGame.getState().newGame("fantastico", "dificil");
    sim.day = 7; sim.inv.metal = 33; sim.lh2 = 2.5;
    saveGame();
    useGame.getState().newGame("realista", "normal"); // something else is in memory now
    render(<Intro />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    const s = useGame.getState();
    expect(s.screen).toBe("juego");
    expect(s.snap).toMatchObject({ mode: "fantastico", difficulty: "dificil", day: 7, lh2: 2.5 });
    expect(s.snap.inv.metal).toBe(33);
  });

  it("a broken save does not crash: it tells the player and stays on the title", () => {
    saveGame();
    const key = Object.keys(localStorage)[0]!; // whatever key the store uses
    localStorage.setItem(key, "{not json");
    render(<Intro />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(useGame.getState().screen).toBe("intro");
    expect(screen.getByText(/could not be loaded/i)).toBeTruthy();
  });
});

describe("rewards are never lost to a full inventory", () => {
  const full = () => {
    const s = createSim("realista", "normal");
    for (const k of Object.keys(s.inv) as (keyof Inv)[]) s.inv[k] = 0;
    for (const k of (Object.keys(s.inv) as (keyof Inv)[]).filter((k) => k !== "agua" && k !== "titanio" && k !== "kits").slice(0, SLOTS)) s.inv[k] = 1;
    expect(usedSlots(s.inv)).toBe(SLOTS);
    return s;
  };

  it("what does not fit is left in a bag at your feet", () => {
    const s = full(); s.pos = { x: 300, y: 300 };
    expect(giveItem(s, "titanio", 3)).toBe(0);
    expect(s.inv.titanio).toBe(0);
    expect(s.drops).toHaveLength(1);
    expect(s.drops[0]).toMatchObject({ kind: "thrown", items: { titanio: 3 } });
    giveItem(s, "kits", 2);
    expect(s.drops).toHaveLength(1); expect(s.drops[0]!.items).toEqual({ titanio: 3, kits: 2 }); // same bag
  });

  it("with room, everything goes straight to the inventory", () => {
    const s = createSim("realista", "normal");
    expect(giveItem(s, "titanio", 3)).toBe(3); expect(s.inv.titanio).toBe(3); expect(s.drops).toHaveLength(0);
  });

  it("special cases pay out even when you are full", () => {
    const s = full();
    s.specialCase = { id: "x", title: "T", desc: "", x: 0, y: 0, reward: { titanio: 3, kits: 2 }, t: 50 };
    expect(resolveSpecialCase(s)).toBe(true);
    expect(s.drops[0]!.items).toMatchObject({ titanio: 3, kits: 2 });
  });
});

describe("special cases are where their text says", () => {
  it("the cryo vein is in the Frozen Basin and the thermal anomaly in the Scorch Fields", () => {
    expect(zoneAt(300, 800).id).toBe("ice");
    expect(zoneAt(1400, 200).id).toBe("fire");
    expect(zoneAt(920, 160).id).toBe("base");
  });
});
