import { useState } from "react";
import recetas from "@/data/recetas.json";
import { useGame, sim } from "@/game/store";
import { recipeBlock, craft, addLog, TIPOS, STACK, SLOTS, type Receta } from "@/game/sim";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";

const INV_ORDER = ["hielo", "agua", "regolito", "chatarra", "metal", "kits", "baterias", "paneles", "taladro", "taller", "horno", "torres_luz", "pala_mejorada", "aislamiento", "planta_electrolisis", "criotanque", "pieza_motor", "traje_termico", "capa_reflectante", "escudo_radiacion", "botiquin", "estimulante"];
const TITLE = { taller: "WORKSHOP", horno: "FURNACE" } as const;
const NOTE = {
  taller: "Build tools, modules and gear here.",
  horno: "Bake regolith into insulation. While powered, the furnace also turns regolith into O2 and metal on its own.",
} as const;

function Slot({ item, n, big, warn, active, dim, onClick, title }: { item?: string | undefined; n?: number | string | undefined; big?: boolean; warn?: boolean; active?: boolean; dim?: boolean; onClick?: () => void; title?: string | undefined }) {
  const size = big ? "h-16 w-16" : "h-11 w-11";
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={title}
      className={`tr-slot relative flex ${size} shrink-0 items-center justify-center ${active ? "tr-slot-active" : ""} ${warn ? "ring-2 ring-destructive" : ""} ${dim ? "opacity-55 grayscale" : ""}`}>
      {item && <PixelIcon item={item} size={big ? 34 : 22} />}
      {n !== undefined && n !== "" && <span className="tr-text absolute bottom-0 right-1 text-[9px]">{n}</span>}
    </button>
  );
}

/**
 * Crafting-station interface (opened with E at the Workshop or Furnace): recipe list on
 * the left, the selected recipe as ingredients → result, and your inventory below.
 */
export function StationPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const station = s.station ?? "taller";
  const list = recetas.filter((r) => r.lugar === station || r.lugar === "mano");
  const [selId, setSelId] = useState(list[0]?.id ?? "");
  const sel: Receta | undefined = list.find((r) => r.id === selId) ?? list[0];
  const inv = s.inv as unknown as Record<string, number>;
  const mod = s.modules.find((m) => m.uid === s.stationUid);
  const repair = () => {
    const m = sim.modules.find((x) => x.uid === sim.stationUid);
    if (!m || sim.inv.kits < 1) { sfx.bad(); return; }
    sim.inv.kits -= 1; m.durabilidad = 100; sim.stats.reparaciones++;
    addLog(sim, `Repaired: ${TIPOS[m.tipo].nombre}. -1 kit.`); sfx.ok(); publish();
  };
  const block = sel ? recipeBlock(s, sel) : "—";
  const result = sel ? Object.entries(sel.resultado)[0] : undefined;
  const stacks: { key: string; n: number }[] = [];
  for (const key of INV_ORDER) { let n = Math.floor(inv[key] ?? 0); while (n > 0) { stacks.push({ key, n: Math.min(STACK, n) }); n -= STACK; } }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-2xl overflow-auto p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">{TITLE[station]}</h3>
          <button type="button" onClick={() => { sim.station = null; setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <p className="mb-2 text-[9px] leading-4 text-white/80">{NOTE[station]}</p>
        {station === "taller" && s.suit.owned && s.suit.integrity < 100 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px]">
            <span className="tr-text">🧑‍🚀 Space suit</span>
            <div className="h-2.5 w-32 overflow-hidden rounded bg-black/50"><div className={`h-full ${s.suit.integrity < 25 ? "bg-alert" : "bg-suit-light"}`} style={{ width: `${s.suit.integrity}%` }} /></div>
            <span>{Math.round(s.suit.integrity)}%</span>
            <button type="button" disabled={s.inv.kits < 1} onClick={() => { if (sim.inv.kits < 1) return; sim.inv.kits -= 1; sim.suit.integrity = 100; addLog(sim, "You patched the space suit: 100%. -1 kit."); sfx.ok(); publish(); }}
              className="tr-btn px-2 py-1 text-[9px] disabled:opacity-40">REPAIR SUIT (1 Sealant kit)</button>
          </div>
        )}
        {mod && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px]">
            <span className="tr-text">Condition</span>
            <div className="h-2.5 w-32 overflow-hidden rounded bg-black/50"><div className={`h-full ${mod.durabilidad < 25 ? "bg-alert" : "bg-ok"}`} style={{ width: `${mod.durabilidad}%` }} /></div>
            <span>{Math.round(mod.durabilidad)}%</span>
            {mod.durabilidad < 100 && (
              <button type="button" disabled={s.inv.kits < 1} onClick={repair} className="tr-btn px-2 py-1 text-[9px] disabled:opacity-40">REPAIR (1 Sealant kit)</button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row short:flex-row">
          {/* recipes */}
          <div className="sm:w-52 short:w-44">
            <div className="tr-text mb-1 text-[9px] text-white/90">Recipes</div>
            <div className="grid grid-cols-4 gap-1">
              {list.map((r) => {
                const out = Object.keys(r.resultado)[0]!;
                const b = recipeBlock(s, r);
                // Craftable: full colour with ✓. Not craftable: greyed out, red outline when materials are missing.
                return <Slot key={r.id} item={out} active={r.id === sel?.id} dim={!!b} warn={b === "Missing materials"} title={`${r.nombre}${b ? ` — ${b}` : " — ready to craft"}`} onClick={() => { setSelId(r.id); sfx.click(); }} n={b ? "" : "✓"} />;
              })}
            </div>
          </div>
          {/* selected recipe: ingredients → result */}
          {sel && result && (
            <div className="flex flex-1 flex-col gap-2">
              <div className="tr-text text-[10px] text-gold">{sel.nombre}</div>
              <div className="flex items-center gap-3">
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 6 }, (_, i) => {
                    const ing = Object.entries(sel.ingredientes)[i];
                    if (!ing) return <Slot key={i} />;
                    const [k, need] = ing;
                    const have = Math.floor(inv[k] ?? 0);
                    return <Slot key={i} item={k} n={`${have}/${need}`} warn={have < (need ?? 0)} title={ITEMS[k]?.nombre} />;
                  })}
                </div>
                <span className="tr-title text-[22px] text-white/80">➜</span>
                <Slot item={result[0]} n={result[1]} big dim={!!block} title={ITEMS[result[0]]?.nombre} />
              </div>
              <p className="text-[9px] leading-4 text-white/80">{ITEMS[result[0]]?.desc}</p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={!!block} onClick={() => { if (craft(sim, sel)) { sfx.ok(); publish(); } else sfx.bad(); }}
                  className="tr-btn tr-btn-primary px-4 py-2 text-[10px] disabled:opacity-40">CRAFT</button>
                {block && <span className="text-[9px] text-alert">{block}</span>}
              </div>
            </div>
          )}
        </div>
        {/* inventory */}
        <div className="tr-text mb-1 mt-3 text-[9px] text-white/90">Inventory</div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: SLOTS }, (_, i) => stacks[i]).map((c, i) => <Slot key={i} item={c?.key} n={c?.n} title={c ? ITEMS[c.key]?.nombre : undefined} />)}
        </div>
      </div>
    </div>
  );
}
