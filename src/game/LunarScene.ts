import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, TIPOS, PLACEABLE, BAL, type LeakTarget, type Module, type ModType } from "./sim";
import { sfx } from "./audio";
import { stepAliens, hitAlien, type World } from "./aliens";
import { stepCountdown } from "./mission";
import { touch } from "./touch";

const W = 640, H = 360;
const HAB = { x: 110, y: 170 } /* matches habitat in modulos.json */, ROCKET = { x: 540, y: 150 };
const SHADOW = { x: 330, y: 270, rx: 120, ry: 60 };
type NodeType = "hielo" | "regolito" | "chatarra";
interface RNode { type: NodeType; amount: number; spr: Phaser.GameObjects.Image }

function px(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, number>) {
  const g = scene.add.graphics();
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (colors[c] !== undefined) { g.fillStyle(colors[c]); g.fillRect(x, y, 1, 1); } }));
  g.generateTexture(key, rows[0]!.length, rows.length); g.destroy();
}

export class LunarScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  keys!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E", Phaser.Input.Keyboard.Key>;
  nodes: RNode[] = [];
  leakSprites = new Map<number, Phaser.GameObjects.Image>();
  alienSprites = new Map<number, Phaser.GameObjects.Image>();
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
    px(this, "astro", ["..www...", ".wbbbw..", ".wbccbw.", ".wbbbw..", "wwwwwwo.", "w.www.w.", "..w.w...", "..w.w..."], { w: T.white, b: T.suit, c: T.suitL, o: T.alert });
    px(this, "ice", [".cc.", "cwcc", "cccw", ".cc."], { c: T.ice, w: T.white });
    px(this, "reg", [".mm.", "mlmm", "mmlm", ".mm."], { m: T.moon2, l: T.moon3 });
    px(this, "scrap", ["o.gg", ".gog", "gg.o", "g.g."], { o: T.alert, g: T.moon4 });
    px(this, "al_abductor", ["..vvvv..", ".vwvvwv.", "vvvvvvvv", ".gg..gg.", "g......g"], { v: T.alien, w: T.white, g: T.ok });
    px(this, "al_rastreador", [".v..v.", "vvvvvv", "vwvvwv", "vvvvvv", "v.vv.v"], { v: T.alien, w: T.red });
    px(this, "al_saboteador", ["v..v", ".vv.", "vwwv", ".vv.", "v..v"], { v: T.alien, w: T.alert });
    px(this, "al_nodriza", ["........vvvvvvvv........", ".....vvvwwvvvvwwvvv.....", "..vvvvvvvvvvvvvvvvvvvv..", "vvvgvvgvvgvvgvvgvvgvvgvv", "..vvvvvvvvvvvvvvvvvvvv..", ".....g.....gg.....g....."], { v: T.alien, w: T.ice, g: T.ok });
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
    this.add.text(SHADOW.x - 52, SHADOW.y - 8, "CRÁTER EN SOMBRA", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#45454f" });

    // rocket
    g.fillStyle(T.moon4).fillRect(ROCKET.x - 8, ROCKET.y - 36, 16, 56); g.fillStyle(T.white).fillTriangle(ROCKET.x - 8, ROCKET.y - 36, ROCKET.x + 8, ROCKET.y - 36, ROCKET.x, ROCKET.y - 52);
    g.fillStyle(T.suit).fillCircle(ROCKET.x, ROCKET.y - 22, 4); g.fillStyle(T.red).fillTriangle(ROCKET.x - 8, ROCKET.y + 4, ROCKET.x - 8, ROCKET.y + 20, ROCKET.x - 18, ROCKET.y + 22);
    g.fillStyle(T.red).fillTriangle(ROCKET.x + 8, ROCKET.y + 4, ROCKET.x + 8, ROCKET.y + 20, ROCKET.x + 18, ROCKET.y + 22);
    g.fillStyle(T.moon2).fillRect(ROCKET.x - 4, ROCKET.y + 20, 8, 4); g.fillStyle(T.moon0).fillRect(ROCKET.x - 6, ROCKET.y - 6, 12, 3);
    g.fillStyle(T.moon0).fillRect(ROCKET.x + 20, ROCKET.y - 10, 10, 30); g.fillStyle(T.moon0).fillRect(ROCKET.x - 30, ROCKET.y - 10, 10, 30);
    const lbl = { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#c9c9cf" };
    this.add.text(ROCKET.x - 16, ROCKET.y + 28, "COHETE", lbl);
    this.add.text(ROCKET.x + 18, ROCKET.y + 22, "LOX", lbl); this.add.text(ROCKET.x - 32, ROCKET.y + 22, "LH2", lbl);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(12 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(10 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(8 * k); i++) this.spawnNode("chatarra");

    this.preview = this.add.graphics().setDepth(35);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro").setDepth(10);
    this.ring = this.add.graphics().setDepth(30);
    this.beam = this.add.graphics().setDepth(22);
    this.night = this.add.rectangle(0, 0, W, H, PAL.black, 0).setOrigin(0).setScrollFactor(0).setDepth(20);
    this.prompt = this.add.text(0, 0, "", { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#f2d24f", backgroundColor: "#0b0b14" }).setDepth(40).setPadding(2);

    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true);
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
    const t = (f: () => void) => () => { this.touchMode = true; f(); };
    touch.act = { use: t(() => (sim.buildMode ? this.place() : this.useTool())), interact: t(() => this.interact()), build: t(() => this.toggleBuild()), cycle: t(() => this.cycleBuild()) };
    this.events.once("shutdown", () => { touch.act = { use: () => {}, interact: () => {}, build: () => {}, cycle: () => {} }; });
    (["ONE", "TWO", "THREE", "FOUR", "FIVE"] as const).forEach((n, i) => this.input.keyboard!.on(`keydown-${n}`, () => { sim.hotbar = i + 1; sfx.click(); }));
    for (const l of sim.leaks) this.addLeakSprite(l.id, l.x, l.y);
    if (!sim.log.length) addLog(sim, "Aterrizaje de emergencia en el polo sur lunar. Sin combustible.");
    this.leakT = 25;
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
    const base = target === "habitat" ? { x: HAB.x + Phaser.Math.Between(-20, 20), y: HAB.y - 10 } : target === "lh2" ? { x: ROCKET.x - 25, y: ROCKET.y } : { x: ROCKET.x + 25, y: ROCKET.y };
    const l = { id: sim.nextLeakId++, target, x: base.x, y: base.y, size: 1, progress: 0, age: 0 };
    sim.leaks.push(l); this.addLeakSprite(l.id, l.x, l.y);
    sim.leakFreeNight = isDay(sim) ? sim.leakFreeNight : false;
    addLog(sim, `Fuga detectada en ${target === "habitat" ? "el hábitat" : target === "lh2" ? "el tanque de LH2" : "el tanque de LOX"}.`);
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
  nearHab() { return Phaser.Math.Distance.Between(HAB.x, HAB.y, this.player.x, this.player.y) < 36; }
  nearModule(pred: (m: Module) => boolean, r = 22) {
    let best: Module | undefined, bd = r;
    for (const m of sim.modules) { if (!pred(m)) continue; const d = Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) - Math.max(TIPOS[m.tipo].w, TIPOS[m.tipo].h) / 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }

  makeModuleTextures() {
    const T = PAL;
    const draw = (key: string, w: number, h: number, f: (g: Phaser.GameObjects.Graphics) => void) => { const g = this.add.graphics(); f(g); g.generateTexture(key, w, h); g.destroy(); };
    draw("m_habitat", 44, 28, (g) => { g.fillStyle(T.moon3).fillRect(0, 4, 44, 24); g.fillStyle(T.moon4).fillRect(2, 0, 40, 6); g.fillStyle(T.suit).fillRect(18, 16, 8, 12); g.fillStyle(T.ok).fillRect(6, 10, 4, 4); });
    draw("m_panel", 18, 14, (g) => { g.fillStyle(T.suit).fillRect(0, 0, 18, 10); g.fillStyle(T.suitL).fillRect(0, 0, 18, 2); g.fillStyle(T.moon3).fillRect(8, 10, 2, 4); });
    draw("m_bateria", 12, 12, (g) => { g.fillStyle(T.moon3).fillRect(0, 2, 12, 10); g.fillStyle(T.moon4).fillRect(4, 0, 4, 2); g.fillStyle(T.ok).fillRect(2, 5, 8, 2); });
    draw("m_electrolisis", 16, 16, (g) => { g.fillStyle(T.moon2).fillRect(0, 4, 16, 12); g.fillStyle(T.suitL).fillRect(2, 0, 4, 8); g.fillStyle(T.white).fillRect(10, 0, 4, 8); });
    draw("m_licuefactor", 14, 14, (g) => { g.fillStyle(T.moon4).fillCircle(7, 7, 7); g.fillStyle(T.ice).fillCircle(7, 7, 3); });
    draw("m_horno", 16, 14, (g) => { g.fillStyle(T.moon2).fillRect(0, 0, 16, 14); g.fillStyle(T.alert).fillRect(4, 4, 8, 5); g.fillStyle(T.gold).fillRect(6, 6, 4, 2); });
    draw("m_taller", 20, 14, (g) => { g.fillStyle(T.moon1).fillRect(0, 0, 20, 14); g.fillStyle(T.moon3).fillRect(0, 0, 20, 3); g.fillStyle(T.alert).fillRect(3, 6, 4, 4); g.fillStyle(T.moon4).fillRect(10, 6, 7, 2); });
    draw("m_taladro", 10, 14, (g) => { g.fillStyle(T.alert).fillRect(2, 0, 6, 6); g.fillStyle(T.moon4).fillRect(4, 6, 2, 8); g.fillStyle(T.moon3).fillRect(0, 10, 10, 2); });
    draw("m_torre_luz", 6, 16, (g) => { g.fillStyle(T.gold).fillRect(0, 0, 6, 4); g.fillStyle(T.moon3).fillRect(2, 4, 2, 12); });
  }

  syncModules(a: number) {
    const alive = new Set(sim.modules.map((m) => m.uid));
    for (const [uid, sp] of this.modSprites) if (!alive.has(uid)) { sp.img.destroy(); sp.warn.destroy(); sp.glow?.destroy(); this.modSprites.delete(uid); }
    for (const m of sim.modules) {
      let sp = this.modSprites.get(m.uid);
      if (!sp) {
        const img = this.add.image(m.x, m.y, `m_${m.tipo}`).setDepth(6);
        const warn = this.add.text(m.x - 3, m.y - TIPOS[m.tipo].h / 2 - 9, "!", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#f08a24" }).setDepth(36);
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
    if (!own.length) { this.say("NO TIENES MÓDULOS: FABRÍCALOS (TAB)"); sfx.bad(); return; }
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
    if (!this.checkPlace(tipo, x, y)) { sfx.bad(); this.say(TIPOS[tipo].en_crater ? "EL TALADRO VA DENTRO DEL CRÁTER" : "LUGAR NO VÁLIDO"); return; }
    (sim.inv as unknown as Record<string, number>)[key]! -= 1;
    sim.modules.push({ uid: sim.nextUid++, tipo, x, y, durabilidad: 100, activo: true });
    addLog(sim, `Día ${sim.day}: construiste ${TIPOS[tipo].nombre.toLowerCase()}.`); sfx.ok();
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
    this.useCd = (sim.inv.taladro ?? 0) > 0 ? 0.25 : (sim.inv.pala_mejorada ?? 0) > 0 ? 0.35 : 0.5;
    if (!addItem(sim, n.type, 1)) { this.say("INVENTARIO LLENO"); sfx.bad(); return; }
    n.amount -= 1; sfx.pick();
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type)); }
  }

  interact() {
    if (useGame.getState().overlay) return;
    if (this.nearestLeak()) return; // hold handled in update
    if (this.nearHab() && sim.inv.hielo > 0) {
      const w = sim.inv.hielo * BAL.hielo_a_agua_kg; sim.inv.agua += w; sim.inv.hielo = 0;
      addLog(sim, `Derretiste hielo: +${w} kg de agua para electrólisis.`); sfx.ok();
    } else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) {
      useGame.getState().setOverlay("cohete");
    }
  }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    const overlay = useGame.getState().overlay;
    if (overlay) return;
    const k = this.keys;
    const sp = 60;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
    let len = Math.hypot(vx, vy) || 1;
    if (!vx && !vy && (touch.vx || touch.vy)) { vx = touch.vx; vy = touch.vy; len = 1; } // analog joystick
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * sp * dt, 4, W - 4);
    this.player.y = Phaser.Math.Clamp(this.player.y + (vy / len) * sp * dt, 4, H - 4);
    if (vx) { this.facing = Math.sign(vx); this.player.setFlipX(vx < 0); }
    this.useCd = Math.max(0, this.useCd - dt);

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    step(sim, dt, { inHabitat: this.nearHab(), inShadow });
    this.updateAliens(dt);
    const cd = stepCountdown(sim, dt);
    if (cd === "launched") { sfx.ok(); saveGame(); useGame.getState().publish(); useGame.getState().go("final"); return; }
    if (cd === "aborted") { sfx.bad(); this.say("DESPEGUE ABORTADO: REVISA EL COHETE (E)"); }

    // leaks
    this.leakT -= dt;
    if (this.leakT <= 0) {
      this.leakT = (55 / (diffCfg(sim).eventos * sim.eventScale)) * Phaser.Math.FloatBetween(0.7, 1.3) * (isDay(sim) ? 1.2 : 0.8);
      if (sim.leaks.length < 4) this.spawnLeak();
    }
    this.ring.clear();
    sim.near.taller = !!this.nearModule((m) => m.tipo === "taller" && m.durabilidad > 0, 26);
    sim.near.horno = !!this.nearModule((m) => m.tipo === "horno" && m.durabilidad > 0, 26);
    const leak = this.nearestLeak();
    const broken = leak ? undefined : this.nearModule((m) => m.durabilidad < 100);
    if (broken && (k.E.isDown || touch.e) && broken.durabilidad < 60) {
      if (sim.inv.kits < 1) this.say("SIN KITS: CRAFTEA UNO (TAB)");
      else {
        this.repairT += dt;
        this.ring.lineStyle(2, PAL.ok).beginPath().arc(broken.x, broken.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.repairT / 2.5)).strokePath();
        if (this.repairT >= 2.5) { this.repairT = 0; sim.inv.kits -= 1; broken.durabilidad = 100; addLog(sim, `Reparaste: ${TIPOS[broken.tipo].nombre}. -1 kit.`); sfx.ok(); }
      }
    } else this.repairT = 0;
    if (leak && (k.E.isDown || touch.e)) {
      if (sim.inv.kits < 1) { this.say("SIN KITS: CRAFTEA UNO (TAB)"); }
      else {
        leak.progress += dt / (1.5 + leak.size * 0.8);
        this.ring.lineStyle(2, PAL.ok).beginPath().arc(leak.x, leak.y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leak.progress).strokePath();
        if (leak.progress >= 1) {
          sim.inv.kits -= 1; sim.leaks = sim.leaks.filter((l) => l !== leak);
          this.leakSprites.get(leak.id)?.destroy(); this.leakSprites.delete(leak.id);
          sim.actFlags.leakFixed = true; addLog(sim, "Fuga sellada. -1 kit."); sfx.ok();
        }
      }
    } else if (leak) leak.progress = Math.max(0, leak.progress - dt * 0.5);
    for (const l of sim.leaks) { const s = this.leakSprites.get(l.id); if (s) s.setScale(0.8 + l.size * 0.25).setAlpha(Math.sin(this.time.now / 120) > 0 ? 1 : 0.4); }

    // prompts
    const n = this.nearestNode();
    if (leak) this.say(`MANTÉN E: SELLAR FUGA (${sim.inv.kits} KITS)`);
    else if (n) this.say(`ESPACIO: RECOGER ${n.type.toUpperCase()}`);
    else if (broken && broken.durabilidad < 60 && !(this.nearHab() && sim.inv.hielo > 0)) this.say(`MANTÉN E: REPARAR ${TIPOS[broken.tipo].nombre.toUpperCase()} (1 KIT)`);
    else if (this.nearHab() && sim.inv.hielo > 0) this.say("E: DERRETIR HIELO");
    else if (this.nearHab()) this.say("HÁBITAT: RECARGANDO O2");
    else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) this.say("E: REVISAR COHETE");
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

    if (sim.health <= 0) { onDeath(sim); sfx.bad(); this.player.setPosition(HAB.x, HAB.y + 30); }

    this.pubT += dt; this.saveT += dt;
    if (this.pubT > 0.15) { this.pubT = 0; useGame.getState().publish(); }
    if (this.saveT > 20) { this.saveT = 0; saveGame(); }
  }

  updateAliens(dt: number) {
    const world: World = { player: { x: this.player.x, y: this.player.y }, inHabitat: this.nearHab(), hab: HAB, rocket: ROCKET, w: W, h: H, rnd: () => Math.random() };
    for (const e of stepAliens(sim, dt, world)) {
      if (e.type === "leak") this.spawnLeak(e.target);
      if (e.type === "abducted") { onDeath(sim); sfx.bad(); this.player.setPosition(HAB.x, HAB.y + 30); }
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
    this.prompt.setText(s).setVisible(true).setPosition(this.player.x - this.prompt.width / 2, this.player.y - 18);
  }
}
