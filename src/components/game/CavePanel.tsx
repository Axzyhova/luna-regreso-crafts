import { useEffect, useState } from "react";
import { useGame, sim } from "@/game/store";
import { CAVE_ALIENS, strikeCaveAlien, openCaveChest, unlockCavePerk } from "@/game/events";
import { PERKS } from "@/game/effects";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";

/**
 * Interactive Meteor Cave exploration overlay:
 * 1) Fight a cave-exclusive alien,
 * 2) Complete the Relic Frequency Lock minigame to unlock a lunar superpower/perk,
 * 3) Open the rare cave chest for rare "Plus" tools & armor.
 */
export function CavePanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const cave = s.caves.find((c) => c.id === s.activeCaveId) ?? s.caves[0] ?? null;

  const [cursor, setCursor] = useState(50);
  const [locks, setLocks] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [chestLoot, setChestLoot] = useState<string[]>([]);

  useEffect(() => {
    if (!cave || cave.relicDone) return;
    let t = 0;
    const id = setInterval(() => {
      t += 0.08;
      setCursor(50 + Math.sin(t * 3.2) * 46);
    }, 30);
    return () => clearInterval(id);
  }, [cave?.id, cave?.relicDone]);

  if (!cave) return null;
  const alien = CAVE_ALIENS[cave.alienType];
  const dmg = (sim.inv.baton > 0 ? 2 : 1) + (sim.inv.pico_plasma > 0 ? 1 : 0);

  const onStrike = () => {
    const res = strikeCaveAlien(sim, cave.id, dmg);
    if (res.killed) {
      sfx.ok();
      setStatusMsg(`✔ Defeated ${alien?.nombre ?? "Cave alien"}!`);
    } else {
      sfx.bad();
      setStatusMsg(`Hit for ${dmg} DMG! Took ${res.counterDmg} DMG back.`);
    }
    publish();
  };

  const onLock = () => {
    if (cursor >= 34 && cursor <= 66) {
      const next = locks + 1;
      sfx.ok();
      if (next >= 3) {
        const perk = unlockCavePerk(sim, cave.id);
        setLocks(3);
        setStatusMsg(perk ? `✨ Unlocked: ${PERKS[perk]?.nombre ?? perk}!` : "Relic calibrated!");
      } else {
        setLocks(next);
        setStatusMsg(`Signal locked (${next}/3)!`);
      }
      publish();
    } else {
      sfx.bad();
      setLocks(0);
      setStatusMsg("Missed target zone! Sequence reset.");
    }
  };

  const onOpenChest = () => {
    const got = openCaveChest(sim, cave.id);
    if (got.length) {
      sfx.ok();
      setChestLoot(got);
      publish();
    } else {
      sfx.bad();
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-2xl overflow-auto p-4 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">🕳 METEOR CAVE #{cave.id}</h3>
          <button type="button" onClick={() => setOverlay(null)} className="tr-btn px-2 py-1 text-[9px]">EXIT CAVE ✕</button>
        </div>
        {statusMsg && <div className="mb-2 rounded bg-black/45 px-2 py-1 text-[8px] text-gold">{statusMsg}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Cave Alien */}
          <div className="rounded-[8px] border-2 border-white/15 bg-black/35 p-2.5 text-[8px]">
            <div className="font-bold text-alien">👾 {alien?.nombre ?? cave.alienType}</div>
            <p className="mt-1 text-white/75">{alien?.desc}</p>
            <div className="mt-2 h-2 w-full bg-black/60">
              <div className="h-full bg-alien transition-all" style={{ width: `${(cave.alienHp / cave.alienMaxHp) * 100}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[7px] text-white/80">
              <span>HP: {cave.alienHp}/{cave.alienMaxHp}</span>
              <span>Your strike: {dmg} DMG</span>
            </div>
            <button type="button" disabled={cave.alienHp <= 0} onClick={onStrike} className="tr-btn mt-2 w-full py-1.5 text-[8px] disabled:opacity-40">
              {cave.alienHp > 0 ? "⚔ STRIKE ALIEN" : "✔ DEFEATED"}
            </button>
          </div>

          {/* Rare Cave Chest */}
          <div className="rounded-[8px] border-2 border-white/15 bg-black/35 p-2.5 text-[8px]">
            <div className="font-bold text-gold">💎 RARE CAVE CHEST</div>
            <p className="mt-1 text-white/75">Contains rare tools or armor (Plasma cutter, Exo-armor, Mag-boots).</p>
            <button type="button" disabled={cave.chestOpened || cave.alienHp > 0} onClick={onOpenChest} className="tr-btn mt-3 w-full py-1.5 text-[8px] disabled:opacity-40">
              {cave.chestOpened ? "✔ OPENED" : cave.alienHp > 0 ? "🔒 DEFEAT ALIEN FIRST" : "🔓 OPEN RARE CHEST"}
            </button>
            {chestLoot.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {chestLoot.map((k) => (
                  <span key={k} className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[7px] text-ok">
                    <PixelIcon item={k} size={12} />+{ITEMS[k]?.nombre ?? k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Exploration Minigame: Relic Frequency Lock */}
        <div className="mt-3 rounded-[8px] border-2 border-gold/40 bg-black/40 p-3 text-[8px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gold">✨ ANCIENT RELIC MINIGAME (SUPERPOWER)</span>
            <span className="text-[7px] text-white/70">{cave.relicDone ? "CALIBRATED" : `LOCKS: ${locks}/3`}</span>
          </div>
          <p className="mt-1 text-white/75">Stop the scanner inside the green zone 3 times to unlock a permanent Lunar Superpower.</p>
          <div className="relative mt-2 h-4 w-full overflow-hidden rounded bg-black/70 ring-1 ring-white/20">
            <div className="absolute inset-y-0 left-[34%] w-[32%] bg-ok/35" />
            <div className="absolute inset-y-0 w-1.5 -translate-x-1/2 bg-gold" style={{ left: `${cursor}%` }} />
          </div>
          <button type="button" disabled={cave.relicDone} onClick={onLock} className="tr-btn mt-2 w-full py-1.5 text-[8px] disabled:opacity-40">
            {cave.relicDone ? "✔ SUPERPOWER UNLOCKED" : "⚡ LOCK SIGNAL"}
          </button>
        </div>
      </div>
    </div>
  );
}
