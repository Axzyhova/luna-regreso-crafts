import { describe, it, expect } from "vitest";
import recetas from "@/data/recetas.json";
import { createSim, stepBaseTech, upgradeRobert, unlockRobertSkill, setRobertMat, setRobertSkin, robertUpCost, ROBERT_MAX_LEVEL, PLACEABLE } from "@/game/sim";

describe("Robert Station", () => {
  it("is a Workshop module you can place", () => {
    expect(recetas.find((r) => r.id === "robot_lab")?.lugar).toBe("taller");
    expect(PLACEABLE["robot_lab"]).toBe("robot_lab");
  });
  it("levels Robert up to 5 with growing costs", () => {
    const s = createSim("realista", "normal");
    expect(upgradeRobert(s)).toBe(false); // can't afford
    Object.assign(s.inv, { metal: 99, chatarra: 99, baterias: 9, titanio: 9 });
    while (upgradeRobert(s));
    expect(s.robert.level).toBe(ROBERT_MAX_LEVEL);
    expect(robertUpCost(4)["titanio"]).toBe(2);
  });
  it("unlocks skills once, tunes the skin and the gathered material", () => {
    const s = createSim("realista", "normal");
    Object.assign(s.inv, { metal: 20, chatarra: 10, baterias: 2, botiquin: 1 });
    expect(unlockRobertSkill(s, "forager")).toBe(true);
    expect(unlockRobertSkill(s, "forager")).toBe(false);
    expect(setRobertMat(s, "hielo")).toBe(true);
    expect(setRobertMat(s, "kits")).toBe(false);
    expect(setRobertSkin(s, "red")).toBe(true);
    expect(s.robert).toMatchObject({ mat: "hielo", skin: "red", skills: ["forager"] });
  });
  it("Med-bot heals you over time", () => {
    const s = createSim("realista", "normal");
    s.robert.skills.push("medic"); s.health = 50;
    for (let i = 0; i < 60; i++) stepBaseTech(s, 1, true);
    expect(s.health).toBeGreaterThan(51);
  });
});

describe("Robert Station — Auto-Miner Rovers", () => {
  it("levels, skills and paint change every rover's stats", async () => {
    const { upgradeRovers, unlockRoverSkill, setRoverSkin, roverSpeed, roverMineS, roverLoad, ROVER_SPEED, ROVER_MINE_S, ROVER_LOAD } = await import("@/game/sim");
    const s = createSim("realista", "normal");
    expect([roverSpeed(s), roverMineS(s), roverLoad(s)]).toEqual([ROVER_SPEED, ROVER_MINE_S, ROVER_LOAD]);
    Object.assign(s.inv, { metal: 99, chatarra: 99, baterias: 9, titanio: 9, cristal_hielo: 4 });
    expect(upgradeRovers(s)).toBe(true);
    for (const id of ["turbo", "cargo", "drill"]) expect(unlockRoverSkill(s, id)).toBe(true);
    expect(setRoverSkin(s, "green")).toBe(true);
    expect(roverLoad(s)).toBe(ROVER_LOAD + 1 + 3);
    expect(roverMineS(s)).toBe(ROVER_MINE_S / 2);
    expect(roverSpeed(s)).toBeCloseTo(ROVER_SPEED * 1.1 * 1.4);
    expect(s.roverTech.skin).toBe("green");
  });
});
