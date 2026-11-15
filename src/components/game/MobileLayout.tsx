import { ClientOnly } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { LH2_CAP, LOX_CAP, batteryCap } from "@/game/sim";
import { sfx } from "@/game/audio";
import { GameCanvas } from "./GameCanvas";
import { Countdown, Overlays, Hotbar } from "./HUD";
import { NavCard, DialogBox, AlertsPanel, GearRow, QuestTracker } from "./StoryUI";
import { DPad, ActionPad, MenuBar, MC_BTN } from "./TouchControls";
import { Vitals, DayClock } from "./Vitals";
import { TutorialCard } from "./StoryUI";

function MiniBar({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="flex items-center gap-1 text-[6px]">
      <span className="w-6 text-right text-white/80">{label}</span>
      <div className="tr-bar !h-1 w-12"><div style={{ width: `${pct}%`, background: color }} /></div>
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

      {/* top-left: astronaut (vitals + gear), navigation chip below */}
      <div className="hud-zoom origin-top-left pointer-events-none absolute left-[max(env(safe-area-inset-left),8px)] top-1.5 flex flex-col items-start gap-1">
        <div className="tr-hud flex flex-col gap-0.5 px-1.5 pb-1 pt-0.5">
          <Vitals />
          <GearRow />
        </div>
        <NavCard />
      </div>

      {/* top-center: menu buttons and tutorial only (warnings live in the side panel) */}
      <div className="hud-zoom origin-top pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-40">
        <div className="pointer-events-auto"><MenuBar /></div>
        <TutorialCard />
      </div>

      {/* top-right: clock, base power + rocket fuel, warnings panel below */}
      <div className="hud-zoom origin-top-right pointer-events-none absolute right-[max(env(safe-area-inset-right),8px)] top-1.5 flex flex-col items-end gap-1">
        <DayClock />
        <div className="tr-hud flex flex-col items-end gap-0.5 px-1.5 py-1" aria-label="Base power and rocket fuel">
          <span className={`tr-text text-[6px] ${net >= 0 ? "!text-ok" : "!text-destructive"}`}>⚡ {net >= 0 ? "+" : ""}{net.toFixed(0)}/s</span>
          <MiniBar label="BAT" v={s.battery} max={batteryCap(s)} color="var(--color-gold)" />
          <MiniBar label="LH2" v={s.lh2} max={LH2_CAP} color="var(--color-suit-light)" />
          <MiniBar label="LOX" v={s.lox} max={LOX_CAP} color="var(--color-suit)" />
        </div>
        <AlertsPanel className="!w-28" />
      </div>

      <Countdown />

      {/* bottom-left: D-pad */}
      <div className={`hud-zoom origin-bottom-left absolute bottom-[max(env(safe-area-inset-bottom),10px)] left-[max(env(safe-area-inset-left),14px)] ${overlay ? "invisible" : ""}`}><DPad /></div>

      {/* bottom-center: mission + hotbar + inventory */}
      <div className="hud-zoom origin-bottom pointer-events-none absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),6px)] flex flex-col items-center gap-1">
        <div className="max-w-[46%] scale-90"><QuestTracker /></div>
        <div className="flex items-center gap-1">
          <Hotbar />
          <button type="button" aria-label="Inventory" onClick={() => { sfx.click(); setOverlay("inv"); }}
            className={`pointer-events-auto flex h-11 w-11 touch-manipulation items-center justify-center text-[16px] short:h-9 short:w-9 ${MC_BTN}`}>⋯</button>
        </div>
      </div>

      {/* bottom-right: actions */}
      <div className={`hud-zoom origin-bottom-right absolute bottom-[max(env(safe-area-inset-bottom),10px)] right-[max(env(safe-area-inset-right),14px)] ${overlay ? "invisible" : ""}`}><ActionPad /></div>

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
