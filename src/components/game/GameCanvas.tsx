import { useEffect, useRef } from "react";

export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: import("phaser").Game | null = null;
    let dead = false;
    (async () => {
      const Phaser = (await import("phaser")).default;
      const { LunarScene } = await import("@/game/LunarScene");
      await document.fonts?.load('8px "Press Start 2P"').catch(() => {});
      if (dead || !ref.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO, parent: ref.current, width: 320, height: 180, pixelArt: true, backgroundColor: "#141428",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [LunarScene],
      });
    })();
    return () => { dead = true; game?.destroy(true); };
  }, []);
  return <div ref={ref} className="pixelated absolute inset-0" />;
}
