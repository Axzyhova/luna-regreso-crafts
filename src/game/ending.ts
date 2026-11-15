/**
 * The launch ending played inside the lunar scene after T-0: the commander walks to the rocket,
 * climbs the ladder, the hatch closes, the engines light and the Selene-7 lifts off.
 * A pure function of time, so the scene only has to apply it (and tests can check it).
 */
export interface Pt { x: number; y: number }
export type BoardPhase = "walk" | "climb" | "hatch" | "ignite" | "rise" | "done";

/** Seconds for each step after the walk (the walk depends on how far away you stand). */
export const BOARD_STEPS = { climb: 2.0, hatch: 1.4, ignite: 1.8, rise: 4.2 } as const;
export const WALK_PX_S = 60;

/** Fixed points on the rocket, relative to its position (ROCKET in world.ts). */
export const ladderBase = (r: Pt): Pt => ({ x: r.x, y: r.y + 22 });
export const hatchPos = (r: Pt): Pt => ({ x: r.x, y: r.y - 26 });

export interface BoardTimeline { from: Pt; rocket: Pt; walk: number; total: number }

export function boardingTimeline(from: Pt, rocket: Pt): BoardTimeline {
  const b = ladderBase(rocket);
  const walk = Math.min(4.5, Math.max(0.6, Math.hypot(b.x - from.x, b.y + 10 - from.y) / WALK_PX_S + 0.3));
  const total = walk + BOARD_STEPS.climb + BOARD_STEPS.hatch + BOARD_STEPS.ignite + BOARD_STEPS.rise;
  return { from, rocket, walk, total };
}

export interface BoardPose {
  phase: BoardPhase;
  /** Astronaut position and opacity (0 once inside the capsule). */
  px: number; py: number; alpha: number;
  /** 0 → 1 inside the current phase. */
  k: number;
  /** Hatch: 0 closed, 1 open. */
  hatch: number;
  /** How far the rocket has risen (world px, negative = up), engine power 0..1 and pad shake in px. */
  rocketDy: number; flame: number; shake: number;
  /** Camera fade to black at the very end, 0..1. */
  fade: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (k: number) => k * k * (3 - 2 * k);

export function boardingAt(t: number, tl: BoardTimeline): BoardPose {
  const { from, rocket, walk } = tl;
  const base = ladderBase(rocket), top = hatchPos(rocket);
  const front = { x: base.x, y: base.y + 10 }; // where you stop before stepping onto the ladder
  const t1 = walk, t2 = t1 + BOARD_STEPS.climb, t3 = t2 + BOARD_STEPS.hatch, t4 = t3 + BOARD_STEPS.ignite, t5 = t4 + BOARD_STEPS.rise;
  const pose: BoardPose = { phase: "walk", px: from.x, py: from.y, alpha: 1, k: 0, hatch: 0, rocketDy: 0, flame: 0, shake: 0, fade: 0 };
  if (t < t1) {
    const k = clamp01(t / walk);
    // walk to the front of the rocket, then the last steps onto the ladder
    const split = 0.85;
    if (k < split) { const q = ease(k / split); pose.px = from.x + (front.x - from.x) * q; pose.py = from.y + (front.y - from.y) * q; }
    else { const q = (k - split) / (1 - split); pose.px = front.x; pose.py = front.y + (base.y - front.y) * q; }
    pose.k = k; pose.hatch = clamp01((k - 0.6) / 0.4);
    return pose;
  }
  if (t < t2) {
    const k = clamp01((t - t1) / BOARD_STEPS.climb);
    return { ...pose, phase: "climb", k, px: base.x, py: base.y + (top.y - base.y) * k, hatch: 1 };
  }
  if (t < t3) {
    const k = clamp01((t - t2) / BOARD_STEPS.hatch);
    // step inside during the first half, then the hatch swings shut
    return { ...pose, phase: "hatch", k, px: top.x, py: top.y - 2 * clamp01(k * 2), alpha: 1 - clamp01(k * 2), hatch: 1 - clamp01((k - 0.5) * 2) };
  }
  if (t < t4) {
    const k = clamp01((t - t3) / BOARD_STEPS.ignite);
    return { ...pose, phase: "ignite", k, px: top.x, py: top.y, alpha: 0, flame: 0.25 + 0.75 * k, shake: 1.6 * k };
  }
  if (t < t5) {
    const k = clamp01((t - t4) / BOARD_STEPS.rise);
    const s = t - t4;
    return { ...pose, phase: "rise", k, px: top.x, py: top.y, alpha: 0, flame: 1, shake: 1.6 * (1 - k), rocketDy: -(s * s * 24 + s * 6), fade: clamp01((k - 0.75) / 0.25) };
  }
  const s = BOARD_STEPS.rise;
  return { ...pose, phase: "done", k: 1, px: top.x, py: top.y, alpha: 0, flame: 1, rocketDy: -(s * s * 24 + s * 6), fade: 1 };
}
