import { useState } from "react";
import { useGame, sim } from "@/game/store";
import {
  ROBERT_MAX_LEVEL, ROBERT_SKILLS, ROBERT_SKINS, ROBERT_MATS, ROBERT_MEDIC_HP_S,
  robertUpCost, robertForageEvery, canPay, upgradeRobert, unlockRobertSkill, setRobertMat, setRobertSkin,
} from "@/game/sim";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";
import { RobertFace } from "./RobertPanel";

type Tab = "up" | "skills" | "tune" | "collect";
const TABS: [Tab, string][] = [["up", "⬆ UPGRADE"], ["skills", "✨ SKILLS"], ["tune", "🎨 TUNING"], ["collect", "⛏ COLLECT"]];

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

/** Robert Station (E on the dock): level up Mini Robert, unlock skills, repaint him, pick what he gathers. */
export function RobotLabPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const [tab, setTab] = useState<Tab>("up");
  const rob = s.robert;
  const inv = s.inv as unknown as Record<string, number>;
  const act = (ok: boolean) => { if (ok) { sfx.ok(); publish(); } else sfx.bad(); };
  const maxed = rob.level >= ROBERT_MAX_LEVEL;
  const upCost = robertUpCost(rob.level);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel flex max-h-full w-full max-w-xl flex-col p-3 short:p-2">
        <div className="mb-2 flex items-center gap-2">
          <RobertFace size={38} />
          <div className="flex-1">
            <h3 className="tr-title text-[11px] text-gold">ROBERT STATION</h3>
            <div className="text-[8px] text-white/75">Mini Robert · Level {rob.level}/{ROBERT_MAX_LEVEL} · {rob.skills.length}/{Object.keys(ROBERT_SKILLS).length} skills · {ROBERT_SKINS[rob.skin]?.nombre}</div>
          </div>
          <button type="button" onClick={() => { sfx.click(); setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <div className="mb-2 grid grid-cols-4 gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { sfx.click(); setTab(id); }} className={`tr-btn px-1 py-1.5 text-[8px] ${tab === id ? "!border-gold !bg-gold/30" : ""}`}>{label}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto pr-1 text-[9px] leading-4 text-white">
          {tab === "up" && (
            <div className="grid gap-2">
              <div className="flex gap-1">{Array.from({ length: ROBERT_MAX_LEVEL }, (_, i) => <span key={i} className={`h-2 flex-1 rounded ${i < rob.level ? "bg-gold" : "bg-white/15"}`} />)}</div>
              <ul className="grid gap-0.5 rounded bg-black/35 p-2">
                <li>🛞 Follow speed: +{(rob.level - 1) * 12}%</li>
                <li>⛏ Forager: a trip every {robertForageEvery(rob.level).toFixed(1)} s, {60 + rob.level * 8} px reach</li>
                <li>💡 Headlamp radius: {40 + rob.level * 10} px</li>
                <li>➕ Med-bot: +{(ROBERT_MEDIC_HP_S * rob.level * 60).toFixed(1)} health / min</li>
              </ul>
              {maxed ? <p className="text-ok">Mini Robert is fully upgraded!</p> : (
                <div className="flex flex-wrap items-center gap-2">
                  <Cost cost={upCost} inv={inv} />
                  <button type="button" disabled={!canPay(s, upCost)} onClick={() => act(upgradeRobert(sim))} className="tr-btn tr-btn-primary px-3 py-1.5 text-[9px] disabled:opacity-40">UPGRADE TO LV {rob.level + 1}</button>
                </div>
              )}
            </div>
          )}

          {tab === "skills" && (
            <div className="grid gap-1.5">
              {Object.entries(ROBERT_SKILLS).map(([id, sk]) => {
                const has = rob.skills.includes(id);
                return (
                  <div key={id} className={`rounded border p-2 ${has ? "border-ok/70 bg-ok/15" : "border-white/15 bg-black/35"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gold">{sk.icon} {sk.nombre}</span>
                      {has ? <span className="text-ok">✓ LEARNED</span> : (
                        <button type="button" disabled={!canPay(s, sk.cost)} onClick={() => act(unlockRobertSkill(sim, id))} className="tr-btn tr-btn-primary px-2 py-1 text-[8px] disabled:opacity-40">UNLOCK</button>
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
                <button key={id} type="button" onClick={() => act(setRobertSkin(sim, id))} className={`tr-btn flex items-center gap-2 px-2 py-2 text-left ${rob.skin === id ? "!border-ok !bg-ok/30" : ""}`}>
                  <span className="h-5 w-5 rounded-full border-2 border-black/60" style={{ background: id === "gold" ? "#c79a2e" : `#${sk.tint.toString(16).padStart(6, "0")}` }} />
                  <span className="text-[9px]">{sk.nombre}{rob.skin === id ? " ✓" : ""}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "collect" && (
            <div className="grid gap-1.5">
              <p className="text-white/80">{rob.skills.includes("forager") ? "Choose what Mini Robert gathers from nodes near you:" : "Unlock the ⛏ Forager skill first, then choose what he gathers."}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ROBERT_MATS.map((mat) => (
                  <button key={mat} type="button" onClick={() => act(setRobertMat(sim, mat))} className={`tr-btn flex items-center gap-2 px-2 py-1.5 text-left ${rob.mat === mat ? "!border-ok !bg-ok/30" : ""}`}>
                    <PixelIcon item={mat} size={18} /><span className="text-[9px]">{ITEMS[mat]?.nombre ?? mat}{rob.mat === mat ? " ✓" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
