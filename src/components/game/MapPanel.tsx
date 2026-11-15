import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { ZONAS, WORLD, FOG_CELL, FOG_COLS, FOG_ROWS, BRIDGE, zoneBlock } from "@/game/sim";
import { SUBZONAS, BOSS_DEFS, type Subzona } from "@/game/zones";
import { ITEMS } from "@/game/items";

const S = 0.5; // map pixels per world pixel (world 1280x720 → map 640x360)

/**
 * Full integrated map of the explorable world. Shows explored vs unexplored areas,
 * dedicated resource lands ("Tierras de recursos"), far boss zones, and mini-locations.
 */
export function MapPanel() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const ref = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Subzona | null>(null);
  const explored = (x: number, y: number) => s.explored[Math.floor(y / FOG_CELL) * FOG_COLS + Math.floor(x / FOG_CELL)] === 1;

  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    const W = WORLD.w * S, H = WORLD.h * S;
    g.clearRect(0, 0, W, H);
    for (const z of ZONAS) {
      const [x, y, w, h] = z.rect as [number, number, number, number];
      g.fillStyle = z.suelo; g.fillRect(x * S, y * S, w * S, h * S);
    }
    // landing-site landmarks
    g.fillStyle = "#141428"; g.beginPath(); g.ellipse(330 * S, 270 * S, 120 * S, 60 * S, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#07070c"; g.fillRect(640 * S, 356 * S, 640 * S, 8 * S); g.fillRect(636 * S, 360 * S, 8 * S, 360 * S);
    if (s.bridge) { g.fillStyle = "#c9c9cf"; g.fillRect((BRIDGE.x - 12) * S, 346 * S, 24 * S, 20 * S); }
    for (const m of s.modules) { g.fillStyle = m.tipo === "habitat" ? "#7fa8ff" : "#c9c9cf"; g.fillRect(m.x * S - 2, m.y * S - 2, m.tipo === "habitat" ? 8 : 4, m.tipo === "habitat" ? 6 : 4); }
    g.fillStyle = "#ffffff"; g.fillRect(540 * S - 2, 150 * S - 6, 4, 12); // rocket
    for (const c of s.capsules) if (explored(c.x, c.y)) { g.fillStyle = "#f2d24f"; g.fillRect(c.x * S - 2, c.y * S - 3, 4, 6); }
    for (const d of s.drops) { g.fillStyle = "#b08a50"; g.beginPath(); g.arc(d.x * S, d.y * S, 3, 0, Math.PI * 2); g.fill(); }
    // fog of war
    g.font = "bold 9px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let cy = 0; cy < FOG_ROWS; cy++) for (let cx = 0; cx < FOG_COLS; cx++) {
      if (s.explored[cy * FOG_COLS + cx] === 1) continue;
      const x = cx * FOG_CELL * S, y = cy * FOG_CELL * S, c = FOG_CELL * S;
      g.fillStyle = "#050508"; g.fillRect(x, y, c + 0.5, c + 0.5);
      if ((cx + cy) % 2 === 0) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillText("?", x + c / 2, y + c / 2); }
    }
    // mini-locations: dedicated resource lands & far boss points (always visible as tactical pins)
    for (const sz of SUBZONAS) {
      const px = sz.x * S, py = sz.y * S;
      const isBoss = sz.tipo === "jefe";
      const bossAlive = isBoss && sz.jefe && !s.bossesDefeated.includes(sz.jefe);
      const isSel = selected?.id === sz.id;
      g.strokeStyle = isSel ? "#ffffff" : isBoss ? "#ff5c77" : "#4ee68a";
      g.lineWidth = isSel ? 2 : 1.2;
      g.fillStyle = isBoss ? "rgba(255,92,119,0.22)" : "rgba(78,230,138,0.16)";
      g.beginPath(); g.arc(px, py, isBoss ? 8 : 6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = isBoss ? (bossAlive ? "#ff5c77" : "#888899") : "#4ee68a";
      g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fill();
      g.font = "bold 8px sans-serif"; g.textAlign = "center"; g.textBaseline = "top";
      g.fillStyle = "rgba(0,0,0,0.75)";
      const tw = g.measureText(sz.nombre).width + 6;
      g.fillRect(px - tw / 2, py + 8, tw, 11);
      g.fillStyle = isBoss ? "#ffb0be" : "#b8ffd4";
      g.fillText(sz.nombre, px, py + 9);
    }
    // active special case pin
    if (s.specialCase) {
      const sx = s.specialCase.x * S, sy = s.specialCase.y * S;
      g.strokeStyle = "#f2d24f"; g.lineWidth = 2;
      g.beginPath(); g.arc(sx, sy, 9, 0, Math.PI * 2); g.stroke();
      g.font = "bold 10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#f2d24f"; g.fillText("★", sx, sy);
    }
    // zone names (+ lock reason)
    g.font = "bold 10px sans-serif";
    for (const z of ZONAS) {
      const [x, y, w] = z.rect as [number, number, number, number];
      const why = zoneBlock(s, z);
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x * S + 4, y * S + 4, Math.min(w * S - 8, 230), why ? 30 : 16);
      g.fillStyle = why ? "#ffb0b0" : "#ffffff"; g.textAlign = "left"; g.textBaseline = "top";
      g.fillText(`${why ? "🔒 " : ""}${z.nombre}`, x * S + 8, y * S + 7);
      if (why) { g.font = "9px sans-serif"; g.fillStyle = "rgba(255,255,255,0.8)"; g.fillText(why.length > 46 ? why.slice(0, 45) + "…" : why, x * S + 8, y * S + 20); g.font = "bold 10px sans-serif"; }
    }
    // player
    g.fillStyle = "#3b8fe6"; g.strokeStyle = "#ffffff"; g.lineWidth = 2;
    g.beginPath(); g.arc(s.pos.x * S, s.pos.y * S, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  }, [s, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * WORLD.w;
    const wy = ((e.clientY - rect.top) / rect.height) * WORLD.h;
    const hit = SUBZONAS.find((sz) => Math.hypot(sz.x - wx, sz.y - wy) <= 36) ?? null;
    setSelected(hit);
  };

  const seen = s.explored.filter((v) => v === 1).length;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel flex max-h-full w-full max-w-4xl flex-col p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">MAP</h3>
          <span className="text-[9px] text-white/80">Explored {Math.round((seen / (FOG_COLS * FOG_ROWS)) * 100)}% · Regions {s.visited.length}/{ZONAS.length} · Sites {s.subzonesVisited.length}/{SUBZONAS.length}</span>
          <button type="button" onClick={() => setOverlay(null)} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <canvas ref={ref} onClick={handleClick} width={WORLD.w * S} height={WORLD.h * S} className="min-h-0 w-full flex-1 cursor-crosshair rounded-[6px] border-2 border-[#0b1230] object-contain [image-rendering:pixelated]" aria-label="World map" />
        {selected && (
          <div className="mt-2 rounded bg-black/55 px-2.5 py-1.5 text-[9px] text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-gold">{selected.tipo === "jefe" ? "💀" : "⛏"} {selected.nombre}</span>
              <span className="text-[8px] text-white/70">{s.subzonesVisited.includes(selected.id) ? "✔ Explored" : "? Unexplored"}</span>
            </div>
            <div className="text-[8px] text-white/85">{selected.desc}</div>
            <div className="mt-0.5 text-[8px] text-[#b8ffd4]">
              Resources: {selected.recursos.map((r) => ITEMS[r]?.nombre ?? r).join(", ")}
              {selected.jefe && ` · Boss: ${BOSS_DEFS[selected.jefe]?.nombre ?? selected.jefe} (${s.bossesDefeated.includes(selected.jefe) ? "Defeated" : "Active"})`}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-[8px] text-white/80">
          <span><b className="text-[#3b8fe6]">●</b> You</span><span><b className="text-[#7fa8ff]">■</b> Habitat</span><span><b className="text-white">▮</b> Rocket</span>
          <span><b className="text-[#4ee68a]">●</b> Resource Land</span><span><b className="text-[#ff5c77]">●</b> Far Boss Zone</span>
          {s.specialCase && <span><b className="text-gold">★</b> Special Case</span>}
          <span>■ ? Unexplored</span><span>🔒 Locked zone</span>
          <span className="ml-auto text-white/60">Click a site pin for details</span>
        </div>
      </div>
    </div>
  );
}
