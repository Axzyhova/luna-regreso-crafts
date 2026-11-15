/**
 * audio.js — all sound is synthesized with the Web Audio API. No audio files.
 *
 * Each mode has its own bed:
 *   Realistic → mission-control telemetry: a quiet hum and sparse data beeps on a major pentatonic scale
 *   Fantasy   → slow, wide "cosmic" chords
 *   Horror    → a low drone, filtered noise and a heartbeat that speeds up as sanity falls
 * plus short effects for actions and alarms. Browsers only allow audio after a user gesture,
 * so call `start()` from a click.
 */
import { getMode } from "./gameModes.js";

const semis = (hz, n) => hz * Math.pow(2, n / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.bed = null; this.muted = false; this.modeId = "realista";
    this.nextNote = 0; this.nextBeat = 0; this.alarmAt = 0; this.sanity = 100; this.tension = 0;
    try { this.muted = localStorage.getItem("colony_muted_v1") === "1"; } catch { /* storage unavailable */ }
  }
  get ready() { return !!this.ctx; }

  /** Create the audio graph. Safe to call many times; must first be called from a user gesture. */
  start() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this._makeBed();
    return true;
  }
  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem("colony_muted_v1", this.muted ? "1" : "0"); } catch { /* storage unavailable */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  setMode(modeId) {
    this.modeId = modeId;
    if (this.ctx) this._makeBed();
  }

  // ───────────── the continuous bed ─────────────
  _noiseBuffer(seconds = 2) {
    const n = Math.floor(this.ctx.sampleRate * seconds), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brownish noise
    return buf;
  }
  _makeBed() {
    const ctx = this.ctx, p = getMode(this.modeId).audio;
    if (this.bed) { const old = this.bed; old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1200); }
    const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.master);
    const nodes = [];
    const osc = (type, hz, vol, detune = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = hz; o.detune.value = detune; g.gain.value = vol; o.connect(g); g.connect(gain); o.start(); nodes.push(o); return { o, g }; };
    if (p.profile === "telemetry") { osc("sine", p.baseHz / 4, 0.1); osc("sine", p.baseHz / 2, 0.035, 4); }
    if (p.profile === "cosmic") { for (const n of [0, 7, 12, 15]) osc("sine", semis(p.baseHz / 2, n), 0.05, (n - 7) * 2); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.07; lg.gain.value = 0.25; l.connect(lg); lg.connect(gain.gain); l.start(); nodes.push(l); }
    if (p.profile === "dread") { osc("sawtooth", p.baseHz, 0.05); osc("sine", p.baseHz * 1.007, 0.12); osc("sine", semis(p.baseHz, 6), 0.03); }
    // air-handling noise, louder in horror
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = this._noiseBuffer(); src.loop = true; f.type = "lowpass"; f.frequency.value = p.profile === "dread" ? 260 : 500; ng.gain.value = p.noise * 4;
    src.connect(f); f.connect(ng); ng.connect(gain); src.start(); nodes.push(src);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    this.bed = { gain, nodes, noiseGain: ng };
  }

  // ───────────── building blocks ─────────────
  _tone(hz, dur, { type = "sine", vol = 0.2, attack = 0.005, slideTo = null, when = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(hz, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  _burst(dur, { vol = 0.2, hz = 1200, q = 1, when = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + when, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this._noise ?? (this._noise = this._noiseBuffer(1)); f.type = "bandpass"; f.frequency.value = hz; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // ───────────── effects ─────────────
  /** Play a named effect. Unknown names are ignored. */
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const horror = this.modeId === "terrorifico";
    switch (name) {
      case "click": this._tone(horror ? 320 : 880, 0.04, { type: "square", vol: 0.06 }); break;
      case "ok": this._tone(660, 0.09, { vol: 0.12 }); this._tone(990, 0.12, { vol: 0.12, when: 0.08 }); break;
      case "error": this._tone(180, 0.18, { type: "sawtooth", vol: 0.12, slideTo: 110 }); break;
      case "build": this._burst(0.12, { hz: 500, vol: 0.25 }); this._tone(220, 0.15, { type: "triangle", vol: 0.15, when: 0.05 }); this._tone(330, 0.2, { type: "triangle", vol: 0.12, when: 0.16 }); break;
      case "dig": this._burst(0.16, { hz: 300, vol: 0.4, q: 0.6 }); break;
      case "water": this._tone(900, 0.2, { vol: 0.1, slideTo: 1500 }); this._tone(1200, 0.18, { vol: 0.08, slideTo: 1900, when: 0.1 }); break;
      case "research": for (let i = 0; i < 4; i++) this._tone(semis(523, [0, 4, 7, 12][i]), 0.25, { vol: 0.1, when: i * 0.09 }); break;
      case "eds": this._tone(90, 0.5, { type: "sawtooth", vol: 0.2, slideTo: 2400 }); this._burst(0.5, { hz: 3000, vol: 0.2, q: 2 }); break;
      case "blackout": this._tone(400, 0.9, { type: "sawtooth", vol: 0.2, slideTo: 30 }); break;
      case "breach": this._burst(1.2, { hz: 2500, vol: 0.45, q: 0.4 }); this._tone(140, 0.6, { type: "square", vol: 0.12 }); break;
      case "alert": this._tone(horror ? 233 : 740, 0.14, { type: "square", vol: 0.1 }); this._tone(horror ? 220 : 740, 0.14, { type: "square", vol: 0.1, when: 0.2 }); break;
      case "mission": for (let i = 0; i < 3; i++) this._tone(semis(440, [0, 5, 9][i]), 0.3, { type: "triangle", vol: 0.12, when: i * 0.12 }); break;
      case "launch": this._burst(3, { hz: 180, vol: 0.6, q: 0.3 }); this._tone(60, 3, { type: "sawtooth", vol: 0.25, slideTo: 200 }); break;
      case "manual": this._tone(520, 0.08, { vol: 0.1 }); this._tone(780, 0.16, { vol: 0.1, when: 0.07 }); break;
      case "whisper": this._burst(1.6, { hz: 900 + Math.random() * 900, vol: 0.12, q: 6 }); break;
      default: break;
    }
  }

  /**
   * Call every frame with the simulation state: sparse generative notes, the horror heartbeat and
   * a repeating alarm while something is critically wrong.
   */
  update(state) {
    if (!this.ctx || this.muted || !state) return;
    const ctx = this.ctx, now = ctx.currentTime, p = getMode(this.modeId).audio;
    const critical = state.alerts.some((a) => a.level === "bad" && !a.fake);
    this.tension = critical ? 1 : 0;
    this.sanity = state.crew.sanity;
    if (now >= this.nextNote) {
      const beat = 60 / p.tempo;
      this.nextNote = now + beat * (p.profile === "telemetry" ? 2 + Math.floor(Math.random() * 6) : p.profile === "cosmic" ? 4 + Math.random() * 4 : 6 + Math.random() * 10);
      const n = p.scale[Math.floor(Math.random() * p.scale.length)];
      if (p.profile === "telemetry") this._tone(semis(p.baseHz * 4, n), 0.07, { type: "sine", vol: 0.035 });
      if (p.profile === "cosmic") { this._tone(semis(p.baseHz * 2, n), 3.5, { vol: 0.05, attack: 1.2 }); this._tone(semis(p.baseHz * 2, n + 7), 3.5, { vol: 0.03, attack: 1.6 }); }
      if (p.profile === "dread") { if (this.sanity < 70 && Math.random() < 0.6) this.sfx("whisper"); else this._tone(semis(p.baseHz * 2, n), 2.5, { type: "triangle", vol: 0.04, attack: 0.8 }); }
    }
    if (p.heartbeat && now >= this.nextBeat) {
      const bpm = 52 + (100 - this.sanity) * 0.9 + this.tension * 20; // faster as sanity falls
      this.nextBeat = now + 60 / bpm;
      this._tone(58, 0.12, { vol: 0.28, slideTo: 40 }); this._tone(52, 0.14, { vol: 0.2, slideTo: 36, when: 0.16 });
    }
    if (critical && now >= this.alarmAt) { this.alarmAt = now + 2.4; this.sfx("alert"); }
    if (this.bed) this.bed.noiseGain.gain.setTargetAtTime(p.noise * 4 * (1 + (100 - this.sanity) / 60), now, 0.5);
  }
}
