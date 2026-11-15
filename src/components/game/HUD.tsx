import { useEffect, useState } from "react";
import modos from "@/data/modos.json";
import recetas from "@/data/recetas.json";
import { useGame, sim, saveGame } from "@/game/store";
import { CHEST_SLOTS, clock, LH2_CAP, LOX_CAP, isDay, batteryCap, nightBatterySeconds, moduleEnergy, TIPOS, NIGHT_LEN, STACK, SLOTS, usedSlots, recipeBlock, craft, PLACEABLE, dropItem, toolInfo, WATER_TANK_KG, upgradeCost, canUpgrade, upgradeModule, UPGRADES, SUBSISTEMAS, UMBRAL_VERDE, repairBlock, repairSubsystem, subCap } from "@/game/sim";
import { launchBlockers, startLaunch, countdownLength, currentWindow, nextWindow, windowSecondsLeft, windowsUntil, VENTANAS_PROVISIONALES } from "@/game/mission";
import { CubeSatDesigner } from "./CubeSatDesigner";
import { Vitals, DayClock } from "./Vitals";
import { CharacterDoll, useGearTouchDrag } from "./CharacterDoll";
import { StationPanel } from "./StationPanel";
import { Panel } from "./Panel";
import { Inventory } from "./InventoryPanel";
import { ChestPanel } from "./ChestPanel";
import { ArchivePanel } from "./ArchivePanel";
import { Hotbar } from "./Hotbar";
import { view, setZoom, defaultZoom, ZOOM_STEP } from "@/game/view";
export { Hotbar } from "./Hotbar";
import { MapPanel } from "./MapPanel";
import { FieldGuidePanel } from "./FieldGuidePanel";
import { CavePanel } from "./CavePanel";
import { DeathScreen, NoticeToast, AchievementList, SuitControl } from "./SurvivalUI";
import { AlertsPanel, GearRow, NavCard, QuestTracker, QuestLog } from "./StoryUI";
import { GEAR, CONSUMIBLES, toggleEquip, consumeItem } from "@/game/effects";
import { ITEMS, INV_ORDER } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
import { sfx } from "@/game/audio";
import { PixelButton } from "./Screens";

function Bar({ label, v, max = 100, tone = "bg-ok", warn = 25, value }: { label: string; v: number; max?: number; tone?: string; warn?: number; value?: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="w-7 text-[6px] text-white/70">{label}</span>
      <div className="tr-bar w-14 sm:w-16"><div className={pct < warn ? "bg-alert" : tone} style={{ width: `${pct}%` }} /></div>
      <span className="tr-text w-9 text-right text-[6px] tabular-nums">{value ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}

/** A titled HUD group (same skin as the menus, lighter) so it's clear what each bar belongs to. */
function HudGroup({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`tr-hud px-2 pb-1.5 pt-1 ${className}`}>
      <div className="tr-label mb-1">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** Astronaut: the player's own body and suit (vitals + thermometer) and worn gear. */
export function AstronautPanel() {
  return (
    <HudGroup title="👨‍🚀 ASTRONAUT">
      <Vitals />
      <GearRow />
    </HudGroup>
  );
}

/** Base installations (power) and the rocket (fuel). */
export function BaseRocketPanel() {
  const s = useGame((g) => g.snap);
  const ratio = s.lh2 > 0.01 ? s.lox / s.lh2 : 0;
  const net = s.energyIn - s.energyOut;
  return (
    <HudGroup title="🏠 BASE">
      <div className="flex items-center gap-1.5 text-[6px]">
        <span className="w-7 text-white/70">POWER</span>
        <span className={`tr-text transition-colors duration-300 ${net >= 0 ? "!text-ok" : "!text-destructive"}`}>+{s.energyIn.toFixed(0)} / -{s.energyOut.toFixed(0)}</span>
      </div>
      <Bar label="BAT" v={s.battery} max={batteryCap(s)} tone="bg-gold" warn={10} value={`${s.battery.toFixed(0)}/${batteryCap(s)}`} />
      <div className="tr-label mt-0.5 border-t border-white/15 pt-1">🚀 ROCKET</div>
      <Bar label="LH2" v={s.lh2} max={LH2_CAP} tone="bg-suit-light" warn={0} />
      <Bar label="LOX" v={s.lox} max={LOX_CAP} tone="bg-suit" warn={0} />
      <div className="flex items-center gap-1.5 text-[6px]">
        <span className="w-7 text-white/70">MIX</span>
        <span className={`tr-text ${Math.abs(ratio - 6) < 0.5 ? "!text-ok" : "!text-alert"}`}>{ratio.toFixed(1)}:1</span>
        <span className="text-white/55">goal 6:1</span>
      </div>
    </HudGroup>
  );
}

/** Desktop/landscape: HUD floats over the game, grouped in corners so the middle stays clear. */
export function HUD() {
  return (
    <>
      <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1.5">
        <AstronautPanel />
        <NavCard />
      </div>
      <HUDTop className="absolute left-1/2 top-2 -translate-x-1/2" />
      <div className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1.5">
        <BaseRocketPanel />
        <AlertsPanel />
      </div>
      <Countdown />
      <HUDBottom className="absolute inset-x-0 bottom-0" />
    </>
  );
}

/** Top-center: day/night clock and the build-mode hint. */
export function HUDTop({ className = "", touch = false }: { className?: string; touch?: boolean }) {
  const s = useGame((g) => g.snap);
  return (
      <div className={`pointer-events-none flex max-w-[40%] flex-col items-center gap-1 ${className}`}>
        <DayClock />
        {s.buildMode && <div className="bg-background/85 px-2 py-0.5 text-center text-[7px] leading-4 text-ok">BUILD MODE: {ITEMS[s.buildMode]?.nombre} — {touch ? "ACTION places it in front of you, or tap the map · ⟳ switch · ✕ exit" : "click to place · Q switch · C exit"}</div>}
      </div>
  );
}

export function Countdown() {
  const s = useGame((g) => g.snap);
  if (s.countdown === null) return null;
  return (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-[5] px-4 text-center">
          <div className="text-2xl text-gold drop-shadow-[3px_3px_0_var(--color-moon-0)]">T-{Math.ceil(s.countdown)}</div>
          {s.aliens.some((a) => a.tipo === "nodriza") && <div className="animate-blink text-[8px] leading-4 text-alien">THE MOTHERSHIP IS ATTACKING THE ROCKET! Hit it next to the rocket and turn on light towers nearby</div>}
        </div>
  );
}

export function PickupFeed() {
  const s = useGame((g) => g.snap);
  if (!s.pickupFeed.length) return null;
  const inv = s.inv as unknown as Record<string, number>;
  return (
    <div className="pointer-events-none flex flex-wrap justify-center gap-1.5">
      {s.pickupFeed.map((p) => (
        <span key={p.item} className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[7px] text-white/80 backdrop-blur-[2px]">
          <PixelIcon item={p.item} size={10} />+{p.n} {ITEMS[p.item]?.nombre ?? p.item} <span className="text-white/50">({Math.floor(inv[p.item] ?? 0)})</span>
        </span>
      ))}
    </div>
  );
}

export function HUDBottom({ className = "", touch = false }: { className?: string; touch?: boolean }) {
  const s = useGame((g) => g.snap);
  return (
      <div className={`pointer-events-none flex flex-col items-center gap-1 bg-background/80 p-2 ${className}`}>
        <PickupFeed />
        <QuestTracker />
        {s.hint && <div className="text-[7px] text-ok">{s.hint}</div>}
        <div className="flex items-center gap-1">
          {touch && (
            <button type="button" onClick={() => { sfx.click(); useGame.getState().setOverlay("inv"); }}
              className="pointer-events-auto flex h-11 w-12 touch-manipulation flex-col items-center justify-center border-2 border-gold bg-secondary text-[12px]">
              🎒<span className="text-[6px]">INV</span>
            </button>
          )}
          <Hotbar />
          {!touch && <button type="button" onClick={() => { sfx.click(); useGame.getState().setOverlay("mapa"); }} className="tr-btn pointer-events-auto ml-1 h-10 px-2 text-[10px]" title="Map (M)">🗺 MAP</button>}
          {!touch && <button type="button" onClick={() => { sfx.click(); useGame.getState().setOverlay("guia"); }} className="tr-btn pointer-events-auto h-10 px-2 text-[10px]" title="Field Guide (G)">📖 GUIDE</button>}
        </div>
        {!touch && <div className="text-[6px] text-muted-foreground">WASD move · SHIFT run · SPACE pick up/hit · E interact (hold to seal/repair) · TAB inventory · X drop · C build · B base · L log · M map · G guide · J missions · K archive · V suit · ESC pause · 1-5 or click: pick item</div>}
      </div>
  );
}

function fmtTime(sec: number) {
  if (!isFinite(sec)) return "no drain";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")} min`;
}

const STATUS: Record<string, { text: string; cls: string; tip: string }> = {
  ok: { text: "● Working", cls: "text-ok", tip: "Running normally" },
  idle: { text: "● Idle", cls: "text-gold", tip: "Nothing to process (no water / gas / regolith) or no sunlight" },
  nopower: { text: "● No power", cls: "text-destructive", tip: "Batteries empty: add solar panels or batteries" },
  off: { text: "● Off", cls: "text-muted-foreground", tip: "Switched off or broken" },
};

function Base() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const day = isDay(s);
  const net = s.energyIn - s.energyOut;
  const nightSec = nightBatterySeconds(s);
  const solar = s.modules.filter((m) => m.tipo === "panel");
  const solarCount = solar.length, solarIn = solar.reduce((a, m) => a + Math.max(0, moduleEnergy(m, day)), 0);
  return (
    <Panel title="BASE PANEL">
      <div className="mb-3 space-y-1 text-[9px] short:mb-1.5">
        <div className={net >= 0 ? "text-ok" : "text-destructive"}>Power {net >= 0 ? "+" : ""}{net.toFixed(0)}/s <span className="text-white/60">({net >= 0 ? "charging the batteries" : "draining the batteries"})</span></div>
        <div className="text-[7px] leading-4 text-white/70">
          ☀ <span className="text-ok">{solarCount} solar panel{solarCount === 1 ? "" : "s"}</span> make +{solarIn.toFixed(0)}/s{day ? "" : " (night: 0)"} · ⚙ machines use −{s.energyOut.toFixed(0)}/s. Add panels to run more machines; add batteries to last the night.
        </div>
        <div className="text-[8px]">Batteries {s.battery.toFixed(0)}/{batteryCap(s)} · They last tonight: <span className={nightSec < NIGHT_LEN ? "text-alert" : "text-ok"}>{fmtTime(nightSec)}</span> <span className="text-muted-foreground">(night lasts {NIGHT_LEN / 60} min)</span></div>
        <div className="text-[7px] text-muted-foreground">Habitat O2 {s.habitatO2.toFixed(0)}% · Water tank {s.inv.agua.toFixed(0)}/{WATER_TANK_KG} kg · H2 gas {s.h2gas.toFixed(2)} kg · O2 gas {s.o2gas.toFixed(2)} kg</div>
      </div>
      <div className="space-y-2">
        {s.modules.map((m) => {
          const t = TIPOS[m.tipo];
          const e = moduleEnergy(m, day);
          if (m.tipo === "cofre") return (
            <div key={m.uid} className="flex flex-wrap items-center gap-2 text-[8px]">
              <span className="w-36">{t.nombre}</span>
              <span className="text-white/70">{Object.values(s.chests[String(m.uid)] ?? {}).reduce((n, v) => n + Math.ceil(v / STACK), 0)}/{CHEST_SLOTS} slots used · press E next to it to open</span>
            </div>
          );
          return (
            <div key={m.uid} className="flex flex-wrap items-center gap-2 text-[8px]">
              <span className="w-36">{t.nombre} <span className="text-gold">Lv{m.level ?? 1}</span></span>
              <span className={`w-20 text-[7px] ${STATUS[s.modStatus[m.uid] ?? "ok"]!.cls}`} title={STATUS[s.modStatus[m.uid] ?? "ok"]!.tip}>{STATUS[s.modStatus[m.uid] ?? "ok"]!.text}</span>
              <div className="h-2 w-24 bg-moon-0"><div className={`h-full ${m.durabilidad < 25 ? "bg-alert" : "bg-ok"}`} style={{ width: `${m.durabilidad}%` }} /></div>
              <span className="w-8">{m.durabilidad.toFixed(0)}%</span>
              <span className={`w-14 ${e > 0 ? "text-ok" : e < 0 ? "text-destructive" : "text-muted-foreground"}`}>{e > 0 ? "+" : ""}{e.toFixed(1)}/s</span>
              <button onClick={() => { const mm = sim.modules.find((x) => x.uid === m.uid); if (mm) mm.activo = !mm.activo; publish(); sfx.click(); }} className={`w-10 px-1 py-1 ${m.activo ? "bg-ok text-background" : "bg-secondary"}`}>{m.activo ? "ON" : "OFF"}</button>
              {upgradeCost(m) && (
                <button title={`${UPGRADES[m.tipo]?.efecto} · Cost: ${Object.entries(upgradeCost(m)!).map(([k, v]) => `${v} ${ITEMS[k]?.nombre ?? k}`).join(", ")}`}
                  onClick={() => { const mm = sim.modules.find((x) => x.uid === m.uid); if (mm && upgradeModule(sim, mm)) { sfx.ok(); publish(); } else sfx.bad(); }}
                  className={`tr-btn px-1.5 py-1 text-[8px] ${canUpgrade(s, m) ? "" : "opacity-40 grayscale"}`}>⬆ Lv{(m.level ?? 1) + 1}</button>
              )}
              {upgradeCost(m) && <span className="text-[7px] text-muted-foreground">{Object.entries(upgradeCost(m)!).map(([k, v]) => `${v} ${ITEMS[k]?.nombre ?? k}`).join(" · ")}</span>}
              {m.durabilidad < 25 && <span className="animate-blink text-[7px] text-alert">Needs maintenance</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[7px] leading-4 text-muted-foreground">To repair: walk up to the module and hold E (costs 1 kit). Turn modules off at night to save battery. Build with C.</p>
    </Panel>
  );
}

function Rocket() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const [sel, setSel] = useState<string | null>(null);
  const inv = s.inv as unknown as Record<string, number>;
  const blockers = launchBlockers(s);
  return (
    <Panel title="ROCKET CHECKLIST">
      <p className="mb-3 text-[7px] leading-4 text-muted-foreground">Subsystems follow the disciplines of NASA Goddard's Mission Design Lab. Green = {UMBRAL_VERDE}% or more.</p>
      <div className="space-y-3">
        {SUBSISTEMAS.map((sub) => {
          const v = s.rocket[sub.id] ?? 0;
          const block = repairBlock(s, sub);
          const cap = subCap(s, sub);
          return (
            <div key={sub.id} className="border-b border-border pb-2 text-[8px]">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setSel(sel === sub.id ? null : sub.id)} className="w-36 text-left hover:text-gold" title="Why it matters">{sub.id} <span className="text-muted-foreground">?</span></button>
                <div className="relative h-2 min-w-24 flex-1 bg-moon-0">
                  <div className={`h-full ${v >= UMBRAL_VERDE ? "bg-ok" : "bg-alert"}`} style={{ width: `${v}%` }} />
                  {cap < 100 && <div className="absolute inset-y-0 border-r-2 border-dashed border-suit-light" style={{ left: `${cap}%` }} title="Cap without the CubeSat relay" />}
                </div>
                <span className="w-8">{v}%</span>
                <button disabled={!!block} onClick={() => { if (repairSubsystem(sim, sub)) { sfx.ok(); publish(); } else sfx.bad(); }} className="bg-primary px-2 py-1 text-primary-foreground disabled:opacity-30">+{sub.sube}%</button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 pl-1 text-[7px]">
                <span className="text-muted-foreground">Needs:</span>
                {Object.entries(sub.ingredientes).map(([k, n]) => (
                  <span key={k} className={(inv[k] ?? 0) >= (n ?? 0) ? "text-muted-foreground" : "text-destructive"}>{n} {ITEMS[k]?.nombre ?? k} ({Math.floor(inv[k] ?? 0)})</span>
                ))}
                {block && block !== "Missing materials" && <span className="text-alert">· {block}</span>}
              </div>
              {sel === sub.id && <p className="mt-1 pl-1 text-[7px] leading-4 text-suit-light">{sub.disciplina}: {sub.porque}</p>}
            </div>
          );
        })}
        <div className="pt-1 text-[8px]">Tanks: LH2 {s.lh2.toFixed(1)}/{LH2_CAP} kg · LOX {s.lox.toFixed(1)}/{LOX_CAP} kg</div>
      </div>
      <Windows />
      <div className="mt-3 flex flex-wrap gap-3">
        <PixelButton disabled={blockers.length > 0 || s.countdown !== null} onClick={() => { if (startLaunch(sim)) { sfx.alert(); publish(); useGame.getState().setOverlay(null); } }}>{s.countdown !== null ? "Countdown…" : `Launch (T-${countdownLength(s)} s)`}</PixelButton>
        <PixelButton tone="ghost" onClick={() => useGame.getState().setOverlay("cubesat")}>{s.relay ? "View CubeSat relay" : "Design CubeSat relay"}</PixelButton>
      </div>
      {blockers.length > 0 && (
        <ul className="mt-2 space-y-1 text-[7px] text-alert">
          <li>You can't launch yet:</li>
          {blockers.map((b) => <li key={b}>· {b}</li>)}
        </ul>
      )}
    </Panel>
  );
}

function Windows() {
  const s = useGame((g) => g.snap);
  if (!s.relay) return <p className="mt-3 text-[7px] leading-4 text-muted-foreground">RETURN WINDOWS: unknown. With no antenna you can't receive Mission Control's data. Launch the CubeSat relay.</p>;
  const cur = currentWindow(s);
  const next = nextWindow(s);
  const list = windowsUntil(s.day + 9).filter((w) => w.abre_dia >= s.day).slice(0, 4);
  return (
    <div className="mt-3 space-y-1 text-[8px]">
      <div className="text-gold">RETURN WINDOWS {VENTANAS_PROVISIONALES && <span className="text-[6px] text-alert">(PROVISIONAL · generate with GMAT)</span>}</div>
      {cur ? <div className="animate-blink text-ok">WINDOW {cur.id} OPEN! Closes in {fmtTime(windowSecondsLeft(s))}</div> : <div className="text-muted-foreground">Next: {next.id}, day {next.abre_dia}</div>}
      {list.map((w) => (
        <div key={w.id} className={`flex flex-wrap gap-3 text-[7px] ${cur?.id === w.id ? "text-ok" : ""}`}>
          <span className="w-10">{w.id}</span><span className="w-14">Day {w.abre_dia}</span><span className="w-20">lasts {Math.round(w.dura_s / 60)} min</span>
          <span className={s.lh2 >= w.lh2_kg ? "text-ok" : "text-muted-foreground"}>LH2 {w.lh2_kg} kg</span>
          <span className={s.lox >= w.lox_kg ? "text-ok" : "text-muted-foreground"}>LOX {w.lox_kg} kg</span>
        </div>
      ))}
      <p className="text-[6px] leading-3 text-muted-foreground">Waiting for a later window needs less fuel, but every day costs oxygen and power.</p>
    </div>
  );
}

function Log() {
  const s = useGame((g) => g.snap);
  return (
    <Panel title="LOG">
      <button type="button" onClick={() => { sfx.click(); useGame.getState().setOverlay("archivo"); }} className="tr-btn mb-2 px-2 py-1.5 text-[8px]">📚 NASA MISSION ARCHIVE (K)</button>
      <AchievementList />
      <ul className="space-y-1">{s.log.map((l, i) => <li key={i} className="text-[8px] leading-4"><span className="text-muted-foreground">[{l.t}]</span> {l.text}</li>)}</ul>
    </Panel>
  );
}

function Pause() {
  const { setOverlay, go } = useGame();
  const [z, setZ] = useState(view.zoom);
  return (
    <Panel title="PAUSED">
      <div className="mb-3 flex items-center gap-2 text-[9px] short:mb-2">
        <span className="text-white/80">VIEW ZOOM</span>
        <button type="button" aria-label="Zoom out" onClick={() => { setZoom(view.zoom - ZOOM_STEP); setZ(view.zoom); sfx.click(); }} className="tr-btn px-2 py-1">−</button>
        <span className="tr-text w-10 text-center tabular-nums">{z.toFixed(1)}×</span>
        <button type="button" aria-label="Zoom in" onClick={() => { setZoom(view.zoom + ZOOM_STEP); setZ(view.zoom); sfx.click(); }} className="tr-btn px-2 py-1">+</button>
        <button type="button" onClick={() => { setZoom(defaultZoom(matchMedia("(pointer: coarse)").matches, matchMedia("(max-height: 520px)").matches)); setZ(view.zoom); sfx.click(); }} className="tr-btn px-2 py-1 text-[7px]">RESET</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <PixelButton onClick={() => setOverlay(null)}>Continue</PixelButton>
        <PixelButton tone="ghost" onClick={() => setOverlay("archivo")}>📚 Archive</PixelButton>
        <PixelButton tone="ghost" onClick={() => setOverlay("guia")}>📖 Field Guide</PixelButton>
        <PixelButton tone="ghost" onClick={() => { saveGame(); sfx.ok(); }}>Save</PixelButton>
        <PixelButton tone="alert" onClick={() => { saveGame(); setOverlay(null); go("intro"); }}>Quit to title</PixelButton>
      </div>
    </Panel>
  );
}

export function Overlays() {
  const overlay = useGame((g) => g.overlay);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const map: Record<string, "inv" | "base" | "log" | "pausa" | "misiones" | "mapa" | "archivo" | "guia"> = { Tab: "inv", b: "base", B: "base", l: "log", L: "log", j: "misiones", J: "misiones", m: "mapa", M: "mapa", k: "archivo", K: "archivo", g: "guia", G: "guia", Escape: "pausa" };
      const o = map[e.key];
      if (!o) return;
      if (e.key === "Escape" && sim.buildMode && !useGame.getState().overlay) { e.preventDefault(); sim.buildMode = null; useGame.getState().publish(); return; }
      e.preventDefault();
      const cur = useGame.getState().overlay;
      useGame.getState().setOverlay(cur ? null : o);
      sfx.click();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const panel =
    overlay === "inv" ? <Inventory /> : overlay === "base" ? <Base /> : overlay === "log" ? <Log /> : overlay === "pausa" ? <Pause /> :
    overlay === "cohete" ? <Rocket /> : overlay === "cubesat" ? <CubeSatDesigner /> : overlay === "misiones" ? <QuestLog /> :
    overlay === "estacion" ? <StationPanel /> : overlay === "mapa" ? <MapPanel /> : overlay === "cofre" ? <ChestPanel /> : overlay === "archivo" ? <ArchivePanel /> : overlay === "guia" ? <FieldGuidePanel /> : overlay === "cueva" ? <CavePanel /> : null;
  return <>{panel}<NoticeToast /><DeathScreen /></>;
}
