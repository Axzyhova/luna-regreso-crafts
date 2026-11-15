import { useEffect, useRef, useState } from "react";
import { useGame, sim } from "@/game/store";
import { sfx } from "@/game/audio";
import { EFECTOS, PERKS, type EffectId } from "@/game/effects";
import { eventBanner } from "@/game/events";
import { PRINCIPALES, currentMain, sideAvailable, MISIONES } from "@/game/quests";
import { expedicion } from "@/game/history";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
import { missionHelp, navigation } from "@/game/nav";
import { TUTORIAL, tutorialStep, stepTutorial } from "@/game/tutorial";
import { useTouchDevice } from "@/hooks/use-device";

/** Unwrap an angle so a needle turning from 350° to 10° rotates 20° forward instead of spinning back 340°. */
export function unwrapAngle(prev: number, next: number) {
  return prev + ((((next - prev) % 360) + 540) % 360) - 180;
}

/** Compass dial: N at the top, needle eases toward the target (0° = north, clockwise). */
function Compass({ deg, size, warn }: { deg: number; size: number; warn?: boolean }) {
  const shown = useRef(deg);
  shown.current = unwrapAngle(shown.current, deg);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="rgba(0,0,0,0.45)" stroke="#0b1230" strokeWidth="2" />
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      {[0, 90, 180, 270].map((a) => <rect key={a} x="15.25" y="3.5" width="1.5" height={a ? 2 : 3.5} fill={a ? "currentColor" : "#f2d24f"} opacity={a ? 0.5 : 1} transform={`rotate(${a} 16 16)`} />)}
      <g style={{ transform: `rotate(${shown.current}deg)`, transformOrigin: "16px 16px", transition: "transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        <path d="M16 5.5 L19.5 16 L16 14.2 L12.5 16 Z" fill={warn ? "#f08a24" : "currentColor"} stroke="#0b1230" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M16 26.5 L12.5 16 L16 17.8 L19.5 16 Z" fill="currentColor" opacity="0.35" />
      </g>
      <circle cx="16" cy="16" r="1.6" fill="#f2f2f2" stroke="#0b1230" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Compact navigation chip: compass needle + target, distance, direction and ETA on two short lines.
 * Leaks switch to the alert tone. A threat or capsule nearby adds a third tiny line.
 */
export function NavCard({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const { primary, then, etaS } = navigation(s);
  const help = missionHelp(s);
  if (!primary) return null;
  const leak = primary.k === "fuga";
  const text = leak ? "text-alert" : "text-suit-light";
  return (
    <div className={`tr-hud pointer-events-none inline-flex items-center gap-1.5 py-1 pl-1 pr-2 ${leak ? "tr-hud-alert" : ""} ${className}`}>
      <span className={`${text} ${leak ? "animate-pulse" : ""}`}>
        <Compass deg={primary.deg} size={24} warn={leak} />
      </span>
      <div className="leading-tight">
        <div className={`flex items-center justify-between gap-2 text-[6px] ${text}`}>
          <span>{leak ? "⚠ " : "▸ "}{primary.label.toUpperCase()}</span>
          <span className="tabular-nums text-white/60">({s.pos.x}, {s.pos.y})</span>
        </div>
        <div className="tr-text mt-0.5 text-[8px] tabular-nums">
          {primary.m}m {primary.dir} <span className="text-[6px] text-white/60">~{etaS}s</span>
        </div>
        {help && <div className="mt-0.5 max-w-[165px] text-[5px] leading-tight text-sky-200/90">{help}</div>}
        {then && <div className={`mt-0.5 text-[5px] ${then.warn ? "text-alert" : "text-white/55"}`}>THEN {then.label.toUpperCase()} {then.m}m</div>}
      </div>
    </div>
  );
}

type AlertItem = { key: string; text: string; tone: string; blink?: boolean; title?: string };

/** Everything that needs the player's attention, most urgent first. (Stamina is already a bar in Vitals.) */
function collectAlerts(s: ReturnType<typeof useGame.getState>["snap"]): AlertItem[] {
  const out: AlertItem[] = [];
  if (s.alert) out.push({ key: "alert", text: `⚠ ${s.alert}`, tone: "border-alert text-alert", blink: true });
  const b = eventBanner(s);
  if (b) out.push({ key: "event", text: `${b.icono} ${b.texto}`, tone: b.activo ? "border-destructive text-destructive" : "border-alert text-alert", blink: b.activo });
  const aliens = s.aliens.filter((a) => a.tipo !== "nodriza").length;
  if (aliens && s.abduction === 0) out.push({ key: "aliens", text: `👾 ${aliens} alien(s) at the base`, tone: "border-alien text-alien" });
  for (const e of s.effects as EffectId[]) out.push({ key: `fx-${e}`, text: `${EFECTOS[e]?.icono ?? ""} ${EFECTOS[e]?.nombre ?? e}`, tone: "border-alert text-alert", title: EFECTOS[e]?.desc });
  return out;
}

/**
 * Warnings side panel: one short line per warning, collapsible to a small badge so it never covers the game.
 * The abduction meter and short toasts live here too.
 */
export function AlertsPanel({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const [open, setOpen] = useState(true);
  const items = collectAlerts(s);
  const n = items.length + (s.abduction > 0 ? 1 : 0);
  if (!n && !s.toast) return null;
  return (
    <div className={`pointer-events-none flex w-44 flex-col items-end gap-1 ${className}`}>
      {n > 0 && (
        <button type="button" onClick={() => { sfx.click(); setOpen((o) => !o); }} aria-expanded={open}
          className={`tr-hud pointer-events-auto flex items-center gap-1.5 px-1.5 py-1 text-[6px] ${items[0]?.key === "alert" ? "tr-hud-alert text-alert" : "text-gold"}`}>
          <span className={items[0]?.blink ? "animate-pulse" : ""}>⚠</span> ALERTS
          <span className="rounded-sm bg-alert px-1 text-[#2a1a04]">{n}</span>
          <span className={`inline-block text-white/60 transition-transform duration-200 ${open ? "" : "rotate-180"}`}>▴</span>
        </button>
      )}
      <div className={`grid w-full transition-[grid-template-rows,opacity] duration-200 ease-out ${open && n > 0 ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <ul className="flex min-h-0 w-full flex-col gap-0.5 overflow-hidden">
          {s.abduction > 0 && (
            <li className="tr-hud tr-in border-alien px-1.5 py-1 text-[6px] text-alien">
              <span className="animate-pulse">ABDUCTION</span> · run to the light
              <div className="tr-bar mt-0.5 !h-1"><div className="bg-alien" style={{ width: `${s.abduction}%` }} /></div>
            </li>
          )}
          {items.map((i) => (
            <li key={i.key} title={i.title} className={`tr-hud tr-in border-l-4 px-1.5 py-1 text-[6px] leading-3 ${i.tone}`}>
              <span className={i.blink ? "animate-pulse" : ""}>{i.text}</span>
            </li>
          ))}
        </ul>
      </div>
      {s.toast && <div key={s.toast.text} className="tr-hud tr-in w-full border-l-4 border-gold px-1.5 py-1 text-[6px] leading-3 text-gold">{s.toast.text}</div>}
    </div>
  );
}

/** Worn gear, shown inside the astronaut panel. */
export function GearRow() {
  const s = useGame((g) => g.snap);
  if (!s.effects.length && !s.equip.length && !s.perks.length && s.fatigue < 40) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[7px]">
      {(s.effects as EffectId[]).map((e) => <span key={e} title={`${EFECTOS[e]?.desc ?? ""} ${(EFECTOS[e] as { consecuencia?: string } | undefined)?.consecuencia ?? ""}`} className="text-alert"><span className="animate-pulse">{EFECTOS[e]?.icono} {EFECTOS[e]?.nombre}</span>{(EFECTOS[e] as { consecuencia?: string } | undefined)?.consecuencia ? <span className="text-white/70"> ({(EFECTOS[e] as { consecuencia?: string }).consecuencia!.split(" · ")[0]})</span> : null}</span>)}
      {!s.effects.includes("cansancio") && s.fatigue >= 40 && <span className="text-muted-foreground">😮‍💨 Fatigue {Math.round(s.fatigue)}%</span>}
      {s.equip.map((g) => <span key={g} className="flex items-center gap-1 text-ok"><PixelIcon item={g} size={10} />{ITEMS[g]?.nombre}</span>)}
      {s.perks.map((p) => <span key={p} title={PERKS[p]?.desc} className="text-gold">{PERKS[p]?.icono} {PERKS[p]?.nombre}</span>)}
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
    <button type="button" onClick={next} className={`absolute inset-x-2 bottom-2 z-[7] mx-auto max-w-xl tr-panel border-[3px] p-3 text-left ${color.split(" ")[0]}`}>
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
      <div className="tr-panel max-h-full w-full max-w-2xl overflow-auto p-4 short:p-2">
        <div className="mb-3 flex items-center justify-between"><h3 className="tr-title text-[11px] text-gold">MISSIONS</h3><button onClick={() => setOverlay(null)} aria-label="Close" className="tr-btn px-2 py-1 text-[9px]">✕</button></div>
        <div className="mb-2 text-[8px] text-suit-light">MAIN STORY</div>
        <ol className="mb-4 space-y-2">
          {PRINCIPALES.map((q, i) => {
            const done = i < s.quest.main, cur = i === s.quest.main;
            return (
              <li key={q.id} className={`text-[8px] leading-4 ${done ? "text-ok" : cur ? "text-foreground" : "text-muted-foreground"}`}>
                {done ? "✔" : cur ? "▶" : "🔒"} {i + 1}. {cur || done ? q.titulo : "???"}
                {(cur || done) && <div className="pl-4 text-[7px] text-muted-foreground">{q.objetivo}</div>}
                {(cur || done) && expedicion(q.inspirado) && <div className="pl-4 text-[6px] text-suit-light">📚 Inspired by {expedicion(q.inspirado)!.nombre}</div>}
              </li>
            );
          })}
        </ol>
        <div className="mb-2 text-[8px] text-suit-light">SPECIAL EXPEDITION CASE</div>
        <div className="mb-4 rounded border border-white/15 bg-black/25 p-2 text-[8px] leading-4">
          {s.specialCase ? (
            <>
              <div className="font-bold text-gold">⭐ {s.specialCase.title} ({Math.ceil(s.specialCase.t)}s left)</div>
              <div className="text-white/85">{s.specialCase.desc}</div>
              <div className="text-[7px] text-ok">Reward: {Object.entries(s.specialCase.reward).map(([k, n]) => `${n} ${ITEMS[k]?.nombre ?? k}`).join(", ")}</div>
            </>
          ) : (
            <div className="text-muted-foreground">No active special case right now ({s.casesDone} resolved). Watch the Map (M) for ⭐ expedition signals.</div>
          )}
        </div>
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
    <div className={`pointer-events-auto w-[min(92vw,340px)] rounded-[12px] border-2 border-gold/70 bg-card/95 p-2.5 shadow-lg short:w-[min(52vw,250px)] short:rounded-[9px] short:p-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-gold short:text-[7px]">🎓 TUTORIAL {s.tut.step + 1}/{TUTORIAL.length} · {st.title}</span>
        <button type="button" onClick={() => { sim.tut.skipped = true; sfx.click(); publish(); }} className="shrink-0 rounded bg-secondary px-2 py-1 text-[8px] short:px-1.5 short:py-0.5 short:text-[6px]">Skip</button>
      </div>
      <p className="mt-1 text-[9px] leading-4 text-foreground short:mt-0.5 short:text-[7px] short:leading-[11px]">{touch ? st.touch : st.text}</p>
      {st.ack && <button type="button" onClick={() => { sim.tut.acks ??= []; sim.tut.acks.push(st.id); stepTutorial(sim); sfx.ok(); publish(); }} className="tr-btn tr-btn-primary mt-1.5 px-3 py-1 text-[9px] short:mt-1 short:px-2 short:py-0.5 short:text-[7px]">GOT IT ✓</button>}
      <div className="mt-1.5 flex gap-1 short:mt-1">
        {TUTORIAL.map((t, i) => <span key={t.id} className={`h-1 flex-1 rounded ${i < s.tut.step ? "bg-ok" : i === s.tut.step ? "bg-gold" : "bg-moon-2"}`} />)}
      </div>
    </div>
  );
}
