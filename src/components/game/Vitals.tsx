import { useGame } from "@/game/store";
import { clock, isDay, CYCLE, DAY_LEN } from "@/game/sim";
import { UMBRALES } from "@/game/effects";

const COLD = "#3b8fe6", HOT = "#f08a24";

function VBar({ icon, v, color, text, thick }: { icon: string; v: number; color: string; text?: string; thick?: boolean }) {
  const pct = Math.max(0, Math.min(100, v));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 text-center text-[10px] leading-none text-white">{icon}</span>
      <div className={`relative flex-1 overflow-hidden rounded-[3px] bg-black/55 ${thick ? "h-3.5" : "h-1.5"}`}>
        <div className="h-full rounded-[3px] transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
        {text && <span className="absolute inset-0 flex items-center pl-1.5 font-sans text-[9px] font-bold leading-none text-white drop-shadow">{text}</span>}
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
      <svg width="58" height="36" viewBox="0 0 64 40" aria-label={`Suit temperature ${s.temp.toFixed(0)} degrees`}>
        <path d={arc(26, -90, 90)} stroke="rgba(0,0,0,0.55)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d={arc(26, -90, aCold)} stroke={COLD} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={arc(26, aCold, aHot)} stroke="#d9d9de" strokeWidth="6" fill="none" />
        <path d={arc(26, aHot, 90)} stroke={HOT} strokeWidth="6" fill="none" strokeLinecap="round" />
        <g transform={`rotate(${needle} 32 34)`} className="transition-transform duration-300">
          <path d="M 32 13 L 34.2 34 L 29.8 34 Z" fill="#ffffff" />
        </g>
        <circle cx="32" cy="34" r="4" fill="#ffffff" />
      </svg>
      <span className={`-mt-1 font-sans text-[9px] font-bold leading-none ${danger === "cold" ? "text-[#7fb8ff]" : danger === "hot" ? "text-[#ffb066]" : "text-white"}`}>
        {danger ? (left > 0 ? `${danger === "cold" ? "❄" : "🔥"} ${left}s` : `${danger === "cold" ? "❄ FREEZING" : "🔥 OVERHEAT"}`) : `${s.temp.toFixed(0)}°C`}
      </span>
    </div>
  );
}

/** Day/night dial: the ring fills through the lunar day (gold) and night (blue). */
export function DayDial() {
  const s = useGame((g) => g.snap);
  const t = s.time % CYCLE;
  const day = isDay(s);
  const frac = t / CYCLE, dayFrac = DAY_LEN / CYCLE;
  const R = 15, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center" title={clock(s)}>
      <svg width="38" height="38" viewBox="0 0 40 40" aria-label={day ? "Day" : "Night"}>
        <circle cx="20" cy="20" r={R} fill="rgba(0,0,0,0.55)" />
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(242,210,79,0.25)" strokeWidth="3" strokeDasharray={`${C * dayFrac} ${C}`} transform="rotate(-90 20 20)" />
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(127,168,255,0.25)" strokeWidth="3" strokeDasharray={`${C * (1 - dayFrac)} ${C}`} strokeDashoffset={-C * dayFrac} transform="rotate(-90 20 20)" />
        <circle cx="20" cy="20" r={R} fill="none" stroke={day ? "#f2d24f" : "#7fa8ff"} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 20 20)" />
        <text x="20" y="25" textAnchor="middle" fontSize="14">{day ? "☀️" : "🌙"}</text>
      </svg>
      <span className={`-mt-0.5 font-sans text-[8px] font-bold leading-none ${day ? "text-gold" : "text-suit-light"}`}>{clock(s).replace(/^(DAY|NIGHT) \d+ /, "")}</span>
    </div>
  );
}

/** Survival panel: suit O2, health and stamina bars, plus the thermometer and the day/night dial. */
export function Vitals({ className = "" }: { className?: string }) {
  const s = useGame((g) => g.snap);
  return (
    <div className={`pointer-events-none flex items-center gap-2 ${className}`}>
      <div className="flex w-36 flex-col gap-1 sm:w-44">
        <VBar icon="🫧" v={s.suitO2} color="#3b8fe6" />
        <VBar icon="♥" v={s.health} color="#3fbf6a" thick text={`${Math.round(s.health)} / 100`} />
        <VBar icon="⚡" v={100 - s.fatigue} color="#f08a24" />
      </div>
      <Thermometer />
      <DayDial />
    </div>
  );
}
