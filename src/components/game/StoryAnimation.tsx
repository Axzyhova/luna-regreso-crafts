import { useEffect, useRef } from "react";
import { GLYPHS, toFont } from "@/game/pixelfont";

/**
 * Cinematic intro scenes (same four scenes: launch, tank failure, emergency descent,
 * landing), drawn on a small canvas with fire, smoke and glow particles so they feel
 * like a looping launch GIF. Everything is computed from the time `t`, so a frame is
 * a pure function of (scene, t) and stays smooth at any frame rate.
 */
/** The story in order: briefing → launch → coast to the Moon → lunar orbit → tank failure → descent → landing → stranded. */
export type SceneId = "briefing" | "launch" | "coast" | "orbit" | "fail" | "fall" | "land" | "stranded";

const W = 320, H = 160;
const LOOP = 7; // seconds per scene loop

/** Deterministic pseudo-random in [0, 1) for particle i, channel k. */
const rnd = (i: number, k = 0) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function sky(g: CanvasRenderingContext2D, top: string, bottom: string) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

function stars(g: CanvasRenderingContext2D, t: number, vy = 0, n = 70) {
  for (let i = 0; i < n; i++) {
    const x = rnd(i, 1) * W;
    const y = (((rnd(i, 2) * H + vy * t) % H) + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + rnd(i, 3) * 3) + i);
    g.globalAlpha = 0.35 + 0.65 * tw * rnd(i, 4);
    g.fillStyle = "#ffffff";
    g.fillRect(Math.round(x), Math.round(y), rnd(i, 5) > 0.9 ? 2 : 1, 1);
  }
  g.globalAlpha = 1;
}

/** Soft additive light. */
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  if (a <= 0 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a;
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/**
 * Exhaust plume: particles born at (x, y) flowing along (dx, dy), turning from
 * white-yellow fire into orange, red and finally grey smoke as they age.
 */
function plume(g: CanvasRenderingContext2D, t: number, x: number, y: number, dx: number, dy: number, power: number, n = 60, spread = 0.35, life = 0.9) {
  if (power <= 0) return;
  for (let i = 0; i < n; i++) {
    const age = ((t / life + rnd(i, 7)) % 1); // 0..1
    const side = (rnd(i, 8) - 0.5) * spread;
    const dist = age * 42 * power;
    const px = x + (dx + -dy * side) * dist;
    const py = y + (dy + dx * side) * dist;
    const r = (1.2 + age * 6) * (0.6 + power * 0.6);
    const col = age < 0.15 ? "255,250,220" : age < 0.35 ? "255,196,90" : age < 0.6 ? "240,120,40" : "120,110,110";
    g.globalAlpha = (1 - age) * (age < 0.6 ? 0.9 : 0.45);
    g.fillStyle = `rgb(${col})`;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

/** Billowing ground smoke clouds, lit from below by the engine. */
function groundSmoke(g: CanvasRenderingContext2D, t: number, cx: number, gy: number, amount: number, light: number) {
  if (amount <= 0) return;
  for (let i = 0; i < 46; i++) {
    const dir = rnd(i, 11) < 0.5 ? -1 : 1;
    const age = ((t * 0.35 + rnd(i, 12)) % 1);
    const x = cx + dir * (8 + age * (70 + rnd(i, 13) * 80) * amount);
    const y = gy - 4 - age * (10 + rnd(i, 14) * 22);
    const r = (6 + age * 18 + rnd(i, 15) * 6) * amount;
    const lit = clamp01(light * (1 - age) * 1.2);
    const c = Math.round(lerp(70, 210, lit)), o = Math.round(lerp(70, 120, lit)), b = Math.round(lerp(78, 70, lit));
    g.globalAlpha = 0.55 * (1 - age * 0.6);
    g.fillStyle = `rgb(${c},${o},${b})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

/** Generic heavy rocket: core with dark bands, two side boosters, nozzle at (x, y+30). */
function rocket(g: CanvasRenderingContext2D, x: number, y: number, tilt = 0, alarm = false, t = 0) {
  g.save(); g.translate(x, y); g.rotate(tilt);
  // boosters
  for (const s of [-1, 1]) {
    g.fillStyle = "#d9d9de"; g.fillRect(s * 6 - 2, -6, 4, 34);
    g.fillStyle = "#f2f2f2"; g.beginPath(); g.moveTo(s * 6 - 2, -6); g.lineTo(s * 6, -11); g.lineTo(s * 6 + 2, -6); g.fill();
    g.fillStyle = "#555"; g.fillRect(s * 6 - 2, 26, 4, 2);
  }
  // core
  g.fillStyle = "#ececf0"; g.fillRect(-4, -26, 8, 54);
  g.fillStyle = "#b8b8c0"; g.fillRect(2, -26, 2, 54);           // shading
  g.fillStyle = "#2a2a36"; g.fillRect(-4, -4, 8, 2); g.fillRect(-4, 12, 8, 2);
  g.fillStyle = "#f2f2f2"; g.beginPath(); g.moveTo(-4, -26); g.quadraticCurveTo(0, -40, 4, -26); g.fill();
  g.fillStyle = alarm && Math.floor(t * 6) % 2 ? "#ff3b3b" : "#3b6fd6"; g.fillRect(-1, -18, 2, 2);
  g.fillStyle = "#444"; g.fillRect(-3, 28, 6, 3);                // nozzle
  g.restore();
}

function launchTower(g: CanvasRenderingContext2D, x: number, gy: number, t: number) {
  g.strokeStyle = "#3a3a46"; g.lineWidth = 1;
  g.fillStyle = "#23232c"; g.fillRect(x, gy - 92, 10, 92);
  g.beginPath();
  for (let y = gy - 92; y < gy; y += 8) { g.moveTo(x, y); g.lineTo(x + 10, y + 8); g.moveTo(x + 10, y); g.lineTo(x, y + 8); }
  g.stroke();
  g.fillStyle = "#23232c"; g.fillRect(x + 10, gy - 70, 10, 2); g.fillRect(x + 10, gy - 40, 10, 2);
  if (Math.floor(t * 2) % 2) { g.fillStyle = "#ff4040"; g.fillRect(x + 4, gy - 95, 2, 2); }
  glow(g, x + 5, gy - 94, 6, "rgba(255,60,60,0.8)", Math.floor(t * 2) % 2 ? 0.8 : 0.2);
}

function earthLimb(g: CanvasRenderingContext2D, yTop: number) {
  const r = 420;
  const cx = W / 2, cy = yTop + r;
  glow(g, cx, yTop + 8, 220, "rgba(110,170,255,0.55)", 0.6);
  const gr = g.createLinearGradient(0, yTop, 0, H);
  gr.addColorStop(0, "#5aa0ff"); gr.addColorStop(0.15, "#2257a8"); gr.addColorStop(1, "#0d2350");
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.35; g.fillStyle = "#e8f2ff";
  for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(30 + i * 36, yTop + 16 + (i % 3) * 7, 16, 3, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}

function moonGround(g: CanvasRenderingContext2D, y: number, curve: number) {
  const gr = g.createLinearGradient(0, y - curve, 0, H);
  gr.addColorStop(0, "#9a9aa3"); gr.addColorStop(1, "#45454f");
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, H); g.lineTo(0, y); g.quadraticCurveTo(W / 2, y - curve, W, y); g.lineTo(W, H); g.fill();
  g.fillStyle = "rgba(30,30,40,0.45)";
  for (let i = 0; i < 8; i++) {
    const cx = rnd(i, 21) * W, cy = y + 6 + rnd(i, 22) * (H - y);
    g.beginPath(); g.ellipse(cx, cy, 6 + rnd(i, 23) * 10, 2 + rnd(i, 24) * 3, 0, 0, Math.PI * 2); g.fill();
  }
}


// ---------------------------------------------------------------------------------------------
// Story scenes that show how the crew got to the Moon (briefing, coast, lunar orbit, stranded).
// Text uses the game's 3x5 pixel font so it stays crisp when baked into a GIF.
// ---------------------------------------------------------------------------------------------

/** Crisp pixel-font text with a drop shadow. (x, y) is the top-left corner, or the centre/right edge with align. */
function pxText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1, align: "left" | "center" | "right" = "left") {
  const str = toFont(text), w = str.length * 4 * scale - scale;
  const ox = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
  const paint = (dx: number, dy: number, c: string) => {
    g.fillStyle = c;
    for (let i = 0; i < str.length; i++) {
      const gl = GLYPHS[str[i]!]; if (!gl) continue;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r]![q] === "#") g.fillRect(ox + i * 4 * scale + q * scale + dx, y + r * scale + dy, scale, scale);
    }
  };
  paint(scale, scale, "rgba(0,0,0,0.85)"); paint(0, 0, color);
}

function earthDisc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  glow(g, x, y, r * 1.7, "rgba(110,170,255,0.55)", 0.55);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  gr.addColorStop(0, "#74b4ff"); gr.addColorStop(0.65, "#2257a8"); gr.addColorStop(1, "#0b1f48");
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#3d8a4c"; g.globalAlpha = 0.85;
  for (const [dx, dy, a, b] of [[-0.25, -0.1, 0.35, 0.22], [0.3, 0.25, 0.28, 0.18], [-0.1, 0.45, 0.2, 0.12]] as const) { g.beginPath(); g.ellipse(x + dx * r, y + dy * r, a * r, b * r, 0.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#ffffff"; g.globalAlpha = 0.4;
  for (const [dx, dy, a] of [[-0.3, -0.35, 0.3], [0.25, 0.05, 0.25], [-0.05, 0.35, 0.28]] as const) { g.beginPath(); g.ellipse(x + dx * r, y + dy * r, a * r, a * r * 0.28, 0, 0, Math.PI * 2); g.fill(); }
  g.restore(); g.globalAlpha = 1;
}

function moonDisc(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  gr.addColorStop(0, "#d9d9e0"); gr.addColorStop(0.7, "#9a9aa3"); gr.addColorStop(1, "#4a4a55");
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(40,40,52,0.45)";
  for (const [dx, dy, a] of [[-0.3, -0.2, 0.2], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.4, -0.35, 0.1]] as const) { g.beginPath(); g.arc(x + dx * r, y + dy * r, a * r, 0, Math.PI * 2); g.fill(); }
}

/** The crew vehicle, pointing right: engine bell, gold service module, white capsule and four solar wings. */
function orion(g: CanvasRenderingContext2D, x: number, y: number, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  for (const sy of [-1, 1]) { // solar wings
    g.fillStyle = "#1f3f8a"; g.fillRect(-18, sy < 0 ? -24 : 8, 20, 16);
    g.fillStyle = "#3b6fd6"; for (let i = 0; i < 4; i++) g.fillRect(-17 + i * 5, sy < 0 ? -23 : 9, 4, 14);
    g.fillStyle = "#9a9aa3"; g.fillRect(-8, sy < 0 ? -8 : 6, 2, 2);
  }
  g.fillStyle = "#c9a24a"; g.fillRect(-26, -7, 26, 14);               // service module (gold foil)
  g.fillStyle = "#8a6a22"; g.fillRect(-26, 3, 26, 4);
  g.fillStyle = "#555"; g.beginPath(); g.moveTo(-26, -3); g.lineTo(-32, -5); g.lineTo(-32, 5); g.lineTo(-26, 3); g.fill(); // engine bell
  g.fillStyle = "#f2f2f2"; g.beginPath(); g.moveTo(0, -7); g.lineTo(16, -3); g.lineTo(16, 3); g.lineTo(0, 7); g.fill(); // capsule
  g.fillStyle = "#b8b8c0"; g.fillRect(0, 2, 16, 3);
  g.fillStyle = "#3b6fd6"; g.fillRect(5, -3, 3, 3);
  g.restore();
}

function sceneBriefing(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#060918", "#0f1a3a"); stars(g, t, 0, 50);
  earthDisc(g, 300, 150, 46);
  // header bar + LIVE light
  g.fillStyle = "rgba(10,16,40,0.85)"; g.fillRect(0, 0, W, 16); g.fillStyle = "#2a4fa8"; g.fillRect(0, 16, W, 1);
  pxText(g, "MISSION CONTROL · HOUSTON", 6, 5, "#9fc0ff");
  g.fillStyle = Math.floor(t * 2) % 2 ? "#ff4040" : "#6a1c1c"; g.fillRect(286, 5, 5, 5); pxText(g, "LIVE", 294, 5, "#ffffff");
  // mission patch
  const px = 62, py = 88;
  g.fillStyle = "#f2d24f"; g.beginPath(); g.arc(px, py, 41, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#0b1230"; g.beginPath(); g.arc(px, py, 37, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(px, py, 37, 0, Math.PI * 2); g.clip();
  const gr = g.createLinearGradient(0, py - 37, 0, py + 37); gr.addColorStop(0, "#10205a"); gr.addColorStop(1, "#050818"); g.fillStyle = gr; g.fillRect(px - 37, py - 37, 74, 74);
  stars(g, t, 0, 30);
  moonDisc(g, px + 6, py + 12, 20);
  g.fillStyle = "#0b0b18"; g.beginPath(); g.ellipse(px + 6, py + 28, 9, 3, 0, 0, Math.PI * 2); g.fill(); // shadowed crater at the south pole
  g.fillStyle = "#74b4ff"; g.beginPath(); g.arc(px - 22, py - 14, 6, 0, Math.PI * 2); g.fill(); // Earth
  g.strokeStyle = "rgba(255,255,255,0.55)"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(px - 18, py - 10); g.quadraticCurveTo(px - 4, py - 30, px + 4, py - 4); g.stroke(); g.setLineDash([]);
  const sweep = ((t / 3) % 1) * 140 - 40; // a shine sweeping across the patch
  g.globalAlpha = 0.22; g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(px - 60 + sweep, py - 40); g.lineTo(px - 48 + sweep, py - 40); g.lineTo(px - 28 + sweep, py + 40); g.lineTo(px - 40 + sweep, py + 40); g.fill(); g.globalAlpha = 1;
  g.restore();
  pxText(g, "SELENE-7", px, py - 66, "#f2d24f", 2, "center");
  pxText(g, "SOUTH POLE", px, py + 46, "#9fc0ff", 1, "center");
  // crew roster, typed in one by one
  const crew: [string, string][] = [["ALEX RIVERA", "COMMANDER · NASA"], ["JONAS WEBER", "PILOT · ESA"], ["AIKO TANAKA", "GEOLOGIST · JAXA"], ["PRIYA RAMAN", "FLIGHT DIRECTOR · HOUSTON"]];
  crew.forEach(([name, role], i) => {
    const t0 = 0.5 + i * 1.45, n = Math.max(0, Math.min(name.length, Math.floor((t - t0) * 16)));
    if (t < t0) return;
    const y = 26 + i * 31;
    g.fillStyle = "#f2d24f"; g.fillRect(124, y + 1, 2, 22);
    pxText(g, name.slice(0, n) + (n < name.length && Math.floor(t * 8) % 2 ? "_" : ""), 131, y, "#ffffff", 2);
    if (n >= name.length) pxText(g, role, 131, y + 14, i === 3 ? "#9fc0ff" : "#f2d24f", 1);
  });
  pxText(g, "FINAL BRIEFING · T-00:03:00", W / 2, 150, "#9fc0ff", 1, "center");
}

function sceneCoast(g: CanvasRenderingContext2D, t: number) {
  const k = clamp01(t / LOOP);
  sky(g, "#02030a", "#05071a"); stars(g, t, 0, 90);
  earthDisc(g, 44, 112, lerp(64, 15, k));
  moonDisc(g, 272, 54, lerp(5, 34, k));
  // trajectory with a travelling marker
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.setLineDash([3, 4]);
  g.beginPath(); g.moveTo(70, 96); g.quadraticCurveTo(170, 20, 262, 56); g.stroke(); g.setLineDash([]);
  const bx = 150 + Math.sin(t * 0.9) * 1.5, by = 74 + Math.sin(t * 0.7) * 1.2;
  const burn = clamp01(1.6 - t) * 1.2; // trans-lunar injection burn at the start
  plume(g, t, bx - 36, by, -1, 0, burn, 36, 0.18, 0.5);
  glow(g, bx - 34, by, 22, "rgba(255,200,120,1)", burn * 0.8);
  orion(g, bx, by, 1);
  pxText(g, "TRANS-LUNAR COAST", 6, 6, "#f2d24f");
  if (t < 2) { if (Math.floor(t * 4) % 2) pxText(g, "TRANS-LUNAR INJECTION BURN", W / 2, 24, "#ffffff", 1, "center"); }
  else pxText(g, "SAME ROUTE AS APOLLO 8 AND 11", W / 2, 24, "#9fc0ff", 1, "center");
  const km = Math.round(lerp(384400, 3200, k) / 100) * 100;
  pxText(g, "DAY " + (1 + Math.min(2, Math.floor(k * 3))), 8, 144, "#ffffff", 2);
  pxText(g, km.toLocaleString("en-US").replace(/,/g, " ") + " KM TO THE MOON", W - 6, 148, "#9fc0ff", 1, "right");
}

function sceneOrbit(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#010208", "#06060f"); stars(g, t, 0, 60);
  moonGround(g, 126, 46);
  g.fillStyle = "#07070f"; g.beginPath(); g.ellipse(176, 146, 32, 9, 0, 0, Math.PI * 2); g.fill(); // shadowed crater at the pole
  g.fillStyle = "#74b4ff"; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3); g.fillRect(168, 143, 3, 2); g.fillRect(179, 145, 2, 2); g.globalAlpha = 1;
  pxText(g, "ICE", 176, 133, "#74b4ff", 1, "center");
  // mothership keeps orbiting; the lander separates after 1.6 s
  const mx = 70 + t * 5, my = 56 + Math.sin(t * 0.8) * 1.5;
  orion(g, mx, my, 1.1);
  const sep = Math.max(0, t - 1.6);
  const lx = mx + 36 + sep * 17, ly = my + 14 + sep * sep * 4.5;
  if (t > 1.6 && t < 5.4) plume(g, t, lx, ly + 6, 0, 1, 0.35, 18, 0.5, 0.4);
  g.save(); g.translate(lx, ly); g.scale(0.5, 0.5); g.rotate(0.2 + sep * 0.12); rocket(g, 0, 0, 0, false, t); g.restore();
  pxText(g, "LUNAR ORBIT", 6, 6, "#f2d24f");
  pxText(g, "WEBER · TANAKA", mx, my - 36, "#ffffff", 1, "center");
  pxText(g, "STAY IN ORBIT", mx, my - 28, "#9fc0ff", 1, "center");
  if (t > 1.6) { pxText(g, "RIVERA", lx + 16, ly - 8, "#ffffff", 1); pxText(g, "DESCENT", lx + 16, ly + 0, "#f2d24f", 1); }
  if (t > 1.3 && t < 3.2 && Math.floor(t * 4) % 2) pxText(g, "SEPARATION", W / 2, 24, "#ffffff", 2, "center");
}

function sceneStranded(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#020208", "#0d0d1a"); stars(g, t, 0, 60);
  earthDisc(g, 266, 36, 15);
  for (let i = 0; i < 3; i++) { // signals from Earth fade out before reaching the lander
    const ph = ((t / 2.4 + i / 3) % 1);
    g.strokeStyle = "rgba(116,180,255," + (0.5 * (1 - ph)) + ")"; g.lineWidth = 1;
    g.beginPath(); g.arc(266, 36, 20 + ph * 70, Math.PI * 0.55, Math.PI * 0.95); g.stroke();
  }
  moonGround(g, 118, 8);
  // the lander, tilted a little, venting its last fuel; antenna snapped off
  rocket(g, 214, 87, 0.05, true, t);
  plume(g, t, 205, 90, -1, 0.2, 0.55, 22, 0.5, 0.8);
  g.fillStyle = "#555"; g.fillRect(207, 52, 1, 6); g.fillRect(209, 50, 3, 1);
  // footprints, then the astronaut looking up at Earth
  g.fillStyle = "rgba(30,30,40,0.7)"; for (let i = 0; i < 6; i++) g.fillRect(192 - i * 9, 119 + (i % 2) * 2, 3, 1);
  const ax = 128, ay = 108 + Math.sin(t * 1.6) * 0.6;
  g.fillStyle = "#14141c"; g.fillRect(ax - 6, ay - 12, 12, 24);                 // outline
  g.fillStyle = "#e6e6ec"; g.fillRect(ax - 5, ay - 4, 10, 14);                  // body
  g.fillStyle = "#8a8a96"; g.fillRect(ax - 8, ay - 3, 3, 10);                   // backpack
  g.fillStyle = "#f2f2f2"; g.beginPath(); g.arc(ax, ay - 8, 6, 0, Math.PI * 2); g.fill(); // helmet
  g.fillStyle = "#1d3f8a"; g.fillRect(ax - 1, ay - 11, 6, 4); g.fillStyle = "#74b4ff"; g.fillRect(ax + 1, ay - 10, 2, 1);
  g.fillStyle = "#c9c9d2"; g.fillRect(ax - 4, ay + 10, 3, 3); g.fillRect(ax + 1, ay + 10, 3, 3);
  if (Math.floor(t * 2) % 2) pxText(g, "NO SIGNAL", W / 2, 70, "#ff4b4b", 2, "center");
  pxText(g, "ANTENNA DESTROYED · TANKS EMPTY", W / 2, 146, "#ffffff", 1, "center");
  pxText(g, "SELENE-7", 6, 6, "#f2d24f");
}

/** One frame of a scene at time t (seconds since the scene started). */
export function drawScene(g: CanvasRenderingContext2D, scene: SceneId, t: number) {
  g.save();
  if (scene === "briefing" || scene === "coast" || scene === "orbit" || scene === "stranded") {
    ({ briefing: sceneBriefing, coast: sceneCoast, orbit: sceneOrbit, stranded: sceneStranded })[scene](g, t);
    g.restore();
    return;
  }
  if (scene === "launch") {
    // Night pad → ignition → slow lift-off with a huge lit smoke cloud (like a real launch).
    const ign = clamp01((t - 0.6) / 0.8);
    const lift = Math.max(0, t - 1.6);
    const rise = lift * lift * 7;
    const shake = ign > 0 && t < 3.2 ? (Math.sin(t * 70) + Math.sin(t * 53)) * 0.8 * ign : 0;
    g.translate(shake, 0);
    sky(g, "#05060f", "#151a33");
    stars(g, t, 0, 60);
    const gy = 132;
    glow(g, W / 2, gy, 150, "rgba(255,150,60,0.9)", ign * (0.55 + 0.1 * Math.sin(t * 30)));
    g.fillStyle = "#0b0b12"; g.fillRect(0, gy, W, H - gy);
    for (let i = 0; i < 14; i++) { g.fillStyle = "#f2d24f"; g.globalAlpha = 0.6; g.fillRect(rnd(i, 31) * W, gy + 3 + rnd(i, 32) * 4, 1, 1); }
    g.globalAlpha = 1;
    launchTower(g, W / 2 - 34, gy, t);
    const ry = gy - 30 - rise;
    plume(g, t, W / 2, ry + 31, 0, 1, ign * (1 + Math.min(1.2, lift * 0.5)), 80, 0.3, 0.7);
    groundSmoke(g, t, W / 2, gy, ign * Math.min(1, 0.4 + lift * 0.35), ign);
    rocket(g, W / 2, ry, 0, false, t);
    glow(g, W / 2, ry + 34, 26, "rgba(255,240,200,1)", ign);
  } else if (scene === "fail") {
    // Coasting above Earth, then an alarm: fuel vents from the tank and the ship tumbles.
    sky(g, "#020208", "#070b1c");
    stars(g, t, 3);
    earthLimb(g, 112);
    const bad = clamp01((t - 1.2) / 0.6);
    const tilt = Math.sin(t * 1.3) * 0.08 + bad * Math.sin(t * 2.4) * 0.22;
    const x = W / 2 + Math.sin(t * 0.7) * 4, y = 66;
    plume(g, t, x - Math.sin(tilt) * 31, y + Math.cos(tilt) * 31, Math.sin(-tilt), Math.cos(tilt), 1 - bad * 0.8, 40, 0.25, 0.6);
    if (bad > 0) { // venting fuel: white-blue spray that freezes into crystals
      for (let i = 0; i < 70; i++) {
        const age = ((t * 0.9 + rnd(i, 41)) % 1);
        const a = 0.25 + (rnd(i, 42) - 0.5) * 0.7;
        const d = age * 90;
        g.globalAlpha = (1 - age) * bad;
        g.fillStyle = age < 0.3 ? "#ffffff" : "#a8e4ff";
        g.fillRect(x + 6 + Math.cos(a) * d, y - 4 + Math.sin(a) * d, 1 + (age < 0.2 ? 1 : 0), 1);
      }
      g.globalAlpha = 1;
    }
    rocket(g, x, y, tilt, bad > 0, t);
    if (bad > 0) {
      const pulse = (Math.sin(t * 9) + 1) / 2;
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(255,30,30,${0.35 * pulse * bad})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      g.fillStyle = pulse > 0.5 ? "#ff4b4b" : "#ffd24f"; g.font = "bold 10px monospace"; g.fillText("! FUEL LEAK", W / 2 + 16, 30);
    }
  } else if (scene === "fall") {
    // Tilted emergency descent: the Moon fills the frame, retro-burn flickers, stars streak.
    sky(g, "#020208", "#0a0a16");
    for (let i = 0; i < 40; i++) { // streaking stars = speed
      const x = rnd(i, 51) * W, y = ((rnd(i, 52) * H - t * 60) % H + H) % H;
      g.globalAlpha = 0.5; g.fillStyle = "#fff"; g.fillRect(x, y, 1, 4);
    }
    g.globalAlpha = 1;
    const k = clamp01(t / LOOP);
    moonGround(g, lerp(150, 92, k), lerp(20, 34, k));
    const tilt = lerp(0.55, 0.12, k) + Math.sin(t * 7) * 0.03;
    const x = lerp(W / 2 + 60, W / 2 + 6, k), y = lerp(28, 52, k);
    const flick = 0.7 + 0.3 * Math.sin(t * 25);
    plume(g, t, x - Math.sin(tilt) * 31, y + Math.cos(tilt) * 31, Math.sin(-tilt), Math.cos(tilt), flick, 60, 0.4, 0.5);
    rocket(g, x, y, tilt, true, t);
    glow(g, x - Math.sin(tilt) * 34, y + Math.cos(tilt) * 34, 18, "rgba(255,200,120,1)", flick * 0.8);
  } else {
    // Touchdown on the plume: a ring of dust blasts out, settles, and the ship stands still.
    sky(g, "#020208", "#0d0d1a");
    stars(g, t, 0, 50);
    g.fillStyle = "#3b6fd6"; g.beginPath(); g.arc(270, 26, 9, 0, Math.PI * 2); g.fill();      // Earth in the sky
    g.fillStyle = "#ffffff"; g.globalAlpha = 0.5; g.beginPath(); g.arc(268, 24, 4, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    const gy = 128;
    moonGround(g, gy, 6);
    const descent = clamp01(1 - t / 2);
    const y = gy - 31 - descent * 46;
    const fire = descent > 0 ? 0.6 + 0.3 * Math.sin(t * 30) : 0;
    plume(g, t, W / 2, y + 31, 0, 1, fire, 50, 0.6, 0.4);
    const blast = clamp01((t - 0.8) / 3.5);
    if (blast > 0 && blast < 1) for (let i = 0; i < 90; i++) { // radial dust ring
      const dir = rnd(i, 61) < 0.5 ? -1 : 1;
      const sp = 40 + rnd(i, 62) * 120;
      const d = Math.sqrt(blast) * sp;
      g.globalAlpha = (1 - blast) * 0.7;
      g.fillStyle = rnd(i, 63) > 0.5 ? "#b6b6be" : "#8a8a94";
      const r = 1.5 + rnd(i, 64) * 3 + blast * 4;
      g.beginPath(); g.arc(W / 2 + dir * d, gy - 2 - rnd(i, 65) * 10 * (1 - blast) - blast * 6, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    rocket(g, W / 2, y, 0, false, t);
    if (descent === 0 && Math.floor(t * 2) % 2) { glow(g, W / 2, y - 18, 8, "rgba(79,194,106,1)", 0.9); }
  }
  g.restore();
}

export function StoryAnimation({ scene }: { scene: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = ((now - start) / 1000) % LOOP;
      drawScene(g, scene, reduce ? 3.5 : t);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene]);
  return <canvas ref={ref} width={W} height={H} className="block aspect-[2/1] w-full rounded-[6px] border-4 border-moon-2 [image-rendering:pixelated]" aria-label={`Animated scene: ${scene}`} />;
}
