import { useState } from "react";
import { useGame } from "@/game/store";
import { EXPEDICIONES, TRIPULACION, DATOS, MISION, TIPO_ICON, TIPO_LABEL, TIPO_LONG, countByTipo, type Tipo } from "@/game/history";
import { sfx } from "@/game/audio";
import { Panel } from "./Panel";

const TONE: Record<Tipo, string> = { exito: "text-ok", fallo: "text-destructive", mixto: "text-alert" };
const FILTERS: { id: "all" | Tipo; label: string }[] = [
  { id: "all", label: `ALL ${EXPEDICIONES.length}` },
  { id: "exito", label: `✔ SUCCESS ${countByTipo("exito")}` },
  { id: "mixto", label: `◐ SAVED ${countByTipo("mixto")}` },
  { id: "fallo", label: `✖ FAILURE ${countByTipo("fallo")}` },
];

/** Real NASA expeditions, the fictional Selene-7 crew, and a few space facts. Static data: works on the title screen too. */
export function ArchiveContent() {
  const [tab, setTab] = useState<"exp" | "crew" | "facts">("exp");
  const [filter, setFilter] = useState<"all" | Tipo>("all");
  const [sel, setSel] = useState(EXPEDICIONES[0]!.id);
  const list = EXPEDICIONES.filter((e) => filter === "all" || e.tipo === filter);
  const cur = list.find((e) => e.id === sel) ?? list[0]!;

  return (
    <div className="text-[8px] leading-4 short:text-[7px] short:leading-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 short:mb-1">
        {([["exp", "EXPEDITIONS"], ["crew", "SELENE-7 CREW"], ["facts", "DID YOU KNOW?"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setTab(id); sfx.click(); }} className={`tr-btn px-2.5 py-1.5 text-[8px] short:px-2 short:py-1 short:text-[7px] ${tab === id ? "tr-btn-primary" : "opacity-80"}`}>{label}</button>
        ))}
      </div>

      {tab === "exp" && (<>
        <div className="mb-2 flex flex-wrap gap-1 short:mb-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => { setFilter(f.id); sfx.click(); }} className={`rounded-full border px-2 py-0.5 text-[7px] short:text-[6px] ${filter === f.id ? "border-gold bg-gold/20 text-gold" : "border-white/20 text-white/65"}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row short:flex-row short:gap-1.5">
          <ul className="flex max-h-40 shrink-0 flex-col gap-1 overflow-auto sm:max-h-72 sm:w-56 short:max-h-44 short:w-40" aria-label="Expeditions">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => { setSel(e.id); sfx.click(); }} className={`tr-slot flex w-full items-start gap-1.5 !rounded-[6px] px-1.5 py-1 text-left ${cur.id === e.id ? "tr-slot-active" : ""}`}>
                  <span className={`${TONE[e.tipo]} text-[10px] leading-none`}>{TIPO_ICON[e.tipo]}</span>
                  <span className="min-w-0"><span className="block truncate text-white">{e.nombre}</span><span className="block truncate text-[6px] text-white/55">{e.fecha}</span></span>
                </button>
              </li>
            ))}
          </ul>
          <article className="tr-slot min-w-0 flex-1 !rounded-[8px] px-2.5 py-2 short:px-2 short:py-1.5" aria-live="polite">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h4 className="tr-title text-[10px] text-gold short:text-[8px]">{cur.nombre}</h4>
              <span className={`text-[7px] ${TONE[cur.tipo]}`}>{TIPO_ICON[cur.tipo]} {TIPO_LONG[cur.tipo].toUpperCase()}</span>
            </div>
            <div className="text-[7px] text-white/60">{cur.fecha} · {cur.agencia}</div>
            <p className="mt-1 text-white/90"><span className="text-suit-light">CREW</span> {cur.tripulacion.join(" · ")}</p>
            <p className="mt-1 text-white/90"><span className="text-suit-light">WHAT HAPPENED</span> {cur.resumen}</p>
            <p className="mt-1 text-white/90"><span className="text-ok">WHAT IT TAUGHT</span> {cur.leccion}</p>
            <p className="mt-1 text-white/90"><span className="text-gold">IN THIS GAME</span> {cur.juego}</p>
          </article>
        </div>
        <p className="mt-1.5 text-[6px] text-white/45">Source: NASA mission pages, history office and accident investigation reports. See “Sources &amp; credits”.</p>
      </>)}

      {tab === "crew" && (<>
        <p className="mb-2 text-white/80 short:mb-1">{MISION.resumen}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2 short:grid-cols-2 short:gap-1">
          {TRIPULACION.map((c) => (
            <li key={c.id} className="tr-slot !rounded-[8px] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] text-gold short:text-[8px]">{c.nombre}</span><span className="rounded-sm bg-white/10 px-1 text-[6px] text-white/70">{c.agencia}</span></div>
              <div className="text-white/85">{c.rol}</div>
              <div className="text-[7px] italic text-white/60">{c.nota}</div>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[6px] text-white/45">Mission SELENE-7 and this crew are fiction. The astronauts in the Expeditions tab are real people who gave their work, and some their lives, to space exploration.</p>
      </>)}

      {tab === "facts" && (
        <ol className="space-y-1.5 short:space-y-1">
          {DATOS.map((d, i) => (<li key={i} className="tr-slot flex gap-2 !rounded-[8px] px-2 py-1.5"><span className="text-gold">{i + 1}</span><span className="text-white/90">{d}</span></li>))}
        </ol>
      )}
    </div>
  );
}

/** In-game overlay (K, or from the Log and Pause menus). */
export function ArchivePanel() {
  return <Panel title="NASA MISSION ARCHIVE" wide><ArchiveContent /></Panel>;
}

/** Same content on its own screen, reachable from the title without starting a game. */
export function ArchiveScreen() {
  const go = useGame((g) => g.go);
  return (
    <div className="relative flex h-full flex-col items-center justify-center-safe gap-3 overflow-y-auto p-4 short:gap-1.5 short:p-2">
      <div className="tr-panel w-full max-w-3xl p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between"><h2 className="tr-title text-[11px] text-gold short:text-[9px]">NASA MISSION ARCHIVE</h2>
          <button type="button" onClick={() => { sfx.click(); go("intro"); }} className="tr-btn px-3 py-1.5 text-[8px]">← BACK</button></div>
        <ArchiveContent />
      </div>
    </div>
  );
}
