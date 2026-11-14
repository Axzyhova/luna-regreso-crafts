import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, TIPOS, PLACEABLE, BAL, leakAllowed, nextLeakDelay, pickUpDrop, toggleSuit, WORLD, ZONAS, zoneAt, zoneBlock, reveal, BRIDGE, buildBridge, canUpgrade, upgradeCost, upgradeModule, lvl, type Zona, type LeakTarget, type Module, type ModType } from "./sim";
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
import { makeSprites, HD } from "./sprites";
import { stepHive, hitHive } from "./zones";

const W = 640, H = 360; // landing site (night aliens, events and capsules stay here)
const WW = WORLD.w, WH = WORLD.h; // whole explorable world
const isStation = (m: Module) => m.tipo === "taller" || m.tipo === "horno";
const HAB = { x: 110, y: 170 } /* matches habitat in modulos.json */, ROCKET = { x: 540, y: 150 };
const SHADOW = { x: 330, y: 270, rx: 120, ry: 60 };
type NodeType = "hielo" | "regolito" | "chatarra" | "cristal_hielo" | "titanio" | "aleacion";
const NODE_TEX: Record<NodeType, string> = { hielo: "ice", regolito: "reg", chatarra: "scrap", cristal_hielo: "n_cristal", titanio: "n_titanio", aleacion: "n_aleacion" };
interface RNode { type: NodeType; amount: number; spr: Phaser.GameObjects.Image; zone?: string }

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
  dropSprites = new Map<number, Phaser.GameObjects.Image>();
  hiveSprites = new Map<number, Phaser.GameObjects.Image>();
  bridgeG!: Phaser.GameObjects.Graphics;
  lastZone = "base"; blockT = 0;
  zone!: Phaser.GameObjects.Graphics;
  tint!: Phaser.GameObjects.Rectangle;
  beam!: Phaser.GameObjects.Graphics;
  ring!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  preview!: Phaser.GameObjects.Graphics;
  modSprites = new Map<number, { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; warn: Phaser.GameObjects.BitmapText; up: Phaser.GameObjects.BitmapText; glow: Phaser.GameObjects.Image | undefined }>();
  buildValid = false;
  prompt!: Phaser.GameObjects.BitmapText;
  promptBg!: Phaser.GameObjects.Rectangle;
  animT = 0; dustT = 0; winded = false; wantsRun = false;
  touchMode = false;
  pubT = 0; saveT = 0; repairT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    // HD pixel art (sprites.ts): every texture is drawn at HD× and shown at 1/HD scale; the camera zooms HD×.
    makeSprites(this);
    registerPixelFont(Phaser, this);
    const lg = this.add.graphics();
    for (let r = 48; r > 0; r -= 4) { lg.fillStyle(0xffffff, 0.08); lg.fillCircle(48, 48, r); }
    lg.generateTexture("glow", 96, 96); lg.destroy();

    // terrain: fine grain, pebbles with a lit top, craters with lit rims and inner shadow
    const g = this.add.graphics();
    g.fillStyle(T.moon1).fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { g.fillStyle(Phaser.Math.RND.pick([T.moon0, T.moon2, 0x55555f, 0x3a3a44])); g.fillRect(Phaser.Math.Between(0, W * 2) / 2, Phaser.Math.Between(0, H * 2) / 2, Phaser.Math.RND.pick([0.5, 1, 1.5]), 0.5); }
    for (let i = 0; i < 70; i++) {
      const x = Phaser.Math.Between(4, W - 4), y = Phaser.Math.Between(4, H - 4), s = Phaser.Math.RND.pick([1, 1.5, 2]);
      g.fillStyle(0x14141c).fillEllipse(x, y + 0.5, s * 2 + 1, s + 1); g.fillStyle(T.moon2).fillEllipse(x, y, s * 2, s); g.fillStyle(T.moon3).fillRect(x - s / 2, y - s / 2, s / 2, 0.5);
    }
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(20, W - 20), y = Phaser.Math.Between(20, H - 20), r = Phaser.Math.Between(6, 16);
      g.fillStyle(T.moon0).fillEllipse(x, y, r * 2, r * 1.4); g.fillStyle(T.moon2).fillEllipse(x + 1, y - 1, r * 1.6, r);
      g.fillStyle(T.moon1).fillEllipse(x + 2, y, r * 1.5, r * 0.9);
      g.fillStyle(T.moon3, 0.6).fillEllipse(x - r * 0.35, y - r * 0.45, r * 0.9, 0.8); // lit rim
      g.fillStyle(0x2a2a36, 0.7).fillEllipse(x + 1.5, y + r * 0.2, r * 1.1, r * 0.35); // inner shadow
    }
    g.fillStyle(T.moon0).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2 + 16, SHADOW.ry * 2 + 10);
    g.fillStyle(T.space).fillEllipse(SHADOW.x, SHADOW.y, SHADOW.rx * 2, SHADOW.ry * 2);
    g.fillStyle(0x0b0b18).fillEllipse(SHADOW.x + 6, SHADOW.y + 4, SHADOW.rx * 1.6, SHADOW.ry * 1.5);
    g.lineStyle(1, T.moon3, 0.5).strokeEllipse(SHADOW.x, SHADOW.y - 1, SHADOW.rx * 2 + 14, SHADOW.ry * 2 + 8);
    this.drawZones(g);
    this.label(SHADOW.x, SHADOW.y - 3, "SHADOWED CRATER", PAL.moon2, 1);

    // rocket and tanks: separate sprites so the astronaut can walk behind them (depth sorted by their base)
    for (const s of STATIC_SPRITES) {
      this.add.image(s.x, s.y + s.h / 2, "shadow").setDisplaySize(s.w + 6, 8).setDepth(5.5);
      this.add.image(s.x, s.y, s.key).setScale(1 / HD).setDepth(sortDepth(groundLine(s.y, s.h), H));
    }
    this.label(ROCKET.x, ROCKET.y + 29, "ROCKET", PAL.moon4);
    this.label(ROCKET.x - 25, ROCKET.y + 23, "LH2", PAL.suitL); this.label(ROCKET.x + 25, ROCKET.y + 23, "LOX", PAL.ice);
    this.label(HAB.x, HAB.y + 17, "HABITAT", PAL.moon4);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(12 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(10 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(8 * k); i++) this.spawnNode("chatarra");
    for (let i = 0; i < 10; i++) { this.spawnNode("cristal_hielo"); this.spawnNode("titanio"); }
    for (let i = 0; i < 8; i++) { this.spawnNode("hielo", "ice"); this.spawnNode("aleacion"); this.spawnNode("regolito", "fire"); }

    this.preview = this.add.graphics().setDepth(35);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro_idle0").setScale(1 / HD).setDepth(10);
    this.ring = this.add.graphics().setDepth(30);
    this.beam = this.add.graphics().setDepth(22);
    this.zone = this.add.graphics().setDepth(24);
    this.tint = this.add.rectangle(0, 0, W, H, PAL.red, 0).setOrigin(0).setScrollFactor(0).setDepth(26);
    this.night = this.add.rectangle(0, 0, W, H, PAL.black, 0).setOrigin(0).setScrollFactor(0).setDepth(20);
    // World text uses the pixel font at HD density (1 font pixel = 1 HD pixel), matching the sprites.
    this.promptBg = this.add.rectangle(0, 0, 4, 5, 0x0b1230, 0.88).setOrigin(0).setDepth(39).setStrokeStyle(0.5, 0x6f86d6, 0.8).setVisible(false);
    this.prompt = this.add.bitmapText(0, 0, FONT_KEY, "").setScale(1 / HD).setTint(PAL.gold).setDepth(40).setVisible(false);

    this.cameras.main.setBounds(0, 0, WW, WH).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true).setZoom(HD);
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
    this.input.keyboard!.on("keydown-V", () => this.suitToggle());
    const t = (f: () => void) => () => { this.touchMode = true; f(); };
    touch.act = { use: t(() => (sim.buildMode ? this.place() : this.useTool())), interact: t(() => this.interact()), build: t(() => this.toggleBuild()), cycle: t(() => this.cycleBuild()), suit: t(() => this.suitToggle()) };
    this.events.once("shutdown", () => { touch.act = { use: () => {}, interact: () => {}, build: () => {}, cycle: () => {}, suit: () => {} }; });
    (["ONE", "TWO", "THREE", "FOUR", "FIVE"] as const).forEach((n, i) => this.input.keyboard!.on(`keydown-${n}`, () => { sim.hotbar = i + 1; sfx.click(); }));
    for (const l of sim.leaks) this.addLeakSprite(l.id, l.x, l.y);
    initCapsules(sim, { w: W, h: H, hab: HAB, rnd: () => Math.random() });
    this.drawBridge();
    if (!sim.log.length) addLog(sim, "Emergency landing at the lunar south pole. No fuel.");
    this.leakT = 90;
  }

  /** Resource node. Zone resources spawn in their zone; the landing-site ones keep the old rules. */
  spawnNode(type: NodeType, zoneId?: string) {
    let x: number, y: number;
    const zone = zoneId ?? (type === "cristal_hielo" ? "ice" : type === "titanio" ? "fire" : type === "aleacion" ? "hive" : "base");
    if (zone !== "base") {
      const r = ZONAS.find((z) => z.id === zone)!.rect as [number, number, number, number];
      x = Phaser.Math.Between(r[0] + 20, r[0] + r[2] - 20); y = Phaser.Math.Between(r[1] + 20, r[1] + r[3] - 20);
    } else {
      const inShadow = (x: number, y: number) => ((x - SHADOW.x) / SHADOW.rx) ** 2 + ((y - SHADOW.y) / SHADOW.ry) ** 2 < 0.8;
      do {
        x = Phaser.Math.Between(16, W - 16); y = Phaser.Math.Between(16, H - 16);
      } while ((type === "hielo") !== inShadow(x, y) || Phaser.Math.Distance.Between(x, y, HAB.x, HAB.y) < 75 || Phaser.Math.Distance.Between(x, y, ROCKET.x, ROCKET.y) < 45);
    }
    const spr = this.add.image(x, y, NODE_TEX[type]).setDepth(4).setScale(1 / HD);
    this.nodes.push({ type, amount: Phaser.Math.Between(2, 4), spr, zone });
  }

  /** Paint the Frozen Basin, Scorch Fields and Alien Hive around the landing site. */
  drawZones(g: Phaser.GameObjects.Graphics) {
    const R = Phaser.Math.Between;
    for (const z of ZONAS) {
      if (z.id === "base") continue;
      const [x, y, w, h] = z.rect as [number, number, number, number];
      g.fillStyle(Phaser.Display.Color.HexStringToColor(z.suelo).color).fillRect(x, y, w, h);
      for (let i = 0; i < 900; i++) {
        const c = z.id === "ice" ? Phaser.Math.RND.pick([0x4a76a8, 0x9fd0ff, 0x223f66]) : z.id === "fire" ? Phaser.Math.RND.pick([0x5a2a12, 0x9a4a20, 0x3a1a0a]) : Phaser.Math.RND.pick([0x2a1838, 0x553366, 0x1e1028]);
        g.fillStyle(c).fillRect(x + R(0, w * 2) / 2, y + R(0, h * 2) / 2, Phaser.Math.RND.pick([0.5, 1, 1.5]), 0.5);
      }
      if (z.id === "ice") for (let i = 0; i < 26; i++) { // ice spikes and frozen pools
        const px = R(x + 10, x + w - 10), py = R(y + 10, y + h - 10);
        if (i % 3 === 0) { g.fillStyle(0x7fb8e8, 0.6).fillEllipse(px, py, R(20, 50), R(8, 18)); g.lineStyle(0.5, 0xd8f2ff, 0.7).strokeEllipse(px, py, R(20, 50), R(8, 18)); }
        else { g.fillStyle(0x14141c).fillTriangle(px - 4, py + 1, px + 4, py + 1, px, py - 11); g.fillStyle(0xbfe6ff).fillTriangle(px - 3, py, px + 3, py, px, py - 10); g.fillStyle(0xffffff).fillRect(px - 1, py - 7, 0.5, 5); }
      }
      if (z.id === "fire") for (let i = 0; i < 40; i++) { // glowing cracks in scorched rock
        let cx = R(x + 10, x + w - 10), cy = R(y + 10, y + h - 10);
        g.lineStyle(1.5, 0x3a1a0a);
        g.beginPath(); g.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) { cx += R(-10, 10); cy += R(-6, 6); g.lineTo(cx, cy); }
        g.strokePath();
        g.lineStyle(0.5, Phaser.Math.RND.pick([0xf08a24, 0xf2d24f]), 0.9); g.strokePath();
      }
      if (z.id === "hive") for (let i = 0; i < 30; i++) { // alien pods
        const px = R(x + 20, x + w - 20), py = R(y + 20, y + h - 20);
        g.fillStyle(0x14141c).fillEllipse(px, py, 9, 11); g.fillStyle(0x6a3a7a).fillEllipse(px, py, 7, 9); g.fillStyle(0x4fc26a, 0.6).fillEllipse(px - 1, py - 1, 3, 4);
      }
      g.lineStyle(1, 0x000000, 0.35).strokeRect(x, y, w, h);
      this.add.bitmapText(x + 10, y + 8, FONT_KEY, toFont(z.nombre)).setScale(1.5).setTint(z.id === "ice" ? 0xcfe9ff : z.id === "fire" ? 0xffd0a0 : 0xd8b0ff).setDepth(3);
    }
    // Ravine around the Hive (the bridge crosses it at BRIDGE).
    g.fillStyle(0x07070c).fillRect(640, 356, 640, 8).fillRect(636, 360, 8, 360);
    g.fillStyle(0x2a2a36).fillRect(640, 355, 640, 1).fillRect(635, 360, 1, 360);
    this.add.image(BRIDGE.x + 16, BRIDGE.y - 12, "gate").setDepth(5).setScale(1 / HD);
  }

  addLeakSprite(id: number, x: number, y: number) {
    this.leakSprites.set(id, this.add.image(x, y, "leak").setDepth(12).setScale(1 / HD));
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
  suitToggle() {
    if (useGame.getState().overlay || sim.dead) return;
    const msg = toggleSuit(sim, this.nearHab());
    toast(sim, `🧑‍🚀 ${msg}`, 3); sfx.click(); useGame.getState().publish();
  }
  nearestDrop() { return sim.drops.find((d) => Phaser.Math.Distance.Between(d.x, d.y, this.player.x, this.player.y) < 18); }
  syncDrops() {
    const alive = new Set(sim.drops.map((d) => d.id));
    for (const [id, spr] of this.dropSprites) if (!alive.has(id)) { spr.destroy(); this.dropSprites.delete(id); }
    for (const d of sim.drops) if (!this.dropSprites.has(d.id)) this.dropSprites.set(d.id, this.add.image(d.x, d.y, "bag").setDepth(5).setScale(1 / HD));
  }
  nearHab() { return Phaser.Math.Distance.Between(HAB.x, HAB.y, this.player.x, this.player.y) < 36; }
  nearModule(pred: (m: Module) => boolean, r = 22) {
    let best: Module | undefined, bd = r;
    for (const m of sim.modules) { if (!pred(m)) continue; const d = Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) - Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  syncModules(a: number) {
    const alive = new Set(sim.modules.map((m) => m.uid));
    for (const [uid, sp] of this.modSprites) if (!alive.has(uid)) { sp.img.destroy(); sp.shadow.destroy(); sp.warn.destroy(); sp.up.destroy(); sp.glow?.destroy(); this.modSprites.delete(uid); }
    for (const m of sim.modules) {
      let sp = this.modSprites.get(m.uid);
      if (!sp) {
        const t = TIPOS[m.tipo];
        const shadow = this.add.image(m.x, groundLine(m.y, t.h), "shadow").setDisplaySize(t.w + 4, 6).setDepth(5.5);
        const img = this.add.image(m.x, m.y, `m_${m.tipo}`).setScale(1 / HD).setDepth(sortDepth(groundLine(m.y, t.h), H));
        const warn = this.add.bitmapText(m.x - 1, m.y - TIPOS[m.tipo].h / 2 - 8, FONT_KEY, "!").setTint(PAL.alert).setDepth(36);
        const glow = m.tipo === "habitat" || m.tipo === "torre_luz" ? this.add.image(m.x, m.y, "glow").setScale(m.tipo === "habitat" ? 1.6 : 1.3).setDepth(21).setBlendMode(Phaser.BlendModes.ADD) : undefined;
        const up = this.add.bitmapText(m.x + TIPOS[m.tipo].w / 2 - 3, m.y - TIPOS[m.tipo].h / 2 - 9, FONT_KEY, "^").setScale(1.5).setTint(PAL.ok).setDepth(36);
        sp = { img, shadow, warn, up, glow }; this.modSprites.set(m.uid, sp);
      }
      const on = m.activo && m.durabilidad > 0;
      sp.img.setAlpha(on ? 1 : 0.45);
      sp.warn.setVisible(m.durabilidad < 25 && Math.sin(this.time.now / 200) > 0);
      // ⬆ appears over modules you can afford to upgrade.
      sp.up.setVisible(canUpgrade(sim, m)).setY(m.y - TIPOS[m.tipo].h / 2 - 10 + Math.sin(this.time.now / 250) * 1.5);
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
    const dmg = sim.inv.baton > 0 ? 2 : 1;
    const hit = hitAlien(sim, this.player.x, this.player.y, dmg) ?? hitHive(sim, this.player.x, this.player.y, dmg);
    if (hit) {
      this.useCd = 0.4; sfx.click();
      const spr = this.alienSprites.get(hit.id) ?? this.hiveSprites.get(hit.id);
      if (spr) { spr.setTint(PAL.white); this.time.delayedCall(120, () => spr.clearTint()); }
      return;
    }
    const n = this.nearestNode();
    if (!n) return;
    this.useCd = ((sim.inv.pala_titanio ?? 0) > 0 ? 0.2 : (sim.inv.taladro ?? 0) > 0 ? 0.25 : (sim.inv.pala_mejorada ?? 0) > 0 ? 0.35 : 0.5) * effectMods(sim).gather;
    if (!addItem(sim, n.type, 1)) { this.say("INVENTORY FULL"); sfx.bad(); return; }
    if (n.type === "hielo") sim.stats.hielo++;
    sim.fatigue = Math.min(100, sim.fatigue + 0.6);
    n.amount -= 1; sfx.pick();
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type, n.zone)); }
  }

  interact() {
    if (useGame.getState().overlay || sim.dead) return;
    if (this.nearestLeak()) return; // hold handled in update
    if (!sim.bridge && Phaser.Math.Distance.Between(BRIDGE.x, BRIDGE.y, this.player.x, this.player.y) < 30) {
      if (buildBridge(sim)) { sfx.ok(); toast(sim, "🌉 Bridge built! The Alien Hive is open.", 4); this.drawBridge(); } else { sfx.bad(); toast(sim, "Bridge needs 10 Metal, 6 Regolith and 2 Titanium.", 4); }
      return;
    }
    const upg = this.nearModule((m) => !isStation(m) && canUpgrade(sim, m), 20);
    if (upg && !(upg.tipo === "habitat" && sim.inv.hielo > 0)) { upgradeModule(sim, upg); sfx.ok(); toast(sim, `⬆ ${TIPOS[upg.tipo].nombre} → level ${lvl(upg)}`, 3); return; }
    const bag = this.nearestDrop();
    if (bag) { pickUpDrop(sim, bag.id); sfx.ok(); toast(sim, "🎒 You picked up your lost items", 3); return; }
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
    } else {
      // Crafting stations open their own interface (unless they need a repair: hold E for that).
      const st = this.nearModule((m) => isStation(m) && m.durabilidad > 0, 26);
      if (st) { sim.station = st.tipo as "taller" | "horno"; sim.stationUid = st.uid; sfx.click(); useGame.getState().publish(); useGame.getState().setOverlay("estacion"); }
    }
  }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    const overlay = useGame.getState().overlay;
    if (sim.respawned) { sim.respawned = false; this.player.setPosition(HAB.x, HAB.y + 30); }
    if (overlay || sim.dead) return;
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
    const moved = moveWithCollision(this.player.x, this.player.y, (vx / len) * sp * dt, (vy / len) * sp * dt, this.solids(), { minX: 5, minY: 6, maxX: WW - 5, maxY: WH - 7 });
    this.player.setPosition(moved.x, moved.y);
    this.checkZone(ox, oy, dt); // may push the astronaut back when a zone isn't open yet
    this.player.setDepth(sortDepth(this.player.y + PLAYER_FOOT_Y, H));
    this.animatePlayer(dt, this.player.x !== ox || this.player.y !== oy, rs.running);
    sim.tut.moved += Math.hypot(this.player.x - ox, this.player.y - oy);
    if (vx) { this.facing = Math.sign(vx); this.player.setFlipX(vx < 0); }
    this.useCd = Math.max(0, this.useCd - dt);

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    const zone = zoneAt(this.player.x, this.player.y);
    step(sim, dt, { inHabitat: this.nearHab(), inShadow, zoneTemp: zone.temp });
    reveal(sim, this.player.x, this.player.y); sim.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    this.updateHive(dt);
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
    sim.near.habitat = this.nearHab();
    sim.near.taller = !!this.nearModule((m) => m.tipo === "taller" && m.durabilidad > 0, 26);
    sim.near.horno = !!this.nearModule((m) => m.tipo === "horno" && m.durabilidad > 0, 26);
    const leak = this.nearestLeak();
    // Working stations are repaired from their own panel; everything else (and broken stations) with hold-E.
    const broken = leak ? undefined : this.nearModule((m) => m.durabilidad < 100 && !(isStation(m) && m.durabilidad > 0));
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
    for (const l of sim.leaks) { const s = this.leakSprites.get(l.id); if (s) s.setScale((0.8 + l.size * 0.25) / HD).setAlpha(Math.sin(this.time.now / 120) > 0 ? 1 : 0.4); }

    // prompts
    const n = this.nearestNode();
    if (leak) this.say(`HOLD E: SEAL LEAK (${sim.inv.kits} KITS)`);
    else if (this.nearestDrop()) this.say("E: PICK UP YOUR LOST ITEMS");
    else if (!sim.bridge && Phaser.Math.Distance.Between(BRIDGE.x, BRIDGE.y, this.player.x, this.player.y) < 30) this.say("E: BUILD BRIDGE (10 METAL, 6 REGOLITH, 2 TITANIUM)");
    else if (this.upgradeHint()) this.say(this.upgradeHint()!);
    else if (nearestCapsule(sim, this.player.x, this.player.y)) this.say("E: OPEN SUPPLY CAPSULE");
    else if (n) this.say(`ACTION: PICK UP ${(ITEMS[n.type]?.nombre ?? n.type).toUpperCase()}`);
    else if (broken && broken.durabilidad < 60 && !(this.nearHab() && sim.inv.hielo > 0)) this.say(`HOLD E: REPAIR ${TIPOS[broken.tipo].nombre.toUpperCase()} (1 KIT)`);
    else if (this.nearHab() && sim.inv.hielo > 0) this.say("E: MELT ICE");
    else if (this.nearHab()) this.say("HABITAT: REFILLING O2");
    else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) this.say("E: CHECK ROCKET");
    else if (sim.near.taller) this.say("E: OPEN WORKSHOP");
    else if (sim.near.horno) this.say("E: OPEN FURNACE");
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

    if (sim.health <= 0 && !sim.dead) {
      sim.dead = { cause: sim.lastHurt || "didn't make it", x: this.player.x, y: this.player.y };
      sfx.bad(); saveGame(); useGame.getState().publish(); return;
    }
    this.syncDrops();

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
    for (const c of sim.capsules) if (!this.capSprites.has(c.id)) this.capSprites.set(c.id, this.add.image(c.x, c.y, "capsule").setDepth(5).setScale(1 / HD));
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
    for (const c of sim.hive) r.push({ k: "alien", dx: c.x - px, dy: c.y - py });
    for (const c of sim.capsules) r.push({ k: "capsula", dx: c.x - px, dy: c.y - py });
    for (const d of sim.drops) r.push({ k: "bolsa", dx: d.x - px, dy: d.y - py });
    for (const l of sim.leaks) r.push({ k: "fuga", dx: l.x - px, dy: l.y - py });
    const ice = this.nodes.filter((n) => n.type === "hielo").map((n) => ({ k: "hielo", dx: n.spr.x - px, dy: n.spr.y - py })).sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy)).slice(0, 3);
    r.push(...ice);
    if (sim.event?.id === "meteoritos") r.push({ k: "meteoritos", dx: sim.event.x - px, dy: sim.event.y - py });
    r.push({ k: "base", dx: HAB.x - px, dy: HAB.y - py }, { k: "cohete", dx: ROCKET.x - px, dy: ROCKET.y - py });
    sim.radar = r.map((x) => ({ k: x.k, dx: Math.round(x.dx), dy: Math.round(x.dy) }));
  }

  /** Block entry to zones you're not ready for, and announce new zones. */
  checkZone(ox: number, oy: number, dt: number) {
    this.blockT = Math.max(0, this.blockT - dt);
    const z: Zona = zoneAt(this.player.x, this.player.y);
    const why = zoneBlock(sim, z);
    if (why) {
      this.player.setPosition(ox, oy);
      if (this.blockT <= 0) { toast(sim, `⛔ ${why}`, 3); sfx.bad(); this.blockT = 2.5; }
      return;
    }
    if (z.id !== this.lastZone) {
      this.lastZone = z.id;
      if (!sim.visited.includes(z.id)) { sim.visited.push(z.id); addLog(sim, `You discovered: ${z.nombre}.`); }
      toast(sim, `📍 ${z.nombre}`, 3);
    }
  }

  updateHive(dt: number) {
    stepHive(sim, dt, { x: this.player.x, y: this.player.y }, () => Math.random());
    const alive = new Set(sim.hive.map((c) => c.id));
    for (const [id, spr] of this.hiveSprites) if (!alive.has(id)) { spr.destroy(); this.hiveSprites.delete(id); }
    for (const c of sim.hive) {
      let spr = this.hiveSprites.get(c.id);
      if (!spr) { spr = this.add.image(c.x, c.y, "al_rastreador").setDepth(9).setScale(1.3 / HD).setTint(0xff9a9a); this.hiveSprites.set(c.id, spr); }
      spr.setPosition(Math.round(c.x), Math.round(c.y)).setAlpha(c.stun > 0 ? 0.5 : 1);
    }
  }

  drawBridge() {
    this.bridgeG ??= this.add.graphics().setDepth(4);
    this.bridgeG.clear();
    if (!sim.bridge) return;
    const x = BRIDGE.x - 12;
    this.bridgeG.fillStyle(0x14141c).fillRect(x - 1, 346, 26, 20);
    this.bridgeG.fillStyle(0x9a9aa3).fillRect(x, 347, 24, 18);
    for (let i = 0; i < 6; i++) this.bridgeG.fillStyle(0x6b6b75).fillRect(x, 348 + i * 3, 24, 0.5);
    this.bridgeG.fillStyle(0xf2d24f).fillRect(x, 347, 1, 18).fillRect(x + 23, 347, 1, 18);
  }

  upgradeHint(): string | null {
    const m = this.nearModule((mm) => !isStation(mm) && canUpgrade(sim, mm), 20);
    if (!m) return null;
    const c = upgradeCost(m)!;
    return `E: UPGRADE ${TIPOS[m.tipo].nombre.toUpperCase()} → LV${lvl(m) + 1} (${Object.entries(c).map(([k, v]) => `${v} ${(ITEMS[k]?.nombre ?? k).toUpperCase()}`).join(", ")})`;
  }

  updateAliens(dt: number) {
    const world = this.world();
    for (const e of stepAliens(sim, dt, world)) {
      if (e.type === "leak") this.spawnLeak(e.target);
      if (e.type === "abducted") { sim.lastHurt = "was abducted by aliens"; sim.health = 0; }
      if (e.type === "steal") { toast(sim, e.text, 6); sfx.alert(); }
    }
    const alive = new Set(sim.aliens.map((a) => a.id));
    for (const [id, spr] of this.alienSprites) if (!alive.has(id)) { spr.destroy(); this.alienSprites.delete(id); }
    for (const a of sim.aliens) {
      let spr = this.alienSprites.get(a.id);
      if (!spr) { spr = this.add.image(a.x, a.y, `al_${a.tipo}`).setDepth(a.tipo === "nodriza" ? 25 : 23).setScale(1 / HD); this.alienSprites.set(a.id, spr); }
      spr.setPosition(Math.round(a.x), Math.round(a.y + Math.sin(this.time.now / 200 + a.id) * 1.5)).setAlpha(a.stun > 0 ? 0.5 : 1);
    }
    this.beam.clear();
    if (sim.abduction > 0) {
      const ab = sim.aliens.filter((a) => a.tipo === "abductor").sort((p, q) => Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(q.x, q.y, this.player.x, this.player.y))[0];
      if (ab) this.beam.fillStyle(PAL.ok, 0.25 + sim.abduction / 250).fillTriangle(ab.x - 3, ab.y + 2, ab.x + 3, ab.y + 2, this.player.x, this.player.y + 4).fillTriangle(this.player.x - 5, this.player.y + 4, this.player.x + 5, this.player.y + 4, ab.x, ab.y + 2);
    }
  }

  /** Hint above the astronaut (crisp bitmap font on a dark plate), kept inside the visible part of the map. */
  say(s: string) {
    this.prompt.setText(toFont(s)).setVisible(true);
    // Snap to the HD pixel grid (0.5 world px) so every glyph pixel lands on a whole screen pixel.
    const snap = (n: number) => Math.round(n * HD) / HD;
    const v = this.cameras.main.worldView, w = this.prompt.getTextBounds().global.width;
    const x = snap(Phaser.Math.Clamp(this.player.x - w / 2, v.x + 2, Math.max(v.x + 2, v.right - w - 2)));
    const y = snap(Math.max(v.y + 2, this.player.y - 12));
    this.prompt.setPosition(x, y);
    this.promptBg.setPosition(x - 1.5, y - 1).setSize(w + 2.5, 4.5).setVisible(true);
  }

  /** Crisp world label (bitmap font at HD density), centred on x. */
  label(x: number, y: number, text: string, color: number, depth = 5.6) {
    return this.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, toFont(text)).setScale(1 / HD).setOrigin(0.5, 0).setTint(color).setDepth(depth);
  }

  /** Walk/run cycle, idle breathing and dust puffs while running. */
  animatePlayer(dt: number, moving: boolean, running: boolean) {
    // Two skins with identical animation sets: with the space suit ("astro_…") and without it ("plain_…").
    const skin = sim.suit.owned && sim.suit.worn ? "astro" : "plain";
    if (!moving) {
      this.animT = 0;
      this.player.setTexture(`${skin}_idle${Math.floor(this.time.now / 650) % 2}`);
      return;
    }
    this.animT += dt;
    this.player.setTexture(`${skin}_${running ? "run" : "walk"}${strideFrame(this.animT, running)}`);
    if (!running) return;
    this.dustT -= dt;
    if (this.dustT > 0) return;
    this.dustT = 0.11;
    const d = this.add.image(this.player.x - this.facing * 3, this.player.y + PLAYER_FOOT_Y - 0.5, "dust").setScale(1 / HD).setDepth(this.player.depth - 0.01).setAlpha(0.85);
    this.tweens.add({ targets: d, alpha: 0, scale: 2 / HD, x: d.x - this.facing * 4, y: d.y - 1.5, duration: 380, ease: "Quad.easeOut", onComplete: () => d.destroy() });
  }
}
