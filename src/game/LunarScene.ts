import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, dropItem, TIPOS, PLACEABLE, leakAllowed, hurt, visitPoi, tendFarm, farmOf, ROBERT_SKINS, robertForageEvery, CROPS, seedToPlant, FARM_WATER_KG, applyBridgeKit, type Leak, toolInfo, meltIce, WATER_TANK_KG, nextLeakDelay, pickUpDrop, toggleSuit, WORLD, ZONAS, zoneAt, zoneBlock, reveal, BRIDGE, buildBridge, canUpgrade, upgradeCost, upgradeModule, lvl, type Zona, type LeakTarget, type Module, type ModType } from "./sim";
import { sfx } from "./audio";
import { stepAliens, hitAlien, type World } from "./aliens";
import { stepCountdown } from "./mission";
import { touch } from "./touch";
import { stepEffects, stepPsychology, effectMods, toggleEquip } from "./effects";
import { stepEvents, stepSpecialCases, resolveSpecialCase, spawnCave, toast, stepAndroids, hitAndroid, stepEmergingProblems } from "./events";
import { initCapsules, nearestCapsule, openCapsule } from "./loot";
import { stepQuests } from "./quests";
import { stepTutorial, tutorialWantsLeak, TUTORIAL } from "./tutorial";
import { ITEMS } from "./items";
import { feetBox, footprint, groundLine, moveWithCollision, overlaps, sortDepth, PLAYER_FOOT_Y, type Box } from "./solids";
import { FONT_KEY, registerPixelFont, toFont } from "./pixelfont";
import { WALK_SPEED, RUN_MULT, RUN_FATIGUE_S, runState, strideFrame } from "./movement";
import { makeSprites, HD } from "./sprites";
import { POIS } from "./world";
import { SUBZONAS, stepHive, hitHive, stepBosses, hitBoss, checkSubzoneVisit } from "./zones";
import { twinkle, bobOffset, beamStrips, ringPhase, edgeMarker } from "./pickups";
import { canMine } from "./tools";
import { view } from "./view";
import { TerrainFx } from "./terrainFx";
import { Phase3Fx } from "./fx3";
import { loadFx } from "./view";
import { createFxTextures, NightLighting, paintRichTerrain, sunShadow, updateSilhouetteShadow } from "./visualFx";
import { PixelfxOverlay } from "./pixelfxBridge";
import { HAB, ROCKET, SHADOW, RAVINE, BRIDGE_DECK } from "./world";

const W = 896, H = 504; // landing site (night aliens, events and capsules stay here)
const WW = WORLD.w, WH = WORLD.h; // whole explorable world (1792x1008)
const isStation = (m: Module) => m.tipo === "taller" || m.tipo === "horno";
/** How far beyond an object's edge E still reaches (world px): practically touching it. */
export const INTERACT_EDGE = 2;
/** Half-size of the astronaut's body (world px): reach is measured from its edge, not its centre. */
const BODY_HW = 3, BODY_HH = 5;
type TargetKind = "leak" | "special" | "cave" | "drop" | "bridge" | "poi" | "capsule" | "rocket" | "melt" | "chest" | "station" | "repair" | "upgrade" | "clean" | "farm" | "robert" | "rover" | "robotlab";
interface Target { kind: TargetKind; x: number; y: number; ref?: unknown; label: string }
type NodeType = "hielo" | "regolito" | "chatarra" | "cristal_hielo" | "titanio" | "aleacion" | "alga_lunar";
const NODE_TEX: Record<NodeType, string> = { hielo: "ice", regolito: "reg", chatarra: "scrap", cristal_hielo: "n_cristal", titanio: "n_titanio", aleacion: "n_aleacion", alga_lunar: "n_aleacion" };
interface RNode { type: NodeType; amount: number; spr: Phaser.GameObjects.Image; zone?: string | undefined }
/** Glow colour under each kind of resource lying on the ground. */
const NODE_GLOW: Record<NodeType, number> = { hielo: PAL.ice, cristal_hielo: PAL.ice, regolito: PAL.moon4, chatarra: PAL.alert, titanio: 0xd8e0ea, aleacion: PAL.ok, alga_lunar: PAL.ok };

/** Static solids that are not modules: the rocket and its two tanks (sprite size + centre). */
const STATIC_SPRITES = [
  { key: "rocket", x: ROCKET.x, y: ROCKET.y - 13, w: 40, h: 78, foot: { x: ROCKET.x - 10, y: ROCKET.y + 6, w: 20, h: 16 } },
  { key: "tank_lh2", x: ROCKET.x - 25, y: ROCKET.y + 5, w: 10, h: 30 },
  { key: "tank_lox", x: ROCKET.x + 25, y: ROCKET.y + 5, w: 10, h: 30 },
] as const;

export class LunarScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  keys!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E" | "SHIFT" | "SPACE" | "X", Phaser.Input.Keyboard.Key>;
  nodes: RNode[] = [];
  leakSprites = new Map<number, Phaser.GameObjects.Image>();
  alienSprites = new Map<number, Phaser.GameObjects.Image>();
  capSprites = new Map<number, Phaser.GameObjects.Image>();
  dropSprites = new Map<number, Phaser.GameObjects.Image>();
  dropLabels = new Map<number, Phaser.GameObjects.BitmapText>();
  dropText0 = new Map<number, string>();
  pickFx!: Phaser.GameObjects.Graphics;
  hiveSprites = new Map<number, Phaser.GameObjects.Image>();
  bossSprites = new Map<string, Phaser.GameObjects.Image>();
  androidSprites = new Map<number, Phaser.GameObjects.Image>();
  bridgeG!: Phaser.GameObjects.Graphics;
  lastZone = "base"; blockT = 0;
  zone!: Phaser.GameObjects.Graphics;
  tint!: Phaser.GameObjects.Rectangle;
  beam!: Phaser.GameObjects.Graphics;
  ring!: Phaser.GameObjects.Graphics;
  nightFx!: NightLighting;
  terrainFx!: TerrainFx;
  fx3!: Phase3Fx;
  pixelfx!: PixelfxOverlay;
  playerShadow!: Phaser.GameObjects.Image;
  staticShadows: { spr: Phaser.GameObjects.Image; baseX: number; baseY: number; w: number; h: number }[] = [];
  vignetteFx?: Phaser.FX.Vignette;
  aimRad = 0; fxT = 0; aimTarget = 0; pointerT = -1e9;
  preview!: Phaser.GameObjects.Graphics;
  modSprites = new Map<number, { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; warn: Phaser.GameObjects.BitmapText; up: Phaser.GameObjects.BitmapText; glow: Phaser.GameObjects.Image | undefined }>();
  buildValid = false;
  prompt!: Phaser.GameObjects.BitmapText;
  promptBg!: Phaser.GameObjects.Rectangle;
  animT = 0; dustT = 0; winded = false; wantsRun = false;
  faceX = 1; faceY = 0;
  robert!: Phaser.GameObjects.Image;
  robErr: { n: RNode; t: number } | null = null; robForageT = 0;
  touchMode = false;
  pubT = 0; saveT = 0; repairT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    // HD pixel art (sprites.ts): every texture is drawn at HD× and shown at 1/HD scale; the camera zooms HD×.
    makeSprites(this);
    createFxTextures(this);
    registerPixelFont(Phaser, this);
    const lg = this.add.graphics();
    for (let r = 48; r > 0; r -= 4) { lg.fillStyle(0xffffff, 0.08); lg.fillCircle(48, 48, r); }
    lg.generateTexture("glow", 96, 96); lg.destroy();

    // multi-layered rich lunar terrain + outer biomes
    const g = this.add.graphics();
    paintRichTerrain(Phaser, this, g, W, H, SHADOW, PAL, FONT_KEY, toFont);
    this.terrainFx = new TerrainFx(Phaser, this, SHADOW); // Phase 2: animated biome detail
    loadFx();
    this.fx3 = new Phase3Fx(Phaser, this); // Phase 3: vignette, particles, glows, auto quality
    this.fx3.onAutoLow = () => toast(sim, "⚙ Effects set to LOW for smoother play (change it in Pause).", 5);
    this.label(SHADOW.x, SHADOW.y - 3, "SHADOWED CRATER", PAL.moon2, 1);

    // rocket and tanks: separate sprites + 2.5D silhouette cast shadows
    this.staticShadows = [];
    for (const s of STATIC_SPRITES) {
      const sh = this.add.image(s.x, s.y + s.h / 2, s.key).setDepth(5.5);
      this.staticShadows.push({ spr: sh, baseX: s.x, baseY: s.y + s.h / 2, w: s.w + 6, h: 8 });
      this.add.image(s.x, s.y, s.key).setScale(1 / HD).setDepth(sortDepth(groundLine(s.y, s.h), H));
    }
    this.label(ROCKET.x, ROCKET.y + 29, "ROCKET", PAL.moon4);
    this.label(ROCKET.x - 25, ROCKET.y + 23, "LH2", PAL.suitL); this.label(ROCKET.x + 25, ROCKET.y + 23, "LOX", PAL.ice);
    this.label(HAB.x, HAB.y + 17, "HABITAT", PAL.moon4);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(16 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(14 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(18 * k); i++) this.spawnNode("chatarra");
    for (let i = 0; i < 4; i++) { this.spawnNode("chatarra", "ice"); this.spawnNode("chatarra", "fire"); this.spawnNode("chatarra", "hive"); }
    for (let i = 0; i < 12; i++) { this.spawnNode("cristal_hielo"); this.spawnNode("titanio"); }
    for (let i = 0; i < 10; i++) { this.spawnNode("hielo", "ice"); this.spawnNode("aleacion"); this.spawnNode("regolito", "fire"); }
    // Dedicated resource lands ("Tierras de recursos dedicados") & far boss caches
    for (const sz of SUBZONAS) {
      const count = sz.tipo === "jefe" ? 5 : 4;
      for (let i = 0; i < count; i++) {
        const res = sz.recursos[i % sz.recursos.length] as NodeType;
        if (NODE_TEX[res]) this.spawnNodeAt(res, sz.x + Phaser.Math.Between(-sz.radio + 12, sz.radio - 12), sz.y + Phaser.Math.Between(-sz.radio + 12, sz.radio - 12), sz.zona);
      }
    }

    this.preview = this.add.graphics().setDepth(35);
    this.playerShadow = this.add.image(HAB.x, HAB.y + 30 + PLAYER_FOOT_Y, "shadow").setDisplaySize(10, 4).setDepth(5.5);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro_idle0").setScale(1 / HD).setDepth(10);
    // Mini Robert follows you everywhere; click / tap him for help.
    this.robert = this.add.image(HAB.x - 10, HAB.y + 36, "robert").setScale(0.6 / HD).setDepth(10)
      .setInteractive(new Phaser.Geom.Circle(14, 12, 20), Phaser.Geom.Circle.Contains);
    // Mouse click opens Robert's help; on phones/tablets he only answers the E button (no accidental taps).
    this.robert.on("pointerdown", (p: Phaser.Input.Pointer, _x: number, _y: number, ev: { stopPropagation: () => void }) => { if (p.wasTouch || this.touchMode) return; ev.stopPropagation(); this.openRobert(); });
    this.ring = this.add.graphics().setDepth(30);
    this.beam = this.add.graphics().setDepth(22);
    this.zone = this.add.graphics().setDepth(24);
    this.pickFx = this.add.graphics().setDepth(11); // glow, light shafts and pointers for things on the ground
    this.tint = this.add.rectangle(0, 0, 640, 360, PAL.red, 0).setOrigin(0).setScrollFactor(0).setDepth(26);
    this.nightFx = new NightLighting(this);
    this.pixelfx = new PixelfxOverlay(this);
    this.pixelfx.spawn("energyCore", ROCKET.x, ROCKET.y - 6, { loop: true });
    if (this.renderer.type === Phaser.WEBGL && this.cameras.main.postFX) {
      const cm = this.cameras.main.postFX.addColorMatrix();
      cm.saturate(0.28);
      cm.contrast(0.12);
      this.vignetteFx = this.cameras.main.postFX.addVignette(0.5, 0.5, 0.94, 0.14);
    }
    // World text uses the pixel font at HD density (1 font pixel = 1 HD pixel), matching the sprites.
    this.promptBg = this.add.rectangle(0, 0, 4, 5, 0x0b1230, 0.88).setOrigin(0).setDepth(39).setStrokeStyle(0.5, 0x6f86d6, 0.8).setVisible(false);
    this.prompt = this.add.bitmapText(0, 0, FONT_KEY, "").setScale(1 / HD).setTint(PAL.gold).setDepth(40).setVisible(false);

    this.cameras.main.setBounds(0, 0, WW, WH).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true).setZoom(HD * view.zoom);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SHIFT,SPACE,ONE,TWO,THREE,FOUR,FIVE,C,Q,X") as LunarScene["keys"];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const w = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      if (sim.buildMode) { this.place(p.wasTouch ? { x: w.x, y: w.y } : undefined); return; }
      const clickedCave = sim.caves.find((c) => Phaser.Math.Distance.Between(c.x, c.y, w.x, w.y) < 16);
      if (clickedCave && this.pickTarget()?.ref === clickedCave) { // only when you are touching the cave
        sim.activeCaveId = clickedCave.id; sfx.click(); useGame.getState().publish(); useGame.getState().setOverlay("cueva"); return;
      }
      this.useTool();
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { if (!p.wasTouch) { this.touchMode = false; this.pointerT = this.time.now; } });
    this.input.keyboard!.on("keydown-C", () => this.toggleBuild());
    this.input.keyboard!.on("keydown-Q", () => this.cycleBuild());
    this.input.keyboard!.on("keydown-SPACE", () => (sim.buildMode ? this.place() : this.useTool()));
    this.input.keyboard!.on("keydown-E", () => this.interact());
    this.input.keyboard!.on("keydown-V", () => this.suitToggle());
    this.input.keyboard!.on("keydown-X", (e: KeyboardEvent) => this.dropHeld(e.shiftKey)); // X: drop 1 · Shift+X: drop the stack
    const t = (f: () => void) => () => { this.touchMode = true; f(); };
    touch.act = { use: t(() => (sim.buildMode ? this.place() : this.useTool())), interact: t(() => this.interact()), build: t(() => this.toggleBuild()), cycle: t(() => this.cycleBuild()), suit: t(() => this.suitToggle()), drop: t(() => this.dropHeld(false)) };
    this.events.once("shutdown", () => { touch.act = { use: () => {}, interact: () => {}, build: () => {}, cycle: () => {}, suit: () => {}, drop: () => {} }; });
    (["ONE", "TWO", "THREE", "FOUR", "FIVE"] as const).forEach((n, i) => this.input.keyboard!.on(`keydown-${n}`, () => { sim.hotbar = i + 1; sfx.click(); }));
    for (const l of sim.leaks) this.addLeakSprite(l.id, l.x, l.y);
    initCapsules(sim, { w: W, h: H, hab: HAB, rnd: () => Math.random() });
    if (!sim.caves.length) spawnCave(sim, 235, 195);
    this.drawBridge();
    for (const p of POIS) this.add.image(p.x, p.y, `poi_${p.id}`).setDepth(p.y).setScale(1 / HD);
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
    if (type === "alga_lunar") spr.setTint(0x66ff99);
    this.nodes.push({ type, amount: Phaser.Math.Between(2, 4), spr, zone });
  }

  spawnNodeAt(type: NodeType, x: number, y: number, zone?: string) {
    const spr = this.add.image(Phaser.Math.Clamp(x, 12, WW - 12), Phaser.Math.Clamp(y, 12, WH - 12), NODE_TEX[type]).setDepth(4).setScale(1 / HD);
    if (type === "alga_lunar") spr.setTint(0x66ff99);
    this.nodes.push({ type, amount: Phaser.Math.Between(3, 5), spr, zone });
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
    for (const r of RAVINE) g.fillStyle(0x07070c).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(0x2a2a36).fillRect(RAVINE[0].x, RAVINE[0].y - 1, RAVINE[0].w, 1).fillRect(RAVINE[1].x - 1, RAVINE[1].y, 1, RAVINE[1].h);
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
    let best: RNode | null = null, bd = 10; // short reach: stand next to the node
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
  /** Thrown stacks name their contents; the bag you leave when you die is a big "LOST ITEMS" beacon. */
  dropText(d: { items: Record<string, number>; kind?: "thrown" }) {
    if (d.kind !== "thrown") return "LOST ITEMS";
    return Object.entries(d.items).map(([k, n]) => `${n > 1 ? n + " " : ""}${ITEMS[k]?.nombre ?? k}`).join(", ").toUpperCase().slice(0, 28);
  }
  syncDrops() {
    const alive = new Set(sim.drops.map((d) => d.id));
    for (const [id, spr] of this.dropSprites) if (!alive.has(id)) { spr.destroy(); this.dropSprites.delete(id); this.dropLabels.get(id)?.destroy(); this.dropLabels.delete(id); this.dropText0.delete(id); }
    const now = this.time.now;
    for (const d of sim.drops) {
      let spr = this.dropSprites.get(d.id);
      const thrown = d.kind === "thrown", txt = this.dropText(d);
      if (!spr) {
        spr = this.add.image(d.x, d.y, "bag").setDepth(9).setScale(1 / HD); this.dropSprites.set(d.id, spr);
        this.dropLabels.set(d.id, this.label(d.x, d.y + 7, txt, thrown ? PAL.white : PAL.gold, 11)); this.dropText0.set(d.id, txt);
      } else if (this.dropText0.get(d.id) !== txt) { this.dropLabels.get(d.id)?.setText(toFont(txt)); this.dropText0.set(d.id, txt); }
      const only = Object.keys(d.items);
      if (thrown && only.length === 1 && this.textures.exists(`item_${only[0]}`)) spr.setTexture(`item_${only[0]}`);
      else if (thrown) spr.setTexture("bag");
      const sc = thrown ? 0.8 : 1 + Math.sin(now / 260) * 0.05;
      spr.setPosition(d.x, d.y + bobOffset(now, d.id, thrown ? 1 : 1.5, 1 / HD)).setScale(sc / HD);
    }
  }

  /**
   * Extra emphasis for everything lying on the ground, drawn on one overlay that is cleared every frame:
   *  - resources: soft ground glow + a twinkle; the one in reach gets gold brackets and a bouncing arrow
   *  - supply capsules: a tall pulsing light shaft and a bigger twinkle
   *  - the bag of lost items: shaft, expanding rings, arrow, and an edge-of-screen pointer when it is off screen
   */
  emphasizePickups() {
    const g = this.pickFx.clear(), now = this.time.now, v = this.cameras.main.worldView;
    const inView = (x: number, y: number, m = 10) => x > v.x - m && x < v.right + m && y > v.y - m && y < v.bottom + m;
    const q = 1 / HD; // one HD pixel in world units
    const star = (x: number, y: number, arm: number, color: number, a: number) => {
      g.fillStyle(color, a).fillRect(x - arm, y - q / 2, arm * 2, q).fillRect(x - q / 2, y - arm, q, arm * 2);
      g.fillStyle(0xffffff, a).fillRect(x - q / 2, y - q / 2, q, q);
    };
    const arrow = (x: number, y: number, color: number, size: number) => { // downward-pointing marker
      g.fillStyle(0x0b0b14, 0.9).fillTriangle(x - size - q, y - q, x + size + q, y - q, x, y + size + q * 2);
      g.fillStyle(color, 1).fillTriangle(x - size, y, x + size, y, x, y + size);
    };
    // resources on the ground
    const reach = this.nearestNode();
    for (const n of this.nodes) {
      const { x, y } = n.spr;
      if (!inView(x, y)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now / 520 + x);
      g.fillStyle(NODE_GLOW[n.type], 0.1 + 0.08 * pulse).fillEllipse(x, y + 1.5, 10, 4.5); // soft glow on the ground
      const tw = twinkle(now, x * 31 + y);
      if (tw > 0) star(x + 2.5, y - 2.5, 1 + tw * 1.5, NODE_GLOW[n.type], tw);
    }
    const mark = (x: number, y: number) => { // gold corner brackets + a bouncing arrow on whatever you can pick up right now
      const a = 0.65 + 0.35 * Math.sin(now / 180), r = 4.5, L = 2;
      g.fillStyle(PAL.gold, a);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        g.fillRect(x + sx * r - (sx > 0 ? L : 0), y + sy * r - (sy > 0 ? q : 0), L, q);
        g.fillRect(x + sx * r - (sx > 0 ? q : 0), y + sy * r - (sy > 0 ? L : 0), q, L);
      }
      arrow(x, y - 9 + bobOffset(now, 0, 1.5, q), PAL.gold, 2);
    };
    if (reach) mark(reach.spr.x, reach.spr.y);
    // stacks you threw on the ground
    const reachDrop = this.nearestDrop();
    for (const gi of sim.drops) {
      if (gi.kind !== "thrown" || !inView(gi.x, gi.y)) continue;
      g.fillStyle(PAL.gold, 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(now / 480 + gi.id))).fillEllipse(gi.x, gi.y + 3, 11, 4.5);
      const tw = twinkle(now, gi.id * 7 + 3, 2200, 360);
      if (tw > 0) star(gi.x + 3.5, gi.y - 3, 1 + tw * 1.4, 0xffffff, tw);
      if (reachDrop?.id === gi.id) mark(gi.x, gi.y);
    }
    // supply capsules
    for (const c of sim.capsules) {
      if (!inView(c.x, c.y, 24)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now / 340 + c.id);
      for (const s of beamStrips(c.x, c.y - 6, 26, 7, 0.16 + 0.12 * pulse, 4)) g.fillStyle(PAL.gold, s.a).fillRect(s.x, s.y, s.w, s.h);
      for (const s of beamStrips(c.x, c.y - 6, 26, 7, 0.32 + 0.2 * pulse, 1.5)) g.fillStyle(0xffffff, s.a).fillRect(s.x, s.y, s.w, s.h);
      const tw = twinkle(now, c.id * 17 + 5, 2000, 420);
      if (tw > 0) star(c.x + 4, c.y - 8, 1.5 + tw * 2.5, PAL.gold, tw);
    }
    // the bag of lost items
    for (const d of sim.drops) {
      if (d.kind === "thrown") { const l = this.dropLabels.get(d.id); if (l) l.setPosition(Math.round(d.x), Math.round(d.y + 7)); continue; }
      const bx = d.x, by = d.y + 4; // ground contact
      const m = edgeMarker(v, d, 7);
      if (m) { // off screen: pulsing pointer on the edge of the view
        const a = 0.7 + 0.3 * Math.sin(now / 200), ux = Math.cos(m.angle), uy = Math.sin(m.angle), px = -uy, py = ux;
        g.fillStyle(0x0b0b14, 0.9).fillTriangle(m.x + ux * 6, m.y + uy * 6, m.x - ux * 3 + px * 4.5, m.y - uy * 3 + py * 4.5, m.x - ux * 3 - px * 4.5, m.y - uy * 3 - py * 4.5);
        g.fillStyle(PAL.gold, a).fillTriangle(m.x + ux * 5, m.y + uy * 5, m.x - ux * 2 + px * 3.5, m.y - uy * 2 + py * 3.5, m.x - ux * 2 - px * 3.5, m.y - uy * 2 - py * 3.5);
        continue;
      }
      for (let i = 0; i < 2; i++) { // rings spreading out on the ground
        const p = ringPhase(now, i), r = 4 + p * 13;
        g.lineStyle(q, i ? PAL.gold : PAL.red, (1 - p) * 0.85).strokeEllipse(bx, by, r * 2, r);
      }
      g.fillStyle(PAL.red, 0.22).fillEllipse(bx, by, 11, 5); // warm pool under it
      const pulse = 0.5 + 0.5 * Math.sin(now / 240);
      for (const s of beamStrips(bx, by - 4, 36, 9, 0.2 + 0.1 * pulse, 6)) g.fillStyle(PAL.red, s.a).fillRect(s.x, s.y, s.w, s.h);
      for (const s of beamStrips(bx, by - 4, 36, 9, 0.5 + 0.2 * pulse, 2)) g.fillStyle(PAL.gold, s.a).fillRect(s.x, s.y, s.w, s.h);
      arrow(bx, by - 44 + bobOffset(now, d.id, 2, q), PAL.gold, 3);
      const tw = twinkle(now, d.id * 13, 1300, 400);
      if (tw > 0) star(bx + 5, by - 7, 1.5 + tw * 2, PAL.gold, tw);
      const lbl = this.dropLabels.get(d.id); if (lbl) lbl.setPosition(Math.round(bx), Math.round(by + 3));
    }
  }
  /** Where something you throw lands: just in front of the astronaut. */
  dropSpot() { return { x: this.player.x + this.facing * 11, y: this.player.y + 3 }; }
  /** X drops one of the selected hotbar item, Shift+X the whole stack. */
  dropHeld(all: boolean) {
    if (useGame.getState().overlay || sim.dead) return;
    const key = sim.hotbarItems[sim.hotbar - 1];
    if (!key) { toast(sim, "Select an item on the hotbar (1-5) to drop it", 2.5); return; }
    if (key === "agua") { toast(sim, "Water lives in the habitat tank: pour it out from the inventory (TAB)", 3); sfx.bad(); return; }
    const have = (sim.inv as unknown as Record<string, number>)[key] ?? 0;
    const n = dropItem(sim, key, all ? have : 1, this.dropSpot().x, this.dropSpot().y);
    if (n > 0) { sfx.click(); toast(sim, `Dropped ${n} ${ITEMS[key]?.nombre ?? key}`, 2); } else sfx.bad();
    useGame.getState().publish();
  }
  /** A small floating number/word that rises and fades (+2 when a tool gives a bonus, etc.). */
  floatText(x: number, y: number, text: string, color: number) {
    const t = this.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, toFont(text)).setOrigin(0.5, 1).setTint(color).setDepth(45);
    this.tweens.add({ targets: t, y: y - 9, alpha: 0, duration: 800, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
  nearHab() { return Phaser.Math.Distance.Between(HAB.x, HAB.y, this.player.x, this.player.y) < 36; }
  nearModule(pred: (m: Module) => boolean, r = 22) {
    let best: Module | undefined, bd = r;
    for (const m of sim.modules) { if (!pred(m)) continue; const d = Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) - Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  cropGfx = new Map<number, Phaser.GameObjects.Graphics>();
  syncModules(a: number) {
    for (const fx of sim.machineFx.splice(0)) this.floatText(fx.x, fx.y, fx.text, PAL.ok);
    for (const m of sim.modules) if (m.tipo === "hidroponia") {
      let g = this.cropGfx.get(m.uid);
      if (!g) { g = this.add.graphics().setDepth(sortDepth(groundLine(m.y, TIPOS[m.tipo].h), H) + 0.01); this.cropGfx.set(m.uid, g); }
      const f = farmOf(sim, m.uid); g.clear();
      if (CROPS[f.crop]) {
        const ripe = f.growth >= 1, gr = f.growth, sway = Math.sin(this.time.now / 700 + m.uid) * 0.3;
        // Two rows of 4 little plants growing out of the soil furrows.
        for (const row of [0.5, 3]) for (const dx of [-5.5, -2.5, 0.5, 3.5]) {
          const bx = m.x + dx, by = m.y + row, h = 0.5 + gr * (f.crop === "trigo" ? 5 : 3);
          if (gr < 0.12) { g.fillStyle(0x6fbf4a).fillRect(bx, by - 0.5, 1, 0.5); continue; } // sprout
          if (f.crop === "trigo") {
            g.fillStyle(ripe ? 0xc8a040 : 0x7fb84a).fillRect(bx + sway, by - h, 0.5, h);
            if (gr > 0.6) g.fillStyle(ripe ? 0xf2d24f : 0xb8d86a).fillRect(bx - 0.25 + sway, by - h - 1, 1, 1.5); // grain head
          } else if (f.crop === "papa") {
            g.fillStyle(0x3f9a3a).fillRect(bx, by - h, 0.5, h);
            g.fillStyle(ripe ? 0x5fb84a : 0x4fc26a).fillEllipse(bx + 0.25 + sway, by - h, 1 + gr * 1.6, 0.8 + gr);    // leafy bush
            if (ripe) g.fillStyle(0xc08a4a).fillEllipse(bx + 0.5, by + 0.3, 1.2, 0.8);                                   // potato peeking out
          } else {
            g.fillStyle(ripe ? 0x9ff0b4 : 0x4fc26a, 0.95).fillEllipse(bx + 0.25 + sway, by - h / 2, 0.8 + gr, h);          // algae frond
            if (ripe) g.fillStyle(0xd8ffe4, 0.8).fillRect(bx + 0.25, by - h + 0.3, 0.5, 0.5);                             // glow tip
          }
        }
        if (f.water > 0) { g.fillStyle(0x4fc3ff, 0.8).fillRect(m.x - 7, m.y + 2, Math.max(1, Math.round(14 * f.water)), 1); } // water level bar
        else if (!ripe && Math.sin(this.time.now / 200) > 0) { g.fillStyle(0x4fc3ff).fillRect(m.x - 1, m.y - 9, 2, 3); } // blinking drop: needs water
      }
    }
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
      if (m.tipo === "rover" && m.rx !== undefined) { // the rover drives around the map
        const rx = m.rx, ry = m.ry!;
        if (Math.abs(sp.img.x - rx) > 0.05) sp.img.setFlipX(rx < sp.img.x);
        sp.img.setPosition(rx, ry).setDepth(sortDepth(groundLine(ry, TIPOS.rover.h), H)); sp.shadow.setPosition(rx, groundLine(ry, TIPOS.rover.h));
        sp.warn.setPosition(rx - 1, ry - TIPOS.rover.h / 2 - 8); sp.up.setPosition(rx + TIPOS.rover.w / 2 - 3, sp.up.y);
      }
      sp.img.setAlpha(on ? 1 : 0.45);
      // ⬆ appears over modules you can afford to upgrade.
      sp.up.setVisible(canUpgrade(sim, m)).setY(m.y - TIPOS[m.tipo].h / 2 - 10 + Math.sin(this.time.now / 250) * 1.5);
      // Status at a glance: 🔌 no power, 💤 idle; working machines puff a little.
      const st = sim.modStatus[m.uid];
      sp.warn.setText(m.durabilidad < 25 ? "!" : st === "nopower" ? "🔌" : st === "idle" && m.tipo !== "panel" ? "💤" : "");
      sp.warn.setVisible(m.durabilidad < 25 ? Math.sin(this.time.now / 200) > 0 : st === "nopower" || (st === "idle" && m.tipo !== "panel"));
      sp.img.setTint(st === "ok" && TIPOS[m.tipo].energia !== 0 && Math.sin(this.time.now / 300 + m.uid) > 0.85 ? 0xfff3c0 : 0xffffff);
      sp.glow?.setAlpha(on && sim.battery > 0 ? a * 0.3 : 0).setTint(m.tipo === "habitat" ? 0xffc27a : 0xfff0aa); // soft warm halo, the light pools do the rest
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
    const hit = hitAlien(sim, this.player.x, this.player.y, dmg) ?? hitAndroid(sim, this.player.x, this.player.y, dmg) ?? hitHive(sim, this.player.x, this.player.y, dmg) ?? hitBoss(sim, this.player.x, this.player.y, dmg);
    if (hit) {
      this.useCd = 0.4; sfx.click();
      this.pixelfx.spawn("critHit", hit.x, hit.y);
      const spr = this.alienSprites.get(hit.id as number) ?? this.androidSprites.get(hit.id as number) ?? this.hiveSprites.get(hit.id as number) ?? this.bossSprites.get(String(hit.id));
      if (spr) { spr.setTint(PAL.white); this.time.delayedCall(120, () => spr.clearTint()); }
      return;
    }
    const n = this.nearestNode();
    if (!n) return;
    // Tool tiers: some resources can only be mined with a shovel (Better shovel → Titanium shovel).
    const gate = canMine(sim.inv, n.type);
    if (!gate.ok) {
      this.useCd = 0.8; sfx.bad();
      toast(sim, `⛏ ${ITEMS[n.type]?.nombre ?? n.type} needs a ${gate.need}: craft one at the Workshop`, 3.5);
      return;
    }
    const tool = toolInfo(sim);
    this.useCd = tool.cd * effectMods(sim).gather;
    let got = 0;
    for (let i = 0; i < Math.min(tool.yield, n.amount); i++) { if (!addItem(sim, n.type, 1)) break; got++; }
    if (!got) { this.say("INVENTORY FULL: DROP ITEMS OR USE A CHEST"); sfx.bad(); this.useCd = 0.6; return; }
    if (n.type === "hielo") {
      sim.stats.hielo += got;
      if (sim.inv.agua < 5 && sim.stats.hielo <= 3) toast(sim, "🧊 Ice gathered! Take it to the Habitat and press E to melt it into Water.", 5);
    }
    sim.fatigue = Math.min(100, sim.fatigue + 0.6);
    n.amount -= got; sfx.pick();
    this.pixelfx.spawn(n.type === "cristal_hielo" || n.type === "hielo" ? "frostNova" : "collectBurst", n.spr.x, n.spr.y);
    this.floatText(n.spr.x, n.spr.y - 4, `+${got}`, got > 1 ? PAL.gold : PAL.white);
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0 && this.inShadowAt(n.spr.x, n.spr.y) && !sim.scanner && Math.random() < 0.3) { hurt(sim, 12, "was caught in a regolith collapse"); this.cameras.main.shake(200, 0.012); toast(sim, "⚠ The crater wall collapsed! The VIPER scanner would have warned you.", 4); }
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(n.type === "chatarra" ? 25000 : 40000, () => this.spawnNode(n.type, n.zone)); }
  }

  /**
   * The single thing E acts on: the closest object whose edge is within INTERACT_EDGE px of the
   * astronaut, preferring what it faces. One target = one prompt, no overlapping signs.
   */
  pickTarget(): Target | null {
    const px = this.player.x, py = this.player.y;
    let best: Target | null = null, bs = Infinity;
    // half: a radius, or [half-width, half-height] for boxes. Gap = box-to-body distance, so you must touch it.
    const consider = (tg: Target, half: number | [number, number]) => {
      const [hw, hh] = typeof half === "number" ? [half, half] : half;
      const dx = tg.x - px, dy = tg.y - py, d = Math.hypot(dx, dy);
      const edge = Math.hypot(Math.max(0, Math.abs(dx) - hw - BODY_HW), Math.max(0, Math.abs(dy) - hh - BODY_HH));
      if (edge > INTERACT_EDGE) return;
      const facing = d > 1 ? (dx * this.faceX + dy * this.faceY) / d : 1;
      const score = edge + (facing < -0.25 ? 6 : 0) - facing;
      if (score < bs) { bs = score; best = tg; }
    };
    for (const l of sim.leaks) consider({ kind: "leak", x: l.x, y: l.y, ref: l, label: sim.inv.kits > 0 ? `HOLD E: SEAL LEAK (1 KIT · ${sim.inv.kits} LEFT)` : "NEED 1 SEALANT KIT (CRAFT IN TAB: 2 SCRAP + 1 METAL)" }, 4);
    if (sim.specialCase) consider({ kind: "special", x: sim.specialCase.x, y: sim.specialCase.y, label: `E: RESOLVE ${sim.specialCase.title.toUpperCase()}` }, 6);
    for (const c of sim.caves) consider({ kind: "cave", x: c.x, y: c.y, ref: c, label: "E: ENTER METEOR CAVE" }, [7, 5]);
    for (const d of sim.drops) consider({ kind: "drop", x: d.x, y: d.y, ref: d, label: d.kind === "thrown" ? "E: PICK UP " + this.dropText(d) : "E: PICK UP YOUR LOST ITEMS" }, 5);
    if (!sim.bridge) consider({ kind: "bridge", x: BRIDGE.x, y: BRIDGE.y, label: sim.inv.puente_kit > 0 ? "E: USE BRIDGE KIT" : "NEEDS A BRIDGE KIT (WORKSHOP: 4 METAL + 4 REGOLITH)" }, 8);
    for (const p of POIS) if (!sim.pois.includes(p.id)) consider({ kind: "poi", x: p.x, y: p.y, ref: p, label: `E: EXAMINE ${p.nombre.toUpperCase()}` }, 7);
    for (const c of sim.capsules) consider({ kind: "capsule", x: c.x, y: c.y, ref: c, label: "E: OPEN SUPPLY CAPSULE" }, 5);
    consider({ kind: "rocket", x: ROCKET.x, y: ROCKET.y + 2, label: "E: CHECK ROCKET" }, [10, 20]); // body + landing feet
    for (const m of sim.modules) {
      const half: [number, number] = [TIPOS[m.tipo].w / 2, TIPOS[m.tipo].h / 2];
      const name = TIPOS[m.tipo].nombre.toUpperCase();
      if (m.tipo === "habitat") { if (sim.inv.hielo > 0) consider({ kind: "melt", x: m.x, y: m.y, ref: m, label: sim.inv.agua >= WATER_TANK_KG ? "WATER TANK FULL" : "E: MELT ICE INTO WATER" }, half); continue; }
      if (m.tipo === "hidroponia" && m.activo && m.durabilidad > 0) { const f = farmOf(sim, m.uid); const c = CROPS[f.crop]; const seed = seedToPlant(sim, sim.hotbarItems[sim.hotbar - 1]);
        consider({ kind: "farm", x: m.x, y: m.y, ref: m, label: !c ? (seed ? `E: PLANT ${CROPS[seed]!.nombre.toUpperCase()}` : "NEED SEEDS (CAPSULES / CHEST) OR LUNAR ALGAE") : f.growth >= 1 ? `E: HARVEST ${c.nombre.toUpperCase()}` : f.water < 0.5 ? `E: WATER CROP (${FARM_WATER_KG} KG FROM TANK)` : `GROWING ${Math.round(f.growth * 100)}% · WATER ${Math.round(f.water * 100)}%` }, half); continue; }
      if (m.tipo === "rover" && m.durabilidad >= 60) { consider({ kind: "rover", x: m.rx ?? m.x, y: m.ry ?? m.y, ref: m, label: `E: ROVER — MINING ${(ITEMS[m.mat ?? "regolito"]?.nombre ?? "").toUpperCase()} (CHANGE)` }, half); continue; }
      if (m.tipo === "robot_lab" && m.durabilidad >= 60) { consider({ kind: "robotlab", x: m.x, y: m.y, ref: m, label: `E: ROBERT STATION (LV ${sim.robert.level})` }, half); continue; }
      if (m.tipo === "cofre") consider({ kind: "chest", x: m.x, y: m.y, ref: m, label: "E: OPEN STORAGE CHEST" }, half);
      else if (isStation(m) && m.durabilidad > 0) consider({ kind: "station", x: m.x, y: m.y, ref: m, label: m.tipo === "taller" ? "E: OPEN WORKSHOP" : "E: OPEN FURNACE" }, half);
      else if (m.durabilidad < 60) consider({ kind: "repair", x: m.x, y: m.y, ref: m, label: `HOLD E: REPAIR ${name} (1 KIT)` }, half);
      else if (canUpgrade(sim, m)) consider({ kind: "upgrade", x: m.x, y: m.y, ref: m, label: `E: UPGRADE ${name} → LV${lvl(m) + 1}` }, half);
      else if (m.tipo === "panel" && !sim.eds && sim.dust > 0.15) consider({ kind: "clean", x: m.x, y: m.y, ref: m, label: `E: CLEAN DUST OFF PANELS (−${Math.round(sim.dust * 50)}% POWER)` }, half);
    }
    // Mini Robert always rolls next to you, so he only answers E when nothing else is in reach.
    if (!best && this.robert && Phaser.Math.Distance.Between(this.robert.x, this.robert.y, px, py) < 14) best = { kind: "robert", x: this.robert.x, y: this.robert.y, label: "E: ASK MINI ROBERT FOR HELP" };
    return best;
  }

  /** Robert Station skills that act in the world: Forager errands and the Magnet. (Med-bot lives in the sim.) */
  stepRobertSkills(dt: number) {
    const rob = sim.robert, rb = this.robert, p = this.player;
    if (rob.skills.includes("magnet")) {
      for (const d of [...sim.drops]) if (Phaser.Math.Distance.Between(d.x, d.y, p.x, p.y) < 30 && pickUpDrop(sim, d.id)) { this.floatText(d.x, d.y - 4, "🧲", PAL.ok); sfx.pick(); }
    }
    if (!rob.skills.includes("forager")) { this.robErr = null; return; }
    if (this.robErr) {
      const n = this.robErr.n;
      if (!this.nodes.includes(n) || n.amount <= 0) { this.robErr = null; return; }
      if (Phaser.Math.Distance.Between(rb.x, rb.y, n.spr.x, n.spr.y + 4) < 4) {
        this.robErr.t += dt;
        if (this.robErr.t > 0.8) {
          const ok = addItem(sim, n.type, 1);
          this.floatText(rb.x, rb.y - 6, ok ? `+1 ${ITEMS[n.type]?.nombre ?? n.type}` : "FULL", ok ? PAL.gold : PAL.alert);
          if (ok) { n.amount -= 1; sfx.pick(); this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 }); }
          if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type, n.zone)); }
          this.robErr = null;
        }
      }
      return;
    }
    this.robForageT += dt;
    if (this.robForageT < robertForageEvery(rob.level)) return;
    this.robForageT = 0;
    let best: RNode | null = null, bd = 60 + rob.level * 8;
    for (const n of this.nodes) { if (n.type !== rob.mat || n.amount <= 0) continue; const d = Phaser.Math.Distance.Between(n.spr.x, n.spr.y, p.x, p.y); if (d < bd) { bd = d; best = n; } }
    if (best) this.robErr = { n: best, t: 0 };
  }

  /** Open Mini Robert's help menu (E next to him, or click / tap him). */
  openRobert() { if (useGame.getState().overlay || sim.dead || !sim.robertMet) return; sfx.click(); useGame.getState().setOverlay("robert"); }

  interact() {
    if (useGame.getState().overlay || sim.dead) return;
    const tg = this.pickTarget();
    if (!tg) return;
    const G = useGame.getState();
    switch (tg.kind) {
      case "leak": case "repair": return; // held: handled in update
      case "special": { const title = sim.specialCase!.title; if (resolveSpecialCase(sim)) { sfx.ok(); toast(sim, `⭐ Resolved: ${title}`, 4); } return; }
      case "cave": sim.activeCaveId = (tg.ref as { id: number }).id; sfx.click(); G.publish(); G.setOverlay("cueva"); return;
      case "drop": { const bag = tg.ref as (typeof sim.drops)[number]; const ok = pickUpDrop(sim, bag.id); if (ok) sfx.ok(); else sfx.bad(); toast(sim, ok ? (bag.kind === "thrown" ? "🎒 Picked up" : "🎒 You picked up your lost items") : "Inventory full: some items are still on the ground", 3); G.publish(); return; }
      case "bridge": if (applyBridgeKit(sim)) { sfx.ok(); toast(sim, "🌉 Bridge built! The Alien Hive is open.", 4); this.drawBridge(); } else { sfx.bad(); toast(sim, "Craft a Bridge Kit at the Workshop (4 Metal + 4 Regolith).", 4); } return;
      case "poi": if (visitPoi(sim, tg.ref as (typeof POIS)[number])) sfx.ok(); G.publish(); return;
      case "capsule": { const found = openCapsule(sim, (tg.ref as { id: number }).id, () => Math.random()); toast(sim, `📦 ${found.map((f) => `+${f.n} ${ITEMS[f.item]?.nombre ?? f.item}`).join(" · ") || "Inventory full"}`); sfx.ok(); return; }
      case "rocket": G.setOverlay("cohete"); return;
      case "melt": {
        const w = meltIce(sim);
        if (w > 0) { addLog(sim, `You melted ice: +${w} kg into the habitat water tank (${Math.round(sim.inv.agua)}/${WATER_TANK_KG} kg).`); sfx.ok(); toast(sim, `💧 +${w} kg water (tank ${Math.round(sim.inv.agua)}/${WATER_TANK_KG})`, 3); }
        else { toast(sim, "💧 Water tank full: drink, make medkits, run electrolysis, or pour some out (TAB)", 5); sfx.bad(); }
        return;
      }
      case "chest": sim.chestUid = (tg.ref as Module).uid; sfx.click(); G.publish(); G.setOverlay("cofre"); return;
      case "station": { const st = tg.ref as Module; sim.station = st.tipo as "taller" | "horno"; sim.stationUid = st.uid; sfx.click(); G.publish(); G.setOverlay("estacion"); return; }
      case "upgrade": { const m = tg.ref as Module; upgradeModule(sim, m); sfx.ok(); toast(sim, `⬆ ${TIPOS[m.tipo].nombre} → level ${lvl(m)}`, 3); return; }
      case "robert": this.openRobert(); return;
      case "robotlab": sfx.click(); G.setOverlay("robotlab"); return;
      case "rover": sim.roverUid = (tg.ref as Module).uid; sfx.click(); G.publish(); G.setOverlay("rover"); return;
      case "farm": { const msg = tendFarm(sim, tg.ref as Module, sim.hotbarItems[sim.hotbar - 1]); sfx[/^(🌱 Planted|💧 Watered|✂)/u.test(msg) ? "ok" : "click"](); toast(sim, msg, 3); G.publish(); return; }
      case "clean": sim.dust = 0; sfx.ok(); toast(sim, "🧹 Panels cleaned: full solar power again. An EDS Dust Shield would do this for you.", 4); return;
    }
  }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    const wantZoom = HD * view.zoom; // the player can zoom in or out from the pause menu
    if (Math.abs(this.cameras.main.zoom - wantZoom) > 0.001) this.cameras.main.setZoom(wantZoom);
    const overlay = useGame.getState().overlay;
    if (sim.respawned) { sim.respawned = false; this.player.setPosition(HAB.x, HAB.y + 30); }
    if (overlay || sim.dead || !sim.robertMet) return;
    {
      // Mini Robert trails behind you (opposite your facing), with a little hover bob.
      const rb = this.robert, p = this.player, rob = sim.robert;
      // Looks: skin colour from the Robert Station, a little bigger each level.
      rb.setTint(ROBERT_SKINS[rob.skin]?.tint ?? 0xffffff).setScale((0.6 + 0.05 * (rob.level - 1)) / HD);
      this.stepRobertSkills(dt);
      let tx = p.x - this.faceX * 10 - (this.faceY ? 6 : 0), ty = p.y - this.faceY * 9 + 5;
      if (this.robErr) { tx = this.robErr.n.spr.x; ty = this.robErr.n.spr.y + 4; } // Forager errand
      const d = Phaser.Math.Distance.Between(rb.x, rb.y, tx, ty);
      if (d > 160) rb.setPosition(tx, ty); // after respawn / teleport
      else if (d > 1.5) { const k = Math.min(1, dt * (d > 30 ? 6 : 3.5) * (1 + 0.12 * (rob.level - 1))); rb.x += (tx - rb.x) * k; rb.y += (ty - rb.y) * k; if (Math.abs(tx - rb.x) > 0.5) rb.setFlipX(tx < rb.x); }
      rb.setDepth(rb.y + 6 > p.y ? p.depth + 0.01 : p.depth - 0.01).setY(rb.y + Math.sin(this.time.now / 260) * 0.04);
    }
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
    if (vx || vy) {
      const l = Math.hypot(vx, vy); this.faceX = vx / l; this.faceY = vy / l;
      this.aimTarget = Math.atan2(vy, vx);
    } else if (!this.touchMode && this.time.now - this.pointerT < 2500) { // the mouse aims only if you moved it recently
      const wp = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      if (Math.hypot(wp.x - this.player.x, wp.y - this.player.y) > 4) this.aimTarget = Math.atan2(wp.y - this.player.y, wp.x - this.player.x);
    }
    // Turn the flashlight smoothly instead of snapping.
    this.aimRad += Phaser.Math.Angle.Wrap(this.aimTarget - this.aimRad) * Math.min(1, dt * 10);
    this.useCd = Math.max(0, this.useCd - dt);
    const mouseHeld = this.input.activePointer.isDown && !this.input.activePointer.wasTouch;
    if ((k.SPACE.isDown || touch.useHeld || mouseHeld) && !sim.buildMode) this.useTool();

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    const zone = zoneAt(this.player.x, this.player.y);
    const distFromHab = Phaser.Math.Distance.Between(this.player.x, this.player.y, HAB.x, HAB.y);
    step(sim, dt, { inHabitat: this.nearHab(), inShadow, zoneTemp: zone.temp, distFromHab });
    reveal(sim, this.player.x, this.player.y, sim.perks.includes("vista_lunar") ? 145 : undefined); sim.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    checkSubzoneVisit(sim, this.player.x, this.player.y);
    this.updateHive(dt);
    this.updateBosses(dt);
    this.updateAliens(dt);
    this.updateWorldEvents(dt, inShadow);
    stepPsychology(sim, dt, { player: this.player, inHabitat: this.nearHab(), hab: HAB, rocket: ROCKET, w: WW, h: WH, rnd: () => Math.random() }, () => Math.random());
    stepSpecialCases(sim, dt, () => Math.random());
    this.updateAndroids(dt);
    stepEmergingProblems(sim, dt, () => Math.random());
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
    const target = this.pickTarget();
    const leak = target?.kind === "leak" ? (target.ref as Leak) : undefined;
    // Working stations are repaired from their own panel; everything else (and broken stations) with hold-E.
    const broken = target?.kind === "repair" ? (target.ref as Module) : undefined;
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
      if (sim.inv.kits < 1) { this.say("NEED 1 SEALANT KIT (TAB: 2 SCRAP + 1 METAL)"); }
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

    // prompts: one sign for the one target in reach; otherwise mining or status hints
    const n = this.nearestNode();
    if (target) this.say(target.label);
    else if (n) this.say(canMine(sim.inv, n.type).ok ? `HOLD ACTION: MINE ${(ITEMS[n.type]?.nombre ?? n.type).toUpperCase()}` : `NEEDS A ${canMine(sim.inv, n.type).need!.toUpperCase()} (WORKSHOP)`);
    else if (this.nearHab()) this.say("HABITAT: REFILLING O2");
    else if (this.winded && this.wantsRun) this.say("TOO TIRED TO RUN");
    else { this.prompt.setVisible(false); this.promptBg.setVisible(false); }

    // day/night lighting, dynamic sun shadows, flashlight & WebGL postFX
    const t = sim.time % CYCLE;
    const dark = modeCfg(sim).noche_oscuridad;
    let a = t < DAY_LEN ? 0 : dark;
    if (t > DAY_LEN - 20 && t < DAY_LEN) a = ((t - (DAY_LEN - 20)) / 20) * dark;
    if (t > CYCLE - 20) a = ((CYCLE - t) / 20) * dark;

    const sh = sunShadow(sim.time);
    if (sim.event?.id === "eclipse" && sim.event.phase === "activo") sh.alpha *= 0.15; // no sun, no shadows
    this.playerShadow.setPosition(this.player.x + sh.ox * 0.7, this.player.y + PLAYER_FOOT_Y + sh.oy * 0.5).setDisplaySize(10 * sh.sx, 4 * sh.sy).setAlpha(sh.alpha);
    for (const st of this.staticShadows) updateSilhouetteShadow(st.spr, st.baseX, st.baseY, sh, HD);
    for (const m of sim.modules) {
      const sp = this.modSprites.get(m.uid);
      if (sp) { const mt = TIPOS[m.tipo]; sp.shadow.setPosition(m.x + sh.ox, groundLine(m.y, mt.h) + sh.oy).setDisplaySize((mt.w + 4) * sh.sx, 6 * sh.sy).setAlpha(sh.alpha); }
    }

    const lights: { x: number; y: number; r: number; color?: number; dayAlpha?: number }[] = [
      { x: HAB.x, y: HAB.y, r: sim.battery > 0 ? 95 : 50, color: 0xffb85c, dayAlpha: 0.04 },
      { x: ROCKET.x, y: ROCKET.y, r: 70, color: 0x66d9ff, dayAlpha: 0.04 },
      { x: SHADOW.x, y: SHADOW.y, r: 40, color: 0x4fc2ff, dayAlpha: 0.03 },
    ];
    for (const m of sim.modules) if (m.tipo === "torre_luz" && m.activo && m.durabilidad > 0 && sim.battery > 0) lights.push({ x: m.x, y: m.y, r: 140, color: 0xfff0aa, dayAlpha: 0.12 });
    if (sim.robert.skills.includes("lamp")) lights.push({ x: this.robert.x, y: this.robert.y, r: 40 + sim.robert.level * 10, color: 0xbfe6ff, dayAlpha: 0 }); // Robert's headlamp
    for (const c of sim.capsules) lights.push({ x: c.x, y: c.y, r: 46, color: 0xf2d24f, dayAlpha: 0.14 });
    for (const cv of sim.caves) lights.push({ x: cv.x, y: cv.y, r: 48, color: 0x66e0ff, dayAlpha: 0.12 });
    if (sim.specialCase) lights.push({ x: sim.specialCase.x, y: sim.specialCase.y, r: 62, color: 0xff8844, dayAlpha: 0.15 });

    this.nightFx.update(this, sim, a, inShadow, this.player.x, this.player.y, this.aimRad, lights);
    this.pixelfx.update(this, dt);
    this.terrainFx.update(this.cameras.main);
    this.fx3.update(dt, sim, this.player, this.wantsRun && !this.winded, this.nodes, this.androidSprites.values());
    if (this.vignetteFx) {
      const danger = sim.suitO2 < 20 || sim.effects.length > 0;
      this.vignetteFx.strength = danger ? 0.34 + Math.abs(Math.sin(this.time.now / 400)) * 0.12 : 0.16;
    }

    this.fxT += dt;
    if (this.fxT >= 0.18) {
      this.fxT = 0;
      for (const l of sim.leaks) {
        const spk = this.add.image(l.x + Phaser.Math.Between(-3, 3), l.y, "fx_spark").setTint(Phaser.Math.RND.pick([0xf2d24f, 0xf08a24])).setDepth(37).setScale(1 / HD);
        this.tweens.add({ targets: spk, x: spk.x + Phaser.Math.Between(-6, 6), y: spk.y - Phaser.Math.Between(6, 12), alpha: 0, duration: 360, onComplete: () => spk.destroy() });
      }
      if (this.fx3.high) for (const c of sim.capsules) {
        const gl = this.add.image(c.x + Phaser.Math.Between(-5, 5), c.y - 2, "fx_spark").setTint(0xf2d24f).setDepth(12).setScale(1 / HD);
        this.tweens.add({ targets: gl, y: gl.y - 8, alpha: 0, duration: 480, onComplete: () => gl.destroy() });
      }
    }

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
    this.emphasizePickups();

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
      this.pixelfx.spawn("bigExplosion", p.x, p.y);
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
    if (color !== null) this.tint.setFillStyle(color, 0.03 + Math.abs(Math.sin(this.time.now / 600)) * 0.03); // the coloured vignette does the heavy lifting
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
    let why = zoneBlock(sim, z);
    if (why && z.req?.equip && ((sim.inv as unknown as Record<string, number>)[z.req.equip] ?? 0) >= 1) {
      if (toggleEquip(sim, z.req.equip) === "Equipped") {
        toast(sim, `🧥 Auto-equipped ${ITEMS[z.req.equip]?.nombre ?? z.req.equip}!`, 3);
        why = zoneBlock(sim, z);
      }
    }
    if (why) {
      this.player.setPosition(ox, oy);
      if (this.blockT <= 0) { toast(sim, `⛔ ${why}`, 4); sfx.bad(); this.blockT = 2.5; }
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

  updateBosses(dt: number) {
    stepBosses(sim, dt, { x: this.player.x, y: this.player.y });
    const alive = new Set(sim.bosses.map((b) => b.id));
    for (const [id, spr] of this.bossSprites) if (!alive.has(id)) { spr.destroy(); this.bossSprites.delete(id); }
    for (const b of sim.bosses) {
      let spr = this.bossSprites.get(b.id);
      const tint = b.tipo === "espectro_crio" ? 0x7fd4ff : b.tipo === "coloso_termico" ? 0xff944d : 0xd966ff;
      if (!spr) { spr = this.add.image(b.x, b.y, "al_nodriza").setDepth(10).setScale(1.7 / HD).setTint(tint); this.bossSprites.set(b.id, spr); }
      spr.setPosition(Math.round(b.x), Math.round(b.y)).setAlpha(b.stun > 0 ? 0.5 : 1);
    }
    if (sim.specialCase) {
      this.zone.lineStyle(2, PAL.gold, 0.85).strokeCircle(sim.specialCase.x, sim.specialCase.y, 12 + Math.sin(this.time.now / 220) * 3);
    }
    for (const c of sim.caves) {
      this.zone.fillStyle(0x06040a, 0.92).fillCircle(c.x, c.y, 8);
      this.zone.lineStyle(1.5, c.explored ? 0x6b7280 : 0xb388ff, 0.9).strokeCircle(c.x, c.y, 8);
    }
  }

  drawBridge() {
    this.bridgeG ??= this.add.graphics().setDepth(4);
    this.bridgeG.clear();
    if (!sim.bridge) return;
    const { x, y, w, h } = BRIDGE_DECK;
    this.bridgeG.fillStyle(0x14141c).fillRect(x - 1, y, w + 2, h);
    this.bridgeG.fillStyle(0x9a9aa3).fillRect(x, y + 1, w, h - 2);
    for (let i = 0; i < 6; i++) this.bridgeG.fillStyle(0x6b6b75).fillRect(x, y + 2 + i * 3, w, 0.5);
    this.bridgeG.fillStyle(0xf2d24f).fillRect(x, y + 1, 1, h - 2).fillRect(x + w - 1, y + 1, 1, h - 2);
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

  updateAndroids(dt: number) {
    stepAndroids(sim, dt, this.world());
    const alive = new Set(sim.androids.map((a) => a.id));
    for (const [id, spr] of this.androidSprites) if (!alive.has(id)) { spr.destroy(); this.androidSprites.delete(id); }
    for (const a of sim.androids) {
      let spr = this.androidSprites.get(a.id);
      if (!spr) { spr = this.add.image(a.x, a.y, "al_saboteador").setTint(0x66e0ff).setDepth(23).setScale(1 / HD); this.androidSprites.set(a.id, spr); }
      spr.setPosition(Math.round(a.x), Math.round(a.y + Math.sin(this.time.now / 140 + a.id) * 1));
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
