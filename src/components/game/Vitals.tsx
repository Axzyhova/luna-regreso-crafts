import { useGame } from "@/game/store";
import { clock, isDay, CYCLE, DAY_LEN } from "@/game/sim";
import { UMBRALES } from "@/game/effects";

const COLD = "#3b8fe6", HOT = "#f08a24";

function VBar({ icon, v, color, text, thick }: { icon: string; v: number; color: string; text?: string | undefined; thick?: boolean }) {
  const pct = Math.max(0, Math.min(100, v));
  return (
    <div className="flex items-center gap-1.5 short:gap-1">
      <span className="w-3 text-center text-[10px] leading-none text-white short:text-[8px]">{icon}</span>
      <div className={`relative flex-1 overflow-hidden rounded-[3px] bg-black/55 ${thick ? "h-3.5 short:h-2.5" : "h-1.5 short:h-1"}`}>
        <div className="h-full rounded-[3px] transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
        {text && <span className="tr-text absolute inset-0 flex items-center pl-1.5 text-[6px] leading-none">{text}</span>}
      </div>
    </div>
  );
}

/** Map a temperature to the gauge angle: -90° (coldest) … +90° (hottest). */
export function tempToAngle(temp: number) {
  const k = (temp - UMBRALES.gauge_min) / (UMBRALES.gauge_max - UMBRALES.gauge_min);
  return -90 + Math.max(0, Math.min(1, k)) * 180;
}

function arc(r: number, a0: number, a1: number) {
  const p = (a: number) => [32 + r * Math.sin((a * Math.PI) / 180), 34 - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

/** Semicircle thermometer: blue = freezing zone, orange = overheating zone. */
export function Thermometer() {
  const s = useGame((g) => g.snap);
  const aCold = tempToAngle(UMBRALES.frio_temp), aHot = tempToAngle(UMBRALES.calor_temp);
  const needle = tempToAngle(s.temp);
  const danger = s.coldT > 0 ? "cold" : s.heatT > 0 ? "hot" : null;
  const t = danger === "cold" ? s.coldT : s.heatT;
  const left = Math.max(0, Math.ceil(UMBRALES.gracia_s - t));
  return (
    <div className={`flex flex-col items-center ${danger ? "animate-pulse" : ""}`} title={`Suit ${s.temp.toFixed(0)} °C`}>
      <svg width="58" height="36" viewBox="0 0 64 40" className="short:h-7 short:w-11" aria-label={`Suit temperature ${s.temp.toFixed(0)} degrees`}>
        <path d={arc(26, -90, 90)} stroke="rgba(0,0,0,0.55)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d={arc(26, -90, aCold)} stroke={COLD} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={arc(26, aCold, aHot)} stroke="#d9d9de" strokeWidth="6" fill="none" />
        <path d={arc(26, aHot, 90)} stroke={HOT} strokeWidth="6" fill="none" strokeLinecap="round" />
        <g transform={`rotate(${needle} 32 34)`} className="transition-transform duration-300">
          <path d="M 32 13 L 34.2 34 L 29.8 34 Z" fill="#ffffff" />
        </g>
        <circle cx="32" cy="34" r="4" fill="#ffffff" />
      </svg>
      <span className={`tr-text -mt-1 text-[6px] leading-none ${danger === "cold" ? "!text-[#7fb8ff]" : danger === "hot" ? "!text-[#ffb066]" : ""}`}>
        {danger ? (left > 0 ? `${danger === "cold" ? "❄" : "🔥"} ${left}s` : `${danger === "cold" ? "❄ FREEZING" : "🔥 OVERHEAT"}`) : `${s.temp.toFixed(0)}°C`}
      </span>
    </div>
  );
}

/** Minimal day/night clock: icon, phase, time left and a thin progress line. */
export function DayClock({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  const t = s.time % CYCLE;
  const day = isDay(s);
  const p = day ? t / DAY_LEN : (t - DAY_LEN) / (CYCLE - DAY_LEN);
  const left = clock(s).replace(/^(DAY|NIGHT) (\d+ )?/, "");
  return (
    <div className={`tr-hud pointer-events-none flex min-w-[104px] flex-col gap-1 !rounded-full px-3 py-1 ${className}`} aria-label={day ? "Day" : "Night"}>
      <div className="tr-text flex items-center justify-between gap-2 text-[7px] leading-none">
        <span className={day ? "text-gold" : "text-suit-light"}>{day ? "☀ Day" : "☾ Night"} {s.day}</span>
        <span className="tabular-nums text-white/80">{left}</span>
      </div>
      <div className="h-[2px] w-full rounded bg-white/15"><div className={`h-full rounded transition-[width] duration-1000 ease-linear ${day ? "bg-gold" : "bg-suit-light"}`} style={{ width: `${Math.min(100, p * 100)}%` }} /></div>
    </div>
  );
}

/** Survival panel: suit O2, health and stamina bars, plus the thermometer and the day/night dial. */
export function Vitals({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  return (
    <div className={`pointer-events-none flex items-center gap-2 ${className}`}>
      <div className="flex w-36 flex-col gap-1 sm:w-44 short:w-24 short:gap-0.5">
        <VBar icon="🫧" v={s.suitO2} color="#3b8fe6" />
        <VBar icon="♥" v={s.health} color="#3fbf6a" thick text={`${Math.round(s.health)} / 100`} />
        <VBar icon="⚡" v={100 - s.fatigue} color="#f08a24" />
        <VBar icon="💧" v={s.hydration} color="#39c6d8" />
        <VBar icon="🧑‍🚀" thick={!s.suit.owned || !s.suit.worn} v={s.suit.owned ? s.suit.integrity : 0} color={s.suit.integrity < 25 ? "#f08a24" : "#c9c9cf"} text={!s.suit.owned ? "NO SUIT" : !s.suit.worn ? "SUIT OFF" : undefined} />
      </div>
      <Thermometer />
    </div>
  );
}
