import { useGame, sim } from "@/game/store";
import { moveToChest, moveFromChest, CHEST_SLOTS, SLOTS, STACK } from "@/game/sim";
import { ITEMS, INV_ORDER } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";

const stacksOf = (rec: Record<string, number>) => {
  const out: { key: string; n: number }[] = [];
  for (const key of INV_ORDER) { let n = Math.floor(rec[key] ?? 0); while (n > 0) { out.push({ key, n: Math.min(STACK, n) }); n -= STACK; } }
  return out;
};

function Grid({ title, cells, total, onPick, hint }: { title: string; cells: { key: string; n: number }[]; total: number; onPick: (k: string, all: boolean) => void; hint: string }) {
  return (
    <div className="flex-1">
      <div className="tr-text mb-1 text-[9px]">{title} <span className="text-white/60">({cells.length}/{total})</span></div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: total }, (_, i) => cells[i]).map((c, i) => (
          <button key={i} type="button" disabled={!c} title={c ? `${ITEMS[c.key]?.nombre} — tap: move 1 · double-tap / right-click: move stack` : ""}
            onClick={() => c && onPick(c.key, false)} onDoubleClick={() => c && onPick(c.key, true)} onContextMenu={(e) => { e.preventDefault(); if (c) onPick(c.key, true); }}
            className="tr-slot relative flex h-11 w-11 items-center justify-center">
            {c && <PixelIcon item={c.key} size={22} />}
            {c && <span className="tr-text absolute bottom-0 right-1 text-[9px]">{c.n}</span>}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[8px] text-white/60">{hint}</p>
    </div>
  );
}

/** Storage chest: tap an item to move one across, double-tap (or right-click) to move the whole stack. */
export function ChestPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const uid = s.chestUid;
  const chest = s.chests[String(uid)] ?? {};
  const inv = s.inv as unknown as Record<string, number>;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-3xl overflow-auto p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">STORAGE CHEST</h3>
          <button type="button" onClick={() => setOverlay(null)} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row short:flex-row">
          <Grid title="Your inventory" cells={stacksOf(inv)} total={SLOTS} hint="Tap: store 1 · double-tap: store the stack"
            onPick={(k, all) => { if (moveToChest(sim, uid, k, all ? STACK : 1)) sfx.click(); else sfx.bad(); publish(); }} />
          <Grid title="Chest" cells={stacksOf(chest)} total={CHEST_SLOTS} hint="Tap: take 1 · double-tap: take the stack"
            onPick={(k, all) => { if (moveFromChest(sim, uid, k, all ? STACK : 1)) sfx.click(); else sfx.bad(); publish(); }} />
        </div>
      </div>
    </div>
  );
}
