import { useState } from "react";
import modos from "@/data/modos.json";
import fuentes from "@/data/fuentes.json";
import { useGame, hasSave } from "@/game/store";
import type { Mode, Difficulty } from "@/game/sim";
import { sfx } from "@/game/audio";

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
      <h1 className="text-3xl text-suit-light drop-shadow-[4px_4px_0_var(--color-suit)] sm:text-5xl">VARADOS</h1>
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
function PanelArt({ art }: { art: string }) {
  return (
    <div className="relative h-40 w-full overflow-hidden border-4 border-moon-2 bg-space">
      <div className="stars absolute inset-0" />
      {art !== "launch" && art !== "fail" ? null : <div className="absolute bottom-0 h-8 w-full bg-suit" />}
      {(art === "fall" || art === "land") && <div className="absolute bottom-0 h-10 w-full bg-moon-1" />}
      <div className={`absolute left-1/2 w-4 -translate-x-1/2 bg-moon-4 ${art === "land" ? "bottom-10 h-12" : art === "fall" ? "top-6 h-12 rotate-[25deg]" : "bottom-12 h-14"}`}>
        <div className="absolute -top-3 left-0 h-3 w-4 bg-foreground [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
      </div>
      {art !== "land" && <div className={`absolute left-1/2 h-6 w-3 -translate-x-1/2 animate-pulse bg-alert ${art === "fall" ? "top-[4.5rem] rotate-[25deg]" : "bottom-6"}`} />}
      {art === "fail" && <div className="absolute left-[55%] top-10 animate-ping text-[10px] text-destructive">!!</div>}
    </div>
  );
}

export function Cinematic() {
  const go = useGame((s) => s.go);
  const [i, setI] = useState(0);
  const p = PANELS[i]!;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-lg">
        <PanelArt art={p.art} />
        <p className="mt-4 min-h-16 text-[10px] leading-5">{p.text}</p>
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
      <ul className="max-w-2xl space-y-4">
        {fuentes.map((f) => (
          <li key={f.titulo} className="border-l-4 border-suit pl-3 text-[9px] leading-5">
            <span className="text-ok">[{f.tipo}]</span> {f.titulo}
            <div className="text-muted-foreground">{f.nota}</div>
          </li>
        ))}
      </ul>
      <p className="max-w-2xl text-[8px] leading-5 text-muted-foreground">NASA se menciona solo como fuente de datos. Este juego no está afiliado ni respaldado por NASA.</p>
      <PixelButton tone="ghost" onClick={() => go("intro")}>Volver</PixelButton>
    </div>
  );
}
