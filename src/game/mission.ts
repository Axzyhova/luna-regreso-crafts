import cubesat from "@/data/piezas_cubesat.json";
import ventanas from "@/data/ventanas_regreso.json";
import aliensCfg from "@/data/aliens.json";
import { addLog, advanceAct, canCraft, unlock, CYCLE, SUBSISTEMAS, UMBRAL_VERDE, type Sim } from "./sim";

// ---------------------------------------------------------------------------
// CubeSat relé (datos basados en CubeSat 101, NASA CSLI)
// ---------------------------------------------------------------------------
export type Pieza = (typeof cubesat.piezas)[number];
export const PIEZAS = cubesat.piezas as Pieza[];
export const COLS = cubesat.cuadricula.columnas;
export const ROWS = cubesat.cuadricula.filas;
export const ROWS_PER_U = cubesat.cuadricula.filas_por_U;
export const MASA_MAX = cubesat.limite_masa_kg;
export const RELAY_FUEL = cubesat.lanzamiento_relay;
export interface Placed { uid: number; id: string; x: number; y: number; rot: number }
export const pieza = (id: string) => PIEZAS.find((p) => p.id === id)!;

/** Cells (dx, dy) a shape covers after `rot` quarter turns clockwise. */
export function shapeCells(forma: number[][], rot = 0): [number, number][] {
  let cells: [number, number][] = [];
  forma.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) {
    const h = Math.max(...cells.map(([, y]) => y)) + 1;
    cells = cells.map(([x, y]) => [h - 1 - y, x]);
  }
  return cells;
}
export function occupied(placed: Placed[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of placed) for (const [dx, dy] of shapeCells(pieza(p.id).forma, p.rot)) m.set(`${p.x + dx},${p.y + dy}`, p.uid);
  return m;
}
export function canPlace(placed: Placed[], id: string, x: number, y: number, rot: number) {
  const occ = occupied(placed);
  return shapeCells(pieza(id).forma, rot).every(([dx, dy]) => {
    const cx = x + dx, cy = y + dy;
    return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && !occ.has(`${cx},${cy}`);
  });
}
export function cubesatStats(placed: Placed[]) {
  let masa = 0, energia = 0;
  const costo: Record<string, number> = {};
  for (const p of placed) {
    const pz = pieza(p.id);
    masa += pz.masa_kg; energia += pz.energia_w;
    for (const [k, v] of Object.entries(pz.costo)) costo[k] = (costo[k] ?? 0) + (v ?? 0);
  }
  return { masa: Math.round(masa * 100) / 100, energia: Math.round(energia * 10) / 10, costo };
}
/** Design problems, each explained in plain language (empty = viable). */
export function cubesatIssues(placed: Placed[]): string[] {
  const out: string[] = [];
  const st = cubesatStats(placed);
  for (const r of cubesat.requisitos) if (!placed.some((p) => p.id === r.pieza)) out.push(r.texto);
  if (st.masa > MASA_MAX) out.push(`Too heavy: ${st.masa} kg of the ${MASA_MAX} kg allowed for a 3U.`);
  if (st.energia < 0) out.push(`Negative power (${st.energia} W): it uses more than the panels generate.`);
  return out;
}
/** Why the relay can't launch now (design, materials or fuel), or null. */
export function relayBlock(s: Sim): string | null {
  if (s.relay) return "The relay is already in orbit";
  const issues = cubesatIssues(s.cubesat);
  if (issues.length) return "The design is not viable yet";
  if (!canCraft(s.inv, cubesatStats(s.cubesat).costo)) return "Missing materials to build the parts";
  if (s.lh2 < RELAY_FUEL.lh2_kg || s.lox < RELAY_FUEL.lox_kg) return `Not enough fuel for the small rocket: ${RELAY_FUEL.lh2_kg} kg LH2 and ${RELAY_FUEL.lox_kg} kg LOX`;
  return null;
}
export function launchRelay(s: Sim) {
  if (relayBlock(s)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(cubesatStats(s.cubesat).costo)) inv[k] = (inv[k] ?? 0) - v;
  s.lh2 -= RELAY_FUEL.lh2_kg; s.lox -= RELAY_FUEL.lox_kg;
  s.relay = true;
  addLog(s, `Day ${s.day}: you launched the CubeSat relay. -${RELAY_FUEL.lh2_kg} kg LH2, -${RELAY_FUEL.lox_kg} kg LOX.`);
  unlock(s, "Contact with Earth");
  const w = nextWindow(s);
  addLog(s, `Mission Control: next return window ${w.id}, day ${w.abre_dia}. You need ${w.lh2_kg} kg LH2 and ${w.lox_kg} kg LOX.`);
  while (s.act < 4) advanceAct(s);
  return true;
}

// ---------------------------------------------------------------------------
// Ventanas de regreso (PROVISIONALES: deben generarse con GMAT)
// ---------------------------------------------------------------------------
export type Ventana = (typeof ventanas.ventanas)[number];
export const VENTANAS_PROVISIONALES = ventanas.provisional;
/** All windows up to `untilDay`, repeating the last one every N days. */
export function windowsUntil(untilDay: number): Ventana[] {
  const list = [...ventanas.ventanas];
  const last = list[list.length - 1]!;
  for (let d = last.abre_dia + ventanas.repetir_cada_dias, k = 1; d <= untilDay; d += ventanas.repetir_cada_dias, k++) list.push({ ...last, id: `${last.id}.${k}`, abre_dia: d });
  return list;
}
const tod = (s: Sim) => s.time % CYCLE;
export function currentWindow(s: Sim): Ventana | null {
  return windowsUntil(s.day).find((w) => w.abre_dia === s.day && tod(s) < w.dura_s) ?? null;
}
export function nextWindow(s: Sim): Ventana {
  return currentWindow(s) ?? windowsUntil(s.day + 30).find((w) => w.abre_dia > s.day)!;
}
/** Seconds left in the open window (0 if closed). */
export const windowSecondsLeft = (s: Sim) => { const w = currentWindow(s); return w ? w.dura_s - tod(s) : 0; };

// ---------------------------------------------------------------------------
// Despegue
// ---------------------------------------------------------------------------
const tankLeaks = (s: Sim) => s.leaks.filter((l) => l.target !== "habitat").length;
/** Everything still missing before launch, in plain language. */
export function launchBlockers(s: Sim): string[] {
  const out: string[] = [];
  const rojos = SUBSISTEMAS.filter((x) => (s.rocket[x.id] ?? 0) < UMBRAL_VERDE).map((x) => x.id);
  if (rojos.length) out.push(`Subsystems below ${UMBRAL_VERDE}%: ${rojos.join(", ")}`);
  if (tankLeaks(s)) out.push("There are leaks in the tanks");
  if (!s.relay) { out.push("No return window: launch the CubeSat relay to receive it"); return out; }
  const w = nextWindow(s);
  if (s.lh2 < w.lh2_kg || s.lox < w.lox_kg) out.push(`Not enough fuel for ${w.id}: LH2 ${s.lh2.toFixed(0)}/${w.lh2_kg} · LOX ${s.lox.toFixed(0)}/${w.lox_kg} kg`);
  if (!currentWindow(s)) out.push(`Outside a window: ${w.id} opens on day ${w.abre_dia}`);
  return out;
}
export function launch(s: Sim) {
  if (launchBlockers(s).length) return false;
  const w = currentWindow(s)!;
  s.result = { ok: true, dia: s.day, ventana: w.id, lh2Sobra: s.lh2 - w.lh2_kg, loxSobra: s.lox - w.lox_kg, destino: s.destino };
  addLog(s, s.destino === "mars" ? `Day ${s.day}: liftoff for Mars — next stop, Jezero Crater!` : `Day ${s.day}: liftoff in window ${w.id}!`);
  unlock(s, "Back home");
  return true;
}

// ---------------------------------------------------------------------------
// Cuenta regresiva (en modos con aliens aparece la Nodriza)
// ---------------------------------------------------------------------------
export const countdownLength = (s: Sim) => aliensCfg.cuenta_regresiva_s[s.mode];
export function startLaunch(s: Sim, destino: "earth" | "mars" = "earth") {
  if (s.countdown !== null || launchBlockers(s).length) return false;
  if (destino === "mars" && !s.navcore) return false;
  s.destino = destino;
  s.countdown = countdownLength(s);
  addLog(s, `Countdown started: ${s.countdown} s. Keep the rocket safe.`);
  return true;
}
/** Advances the countdown: "launched" at zero, "aborted" if anything breaks the launch conditions. */
export function stepCountdown(s: Sim, dt: number): "launched" | "aborted" | null {
  if (s.countdown === null) return null;
  const b = launchBlockers(s);
  if (b.length) { s.countdown = null; addLog(s, `Launch aborted: ${b[0]}.`); return "aborted"; }
  s.countdown -= dt;
  if (s.countdown <= 0) { s.countdown = null; s.aliens = []; return launch(s) ? "launched" : "aborted"; }
  return null;
}
