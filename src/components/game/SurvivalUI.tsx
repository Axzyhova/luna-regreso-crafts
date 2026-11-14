import { useEffect } from "react";
import modos from "@/data/modos.json";
import { useGame, sim, saveGame } from "@/game/store";
import { respawn, toggleSuit } from "@/game/sim";
import { sfx } from "@/game/audio";

const habitatPos = () => {
  const h = sim.modules.find((m) => m.tipo === "habitat");
  return { x: h?.x ?? 110, y: h?.y ?? 170 };
};

/** "You died" screen: respawn in the habitat (items stay in a bag where you died) or go to the menu. */
export function DeathScreen() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const go = useGame((g) => g.go);
  const setOverlay = useGame((g) => g.setOverlay);
  if (!s.dead) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center-safe gap-4 overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgba(80,0,0,0.55),rgba(30,0,0,0.85))] p-4 text-center">
      <h2 className="tr-title text-2xl text-white short:text-xl">YOU DIED!</h2>
      <p className="tr-text text-[11px]">Commander {s.dead.cause}.</p>
      <p className="max-w-sm text-[9px] leading-4 text-white/80">Respawning loses everything you carried: it stays in a bag 🎒 where you fell. You wake up in the habitat with the spare suit.</p>
      <div className="flex w-64 flex-col gap-2">
        <button type="button" onClick={() => { respawn(sim, habitatPos()); setOverlay(null); sfx.ok(); publish(); }}
          className="tr-btn !bg-[linear-gradient(180deg,#4fc26a,#2f8a45)] px-4 py-3 text-[12px] font-semibold">RESPAWN</button>
        <button type="button" onClick={() => { respawn(sim, habitatPos()); saveGame(); publish(); go("intro"); }}
          className="tr-btn px-4 py-2 text-[10px]">Main menu</button>
      </div>
    </div>
  );
}

/** Console-style pop-up for achievements and missions, one at a time. */
export function NoticeToast() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const n = s.notices[0];
  useEffect(() => {
    if (!n) return;
    sfx.ok();
    const id = setTimeout(() => { if (sim.notices[0]?.id === n.id) sim.notices.shift(); publish(); }, 4200);
    return () => clearTimeout(id);
  }, [n?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!n) return null;
  const ach = n.kind === "achievement";
  return (
    <div key={n.id} className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={`flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 font-sans text-white shadow-[0_0_18px_rgba(80,220,110,0.45)] ${ach ? "bg-[linear-gradient(90deg,#1d8a2e,#0f5c1c)]" : "bg-[linear-gradient(90deg,#2f5fd0,#1a3a8a)]"}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[20px] ${ach ? "bg-[#5ccf3f]" : "bg-[#5a8cff]"}`}>{ach ? "🏆" : "📜"}</div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold">{n.title}</div>
          <div className="text-[11px] text-white/90">{n.text}</div>
        </div>
      </div>
    </div>
  );
}

/** Achievement list (console style): every achievement, locked or unlocked, with a counter. */
export function AchievementList() {
  const s = useGame((g) => g.snap);
  const all = modos.logros;
  return (
    <div className="mb-3 overflow-hidden rounded-[8px] border-2 border-[#0b1230]">
      <div className="flex items-center justify-between bg-[linear-gradient(90deg,#1d8a2e,#147024)] px-3 py-1.5 text-[10px] font-semibold text-white">
        <span>🏆 Achievements</span><span>{s.logros.length} of {all.length}</span>
      </div>
      {all.map((a) => {
        const got = s.logros.includes(a);
        return (
          <div key={a} className={`flex items-center gap-2 border-t border-black/20 px-3 py-1.5 text-[9px] ${got ? "bg-white/90 text-[#14141c]" : "bg-white/40 text-[#14141c]/60"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded ${got ? "bg-[#5ccf3f]" : "bg-black/20 grayscale"}`}>{got ? "🏆" : "🔒"}</span>
            <span className="flex-1">{a}</span>
            <span className="font-semibold">{got ? "Unlocked" : "Locked"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Suit status + put on / take off (also key V). */
export function SuitControl({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const label = !s.suit.owned ? "No suit" : s.suit.worn ? "Take off" : "Put on";
  return (
    <div className={`pointer-events-auto flex items-center gap-2 text-[9px] ${className}`}>
      <span className={`tr-text ${s.suit.integrity < 25 ? "text-alert" : ""}`}>🧑‍🚀 Suit {s.suit.owned ? `${Math.round(s.suit.integrity)}%` : "—"}{s.suit.owned && !s.suit.worn ? " (off)" : ""}</span>
      <button type="button" disabled={!s.suit.owned} onClick={() => {
        const msg = toggleSuit(sim, s.near.habitat);
        if (msg.startsWith("Take") || msg.startsWith("You have")) sfx.bad(); else sfx.click();
        publish();
      }} className="tr-btn px-2 py-1 text-[9px] disabled:opacity-40">{label}</button>
    </div>
  );
}
