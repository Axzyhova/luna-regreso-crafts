import { useRef, useState } from "react";
import { useGame } from "@/game/store";
import { touch, stickVector } from "@/game/touch";
import { sfx } from "@/game/audio";

const R = 58; // joystick radius in CSS px
/** Keep receiving moves after the finger leaves the control (ignored if the browser refuses). */
const capture = (e: React.PointerEvent<HTMLElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ } };

/** Virtual joystick: drag anywhere on the pad; the knob follows and writes an analog vector. */
function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const center = useRef({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const move = (cx: number, cy: number) => {
    const dx = cx - center.current.x, dy = cy - center.current.y;
    const v = stickVector(dx, dy, R);
    touch.vx = v.vx; touch.vy = v.vy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, R / len);
    setKnob({ x: dx * k, y: dy * k });
  };
  const end = () => { id.current = null; touch.vx = 0; touch.vy = 0; setKnob({ x: 0, y: 0 }); };
  return (
    <div
      aria-label="Joystick: mover"
      className="relative flex h-40 w-40 shrink-0 touch-none select-none items-center justify-center rounded-full border-4 border-moon-2 bg-moon-0/80"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        id.current = e.pointerId;
        capture(e);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (id.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="pointer-events-none absolute text-[7px] text-muted-foreground" style={{ top: 8 }}>▲</div>
      <div className="pointer-events-none absolute text-[7px] text-muted-foreground" style={{ bottom: 8 }}>▼</div>
      <div className="pointer-events-none absolute text-[7px] text-muted-foreground" style={{ left: 10 }}>◀</div>
      <div className="pointer-events-none absolute text-[7px] text-muted-foreground" style={{ right: 10 }}>▶</div>
      <div className="pointer-events-none h-16 w-16 rounded-full border-4 border-suit-light bg-suit shadow-[0_3px_0_0_var(--color-moon-0)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function Btn({ label, sub, onPress, onRelease, className = "" }: { label: string; sub?: string; onPress: () => void; onRelease?: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`flex touch-none select-none flex-col items-center justify-center border-4 shadow-[0_4px_0_0_var(--color-moon-0)] active:translate-y-1 active:shadow-none ${className}`}
      onPointerDown={(e) => { e.preventDefault(); capture(e); onPress(); }}
      onPointerUp={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="text-[12px]">{label}</span>
      {sub && <span className="mt-0.5 text-[7px] opacity-80">{sub}</span>}
    </button>
  );
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    await document.documentElement.requestFullscreen();
    // Android Chrome allows locking orientation only in fullscreen.
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("portrait").catch(() => {});
  } catch { /* not supported (iOS Safari) */ }
}

type Menu = "base" | "log" | "pausa" | "misiones";

/** Top-right drop-down with the less frequent actions (Base, Misiones, Log, Pausa, Pantalla completa). */
export function MobileMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const overlay = useGame((g) => g.overlay);
  const setOverlay = useGame((g) => g.setOverlay);
  const go = (o: Menu) => { sfx.click(); setOpen(false); setOverlay(overlay === o ? null : o); };
  const items: { label: string; icon: string; act: () => void }[] = [
    { label: "Base", icon: "🏠", act: () => go("base") },
    { label: "Misiones", icon: "📜", act: () => go("misiones") },
    { label: "Log", icon: "📓", act: () => go("log") },
    { label: "Pausa", icon: "⏸", act: () => go("pausa") },
    { label: "Pantalla completa", icon: "⛶", act: () => { setOpen(false); void toggleFullscreen(); } },
  ];
  if (overlay) return null;
  return (
    <div className={`z-[8] flex flex-col items-end ${className}`}>
      <button type="button" aria-label="Menú" aria-expanded={open} onClick={() => { sfx.click(); setOpen(!open); }}
        className="flex h-11 w-11 touch-manipulation items-center justify-center border-4 border-moon-2 bg-secondary text-[14px] shadow-[0_3px_0_0_var(--color-moon-0)]">
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div className="mt-1 flex min-w-40 flex-col border-4 border-suit bg-card shadow-lg">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={it.act} className="flex touch-manipulation items-center gap-2 border-b border-border px-3 py-3 text-left text-[9px] last:border-b-0 active:bg-secondary">
              <span className="text-[13px]">{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** On-screen controls for phones/tablets: big joystick on the left, actions on the right. */
export function TouchControls({ floating = false }: { floating?: boolean }) {
  const s = useGame((g) => g.snap);
  const overlay = useGame((g) => g.overlay);
  const publish = useGame((g) => g.publish);
  const side = "h-14 w-16 px-1 border-moon-2 bg-secondary text-secondary-foreground";
  return (
    <div className={`${floating ? "pointer-events-none absolute inset-x-0 bottom-28 z-[6]" : "relative"} flex select-none items-end justify-between gap-2 px-4 pb-[max(env(safe-area-inset-bottom),22px)] pt-2 ${overlay ? "invisible" : ""}`}>
      <div className="pointer-events-auto"><Joystick /></div>
      <div className="pointer-events-auto flex items-end gap-2">
        <div className="flex flex-col gap-2">
          {s.buildMode ? (
            <>
              <Btn label="⟳" sub="CAMBIA" onPress={() => { touch.act.cycle(); publish(); }} className={side} />
              <Btn label="✕" sub="SALIR" onPress={() => { touch.act.build(); publish(); }} className={`${side} border-destructive`} />
            </>
          ) : (
            <Btn label="🔨" sub="CREAR" onPress={() => { touch.act.build(); publish(); }} className={side} />
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Btn label="A" sub={s.buildMode ? "COLOCAR" : "ACCIÓN"} onPress={() => { touch.act.use(); publish(); }}
            className="h-24 w-24 rounded-full border-gold bg-alert text-background" />
          <Btn label="E" sub="MANTÉN" onPress={() => { touch.e = true; touch.act.interact(); }} onRelease={() => { touch.e = false; }}
            className="h-16 w-16 rounded-full border-suit-light bg-suit text-white" />
        </div>
      </div>
    </div>
  );
}
