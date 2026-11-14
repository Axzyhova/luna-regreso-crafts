import { useEffect } from "react";
import { useGame, sim } from "@/game/store";
import { sfx } from "@/game/audio";
import { EFECTOS, type EffectId } from "@/game/effects";
import { eventBanner } from "@/game/events";
import { PRINCIPALES, currentMain, sideAvailable, MISIONES } from "@/game/quests";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
import { navigation } from "@/game/nav";
import { TUTORIAL, tutorialStep } from "@/game/tutorial";
import { useTouchDevice } from "@/hooks/use-device";

function Arrow({ deg, size, warn }: { deg: number; size: number; warn?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }} className="shrink-0 transition-transform duration-200" aria-hidden>
      <path d="M12 2 L20 13 H14.5 V22 H9.5 V13 H4 Z" fill={warn ? "#ff6b5b" : "#ffffff"} />
    </svg>
  );
}

/**
 * Compact GPS card in the style of a phone's car navigation: rounded dark tile with the
 * turn arrow and distance, the target name, and a slim "then" row. Kept small on purpose.
 */
export function NavCard({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const { primary, then, etaS } = navigation(s);
  if (!primary) return null;
  return (
    <div className={`pointer-events-none w-[132px] overflow-hidden rounded-[14px] bg-[#1c1c1e]/90 font-sans text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-sm sm:w-[164px] ${className}`}>
      <div className="flex items-center gap-1.5 px-2.5 pt-2">
        <Arrow deg={primary.deg} size={18} />
        <span className="text-[17px] font-semibold leading-none tabular-nums sm:text-[20px]">{primary.m} m</span>
      </div>
      <div className="truncate px-2.5 pb-1.5 pt-0.5 text-[11px] font-semibold sm:text-[12px]">{primary.label}</div>
      <div className={`flex items-center justify-between border-t border-white/10 px-2.5 py-1 text-[9px] sm:text-[10px] ${then?.warn ? "text-[#ff6b5b]" : "text-white/70"}`}>
        <span className="truncate">{then ? `then ${then.label}` : `~${etaS} s · ${primary.dir}`}</span>
        {then && <Arrow deg={then.deg} size={10} warn={then.warn} />}
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
      {!s.effects.includes("cansancio") && s.fatigue >= 40 && <span className="text-muted-foreground">😮‍💨 Fatigue {Math.round(s.fatigue)}%</span>}
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
      <div className={`mb-1 text-[8px] ${color.split(" ")[1]}`}>{line.quien === "CONTROL" ? "📡 MISSION CONTROL" : line.quien === "ARIA" ? "🤖 ARIA" : line.quien}</div>
      <div className="text-[8px] leading-4 text-foreground">{line.texto}</div>
      <div className="mt-1 text-right text-[6px] text-muted-foreground">{s.dialog.length > 1 ? `tap to continue (${s.dialog.length - 1})` : "tap to close"} ▶</div>
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
      📜 {q ? <>MISSION {s.quest.main + 1}/{PRINCIPALES.length} · {q.titulo.toUpperCase()}: <span className="text-foreground">{q.objetivo}</span></> : "Story complete!"}
    </button>
  );
}

export function QuestLog() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4 short:p-1">
      <div className="max-h-full w-full max-w-2xl overflow-auto border-4 border-suit bg-card p-4 short:p-2">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] text-gold">MISSIONS</h3><button onClick={() => setOverlay(null)} className="text-[9px] text-muted-foreground">[X]</button></div>
        <div className="mb-2 text-[8px] text-suit-light">MAIN STORY</div>
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
        <div className="mb-2 text-[8px] text-suit-light">SIDE MISSIONS</div>
        <ul className="space-y-2">
          {sideAvailable(s).map((q) => {
            const done = s.quest.sideDone.includes(q.id);
            return (
              <li key={q.id} className={`text-[8px] leading-4 ${done ? "text-ok" : ""}`}>
                {done ? "✔" : "◇"} {q.titulo}
                <div className="pl-4 text-[7px] text-muted-foreground">{q.objetivo} · Reward: {Object.entries(q.recompensa).map(([k, n]) => `${n} ${ITEMS[k]?.nombre ?? k}`).join(", ")}</div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[7px] leading-4 text-muted-foreground">Characters: {Object.entries(MISIONES.personajes).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>
      </div>
    </div>
  );
}

/** Step-by-step tutorial card (skippable). Each step completes on its own. */
export function TutorialCard({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const touch = useTouchDevice();
  const st = tutorialStep(s);
  if (!st) return null;
  return (
    <div className={`pointer-events-auto w-[min(92vw,340px)] rounded-[12px] border-2 border-gold/70 bg-card/95 p-2.5 shadow-lg ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-gold">🎓 TUTORIAL {s.tut.step + 1}/{TUTORIAL.length} · {st.title}</span>
        <button type="button" onClick={() => { sim.tut.skipped = true; sfx.click(); publish(); }} className="shrink-0 rounded bg-secondary px-2 py-1 text-[8px]">Skip</button>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-foreground">{touch ? st.touch : st.text}</p>
      <div className="mt-1.5 flex gap-1">
        {TUTORIAL.map((t, i) => <span key={t.id} className={`h-1 flex-1 rounded ${i < s.tut.step ? "bg-ok" : i === s.tut.step ? "bg-gold" : "bg-moon-2"}`} />)}
      </div>
    </div>
  );
}
