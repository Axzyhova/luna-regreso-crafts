import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import misiones from "@/data/misiones.json";
import fuentes from "@/data/fuentes.json";
import { EXPEDICIONES, TRIPULACION, DATOS, expedicion, countByTipo } from "@/game/history";
import { ArchiveContent } from "@/components/game/ArchivePanel";
import { createSim, notify } from "@/game/sim";
import { stepQuests } from "@/game/quests";

describe("NASA archive data", () => {
  it("every expedition is complete, unique and uses a known category", () => {
    const ids = new Set<string>();
    for (const e of EXPEDICIONES) {
      expect(ids.has(e.id), `duplicate ${e.id}`).toBe(false); ids.add(e.id);
      expect(e.nombre.trim().length, `${e.id}.nombre`).toBeGreaterThanOrEqual(5);
      for (const k of ["resumen", "leccion", "juego", "dato"] as const) expect(e[k].trim().length, `${e.id}.${k}`).toBeGreaterThan(20);
      expect(e.agencia.trim().length, `${e.id}.agencia`).toBeGreaterThanOrEqual(4);
      expect(["exito", "fallo", "mixto"]).toContain(e.tipo);
      expect(e.tripulacion.length).toBeGreaterThan(0);
      expect(e.dato.length, `${e.id} pop-up text fits`).toBeLessThanOrEqual(64);
      expect(e.fecha).toMatch(/(19|20)\d\d/); // every entry is dated
    }
  });

  it("covers successes, failures and failures that were overcome", () => {
    expect(countByTipo("exito")).toBeGreaterThanOrEqual(5);
    expect(countByTipo("fallo")).toBeGreaterThanOrEqual(3);
    expect(countByTipo("mixto")).toBeGreaterThanOrEqual(3);
  });

  it("the famous crews are complete (names checked against NASA records)", () => {
    const crew = (id: string) => expedicion(id)!.tripulacion.join(" | ");
    expect(expedicion("challenger")!.tripulacion).toHaveLength(7); expect(crew("challenger")).toContain("McAuliffe"); expect(crew("challenger")).toContain("Scobee");
    expect(expedicion("columbia")!.tripulacion).toHaveLength(7); expect(crew("columbia")).toContain("Chawla"); expect(crew("columbia")).toContain("Ramon");
    expect(expedicion("apollo1")!.tripulacion).toHaveLength(3); expect(crew("apollo1")).toContain("Chaffee");
    expect(expedicion("apollo11")!.tripulacion).toHaveLength(3); expect(crew("apollo11")).toContain("Armstrong"); expect(crew("apollo11")).toContain("Collins");
    expect(expedicion("apollo13")!.tripulacion).toHaveLength(3); expect(crew("apollo13")).toContain("Swigert");
    expect(expedicion("apollo17")!.tripulacion).toHaveLength(3); expect(crew("apollo17")).toContain("Schmitt");
  });

  it("the fictional crew is named and clearly labelled as fiction in the sources", () => {
    expect(TRIPULACION.map((c) => c.nombre.split(" ").pop())).toEqual(expect.arrayContaining(["Rivera", "Weber", "Tanaka", "Ortega", "ARIA"]));
    expect(fuentes.some((f) => f.tipo === "FICTION" && f.titulo.includes("SELENE-7"))).toBe(true);
    expect(fuentes.filter((f) => f.tipo === "EXTERNAL").length).toBeGreaterThanOrEqual(14);
    expect(DATOS.length).toBeGreaterThanOrEqual(8);
  });

  it("every mission points at a real archive entry", () => {
    for (const q of [...misiones.principales, ...misiones.secundarias] as { id: string; inspirado?: string }[]) if (q.inspirado) expect(expedicion(q.inspirado), `${q.id} -> ${q.inspirado}`).toBeTruthy();
    expect(misiones.principales.every((q) => !!(q as { inspirado?: string }).inspirado)).toBe(true);
  });

  it("finishing a mission pops up the matching NASA file", () => {
    const s = createSim("realista", "normal");
    s.actFlags.leakFixed = true; // mission 1: seal a leak -> Apollo 13
    stepQuests(s);
    const titles = s.notices.map((n) => n.title);
    expect(titles).toContain("Mission complete");
    expect(titles.some((t) => t.includes("Apollo 13"))).toBe(true);
    expect(s.log.some((l) => l.text.includes("NASA file"))).toBe(true);
    void notify;
  });
});

describe("Archive screen", () => {
  it("browses expeditions, filters by outcome and shows the lesson", () => {
    render(<ArchiveContent />);
    expect(screen.getByRole("list", { name: "Expeditions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /FAILURE/ }));
    const items = screen.getByRole("list", { name: "Expeditions" }).querySelectorAll("li");
    expect(items.length).toBe(countByTipo("fallo"));
    fireEvent.click(screen.getByText("Space Shuttle Challenger · STS-51-L"));
    expect(screen.getByText(/WHAT IT TAUGHT/)).toBeTruthy();
    expect(screen.getAllByText(/O-ring/).length).toBeGreaterThan(0);
  });

  it("shows the crew and the facts tabs", () => {
    render(<ArchiveContent />);
    fireEvent.click(screen.getByRole("button", { name: "SELENE-7 CREW" }));
    expect(screen.getByText("Cmdr. Alex Rivera")).toBeTruthy(); expect(screen.getByText("Dr. Aiko Tanaka")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "DID YOU KNOW?" }));
    expect(screen.getAllByRole("listitem").length).toBe(DATOS.length);
  });
});
