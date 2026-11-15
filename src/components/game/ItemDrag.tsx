import { useCallback, useEffect, useRef, useState } from "react";
import { PixelIcon } from "./PixelIcon";

/**
 * Drag & drop for items that works the same with a mouse and with a finger (pointer events, not HTML5 drag).
 *
 * - Start a drag from any element with `bind(source)`.
 * - Drop targets are elements with `data-drop="name"`; a target with `data-drop-self="name"` only counts when
 *   the pointer is directly over it (used for the dim backdrop, so releasing anywhere inside a panel isn't a drop).
 * - A press that barely moves is a normal tap/click, so selecting an item keeps working.
 */
export interface DragSource { key: string; n: number; from: string }
interface Active { src: DragSource; x: number; y: number; x0: number; y0: number }
const THRESHOLD = 7;

export const dropTargetAt = (x: number, y: number): string | null => {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const self = el.getAttribute("data-drop-self");
  if (self) return self;
  return el.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
};

export function useItemDrag(onDrop: (src: DragSource, target: string) => void) {
  const [drag, setDrag] = useState<Active | null>(null);
  const moved = useRef(false);
  const cb = useRef(onDrop); cb.current = onDrop;
  const active = !!drag;
  const key = drag?.src.key, from = drag?.src.from;

  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => setDrag((d) => { if (!d) return d; if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > THRESHOLD) moved.current = true; return { ...d, x: e.clientX, y: e.clientY }; });
    const up = (e: PointerEvent) => {
      setDrag((d) => { if (d && moved.current) { const t = dropTargetAt(e.clientX, e.clientY); if (t) cb.current(d.src, t); } return null; });
      // the click that follows a drag must not also select/use the item
      setTimeout(() => { moved.current = false; }, 0);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [active, key, from]);

  const bind = useCallback((src: DragSource) => ({
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === "mouse" && e.button !== 0) return; moved.current = false; setDrag({ src, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); },
    style: { touchAction: "none" } as React.CSSProperties,
    draggable: false,
  }), []);

  const dragging = drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > THRESHOLD ? drag : null;
  const ghost = dragging ? (
    <div className="tr-slot tr-slot-active pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 scale-110 items-center justify-center p-1.5 shadow-lg" style={{ left: dragging.x, top: dragging.y }}>
      <PixelIcon item={dragging.src.key} size={28} />
      {dragging.src.n > 1 && <span className="tr-text absolute bottom-0 right-1 text-[8px]">{dragging.src.n}</span>}
    </div>
  ) : null;
  /** True right after a drag: the caller's onClick should ignore it. */
  const justDragged = () => moved.current;
  return { bind, ghost, dragging: dragging?.src ?? null, justDragged };
}
