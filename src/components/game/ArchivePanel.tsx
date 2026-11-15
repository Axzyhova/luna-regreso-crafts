import { useState } from "react";
import { useGame } from "@/game/store";
import { ARCHIVO } from "@/game/quests";
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

const BADGE: Record<string, { text: string; cls: string }> = {
  success: { text: "SUCCESS", cls: "bg-[#2f8a45]" },
  failure: { text: "FAILED", cls: "bg-[#b02a2a]" },
  partial: { text: "PARTIAL", cls: "bg-[#c48a14]" },
  planned: { text: "PLANNED", cls: "bg-[#3a5ab8]" },
};
const HINT: Record<string, string> = { M1: "mission 1", M2: "mission 2", M3: "mission 3", M4: "mission 4", M5: "mission 5", M6: "mission 6", M7: "the final mission" };

/** Real missions to the Moon, unlocked as the story advances (all open on the title screen). */
function LunarMissions({ unlockAll }: { unlockAll: boolean }) {
  const archive = useGame((g) => g.snap.archive);
  const list = [...ARCHIVO].sort((a, b) => a.anio - b.anio);
  return (
    <>
      <p className="mb-2 text-white/80">Real missions to the Moon, with their crews. {unlockAll ? ARCHIVO.length : archive.length}/{ARCHIVO.length} unlocked: more entries appear as you complete missions. Summaries are simplified: check NASA and each agency for the full story.</p>
      <div className="grid items-start gap-1.5 sm:grid-cols-2">
        {list.map((e) => {
          const open = unlockAll || archive.includes(e.id);
          const b = BADGE[e.resultado] ?? BADGE["planned"]!;
          if (!open) return (
            <div key={e.id} className="rounded-[8px] border-2 border-dashed border-white/20 bg-black/25 p-2 text-white/50">
              🔒 ??? · {e.anio}<div className="mt-1 text-[7px]">Unlocks with {HINT[e.desbloqueo] ?? (e.desbloqueo === "zona_fire" ? "visiting the Scorch Fields" : "progress")}.</div>
            </div>
          );
          return (
            <div key={e.id} className="tr-slot !rounded-[8px] p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-gold">{e.nombre}</span>
                <span className={`rounded px-1.5 py-0.5 text-[7px] text-white ${b.cls}`}>{b.text}</span>
              </div>
              <div className="text-[7px] text-white/60">{e.anio} · {e.agencia}</div>
              <div className="mt-1"><span className="text-suit-light">CREW</span> {e.tripulacion}</div>
              <p className="mt-1 text-white/90">{e.resumen}</p>
              <p className="mt-1 text-ok">🎮 {e.leccion}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Real NASA expeditions, the fictional Selene-7 crew, and a few space facts. Static data: works on the title screen too. */
export function ArchiveContent({ unlockAll = false, start = "exp" }: { unlockAll?: boolean; start?: "luna" | "exp" } = {}) {
  const [tab, setTab] = useState<"luna" | "exp" | "crew" | "facts">(start);
  const [filter, setFilter] = useState<"all" | Tipo>("all");
  const [sel, setSel] = useState(EXPEDICIONES[0]!.id);
  const list = EXPEDICIONES.filter((e) => filter === "all" || e.tipo === filter);
  const cur = list.find((e) => e.id === sel) ?? list[0]!;

  return (
    <div className="text-[8px] leading-4 short:text-[7px] short:leading-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 short:mb-1">
        {([["luna", "LUNAR MISSIONS"], ["exp", "NASA EXPEDITIONS"], ["crew", "SELENE-7 CREW"], ["facts", "DID YOU KNOW?"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setTab(id); sfx.click(); }} className={`tr-btn px-2.5 py-1.5 text-[8px] short:px-2 short:py-1 short:text-[7px] ${tab === id ? "tr-btn-primary" : "opacity-80"}`}>{label}</button>
        ))}
      </div>

      {tab === "luna" && <LunarMissions unlockAll={unlockAll} />}

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
  return <Panel title="NASA MISSION ARCHIVE" wide><ArchiveContent start="luna" /></Panel>;
}

/** Same content on its own screen, reachable from the title without starting a game. */
export function ArchiveScreen() {
  const go = useGame((g) => g.go);
  return (
    <div className="relative flex h-full flex-col items-center justify-center-safe gap-3 overflow-y-auto p-4 short:gap-1.5 short:p-2">
      <div className="tr-panel w-full max-w-3xl p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between"><h2 className="tr-title text-[11px] text-gold short:text-[9px]">NASA MISSION ARCHIVE</h2>
          <button type="button" onClick={() => { sfx.click(); go("intro"); }} className="tr-btn px-3 py-1.5 text-[8px]">← BACK</button></div>
        <ArchiveContent unlockAll />
      </div>
    </div>
  );
}
