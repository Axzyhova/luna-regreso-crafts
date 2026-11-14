import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, TIPOS, PLACEABLE, BAL, leakAllowed, nextLeakDelay, type LeakTarget, type Module, type ModType } from "./sim";
import { sfx } from "./audio";
import { stepAliens, hitAlien, type World } from "./aliens";
import { stepCountdown } from "./mission";
import { touch } from "./touch";
import { stepEffects, effectMods } from "./effects";
import { stepEvents, toast } from "./events";
import { initCapsules, nearestCapsule, openCapsule } from "./loot";
import { stepQuests } from "./quests";
import { stepTutorial, tutorialWantsLeak, TUTORIAL } from "./tutorial";
import { ITEMS } from "./items";
import { feetBox, footprint, groundLine, moveWithCollision, overlaps, sortDepth, PLAYER_FOOT_Y, type Box } from "./solids";
import { FONT_KEY, registerPixelFont, toFont } from "./pixelfont";
import { WALK_SPEED, RUN_MULT, RUN_FATIGUE_S, runState, strideFrame } from "./movement";

/**
 * Astronaut frames (10×12, facing right). Rows 0-7 are the upper body, 8-11 the legs.
 * Walk: 4 frames (contact / passing / contact other leg / passing). Run: body leans forward,
 * longer stride. Near leg is light (w/s boot), far leg is shaded (s/d boot) so the legs read apart.
 */
const ASTRO_TOP = ["...wwws...", "..wwwwwws.", "..wwwvvvi.", "..wwwvvvv.", "..swwwwws.", ".bbwwwwws.", ".bbwwoows.", ".bbswwwss."];
const ASTRO_LEGS: Record<string, string[]> = {
  idle: ["...swwws..", "...s..w...", "...s..w...", "..dd..ss.."],
  walk0: ["...swwws..", "...s...w..", "..s....w..", ".dd....ss."],
  walk1: ["...swwws..", "...s.ww...", "...s.ss...", "..dd......"],
  walk2: ["...swwws..", "...w...s..", "..w....s..", ".ss....dd."],
  walk3: ["...swwws..", "...w.ss...", "...w.dd...", "..ss......"],
  run0: ["....swwws.", "...s....w.", ".ss......w", "dd.......s"],
  run1: ["....swwws.", "....sww...", "....s.ws..", "...dd.ss.."],
  run2: ["....swwws.", "...w....s.", ".ww......s", "ss.......d"],
  run3: ["....swwws.", "....wss...", "....w.sd..", "...ss.dd.."],
};
const lean = (rows: string[]) => rows.map((r) => `.${r.slice(0, -1)}`);

const W = 640, H = 360;
const HAB = { x: 110, y: 170 } /* matches habitat in modulos.json */, ROCKET = { x: 540, y: 150 };
const SHADOW = { x: 330, y: 270, rx: 120, ry: 60 };
type NodeType = "hielo" | "regolito" | "chatarra";
interface RNode { type: NodeType; amount: number; spr: Phaser.GameObjects.Image }

/** Pixel sprite from a text map. Adds a 1 px dark outline around the shape so it reads on any ground. */
function px(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, number>, outline: number | null = PAL.black) {
  const g = scene.add.graphics();
  const filled = (x: number, y: number) => colors[rows[y]?.[x] ?? "."] !== undefined;
  const o = outline === null ? 0 : 1;
  if (outline !== null) {
    g.fillStyle(outline);
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= rows[0]!.length; x++)
      if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g.fillRect(x + o, y + o, 1, 1);
  }
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (colors[c] !== undefined) { g.fillStyle(colors[c]); g.fillRect(x + o, y + o, 1, 1); } }));
  g.generateTexture(key, rows[0]!.length + o * 2, rows.length + o * 2); g.destroy();
}

/** Shaded 8-bit box: dark outline, base colour, light top/left edge, dark bottom/right edge. */
function box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, base: number, light: number, dark: number) {
  g.fillStyle(PAL.black).fillRect(x, y, w, h);
  g.fillStyle(base).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(light).fillRect(x + 1, y + 1, w - 2, 1).fillRect(x + 1, y + 1, 1, h - 2);
  g.fillStyle(dark).fillRect(x + 1, y + h - 2, w - 2, 1).fillRect(x + w - 2, y + 2, 1, h - 3);
}
const dot = (g: Phaser.GameObjects.Graphics, c: number, x: number, y: number, w = 1, h = 1) => g.fillStyle(c).fillRect(x, y, w, h);

/** Static solids that are not modules: the rocket and its two tanks (sprite size + centre). */
const STATIC_SPRITES = [
  { key: "rocket", x: ROCKET.x, y: ROCKET.y - 13, w: 40, h: 78, foot: { x: ROCKET.x - 10, y: ROCKET.y + 6, w: 20, h: 16 } },
  { key: "tank_lh2", x: ROCKET.x - 25, y: ROCKET.y + 5, w: 10, h: 30 },
  { key: "tank_lox", x: ROCKET.x + 25, y: ROCKET.y + 5, w: 10, h: 30 },
] as const;

export class LunarScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  keys!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E" | "SHIFT", Phaser.Input.Keyboard.Key>;
  nodes: RNode[] = [];
  leakSprites = new Map<number, Phaser.GameObjects.Image>();
  alienSprites = new Map<number, Phaser.GameObjects.Image>();
  capSprites = new Map<number, Phaser.GameObjects.Image>();
  zone!: Phaser.GameObjects.Graphics;
  tint!: Phaser.GameObjects.Rectangle;
  beam!: Phaser.GameObjects.Graphics;
  ring!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  preview!: Phaser.GameObjects.Graphics;
  modSprites = new Map<number, { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; warn: Phaser.GameObjects.BitmapText; glow: Phaser.GameObjects.Image | undefined }>();
  buildValid = false;
  prompt!: Phaser.GameObjects.BitmapText;
  promptBg!: Phaser.GameObjects.Rectangle;
  animT = 0; dustT = 0; winded = false; wantsRun = false;
  touchMode = false;
  pubT = 0; saveT = 0; repairT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    // Astronaut (faces right): helmet with a lit visor, backpack, chest light, two-tone legs and boots.
    registerPixelFont(Phaser, this);
    const astroCols = { w: T.white, s: T.moon3, d: T.moon2, v: T.suit, i: T.ice, b: T.moon2, o: T.alert };
    for (const [name, legs] of Object.entries(ASTRO_LEGS)) px(this, `astro_${name}`, [...(name.startsWith("run") ? lean(ASTRO_TOP) : ASTRO_TOP), ...legs], astroCols);
    px(this, "dust", [".m.", "mmm", ".m."], { m: T.moon3 }, null);
    // Resource nodes: light from the top-left, shade at the bottom.
    px(this, "ice", ["..ww..", ".wccw.", "wcccdc", "ccdcdd", ".dddd."], { w: T.white, c: T.ice, d: T.suitL });
    px(this, "reg", [".ll...", "lmml.l", "mmdmlm", "dmddmd", ".dd.d."], { l: T.moon3, m: T.moon2, d: T.moon1 });
    px(this, "scrap", ["g..oo.", "gs.od.", ".sgg.d", "osdsg.", ".d..dd"], { g: T.moon4, s: T.moon3, o: T.alert, d: T.moon2 });
    px(this, "al_abductor", ["..vvvv..", ".vwvvwv.", "vvvvvvvv", ".gg..gg.", "g......g"], { v: T.alien, w: T.white, g: T.ok });
    px(this, "al_rastreador", [".v..v.", "vvvvvv", "vwvvwv", "vvvvvv", "v.vv.v"], { v: T.alien, w: T.red });
    px(this, "al_saboteador", ["v..v", ".vv.", "vwwv", ".vv.", "v..v"], { v: T.alien, w: T.alert });
    px(this, "al_nodriza", ["........vvvvvvvv........", ".....vvvwwvvvvwwvvv.....", "..vvvvvvvvvvvvvvvvvvvv..", "vvvgvvgvvgvvgvvgvvgvvgvv", "..vvvvvvvvvvvvvvvvvvvv..", ".....g.....gg.....g....."], { v: T.alien, w: T.ice, g: T.ok });
    // Supply capsule: a small cargo rocket, clearly bigger than scrap (11x15 vs 4x4).
    px(this, "capsule", ["....www....", "...wwwww...", "...wrrrw...", "..wwwwwww..", "..wgggggw..", "..wgyyygw..", "..wgggggw..", "..wwwwwww..", "..wbbbbbw..", "..wwwwwww..", ".rww...wwr.", "rr.w...w.rr", "r..o...o..r", "...o...o..."], { w: PAL.white, r: PAL.red, g: PAL.gold, y: PAL.alert, b: PAL.suit, o: PAL.moon3 });
    px(this, "leak", [".a.a.", "a.r.a", ".rwr.", "a.r.a", ".a.a."], { a: T.alert, r: T.red, w: T.white });
    this.makeModuleTextures();
    const lg = this.add.graphics();
    for (let r = 48; r > 0; r -= 4) { lg.fillStyle(0xffffff, 0.08); lg.fillCircle(48, 48, r); }
    lg.generateTexture("glow", 96, 96); lg.destroy();

    // terrain
    const g = this.add.graphics();
    g.fillStyle(T.moon1).fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle(Phaser.Math.RND.pick([T.moon0, T.moon2])); g.fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 2, 1); }
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(20, W - 20), y = Phaser.Math.Between(20, H - 20), r = Phaser.Math.Between(6, 16);
      g.fillStyle(T.moon0).fillEllipse(x, y, r * 2, r * 1.4); g.fillStyle(T.moon2).fillEllipse(x + 1, y - 1, r * 1.6, r);
      g.fillStyle(T.moon1).fillEllipse(x + 2, y, r * 1.5, r * 0.9);
    }
    g.fillStyle(T.moon0).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2 + 16, SHADOW.ry * 2 + 10);
    g.fillStyle(T.space).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2, SHADOW.ry * 2);
    this.label(SHADOW.x, SHADOW.y - 3, "SHADOWED CRATER", PAL.moon2, 1);

    // rocket and tanks: separate sprites so the astronaut can walk behind them (depth sorted by their base)
    for (const s of STATIC_SPRITES) {
      this.add.image(s.x, s.y + s.h / 2, "shadow").setDisplaySize(s.w + 6, 8).setDepth(5.5);
      this.add.image(s.x, s.y, s.key).setDepth(sortDepth(groundLine(s.y, s.h), H));
    }
    this.label(ROCKET.x, ROCKET.y + 29, "ROCKET", PAL.moon4);
    this.label(ROCKET.x - 25, ROCKET.y + 23, "LH2", PAL.suitL); this.label(ROCKET.x + 25, ROCKET.y + 23, "LOX", PAL.ice);
    this.label(HAB.x, HAB.y + 17, "HABITAT", PAL.moon4);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(12 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(10 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(8 * k); i++) this.spawnNode("chatarra");

    this.preview = this.add.graphics().setDepth(35);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro_idle").setDepth(10);
    this.ring = this.add.graphics().setDepth(30);
    this.beam = this.add.graphics().setDepth(22);
    this.zone = this.add.graphics().setDepth(24);
    this.tint = this.add.rectangle(0, 0, W, H, PAL.red, 0).setOrigin(0).setScrollFactor(0).setDepth(26);
    this.night = this.add.rectangle(0, 0, W, H, PAL.black, 0).setOrigin(0).setScrollFactor(0).setDepth(20);
    this.promptBg = this.add.rectangle(0, 0, 4, 9, PAL.black, 0.85).setOrigin(0).setDepth(39).setStrokeStyle(1, PAL.moon1).setVisible(false);
    this.prompt = this.add.bitmapText(0, 0, FONT_KEY, "").setTint(PAL.gold).setDepth(40).setVisible(false);

    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SHIFT,SPACE,ONE,TWO,THREE,FOUR,FIVE,C,Q") as LunarScene["keys"];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const w = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      if (sim.buildMode) this.place(p.wasTouch ? { x: w.x, y: w.y } : undefined); else this.useTool();
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { if (!p.wasTouch) this.touchMode = false; });
    this.input.keyboard!.on("keydown-C", () => this.toggleBuild());
    this.input.keyboard!.on("keydown-Q", () => this.cycleBuild());
    this.input.keyboard!.on("keydown-SPACE", () => (sim.buildMode ? this.place() : this.useTool()));
    this.input.keyboard!.on("keydown-E", () => this.interact());
    const t = (f: () => void) => () => { this.touchMode = true; f(); };
    touch.act = { use: t(() => (sim.buildMode ? this.place() : this.useTool())), interact: t(() => this.interact()), build: t(() => this.toggleBuild()), cycle: t(() => this.cycleBuild()) };
    this.events.once("shutdown", () => { touch.act = { use: () => {}, interact: () => {}, build: () => {}, cycle: () => {} }; });
    (["ONE", "TWO", "THREE", "FOUR", "FIVE"] as const).forEach((n, i) => this.input.keyboard!.on(`keydown-${n}`, () => { sim.hotbar = i + 1; sfx.click(); }));
    for (const l of sim.leaks) this.addLeakSprite(l.id, l.x, l.y);
    initCapsules(sim, { w: W, h: H, hab: HAB, rnd: () => Math.random() });
    if (!sim.log.length) addLog(sim, "Emergency landing at the lunar south pole. No fuel.");
    this.leakT = 90;
  }

  spawnNode(type: NodeType) {
    let x: number, y: number;
    const inShadow = (x: number, y: number) => ((x - SHADOW.x) / SHADOW.rx) ** 2 + ((y - SHADOW.y) / SHADOW.ry) ** 2 < 0.8;
    do {
      x = Phaser.Math.Between(16, W - 16); y = Phaser.Math.Between(16, H - 16);
    } while ((type === "hielo") !== inShadow(x, y) || Phaser.Math.Distance.Between(x, y, HAB.x, HAB.y) < 75 || Phaser.Math.Distance.Between(x, y, ROCKET.x, ROCKET.y) < 45);
    const spr = this.add.image(x, y, type === "hielo" ? "ice" : type === "regolito" ? "reg" : "scrap").setDepth(4);
    this.nodes.push({ type, amount: Phaser.Math.Between(2, 4), spr });
  }

  addLeakSprite(id: number, x: number, y: number) {
    this.leakSprites.set(id, this.add.image(x, y, "leak").setDepth(12));
  }

  spawnLeak(forced?: LeakTarget) {
    const target: LeakTarget = forced ?? Phaser.Math.RND.pick(["habitat", "habitat", "lh2", "lox"]);
    // Leaks sit on the front wall of solid structures so they can be reached from the front or the back.
    const base = target === "habitat" ? { x: HAB.x + Phaser.Math.Between(-20, 20), y: HAB.y + 8 } : target === "lh2" ? { x: ROCKET.x - 25, y: ROCKET.y + 10 } : { x: ROCKET.x + 25, y: ROCKET.y + 10 };
    const l = { id: sim.nextLeakId++, target, x: base.x, y: base.y, size: 1, progress: 0, age: 0 };
    sim.leaks.push(l); this.addLeakSprite(l.id, l.x, l.y);
    sim.leakFreeNight = isDay(sim) ? sim.leakFreeNight : false;
    addLog(sim, `Leak detected in ${target === "habitat" ? "the habitat" : target === "lh2" ? "the LH2 tank" : "the LOX tank"}.`);
    sfx.alert();
  }

  nearestNode() {
    let best: RNode | null = null, bd = 14;
    for (const n of this.nodes) { const d = Phaser.Math.Distance.Between(n.spr.x, n.spr.y, this.player.x, this.player.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  nearestLeak() {
    return sim.leaks.find((l) => Phaser.Math.Distance.Between(l.x, l.y, this.player.x, this.player.y) < 16);
  }
  /** Everything the astronaut bumps into: the rocket, its tanks and every built module. */
  solids(): Box[] {
    const out: Box[] = STATIC_SPRITES.map((s) => ("foot" in s ? s.foot : footprint(s.x, s.y, s.w, s.h)));
    for (const m of sim.modules) { const t = TIPOS[m.tipo]; out.push(footprint(m.x, m.y, t.w, t.h)); }
    return out;
  }
  nearHab() { return Phaser.Math.Distance.Between(HAB.x, HAB.y, this.player.x, this.player.y) < 36; }
  nearModule(pred: (m: Module) => boolean, r = 22) {
    let best: Module | undefined, bd = r;
    for (const m of sim.modules) { if (!pred(m)) continue; const d = Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) - Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  makeModuleTextures() {
    const T = PAL;
    const draw = (key: string, w: number, h: number, f: (g: Phaser.GameObjects.Graphics) => void) => { const g = this.add.graphics(); f(g); g.generateTexture(key, w, h); g.destroy(); };
    // Sizes match modulos.json (w × h) because placement and collisions use those numbers.
    draw("m_habitat", 44, 28, (g) => {
      box(g, 0, 8, 44, 20, T.moon3, T.moon4, T.moon2); // main hull
      box(g, 3, 2, 38, 8, T.moon4, T.white, T.moon3); // curved roof
      dot(g, T.black, 3, 2); dot(g, T.black, 40, 2); // rounded roof corners
      dot(g, T.moon4, 36, 0, 1, 2); dot(g, T.red, 36, 0); // antenna with beacon
      for (let x = 4; x < 42; x += 5) dot(g, T.moon2, x, 24); // rivets
      box(g, 5, 12, 7, 6, T.suit, T.ice, T.moon0); box(g, 32, 12, 7, 6, T.suit, T.ice, T.moon0); // portholes
      box(g, 17, 14, 10, 14, T.suit, T.suitL, T.moon0); dot(g, T.ice, 19, 16, 6, 2); dot(g, T.moon0, 21, 22, 2, 1); // airlock door
      dot(g, T.ok, 29, 15, 2, 2); // status light
    });
    draw("m_panel", 18, 14, (g) => {
      box(g, 0, 0, 18, 10, T.suit, T.suitL, T.moon0);
      dot(g, T.moon0, 6, 1, 1, 8); dot(g, T.moon0, 11, 1, 1, 8); dot(g, T.moon0, 1, 5, 16, 1); // cell grid
      dot(g, T.white, 2, 2); dot(g, T.white, 8, 2); dot(g, T.ice, 13, 2, 2, 1); // glints
      box(g, 7, 9, 4, 4, T.moon3, T.moon4, T.moon1); dot(g, T.moon2, 4, 13, 10, 1); // mast + foot
    });
    draw("m_bateria", 12, 12, (g) => {
      dot(g, T.black, 2, 0, 3, 3); dot(g, T.red, 3, 1); dot(g, T.black, 7, 0, 3, 3); dot(g, T.moon4, 8, 1); // + / - terminals
      box(g, 0, 2, 12, 10, T.moon3, T.moon4, T.moon1);
      dot(g, T.moon0, 2, 5, 8, 4); dot(g, T.ok, 3, 6, 2, 2); dot(g, T.ok, 5, 6, 2, 2); dot(g, T.moon1, 7, 6, 2, 2); // charge cells
    });
    draw("m_electrolisis", 16, 16, (g) => {
      box(g, 0, 8, 16, 8, T.moon2, T.moon3, T.moon0);
      box(g, 1, 0, 6, 10, T.suitL, T.ice, T.suit); dot(g, T.white, 3, 2, 1, 2); // H2 tank
      box(g, 9, 0, 6, 10, T.white, T.white, T.moon3); dot(g, T.ice, 11, 2, 1, 2); // O2 tank
      dot(g, T.moon4, 6, 4, 4, 1); dot(g, T.ok, 3, 12, 2, 1); dot(g, T.alert, 11, 12, 2, 1); // pipe + lights
    });
    draw("m_licuefactor", 14, 14, (g) => {
      box(g, 2, 0, 10, 12, T.moon4, T.white, T.moon2);
      dot(g, T.black, 2, 0); dot(g, T.black, 11, 0); // rounded cap
      dot(g, T.ice, 3, 4, 8, 3); dot(g, T.suitL, 3, 6, 8, 1); dot(g, T.white, 4, 4, 2, 1); // frost band
      dot(g, T.black, 2, 12, 3, 2); dot(g, T.moon2, 3, 12, 1, 1); dot(g, T.black, 9, 12, 3, 2); dot(g, T.moon2, 10, 12, 1, 1); // feet
    });
    draw("m_horno", 16, 14, (g) => {
      box(g, 0, 2, 16, 12, T.moon2, T.moon3, T.moon0);
      box(g, 11, 0, 4, 4, T.moon1, T.moon2, T.moon0); // chimney
      box(g, 3, 5, 10, 7, T.moon0, T.moon1, T.black); // mouth
      dot(g, T.red, 4, 9, 8, 2); dot(g, T.alert, 5, 8, 6, 2); dot(g, T.gold, 7, 8, 2, 1); // fire
    });
    draw("m_taller", 20, 14, (g) => {
      box(g, 0, 3, 20, 11, T.moon1, T.moon2, T.moon0);
      box(g, 0, 0, 20, 5, T.alert, T.gold, T.red);
      for (let x = 2; x < 18; x += 4) dot(g, T.black, x, 2, 2, 1); // hazard stripes
      box(g, 8, 7, 5, 7, T.moon0, T.moon1, T.black); // door
      dot(g, T.moon4, 2, 8, 4, 1); dot(g, T.moon4, 3, 7, 1, 3); dot(g, T.moon4, 15, 7, 1, 4); dot(g, T.moon4, 14, 7, 3, 1); // tools
    });
    draw("m_taladro", 10, 14, (g) => {
      dot(g, T.moon3, 1, 4, 1, 9); dot(g, T.moon3, 8, 4, 1, 9); dot(g, T.moon2, 2, 7, 6, 1); // frame
      box(g, 2, 0, 6, 5, T.alert, T.gold, T.red); // motor
      dot(g, T.black, 3, 5, 4, 7); dot(g, T.moon4, 4, 5, 1, 6); dot(g, T.moon2, 5, 5, 1, 6); dot(g, T.moon4, 4, 11, 2, 1); // bit
      box(g, 0, 12, 10, 2, T.moon2, T.moon3, T.moon0);
    });
    draw("m_torre_luz", 6, 16, (g) => {
      box(g, 0, 0, 6, 5, T.gold, T.white, T.alert);
      dot(g, T.black, 1, 5, 4, 10); dot(g, T.moon3, 2, 5, 1, 10); dot(g, T.moon2, 3, 5, 1, 10); // pole
      dot(g, T.black, 0, 15, 6, 1);
    });

    // Rocket (40×78): stepped nose cone, porthole, red band and fins, all outlined and shaded.
    draw("rocket", 40, 78, (g) => {
      const nose: [number, number, number, number][] = [[19, 0, 2, 2], [18, 2, 4, 3], [17, 5, 6, 3], [16, 8, 8, 3], [15, 11, 10, 3], [13, 14, 14, 3]];
      for (const [x, y, w, h] of nose) dot(g, T.black, x - 1, y - (y ? 0 : 1), w + 2, h + 1);
      const fins: [number, number, number, number][] = [[7, 56, 6, 16], [4, 62, 4, 10], [2, 66, 3, 8], [27, 56, 6, 16], [32, 62, 4, 10], [35, 66, 3, 8]];
      for (const [x, y, w, h] of fins) dot(g, T.black, x - 1, y - 1, w + 2, h + 2);
      for (const [x, y, w, h] of fins) dot(g, T.red, x, y, w, h);
      dot(g, T.alert, 7, 56, 1, 16); dot(g, T.alert, 27, 56, 1, 16); // fin highlights
      box(g, 12, 16, 16, 58, T.moon4, T.white, T.moon3); // body
      for (const [i, [x, y, w, h]] of nose.entries()) { dot(g, i < 2 ? T.red : T.white, x, y, w, h); dot(g, T.moon3, x + w - 1, y, 1, h); }
      box(g, 16, 23, 8, 8, T.suit, T.suitL, T.moon0); dot(g, T.ice, 18, 25, 2, 2); // porthole
      dot(g, T.red, 13, 38, 14, 3); dot(g, T.alert, 13, 38, 14, 1); // band
      for (let y = 46; y < 70; y += 6) dot(g, T.moon3, 14, y, 12, 1); // panel seams
      box(g, 15, 72, 10, 6, T.moon2, T.moon3, T.moon0); // nozzle
    });
    for (const [key, band] of [["tank_lh2", T.suitL], ["tank_lox", T.ice]] as const) {
      draw(key, 10, 30, (g) => {
        box(g, 2, 0, 6, 3, T.moon3, T.moon4, T.moon1); // valve cap
        box(g, 0, 2, 10, 26, T.moon2, T.moon3, T.moon0);
        dot(g, T.black, 0, 2); dot(g, T.black, 9, 2); // rounded top
        dot(g, band, 1, 8, 8, 3); dot(g, T.white, 2, 8, 2, 1); // frost band
        dot(g, T.moon0, 1, 18, 8, 1); // weld seam
        dot(g, T.black, 1, 28, 3, 2); dot(g, T.black, 6, 28, 3, 2); // legs
      });
    }
    // Soft ground shadow, stretched under every structure.
    draw("shadow", 32, 8, (g) => { g.fillStyle(PAL.black, 0.35).fillEllipse(16, 4, 32, 8); });
  }

  syncModules(a: number) {
    const alive = new Set(sim.modules.map((m) => m.uid));
    for (const [uid, sp] of this.modSprites) if (!alive.has(uid)) { sp.img.destroy(); sp.shadow.destroy(); sp.warn.destroy(); sp.glow?.destroy(); this.modSprites.delete(uid); }
    for (const m of sim.modules) {
      let sp = this.modSprites.get(m.uid);
      if (!sp) {
        const t = TIPOS[m.tipo];
        const shadow = this.add.image(m.x, groundLine(m.y, t.h), "shadow").setDisplaySize(t.w + 4, 6).setDepth(5.5);
        const img = this.add.image(m.x, m.y, `m_${m.tipo}`).setDepth(sortDepth(groundLine(m.y, t.h), H));
        const warn = this.add.bitmapText(m.x - 1, m.y - TIPOS[m.tipo].h / 2 - 8, FONT_KEY, "!").setTint(PAL.alert).setDepth(36);
        const glow = m.tipo === "habitat" || m.tipo === "torre_luz" ? this.add.image(m.x, m.y, "glow").setScale(m.tipo === "habitat" ? 1.6 : 1.3).setDepth(21).setBlendMode(Phaser.BlendModes.ADD) : undefined;
        sp = { img, shadow, warn, glow }; this.modSprites.set(m.uid, sp);
      }
      const on = m.activo && m.durabilidad > 0;
      sp.img.setAlpha(on ? 1 : 0.45);
      sp.warn.setVisible(m.durabilidad < 25 && Math.sin(this.time.now / 200) > 0);
      sp.glow?.setAlpha(on && sim.battery > 0 ? a * 1.4 : 0);
    }
  }

  ownedPlaceables() { return Object.keys(PLACEABLE).filter((k) => (sim.inv as unknown as Record<string, number>)[k]! >= 1); }
  toggleBuild() {
    if (useGame.getState().overlay) return;
    if (sim.buildMode) { sim.buildMode = null; this.preview.clear(); return; }
    const own = this.ownedPlaceables();
    if (!own.length) { this.say("NO MODULES: CRAFT THEM (INVENTORY)"); sfx.bad(); return; }
    sim.buildMode = own[0]!; sfx.click();
  }
  cycleBuild() {
    if (!sim.buildMode) return;
    const own = this.ownedPlaceables();
    sim.buildMode = own[(own.indexOf(sim.buildMode) + 1) % own.length] ?? null; sfx.click();
  }
  inShadowAt(x: number, y: number) { return ((x - SHADOW.x) / SHADOW.rx) ** 2 + ((y - SHADOW.y) / SHADOW.ry) ** 2 < 1; }
  checkPlace(tipo: ModType, x: number, y: number) {
    const t = TIPOS[tipo];
    if (x - t.w / 2 < 2 || y - t.h / 2 < 2 || x + t.w / 2 > W - 2 || y + t.h / 2 > H - 2) return false;
    if (Math.abs(x - ROCKET.x) < 36 && Math.abs(y - ROCKET.y) < 60) return false;
    if (!!t.en_crater !== this.inShadowAt(x, y)) return false;
    if (overlaps(footprint(x, y, t.w, t.h), feetBox(this.player.x, this.player.y))) return false; // never build on the astronaut
    return sim.modules.every((m) => { const o = TIPOS[m.tipo]; return Math.abs(m.x - x) * 2 >= o.w + t.w + 4 || Math.abs(m.y - y) * 2 >= o.h + t.h + 4; });
  }
  /** Where a module would go: under the mouse, or in front of the astronaut on touch screens. */
  buildTarget() {
    if (this.touchMode) return { x: Math.round(this.player.x + this.facing * 22), y: Math.round(this.player.y) };
    const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }
  place(at?: { x: number; y: number }) {
    const key = sim.buildMode; if (!key) return;
    const tipo = PLACEABLE[key]!;
    const p = at ?? this.buildTarget();
    const x = Math.round(p.x), y = Math.round(p.y);
    if (!this.checkPlace(tipo, x, y)) { sfx.bad(); this.say(TIPOS[tipo].en_crater ? "THE DRILL GOES INSIDE THE CRATER" : "INVALID SPOT"); return; }
    (sim.inv as unknown as Record<string, number>)[key]! -= 1;
    sim.modules.push({ uid: sim.nextUid++, tipo, x, y, durabilidad: 100, activo: true });
    addLog(sim, `Day ${sim.day}: you built a ${TIPOS[tipo].nombre.toLowerCase()}.`); sfx.ok();
    if (!this.ownedPlaceables().includes(key)) { sim.buildMode = null; this.preview.clear(); }
  }

  useTool() {
    if (useGame.getState().overlay || this.useCd > 0) return;
    const hit = hitAlien(sim, this.player.x, this.player.y);
    if (hit) {
      this.useCd = 0.4; sfx.click();
      const spr = this.alienSprites.get(hit.id);
      if (spr) { spr.setTint(PAL.white); this.time.delayedCall(120, () => spr.clearTint()); }
      return;
    }
    const n = this.nearestNode();
    if (!n) return;
    this.useCd = ((sim.inv.taladro ?? 0) > 0 ? 0.25 : (sim.inv.pala_mejorada ?? 0) > 0 ? 0.35 : 0.5) * effectMods(sim).gather;
    if (!addItem(sim, n.type, 1)) { this.say("INVENTORY FULL"); sfx.bad(); return; }
    if (n.type === "hielo") sim.stats.hielo++;
    sim.fatigue = Math.min(100, sim.fatigue + 0.6);
    n.amount -= 1; sfx.pick();
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type)); }
  }

  interact() {
    if (useGame.getState().overlay) return;
    if (this.nearestLeak()) return; // hold handled in update
    const cap = nearestCapsule(sim, this.player.x, this.player.y);
    if (cap) {
      const found = openCapsule(sim, cap.id, () => Math.random());
      toast(sim, `📦 ${found.map((f) => `+${f.n} ${ITEMS[f.item]?.nombre ?? f.item}`).join(" · ") || "Inventory full"}`);
      sfx.ok();
      return;
    }
    if (this.nearHab() && sim.inv.hielo > 0) {
      const w = sim.inv.hielo * BAL.hielo_a_agua_kg; sim.inv.agua += w; sim.inv.hielo = 0;
      addLog(sim, `You melted ice: +${w} kg of water for electrolysis.`); sfx.ok();
    } else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) {
      useGame.getState().setOverlay("cohete");
    }
  }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    const overlay = useGame.getState().overlay;
    if (overlay) return;
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
    let len = Math.hypot(vx, vy) || 1;
    if (!vx && !vy && (touch.vx || touch.vy)) { vx = touch.vx; vy = touch.vy; len = 1; } // analog joystick
    // Run: hold Shift (keyboard) or toggle RUN (touch). Costs stamina; when winded you can only walk.
    const wantsMove = !!(vx || vy);
    this.wantsRun = k.SHIFT.isDown || touch.run;
    const rs = runState(sim.fatigue, wantsMove && this.wantsRun, this.winded);
    this.winded = rs.winded;
    if (rs.running) sim.fatigue = Math.min(100, sim.fatigue + RUN_FATIGUE_S * dt);
    const sp = WALK_SPEED * effectMods(sim).speed * (rs.running ? RUN_MULT : 1);
    const ox = this.player.x, oy = this.player.y;
    const moved = moveWithCollision(this.player.x, this.player.y, (vx / len) * sp * dt, (vy / len) * sp * dt, this.solids(), { minX: 5, minY: 6, maxX: W - 5, maxY: H - 7 });
    this.player.setPosition(moved.x, moved.y).setDepth(sortDepth(this.player.y + PLAYER_FOOT_Y, H));
    this.animatePlayer(dt, moved.x !== ox || moved.y !== oy, rs.running);
    sim.tut.moved += Math.hypot(this.player.x - ox, this.player.y - oy);
    if (vx) { this.facing = Math.sign(vx); this.player.setFlipX(vx < 0); }
    this.useCd = Math.max(0, this.useCd - dt);

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    step(sim, dt, { inHabitat: this.nearHab(), inShadow });
    this.updateAliens(dt);
    this.updateWorldEvents(dt, inShadow);
    const cd = stepCountdown(sim, dt);
    if (cd === "launched") { sfx.ok(); saveGame(); useGame.getState().publish(); useGame.getState().go("final"); return; }
    if (cd === "aborted") { sfx.bad(); this.say("LAUNCH ABORTED: CHECK THE ROCKET (E)"); }

    // leaks
    this.leakT -= dt;
    if (this.leakT <= 0) {
      this.leakT = nextLeakDelay(sim, Math.random());
      if (leakAllowed(sim)) { sim.leaksToday++; this.spawnLeak(); }
    }
    // Tutorial: make sure there is a leak to practice sealing.
    if (tutorialWantsLeak(sim) && !sim.leaks.length) this.spawnLeak("habitat");
    if (stepTutorial(sim)) {
      sfx.ok();
      toast(sim, sim.tut.step >= TUTORIAL.length ? "🎓 Tutorial complete! Follow the GPS card and your missions." : `✔ ${TUTORIAL[sim.tut.step - 1]!.title}`, 4);
    }
    this.ring.clear();
    sim.near.taller = !!this.nearModule((m) => m.tipo === "taller" && m.durabilidad > 0, 26);
    sim.near.horno = !!this.nearModule((m) => m.tipo === "horno" && m.durabilidad > 0, 26);
    const leak = this.nearestLeak();
    const broken = leak ? undefined : this.nearModule((m) => m.durabilidad < 100);
    if (broken && (k.E.isDown || touch.e) && broken.durabilidad < 60) {
      if (sim.inv.kits < 1) this.say("NO KITS: CRAFT ONE (INVENTORY)");
      else {
        this.repairT += dt;
        const need = 2.5 * effectMods(sim).repair;
        this.ring.lineStyle(2, PAL.ok).beginPath().arc(broken.x, broken.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.repairT / need)).strokePath();
        if (this.repairT >= need) { this.repairT = 0; sim.inv.kits -= 1; broken.durabilidad = 100; sim.stats.reparaciones++; addLog(sim, `Repaired: ${TIPOS[broken.tipo].nombre}. -1 kit.`); sfx.ok(); }
      }
    } else this.repairT = 0;
    if (leak && (k.E.isDown || touch.e)) {
      if (sim.inv.kits < 1) { this.say("NO KITS: CRAFT ONE (INVENTORY)"); }
      else {
        leak.progress += dt / ((1.5 + leak.size * 0.8) * effectMods(sim).repair);
        this.ring.lineStyle(2, PAL.ok).beginPath().arc(leak.x, leak.y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leak.progress).strokePath();
        if (leak.progress >= 1) {
          sim.inv.kits -= 1; sim.leaks = sim.leaks.filter((l) => l !== leak);
          this.leakSprites.get(leak.id)?.destroy(); this.leakSprites.delete(leak.id);
          sim.actFlags.leakFixed = true; sim.stats.reparaciones++; addLog(sim, "Leak sealed. -1 kit."); sfx.ok();
        }
      }
    } else if (leak) leak.progress = Math.max(0, leak.progress - dt * 0.5);
    for (const l of sim.leaks) { const s = this.leakSprites.get(l.id); if (s) s.setScale(0.8 + l.size * 0.25).setAlpha(Math.sin(this.time.now / 120) > 0 ? 1 : 0.4); }

    // prompts
    const n = this.nearestNode();
    if (leak) this.say(`HOLD E: SEAL LEAK (${sim.inv.kits} KITS)`);
    else if (nearestCapsule(sim, this.player.x, this.player.y)) this.say("E: OPEN SUPPLY CAPSULE");
    else if (n) this.say(`ACTION: PICK UP ${(ITEMS[n.type]?.nombre ?? n.type).toUpperCase()}`);
    else if (broken && broken.durabilidad < 60 && !(this.nearHab() && sim.inv.hielo > 0)) this.say(`HOLD E: REPAIR ${TIPOS[broken.tipo].nombre.toUpperCase()} (1 KIT)`);
    else if (this.nearHab() && sim.inv.hielo > 0) this.say("E: MELT ICE");
    else if (this.nearHab()) this.say("HABITAT: REFILLING O2");
    else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) this.say("E: CHECK ROCKET");
    else if (this.winded && this.wantsRun) this.say("TOO TIRED TO RUN");
    else { this.prompt.setVisible(false); this.promptBg.setVisible(false); }

    // day/night lighting
    const t = sim.time % CYCLE;
    const dark = modeCfg(sim).noche_oscuridad;
    let a = t < DAY_LEN ? 0 : dark;
    if (t > DAY_LEN - 20 && t < DAY_LEN) a = ((t - (DAY_LEN - 20)) / 20) * dark;
    if (t > CYCLE - 20) a = ((CYCLE - t) / 20) * dark;
    this.night.setAlpha(a);
    this.syncModules(a);
    this.preview.clear();
    if (sim.buildMode) {
      const tipo = PLACEABLE[sim.buildMode]!; const t = TIPOS[tipo];
      const p = this.buildTarget();
      const ok = this.checkPlace(tipo, Math.round(p.x), Math.round(p.y));
      this.preview.fillStyle(ok ? PAL.ok : PAL.red, 0.45).fillRect(Math.round(p.x) - t.w / 2, Math.round(p.y) - t.h / 2, t.w, t.h);
      this.preview.lineStyle(1, ok ? PAL.ok : PAL.red).strokeRect(Math.round(p.x) - t.w / 2, Math.round(p.y) - t.h / 2, t.w, t.h);
    }

    if (sim.health <= 0) { onDeath(sim); sfx.bad(); this.player.setPosition(HAB.x, HAB.y + 30); }

    this.pubT += dt; this.saveT += dt;
    if (this.pubT > 0.15) { this.pubT = 0; this.publishRadar(); useGame.getState().publish(); }
    if (this.saveT > 20) { this.saveT = 0; saveGame(); }
  }

  world(): World {
    return { player: { x: this.player.x, y: this.player.y }, inHabitat: this.nearHab(), hab: HAB, rocket: ROCKET, w: W, h: H, rnd: () => Math.random() };
  }

  /** Natural events, negative states, story progress, loot capsules and screen tint. */
  updateWorldEvents(dt: number, inShadow: boolean) {
    const w = this.world();
    for (const p of stepEvents(sim, dt, w)) {
      if (Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) < 90) this.cameras.main.shake(150, 0.01);
      sfx.alert();
    }
    stepEffects(sim, dt, w, inShadow);
    stepQuests(sim);
    // capsules
    const alive = new Set(sim.capsules.map((c) => c.id));
    for (const [id, spr] of this.capSprites) if (!alive.has(id)) { spr.destroy(); this.capSprites.delete(id); }
    for (const c of sim.capsules) if (!this.capSprites.has(c.id)) this.capSprites.set(c.id, this.add.image(c.x, c.y, "capsule").setDepth(5));
    // Capsules: steady sprite plus a pulsing gold ring so they never look like scrap.
    const pulse = (Math.sin(this.time.now / 300) + 1) / 2;
    // meteor zone and impacts
    this.zone.clear();
    for (const c of sim.capsules) this.zone.lineStyle(1, PAL.gold, 0.35 + pulse * 0.5).strokeCircle(c.x, c.y + 1, 10 + pulse * 3);
    const ev = sim.event;
    if (ev?.id === "meteoritos") {
      const r = 70;
      const blink = Math.sin(this.time.now / (ev.phase === "aviso" ? 180 : 90)) > 0;
      this.zone.lineStyle(1, ev.phase === "aviso" ? PAL.alert : PAL.red, blink ? 1 : 0.4).strokeCircle(ev.x, ev.y, r);
      this.zone.fillStyle(PAL.red, ev.phase === "activo" ? 0.12 : 0.05).fillCircle(ev.x, ev.y, r);
    }
    for (const i of sim.impacts) {
      this.zone.fillStyle(PAL.gold, Math.min(1, i.t)).fillCircle(i.x, i.y, 4 + (1.2 - i.t) * 10);
      this.zone.fillStyle(PAL.moon0, 0.8).fillCircle(i.x, i.y, 3);
    }
    // screen tint for the worst state
    const e = sim.effects;
    const color = e.includes("radiacion") ? PAL.ok : e.includes("frio") ? PAL.suitL : e.includes("calor") ? PAL.alert : e.includes("miedo") ? PAL.alien : null;
    if (color !== null) this.tint.setFillStyle(color, 0.08 + Math.abs(Math.sin(this.time.now / 600)) * 0.08);
    else this.tint.setFillStyle(PAL.red, 0);
  }

  /** Positions around the player for the compass/radar widget. */
  publishRadar() {
    const px = this.player.x, py = this.player.y;
    const r: { k: string; dx: number; dy: number }[] = [];
    for (const a of sim.aliens) r.push({ k: a.tipo === "nodriza" ? "jefe" : "alien", dx: a.x - px, dy: a.y - py });
    for (const c of sim.capsules) r.push({ k: "capsula", dx: c.x - px, dy: c.y - py });
    for (const l of sim.leaks) r.push({ k: "fuga", dx: l.x - px, dy: l.y - py });
    const ice = this.nodes.filter((n) => n.type === "hielo").map((n) => ({ k: "hielo", dx: n.spr.x - px, dy: n.spr.y - py })).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy)).slice(0, 3);
    r.push(...ice);
    if (sim.event?.id === "meteoritos") r.push({ k: "meteoritos", dx: sim.event.x - px, dy: sim.event.y - py });
    r.push({ k: "base", dx: HAB.x - px, dy: HAB.y - py }, { k: "cohete", dx: ROCKET.x - px, dy: ROCKET.y - py });
    sim.radar = r.map((x) => ({ k: x.k, dx: Math.round(x.dx), dy: Math.round(x.dy) }));
  }

  updateAliens(dt: number) {
    const world = this.world();
    for (const e of stepAliens(sim, dt, world)) {
      if (e.type === "leak") this.spawnLeak(e.target);
      if (e.type === "abducted") { onDeath(sim); sfx.bad(); this.player.setPosition(HAB.x, HAB.y + 30); }
      if (e.type === "steal") { toast(sim, e.text, 6); sfx.alert(); }
    }
    const alive = new Set(sim.aliens.map((a) => a.id));
    for (const [id, spr] of this.alienSprites) if (!alive.has(id)) { spr.destroy(); this.alienSprites.delete(id); }
    for (const a of sim.aliens) {
      let spr = this.alienSprites.get(a.id);
      if (!spr) { spr = this.add.image(a.x, a.y, `al_${a.tipo}`).setDepth(a.tipo === "nodriza" ? 25 : 23); this.alienSprites.set(a.id, spr); }
      spr.setPosition(Math.round(a.x), Math.round(a.y + Math.sin(this.time.now / 200 + a.id) * 1.5)).setAlpha(a.stun > 0 ? 0.5 : 1);
    }
    this.beam.clear();
    if (sim.abduction > 0) {
      const ab = sim.aliens.filter((a) => a.tipo === "abductor").sort((p, q) => Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(q.x, q.y, this.player.x, this.player.y))[0];
      if (ab) this.beam.fillStyle(PAL.ok, 0.25 + sim.abduction / 250).fillTriangle(ab.x - 3, ab.y + 2, ab.x + 3, ab.y + 2, this.player.x, this.player.y + 4).fillTriangle(this.player.x - 5, this.player.y + 4, this.player.x + 5, this.player.y + 4, ab.x, ab.y + 2);
    }
  }

  say(s: string) {
    this.prompt.setText(toFont(s)).setVisible(true);
    const w = Math.ceil(this.prompt.width), x = Math.round(this.player.x - w / 2), y = Math.round(this.player.y - 19);
    this.prompt.setPosition(x, y);
    this.promptBg.setPosition(x - 2, y - 2).setSize(w + 3, 9).setVisible(true);
  }

  /** Crisp world label (bitmap font), centred on x. */
  label(x: number, y: number, text: string, color: number, depth = 5.6) {
    return this.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, toFont(text)).setOrigin(0.5, 0).setTint(color).setDepth(depth);
  }

  /** Walk/run cycle, idle breathing and dust puffs while running. */
  animatePlayer(dt: number, moving: boolean, running: boolean) {
    const h = this.player.height;
    if (!moving) {
      this.animT = 0;
      const breathe = Math.floor(this.time.now / 700) % 2;
      this.player.setTexture("astro_idle").setOrigin(0.5, 0.5 + breathe / h);
      return;
    }
    this.animT += dt;
    const { frame, lift } = strideFrame(this.animT, running);
    this.player.setTexture(`astro_${running ? "run" : "walk"}${frame}`).setOrigin(0.5, 0.5 + lift / h);
    if (!running) return;
    this.dustT -= dt;
    if (this.dustT > 0) return;
    this.dustT = 0.12;
    const d = this.add.image(Math.round(this.player.x - this.facing * 3), Math.round(this.player.y + PLAYER_FOOT_Y), "dust").setDepth(this.player.depth - 0.01).setAlpha(0.8);
    this.tweens.add({ targets: d, alpha: 0, scale: 1.8, x: d.x - this.facing * 3, y: d.y - 2, duration: 340, onComplete: () => d.destroy() });
  }
}
