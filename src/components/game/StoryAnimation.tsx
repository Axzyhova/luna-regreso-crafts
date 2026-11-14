import { useEffect, useRef } from "react";

/**
 * Animated pixel-art versions of the four intro scenes (same scenes as before:
 * launch, tank failure, emergency descent, landing). Drawn on a tiny canvas and
 * scaled up crisply, so it looks like a looping 8-bit GIF but stays sharp and light.
 */
export type SceneId = "launch" | "fail" | "fall" | "land";

const W = 160, H = 80;
const C = {
  space: "#141428", star: "#f2f2f2", earth: "#3b6fd6", earthL: "#7fa8ff", moon0: "#2a2a36", moon1: "#45454f", moon2: "#6b6b75",
  hull: "#c9c9cf", nose: "#f2f2f2", window: "#3b6fd6", fin: "#d63b3b", flame: "#f08a24", flameL: "#f2d24f", smoke: "#9a9aa3", alarm: "#d63b3b", fuel: "#a8e4ff",
};

// Fixed star field (deterministic so it doesn't flicker between renders).
const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 53) % W, y: (i * 29 + (i % 7) * 11) % H, s: i % 5 === 0 ? 2 : 1, tw: i % 3 }));

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Rocket drawn around (cx, cy) = center of the body, optionally tilted. */
function rocket(g: CanvasRenderingContext2D, cx: number, cy: number, t: number, opts: { flame?: number; tilt?: number; alarm?: boolean } = {}) {
  g.save();
  g.translate(Math.round(cx), Math.round(cy));
  if (opts.tilt) g.rotate(opts.tilt);
  rect(g, -3, -10, 6, 18, C.hull);                       // body
  rect(g, -2, -13, 4, 3, C.nose); rect(g, -1, -15, 2, 2, C.nose); // nose
  rect(g, -1, -6, 2, 2, opts.alarm && Math.floor(t * 6) % 2 ? C.alarm : C.window); // window
  rect(g, -6, 3, 3, 5, C.fin); rect(g, 3, 3, 3, 5, C.fin); // fins
  const f = opts.flame ?? 0;
  if (f > 0) {
    const flick = 2 + Math.floor((Math.sin(t * 40) + 1) * 1.5);
    rect(g, -2, 8, 4, Math.round((3 + flick) * f), C.flame);
    rect(g, -1, 8, 2, Math.round((2 + flick) * f), C.flameL);
  }
  g.restore();
}

function stars(g: CanvasRenderingContext2D, t: number, scroll = 0) {
  for (const s of STARS) {
    const y = (s.y + scroll) % H;
    if ((Math.floor(t * 2) + s.tw) % 3 === 0 && s.s === 1) continue; // twinkle
    rect(g, s.x, y < 0 ? y + H : y, s.s, s.s, C.star);
  }
}

/** One frame of a scene. `t` = seconds since the scene started. */
export function drawScene(g: CanvasRenderingContext2D, scene: SceneId, t: number) {
  rect(g, 0, 0, W, H, C.space);
  if (scene === "launch") {
    // Countdown on the pad, ignition, then lift-off with the ground falling away.
    const lift = Math.max(0, t - 1.2);
    const rise = Math.min(60, lift * lift * 14);
    stars(g, t, rise * 0.4);
    const groundY = 64 + rise;
    if (groundY < H) { rect(g, 0, groundY, W, H - groundY, C.earth); rect(g, 0, groundY, W, 2, C.earthL); }
    const shake = t > 0.8 && t < 2.2 ? Math.sin(t * 60) : 0;
    rocket(g, W / 2 + shake, 52 - rise * 0.6, t, { flame: t > 0.8 ? 1 + Math.min(1, lift) : 0 });
    if (t > 0.8) for (let i = 0; i < 8; i++) { // smoke puffs on the pad
      const a = (t * 3 + i) % 4;
      rect(g, W / 2 - 4 + (i - 4) * 4 * a, groundY - 3 - a * 2, 3, 3, C.smoke);
    }
  } else if (scene === "fail") {
    // Cruising in space; an alarm flashes and fuel sprays out of the tank.
    stars(g, t, t * 6);
    const wobble = Math.sin(t * 3) * 0.12 + (t > 1 ? Math.sin(t * 25) * 0.03 : 0);
    const cx = W / 2, cy = 40;
    rocket(g, cx, cy, t, { flame: t < 1 ? 1 : 0.4, tilt: wobble, alarm: t > 1 });
    if (t > 1) {
      for (let i = 0; i < 14; i++) { // fuel droplets leaking from the side tank
        const a = ((t - 1) * 1.6 + i / 14) % 1;
        rect(g, cx + 4 + a * 40 + Math.sin(i * 7) * 3, cy - 2 + a * 14 + Math.cos(i * 3) * 4 * a, 1, 1, C.fuel);
      }
      if (Math.floor(t * 4) % 2) { rect(g, 0, 0, W, 2, C.alarm); rect(g, 0, H - 2, W, 2, C.alarm); }
      g.fillStyle = Math.floor(t * 4) % 2 ? C.alarm : C.flameL;
      g.font = "8px monospace"; g.fillText("!!", cx + 10, cy - 12);
    }
  } else if (scene === "fall") {
    // Tilted emergency descent: the Moon grows from the bottom, retro-burn flickers.
    stars(g, t, -t * 10);
    const moonR = 70 + t * 18;
    g.fillStyle = C.moon1; g.beginPath(); g.arc(W / 2, H + moonR - 22 - t * 4, moonR, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.moon0;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(20 + i * 30, H - 10 - t * 4 + (i % 2) * 5, 3 + (i % 3), 0, Math.PI * 2); g.fill(); }
    const tilt = 0.45 - Math.min(0.35, t * 0.08);
    rocket(g, W / 2 + 18 - t * 5, 20 + t * 6, t, { tilt, flame: 0.6 + (Math.sin(t * 9) + 1) * 0.3 });
  } else {
    // Touchdown: dust cloud, the rocket settles, then the dust drifts away.
    stars(g, t);
    rect(g, 0, 62, W, H - 62, C.moon1); rect(g, 0, 62, W, 2, C.moon2);
    rect(g, 30, 66, 10, 3, C.moon0); rect(g, 118, 68, 14, 3, C.moon0);
    const descent = Math.max(0, 1 - t / 1.4);
    const y = 50 - descent * 30;
    rocket(g, W / 2, y, t, { flame: descent > 0 ? 1 : 0 });
    if (t > 1) for (let i = 0; i < 12; i++) {
      const a = Math.min(1, (t - 1) / 2.5);
      const dx = (i - 6) * (6 + a * 10);
      const alpha = 1 - Math.max(0, (t - 3) / 2);
      if (alpha <= 0) break;
      g.globalAlpha = alpha;
      rect(g, W / 2 + dx, 58 - a * 4 - (i % 3), 3, 3, C.smoke);
      g.globalAlpha = 1;
    }
    if (t > 2.5 && Math.floor(t * 2) % 2) rect(g, W / 2 - 1, y - 6, 2, 2, "#4fc26a"); // "alive" light blinking
  }
}

export function StoryAnimation({ scene }: { scene: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    g.imageSmoothingEnabled = false;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = ((now - start) / 1000) % 6; // each scene loops every 6 s, like a GIF
      drawScene(g, scene, reduce ? 3 : t);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene]);
  return <canvas ref={ref} width={W} height={H} className="pixelated block aspect-[2/1] w-full border-4 border-moon-2 [image-rendering:pixelated]" aria-label={`Escena animada: ${scene}`} />;
}
