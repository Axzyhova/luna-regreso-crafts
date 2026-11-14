import type Phaser from "phaser";
import { PAL } from "./palette";

/**
 * High-definition pixel art: every texture is drawn at HD× the world resolution and
 * shown at 1/HD scale, so sprites keep their size in the world but get twice the
 * pixel detail (outlines, shading, highlights) — chunky but crisp, like modern 2D
 * pixel games. The camera renders at the same HD factor.
 */
export const HD = 2;

type G = Phaser.GameObjects.Graphics;
const OUT = 0x14141c;      // outline
const SHADE = 0x2a2a36;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G, r: (x: number, y: number, w: number, h: number, c: number, a?: number) => void) => void) {
  const g = scene.add.graphics();
  const r = (x: number, y: number, ww: number, hh: number, c: number, a = 1) => { g.fillStyle(c, a); g.fillRect(x, y, ww, hh); };
  draw(g, r);
  g.generateTexture(key, w * HD, h * HD);
  g.destroy();
}

/** Rectangle with a 1px dark outline and a light top / dark bottom bevel. */
function block(r: (x: number, y: number, w: number, h: number, c: number, a?: number) => void, x: number, y: number, w: number, h: number, base: number, light: number, dark: number) {
  r(x - 1, y - 1, w + 2, h + 2, OUT);
  r(x, y, w, h, base);
  r(x, y, w, 1, light); r(x, y, 1, h, light);
  r(x, y + h - 1, w, 1, dark); r(x + w - 1, y, 1, h, dark);
}

export function makeSprites(scene: Phaser.Scene) {
  const T = PAL;

  // Astronaut (10x12 world px): idle, 8-frame walk and 8-frame run, all from one parametric drawing.
  makeAstronaut(scene);
  makeStructures(scene);

  // Astronaut without the space suit (same size): head and hair visible, blue undersuit.
  tex(scene, "astro_plain", 10, 12, (g, r) => {
    r(5, 10, 10, 10, OUT); g.fillStyle(OUT).fillCircle(10, 6, 4.8);
    r(6, 11, 8, 8, 0x3b6fd6); r(11, 11, 3, 8, 0x2a4fa8); r(6, 11, 8, 1, 0x7fa8ff);   // undersuit
    r(9, 13, 2, 2, T.alert);                                                          // patch
    r(6, 18, 3, 5, OUT); r(11, 18, 3, 5, OUT); r(6, 18, 3, 4, 0x2a4fa8); r(11, 18, 3, 4, 0x223f88);
    r(6, 22, 3, 1, 0x2a2a36); r(11, 22, 3, 1, 0x2a2a36);
    g.fillStyle(0xf0c8a0).fillCircle(10, 6.5, 3.8);                                  // face
    r(6, 2, 8, 3, 0x4a2e1a); r(6, 4, 2, 3, 0x4a2e1a);                               // hair
    r(8, 6, 1, 1, 0x14141c); r(11, 6, 1, 1, 0x14141c);                               // eyes
  });

  // Death bag: a sack with a red marker, so you can find your lost items.
  tex(scene, "bag", 9, 10, (g, r) => {
    g.fillStyle(OUT).fillEllipse(9, 13, 16, 13); g.fillStyle(0x8a6a3a).fillEllipse(9, 13, 14, 11); g.fillStyle(0xb08a50).fillEllipse(7, 11, 7, 5);
    r(7, 4, 4, 4, OUT); r(8, 5, 2, 3, 0x6a4e28);
    r(5, 0, 8, 2, T.red); r(8, 0, 2, 4, T.red);
  });

  // Zone resources.
  tex(scene, "n_cristal", 7, 8, (g, r) => {
    g.fillStyle(OUT).fillPoints(toPts([7, 0, 13, 7, 7, 15, 1, 7], 1), true);
    g.fillStyle(0x9fd8ff).fillPoints(toPts([7, 0, 13, 7, 7, 15, 1, 7], 0), true);
    g.fillStyle(0xd8f2ff).fillPoints(toPts([7, 1, 7, 14, 2, 7], 0), true);
    r(6, 4, 1, 4, 0xffffff); r(9, 9, 2, 1, 0x5aa0d8);
  });
  tex(scene, "n_titanio", 7, 6, (g, r) => {
    g.fillStyle(OUT).fillEllipse(7, 7, 14, 10); g.fillStyle(0x6b6b75).fillEllipse(7, 7, 12, 8);
    r(3, 4, 3, 2, 0xd8e0ea); r(8, 6, 3, 2, 0xb8c6d8); r(5, 8, 2, 1, 0xffffff); r(9, 4, 1, 1, 0xffffff);
  });
  tex(scene, "n_aleacion", 7, 7, (g, r) => {
    g.fillStyle(0x4fc26a, 0.35).fillCircle(7, 7, 7);
    g.fillStyle(OUT).fillPoints(toPts([7, 1, 12, 5, 11, 12, 3, 12, 2, 5], 1), true);
    g.fillStyle(0x3a9a52).fillPoints(toPts([7, 1, 12, 5, 11, 12, 3, 12, 2, 5], 0), true);
    r(5, 4, 2, 4, 0x9ff0b4); r(8, 8, 2, 2, T.alien);
  });
  // Warning sign at the ravine where the bridge goes.
  tex(scene, "gate", 9, 11, (g, r) => {
    r(8, 10, 2, 12, OUT); r(8, 10, 1, 12, 0x9a9aa3);
    g.fillStyle(OUT).fillTriangle(9, 0, 0, 12, 18, 12); g.fillStyle(T.gold).fillTriangle(9, 2, 2, 11, 16, 11);
    r(8, 4, 2, 4, OUT); r(8, 9, 2, 1, OUT);
  });

  // Ice crystals: faceted shards with highlights.
  tex(scene, "ice", 6, 6, (g) => {
    const shard = (pts: number[], fill: number, edge: number) => {
      g.fillStyle(OUT).fillPoints(toPts(pts, 1), true);
      g.fillStyle(fill).fillPoints(toPts(pts, 0), true);
      g.lineStyle(1, edge).strokePoints(toPts(pts, 0), true);
    };
    shard([2, 11, 4, 3, 7, 11], 0x7fc6ec, 0xffffff);
    shard([5, 11, 8, 1, 11, 11], 0xa8e4ff, 0xe8f8ff);
    g.fillStyle(0xffffff).fillRect(7, 3, 1, 3);
    g.fillStyle(0x3b8fc6).fillRect(4, 10, 6, 1);
  });

  // Regolith rock pile: rounded stones with light top-left and dark bottom-right.
  tex(scene, "reg", 6, 5, (g) => {
    const stone = (x: number, y: number, rx: number, ry: number) => {
      g.fillStyle(OUT).fillEllipse(x, y, rx * 2 + 2, ry * 2 + 2);
      g.fillStyle(0x6b6b75).fillEllipse(x, y, rx * 2, ry * 2);
      g.fillStyle(0x9a9aa3).fillEllipse(x - 1, y - 1, rx * 1.2, ry * 1.1);
      g.fillStyle(0x45454f).fillRect(x + rx - 2, y + 1, 2, 1);
    };
    stone(4, 6, 3, 2.5); stone(8, 5, 3, 3); stone(6, 7.5, 2.5, 1.8);
  });

  // Scrap: bent hull plate with rivets and rust, clearly different from capsules.
  tex(scene, "scrap", 6, 5, (g, r) => {
    g.fillStyle(OUT).fillPoints(toPts([1, 3, 9, 1, 11, 6, 3, 9], 1), true);
    g.fillStyle(0xa9a9b3).fillPoints(toPts([1, 3, 9, 1, 11, 6, 3, 9], 0), true);
    r(3, 4, 6, 1, 0xd8d8de); r(5, 6, 3, 2, 0xc96a1e); r(8, 3, 1, 1, 0x55555f); r(4, 7, 1, 1, 0x55555f);
    r(2, 8, 2, 1, 0x7a4416);
  });

  // Leak: bright spray star.
  tex(scene, "leak", 7, 7, (g, r) => {
    g.fillStyle(0xf08a24, 0.6).fillCircle(7, 7, 6);
    g.fillStyle(0xd63b3b).fillCircle(7, 7, 3.5);
    g.fillStyle(0xffffff).fillCircle(7, 7, 1.8);
    for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0], [4, -4], [4, 4], [-4, 4], [-4, -4]]) r(7 + dx! - 0.5, 7 + dy! - 0.5, 1.5, 1.5, 0xffe0a0);
  });

  // Supply capsule: small outlined cargo rocket (11x15 world px).
  tex(scene, "capsule", 11, 15, (g, r) => {
    g.fillStyle(OUT).fillTriangle(11, 0, 4, 9, 18, 9);
    r(4, 8, 14, 15, OUT);
    g.fillStyle(T.red).fillTriangle(11, 1, 5, 9, 17, 9);
    g.fillStyle(0xff7a6a).fillTriangle(11, 2, 8, 7, 11, 7);
    r(5, 9, 12, 13, 0xf2f2f2); r(14, 9, 3, 13, 0xc9c9d2);
    r(5, 11, 12, 3, T.gold); r(5, 11, 12, 1, 0xfff0a0);
    g.fillStyle(OUT).fillCircle(11, 17, 2.6); g.fillStyle(0x3b6fd6).fillCircle(11, 17, 2); r(10, 16, 1, 1, 0xbfd8ff);
    g.fillStyle(OUT).fillTriangle(5, 17, 1, 25, 6, 23); g.fillStyle(T.red).fillTriangle(5, 18, 2, 24, 5, 22);
    g.fillStyle(OUT).fillTriangle(17, 17, 21, 25, 16, 23); g.fillStyle(T.red).fillTriangle(17, 18, 20, 24, 17, 22);
    r(7, 22, 2, 7, 0x6b6b75); r(13, 22, 2, 7, 0x6b6b75); r(6, 28, 4, 1, 0x45454f); r(12, 28, 4, 1, 0x45454f);
  });

  // Aliens (fiction): outlined, with glowing details.
  tex(scene, "al_abductor", 10, 7, (g, r) => {
    g.fillStyle(OUT).fillEllipse(10, 6, 16, 10); g.fillStyle(0x7fe8ff, 0.9).fillEllipse(10, 5, 12, 8); r(7, 3, 2, 2, 0xffffff);
    g.fillStyle(OUT).fillEllipse(10, 9, 22, 8); g.fillStyle(T.alien).fillEllipse(10, 9, 20, 6); g.fillStyle(0xc28bff).fillEllipse(10, 8, 16, 2);
    for (const x of [4, 8, 12, 16]) r(x, 9, 2, 1, T.ok);
    r(6, 12, 1, 2, T.ok); r(13, 12, 1, 2, T.ok);
  });
  tex(scene, "al_rastreador", 7, 6, (g, r) => {
    g.fillStyle(OUT).fillEllipse(7, 6, 12, 9); g.fillStyle(T.alien).fillEllipse(7, 6, 10, 7); g.fillStyle(0xc28bff).fillEllipse(6, 4, 6, 3);
    r(4, 5, 2, 2, T.red); r(8, 5, 2, 2, T.red); r(4, 5, 1, 1, 0xffb0b0); r(8, 5, 1, 1, 0xffb0b0);
    for (const x of [2, 5, 8, 11]) r(x, 9, 1, 3, OUT);
  });
  tex(scene, "al_saboteador", 5, 6, (g, r) => {
    g.fillStyle(OUT).fillCircle(5, 5, 4.5); g.fillStyle(T.alien).fillCircle(5, 5, 3.5);
    r(3, 4, 1, 2, T.alert); r(6, 4, 1, 2, T.alert);
    r(1, 1, 1, 3, OUT); r(8, 1, 1, 3, OUT); r(3, 9, 1, 3, OUT); r(6, 9, 1, 3, OUT);
  });
  tex(scene, "al_nodriza", 26, 8, (g, r) => {
    g.fillStyle(OUT).fillEllipse(26, 5, 22, 10); g.fillStyle(0x7fe8ff, 0.9).fillEllipse(26, 4, 18, 8);
    g.fillStyle(OUT).fillEllipse(26, 9, 52, 12); g.fillStyle(T.alien).fillEllipse(26, 9, 50, 10); g.fillStyle(0xc28bff).fillEllipse(26, 7, 42, 3);
    for (let x = 6; x < 48; x += 6) r(x, 9, 2, 2, T.ok);
    r(14, 14, 2, 2, T.ok); r(25, 14, 2, 2, T.ok); r(36, 14, 2, 2, T.ok);
  });

  // ---- Base modules (sizes in world px match modulos.json) ----
  tex(scene, "m_habitat", 44, 28, (g, r) => {
    block(r, 2, 10, 84, 44, 0x9a9aa3, 0xc9c9cf, 0x6b6b75);
    g.fillStyle(OUT).fillEllipse(44, 12, 84, 22); g.fillStyle(0xc9c9cf).fillEllipse(44, 12, 82, 20); g.fillStyle(0xe6e6ec).fillEllipse(38, 8, 56, 8);
    for (let x = 8; x < 82; x += 12) r(x, 14, 1, 38, 0x7c7c86);
    block(r, 36, 30, 16, 24, T.suit, T.suitL, 0x1f3f8a); r(48, 41, 2, 2, T.gold);
    block(r, 12, 22, 10, 8, 0x1d3f8a, 0x7fa8ff, 0x10204a); block(r, 66, 22, 10, 8, 0x1d3f8a, 0x7fa8ff, 0x10204a);
    r(10, 18, 4, 3, T.ok); r(70, 16, 6, 2, 0x45454f);
  });
  tex(scene, "m_panel", 18, 14, (g, r) => {
    r(16, 18, 4, 10, OUT); r(17, 18, 2, 10, 0x9a9aa3);
    block(r, 1, 1, 34, 18, 0x1d3f8a, 0x7fa8ff, 0x10204a);
    for (let x = 2; x < 34; x += 4) r(x, 2, 1, 16, 0x3b6fd6);
    r(2, 9, 32, 1, 0x3b6fd6); r(3, 3, 10, 1, 0xbfd8ff);
  });
  tex(scene, "m_bateria", 12, 12, (g, r) => {
    block(r, 2, 5, 20, 18, 0x9a9aa3, 0xc9c9cf, 0x55555f);
    block(r, 8, 1, 8, 4, 0xc9c9cf, 0xffffff, 0x6b6b75);
    r(5, 9, 14, 6, OUT); r(6, 10, 9, 4, T.ok); r(6, 10, 9, 1, 0x9ff0b4);
  });
  tex(scene, "m_electrolisis", 16, 16, (g, r) => {
    block(r, 1, 9, 30, 22, 0x6b6b75, 0x9a9aa3, 0x45454f);
    block(r, 4, 1, 8, 16, 0x7fa8ff, 0xd8e8ff, 0x3b6fd6); r(6, 4, 2, 6, 0xffffff, 0.6);
    block(r, 20, 1, 8, 16, 0xf2f2f2, 0xffffff, 0xb0b0ba); r(22, 4, 2, 6, 0xffffff);
    r(6, 22, 20, 3, OUT); r(7, 23, 18, 1, T.gold);
  });
  tex(scene, "m_licuefactor", 14, 14, (g, r) => {
    g.fillStyle(OUT).fillCircle(14, 14, 13.5); g.fillStyle(0xc9c9cf).fillCircle(14, 14, 12.5); g.fillStyle(0xe6e6ec).fillCircle(11, 11, 8);
    g.fillStyle(OUT).fillCircle(14, 14, 6.5); g.fillStyle(0xa8e4ff).fillCircle(14, 14, 5.5); r(11, 11, 3, 2, 0xffffff);
    r(13, 1, 2, 4, 0x6b6b75);
  });
  tex(scene, "m_horno", 16, 14, (g, r) => {
    block(r, 1, 1, 30, 26, 0x6b6b75, 0x9a9aa3, 0x45454f);
    r(7, 7, 18, 12, OUT); r(8, 8, 16, 10, 0x2a1408);
    r(9, 12, 14, 6, T.alert); r(11, 13, 10, 3, T.gold); r(13, 14, 6, 1, 0xfff0a0);
    r(4, 22, 24, 2, 0x45454f); r(26, 3, 3, 3, T.red);
  });
  tex(scene, "m_taller", 20, 14, (g, r) => {
    block(r, 1, 5, 38, 22, 0x45454f, 0x6b6b75, 0x2a2a36);
    block(r, 0, 1, 40, 6, 0x9a9aa3, 0xc9c9cf, 0x6b6b75);
    block(r, 5, 12, 8, 8, T.alert, 0xffb066, 0x8a4410);
    r(18, 12, 16, 3, 0xc9c9cf); r(18, 17, 10, 2, 0x9a9aa3); r(30, 16, 3, 6, 0x7a4416);
  });
  tex(scene, "m_taladro", 10, 14, (g, r) => {
    block(r, 4, 1, 12, 12, T.alert, 0xffb066, 0x8a4410); r(7, 4, 6, 2, 0x2a2a36);
    r(8, 13, 4, 12, OUT); r(9, 13, 2, 12, 0xc9c9cf);
    g.fillStyle(OUT).fillTriangle(7, 25, 13, 25, 10, 28); g.fillStyle(0x9a9aa3).fillTriangle(8, 25, 12, 25, 10, 27);
    block(r, 1, 20, 18, 3, 0x6b6b75, 0x9a9aa3, 0x45454f);
  });
  tex(scene, "m_torre_luz", 6, 16, (g, r) => {
    block(r, 1, 1, 10, 7, T.gold, 0xfff3a6, 0xb08a10); r(3, 3, 6, 2, 0xffffff);
    r(5, 8, 2, 22, OUT); r(5, 8, 1, 22, 0xc9c9cf);
    block(r, 2, 28, 8, 3, 0x6b6b75, 0x9a9aa3, 0x45454f);
  });
}

type R = (x: number, y: number, w: number, h: number, c: number, a?: number) => void;

/** One astronaut pose, in HD pixels. Legs swing from a shared hip; the body can dip (knees bend) and lean. */
export interface AstroPose { nearDx: number; nearLift: number; farDx: number; farLift: number; dip: number; lean: number; arm: number; bent: boolean }

/** Walk/run cycles: 8 frames each, legs on a sine so contact, passing and lift land on the right frames. */
export const ASTRO_FRAMES = 8;
export function astroPose(kind: "idle" | "walk" | "run", i: number): AstroPose {
  if (kind === "idle") return { nearDx: 0, nearLift: 0, farDx: 0, farLift: 0, dip: i % 2, lean: 0, arm: 0, bent: false };
  const run = kind === "run";
  const p = (i / ASTRO_FRAMES) * Math.PI * 2, s = Math.sin(p), c = Math.cos(p);
  const amp = run ? 4 : 3, lift = run ? 3 : 2;
  const nearDx = Math.round(amp * s);
  return {
    nearDx, farDx: -nearDx,
    nearLift: Math.round(Math.max(0, c) * lift), farLift: Math.round(Math.max(0, -c) * lift), // the leg swinging forward is lifted
    dip: Math.abs(s) > 0.9 ? 1 : 0, // weight lands on the front foot at full stride
    lean: run ? 1 : 0, arm: -Math.round(nearDx * (run ? 0.8 : 0.6)), bent: run,
  };
}

/** "suit" = EVA suit with helmet; "plain" = blue undersuit with face and hair (shown while the suit is off). */
export type AstroSkin = "suit" | "plain";

function drawAstro(g: G, r: R, p: AstroPose, skin: AstroSkin = "suit") {
  const L = p.lean, D = p.dip, suit = skin === "suit";
  const leg = (dx: number, lift: number, fill: number, boot: number) => {
    const hip = 8, top = 18 + D, foot = 22 - lift;
    const thighX = hip + Math.round(dx / 2), shinX = hip + dx;
    const parts: [number, number, number, number][] = [[thighX, top, 3, 2], [shinX, top + 2, 3, Math.max(1, foot - top - 2)], [shinX, foot, 4, 1]];
    for (const [x, y, w, h] of parts) r(x - 1, y - 1, w + 2, h + 2, OUT);
    r(thighX, top, 3, 2, fill); r(shinX, top + 2, 3, Math.max(1, foot - top - 2), fill); r(shinX, foot, 4, 1, boot);
  };
  leg(p.farDx, p.farLift, suit ? 0xb4b4be : 0x223f88, suit ? 0x45454f : 0x2a2a36); // far leg, in shade
  if (suit) {
    // body (same design as the HD art: backpack, torso with shade and mission patch, round helmet with visor)
    r(4 + L, 10 + D, 12, 10, OUT); r(2 + L, 11 + D, 3, 8, OUT);
    g.fillStyle(OUT).fillCircle(10 + L, 7 + D, 6.5);
    r(3 + L, 12 + D, 2, 6, 0x8a8a96); r(3 + L, 12 + D, 1, 6, 0xb0b0ba);
    r(5 + L, 11 + D, 10, 8, 0xf2f2f2); r(12 + L, 11 + D, 3, 8, 0xc9c9d2);
    r(9 + L, 13 + D, 3, 2, PAL.alert);
  } else {
    r(5 + L, 10 + D, 10, 10, OUT); g.fillStyle(OUT).fillCircle(10 + L, 6 + D, 4.8);
    r(6 + L, 11 + D, 8, 8, 0x3b6fd6); r(11 + L, 11 + D, 3, 8, 0x2a4fa8); r(6 + L, 11 + D, 8, 1, 0x7fa8ff); // undersuit
    r(9 + L, 13 + D, 2, 2, PAL.alert); // patch
  }
  leg(p.nearDx, p.nearLift, suit ? 0xeeeef2 : 0x2a4fa8, suit ? 0x55555f : 0x2a2a36); // near leg, lit
  if (suit) {
    g.fillStyle(0xf2f2f2).fillCircle(10 + L, 7 + D, 5.5);
    g.fillStyle(0xc9c9d2).fillCircle(11.5 + L, 8 + D, 4);
    g.fillStyle(0xf2f2f2).fillCircle(9.5 + L, 6.5 + D, 4.2);
    r(6 + L, 5 + D, 8, 4, 0x1d3f8a); r(6 + L, 5 + D, 8, 1, 0x3b6fd6); r(7 + L, 6 + D, 2, 1, 0xbfd8ff); r(12 + L, 7 + D, 1, 1, 0x7fa8ff);
  } else {
    g.fillStyle(0xf0c8a0).fillCircle(10 + L, 6.5 + D, 3.8); // face
    r(6 + L, 2 + D, 8, 3, 0x4a2e1a); r(6 + L, 4 + D, 2, 3, 0x4a2e1a); // hair
    r(8 + L, 6 + D, 1, 1, 0x14141c); r(11 + L, 6 + D, 1, 1, 0x14141c); // eyes
  }
  // near arm in two segments from a fixed shoulder: the forearm swings against the near leg
  // (bent and raised when running). Soft edge instead of a black box so it reads as a limb.
  const sx = 10 + L, sy = 12 + D, fx = sx + p.arm, fy = sy + 2, fh = p.bent ? 2 : 3;
  const EDGE = suit ? 0x8a8a96 : 0x223f88;
  r(sx - 1, sy - 1, 4, 4, EDGE); r(fx - 1, fy - 1, 4, fh + 3, EDGE);
  r(sx, sy, 2, 3, suit ? 0xe6e6ec : 0x3b6fd6); r(fx, fy, 2, fh + 1, suit ? 0xf2f2f2 : 0x3b6fd6); r(fx, fy, 1, fh + 1, suit ? 0xffffff : 0x7fa8ff);
  r(fx, fy + fh + 1, 2, 1, suit ? 0x6b6b75 : 0xf0c8a0); // glove / hand
}

/** Texture prefix per skin: suit → "astro_…", plain → "plain_…" (idle0-1, walk0-7, run0-7 each). */
export const ASTRO_PREFIX: Record<AstroSkin, string> = { suit: "astro", plain: "plain" };

function makeAstronaut(scene: Phaser.Scene) {
  for (const skin of ["suit", "plain"] as const) {
    const pre = ASTRO_PREFIX[skin];
    for (let i = 0; i < 2; i++) tex(scene, `${pre}_idle${i}`, 10, 12, (g, r) => drawAstro(g, r, astroPose("idle", i), skin));
    for (const kind of ["walk", "run"] as const)
      for (let i = 0; i < ASTRO_FRAMES; i++) tex(scene, `${pre}_${kind}${i}`, 10, 12, (g, r) => drawAstro(g, r, astroPose(kind, i), skin));
  }
  tex(scene, "astro", 10, 12, (g, r) => drawAstro(g, r, astroPose("idle", 0))); // default frame
}

/** Rocket, tanks, ground shadow and dust puff — separate sprites so the astronaut can walk behind them. */
function makeStructures(scene: Phaser.Scene) {
  const T = PAL;
  // Rocket: 40x78 world px (80x156 HD). Body x 25..55, nose to y 0, fins and nozzle at the bottom.
  tex(scene, "rocket", 40, 78, (g, r) => {
    for (const s of [1, -1]) { // fins behind the body
      const fx = (x: number) => 40 + s * (x - 40);
      g.fillStyle(OUT).fillPoints(toPts([fx(26), 108, fx(26), 148, fx(4), 152, fx(8), 128], 1.2), true);
      g.fillStyle(T.red).fillPoints(toPts([fx(26), 108, fx(26), 148, fx(4), 152, fx(8), 128], 0), true);
      g.fillStyle(0xff7a6a).fillPoints(toPts([fx(25), 112, fx(25), 124, fx(12), 130], 0), true);
    }
    block(r, 32, 146, 16, 8, 0x6b6b75, 0x9a9aa3, 0x45454f); // nozzle
    block(r, 25, 32, 30, 115, 0xe6e6ec, 0xffffff, 0xa9a9b3); // body
    r(46, 33, 8, 113, 0xc9c9d2); r(27, 33, 2, 113, 0xffffff);
    g.fillStyle(OUT).fillTriangle(40, 0, 23, 33, 57, 33); // nose cone
    g.fillStyle(0xf2f2f2).fillTriangle(40, 2, 25, 32, 55, 32);
    g.fillStyle(0xc9c9d2).fillTriangle(40, 2, 40, 32, 55, 32);
    g.fillStyle(T.red).fillTriangle(40, 2, 35, 13, 45, 13);
    g.fillStyle(OUT).fillCircle(40, 58, 7.5); g.fillStyle(0x1d3f8a).fillCircle(40, 58, 6); g.fillStyle(0x3b6fd6).fillCircle(39, 57, 4); r(36, 54, 3, 2, 0xbfd8ff); // porthole
    r(25, 80, 30, 6, T.red); r(25, 80, 30, 1, 0xff7a6a); r(46, 80, 8, 6, 0xa02a2a); // band
    for (const y of [96, 110, 124, 138]) r(26, y, 28, 1, 0xa9a9b3); // panel seams
    r(38, 90, 4, 3, T.gold); // flag decal
  });
  for (const [key, band] of [["tank_lh2", T.suitL], ["tank_lox", T.ice]] as const) {
    tex(scene, key, 10, 30, (_g, r) => {
      block(r, 6, 1, 8, 5, 0x9a9aa3, 0xc9c9cf, 0x6b6b75); // valve cap
      block(r, 1, 5, 18, 51, 0x6b6b75, 0x9a9aa3, 0x45454f);
      r(14, 6, 4, 49, 0x55555f); r(3, 6, 1, 49, 0xb0b0ba);
      r(2, 16, 16, 6, band); r(3, 16, 6, 1, 0xffffff); r(13, 16, 5, 6, 0x5a8fd0, 0.5); // frost band
      r(2, 38, 16, 1, 0x45454f); // weld seam
      r(2, 56, 4, 4, OUT); r(14, 56, 4, 4, OUT); r(3, 56, 2, 3, 0x6b6b75); r(15, 56, 2, 3, 0x6b6b75); // legs
    });
  }
  tex(scene, "shadow", 32, 8, (g) => { g.fillStyle(0x000000, 0.32).fillEllipse(32, 8, 64, 16); g.fillStyle(0x000000, 0.18).fillEllipse(32, 8, 44, 10); });
  tex(scene, "dust", 4, 3, (g) => { g.fillStyle(0x9a9aa3, 0.85).fillEllipse(4, 3, 8, 5); g.fillStyle(0xc9c9cf, 0.7).fillEllipse(3, 2, 4, 2); });
}

/** Flat [x0,y0,x1,y1,...] → points, optionally grown by `grow` px from the centroid (for outlines). */
function toPts(a: number[], grow: number) {
  const pts = [] as { x: number; y: number }[];
  let cx = 0, cy = 0;
  for (let i = 0; i < a.length; i += 2) { cx += a[i]!; cy += a[i + 1]!; }
  cx /= a.length / 2; cy /= a.length / 2;
  for (let i = 0; i < a.length; i += 2) {
    const dx = a[i]! - cx, dy = a[i + 1]! - cy, d = Math.hypot(dx, dy) || 1;
    pts.push({ x: a[i]! + (dx / d) * grow, y: a[i + 1]! + (dy / d) * grow });
  }
  return pts;
}

/** Re-export for scene code that needs the shading color. */
export const SPRITE_SHADE = SHADE;
