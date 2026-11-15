/**
 * Walking and running. Running is faster but burns stamina (the ⚡ bar = 100 - fatigue).
 * When stamina runs out you are "winded" and can only walk until it recovers a bit,
 * so the astronaut doesn't flicker between running and walking at the limit.
 */
export const WALK_SPEED = 60; // px/s, same as before
export const RUN_MULT = 1.65;
export const RUN_FATIGUE_S = 1.6; // extra fatigue per second while running
export const WINDED_AT = 90; // fatigue at which you can't run any more…
export const RECOVER_AT = 75; // …until it drops back below this

export function runState(fatigue: number, wantsRun: boolean, winded: boolean) {
  const nowWinded = winded ? fatigue > RECOVER_AT : fatigue >= WINDED_AT;
  return { running: wantsRun && !nowWinded, winded: nowWinded };
}

/** Frame of the 8-frame walk/run cycle after `t` seconds of moving (12 fps walking, 16 fps running). */
export const STRIDE_FRAMES = 8;
export function strideFrame(t: number, running: boolean) {
  return Math.floor(t * (running ? 16 : 12)) % STRIDE_FRAMES;
}
