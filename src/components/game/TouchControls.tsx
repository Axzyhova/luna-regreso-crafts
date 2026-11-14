import { useEffect, useRef, useState } from "react";
import { touch } from "@/game/touch";
import { useGame, sim } from "@/game/store";
import type { Overlay } from "@/game/store";

/** On-screen joystick + action buttons, shown only on touch devices. */
export function TouchControls() {
  const [show, setShow] = useState(false);
  const buildMode = useGame((g) => g.snap.buildMode);
  const inside = useGame((g) => g.snap.inside);
  const overlay = useGame((g) => g.overlay);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);

  useEffect(() => {
    setShow(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    return () => { touch.vx = 0; touch.vy = 0; touch.e = false; };
  }, []);
  if (!show) return null;

  const move = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const max = r.width / 2, d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy });
    touch.vx = Math.abs(dx / max) > 0.15 ? dx / max : 0;
    touch.vy = Math.abs(dy / max) > 0.15 ? dy / max : 0;
  };
  const release = () => { pid.current = null; setKnob({ x: 0, y: 0 }); touch.vx = 0; touch.vy = 0; };
  const open = (o: Overlay) => useGame.getState().setOverlay(useGame.getState().overlay === o ? null : o);
  const btn = "select-none touch-none border-2 border-moon-2 bg-background/70 text-[8px] active:bg-primary active:text-primary-foreground";

  if (overlay) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[4]">
      <div ref={base} aria-label="Joystick"
        className="pointer-events-auto absolute bottom-24 left-6 h-28 w-28 touch-none rounded-full border-2 border-moon-2 bg-background/40"
        onPointerDown={(e) => { pid.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX, e.clientY); }}
        onPointerMove={(e) => pid.current === e.pointerId && move(e.clientX, e.clientY)}
        onPointerUp={release} onPointerCancel={release}>
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-suit/80" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <div className="pointer-events-auto absolute bottom-24 right-4 grid grid-cols-2 gap-2">
        <button className={`${btn} h-16 w-16 rounded-full text-[12px] text-gold`}
          onPointerDown={(e) => { e.preventDefault(); touch.emit("e-down"); }} onPointerUp={() => touch.emit("e-up")} onPointerCancel={() => touch.emit("e-up")} onPointerLeave={() => touch.e && touch.emit("e-up")}>E</button>
        {!inside && <button className={`${btn} h-16 w-16 rounded-full`} onPointerDown={(e) => { e.preventDefault(); touch.emit("use"); }}>{buildMode ? "PONER" : "USAR"}</button>}
        {!inside && <button className={`${btn} h-10 w-16`} onPointerDown={(e) => { e.preventDefault(); touch.emit("build"); }}>{buildMode ? "SALIR" : "CONSTR."}</button>}
        {!inside && buildMode && <button className={`${btn} h-10 w-16`} onPointerDown={(e) => { e.preventDefault(); touch.emit("cycle"); }}>CAMBIAR</button>}
      </div>
      <div className="pointer-events-auto absolute right-20 top-16 flex flex-col gap-1">
        {([["inv", "INV"], ["base", "BASE"], ["log", "LOG"], ["pausa", "II"]] as const).map(([o, l]) => (
          <button key={o} className={`${btn} px-2 py-1`} onClick={() => { if (sim.tip) sim.tip = null; open(o); }}>{l}</button>
        ))}
      </div>
    </div>
  );
}
