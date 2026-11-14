import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createSim } from "@/game/sim";
import type { World } from "@/game/aliens";
import { stepEffects, toggleEquip, UMBRALES } from "@/game/effects";
import { Vitals, tempToAngle } from "@/components/game/Vitals";
import { useGame, sim } from "@/game/store";

const world: World = { player: { x: 400, y: 300 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 640, h: 360, rnd: () => 0.5 };

describe("cold/heat exposure", () => {
  it("in the blue zone you freeze first and only lose health after the grace time", () => {
    const s = createSim("realista", "normal"); s.temp = -20;
    for (let i = 0; i < UMBRALES.gracia_s - 1; i++) stepEffects(s, 1, world, false);
    expect(s.health).toBe(100);
    expect(s.effects).toContain("frio");
    for (let i = 0; i < 10; i++) stepEffects(s, 1, world, false);
    expect(s.health).toBeLessThan(100);
  });
  it("the thermal suit prevents freezing damage", () => {
    const s = createSim("realista", "normal"); s.temp = -20;
    s.inv.traje_termico = 1; toggleEquip(s, "traje_termico");
    for (let i = 0; i < 30; i++) stepEffects(s, 1, world, false);
    expect(s.health).toBe(100);
    expect(s.coldT).toBe(0);
  });
  it("overheating also damages after the grace time", () => {
    const s = createSim("realista", "normal"); s.temp = 60;
    for (let i = 0; i < UMBRALES.gracia_s + 10; i++) stepEffects(s, 1, world, false);
    expect(s.health).toBeLessThan(100);
  });
});

describe("vitals panel", () => {
  it("maps temperature onto the gauge (cold left, hot right)", () => {
    expect(tempToAngle(UMBRALES.gauge_min)).toBe(-90);
    expect(tempToAngle(UMBRALES.gauge_max)).toBe(90);
    expect(tempToAngle(20)).toBeGreaterThan(tempToAngle(0));
  });
  it("shows health, thermometer and day/night", () => {
    useGame.getState().newGame("realista", "normal");
    sim.health = 72; useGame.getState().publish();
    render(<Vitals />);
    expect(screen.getByText("72 / 100")).toBeTruthy();
    expect(screen.getByLabelText(/Suit temperature/)).toBeTruthy();
    expect(screen.getByLabelText("Day")).toBeTruthy();
  });
});
