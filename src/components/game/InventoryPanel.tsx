import { useState } from "react";
import recetas from "@/data/recetas.json";
import { useGame, sim } from "@/game/store";
import { SLOTS, STACK, WATER_TANK_KG, usedSlots, recipeBlock, craft, dropItem, pourWater, healInHabitat } from "@/game/sim";
import { GEAR, CONSUMIBLES, toggleEquip, applyConsumable } from "@/game/effects";
import { ITEMS } from "@/game/items";
import { INV_ORDER } from "@/game/items";
import { ITEM_GUIDE } from "@/game/itemGuide";
import { bestTool, HANDS, TOOLS } from "@/game/tools";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";
import { Panel } from "./Panel";
import { CharacterDoll, wearGear } from "./CharacterDoll";
import { SuitControl } from "./SurvivalUI";
import { useItemDrag, type DragSource } from "./ItemDrag";
import { Hotbar } from "./Hotbar";

/** Inventory slots as the grid shows them: stacks of up to 50, water excluded (it lives in the base tank). */
export function inventoryStacks(inv: Record<string, number>) {
  const stacks: { key: string; n: number }[] = [];
  for (const key of INV_ORDER) {
    let n = Math.floor(inv[key] ?? 0);
    while (n > 0) { stacks.push({ key, n: Math.min(STACK, n) }); n -= STACK; }
  }
  return stacks;
}

const have = (o: { inv: unknown }, key: string) => Math.floor(((o.inv as Record<string, number>)[key]) ?? 0);

export function Inventory() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const [tab, setTab] = useState<"inv" | "craft">("inv");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inv = s.inv as unknown as Record<string, number>;
  const cells = Array.from({ length: SLOTS }, (_, i) => inventoryStacks(inv)[i] ?? null);
  const say = (m: string) => { setNote(m); setTimeout(() => setNote((c) => (c === m ? null : c)), 2600); };

  const throwAway = (key: string, n: number) => {
    const done = key === "agua" ? pourWater(sim, n) : dropItem(sim, key, n, sim.pos.x, sim.pos.y);
    sfx[done > 0 ? "click" : "bad"]();
    say(done > 0 ? (key === "agua" ? `Poured out ${Math.round(done)} kg of water` : `Dropped ${done} ${ITEMS[key]?.nombre ?? key} on the ground`) : "Nothing to drop");
    if (!(have(sim, key) > 0)) setSel((c) => (c === key ? null : c));
    publish();
  };
  const drag = useItemDrag((src: DragSource, target: string) => {
    if (target === "trash") throwAway(src.key, src.key === "agua" ? 999 : src.n);
    else if (target === "doll") { say(wearGear(src.key)); publish(); }
    else if (target.startsWith("hotbar:")) {
      const i = Number(target.split(":")[1]);
      sim.hotbarItems = sim.hotbarItems.map((x) => (x === src.key ? null : x)); sim.hotbarItems[i] = src.key; sfx.click(); publish();
    }
  });
  const tool = bestTool(s.inv);
  const nextTool = TOOLS.slice().reverse().find((t) => t.tier > tool.tier);
  const info = sel ? ITEMS[sel] : null, guide = sel ? ITEM_GUIDE[sel] : null;
  const selCount = sel ? have(s, sel) : 0;
  const waterPct = Math.min(100, (s.inv.agua / WATER_TANK_KG) * 100);

  return (
    <Panel title="INVENTORY" wide dropOutside>
      <SuitControl className="mb-2 short:mb-1" />
      <div className="mb-2 flex items-center gap-2 short:mb-1">
        {(["inv", "craft"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); sfx.click(); }} className={`tr-btn px-3 py-2 text-[9px] short:py-1 ${tab === t ? "tr-btn-primary" : "opacity-80"}`}>{t === "inv" ? "Items" : "Crafting"}</button>
        ))}
        <span className="ml-auto text-right text-[7px] text-white/60">{usedSlots(s.inv)}/{SLOTS} slots</span>
      </div>

      {tab === "inv" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start short:flex-row short:gap-2">
            <div className="flex shrink-0 justify-center"><CharacterDoll dragging={!!drag.dragging && GEAR.includes(drag.dragging.key)} /></div>

            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-4 gap-1 short:gap-0.5" aria-label="Inventory slots">
                {cells.map((c, i) => (
                  <div key={i} {...(c ? drag.bind({ key: c.key, n: c.n, from: "inv" }) : {})}
                    onClick={() => { if (!c || drag.justDragged()) return; setSel(sel === c.key ? null : c.key); sfx.click(); }}
                    title={c ? ITEMS[c.key]?.nombre : undefined}
                    className={`tr-slot relative flex h-16 w-16 flex-col items-center justify-center short:h-9 short:w-9 ${c ? `cursor-grab ${sel === c.key ? "tr-slot-active" : ""}` : "opacity-80"}`}>
                    {c && <>
                      <PixelIcon item={c.key} size={28} className="short:h-5 short:w-5" />
                      <span className="mt-0.5 max-w-full truncate px-0.5 text-[5px] text-white/70 short:hidden">{ITEMS[c.key]?.nombre}</span>
                      <span className="tr-text absolute bottom-0.5 right-1 text-[9px] short:bottom-0 short:right-0.5 short:text-[7px]">{c.n}</span>
                      {s.equip.includes(c.key) && <span className="absolute left-1 top-1 rounded-sm bg-ok px-0.5 text-[5px] text-background short:left-0 short:top-0">ON</span>}
                    </>}
                  </div>
                ))}
              </div>
              <div data-drop="trash" className={`flex items-center justify-center gap-1 rounded-[7px] border-2 border-dashed px-2 py-1 text-[6px] transition-colors short:py-0.5 ${drag.dragging ? "border-alert bg-alert/15 text-alert" : "border-white/25 text-white/55"}`}>
                🗑 DROP HERE <span className="text-white/40">· or drop anywhere outside</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 short:gap-1">
              {/* water tank: water never uses inventory slots */}
              <div className="tr-slot flex items-center gap-2 !rounded-[7px] px-2 py-1.5 short:py-1">
                <div {...drag.bind({ key: "agua", n: Math.floor(s.inv.agua), from: "tank" })} className="flex shrink-0 cursor-grab items-center" title="Drag to a hotbar slot or to DROP to pour it out"><PixelIcon item="agua" size={22} className="short:h-4 short:w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[6px]"><span className="text-white/80">WATER TANK</span><span className="tr-text tabular-nums">{Math.round(s.inv.agua)}/{WATER_TANK_KG} kg</span></div>
                  <div className="tr-bar mt-0.5 !h-1.5"><div className="bg-suit-light" style={{ width: `${waterPct}%` }} /></div>
                </div>
                <button type="button" onClick={() => { const r = applyConsumable(sim, "agua"); sfx[r.ok ? "ok" : "bad"](); say(r.msg); publish(); }} className="tr-btn px-1.5 py-1 text-[6px]">DRINK</button>
                <button type="button" onClick={() => throwAway("agua", 25)} className="tr-btn px-1.5 py-1 text-[6px]" title="Pour out 25 kg">POUR</button>
              </div>
              {s.near.habitat && s.health < 100 && (
                <button
                  type="button"
                  onClick={() => { const r = healInHabitat(sim); sfx[r.ok ? "ok" : "bad"](); say(r.msg); publish(); }}
                  className="tr-btn tr-btn-primary px-2 py-1.5 text-[7px]"
                >
                  🏥 REST & HEAL (+35 HP · 5 kg Water)
                </button>
              )}

              {/* what you gather with */}
              <div className="tr-slot flex items-center gap-2 !rounded-[7px] px-2 py-1.5 text-[6px] leading-3 short:py-1">
                {tool.key ? <PixelIcon item={tool.key} size={22} className="short:h-4 short:w-4" /> : <span className="w-[22px] text-center text-[14px] short:w-4">✋</span>}
                <div className="min-w-0">
                  <div className="text-gold">TOOL: {tool.name.toUpperCase()}</div>
                  <div className="text-white/75">{tool === HANDS ? HANDS.blurb : tool.blurb}</div>
                  {nextTool && <div className="text-ok">Next: {nextTool.name} → {nextTool.tier >= 2 ? "Alien alloy" : "Frost crystals + Titanium"}</div>}
                </div>
              </div>

              {/* selected item */}
              <div className="tr-slot min-h-[3.2rem] !rounded-[7px] px-2 py-1.5 text-[7px] leading-4 short:py-1 short:leading-3">
                {sel && info ? (<>
                  <div className="flex items-center justify-between gap-2"><span className="text-[9px] text-gold short:text-[8px]">{info.nombre} <span className="text-white/60">×{selCount}</span></span></div>
                  <div className="text-white/85">{info.desc}</div>
                  {guide && <div className="mt-0.5 text-white/70 short:hidden"><span className="text-ok">USED FOR</span> {guide.uso} <span className="text-suit-light">FROM</span> {guide.origen}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {CONSUMIBLES.includes(sel) && <button type="button" onClick={() => { const r = applyConsumable(sim, sel); sfx[r.ok ? "ok" : "bad"](); say(r.msg); publish(); }} className="tr-btn tr-btn-primary px-2 py-1 text-[7px]">USE</button>}
                    {GEAR.includes(sel) && <button type="button" onClick={() => { say(toggleEquip(sim, sel)); sfx.click(); publish(); }} className="tr-btn tr-btn-primary px-2 py-1 text-[7px]">{s.equip.includes(sel) ? "TAKE OFF" : "EQUIP"}</button>}
                    <button type="button" onClick={() => throwAway(sel, 1)} className="tr-btn px-2 py-1 text-[7px]">DROP 1</button>
                    {selCount > 1 && <button type="button" onClick={() => throwAway(sel, selCount)} className="tr-btn px-2 py-1 text-[7px]">DROP ALL</button>}
                  </div>
                </>) : <span className="text-white/55">Tap an item for what it does. Drag it to the doll (gear), a hotbar slot, or 🗑 to throw it away.</span>}
              </div>
              <div className="min-h-3 text-[7px] text-ok">{note}</div>
            </div>
          </div>
          {drag.ghost}
          <Hotbar editable pending={sel} onAssign={() => setSel(null)} />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[7px] text-white/60">Near: {s.near.taller ? <span className="text-ok">Workshop</span> : "—"} {s.near.horno ? <span className="text-ok">· Furnace</span> : ""}</div>
          {recetas.map((r) => {
            const block = recipeBlock(s, r);
            return (
              <div key={r.id} className={`flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 text-[8px] short:text-[7px] ${block ? "opacity-60 grayscale" : ""}`}>
                <div className="flex items-center gap-2">
                  <PixelIcon item={Object.keys(r.resultado)[0]!} size={20} className="short:h-4 short:w-4" />
                  <div>
                    <div>{r.nombre} <span className="text-[6px] text-suit-light">[{r.lugar === "mano" ? "BY HAND" : r.lugar.toUpperCase()}]</span></div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2">
                      {Object.entries(r.ingredientes).map(([k, v]) => (
                        <span key={k} className={(inv[k] ?? 0) >= (v ?? 0) ? "text-white/60" : "text-destructive"}>{v} {ITEMS[k]?.nombre ?? k} ({Math.floor(inv[k] ?? 0)})</span>
                      ))}
                    </div>
                    {block && block !== "Missing materials" && <div className="text-[6px] text-alert">{block}</div>}
                  </div>
                </div>
                <button disabled={!!block} onClick={() => { if (craft(sim, r)) { sfx.ok(); publish(); } }} className="tr-btn tr-btn-primary px-2 py-1 disabled:opacity-30">CRAFT</button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
