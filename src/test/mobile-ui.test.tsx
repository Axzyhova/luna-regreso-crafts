import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TouchControls } from "@/components/game/TouchControls";
import { touch } from "@/game/touch";
import { useGame } from "@/game/store";

// jsdom has no PointerEvent: give it one with coordinates so the joystick math runs.
if (!("PointerEvent" in window)) {
  class PE extends MouseEvent { pointerId: number; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; } }
  (window as unknown as { PointerEvent: typeof PE }).PointerEvent = PE;
}

describe("controles táctiles", () => {
  it("el joystick escribe el vector de movimiento y lo suelta al levantar el dedo", () => {
    useGame.getState().newGame("realista", "normal");
    render(<TouchControls />);
    const joy = screen.getByLabelText("Joystick: mover");
    fireEvent.pointerDown(joy, { clientX: 100, clientY: 0, pointerId: 1 });
    expect(touch.vx).toBeCloseTo(1);
    fireEvent.pointerUp(joy, { pointerId: 1 });
    expect(touch.vx).toBe(0);
  });
  it("ACCIÓN usa la herramienta y E se mantiene presionado", () => {
    const use = vi.fn(), interact = vi.fn();
    touch.act = { ...touch.act, use, interact };
    render(<TouchControls />);
    fireEvent.pointerDown(screen.getAllByText("A")[0]!.closest("button")!);
    expect(use).toHaveBeenCalled();
    const e = screen.getAllByText("E")[0]!.closest("button")!;
    fireEvent.pointerDown(e);
    expect(interact).toHaveBeenCalled();
    expect(touch.e).toBe(true);
    fireEvent.pointerUp(e);
    expect(touch.e).toBe(false);
  });
});

import { HUDBottom } from "@/components/game/HUD";
import { MobileMenu } from "@/components/game/TouchControls";

describe("interfaz móvil ordenada", () => {
  it("el inventario está junto a la barra rápida solo en táctil", () => {
    useGame.getState().newGame("realista", "normal");
    const { unmount } = render(<HUDBottom touch />);
    expect(screen.getByText("INV")).toBeTruthy();
    fireEvent.click(screen.getByText("INV").closest("button")!);
    expect(useGame.getState().overlay).toBe("inv");
    unmount(); useGame.getState().setOverlay(null);
    render(<HUDBottom />);
    expect(screen.queryByText("INV")).toBeNull();
  });
  it("el menú ☰ despliega Base, Misiones, Log, Pausa y Pantalla completa", () => {
    useGame.getState().setOverlay(null);
    render(<MobileMenu />);
    fireEvent.click(screen.getByLabelText("Menú"));
    for (const t of ["Base", "Misiones", "Log", "Pausa", "Pantalla completa"]) expect(screen.getByText(t)).toBeTruthy();
    fireEvent.click(screen.getByText("Base"));
    expect(useGame.getState().overlay).toBe("base");
  });
});
