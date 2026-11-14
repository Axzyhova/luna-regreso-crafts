import { useEffect } from "react";
import { useGame, sim } from "@/game/store";
import { sfx } from "@/game/audio";
import { EFECTOS, type EffectId } from "@/game/effects";
import { eventBanner } from "@/game/events";
import { PRINCIPALES, currentMain, sideAvailable, MISIONES } from "@/game/quests";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
import { navigation } from "@/game/nav";

function Arrow({ deg, size, warn }: { deg: number; size: number; warn?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }} className="shrink-0 transition-transform duration-200" aria-hidden>
      <path d="M12 2 L20 13 H14.5 V22 H9.5 V13 H4 Z" fill={warn ? "#ff6b5b" : "#ffffff"} />
    </svg>
  );
}

/** GPS-style guidance card (like a car navigation screen): arrow, distance, target, "y luego" and ETA. */
export function NavCard({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const { primary, then, etaS } = navigation(s);
  if (!primary) return null;
  return (
    <div className={`pointer-events-none flex w-40 flex-col gap-1.5 font-sans sm:w-56 lg:w-64 ${className}`}>
      <div className="overflow-hidden rounded-2xl bg-[#111214]/95 text-white shadow-lg">
        <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5 sm:gap-3 sm:px-4 sm:pt-3">
          <Arrow deg={primary.deg} size={30} />
          <span className="text-2xl font-bold tabular-nums sm:text-3xl">{primary.m} m</span>
        </div>
        <div className="truncate px-3 pb-2 text-sm font-bold sm:px-4 sm:text-base">{primary.label}</div>
        {then && (
          <div className={`flex items-center justify-between border-t border-white/15 px-3 py-1.5 text-[11px] sm:px-4 sm:text-sm ${then.warn ? "text-[#ff6b5b]" : "text-white/85"}`}>
            <span className="truncate">y luego · {then.label} {then.m} m</span>
            <Arrow deg={then.deg} size={14} warn={then.warn} />
          </div>
        )}
      </div>
      <div className="rounded-2xl bg-white/90 px-3 py-1.5 text-[#111214] shadow sm:px-4 sm:py-2">
        <div className="text-sm font-bold sm:text-base">Llegada ~{etaS} s</div>
        <div className="text-[10px] text-black/60 sm:text-xs">{primary.dir} · {primary.m} m</div>
      </div>
    </div>
  );
}

/** Natural-event alert with countdown, plus short toasts. */
export function EventBanner() {
  const s = useGame((g) => g.snap);
  const b = eventBanner(s);
  return (
    <>
      {b && <div className={`text-center text-[8px] leading-4 ${b.activo ? "animate-blink text-destructive" : "text-alert"}`}>{b.icono} {b.texto}</div>}
      {s.toast && <div className="text-center text-[8px] leading-4 text-gold">{s.toast.text}</div>}
    </>
  );
}

/** Active negative states and worn gear. */
export function EffectsBar() {
  const s = useGame((g) => g.snap);
  if (!s.effects.length && !s.equip.length && s.fatigue < 40) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[7px]">
      {(s.effects as EffectId[]).map((e) => <span key={e} title={EFECTOS[e]?.desc} className="animate-pulse text-alert">{EFECTOS[e]?.icono} {EFECTOS[e]?.nombre}</span>)}
      {!s.effects.includes("cansancio") && s.fatigue >= 40 && <span className="text-muted-foreground">😮‍💨 Fatiga {Math.round(s.fatigue)}%</span>}
      {s.equip.map((g) => <span key={g} className="flex items-center gap-1 text-ok"><PixelIcon item={g} size={10} />{ITEMS[g]?.nombre}</span>)}
    </div>
  );
}

/** Story dialog box: tap / click / Enter to advance. The game keeps running. */
export function DialogBox() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const line = s.dialog[0];
  const next = () => { sim.dialog.shift(); sfx.click(); publish(); };
  useEffect(() => {
    if (!line) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); next(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!line) return null;
  const color = line.quien === "CONTROL" ? "border-ok text-ok" : line.quien === "ARIA" ? "border-suit-light text-suit-light" : "border-gold text-gold";
  return (
    <button type="button" onClick={next} className={`absolute inset-x-2 bottom-2 z-[7] mx-auto max-w-xl border-4 bg-card/95 p-3 text-left ${color.split(" ")[0]}`}>
      <div className={`mb-1 text-[8px] ${color.split(" ")[1]}`}>{line.quien === "CONTROL" ? "📡 CONTROL DE MISIÓN" : line.quien === "ARIA" ? "🤖 ARIA" : line.quien}</div>
      <div className="text-[8px] leading-4 text-foreground">{line.texto}</div>
      <div className="mt-1 text-right text-[6px] text-muted-foreground">{s.dialog.length > 1 ? `toca para continuar (${s.dialog.length - 1})` : "toca para cerrar"} ▶</div>
    </button>
  );
}

/** Current main quest, tappable to open the quest log. */
export function QuestTracker() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const q = currentMain(s);
  return (
    <button type="button" onClick={() => { sfx.click(); setOverlay("misiones"); }} className="pointer-events-auto text-center text-[8px] leading-4 text-gold">
      📜 {q ? <>MISIÓN {s.quest.main + 1}/{PRINCIPALES.length} · {q.titulo.toUpperCase()}: <span className="text-foreground">{q.objetivo}</span></> : "¡Historia completada!"}
    </button>
  );
}

export function QuestLog() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-auto border-4 border-suit bg-card p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] text-gold">MISIONES</h3><button onClick={() => setOverlay(null)} className="text-[9px] text-muted-foreground">[X]</button></div>
        <div className="mb-2 text-[8px] text-suit-light">HISTORIA PRINCIPAL</div>
        <ol className="mb-4 space-y-2">
          {PRINCIPALES.map((q, i) => {
            const done = i < s.quest.main, cur = i === s.quest.main;
            return (
              <li key={q.id} className={`text-[8px] leading-4 ${done ? "text-ok" : cur ? "text-foreground" : "text-muted-foreground"}`}>
                {done ? "✔" : cur ? "▶" : "🔒"} {i + 1}. {cur || done ? q.titulo : "???"}
                {(cur || done) && <div className="pl-4 text-[7px] text-muted-foreground">{q.objetivo}</div>}
              </li>
            );
          })}
        </ol>
        <div className="mb-2 text-[8px] text-suit-light">SECUNDARIAS</div>
        <ul className="space-y-2">
          {sideAvailable(s).map((q) => {
            const done = s.quest.sideDone.includes(q.id);
            return (
              <li key={q.id} className={`text-[8px] leading-4 ${done ? "text-ok" : ""}`}>
                {done ? "✔" : "◇"} {q.titulo}
                <div className="pl-4 text-[7px] text-muted-foreground">{q.objetivo} · Recompensa: {Object.entries(q.recompensa).map(([k, n]) => `${n} ${ITEMS[k]?.nombre ?? k}`).join(", ")}</div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[7px] leading-4 text-muted-foreground">Personajes: {Object.entries(MISIONES.personajes).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>
      </div>
    </div>
  );
}
