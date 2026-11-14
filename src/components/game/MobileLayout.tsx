import { ClientOnly } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { clock, isDay, LH2_CAP, LOX_CAP } from "@/game/sim";
import { sfx } from "@/game/audio";
import { GameCanvas } from "./GameCanvas";
import { Countdown, Overlays, Hotbar } from "./HUD";
import { NavCard, DialogBox, EventBanner, EffectsBar, QuestTracker } from "./StoryUI";
import { DPad, ActionPad, MenuBar, MC_BTN } from "./TouchControls";

/** Minecraft-style rows of 10 icons (hearts for health, bubbles for suit O2). */
function IconRow({ value, full, empty, label }: { value: number; full: string; empty: string; label: string }) {
  const n = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return (
    <div className="flex gap-[1px] text-[11px] leading-none" aria-label={`${label} ${Math.round(value)}%`}>
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < n ? "" : "opacity-30 grayscale"}>{i < n ? full : empty}</span>)}
    </div>
  );
}

function MiniBar({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="flex items-center gap-1 text-[6px]">
      <span className="w-6 text-right text-white/80">{label}</span>
      <div className="h-1.5 w-14 bg-black/50"><div className="h-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

/** Landscape layout for phones and tablets, laid out like a mobile block-building game. */
export function MobileGame() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const overlay = useGame((g) => g.overlay);
  const net = s.energyIn - s.energyOut;
  return (
    <div className="relative h-full w-full select-none">
      <ClientOnly fallback={null}><GameCanvas /></ClientOnly>

      {/* top-left: vitals */}
      <div className="pointer-events-none absolute left-[max(env(safe-area-inset-left),8px)] top-2 flex flex-col gap-1">
        <IconRow value={s.health} full="❤️" empty="🖤" label="Health" />
        <IconRow value={s.suitO2} full="🫧" empty="⚪" label="Suit O2" />
        <span className={`text-[7px] ${s.temp < 5 ? "text-suit-light" : "text-white/90"}`}>{s.temp.toFixed(0)}°C</span>
      </div>

      {/* top-center: menu buttons, alerts below */}
      <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-40">
        <div className="pointer-events-auto"><MenuBar /></div>
        {s.alert && <div className="animate-blink text-center text-[8px] text-alert">⚠ {s.alert}</div>}
        <EventBanner />
        <EffectsBar />
        {s.abduction > 0 && <div className="flex items-center gap-1 text-[7px] text-alien"><span className="animate-blink">ABDUCTION</span><div className="h-1.5 w-24 bg-black/50"><div className="h-full bg-alien" style={{ width: `${s.abduction}%` }} /></div></div>}
      </div>

      {/* top-right: power, fuel, clock */}
      <div className="pointer-events-none absolute right-[max(env(safe-area-inset-right),8px)] top-2 flex flex-col items-end gap-1 bg-black/25 p-1">
        <span className={`text-[7px] ${isDay(s) ? "text-gold" : "text-suit-light"}`}>{clock(s)}</span>
        <span className={`text-[6px] ${net >= 0 ? "text-ok" : "text-destructive"}`}>⚡ +{s.energyIn.toFixed(0)}/-{s.energyOut.toFixed(0)}</span>
        <MiniBar label="LH2" v={s.lh2} max={LH2_CAP} color="var(--color-suit-light)" />
        <MiniBar label="LOX" v={s.lox} max={LOX_CAP} color="var(--color-suit)" />
      </div>

      {/* left, below vitals: GPS card */}
      <NavCard className="absolute left-[max(env(safe-area-inset-left),8px)] top-16 !w-40 scale-90 origin-top-left short:scale-75" />

      <Countdown />

      {/* bottom-left: D-pad */}
      <div className={`absolute bottom-[max(env(safe-area-inset-bottom),10px)] left-[max(env(safe-area-inset-left),14px)] ${overlay ? "invisible" : ""}`}><DPad /></div>

      {/* bottom-center: mission + hotbar + inventory */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),6px)] flex flex-col items-center gap-1">
        <div className="max-w-[46%] scale-90"><QuestTracker /></div>
        <div className="flex items-center gap-1">
          <Hotbar />
          <button type="button" aria-label="Inventory" onClick={() => { sfx.click(); setOverlay("inv"); }}
            className={`pointer-events-auto flex h-11 w-11 touch-manipulation items-center justify-center text-[16px] ${MC_BTN}`}>⋯</button>
        </div>
      </div>

      {/* bottom-right: actions */}
      <div className={`absolute bottom-[max(env(safe-area-inset-bottom),10px)] right-[max(env(safe-area-inset-right),14px)] ${overlay ? "invisible" : ""}`}><ActionPad /></div>

      <div className="absolute inset-x-0 bottom-24"><DialogBox /></div>
      <Overlays />
    </div>
  );
}

/** Shown on touch devices held upright: the game is designed for landscape. */
export function RotateNotice() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-8 text-center font-pixel text-foreground">
      <div className="text-5xl [animation:rotate-hint_2.4s_ease-in-out_infinite]">📱</div>
      <h2 className="text-sm text-gold">ROTATE YOUR DEVICE</h2>
      <p className="max-w-xs text-[9px] leading-5 text-muted-foreground">The Last Contact On Earth is played in landscape. Turn your phone or tablet sideways to start.</p>
    </div>
  );
}
