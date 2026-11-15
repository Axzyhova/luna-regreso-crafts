import { useState } from "react";
import { useGame, sim } from "@/game/store";
import {
  ROBERT_MAX_LEVEL, ROBERT_SKILLS, ROBERT_SKINS, ROBERT_MATS, ROBERT_MEDIC_HP_S,
  robertUpCost, robertForageEvery, canPay, upgradeRobert, unlockRobertSkill, setRobertMat, setRobertSkin,
  ROVER_MAX_LEVEL, ROVER_SKILLS, ROVER_MATS, ROVER_SPEED, ROVER_MINE_S, ROVER_LOAD, roverUpCost, roverSpeed, roverMineS, roverLoad,
  upgradeRovers, unlockRoverSkill, setRoverSkin, setRoverMat, roverSite,
} from "@/game/sim";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";
import { RobertFace } from "./RobertPanel";

type Who = "robert" | "rover";
type Tab = "up" | "skills" | "tune" | "collect";
const TABS: [Tab, string][] = [["up", "⬆ UPGRADE"], ["skills", "✨ SKILLS"], ["tune", "🎨 TUNING"], ["collect", "⛏ COLLECT"]];
type Skill = { nombre: string; icon: string; desc: string; cost: Record<string, number> };

function Cost({ cost, inv }: { cost: Record<string, number>; inv: Record<string, number> }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {Object.entries(cost).map(([k, n]) => (
        <span key={k} className={`flex items-center gap-0.5 ${(inv[k] ?? 0) >= n ? "text-white/85" : "text-destructive"}`}>
          <PixelIcon item={k} size={12} /> {n} {ITEMS[k]?.nombre ?? k} ({Math.floor(inv[k] ?? 0)})
        </span>
      ))}
    </span>
  );
}

const swatch = (id: string, tint: number) => (id === "gold" ? "#c79a2e" : `#${tint.toString(16).padStart(6, "0")}`);

/** Robert Station (E on the dock): upgrade, add skills, repaint and pick materials for Mini Robert or the Auto-Miner Rovers. */
export function RobotLabPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const [who, setWho] = useState<Who>("robert");
  const [tab, setTab] = useState<Tab>("up");
  const inv = s.inv as unknown as Record<string, number>;
  const act = (ok: boolean) => { if (ok) { sfx.ok(); publish(); } else sfx.bad(); };
  const rovers = s.modules.filter((m) => m.tipo === "rover");

  // One shape for both machines, so the four tabs work the same way.
  const R = who === "robert"
    ? {
        title: "Mini Robert", level: s.robert.level, max: ROBERT_MAX_LEVEL, skills: s.robert.skills, skin: s.robert.skin,
        upCost: robertUpCost(s.robert.level), upgrade: () => upgradeRobert(sim), all: ROBERT_SKILLS as Record<string, Skill>,
        unlock: (id: string) => unlockRobertSkill(sim, id), setSkin: (id: string) => setRobertSkin(sim, id),
        stats: [
          `🛞 Follow speed: +${(s.robert.level - 1) * 12}%`,
          `⛏ Forager: a trip every ${robertForageEvery(s.robert.level).toFixed(1)} s, ${60 + s.robert.level * 8} px reach`,
          `💡 Headlamp radius: ${26 + s.robert.level * 5} px`,
          `➕ Med-bot: +${(ROBERT_MEDIC_HP_S * s.robert.level * 60).toFixed(1)} health / min`,
        ],
      }
    : {
        title: `Auto-Miner Rovers (${rovers.length})`, level: s.roverTech.level, max: ROVER_MAX_LEVEL, skills: s.roverTech.skills, skin: s.roverTech.skin,
        upCost: roverUpCost(s.roverTech.level), upgrade: () => upgradeRovers(sim), all: ROVER_SKILLS as Record<string, Skill>,
        unlock: (id: string) => unlockRoverSkill(sim, id), setSkin: (id: string) => setRoverSkin(sim, id),
        stats: [
          `🛞 Speed: ${roverSpeed(s).toFixed(0)} px/s (base ${ROVER_SPEED})`,
          `⛏ Mining time: ${roverMineS(s).toFixed(1)} s (base ${ROVER_MINE_S})`,
          `📦 Load per trip: ${roverLoad(s)} (base ${ROVER_LOAD})`,
          `🔦 Headlights: ${s.roverTech.skills.includes("lights") ? "on at night" : "not installed"}`,
        ],
      };
  const maxed = R.level >= R.max;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel flex max-h-full w-full max-w-xl flex-col p-3 short:p-2">
        <div className="mb-2 flex items-center gap-2">
          {who === "robert" ? <RobertFace size={38} /> : <PixelIcon item="rover" size={34} />}
          <div className="flex-1">
            <h3 className="tr-title text-[11px] text-gold">ROBERT STATION</h3>
            <div className="text-[8px] text-white/75">{R.title} · Level {R.level}/{R.max} · {R.skills.length}/{Object.keys(R.all).length} skills · {ROBERT_SKINS[R.skin]?.nombre}</div>
          </div>
          <button type="button" onClick={() => { sfx.click(); setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <div className="mb-1.5 grid grid-cols-2 gap-1">
          {([["robert", "🤖 MINI ROBERT"], ["rover", "🚜 AUTO-MINER ROVERS"]] as [Who, string][]).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { sfx.click(); setWho(id); }} className={`tr-btn px-1 py-1.5 text-[9px] ${who === id ? "!border-ok !bg-ok/35" : ""}`}>{label}</button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { sfx.click(); setTab(id); }} className={`tr-btn px-1 py-1.5 text-[8px] ${tab === id ? "!border-gold !bg-gold/30" : ""}`}>{label}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto pr-1 text-[9px] leading-4 text-white">
          {tab === "up" && (
            <div className="grid gap-2">
              <div className="flex gap-1">{Array.from({ length: R.max }, (_, i) => <span key={i} className={`h-2 flex-1 rounded ${i < R.level ? "bg-gold" : "bg-white/15"}`} />)}</div>
              <ul className="grid gap-0.5 rounded bg-black/35 p-2">{R.stats.map((x) => <li key={x}>{x}</li>)}</ul>
              {who === "rover" && <p className="text-white/70">Upgrades apply to every Auto-Miner Rover you own.</p>}
              {maxed ? <p className="text-ok">Fully upgraded!</p> : (
                <div className="flex flex-wrap items-center gap-2">
                  <Cost cost={R.upCost} inv={inv} />
                  <button type="button" disabled={!canPay(s, R.upCost)} onClick={() => act(R.upgrade())} className="tr-btn tr-btn-primary px-3 py-1.5 text-[9px] disabled:opacity-40">UPGRADE TO LV {R.level + 1}</button>
                </div>
              )}
            </div>
          )}

          {tab === "skills" && (
            <div className="grid gap-1.5">
              {Object.entries(R.all).map(([id, sk]) => {
                const has = R.skills.includes(id);
                return (
                  <div key={id} className={`rounded border p-2 ${has ? "border-ok/70 bg-ok/15" : "border-white/15 bg-black/35"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gold">{sk.icon} {sk.nombre}</span>
                      {has ? <span className="text-ok">✓ INSTALLED</span> : (
                        <button type="button" disabled={!canPay(s, sk.cost)} onClick={() => act(R.unlock(id))} className="tr-btn tr-btn-primary px-2 py-1 text-[8px] disabled:opacity-40">UNLOCK</button>
                      )}
                    </div>
                    <p className="text-white/80">{sk.desc}</p>
                    {!has && <Cost cost={sk.cost} inv={inv} />}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "tune" && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {Object.entries(ROBERT_SKINS).map(([id, sk]) => (
                <button key={id} type="button" onClick={() => act(R.setSkin(id))} className={`tr-btn flex items-center gap-2 px-2 py-2 text-left ${R.skin === id ? "!border-ok !bg-ok/30" : ""}`}>
                  <span className="h-5 w-5 rounded-full border-2 border-black/60" style={{ background: swatch(id, sk.tint) }} />
                  <span className="text-[9px]">{sk.nombre}{R.skin === id ? " ✓" : ""}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "collect" && who === "robert" && (
            <div className="grid gap-1.5">
              <p className="text-white/80">{s.robert.skills.includes("forager") ? "Choose what Mini Robert gathers from nodes near you:" : "Unlock the ⛏ Forager skill first, then choose what he gathers."}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ROBERT_MATS.map((mat) => (
                  <button key={mat} type="button" onClick={() => act(setRobertMat(sim, mat))} className={`tr-btn flex items-center gap-2 px-2 py-1.5 text-left ${s.robert.mat === mat ? "!border-ok !bg-ok/30" : ""}`}>
                    <PixelIcon item={mat} size={18} /><span className="text-[9px]">{ITEMS[mat]?.nombre ?? mat}{s.robert.mat === mat ? " ✓" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "collect" && who === "rover" && (
            <div className="grid gap-2">
              {!rovers.length && <p className="text-white/80">You have no Auto-Miner Rovers yet. Craft one at the Workshop and place it with BUILD.</p>}
              {rovers.map((m, i) => (
                <div key={m.uid} className="rounded bg-black/35 p-2">
                  <div className="mb-1 text-[9px] text-gold">Rover #{i + 1} · mining {ITEMS[m.mat ?? "regolito"]?.nombre} · {m.note ?? "Ready"}</div>
                  <div className="flex flex-wrap gap-1">
                    {ROVER_MATS.map((mat) => {
                      const ok = !!roverSite(s, mat, { x: m.x, y: m.y }), on = (m.mat ?? "regolito") === mat;
                      return (
                        <button key={mat} type="button" disabled={!ok} title={ok ? ITEMS[mat]?.nombre : "Needs the bridge to the Hive"}
                          onClick={() => { const live = sim.modules.find((x) => x.uid === m.uid); act(!!live && setRoverMat(sim, live, mat)); }}
                          className={`tr-btn flex h-8 w-8 items-center justify-center p-0 disabled:opacity-30 ${on ? "!border-ok !bg-ok/35" : ""}`}>
                          <PixelIcon item={mat} size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
