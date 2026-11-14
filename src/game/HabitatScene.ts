import Phaser from "phaser";
import { PAL } from "./palette";
import { sim, useGame } from "./store";
import { addLog } from "./sim";
import { sfx } from "./audio";
import type { LunarScene } from "./LunarScene";

const F = '"Press Start 2P"';
interface Station { id: string; x: number; y: number; label: string }
const STATIONS: Station[] = [
  { id: "puerta", x: 160, y: 150, label: "PUERTA" },
  { id: "fusor", x: 56, y: 62, label: "FUSOR DE HIELO" },
  { id: "mesa", x: 128, y: 62, label: "MESA" },
  { id: "terminal", x: 264, y: 62, label: "TERMINAL" },
  { id: "litera", x: 52, y: 132, label: "LITERA" },
  { id: "o2", x: 268, y: 132, label: "ESTACIÓN O2" },
  { id: "ventana", x: 200, y: 50, label: "VENTANA" },
];

/** Interior of the habitat, drawn on top of the (still simulating) lunar scene. */
export class HabitatScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Image;
  keys!: Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E", Phaser.Input.Keyboard.Key>;
  prompt!: Phaser.GameObjects.Text;
  dark!: Phaser.GameObjects.Rectangle;
  info!: Phaser.GameObjects.Text;
  leakTxt!: Phaser.GameObjects.Text;
  o2bar!: Phaser.GameObjects.Graphics;
  sawEarth = false;
  constructor() { super("habitat"); }

  create() {
    const T = PAL;
    const g = this.add.graphics();
    g.fillStyle(T.black).fillRect(0, 0, 320, 180);
    // walls
    g.fillStyle(T.moon1).fillRect(8, 8, 304, 148);
    g.fillStyle(T.moon2).fillRect(8, 8, 304, 36);
    for (let x = 8; x < 312; x += 24) g.fillStyle(T.moon3).fillRect(x, 40, 22, 2);
    // floor tiles
    for (let y = 44; y < 152; y += 12) for (let x = 8; x < 312; x += 12) g.fillStyle((x + y) % 24 === 0 ? T.moon1 : T.moon0).fillRect(x, y, 12, 12);
    g.lineStyle(2, T.moon4).strokeRect(8, 8, 304, 148);
    // window with Earth
    g.fillStyle(T.moon4).fillRect(176, 12, 48, 28); g.fillStyle(T.space).fillRect(178, 14, 44, 24);
    g.fillStyle(T.suit).fillCircle(206, 24, 6); g.fillStyle(T.ok).fillRect(203, 21, 4, 3); g.fillStyle(T.white).fillRect(200, 26, 3, 2);
    g.fillStyle(T.white).fillRect(184, 18, 1, 1).fillRect(190, 32, 1, 1).fillRect(216, 34, 1, 1);
    // fusor
    g.fillStyle(T.moon4).fillRect(40, 44, 32, 22); g.fillStyle(T.ice).fillRect(44, 48, 10, 10); g.fillStyle(T.alert).fillRect(58, 50, 10, 6);
    // mesa
    g.fillStyle(T.moon3).fillRect(110, 50, 36, 14); g.fillStyle(T.moon2).fillRect(112, 64, 4, 8).fillRect(140, 64, 4, 8); g.fillStyle(T.alert).fillRect(116, 46, 6, 4); g.fillStyle(T.moon4).fillRect(128, 47, 10, 3);
    // terminal
    g.fillStyle(T.moon0).fillRect(250, 42, 28, 22); g.fillStyle(T.ok).fillRect(253, 45, 22, 13); g.fillStyle(T.black).fillRect(255, 48, 14, 1).fillRect(255, 51, 10, 1).fillRect(255, 54, 16, 1);
    // litera
    g.fillStyle(T.moon3).fillRect(28, 118, 48, 26); g.fillStyle(T.suit).fillRect(30, 120, 44, 10); g.fillStyle(T.white).fillRect(30, 120, 10, 10); g.fillStyle(T.suit).fillRect(30, 132, 44, 10);
    // o2 station
    g.fillStyle(T.moon4).fillRect(258, 114, 20, 30); g.fillStyle(T.suitL).fillRect(262, 118, 12, 18); g.fillStyle(T.ok).fillRect(266, 138, 4, 4);
    // door
    g.fillStyle(T.moon3).fillRect(146, 150, 28, 8); g.fillStyle(T.suit).fillRect(150, 152, 20, 6);
    // plant (life support)
    g.fillStyle(T.moon2).fillRect(96, 140, 10, 8); g.fillStyle(T.ok).fillRect(97, 132, 3, 8).fillRect(101, 130, 3, 10).fillRect(104, 134, 2, 6);

    const lbl = { fontFamily: F, fontSize: "5px", color: "#f2f2f2", resolution: 4 };
    for (const s of STATIONS) if (s.id !== "ventana") this.add.text(s.x, s.y + (s.id === "puerta" ? -9 : 13), s.label, lbl).setOrigin(0.5, 0);
    this.add.text(14, 12, "HÁBITAT", { fontFamily: F, fontSize: "6px", color: "#f2d24f" });
    this.info = this.add.text(14, 22, "", { fontFamily: F, fontSize: "5px", color: "#c9c9cf", resolution: 4 });
    this.o2bar = this.add.graphics();
    this.leakTxt = this.add.text(160, 100, "", { fontFamily: F, fontSize: "5px", color: "#f08a24", backgroundColor: "#0b0b14" }).setOrigin(0.5).setPadding(2).setDepth(30);

    this.player = this.add.image(160, 136, "astro").setDepth(10);
    this.dark = this.add.rectangle(0, 0, 320, 180, T.black, 0).setOrigin(0).setDepth(20);
    this.prompt = this.add.text(0, 0, "", { fontFamily: F, fontSize: "5px", color: "#f2d24f", backgroundColor: "#0b0b14" }).setDepth(40).setPadding(2);
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E") as HabitatScene["keys"];
    this.input.keyboard!.on("keydown-E", () => this.interact());
    addLog(sim, "Entraste al hábitat. Te quitas el casco.");
  }

  nearest() {
    let best: Station | undefined, bd = 22;
    for (const s of STATIONS) { const d = Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  interact() {
    if (useGame.getState().overlay) return;
    const st = this.nearest();
    if (!st) return;
    if (st.id === "puerta") {
      (this.scene.get("lunar") as LunarScene).exitHabitat();
      addLog(sim, "Sales a la superficie.");
      sfx.click(); this.scene.stop(); return;
    }
    if (st.id === "fusor") {
      if (sim.inv.hielo <= 0) { this.flash("NO TIENES HIELO"); sfx.bad(); return; }
      const w = sim.inv.hielo * 2; sim.inv.agua += w; sim.inv.hielo = 0;
      addLog(sim, `Derretiste hielo: +${w} kg de agua para electrólisis.`); sfx.ok(); this.flash(`+${w} KG DE AGUA`);
    }
    if (st.id === "mesa") { useGame.getState().setOverlay("inv"); sfx.click(); }
    if (st.id === "terminal") { useGame.getState().setOverlay("base"); sfx.click(); }
    if (st.id === "litera") {
      if (sim.restCd > 0) { this.flash(`AÚN NO TIENES SUEÑO (${Math.ceil(sim.restCd)}S)`); return; }
      sim.health = Math.min(100, sim.health + 30); sim.restCd = 60;
      addLog(sim, "Descansaste en la litera. +30 salud."); sfx.ok(); this.flash("+30 SALUD");
    }
    if (st.id === "ventana") {
      this.flash("LA TIERRA... TAN CERCA Y TAN LEJOS");
      if (!this.sawEarth) { this.sawEarth = true; addLog(sim, "Miras la Tierra por la ventana. Tienes que volver."); }
    }
    if (st.id === "o2") this.flash(`O2 DEL TRAJE ${Math.round(sim.suitO2)}%`);
  }

  flashUntil = 0; flashMsg = "";
  flash(m: string) { this.flashMsg = m; this.flashUntil = this.time.now + 1500; }

  override update(_t: number, ms: number) {
    const dt = Math.min(0.1, ms / 1000);
    sim.restCd = Math.max(0, sim.restCd - dt);
    const powered = sim.battery > 0;
    this.dark.setAlpha(powered ? 0 : 0.55);
    this.info.setText(`O2 HÁBITAT ${Math.round(sim.habitatO2)}%  ·  ${powered ? "LUCES OK" : "¡SIN ENERGÍA!"}`);
    this.o2bar.clear().fillStyle(PAL.moon0).fillRect(14, 30, 60, 3).fillStyle(sim.habitatO2 < 25 ? PAL.alert : PAL.suitL).fillRect(14, 30, (60 * sim.habitatO2) / 100, 3);
    const hl = sim.leaks.some((l) => l.target === "habitat");
    this.leakTxt.setText(hl ? "¡FUGA EN EL HÁBITAT! SÉLLALA DESDE FUERA" : "").setVisible(hl && Math.sin(this.time.now / 150) > 0);

    if (useGame.getState().overlay) return;
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    this.player.x = Phaser.Math.Clamp(this.player.x + (vx / len) * 55 * dt, 16, 304);
    this.player.y = Phaser.Math.Clamp(this.player.y + (vy / len) * 55 * dt, 50, 148);
    if (vx) this.player.setFlipX(vx < 0);

    const st = this.nearest();
    const txt = this.time.now < this.flashUntil ? this.flashMsg : st ? {
      puerta: "E: SALIR A LA SUPERFICIE", fusor: `E: DERRETIR HIELO (${Math.floor(sim.inv.hielo)})`, mesa: "E: INVENTARIO Y CRAFTEO",
      terminal: "E: PANEL DE BASE", litera: "E: DESCANSAR", o2: "RECARGANDO O2 DEL TRAJE", ventana: "E: MIRAR LA TIERRA",
    }[st.id]! : "";
    this.prompt.setText(txt).setVisible(!!txt).setPosition(Phaser.Math.Clamp(this.player.x - this.prompt.width / 2, 2, 318 - this.prompt.width), this.player.y - 18);
  }
}
