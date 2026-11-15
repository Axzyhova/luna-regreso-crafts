import { useGame } from "@/game/store";

/**
 * Full-screen dimmed overlay with a framed panel in the middle. Used by every menu.
 * `dropOutside`: releasing a dragged item on the dim area (outside the panel) counts as "drop it".
 */
export function Panel({ title, children, wide = false, dropOutside = false }: { title: string; children: React.ReactNode; wide?: boolean; dropOutside?: boolean }) {
  const close = () => useGame.getState().setOverlay(null);
  return (
    <div data-drop-self={dropOutside ? "trash" : undefined} className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4 short:p-1">
      <div className={`tr-panel max-h-full w-full overflow-auto p-4 short:p-2 ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        <div className="mb-4 flex items-center justify-between short:mb-1.5"><h3 className="tr-title text-[11px] text-gold short:text-[9px]">{title}</h3><button onClick={close} aria-label="Close" className="tr-btn px-2 py-1 text-[9px]">✕</button></div>
        {children}
      </div>
    </div>
  );
}
