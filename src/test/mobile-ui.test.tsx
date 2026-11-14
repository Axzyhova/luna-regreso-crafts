import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DPad, ActionPad, MenuBar, padDirection } from "@/components/game/TouchControls";
import { RotateNotice } from "@/components/game/MobileLayout";
import { HUDBottom } from "@/components/game/HUD";
import { touch } from "@/game/touch";
import { useGame } from "@/game/store";

// jsdom has no PointerEvent: give it one with coordinates so the D-pad math runs.
if (!("PointerEvent" in window)) {
  class PE extends MouseEvent { pointerId: number; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; } }
  (window as unknown as { PointerEvent: typeof PE }).PointerEvent = PE;
}

describe("Minecraft-style touch controls", () => {
  it("the D-pad gives 8 directions and stops when the finger lifts", () => {
    expect(padDirection(40, 0)).toMatchObject({ x: 1, y: 0 });
    const diag = padDirection(40, -40);
    expect(diag.vx).toBeCloseTo(Math.SQRT1_2); expect(diag.vy).toBeCloseTo(-Math.SQRT1_2);
    expect(padDirection(5, 5)).toMatchObject({ x: 0, y: 0 });
    useGame.getState().newGame("realista", "normal");
    render(<DPad />);
    const pad = screen.getByLabelText("D-pad: move");
    fireEvent.pointerDown(pad, { clientX: 60, clientY: 0, pointerId: 1 });
    expect(touch.vx).toBeCloseTo(1);
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(touch.vx).toBe(0);
  });
  it("ACTION uses the tool and E stays held while pressed", () => {
    const use = vi.fn(), interact = vi.fn();
    touch.act = { ...touch.act, use, interact };
    render(<ActionPad />);
    fireEvent.pointerDown(screen.getByText("ACTION").closest("button")!);
    expect(use).toHaveBeenCalled();
    const e = screen.getByText("HOLD").closest("button")!;
    fireEvent.pointerDown(e);
    expect(interact).toHaveBeenCalled();
    expect(touch.e).toBe(true);
    fireEvent.pointerUp(e);
    expect(touch.e).toBe(false);
  });
  it("the top menu opens Missions, Base, Log and Pause", () => {
    useGame.getState().setOverlay(null);
    render(<MenuBar />);
    for (const t of ["Missions", "Base", "Log", "Fullscreen", "Pause"]) expect(screen.getByLabelText(t)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Base"));
    expect(useGame.getState().overlay).toBe("base");
    useGame.getState().setOverlay(null);
  });
  it("asks to rotate the device in portrait", () => {
    render(<RotateNotice />);
    expect(screen.getByText("ROTATE YOUR DEVICE")).toBeTruthy();
  });
  it("desktop HUD shows keyboard help in English", () => {
    useGame.getState().newGame("realista", "normal");
    render(<HUDBottom />);
    expect(screen.getByText(/WASD move/)).toBeTruthy();
  });
});
