import { useEffect, useState } from "react";
import { useGame, sim } from "@/game/store";
import { PAL } from "@/game/palette";
import { GEAR, EQUIPO_MAX, toggleEquip } from "@/game/effects";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";

/**
 * Inventory paper doll: a detailed 16×24 front view of the astronaut. Worn gear is drawn on top as
 * pixel layers. Drag a gear item from the grid onto the astronaut to wear it (mouse: native drag;
 * touch: finger drag via useGearTouchDrag). Tap a slot — or drag it back to the grid — to take it off.
 */

const C: Record<string, number> = {
  B: PAL.black, W: PAL.white, S: PAL.moon4, D: PAL.moon3, K: PAL.moon2, N: PAL.moon1,
  V: PAL.suit, L: PAL.suitL, I: PAL.ice, O: PAL.alert, G: PAL.ok, R: PAL.red, Y: PAL.gold, M: PAL.moon4,
};
// Front view. B outline · W suit · S/D shading · K/N dark grey · V visor · L/I visor glare · G/O/R chest lights.
const BASE = [
  "....BBBBBBBB....", "...BWWWWWWWSB...", "..BWWBBBBBBWSB..", "..BWBVVVVLIBSB..", "..BWBVVVVVLBSB..", "..BWBVVVVVVBSB..",
  "..BWWBBBBBBWSB..", "...BSWWWWWSSB...", "..BBBDDDDDDBBB..", ".BWWBWWWWWWBWSB.", "BWWSBWKKKKWBSWSB", "BWWSBWKGOKWBSWSB",
  "BWWSBWKKKKWBSWSB", "BWSSBWWWWWSBSSSB", "BSSBBDDDDDDBBSSB", "BDDB.BWWWSB.BDDB", ".BB..BWWSSB..BB.", ".....BWSBWSB....",
  ".....BWSBWSB....", ".....BWSBWSB....", ".....BSSBSSB....", "....BDDDBDDDB...", "....BKKKBKKKB...", "....BBBBBBBBB...",
];
// Reflective cape: drawn BEHIND the body (shows between and around the legs) + a collar on top.
const CAPE_BACK: Record<number, string> = {
  15: "..BMMMMMMMMMMB..", 16: "..BMMMMMMMMMMB..", 17: ".BMMMMMMMMMMMMB.", 18: ".BMWMMMMMMMMWMB.",
  19: ".BMMMMMMMMMMMMB.", 20: ".BMWMMWMMWMMWMB.", 21: ".BBMBBMBBMBBMBB.",
};
const CAPE_FRONT: Record<number, string> = { 8: "...BMWMMMMWMB..." };
// Regolith shield: shoulder pads and a riveted chest plate over the suit.
const SHIELD: Record<number, string> = {
  9: "..NK........KN..", 10: "....BBBBBBBB....", 11: "....BNKYYKNB....", 12: "....BKNKKNKB....", 13: "....BNKYYKNB....", 14: "....BBBBBBBB....",
};

type Grid = (number | null)[][];
const toGrid = (rows: string[]): Grid => rows.map((r) => [...r].map((ch) => C[ch] ?? null));
const paint = (g: Grid, layer: Record<number, string>, under = false) => {
  for (const [y, row] of Object.entries(layer)) [...row].forEach((ch, x) => {
    const col = C[ch]; if (col === undefined) return;
    const yy = Number(y);
    if (!under || g[yy]![x] === null) g[yy]![x] = col;
  });
};

/** Build the pixel grid for the astronaut wearing `equip`. Exported for tests. */
export function dollPixels(equip: string[]): Grid {
  const g = toGrid(BASE);
  // Order matters: suit recolour first (only the astronaut's own pixels), then the cape behind, then plates on top.
  if (equip.includes("traje_termico")) {
    // Insulated orange layers with neat gold quilting lines on arms, torso and legs (helmet and chest panel stay).
    for (let y = 9; y <= 22; y++) g[y] = g[y]!.map((c, x) => {
      if (c === PAL.white) return y % 3 === 0 && x % 2 === 0 ? PAL.gold : PAL.alert;
      if (c === PAL.moon4) return PAL.red;
      return c;
    });
  }
  if (equip.includes("capa_reflectante")) paint(g, CAPE_BACK, true);
  if (equip.includes("escudo_radiacion")) paint(g, SHIELD);
  if (equip.includes("capa_reflectante")) paint(g, CAPE_FRONT);
  return g;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export const SLOT_LABEL: Record<string, string> = { traje_termico: "SUIT", capa_reflectante: "CAPE", escudo_radiacion: "CHEST" };

function DollSprite({ equip, scale }: { equip: string[]; scale: number }) {
  const g = dollPixels(equip);
  return (
    <svg width={16 * scale} height={24 * scale} viewBox="0 0 16 24" shapeRendering="crispEdges" aria-label={`Astronaut wearing ${equip.length ? equip.map((e) => ITEMS[e]?.nombre).join(", ") : "the basic suit"}`}>
      {g.flatMap((row, y) => row.map((c, x) => (c === null ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={hex(c)} />)))}
    </svg>
  );
}

/** Equip `key` (dropped on the doll). Returns the message to show. */
export function wearGear(key: string): string {
  if (!GEAR.includes(key)) return "Only gear can be worn";
  if (sim.equip.includes(key)) return "Already wearing it";
  const msg = toggleEquip(sim, key);
  if (msg === "Equipped") sfx.ok(); else sfx.bad();
  return msg;
}

export function CharacterDoll({ dragging = false, flash }: { dragging?: boolean; flash?: string | null }) {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (flash) setMsg(flash); }, [flash]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2200); return () => clearTimeout(t); }, [msg]);
  const drop = (key: string) => { setMsg(wearGear(key)); publish(); };
  const takeOff = (key: string) => { toggleEquip(sim, key); sfx.click(); setMsg("Gear removed"); publish(); };
  const hot = over || dragging;
  return (
    <div className="flex flex-col items-center gap-2">
      <div data-doll
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const k = e.dataTransfer.getData("text/item"); if (k) drop(k); }}
        className={`relative flex items-end justify-center border-2 px-4 pb-2 pt-3 transition-colors ${hot ? "border-ok bg-ok/15" : "border-moon-2 bg-moon-0"}`}>
        <div className="pointer-events-none absolute inset-x-3 bottom-1.5 h-2 rounded-[50%] bg-black/40" />
        <div className="relative animate-[doll-bob_1.6s_steps(2)_infinite]"><DollSprite equip={s.equip} scale={6} /></div>
        {hot && <span className="pointer-events-none absolute top-1 text-[6px] text-ok">DROP TO WEAR</span>}
      </div>
      <div className="flex gap-1" aria-label="Gear slots">
        {GEAR.map((k) => {
          const on = s.equip.includes(k);
          return (
            <button key={k} type="button" disabled={!on} draggable={on}
              onDragStart={(e) => e.dataTransfer.setData("text/unequip", k)}
              onClick={() => on && takeOff(k)}
              title={on ? `${ITEMS[k]?.nombre}: tap or drag back to the grid to take it off` : `${SLOT_LABEL[k]} slot: drag ${ITEMS[k]?.nombre} onto the astronaut`}
              className={`flex h-12 w-12 flex-col items-center justify-center border-2 ${on ? "border-gold bg-moon-0" : "border-dashed border-moon-2 bg-background/50 opacity-70"}`}>
              {on ? <PixelIcon item={k} size={22} /> : <span className="text-[10px] text-muted-foreground opacity-40">+</span>}
              <span className="mt-0.5 text-[5px] text-muted-foreground">{SLOT_LABEL[k]}</span>
            </button>
          );
        })}
      </div>
      <div className="min-h-4 text-center text-[6px] leading-3">
        {msg ? <span className={msg === "Equipped" ? "text-ok" : "text-gold"}>{msg}</span>
          : <span className="text-muted-foreground">Gear {s.equip.length}/{EQUIPO_MAX} · drag gear onto the astronaut</span>}
      </div>
    </div>
  );
}

/**
 * Finger drag for touch screens (HTML5 drag & drop doesn't work with touch).
 * Start it from a grid cell's onPointerDown; dropping over the doll wears the item.
 */
export function useGearTouchDrag() {
  const [drag, setDrag] = useState<{ key: string; x: number; y: number; x0: number; y0: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const publish = useGame((g) => g.publish);
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-doll]");
      if (moved && target) { setResult(wearGear(drag.key)); publish(); }
      setDrag(null);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [drag?.key, drag?.x0, drag?.y0, publish]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = (key: string) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !GEAR.includes(key)) return;
    setResult(null);
    setDrag({ key, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  };
  const ghost = drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 8
    ? <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 border-2 border-ok bg-moon-0/90 p-1" style={{ left: drag.x, top: drag.y }}><PixelIcon item={drag.key} size={28} /></div>
    : null;
  return { start, ghost, dragging: !!drag, result };
}
