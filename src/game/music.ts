/**
 * Procedural 8-bit ambient soundtrack (Web Audio, no files). Calm and quiet: soft triangle pads and bass,
 * a filtered square-wave arpeggio, and a rare bell melody, all through a gentle echo. A slow, warm
 * progression by day and a darker, sparser one at night. Settings (on/off, volume) are remembered.
 */
const KEY = "varados_music_v1";
type Mood = "day" | "night";

// Chords as semitone offsets from A2 (110 Hz). Each chord lasts 2 bars of 8 steps.
const PROG: Record<Mood, number[][]> = {
  day: [[0, 7, 12, 15, 19], [-4, 3, 7, 12, 16], [3, 10, 15, 19, 22], [-2, 5, 10, 14, 17]],   // Am9 · Fmaj7 · Cmaj7 · G6
  night: [[5, 12, 17, 20, 24], [1, 8, 13, 17, 20], [-4, 3, 8, 12, 15], [0, 7, 12, 15, 19]],  // Dm9 · Bbmaj7 · Fmaj7 · Am
};
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // A minor pentatonic for the bell
const hz = (semi: number) => 110 * 2 ** (semi / 12);

export const music = {
  on: true,
  volume: 0.5,             // 0..1 (user setting); the real loudness is kept very low
  mood: "day" as Mood,
  playing: false,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0, nextT = 0;
const STEP_S = 60 / 72 / 2; // eighth notes at 72 BPM

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (v) { music.on = !!v.on; music.volume = Math.min(1, Math.max(0, Number(v.volume) || 0)); } } catch { /* storage unavailable */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: music.on, volume: music.volume })); } catch { /* storage unavailable */ } }
const level = () => (music.on ? 0.09 * music.volume : 0);

function graph() {
  if (ctx || typeof window === "undefined" || !("AudioContext" in window)) return;
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = level();
  // soft tone + a little space: lowpass → output, plus a quiet feedback echo
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.Q.value = 0.3;
  const delay = ctx.createDelay(1); delay.delayTime.value = STEP_S * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  master.connect(lp); lp.connect(ctx.destination);
  lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) void ctx.suspend(); else if (music.playing) void ctx.resume(); });
}

/** One note with a soft envelope. */
function note(t: number, f: number, dur: number, type: OscillatorType, vol: number, attack = 0.02) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function schedule() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.35) {
    const night = music.mood === "night";
    const prog = PROG[music.mood];
    const chord = prog[Math.floor(step / 16) % prog.length]!;
    const s = step % 16, t = nextT;
    // pad: whole chord, slow swell, every 2 bars
    if (s === 0) for (const c of chord.slice(1, 4)) note(t, hz(c + 12), STEP_S * 16, "triangle", night ? 0.05 : 0.06, 1.2);
    // bass: root on beats 1 and 3 (sparser at night)
    if (s % 8 === 0 || (!night && s % 8 === 4 && Math.random() < 0.5)) note(t, hz(chord[0]!), STEP_S * 3.5, "triangle", 0.16, 0.03);
    // arpeggio: gentle, filtered square, with soft gaps so it never feels busy
    const pattern = night ? [0, -1, 2, -1, 1, -1, 3, -1] : [0, 2, 1, 3, 4, 3, 1, 2];
    const idx = pattern[s % 8]!;
    if (idx >= 0 && Math.random() < (night ? 0.55 : 0.75)) note(t, hz(chord[idx % chord.length]! + 24), STEP_S * 1.6, "square", night ? 0.022 : 0.028, 0.01);
    // bell: a rare, calm melody note
    if (s % 4 === 2 && Math.random() < (night ? 0.12 : 0.18)) note(t, hz(PENTA[Math.floor(Math.random() * PENTA.length)]! + 36), 1.8, "sine", 0.05, 0.005);
    step++; nextT += night ? STEP_S * 1.12 : STEP_S; // night is a touch slower
  }
}

/** Start the soundtrack (call from a user gesture or right after one). */
export function startMusic() {
  load(); graph();
  if (!ctx || !master) return;
  void ctx.resume();
  master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
  if (timer) return;
  music.playing = true; step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 100);
}
export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null; music.playing = false;
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}
export function setMusicOn(on: boolean) { music.on = on; save(); if (ctx && master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.3); if (on && !music.playing) startMusic(); }
export function setMusicVolume(v: number) { music.volume = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10; save(); if (ctx && master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.2); }
/** Day or night arrangement (the scene calls this as the cycle turns). */
export function setMusicMood(m: Mood) { music.mood = m; }
export function loadMusicSettings() { load(); return music; }
