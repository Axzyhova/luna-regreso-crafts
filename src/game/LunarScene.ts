import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, TIPOS, PLACEABLE, BAL, leakAllowed, nextLeakDelay, pickUpDrop, toggleSuit, type LeakTarget, type Module, type ModType } from "./sim";
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
import { makeSprites, HD } from "./sprites";

const W = 640, H = 360;
const HAB = { x: 110, y: 170 } /* matches habitat in modulos.json */, ROCKET = { x: 540, y: 150 };
const SHADOW = { x: 330, y: 270, rx: 120, ry: 60 };
type NodeType = "hielo" | "regolito" | "chatarra";
interface RNode { type: NodeType; amount: number; spr: Phaser.GameObjects.Image }

const isStation = (m: Module) => m.tipo === "taller" || m.tipo === "horno";

export class LunarScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  keys!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E", Phaser.Input.Keyboard.Key>;
  nodes: RNode[] = [];
  leakSprites = new Map<number, Phaser.GameObjects.Image>();
  alienSprites = new Map<number, Phaser.GameObjects.Image>();
  capSprites = new Map<number, Phaser.GameObjects.Image>();
  dropSprites = new Map<number, Phaser.GameObjects.Image>();
  zone!: Phaser.GameObjects.Graphics;
  tint!: Phaser.GameObjects.Rectangle;
  beam!: Phaser.GameObjects.Graphics;
  ring!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  preview!: Phaser.GameObjects.Graphics;
  modSprites = new Map<number, { img: Phaser.GameObjects.Image; warn: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Image | undefined }>();
  buildValid = false;
  prompt!: Phaser.GameObjects.Text;
  touchMode = false;
  pubT = 0; saveT = 0; repairT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    makeSprites(this);
    const lg = this.add.graphics();
    for (let r = 48; r > 0; r -= 4) { lg.fillStyle(0xffffff, 0.08); lg.fillCircle(48, 48, r); }
    lg.generateTexture("glow", 96, 96); lg.destroy();

    // terrain
    const g = this.add.graphics();
    g.fillStyle(T.moon1).fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { g.fillStyle(Phaser.Math.RND.pick([T.moon0, T.moon2, 0x55555f, 0x3a3a44])); g.fillRect(Phaser.Math.Between(0, W * 2) / 2, Phaser.Math.Between(0, H * 2) / 2, Phaser.Math.RND.pick([0.5, 1, 1.5]), 0.5); }
    for (let i = 0; i < 70; i++) { // pebbles with a lit top
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
    this.add.text(SHADOW.x - 46, SHADOW.y - 8, "SHADOWED CRATER", { fontFamily: '"Press Start 2P"', resolution: HD * 2, fontSize: "6px", color: "#45454f" });

    // rocket
    g.fillStyle(T.moon4).fillRect(ROCKET.x - 8, ROCKET.y - 36, 16, 56); g.fillStyle(T.white).fillTriangle(ROCKET.x - 8, ROCKET.y - 36, ROCKET.x + 8, ROCKET.y - 36, ROCKET.x, ROCKET.y - 52);
    g.fillStyle(T.suit).fillCircle(ROCKET.x, ROCKET.y - 22, 4); g.fillStyle(T.red).fillTriangle(ROCKET.x - 8, ROCKET.y + 4, ROCKET.x - 8, ROCKET.y + 20, ROCKET.x - 18, ROCKET.y + 22);
    g.fillStyle(T.red).fillTriangle(ROCKET.x + 8, ROCKET.y + 4, ROCKET.x + 8, ROCKET.y + 20, ROCKET.x + 18, ROCKET.y + 22);
    g.fillStyle(T.moon2).fillRect(ROCKET.x - 4, ROCKET.y + 20, 8, 4); g.fillStyle(T.moon0).fillRect(ROCKET.x - 6, ROCKET.y - 6, 12, 3);
    g.fillStyle(T.moon0).fillRect(ROCKET.x + 20, ROCKET.y - 10, 10, 30); g.fillStyle(T.moon0).fillRect(ROCKET.x - 30, ROCKET.y - 10, 10, 30);
    g.lineStyle(1, 0x14141c).strokeRect(ROCKET.x - 8, ROCKET.y - 36, 16, 56);
    g.fillStyle(0xa9a9b3).fillRect(ROCKET.x + 3, ROCKET.y - 36, 5, 56);        // body shading
    g.fillStyle(0xffffff, 0.8).fillRect(ROCKET.x - 7, ROCKET.y - 35, 1.5, 54);  // highlight
    for (const dy of [-28, -12, 8]) g.fillStyle(0x6b6b75).fillRect(ROCKET.x - 8, ROCKET.y + dy, 16, 0.5); // panel lines
    g.lineStyle(1, 0x14141c).strokeCircle(ROCKET.x, ROCKET.y - 22, 4); g.fillStyle(0xbfd8ff).fillRect(ROCKET.x - 2, ROCKET.y - 24, 1.5, 1.5);
    for (const sx of [-30, 20]) { g.lineStyle(1, 0x14141c).strokeRect(ROCKET.x + sx, ROCKET.y - 10, 10, 30); g.fillStyle(0x45454f).fillRect(ROCKET.x + sx + 1, ROCKET.y - 9, 2, 28); g.fillStyle(T.ice, 0.5).fillRect(ROCKET.x + sx + 4, ROCKET.y - 6, 3, 1); }
    const lbl = { fontFamily: '"Press Start 2P"', resolution: HD * 2, fontSize: "5px", color: "#c9c9cf", stroke: "#14141c", strokeThickness: 1 };
    this.add.text(ROCKET.x - 16, ROCKET.y + 28, "ROCKET", lbl);
    this.add.text(ROCKET.x + 18, ROCKET.y + 22, "LOX", lbl); this.add.text(ROCKET.x - 32, ROCKET.y + 22, "LH2", lbl);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(12 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(10 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(8 * k); i++) this.spawnNode("chatarra");

    this.preview = this.add.graphics().setDepth(35);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro").setDepth(10).setScale(1 / HD);
    this.ring = this.add.graphics().setDepth(30);
    this.beam = this.add.graphics().setDepth(22);
    this.zone = this.add.graphics().setDepth(24);
    this.tint = this.add.rectangle(0, 0, W, H, PAL.red, 0).setOrigin(0).setScrollFactor(0).setDepth(26);
    this.night = this.add.rectangle(0, 0, W, H, PAL.black, 0).setOrigin(0).setScrollFactor(0).setDepth(20);
    this.prompt = this.add.text(0, 0, "", { fontFamily: '"Press Start 2P"', resolution: HD * 2, fontSize: "5px", color: "#f2d24f", backgroundColor: "#0b0b14" }).setDepth(40).setPadding(2);

    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true).setZoom(HD);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ONE,TWO,THREE,FOUR,FIVE,C,Q") as LunarScene["keys"];
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
    if (!sim.log.length) addLog(sim, "Emergency landing at the lunar south pole. No fuel.");
    this.leakT = 90;
  }

  spawnNode(type: NodeType) {
    let x: number, y: number;
    const inShadow = (x: number, y: number) => ((x - SHADOW.x) / SHADOW.rx) ** 2 + ((y - SHADOW.y) / SHADOW.ry) ** 2 < 0.8;
    do {
      x = Phaser.Math.Between(16, W - 16); y = Phaser.Math.Between(16, H - 16);
    } while ((type === "hielo") !== inShadow(x, y) || Phaser.Math.Distance.Between(x, y, HAB.x, HAB.y) < 75 || Phaser.Math.Distance.Between(x, y, ROCKET.x, ROCKET.y) < 45);
    const spr = this.add.image(x, y, type === "hielo" ? "ice" : type === "regolito" ? "reg" : "scrap").setDepth(4).setScale(1 / HD);
    this.nodes.push({ type, amount: Phaser.Math.Between(2, 4), spr });
  }

  addLeakSprite(id: number, x: number, y: number) {
    this.leakSprites.set(id, this.add.image(x, y, "leak").setDepth(12).setScale(1 / HD));
  }

  spawnLeak(forced?: LeakTarget) {
    const target: LeakTarget = forced ?? Phaser.Math.RND.pick(["habitat", "habitat", "lh2", "lox"]);
    const base = target === "habitat" ? { x: HAB.x + Phaser.Math.Between(-20, 20), y: HAB.y - 10 } : target === "lh2" ? { x: ROCKET.x - 25, y: ROCKET.y } : { x: ROCKET.x + 25, y: ROCKET.y };
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
    for (const [uid, sp] of this.modSprites) if (!alive.has(uid)) { sp.img.destroy(); sp.warn.destroy(); sp.glow?.destroy(); this.modSprites.delete(uid); }
    for (const m of sim.modules) {
      let sp = this.modSprites.get(m.uid);
      if (!sp) {
        const img = this.add.image(m.x, m.y, `m_${m.tipo}`).setDepth(6).setScale(1 / HD);
        const warn = this.add.text(m.x - 3, m.y - TIPOS[m.tipo].h / 2 - 9, "!", { fontFamily: '"Press Start 2P"', resolution: HD * 2, fontSize: "6px", color: "#f08a24" }).setDepth(36);
        const glow = m.tipo === "habitat" || m.tipo === "torre_luz" ? this.add.image(m.x, m.y, "glow").setScale(m.tipo === "habitat" ? 1.6 : 1.3).setDepth(21).setBlendMode(Phaser.BlendModes.ADD) : undefined;
        sp = { img, warn, glow }; this.modSprites.set(m.uid, sp);
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
    if (useGame.getState().overlay || sim.dead) return;
    if (this.nearestLeak()) return; // hold handled in update
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
    const sp = 60 * effectMods(sim).speed;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
    let len = Math.hypot(vx, vy) || 1;
    if (!vx && !vy && (touch.vx || touch.vy)) { vx = touch.vx; vy = touch.vy; len = 1; } // analog joystick
    const ox = this.player.x, oy = this.player.y;
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * sp * dt, 4, W - 4);
    this.player.y = Phaser.Math.Clamp(this.player.y + (vy / len) * sp * dt, 4, H - 4);
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
    else if (nearestCapsule(sim, this.player.x, this.player.y)) this.say("E: OPEN SUPPLY CAPSULE");
    else if (n) this.say(`ACTION: PICK UP ${(ITEMS[n.type]?.nombre ?? n.type).toUpperCase()}`);
    else if (broken && broken.durabilidad < 60 && !(this.nearHab() && sim.inv.hielo > 0)) this.say(`HOLD E: REPAIR ${TIPOS[broken.tipo].nombre.toUpperCase()} (1 KIT)`);
    else if (this.nearHab() && sim.inv.hielo > 0) this.say("E: MELT ICE");
    else if (this.nearHab()) this.say("HABITAT: REFILLING O2");
    else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) this.say("E: CHECK ROCKET");
    else if (sim.near.taller) this.say("E: OPEN WORKSHOP");
    else if (sim.near.horno) this.say("E: OPEN FURNACE");
    else this.prompt.setVisible(false);

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
    // Skin: helmet and suit only while wearing it.
    this.player.setTexture(sim.suit.owned && sim.suit.worn ? "astro" : "astro_plain");
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
    for (const c of sim.capsules) r.push({ k: "capsula", dx: c.x - px, dy: c.y - py });
    for (const d of sim.drops) r.push({ k: "bolsa", dx: d.x - px, dy: d.y - py });
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

  /** Hint above the astronaut, kept inside the visible part of the map. */
  say(s: string) {
    this.prompt.setText(s).setVisible(true);
    const v = this.cameras.main.worldView, pw = this.prompt.displayWidth;
    const x = Phaser.Math.Clamp(this.player.x - pw / 2, v.x + 2, Math.max(v.x + 2, v.right - pw - 2));
    this.prompt.setPosition(Math.round(x), Math.round(Math.max(v.y + 2, this.player.y - 18)));
  }
}
