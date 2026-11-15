/**
 * observatory.js — the scanning interface of the cryogenic telescope on the crater floor.
 * Three programs, each with its own instrument display drawn on a 2D canvas:
 *   cme → the solar limb (storm forecast)      nea → near-Earth asteroid tracks (funding)
 *   exo → an exoplanet transit light curve (science)
 * The numbers come from the simulation; this file only draws and offers the buttons.
 */
import { OBS_TASKS, countOf, cmeWarningHours, startObservation } from "./simulation.js";
import { t, tr, loc } from "./i18n.js";

const css = (name, fallback) => (typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback : fallback);

/** Seeded pseudo-random so each display is stable between frames. */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function drawFrame(g, w, h, title) {
  g.fillStyle = "#03060d"; g.fillRect(0, 0, w, h);
  g.strokeStyle = css("--grid", "#2a3a66"); g.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += h / 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = css("--accent", "#4ea1ff"); g.font = "11px monospace"; g.textBaseline = "top"; g.fillText(title, 8, 6);
}

function drawSun(g, w, h, time, state) {
  const cx = w * 0.32, cy = h * 0.56, r = h * 0.3;
  const grad = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, "#fff3b0"); grad.addColorStop(1, "#f08a24");
  g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // prominences on the limb; one grows as the next storm approaches
  const eta = state.events.cme ? 0 : Math.max(0, state.events.nextCME - state.t);
  const threat = state.events.cme ? 1 : Math.max(0, 1 - eta / 48);
  const R = rng(99);
  g.strokeStyle = "#ffb066"; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, len = r * (0.08 + R() * 0.12) * (1 + 0.3 * Math.sin(time * 2 + i));
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)); g.stroke();
  }
  if (threat > 0) {
    g.strokeStyle = css("--bad", "#ff5c5c"); g.lineWidth = 3;
    g.beginPath(); g.arc(cx + r * 0.9, cy - r * 0.3, r * (0.2 + threat * 0.7), -0.9, 0.9); g.stroke();
  }
  g.fillStyle = css("--text", "#dfe8ff"); g.font = "11px monospace";
  const lead = cmeWarningHours(state);
  const known = eta <= lead;
  g.fillText(`${t("Storm warning")}: ${lead} h`, w * 0.62, h * 0.3);
  g.fillStyle = state.events.cme ? css("--bad", "#ff5c5c") : known ? css("--warn", "#f2b84f") : css("--ok", "#4ee68a");
  g.fillText(state.events.cme ? tr("SOLAR STORM in progress: stay shielded").slice(0, 26) : known ? `CME T−${eta.toFixed(1)} h` : "CME: —", w * 0.62, h * 0.3 + 18);
}

function drawAsteroids(g, w, h, time, state) {
  const R = rng(7 + state.obs.nea);
  const cx = w * 0.5, cy = h * 0.58;
  g.strokeStyle = css("--grid", "#2a3a66");
  for (const rr of [0.18, 0.3, 0.42]) { g.beginPath(); g.ellipse(cx, cy, w * rr, h * rr * 0.9, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = "#3b7bd6"; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2 + time * (0.05 + R() * 0.1), d = 0.14 + R() * 0.3;
    const x = cx + Math.cos(a) * w * d, y = cy + Math.sin(a) * h * d * 0.9, tracked = i < state.obs.nea;
    g.fillStyle = tracked ? css("--ok", "#4ee68a") : css("--text", "#dfe8ff");
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
    if (tracked) { g.strokeStyle = css("--ok", "#4ee68a"); g.strokeRect(x - 6, y - 6, 12, 12); }
  }
  g.fillStyle = css("--text", "#dfe8ff"); g.font = "11px monospace";
  g.fillText(`${t("Asteroids tracked")}: ${state.obs.nea}`, 8, h - 18);
}

function drawTransit(g, w, h, time, state) {
  const R = rng(31 + state.obs.exoplanets);
  const y0 = h * 0.45, depth = h * (0.12 + R() * 0.1), mid = w * (0.35 + R() * 0.3), half = w * 0.09;
  g.strokeStyle = css("--ok", "#4ee68a"); g.lineWidth = 1.5; g.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const d = Math.abs(x - mid), dip = d < half ? depth * Math.min(1, (half - d) / (half * 0.3)) : 0;
    const y = y0 + dip + Math.sin(x * 0.9 + time * 3) * 1.5 + (R() - 0.5) * 3;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const sweep = ((time * 40) % (w + 40)) - 20;
  g.strokeStyle = css("--accent", "#4ea1ff"); g.beginPath(); g.moveTo(sweep, 22); g.lineTo(sweep, h - 4); g.stroke();
  g.fillStyle = css("--text", "#dfe8ff"); g.font = "11px monospace";
  g.fillText(`${t("Exoplanets surveyed")}: ${state.obs.exoplanets}`, 8, h - 18);
}

/** Draw the instrument display for the running (or last selected) program. */
export function drawObservatory(canvas, state, time, kind) {
  const g = canvas.getContext("2d");
  if (!g) return;
  const w = canvas.width, h = canvas.height;
  const k = state.obs.task?.kind ?? kind ?? "cme";
  drawFrame(g, w, h, loc.obsTask(k).name.toUpperCase());
  if (!countOf(state, "telescope", true)) {
    g.fillStyle = css("--bad", "#ff5c5c"); g.font = "12px monospace"; g.fillText("NO SIGNAL", w / 2 - 34, h / 2 - 6);
    return;
  }
  if (k === "cme") drawSun(g, w, h, time, state);
  if (k === "nea") drawAsteroids(g, w, h, time, state);
  if (k === "exo") drawTransit(g, w, h, time, state);
  if (state.obs.task) {
    const total = OBS_TASKS[state.obs.task.kind].hours, done = 1 - state.obs.task.left / total;
    g.fillStyle = css("--panel", "#111a33"); g.fillRect(8, h - 8, w - 16, 4);
    g.fillStyle = css("--accent", "#4ea1ff"); g.fillRect(8, h - 8, (w - 16) * Math.max(0, Math.min(1, done)), 4);
  }
}

/**
 * HTML of the observatory panel. `selected` is the program whose display is shown when idle.
 * Buttons carry data-obs="cme|nea|exo"; bind them with `bindObservatory`.
 */
export function observatoryHtml(state, selected = "cme") {
  const working = countOf(state, "telescope", true) > 0, task = state.obs.task;
  const rows = Object.keys(OBS_TASKS).map((k) => {
    const o = loc.obsTask(k), running = task?.kind === k;
    return `<div class="row obs-row${selected === k ? " sel" : ""}"><div><b>${o.name}</b> <span class="dim">(${o.hours} h)</span><div class="dim small">${o.desc}</div></div>
      <button class="btn" data-obs="${k}" ${!working || task ? "disabled" : ""}>${running ? `${t("Running")} · ${task.left.toFixed(1)} ${t("h left")}` : t("Scan")}</button></div>`;
  }).join("");
  return `<canvas class="obs-canvas" width="420" height="190" aria-label="${t("Telescope program")}"></canvas>
    <div class="kv"><span>${t("Storm warning")}</span><b>${cmeWarningHours(state)} h</b><span>${t("Asteroids tracked")}</span><b>${state.obs.nea}</b><span>${t("Exoplanets surveyed")}</span><b>${state.obs.exoplanets}</b></div>
    ${working ? "" : `<p class="warn small">${tr("Needs a powered telescope on the crater floor")}</p>`}${rows}`;
}

/** Wire the buttons of the panel. `onResult({ok,msg})` lets the UI show the outcome; `onSelect(kind)` changes the display. */
export function bindObservatory(root, getState, onResult, onSelect) {
  root.querySelectorAll("[data-obs]").forEach((b) => b.addEventListener("click", () => { const k = b.getAttribute("data-obs"); onSelect?.(k); onResult(startObservation(getState(), k)); }));
  root.querySelectorAll(".obs-row").forEach((row, i) => row.addEventListener("mouseenter", () => onSelect?.(Object.keys(OBS_TASKS)[i], true)));
}
