import { useEffect } from "react";
import modos from "@/data/modos.json";
import recetas from "@/data/recetas.json";
import { useGame, sim, saveGame } from "@/game/store";
import { clock, LH2_CAP, LOX_CAP, canCraft, isDay, addLog } from "@/game/sim";
import { sfx } from "@/game/audio";
import { PixelButton } from "./Screens";

function Bar({ label, v, max = 100, tone = "bg-ok", warn = 25 }: { label: string; v: number; max?: number; tone?: string; warn?: number }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="text-[7px] text-muted-foreground">{label}</span>
      <div className="h-2 w-14 bg-moon-0 sm:w-20"><div className={`h-full ${pct < warn ? "bg-alert" : tone}`} style={{ width: `${pct}%` }} /></div>
      <span className="w-8 text-[7px]">{Math.round(pct)}%</span>
    </div>
  );
}
const HOTBAR = ["Pala", "Taladro", "Kit", "Linterna", "Escáner"];

export function HUD() {
  const s = useGame((g) => g.snap);
  const ratio = s.lh2 > 0.01 ? s.lox / s.lh2 : 0;
  const acto = modos.actos[s.act - 1] ?? modos.actos[3];
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 space-y-1 bg-background/80 p-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Bar label="O2" v={s.suitO2} tone="bg-suit-light" />
          <Bar label="SALUD" v={s.health} />
          <span className={`text-[8px] ${s.temp < 5 ? "text-suit-light" : "text-foreground"}`}>{s.temp.toFixed(0)}°C</span>
          <span className={`ml-auto text-[8px] ${isDay(s) ? "text-gold" : "text-suit-light"}`}>{clock(s)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[7px]"><span className="text-muted-foreground">ENERGÍA</span> <span className="text-ok">+{s.energyIn.toFixed(0)}</span>/<span className="text-alert">-{s.energyOut.toFixed(0)}</span> BAT {s.battery.toFixed(0)}</span>
          <Bar label="LH2" v={s.lh2} max={LH2_CAP} tone="bg-suit-light" warn={0} />
          <Bar label="LOX" v={s.lox} max={LOX_CAP} tone="bg-suit" warn={0} />
          <span className="text-[7px]"><span className="text-muted-foreground">MEZCLA O2:H2</span> <span className={Math.abs(ratio - 6) < 0.5 ? "text-ok" : "text-alert"}>{ratio.toFixed(1)}:1</span> <span className="text-muted-foreground">(obj 6:1)</span></span>
        </div>
        {s.alert && <div className="animate-blink text-center text-[9px] text-alert">⚠ {s.alert}</div>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-background/80 p-2">
        <div className="text-[8px] text-gold">ACTO {acto.n} · {acto.titulo.toUpperCase()}: <span className="text-foreground">{acto.meta}</span></div>
        {s.hint && <div className="text-[7px] text-ok">{s.hint}</div>}
        <div className="flex gap-1">
          {HOTBAR.map((h, i) => (
            <div key={h} className={`border-2 px-2 py-1 text-[7px] ${s.hotbar === i + 1 ? "border-gold text-gold" : "border-moon-2 text-muted-foreground"}`}>{i + 1} {h}</div>
          ))}
        </div>
        <div className="text-[6px] text-muted-foreground">WASD mover · ESPACIO recoger · E interactuar (mantén para sellar) · TAB inventario · B base · L bitácora · ESC pausa</div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const close = () => useGame.getState().setOverlay(null);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-auto border-4 border-suit bg-card p-4">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-[11px] text-gold">{title}</h3><button onClick={close} className="text-[9px] text-muted-foreground">[X]</button></div>
        {children}
      </div>
    </div>
  );
}

function Inventory() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  return (
    <Panel title="INVENTARIO Y CRAFTEO">
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Object.entries(s.inv).map(([k, v]) => <div key={k} className="bg-secondary p-2 text-[8px]">{k.replace("_", " ")}: <span className="text-gold">{Number(v).toFixed(v % 1 ? 1 : 0)}</span></div>)}
      </div>
      <div className="space-y-2">
        {recetas.map((r) => {
          const ok = r.disponible && canCraft(s.inv, r.ingredientes);
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[8px]">
              <div><div>{r.nombre}</div><div className="text-muted-foreground">{Object.entries(r.ingredientes).map(([k, v]) => `${v} ${k}`).join(" + ")}{!r.disponible && " · próximamente"}</div></div>
              <button disabled={!ok} onClick={() => {
                for (const [k, v] of Object.entries(r.ingredientes)) sim.inv[k] -= v;
                for (const [k, v] of Object.entries(r.resultado)) sim.inv[k] = (sim.inv[k] ?? 0) + v;
                addLog(sim, `Crafteaste: ${r.nombre}.`); sfx.ok(); publish();
              }} className="bg-primary px-2 py-1 text-primary-foreground disabled:opacity-30">CREAR</button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Base() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  return (
    <Panel title="PANEL DE BASE">
      <div className="mb-3 text-[8px] text-muted-foreground">O2 del hábitat: <span className="text-foreground">{s.habitatO2.toFixed(0)}%</span> · Agua: {s.inv.agua.toFixed(1)} kg · H2 gas {s.h2gas.toFixed(2)} kg · O2 gas {s.o2gas.toFixed(2)} kg</div>
      <div className="space-y-2">
        {s.modules.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2 text-[8px]">
            <span className="w-40">{m.nombre}</span>
            <div className="h-2 flex-1 bg-moon-0"><div className={`h-full ${m.durabilidad < 25 ? "bg-alert" : "bg-ok"}`} style={{ width: `${m.durabilidad}%` }} /></div>
            <span className="w-8">{m.durabilidad.toFixed(0)}%</span>
            <button onClick={() => { sim.modules[i].activo = !sim.modules[i].activo; publish(); sfx.click(); }} className={`w-10 px-1 py-1 ${m.activo ? "bg-ok text-background" : "bg-secondary"}`}>{m.activo ? "ON" : "OFF"}</button>
            <button disabled={s.inv.kits < 1 || m.durabilidad >= 100} onClick={() => { sim.inv.kits -= 1; sim.modules[i].durabilidad = Math.min(100, m.durabilidad + 30); addLog(sim, `Mantenimiento: ${m.nombre}.`); publish(); sfx.ok(); }} className="bg-primary px-2 py-1 text-primary-foreground disabled:opacity-30">+30% (1 KIT)</button>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[7px] leading-4 text-muted-foreground">Electrólisis: agua + energía → H2 y O2 (masa 1:8). El licuefactor llena LH2 y LOX manteniendo ~6:1; el O2 sobrante va al hábitat.</p>
    </Panel>
  );
}

function Rocket() {
  const s = useGame((g) => g.snap);
  return (
    <Panel title="CHECKLIST DEL COHETE">
      <div className="space-y-2">
        {Object.entries(s.rocket).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[8px]"><span className="w-40">{k}</span><div className="h-2 flex-1 bg-moon-0"><div className={`h-full ${v >= 90 ? "bg-ok" : "bg-alert"}`} style={{ width: `${v}%` }} /></div><span>{v}%</span></div>
        ))}
        <div className="pt-2 text-[8px]">Tanques: LH2 {s.lh2.toFixed(1)}/{LH2_CAP} kg · LOX {s.lox.toFixed(1)}/{LOX_CAP} kg</div>
      </div>
      <PixelButton disabled>Despegar</PixelButton>
      <p className="mt-2 text-[7px] text-alert">No puedes despegar: faltan subsistemas en verde, tanques llenos y una ventana de regreso (CubeSat relé — próxima versión).</p>
    </Panel>
  );
}

function Log() {
  const s = useGame((g) => g.snap);
  return (
    <Panel title="BITÁCORA">
      <div className="mb-3 text-[8px] text-ok">Logros: {s.logros.length ? s.logros.join(" · ") : "ninguno aún"}</div>
      <ul className="space-y-1">{s.log.map((l, i) => <li key={i} className="text-[8px] leading-4"><span className="text-muted-foreground">[{l.t}]</span> {l.text}</li>)}</ul>
    </Panel>
  );
}

function Pause() {
  const { setOverlay, go } = useGame();
  return (
    <Panel title="PAUSA">
      <div className="flex flex-wrap gap-3">
        <PixelButton onClick={() => setOverlay(null)}>Continuar</PixelButton>
        <PixelButton tone="ghost" onClick={() => { saveGame(); sfx.ok(); }}>Guardar</PixelButton>
        <PixelButton tone="alert" onClick={() => { saveGame(); setOverlay(null); go("intro"); }}>Salir al inicio</PixelButton>
      </div>
    </Panel>
  );
}

export function Overlays() {
  const overlay = useGame((g) => g.overlay);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const map: Record<string, "inv" | "base" | "log" | "pausa"> = { Tab: "inv", b: "base", B: "base", l: "log", L: "log", Escape: "pausa" };
      const o = map[e.key];
      if (!o) return;
      e.preventDefault();
      const cur = useGame.getState().overlay;
      useGame.getState().setOverlay(cur ? null : o);
      sfx.click();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  if (overlay === "inv") return <Inventory />;
  if (overlay === "base") return <Base />;
  if (overlay === "log") return <Log />;
  if (overlay === "pausa") return <Pause />;
  if (overlay === "cohete") return <Rocket />;
  return null;
}
