import { describe, it, expect } from "vitest";
import { music, setMusicOn, setMusicVolume, setMusicMood, startMusic, stopMusic } from "@/game/music";

describe("ambient music", () => {
  it("is safe without Web Audio (tests / old browsers) and remembers settings", () => {
    expect(() => { startMusic(); stopMusic(); }).not.toThrow();
    setMusicVolume(2); expect(music.volume).toBe(1);
    setMusicVolume(-1); expect(music.volume).toBe(0);
    setMusicVolume(0.5);
    setMusicOn(false); expect(music.on).toBe(false);
    expect(JSON.parse(localStorage.getItem("varados_music_v1")!)).toEqual({ on: false, volume: 0.5 });
    setMusicOn(true);
    setMusicMood("night"); expect(music.mood).toBe("night");
  });
});
