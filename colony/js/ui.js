/**
 * ui.js — the mission-control interface: top bar, objective and alerts, tabbed panels, tools,
 * the selected-cell inspector and the modal cards (menu, briefing, manuals, science cards, endings).
 *
 * The UI never edits the simulation itself: it calls functions from simulation.js through `api.act`,
 * which runs them, shows the result and refreshes. Panels appear as the tutorial unlocks them.
 * All handlers use event delegation (data-act="name:arg"), so panels can be re-rendered freely.
 */
import * as S from "./simulation.js";
import { TECHS, TREES, techsOfTree, researchBlock, techFor, unlockedSet, treeProgress } from "./techTree.js";
import { MODES, DIFFICULTIES, getMode, displayedReading, modeCssVars } from "./gameModes.js";
import { missionPatchSvg } from "./lore.js";
import { visiblePanels, currentObjective, MANUALS, getManual, fieldManualIndex, flowSvg } from "./tutorial.js";
import { observatoryHtml, bindObservatory, drawObservatory } from "./observatory.js";
import { t, tr, loc, getLang, setLang, LANGS } from "./i18n.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n0 = (v) => Math.round(v).toLocaleString(getLang());
const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const costText = (cost) => Object.entries(cost ?? {}).map(([k, v]) => `${v} ${loc.resource(k)}`).join(" · ") || "—";
const bar = (pct, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

/** Tabs of the right panel: [tab id, label, tutorial panel that reveals it (null = always)]. */
const TABS = [
  ["console", "Console", null], ["build", "Build", "build"], ["techtree", "Tech", "techtree"], ["power", "Power", "power"],
  ["atmosphere", "Air", "atmosphere"], ["networks", "Networks", "networks"], ["rovers", "Rovers", "rovers"], ["blss", "Farm", "blss"],
  ["observatory", "Observatory", "observatory"], ["shipyard", "Shipyard", "shipyard"], ["manual", "Manual", null], ["log", "Log", null],
];

export class UI {
  /**
   * @param {HTMLElement} root   element with #topbar #left #right #bottom #toasts #modal inside
   * @param {object} api         see main.js: getState, getTutorial, act, getSpeed, setSpeed, getTool, setTool,
   *                             getSelected, newGame, stressTest, continueGame, hasSave, exitToMenu, world, audio, onLang
   */
  constructor(root, api) {
    this.root = root; this.api = api;
    this.tab = "console"; this.obsKind = "cme"; this.modalKind = null; this.seenPanels = [];
    this.el = { top: $("#topbar", root), left: $("#left", root), right: $("#right", root), bottom: $("#bottom", root), toasts: $("#toasts", root), modal: $("#modal", root) };
    root.addEventListener("click", (e) => this._click(e));
    this.menuChoice = { mode: "realista", diff: "normal" };
  }

  // ───────────────────────────── helpers ─────────────────────────────
  get state() { return this.api.getState(); }
  toast(text, level = "info") {
    if (!text) return;
    const d = document.createElement("div");
    d.className = `toast ${level}`; d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.classList.add("out"), 3600); setTimeout(() => d.remove(), 4200);
  }
  /** Run a simulation action and report it. */
  do(fn, sound = "ok") {
    const r = this.api.act(fn);
    if (r && typeof r === "object" && "ok" in r) {
      this.toast(tr(r.msg), r.ok ? "good" : "bad");
      this.api.audio.sfx(r.ok ? sound : "error");
    }
    this.render(true);
    return r;
  }
  /** Empty the panels (back at the menu, with no game running). */
  clear() { for (const k of ["top", "left", "right", "bottom"]) this.el[k].innerHTML = ""; }
  applyMode(modeId) {
    for (const [k, v] of Object.entries(modeCssVars(modeId))) document.documentElement.style.setProperty(k, v);
    document.body.dataset.mode = getMode(modeId).id;
  }

  // ───────────────────────────── clicks ─────────────────────────────
  _click(e) {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const [name, ...rest] = el.getAttribute("data-act").split(":"), arg = rest.join(":");
    const s = this.state, A = this.api;
    A.audio.start();
    switch (name) {
      // menu
      case "menu-mode": this.menuChoice.mode = arg; this.applyMode(arg); A.audio.setMode(arg); A.audio.sfx("click"); this.showMenu(); break;
      case "menu-diff": this.menuChoice.diff = arg; A.audio.sfx("click"); this.showMenu(); break;
      case "menu-start": this.showBriefing(this.menuChoice.mode, 0); break;
      case "menu-stress": this.closeModal(); A.stressTest(this.menuChoice.mode, this.menuChoice.diff); break;
      case "menu-continue": this.closeModal(); A.continueGame(); break;
      case "brief": { const i = Number(arg); if (i >= 4) { this.closeModal(); A.newGame(this.menuChoice.mode, this.menuChoice.diff); } else this.showBriefing(this.menuChoice.mode, i); A.audio.sfx("click"); break; }
      case "lang": setLang(arg || (getLang() === "en" ? "es" : "en")); A.onLang?.(); if (this.modalKind === "menu") this.showMenu(); else if (this.modalKind?.startsWith("brief")) this.showBriefing(this.menuChoice.mode, Number(this.modalKind.slice(5))); this.render(true); break;
      case "mute": A.audio.toggleMute(); this.render(true); break;
      case "exit": A.exitToMenu(); break;
      case "close": this.closeModal(); A.audio.sfx("click"); break;
      case "again": this.closeModal(); A.exitToMenu(); break;
      // top bar
      case "speed": A.setSpeed(Number(arg)); A.audio.sfx("click"); this.render(true); break;
      case "tab": this.tab = arg; A.audio.sfx("click"); this.render(true); break;
      case "layer": A.world.setLayer(Number(arg)); this.render(true); break;
      case "view": A.world.setView(arg); this.render(true); break;
      // tools and building
      case "tool": A.setTool(arg); A.audio.sfx("click"); this.render(true); break;
      case "research": { const r = this.do((st) => S.research(st, arg), "research"); if (r?.ok) this.showScienceCard(arg); break; }
      case "card": this.showScienceCard(arg); break;
      case "manual": this.showManual(arg); break;
      case "logs": this.showLostLogs(); break;
      // cell and building actions
      case "dig": { const c = A.getSelected(); if (c) this.do((st) => S.excavate(st, c.x, c.y), "dig"); break; }
      case "melt": this.do((st) => S.meltIce(st), "water"); break;
      case "repair": this.do((st) => S.repair(st, Number(arg))); break;
      case "toggle": this.do((st) => { S.toggle(st, Number(arg)); return null; }); A.audio.sfx("click"); break;
      case "demolish": this.do((st) => S.demolish(st, Number(arg))); break;
      case "eds": this.do((st) => S.edsPulse(st, Number(arg)), "eds"); break;
      case "edsauto": this.do((st) => { const b = S.buildingById(st, Number(arg)); if (b) b.auto = !b.auto; return null; }); break;
      case "scan": this.do((st) => S.seismicScan(st), "research"); break;
      case "berm": this.do((st) => S.buildBerm(st), "build"); break;
      case "resupply": this.do((st) => S.resupply(st, arg)); break;
      case "gas": this.do((st) => S.addGas(st, arg, arg === "o2" ? 5 : 20)); break;
      case "crystal": this.do((st) => (arg === "use" ? S.useCrystal(st) : S.collectCrystal(st))); break;
      case "assemble": this.do((st) => S.assembleSubsystem(st, arg), "build"); break;
      case "launch": { const r = this.do((st) => S.launch(st, arg), "launch"); if (r?.ok) { A.world.rebuild(this.state); this.showEnding(); } break; }
      case "route": {
        const id = Number(arg), row = el.closest(".rover");
        const from = Number($("[data-f=from]", row).value), to = Number($("[data-f=to]", row).value), res = $("[data-f=res]", row).value;
        this.do((st) => S.setRoverRoute(st, id, from, to, res)); break;
      }
      case "routeclear": this.do((st) => { S.clearRoverRoute(st, Number(arg)); return null; }); break;
      case "rescue": this.do((st) => S.rescueRover(st, Number(arg))); break;
      default: break;
    }
    void s;
  }

  // ───────────────────────────── frame and render ─────────────────────────────
  /** Called every animation frame (cheap work only). */
  frame(time) {
    const canvas = $(".obs-canvas", this.el.right);
    if (canvas && this.state) drawObservatory(canvas, this.state, time, this.obsKind);
  }

  /** Redraw the interface. Called a few times per second, and with `force` after every action. */
  render(force = false) {
    const s = this.state;
    if (!s) return;
    const panels = visiblePanels(s);
    this._top(s, panels); this._left(s, panels); this._bottom(s, panels);
    // don't rebuild a panel while the player is choosing something in it
    const busy = this.el.right.contains(document.activeElement) && ["SELECT", "INPUT"].includes(document.activeElement.tagName);
    if (force || !busy) this._right(s, panels);
    document.body.classList.toggle("glitch", s.rules.hudGlitches && s.crew.sanity < 45);
  }

  _top(s, panels) {
    const m = loc.mode(s.modeId), c = S.clock(s), speed = this.api.getSpeed();
    const R = (k, v, fmt = n0) => `<span class="res" title="${esc(loc.resource(k))}"><em>${esc(loc.resource(k))}</em><b>${fmt(v)}</b></span>`;
    const hab = displayedReading(s, "pressure", s.air.habitability);
    const speeds = panels.includes("timecontrol")
      ? [[0, "❚❚"], [1, "1×"], [5, "5×"], [20, "20×"]].map(([v, l]) => `<button class="btn sm${speed === v ? " on" : ""}" data-act="speed:${v}" ${v === 0 ? `title="${t("Pause")}"` : ""}>${l}</button>`).join("")
      : "";
    const layers = panels.includes("layers")
      ? `<span class="grp" title="${t("Layers")}">${[1, 2, 3, 4].map((n) => `<button class="btn sm${this.api.world.layer === n ? " on" : ""}" data-act="layer:${n}" title="${esc(loc.layer(n).name)}">${n}</button>`).join("")}</span>`
      : "";
    const view = panels.includes("underground")
      ? `<span class="grp"><button class="btn sm${this.api.world.view === "s" ? " on" : ""}" data-act="view:s">${t("Surface")}</button><button class="btn sm${this.api.world.view === "u" ? " on" : ""}" data-act="view:u">${t("Underground")}</button></span>`
      : "";
    this.el.top.innerHTML = `
      <span class="brand">${esc(m.codename)} <small>${esc(loc.scenario(s.scenario))}</small></span>
      <span class="clock">${c.night ? "☾" : "☀"} ${t("Day")} ${c.day} · ${String(c.hour).padStart(2, "0")}:00 <small>${n0(c.toTerminator)} ${c.night ? t("h to sunrise") : t("h to sunset")}</small></span>
      <span class="grp">${speeds}</span>${layers}${view}
      <span class="resbar">${R("water", s.res.water)}${R("o2", s.res.o2)}${R("food", s.res.food)}${R("parts", s.res.parts)}${R("regolith", s.res.regolith)}${s.res.ice > 0 ? R("ice", s.res.ice) : ""}${R("science", s.res.science)}${R("funds", s.res.funds)}
        <span class="res" title="${t("Habitability")}"><em>${t("Habitability")}</em><b class="${hab.value >= 70 ? "good" : hab.value >= 40 ? "warn" : "bad"}">${n0(hab.value)}%</b></span></span>
      <span class="grp right"><button class="btn sm" data-act="lang" title="${t("Language")}">${getLang().toUpperCase()}</button><button class="btn sm" data-act="mute" title="${t("Sound")}">${this.api.audio.muted ? "🔇" : "🔊"}</button><button class="btn sm" data-act="exit">${t("Menu")}</button></span>`;
    if (this.api.world.layer) this.el.top.insertAdjacentHTML("beforeend", `<span class="legend">${esc(loc.layer(this.api.world.layer).name)} — ${esc(loc.layer(this.api.world.layer).legend)}</span>`);
  }

  _left(s, panels) {
    const K = s.crew, P = s.player;
    const missions = panels.includes("capcom")
      ? `<h3>${esc(getMode(s.modeId).terms.capcom)} · ${t("MISSIONS")}</h3>${S.activeMissions(s).map((m0) => { const m = loc.mission(m0); return `<div class="mission"><b>${esc(m.title)}</b><div class="dim small">${esc(m.text)}</div><div class="small reward">${t("Reward")}: ${Object.entries(m.reward).map(([k, v]) => `+${v} ${loc.resource(k)}`).join(" · ")}</div></div>`; }).join("") || `<p class="dim small">—</p>`}`
      : "";
    const alerts = s.alerts.length ? s.alerts.map((a) => `<div class="alert ${a.level}${a.fake ? " fake" : ""}">${esc(tr(a.text))}</div>`).join("") : `<p class="dim small">${t("No alerts")}</p>`;
    const crewN = displayedReading(s, "crew", K.count);
    this.el.left.innerHTML = `
      <h3>${t("OBJECTIVE")}</h3><p class="objective">${esc(tr(currentObjective(s)))}</p>
      ${missions}
      <h3>${t("ALERTS")}</h3>${alerts}
      <h3>${t("Crew")} · ${crewN.value}</h3>
      <div class="kv"><span>${t("Health")}</span>${bar(K.health, K.health < 40 ? "bad" : "good")}<span>${t("Stress")}</span>${bar(K.stress, K.stress > 70 ? "bad" : "warn")}
        ${s.rules.sanity ? `<span>${t("Sanity")}</span>${bar(K.sanity, K.sanity < 45 ? "bad" : "good")}` : ""}
        <span>${t("Suit oxygen")}</span><b>${P.inside ? t("inside") : `${n1(P.suitO2)} h · ${t("outside (EVA)")}`}</b>
        ${K.dose > 5 ? `<span>${t("Radiation dose")}</span><b class="${K.dose >= 100 ? "bad" : "warn"}">${n0(K.dose)}</b>` : ""}
        ${K.suitless ? `<span></span><b class="good">${t("Living without suits")}</b>` : ""}</div>
      ${s.loreLogs.length ? `<button class="btn sm wide" data-act="logs">${t("Lost expedition logs")} (${s.loreLogs.length})</button>` : ""}`;
    // announce newly unlocked panels once
    for (const id of panels) if (!this.seenPanels.includes(id)) { this.seenPanels.push(id); if (this.seenPanels.length > 4 && this.announce) { const p = loc.panel(id); this.toast(`${t("New panel unlocked")}: ${p.name} — ${p.hint}`, "good"); this.api.audio.sfx("manual"); } }
    this.announce = true;
  }

  _bottom(s, panels) {
    const tool = this.api.getTool(), sel = this.api.getSelected(), U = unlockedSet(s.techs);
    const tb = (id, label, show = true) => (show ? `<button class="btn${tool === id ? " on" : ""}" data-act="tool:${id}">${label}</button>` : "");
    const tools = `<div class="tools">${tb("walk", t("Inspect"))}${tb("pipe", `${t("Pipe")} (1)`, panels.includes("build"))}${tb("pave", t("Pave"), U.has("action:pave"))}${tb("pile", `${t("Piles")} (4)`, U.has("action:pile"))}${tb("demolish", t("Demolish"), panels.includes("build"))}
      ${tool.startsWith("build:") ? `<span class="chip">${t("Build")}: ${esc(loc.building(tool.slice(6)).name)}</span>` : ""}</div>`;
    let info = `<span class="dim small">${t("Click a cell to walk there · E dig · 1–4 data layers · Space pause · Tab surface/underground")}</span>`;
    if (sel) {
      const c = S.cellAt(s, sel.x, sel.y, sel.layer), b = c && c.b !== null ? S.buildingById(s, c.b) : null;
      const z = loc.zone(sel.layer === "u" ? "tube" : c.zone);
      const near = Math.abs(s.player.x - sel.x) <= 1 && Math.abs(s.player.y - sel.y) <= 1 && s.player.layer === sel.layer;
      const flags = sel.layer === "s" ? [c.paved ? t("paved") : "", c.piled ? t("piles") : "", c.pipe ? t("pipe") : ""].filter(Boolean).join(" · ") : c.pipe ? t("pipe") : "";
      const cellBits = sel.layer === "s"
        ? `<span>${t("Stability")} <b class="${c.stability < (c.piled ? 25 : 45) ? "bad" : ""}">${n0(c.stability)}%</b></span><span>${t("Dust")} <b>${n0(c.dust * 100)}%</b></span>${c.ice > 0 ? `<span>${t("Ice")} <b>${n0(c.ice)} kg</b></span>` : ""}<span>${t("Sunlight")} <b>${S.illumination(s, sel.x, sel.y) > 0 ? "☀" : "—"}</b></span>`
        : "";
      let bHtml = "";
      if (b) {
        const d = loc.building(b.type), buf = Object.entries(b.buf).filter(([, v]) => v > 0.05).map(([k, v]) => `${n0(v)} ${loc.resource(k)}`).join(", ");
        bHtml = `<div class="binfo"><b>${esc(d.name)}</b> <span class="chip st-${b.status}">${esc(loc.status(b.status))}</span>
          <span>${t("Integrity")} ${n0(b.hp)}%</span><span>${t("Dust")} ${n0(b.dust * 100)}%</span>${S.BUILDINGS[b.type].vol ? `<span>${t("Seal wear")} ${n0(b.wear * 100)}%</span>` : ""}${buf ? `<span>${t("Buffer")}: ${buf}</span>` : ""}
          <span class="acts">${b.hp < 100 || b.breached || b.wear >= 0.05 ? `<button class="btn sm" data-act="repair:${b.id}">${t("Repair")} (2)</button>` : ""}
          <button class="btn sm" data-act="toggle:${b.id}">${b.on ? t("Switch off") : t("Switch on")}</button>
          ${b.type === "eds" ? `<button class="btn sm" data-act="eds:${b.id}">${t("Fire pulse")}</button><button class="btn sm${b.auto ? " on" : ""}" data-act="edsauto:${b.id}">${t("Auto")}</button>` : ""}
          ${b.type === "seismic_radar" && !s.tubeFound ? `<button class="btn sm" data-act="scan">${t("Scan")}</button>` : ""}
          ${b.type === "habitat" && s.res.ice > 0 ? `<button class="btn sm" data-act="melt">${t("Melt ice")}</button>` : ""}
          <button class="btn sm" data-act="manual:${b.type}">?</button></span><div class="dim small">${esc(d.desc)}</div></div>`;
      }
      info = `<div class="cell"><b>${esc(z.name)}</b> <span class="dim">(${sel.x}, ${sel.y})</span> ${cellBits} ${flags ? `<span class="chip">${flags}</span>` : ""}
        ${!b && sel.layer === "s" && near && !c.paved ? `<button class="btn sm" data-act="dig">${t("Dig")} (E)</button>` : ""}</div>${bHtml || `<div class="dim small">${esc(z.note)}</div>`}`;
    }
    this.el.bottom.innerHTML = tools + `<div class="info">${info}</div>`;
  }

  _right(s, panels) {
    const tabs = TABS.filter(([, , need]) => !need || panels.includes(need));
    if (!tabs.some(([id]) => id === this.tab)) this.tab = "console";
    const head = `<nav class="tabs">${tabs.map(([id, label]) => `<button class="tab${this.tab === id ? " on" : ""}" data-act="tab:${id}">${t(label)}</button>`).join("")}</nav>`;
    const body = this[`_p_${this.tab}`]?.(s) ?? "";
    this.el.right.innerHTML = head + `<div class="panel">${body}</div>`;
    if (this.tab === "observatory") bindObservatory(this.el.right, () => this.state, (r) => { this.toast(tr(r.msg), r.ok ? "good" : "bad"); this.api.audio.sfx(r.ok ? "ok" : "error"); this.render(true); }, (k, hover) => { this.obsKind = k; if (!hover) this.render(true); });
  }

  // ───────────────────────────── panels ─────────────────────────────
  _p_console(s) {
    const offers = [["parts", "+20", 120], ["n2", "+150 kg", 90], ["food", "+60 kg", 80]];
    return `<h4>${t("Console")}</h4>
      <div class="row"><span>${loc.resource("ice")}: <b>${n0(s.res.ice)} kg</b></span><button class="btn" data-act="melt" ${s.res.ice > 0 && s.player.inside ? "" : "disabled"}>${t("Melt ice")}</button></div>
      <div class="row"><span>${t("Shielding")}: <b>${s.berm ? "✔" : "—"}</b> <span class="dim small">(300 ${loc.resource("regolith")})</span></span><button class="btn" data-act="berm" ${s.berm ? "disabled" : ""}>${t("Build berm")}</button></div>
      ${s.scenario === "moon" ? `<div class="row"><span>${t("Earth elevation")}</span><b>${n1(S.earthElevationDeg(s))}°</b></div>` : ""}
      ${s.rules.heliumPlasma ? `<div class="row"><span>${loc.resource("heliumPlasma")}: <b>${s.res.heliumPlasma}</b> <span class="dim small">(${s.crystals.length} ⟡)</span></span><span><button class="btn sm" data-act="crystal:get">${t("Collect crystal")}</button><button class="btn sm" data-act="crystal:use" ${s.res.heliumPlasma ? "" : "disabled"}>${t("Use crystal")}</button></span></div>` : ""}
      <h4>${t("Resupply from Earth")}</h4>
      ${offers.map(([k, give, cost]) => `<div class="row"><span>${give} ${loc.resource(k)}</span><button class="btn sm" data-act="resupply:${k}">${t("Order")} · ${Math.round(cost * s.rules.resupplyCostMult)} ${t("funds")}</button></div>`).join("")}
      <h4>${t("Did you know?")}</h4><p class="dim small">${esc(loc.fact(Math.floor(s.t / 24)))}</p>`;
  }

  _p_build(s) {
    const U = unlockedSet(s.techs), tool = this.api.getTool(), cats = {};
    for (const id of Object.keys(S.BUILDINGS)) (cats[S.BUILDINGS[id].cat] ??= []).push(id);
    return Object.entries(cats).map(([cat, ids]) => `<h4>${esc(loc.category(cat))}</h4>` + ids.map((id) => {
      const d = loc.building(id), open = id === "sabatier" ? S.SCENARIOS[s.scenario].co2Air : U.has(id);
      if (id === "sabatier" && !open) return "";
      const kw = d.gen ? `+${d.gen} kW` : d.kw ? `${d.kw} kW` : "";
      const lock = open ? "" : `<span class="dim small">🔒 ${esc(techFor(id) ? loc.tech(techFor(id)).name : "")}</span>`;
      return `<button class="card${tool === `build:${id}` ? " on" : ""}${open ? "" : " locked"}" ${open ? `data-act="tool:build:${id}"` : "disabled"} title="${esc(d.desc)}">
        <b>${esc(d.name)}</b> <span class="kw">${kw}</span><div class="small">${costText(d.cost)}</div>${lock}</button>`;
    }).join("")).join("");
  }

  _p_techtree(s) {
    const prog = treeProgress(s.techs);
    return `<div class="row"><span>${loc.resource("science")}: <b>${n1(s.res.science)}</b></span><span>${loc.resource("funds")}: <b>${n0(s.res.funds)}</b></span></div>` + Object.keys(TREES).map((id) => {
      const tree = loc.tree(id);
      return `<h4 style="color:${tree.color}">${tree.icon} ${esc(tree.name)} <small>${Math.round(prog[id] * 100)}%</small></h4><p class="dim small">${esc(tree.blurb)}</p>` + techsOfTree(id).map((t0) => {
        const tech = loc.tech(t0), done = s.techs.includes(t0.id), why = done ? null : researchBlock(s, t0.id);
        const cost = `${t0.cost.science} ${t("science")}${t0.cost.funds ? ` · ${t0.cost.funds} ${t("funds")}` : ""}`;
        return `<div class="tech${done ? " done" : why ? " blocked" : " ready"}"><div><b>${esc(tech.name)}</b> <button class="btn sm" data-act="card:${t0.id}" title="${t("REAL NASA SCIENCE")}">?</button><div class="small dim">${done ? `✔ ${t("Researched")}` : `${cost}${why ? ` — ${esc(tr(why))}` : ""}`}</div></div>
          ${done ? "" : `<button class="btn" data-act="research:${t0.id}" ${why ? "disabled" : ""}>${t("Research")}</button>`}</div>`;
      }).join("");
    }).join("");
  }

  _p_power(s) {
    const P = s.power, net = P.gen - P.demand, pw = displayedReading(s, "power", P.stored);
    const hours = net < 0 ? P.stored / -net : Infinity;
    return `<h4>${t("Power")}</h4><div class="kv">
      <span>${t("Generation")}</span><b class="good">${n1(P.gen)} kW</b><span>${t("Demand")}</span><b>${n1(P.demand)} kW</b>
      <span>${t("Stored")}</span><b>${n0(pw.value)} / ${n0(P.cap)} kWh${Number.isFinite(hours) ? ` · ${n0(hours)} h` : ""}</b>
      <span>${t("Peak capacity")}</span><b>${n0(S.peakCapacityKW(s))} kW</b>
      <span>${t("Fuel cells")}</span><b>${n1(s.rfc.h2 * 9)} / ${S.countOf(s, "rfc") * S.C.RFC_WATER_CAP} kg H₂O</b>
      <span>${t("Machines without power")}</span><b class="${P.shed ? "bad" : ""}">${P.shed}</b>
      <span>${t("Heat load")}</span><b>${n1(s.thermal.load)} kW</b><span>${t("Heat rejected")}</span><b class="${s.thermal.reject < s.thermal.load ? "bad" : ""}">${n1(s.thermal.reject)} kW</b></div>
      ${bar((P.stored / Math.max(1, P.cap)) * 100, "good")}
      ${P.blackout > 0 ? `<p class="bad">${esc(tr(`BLACKOUT: ${P.blackout.toFixed(1)} h to restart`))}</p>` : ""}
      ${s.plasmaBoostUntil > s.t ? `<p class="good small">⟡ +50% · ${n0(s.plasmaBoostUntil - s.t)} h</p>` : ""}`;
  }

  _p_atmosphere(s) {
    const A = s.air, sc = S.habitabilityScores(s);
    const o2 = displayedReading(s, "oxygen", A.pO2), tot = displayedReading(s, "pressure", A.total), co2 = displayedReading(s, "co2", A.pCO2);
    const names = { oxygen: "Oxygen", pressure: "Pressure", co2: "CO₂", temperature: "Temperature", cleanAir: "Clean air", shielding: "Shielding", supplies: "Supplies" };
    return `<h4>${t("Air")} · ${t("Habitability")} ${A.habitability}%</h4><div class="kv">
      <span>${t("Oxygen")}</span><b class="${o2.fake ? "fakeval" : ""}">${n1(o2.value)} kPa <small class="dim">(21)</small></b>
      <span>${t("Nitrogen")}</span><b>${n1(A.pN2)} kPa <small class="dim">(79)</small></b>
      <span>CO₂</span><b class="${co2.value > 0.7 ? "bad" : ""}${co2.fake ? " fakeval" : ""}">${(co2.value).toFixed(2)} kPa</b>
      <span>${t("Pressure")}</span><b class="${tot.fake ? "fakeval" : ""}">${n0(tot.value)} kPa</b>
      <span>${t("Temperature")}</span><b>${n0(A.temp)} °C</b><span>${t("Cabin dust")}</span><b class="${A.dust > 0.15 ? "bad" : ""}">${n0(A.dust * 100)}%</b>
      <span>${t("Volume")}</span><b>${n0(A.volume)} m³</b><span>${t("Automatic regulator")}</span><b>${A.auto ? "O₂ + N₂" : "O₂"}</b></div>
      <div class="row"><button class="btn" data-act="gas:o2">${t("Add O2")} (5 kg)</button><button class="btn" data-act="gas:n2">${t("Add N2")} (20 kg)</button></div>
      <div class="kv">${Object.entries(sc).map(([k, v]) => `<span>${t(names[k])}</span>${bar(v, v < 40 ? "bad" : v < 100 ? "warn" : "good")}`).join("")}</div>
      <div class="kv"><span>${loc.resource("o2")}</span><b>${n0(s.res.o2)} kg</b><span>${loc.resource("n2")}</span><b>${n0(s.res.n2)} kg</b><span>${loc.resource("co2")}</span><b>${n1(s.res.co2)} kg</b></div>`;
  }

  _p_networks(s) {
    const F = s.flowsPerHour ?? {}, cap = { lh2: S.countOf(s, "cryo_tank") * S.C.LH2_TANK_KG, lox: S.countOf(s, "cryo_tank") * S.C.LOX_TANK_KG };
    const store = S.RES_KEYS.filter((k) => !["science", "funds", "heliumPlasma"].includes(k) && (s.res[k] > 0.05 || F[k])).map((k) => {
      const f = F[k] ?? 0;
      return `<span>${esc(loc.resource(k))}</span><b>${n1(s.res[k])}${cap[k] !== undefined ? ` / ${cap[k]}` : ""} kg <small class="${f > 0.005 ? "good" : f < -0.005 ? "bad" : "dim"}">${f > 0 ? "+" : ""}${f.toFixed(2)}/h</small></b>`;
    }).join("");
    const off = s.buildings.filter((b) => !b.connected);
    return `<h4>${t("Storage")} · ${t("Flows (kg per hour)")}</h4><div class="kv">${store}</div>
      <h4>${t("Networks")}</h4><div class="kv"><span>${t("connected")}</span><b class="good">${s.buildings.filter((b) => b.connected).length}</b><span>${t("beamed power")}</span><b class="warn">${off.filter((b) => b.beamed).length}</b><span>${t("isolated")}</span><b class="${off.some((b) => !b.beamed) ? "bad" : ""}">${off.filter((b) => !b.beamed).length}</b></div>
      ${off.map((b) => `<div class="small ${b.beamed ? "warn" : "bad"}">${esc(loc.building(b.type).name)} (${b.x}, ${b.y}) — ${esc(loc.status(b.beamed ? "ok" : "unconnected"))}</div>`).join("")}
      <p class="dim small">${esc(loc.layer(4).name)}: ${esc(loc.layer(4).legend)}</p>`;
  }

  _p_rovers(s) {
    if (!s.rovers.length) return `<p class="dim">${t("No rovers yet: build a Rover bay.")}</p>`;
    const surf = s.buildings.filter((b) => b.layer === "s");
    const opt = (list, cur) => list.map((b) => `<option value="${b.id}" ${cur === b.id ? "selected" : ""}>${esc(loc.building(b.type).name)} (${b.x},${b.y})</option>`).join("");
    const resOpt = (cur) => ["water", "regolith", "iron", "n2"].map((k) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(loc.resource(k))}</option>`).join("");
    return s.rovers.map((r) => `<div class="rover"><b>Rover ${r.id}</b> <span class="chip ${r.stuck ? "st-broken" : ""}">${r.stuck ? t("TRAPPED") : r.route ? `${t("Cargo")} ${n0(r.cargo)} kg` : t("idle")}</span> <span class="dim small">${t("battery")} ${n0((r.battery / 20) * 100)}%</span>
      <div class="row"><label>${t("From")} <select data-f="from">${opt(surf, r.route?.from)}</select></label><label>${t("To")} <select data-f="to">${opt(surf.filter((b) => b.connected), r.route?.to)}</select></label><label><select data-f="res">${resOpt(r.route?.res)}</select></label></div>
      <div class="row"><button class="btn sm" data-act="route:${r.id}">${t("Set route")}</button><button class="btn sm" data-act="routeclear:${r.id}">${t("Clear")}</button>${r.stuck ? `<button class="btn sm" data-act="rescue:${r.id}">${t("Rescue")} (3)</button>` : ""}</div></div>`).join("");
  }

  _p_blss(s) {
    const domes = s.buildings.filter((b) => b.type === "biodome");
    return `<h4>${t("Crops")}</h4>${domes.map((b) => `<div class="row"><span>${esc(loc.building("biodome").name)} (${b.x},${b.y}) <span class="chip st-${b.status}">${esc(loc.status(b.status))}</span><div class="small dim">${t("Medium")}: ${b.soil ? t("lunar soil") : t("hydroponics")}</div></span><span style="width:40%">${bar(b.crop, b.crop < 30 ? "bad" : "good")}</span></div>`).join("")}
      <div class="kv"><span>${t("Food grown")}</span><b>${n1(s.stats.foodGrown)} kg</b><span>${loc.resource("food")}</span><b>${n0(s.res.food)} kg</b><span>${t("Soil in storage")}</span><b>${n0(s.res.soil)} / 200 kg</b><span>${loc.resource("co2")}</span><b>${n1(s.res.co2)} kg</b></div>
      <button class="btn sm" data-act="manual:biodome">${t("FIELD MANUAL")}</button>`;
  }

  _p_observatory(s) { return observatoryHtml(s, this.obsKind); }

  _p_shipyard(s) {
    const subs = loc.subsystems().map((sub) => { const v = s.vehicle.subsystems[sub.id], why = S.subsystemBlock(s, sub.id); return `<div class="row"><span><b>${esc(sub.name)}</b> ${v}% <div class="small dim" title="${esc(sub.why)}">${why ? esc(tr(why)) : costText(sub.cost)}</div></span><span style="width:34%">${bar(v, v >= 90 ? "good" : "warn")}</span><button class="btn sm" data-act="assemble:${sub.id}" ${why ? "disabled" : ""}>${t("Assemble")}</button></div>`; }).join("");
    const dests = Object.keys(S.DESTINATIONS).map((id) => { const d = loc.destination(id), w = S.windowInfo(s, id), bl = S.launchBlockers(s, id);
      return `<div class="dest"><b>${esc(d.name)}</b><div class="small dim">${esc(d.note)}</div><div class="small">${t("Window")}: ${w.open ? `<b class="good">${t("OPEN")}</b> · ${t("closes in")} ${n0(w.closesIn)} h` : `${t("opens in")} ${n0(w.opensIn)} h`} · LH₂ ${d.lh2} · LOX ${d.lox}</div>
        ${bl.length ? `<ul class="small bad">${bl.slice(0, 4).map((b) => `<li>${esc(tr(b))}</li>`).join("")}</ul>` : `<p class="good small">${t("Ready to launch")}</p>`}<button class="btn" data-act="launch:${id}" ${bl.length ? "disabled" : ""}>${t("Launch")}</button></div>`; }).join("");
    const caps = S.countOf(s, "cryo_tank");
    return `<h4>${t("Vehicle subsystems")}</h4>${subs}<h4>${t("Tanks")}</h4><div class="kv"><span>LH₂</span><b>${n1(s.res.lh2)} / ${caps * S.C.LH2_TANK_KG} kg</b><span>LOX</span><b>${n1(s.res.lox)} / ${caps * S.C.LOX_TANK_KG} kg</b></div><h4>${t("Destinations")}</h4>${dests}`;
  }

  _p_manual() {
    const idx = fieldManualIndex(this.api.getTutorial());
    return `<h4>${t("FIELD MANUAL")}</h4>` + idx.map((m) => `<button class="card${m.unlocked ? "" : " locked"}" ${m.unlocked ? `data-act="manual:${m.id}"` : "disabled"}><b>${esc(loc.manual(getManual(m.id)).title)}</b>${m.unlocked ? "" : ` <span class="dim small">🔒</span>`}</button>`).join("");
  }

  _p_log(s) {
    return `<h4>${t("Log")}</h4>` + s.log.slice(0, 50).map((l) => `<div class="logline ${l.level}"><span class="dim">${t("Day")} ${Math.floor(l.t / 24) + 1} ${String(Math.floor(l.t % 24)).padStart(2, "0")}h</span> ${esc(tr(l.text))}</div>`).join("");
  }

  // ───────────────────────────── modals ─────────────────────────────
  _modal(kind, html, wide = false) {
    this.modalKind = kind;
    this.el.modal.innerHTML = `<div class="sheet${wide ? " wide" : ""}">${html}</div>`;
    this.el.modal.classList.add("open");
  }
  closeModal() { this.modalKind = null; this.el.modal.classList.remove("open"); this.el.modal.innerHTML = ""; }
  get modalOpen() { return !!this.modalKind; }

  showMenu() {
    const c = this.menuChoice;
    this.applyMode(c.mode);
    const modes = Object.keys(MODES).map((id) => { const m = loc.mode(id); return `<button class="mode${c.mode === id ? " on" : ""}" data-act="menu-mode:${id}"><div class="patch">${missionPatchSvg(id)}</div><b>${esc(m.name)}</b><i>${esc(m.codename)}</i><p>${esc(m.tagline)}</p></button>`; }).join("");
    const diffs = Object.keys(DIFFICULTIES).map((id) => `<button class="btn${c.diff === id ? " on" : ""}" data-act="menu-diff:${id}" title="${esc(loc.difficulty(id).desc)}">${esc(loc.difficulty(id).name)}</button>`).join("");
    this._modal("menu", `
      <div class="langrow">${Object.entries(LANGS).map(([id, name]) => `<button class="btn sm${getLang() === id ? " on" : ""}" data-act="lang:${id}">${name}</button>`).join("")}</div>
      <h1>${t("LUNAR COLONY SIMULATOR")}</h1><p class="sub">${t("Real engineering. Fictional story.")}</p>
      <div class="modes">${modes}</div><p class="desc">${esc(loc.mode(c.mode).description)}</p>
      <div class="row center">${t("Difficulty")}: ${diffs}</div>
      <div class="row center"><button class="btn big primary" data-act="menu-start">${t("New game")}</button>${this.api.hasSave() ? `<button class="btn big" data-act="menu-continue">${t("Continue")}</button>` : ""}</div>
      <div class="row center"><button class="btn" data-act="menu-stress" title="${t("Quick mode: a developed base in its worst hour.")}">⚠ ${t("Artemis Crisis Stress Test")}</button></div>`, true);
  }

  showBriefing(modeId, i) {
    const screens = loc.briefing(modeId), s = screens[i];
    this._modal(`brief${i}`, `
      <div class="steps">${screens.map((_, k) => `<i class="${k === i ? "on" : k < i ? "done" : ""}"></i>`).join("")}</div>
      <h2>${esc(s.title)}</h2><div class="art">${s.svg}</div>
      ${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${s.transmissions ? s.transmissions.map((c) => `<div class="tx" style="border-color:${c.color}"><b style="color:${c.color}">${esc(c.name)}</b> <span class="dim small">${esc(c.role)} · ${esc(c.agency)}</span><p>“${esc(c.line)}”</p></div>`).join("") : ""}
      ${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}${s.footer ? `<p class="warn">${esc(s.footer)}</p>` : ""}
      <div class="row center">${i > 0 ? `<button class="btn" data-act="brief:${i - 1}">${t("Back")}</button>` : ""}<button class="btn primary big" data-act="brief:${i + 1}">${i === 3 ? t("Start") : t("Next")}</button><button class="btn sm" data-act="brief:4">${t("Skip")}</button></div>`, true);
  }

  showManual(id) {
    const m0 = getManual(id) ?? getManual({ cryo_tank: "cryo_plant", laser_rx: "laser_tx", suitport: "airlock_n2", regolith_mine: "ilmenite_reactor", bioremediation: "biodome", geodesic_biosphere: "biodome", heavy_pad: "ntr_assembly" }[id]);
    if (!m0) { this.toast(loc.building(id)?.desc ?? "", "info"); return; }
    const m = loc.manual(m0), list = (title, items) => `<h4>${t(title)}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    this.api.audio.sfx("manual");
    this._modal("manual", `<div class="tag">${t("OPERATING MANUAL")}</div><h2>${esc(m.title)}</h2><p>${esc(m.summary)}</p><div class="flow">${flowSvg(m)}</div>
      ${list("How to connect it", m.connect)}${list("How to automate it", m.automate)}${list("How it fails", m.failures)}
      <div class="row center"><button class="btn primary" data-act="close">${t("Close")}</button></div>`);
  }

  showScienceCard(techId) {
    const t0 = TECHS.find((x) => x.id === techId);
    if (!t0) return;
    const tech = loc.tech(t0);
    this._modal("card", `<div class="tag">${t("REAL NASA SCIENCE")}</div><h2>${esc(tech.card.title)}</h2><div class="formula">${esc(tech.card.formula)}</div><p>${esc(tech.card.text)}</p>
      <p class="dim small">${t("Source")}: ${esc(tech.card.source)}</p><div class="row center"><button class="btn primary" data-act="close">${t("Close")}</button></div>`);
  }

  showLostLogs() {
    this._modal("logs", `<h2>${t("Lost expedition logs")}</h2>${loc.lostLogs(this.state).map((l) => `<div class="tx"><b>${t("Day")} ${l.day} — ${esc(l.author)}</b><p>${esc(l.text)}</p></div>`).join("")}<div class="row center"><button class="btn primary" data-act="close">${t("Close")}</button></div>`);
  }

  /** Crew transmission as a toast (reactions to events). */
  transmission(code) {
    const line = loc.crewLine(code, this.state.modeId);
    if (line) this.toast(`📡 ${line}`, "info");
  }

  showEnding() {
    const e = loc.ending(this.state);
    if (!e) return;
    const lost = this.state.lost;
    this._modal("ending", `<h1>${esc(e.title)}</h1><div class="art small">${missionPatchSvg(this.state.modeId)}</div><p>${esc(e.text)}</p>
      <div class="row center">${lost ? `<button class="btn primary big" data-act="again">${t("Try again")}</button>` : `<button class="btn primary big" data-act="close">${t("Keep playing")}</button>`}</div>`);
  }
}
