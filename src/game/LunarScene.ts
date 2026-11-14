import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { showTip, missionSteps, step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, addItem, TIPOS, PLACEABLE, type LeakTarget, type Module, type ModType } from "./sim";
import { sfx } from "./audio";
import { touch } from "./touch";
import { toolFor, gainXp, toolCooldown, bonusChance, TOOLS } from "./tools";

const W = 640, H = 360;
const HAB = { x: 110, y: 170 } /* matches habitat in modulos.json */, ROCKET = { x: 540, y: 150 };
const SHADOW = { x: 330, y: 270, rx: 120, ry: 60 };
type NodeType = "hielo" | "regolito" | "chatarra" | "ilmenita" | "silicio";
const DOOR = { x: HAB.x, y: HAB.y + 14 };
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
  ring!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  preview!: Phaser.GameObjects.Graphics;
  modSprites = new Map<number, { img: Phaser.GameObjects.Image; warn: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Image | undefined }>();
  buildValid = false;
  body!: Phaser.GameObjects.Image;
  marker!: Phaser.GameObjects.Image;
  promptTxt = ""; flashMsg = ""; flashUntil = 0;
  walkT = 0; lastHop = 0; meteorT = 12;
  motes: { o: Phaser.GameObjects.Rectangle; vx: number; vy: number }[] = [];
  pubT = 0; saveT = 0; repairT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    const ac = { w: T.white, b: T.suit, c: T.suitL, o: T.alert };
    const top = ["..www...", ".wbbbw..", ".wbccbw.", ".wbbbw..", "wwwwwwo.", "w.www.w."];
    if (!this.textures.exists("astro")) {
      px(this, "astro", [...top, "..w.w...", "..w.w..."], ac);
      px(this, "astro1", [...top, ".w...w..", ".w....w."], ac);
      px(this, "astro2", [...top, "..w.w...", "...ww..."], ac);
      px(this, "shadow", ["..kkkk..", ".kkkkkk.", "..kkkk.."], { k: T.moon0 });
      px(this, "mark", ["yyyyy", ".yyy.", "..y.."], { y: T.gold });
      px(this, "markp", ["aaaaa", ".aaa.", "..a.."], { a: T.alert });
    }
    px(this, "ice", [".cc.", "cwcc", "cccw", ".cc."], { c: T.ice, w: T.white });
    px(this, "reg", [".mm.", "mlmm", "mmlm", ".mm."], { m: T.moon2, l: T.moon3 });
    px(this, "scrap", ["o.gg", ".gog", "gg.o", "g.g."], { o: T.alert, g: T.moon4 });
    px(this, "ilm", [".kk.", "kmkk", "kkmk", ".kk."], { k: T.moon0, m: T.alien });
    px(this, "sil", [".w..", "wcw.", "cccw", ".cc."], { c: T.ok, w: T.white });
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
    this.add.text(SHADOW.x, SHADOW.y - 4, "CRÁTER EN SOMBRA", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#6b6b75", resolution: 4 }).setOrigin(0.5).setDepth(1);

    // rocket
    g.fillStyle(T.moon4).fillRect(ROCKET.x - 8, ROCKET.y - 36, 16, 56); g.fillStyle(T.white).fillTriangle(ROCKET.x - 8, ROCKET.y - 36, ROCKET.x + 8, ROCKET.y - 36, ROCKET.x, ROCKET.y - 52);
    g.fillStyle(T.suit).fillCircle(ROCKET.x, ROCKET.y - 22, 4); g.fillStyle(T.red).fillTriangle(ROCKET.x - 8, ROCKET.y + 4, ROCKET.x - 8, ROCKET.y + 20, ROCKET.x - 18, ROCKET.y + 22);
    g.fillStyle(T.red).fillTriangle(ROCKET.x + 8, ROCKET.y + 4, ROCKET.x + 8, ROCKET.y + 20, ROCKET.x + 18, ROCKET.y + 22);
    g.fillStyle(T.moon2).fillRect(ROCKET.x - 4, ROCKET.y + 20, 8, 4); g.fillStyle(T.moon0).fillRect(ROCKET.x - 6, ROCKET.y - 6, 12, 3);
    g.fillStyle(T.moon0).fillRect(ROCKET.x + 20, ROCKET.y - 10, 10, 30); g.fillStyle(T.moon0).fillRect(ROCKET.x - 30, ROCKET.y - 10, 10, 30);
    g.generateTexture("terrain", W, H); g.destroy();
    this.add.image(0, 0, "terrain").setOrigin(0).setDepth(-1);
    // living details: rocket beacon, panel glints, drifting dust
    const beacon = this.add.rectangle(ROCKET.x, ROCKET.y - 53, 2, 2, T.red).setDepth(7);
    this.tweens.add({ targets: beacon, alpha: 0.1, duration: 500, yoyo: true, repeat: -1, hold: 300 });
    const antenna = this.add.rectangle(HAB.x + 18, HAB.y - 18, 1, 6, T.moon4).setOrigin(0.5, 1).setDepth(7);
    this.add.rectangle(HAB.x + 18, HAB.y - 25, 3, 1, T.ok).setDepth(7);
    this.tweens.add({ targets: antenna, angle: { from: -12, to: 12 }, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    for (let i = 0; i < 26; i++) {
      const o = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 1, 1, T.moon4, 0.5).setDepth(8);
      this.motes.push({ o, vx: Phaser.Math.FloatBetween(2, 6), vy: Phaser.Math.FloatBetween(-1, 1) });
    }
    const lbl = { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#c9c9cf", resolution: 4 };
    this.add.text(ROCKET.x - 16, ROCKET.y + 28, "COHETE", lbl);
    this.add.text(ROCKET.x + 18, ROCKET.y + 22, "LOX", lbl); this.add.text(ROCKET.x - 32, ROCKET.y + 22, "LH2", lbl);

    // resources
    const k = modeCfg(sim).recursos;
    const counts: [NodeType, number][] = [["hielo", 18], ["regolito", 16], ["chatarra", 12], ["ilmenita", 8], ["silicio", 7]];
    for (const [t, n] of counts) for (let i = 0; i < Math.round(n * k); i++) this.spawnNode(t);

    this.preview = this.add.graphics().setDepth(35);
    this.player = this.add.image(HAB.x, HAB.y + 30, "shadow").setDepth(9);
    this.body = this.add.image(HAB.x, HAB.y + 26, "astro").setDepth(10);
    this.marker = this.add.image(0, 0, "mark").setDepth(37).setVisible(false);
    this.ring = this.add.graphics().setDepth(30);
    this.night = this.add.rectangle(-W, -H, W * 4, H * 4, PAL.black, 0).setOrigin(0).setDepth(20);

    this.cameras.main.setZoom(4).setBounds(0, 0, W, H).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ONE,TWO,THREE,FOUR,FIVE,C,Q") as LunarScene["keys"];
    this.input.on("pointerdown", () => sim.inside ? undefined : (sim.buildMode ? this.place() : this.useTool()));
    this.input.keyboard!.on("keydown-C", () => this.toggleBuild());
    this.input.keyboard!.on("keydown-Q", () => this.cycleBuild());
    this.input.keyboard!.on("keydown-SPACE", () => sim.inside ? undefined : (sim.buildMode ? this.place() : this.useTool()));
    this.input.keyboard!.on("keydown-E", () => this.interact());
    this.input.keyboard!.on("keyup-E", () => { if (!sim.inside && !useGame.getState().overlay && this.nearDoor() && this.repairT < 0.35 && !this.nearestLeak()) this.enterHabitat(); });
    if (sim.inside) this.scene.launch("habitat");
    const offs = [
      touch.on("e-down", () => this.interact()),
      touch.on("e-up", () => { if (!sim.inside && !useGame.getState().overlay && this.nearDoor() && this.repairT < 0.35 && !this.nearestLeak()) this.enterHabitat(); }),
      touch.on("use", () => { if (!sim.inside && !useGame.getState().overlay) { if (sim.buildMode) this.place(); else this.useTool(); } }),
      touch.on("build", () => this.toggleBuild()),
      touch.on("cycle", () => this.cycleBuild()),
    ];
    this.events.once("shutdown", () => offs.forEach((f) => f()));
    this.events.once("destroy", () => offs.forEach((f) => f()));
    showTip(sim, "inicio");
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
    const tex = { hielo: "ice", regolito: "reg", chatarra: "scrap", ilmenita: "ilm", silicio: "sil" }[type];
    const spr = this.add.image(x, y, tex).setDepth(4);
    this.nodes.push({ type, amount: Phaser.Math.Between(3, 6), spr });
  }

  addLeakSprite(id: number, x: number, y: number) {
    this.leakSprites.set(id, this.add.image(x, y, "leak").setDepth(12));
  }

  spawnLeak() {
    const target: LeakTarget = Phaser.Math.RND.pick(["habitat", "habitat", "lh2", "lox"]);
    const base = target === "habitat" ? { x: HAB.x + Phaser.Math.Between(-20, 20), y: HAB.y - 10 } : target === "lh2" ? { x: ROCKET.x - 25, y: ROCKET.y } : { x: ROCKET.x + 25, y: ROCKET.y };
    const l = { id: sim.nextLeakId++, target, x: base.x, y: base.y, size: 1, progress: 0, age: 0 };
    sim.leaks.push(l); this.addLeakSprite(l.id, l.x, l.y);
    showTip(sim, "primera_fuga");
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
        const warn = this.add.text(m.x - 3, m.y - TIPOS[m.tipo].h / 2 - 9, "!", { fontFamily: '"Press Start 2P"', fontSize: "6px", color: "#f08a24", resolution: 4 }).setDepth(36);
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
    if (useGame.getState().overlay || sim.inside) return;
    if (sim.buildMode) { sim.buildMode = null; this.preview.clear(); return; }
    const own = this.ownedPlaceables();
    if (!own.length) { this.flash("NO TIENES MÓDULOS: FABRÍCALOS (TAB)"); sfx.bad(); return; }
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
  place() {
    const key = sim.buildMode; if (!key) return;
    const tipo = PLACEABLE[key]!;
    const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (!this.checkPlace(tipo, x, y)) { sfx.bad(); this.flash(TIPOS[tipo].en_crater ? "EL TALADRO VA DENTRO DEL CRÁTER" : "LUGAR NO VÁLIDO"); return; }
    (sim.inv as unknown as Record<string, number>)[key]! -= 1;
    sim.modules.push({ uid: sim.nextUid++, tipo, x, y, durabilidad: 100, activo: true });
    addLog(sim, `Día ${sim.day}: construiste ${TIPOS[tipo].nombre.toLowerCase()}.`); sfx.ok();
    if (!this.ownedPlaceables().includes(key)) { sim.buildMode = null; this.preview.clear(); }
  }

  useTool() {
    if (useGame.getState().overlay || this.useCd > 0) return;
    const n = this.nearestNode();
    if (!n) return;
    const tid = toolFor(n.type); const tool = sim.tools[tid];
    if (!tool.tiene) { this.flash(`NECESITAS ${TOOLS[tid].nombre.toUpperCase()} (TAB > CRAFTEO)`); if (tid === "pico") showTip(sim, "necesita_pico"); sfx.bad(); this.useCd = 0.4; return; }
    this.useCd = toolCooldown(tool.nivel);
    const amount = 1 + (Math.random() < bonusChance(tool.nivel) ? 1 : 0);
    if (!addItem(sim, n.type, amount)) { this.flash("INVENTARIO LLENO"); showTip(sim, "inventario_lleno"); sfx.bad(); return; }
    n.amount -= 1; sfx.pick();
    if (gainXp(sim, tid)) { addLog(sim, `Tu ${TOOLS[tid].nombre.toLowerCase()} mejoró a nivel ${tool.nivel}.`); showTip(sim, "nivel_herramienta"); sfx.ok(); this.flash(`¡${TOOLS[tid].nombre.toUpperCase()} NIVEL ${tool.nivel}!`); }
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type)); }
  }

  nearDoor() { return Phaser.Math.Distance.Between(DOOR.x, DOOR.y, this.player.x, this.player.y) < 14; }
  enterHabitat() {
    sim.inside = true; sim.buildMode = null; this.preview.clear(); this.promptTxt = "";
    this.scene.launch("habitat"); sfx.ok();
  }
  exitHabitat() {
    sim.inside = false; this.player.setPosition(DOOR.x, DOOR.y + 10);
  }
  interact() {
    if (useGame.getState().overlay || sim.inside) return;
    if (this.nearestLeak()) return; // hold handled in update
    if (this.nearDoor()) return; // tap E enters on release (hold repairs)
    if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) {
      useGame.getState().setOverlay("cohete");
    }
  }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    const overlay = useGame.getState().overlay;
    if (overlay) return;
    const k = this.keys;
    const sp = 60;
    if (sim.inside) {
      step(sim, dt, { inHabitat: true, inShadow: false });
      this.tickEvents(dt);
      if (sim.health <= 0) { onDeath(sim); sfx.bad(); }
      return;
    }
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
    vx += touch.vx; vy += touch.vy;
    const len = Math.max(1, Math.hypot(vx, vy));
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * sp * dt, 4, W - 4);
    this.player.y = Phaser.Math.Clamp(this.player.y + (vy / len) * sp * dt, 4, H - 4);
    if (Math.abs(vx) > 0.1) { this.facing = Math.sign(vx); this.body.setFlipX(vx < 0); }
    this.animate(dt, Math.hypot(vx, vy) > 0.1);
    this.useCd = Math.max(0, this.useCd - dt);

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    step(sim, dt, { inHabitat: false, inShadow });
    this.tickEvents(dt);
    this.ring.clear();
    sim.near.taller = !!this.nearModule((m) => m.tipo === "taller" && m.durabilidad > 0, 26);
    sim.near.horno = !!this.nearModule((m) => m.tipo === "horno" && m.durabilidad > 0, 26);
    const leak = this.nearestLeak();
    const broken = leak ? undefined : this.nearModule((m) => m.durabilidad < 100);
    if (broken && this.eHeld() && broken.durabilidad < 60 && (!this.nearDoor() || Math.max(k.E.getDuration(), touch.eDuration()) > 350)) {
      if (sim.inv.kits < 1) this.say("SIN KITS: CRAFTEA UNO (TAB)");
      else {
        this.repairT += dt;
        this.ring.lineStyle(2, PAL.ok).beginPath().arc(broken.x, broken.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (this.repairT / 2.5)).strokePath();
        if (this.repairT >= 2.5) { this.repairT = 0; sim.inv.kits -= 1; broken.durabilidad = 100; addLog(sim, `Reparaste: ${TIPOS[broken.tipo].nombre}. -1 kit.`); sfx.ok(); }
      }
    } else this.repairT = 0;
    if (leak && this.eHeld()) {
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

    // prompts
    this.promptTxt = "";
    const n = this.nearestNode();
    if (leak) this.say(`MANTÉN E: SELLAR FUGA (${sim.inv.kits} KITS)`);
    else if (n) { const tid = toolFor(n.type); const t = sim.tools[tid]; this.say(t.tiene ? `ESPACIO: ${n.type.toUpperCase()} (${TOOLS[tid].nombre.toUpperCase()} NV${t.nivel})` : `${n.type.toUpperCase()}: NECESITAS ${TOOLS[tid].nombre.toUpperCase()}`); }
    else if (broken && broken.durabilidad < 60 && !this.nearDoor()) this.say(`MANTÉN E: REPARAR ${TIPOS[broken.tipo].nombre.toUpperCase()} (1 KIT)`);
    else if (this.nearDoor()) this.say("E: ENTRAR AL HÁBITAT");
    else if (Phaser.Math.Distance.Between(ROCKET.x, ROCKET.y, this.player.x, this.player.y) < 36) this.say("E: REVISAR COHETE");

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
      const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const ok = this.checkPlace(tipo, Math.round(p.x), Math.round(p.y));
      this.preview.fillStyle(ok ? PAL.ok : PAL.red, 0.45).fillRect(Math.round(p.x) - t.w / 2, Math.round(p.y) - t.h / 2, t.w, t.h);
      this.preview.lineStyle(1, ok ? PAL.ok : PAL.red).strokeRect(Math.round(p.x) - t.w / 2, Math.round(p.y) - t.h / 2, t.w, t.h);
    }

    this.updateGuidance();
    this.ambient(dt);
    sim.prompt = this.time.now < this.flashUntil ? this.flashMsg : this.promptTxt;
    if (sim.health <= 0) { onDeath(sim); sfx.bad(); this.enterHabitat(); }
  }

  eHeld() { return this.keys.E.isDown || touch.e; }
  flash(m: string) { this.flashMsg = m; this.flashUntil = this.time.now + 1600; }

  /** Low-gravity bounding gait: hop + leg frames + dust puffs on landing. */
  animate(dt: number, moving: boolean) {
    if (moving) this.walkT += dt; else this.walkT = 0;
    const ph = this.walkT * 6;
    const hop = moving ? Math.abs(Math.sin(ph)) * 5 : Math.sin(this.time.now / 600) * 0.5;
    this.body.setPosition(Math.round(this.player.x), Math.round(this.player.y - 4 - hop));
    this.body.setTexture(!moving ? "astro" : hop > 2.5 ? "astro2" : Math.floor(ph / Math.PI) % 2 ? "astro1" : "astro");
    this.player.setScale(1 - hop * 0.06);
    const landed = Math.floor(ph / Math.PI);
    if (moving && landed !== this.lastHop) { this.lastHop = landed; this.puff(this.player.x, this.player.y, 3); }
  }
  puff(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const d = this.add.rectangle(x + Phaser.Math.Between(-2, 2), y, 1, 1, PAL.moon3).setDepth(8);
      this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-5, 5), y: y - Phaser.Math.Between(1, 4), alpha: 0, duration: 500, onComplete: () => d.destroy() });
    }
  }
  ambient(dt: number) {
    for (const m of this.motes) {
      m.o.x += m.vx * dt; m.o.y += m.vy * dt;
      if (m.o.x > W) { m.o.x = 0; m.o.y = Phaser.Math.Between(0, H); }
    }
    for (const n of this.nodes) if ((n.type === "hielo" || n.type === "silicio") && Math.random() < dt * 0.15) {
      this.tweens.add({ targets: n.spr, alpha: 0.4, duration: 120, yoyo: true });
    }
    this.meteorT -= dt;
    if (this.meteorT <= 0) {
      this.meteorT = Phaser.Math.Between(15, 35);
      const tx = Phaser.Math.Between(30, W - 30), ty = Phaser.Math.Between(30, H - 30);
      const m = this.add.rectangle(tx - 60, ty - 40, 2, 1, PAL.gold).setDepth(25);
      this.tweens.add({ targets: m, x: tx, y: ty, duration: 600, onComplete: () => { m.destroy(); this.puff(tx, ty, 8); if (Phaser.Math.Distance.Between(tx, ty, this.player.x, this.player.y) < 150) sfx.pick(); } });
    }
  }

  /** Compass + world marker: urgent problems first, then the mission target. */
  updateGuidance() {
    const p = this.player;
    let t: { x: number; y: number; label: string; problema: boolean } | null = null;
    const nearestOf = (pts: { x: number; y: number }[]) => pts.reduce<{ x: number; y: number } | null>((b, q) => (!b || Phaser.Math.Distance.Between(q.x, q.y, p.x, p.y) < Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) ? q : b), null);
    const nodeOf = (type: NodeType) => nearestOf(this.nodes.filter((n) => n.type === type).map((n) => ({ x: n.spr.x, y: n.spr.y })));
    const leak = nearestOf(sim.leaks);
    const broken = sim.modules.find((m) => m.durabilidad < 25);
    if (leak) t = { ...leak, label: "FUGA", problema: true };
    else if (sim.suitO2 < 30 || sim.temp < 8) t = { ...DOOR, label: sim.suitO2 < 30 ? "O2: HÁBITAT" : "CALOR: HÁBITAT", problema: true };
    else if (broken) t = { x: broken.x, y: broken.y, label: "REPARAR", problema: true };
    else {
      const steps = missionSteps(sim);
      const next = steps.findIndex((st) => !st.done);
      let q: { x: number; y: number } | null = null, label = "";
      if (sim.act === 1 && next === 0) { q = nodeOf("hielo"); label = "HIELO"; }
      else if (sim.act === 1 && next === 1) { q = nodeOf("chatarra"); label = "CHATARRA"; }
      else if (sim.act === 2 && sim.inv.hielo > 0) { q = DOOR; label = "FUSOR (HÁBITAT)"; }
      else if (sim.act === 2 && next === 0) { q = nodeOf("hielo"); label = "HIELO"; }
      else if (sim.act >= 3) { q = ROCKET; label = "COHETE"; }
      if (q) t = { ...q, label, problema: false };
    }
    if (!t) { sim.compass = null; this.marker.setVisible(false); return; }
    const dist = Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y);
    sim.compass = { angle: Phaser.Math.RadToDeg(Math.atan2(t.y - p.y, t.x - p.x)) + 90, dist: Math.round(dist), label: t.label, problema: t.problema };
    this.marker.setTexture(t.problema ? "markp" : "mark").setVisible(dist > 12).setPosition(t.x, t.y - 10 + Math.sin(this.time.now / 200) * 2);
  }

  /** Shared per-frame events that run whether the player is outside or inside. */
  tickEvents(dt: number) {
    this.leakT -= dt;
    if (this.leakT <= 0) {
      this.leakT = (55 / (diffCfg(sim).eventos * sim.eventScale)) * Phaser.Math.FloatBetween(0.7, 1.3) * (isDay(sim) ? 1.2 : 0.8);
      if (sim.leaks.length < 4) this.spawnLeak();
    }
    for (const l of sim.leaks) { const s = this.leakSprites.get(l.id); if (s) s.setScale(0.8 + l.size * 0.25).setAlpha(Math.sin(this.time.now / 120) > 0 ? 1 : 0.4); }
    this.pubT += dt; this.saveT += dt;
    if (this.pubT > 0.15) { this.pubT = 0; useGame.getState().publish(); }
    if (this.saveT > 20) { this.saveT = 0; saveGame(); }
  }

  say(s: string) { this.promptTxt = s; }
}
