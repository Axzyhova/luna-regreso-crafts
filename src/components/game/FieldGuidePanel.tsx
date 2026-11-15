import { useState } from "react";
import { useGame } from "@/game/store";
import { ITEMS } from "@/game/items";
import { MATERIAL_GUIDE, CREATURE_GUIDE } from "@/game/guide";
import { PixelIcon } from "./PixelIcon";

/**
 * Field Guide / Compendium: shows what each material looks like (pixel icon),
 * where to find it, and what creatures/bosses you've encountered.
 */
export function FieldGuidePanel() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const [tab, setTab] = useState<"materials" | "creatures">("materials");
  const inv = s.inv as unknown as Record<string, number>;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-3xl overflow-auto p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="tr-title text-[11px] text-gold">📖 FIELD GUIDE</h3>
          <div className="flex gap-1">
            <button type="button" onClick={() => setTab("materials")} className={`tr-btn px-2 py-1 text-[8px] ${tab === "materials" ? "border-gold text-gold" : ""}`}>
              MATERIALS ({s.discoveredItems.length}/{MATERIAL_GUIDE.length})
            </button>
            <button type="button" onClick={() => setTab("creatures")} className={`tr-btn px-2 py-1 text-[8px] ${tab === "creatures" ? "border-gold text-gold" : ""}`}>
              CREATURES ({s.creaturesSeen.length + s.alienSeen.length}/{CREATURE_GUIDE.length})
            </button>
          </div>
          <button type="button" onClick={() => setOverlay(null)} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>

        {tab === "materials" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {MATERIAL_GUIDE.map((m) => {
              const info = ITEMS[m.id];
              const found = s.discoveredItems.includes(m.id) || (inv[m.id] ?? 0) > 0;
              return (
                <div key={m.id} className={`flex gap-2.5 rounded-[8px] border-2 p-2 ${found ? "border-[#0b1230] bg-white/90 text-[#14141c]" : "border-white/20 bg-black/35 text-white/80"}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-black/20">
                    <PixelIcon item={m.id} size={28} />
                  </div>
                  <div className="min-w-0 flex-1 text-[8px] leading-4">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold">{info?.nombre ?? m.id}</span>
                      <span className={`rounded px-1 text-[7px] font-bold ${found ? "bg-[#2f8a45] text-white" : "bg-white/15 text-white/70"}`}>
                        {found ? `FOUND (${Math.floor(inv[m.id] ?? 0)})` : "UNSEEN"}
                      </span>
                    </div>
                    <div><b>Where:</b> {m.where}</div>
                    <div><b>Use:</b> {m.use}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {CREATURE_GUIDE.map((c) => {
              const seen = s.alienSeen.includes(c.id) || s.creaturesSeen.includes(c.id) || s.bossesDefeated.includes(c.id);
              const defeated = s.bossesDefeated.includes(c.id);
              return (
                <div key={c.id} className={`rounded-[8px] border-2 p-2 text-[8px] leading-4 ${seen ? "border-[#0b1230] bg-white/90 text-[#14141c]" : "border-white/20 bg-black/35 text-white/75"}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold">{seen ? c.nombre : `??? (${c.kind})`}</span>
                    <span className={`rounded px-1 text-[7px] font-bold ${defeated ? "bg-[#3a5ab8] text-white" : seen ? "bg-[#b02a2a] text-white" : "bg-white/15 text-white/60"}`}>
                      {defeated ? "DEFEATED" : seen ? "SPOTTED" : "UNSEEN"}
                    </span>
                  </div>
                  <div className="mt-1"><b>Appears:</b> {c.where}</div>
                  <div><b>Info:</b> {seen ? c.desc : "Explore this region to spot it."}</div>
                  <div><b>Reward:</b> {c.loot}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
