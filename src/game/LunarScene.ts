import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame, saveGame } from "./store";
import { step, isDay, CYCLE, DAY_LEN, addLog, onDeath, modeCfg, diffCfg, type LeakTarget } from "./sim";
import { sfx } from "./audio";

const W = 640, H = 360;
const HAB = { x: 110, y: 170 }, ROCKET = { x: 540, y: 150 };
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
  ring!: Phaser.GameObjects.Graphics;
  night!: Phaser.GameObjects.Rectangle;
  light!: Phaser.GameObjects.Image;
  prompt!: Phaser.GameObjects.Text;
  pubT = 0; saveT = 0; leakT = 0; useCd = 0; facing = 1;
  constructor() { super("lunar"); }

  create() {
    const T = PAL;
    px(this, "astro", ["..www...", ".wbbbw..", ".wbccbw.", ".wbbbw..", "wwwwwwo.", "w.www.w.", "..w.w...", "..w.w..."], { w: T.white, b: T.suit, c: T.suitL, o: T.alert });
    px(this, "ice", [".cc.", "cwcc", "cccw", ".cc."], { c: T.ice, w: T.white });
    px(this, "reg", [".mm.", "mlmm", "mmlm", ".mm."], { m: T.moon2, l: T.moon3 });
    px(this, "scrap", ["o.gg", ".gog", "gg.o", "g.g."], { o: T.alert, g: T.moon4 });
    px(this, "leak", [".a.a.", "a.r.a", ".rwr.", "a.r.a", ".a.a."], { a: T.alert, r: T.red, w: T.white });
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

    // base
    g.fillStyle(T.moon3).fillRect(HAB.x - 22, HAB.y - 12, 44, 24); g.fillStyle(T.moon4).fillRect(HAB.x - 20, HAB.y - 16, 40, 6);
    g.fillStyle(T.suit).fillRect(HAB.x - 4, HAB.y + 2, 8, 10); g.fillStyle(T.ok).fillRect(HAB.x - 16, HAB.y - 6, 4, 4);
    for (let i = 0; i < 3; i++) { g.fillStyle(T.suit).fillRect(HAB.x - 30 + i * 22, HAB.y - 52, 18, 12); g.fillStyle(T.suitL).fillRect(HAB.x - 30 + i * 22, HAB.y - 52, 18, 2); g.fillStyle(T.moon3).fillRect(HAB.x - 22 + i * 22, HAB.y - 40, 2, 10); }
    g.fillStyle(T.moon2).fillRect(HAB.x + 30, HAB.y - 6, 16, 16); g.fillStyle(T.alert).fillRect(HAB.x + 34, HAB.y - 2, 8, 4);
    g.fillStyle(T.moon4).fillRect(HAB.x - 50, HAB.y - 4, 14, 14); g.fillStyle(T.ice).fillRect(HAB.x - 47, HAB.y - 1, 8, 8);
    // rocket
    g.fillStyle(T.moon4).fillRect(ROCKET.x - 8, ROCKET.y - 36, 16, 56); g.fillStyle(T.white).fillTriangle(ROCKET.x - 8, ROCKET.y - 36, ROCKET.x + 8, ROCKET.y - 36, ROCKET.x, ROCKET.y - 52);
    g.fillStyle(T.suit).fillCircle(ROCKET.x, ROCKET.y - 22, 4); g.fillStyle(T.red).fillTriangle(ROCKET.x - 8, ROCKET.y + 4, ROCKET.x - 8, ROCKET.y + 20, ROCKET.x - 18, ROCKET.y + 22);
    g.fillStyle(T.red).fillTriangle(ROCKET.x + 8, ROCKET.y + 4, ROCKET.x + 8, ROCKET.y + 20, ROCKET.x + 18, ROCKET.y + 22);
    g.fillStyle(T.moon2).fillRect(ROCKET.x - 4, ROCKET.y + 20, 8, 4); g.fillStyle(T.moon0).fillRect(ROCKET.x - 6, ROCKET.y - 6, 12, 3);
    g.fillStyle(T.moon0).fillRect(ROCKET.x + 20, ROCKET.y - 10, 10, 30); g.fillStyle(T.moon0).fillRect(ROCKET.x - 30, ROCKET.y - 10, 10, 30);
    const lbl = { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#c9c9cf" };
    this.add.text(HAB.x - 16, HAB.y + 16, "HÁBITAT", lbl); this.add.text(ROCKET.x - 16, ROCKET.y + 28, "COHETE", lbl);
    this.add.text(ROCKET.x + 18, ROCKET.y + 22, "LOX", lbl); this.add.text(ROCKET.x - 32, ROCKET.y + 22, "LH2", lbl);

    // resources
    const k = modeCfg(sim).recursos;
    for (let i = 0; i < Math.round(12 * k); i++) this.spawnNode("hielo");
    for (let i = 0; i < Math.round(10 * k); i++) this.spawnNode("regolito");
    for (let i = 0; i < Math.round(8 * k); i++) this.spawnNode("chatarra");

    this.light = this.add.image(HAB.x, HAB.y, "glow").setScale(1.6).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.player = this.add.image(HAB.x, HAB.y + 30, "astro").setDepth(10);
    this.ring = this.add.graphics().setDepth(30);
    this.night = this.add.rectangle(0, 0, 320, 180, PAL.black, 0).setOrigin(0).setScrollFactor(0).setDepth(20);
    this.prompt = this.add.text(0, 0, "", { fontFamily: '"Press Start 2P"', fontSize: "5px", color: "#f2d24f", backgroundColor: "#0b0b14" }).setDepth(40).setPadding(2);

    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player, true, 0.15, 0.15).setRoundPixels(true);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ONE,TWO,THREE,FOUR,FIVE") as LunarScene["keys"];
    this.input.on("pointerdown", () => this.useTool());
    this.input.keyboard!.on("keydown-SPACE", () => this.useTool());
    this.input.keyboard!.on("keydown-E", () => this.interact());
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
    } while ((type === "hielo") !== inShadow(x, y) || Phaser.Math.Distance.Between(x, y, HAB.x, HAB.y) < 50 || Phaser.Math.Distance.Between(x, y, ROCKET.x, ROCKET.y) < 45);
    const spr = this.add.image(x, y, type === "hielo" ? "ice" : type === "regolito" ? "reg" : "scrap").setDepth(4);
    this.nodes.push({ type, amount: Phaser.Math.Between(2, 4), spr });
  }

  addLeakSprite(id: number, x: number, y: number) {
    this.leakSprites.set(id, this.add.image(x, y, "leak").setDepth(12));
  }

  spawnLeak() {
    const target: LeakTarget = Phaser.Math.RND.pick(["habitat", "habitat", "lh2", "lox"]);
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

  useTool() {
    if (useGame.getState().overlay || this.useCd > 0) return;
    const n = this.nearestNode();
    if (!n) return;
    this.useCd = (sim.inv.taladro ?? 0) > 0 ? 0.25 : (sim.inv.pala_mejorada ?? 0) > 0 ? 0.35 : 0.5;
    sim.inv[n.type] += 1; n.amount -= 1; sfx.pick();
    this.tweens.add({ targets: n.spr, y: n.spr.y - 2, yoyo: true, duration: 60 });
    if (n.amount <= 0) { n.spr.destroy(); this.nodes = this.nodes.filter((x) => x !== n); this.time.delayedCall(40000, () => this.spawnNode(n.type)); }
  }

  interact() {
    if (useGame.getState().overlay) return;
    if (this.nearestLeak()) return; // hold handled in update
    if (this.nearHab() && sim.inv.hielo > 0) {
      const w = sim.inv.hielo * 2; sim.inv.agua += w; sim.inv.hielo = 0;
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
    const len = Math.hypot(vx, vy) || 1;
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * sp * dt, 4, W - 4);
    this.player.y = Phaser.Math.Clamp(this.player.y + (vy / len) * sp * dt, 4, H - 4);
    if (vx) { this.facing = vx; this.player.setFlipX(vx < 0); }
    this.useCd = Math.max(0, this.useCd - dt);

    const inShadow = ((this.player.x - SHADOW.x) / SHADOW.rx) ** 2 + ((this.player.y - SHADOW.y) / SHADOW.ry) ** 2 < 1;
    step(sim, dt, { inHabitat: this.nearHab(), inShadow });

    // leaks
    this.leakT -= dt;
    if (this.leakT <= 0) {
      this.leakT = (55 / (diffCfg(sim).eventos * sim.eventScale)) * Phaser.Math.FloatBetween(0.7, 1.3) * (isDay(sim) ? 1.2 : 0.8);
      if (sim.leaks.length < 4) this.spawnLeak();
    }
    this.ring.clear();
    const leak = this.nearestLeak();
    if (leak && k.E.isDown) {
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
    this.light.setAlpha(sim.battery > 0 ? a * 1.4 : 0).setDepth(21);

    if (sim.health <= 0) { onDeath(sim); sfx.bad(); this.player.setPosition(HAB.x, HAB.y + 30); }

    this.pubT += dt; this.saveT += dt;
    if (this.pubT > 0.15) { this.pubT = 0; useGame.getState().publish(); }
    if (this.saveT > 20) { this.saveT = 0; saveGame(); }
  }

  say(s: string) {
    this.prompt.setText(s).setVisible(true).setPosition(this.player.x - this.prompt.width / 2, this.player.y - 18);
  }
}
