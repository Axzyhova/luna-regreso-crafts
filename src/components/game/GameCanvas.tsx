import { useEffect, useRef } from "react";

/**
 * Internal pixel resolution that matches the container's shape, so a vertical phone
 * shows a vertical slice of the map instead of a tiny letterboxed strip.
 * The world is 640x360, so neither side may exceed it.
 */
export function gameSize(cw: number, ch: number) {
  if (cw <= 0 || ch <= 0) return { w: 320, h: 180 };
  const portrait = ch > cw;
  const w = portrait ? 200 : 320;
  const h = Math.round(Math.min(360, Math.max(120, (w * ch) / cw)));
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
  return <div ref={ref} className="pixelated absolute inset-0 touch-none" />;
}
