import { icon, modal, fmtTime, setRange } from '../core/ui.js';

const GLYPH = {
  rain: 'M7 4l-2 5M12 3l-2 5M17 4l-2 5M8 13l-2 5M13 12l-2 5M18 13l-2 5',
  thunder: 'M13 2L5 13h6l-2 9 9-12h-6z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
  ocean: 'M2 9c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0',
  forest: 'M12 2l6 9h-4l5 7H5l5-7H6zM12 18v4',
  fireplace: 'M12 22c-4 0-7-3-7-7 0-5 5-6 5-12 3 2 4 5 4 7 1-1 2-2 2-4 2 2 3 5 3 9 0 4-3 7-7 7z',
  cafe: 'M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 11h2a2 2 0 0 1 0 4h-2M8 2v3M12 2v3',
  fan: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 10c0-5 2-7 5-6s1 5-3 7M14 12c5 0 7 2 6 5s-5 1-7-3M12 14c0 5-2 7-5 6s-1-5 3-7M10 12c-5 0-7-2-6-5s5-1 7 3',
  white: 'M4 6h.01M8 4h.01M12 7h.01M16 5h.01M20 7h.01M5 11h.01M9 13h.01M14 11h.01M19 12h.01M4 17h.01M8 19h.01M12 16h.01M16 19h.01M20 17h.01',
};
const LAYERS = [['rain', 'Rain'], ['thunder', 'Thunder'], ['wind', 'Wind'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['fireplace', 'Fireplace'], ['cafe', 'Café murmur'], ['fan', 'Fan'], ['white', 'White noise']];
const PRESETS = {
  Focus: { cafe: 0.35, rain: 0.3, fan: 0.25 },
  'Rainy Window': { rain: 0.75, thunder: 0.55, wind: 0.2 },
  'Night Drive': { fan: 0.5, rain: 0.35, wind: 0.25 },
  Forest: { forest: 0.7, wind: 0.3, rain: 0.12 },
  Fireside: { fireplace: 0.75, wind: 0.25, rain: 0.2 },
  Seaside: { ocean: 0.75, wind: 0.3 },
};
const rand = (a, b) => a + Math.random() * (b - a);

// ---- Sound generators: each returns { stop(), tick?(ac, until) } and writes into `out`. ----
function loopNoise(ac, audio, kind, out, filters = []) {
  const s = ac.createBufferSource(); s.buffer = audio.noise(kind, 6); s.loop = true; s.loopStart = 0; s.loopEnd = 6;
  let node = s;
  for (const [type, f, q = 0.7] of filters) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; }
  const g = ac.createGain(); node.connect(g).connect(out);
  s.start(0, Math.random() * 5);
  return { s, g, last: node };
}
const GEN = {
  rain(ac, a, out) {
    const bed = loopNoise(ac, a, 'pink', out, [['highpass', 500], ['lowpass', 7500]]); bed.g.gain.value = 0.6;
    let next = 0;
    return {
      stop: () => bed.s.stop(),
      tick(until) { while (next < until) { next = Math.max(next, ac.currentTime) + rand(0.01, 0.05); a.burst(out, { when: next - ac.currentTime, dur: rand(0.01, 0.03), vol: rand(0.02, 0.12), type: 'highpass', freq: rand(2500, 6000) }); } },
    };
  },
  thunder(ac, a, out, fx) {
    let next = ac.currentTime + rand(2, 6);
    const srcs = new Set();
    return {
      stop: () => srcs.forEach(s => { try { s.stop(); } catch {} }),
      tick(until) {
        if (next > until) return;
        const t = next, dur = rand(3, 6);
        const s = ac.createBufferSource(); s.buffer = a.noise('brown', 6);
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(rand(300, 600), t); f.frequency.exponentialRampToValueAtTime(90, t + dur);
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(rand(0.8, 1.6), t + rand(0.05, 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
        srcs.add(s); s.onended = () => srcs.delete(s);
        if (Math.random() < 0.6) a.burst(out, { when: t - ac.currentTime, dur: 0.25, vol: 0.5, type: 'bandpass', freq: 900, q: 0.6, kind: 'pink' });
        setTimeout(() => fx.flash = 1, Math.max(0, (t - ac.currentTime) * 1000 - 300));
        next = t + rand(9, 26);
      },
    };
  },
  wind(ac, a, out) {
    const n = loopNoise(ac, a, 'pink', out, [['bandpass', 500, 0.9]]); n.g.gain.value = 0.5;
    const f = n.last;
    let next = 0;
    return {
      stop: () => n.s.stop(),
      tick(until) { if (next > until) return; next = ac.currentTime + rand(1.5, 4); f.frequency.setTargetAtTime(rand(250, 900), ac.currentTime, 1.2); n.g.gain.setTargetAtTime(rand(0.25, 0.9), ac.currentTime, 1.5); },
    };
  },
  ocean(ac, a, out) {
    const low = loopNoise(ac, a, 'brown', out, [['lowpass', 700]]);
    const hiss = loopNoise(ac, a, 'pink', out, [['highpass', 1500], ['lowpass', 6000]]);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
    const d1 = ac.createGain(); d1.gain.value = 0.4; const d2 = ac.createGain(); d2.gain.value = 0.12;
    low.g.gain.value = 0.5; hiss.g.gain.value = 0.13;
    lfo.connect(d1).connect(low.g.gain); lfo.connect(d2).connect(hiss.g.gain); lfo.start();
    return { stop: () => { low.s.stop(); hiss.s.stop(); lfo.stop(); } };
  },
  forest(ac, a, out) {
    const r = loopNoise(ac, a, 'pink', out, [['bandpass', 3200, 0.5]]); r.g.gain.value = 0.12;
    let next = 0;
    return {
      stop: () => r.s.stop(),
      tick(until) {
        while (next < until) {
          next = Math.max(next, ac.currentTime) + rand(0.8, 3.5);
          const base = rand(2200, 4200), notes = 2 + Math.floor(Math.random() * 4), when = next - ac.currentTime;
          for (let k = 0; k < notes; k++) a.tone(out, { when: when + k * rand(0.08, 0.14), freq: base * rand(0.9, 1.15), to: base * rand(1.1, 1.5), dur: rand(0.05, 0.12), vol: rand(0.03, 0.09) });
        }
      },
    };
  },
  fireplace(ac, a, out) {
    const roar = loopNoise(ac, a, 'brown', out, [['lowpass', 380]]); roar.g.gain.value = 0.7;
    let next = 0;
    return {
      stop: () => roar.s.stop(),
      tick(until) {
        while (next < until) {
          next = Math.max(next, ac.currentTime) + (Math.random() < 0.3 ? rand(0.01, 0.05) : rand(0.08, 0.5));
          a.burst(out, { when: next - ac.currentTime, dur: rand(0.004, 0.02), vol: rand(0.05, 0.35), type: 'highpass', freq: rand(1500, 4000) });
        }
      },
    };
  },
  cafe(ac, a, out) {
    const room = loopNoise(ac, a, 'brown', out, [['lowpass', 300]]); room.g.gain.value = 0.25;
    const voices = Array.from({ length: 4 }, () => { const v = loopNoise(ac, a, 'pink', out, [['bandpass', rand(400, 1800), 4]]); v.g.gain.value = 0; return v; });
    let next = 0, clink = ac.currentTime + rand(3, 8);
    return {
      stop: () => { room.s.stop(); voices.forEach(v => v.s.stop()); },
      tick(until) {
        if (next <= until) {
          next = ac.currentTime + rand(0.12, 0.3);
          for (const v of voices) { v.last.frequency.setTargetAtTime(rand(350, 2200), ac.currentTime, 0.05); v.g.gain.setTargetAtTime(Math.random() < 0.55 ? rand(0.05, 0.22) : 0, ac.currentTime, 0.06); }
        }
        if (clink <= until) { const f = rand(2600, 4200); a.tone(out, { when: clink - ac.currentTime, freq: f, dur: 0.4, vol: 0.04 }); a.tone(out, { when: clink - ac.currentTime, freq: f * 2.7, dur: 0.25, vol: 0.02 }); clink += rand(3, 10); }
      },
    };
  },
  fan(ac, a, out) {
    const n = loopNoise(ac, a, 'brown', out, [['lowpass', 900]]); n.g.gain.value = 0.6;
    const hum = ac.createOscillator(); hum.frequency.value = 98; const hg = ac.createGain(); hg.gain.value = 0.025; hum.connect(hg).connect(out); hum.start();
    const lfo = ac.createOscillator(); lfo.frequency.value = 11; const d = ac.createGain(); d.gain.value = 0.06; lfo.connect(d).connect(n.g.gain); lfo.start();
    return { stop: () => { n.s.stop(); hum.stop(); lfo.stop(); } };
  },
  white(ac, a, out) { const n = loopNoise(ac, a, 'white', out); n.g.gain.value = 0.35; return { stop: () => n.s.stop() }; },
};

export function mount(root, api) {
  const saved = api.load('mix', {});
  const vols = Object.fromEntries(LAYERS.map(([k]) => [k, typeof saved[k] === 'number' ? saved[k] : 0.5]));
  const on = {}; // key -> { gen, gain }
  let master = null, masterVol = api.load('master', 0.8), muted = false;
  let mixes = api.load('mixes', {});
  let timerEnd = null, timerTotal = 0;
  const fx = { flash: 0 };

  root.innerHTML = `<div class="atm">
    <div class="atm-scene"><canvas id="cv" aria-hidden="true"></canvas>
      <div class="atm-now"><span class="badge" id="now">Silence</span><span class="badge mono" id="tleft" hidden></span></div></div>
    <div class="atm-body">
      <div class="atm-layers" id="layers">${LAYERS.map(([k, l]) => `<div class="atm-tile" data-k="${k}">
        <button class="atm-tog" aria-pressed="false" aria-label="${l}"><svg viewBox="0 0 24 24" class="i"><path d="${GLYPH[k]}"/></svg><span>${l}</span></button>
        <input type="range" min="0" max="1" step="0.01" value="${vols[k]}" aria-label="${l} volume"></div>`).join('')}</div>
      <aside class="atm-side">
        <section><h2>Presets</h2><div class="row" id="presets"></div></section>
        <section><h2>Master</h2>
          <label class="field"><span class="row">Volume<output id="mvO">${Math.round(masterVol * 100)}%</output></span><input type="range" id="mv" min="0" max="1" step="0.01" value="${masterVol}"></label>
          <div class="row"><button class="btn" id="mute" aria-pressed="false">${icon('mute')} Mute</button><button class="btn" id="fade">Fade out all</button></div></section>
        <section><h2>Sleep timer</h2><div class="seg" id="timer">${[[0, 'Off'], [15, '15m'], [30, '30m'], [60, '60m']].map(([m, l]) => `<button data-m="${m}" aria-pressed="${m === 0}">${l}</button>`).join('')}</div><p class="muted" style="font-size:12.5px">Fades out gently over the final 30 seconds.</p></section>
        <section><button class="btn" id="save">${icon('save')} Save this mix</button></section>
        <p class="note">Every sound is synthesised live in your browser, so there are no recordings to download and it works offline.</p>
      </aside>
    </div>
  </div>
  <style>
    .atm { flex: 1; display: grid; grid-template-rows: 220px 1fr; }
    .atm-scene { position: relative; overflow: hidden; border-bottom: 1px solid var(--line); }
    .atm-scene canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .atm-now { position: absolute; left: 16px; bottom: 14px; display: flex; gap: 8px; }
    .atm-body { display: grid; grid-template-columns: 1fr 300px; }
    .atm-layers { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; padding: 16px; align-content: start; }
    .atm-tile { display: grid; gap: 8px; padding: 12px; border-radius: 16px; background: var(--panel); border: 1px solid var(--line); transition: border-color var(--t), background var(--t); }
    .atm-tile.on { border-color: color-mix(in oklab, var(--accent) 55%, var(--line)); background: color-mix(in oklab, var(--accent) 8%, var(--panel)); }
    .atm-tog { display: flex; align-items: center; gap: 10px; background: none; border: 0; padding: 4px; cursor: pointer; font-weight: 700; font-size: 15px; text-align: left; border-radius: 10px; }
    .atm-tog svg { width: 34px; height: 34px; padding: 6px; border-radius: 10px; background: var(--panel-3); }
    .atm-tile.on .atm-tog svg { background: var(--accent); color: var(--accent-ink); }
    .atm-side { border-left: 1px solid var(--line); background: var(--bg-2); padding: 16px; display: flex; flex-direction: column; gap: 18px; }
    .atm-side h2 { font: 700 11px var(--f-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
    .atm-side .chip .x { margin-left: 4px; opacity: .6; }
    @media (max-width: 860px) { .atm-body { grid-template-columns: 1fr; } .atm-side { border-left: 0; border-top: 1px solid var(--line); } .atm { grid-template-rows: 160px 1fr; } }
  </style>`;
  const $ = s => root.querySelector(s);

  function ensureMaster() {
    if (master) return master;
    const bus = api.bus(); if (!bus) return null;
    master = api.audio.ctx.createGain(); master.gain.value = muted ? 0 : masterVol; master.connect(bus);
    return master;
  }
  function start(k, fade = 1.5) {
    const m = ensureMaster(); if (!m || on[k]) return;
    const ac = api.audio.ctx, g = ac.createGain();
    g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(vols[k] ** 2, ac.currentTime + fade);
    g.connect(m);
    on[k] = { gen: GEN[k](ac, api.audio, g, fx), gain: g };
    paint();
  }
  function stop(k, fade = 1) {
    const l = on[k]; if (!l) return;
    delete on[k];
    const ac = api.audio.ctx;
    l.gain.gain.cancelScheduledValues(ac.currentTime); l.gain.gain.setValueAtTime(l.gain.gain.value, ac.currentTime);
    l.gain.gain.linearRampToValueAtTime(0, ac.currentTime + fade);
    setTimeout(() => { try { l.gen.stop(); l.gain.disconnect(); } catch {} }, fade * 1000 + 100);
    paint();
  }
  const stopAll = (fade = 1) => Object.keys(on).forEach(k => stop(k, fade));
  function paint() {
    root.querySelectorAll('.atm-tile').forEach(t => { const a = !!on[t.dataset.k]; t.classList.toggle('on', a); t.querySelector('.atm-tog').setAttribute('aria-pressed', a); });
    const names = LAYERS.filter(([k]) => on[k]).map(([, l]) => l);
    $('#now').textContent = names.length ? names.join(' · ') : 'Silence';
    markPreset();
  }
  const persist = () => api.save('mix', vols);

  $('#layers').addEventListener('click', e => {
    const b = e.target.closest('.atm-tog'); if (!b) return;
    const k = b.closest('.atm-tile').dataset.k;
    on[k] ? stop(k) : start(k);
    api.haptics.pulse('tick');
  });
  $('#layers').addEventListener('input', e => {
    if (e.target.type !== 'range') return;
    const k = e.target.closest('.atm-tile').dataset.k;
    vols[k] = +e.target.value; persist();
    if (on[k]) on[k].gain.gain.setTargetAtTime(vols[k] ** 2, api.audio.ctx.currentTime, 0.1);
    markPreset();
  });

  function applyMix(mix) {
    ensureMaster(); if (!master) return;
    for (const [k] of LAYERS) {
      if (mix[k]) { vols[k] = mix[k]; setRange(root.querySelector(`[data-k="${k}"] input`), mix[k]); if (on[k]) on[k].gain.gain.setTargetAtTime(vols[k] ** 2, api.audio.ctx.currentTime, 0.4); else start(k, 2.5); }
      else stop(k, 1.5);
    }
    persist();
  }
  function renderPresets() {
    $('#presets').innerHTML = [...Object.keys(PRESETS).map(n => `<button class="chip" data-p="${n}">${n}</button>`),
      ...Object.keys(mixes).map(n => `<button class="chip" data-u="${encodeURIComponent(n)}">${n.replace(/</g, '&lt;')}<span class="x" data-del="${encodeURIComponent(n)}" role="button" aria-label="Delete mix">✕</span></button>`)].join('');
    markPreset();
  }
  function markPreset() {
    const cur = Object.fromEntries(Object.keys(on).map(k => [k, vols[k]]));
    const same = m => { const ks = Object.keys(m); return ks.length === Object.keys(cur).length && ks.every(k => Math.abs((cur[k] ?? -1) - m[k]) < 0.005); };
    root.querySelectorAll('#presets [data-p]').forEach(b => b.setAttribute('aria-pressed', same(PRESETS[b.dataset.p])));
    root.querySelectorAll('#presets [data-u]').forEach(b => b.setAttribute('aria-pressed', same(mixes[decodeURIComponent(b.dataset.u)] || {})));
  }
  $('#presets').onclick = e => {
    const d = e.target.closest('[data-del]');
    if (d) { delete mixes[decodeURIComponent(d.dataset.del)]; api.save('mixes', mixes); renderPresets(); return; }
    const p = e.target.closest('[data-p]'), u = e.target.closest('[data-u]');
    if (p) applyMix(PRESETS[p.dataset.p]); else if (u) applyMix(mixes[decodeURIComponent(u.dataset.u)]);
  };
  $('#save').onclick = () => {
    if (!Object.keys(on).length) return api.toast('Turn on a layer first');
    const d = modal('Save mix', `<label class="field">Name<input id="mn" maxlength="24" style="height:40px;padding:0 12px;border-radius:9px;border:1px solid var(--line-2);background:var(--panel-2)" placeholder="Late night reading"></label><div class="row" style="justify-content:flex-end"><button class="btn primary" id="mok">Save</button></div>`);
    const inp = d.querySelector('#mn'); inp.focus();
    const ok = () => { const n = inp.value.trim(); if (!n) return; mixes[n] = Object.fromEntries(Object.keys(on).map(k => [k, vols[k]])); api.save('mixes', mixes); renderPresets(); d.close(); api.toast(`Saved “${n}”`); };
    d.querySelector('#mok').onclick = ok; inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  };
  $('#mv').oninput = e => { masterVol = +e.target.value; $('#mvO').textContent = Math.round(masterVol * 100) + '%'; api.save('master', masterVol); if (master && !muted) master.gain.setTargetAtTime(masterVol, api.audio.ctx.currentTime, 0.05); };
  $('#mute').onclick = () => { muted = !muted; $('#mute').setAttribute('aria-pressed', muted); if (master) master.gain.setTargetAtTime(muted ? 0 : masterVol, api.audio.ctx.currentTime, 0.05); };
  $('#fade').onclick = () => stopAll(4);
  $('#timer').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    root.querySelectorAll('#timer button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const m = +b.dataset.m;
    timerTotal = m * 60; timerEnd = m ? performance.now() + m * 60000 : null;
    $('#tleft').hidden = !m;
    if (master && !muted) master.gain.setTargetAtTime(masterVol, api.audio.ctx.currentTime, 0.1);
  };
  renderPresets(); paint();

  // Event scheduler (lookahead) + sleep timer.
  api.interval(() => {
    const ac = api.audio.ctx; if (!ac) return;
    for (const k in on) on[k].gen.tick?.(ac.currentTime + 0.25);
    if (timerEnd) {
      const left = (timerEnd - performance.now()) / 1000;
      $('#tleft').textContent = '⏾ ' + fmtTime(Math.max(0, left));
      if (left < 30 && master && !muted) master.gain.setTargetAtTime(masterVol * Math.max(0, left / 30), ac.currentTime, 0.2);
      if (left <= 0) {
        stopAll(0.5); timerEnd = null; $('#tleft').hidden = true;
        root.querySelectorAll('#timer button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === '0'));
        setTimeout(() => master?.gain.setValueAtTime(masterVol, api.audio.ctx.currentTime), 700);
        api.toast('Sleep timer finished');
      }
    }
  }, 50);
  api.onCleanup(() => { for (const k in on) { try { on[k].gen.stop(); } catch {} } try { master?.disconnect(); } catch {} });

  // ---- Scene: low-motion by default; reduced motion freezes it. ----
  const cv = $('#cv'), C = api.canvas(cv);
  const drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.6, 1) }));
  const motes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6 }));
  api.loop((dt, t) => {
    const { ctx, w, h } = C; if (!w) return;
    const lvl = k => on[k] ? vols[k] : 0, still = api.reducedMotion(), T = still ? 0 : t / 1000;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const fire = lvl('fireplace'), cafe = lvl('cafe');
    sky.addColorStop(0, '#0b0f1a'); sky.addColorStop(1, `rgb(${30 + fire * 60 + cafe * 30},${24 + fire * 20 + cafe * 18},${30})`);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    if (fx.flash > 0) { ctx.fillStyle = `rgba(220,230,255,${fx.flash * 0.5 * (still ? 0.4 : 1)})`; ctx.fillRect(0, 0, w, h); fx.flash = Math.max(0, fx.flash - dt * 2.5); }
    ctx.fillStyle = '#efe8dc'; ctx.globalAlpha = 0.85 - lvl('rain') * 0.6; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.3, 18, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (lvl('forest')) { ctx.fillStyle = `rgba(20,40,28,${0.4 + lvl('forest') * 0.6})`; for (let i = 0; i < 14; i++) { const x = i / 13 * w, th = h * (0.35 + (i * 37 % 10) / 40); ctx.beginPath(); ctx.moveTo(x - 30, h); ctx.lineTo(x, h - th); ctx.lineTo(x + 30, h); ctx.fill(); }
      ctx.fillStyle = '#d8f28a'; motes.forEach(m => { ctx.globalAlpha = lvl('forest') * (0.4 + 0.6 * Math.sin(T * 1.5 + m.p) ** 2); ctx.beginPath(); ctx.arc((m.x + Math.sin(T * 0.1 + m.p) * 0.02) * w, (0.4 + m.y * 0.55) * h, 1.8, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; }
    if (lvl('ocean')) { for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(60,110,170,${(0.25 + k * 0.2) * (0.4 + lvl('ocean'))})`; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.72 + k * 0.09) + Math.sin(x / 90 + T * (0.5 + k * 0.2) + k) * 6); ctx.lineTo(w, h); ctx.fill(); } }
    if (fire) { const g = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, h * 0.9); g.addColorStop(0, `rgba(255,140,50,${0.55 * fire + 0.05 * Math.sin(T * 9)})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffb347'; motes.slice(0, 18).forEach(m => { const y = 1 - ((m.y + T * 0.08 * (0.5 + m.p / 6)) % 1); ctx.globalAlpha = fire * y; ctx.fillRect(w / 2 + (m.x - 0.5) * w * 0.3 + Math.sin(T + m.p) * 10, y * h, 2, 2); }); ctx.globalAlpha = 1; }
    if (cafe) { for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(255,200,120,${0.12 * cafe})`; ctx.beginPath(); ctx.arc(((i * 0.137 + 0.05) % 1) * w, h * (0.25 + (i % 3) * 0.12), 18 + (i % 4) * 8, 0, 7); ctx.fill(); } }
    if (lvl('wind')) { ctx.strokeStyle = `rgba(220,220,230,${0.15 * lvl('wind')})`; ctx.lineWidth = 1; motes.forEach(m => { const x = ((m.x + T * 0.05 * (1 + m.p / 3)) % 1.2 - 0.1) * w, y = m.y * h * 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 4, x + 50, y); ctx.stroke(); }); }
    if (lvl('rain')) { ctx.strokeStyle = `rgba(170,200,240,${0.25 + lvl('rain') * 0.35})`; ctx.lineWidth = 1; const n = Math.floor(drops.length * lvl('rain')); for (let i = 0; i < n; i++) { const d = drops[i]; const y = ((d.y + T * 0.35 * d.s) % 1) * h, x = (d.x * w + y * 0.15) % w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 12 * d.s); ctx.stroke(); } }
    if (lvl('white') || lvl('fan')) { ctx.fillStyle = `rgba(255,255,255,${0.04 * (lvl('white') + lvl('fan'))})`; for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  });

  return { reset() { stopAll(0.5); LAYERS.forEach(([k]) => { vols[k] = 0.5; setRange(root.querySelector(`[data-k="${k}"] input`), 0.5); }); persist(); paint(); } };
}
