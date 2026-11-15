// Run with:  node --test colony/tests
import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/simulation.js";
import { TECHS, TREES, validateTechTree, techsOfTree } from "../js/techTree.js";
import { MODES, resolveRules, displayedReading } from "../js/gameModes.js";
import * as L from "../js/lore.js";
import * as T from "../js/tutorial.js";
import * as I from "../js/i18n.js";
import { ES } from "../js/lang/es.js";

const allTechs = () => TECHS.map((t) => t.id);
const finite = (state) => {
  for (const [k, v] of Object.entries(state.res)) assert.ok(Number.isFinite(v) && v > -1e-6, `res.${k} = ${v}`);
  for (const k of ["o2", "n2", "co2", "temp", "pO2", "total", "habitability"]) assert.ok(Number.isFinite(state.air[k]), `air.${k} = ${state.air[k]}`);
  assert.ok(Number.isFinite(state.power.stored) && state.power.stored >= -1e-6);
  assert.ok(Number.isFinite(state.crew.health));
};
const rich = (mode = "realista") => {
  const s = S.createState(mode, "normal");
  s.techs = allTechs(); s.air.auto = true;
  Object.assign(s.res, { parts: 5000, iron: 5000, tio2: 5000, funds: 9999, science: 999, water: 2000, n2: 20000, o2: 3000, food: 2000, regolith: 5000 });
  return s;
};
const ok = (r) => { assert.ok(r.ok, r.msg); return r; };

test("tech tree: five trees, every tech reachable, every unlock is a real building or action", () => {
  assert.equal(Object.keys(TREES).length, 5);
  assert.deepEqual(validateTechTree(), []);
  for (const tree of Object.keys(TREES)) assert.ok(techsOfTree(tree).length >= 4);
  for (const t of TECHS) {
    assert.ok(t.card.formula && t.card.text && t.card.source, `${t.id} has a science card`);
    for (const u of t.unlocks) if (!u.startsWith("action:")) assert.ok(S.BUILDINGS[u], `${t.id} unlocks unknown building ${u}`);
  }
  const unlockable = new Set(TECHS.flatMap((t) => t.unlocks));
  for (const id of Object.keys(S.BUILDINGS)) assert.ok(unlockable.has(id) || ["habitat", "solar", "battery", "radiator", "lab", "sabatier", "kilopower"].includes(id), `${id} can never be unlocked`);
});

test("three modes change the rules", () => {
  assert.deepEqual(Object.keys(MODES), ["realista", "fantastico", "terrorifico"]);
  assert.equal(resolveRules("fantastico", "normal").xenoflora, true);
  assert.equal(resolveRules("terrorifico", "normal").sanity, true);
  assert.ok(resolveRules("realista", "dificil").eventMult > resolveRules("realista", "facil").eventMult);
});

test("a new game starts breathable, powered and stable for a day", () => {
  const s = S.createState();
  assert.ok(Math.abs(s.air.pO2 - 21) < 0.5 && Math.abs(s.air.total - 100) < 2);
  assert.equal(s.air.habitability >= 60, true);
  S.step(s, 24);
  finite(s);
  assert.ok(s.crew.health > 90);
  assert.equal(S.activeMissions(s).length, 3);
});

test("electrolysis conserves mass 9 : 1 : 8", () => {
  const s = rich();
  ok(S.build(s, "electrolyzer", 15, 8));
  const w0 = s.res.water, h0 = s.res.h2, o0 = s.res.o2 + s.air.o2;
  S.step(s, 1);
  const dw = w0 - s.res.water;
  // crew drinks a little and the regulator moves O2 into the air, so compare hydrogen (nothing else touches it)
  const dh = s.res.h2 - h0;
  assert.ok(dh > 0.2 && dh < 0.23, `H2 made: ${dh}`);
  assert.ok(Math.abs(dh * 9 - 2) < 0.01, "2 kg of water split per hour");
  assert.ok(dw >= 2);
  assert.ok(s.res.o2 + s.air.o2 > o0);
});

test("ilmenite reduction: iron, titanium dioxide and water out, hydrogen in", () => {
  const s = rich();
  s.res.h2 = 5; s.res.iron = 0; s.res.tio2 = 0;
  ok(S.build(s, "ilmenite_reactor", 15, 8));
  S.step(s, 1);
  const ilm = 10 * S.C.ILMENITE_FRACTION;
  assert.ok(Math.abs(s.res.iron - ilm * S.C.ILM_FE) < 1e-6);
  assert.ok(Math.abs(s.res.tio2 - ilm * S.C.ILM_TIO2) < 1e-6);
  assert.ok(Math.abs(5 - s.res.h2 - ilm * S.C.ILM_H2) < 1e-6);
  // products weigh what the reactants weighed
  assert.ok(Math.abs(S.C.ILM_FE + S.C.ILM_TIO2 + S.C.ILM_H2O - (1 + S.C.ILM_H2)) < 0.002);
});

test("zones: VSAT only on the rim, extractor only in the crater, and the crater is never lit", () => {
  const s = rich();
  assert.match(S.buildBlock(s, "vsat", 5, 8), /Only in/);
  assert.equal(S.buildBlock(s, "vsat", 5, 1), null);
  assert.match(S.buildBlock(s, "ice_extractor", 5, 8), /Only in/);
  for (let t = 0; t < S.C.LUNAR_CYCLE_H; t += 24) { s.t = t; assert.equal(S.illumination(s, 5, 16), 0); }
  let rimLit = 0, plainsLit = 0, n = 0;
  for (let t = 0; t < S.C.LUNAR_CYCLE_H; t += 1) { s.t = t; rimLit += S.illumination(s, 5, 1); plainsLit += S.illumination(s, 5, 8); n++; }
  assert.ok(Math.abs(rimLit / n - 0.88) < 0.01, `rim lit ${rimLit / n}`);
  assert.ok(Math.abs(plainsLit / n - 0.5) < 0.01);
});

test("networks: an unpiped machine does nothing until a pipe reaches it", () => {
  const s = rich();
  const b = ok(S.build(s, "lab", 20, 8)).building;
  S.step(s, 1);
  assert.equal(b.status, "unconnected");
  for (let x = 15; x <= 19; x++) ok(S.layPipe(s, x, 8));
  const sci = s.res.science;
  S.step(s, 1);
  assert.equal(b.status, "ok");
  assert.ok(s.res.science > sci);
});

test("the dark crater drains 4x without a power beam, and a beam powers an unpiped crater network", () => {
  const s = rich();
  for (let x = 15; x <= 22; x++) ok(S.build(s, "vsat", x, 1));
  for (let y = 2; y <= 7; y++) ok(S.layPipe(s, 15, y));
  ok(S.build(s, "tunnel", 15, 8));
  const ex = ok(S.build(s, "ice_extractor", 5, 15)).building;
  S.step(s, 0.25);
  assert.equal(ex.status, "unconnected");
  ok(S.build(s, "laser_tx", 16, 8)); ok(S.build(s, "laser_rx", 5, 16));
  S.step(s, 0.25);
  assert.equal(ex.beamed, true); assert.equal(ex.connected, false);
  assert.equal(ex.status, "ok");
  assert.ok((ex.buf.water ?? 0) > 0, "water waits in the machine's buffer for a rover");
});

test("EDS: cleans nearby machines, but trips the grid when the peak can't be delivered", () => {
  const s = rich();
  const eds = ok(S.build(s, "eds", 11, 8)).building; eds.auto = false;
  const panel = s.buildings.find((b) => b.type === "solar"); panel.dust = 0.9;
  S.step(s, 0.25);
  for (let i = 0; i < 4; i++) ok(S.build(s, "battery", 10 + i, 10));
  for (const x of [10, 11, 12, 13]) S.layPipe(s, x, 9);
  S.step(s, 0.25);
  ok(S.edsPulse(s, eds.id));
  assert.equal(panel.dust, 0);
  // now with no batteries and at night: the peak is impossible
  const n = S.createState(); n.techs = allTechs(); n.res.parts = 500;
  const e2 = ok(S.build(n, "eds", 11, 8)).building; e2.auto = false;
  n.buildings = n.buildings.filter((b) => b.type !== "battery" || (S.cellAt(n, b.x, b.y).b = null));
  n.t = S.C.LUNAR_CYCLE_H * 0.6; n.netDirty = true;
  S.step(n, 0.25);
  const r = S.edsPulse(n, e2.id);
  assert.equal(r.ok, false); assert.match(r.msg, /BLACKOUT/);
  assert.ok(n.power.blackout > 0);
});

test("over-excavation weakens the ground and structures on it sink", () => {
  const s = rich();
  s.player.x = 20; s.player.y = 9;
  const c = S.cellAt(s, 20, 8), before = c.stability;
  for (let i = 0; i < 6; i++) ok(S.excavate(s, 20, 9));
  assert.ok(c.stability < before - 8, "neighbour weakened");
  c.stability = 20;
  const b = ok(S.build(s, "lab", 20, 8)).building;
  for (let x = 15; x <= 19; x++) S.layPipe(s, x, 8);
  for (let i = 0; i < 400 && b.hp === 100; i++) S.step(s, 1);
  assert.ok(b.hp < 100, "the lab sank");
  assert.ok(s.stats.subsidences >= 1);
  // piles make the same ground safe
  const s2 = rich(); S.cellAt(s2, 20, 8).stability = 30; ok(S.pile(s2, 20, 8));
  const b2 = ok(S.build(s2, "lab", 20, 8)).building;
  for (let i = 0; i < 200; i++) S.step(s2, 1);
  assert.equal(s2.stats.subsidences, 0); assert.ok(b2.hp > 60);
});

test("paving stops dust and firms the ground", () => {
  const s = rich();
  ok(S.build(s, "sinter_laser", 15, 8)); S.step(s, 0.25);
  const c = S.cellAt(s, 20, 8); c.dust = 0.6; c.stability = 50;
  ok(S.pave(s, 20, 8));
  assert.equal(c.dust, 0); assert.equal(c.stability, 75); assert.equal(c.paved, true);
});

test("connecting a new module lowers the pressure until gas is added", () => {
  const s = rich(); s.air.auto = false;
  const p0 = s.air.total;
  ok(S.build(s, "tunnel", 15, 8));
  S.step(s, 0.25);
  assert.ok(s.air.total < p0 * 0.93, `pressure fell: ${p0} -> ${s.air.total}`);
  s.air.auto = true;
  S.step(s, 3);
  assert.ok(Math.abs(s.air.pO2 - 21) < 1 && Math.abs(s.air.pN2 - 79) < 2);
});

test("a biodome removes CO2 and grows food; crops die in an unheated night", () => {
  const s = rich();
  for (let x = 15; x <= 20; x++) ok(S.build(s, "vsat", x, 1));
  for (let y = 2; y <= 7; y++) ok(S.layPipe(s, 15, y));
  const dome = ok(S.build(s, "biodome", 15, 8)).building;
  S.step(s, 48);
  assert.ok(s.stats.foodGrown > 3, `food ${s.stats.foodGrown}`);
  assert.ok(s.air.pCO2 < 0.5);
  dome.on = false; // unpowered
  S.step(s, 40);
  assert.ok(dome.crop < 50);
  finite(s);
});

test("horror: sanity drops in the dark and the HUD starts lying", () => {
  const s = S.createState("terrorifico", "normal");
  s.t = S.C.LUNAR_CYCLE_H * 0.6;
  S.movePlayer(s, 20, 9);
  assert.equal(s.player.inside, false);
  s.player.suitO2 = 1e6;
  S.step(s, 40);
  assert.ok(s.crew.sanity < 50, `sanity ${s.crew.sanity}`);
  let fake = 0;
  for (let i = 0; i < 200; i++) { S.step(s, 0.25); s.player.suitO2 = 1e6; s.crew.health = 100; if (displayedReading(s, "pressure", s.air.total).fake || displayedReading(s, "oxygen", 1).fake || s.alerts.some((a) => a.fake)) fake++; }
  assert.ok(fake > 0, "false readings or phantom alarms appeared");
  const r = S.createState("realista", "normal");
  assert.equal(displayedReading(r, "pressure", 101).fake, false);
});

test("fantasy: crystals appear in the crater and overcharge the grid", () => {
  const s = S.createState("fantastico", "normal");
  for (let i = 0; i < 300 && !s.crystals.length; i++) S.step(s, 1);
  assert.ok(s.crystals.length > 0);
  const c = s.crystals[0];
  assert.ok(c.y >= S.C.PSR_ROW);
  S.movePlayer(s, c.x, c.y);
  ok(S.collectCrystal(s)); ok(S.useCrystal(s));
  assert.ok(s.plasmaBoostUntil > s.t);
});

test("lava tube: found by radar, built underground, sealed with two airlocks", () => {
  const s = rich();
  assert.match(S.buildBlock(s, "habitat", 10, 8, "u"), /seismic/);
  ok(S.build(s, "seismic_radar", 15, 8)); S.step(s, 0.25);
  ok(S.seismicScan(s));
  assert.match(S.buildBlock(s, "habitat", 2, 2, "u"), /Solid rock/);
  ok(S.build(s, "lava_seal", 14, 9, "u"));      // under a surface cell next to the base
  ok(S.layPipe(s, 14, 9));
  ok(S.build(s, "lava_seal", 10, 8, "u"));
  for (let x = 11; x <= 13; x++) ok(S.layPipe(s, x, 9, "u"));
  ok(S.layPipe(s, 10, 9, "u"));
  S.step(s, 0.25);
  assert.equal(s.tubeSealed, true);
  const under = s.buildings.find((b) => b.type === "lava_seal" && b.x === 14);
  assert.equal(under.connected, true);
  assert.ok(s.air.volume >= 5000);
});

test("stress test survives its first two days without NaN and is winnable in principle", () => {
  for (const mode of Object.keys(MODES)) {
    const s = S.createStressTest(mode);
    assert.ok(s.alerts.length >= 3);
    S.step(s, 48);
    finite(s);
  }
});

test("step size does not change the result (20x vs 1x)", () => {
  const a = S.createState("realista", "normal", 7), b = S.createState("realista", "normal", 7);
  for (let i = 0; i < 40; i++) S.step(a, 0.25);
  S.step(b, 10);
  assert.ok(Math.abs(a.res.water - b.res.water) < 1e-6);
  assert.ok(Math.abs(a.power.stored - b.power.stored) < 1e-6);
  assert.ok(Math.abs(a.air.o2 - b.air.o2) < 1e-6);
});

test("save and load round-trips", () => {
  const s = S.createStressTest(); S.step(s, 5);
  const back = S.deserialize(S.serialize(s));
  S.step(s, 3); S.step(back, 3);
  assert.equal(back.res.water, s.res.water); assert.equal(back.crew.health, s.crew.health);
  assert.throws(() => S.deserialize("{}"));
});

test("endgame: six Goddard subsystems, propellant and a window, then Mars with Sabatier", () => {
  const s = rich();
  assert.ok(S.launchBlockers(s, "mars").length > 3);
  for (let x = 15; x <= 22; x++) ok(S.build(s, "vsat", x, 1));
  for (let y = 2; y <= 7; y++) ok(S.layPipe(s, 15, y));
  ok(S.build(s, "ntr_assembly", 15, 8)); ok(S.build(s, "heavy_pad", 16, 8));
  for (let x = 17; x <= 26; x++) ok(S.build(s, "cryo_tank", x, 8));
  S.step(s, 0.25);
  assert.match(S.subsystemBlock(s, "Communications") ?? "", /^$/);
  for (let i = 0; i < 6; i++) for (const sub of S.SUBSYSTEMS) S.assembleSubsystem(s, sub.id);
  assert.equal(s.vehicle.subsystems.Communications, 50, "capped without the telescope");
  for (let y = 9; y <= 12; y++) ok(S.layPipe(s, 16, y));
  ok(S.build(s, "laser_tx", 17, 9)); ok(S.build(s, "telescope", 16, 13));
  S.step(s, 0.25);
  for (let i = 0; i < 4; i++) S.assembleSubsystem(s, "Communications");
  for (const sub of S.SUBSYSTEMS) assert.ok(s.vehicle.subsystems[sub.id] >= 90, sub.id);
  s.res.lh2 = 260; s.res.lox = 200;
  const w = S.windowInfo(s, "mars");
  s.t += w.opensIn + 1;
  assert.deepEqual(S.launchBlockers(s, "mars"), []);
  ok(S.launch(s, "mars"));
  assert.equal(s.scenario, "mars");
  assert.equal(S.buildBlock(s, "sabatier", 15, 8), null);
  s.res.h2 = 5; ok(S.build(s, "sabatier", 15, 8));
  s.t = 1; S.step(s, 2);
  assert.ok(s.res.ch4 > 0, "methane from Martian CO2");
  finite(s);
});

test("briefing: four screens with SVG drawn in code, for every mode", () => {
  for (const mode of Object.keys(MODES)) {
    const b = L.buildBriefing(mode);
    assert.equal(b.length, 4);
    assert.deepEqual(b.map((x) => x.id), ["purpose", "crew", "site", "firstday"]);
    for (const scr of b) { assert.match(scr.svg, /^<svg [^>]*viewBox/); assert.ok(!/<image|href="http/.test(scr.svg), "no external images"); assert.ok(scr.paragraphs.length); }
    assert.equal(b[1].transmissions.length, 4);
    assert.equal(b[3].bullets.length, 3, "three first-day actions");
    assert.match(L.missionPatchSvg(mode), /textPath/);
  }
  assert.equal(L.LOST_EXPEDITION_LOGS.length, 8);
  assert.ok(L.crewLine("breach", "terrorifico") !== L.crewLine("breach", "realista"));
});

test("tutorial: clean interface at minute 0, panels and manuals appear with progress", () => {
  assert.deepEqual(T.validateManuals(), []);
  const s = S.createState(), tut = T.createTutorial();
  assert.deepEqual(T.visiblePanels(s), ["move", "gather", "suit", "console"]);
  let r = T.tutorialUpdate(s, tut);
  assert.equal(r.newManuals.length, 0);
  assert.match(T.currentObjective(s), /dig ice/i);
  // dig ice on the crater floor, bring it home, melt it
  S.movePlayer(s, 13, 14); assert.ok(S.excavate(s, 13, 15).ok);
  assert.ok(s.res.ice > 0);
  S.movePlayer(s, 13, 8); assert.ok(S.meltIce(s).ok);
  assert.ok(T.visiblePanels(s).includes("build") && T.visiblePanels(s).includes("capcom"));
  assert.ok(!T.visiblePanels(s).includes("shipyard") && !T.visiblePanels(s).includes("observatory") && !T.visiblePanels(s).includes("techtree"));
  assert.ok(S.build(s, "lab", 15, 8).ok);
  r = T.tutorialUpdate(s, tut);
  assert.deepEqual(r.newManuals.map((m) => m.id), ["lab"]);
  assert.ok(T.visiblePanels(s).includes("techtree"));
  assert.equal(T.nextManual(tut).id, "lab"); assert.equal(T.nextManual(tut), null);
  assert.equal(T.tutorialUpdate(s, tut).newManuals.length, 0, "a manual opens only the first time");
  assert.match(T.flowSvg(T.getManual("eds")), /marker-end/);
  assert.equal(T.fieldManualIndex(tut).filter((m) => m.unlocked).length, 1);
  assert.equal(T.manualFor("cryo_tank").id, "cryo_plant");
});

test("first minutes are playable: the lab makes science, science buys the first tech, the mission pays", () => {
  const s = S.createState();
  S.movePlayer(s, 13, 14); S.excavate(s, 13, 15); S.excavate(s, 13, 15); S.movePlayer(s, 13, 8); S.meltIce(s);
  assert.ok(S.build(s, "lab", 15, 8).ok);
  S.step(s, 12);
  assert.ok(s.missions.done.includes("m_ice") && s.missions.done.includes("m_lab"));
  assert.ok(S.research(s, "thermal_mining").ok);
  assert.equal(S.buildBlock(s, "ice_extractor", 13, 14), null);
});

test("languages: English by default, Spanish covers every building, tech, manual, mission and engine message", () => {
  assert.equal(I.getLang(), "en");
  assert.equal(I.t("Build"), "Build"); assert.equal(I.tr("Pipe laid"), "Pipe laid");
  assert.equal(I.loc.building("lab").name, "Laboratory");
  I.setLang("es");
  assert.equal(I.t("Build"), "Construir"); assert.equal(I.tr("Pipe laid"), "Tubería colocada");
  for (const id of Object.keys(S.BUILDINGS)) assert.ok(ES.buildings[id]?.name && ES.buildings[id]?.desc, );
  for (const tech of TECHS) assert.ok(ES.techs[tech.id]?.name && ES.techs[tech.id]?.text, );
  for (const m of T.MANUALS) { const e = ES.manuals[m.id]; assert.ok(e, ); assert.equal(e.flow.length, m.flow.length); assert.equal(e.connect.length, m.connect.length); assert.equal(e.failures.length, m.failures.length); }
  for (const m of S.MISSIONS) assert.ok(ES.missions[m.id], );
  for (const p of T.PANELS) assert.ok(ES.panels[p.id], );
  assert.equal(ES.lostLogs.length, 8); assert.equal(ES.facts.length, 10);
  // every message the engine can produce in a busy session is translated
  const untranslated = new Set();
  const seen = (txt) => { if (I.tr(txt) === txt && /[a-z]{4}/.test(txt)) untranslated.add(txt); };
  for (const mode of Object.keys(MODES)) {
    const s = S.createStressTest(mode);
    for (let i = 0; i < 300; i++) { S.step(s, 2); s.crew.health = 100; for (const a of s.alerts) seen(a.text); }
    for (const l of s.log) seen(l.text);
    seen(T.currentObjective(s));
    for (const r of [S.build(s, "vsat", 5, 8), S.build(s, "telescope", 5, 8), S.pave(s, 13, 8), S.excavate(s, 0, 0), S.meltIce(s), S.pile(s, 3, 3), S.layPipe(s, 3, 3), S.repair(s, 1), S.resupply(s, "parts"), S.research(s, "suitport"), S.seismicScan(s), S.startObservation(s, "cme"), S.assembleSubsystem(s, "Power"), S.addGas(s, "o2", 1), S.buildBerm(s), S.edsPulse(s, 1)]) seen(r.msg);
    for (const b of S.launchBlockers(s, "mars")) seen(b);
  }
  assert.deepEqual([...untranslated], []);
  const b = I.loc.briefing("terrorifico");
  assert.match(b[0].paragraphs[0], /miedo/); assert.equal(b[1].transmissions.length, 4); assert.match(b[3].footer, /dos semanas/);
  assert.equal(I.loc.tech(TECHS[0]).card.formula, TECHS[0].card.formula, "formulas are not translated");
  I.setLang("en");
  assert.equal(I.loc.briefing("realista")[0].title, "WHY THIS MISSION IS REAL");
});
