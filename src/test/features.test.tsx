import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createSim, step, addItem, healInHabitat } from "@/game/sim";
import { consumeItem, stepPsychology } from "@/game/effects";
import { stepEvents, stepSpecialCases, resolveSpecialCase, spawnCave, strikeCaveAlien, openCaveChest, unlockCavePerk, hitAndroid, stepEmergingProblems } from "@/game/events";
import { missionHelp } from "@/game/nav";
import { NavCard } from "@/components/game/StoryUI";
import { sunShadow } from "@/game/visualFx";
import { FX_CATALOG } from "@/game/pixelfxBridge";
import { createFx, createFrame, clearFrame } from "@/game/pixelfx/core/index.js";
import { SUBZONAS, stepBosses, hitBoss, checkSubzoneVisit } from "@/game/zones";
import { FieldGuidePanel } from "@/components/game/FieldGuidePanel";
import { MapPanel } from "@/components/game/MapPanel";
import { ModeSelect } from "@/components/game/Screens";
import { PickupFeed } from "@/components/game/HUD";
import { CavePanel } from "@/components/game/CavePanel";
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
    const sz = checkSubzoneVisit(s, 644, 112);
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

  it("ModeSelect shows only Start (no Continue) and goes to story", () => {
    localStorage.setItem("varados_save_v3", JSON.stringify(createSim("realista", "normal")));
    useGame.setState({ screen: "modo" });
    render(<ModeSelect />);
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(useGame.getState().screen).toBe("cinematica");
  });

  it("pickup feed tracks collected items and renders counter", () => {
    const s = createSim("realista", "normal");
    addItem(s, "hielo", 3);
    expect(s.pickupFeed[0]?.item).toBe("hielo");
    expect(s.pickupFeed[0]?.n).toBe(3);
    useGame.setState({ snap: s });
    render(<PickupFeed />);
    expect(screen.getByText(/\+3 Ice/i)).toBeInTheDocument();
  });

  it("meteor caves spawn cave aliens, rare chests, and superpower perks", () => {
    const s = createSim("realista", "normal");
    const cave = spawnCave(s, 250, 200, () => 0);
    s.activeCaveId = cave.id;
    expect(cave.alienHp).toBeGreaterThan(0);

    // Defeat cave alien
    for (let i = 0; i < 10 && cave.alienHp > 0; i++) strikeCaveAlien(s, cave.id, 2);
    expect(cave.alienHp).toBe(0);

    // Unlock superpower & rare chest
    const perk = unlockCavePerk(s, cave.id, () => 0);
    expect(perk).toBeTruthy();
    expect(s.perks.length).toBe(1);

    const loot = openCaveChest(s, cave.id, () => 0);
    expect(loot.length).toBeGreaterThan(0);
    expect(cave.chestOpened).toBe(true);

    useGame.setState({ snap: s, overlay: "cueva" });
    render(<CavePanel />);
    expect(screen.getByText(/METEOR CAVE/i)).toBeInTheDocument();
  });

  it("rogue android drop spawns androids and hitAndroid awards loot on defeat", () => {
    const s = createSim("realista", "normal");
    s.event = { id: "lluvia_androides", phase: "aviso", t: 0.1, x: 400, y: 300, hits: 0, maxDose: 0 };
    const w = { player: { x: 400, y: 300 }, inHabitat: false, hab: { x: 480, y: 360 }, rocket: { x: 430, y: 240 }, w: 960, h: 720, rnd: () => 0.1 };
    stepEvents(s, 0.2, w); // transitions aviso -> activo
    stepEvents(s, 6, w);   // spawns androids during activo
    expect(s.androids.length).toBeGreaterThan(0);

    const target = s.androids[0]!;
    const beforeMetal = s.inv.metal;
    for (let i = 0; i < 4; i++) hitAndroid(s, target.x, target.y, 1);
    expect(s.androids.some((a) => a.id === target.id)).toBe(false);
    expect(s.inv.metal).toBeGreaterThan(beforeMetal);
  });

  it("emerging problems trigger operational failures over time", () => {
    const s = createSim("realista", "normal");
    s.problemT = 0.1;
    stepEmergingProblems(s, 0.2, () => 0);
    expect(s.toast).toBeTruthy();
  });

  it("NavCard displays live coordinates and missionHelp orientation", () => {
    const s = createSim("realista", "normal");
    s.tut.step = 99;
    s.pos = { x: 412, y: 298 };
    s.radar = [{ k: "base", dx: 68, dy: 62 }];
    useGame.setState({ snap: s });
    render(<NavCard />);
    expect(screen.getByText("(412, 298)")).toBeInTheDocument();
    expect(screen.getByText(missionHelp(s))).toBeInTheDocument();
  });

  it("ModeSelect shows gameplay differences when switching difficulties", () => {
    render(<ModeSelect />);
    expect(screen.getByText(/NORMAL · REALISTIC/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hard/i }));
    expect(screen.getByText(/\+40%/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Easy/i }));
    expect(screen.getByText(/\+2 Kits, \+1 Ration/i)).toBeInTheDocument();
  });

  it("O2 depletion causes suffocation damage and healInHabitat restores HP using water", () => {
    const s = createSim("realista", "normal");
    s.suitO2 = 0;
    s.health = 80;
    step(s, 2, { inHabitat: false, inShadow: false });
    expect(s.health).toBeLessThan(70);
    expect(s.alert).toMatch(/OXYGEN DEPLETED/i);

    s.near.habitat = true;
    s.inv.agua = 10;
    const beforeHp = s.health;
    const res = healInHabitat(s);
    expect(res.ok).toBe(true);
    expect(s.health).toBeGreaterThan(beforeHp);
    expect(s.inv.agua).toBe(5);
  });

  it("unsealed leaks drain battery and crew morale", () => {
    const s = createSim("realista", "normal");
    s.battery = 50;
    s.sanity = 80;
    s.leaks.push({ id: 1, target: "habitat", x: 110, y: 170, size: 2, progress: 0, age: 0 });
    step(s, 5, { inHabitat: false, inShadow: false });
    expect(s.battery).toBeLessThan(50);
    expect(s.sanity).toBeLessThan(80);
  });

  it("sunShadow sweeps directional shadows across day and dims at night", () => {
    const dawn = sunShadow(10);
    const noon = sunShadow(180);
    const dusk = sunShadow(340);
    const night = sunShadow(450);
    expect(dawn.ox).toBeGreaterThan(0);
    expect(dusk.ox).toBeLessThan(0);
    expect(Math.abs(noon.ox)).toBeLessThan(Math.abs(dawn.ox));
    expect(night.alpha).toBeLessThan(dawn.alpha);
  });

  it("pixelfx effects instantiate, step, and draw into pixel/light buffers", () => {
    const frame = createFrame(64, 64);
    clearFrame(frame);
    const fx = createFx(FX_CATALOG.collectBurst, { x: 32, y: 32 });
    fx.update(0.05);
    fx.draw(frame, "front");
    expect(frame.color.some((v) => v > 0)).toBe(true);
    expect(fx.done()).toBe(false);
  });
});
