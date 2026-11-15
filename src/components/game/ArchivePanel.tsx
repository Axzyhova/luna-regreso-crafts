import { useGame } from "@/game/store";
import { ARCHIVO } from "@/game/quests";

const BADGE: Record<string, { text: string; cls: string }> = {
  success: { text: "SUCCESS", cls: "bg-[#2f8a45]" },
  failure: { text: "FAILED", cls: "bg-[#b02a2a]" },
  partial: { text: "PARTIAL", cls: "bg-[#c48a14]" },
  planned: { text: "PLANNED", cls: "bg-[#3a5ab8]" },
};
const HINT: Record<string, string> = { M1: "mission 1", M2: "mission 2", M3: "mission 3", M4: "mission 4", M5: "mission 5", M6: "mission 6", M7: "the final mission" };

/**
 * Lunar Missions Archive: real missions (successes and failures) with their crews,
 * unlocked as the story advances, each tied to what you're doing in the game.
 */
export function ArchivePanel() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const list = [...ARCHIVO].sort((a, b) => a.anio - b.anio);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-3xl overflow-auto p-3 short:p-2">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">📚 LUNAR MISSIONS ARCHIVE</h3>
          <button type="button" onClick={() => setOverlay(null)} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <p className="mb-3 text-[9px] leading-4 text-white/80">Real missions to the Moon, with their crews. {s.archive.length}/{ARCHIVO.length} unlocked — more entries appear as you complete missions. Summaries are simplified: check NASA and each agency for the full story.</p>
        <div className="grid items-start gap-2 sm:grid-cols-2">
          {list.map((e) => {
            const open = s.archive.includes(e.id);
            const b = BADGE[e.resultado] ?? BADGE["planned"]!;
            if (!open) return (
              <div key={e.id} className="rounded-[8px] border-2 border-dashed border-white/20 bg-black/25 p-2 text-[9px] text-white/50">
                🔒 ??? · {e.anio}<div className="mt-1 text-[8px]">Unlocks with {HINT[e.desbloqueo] ?? (e.desbloqueo === "zona_fire" ? "visiting the Scorch Fields" : "progress")}.</div>
              </div>
            );
            return (
              <div key={e.id} className="rounded-[8px] border-2 border-[#0b1230] bg-white/90 p-2 text-[#14141c]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold">{e.nombre}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${b.cls}`}>{b.text}</span>
                </div>
                <div className="text-[8px] text-black/60">{e.anio} · {e.agencia}</div>
                <div className="mt-1 text-[8px]"><b>Crew:</b> {e.tripulacion}</div>
                <p className="mt-1 text-[9px] leading-4">{e.resumen}</p>
                <p className="mt-1 rounded bg-[#e8f0ff] px-1.5 py-1 text-[8px] leading-4 text-[#1d3f8a]">🎮 {e.leccion}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
