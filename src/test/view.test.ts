import { describe, it, expect, beforeEach } from "vitest";
import { clampZoom, defaultZoom, loadZoom, setZoom, view, ZOOM_MAX, ZOOM_MIN, PHONE_ZOOM } from "@/game/view";

describe("camera zoom", () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });

  it("phones and short screens start more zoomed in than a desktop", () => {
    expect(defaultZoom(false, false)).toBe(1);
    expect(defaultZoom(true, false)).toBe(PHONE_ZOOM);
    expect(defaultZoom(false, true)).toBe(PHONE_ZOOM);
    expect(PHONE_ZOOM).toBeGreaterThan(1);
  });

  it("stays inside its limits and snaps to tenths", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN); expect(clampZoom(9)).toBe(ZOOM_MAX); expect(clampZoom(1.34)).toBe(1.3);
  });

  it("remembers what the player chose", () => {
    expect(loadZoom(true, true)).toBe(PHONE_ZOOM); // nothing saved yet: device default
    setZoom(1.8); expect(view.zoom).toBe(1.8);
    expect(loadZoom(false, false)).toBe(1.8); // saved choice wins over the default
    localStorage.setItem("varados_zoom_v1", "garbage"); expect(loadZoom(false, false)).toBe(1);
  });
});
