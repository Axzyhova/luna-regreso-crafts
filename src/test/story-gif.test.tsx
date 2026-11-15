import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StoryScene, STORY_GIFS } from "@/components/game/StoryGif";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCENES = ["briefing", "launch", "coast", "orbit", "fail", "fall", "land", "stranded"] as const;

afterEach(() => { cleanup(); delete (window as { matchMedia?: unknown }).matchMedia; });

describe("intro scenes as GIFs", () => {
  it("shows each scene as a looping GIF image", () => {
    for (const scene of SCENES) {
      const { unmount } = render(<StoryScene scene={scene} />);
      const img = screen.getByAltText(`Animated scene: ${scene}`) as HTMLImageElement;
      expect(img.getAttribute("src")).toMatch(/\.gif/);
      expect(img.getAttribute("src")).toBe(STORY_GIFS[scene]);
      unmount();
    }
  });

  it("falls back to the canvas drawing if the GIF can't load", () => {
    render(<StoryScene scene="fail" />);
    fireEvent.error(screen.getByAltText("Animated scene: fail"));
    expect(screen.queryByAltText("Animated scene: fail")).toBeNull();
    expect(document.querySelector("canvas")?.getAttribute("aria-label")).toBe("Animated scene: fail");
  });

  it("uses the still canvas frame when the system asks for reduced motion", () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<StoryScene scene="launch" />);
    expect(screen.queryByAltText("Animated scene: launch")).toBeNull();
    expect(document.querySelector("canvas")).toBeTruthy();
  });

  it("the baked files are real, looping, 320×160 GIF89a animations", () => {
    for (const scene of SCENES) {
      const b = readFileSync(resolve(__dirname, `../assets/story/${scene}.gif`));
      expect(b.toString("latin1", 0, 6)).toBe("GIF89a");
      expect([b.readUInt16LE(6), b.readUInt16LE(8)]).toEqual([320, 160]);
      expect(b.includes(Buffer.from("NETSCAPE2.0"))).toBe(true); // loop forever
      expect(b[b.length - 1]).toBe(0x3b); // trailer
      expect(b.length).toBeGreaterThan(50_000);
      expect(b.length).toBeLessThan(2_000_000); // keep the intro light
      expect(b.readUInt16LE(b.indexOf(Buffer.from([0x21, 0xf9, 0x04])) + 4)).toBe(8); // 8/100 s per frame = 12.5 fps
    }
  });
});
