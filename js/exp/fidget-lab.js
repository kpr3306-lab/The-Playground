import { clamp } from '../core/ui.js';

const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

const SHELF = [
  ['classic', 'Classic spinner'], ['tri', 'Tri-blade'], ['gear', 'Gear spinner'], ['clicker', 'Clicker'], ['toggles', 'Toggles'],
  ['sliders', 'Sliders'], ['dial', 'Rotary dial'], ['pop', 'Pop buttons'], ['bead', 'Rolling beads'], ['ratchet', 'Ratchet'],
];

export function mount(root, api) {
  root.innerHTML = `<div class="fl">
    <nav class="fl-shelf" aria-label="Fidget objects">${SHELF.map(([k, l]) => `<button class="tool" data-k="${k}">${glyph(k)}<span>${l}</span></button>`).join('')}</nav>
    <div class="fl-stage" id="stage"></div>
  </div>
  <style>
    .fl { flex: 1; display: grid; grid-template-columns: 220px 1fr; min-height: 0; }
    .fl-shelf { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 14px; align-content: start; border-right: 1px solid var(--line); background: var(--bg-2); overflow-y: auto; }
    .fl-shelf svg { width: 30px; height: 30px; }
    .fl-stage { position: relative; display: grid; place-items: center; min-height: min(480px, 80dvh); padding: 20px; background: radial-gradient(800px 500px at 50% 40%, #1d1a16, #0e0d0b); overflow: hidden; }
    .fl-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
    .fl-info { position: absolute; left: 16px; right: 16px; bottom: 14px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; pointer-events: none; }
    .fl-info > * { pointer-events: auto; }
    .fl-click { width: 200px; height: 200px; border-radius: 50%; border: 0; cursor: pointer; background: radial-gradient(circle at 50% 35%, #ffb35c, var(--accent) 50%, #b06a10); box-shadow: 0 14px 0 #6b3d05, 0 24px 40px rgba(0,0,0,.6), inset 0 4px 0 rgba(255,255,255,.3); transition: transform 50ms, box-shadow 50ms; font: 800 44px var(--f-mono); color: var(--accent-ink); touch-action: manipulation; }
    .fl-click.down { transform: translateY(12px); box-shadow: 0 2px 0 #6b3d05, 0 8px 16px rgba(0,0,0,.6), inset 0 4px 0 rgba(255,255,255,.2); }
    .fl-toggles { display: grid; grid-template-columns: repeat(3, 96px); gap: 22px; }
    .fl-rocker { width: 96px; height: 140px; border-radius: 16px; border: 0; cursor: pointer; background: #15130f; padding: 10px; box-shadow: inset 0 2px 6px #000, 0 1px 0 rgba(255,255,255,.06); }
    .fl-rocker i { display: block; height: 100%; border-radius: 10px; background: linear-gradient(#3a342c 0 50%, #26221d 50%); transform: perspective(300px) rotateX(16deg); transition: transform 90ms cubic-bezier(.3,1.6,.6,1); position: relative; box-shadow: 0 6px 10px rgba(0,0,0,.5); }
    .fl-rocker i::after { content: ""; position: absolute; left: 50%; top: 18%; width: 22px; height: 6px; margin-left: -11px; border-radius: 3px; background: #4a443a; transition: background 120ms, box-shadow 120ms; }
    .fl-rocker[aria-pressed="true"] i { transform: perspective(300px) rotateX(-16deg); background: linear-gradient(#26221d 0 50%, #3a342c 50%); }
    .fl-rocker[aria-pressed="true"] i::after { top: auto; bottom: 18%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }
    .fl-faders { display: flex; gap: 60px; }
    .fl-fader { display: grid; justify-items: center; gap: 12px; }
    .fl-track { position: relative; width: 56px; height: 300px; border-radius: 12px; background: #12100d; box-shadow: inset 0 2px 8px #000; touch-action: none; cursor: grab; }
    .fl-track::before { content: ""; position: absolute; left: 50%; top: 16px; bottom: 16px; width: 4px; margin-left: -2px; background: #000; border-radius: 2px; }
    .fl-track .notch { position: absolute; left: 6px; right: 6px; height: 2px; background: #2e2923; }
    .fl-cap { position: absolute; left: 4px; right: 4px; height: 40px; border-radius: 8px; background: linear-gradient(#5b5246, #3a342c 45%, #2a2621 55%, #463f35); box-shadow: 0 6px 12px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.2); }
    .fl-cap::after { content: ""; position: absolute; left: 8px; right: 8px; top: 50%; height: 3px; margin-top: -1.5px; background: var(--accent); border-radius: 2px; }
    .fl-pop { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 22px; border-radius: 34px; width: min(440px, 92vw); background: var(--bc, #5fd3a8); box-shadow: inset 0 -6px 0 rgba(0,0,0,.2), 0 20px 40px rgba(0,0,0,.5); transition: background 400ms; }
    .fl-bub { aspect-ratio: 1; border-radius: 50%; border: 0; cursor: pointer; background: radial-gradient(circle at 40% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 45%), var(--bc, #5fd3a8); box-shadow: 0 5px 0 rgba(0,0,0,.25), inset 0 -4px 6px rgba(0,0,0,.18); transition: transform 90ms, box-shadow 90ms; touch-action: manipulation; }
    .fl-bub.popped { transform: scale(.9); box-shadow: inset 0 5px 8px rgba(0,0,0,.35), 0 0 0 rgba(0,0,0,0); background: radial-gradient(circle at 60% 70%, rgba(255,255,255,.25), rgba(255,255,255,0) 50%), var(--bc, #5fd3a8); }
    @media (max-width: 760px) {
      .fl { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
      .fl-shelf { display: flex; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      .fl-shelf .tool { flex: 0 0 92px; }
      .fl-toggles { grid-template-columns: repeat(3, 76px); gap: 14px; } .fl-rocker { width: 76px; height: 112px; }
      .fl-faders { gap: 30px; } .fl-track { height: 240px; }
    }
  </style>`;
  const stage = root.querySelector('#stage');
  let cur = null, curKey = null;
  const sfx = {
    tick: (f = 2400, v = 0.08) => api.audio.burst(api.bus(), { dur: 0.025, vol: v, freq: f, q: 4 }),
    click: (f = 1800, v = 0.16) => { api.audio.burst(api.bus(), { dur: 0.03, vol: v, freq: f, q: 3 }); api.audio.tone(api.bus(), { freq: f / 4, dur: 0.03, type: 'square', vol: v * 0.2 }); },
    thunk: (f = 140) => { api.audio.tone(api.bus(), { freq: f, to: f * 0.6, dur: 0.08, type: 'triangle', vol: 0.25 }); api.audio.burst(api.bus(), { dur: 0.04, vol: 0.12, freq: 900, q: 1 }); },
    pop: () => { api.audio.tone(api.bus(), { freq: 520 + Math.random() * 200, to: 160, dur: 0.07, type: 'sine', vol: 0.3 }); api.audio.burst(api.bus(), { dur: 0.03, vol: 0.12, freq: 3000, q: 1 }); },
  };

  // Each object gets its own listeners/loops/canvases so switching objects tears them down.
  function scoped() {
    const ac = new AbortController(), fns = [];
    const s = Object.create(api);
    s.signal = ac.signal;
    s.loop = fn => { const l = api.loop(fn); fns.push(l.stop); return l; };
    s.canvas = (c, o) => { const st = api.canvas(c, o); fns.push(st.destroy); return st; };
    s.dispose = () => { ac.abort(); fns.forEach(f => f()); };
    return s;
  }
  let scope = null;
  function select(k) {
    if (k === curKey || !OBJECTS[k]) return;
    cur?.destroy?.(); scope?.dispose();
    stage.innerHTML = '';
    curKey = k;
    root.querySelectorAll('.fl-shelf .tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
    api.save('last', k);
    scope = scoped();
    cur = OBJECTS[k](stage, scope, sfx);
  }
  root.querySelector('.fl-shelf').onclick = e => { const b = e.target.closest('.tool'); if (b) select(b.dataset.k); };
  select(OBJECTS[api.load('last', 'classic')] ? api.load('last', 'classic') : 'classic');
  return { reset() { const k = curKey; curKey = null; select(k); }, destroy() { cur?.destroy?.(); scope?.dispose(); } };
}

function glyph(k) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.8"';
  const g = {
    classic: `<circle cx="16" cy="16" r="4" ${s}/><circle cx="16" cy="6" r="4" ${s}/><circle cx="7.3" cy="21" r="4" ${s}/><circle cx="24.7" cy="21" r="4" ${s}/>`,
    tri: `<path d="M16 16 C10 10 12 3 18 3 C22 8 20 12 16 16 Z M16 16 C23 14 28 19 25 24 C19 25 17 21 16 16 Z M16 16 C13 23 6 25 4 19 C8 14 12 15 16 16Z" ${s}/>`,
    gear: `<circle cx="16" cy="16" r="8" ${s}/><circle cx="16" cy="16" r="3" ${s}/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M6.8 6.8l3.5 3.5M21.7 21.7l3.5 3.5M6.8 25.2l3.5-3.5M21.7 10.3l3.5-3.5" ${s}/>`,
    clicker: `<circle cx="16" cy="16" r="11" ${s}/><circle cx="16" cy="16" r="6" fill="currentColor"/>`,
    toggles: `<rect x="5" y="5" width="9" height="22" rx="3" ${s}/><rect x="18" y="5" width="9" height="22" rx="3" ${s}/><rect x="7" y="7" width="5" height="8" rx="1" fill="currentColor"/><rect x="20" y="17" width="5" height="8" rx="1" fill="currentColor"/>`,
    sliders: `<path d="M10 4v24M22 4v24" ${s}/><rect x="6" y="9" width="8" height="5" rx="1" fill="currentColor"/><rect x="18" y="18" width="8" height="5" rx="1" fill="currentColor"/>`,
    dial: `<circle cx="16" cy="16" r="10" ${s}/><path d="M16 16l5-6" ${s}/><path d="M16 2v2M30 16h-2M16 30v-2M2 16h2" ${s}/>`,
    pop: `<rect x="3" y="3" width="26" height="26" rx="8" ${s}/><circle cx="11" cy="11" r="3" fill="currentColor"/><circle cx="21" cy="11" r="3" ${s}/><circle cx="11" cy="21" r="3" ${s}/><circle cx="21" cy="21" r="3" fill="currentColor"/>`,
    bead: `<path d="M3 20 L29 12" ${s}/><circle cx="12" cy="17.3" r="3.5" fill="currentColor"/><circle cx="19" cy="15.2" r="3.5" ${s}/>`,
    ratchet: `<circle cx="16" cy="16" r="9" ${s}/><path d="M16 5l3 3M27 16l-3 3M16 27l-3-3M5 16l3-3" ${s}/><path d="M24 5l-5 6" ${s}/>`,
  };
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${g[k]}</svg>`;
}

function info(stage, html) { const d = document.createElement('div'); d.className = 'fl-info'; d.innerHTML = html; stage.append(d); return d; }

// ---------- Spinners ----------
function spinner(variant) {
  const P = { classic: { lobes: 3, k: 0.18, c: 0.25 }, tri: { lobes: 3, k: 0.3, c: 0.4 }, gear: { lobes: 14, k: 0.5, c: 0.7 } }[variant];
  return (stage, api, sfx) => {
    const cv = document.createElement('canvas'); stage.append(cv);
    const C = api.canvas(cv);
    const best = api.load('spin:' + variant, 0);
    const box = info(stage, `<span class="badge mono" id="rpm">0 RPM</span><span class="badge mono" id="sp">Spin 0.0s</span><span class="badge mono">Best ${best.toFixed(1)}s</span>`);
    let ang = 0, om = 0, drag = null, spinT = 0, spinning = false, bestV = best, lastTick = 0;
    const reduced = api.reducedMotion();
    const center = () => [C.w / 2, C.h / 2 - 20];
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      const [cx, cy] = center();
      drag = { a: Math.atan2(e.offsetY - cy, e.offsetX - cx), t: performance.now() };
      om *= 0.3; api.audio.ensure();
    }, { signal: api.signal });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const [cx, cy] = center();
      const a = Math.atan2(e.offsetY - cy, e.offsetX - cx), now = performance.now();
      const da = wrap(a - drag.a), dt = Math.max(0.008, (now - drag.t) / 1000);
      ang += da; om = om * 0.4 + (da / dt) * 0.6;
      drag = { a, t: now };
    }, { signal: api.signal });
    const up = () => {
      if (!drag) return; drag = null;
      om = clamp(om, -90, 90);
      if (Math.abs(om) > 3) { spinning = true; spinT = 0; api.haptics.pulse('click'); }
    };
    cv.addEventListener('pointerup', up, { signal: api.signal });
    cv.addEventListener('pointercancel', up, { signal: api.signal });
    // Keyboard flick
    cv.tabIndex = 0; cv.setAttribute('aria-label', 'Spinner. Press Space to flick.');
    cv.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); api.audio.ensure(); om += 25; spinning = true; spinT = 0; } }, { signal: api.signal });

    api.loop(dt => {
      if (!drag) {
        om -= Math.sign(om) * Math.min(Math.abs(om), (P.c + Math.abs(om) * P.k * 0.06) * dt * 3);
        ang += om * dt;
      }
      if (spinning) {
        spinT += dt;
        if (Math.abs(om) < 0.2) {
          spinning = false; om = 0;
          if (spinT > bestV) { bestV = spinT; api.save('spin:' + variant, bestV); api.toast(`New longest spin: ${bestV.toFixed(1)}s`); }
          box.lastElementChild.textContent = `Best ${bestV.toFixed(1)}s`;
        }
      }
      // Tick as lobes pass the top, only at slow speeds so it never becomes a drone.
      const rps = Math.abs(om) / TAU;
      const seg = Math.floor(ang / (TAU / P.lobes));
      if (seg !== lastTick) { lastTick = seg; if (rps < 4 && rps > 0.05) { sfx.tick(variant === 'gear' ? 3000 : 2000, variant === 'gear' ? 0.06 : 0.04); if (variant === 'gear') api.haptics.pulse('tick'); } }
      sound(rps);
      box.children[0].textContent = `${Math.round(rps * 60)} RPM`;
      box.children[1].textContent = `Spin ${spinT.toFixed(1)}s`;
      draw();
    });

    // Continuous spin sound: airflow whoosh + bearing rumble, both scaling with speed. Silent at rest.
    let snd = null;
    function sound(rps) {
      const ac = api.audio.ctx; if (!ac) return; // only after a gesture has created audio
      if (!snd) {
        const bus = api.bus();
        const loop = (kind, filterType, f) => {
          const s = ac.createBufferSource(); s.buffer = api.audio.noise(kind, 6); s.loop = true;
          const fl = ac.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = 0.9;
          const g = ac.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(bus); s.start(0, Math.random() * 5);
          return { s, fl, g };
        };
        const wind = loop('pink', 'bandpass', 400), bear = loop('white', 'highpass', 5200);
        const am = ac.createOscillator(); am.type = 'square'; const amg = ac.createGain(); amg.gain.value = 0;
        am.connect(amg).connect(bear.g.gain); am.start(); // balls passing the race chop the hiss into a rattle
        const hum = ac.createOscillator(); hum.type = 'triangle'; const hg = ac.createGain(); hg.gain.value = 0;
        hum.connect(hg).connect(bus); hum.start();
        snd = { wind, bear, am, amg, hum, hg, stop: () => [wind.s, bear.s, am, hum].forEach(n => { try { n.stop(); } catch {} }) };
      }
      const t = ac.currentTime, k = 0.08, s = Math.min(1, rps / 12);
      const air = { classic: 0.55, tri: 1, gear: 0.35 }[variant], grit = variant === 'gear' ? 1.4 : 1;
      snd.wind.g.gain.setTargetAtTime(s * s * 0.4 * air, t, k);
      snd.wind.fl.frequency.setTargetAtTime(280 + rps * 130, t, k);
      snd.bear.g.gain.setTargetAtTime(Math.min(0.05, rps * 0.006) * grit, t, k);
      snd.amg.gain.setTargetAtTime(Math.min(0.04, rps * 0.005) * grit, t, k);
      snd.am.frequency.setTargetAtTime(8 + rps * 7, t, k);
      snd.hum.frequency.setTargetAtTime(40 + rps * 28, t, k);
      snd.hg.gain.setTargetAtTime(Math.min(0.045, rps * 0.006), t, k);
    }

    function draw() {
      const { ctx, w, h } = C; if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const [cx, cy] = center();
      const R = Math.min(w, h) * 0.32;
      const ghosts = reduced ? 1 : Math.min(5, 1 + Math.floor(Math.abs(om) / 12));
      for (let g = ghosts - 1; g >= 0; g--) {
        ctx.save(); ctx.globalAlpha = g ? 0.18 / g : 1;
        ctx.translate(cx, cy); ctx.rotate(ang - g * om * 0.008);
        shape(ctx, R, !g);
        ctx.restore();
      }
    }
    function shape(ctx, R, full) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f0a63a';
      if (variant === 'classic') {
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 - Math.PI / 2, x = Math.cos(a) * R * 0.62, y = Math.sin(a) * R * 0.62;
          ctx.strokeStyle = accent; ctx.lineWidth = R * 0.52;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
        }
        for (let i = 0; i < 3; i++) {
          const a = i * TAU / 3 - Math.PI / 2, x = Math.cos(a) * R * 0.62, y = Math.sin(a) * R * 0.62;
          bearing(ctx, x, y, R * 0.2, full);
        }
        bearing(ctx, 0, 0, R * 0.22, full, true);
      } else if (variant === 'tri') {
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.rotate(i * TAU / 3);
          const gr = ctx.createLinearGradient(0, 0, R, -R);
          gr.addColorStop(0, '#d8d2c8'); gr.addColorStop(1, '#6e665a');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.moveTo(0, -R * 0.15);
          ctx.bezierCurveTo(R * 0.2, -R * 0.7, R * 0.6, -R * 1.05, R * 0.15, -R * 1.02);
          ctx.bezierCurveTo(-R * 0.25, -R, -R * 0.3, -R * 0.4, -R * 0.13, -R * 0.08);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(R * 0.12, -R * 0.85, R * 0.08, 0, TAU); ctx.fill();
          ctx.restore();
        }
        bearing(ctx, 0, 0, R * 0.24, full, true);
      } else {
        const n = 14, ro = R, ri = R * 0.84;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a0 = i * TAU / n, a1 = a0 + TAU / n * 0.25, a2 = a0 + TAU / n * 0.5, a3 = a0 + TAU / n * 0.75;
          ctx.lineTo(Math.cos(a0) * ri, Math.sin(a0) * ri); ctx.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
          ctx.lineTo(Math.cos(a2) * ro, Math.sin(a2) * ro); ctx.lineTo(Math.cos(a3) * ri, Math.sin(a3) * ri);
        }
        ctx.closePath();
        const gr = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
        gr.addColorStop(0, '#8b8173'); gr.addColorStop(1, '#4b443a');
        ctx.fillStyle = gr; ctx.fill();
        ctx.fillStyle = '#0e0d0b';
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.14, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, TAU); ctx.stroke();
        bearing(ctx, 0, 0, R * 0.22, full, true);
      }
    }
    function bearing(ctx, x, y, r, full, center) {
      ctx.fillStyle = '#1a1815'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (!full) return;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 0.85);
      g.addColorStop(0, '#f4efe6'); g.addColorStop(1, '#8a8174');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, TAU); ctx.fill();
      ctx.fillStyle = center ? '#2a2621' : '#3a342c'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
    }
    return { destroy: () => snd?.stop() };
  };
}

// ---------- Clicker ----------
function clicker(stage, api, sfx) {
  let total = api.load('clicks', 0), session = 0;
  stage.innerHTML = `<button class="fl-click" id="ck" aria-label="Clicker">0</button>`;
  const box = info(stage, `<span class="badge mono" id="tot">Lifetime ${total}</span>`);
  const b = stage.querySelector('#ck');
  const down = () => { if (b.classList.contains('down')) return; b.classList.add('down'); api.audio.ensure(); sfx.click(2200, 0.18); api.haptics.pulse('click'); };
  const up = () => {
    if (!b.classList.contains('down')) return;
    b.classList.remove('down'); sfx.click(1300, 0.1);
    session++; total++; b.textContent = session; box.firstElementChild.textContent = `Lifetime ${total}`;
    if (total % 10 === 0) api.save('clicks', total);
  };
  b.addEventListener('pointerdown', down, { signal: api.signal });
  b.addEventListener('pointerup', up, { signal: api.signal });
  b.addEventListener('pointerleave', () => b.classList.remove('down'), { signal: api.signal });
  b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down(); } }, { signal: api.signal });
  b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); }, { signal: api.signal });
  b.addEventListener('click', e => e.preventDefault(), { signal: api.signal });
  b.focus();
  return { destroy: () => api.save('clicks', total) };
}

// ---------- Toggles ----------
function toggles(stage, api, sfx) {
  stage.innerHTML = `<div class="fl-toggles">${Array.from({ length: 6 }, (_, i) => `<button class="fl-rocker" aria-pressed="false" aria-label="Switch ${i + 1}"><i></i></button>`).join('')}</div>`;
  stage.querySelectorAll('.fl-rocker').forEach((b, i) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    sfx.thunk(on ? 170 + i * 8 : 120 + i * 6); api.haptics.pulse('thud');
    const all = [...stage.querySelectorAll('.fl-rocker')].every(x => x.getAttribute('aria-pressed') === 'true');
    if (all) [523, 659, 784].forEach((f, k) => api.audio.tone(api.bus(), { freq: f, dur: 0.2, type: 'triangle', vol: 0.08, when: 0.1 + k * 0.08 }));
  }, { signal: api.signal }));
}

// ---------- Sliders ----------
function sliders(stage, api, sfx) {
  stage.innerHTML = `<div class="fl-faders">
    <div class="fl-fader"><div class="fl-track" data-mode="glide" role="slider" tabindex="0" aria-label="Glide fader" aria-valuemin="0" aria-valuemax="100"><div class="fl-cap"></div></div><span class="badge">Glide</span><span class="mono" data-out>50</span></div>
    <div class="fl-fader"><div class="fl-track" data-mode="notch" role="slider" tabindex="0" aria-label="Notched fader" aria-valuemin="0" aria-valuemax="10">${Array.from({ length: 11 }, (_, i) => `<span class="notch" style="top:${20 + i * 10 / 11 * 26.4}px"></span>`).join('')}<div class="fl-cap"></div></div><span class="badge">Notched</span><span class="mono" data-out>5</span></div>
  </div>`;
  stage.querySelectorAll('.fl-track').forEach(t => {
    const notch = t.dataset.mode === 'notch', cap = t.querySelector('.fl-cap'), out = t.parentElement.querySelector('[data-out]');
    let v = 0.5, last = 5, dragging = false;
    const notches = t.querySelectorAll('.notch');
    function place() {
      const H = t.clientHeight - 40;
      cap.style.top = (1 - v) * H + 'px';
      notches.forEach((nn, i) => nn.style.top = (i / 10) * H + 19 + 'px');
      const shown = notch ? Math.round(v * 10) : Math.round(v * 100);
      out.textContent = shown; t.setAttribute('aria-valuenow', shown);
    }
    function set(nv) {
      v = clamp(nv, 0, 1);
      if (notch) {
        const s = Math.round(v * 10);
        if (s !== last) { last = s; sfx.tick(2600, 0.1); api.haptics.pulse('tick'); }
        if (!dragging) v = s / 10;
      }
      place();
    }
    const fromY = e => { const r = t.getBoundingClientRect(); return 1 - (e.clientY - r.top - 20) / (r.height - 40); };
    t.addEventListener('pointerdown', e => { t.setPointerCapture(e.pointerId); dragging = true; api.audio.ensure(); set(fromY(e)); }, { signal: api.signal });
    t.addEventListener('pointermove', e => { if (dragging) set(fromY(e)); }, { signal: api.signal });
    t.addEventListener('pointerup', () => {
      dragging = false;
      if (notch) {
        // Snap to the nearest detent with a short eased glide.
        const target = Math.round(v * 10) / 10, from = v, t0 = performance.now();
        const step = () => { const k = Math.min(1, (performance.now() - t0) / 120); v = from + (target - from) * (1 - (1 - k) ** 3); place(); if (k < 1) requestAnimationFrame(step); };
        step();
      }
    }, { signal: api.signal });
    t.addEventListener('keydown', e => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); set(v + d * (notch ? 0.1 : 0.02)); }
    }, { signal: api.signal });
    new ResizeObserver(place).observe(t);
    place();
  });
}

// ---------- Rotary dial ----------
function dial(stage, api, sfx) {
  const cv = document.createElement('canvas'); stage.append(cv);
  const C = api.canvas(cv);
  const N = 24;
  let ang = 0, vis = 0, drag = null, det = 0;
  cv.tabIndex = 0; cv.setAttribute('role', 'slider'); cv.setAttribute('aria-label', 'Rotary dial'); cv.setAttribute('aria-valuemin', 0); cv.setAttribute('aria-valuemax', N - 1);
  const center = () => [C.w / 2, C.h / 2 - 10];
  function update() {
    const d = ((Math.round(ang / (TAU / N)) % N) + N) % N;
    if (d !== det) { det = d; sfx.tick(1700, 0.12); api.haptics.pulse('tick'); cv.setAttribute('aria-valuenow', d); }
  }
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); api.audio.ensure(); const [cx, cy] = center(); drag = Math.atan2(e.offsetY - cy, e.offsetX - cx); }, { signal: api.signal });
  cv.addEventListener('pointermove', e => { if (drag == null) return; const [cx, cy] = center(); const a = Math.atan2(e.offsetY - cy, e.offsetX - cx); ang += wrap(a - drag); drag = a; update(); }, { signal: api.signal });
  const up = () => { drag = null; ang = Math.round(ang / (TAU / N)) * (TAU / N); };
  cv.addEventListener('pointerup', up, { signal: api.signal });
  cv.addEventListener('keydown', e => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); api.audio.ensure(); ang += d * TAU / N; update(); } }, { signal: api.signal });
  api.loop(dt => {
    vis += (ang - vis) * Math.min(1, dt * (drag != null ? 40 : 18));
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const [cx, cy] = center(), R = Math.min(w, h) * 0.3;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    for (let i = 0; i < N; i++) {
      const a = i * TAU / N - Math.PI / 2, lit = i === det;
      ctx.fillStyle = lit ? accent : '#3a342c';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 1.32, cy + Math.sin(a) * R * 1.32, lit ? 5 : 3, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(cx, cy);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#5a5246'); g.addColorStop(1, '#1f1c18');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.rotate(vis);
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) { const a = i * TAU / 60; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
    ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(-4, -R * 0.85, 8, R * 0.32, 4); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#efe8dc'; ctx.font = '700 28px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(det).padStart(2, '0'), cx, cy + R * 1.32 + 52);
  });
}

// ---------- Pop buttons ----------
function pop(stage, api, sfx) {
  const hues = ['#5fd3a8', '#ff7a63', '#9c8cff', '#ffd24d', '#5cb8ff'];
  let hi = 0;
  stage.innerHTML = `<div class="fl-pop" style="--bc:${hues[0]}">${Array.from({ length: 36 }, (_, i) => `<button class="fl-bub" aria-label="Bubble ${i + 1}" aria-pressed="false"></button>`).join('')}</div>`;
  const grid = stage.firstElementChild;
  grid.addEventListener('pointerdown', e => {
    const b = e.target.closest('.fl-bub'); if (!b || b.classList.contains('popped')) return;
    api.audio.ensure();
    b.classList.add('popped'); b.setAttribute('aria-pressed', 'true'); sfx.pop(); api.haptics.pulse('pop');
    if (!grid.querySelector('.fl-bub:not(.popped)')) setTimeout(() => {
      // Flip the sheet: everything re-inflates in a new colour.
      hi = (hi + 1) % hues.length; grid.style.setProperty('--bc', hues[hi]);
      grid.querySelectorAll('.fl-bub').forEach((x, i) => setTimeout(() => { x.classList.remove('popped'); x.setAttribute('aria-pressed', 'false'); }, i * 14));
      api.audio.tone(api.bus(), { freq: 300, to: 900, dur: 0.4, type: 'sine', vol: 0.1 });
    }, 300);
  }, { signal: api.signal });
  grid.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('fl-bub')) { e.preventDefault(); e.target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } }, { signal: api.signal });
}

// ---------- Rolling beads ----------
function bead(stage, api, sfx) {
  const cv = document.createElement('canvas'); stage.append(cv);
  const C = api.canvas(cv);
  info(stage, `<span class="badge">Drag to tilt · ←/→</span>`);
  let tilt = 0, target = 0, drag = null;
  const beads = [{ x: -0.3, v: 0, c: '#ff7a63' }, { x: 0, v: 0, c: '#ffd24d' }, { x: 0.3, v: 0, c: '#5cb8ff' }];
  const r = 0.07;
  cv.tabIndex = 0; cv.setAttribute('aria-label', 'Bead track. Use left and right arrows to tilt.');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); api.audio.ensure(); drag = { x: e.clientX, t: target }; }, { signal: api.signal });
  cv.addEventListener('pointermove', e => { if (drag) target = clamp(drag.t + (e.clientX - drag.x) / 400, -0.5, 0.5); }, { signal: api.signal });
  cv.addEventListener('pointerup', () => drag = null, { signal: api.signal });
  cv.addEventListener('keydown', e => { const d = { ArrowLeft: -0.12, ArrowRight: 0.12 }[e.key]; if (d) { e.preventDefault(); api.audio.ensure(); target = clamp(target + d, -0.5, 0.5); } }, { signal: api.signal });
  const clack = sp => { if (sp > 0.08) { sfx.click(2800 + Math.random() * 600, Math.min(0.25, sp * 0.4)); api.haptics.pulse(sp > 0.5 ? 'click' : 'tick'); } };
  api.loop(dt => {
    tilt += (target - tilt) * Math.min(1, dt * 10);
    for (const b of beads) { b.v += Math.sin(tilt) * 2.4 * dt; b.v *= 1 - 0.25 * dt; b.x += b.v * dt; }
    for (let it = 0; it < 3; it++) {
      beads.sort((a, b) => a.x - b.x);
      for (let i = 0; i < beads.length; i++) {
        const b = beads[i];
        if (b.x < -1 + r) { b.x = -1 + r; if (b.v < 0) { clack(-b.v); b.v = -b.v * 0.45; } }
        if (b.x > 1 - r) { b.x = 1 - r; if (b.v > 0) { clack(b.v); b.v = -b.v * 0.45; } }
        const n = beads[i + 1];
        if (n && n.x - b.x < 2 * r) {
          const mid = (b.x + n.x) / 2; b.x = mid - r; n.x = mid + r;
          const rel = b.v - n.v;
          if (rel > 0) { clack(rel); const e = 0.8; const vb = b.v, vn = n.v; b.v = (vb + vn - e * rel) / 2; n.v = (vb + vn + e * rel) / 2; }
        }
      }
    }
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const L = Math.min(w * 0.4, 420), cy = h / 2 - 10;
    ctx.save(); ctx.translate(w / 2, cy); ctx.rotate(tilt);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2621'; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(-L - 6, 0); ctx.lineTo(L + 6, 0); ctx.stroke();
    ctx.strokeStyle = '#0c0b09'; ctx.lineWidth = 32; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = '#6b6357'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
    for (const b of beads) {
      const x = b.x * L, rr = r * L;
      const g = ctx.createRadialGradient(x - rr * 0.35, -rr * 0.35, rr * 0.1, x, 0, rr);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, b.c); g.addColorStop(1, '#000');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, 0, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#2a2621'; ctx.beginPath(); ctx.moveTo(w / 2 - 20, cy + 60); ctx.lineTo(w / 2 + 20, cy + 60); ctx.lineTo(w / 2, cy + 24); ctx.fill();
  });
}

// ---------- Ratchet ----------
function ratchet(stage, api, sfx) {
  const cv = document.createElement('canvas'); stage.append(cv);
  const C = api.canvas(cv);
  const box = info(stage, `<span class="badge">Turns clockwise only</span><span class="badge mono" id="cnt">0 clicks</span>`);
  const N = 20;
  let ang = 0, drag = null, tooth = 0, clicks = 0, pawl = 0;
  const center = () => [C.w / 2, C.h / 2 - 10];
  cv.tabIndex = 0; cv.setAttribute('aria-label', 'Ratchet. Press right arrow to advance.');
  function advance(d) {
    if (d < 0) { pawl = Math.min(pawl, 0.15); return; } // pawl blocks reverse
    ang += d;
    const t = Math.floor(ang / (TAU / N));
    pawl = (ang / (TAU / N)) % 1;
    if (t !== tooth) { tooth = t; clicks++; pawl = 0; sfx.click(1500, 0.2); api.haptics.pulse('click'); box.lastElementChild.textContent = `${clicks} clicks`; }
  }
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); api.audio.ensure(); const [cx, cy] = center(); drag = Math.atan2(e.offsetY - cy, e.offsetX - cx); }, { signal: api.signal });
  cv.addEventListener('pointermove', e => { if (drag == null) return; const [cx, cy] = center(); const a = Math.atan2(e.offsetY - cy, e.offsetX - cx); advance(wrap(a - drag)); drag = a; }, { signal: api.signal });
  cv.addEventListener('pointerup', () => drag = null, { signal: api.signal });
  cv.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); api.audio.ensure(); advance(TAU / N); } }, { signal: api.signal });
  api.loop(() => {
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const [cx, cy] = center(), R = Math.min(w, h) * 0.28;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = i * TAU / N, a2 = (i + 1) * TAU / N;
      ctx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
      ctx.lineTo(Math.cos(a2 - 0.02) * R, Math.sin(a2 - 0.02) * R);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, R); g.addColorStop(0, '#9a9083'); g.addColorStop(1, '#4b443a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a2621'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a1815'; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.beginPath(); ctx.roundRect(-5, -R * 0.5, 10, R * 0.35, 5); ctx.fill();
    ctx.restore();
    // Pawl rides up each tooth then drops.
    const px = cx + R * 0.95, py = cy - R * 0.9, lift = pawl * 0.25;
    ctx.save(); ctx.translate(px, py); ctx.rotate(2.3 - lift);
    ctx.fillStyle = '#c9bfae'; ctx.beginPath(); ctx.roundRect(-6, -6, R * 0.5, 12, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a342c'; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
  });
}

const OBJECTS = { classic: spinner('classic'), tri: spinner('tri'), gear: spinner('gear'), clicker, toggles, sliders, dial, pop, bead, ratchet };
