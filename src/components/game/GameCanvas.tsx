import { useEffect, useRef } from "react";
import { loadZoom, view } from "@/game/view";
import { startMusic, stopMusic } from "@/game/music";

/**
 * Internal pixel resolution that matches the container's shape, so a vertical phone
 * shows a vertical slice of the map instead of a tiny letterboxed strip.
 * At the HD camera zoom the visible area is half of these numbers (world is 640x360).
 */
export function gameSize(cw: number, ch: number) {
  // HD render: twice the old 320x180 canvas; the scene zooms the camera by the same factor,
  // so the visible slice of the map is unchanged but every sprite has double the detail.
  if (cw <= 0 || ch <= 0) return { w: 640, h: 360 };
  const portrait = ch > cw;
  const w = portrait ? 400 : 640;
  const h = Math.round(Math.min(720, Math.max(240, (w * ch) / cw)));
  return { w, h };
}

export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let dead = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const { LunarScene } = await import("@/game/LunarScene");
      await document.fonts?.load('8px "Press Start 2P"').catch(() => {});
      const el = ref.current;
      if (dead || !el) return;
      const { w, h } = gameSize(el.clientWidth, el.clientHeight);
      view.zoom = loadZoom(matchMedia("(pointer: coarse)").matches, matchMedia("(max-height: 520px)").matches);
      game = new Phaser.Game({
        type: Phaser.AUTO, parent: el, width: w, height: h, pixelArt: true, backgroundColor: "#141428",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2 },
        scene: [LunarScene],
      });
      ro = new ResizeObserver(() => {
        if (!game || !el.clientWidth) return;
        const s = gameSize(el.clientWidth, el.clientHeight);
        if (s.w !== game.scale.gameSize.width || s.h !== game.scale.gameSize.height) game.scale.setGameSize(s.w, s.h);
        game.scale.refresh();
      });
      ro.observe(el);
    })();
    return () => { dead = true; ro?.disconnect(); game?.destroy(true); };
  }, []);
  // Tablets/phones: a long press (holding a move button) opens the browser's menu and cancels the touch,
  // so the astronaut stops. While the game is mounted, the long-press menu is blocked everywhere.
  // Calm 8-bit ambient music while playing (the game is entered with a tap/click, so audio is allowed).
  useEffect(() => { startMusic(); return () => stopMusic(); }, []);
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    document.body.classList.add("no-callout");
    return () => { window.removeEventListener("contextmenu", block); document.body.classList.remove("no-callout"); };
  }, []);
  return <div ref={ref} className="pixelated absolute inset-0 touch-none" />;
}
