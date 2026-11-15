import data from "@/data/misiones.json";
import archivo from "@/data/archivo.json";
import { addLog, addItem, notify, isOn, UMBRAL_VERDE, SUBSISTEMAS, type Inv, type Sim, giveItem } from "./sim";
import { aliensEnabled } from "./aliens";
import { nextWindow } from "./mission";
import { expedicion } from "./history";

export type Quest = (typeof data.principales)[number];
export type SideQuest = (typeof data.secundarias)[number] & { solo_aliens?: boolean };
export const MISIONES = data;
export const PRINCIPALES = data.principales as Quest[];
export const SECUNDARIAS = data.secundarias as SideQuest[];

/** Each quest condition, readable by id from misiones.json. */
export const COND: Record<string, (s: Sim) => boolean> = {
  fuga_sellada: (s) => s.actFlags.leakFixed,
  hielo_6: (s) => s.stats.hielo >= 6,
  lh2_3: (s) => s.lh2 >= 3,
  esencial_70: (s) => (s.rocket["Structure"] ?? 0) >= 70 && (s.rocket["Power"] ?? 0) >= 70,
  relay: (s) => s.relay,
  listo_para_despegar: (s) => {
    if (!s.relay || SUBSISTEMAS.some((x) => (s.rocket[x.id] ?? 0) < UMBRAL_VERDE)) return false;
    const w = nextWindow(s);
    return s.lh2 >= w.lh2_kg && s.lox >= w.lox_kg;
  },
  despegue: (s) => !!s.result?.ok,
  capsulas_3: (s) => s.stats.capsulas >= 3,
  llamarada_superada: (s) => s.stats.llamaradas >= 1,
  torres_2: (s) => s.modules.filter((m) => m.tipo === "torre_luz" && isOn(m)).length >= 2,
  reparaciones_5: (s) => s.stats.reparaciones >= 5,
  aliens_5: (s) => s.stats.aliens >= 5,
  mezcla: (s) => s.logros.includes("Perfect 6:1 mix"),
  visit_fire: (s) => s.visited.includes("fire"),
  cristales_5: (s) => s.inv.cristal_hielo >= 5,
  puente: (s) => s.bridge,
  aleacion_3: (s) => s.inv.aleacion >= 3,
};

export const currentMain = (s: Sim): Quest | null => PRINCIPALES[s.quest.main] ?? null;
export const sideAvailable = (s: Sim) => SECUNDARIAS.filter((q) => !q.solo_aliens || aliensEnabled(s));

/** Check objectives, queue story dialog, give rewards. Call every frame (cheap). */
export type ArchiveEntry = (typeof archivo.misiones)[number];
export const ARCHIVO = archivo.misiones as ArchiveEntry[];
/** Is an archive entry's unlock condition met? ("inicio", "M3" = main mission 3 done, "zona_fire" = zone visited). */
export function archiveReady(s: Sim, cond: string) {
  if (cond === "inicio") return true;
  if (cond.startsWith("M")) return s.quest.main >= Number(cond.slice(1));
  if (cond.startsWith("zona_")) return s.visited.includes(cond.slice(5));
  if (cond.startsWith("poi_")) return s.pois.includes(cond.slice(4));
  return false;
}

/** Unlock archive entries whose condition is now met (with a pop-up for story unlocks). */
export function unlockArchive(s: Sim) {
  for (const e of ARCHIVO) {
    if (s.archive.includes(e.id) || !archiveReady(s, e.desbloqueo)) continue;
    s.archive.push(e.id);
    if (e.desbloqueo !== "inicio") notify(s, "mission", "New archive entry", `${e.nombre} (${e.anio})`);
  }
}

export function stepQuests(s: Sim) {
  if (!s.quest.started) {
    s.quest.started = true;
    s.dialog.push(...data.intro);
    addLog(s, `MISSION: ${PRINCIPALES[0]!.titulo} — ${PRINCIPALES[0]!.objetivo}`);
  }
  // Main story: sequential (several can complete in one frame if already satisfied).
  for (let q = currentMain(s); q && COND[q.cond]?.(s); q = currentMain(s)) {
    s.dialog.push(...q.fin);
    addLog(s, `✔ Mission complete: ${q.titulo}`);
    notify(s, "mission", "Mission complete", q.titulo);
    nasaFile(s, q.inspirado);
    s.quest.main++;
    const next = currentMain(s);
    if (next) { s.dialog.push(...next.inicio); addLog(s, `MISSION: ${next.titulo} — ${next.objetivo}`); }
  }
  for (const q of sideAvailable(s)) {
    if (s.quest.sideDone.includes(q.id) || !COND[q.cond]?.(s)) continue;
    s.quest.sideDone.push(q.id);
    for (const [k, n] of Object.entries(q.recompensa)) giveItem(s, k as keyof Inv, n ?? 0);
    const [quien, ...rest] = q.fin.split(": ");
    s.dialog.push({ quien: rest.length ? quien! : "ARIA", texto: rest.length ? rest.join(": ") : q.fin });
    addLog(s, `✔ Side mission: ${q.titulo}`);
    notify(s, "mission", "Side mission complete", q.titulo);
    nasaFile(s, (q as { inspirado?: string }).inspirado);
  }
  unlockArchive(s);
}

/** Real NASA history tied to what the player just did: a pop-up and a log line, with the full story in the Archive. */
export function nasaFile(s: Sim, id: string | undefined) {
  const e = expedicion(id);
  if (!e) return;
  addLog(s, `📚 NASA file · ${e.nombre}: ${e.dato}`);
  notify(s, "mission", `NASA file: ${e.nombre}`, e.dato);
}
