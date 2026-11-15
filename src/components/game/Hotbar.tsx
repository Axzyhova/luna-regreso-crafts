import { useGame, sim } from "@/game/store";
import { PLACEABLE } from "@/game/sim";
import { GEAR, CONSUMIBLES, toggleEquip, useConsumable } from "@/game/effects";
import { toast } from "@/game/events";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
import { sfx } from "@/game/audio";

/** Hotbar. In play: tap/click a slot to hold that item (modules enter build mode, gear is worn, consumables are used).
 *  In the inventory (editable): tap a slot to drop the item picked above, or drag an item onto it. */
export function Hotbar({ editable = false, pending = null, onAssign }: { editable?: boolean; pending?: string | null; onAssign?: () => void }) {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const inv = s.inv as unknown as Record<string, number>;
  const tap = (i: number) => {
    const key = sim.hotbarItems[i] ?? null;
    if (editable) {
      if (!pending) return;
      sim.hotbarItems = sim.hotbarItems.map((x) => (x === pending ? null : x));
      sim.hotbarItems[i] = pending; sfx.click(); onAssign?.(); publish();
      return;
    }
    sim.hotbar = i + 1;
    if (key && GEAR.includes(key)) { toggleEquip(sim, key); sfx.click(); publish(); return; }
    if (key && CONSUMIBLES.includes(key)) { const r = useConsumable(sim, key); r.ok ? sfx.ok() : sfx.bad(); toast(sim, r.msg, 2); publish(); return; }
    if (key && PLACEABLE[key] && (inv[key] ?? 0) >= 1) sim.buildMode = sim.buildMode === key ? null : key;
    else if (sim.buildMode) sim.buildMode = null;
    sfx.click(); publish();
  };
  return (
    <div className="pointer-events-auto flex gap-1">
      {s.hotbarItems.map((key, i) => (
        <button type="button" key={i} onClick={() => tap(i)} data-drop={editable ? `hotbar:${i}` : undefined}
          onDragOver={(e) => editable && e.preventDefault()}
          onDrop={(e) => { const k = e.dataTransfer.getData("text/item"); if (!k) return; sim.hotbarItems = sim.hotbarItems.map((x) => (x === k ? null : x)); sim.hotbarItems[i] = k; sfx.click(); publish(); }}
          onContextMenu={(e) => { if (!editable) return; e.preventDefault(); sim.hotbarItems[i] = null; publish(); }}
          title={editable ? "Tap or drop an item here · right-click to clear" : ITEMS[key ?? ""]?.nombre}
          className={`tr-slot relative flex h-11 w-11 touch-manipulation items-center justify-center sm:h-10 sm:w-10 short:h-9 short:w-9 ${s.hotbar === i + 1 ? "tr-slot-active" : ""} ${editable && pending ? "animate-pulse border-ok" : ""}`}>
          <span className="tr-text absolute left-1 top-0 text-[7px] short:text-[6px]">{i + 1}</span>
          {key && <PixelIcon item={key} size={22} className="short:h-[18px] short:w-[18px]" />}
          {key && <span className="tr-text absolute bottom-0 right-1 text-[8px] short:text-[7px]">{Math.floor(inv[key] ?? 0)}</span>}
        </button>
      ))}
    </div>
  );
}
