import { describe, it, expect } from "vitest";
import personal from "@/data/personal.json";
import subs from "@/data/subsistemas_cohete.json";
import { createSim, sleepUntilDawn, isDay, personalUnlocked, phaseOf, DAY_LEN } from "@/game/sim";
import { itemSources } from "@/game/sources";
import { ROBERT } from "@/game/robert";

describe("habitat bed", () => {
  it("only sleeps at night, skips to dawn and rests you", () => {
    const s = createSim("realista", "normal");
    expect(sleepUntilDawn(s).ok).toBe(false); // daytime
    s.time = DAY_LEN + 30; s.fatigue = 80; s.leaks = [];
    const day = s.day;
    expect(sleepUntilDawn(s).ok).toBe(true);
    expect(isDay(s)).toBe(true);
    expect(s.day).toBe(day + 1);
    expect(s.fatigue).toBe(0);
  });
  it("won't sleep with an open leak", () => {
    const s = createSim("realista", "normal");
    s.time = DAY_LEN + 30;
    s.leaks = [{ id: 1, target: "habitat", x: 0, y: 0, size: 1, progress: 0, age: 0 }] as typeof s.leaks;
    expect(sleepUntilDawn(s).msg).toMatch(/leak/i);
  });
});

describe("diary and album", () => {
  it("start with some pages/photos and unlock more with days and missions", () => {
    const s = createSim("realista", "normal");
    const open = (list: { unlock: object }[]) => list.filter((x) => personalUnlocked(s, x.unlock)).length;
    const p0 = open(personal.diario), a0 = open(personal.album);
    expect(p0).toBeGreaterThan(0); expect(a0).toBeGreaterThan(0);
    s.day = 10; s.quest.main = 7;
    expect(open(personal.diario)).toBe(personal.diario.length);
    expect(open(personal.album)).toBe(personal.album.length);
  });
});

describe("day-only and night-only resources", () => {
  it("are tagged and needed by the rocket, so both halves of the day matter", () => {
    expect(phaseOf("vidrio_solar")).toBe("day");
    expect(phaseOf("cristal_estelar")).toBe("night");
    expect(phaseOf("hielo")).toBeNull();
    const need = subs.subsistemas.flatMap((x) => Object.keys(x.ingredientes));
    expect(need).toContain("vidrio_solar");
    expect(need).toContain("cristal_estelar");
    expect(itemSources("vidrio_solar").join(" ")).toMatch(/DAY ONLY/);
    expect(itemSources("cristal_estelar").join(" ")).toMatch(/NIGHT ONLY/);
    expect(ROBERT.areas.some((a) => a.id === "daynight")).toBe(true);
  });
});
