import { useState, type ReactNode } from "react";
import personal from "@/data/personal.json";
import { useGame, sim } from "@/game/store";
import { isDay, meltIce, addLog, sleepUntilDawn, personalUnlocked, toggleSuit, drinkWater, WATER_TANK_KG } from "@/game/sim";
import { sfx } from "@/game/audio";

type View = "room" | "bed" | "diary" | "album";
type Unlock = { day?: number; mission?: number };
const lockHint = (u: Unlock) => (u.day !== undefined ? `Survive until day ${u.day}` : u.mission !== undefined ? `Complete ${u.mission} main mission${u.mission > 1 ? "s" : ""}` : "");

/** Tiny pixel helper for the SVG art (1 unit = 1 pixel). */
const P = ({ x, y, w = 1, h = 1, c }: { x: number; y: number; w?: number; h?: number; c: string }) => <rect x={x} y={y} width={w} height={h} fill={c} />;

/** Family photos drawn as small pixel scenes (32×24). */
function PhotoArt({ id }: { id: string }) {
  const scenes: Record<string, ReactNode> = {
    launch: <>
      <P x={0} y={0} w={32} h={14} c="#7fb8ff" /><P x={0} y={14} w={32} h={10} c="#5a8a3a" />
      <P x={24} y={2} w={2} h={12} c="#e6e6ec" /><P x={23} y={0} w={4} h={3} c="#d63b3b" /><P x={23} y={13} w={4} h={2} c="#f2a83a" />
      {[[4, "#3b6fd6"], [9, "#d63b3b"], [14, "#9b4fd6"]].map(([x, c]) => <g key={String(x)}><P x={Number(x)} y={11} w={3} h={3} c="#f0c8a0" /><P x={Number(x)} y={14} w={3} h={6} c={String(c)} /></g>)}
      <P x={16} y={8} w={8} h={4} c="#ffffff" /><P x={17} y={9} w={6} h={2} c="#d63b3b" />
    </>,
    drawing: <>
      <P x={0} y={0} w={32} h={24} c="#fdf6e3" />
      <circle cx={10} cy={8} r={5} fill="#f2d24f" /><P x={8} y={7} w={1} h={1} c="#5a3a18" /><P x={11} y={7} w={1} h={1} c="#5a3a18" /><P x={8} y={10} w={4} h={1} c="#d63b3b" />
      <P x={18} y={12} w={5} h={6} c="#ffffff" /><P x={19} y={13} w={3} h={2} c="#3b6fd6" />
      <P x={24} y={16} w={5} h={3} c="#c8902a" /><circle cx={27} cy={15} r={2.5} fill="none" stroke="#3b6fd6" strokeWidth={0.6} />
      {[3, 14, 29, 6].map((x, i) => <P key={i} x={x} y={18 + (i % 2) * 3} w={1} h={1} c="#9b4fd6" />)}
    </>,
    dog: <>
      <P x={0} y={0} w={32} h={24} c="#8ac0e8" /><P x={0} y={17} w={32} h={7} c="#6fbf4a" />
      <P x={8} y={10} w={14} h={7} c="#d8a050" /><P x={19} y={6} w={7} h={6} c="#d8a050" /><P x={20} y={5} w={2} h={3} c="#b07a3a" />
      <P x={23} y={8} w={1} h={1} c="#1b1b22" /><P x={25} y={10} w={1} h={1} c="#1b1b22" /><P x={24} y={11} w={2} h={1} c="#d63b3b" />
      {[9, 12, 17, 20].map((x) => <P key={x} x={x} y={17} w={2} h={3} c="#b07a3a" />)}<P x={6} y={9} w={3} h={2} c="#d8a050" />
      <P x={2} y={19} w={3} h={2} c="#ffffff" />
    </>,
    wedding: <>
      <P x={0} y={0} w={32} h={24} c="#6b7a8a" />
      {Array.from({ length: 22 }, (_, i) => <P key={i} x={(i * 7) % 32} y={(i * 5) % 20} w={0.5} h={2} c="#cfe2ff" />)}
      <P x={9} y={9} w={4} h={4} c="#f0c8a0" /><P x={8} y={13} w={6} h={9} c="#ffffff" />
      <P x={18} y={9} w={4} h={4} c="#c8946a" /><P x={17} y={13} w={6} h={9} c="#2a2a36" /><P x={19} y={13} w={2} h={3} c="#ffffff" />
      <P x={13} y={15} w={4} h={1} c="#f0c8a0" /><circle cx={7} cy={14} r={1.5} fill="#ff8ab0" />
    </>,
    crew: <>
      <P x={0} y={0} w={32} h={24} c="#1d3f8a" /><P x={0} y={19} w={32} h={5} c="#45454f" />
      {[[5, "#f0c8a0"], [13, "#c8946a"], [21, "#e8c4a0"]].map(([x, c]) => <g key={String(x)}>
        <P x={Number(x)} y={6} w={6} h={6} c="#e6e6ec" /><P x={Number(x) + 1} y={7} w={4} h={4} c={String(c)} />
        <P x={Number(x)} y={12} w={6} h={8} c="#e6e6ec" /><P x={Number(x) + 2} y={13} w={2} h={2} c="#d63b3b" /></g>)}
      <P x={11} y={2} w={10} h={2} c="#f2d24f" />
    </>,
    earthrise: <>
      <P x={0} y={0} w={32} h={24} c="#05060f" />
      {[[3, 3], [27, 5], [12, 2], [6, 10], [29, 14], [18, 4]].map(([x, y], i) => <P key={i} x={x!} y={y!} c="#ffffff" />)}
      <circle cx={18} cy={11} r={6} fill="#2a6ad8" /><P x={14} y={8} w={4} h={3} c="#4fc26a" /><P x={19} y={12} w={3} h={2} c="#4fc26a" /><P x={16} y={6} w={5} h={1} c="#ffffff" />
      <ellipse cx={16} cy={26} rx={22} ry={8} fill="#9a9aa3" /><P x={0} y={20} w={32} h={4} c="#6b6b75" />
    </>,
  };
  return <svg viewBox="0 0 32 24" shapeRendering="crispEdges" className="h-full w-full">{scenes[id]}</svg>;
}

/** The habitat interior (E at the habitat): bed, diary, family album and the water tank. */
export function HabitatPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const [view, setView] = useState<View>("room");
  const [page, setPage] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const night = !isDay(s);
  const pages = personal.diario.filter((d) => personalUnlocked(s, d.unlock as Unlock));
  const nextPage = personal.diario.find((d) => !personalUnlocked(s, d.unlock as Unlock));
  const melt = () => {
    const w = meltIce(sim);
    if (w > 0) { addLog(sim, `You melted ice: +${w} kg into the water tank.`); sfx.ok(); setMsg(`💧 +${w} kg water (tank ${Math.round(sim.inv.agua)}/${WATER_TANK_KG})`); }
    else { sfx.bad(); setMsg(sim.inv.hielo <= 0 ? "No ice to melt: bring some from the Shadowed Crater." : "Water tank full."); }
    publish();
  };
  const suit = () => { const m = toggleSuit(sim, true); sfx.click(); setMsg(`🧑‍🚀 ${m}${!sim.suit.worn ? " — you can drink and rest now. Put it back on before going out!" : ""}`); publish(); };
  const drink = () => { const r = drinkWater(sim); if (r.ok) sfx.ok(); else sfx.bad(); setMsg(`💧 ${r.msg}`); publish(); };
  const sleep = () => { const r = sleepUntilDawn(sim); if (r.ok) sfx.ok(); else sfx.bad(); setMsg(r.msg); publish(); if (r.ok) setView("room"); };
  const go = (v: View) => { sfx.click(); setMsg(null); setView(v); };
  const Spot = ({ x, y, w, h, label, onClick }: { x: number; y: number; w: number; h: number; label: string; onClick: () => void }) => (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={x} y={y} width={w} height={h} fill="#ffd45a" opacity={0} className="hover:opacity-20" />
      <text x={x + w / 2} y={y - 1.5} textAnchor="middle" fontSize={3.4} fill="#ffd45a" stroke="#000" strokeWidth={0.5} paintOrder="stroke" style={{ fontFamily: "inherit" }}>{label}</text>
    </g>
  );

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-3 short:p-1">
      <div className="tr-panel flex max-h-full w-full max-w-2xl flex-col p-3 short:p-2">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="tr-title flex-1 text-[11px] text-gold">🏠 HABITAT — {view === "room" ? "HOME" : view === "bed" ? "BED" : view === "diary" ? "COMMANDER'S DIARY" : "FAMILY ALBUM"}</h3>
          {view !== "room" && <button type="button" onClick={() => go("room")} className="tr-btn px-2 py-1 text-[9px]">← ROOM</button>}
          <button type="button" onClick={() => { sfx.click(); setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        {msg && <div className="mb-2 rounded bg-black/45 px-2 py-1 text-[9px] text-ok">{msg}</div>}

        <div className="min-h-0 flex-1 overflow-auto text-[9px] leading-4 text-white">
          {view === "room" && (
            <>
              <svg viewBox="0 0 160 80" shapeRendering="crispEdges" className="w-full rounded border-2 border-black/60">
                <P x={0} y={0} w={160} h={56} c="#3a3f52" /><P x={0} y={56} w={160} h={24} c="#5a4a3a" />
                {Array.from({ length: 10 }, (_, i) => <P key={i} x={i * 16} y={56} w={1} h={24} c="#4a3c2e" />)}
                {Array.from({ length: 8 }, (_, i) => <P key={`w${i}`} x={i * 20 + 9} y={0} w={1} h={56} c="#343849" />)}
                {/* window with Earth (day) or stars (night) */}
                <P x={64} y={8} w={32} h={22} c="#1b1b22" /><P x={66} y={10} w={28} h={18} c={night ? "#05060f" : "#0b1230"} />
                <circle cx={80} cy={19} r={5} fill="#2a6ad8" /><P x={77} y={17} w={3} h={2} c="#4fc26a" />
                {night && [[68, 12], [90, 13], [72, 25], [87, 24]].map(([x, y], i) => <P key={i} x={x!} y={y!} c="#ffffff" />)}
                {/* bed */}
                <P x={6} y={44} w={42} h={14} c="#6a4420" /><P x={8} y={42} w={38} h={8} c="#3b6fd6" /><P x={8} y={42} w={11} h={6} c="#e8eef8" />
                <P x={4} y={34} w={4} h={24} c="#5a3a1e" /><P x={22} y={32} w={10} h={8} c="#fdf6e3" /><circle cx={25} cy={35} r={2} fill="#f2d24f" />
                {/* desk + diary */}
                <P x={58} y={44} w={36} h={4} c="#8a5a2a" /><P x={60} y={48} w={3} h={10} c="#5a3a1e" /><P x={89} y={48} w={3} h={10} c="#5a3a1e" />
                <P x={70} y={40} w={10} h={4} c="#7a2a2a" /><P x={71} y={40} w={8} h={1} c="#f2d8a0" /><P x={83} y={38} w={2} h={6} c="#c9c9cf" /><P x={82} y={37} w={4} h={2} c="#f2d24f" />
                {/* shelf + album + photo frames */}
                <P x={106} y={22} w={34} h={2} c="#8a5a2a" /><P x={110} y={14} w={8} h={8} c="#2f8a45" /><P x={111} y={15} w={6} h={6} c="#9fd8ff" />
                <P x={122} y={16} w={9} h={6} c="#c8902a" /><P x={123} y={17} w={7} h={4} c="#f0c8a0" />
                <P x={110} y={44} w={22} h={3} c="#8a5a2a" /><P x={113} y={38} w={14} h={6} c="#4a2a5a" /><P x={114} y={39} w={12} h={1} c="#f2d24f" />
                {/* water tank */}
                <P x={142} y={30} w={14} h={28} c="#6b6b75" /><P x={144} y={32} w={10} h={24} c="#1d3f8a" />
                <P x={144} y={32 + 24 * (1 - Math.min(1, s.inv.agua / WATER_TANK_KG))} w={10} h={24 * Math.min(1, s.inv.agua / WATER_TANK_KG)} c="#4fc3ff" />
                <Spot x={4} y={32} w={46} h={26} label="🛏 BED" onClick={() => go("bed")} />
                <Spot x={58} y={36} w={36} h={22} label="📔 DIARY" onClick={() => { setPage(Math.max(0, pages.length - 1)); go("diary"); }} />
                <Spot x={106} y={12} w={34} h={36} label="📷 ALBUM" onClick={() => go("album")} />
                <Spot x={140} y={28} w={18} h={30} label="💧 TANK" onClick={melt} />
              </svg>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <button type="button" onClick={() => go("bed")} className="tr-btn px-2 py-2">🛏 Bed {night ? "(sleep)" : "(night only)"}</button>
                <button type="button" onClick={() => { setPage(Math.max(0, pages.length - 1)); go("diary"); }} className="tr-btn px-2 py-2">📔 Diary ({pages.length}/{personal.diario.length})</button>
                <button type="button" onClick={() => go("album")} className="tr-btn px-2 py-2">📷 Album</button>
                <button type="button" onClick={melt} className={`tr-btn px-2 py-2 ${s.inv.hielo > 0 ? "tr-btn-primary" : ""}`}>💧 Melt ice ({Math.floor(s.inv.hielo)})</button>
                {s.suit.owned && <button type="button" onClick={suit} className={`tr-btn px-2 py-2 ${s.suit.worn ? "" : "!border-alert !bg-alert/30"}`}>🧑‍🚀 {s.suit.worn ? "Take suit off" : "Put suit on"}</button>}
                <button type="button" disabled={s.suit.worn} onClick={drink} title={s.suit.worn ? "Take the suit off first" : "Drink from the tank"} className="tr-btn px-2 py-2 disabled:opacity-40">🥤 Drink{s.suit.worn ? " (suit off first)" : ""}</button>
              </div>
              <p className="mt-1 text-[8px] text-white/60">Water tank {Math.round(s.inv.agua)}/{WATER_TANK_KG} kg · Inside, O2 refills and you rest.</p>
            </>
          )}

          {view === "bed" && (
            <div className="grid gap-2">
              <p>{night ? "It's night. Sleep until dawn: fatigue gone, +30 sanity, +15 health (and a little thirsty)." : "It's daytime. You can only sleep at night — the bed will be waiting."}</p>
              <p className="text-white/70">☀ Some things only exist by day (Solar glass) and 🌙 others only at night (Starlight crystals). Sleeping skips the night, so grab what you need first.</p>
              <button type="button" disabled={!night} onClick={sleep} className="tr-btn tr-btn-primary w-fit px-4 py-2 text-[10px] disabled:opacity-40">😴 SLEEP UNTIL DAWN</button>
            </div>
          )}

          {view === "diary" && (
            <div className="grid gap-2">
              {pages[page] && (
                <div className="rounded bg-[#fdf6e3] p-3 text-[#3a2a1a]">
                  <div className="mb-1 text-[10px] font-bold">{pages[page]!.title}</div>
                  <p className="text-[9px] leading-4">{pages[page]!.text}</p>
                  <div className="mt-2 text-right text-[8px] italic">— Alex</div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 0} onClick={() => { sfx.click(); setPage(page - 1); }} className="tr-btn px-2 py-1 disabled:opacity-40">◀</button>
                <span className="flex-1 text-center">Page {page + 1} / {pages.length}</span>
                <button type="button" disabled={page >= pages.length - 1} onClick={() => { sfx.click(); setPage(page + 1); }} className="tr-btn px-2 py-1 disabled:opacity-40">▶</button>
              </div>
              {nextPage && <p className="text-[8px] text-white/60">🔒 Next page: {lockHint(nextPage.unlock as Unlock)}.</p>}
            </div>
          )}

          {view === "album" && (
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {personal.album.map((p) => {
                  const ok = personalUnlocked(s, p.unlock as Unlock);
                  return (
                    <button key={p.id} type="button" disabled={!ok} onClick={() => { sfx.click(); setPhoto(photo === p.id ? null : p.id); }}
                      className={`rounded bg-[#fdf6e3] p-1.5 text-left text-[#3a2a1a] shadow ${photo === p.id ? "ring-2 ring-gold" : ""} disabled:opacity-60`}>
                      <div className="aspect-[4/3] overflow-hidden bg-black/80">{ok ? <PhotoArt id={p.id} /> : <div className="flex h-full items-center justify-center text-[16px]">🔒</div>}</div>
                      <div className="mt-1 text-[8px] font-bold">{ok ? p.title : "Locked"}</div>
                      {!ok && <div className="text-[7px]">{lockHint(p.unlock as Unlock)}</div>}
                    </button>
                  );
                })}
              </div>
              {photo && <p className="rounded bg-black/40 p-2">{personal.album.find((p) => p.id === photo)?.caption}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
