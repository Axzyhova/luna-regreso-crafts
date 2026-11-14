import { useEffect } from "react";
import { useGame, sim } from "@/game/store";
import { sfx } from "@/game/audio";
import { EFECTOS, type EffectId } from "@/game/effects";
import { eventBanner } from "@/game/events";
import { PRINCIPALES, currentMain, sideAvailable, MISIONES } from "@/game/quests";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";

const RADAR_RANGE = 200; // world px shown from the center to the edge
const DOT: Record<string, { c: string; label: string }> = {
  alien: { c: "var(--color-alien)", label: "Alien" },
  jefe: { c: "var(--color-destructive)", label: "Nodriza" },
  capsula: { c: "var(--color-gold)", label: "Cápsula" },
  hielo: { c: "var(--color-ice, #a8e4ff)", label: "Hielo" },
  fuga: { c: "var(--color-alert)", label: "Fuga" },
  meteoritos: { c: "var(--color-destructive)", label: "Meteoritos" },
  base: { c: "var(--color-suit-light)", label: "Hábitat" },
  cohete: { c: "#f2f2f2", label: "Cohete" },
};
const DIRS = ["E", "SE", "S", "SO", "O", "NO", "N", "NE"];
const dir = (dx: number, dy: number) => DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8]!;

/** Small compass/radar: dots around the astronaut, plus a warning for what is closest. */
export function Radar({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const size = 76, half = size / 2;
  const near = s.radar
    .filter((r) => ["alien", "jefe", "capsula", "fuga", "meteoritos"].includes(r.k))
    .map((r) => ({ ...r, d: Math.hypot(r.dx, r.dy) }))
    .sort((a, b) => a.d - b.d)[0];
  return (
    <div className={`pointer-events-none flex flex-col items-end gap-1 ${className}`}>
      <div className="relative rounded-full border-2 border-moon-2 bg-background/70" style={{ width: size, height: size }}>
        <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[6px] text-gold">N</span>
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-white" />
        {s.radar.map((r, i) => {
          const d = Math.hypot(r.dx, r.dy);
          const k = Math.min(1, d / RADAR_RANGE) * (half - 5) / (d || 1);
          const edge = d > RADAR_RANGE;
          return <div key={i} title={DOT[r.k]?.label} className={`absolute rounded-full ${r.k === "alien" || r.k === "jefe" || r.k === "meteoritos" ? "animate-pulse" : ""}`}
            style={{ width: edge ? 3 : 5, height: edge ? 3 : 5, background: DOT[r.k]?.c ?? "#fff", left: half + r.dx * k - 2.5, top: half + r.dy * k - 2.5, opacity: edge ? 0.6 : 1 }} />;
        })}
      </div>
      {near && near.d < 120 && (
        <div className={`rounded bg-background/80 px-1 text-[6px] ${near.k === "capsula" ? "text-gold" : "text-alert"}`}>
          {DOT[near.k]?.label} a {Math.round(near.d / 4)} m ({dir(near.dx, near.dy)})
        </div>
      )}
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
