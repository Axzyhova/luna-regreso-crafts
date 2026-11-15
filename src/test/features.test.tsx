import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createSim, step, addItem } from "@/game/sim";
import { consumeItem, stepPsychology } from "@/game/effects";
import { stepEvents, stepSpecialCases, resolveSpecialCase } from "@/game/events";
import { SUBZONAS, stepBosses, hitBoss, checkSubzoneVisit } from "@/game/zones";
import { FieldGuidePanel } from "@/components/game/FieldGuidePanel";
import { MapPanel } from "@/components/game/MapPanel";
import { useGame } from "@/game/store";

describe("Lunar survival & exploration expansions", () => {
  it("food items (racion & comida_caliente) restore health and sanity", () => {
    const s = createSim("realista", "normal");
    s.health = 40;
    s.sanity = 50;
    s.coldT = 10;
    s.psychEffect = { id: "vertigo_gravedad", t: 15 };
    addItem(s, "racion", 1);
    addItem(s, "comida_caliente", 1);

    expect(consumeItem(s, "racion")).toBe(true);
    expect(s.health).toBe(65);
    expect(s.sanity).toBe(65);

    expect(consumeItem(s, "comida_caliente")).toBe(true);
    expect(s.health).toBe(100);
    expect(s.sanity).toBe(90);
    expect(s.coldT).toBe(0);
    expect(s.psychEffect).toBeNull();
  });

  it("crew psychology & 0.165g gravity formula drains sanity far from base and triggers an effect", () => {
    const s = createSim("fantastico", "normal");
    s.sanity = 40;
    s.psychCheckT = 0.5;
    const w = { player: { x: 1150, y: 620 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 1280, h: 720, rnd: () => 0.1 };
    stepPsychology(s, 1, w, () => 0.05);
    expect(s.sanity).toBeLessThan(40);
    expect(s.psychEffect).not.toBeNull();
  });

  it("neglecting leaks while far from base degrades rocket subsystems and shows required kit material", () => {
    const s = createSim("realista", "normal");
    s.leaks.push({ id: 1, target: "lh2", x: 515, y: 150, size: 1, progress: 0, age: 0 });
    const beforeProp = s.rocket["Propulsion"]!;
    for (let i = 0; i < 26; i++) {
      step(s, 1, { inHabitat: false, inShadow: false, distFromHab: 500 });
    }
    expect(s.rocket["Propulsion"]).toBeLessThan(beforeProp);
    expect(s.alert).toContain("Sealant kit");
    expect(s.alert).toContain("2 Scrap + 1 Metal");
  });

  it("neglecting a solar flare damages Communications", () => {
    const s = createSim("realista", "normal");
    s.rocket["Communications"] = 30;
    s.event = { id: "llamarada_solar", phase: "activo", t: 0.5, x: 100, y: 100, hits: 0, maxDose: 70 };
    const w = { player: { x: 200, y: 200 }, inHabitat: false, hab: { x: 110, y: 170 }, rocket: { x: 540, y: 150 }, w: 1280, h: 720, rnd: () => 0.5 };
    stepEvents(s, 1, w);
    expect(s.rocket["Communications"]).toBe(26);
  });

  it("special cases spawn, resolve and grant rewards", () => {
    const s = createSim("realista", "normal");
    s.nextCaseT = 0.5;
    stepSpecialCases(s, 1, () => 0);
    expect(s.specialCase).not.toBeNull();
    expect(resolveSpecialCase(s)).toBe(true);
    expect(s.casesDone).toBe(1);
    expect(s.specialCase).toBeNull();
  });

  it("dedicated resource lands, far bosses and field guide work together", () => {
    const s = createSim("realista", "normal");
    expect(SUBZONAS.length).toBeGreaterThanOrEqual(9);
    const sz = checkSubzoneVisit(s, 465, 90);
    expect(sz?.id).toBe("tierra_chatarra");
    expect(s.subzonesVisited).toContain("tierra_chatarra");

    stepBosses(s, 0.1, { x: 110, y: 635 });
    expect(s.bosses.length).toBe(3);
    const cryo = s.bosses.find((b) => b.id === "espectro_crio")!;
    cryo.hp = 1;
    hitBoss(s, cryo.x, cryo.y, 2);
    expect(s.bossesDefeated).toContain("espectro_crio");
    expect(s.inv.cristal_hielo).toBeGreaterThanOrEqual(4);

    useGame.setState({ snap: s, overlay: "guia" });
    render(<FieldGuidePanel />);
    expect(screen.getByText(/FIELD GUIDE/i)).toBeInTheDocument();
    expect(screen.getByText("Sealant kit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /CREATURES/i }));
    expect(screen.getByText(/Cryo Warden/i)).toBeInTheDocument();
  });

  it("integrated map renders subzone info", () => {
    const s = createSim("realista", "normal");
    useGame.setState({ snap: s, overlay: "mapa" });
    render(<MapPanel />);
    expect(screen.getByText("MAP")).toBeInTheDocument();
    expect(screen.getByText(/Resource Land/i)).toBeInTheDocument();
    expect(screen.getByText(/Far Boss Zone/i)).toBeInTheDocument();
  });
});
