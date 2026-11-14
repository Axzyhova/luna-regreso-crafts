import { useState } from "react";
import { useGame, sim } from "@/game/store";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PIEZAS, COLS, ROWS, ROWS_PER_U, MASA_MAX, RELAY_FUEL, pieza, shapeCells, canPlace, occupied, cubesatStats, cubesatIssues, relayBlock, launchRelay } from "@/game/mission";
import { PixelButton } from "./Screens";

const COLOR: Record<string, string> = { panel: "bg-suit", bateria: "bg-ok", radio: "bg-alert", computadora: "bg-gold", estructura: "bg-moon-3" };

/** 3U CubeSat relay designer: place Tetris-like parts on a 3x6 grid (data from CubeSat 101). */
export function CubeSatDesigner() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const [sel, setSel] = useState<string>("panel");
  const [rot, setRot] = useState(0);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const occ = occupied(s.cubesat);
  const st = cubesatStats(s.cubesat);
  const issues = cubesatIssues(s.cubesat);
  const block = relayBlock(s);
  const inv = s.inv as unknown as Record<string, number>;
  const ghost = hover && !s.relay ? shapeCells(pieza(sel).forma, rot).map(([dx, dy]) => `${hover[0] + dx},${hover[1] + dy}`) : [];
  const ghostOk = hover ? canPlace(s.cubesat, sel, hover[0], hover[1], rot) : false;

  const clickCell = (x: number, y: number) => {
    if (s.relay) return;
    const uid = occ.get(`${x},${y}`);
    if (uid !== undefined) { sim.cubesat = sim.cubesat.filter((p) => p.uid !== uid); sfx.click(); }
    else if (canPlace(sim.cubesat, sel, x, y, rot)) { sim.cubesat.push({ uid: sim.nextUid++, id: sel, x, y, rot }); sfx.pick(); }
    else sfx.bad();
    publish();
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4 short:p-1">
      <div className="max-h-full w-full max-w-3xl overflow-auto border-4 border-suit bg-card p-4 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] text-gold">CUBESAT RELAY DESIGNER (3U)</h3>
          <button onClick={() => setOverlay("cohete")} className="text-[9px] text-muted-foreground">[BACK TO ROCKET]</button>
        </div>
        <p className="mb-3 text-[7px] leading-4 text-muted-foreground">The rocket's antenna broke. A small satellite in orbit can relay your signal to Earth and bring you the return window. Format and mass limit based on CubeSat 101 (NASA).</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* piezas */}
          <div className="space-y-1 sm:w-56">
            <div className="text-[8px] text-gold">PARTS</div>
            {PIEZAS.map((p) => (
              <button key={p.id} onClick={() => { setSel(p.id); sfx.click(); }} disabled={s.relay}
                className={`block w-full border-2 p-2 text-left text-[7px] leading-4 ${sel === p.id ? "border-gold" : "border-border"} disabled:opacity-40`}>
                <span className={`mr-1 inline-block h-2 w-2 ${COLOR[p.id]}`} />{p.nombre}
                <span className="text-muted-foreground"> · {p.masa_kg} kg · {p.energia_w > 0 ? "+" : ""}{p.energia_w} W</span>
                <div className="text-muted-foreground">{p.desc}</div>
              </button>
            ))}
            <button disabled={s.relay} onClick={() => { setRot((r) => (r + 1) % 4); sfx.click(); }} className="mt-1 w-full bg-secondary px-2 py-1 text-[8px] disabled:opacity-40">ROTATE PART (R)</button>
          </div>
          {/* cuadrícula */}
          <div className="flex flex-col items-center gap-1" onKeyDown={(e) => { if (e.key === "r" || e.key === "R") setRot((r) => (r + 1) % 4); }} tabIndex={0}>
            {Array.from({ length: ROWS }, (_, y) => (
              <div key={y} className={`flex gap-1 ${y > 0 && y % ROWS_PER_U === 0 ? "mt-2" : ""}`}>
                {Array.from({ length: COLS }, (_, x) => {
                  const uid = occ.get(`${x},${y}`);
                  const p = uid !== undefined ? s.cubesat.find((q) => q.uid === uid) : undefined;
                  const g = ghost.includes(`${x},${y}`);
                  return (
                    <button key={x} onClick={() => clickCell(x, y)} onMouseEnter={() => setHover([x, y])} onMouseLeave={() => setHover(null)}
                      title={p ? `${pieza(p.id).nombre} (click to remove)` : "Click to place"}
                      className={`h-10 w-10 border-2 ${p ? `${COLOR[p.id]} border-moon-0` : "border-moon-2 bg-moon-0"} ${g && !p ? (ghostOk ? "bg-ok/40" : "bg-destructive/40") : ""}`} />
                  );
                })}
              </div>
            ))}
            <div className="mt-1 text-[6px] text-muted-foreground">1U · 1U · 1U (top to bottom)</div>
          </div>
          {/* estado */}
          <div className="flex-1 space-y-2 text-[8px]">
            <div>MASS <span className={st.masa > MASA_MAX ? "text-destructive" : "text-ok"}>{st.masa} / {MASA_MAX} kg</span></div>
            <div className="h-2 bg-moon-0"><div className={`h-full ${st.masa > MASA_MAX ? "bg-destructive" : "bg-ok"}`} style={{ width: `${Math.min(100, (st.masa / MASA_MAX) * 100)}%` }} /></div>
            <div>NET POWER <span className={st.energia < 0 ? "text-destructive" : "text-ok"}>{st.energia > 0 ? "+" : ""}{st.energia} W</span></div>
            <div className="text-[7px] text-muted-foreground">Fabricar las piezas cuesta:</div>
            <div className="flex flex-wrap gap-2 text-[7px]">
              {Object.keys(st.costo).length === 0 && <span className="text-muted-foreground">—</span>}
              {Object.entries(st.costo).map(([k, v]) => <span key={k} className={(inv[k] ?? 0) >= v ? "text-muted-foreground" : "text-destructive"}>{v} {ITEMS[k]?.nombre ?? k} ({Math.floor(inv[k] ?? 0)})</span>)}
            </div>
            <div className="text-[7px] leading-4 text-suit-light">Lanzarlo cuesta {RELAY_FUEL.lh2_kg} kg LH2 y {RELAY_FUEL.lox_kg} kg LOX. {RELAY_FUEL.explicacion}</div>
            {s.relay ? <div className="text-ok">✔ The relay is in orbit. You have contact with Earth.</div> : (
              <>
                {issues.length > 0 && <ul className="space-y-1 text-[7px] leading-4 text-alert">{issues.map((i) => <li key={i}>· {i}</li>)}</ul>}
                {issues.length === 0 && <div className="text-ok">✔ Viable design</div>}
                <PixelButton disabled={!!block} onClick={() => { if (launchRelay(sim)) { sfx.ok(); publish(); } }}>Launch relay</PixelButton>
                {block && issues.length === 0 && <div className="text-[7px] text-alert">{block}</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
