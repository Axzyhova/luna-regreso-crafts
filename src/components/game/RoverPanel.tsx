import { useGame, sim } from "@/game/store";
import { ROVER_MATS, ROVER_LOAD, roverSite, setRoverMat } from "@/game/sim";
import { ITEMS } from "@/game/items";
import { sfx } from "@/game/audio";
import { PixelIcon } from "./PixelIcon";

const PHASE = { idle: "Waiting", go: "Driving out", mine: "Mining", back: "Driving back" } as const;

/** Auto-Miner Rover panel (E on the rover): pick which material it fetches from anywhere on the map. */
export function RoverPanel() {
  const s = useGame((g) => g.snap);
  const publish = useGame((g) => g.publish);
  const setOverlay = useGame((g) => g.setOverlay);
  const m = s.modules.find((x) => x.uid === s.roverUid);
  if (!m) return null;
  const pick = (mat: string) => {
    const live = sim.modules.find((x) => x.uid === sim.roverUid);
    if (live && setRoverMat(sim, live, mat)) { sfx.ok(); publish(); }
  };
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-3 short:p-1">
      <div className="tr-panel max-h-full w-full max-w-lg overflow-auto p-3 short:p-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="tr-title text-[11px] text-gold">AUTO-MINER ROVER</h3>
          <button type="button" onClick={() => { sim.roverUid = null; setOverlay(null); }} className="tr-btn px-2 py-1 text-[9px]">✕</button>
        </div>
        <p className="mb-2 text-[9px] leading-4 text-white/85">
          It drives to the nearest place with the material, mines {ROVER_LOAD}, comes back and drops them in the storage chest. Day and night, on its own power.
        </p>
        <div className="mb-2 rounded bg-black/35 px-2 py-1.5 text-[9px] text-white">
          {PHASE[m.rst ?? "idle"]} · {m.note ?? "Ready"} · delivered so far: {m.tick ?? 0}
        </div>
        <div className="tr-text mb-1 text-[9px] text-white/90">Choose what to collect</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ROVER_MATS.map((mat) => {
            const site = roverSite(s, mat, { x: m.x, y: m.y });
            const on = (m.mat ?? "regolito") === mat;
            return (
              <button key={mat} type="button" disabled={!site} onClick={() => pick(mat)}
                className={`tr-btn flex items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40 ${on ? "!border-ok !bg-ok/35" : ""}`}>
                <PixelIcon item={mat} size={20} />
                <span className="min-w-0">
                  <span className="block text-[10px]">{ITEMS[mat]?.nombre ?? mat}{on ? " ✓" : ""}</span>
                  <span className="block truncate text-[7px] opacity-75">{site ? site.nombre : "Needs the bridge to the Hive"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
