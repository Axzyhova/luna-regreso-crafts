/**
 * main.js — starts everything and runs the loop.
 *
 *   simulation.js  ← the only place where game rules live
 *   world3d.js     ← draws the state            ui.js ← panels and cards
 *   audio.js       ← procedural sound           tutorial.js ← what to reveal and when
 *
 * Time: at 1× one game hour takes 4 real seconds (a 28-day lunar cycle ≈ 45 min; at 20× ≈ 2 min).
 */
import * as THREE from "three";
import * as S from "./simulation.js";
import { World3D } from "./world3d.js";
import { UI } from "./ui.js";
import { AudioEngine } from "./audio.js";
import { createTutorial, tutorialUpdate, nextManual, visiblePanels } from "./tutorial.js";
import { initLang, setLang, t, tr } from "./i18n.js";

const HOURS_PER_SECOND = 0.25;
const SAVE_KEY = "colony_save_v1";

const game = { state: null, tutorial: createTutorial(), speed: 1, tool: "walk", selected: null, lastLogT: -1, lastLogText: "", alertCodes: new Set(), milestones: 0, ended: false };
let world, ui;
const audio = new AudioEngine();

// ───────────────────────────── saving ─────────────────────────────
function save() {
  if (!game.state || game.state.lost) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state: game.state, tutorial: game.tutorial })); } catch { /* storage full or unavailable */ }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    return { state: S.deserialize(raw.state), tutorial: { ...createTutorial(), ...raw.tutorial } };
  } catch { return null; }
}

// ───────────────────────────── starting a game ─────────────────────────────
function begin(state, tutorial, announce) {
  game.state = state; game.tutorial = tutorial; game.speed = 1; game.tool = "walk"; game.selected = null; game.ended = false;
  game.lastLogT = state.log[0]?.t ?? -1; game.lastLogText = state.log[0]?.text ?? "";
  game.alertCodes = new Set(state.alerts.map((a) => a.code)); game.milestones = state.milestones.length;
  ui.seenPanels = announce ? [] : visiblePanels(state); ui.announce = false; ui.tab = "console";
  ui.applyMode(state.modeId); audio.setMode(state.modeId);
  world.setMode(state.modeId); world.setLayer(0); world.layer = 0; world.setView("s"); world.rebuild(state);
  if (state.rules.lightCone) { world.cam.dist = 20; world.focus(state.player.x, state.player.y); } // horror: stay close to the light
  else { world.cam.dist = 40; world.focus(13, 9); }                                              // otherwise the whole site: rim at the top, crater floor at the bottom
  tutorialUpdate(state, game.tutorial);
  if (!announce) game.tutorial.queue = [];
  ui.render(true);
}
const api = {
  getState: () => game.state, getTutorial: () => game.tutorial,
  getSpeed: () => game.speed, setSpeed: (v) => { game.speed = v; },
  getTool: () => game.tool, setTool: (v) => { game.tool = v; },
  getSelected: () => game.selected,
  hasSave,
  /** Run something on the state and return its result. */
  act: (fn) => { const r = fn(game.state); afterAction(); return r; },
  newGame: (mode, diff) => begin(S.createState(mode, diff, (Date.now() % 100000) + 1), createTutorial(), true),
  stressTest: (mode, diff) => { const s = S.createStressTest(mode, diff); const tut = createTutorial(); begin(s, tut, false); ui.toast(tr(s.log[0].text), "bad"); },
  continueGame: () => { const sv = loadSave(); if (sv) begin(sv.state, sv.tutorial, false); else ui.showMenu(); },
  exitToMenu: () => { save(); game.state = null; ui.clear(); ui.showMenu(); },
  onLang: () => { document.title = t("LUNAR COLONY SIMULATOR"); },
  audio,
  get world() { return world; },
};

// ───────────────────────────── reactions ─────────────────────────────
/** After a step or an action: manuals, sounds for new log lines, crew transmissions, endings. */
function afterAction() {
  const s = game.state;
  if (!s) return;
  const { newManuals } = tutorialUpdate(s, game.tutorial);
  void newManuals;
  // new log lines → sounds
  const top = s.log[0];
  if (top && (top.t !== game.lastLogT || top.text !== game.lastLogText)) {
    game.lastLogT = top.t; game.lastLogText = top.text;
    if (top.level === "bad") { audio.sfx(/Breach|BREACH/.test(top.text) ? "breach" : /Blackout|BLACKOUT/.test(top.text) ? "blackout" : "alert"); ui.toast(tr(top.text), "bad"); }
    else if (top.level === "good") { audio.sfx(/CAPCOM/.test(top.text) ? "mission" : "ok"); ui.toast(tr(top.text), "good"); }
    else if (top.level === "warn") ui.toast(tr(top.text), "warn");
  }
  // crew speaks when an alert first appears or a milestone is reached
  const codes = new Set(s.alerts.filter((a) => !a.fake).map((a) => a.code));
  for (const c of ["breach", "blackout", "cme_warn", "soil", "dust"]) if (codes.has(c) && !game.alertCodes.has(c)) ui.transmission(c);
  game.alertCodes = codes;
  if (s.milestones.length > game.milestones) { for (const id of s.milestones.slice(game.milestones)) ui.transmission(id); game.milestones = s.milestones.length; }
  // first-time manuals, one at a time, never over another card
  if (!ui.modalOpen) { const m = nextManual(game.tutorial); if (m) ui.showManual(m.id); }
  if ((s.lost || (s.crew.suitless && !game.shownWin)) && !game.ended && !ui.modalOpen) {
    if (s.lost) game.ended = true; else game.shownWin = true;
    ui.showEnding();
  }
}

// ───────────────────────────── picking cells ─────────────────────────────
function pick(x, y, layer) {
  const s = game.state;
  if (!s || ui.modalOpen) return;
  audio.start();
  game.selected = { x, y, layer }; world.select(x, y, layer);
  const tool = game.tool;
  let r = null, sound = "ok";
  if (tool === "walk") { S.movePlayer(s, x, y, layer); audio.sfx("click"); }
  else if (tool === "pipe") r = S.layPipe(s, x, y, layer);
  else if (tool === "pave") r = S.pave(s, x, y);
  else if (tool === "pile") r = S.pile(s, x, y);
  else if (tool === "demolish") { const c = S.cellAt(s, x, y, layer); r = c && c.b !== null ? S.demolish(s, c.b) : { ok: false, msg: "Nothing there" }; }
  else if (tool.startsWith("build:")) { r = S.build(s, tool.slice(6), x, y, layer); sound = "build"; }
  if (r) { ui.toast(tr(r.msg), r.ok ? "good" : "bad"); audio.sfx(r.ok ? sound : "error"); }
  afterAction(); ui.render(true);
}

function movePlayerBy(dx, dy) {
  const s = game.state, p = s.player;
  if (S.movePlayer(s, p.x + dx, p.y + dy, p.layer)) { game.selected = { x: p.x, y: p.y, layer: p.layer }; world.select(p.x, p.y, p.layer); afterAction(); ui.render(true); }
}

function onKey(e) {
  const s = game.state;
  if (e.target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === "Escape") { if (ui.modalOpen && ui.modalKind !== "menu" && !ui.modalKind.startsWith("brief") && ui.modalKind !== "ending") ui.closeModal(); else if (s) { game.tool = "walk"; ui.render(true); } return; }
  if (!s || ui.modalOpen) return;
  const panels = visiblePanels(s), k = e.key.toLowerCase();
  if (k === "w" || e.key === "ArrowUp") movePlayerBy(0, -1);
  else if (k === "s" || e.key === "ArrowDown") movePlayerBy(0, 1);
  else if (k === "a" || e.key === "ArrowLeft") movePlayerBy(-1, 0);
  else if (k === "d" || e.key === "ArrowRight") movePlayerBy(1, 0);
  else if (k === "e") { // dig the selected cell if it is in reach, otherwise the cell under your feet
    const p = s.player, sel = game.selected;
    const near = sel && sel.layer === "s" && Math.abs(sel.x - p.x) <= 1 && Math.abs(sel.y - p.y) <= 1;
    const c = near ? sel : { x: p.x, y: p.y };
    ui.do((st) => S.excavate(st, c.x, c.y), "dig");
  }
  else if (["1", "2", "3", "4"].includes(e.key) && panels.includes("layers")) { world.setLayer(Number(e.key)); ui.render(true); }
  else if (e.key === " " && panels.includes("timecontrol")) { game.speed = game.speed ? 0 : 1; ui.render(true); }
  else if (e.key === "Tab" && s.tubeFound) { world.setView(world.view === "s" ? "u" : "s"); ui.render(true); }
  else if (k === "m") ui.do((st) => S.meltIce(st), "water");
  else return;
  e.preventDefault();
}

// ───────────────────────────── loop ─────────────────────────────
let last = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const s = game.state;
  if (s) {
    if (game.speed > 0 && !ui.modalOpen && !s.lost) { S.step(s, dt * HOURS_PER_SECOND * game.speed); afterAction(); }
    world.sync(s, dt);
    audio.update(s);
    uiT -= dt; if (uiT <= 0) { ui.render(false); uiT = 0.25; }
    saveT -= dt; if (saveT <= 0) { save(); saveT = 20; }
    ui.frame(now / 1000);
  }
  world.render();
  requestAnimationFrame(frame);
}

function boot() {
  initLang();
  document.title = t("LUNAR COLONY SIMULATOR");
  const root = document.getElementById("app");
  try {
    world = new World3D(THREE, document.getElementById("view"), { onPick: pick });
  } catch (err) {
    document.getElementById("view").innerHTML = `<p class="fatal">${t("Your browser could not start WebGL. The simulation needs it for the 3D view.")}</p>`;
    console.error(err);
    return;
  }
  ui = new UI(root, api);
  window.addEventListener("resize", () => world.resize());
  window.addEventListener("keydown", onKey);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  // a quiet scene behind the menu
  const preview = S.createState("realista", "normal", 1);
  world.setMode("realista"); world.rebuild(preview); world.sync(preview, 0);
  ui.showMenu();
  // shortcuts for testing and demos:  ?stress[=mode]  opens the quick mode,  ?play[=mode]  starts a new game without the briefing
  //   ?lang=es|en  sets the language
  const q = new URLSearchParams(location.search), pickMode = (v) => (["realista", "fantastico", "terrorifico"].includes(v) ? v : "realista");
  if (q.get("lang")) { setLang(q.get("lang")); api.onLang(); ui.showMenu(); }
  if (q.has("stress")) { ui.closeModal(); api.stressTest(pickMode(q.get("stress")), "normal"); }
  else if (q.has("play")) { ui.closeModal(); api.newGame(pickMode(q.get("play")), "normal"); game.tutorial.queue = []; }
  requestAnimationFrame(frame);
}
boot();

// For debugging from the browser console.
window.colony = { game, S, get world() { return world; }, get ui() { return ui; } };
