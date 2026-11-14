import { useEffect, useState } from "react";
import modos from "@/data/modos.json";
import fuentes from "@/data/fuentes.json";
import { useGame, hasSave } from "@/game/store";
import type { Mode, Difficulty } from "@/game/sim";
import { sfx } from "@/game/audio";
import { GAME_TITLE } from "@/game/title";
import { StoryAnimation, type SceneId } from "./StoryAnimation";

/** Reveals text letter by letter, like an old console. */
function useTypewriter(text: string, cps = 38) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + 1)), 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  return text.slice(0, n);
}
import { MISIONES, sideAvailable } from "@/game/quests";

export function PixelButton({ children, onClick, tone = "primary", disabled }: { children: React.ReactNode; onClick?: () => void; tone?: "primary" | "ghost" | "alert"; disabled?: boolean }) {
  const t = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "alert" ? "bg-alert text-background" : "bg-secondary text-secondary-foreground";
  return (
    <button disabled={disabled} onClick={() => { sfx.click(); onClick?.(); }}
      className={`${t} px-4 py-3 text-[10px] uppercase shadow-[0_4px_0_0_var(--color-moon-0)] active:translate-y-1 active:shadow-none disabled:opacity-40 hover:brightness-110`}>
      {children}
    </button>
  );
}

function Stars() {
  return <div className="stars pointer-events-none absolute inset-0" aria-hidden />;
}

export function Intro() {
  const go = useGame((s) => s.go);
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 p-6 text-center">
      <Stars />
      <h1 className="max-w-3xl text-xl leading-relaxed text-suit-light drop-shadow-[4px_4px_0_var(--color-suit)] sm:text-4xl sm:leading-snug">{GAME_TITLE}</h1>
      <p className="max-w-xl text-[11px] leading-6 text-foreground">Bienvenido a la experiencia… ¿estás preparado para vivir una historia en el espacio?</p>
      <div className="flex gap-4">
        <PixelButton onClick={() => go("modo")}>Aceptar</PixelButton>
        <PixelButton tone="ghost" onClick={() => go("rechazo")}>Rechazar</PixelButton>
      </div>
      <button className="text-[8px] text-muted-foreground underline" onClick={() => go("fuentes")}>Fuentes y créditos</button>
    </div>
  );
}

export function Rechazo() {
  const go = useGame((s) => s.go);
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 text-center">
      <Stars />
      <p className="text-sm text-suit-light">Hasta la próxima, astronauta</p>
      <PixelButton tone="ghost" onClick={() => go("intro")}>Volver al inicio</PixelButton>
    </div>
  );
}

export function ModeSelect() {
  const { go, newGame, loadGame } = useGame();
  const [mode, setMode] = useState<Mode>("realista");
  const [diff, setDiff] = useState<Difficulty>("normal");
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-auto p-6">
      <Stars />
      <h2 className="text-sm text-gold">ELIGE TU EXPERIENCIA</h2>
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {(Object.keys(modos.modos) as Mode[]).map((m) => {
          const c = modos.modos[m];
          const tone = m === "realista" ? "border-ok" : m === "fantastico" ? "border-alien" : "border-destructive";
          return (
            <button key={m} onClick={() => { sfx.click(); setMode(m); }}
              className={`relative border-4 bg-card p-4 text-left ${mode === m ? tone : "border-border opacity-70"}`}>
              <div className="text-[11px] text-foreground">{c.nombre}</div>
              <div className="mt-3 text-[8px] leading-4 text-muted-foreground">{c.desc}</div>
              {m !== "realista" && <div className="mt-2 text-[7px] text-alert">Aliens en la próxima versión</div>}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {(Object.keys(modos.dificultades) as Difficulty[]).map((d) => (
          <button key={d} onClick={() => { sfx.click(); setDiff(d); }}
            className={`px-3 py-2 text-[9px] ${diff === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {modos.dificultades[d].nombre}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <PixelButton onClick={() => { newGame(mode, diff); go("cinematica"); }}>Comenzar</PixelButton>
        {hasSave() && <PixelButton tone="ghost" onClick={() => { if (loadGame()) go("juego"); }}>Continuar</PixelButton>}
      </div>
    </div>
  );
}

const PANELS = [
  { text: "Año 2026. Despegas rumbo a una misión de rutina más allá de la órbita terrestre.", art: "launch" },
  { text: "Una alarma. Un fallo en los tanques: el combustible escapa al vacío.", art: "fail" },
  { text: "Sin opciones, apuntas al polo sur de la Luna y desciendes de emergencia.", art: "fall" },
  { text: "Sobreviviste. Pero estás VARADO. Para volver tendrás que fabricar tu propio combustible.", art: "land" },
];
export function Cinematic() {
  const go = useGame((s) => s.go);
  const [i, setI] = useState(0);
  const p = PANELS[i]!;
  const typed = useTypewriter(p.text);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div key={i} className="w-full max-w-lg animate-in fade-in duration-500">
        <StoryAnimation scene={p.art as SceneId} />
        <p className="mt-4 min-h-16 text-[10px] leading-5">{typed}<span className="animate-blink">▌</span></p>
        <div className="mt-2 text-[8px] text-muted-foreground">{i + 1}/4</div>
      </div>
      <div className="flex gap-3">
        <PixelButton tone="ghost" onClick={() => go("juego")}>Saltar</PixelButton>
        <PixelButton onClick={() => (i < 3 ? setI(i + 1) : go("juego"))}>{i < 3 ? "Siguiente" : "Comenzar"}</PixelButton>
      </div>
    </div>
  );
}

export function Fuentes() {
  const go = useGame((s) => s.go);
  return (
    <div className="flex h-full flex-col items-center gap-6 overflow-auto p-8">
      <h2 className="text-sm text-gold">FUENTES Y CRÉDITOS</h2>
      <p className="max-w-2xl text-[7px] leading-4 text-muted-foreground"><span className="text-ok">NASA-LISTA</span>: recurso oficial del reto · <span className="text-gold">EXTERNO</span>: dato real fuera de la lista · <span className="text-alert">FICCIÓN</span>: inventado para el juego</p>
      <ul className="max-w-2xl space-y-4">
        {fuentes.map((f) => (
          <li key={f.titulo} className="border-l-4 border-suit pl-3 text-[9px] leading-5">
            <span className={f.tipo === "NASA-LISTA" ? "text-ok" : f.tipo === "EXTERNO" ? "text-gold" : f.tipo === "FICCIÓN" ? "text-alert" : "text-suit-light"}>[{f.tipo}]</span> {f.titulo}
            <div className="text-muted-foreground">{f.nota}</div>
            {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="break-all text-[7px] text-suit-light underline">{f.url}</a>}
          </li>
        ))}
      </ul>
      <p className="max-w-2xl text-[8px] leading-5 text-muted-foreground">NASA se menciona solo como fuente de datos. Este juego no está afiliado ni respaldado por NASA.</p>
      <PixelButton tone="ghost" onClick={() => go("intro")}>Volver</PixelButton>
    </div>
  );
}

/** Basic end screen after a successful launch (the full explanatory report comes in a later iteration). */
export function Final() {
  const go = useGame((s) => s.go);
  const s = useGame((g) => g.snap);
  const r = s.result;
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-auto p-6 text-center">
      <Stars />
      <h2 className="text-2xl text-ok drop-shadow-[3px_3px_0_var(--color-moon-0)]">¡REGRESO A CASA!</h2>
      {r && (
        <div className="max-w-xl space-y-2 text-[9px] leading-5">
          {MISIONES.final.map((l) => <p key={l} className="text-suit-light">{l}</p>)}
          <p className="pt-2">Despegaste el día {r.dia} en la ventana {r.ventana}.</p>
          <p>Misiones secundarias: {s.quest.sideDone.length}/{sideAvailable(s).length} · Cápsulas abiertas: {s.stats.capsulas} · Reparaciones: {s.stats.reparaciones}</p>
          <p>Combustible de sobra: LH2 {r.lh2Sobra.toFixed(1)} kg · LOX {r.loxSobra.toFixed(1)} kg</p>
          <p className="text-gold">Logros: {s.logros.join(" · ") || "—"}</p>
          <p className="text-[7px] text-muted-foreground">Las ventanas y el combustible requerido son provisionales hasta calcularlos con GMAT.</p>
        </div>
      )}
      <PixelButton onClick={() => go("intro")}>Volver al inicio</PixelButton>
    </div>
  );
}
