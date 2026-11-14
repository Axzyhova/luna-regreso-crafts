let ctx: AudioContext | null = null;
export function beep(freq = 440, dur = 0.08, type: OscillatorType = "square", vol = 0.05) {
  try {
    if (typeof window === "undefined") return;
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio unavailable */ }
}
export const sfx = {
  pick: () => beep(880, 0.05),
  ok: () => { beep(660, 0.07); setTimeout(() => beep(990, 0.1), 70); },
  alert: () => beep(220, 0.15, "sawtooth", 0.04),
  click: () => beep(520, 0.03),
  bad: () => beep(140, 0.25, "triangle", 0.08),
};
