import { useState } from "react";
import { useGame, sim } from "@/game/store";
import { ROBERT, robertAdvice } from "@/game/robert";
import { sfx } from "@/game/audio";
import { useTouchDevice } from "@/hooks/use-device";

/** Mini Robert's face: a round solar rover with cells, two wheels on top and a blue eye. */
export function RobertFace({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <rect x="2" y="1" width="4" height="3" fill="#1b1b22" /><rect x="10" y="1" width="4" height="3" fill="#1b1b22" />
      <rect x="3" y="2" width="2" height="1" fill="#6b6b75" /><rect x="11" y="2" width="2" height="1" fill="#6b6b75" />
      <rect x="2" y="4" width="12" height="10" fill="#c79a2e" /><rect x="1" y="5" width="14" height="8" fill="#c79a2e" />
      <rect x="3" y="5" width="10" height="8" fill="#15151c" /><rect x="2" y="6" width="12" height="6" fill="#15151c" />
      {[3, 6, 9].map((y) => [3, 6, 9].map((x) => <rect key={`${x}${y}`} x={x + 0.5} y={y} width="2" height="2" fill="#26304a" />))}
      <rect x="4" y="6" width="1" height="1" fill="#e8ecff" /><rect x="10" y="9" width="1" height="1" fill="#e8ecff" />
      <rect x="7" y="8" width="2" height="2" fill="#4fc3ff" /><rect x="7" y="8" width="1" height="1" fill="#d8f4ff" />
      <rect x="1" y="9" width="1" height="2" fill="#f2d24f" /><rect x="14" y="9" width="1" height="2" fill="#f2d24f" />
    </svg>
  );
}

/** Mandatory first-time intro: who Mini Robert is and what the game is about. No skip. */
export function RobertIntro() {
  const met = useGame((g) => g.snap.robertMet);
  const dialog = useGame((g) => g.snap.dialog.length);
  const dead = useGame((g) => g.snap.dead);
  const publish = useGame((g) => g.publish);
  const [i, setI] = useState(0);
  if (met || dialog > 0 || dead) return null;
  const slides = ROBERT.intro;
  const sl = slides[i]!;
  const last = i === slides.length - 1;
  const next = () => { sfx.click(); if (last) { sim.robertMet = true; publish(); } else setI(i + 1); };
  return (
    <div className="absolute inset-0 z-[30] flex items-center justify-center bg-background/75 p-3 short:p-1">
      <div className="tr-panel w-full max-w-md p-4 short:p-2">
        <div className="flex items-center gap-3">
          <div className="animate-bounce"><RobertFace size={56} /></div>
          <div className="min-w-0">
            <div className="tr-text text-[8px] text-white/70">MINI ROBERT · {i + 1}/{slides.length}</div>
            <h3 className="tr-title text-[12px] text-gold">{sl.title}</h3>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-white/90">{sl.text}</p>
        {"steps" in sl && sl.steps && (
          <ol className="mt-2 grid gap-1">
            {sl.steps.map((st, k) => <li key={k} className="rounded bg-black/35 px-2 py-1.5 text-[9px] leading-4 text-white">{st}</li>)}
          </ol>
        )}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1">{slides.map((_, k) => <span key={k} className={`h-1 flex-1 rounded ${k <= i ? "bg-gold" : "bg-white/20"}`} />)}</div>
          {i > 0 && <button type="button" onClick={() => { sfx.click(); setI(i - 1); }} className="tr-btn px-3 py-2 text-[9px]">BACK</button>}
          <button type="button" onClick={next} className="tr-btn tr-btn-primary px-4 py-2 text-[10px]">{last ? "LET'S GO!" : "NEXT"}</button>
        </div>
      </div>
    </div>
  );
}

/** "How can Mini Robert help you?": what to do now, then the full guide by area → subarea → point. */
export function RobertPanel() {
  const s = useGame((g) => g.snap);
  const setOverlay = useGame((g) => g.setOverlay);
  const touch = useTouchDevice();
  const [area, setArea] = useState<number | null>(null);
  const [sub, setSub] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const A = area !== null ? ROBERT.areas[area] : undefined;
  const S = A && sub !== null ? A.subs[sub] : undefined;
  const go = (a: number | null, b: number | null = null) => { sfx.click(); setArea(a); setSub(b); setOpen(0); };
  const advice = robertAdvice(s, touch);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel flex max-h-full w-full max-w-xl flex-col p-3 short:p-2">
        <div className="mb-2 flex items-center gap-2">
          <RobertFace size={36} />
          <div className="min-w-0 flex-1">
            <h3 className="tr-title text-[11px] text-gold">MINI ROBERT</h3>
            <div className="truncate text-[8px] text-white/75">
              <button type="button" onClick={() => go(null)} className="hover:text-gold">Help</button>
              {A && <> › <button type="button" onClick={() => go(area)} className="hover:text-gold">{A.title}</button></>}
              {S && <> › {S.title}</>}
            </div>
          </div>
          {A && <button type="button" onClick={() => (S ? go(area) : go(null))} className="tr-btn px-2 py-1 text-[9px]">← BACK</button>}
          <button type="button" onClick={() => { sfx.click(); setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {!A && (
            <>
              <div className="mb-2 rounded border-2 border-gold/60 bg-black/35 p-2">
                <div className="tr-text mb-1 text-[9px] text-gold">❓ WHAT SHOULD I DO NOW?</div>
                {advice.now.map((t, k) => <p key={k} className="text-[9px] leading-4 text-white">{t}</p>)}
                <ul className="mt-1 grid gap-0.5">{advice.tips.map((t, k) => <li key={k} className="text-[8px] leading-4 text-white/85">{t}</li>)}</ul>
              </div>
              <div className="tr-text mb-1 text-[9px] text-white/90">What do you need help with?</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {ROBERT.areas.map((a, k) => (
                  <button key={a.id} type="button" onClick={() => go(k)} className="tr-btn flex flex-col items-start gap-0.5 px-2 py-2 text-left">
                    <span className="text-[10px]">{a.icon} {a.title}</span>
                    <span className="text-[7px] leading-3 opacity-75">{a.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {A && !S && (
            <div className="grid gap-1.5">
              <p className="text-[9px] text-white/80">{A.icon} {A.sub}</p>
              {A.subs.map((b, k) => (
                <button key={b.title} type="button" onClick={() => go(area, k)} className="tr-btn flex items-center justify-between px-3 py-2 text-left text-[10px]">
                  <span>{b.title}</span><span className="text-[8px] opacity-70">{b.points.length} ›</span>
                </button>
              ))}
            </div>
          )}

          {S && (
            <div className="grid gap-1">
              {S.points.map((p, k) => (
                <button key={p.t} type="button" onClick={() => { sfx.click(); setOpen(open === k ? null : k); }} className="rounded bg-black/35 px-2 py-1.5 text-left">
                  <div className="flex items-center justify-between text-[10px] text-gold"><span>{p.t}</span><span className="text-[8px] text-white/60">{open === k ? "−" : "+"}</span></div>
                  {open === k && <p className="mt-1 text-[9px] leading-4 text-white/90">{p.d}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
