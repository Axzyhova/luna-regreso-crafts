import { useEffect, useState } from "react";
import modos from "@/data/modos.json";
import recetas from "@/data/recetas.json";
import { useGame, sim, saveGame } from "@/game/store";
import { clock, LH2_CAP, LOX_CAP, isDay, batteryCap, nightBatterySeconds, moduleEnergy, TIPOS, NIGHT_LEN, STACK, SLOTS, usedSlots, recipeBlock, craft, PLACEABLE, SUBSISTEMAS, UMBRAL_VERDE, repairBlock, repairSubsystem, subCap } from "@/game/sim";
import { launchBlockers, startLaunch, countdownLength, currentWindow, nextWindow, windowSecondsLeft, windowsUntil, VENTANAS_PROVISIONALES } from "@/game/mission";
import { CubeSatDesigner } from "./CubeSatDesigner";
import { Vitals, DayClock } from "./Vitals";
import { EventBanner, EffectsBar, QuestTracker, QuestLog } from "./StoryUI";
import { GEAR, CONSUMIBLES, toggleEquip, consumeItem } from "@/game/effects";
import { ITEMS } from "@/game/items";
import { PixelIcon } from "./PixelIcon";
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
/** Desktop/landscape: HUD floats over the game. */
export function HUD() {
  return (
    <>
      <HUDTop className="absolute inset-x-0 top-0" />
      <Countdown />
      <HUDBottom className="absolute inset-x-0 bottom-0" />
    </>
  );
}

export function HUDTop({ className = "", touch = false }: { className?: string; touch?: boolean }) {
  const s = useGame((g) => g.snap);
  const ratio = s.lh2 > 0.01 ? s.lox / s.lh2 : 0;
  const net = s.energyIn - s.energyOut;
  return (
      <div className={`pointer-events-none space-y-1 bg-background/80 p-2 ${className}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Vitals />
          <DayClock className="ml-auto" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[7px]"><span className="text-muted-foreground">POWER</span> <span className={net >= 0 ? "text-ok" : "text-destructive"}>+{s.energyIn.toFixed(0)} / -{s.energyOut.toFixed(0)}</span> <span className="text-muted-foreground">BAT</span> {s.battery.toFixed(0)}/{batteryCap(s)}</span>
          <Bar label="LH2" v={s.lh2} max={LH2_CAP} tone="bg-suit-light" warn={0} />
          <Bar label="LOX" v={s.lox} max={LOX_CAP} tone="bg-suit" warn={0} />
          <span className="text-[7px]"><span className="text-muted-foreground">MIX O2:H2</span> <span className={Math.abs(ratio - 6) < 0.5 ? "text-ok" : "text-alert"}>{ratio.toFixed(1)}:1</span> <span className="text-muted-foreground">(target 6:1)</span></span>
        </div>
        {s.alert && <div className="animate-blink text-center text-[9px] text-alert">⚠ {s.alert}</div>}
        <EventBanner />
        <EffectsBar />
        {s.abduction > 0 && (
          <div className="flex items-center justify-center gap-2 text-[8px] text-alien">
            <span className="animate-blink">ABDUCTION</span>
            <div className="h-2 w-32 bg-moon-0"><div className="h-full bg-alien" style={{ width: `${s.abduction}%` }} /></div>
            <span className="text-[6px] text-muted-foreground">run to the light or hit it ({touch ? "ACTION button" : "SPACE"})</span>
          </div>
        )}
        {s.aliens.some((a) => a.tipo !== "nodriza") && s.abduction === 0 && <div className="text-center text-[7px] text-alien">👾 {s.aliens.filter((a) => a.tipo !== "nodriza").length} alien(s) at the base</div>}
        {s.buildMode && <div className="text-center text-[8px] leading-4 text-ok">BUILD MODE: {ITEMS[s.buildMode]?.nombre} — {touch ? "ACTION places it in front of you, or tap the map · ⟳ switch · ✕ exit" : "click to place · Q switch · C exit"}</div>}
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

export function HUDBottom({ className = "", touch = false }: { className?: string; touch?: boolean }) {
  const s = useGame((g) => g.snap);
  return (
      <div className={`pointer-events-none flex flex-col items-center gap-1 bg-background/80 p-2 ${className}`}>
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
        </div>
        {!touch && <div className="text-[6px] text-muted-foreground">WASD move · SPACE pick up/hit · E interact (hold to seal/repair) · TAB inventory · C build · B base · L log · M missions · ESC pause · 1-5 or click: pick item</div>}
      </div>
  );
}

/** Hotbar. In play: tap/click a slot to hold that item (modules enter build mode).
 *  In the inventory (editable): tap a slot to drop the item picked above, or drag on desktop. */
export function Hotbar({ editable = false, pending = null, onAssign }: { editable?: boolean; pending?: string | null; onAssign?: () => void }) {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const inv = s.inv as unknown as Record<string, number>;
  const tap = (i: number) => {
    const key = sim.hotbarItems[i] ?? null;
    if (editable) {
      if (!pending) return;
      sim.hotbarItems = sim.hotbarItems.map((x) => (x === pending ? null : x));
      sim.hotbarItems[i] = pending; sfx.click(); onAssign?.(); publish();
      return;
    }
    sim.hotbar = i + 1;
    if (key && GEAR.includes(key)) { toggleEquip(sim, key); sfx.click(); publish(); return; }
    if (key && CONSUMIBLES.includes(key)) { if (consumeItem(sim, key)) sfx.ok(); else sfx.bad(); publish(); return; }
    if (key && PLACEABLE[key] && (inv[key] ?? 0) >= 1) sim.buildMode = sim.buildMode === key ? null : key;
    else if (sim.buildMode) sim.buildMode = null;
    sfx.click(); publish();
  };
  return (
    <div className="pointer-events-auto flex gap-1">
      {s.hotbarItems.map((key, i) => (
        <button type="button" key={i} onClick={() => tap(i)}
          onDragOver={(e) => editable && e.preventDefault()}
          onDrop={(e) => { const k = e.dataTransfer.getData("text/item"); if (!k) return; sim.hotbarItems = sim.hotbarItems.map((x) => (x === k ? null : x)); sim.hotbarItems[i] = k; sfx.click(); publish(); }}
          onContextMenu={(e) => { if (!editable) return; e.preventDefault(); sim.hotbarItems[i] = null; publish(); }}
          title={editable ? "Tap or drop an item here · right-click to clear" : ITEMS[key ?? ""]?.nombre}
          className={`relative flex h-11 w-11 touch-manipulation items-center justify-center border-2 bg-moon-0 sm:h-10 sm:w-10 ${s.hotbar === i + 1 ? "border-gold" : "border-moon-2"} ${editable && pending ? "animate-pulse border-ok" : ""}`}>
          <span className="absolute left-0.5 top-0 text-[6px] text-muted-foreground">{i + 1}</span>
          {key && <PixelIcon item={key} size={22} />}
          {key && <span className="absolute bottom-0 right-0.5 text-[6px]">{Math.floor(inv[key] ?? 0)}</span>}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const close = () => useGame.getState().setOverlay(null);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-4 short:p-1">
      <div className="max-h-full w-full max-w-2xl overflow-auto border-4 border-suit bg-card p-4 short:p-2">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-[11px] text-gold">{title}</h3><button onClick={close} className="text-[9px] text-muted-foreground">[X]</button></div>
        {children}
      </div>
    </div>
  );
}

const INV_ORDER = ["hielo", "agua", "regolito", "chatarra", "metal", "kits", "baterias", "paneles", "taladro", "taller", "horno", "torres_luz", "pala_mejorada", "aislamiento", "planta_electrolisis", "criotanque", "pieza_motor", "traje_termico", "capa_reflectante", "escudo_radiacion", "botiquin", "estimulante"];

function Inventory() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const [tab, setTab] = useState<"inv" | "craft">("inv");
  const [hover, setHover] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const inv = s.inv as unknown as Record<string, number>;
  const stacks: { key: string; n: number }[] = [];
  for (const key of INV_ORDER) {
    let n = Math.floor(inv[key] ?? 0);
    while (n > 0) { stacks.push({ key, n: Math.min(STACK, n) }); n -= STACK; }
  }
  const cells = Array.from({ length: SLOTS }, (_, i) => stacks[i] ?? null);
  return (
    <Panel title="INVENTORY">
      <div className="mb-4 flex gap-2">
        {(["inv", "craft"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); sfx.click(); }} className={`px-3 py-2 text-[9px] ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{t === "inv" ? "Items" : "Crafting"}</button>
        ))}
        <span className="ml-auto self-center text-[7px] text-muted-foreground">{usedSlots(s.inv)}/{SLOTS} slots · max {STACK} per stack</span>
      </div>
      {tab === "inv" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="grid grid-cols-4 gap-1">
            {cells.map((c, i) => (
              <div key={i} draggable={!!c}
                onDragStart={(e) => c && e.dataTransfer.setData("text/item", c.key)}
                onMouseEnter={() => setHover(c?.key ?? null)} onMouseLeave={() => setHover(null)}
                onClick={() => { if (!c) return; setHover(c.key); setPending(pending === c.key ? null : c.key); sfx.click(); }}
                className={`relative flex h-16 w-16 flex-col items-center justify-center border-2 bg-moon-0 ${c ? `cursor-grab hover:border-gold ${pending === c.key ? "border-ok" : "border-moon-2"}` : "border-border"}`}>
                {c && <><PixelIcon item={c.key} size={28} /><span className="mt-0.5 max-w-full truncate px-0.5 text-[5px] text-muted-foreground">{ITEMS[c.key]?.nombre}</span><span className="absolute bottom-0.5 right-1 text-[8px] text-gold">{c.n}</span></>}
              </div>
            ))}
          </div>
          <div className="min-h-10 max-w-sm text-center text-[8px] leading-4">
            {hover ? <><span className="text-gold">{ITEMS[hover]?.nombre}:</span> {ITEMS[hover]?.desc}</> : <span className="text-muted-foreground">Tap an item, then a hotbar slot (or drag it).</span>}
            {pending && <div className="text-ok">Now tap a hotbar slot to put it there.</div>}
            {pending && GEAR.includes(pending) && <button onClick={() => { toggleEquip(sim, pending); sfx.click(); publish(); }} className="pointer-events-auto mt-2 bg-ok px-3 py-2 text-[8px] text-background">{s.equip.includes(pending) ? "UNEQUIP" : "EQUIP"}</button>}
            {pending && CONSUMIBLES.includes(pending) && <button onClick={() => { if (consumeItem(sim, pending)) sfx.ok(); publish(); }} className="pointer-events-auto mt-2 bg-ok px-3 py-2 text-[8px] text-background">USE</button>}
          </div>
          <Hotbar editable pending={pending} onAssign={() => setPending(null)} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[7px] text-muted-foreground">Near: {s.near.taller ? <span className="text-ok">Workshop</span> : "—"} {s.near.horno ? <span className="text-ok">· Furnace</span> : ""}</div>
          {recetas.map((r) => {
            const block = recipeBlock(s, r);
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-[8px]">
                <div className="flex items-center gap-2">
                  <PixelIcon item={Object.keys(r.resultado)[0]!} size={20} />
                  <div>
                    <div>{r.nombre} <span className="text-[6px] text-suit-light">[{r.lugar === "mano" ? "BY HAND" : r.lugar.toUpperCase()}]</span></div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {Object.entries(r.ingredientes).map(([k, v]) => (
                        <span key={k} className={(inv[k] ?? 0) >= (v ?? 0) ? "text-muted-foreground" : "text-destructive"}>{v} {ITEMS[k]?.nombre ?? k} ({Math.floor(inv[k] ?? 0)})</span>
                      ))}
                    </div>
                    {block && block !== "Missing materials" && <div className="mt-1 text-[6px] text-alert">{block}</div>}
                  </div>
                </div>
                <button disabled={!!block} onClick={() => { if (craft(sim, r)) { sfx.ok(); publish(); } }} className="bg-primary px-2 py-1 text-primary-foreground disabled:opacity-30">CRAFT</button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function fmtTime(sec: number) {
  if (!isFinite(sec)) return "no drain";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")} min`;
}

function Base() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const day = isDay(s);
  const net = s.energyIn - s.energyOut;
  const nightSec = nightBatterySeconds(s);
  return (
    <Panel title="BASE PANEL">
      <div className="mb-3 space-y-1 text-[9px]">
        <div className={net >= 0 ? "text-ok" : "text-destructive"}>Power +{s.energyIn.toFixed(0)} / -{s.energyOut.toFixed(0)}</div>
        <div className="text-[8px]">Batteries {s.battery.toFixed(0)}/{batteryCap(s)} · They last tonight: <span className={nightSec < NIGHT_LEN ? "text-alert" : "text-ok"}>{fmtTime(nightSec)}</span> <span className="text-muted-foreground">(night lasts {NIGHT_LEN / 60} min)</span></div>
        <div className="text-[7px] text-muted-foreground">Habitat O2 {s.habitatO2.toFixed(0)}% · Water {s.inv.agua.toFixed(1)} kg · H2 gas {s.h2gas.toFixed(2)} kg · O2 gas {s.o2gas.toFixed(2)} kg</div>
      </div>
      <div className="space-y-2">
        {s.modules.map((m) => {
          const t = TIPOS[m.tipo];
          const e = moduleEnergy(m, day);
          return (
            <div key={m.uid} className="flex flex-wrap items-center gap-2 text-[8px]">
              <span className="w-36">{t.nombre}</span>
              <div className="h-2 w-24 bg-moon-0"><div className={`h-full ${m.durabilidad < 25 ? "bg-alert" : "bg-ok"}`} style={{ width: `${m.durabilidad}%` }} /></div>
              <span className="w-8">{m.durabilidad.toFixed(0)}%</span>
              <span className={`w-14 ${e > 0 ? "text-ok" : e < 0 ? "text-destructive" : "text-muted-foreground"}`}>{e > 0 ? "+" : ""}{e.toFixed(1)}/s</span>
              <button onClick={() => { const mm = sim.modules.find((x) => x.uid === m.uid); if (mm) mm.activo = !mm.activo; publish(); sfx.click(); }} className={`w-10 px-1 py-1 ${m.activo ? "bg-ok text-background" : "bg-secondary"}`}>{m.activo ? "ON" : "OFF"}</button>
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
      <div className="mb-3 text-[8px] text-ok">Achievements: {s.logros.length ? s.logros.join(" · ") : "none yet"}</div>
      <ul className="space-y-1">{s.log.map((l, i) => <li key={i} className="text-[8px] leading-4"><span className="text-muted-foreground">[{l.t}]</span> {l.text}</li>)}</ul>
    </Panel>
  );
}

function Pause() {
  const { setOverlay, go } = useGame();
  return (
    <Panel title="PAUSED">
      <div className="flex flex-wrap gap-3">
        <PixelButton onClick={() => setOverlay(null)}>Continue</PixelButton>
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
      const map: Record<string, "inv" | "base" | "log" | "pausa" | "misiones"> = { Tab: "inv", b: "base", B: "base", l: "log", L: "log", m: "misiones", M: "misiones", Escape: "pausa" };
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
  if (overlay === "inv") return <Inventory />;
  if (overlay === "base") return <Base />;
  if (overlay === "log") return <Log />;
  if (overlay === "pausa") return <Pause />;
  if (overlay === "cohete") return <Rocket />;
  if (overlay === "cubesat") return <CubeSatDesigner />;
  if (overlay === "misiones") return <QuestLog />;
  return null;
}
