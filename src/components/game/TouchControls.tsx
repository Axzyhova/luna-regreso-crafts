import { useRef, useState } from "react";
import { useGame } from "@/game/store";
import { touch, stickVector } from "@/game/touch";
import { sfx } from "@/game/audio";

const R = 46;
/** Keep receiving moves after the finger leaves the control (ignored if the browser refuses). */
const capture = (e: React.PointerEvent<HTMLElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ } }; // joystick radius in CSS px

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
      className="relative flex h-32 w-32 shrink-0 touch-none select-none items-center justify-center rounded-full border-4 border-moon-2 bg-moon-0/80"
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
      <div className="pointer-events-none absolute text-[6px] text-muted-foreground" style={{ top: 6 }}>▲</div>
      <div className="pointer-events-none absolute text-[6px] text-muted-foreground" style={{ bottom: 6 }}>▼</div>
      <div className="pointer-events-none absolute text-[6px] text-muted-foreground" style={{ left: 8 }}>◀</div>
      <div className="pointer-events-none absolute text-[6px] text-muted-foreground" style={{ right: 8 }}>▶</div>
      <div className="pointer-events-none h-12 w-12 rounded-full border-4 border-suit-light bg-suit shadow-[0_3px_0_0_var(--color-moon-0)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
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
      <span className="text-[10px]">{label}</span>
      {sub && <span className="mt-0.5 text-[6px] opacity-80">{sub}</span>}
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

/** On-screen controls for phones/tablets: joystick on the left, actions on the right. */
export function TouchControls({ floating = false }: { floating?: boolean }) {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const overlay = useGame((g) => g.overlay);
  const publish = useGame((g) => g.publish);
  const open = (o: "inv" | "base" | "log" | "pausa") => { sfx.click(); setOverlay(overlay === o ? null : o); };
  const small = "h-10 px-1 border-moon-2 bg-secondary text-secondary-foreground";
  const menu = (
    <div className="pointer-events-auto grid grid-cols-5 gap-1">
      <Btn label="🎒" sub="INV" onPress={() => open("inv")} className={small} />
      <Btn label="🏠" sub="BASE" onPress={() => open("base")} className={small} />
      <Btn label="📓" sub="LOG" onPress={() => open("log")} className={small} />
      <Btn label="⏸" sub="PAUSA" onPress={() => open("pausa")} className={small} />
      <Btn label="⛶" sub="PANT." onPress={() => void toggleFullscreen()} className={small} />
    </div>
  );
  return (
    <div className={`${floating ? "pointer-events-none absolute inset-x-0 bottom-28 z-[6]" : "relative"} flex select-none flex-col gap-2 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-1 ${overlay ? "invisible" : ""}`}>
      {!floating && menu}
      <div className="flex items-end justify-between gap-2">
      <div className="pointer-events-auto"><Joystick /></div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {floating && menu}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-2">
            {s.buildMode ? (
              <>
                <Btn label="⟳" sub="CAMBIA" onPress={() => { touch.act.cycle(); publish(); }} className={`${small} h-12 w-14`} />
                <Btn label="✕" sub="SALIR" onPress={() => { touch.act.build(); publish(); }} className={`${small} h-12 w-14 border-destructive`} />
              </>
            ) : (
              <Btn label="🔨" sub="CREAR" onPress={() => { touch.act.build(); publish(); }} className={`${small} h-12 w-14`} />
            )}
          </div>
          <Btn label="E" sub="MANTÉN" onPress={() => { touch.e = true; touch.act.interact(); }} onRelease={() => { touch.e = false; }}
            className="h-14 w-14 rounded-full border-suit-light bg-suit text-white" />
          <Btn label="A" sub={s.buildMode ? "COLOCAR" : "ACCIÓN"} onPress={() => { touch.act.use(); publish(); }}
            className="h-[72px] w-[72px] rounded-full border-gold bg-alert text-background" />
        </div>
      </div>
      </div>
    </div>
  );
}
