import { useState } from "react";
import { useGame, sim } from "@/game/store";
import { SLOTS, usedSlots } from "@/game/sim";
import { ITEMS } from "@/game/items";
import { INV_ORDER } from "@/game/itemGuide";
import { CHEST_SLOTS, CHEST_STACK, chestUsed, deposit, depositAll, withdraw, withdrawAll } from "@/game/storage";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";
import { Panel } from "./Panel";
import { useItemDrag, type DragSource } from "./ItemDrag";
import { inventoryStacks } from "./InventoryPanel";

type Side = "inv" | "chest";

/** Stacks of the chest's contents, in the same order as the inventory grid. */
export function chestStacks(storage: Record<string, number> | undefined) {
  const out: { key: string; n: number }[] = [];
  const keys = [...INV_ORDER, ...Object.keys(storage ?? {}).filter((k) => !INV_ORDER.includes(k))];
  for (const key of keys) { let n = Math.floor(storage?.[key] ?? 0); while (n > 0) { out.push({ key, n: Math.min(CHEST_STACK, n) }); n -= CHEST_STACK; } }
  return out;
}

/** Storage chest: move items between your inventory and the chest by dragging, or with the buttons. */
export function ChestPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const chest = s.modules.find((m) => m.uid === s.chestUid && m.tipo === "cofre");
  const [sel, setSel] = useState<{ key: string; side: Side } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const say = (m: string) => { setNote(m); setTimeout(() => setNote((c) => (c === m ? null : c)), 2600); };
  const uid = s.chestUid;

  const move = (side: Side, key: string, n: number) => {
    const moved = side === "inv" ? deposit(sim, uid, key, n) : withdraw(sim, uid, key, n);
    if (moved > 0) { sfx.click(); say(`${side === "inv" ? "Stored" : "Took"} ${moved} ${ITEMS[key]?.nombre ?? key}`); }
    else { sfx.bad(); say(side === "inv" ? "The chest is full" : "Your inventory is full"); }
    publish();
  };
  const drag = useItemDrag((src: DragSource, target: string) => {
    if (src.from === "inv" && target === "chest") move("inv", src.key, src.n);
    else if (src.from === "chest" && target === "inv") move("chest", src.key, src.n);
  });
  const invCells = Array.from({ length: SLOTS }, (_, i) => inventoryStacks(s.inv as unknown as Record<string, number>)[i] ?? null);
  const chestCells = Array.from({ length: CHEST_SLOTS }, (_, i) => chestStacks(chest?.storage)[i] ?? null);
  const selCount = sel ? Math.floor(((sel.side === "inv" ? (s.inv as unknown as Record<string, number>) : chest?.storage ?? {})[sel.key]) ?? 0) : 0;

  const cell = (c: { key: string; n: number } | null, side: Side, i: number) => (
    <div key={i} {...(c ? drag.bind({ key: c.key, n: c.n, from: side }) : {})}
      onClick={() => { if (!c || drag.justDragged()) return; setSel(sel?.key === c.key && sel.side === side ? null : { key: c.key, side }); sfx.click(); }}
      title={c ? ITEMS[c.key]?.nombre : undefined}
      className={`tr-slot relative flex h-12 w-12 items-center justify-center short:h-8 short:w-8 ${c ? `cursor-grab ${sel?.key === c.key && sel.side === side ? "tr-slot-active" : ""}` : "opacity-80"}`}>
      {c && <><PixelIcon item={c.key} size={24} className="short:h-4 short:w-4" /><span className="tr-text absolute bottom-0 right-0.5 text-[8px] short:text-[6px]">{c.n}</span></>}
    </div>
  );

  if (!chest) return <Panel title="STORAGE CHEST"><p className="text-[9px]">This chest is gone.</p></Panel>;
  return (
    <Panel title={`STORAGE CHEST · ${chestUsed(chest.storage)}/${CHEST_SLOTS} slots`} wide>
      <div className="grid gap-3 sm:grid-cols-2 short:grid-cols-2 short:gap-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-[7px] text-white/70"><span className="text-gold">YOUR INVENTORY</span><span>{usedSlots(s.inv)}/{SLOTS}</span></div>
          <div data-drop="inv" className={`grid grid-cols-5 gap-1 rounded-[8px] p-1 short:gap-0.5 ${drag.dragging?.from === "chest" ? "ring-2 ring-ok" : ""}`}>{invCells.map((c, i) => cell(c, "inv", i))}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[7px] text-white/70"><span className="text-gold">CHEST</span><span>stacks of {CHEST_STACK}</span></div>
          <div data-drop="chest" className={`grid grid-cols-6 gap-1 rounded-[8px] p-1 short:gap-0.5 ${drag.dragging?.from === "inv" ? "ring-2 ring-ok" : ""}`}>{chestCells.map((c, i) => cell(c, "chest", i))}</div>
        </div>
      </div>
      {drag.ghost}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 short:mt-1">
        {sel && selCount > 0 ? (<>
          <span className="text-[8px] text-gold">{ITEMS[sel.key]?.nombre} ×{selCount}</span>
          {[1, 10].map((n) => selCount >= n && <button key={n} type="button" onClick={() => move(sel.side, sel.key, n)} className="tr-btn px-2 py-1 text-[7px]">{sel.side === "inv" ? "STORE" : "TAKE"} {n}</button>)}
          <button type="button" onClick={() => move(sel.side, sel.key, selCount)} className="tr-btn tr-btn-primary px-2 py-1 text-[7px]">{sel.side === "inv" ? "STORE ALL" : "TAKE ALL"}</button>
        </>) : <span className="text-[7px] text-white/55">Tap an item (or drag it across) to move it.</span>}
        <span className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => { const n = depositAll(sim, uid); sfx[n > 0 ? "ok" : "bad"](); say(n > 0 ? `Stored ${n} items (tools and gear stay with you)` : "Nothing to store"); publish(); }} className="tr-btn px-2 py-1 text-[7px]">STORE EVERYTHING</button>
          <button type="button" onClick={() => { const n = withdrawAll(sim, uid); sfx[n > 0 ? "ok" : "bad"](); say(n > 0 ? `Took ${n} items` : "Nothing to take"); publish(); }} className="tr-btn px-2 py-1 text-[7px]">TAKE EVERYTHING</button>
        </span>
      </div>
      <div className="mt-1 min-h-3 text-[7px] text-ok">{note}</div>
    </Panel>
  );
}
