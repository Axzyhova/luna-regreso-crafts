import cubesat from "@/data/piezas_cubesat.json";
import ventanas from "@/data/ventanas_regreso.json";
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
  if (st.masa > MASA_MAX) out.push(`Demasiado pesado: ${st.masa} kg de ${MASA_MAX} kg permitidos para un 3U.`);
  if (st.energia < 0) out.push(`Energía negativa (${st.energia} W): consume más de lo que generan los paneles.`);
  return out;
}
/** Why the relay can't launch now (design, materials or fuel), or null. */
export function relayBlock(s: Sim): string | null {
  if (s.relay) return "El relé ya está en órbita";
  const issues = cubesatIssues(s.cubesat);
  if (issues.length) return "El diseño aún no es viable";
  if (!canCraft(s.inv, cubesatStats(s.cubesat).costo)) return "Faltan materiales para fabricar las piezas";
  if (s.lh2 < RELAY_FUEL.lh2_kg || s.lox < RELAY_FUEL.lox_kg) return `Falta combustible para el cohete pequeño: ${RELAY_FUEL.lh2_kg} kg LH2 y ${RELAY_FUEL.lox_kg} kg LOX`;
  return null;
}
export function launchRelay(s: Sim) {
  if (relayBlock(s)) return false;
  const inv = s.inv as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(cubesatStats(s.cubesat).costo)) inv[k] = (inv[k] ?? 0) - v;
  s.lh2 -= RELAY_FUEL.lh2_kg; s.lox -= RELAY_FUEL.lox_kg;
  s.relay = true;
  addLog(s, `Día ${s.day}: lanzaste el CubeSat relé. -${RELAY_FUEL.lh2_kg} kg LH2, -${RELAY_FUEL.lox_kg} kg LOX.`);
  unlock(s, "Contacto con la Tierra");
  const w = nextWindow(s);
  addLog(s, `Control de Misión: próxima ventana de regreso ${w.id}, día ${w.abre_dia}. Necesitas ${w.lh2_kg} kg LH2 y ${w.lox_kg} kg LOX.`);
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
  if (rojos.length) out.push(`Subsistemas por debajo de ${UMBRAL_VERDE}%: ${rojos.join(", ")}`);
  if (tankLeaks(s)) out.push("Hay fugas en los tanques");
  if (!s.relay) { out.push("Sin ventana de regreso: lanza el CubeSat relé para recibirla"); return out; }
  const w = nextWindow(s);
  if (s.lh2 < w.lh2_kg || s.lox < w.lox_kg) out.push(`Tanques insuficientes para ${w.id}: LH2 ${s.lh2.toFixed(0)}/${w.lh2_kg} · LOX ${s.lox.toFixed(0)}/${w.lox_kg} kg`);
  if (!currentWindow(s)) out.push(`Fuera de ventana: ${w.id} abre el día ${w.abre_dia}`);
  return out;
}
export function launch(s: Sim) {
  if (launchBlockers(s).length) return false;
  const w = currentWindow(s)!;
  s.result = { ok: true, dia: s.day, ventana: w.id, lh2Sobra: s.lh2 - w.lh2_kg, loxSobra: s.lox - w.lox_kg };
  addLog(s, `Día ${s.day}: ¡despegue en la ventana ${w.id}!`);
  unlock(s, "Regreso a casa");
  return true;
}
