import { useEffect, useRef } from "react";
import { GLYPHS, toFont } from "@/game/pixelfont";

/**
 * Cinematic intro scenes (same four scenes: launch, tank failure, emergency descent,
 * landing), drawn on a small canvas with fire, smoke and glow particles so they feel
 * like a looping launch GIF. Everything is computed from the time `t`, so a frame is
 * a pure function of (scene, t) and stays smooth at any frame rate.
 */
import type { SceneId } from "./scenes";
export type { SceneId } from "./scenes";

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

// ---------------------------------------------------------------------------------------------
// The way home: the Selene-7 capsule returns to Earth and splashes down in the Pacific Ocean,
// off the coast of Chiapas, Mexico (in front of Arriaga and Tonalá), where a recovery ship waits.
// ---------------------------------------------------------------------------------------------

/** Splashdown point used by the ending (open sea in front of Arriaga–Tonalá, Chiapas). */
const SPLASHDOWN = { lat: 15.8, lon: -93.9, label: "15.8N 93.9W" };

/**
 * Crew capsule seen from the side, heat shield down: white cone, dark windows, brown heat shield.
 * (x, y) is the centre of the heat shield's top edge; k scales it.
 */
function capsule(g: CanvasRenderingContext2D, x: number, y: number, k = 1, rot = 0, char = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k);
  g.fillStyle = "#14141c"; g.beginPath(); g.moveTo(-11, 1); g.lineTo(-5, -15); g.lineTo(5, -15); g.lineTo(11, 1); g.fill(); // outline
  g.fillStyle = "#e9e9ef"; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-4.5, -14); g.lineTo(4.5, -14); g.lineTo(10, 0); g.fill();
  g.fillStyle = "#b8b8c4"; g.beginPath(); g.moveTo(4, 0); g.lineTo(4.5, -14); g.lineTo(10, 0); g.fill();         // shaded side
  g.fillStyle = char > 0.5 ? "#6b5a4a" : "#c9c9d2"; g.fillRect(-4, -16, 8, 2);                               // docking hatch on top
  g.fillStyle = "#1d3f8a"; g.fillRect(-4, -9, 2, 2); g.fillRect(0, -9, 2, 2);                                 // windows
  g.fillStyle = "#74b4ff"; g.fillRect(-4, -9, 1, 1); g.fillRect(0, -9, 1, 1);
  g.fillStyle = char > 0.3 ? "#3a2414" : "#5a3a22"; g.fillRect(-11, 0, 22, 3);                                // heat shield
  g.fillStyle = "#2a1a10"; g.fillRect(-11, 2, 22, 1);
  g.restore();
}

/** Parachute canopy with orange and white gores (like the real crew capsule chutes), lines down to (cx, cy). */
function chute(g: CanvasRenderingContext2D, x: number, y: number, r: number, cx: number, cy: number, open = 1) {
  if (r <= 0.5) return;
  const rw = r * (0.35 + 0.65 * open), rh = r * 0.62;
  g.strokeStyle = "rgba(230,230,240,0.75)"; g.lineWidth = 0.6;
  g.beginPath(); for (const f of [-1, -0.5, 0, 0.5, 1]) { g.moveTo(x + f * rw, y); g.lineTo(cx, cy); } g.stroke();
  g.save(); g.beginPath(); g.ellipse(x, y, rw, rh, 0, Math.PI, 0); g.closePath(); g.clip();
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#f07a24"; g.fillRect(x - rw + (i * 2 * rw) / 8, y - rh, (2 * rw) / 8 + 0.5, rh); }
  g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x + rw * 0.25, y - rh, rw, rh);
  g.restore();
  g.strokeStyle = "#14141c"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, rw, rh, 0, Math.PI, 0); g.closePath(); g.stroke();
}

/** Sea surface from the horizon down: deep blue, sun glints and moving swell lines. */
function sea(g: CanvasRenderingContext2D, t: number, hy: number, warm = 0) {
  const gr = g.createLinearGradient(0, hy, 0, H);
  gr.addColorStop(0, warm ? "#4a6aa0" : "#3f86c4"); gr.addColorStop(0.4, warm ? "#28406e" : "#1f5c9a"); gr.addColorStop(1, "#0d2a52");
  g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
  for (let i = 0; i < 46; i++) {
    const row = rnd(i, 71), y = hy + 2 + row * row * (H - hy - 2);
    const len = 3 + row * 14, sp = 4 + row * 10;
    const x = ((rnd(i, 72) * (W + 40) + t * sp) % (W + 40)) - 20;
    g.globalAlpha = 0.25 + 0.35 * rnd(i, 73);
    g.fillStyle = warm && rnd(i, 74) > 0.6 ? "#ffc070" : "#bfe0ff";
    g.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
  }
  g.globalAlpha = 1;
}

/** Clouds as soft pixel blobs drifting slowly. */
function clouds(g: CanvasRenderingContext2D, t: number, y0: number, n: number, tint = "#ffffff", a = 0.85) {
  for (let i = 0; i < n; i++) {
    const x = ((rnd(i, 81) * (W + 80) + t * (2 + rnd(i, 82) * 3)) % (W + 80)) - 40;
    const y = y0 + rnd(i, 83) * 26, w = 14 + rnd(i, 84) * 26;
    g.globalAlpha = a * (0.6 + 0.4 * rnd(i, 85)); g.fillStyle = tint;
    g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x - w * 0.3, y - w * 0.12, w * 0.45, w * 0.2, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

/**
 * The Chiapas coast seen from the sea: a flat sandy shore with lagoons and palms in front of the
 * Sierra Madre de Chiapas. hy = horizon line; dusk tints it for the sunset scene.
 */
function chiapasCoast(g: CanvasRenderingContext2D, hy: number, scale = 1, dusk = 0, labels = true) {
  const far = dusk ? "#3a2d55" : "#5a7fa8", mid = dusk ? "#2a2240" : "#3f6b6a";
  g.fillStyle = far; g.beginPath(); g.moveTo(0, hy);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, hy - (10 + 9 * Math.sin(x * 0.045) + 6 * Math.sin(x * 0.11 + 1) + 4 * rnd(x, 91)) * scale);
  g.lineTo(W, hy); g.fill();
  g.fillStyle = mid; g.beginPath(); g.moveTo(0, hy);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, hy - (4 + 3 * Math.sin(x * 0.07 + 2) + 2 * rnd(x, 92)) * scale);
  g.lineTo(W, hy); g.fill();
  g.fillStyle = dusk ? "#c9a070" : "#e8d8a8"; g.fillRect(0, hy - 1, W, Math.max(1, Math.round(1.5 * scale)));          // beach
  g.fillStyle = dusk ? "#1e1830" : "#2f5a3a";
  for (let i = 0; i < 26; i++) { const x = rnd(i, 93) * W, h = (2 + rnd(i, 94) * 3) * scale; g.fillRect(Math.round(x), Math.round(hy - 1 - h), 1, Math.round(h)); g.fillRect(Math.round(x - 1), Math.round(hy - 1 - h), 3, 1); } // palms
  if (labels) {
    for (const [x, name] of [[86, "ARRIAGA"], [214, "TONALA"]] as const) {
      g.fillStyle = dusk ? "#ffe08a" : "#fff7c0"; g.fillRect(x - 2, hy - 3, 1, 1); g.fillRect(x, hy - 2, 1, 1); g.fillRect(x + 2, hy - 3, 1, 1); // town lights
      pxText(g, name, x, hy - 14 * scale - 10, "#ffffff", 1, "center");
      g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(x, hy - 14 * scale - 3, 1, 14 * scale - 1);
    }
  }
}

/** Little astronaut (white suit, blue visor) standing; wave = 0..1 raises the right arm. */
function astronaut(g: CanvasRenderingContext2D, x: number, y: number, wave = 0, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  g.fillStyle = "#14141c"; g.fillRect(-4, -11, 8, 15);
  g.fillStyle = "#e6e6ec"; g.fillRect(-3, -5, 6, 8);
  g.fillStyle = "#f2f2f2"; g.beginPath(); g.arc(0, -7, 3.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1d3f8a"; g.fillRect(-1, -9, 4, 3); g.fillStyle = "#74b4ff"; g.fillRect(0, -9, 1, 1);
  g.fillStyle = "#e6e6ec"; g.fillRect(-5, -4, 2, 5);
  const a = -0.4 - wave * 1.6;
  g.save(); g.translate(3, -4); g.rotate(a); g.fillRect(0, -1, 5, 2); g.restore();
  g.fillStyle = "#c9c9d2"; g.fillRect(-3, 3, 2, 2); g.fillRect(1, 3, 2, 2);
  g.restore();
}

/** Rescue diver in a black wetsuit with an orange buoyancy vest, bobbing at the surface. */
function diver(g: CanvasRenderingContext2D, x: number, y: number, t: number, i: number) {
  const by = y + Math.sin(t * 2.4 + i) * 0.8;
  g.fillStyle = "#14141c"; g.beginPath(); g.arc(x, by - 3, 2.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f07a24"; g.fillRect(x - 2.5, by - 1, 5, 2);
  g.fillStyle = "#74b4ff"; g.fillRect(x - 1, by - 4, 2, 1);
  g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x - 4, by + 1, 8, 1);
}

/** Small rigid-hull inflatable rescue boat with a crew, moving along x. */
function rhib(g: CanvasRenderingContext2D, x: number, y: number, t: number, wake: number) {
  if (wake > 0) for (let i = 0; i < 14; i++) { g.globalAlpha = (1 - i / 14) * 0.7 * wake; g.fillStyle = "#e8f4ff"; g.fillRect(x - 12 - i * 2.5, y + 1 + (i % 2), 3, 1); }
  g.globalAlpha = 1;
  const by = y + Math.sin(t * 3 + x) * 0.6;
  g.fillStyle = "#14141c"; g.fillRect(x - 12, by - 3, 25, 5);
  g.fillStyle = "#f07a24"; g.fillRect(x - 11, by - 2, 23, 3);
  g.fillStyle = "#2a2a36"; g.fillRect(x - 11, by + 1, 23, 1);
  g.fillStyle = "#c9c9d2"; g.fillRect(x - 2, by - 6, 6, 3);
  for (const cx of [x - 7, x - 3, x + 6]) { g.fillStyle = "#14141c"; g.fillRect(cx - 1, by - 7, 3, 4); g.fillStyle = "#f07a24"; g.fillRect(cx - 1, by - 5, 3, 1); }
}

/** The recovery ship, side view: grey hull, superstructure, crane and an open well deck at the stern (left). */
function recoveryShip(g: CanvasRenderingContext2D, x: number, y: number, k: number, t: number, dusk = 0) {
  g.save(); g.translate(x, y); g.scale(k, k);
  const hull = dusk ? "#4a4a5e" : "#7a8494", dark = dusk ? "#2a2a3a" : "#4a5260", light = dusk ? "#6a6a80" : "#a8b2c0";
  g.fillStyle = "#14141c"; g.beginPath(); g.moveTo(-61, -13); g.lineTo(61, -13); g.lineTo(54, 1); g.lineTo(-58, 1); g.fill();
  g.fillStyle = hull; g.beginPath(); g.moveTo(-60, -12); g.lineTo(60, -12); g.lineTo(53, 0); g.lineTo(-57, 0); g.fill();
  g.fillStyle = dark; g.fillRect(-57, -3, 110, 3);
  g.fillStyle = "#0b1020"; g.fillRect(-58, -11, 14, 9);                         // open well deck at the stern
  g.fillStyle = "#ffe08a"; g.fillRect(-57, -10, 12, 1);                         // well-deck lights
  g.fillStyle = light; g.fillRect(-36, -24, 42, 12); g.fillRect(-26, -32, 22, 8); g.fillRect(-18, -40, 6, 8); // superstructure + mast
  g.fillStyle = dark; for (let i = 0; i < 7; i++) g.fillRect(-33 + i * 5.5, -21, 3, 2);
  g.fillStyle = "#1d3f8a"; g.fillRect(-24, -30, 18, 2);
  g.strokeStyle = dark; g.lineWidth = 1; g.beginPath(); g.moveTo(20, -12); g.lineTo(32, -30); g.lineTo(44, -18); g.stroke(); // crane
  g.fillStyle = "#f2d24f"; g.fillRect(31, -31, 2, 2);
  if (Math.floor(t * 2) % 2) { g.fillStyle = "#ff4040"; g.fillRect(-16, -42, 2, 2); }
  g.restore();
  if (k >= 1) pxText(g, "RECOVERY", x + 20 * k, Math.round(y - 9 * k), "#ffffff", 1, "center");
}

function sceneReentry(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#02030a", "#0a1638"); stars(g, t, 0, 50);
  // Earth seen from above the Pacific, coming up fast
  const r = 380, cx = W / 2 + 60, cy = 140 + r - t * 3;
  glow(g, cx, cy - r, 240, "rgba(110,170,255,0.6)", 0.65);
  const gr = g.createLinearGradient(0, cy - r, 0, H); gr.addColorStop(0, "#5aa0ff"); gr.addColorStop(0.2, "#1f5c9a"); gr.addColorStop(1, "#0d2a52");
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#4f8a4c"; g.beginPath(); g.ellipse(250, cy - r + 26, 70, 9, -0.12, 0, Math.PI * 2); g.fill(); // Mexico's Pacific coast
  g.fillStyle = "#c9b27a"; g.fillRect(186, Math.round(cy - r + 31), 60, 1);
  g.globalAlpha = 0.45; g.fillStyle = "#ffffff"; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(40 + i * 46, cy - r + 14 + (i % 3) * 8, 18, 3, 0, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
  g.restore();
  // the service module separates first, then the capsule plunges in shield-first, wrapped in plasma
  const sep = clamp01(t / 1.4);
  const k = clamp01((t - 0.8) / 5.5);
  const x = lerp(70, 178, k), y = lerp(34, 82, k), rot = Math.atan2(48, 108) - Math.PI / 2; // heat shield faces the way it flies
  if (t < 3) {
    g.save(); g.globalAlpha = 1 - clamp01((t - 1.6) / 1.4);
    g.fillStyle = "#c9a24a"; g.translate(x - 16 - sep * 26, y - 16 - sep * 10); g.rotate(rot + sep * 0.8); g.fillRect(-6, -5, 12, 10);
    g.fillStyle = "#1f3f8a"; g.fillRect(-16, -2, 8, 4); g.fillRect(8, -2, 8, 4);
    g.restore(); g.globalAlpha = 1;
  }
  const heat = clamp01((t - 1.2) / 1.5) * (1 - clamp01((t - 6.2) / 0.8) * 0.6);
  if (heat > 0) {
    const dx = Math.cos(rot + Math.PI / 2), dy = Math.sin(rot + Math.PI / 2); // direction of travel (shield first)
    for (let i = 0; i < 90; i++) { // plasma trail streaming back from the shield
      const age = ((t * 1.8 + rnd(i, 101)) % 1);
      const side = (rnd(i, 102) - 0.5) * 18 * (0.4 + age);
      const px = x + dx * 6 - dx * age * 120 + -dy * side, py = y + dy * 6 - dy * age * 120 + dx * side;
      g.globalAlpha = (1 - age) * heat * 0.8;
      g.fillStyle = age < 0.15 ? "#fff6e0" : age < 0.4 ? "#ffb060" : age < 0.7 ? "#ff5a7a" : "#8a4aff";
      g.fillRect(Math.round(px), Math.round(py), age < 0.3 ? 2 : 1, age < 0.3 ? 2 : 1);
    }
    g.globalAlpha = 1;
    glow(g, x + dx * 8, y + dy * 8, 34, "rgba(255,170,90,1)", heat * (0.8 + 0.2 * Math.sin(t * 40)));
    glow(g, x + dx * 8, y + dy * 8, 14, "rgba(255,255,230,1)", heat);
  }
  capsule(g, x, y, 1.1, rot, heat);
  pxText(g, "REENTRY", 6, 6, "#f2d24f", 2);
  pxText(g, "11 KM/S · HEAT SHIELD 2700 C", 6, 20, "#ffffff");
  if (t > 2 && t < 5.2) { if (Math.floor(t * 3) % 2) pxText(g, "COMMS BLACKOUT", W - 6, 6, "#ff6b6b", 1, "right"); }
  else if (t >= 5.2) pxText(g, "SIGNAL ACQUIRED · HOUSTON", W - 6, 6, "#4fc26a", 1, "right");
}

function sceneChutes(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#2f7fd0", "#bfe4ff");
  glow(g, 34, 58, 50, "rgba(255,250,210,1)", 0.7);
  g.fillStyle = "#fffbe0"; g.beginPath(); g.arc(34, 58, 7, 0, Math.PI * 2); g.fill();
  clouds(g, t, 30, 6);
  const hy = 118;
  chiapasCoast(g, hy, 1, 0, true);
  sea(g, t, hy);
  pxText(g, "PACIFIC OCEAN", W / 2, 148, "#e8f4ff", 1, "center");
  // drogues first, then three mains pop open and the capsule slows right down
  const main = clamp01((t - 1.6) / 1.2);
  const fall = t < 1.6 ? t * 12 : 19 + (t - 1.6) * 5;
  const sway = Math.sin(t * 1.4) * 0.06 * main;
  const cx = 165 + Math.sin(t * 0.9) * 3, cy = 48 + fall;
  if (t < 2.2) { const a = 1 - clamp01((t - 1.7) / 0.5); g.globalAlpha = a; chute(g, cx - 5, cy - 22, 4, cx, cy - 14, 1); chute(g, cx + 5, cy - 23, 4, cx, cy - 14, 1); g.globalAlpha = 1; }
  if (main > 0) {
    const r = 6 + 10 * main;
    chute(g, cx - 16 * main, cy - 30 - 14 * main, r * 0.95, cx, cy - 14, main);
    chute(g, cx + 16 * main, cy - 30 - 14 * main, r * 0.95, cx, cy - 14, main);
    chute(g, cx, cy - 38 - 18 * main, r, cx, cy - 14, main);
  }
  capsule(g, cx, cy, 1, sway, 1);
  const alt = Math.round(lerp(7600, 1200, clamp01(t / 7)) / 100) * 100;
  const kmh = Math.round(t < 1.6 ? lerp(480, 200, t / 1.6) : lerp(200, 30, clamp01((t - 1.6) / 2.4)));
  pxText(g, t < 1.6 ? "DROGUE CHUTES" : "MAIN CHUTES OPEN", 6, 6, "#ffffff", 2);
  pxText(g, `ALT ${alt} M · ${kmh} KM/H`, 6, 20, "#0b1230");
  pxText(g, "CHIAPAS, MEXICO", 6, 30, "#0b1230");
}

function sceneSplash(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#3a8ad8", "#cfeaff");
  clouds(g, t, 12, 5);
  const hy = 74;
  chiapasCoast(g, hy, 0.8, 0, false);
  sea(g, t, hy);
  const touch = 1.5;
  const bob = t > touch ? Math.sin((t - touch) * 2.2) * 1.2 * Math.min(1, (t - touch)) : 0;
  const cx = 150, cy = t < touch ? lerp(26, 112, t / touch) : 112 + bob;
  // chutes: carry it down, then are cut loose and settle onto the water to the right
  const cut = clamp01((t - touch - 0.3) / 1.6);
  if (cut < 1) {
    g.globalAlpha = 1 - cut;
    const drift = cut * 50, sink = cut * 40;
    chute(g, cx - 16 + drift, cy - 44 + sink, 15, cx, cy - 14, 1 - cut * 0.7);
    chute(g, cx + 16 + drift, cy - 44 + sink, 15, cx, cy - 14, 1 - cut * 0.7);
    chute(g, cx + drift, cy - 56 + sink, 16, cx, cy - 14, 1 - cut * 0.7);
    g.globalAlpha = 1;
  }
  if (cut > 0.6) for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#f07a24"; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(214 + i * 14, 120 + i * 2, 9, 2, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  // splash: spray arcs and spreading rings
  const sp = t - touch;
  if (sp > 0) {
    for (let r = 0; r < 3; r++) { const rr = ((sp * 1.2 + r / 3) % 1); g.strokeStyle = `rgba(230,245,255,${0.6 * (1 - rr)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, 116, 14 + rr * 70, 3 + rr * 9, 0, 0, Math.PI * 2); g.stroke(); }
    if (sp < 1.6) for (let i = 0; i < 80; i++) {
      const a = Math.PI + rnd(i, 111) * Math.PI, v = 30 + rnd(i, 112) * 50;
      const px = cx + Math.cos(a) * v * sp, py = 114 + Math.sin(a) * v * sp + 60 * sp * sp;
      if (py > 118) continue;
      g.globalAlpha = 1 - sp / 1.6; g.fillStyle = rnd(i, 113) > 0.5 ? "#ffffff" : "#bfe4ff"; g.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    g.globalAlpha = 1;
  }
  capsule(g, cx, cy, 1.4, Math.sin(t * 1.7) * 0.05 * Math.min(1, Math.max(0, sp)), 1);
  if (sp > 0) { g.fillStyle = "rgba(13,42,82,0.55)"; g.fillRect(cx - 18, 116, 36, 4); } // waterline
  // uprighting bags inflate on top, then the recovery beacon flashes
  const bags = clamp01((t - 3) / 1.2);
  if (bags > 0) for (const dx of [-4, 0, 4]) { g.fillStyle = "#f07a24"; g.beginPath(); g.arc(cx + dx * 1.4, cy - 22 - 2 * bags, 3 * bags, 0, Math.PI * 2); g.fill(); }
  if (t > 3.8 && Math.floor(t * 3) % 2) glow(g, cx + 8, cy - 22, 10, "rgba(120,200,255,1)", 0.95);
  if (sp > 0 && sp < 2.4 && Math.floor(t * 4) % 2) pxText(g, "SPLASHDOWN!", W / 2, 8, "#ffffff", 2, "center");
  pxText(g, "PACIFIC OCEAN · OFF ARRIAGA-TONALA", 6, 140, "#ffffff");
  pxText(g, SPLASHDOWN.label, W - 6, 150, "#ffe08a", 1, "right");
  pxText(g, "CHIAPAS, MEXICO", 6, 150, "#bfe4ff");
}

function sceneRescue(g: CanvasRenderingContext2D, t: number) {
  sky(g, "#3a8ad8", "#d8eeff");
  clouds(g, t, 10, 4);
  const hy = 70;
  chiapasCoast(g, hy, 0.6, 0, false);
  sea(g, t, hy);
  recoveryShip(g, 70, hy + 4, 0.75, t);
  // two rescue boats race in, divers jump in and fit the flotation collar
  const arrive = clamp01(t / 2.2);
  rhib(g, lerp(-30, 150, arrive), 120, t, 1 - arrive * 0.6);
  rhib(g, lerp(-60, 240, arrive * 0.95), 132, t, 1 - arrive * 0.6);
  const cx = 196, cy = 116 + Math.sin(t * 2.2) * 1;
  const collar = clamp01((t - 2.4) / 1.2);
  if (collar > 0) { g.fillStyle = "#f2d24f"; g.fillRect(cx - 16 * collar, cy - 1, 32 * collar, 3); g.fillStyle = "#14141c"; g.fillRect(cx - 16 * collar, cy + 2, 32 * collar, 1); }
  capsule(g, cx, cy, 1.4, Math.sin(t * 1.7) * 0.04, 1);
  g.fillStyle = "rgba(13,42,82,0.5)"; g.fillRect(cx - 20, cy + 2, 40, 4);
  if (t > 2) for (let i = 0; i < 3; i++) diver(g, cx - 22 + i * 22, cy + 6 + (i % 2) * 3, t, i);
  // the side hatch opens and the commander waves to the boats
  const hatch = clamp01((t - 4) / 0.6);
  if (hatch > 0) {
    g.fillStyle = "#0b1020"; g.fillRect(cx - 4, cy - 17, 8, 9);
    g.fillStyle = "#e9e9ef"; g.fillRect(cx + 4, cy - 17, 6 * hatch, 9);
    if (t > 4.5) astronaut(g, cx, cy - 14 - Math.min(4, (t - 4.5) * 6), clamp01((t - 5) * 2) * (0.6 + 0.4 * Math.sin(t * 8)), 1);
  }
  pxText(g, "RECOVERY TEAM ON SITE", 6, 6, "#ffffff", 2);
  pxText(g, t > 5 ? "COMMANDER RIVERA IS OUT AND SAFE" : "DIVERS · RESCUE BOATS · RECOVERY SHIP", W / 2, 148, "#ffffff", 1, "center");
}

function sceneShip(g: CanvasRenderingContext2D, t: number) {
  // sunset over the Pacific with the Sierra Madre de Chiapas behind
  sky(g, "#2a2a6a", "#ff9a5a");
  glow(g, 250, 92, 90, "rgba(255,180,90,1)", 0.7);
  g.fillStyle = "#ffd27a"; g.beginPath(); g.arc(250, 94, 12, 0, Math.PI * 2); g.fill();
  clouds(g, t, 30, 4, "#ffb08a", 0.5);
  const hy = 98;
  chiapasCoast(g, hy, 1, 1, true);
  sea(g, t, hy, 1);
  for (let i = 0; i < 18; i++) { g.globalAlpha = 0.5 * rnd(i, 121); g.fillStyle = "#ffd27a"; g.fillRect(244 + (rnd(i, 122) - 0.5) * 20 + Math.sin(t * 2 + i) * 2, hy + 3 + i * 3, 4 + rnd(i, 123) * 8, 1); } // sun glitter
  g.globalAlpha = 1;
  // the capsule is winched into the well deck at the stern of the ship
  const sx = 150, sy = 128;
  recoveryShip(g, sx, sy, 1.25, t, 1);
  const k = clamp01(t / 4.2);
  const cxp = lerp(300, sx - 58, k), cyp = lerp(130, 120, k);
  g.strokeStyle = "#ffe08a"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(sx - 64, 118); g.lineTo(cxp, cyp - 6); g.stroke(); // tow line
  if (k < 1) { capsule(g, cxp, cyp + Math.sin(t * 2) * 0.8, 0.9, 0, 1); g.fillStyle = "rgba(20,24,50,0.6)"; g.fillRect(cxp - 12, cyp + 1, 24, 3); }
  else { g.fillStyle = "#e9e9ef"; g.fillRect(sx - 72, 118, 10, 4); }
  // the crew on deck, and the commander waving from the flight deck
  for (let i = 0; i < 6; i++) { const x = sx + 6 + i * 7; g.fillStyle = "#14141c"; g.fillRect(x, 105 + (i % 2), 3, 6); g.fillStyle = i % 3 === 0 ? "#f07a24" : "#3b6fd6"; g.fillRect(x, 107 + (i % 2), 3, 2); }
  if (t > 4.2) astronaut(g, sx + 52, 104, 0.5 + 0.5 * Math.sin(t * 8), 1);
  if (t > 4.6) pxText(g, "WELCOME HOME, COMMANDER", W / 2, 10, "#ffe08a", 2, "center");
  else pxText(g, "ON BOARD THE RECOVERY SHIP", W / 2, 10, "#ffffff", 1, "center");
  pxText(g, "COAST OF CHIAPAS, MEXICO", W / 2, 150, "#ffffff", 1, "center");
}

/** One frame of a scene at time t (seconds since the scene started). */
export function drawScene(g: CanvasRenderingContext2D, scene: SceneId, t: number) {
  g.save();
  if (scene === "reentry" || scene === "chutes" || scene === "splash" || scene === "rescue" || scene === "ship") {
    ({ reentry: sceneReentry, chutes: sceneChutes, splash: sceneSplash, rescue: sceneRescue, ship: sceneShip })[scene](g, t);
    g.restore();
    return;
  }
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
