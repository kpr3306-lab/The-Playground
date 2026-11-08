// Garage shared pieces: car definitions, synthesised engine sound, pixel-art sprites, drivetrain model.

export const CARS = [
  { id: 'pico', name: 'PICO K3', type: 'Kei city car · 3-cyl', colors: ['#ff9ac1', '#a9f0d4', '#fff3b0', '#e9e1d4'], cyl: 3, idle: 1100, red: 9000, ratios: [3.8, 2.3, 1.6, 1.2, 0.95], final: 4.6, torque: 7000, mass: 300, topKmh: 200, stats: { speed: 1, accel: 2, handling: 5 }, arcade: { lane: 16 }, tone: { drive: 1.6, sub: 0.15, harm: 0.75, noise: 0.2 } },
  { id: 'mote', name: 'MOTE', type: 'Compact hatch · 4-cyl', colors: ['#4fc3f7', '#ffd24d', '#ff7a63', '#e9e1d4'], cyl: 4, idle: 900, red: 7000, ratios: [3.6, 2.1, 1.45, 1.1, 0.88], final: 4.1, torque: 8200, mass: 380, topKmh: 200, stats: { speed: 2, accel: 3, handling: 5 }, arcade: { lane: 14 }, tone: { drive: 2.2, sub: 0.25, harm: 0.5, noise: 0.25 } },
  { id: 'kestrel', name: 'KESTREL R', type: 'Rally coupe · turbo 4', colors: ['#e9e1d4', '#5fd3a8', '#9c8cff', '#ff5d73'], cyl: 4, turbo: true, idle: 1000, red: 7800, ratios: [3.3, 2.2, 1.6, 1.25, 1.0], final: 4.4, torque: 9800, mass: 420, topKmh: 240, stats: { speed: 4, accel: 5, handling: 4 }, arcade: { lane: 12 }, tone: { drive: 3.5, sub: 0.35, harm: 0.6, noise: 0.4 } },
  { id: 'sabre', name: 'SABRE 6S', type: 'Sports car · flat-6', colors: ['#ffd24d', '#e9e1d4', '#2b3245', '#5fd3a8'], cyl: 6, idle: 950, red: 8800, ratios: [3.2, 2.2, 1.7, 1.35, 1.1, 0.9], final: 4.0, torque: 11000, mass: 400, topKmh: 280, stats: { speed: 5, accel: 5, handling: 5 }, arcade: { lane: 13 }, tone: { drive: 2.8, sub: 0.2, harm: 0.9, noise: 0.35, rasp: true } },
  { id: 'ironclad', name: 'IRONCLAD 68', type: 'Classic muscle · V8', colors: ['#ff5d73', '#2b3245', '#f2994a', '#5cb8ff'], cyl: 8, idle: 700, red: 6000, ratios: [2.8, 1.85, 1.35, 1.0], final: 3.6, torque: 10500, mass: 520, topKmh: 240, stats: { speed: 5, accel: 4, handling: 2 }, arcade: { lane: 9 }, tone: { drive: 5, sub: 0.7, harm: 0.35, noise: 0.35 } },
  { id: 'regent', name: 'REGENT V12', type: 'Grand tourer · V12', colors: ['#2b3245', '#9c8cff', '#e9e1d4', '#ff5d73'], cyl: 12, idle: 750, red: 7600, ratios: [3.0, 2.0, 1.5, 1.2, 1.0, 0.8], final: 3.4, torque: 12500, mass: 560, topKmh: 320, stats: { speed: 5, accel: 4, handling: 3 }, arcade: { lane: 10 }, tone: { drive: 1.4, sub: 0.15, harm: 1, noise: 0.2 } },
  { id: 'brick', name: 'BRICK HD', type: 'Pickup · diesel 6', colors: ['#7a8b6f', '#c4a484', '#5cb8ff', '#e9e1d4'], cyl: 6, diesel: true, idle: 650, red: 4300, ratios: [4.2, 2.5, 1.6, 1.15, 0.85], final: 3.9, torque: 9000, mass: 650, topKmh: 180, stats: { speed: 2, accel: 2, handling: 1 }, arcade: { lane: 8 }, tone: { drive: 2, sub: 0.5, harm: 0.25, noise: 0.6, clatter: 0.5 } },
];
export const WHEEL_CIRC = 2.0; // metres per wheel revolution

// Arcade top speed (px/s) is derived from the gearing, so the auto-box never runs past the redline in top gear.
export const arcadeMax = c => Math.min(420, (c.red * 0.95 / (60 * c.ratios.at(-1) * c.final)) * WHEEL_CIRC * 3.6 / 0.6);
// Automatic gearbox for Arcade Drive: picks a gear from road speed and returns the RPM that implies.
export function autoBox(c, kmh, gear) {
  const rpmAt = g => kmh / 3.6 / WHEEL_CIRC * 60 * c.ratios[g - 1] * c.final;
  while (gear < c.ratios.length && rpmAt(gear) > c.red * 0.9) gear++;
  while (gear > 1 && rpmAt(gear - 1) < c.red * 0.78) gear--;
  // Below ~idle the clutch slips and holds revs up; above the redline the rev limiter caps them.
  return { gear, rpm: Math.min(c.red, Math.max(c.idle * 1.15, rpmAt(gear))) };
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
  return `rgb(${c})`;
}

// ---------- Engine sound: layered oscillators + combustion noise, shaped by RPM and throttle ----------
export class EngineSound {
  constructor(audio, dest, car) {
    const ac = audio.ctx; this.ac = ac; this.audio = audio; this.car = car; this.dest = dest;
    const t = car.tone;
    this.out = ac.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 2;
    const shaper = ac.createWaveShaper(); const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * t.drive) / Math.tanh(t.drive); }
    shaper.curve = curve;
    this.mix = ac.createGain(); this.mix.gain.value = 0.3;
    this.mix.connect(shaper).connect(this.lp).connect(this.out);
    const osc = (type, g) => { const o = ac.createOscillator(); o.type = type; const gg = ac.createGain(); gg.gain.value = g; o.connect(gg).connect(this.mix); o.start(); return { o, g: gg }; };
    this.f1 = osc('sawtooth', 0.5); this.f2 = osc('square', t.sub); this.f3 = osc('sawtooth', t.harm);
    // V8 lope / 4-cyl buzz: slow amplitude wobble on the sub layer.
    this.lfo = ac.createOscillator(); this.lfoG = ac.createGain(); this.lfoG.gain.value = car.cyl === 8 ? 0.35 : 0.08;
    this.lfo.connect(this.lfoG).connect(this.f2.g.gain); this.lfo.start();
    const n = ac.createBufferSource(); n.buffer = audio.noise('white', 2); n.loop = true;
    this.nf = ac.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.Q.value = 1.2;
    this.ng = ac.createGain(); this.ng.gain.value = 0; n.connect(this.nf).connect(this.ng).connect(this.mix); n.start(); this.noise = n;
    if (car.turbo) { this.tb = ac.createOscillator(); this.tb.type = 'sine'; this.tbg = ac.createGain(); this.tbg.gain.value = 0; this.tb.connect(this.tbg).connect(this.out); this.tb.start(); }
    if (t.rasp) this.lp.Q.value = 7; // resonant, raspy flat-six
    if (t.clatter) { // diesel knock: combustion noise chopped at the firing rate
      this.clat = ac.createOscillator(); this.clat.type = 'square';
      const cg = ac.createGain(); cg.gain.value = t.clatter; this.clat.connect(cg).connect(this.ng.gain); this.clat.start();
    }
    this.vol = 0.5; this.boost = 0;
  }
  set(rpm, throttle, running) {
    const t = this.ac.currentTime, k = 0.025, car = this.car;
    const f = Math.max(8, rpm / 60 * car.cyl / 2);
    this.f1.o.frequency.setTargetAtTime(f, t, k);
    this.f2.o.frequency.setTargetAtTime(f / 2, t, k);
    this.f3.o.frequency.setTargetAtTime(f * 2.01, t, k);
    this.lfo.frequency.setTargetAtTime(f / 4, t, k);
    this.nf.frequency.setTargetAtTime(car.diesel ? 2400 + f * 4 : f * 3, t, k);
    this.clat?.frequency.setTargetAtTime(f, t, k);
    this.ng.gain.setTargetAtTime(car.tone.noise * (0.15 + throttle * 0.85), t, k);
    this.lp.frequency.setTargetAtTime(350 + rpm * 0.25 + throttle * 2600, t, k);
    const loud = running ? 0.22 + throttle * 0.45 + rpm / car.red * 0.2 : (rpm > 50 ? 0.12 * rpm / car.idle : 0);
    this.out.gain.setTargetAtTime(loud * this.vol, t, 0.04);
    if (this.tb) {
      const target = running && rpm > 2800 ? throttle * Math.min(1, (rpm - 2800) / 3000) : 0;
      if (this.boost > 0.5 && target < 0.1) this.blowoff();
      this.boost += (target - this.boost) * 0.08;
      this.tb.frequency.setTargetAtTime(2500 + rpm * 0.6, t, 0.1);
      this.tbg.gain.setTargetAtTime(this.boost * 0.05 * this.vol, t, 0.1);
    }
  }
  starter() { const a = this.audio; a.tone(this.dest, { freq: 150, to: 240, dur: 0.75, type: 'square', vol: 0.08 }); for (let i = 0; i < 7; i++) a.burst(this.dest, { when: i * 0.1, dur: 0.06, vol: 0.15, type: 'lowpass', freq: 500, kind: 'brown' }); }
  shift() { this.audio.burst(this.dest, { dur: 0.08, vol: 0.3, type: 'lowpass', freq: 600, kind: 'brown' }); this.audio.tone(this.dest, { freq: 900, dur: 0.03, type: 'square', vol: 0.05, when: 0.02 }); }
  clutch() { this.audio.burst(this.dest, { dur: 0.05, vol: 0.12, type: 'lowpass', freq: 300, kind: 'brown' }); }
  grind() { for (let i = 0; i < 6; i++) this.audio.burst(this.dest, { when: i * 0.035, dur: 0.03, vol: 0.18, type: 'bandpass', freq: 2600 + Math.random() * 800, q: 3 }); }
  blowoff() { this.audio.burst(this.dest, { dur: 0.35, vol: 0.18, type: 'highpass', freq: 3000, to: 900 }); }
  pop() { this.audio.burst(this.dest, { dur: 0.05, vol: 0.25, type: 'lowpass', freq: 900, kind: 'brown' }); }
  destroy() {
    const t = this.ac.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { for (const n of [this.f1.o, this.f2.o, this.f3.o, this.lfo, this.noise, this.tb, this.clat]) try { n?.stop(); } catch {} try { this.out.disconnect(); } catch {} }, 250);
  }
}

// ---------- Simplified manual drivetrain ----------
// Two inertias (engine, car) coupled by a friction clutch. Not a vehicle-dynamics model.
export function makeDrive(car) {
  return { car, running: false, cranking: 0, rpm: 0, v: 0, gear: 0, clutch: 0, clutchIn: 0, throttle: 0, thrIn: 0, brake: 0, msg: '', status: 'Off', dist: 0, limiter: 0 };
}
const curve = (rpm, red) => { const x = rpm / red; return Math.max(0.35, 1 - (x - 0.6) ** 2 * 1.6); };
export function gearRatio(car, gear) { return gear === -1 ? -3.2 * car.final : gear === 0 ? 0 : car.ratios[gear - 1] * car.final; }
export function wheelRpm(d) { const R = gearRatio(d.car, d.gear); return d.v / WHEEL_CIRC * 60 * R; }

export function stepDrive(d, dt, events) {
  const car = d.car;
  d.clutch += (d.clutchIn - d.clutch) * Math.min(1, dt * (d.clutchIn > d.clutch ? 14 : 2.2)); // releasing is slower: lets you feather it
  d.throttle += (d.thrIn - d.throttle) * Math.min(1, dt * 10);
  if (d.cranking > 0) {
    d.cranking -= dt; d.rpm = 220 + Math.sin(d.cranking * 60) * 60;
    if (d.cranking <= 0) { d.running = true; d.rpm = car.idle * 1.3; d.status = 'Idle'; events.push('started'); }
  }
  let thr = d.running ? d.throttle : 0;
  if (d.running && d.rpm < car.idle) thr = Math.max(thr, Math.min(0.35, (car.idle - d.rpm) / 400)); // idle governor
  if (d.rpm > car.red + 150) { thr = 0; d.limiter = 0.25; }
  if (d.limiter > 0) { d.limiter -= dt; thr = Math.min(thr, 0.2); }
  let rpmDot = d.running ? thr * car.torque * curve(d.rpm, car.red) : 0;
  rpmDot -= d.rpm * 0.35 + (d.rpm > 1 ? 300 : 0);
  if (d.cranking > 0) rpmDot = 0;
  // Clutch coupling
  const R = gearRatio(car, d.gear);
  let vDot = -(0.15 + 0.0011 * d.v * d.v) * Math.sign(d.v) - d.brake * 9 * Math.sign(d.v);
  if (R !== 0) {
    const engage = Math.min(1, Math.max(0, (1 - d.clutch - 0.25) / 0.5)); // bite point
    const rw = wheelRpm(d);
    // Friction clutch: locks when it can, otherwise slips at a capacity proportional to engagement.
    let cap = engage * car.torque * 1.3;
    // Launch assist (playability): with throttle applied the clutch slips near idle instead of stalling.
    if (d.running && d.throttle > 0.1) cap *= Math.min(1, Math.max(0.05, (d.rpm - 450) / (car.idle * 1.4 - 450)));
    const dif = d.rpm - rw, T = Math.sign(dif) * Math.min(Math.abs(dif) * 160, cap);
    const Iv = car.mass / (R * R);
    rpmDot -= T;
    vDot += (T / Iv) * WHEEL_CIRC / (60 * R);
    if (d.running && engage > 0.6 && d.rpm < 380) { d.running = false; d.status = 'Stalled'; d.msg = 'Stalled! Press the clutch, then restart with Ignition.'; events.push('stall'); }
  }
  const dv = vDot * dt;
  if (R === 0 && Math.sign(d.v + dv) !== Math.sign(d.v) && d.v !== 0) d.v = 0; else d.v += dv; // brakes/drag never reverse the car
  if (Math.abs(d.v) < 0.02 && d.brake > 0) d.v = 0;
  d.rpm = Math.max(0, d.rpm + rpmDot * dt);
  d.dist += d.v * dt;
  if (d.running) d.status = d.rpm > car.red ? 'Redline' : thr > 0.15 ? 'Running' : 'Idle';
  else if (d.cranking <= 0 && d.status !== 'Stalled') d.status = 'Off';
}

export function tryStart(d) {
  if (d.running || d.cranking > 0) return 'Engine is already running.';
  if (d.gear !== 0 && d.clutchIn < 0.7) return 'Press the clutch or select N before starting.';
  d.cranking = 0.75; d.status = 'Cranking'; d.msg = '';
  return null;
}
export function tryShift(d, g) {
  const car = d.car, max = car.ratios.length;
  if (g < -1 || g > max || g === d.gear) return { ok: false };
  if (d.clutchIn < 0.7 && d.clutch < 0.7) return { ok: false, grind: true, msg: 'Press the clutch (Space) to change gear.' };
  if (g === -1 && d.v > 0.8) return { ok: false, msg: 'Stop the car before selecting reverse.' };
  if (d.gear === -1 && g > 0 && d.v < -0.8) return { ok: false, msg: 'Stop the car before leaving reverse.' };
  d.gear = g;
  return { ok: true };
}

// ---------- Pixel sprites ----------
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

const TOP = { pico: [14, 20, 5], mote: [16, 24, 6], kestrel: [16, 28, 8], sabre: [16, 26, 9], ironclad: [18, 30, 10], regent: [18, 32, 11], brick: [18, 32, 5] }; // width, length, windscreen row
export function topCar(ctx, cx, cy, car, color, phase = 0, braking = false) {
  const [W, H, ws] = TOP[car.id] || TOP.mote;
  const x = Math.round(cx - W / 2), y = Math.round(cy - H / 2);
  const tread = Math.floor(phase) % 3;
  for (const [wx, wy] of [[x - 1, y + 4], [x + W - 2, y + 4], [x - 1, y + H - 10], [x + W - 2, y + H - 10]]) {
    px(ctx, '#0b0b0e', wx, wy, 3, 6);
    for (let r = tread; r < 6; r += 3) px(ctx, '#3a3a44', wx, wy + r, 3, 1);
  }
  px(ctx, 'rgba(0,0,0,.35)', x + 1, y + 2, W, H);
  px(ctx, color, x + 2, y, W - 4, 1); px(ctx, color, x + 1, y + 1, W - 2, H - 2); px(ctx, color, x + 2, y + H - 1, W - 4, 1);
  px(ctx, shade(color, 0.72), x + W - 3, y + 2, 2, H - 4);
  px(ctx, shade(color, 1.25), x + 1, y + 2, 1, H - 4);
  px(ctx, '#1b2333', x + 3, y + ws, W - 6, 5); px(ctx, '#3d4d6a', x + 4, y + ws, W - 10, 1);
  px(ctx, shade(color, 1.1), x + 3, y + ws + 5, W - 6, H - ws - 11);
  px(ctx, '#1b2333', x + 3, y + H - 6, W - 6, 3);
  if (car.id === 'kestrel') { px(ctx, '#fff', x + W / 2 - 1, y, 2, ws); px(ctx, shade(color, 0.5), x, y + H - 3, W, 2); px(ctx, '#222', x + W / 2 - 2, y + ws - 3, 4, 2); }
  if (car.id === 'ironclad') { px(ctx, '#f4efe6', x + W / 2 - 3, y, 2, H); px(ctx, '#f4efe6', x + W / 2 + 1, y, 2, H); px(ctx, '#c0c0c0', x + 1, y, W - 2, 1); }
  if (car.id === 'brick') { px(ctx, shade(color, 0.55), x + 3, y + ws + 9, W - 6, H - ws - 11); for (let k = y + ws + 11; k < y + H - 2; k += 3) px(ctx, shade(color, 0.75), x + 3, k, W - 6, 1); px(ctx, '#c0c0c0', x + 1, y, W - 2, 1); }
  if (car.id === 'regent') { px(ctx, '#d8d8e2', x + W / 2, y + 1, 1, ws - 1); px(ctx, shade(color, 0.6), x + 3, y + 3, 2, 4); px(ctx, shade(color, 0.6), x + W - 5, y + 3, 2, 4); }
  if (car.id === 'sabre') { for (let k = 0; k < 3; k++) px(ctx, '#222', x + 4, y + H - 10 + k * 2, W - 8, 1); }
  if (car.id === 'pico') px(ctx, '#fff', x + 3, y + ws + 6, W - 6, 1);
  px(ctx, '#fff3b0', x + 2, y, 3, 1); px(ctx, '#fff3b0', x + W - 5, y, 3, 1);
  const tl = braking ? '#ff3b3b' : '#9a1c1c';
  px(ctx, tl, x + 2, y + H - 1, 3, 1); px(ctx, tl, x + W - 5, y + H - 1, 3, 1);
}

function wheel(ctx, cx, cy, r, ang) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d > r + 0.3) continue;
    px(ctx, d > r * 0.62 ? '#101014' : d > r * 0.5 ? '#6b6b78' : '#b8b8c4', cx + x, cy + y);
  }
  for (let k = 0; k < 3; k++) {
    const a = ang + k * 2.094;
    for (let s = 1; s < r * 0.6; s++) px(ctx, '#4a4a55', Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s));
  }
  px(ctx, '#222', cx, cy);
}
// Side view, ~60x22 px, origin at the ground under the car's centre.
export function sideCar(ctx, gx, gy, car, color, wheelAng = 0, bob = 0) {
  const x = Math.round(gx - 30), y = Math.round(gy - 22 + bob);
  const dark = shade(color, 0.7), light = shade(color, 1.3), glass = '#1d2638', glassHi = '#4a5f85';
  if (car.id === 'mote') {
    px(ctx, color, x + 4, y + 10, 52, 7); px(ctx, color, x + 6, y + 9, 48, 1);
    for (let r = 0; r < 6; r++) px(ctx, color, x + 14 + Math.max(0, 5 - r), y + 3 + r, 30 - Math.max(0, 5 - r) + (r > 3 ? 2 : 0), 1);
    px(ctx, glass, x + 20, y + 4, 10, 5); px(ctx, glass, x + 32, y + 4, 9, 5); px(ctx, glassHi, x + 21, y + 4, 4, 1);
    px(ctx, dark, x + 4, y + 15, 52, 2); px(ctx, light, x + 6, y + 10, 46, 1);
    px(ctx, '#fff3b0', x + 54, y + 11, 2, 2); px(ctx, '#b02020', x + 4, y + 11, 2, 2);
  } else if (car.id === 'kestrel') {
    px(ctx, color, x + 2, y + 11, 56, 6); px(ctx, color, x + 4, y + 10, 52, 1);
    for (let r = 0; r < 6; r++) px(ctx, color, x + 16 + Math.max(0, 6 - r) * 1.5, y + 4 + r, 22 - Math.max(0, 6 - r) * 1.5 + r, 1);
    px(ctx, glass, x + 24, y + 5, 8, 4); px(ctx, glass, x + 33, y + 5, 7, 4); px(ctx, glassHi, x + 25, y + 5, 3, 1);
    px(ctx, dark, x + 1, y + 6, 9, 2); px(ctx, dark, x + 4, y + 8, 2, 3);
    px(ctx, '#ff5d73', x + 2, y + 13, 56, 1); px(ctx, '#1d1d24', x + 18, y + 12, 5, 4); px(ctx, '#fff', x + 19, y + 13, 3, 2);
    px(ctx, dark, x + 2, y + 15, 56, 2);
    px(ctx, '#fff3b0', x + 56, y + 11, 2, 2); px(ctx, '#b02020', x + 2, y + 11, 2, 2);
  } else if (car.id === 'pico') {
    px(ctx, color, x + 8, y + 9, 44, 8);
    for (let r = 0; r < 8; r++) px(ctx, color, x + 10, y + 1 + r, 32 + Math.min(4, r), 1);
    px(ctx, glass, x + 12, y + 2, 10, 6); px(ctx, glass, x + 24, y + 2, 9, 6); px(ctx, glass, x + 35, y + 3, 6, 5); px(ctx, glassHi, x + 13, y + 2, 4, 1);
    px(ctx, light, x + 8, y + 12, 44, 1); px(ctx, dark, x + 8, y + 15, 44, 2);
    px(ctx, '#fff3b0', x + 50, y + 10, 2, 2); px(ctx, '#b02020', x + 8, y + 10, 2, 2);
  } else if (car.id === 'sabre') {
    px(ctx, color, x + 2, y + 12, 56, 5); px(ctx, color, x + 4, y + 11, 52, 1);
    for (let r = 0; r < 6; r++) px(ctx, color, x + 18 + (5 - r), y + 6 + r, 18 + r * 3, 1);
    px(ctx, glass, x + 24, y + 7, 7, 3); px(ctx, glass, x + 32, y + 7, 7, 3); px(ctx, glassHi, x + 25, y + 7, 3, 1);
    px(ctx, '#1d1d24', x + 15, y + 13, 5, 2); px(ctx, dark, x + 1, y + 10, 7, 1); px(ctx, dark, x + 2, y + 15, 56, 2);
    px(ctx, '#fff3b0', x + 56, y + 12, 2, 2); px(ctx, '#b02020', x + 2, y + 12, 2, 2);
  } else if (car.id === 'brick') {
    px(ctx, color, x, y + 8, 60, 9);
    px(ctx, color, x + 30, y + 1, 18, 7); for (let r = 0; r < 5; r++) px(ctx, color, x + 48, y + 3 + r, 1 + r, 1);
    px(ctx, glass, x + 32, y + 2, 7, 5); px(ctx, glass, x + 41, y + 2, 6, 5); px(ctx, glassHi, x + 33, y + 2, 3, 1);
    px(ctx, light, x + 1, y + 8, 28, 1); px(ctx, dark, x + 28, y + 8, 2, 7); px(ctx, dark, x, y + 15, 60, 2);
    px(ctx, '#c9c9d4', x + 58, y + 12, 3, 5); px(ctx, '#c9c9d4', x - 1, y + 14, 3, 3);
    px(ctx, '#fff3b0', x + 57, y + 9, 2, 2); px(ctx, '#b02020', x, y + 9, 2, 3);
  } else if (car.id === 'regent') {
    px(ctx, color, x - 2, y + 11, 64, 6); px(ctx, color, x, y + 10, 60, 1);
    for (let r = 0; r < 5; r++) px(ctx, color, x + 12 + (4 - r) * 3, y + 5 + r, 14 + r * 4, 1);
    px(ctx, glass, x + 25, y + 6, 6, 3); px(ctx, glass, x + 32, y + 6, 6, 3); px(ctx, glassHi, x + 26, y + 6, 3, 1);
    px(ctx, '#d8d8e2', x + 2, y + 13, 56, 1); px(ctx, '#222', x + 46, y + 12, 5, 1); px(ctx, dark, x - 2, y + 15, 64, 2);
    px(ctx, '#fff3b0', x + 59, y + 12, 2, 2); px(ctx, '#b02020', x - 2, y + 12, 2, 2);
  } else {
    px(ctx, color, x, y + 10, 60, 7); px(ctx, color, x + 2, y + 9, 54, 1);
    for (let r = 0; r < 5; r++) px(ctx, color, x + 18 + Math.max(0, 4 - r) * 2, y + 4 + r, 20 - Math.max(0, 4 - r) * 2 + r * 2, 1);
    px(ctx, glass, x + 24, y + 5, 8, 4); px(ctx, glass, x + 34, y + 5, 6, 4); px(ctx, glassHi, x + 25, y + 5, 3, 1);
    px(ctx, '#f4efe6', x, y + 12, 60, 1); px(ctx, '#f4efe6', x, y + 14, 60, 1);
    px(ctx, '#c9c9d4', x - 1, y + 15, 3, 2); px(ctx, '#c9c9d4', x + 58, y + 15, 3, 2);
    px(ctx, dark, x + 2, y + 15, 56, 2); px(ctx, '#222', x + 44, y + 8, 6, 2);
    px(ctx, '#fff3b0', x + 58, y + 11, 2, 2); px(ctx, '#b02020', x, y + 11, 2, 2);
  }
  const [a, b, r] = { pico: [16, 44, 4], mote: [14, 45, 5], kestrel: [13, 46, 5], sabre: [14, 46, 5], ironclad: [12, 47, 6], regent: [11, 48, 5], brick: [12, 47, 6] }[car.id];
  px(ctx, '#0a0a0c', x + a - r - 1, y + 13, r * 2 + 3, 4); px(ctx, '#0a0a0c', x + b - r - 1, y + 13, r * 2 + 3, 4);
  wheel(ctx, x + a, Math.round(gy - r), r, wheelAng);
  wheel(ctx, x + b, Math.round(gy - r), r, wheelAng);
}
