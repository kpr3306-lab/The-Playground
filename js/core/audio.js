// One shared AudioContext. Created lazily inside a user gesture, so nothing ever autoplays.
import { settings } from './storage.js';

let ctx = null, master = null;
const buses = new Map(); // moduleId -> GainNode
const noiseCache = {};

function apply() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.get('muted') ? 0 : settings.get('volume'), t, 0.02);
  const ms = settings.get('moduleSound');
  for (const [id, g] of buses) g.gain.setTargetAtTime(ms[id] === false ? 0 : 1, t, 0.02);
}
settings.on(apply);

export const audio = {
  get ctx() { return ctx; },
  get supported() { return !!(window.AudioContext || window.webkitAudioContext); },
  ensure() {
    if (!this.supported) return null;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  },
  // Each experience routes through its own bus so the per-module sound toggle works.
  bus(id) {
    if (!this.ensure()) return null;
    let g = buses.get(id);
    if (!g) { g = ctx.createGain(); g.connect(master); buses.set(id, g); apply(); }
    return g;
  },
  closeBus(id) {
    const g = buses.get(id);
    if (g) { try { g.disconnect(); } catch {} buses.delete(id); }
  },
  noise(kind = 'white', seconds = 2) {
    const key = kind + seconds;
    if (noiseCache[key]) return noiseCache[key];
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown
    }
    return (noiseCache[key] = buf);
  },
  // Short one-shot tone. All SFX are tiny and pass through the module bus.
  tone(dest, { freq = 440, to, dur = 0.08, type = 'sine', vol = 0.2, attack = 0.003, when = 0 } = {}) {
    if (!ctx || !dest) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  },
  burst(dest, { dur = 0.06, vol = 0.2, type = 'bandpass', freq = 2000, q = 1, kind = 'white', when = 0, to } = {}) {
    if (!ctx || !dest) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise(kind);
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
};

// Resume a context that the browser suspended (tab switch, iOS interruptions) on the next gesture.
addEventListener('pointerdown', () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, { capture: true });
