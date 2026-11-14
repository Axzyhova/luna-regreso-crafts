import { useRef, useState } from "react";
import { useGame } from "@/game/store";
import { touch } from "@/game/touch";
import { sfx } from "@/game/audio";

/** Keep receiving moves after the finger leaves the control (ignored if the browser refuses). */
const capture = (e: React.PointerEvent<HTMLElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ } };

/** Minecraft-like translucent grey square button style. */
export const MC_BTN = "border-2 border-t-white/40 border-l-white/40 border-r-black/40 border-b-black/50 bg-[#8b8b8b]/45 text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)] backdrop-blur-[1px]";
const MC_DOWN = "bg-[#bdbdbd]/70";

/**
 * 8-way direction from a finger position relative to the pad center.
 * Each axis turns on past a small dead zone, like pressing two arrow keys at once.
 */
export function padDirection(dx: number, dy: number, dead = 14) {
  const x = Math.abs(dx) > dead ? Math.sign(dx) : 0;
  const y = Math.abs(dy) > dead ? Math.sign(dy) : 0;
  const len = Math.hypot(x, y) || 1;
  return { vx: x / len, vy: y / len, x, y };
}

/** Minecraft-style D-pad: slide your thumb over the arrows (diagonals work). */
export function DPad() {
  const [dir, setDir] = useState({ x: 0, y: 0 });
  const center = useRef({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const move = (cx: number, cy: number) => {
    const d = padDirection(cx - center.current.x, cy - center.current.y);
    touch.vx = d.vx; touch.vy = d.vy;
    setDir({ x: d.x, y: d.y });
  };
  const end = () => { id.current = null; touch.vx = 0; touch.vy = 0; setDir({ x: 0, y: 0 }); };
  const S = 50; // square size in px
  const cell = (on: boolean, glyph: string, col: number, row: number) => (
    <div className={`pointer-events-none absolute flex items-center justify-center text-[18px] ${MC_BTN} ${on ? MC_DOWN : ""}`}
      style={{ width: S, height: S, left: col * S, top: row * S }}>{glyph}</div>
  );
  return (
    <div aria-label="D-pad: move" className="relative touch-none select-none" style={{ width: S * 3, height: S * 3 }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        id.current = e.pointerId; capture(e); move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (id.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={end} onPointerCancel={end}>
      {cell(dir.y < 0, "▲", 1, 0)}
      {cell(dir.x < 0, "◀", 0, 1)}
      {cell(dir.x === 0 && dir.y === 0 && id.current !== null, "◆", 1, 1)}
      {cell(dir.x > 0, "▶", 2, 1)}
      {cell(dir.y > 0, "▼", 1, 2)}
    </div>
  );
}

function McButton({ label, sub, onPress, onRelease, size = 56, className = "" }: { label: string; sub?: string; onPress: () => void; onRelease?: () => void; size?: number; className?: string }) {
  const [down, setDown] = useState(false);
  return (
    <button type="button" style={{ width: size, height: size }}
      className={`flex touch-none select-none flex-col items-center justify-center ${MC_BTN} ${down ? MC_DOWN : ""} ${className}`}
      onPointerDown={(e) => { e.preventDefault(); capture(e); setDown(true); onPress(); }}
      onPointerUp={() => { setDown(false); onRelease?.(); }}
      onPointerCancel={() => { setDown(false); onRelease?.(); }}
      onContextMenu={(e) => e.preventDefault()}>
      <span className="text-[14px] leading-none">{label}</span>
      {sub && <span className="mt-1 text-[6px] leading-none opacity-90">{sub}</span>}
    </button>
  );
}

/** Right-hand actions: big ACTION square, E (hold) and Build, Minecraft-style. */
export function ActionPad() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  return (
    <div className="flex select-none items-end gap-2">
      <div className="flex flex-col gap-2">
        {s.buildMode ? (
          <>
            <McButton label="⟳" sub="SWITCH" size={46} onPress={() => { touch.act.cycle(); publish(); }} />
            <McButton label="✕" sub="EXIT" size={46} onPress={() => { touch.act.build(); publish(); }} />
          </>
        ) : (
          <McButton label="🔨" sub="BUILD" size={46} onPress={() => { touch.act.build(); publish(); }} />
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <McButton label="E" sub="HOLD" size={54} onPress={() => { touch.e = true; touch.act.interact(); }} onRelease={() => { touch.e = false; }} />
        <McButton label="✋" sub={s.buildMode ? "PLACE" : "ACTION"} size={72} onPress={() => { touch.act.use(); publish(); }} />
      </div>
    </div>
  );
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    await document.documentElement.requestFullscreen();
    // Android Chrome can lock orientation only in fullscreen.
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape").catch(() => {});
  } catch { /* not supported (iOS Safari) */ }
}

type Menu = "base" | "log" | "pausa" | "misiones";

/** Top-center row of small square buttons, like Minecraft's emote/chat/pause buttons. */
export function MenuBar({ className = "" }: { className?: string }) {
  const overlay = useGame((g) => g.overlay);
  const setOverlay = useGame((g) => g.setOverlay);
  const go = (o: Menu) => { sfx.click(); setOverlay(overlay === o ? null : o); };
  const items: { label: string; icon: string; act: () => void }[] = [
    { label: "Missions", icon: "📜", act: () => go("misiones") },
    { label: "Base", icon: "🏠", act: () => go("base") },
    { label: "Log", icon: "📓", act: () => go("log") },
    { label: "Fullscreen", icon: "⛶", act: () => void toggleFullscreen() },
    { label: "Pause", icon: "⏸", act: () => go("pausa") },
  ];
  if (overlay) return null;
  return (
    <div className={`z-[8] flex gap-1 ${className}`}>
      {items.map((it) => (
        <button key={it.label} type="button" aria-label={it.label} title={it.label} onClick={it.act}
          className={`flex h-9 w-9 touch-manipulation items-center justify-center text-[14px] ${MC_BTN} active:bg-[#bdbdbd]/70`}>
          {it.icon}
        </button>
      ))}
    </div>
  );
}
