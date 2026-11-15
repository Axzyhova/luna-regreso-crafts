/**
 * 3×5 pixel font for text drawn inside the game world (prompts, labels, warnings).
 * Phaser's normal Text renders a TTF into a tiny 320×180 canvas and then gets scaled up,
 * which smears the letters. A bitmap font made of whole pixels stays sharp at any zoom.
 * Each glyph sits in a 4×6 cell: 3×5 letter + 1 px drop shadow / letter spacing.
 * (No Phaser import here: the scene passes Phaser in, so tests can load the glyphs without a canvas.)
 */
import type PhaserNS from "phaser";

export const GLYPHS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."], "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
  " ": ["...", "...", "...", "...", "..."], ".": ["...", "...", "...", "...", ".#."], ",": ["...", "...", "...", ".#.", "#.."],
  ":": ["...", ".#.", "...", ".#.", "..."], "!": [".#.", ".#.", ".#.", "...", ".#."], "?": ["##.", "..#", ".#.", "...", ".#."],
  "(": ["..#", ".#.", ".#.", ".#.", "..#"], ")": ["#..", ".#.", ".#.", ".#.", "#.."], "-": ["...", "...", "###", "...", "..."],
  "+": ["...", ".#.", "###", ".#.", "..."], "/": ["..#", "..#", ".#.", "#..", "#.."], "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "'": [".#.", ".#.", "...", "...", "..."], ">": ["#..", ".#.", "..#", ".#.", "#.."], "<": ["..#", ".#.", "#..", ".#.", "..#"],
  "=": ["...", "###", "...", "###", "..."], "^": [".#.", "###", ".#.", ".#.", ".#."], "·": ["...", "...", ".#.", "...", "..."], _: ["...", "...", "...", "...", "###"],
};
export const FONT_KEY = "px";
const CHARS = Object.keys(GLYPHS).join("");
const CW = 4, CH = 6;

/** Upper-case and swap anything the font doesn't have (accents, emoji, ellipsis) for a close match or a space. */
export function toFont(s: string): string {
  return s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/…/g, "...").replace(/[→▸]/g, ">").replace(/./gu, (c) => (GLYPHS[c] ? c : " "));
}

/** Draw the glyph sheet (white letters + black drop shadow) and register it as a Phaser bitmap font. */
export function registerPixelFont(Phaser: typeof PhaserNS, scene: PhaserNS.Scene) {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;
  const g = scene.add.graphics();
  const pass = (color: number, d: number) => {
    g.fillStyle(color);
    [...CHARS].forEach((c, i) => GLYPHS[c]!.forEach((row, y) => [...row].forEach((p, x) => { if (p === "#") g.fillRect(i * CW + x + d, y + d, 1, 1); })));
  };
  pass(0x0b0b14, 1); pass(0xffffff, 0);
  g.generateTexture("pxfont", CHARS.length * CW, CH); g.destroy();
  scene.cache.bitmapFont.add(FONT_KEY, Phaser.GameObjects.RetroFont.Parse(scene, {
    image: "pxfont", width: CW, height: CH, chars: CHARS, charsPerRow: CHARS.length,
    "offset.x": 0, "offset.y": 0, "spacing.x": 0, "spacing.y": 0, lineSpacing: 0,
  }));
}
