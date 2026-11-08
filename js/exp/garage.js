import { setRange, initRanges } from '../core/ui.js';
import { CARS, EngineSound, topCar, sideCar, makeDrive, stepDrive, tryStart, tryShift, arcadeMax, autoBox } from './garage-engine.js';

const VW = 180, VH = 320; // arcade virtual resolution

// ---- Gauges ----
const accent = '#ffd24d';
function gauge(cv, val, maxV, redFrom, label, center, step, fmt) {
  const g = cv.getContext('2d'), W = 200, cx = 100, cy = 104, R = 82;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#12121c'; g.beginPath(); g.arc(cx, cy, R + 12, 0, 7); g.fill();
  g.strokeStyle = '#2b2b3d'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R + 9, 0, 7); g.stroke();
  const a0 = Math.PI * 0.75, span = Math.PI * 1.5, ang = v => a0 + span * Math.min(1, v / maxV);
  if (redFrom) { g.strokeStyle = '#ff3b55'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R - 4, ang(redFrom), ang(maxV)); g.stroke(); }
  g.fillStyle = '#e9e6f2'; g.font = '9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= maxV + 1e-6; v += step / 2) {
    const a = ang(v), major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    g.strokeStyle = redFrom && v >= redFrom ? '#ff3b55' : '#e9e6f2'; g.lineWidth = major ? 4 : 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - (major ? 14 : 8)), cy + Math.sin(a) * (R - (major ? 14 : 8))); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    if (major) g.fillText(fmt(v), cx + Math.cos(a) * (R - 28), cy + Math.sin(a) * (R - 28));
  }
  const a = ang(val);
  g.strokeStyle = accent; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); g.stroke();
  g.fillStyle = '#2b2b3d'; g.fillRect(cx - 9, cy - 9, 18, 18);
  g.fillStyle = '#8f8aa8'; g.font = '7px "Press Start 2P", monospace'; g.fillText(label, cx, cy - 30);
  g.fillStyle = '#fff'; g.font = '13px "Press Start 2P", monospace'; g.fillText(center, cx, cy + 42);
}


// Traffic cone: dark outline + high-contrast stripes so it reads clearly on the asphalt.
function drawCone(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x - 8, y + 6, 18, 3);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 8, y + 3, 16, 5); ctx.fillRect(x - 5, y - 9, 10, 13); ctx.fillRect(x - 3, y - 11, 6, 3);
  ctx.fillStyle = '#ff6a00'; ctx.fillRect(x - 4, y - 8, 8, 12); ctx.fillRect(x - 2, y - 10, 4, 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 5, 8, 2); ctx.fillRect(x - 4, y, 8, 2);
  ctx.fillStyle = '#ffb066'; ctx.fillRect(x - 3, y - 8, 1, 3);
  ctx.fillStyle = '#ff6a00'; ctx.fillRect(x - 7, y + 4, 14, 3);
}

export function mount(root, api) {
  let carIdx = Math.max(0, CARS.findIndex(c => c.id === api.load('car', 'mote')));
  const colors = api.load('colors', {});
  let view = null; // active sub-screen cleanup
  let engVol = api.load('engVol', 0.6);

  root.innerHTML = `<div class="gar" id="gar"></div>
  <style>
    .gar { flex: 1; display: flex; flex-direction: column; background: #0d0d14; color: #e9e6f2; font-family: var(--f-pixel); font-size: 10px; line-height: 1.6; }
    .gar .px-btn { font: 10px var(--f-pixel); color: #0d0d14; background: #ffd24d; border: 0; padding: 12px 14px; cursor: pointer; box-shadow: inset -3px -3px 0 #b8901a, inset 3px 3px 0 #fff1b0, 0 4px 0 #000; text-transform: uppercase; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
    .gar .px-btn:active, .gar .px-btn.is-down { transform: translateY(3px); box-shadow: inset -3px -3px 0 #b8901a, inset 3px 3px 0 #fff1b0, 0 1px 0 #000; }
    .gar .px-btn.alt { background: #5cb8ff; box-shadow: inset -3px -3px 0 #2c74b0, inset 3px 3px 0 #c8e8ff, 0 4px 0 #000; }
    .gar .px-btn.red { background: #ff5d73; box-shadow: inset -3px -3px 0 #a8283c, inset 3px 3px 0 #ffc2cb, 0 4px 0 #000; }
    .gar .px-btn.dark { background: #2b2b3d; color: #e9e6f2; box-shadow: inset -3px -3px 0 #16161f, inset 3px 3px 0 #4a4a66, 0 4px 0 #000; }
    .gar .px-btn[aria-pressed="true"] { background: #7fd19b; box-shadow: inset -3px -3px 0 #3d8a58, inset 3px 3px 0 #d0f5dc, 0 4px 0 #000; }
    .gar .px-btn:disabled { opacity: .45; }
    .gar .px-btn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; border-radius: 0; }
    .gar canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
    .gar .panel { background: #161622; border: 3px solid #2b2b3d; box-shadow: inset 0 0 0 3px #0d0d14; padding: 12px; }
    .gar h2 { font: 16px var(--f-pixel); letter-spacing: 1px; color: #ffd24d; text-shadow: 3px 3px 0 #000; }
    .gar .muted2 { color: #8f8aa8; }
    .g-home { flex: 1; display: grid; gap: 16px; padding: 18px 16px 30px; max-width: 900px; margin: 0 auto; width: 100%; align-content: start; }
    .g-show { position: relative; }
    .g-show canvas { width: 100%; aspect-ratio: 160 / 72; }
    .g-arrows { position: absolute; inset: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; pointer-events: none; }
    .g-arrows button { pointer-events: auto; }
    .g-info { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .g-stat { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 8px; margin: 6px 0; }
    .g-bar { display: flex; gap: 3px; } .g-bar i { width: 14px; height: 10px; background: #2b2b3d; } .g-bar i.on { background: #7fd19b; }
    .g-sw { display: flex; gap: 8px; margin-top: 8px; } .g-sw button { width: 30px; height: 30px; border: 3px solid #0d0d14; cursor: pointer; box-shadow: 0 0 0 2px #2b2b3d; } .g-sw button[aria-pressed="true"] { box-shadow: 0 0 0 3px #ffd24d; }
    .g-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .g-modes .px-btn { padding: 18px 10px; font-size: 12px; }
    @media (max-width: 640px) { .g-info, .g-modes { grid-template-columns: 1fr; } }
    /* Arcade */
    .g-arc { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; padding: 12px; align-items: start; }
    .g-arc .scr { position: relative; grid-column: 2; height: min(calc(100dvh - 190px), 760px); aspect-ratio: 180 / 320; max-width: calc(100vw - 24px); }
    .g-arc .scr canvas { width: 100%; height: 100%; touch-action: none; }
    .g-arc .crt::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,.45)); }
    .g-ov { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(13,13,20,.82); text-align: center; padding: 14px; }
    .g-ov .box { display: grid; gap: 14px; justify-items: center; }
    .g-side { display: grid; gap: 10px; align-content: start; justify-items: start; grid-column: 3; grid-row: 1; }
    .g-gauges { grid-column: 1; grid-row: 1; justify-self: end; display: grid; gap: 10px; justify-items: center; }
    .g-gauges canvas { width: 170px; aspect-ratio: 1; }
    .g-gauges .gtag { font-size: 9px; color: #8f8aa8; }
    .g-pad { display: none; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
    .g-pad .px-btn { padding: 18px 4px; font-size: 14px; }
    @media (max-width: 760px), (pointer: coarse) {
      .g-arc { grid-template-columns: 1fr; justify-items: center; gap: 8px; }
      .g-arc .scr { grid-column: 1; grid-row: auto; height: min(calc(100dvh - 350px), 640px); }
      .g-gauges { grid-column: 1; grid-row: auto; justify-self: center; display: flex; align-items: center; gap: 10px; }
      .g-gauges canvas { width: 84px; }
      .g-side { grid-column: 1; grid-row: auto; grid-template-columns: repeat(3, auto); }
      .g-pad { display: grid; width: min(100%, 420px); }
    }
    /* Phone held sideways: gauges | road | controls, all on one screen. */
    @media (orientation: landscape) and (max-height: 540px) {
      .g-arc { grid-template-columns: auto auto auto; justify-content: center; justify-items: center; align-items: center; padding: 6px; gap: 12px; }
      .g-arc .scr { grid-column: 2; grid-row: 1 / span 2; height: calc(100dvh - 60px); }
      .g-gauges { grid-column: 1; grid-row: 1 / span 2; display: grid; }
      .g-gauges canvas { width: min(120px, calc(50dvh - 50px)); }
      .g-side { grid-column: 3; grid-row: 1; grid-template-columns: repeat(3, auto); }
      .g-pad { grid-column: 3; grid-row: 2; display: grid; grid-template-columns: 1fr 1fr; width: 220px; }
    }
    /* Engine lab */
    .g-lab { flex: 1; display: grid; gap: 12px; padding: 12px; max-width: 1200px; width: 100%; margin: 0 auto; align-content: start; }
    .g-dash { display: grid; grid-template-columns: 1fr 1.7fr 1fr; gap: 8px; align-items: center; background: #0a0a10; border: 3px solid #2b2b3d; padding: 10px; }
    .g-dash canvas { width: 100%; aspect-ratio: 1; }
    .g-dash .car { aspect-ratio: 160 / 90; }
    .g-status { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .g-status .panel { padding: 8px 10px; } .g-status b { display: block; font-size: 13px; color: #ffd24d; margin-top: 4px; }
    .g-msg { min-height: 2.6em; color: #ff9aa8; }
    .g-ctrl { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
    .g-pedals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .g-pedals .px-btn { padding: 22px 4px; }
    .g-gears { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .g-gears .px-btn { padding: 12px 4px; }
    .g-thr { width: 100%; height: 8px; background: #2b2b3d; margin-top: 6px; } .g-thr i { display: block; height: 100%; background: #7fd19b; width: 0; }
    @media (max-width: 760px) { .g-ctrl { grid-template-columns: 1fr; } .g-status { grid-template-columns: repeat(3, 1fr); } .g-dash { gap: 4px; padding: 6px; } }
  </style>`;
  const gar = root.querySelector('#gar');

  // Each screen gets its own engine sound + loop + listeners, torn down on exit.
  function screen(build) {
    view?.();
    const ac = new AbortController(), stops = [];
    const s = {
      signal: ac.signal,
      loop: fn => { const l = api.loop(fn); stops.push(l.stop); return l; },
      engine: null,
      ensureEngine(car) {
        if (!api.audio.ensure()) return null;
        if (!s.engine || s.engine.car !== car) { s.engine?.destroy(); s.engine = new EngineSound(api.audio, api.bus(), car); s.engine.vol = engVol; }
        return s.engine;
      },
    };
    view = () => { ac.abort(); stops.forEach(f => f()); s.engine?.destroy(); s.engine = null; };
    build(s);
    initRanges(gar);
  }
  const car = () => CARS[carIdx];
  const colorOf = c => colors[c.id] || c.colors[0];

  // ================= GARAGE HOME =================
  function home() {
    screen(s => {
      gar.innerHTML = `<div class="g-home">
        <div class="row" style="justify-content:space-between"><h2>GARAGE</h2><span class="muted2">SELECT YOUR RIDE</span></div>
        <div class="g-show panel"><canvas id="show" width="160" height="72" aria-label="Selected car"></canvas>
          <div class="g-arrows"><button class="px-btn dark" id="prev" aria-label="Previous car">◀</button><button class="px-btn dark" id="next" aria-label="Next car">▶</button></div></div>
        <div class="g-info">
          <div class="panel"><div id="nm" style="font-size:14px;color:#fff"></div><div id="ty" class="muted2"></div>
            <div class="g-sw" id="sw"></div></div>
          <div class="panel" id="stats"></div>
        </div>
        <div class="row" style="justify-content:center"><button class="px-btn alt" id="rev">HOLD TO REV</button><span class="muted2" id="revHint">Starts the engine</span></div>
        <div class="g-modes"><button class="px-btn" id="arc">▶ ARCADE DRIVE</button><button class="px-btn red" id="lab">⚙ ENGINE LAB</button></div>
        <p class="muted2" style="text-align:center">Fictional cars. Sounds are synthesised live.</p>
      </div>`;
      const $ = q => gar.querySelector(q);
      const cv = $('#show'), ctx = cv.getContext('2d');
      let rev = { on: false, rpm: 0, t: 0, run: false }, spin = 0;
      function paint() {
        const c = car();
        $('#nm').textContent = c.name; $('#ty').textContent = c.type.toUpperCase();
        $('#sw').innerHTML = c.colors.map(k => `<button style="background:${k}" data-c="${k}" aria-label="Colour ${k}" aria-pressed="${k === colorOf(c)}"></button>`).join('');
        $('#stats').innerHTML = Object.entries(c.stats).map(([k, v]) => `<div class="g-stat"><span>${k.toUpperCase()}</span><span class="g-bar">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span></div>`).join('') + `<div class="muted2" style="margin-top:6px">BEST ${api.load('best:casual:' + c.id, 0)} · ${c.cyl} CYL${c.turbo ? ' TURBO' : ''}</div>`;
      }
      const go = d => { carIdx = (carIdx + d + CARS.length) % CARS.length; api.save('car', car().id); s.engine?.destroy(); s.engine = null; rev.run = false; paint(); api.audio.ensure() && api.audio.tone(api.bus(), { freq: 440, to: 660, dur: 0.06, type: 'square', vol: 0.05 }); };
      $('#prev').onclick = () => go(-1); $('#next').onclick = () => go(1);
      $('#sw').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { colors[car().id] = b.dataset.c; api.save('colors', colors); paint(); } };
      const revBtn = $('#rev');
      const down = e => { e.preventDefault(); revBtn.classList.add('is-down'); const en = s.ensureEngine(car()); if (!en) return; if (!rev.run) { en.starter(); rev.t = 0.7; rev.run = true; } rev.on = true; };
      const up = () => { revBtn.classList.remove('is-down'); rev.on = false; };
      revBtn.addEventListener('pointerdown', down, { signal: s.signal });
      revBtn.addEventListener('pointerup', up, { signal: s.signal }); revBtn.addEventListener('pointerleave', up, { signal: s.signal });
      revBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); }, { signal: s.signal });
      revBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); }, { signal: s.signal });
      $('#arc').onclick = arcade; $('#lab').onclick = lab;
      paint();
      s.loop(dt => {
        const c = car();
        if (rev.run) {
          if (rev.t > 0) { rev.t -= dt; rev.rpm = 250; }
          else { const target = rev.on ? c.red * 0.92 : c.idle; rev.rpm += (target - rev.rpm) * Math.min(1, dt * (rev.on ? 3 : 2)); }
          s.engine?.set(rev.rpm, rev.on ? 1 : 0, rev.t <= 0);
        }
        spin += dt * 0.5;
        ctx.fillStyle = '#12121c'; ctx.fillRect(0, 0, 160, 72);
        ctx.fillStyle = '#1b1b2a'; for (let y = 0; y < 44; y += 6) ctx.fillRect(0, y, 160, 4); // roller door
        ctx.fillStyle = '#26263a'; ctx.fillRect(0, 52, 160, 20);
        ctx.fillStyle = '#33334d'; ctx.fillRect(20, 58, 120, 6); ctx.fillStyle = '#ffd24d'; for (let x = 0; x < 160; x += 16) ctx.fillRect(x + ((spin * 8) % 16), 66, 8, 2);
        const bob = rev.run && rev.t <= 0 ? Math.round(Math.sin(performance.now() / (40 - rev.rpm / 400)) * (rev.rpm > c.red * 0.5 ? 1 : 0.5)) : 0;
        sideCar(ctx, 80, 58, c, colorOf(c), 0, bob);
        if (rev.on && rev.t <= 0) { ctx.fillStyle = 'rgba(200,200,220,.5)'; ctx.fillRect(44 - Math.random() * 8, 50 + Math.random() * 3, 3, 2); }
      });
    });
  }

  // ================= ARCADE DRIVE =================
  function arcade() {
    screen(s => {
      let diff = api.load('diff', 'casual'), crt = api.load('crt', true);
      gar.innerHTML = `<div class="g-arc">
        <div class="g-gauges"><canvas id="aRpm" width="200" height="200" aria-label="RPM gauge"></canvas><canvas id="aSpd" width="200" height="200" aria-label="Speed gauge"></canvas><span class="gtag">AUTO GEARBOX</span></div>
        <div class="scr ${crt ? 'crt' : ''}" id="scr"><canvas id="cv" width="${VW}" height="${VH}" aria-label="Arcade Drive. Arrow keys change lane, up accelerates, down brakes, P pauses."></canvas>
          <div class="g-ov" id="ov"><div class="box" id="ovb"></div></div></div>
        <div class="g-side"><button class="px-btn dark" id="back">◀ GARAGE</button><button class="px-btn dark" id="pause">PAUSE</button><button class="px-btn dark" id="crt" aria-pressed="${crt}">CRT</button></div>
        <div class="g-pad"><button class="px-btn dark" id="lL" aria-label="Lane left">◀</button><button class="px-btn red" id="brk">BRAKE</button><button class="px-btn" id="gas">GAS</button><button class="px-btn dark" id="lR" aria-label="Lane right">▶</button></div>
      </div>`;
      const $ = q => gar.querySelector(q);
      const ctx = $('#cv').getContext('2d');
      const c = car(), col = colorOf(c);
      const LANES = [50, 90, 130], MAX = arcadeMax(c);
      let gear = 1, rpm = 0, nR = 0, nS = 0;
      let G = null; // game state
      const best = () => api.load(`best:${diff}:${c.id}`, 0);
      const keys = { gas: false, brake: false };
      const scenery = Array.from({ length: 14 }, (_, i) => ({ y: i * 26, side: i % 2, kind: Math.random() < 0.6 ? 'tree' : 'post', far: Math.random() < 0.5 }));

      function menu(over) {
        $('#ov').hidden = false;
        $('#ovb').innerHTML = over
          ? `<h2>${over.best ? 'NEW BEST!' : 'CRASHED'}</h2><div>SCORE ${over.score}</div><div class="muted2">BEST ${best()}</div><button class="px-btn" id="go">RETRY</button><button class="px-btn dark" id="g2">GARAGE</button>`
          : `<h2>ARCADE<br>DRIVE</h2><div class="muted2">${c.name}</div><div class="row" style="justify-content:center"><button class="px-btn dark" data-d="casual" aria-pressed="${diff === 'casual'}">CASUAL · 3 HITS</button><button class="px-btn dark" data-d="classic" aria-pressed="${diff === 'classic'}">CLASSIC · 1 HIT</button></div><div class="muted2">BEST ${best()}</div><button class="px-btn" id="go">START</button><div class="muted2" style="max-width:230px">ARROWS / A D OR SWIPE TO CHANGE LANE. UP = GAS, DOWN = BRAKE.</div>`;
        $('#go').onclick = start; $('#go').focus();
        $('#g2')?.addEventListener('click', home);
        gar.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { diff = b.dataset.d; api.save('diff', diff); menu(); });
      }
      function start() {
        s.ensureEngine(c); gear = 1;
        G = { t: 0, lane: 1, x: LANES[1], v: 140, dist: 0, score: 0, bonus: 0, obs: [], spawn: 0.8, hp: diff === 'casual' ? 3 : 1, inv: 0, scroll: 0, phase: 0, paused: false, pops: [], shake: 0 };
        $('#ov').hidden = true; $('#cv').focus?.();
      }
      function lane(d) {
        if (!G || G.paused) return;
        const n = Math.max(0, Math.min(2, G.lane + d));
        if (n !== G.lane) { G.lane = n; api.audio.ctx && api.audio.tone(api.bus(), { freq: 300, to: 420, dur: 0.05, type: 'square', vol: 0.04 }); api.haptics.pulse('tick'); }
      }
      function pause(p = !G?.paused) {
        if (!G) return;
        G.paused = p;
        if (p) { $('#ov').hidden = false; $('#ovb').innerHTML = `<h2>PAUSED</h2><button class="px-btn" id="res">RESUME</button><button class="px-btn dark" id="rst">RESTART</button><button class="px-btn dark" id="g2">GARAGE</button>`; $('#res').onclick = () => pause(false); $('#rst').onclick = start; $('#g2').onclick = home; $('#res').focus(); }
        else $('#ov').hidden = true;
      }
      function crash(o) {
        G.shake = 0.35;
        api.audio.burst(api.bus(), { dur: 0.4, vol: 0.5, type: 'lowpass', freq: 1200, to: 200, kind: 'pink' });
        api.audio.tone(api.bus(), { freq: 120, to: 40, dur: 0.3, type: 'square', vol: 0.15 });
        api.haptics.pulse('bump');
        G.hp--; G.inv = 1.5; G.v = Math.max(110, G.v * 0.55); o.hit = true;
        if (G.hp <= 0) {
          const score = Math.floor(G.score), isBest = score > best();
          if (isBest) api.save(`best:${diff}:${c.id}`, score);
          s.engine?.set(0, 0, false);
          G = null; menu({ score, best: isBest });
        }
      }
      function spawn() {
        const top = G.obs.filter(o => o.y < 60);
        const free = [0, 1, 2].filter(l => !top.some(o => o.lane === l || o.to === l));
        if (free.length <= 1) return; // always leave an escape lane
        const l = free[Math.floor(Math.random() * free.length)];
        const r = Math.random(), lvl = Math.min(1, G.t / 120);
        let o;
        if (r < 0.5) o = { kind: 'car', v: 50 + Math.random() * 70, col: ['#9c8cff', '#5fd3a8', '#e9e1d4', '#f2994a', '#5cb8ff'][Math.floor(Math.random() * 5)], car: CARS[Math.floor(Math.random() * CARS.length)] };
        else if (r < 0.7) o = { kind: 'cone', v: 0 };
        else if (r < 0.85) o = { kind: 'barrier', v: 0 };
        else o = { kind: 'mover', v: 70, col: '#ffd24d', car: CARS[0], blink: 0 };
        if (o.kind === 'mover' && lvl < 0.15) o.kind = 'car';
        Object.assign(o, { lane: l, x: LANES[l], y: -30 });
        G.obs.push(o);
      }
      const box = o => o.kind === 'cone' ? [7, 9] : o.kind === 'barrier' ? [16, 6] : [7, 13];

      // Input
      addEventListener('keydown', e => {
        if (document.getElementById('modal').open) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') { e.preventDefault(); lane(-1); }
        else if (k === 'arrowright' || k === 'd') { e.preventDefault(); lane(1); }
        else if (k === 'arrowup' || k === 'w') { e.preventDefault(); keys.gas = true; }
        else if (k === 'arrowdown' || k === 's') { e.preventDefault(); keys.brake = true; }
        else if (k === 'p' || k === 'escape') pause();
      }, { signal: s.signal });
      addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') keys.gas = false; if (k === 'arrowdown' || k === 's') keys.brake = false; }, { signal: s.signal });
      let sx = null;
      $('#cv').addEventListener('pointerdown', e => { sx = e.clientX; api.audio.ensure(); }, { signal: s.signal });
      $('#cv').addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 24) lane(Math.sign(dx)); else { const r = e.target.getBoundingClientRect(); lane(e.clientX < r.left + r.width / 2 ? -1 : 1); } }, { signal: s.signal });
      const hold = (id, key) => { const b = $(id); const on = e => { e.preventDefault(); keys[key] = true; b.classList.add('is-down'); }, off = () => { keys[key] = false; b.classList.remove('is-down'); }; b.addEventListener('pointerdown', on, { signal: s.signal }); b.addEventListener('pointerup', off, { signal: s.signal }); b.addEventListener('pointerleave', off, { signal: s.signal }); };
      hold('#gas', 'gas'); hold('#brk', 'brake');
      $('#lL').onclick = () => lane(-1); $('#lR').onclick = () => lane(1);
      $('#back').onclick = home; $('#pause').onclick = () => pause();
      $('#crt').onclick = () => { crt = !crt; api.save('crt', crt); $('#crt').setAttribute('aria-pressed', crt); $('#scr').classList.toggle('crt', crt); };
      addEventListener('blur', () => { if (G && !G.paused) pause(true); }, { signal: s.signal });

      s.loop(dt => {
        const max = MAX;
        if (G && !G.paused) {
          G.t += dt;
          const cruise = Math.min(max * 0.75, 150 + G.t * 1.6);
          const target = keys.gas ? max : keys.brake ? 90 : cruise;
          G.v += (target - G.v) * Math.min(1, dt * (keys.brake ? 2.2 : 0.9));
          G.scroll += G.v * dt; G.dist += G.v * dt * 0.05; G.phase += G.v * dt * 0.25;
          G.score = G.dist + G.bonus;
          G.x += (LANES[G.lane] - G.x) * Math.min(1, dt * c.arcade.lane);
          G.inv = Math.max(0, G.inv - dt); G.shake = Math.max(0, G.shake - dt);
          G.spawn -= dt * (G.v / 200);
          if (G.spawn <= 0) { spawn(); G.spawn = Math.max(0.42, 1.15 - G.t / 160) * (0.7 + Math.random() * 0.6); }
          for (const o of G.obs) {
            o.y += (G.v - o.v) * dt;
            if (o.kind === 'mover') { o.blink += dt; if (o.to == null && o.y > 40 && o.y < 120) { const opts = [o.lane - 1, o.lane + 1].filter(l => l >= 0 && l <= 2); o.to = opts[Math.floor(Math.random() * opts.length)]; } if (o.to != null && o.blink > 0.8) { o.x += (LANES[o.to] - o.x) * Math.min(1, dt * 3); if (Math.abs(o.x - LANES[o.to]) < 1) o.lane = o.to; } }
            const [bw, bh] = box(o);
            if (!o.hit && G.inv <= 0 && Math.abs(o.x - G.x) < bw + 6 && Math.abs(o.y - 250) < bh + 12) { crash(o); if (!G) break; }
            if (!o.passed && o.y > 262 && !o.hit) { o.passed = true; if (Math.abs(o.x - G.x) < 46) { G.bonus += 50; G.pops.push({ x: G.x, y: 230, t: 1, txt: '+50' }); api.audio.ctx && api.audio.tone(api.bus(), { freq: 880, to: 1320, dur: 0.08, type: 'square', vol: 0.05 }); } }
          }
          if (G) {
            G.obs = G.obs.filter(o => o.y < VH + 40);
            const box2 = autoBox(c, G.v * 0.6, gear);
            if (box2.gear !== gear) { s.engine?.shift(); gear = box2.gear; }
            rpm = box2.rpm;
            s.engine?.set(rpm, keys.gas ? 1 : keys.brake ? 0 : 0.35, true);
          }
        }
        draw(dt);
        // Gauges: real values from the auto-box; needles fall back to rest when not driving.
        const kmh = G ? G.v * 0.6 : 0;
        nR += ((G ? rpm : 0) - nR) * Math.min(1, dt * 12); nS += (kmh - nS) * Math.min(1, dt * 8);
        gauge($('#aRpm'), nR / 1000, Math.ceil(c.red / 1000) + 1, c.red / 1000, 'RPM x1000', G ? String(gear) : '-', 1, v => v);
        gauge($('#aSpd'), nS, c.topKmh, 0, 'KM/H', String(Math.round(nS)).padStart(3, '0'), c.topKmh / 6, v => Math.round(v));
      });

      function draw() {
        const sh = G?.shake ? Math.round((Math.random() - 0.5) * 4) : 0;
        ctx.save(); ctx.translate(sh, 0);
        const sc = G ? G.scroll : performance.now() / 10;
        // Dithered grass, two-tone checker that scrolls
        for (let y = -2; y < VH; y += 2) for (let x = 0; x < VW; x += 2) {
          if (x >= 26 && x < 154) { x = 152; continue; }
          ctx.fillStyle = ((x + Math.floor((y + sc) / 2) * 2) & 2) ? '#2f6b3e' : '#367a46';
          ctx.fillRect(x, y, 2, 2);
        }
        ctx.fillStyle = '#2b2a33'; ctx.fillRect(30, 0, 120, VH);
        for (let y = -16; y < VH + 16; y += 16) { const yy = y + (sc % 16); ctx.fillStyle = ((Math.floor((y - sc) / 16)) & 1) ? '#e9e1d4' : '#ff5d73'; ctx.fillRect(26, yy, 4, 16); ctx.fillRect(150, yy, 4, 16); }
        ctx.fillStyle = '#f2c14e';
        for (let y = -40; y < VH + 40; y += 40) { const yy = y + (sc % 40); ctx.fillRect(69, yy, 2, 20); ctx.fillRect(109, yy, 2, 20); }
        // Parallax roadside scenery: far items move at half speed.
        for (const p of scenery) {
          const yy = ((p.y + sc * (p.far ? 0.5 : 1)) % (VH + 40)) - 20, x = p.side ? (p.far ? 168 : 160) : (p.far ? 6 : 14);
          if (p.kind === 'tree') { ctx.fillStyle = p.far ? '#24563a' : '#1e4a2e'; ctx.fillRect(x - 5, yy - 6, 10, 10); ctx.fillStyle = '#4e9a5c'; ctx.fillRect(x - 3, yy - 5, 4, 3); ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 1, yy + 4, 2, 3); }
          else { ctx.fillStyle = '#d8d0c4'; ctx.fillRect(x - 1, yy, 2, 7); ctx.fillStyle = '#ff5d73'; ctx.fillRect(x - 1, yy, 2, 2); }
        }
        if (G) {
          for (const o of G.obs) {
            if (o.kind === 'cone') drawCone(ctx, Math.round(o.x), Math.round(o.y));
            else if (o.kind === 'barrier') { for (let k = 0; k < 8; k++) { ctx.fillStyle = k & 1 ? '#fff' : '#ff5d73'; ctx.fillRect(o.x - 16 + k * 4, o.y - 4, 4, 8); } ctx.fillStyle = '#555'; ctx.fillRect(o.x - 14, o.y + 4, 2, 3); ctx.fillRect(o.x + 12, o.y + 4, 2, 3); }
            else {
              ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.PI); topCar(ctx, 0, 0, o.car, o.col, 0, false); ctx.restore();
              if (o.kind === 'mover' && o.to != null && Math.floor(o.blink * 6) % 2) { ctx.fillStyle = '#ffb300'; const sx2 = o.to < o.lane ? o.x - 8 : o.x + 6; ctx.fillRect(sx2, o.y - 13, 2, 2); ctx.fillRect(sx2, o.y + 11, 2, 2); }
            }
          }
          if (!(G.inv > 0 && Math.floor(G.inv * 10) % 2)) topCar(ctx, G.x, 250, c, col, G.phase, keys.brake);
          if (G.v > MAX * 0.7 && !api.reducedMotion()) { // wind streaks
            ctx.fillStyle = 'rgba(255,255,255,.5)';
            for (let k = 0; k < 6; k++) { const yy = (k * 57 + sc * 2.5) % VH; ctx.fillRect(34 + (k * 23) % 112, yy, 1, 10 + (G.v - MAX * 0.7) / 10); }
          }
          for (const p of G.pops) { p.t -= 1 / 60; p.y -= 0.4; ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = '#ffd24d'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText(p.txt, p.x - 12, p.y); ctx.globalAlpha = 1; }
          G.pops = G.pops.filter(p => p.t > 0);
          // HUD
          ctx.fillStyle = 'rgba(13,13,20,.75)'; ctx.fillRect(0, 0, VW, 18);
          ctx.fillStyle = '#fff'; ctx.font = '7px "Press Start 2P", monospace';
          ctx.fillText(String(Math.floor(G.score)).padStart(6, '0'), 4, 12);
          ctx.fillStyle = '#7fd19b'; ctx.fillText(`${Math.round(G.v * 0.6)}KMH`, 62, 12);
          ctx.fillStyle = '#ff5d73'; for (let k = 0; k < G.hp; k++) { const hx = 150 + k * 9; ctx.fillRect(hx, 6, 3, 2); ctx.fillRect(hx + 4, 6, 3, 2); ctx.fillRect(hx, 8, 7, 2); ctx.fillRect(hx + 1, 10, 5, 1); ctx.fillRect(hx + 2, 11, 3, 1); ctx.fillRect(hx + 3, 12, 1, 1); } // pixel hearts
          ctx.fillStyle = '#8f8aa8'; ctx.fillText('HI ' + best(), 4, VH - 4);
        }
        ctx.restore();
      }
      menu();
    });
  }

  // ================= ENGINE LAB =================
  function lab() {
    screen(s => {
      const c = car(), col = colorOf(c);
      const D = makeDrive(c);
      let needleR = 0, needleS = 0, wheelAng = 0, scene = 0, script = null, puffs = [];
      const max = c.ratios.length;
      gar.innerHTML = `<div class="g-lab">
        <div class="row" style="justify-content:space-between"><button class="px-btn dark" id="back">◀ GARAGE</button><span class="muted2">${c.name} · SIMPLIFIED DRIVETRAIN MODEL</span></div>
        <div class="g-dash"><canvas id="rpm" width="200" height="200" aria-label="RPM gauge"></canvas><canvas id="car" class="car" width="160" height="90" aria-label="Car"></canvas><canvas id="spd" width="200" height="200" aria-label="Speed gauge"></canvas></div>
        <div class="g-status" aria-live="polite">
          <div class="panel">GEAR<b id="sG">N</b></div><div class="panel">CLUTCH<b id="sC">IN</b></div><div class="panel">THROTTLE<b id="sT">0%</b><div class="g-thr"><i id="tb"></i></div></div><div class="panel">ENGINE<b id="sE">OFF</b></div><div class="panel">SPEED<b id="sS">0</b></div>
        </div>
        <div class="g-msg" id="msg">Press IGNITION (I) to start. Hold the clutch (Space) to change gear.</div>
        <div class="g-ctrl">
          <div class="panel" style="display:grid;gap:10px">
            <div class="g-pedals"><button class="px-btn" id="ign">IGNITION</button><button class="px-btn dark" id="clu">CLUTCH</button><button class="px-btn red" id="brk">BRAKE</button><button class="px-btn alt" id="thr">THROTTLE</button></div>
            <label class="muted2" style="display:grid;gap:4px">THROTTLE (SLIDER)<input type="range" id="thrR" min="0" max="1" step="0.01" value="0"></label>
          </div>
          <div class="panel" style="display:grid;gap:10px">
            <div class="g-gears" id="gears">${['R', 'N', ...c.ratios.map((_, i) => i + 1)].map(g => `<button class="px-btn dark" data-g="${g === 'R' ? -1 : g === 'N' ? 0 : g}">${g}</button>`).join('')}</div>
            <div class="row"><button class="px-btn dark" id="gd">▼ GEAR (Q)</button><button class="px-btn dark" id="gu">▲ GEAR (E)</button></div>
          </div>
        </div>
        <div class="panel" style="display:grid;gap:10px"><div>SOUND TEST <span class="muted2">(engine off)</span></div>
          <div class="row" id="tests">${['IDLE', 'REV', 'ACCEL', 'SHIFT', 'DECEL'].map(t => `<button class="px-btn dark" data-t="${t}">${t}</button>`).join('')}</div>
          <div class="row"><span>CAR</span>${CARS.map((k, i) => `<button class="px-btn dark" data-car="${i}" aria-pressed="${i === carIdx}">${k.name}</button>`).join('')}</div>
          <label class="muted2" style="display:grid;gap:4px;max-width:320px">ENGINE VOLUME<input type="range" id="ev" min="0" max="1" step="0.01" value="${engVol}"></label>
        </div>
      </div>`;
      const $ = q => gar.querySelector(q);
      const say = m => { $('#msg').textContent = m; };
      const en = () => s.ensureEngine(c);
      setRange($('#ev'), engVol);

      $('#back').onclick = home;
      const ign = () => {
        const e = en();
        if (D.running || D.cranking > 0) { D.running = false; D.cranking = 0; D.status = 'Off'; say('Engine off.'); return; }
        const err = tryStart(D); if (err) { say(err); api.haptics.pulse('bump'); return; }
        script = null; e?.starter(); say('Cranking…'); api.haptics.pulse('thud');
      };
      $('#ign').onclick = ign;
      const shift = g => {
        const r = tryShift(D, g); en();
        if (r.ok) { s.engine?.shift(); api.haptics.pulse('click'); say(g === -1 ? 'Reverse selected.' : g === 0 ? 'Neutral.' : `Gear ${g}. Ease off the clutch${D.v < 1 && g === 1 ? ' with a little throttle' : ''}.`); }
        else { if (r.grind) { s.engine?.grind(); api.haptics.pulse('bump'); } if (r.msg) say(r.msg); }
        paintGears();
      };
      const paintGears = () => gar.querySelectorAll('#gears [data-g]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.g === D.gear));
      $('#gears').onclick = e => { const b = e.target.closest('[data-g]'); if (b) shift(+b.dataset.g); };
      $('#gu').onclick = () => shift(Math.min(max, D.gear + 1)); $('#gd').onclick = () => shift(Math.max(-1, D.gear - 1));
      const hold = (id, on, off) => { const b = $(id); const dn = e => { e.preventDefault(); en(); b.classList.add('is-down'); on(); }, up = () => { if (!b.classList.contains('is-down')) return; b.classList.remove('is-down'); off(); }; b.addEventListener('pointerdown', dn, { signal: s.signal }); b.addEventListener('pointerup', up, { signal: s.signal }); b.addEventListener('pointerleave', up, { signal: s.signal }); b.addEventListener('pointercancel', up, { signal: s.signal }); };
      hold('#clu', () => { D.clutchIn = 1; s.engine?.clutch(); }, () => { D.clutchIn = 0; });
      hold('#brk', () => { D.brake = 1; }, () => { D.brake = 0; });
      hold('#thr', () => { D.thrIn = 1; }, () => { D.thrIn = +$('#thrR').value; });
      $('#thrR').oninput = e => { D.thrIn = +e.target.value; en(); };
      $('#ev').oninput = e => { engVol = +e.target.value; api.save('engVol', engVol); if (s.engine) s.engine.vol = engVol; };
      gar.querySelectorAll('[data-car]').forEach(b => b.onclick = () => { carIdx = +b.dataset.car; api.save('car', car().id); lab(); });
      const held = new Set();
      addEventListener('keydown', e => {
        if (document.getElementById('modal').open || /INPUT/.test(document.activeElement?.tagName) && e.key !== ' ') return;
        const k = e.key.toLowerCase();
        if (e.repeat && !['arrowup', 'w'].includes(k)) { if (k === ' ') e.preventDefault(); return; }
        if (k === ' ') { e.preventDefault(); en(); if (!held.has(' ')) s.engine?.clutch(); held.add(' '); D.clutchIn = 1; }
        else if (k === 'w' || k === 'arrowup') { e.preventDefault(); en(); D.thrIn = 1; }
        else if (k === 's' || k === 'arrowdown') { e.preventDefault(); D.brake = 1; }
        else if (k === 'e') shift(Math.min(max, D.gear + 1));
        else if (k === 'q') shift(Math.max(-1, D.gear - 1));
        else if (k === 'i') ign();
        else if (k === 'n') shift(0);
        else if (k === 'r') shift(-1);
        else if (/^[1-6]$/.test(k)) shift(+k);
      }, { signal: s.signal });
      addEventListener('keyup', e => {
        const k = e.key.toLowerCase();
        if (k === ' ') { held.delete(' '); D.clutchIn = 0; }
        if (k === 'w' || k === 'arrowup') D.thrIn = +$('#thrR').value;
        if (k === 's' || k === 'arrowdown') D.brake = 0;
      }, { signal: s.signal });

      // Sound test: scripted RPM curves through the same synth while the engine is off.
      const SCRIPTS = {
        IDLE: [[0, c.idle, 0], [3, c.idle, 0]],
        REV: [[0, c.idle, 0], [0.35, c.red * 0.75, 1], [0.9, c.idle * 1.1, 0], [1.3, c.red * 0.85, 1], [2, c.idle, 0], [2.6, c.idle, 0]],
        ACCEL: [[0, c.idle * 1.4, 1], [2.2, c.red * 0.97, 1], [2.3, c.red * 0.6, 0.1, 'shift'], [2.5, c.red * 0.6, 1], [4.6, c.red * 0.97, 1], [4.7, c.red * 0.65, 0.1, 'shift'], [4.9, c.red * 0.65, 1], [6.5, c.red * 0.9, 1], [7, c.idle * 1.3, 0]],
        SHIFT: [[0, c.red * 0.85, 1], [0.15, c.red * 0.55, 0.05, 'shift'], [0.6, c.red * 0.6, 0.8], [1.2, c.red * 0.6, 0.8]],
        DECEL: [[0, c.red * 0.9, 0, 'pop'], [3.2, c.idle, 0], [3.6, c.idle, 0]],
      };
      $('#tests').onclick = e => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        if (D.running || D.cranking > 0) { say('Stop the engine (Ignition) to use the sound test.'); return; }
        en(); script = { k: SCRIPTS[b.dataset.t], t: 0, fired: new Set() };
      };

      const carCv = $('#car'), cctx = carCv.getContext('2d');
      const topKmh = c.topKmh;
      s.loop(dt => {
        if (script) {
          script.t += dt;
          const k = script.k; let i = 0; while (i < k.length - 1 && k[i + 1][0] <= script.t) i++;
          const [t0, r0, th0, ev] = k[i], n = k[i + 1] || k[i];
          const f = n === k[i] ? 1 : (script.t - t0) / (n[0] - t0);
          D.rpm = r0 + (n[1] - r0) * f; D.throttle = th0;
          if (ev && !script.fired.has(i)) { script.fired.add(i); ev === 'shift' ? s.engine?.shift() : null; }
          if (ev === 'pop' && Math.random() < 0.08) s.engine?.pop();
          s.engine?.set(D.rpm, th0, true);
          if (script.t > k[k.length - 1][0]) { script = null; D.rpm = 0; D.throttle = 0; s.engine?.set(0, 0, false); }
        } else {
          const ev = [];
          for (let k = 0; k < 8; k++) stepDrive(D, dt / 8, ev);
          if (ev.includes('stall')) { say(D.msg); api.haptics.pulse('bump'); s.engine?.clutch(); }
          if (ev.includes('started')) say('Engine running. Clutch in, select 1st, then ease the clutch out with some throttle.');
          if (D.status === 'Redline' && Math.random() < 0.02) api.haptics.pulse('tick');
          s.engine?.set(D.rpm, D.running ? D.throttle : 0, D.running);
          if (D.running && c.id !== 'mote' && D.thrIn === 0 && D.rpm > c.red * 0.6 && Math.random() < 0.03) s.engine?.pop();
        }
        const kmh = Math.abs(D.v) * 3.6;
        needleR += (D.rpm - needleR) * Math.min(1, dt * 14);
        needleS += (kmh - needleS) * Math.min(1, dt * 8);
        const gName = D.gear === -1 ? 'R' : D.gear === 0 ? 'N' : String(D.gear);
        gauge($('#rpm'), needleR / 1000, Math.ceil(c.red / 1000) + 1, c.red / 1000, 'RPM x1000', gName, 1, v => v);
        gauge($('#spd'), needleS, topKmh, 0, 'KM/H', String(Math.round(kmh)).padStart(3, '0'), topKmh / 6, v => Math.round(v));
        $('#sG').textContent = gName;
        $('#sC').textContent = D.clutch > 0.7 ? 'PRESSED' : D.clutch > 0.2 ? 'SLIPPING' : 'ENGAGED';
        $('#sT').textContent = Math.round(D.throttle * 100) + '%'; $('#tb').style.width = D.throttle * 100 + '%';
        $('#sE').textContent = script ? 'TEST' : D.status.toUpperCase();
        $('#sE').style.color = D.status === 'Redline' || D.status === 'Stalled' ? '#ff3b55' : '';
        $('#sS').textContent = Math.round(kmh);
        // Car scene: wheels and wind only move with simulated speed.
        const W = 160, H = 90;
        wheelAng += (D.v * dt / 0.32);
        scene += D.v * dt * 12;
        cctx.fillStyle = '#16162a'; cctx.fillRect(0, 0, W, H);
        cctx.fillStyle = '#1f1f38'; for (let k = 0; k < 8; k++) { const x = ((k * 34 - scene * 0.3) % 272 + 272) % 272 - 40; cctx.fillRect(x, 30 - (k % 3) * 6, 22, 40 + (k % 3) * 6); }
        cctx.fillStyle = '#2b2a33'; cctx.fillRect(0, 68, W, 22);
        cctx.fillStyle = '#f2c14e'; for (let x = -32; x < W + 32; x += 32) cctx.fillRect(((x - scene) % 192 + 192) % 192 - 32, 78, 16, 2);
        const bob = D.running ? (Math.sin(performance.now() / (25 + 5000 / Math.max(500, D.rpm))) > 0.3 ? 1 : 0) : 0;
        sideCar(cctx, 80, 70, c, col, wheelAng, bob);
        if (kmh > 15 && !api.reducedMotion()) { cctx.fillStyle = 'rgba(255,255,255,.45)'; const n = Math.min(10, Math.floor(kmh / 15)); for (let k = 0; k < n; k++) { const y = 20 + (k * 37) % 48, x = ((k * 53 - scene * 3) % 200 + 200) % 200 - 20; cctx.fillRect(x, y, 6 + kmh / 12, 1); } }
        if (D.running && D.throttle > 0.3 && Math.random() < D.throttle * 0.5) puffs.push({ x: 50 - (c.id === 'ironclad' ? 4 : 0), y: 64, t: 1 });
        for (const p of puffs) { p.t -= dt * 1.5; p.x -= 20 * dt + D.v * dt * 4; p.y -= 6 * dt; cctx.fillStyle = `rgba(190,190,210,${p.t * 0.5})`; cctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 2); }
        puffs = puffs.filter(p => p.t > 0);
        if (D.status === 'Redline' && Math.floor(performance.now() / 150) % 2) { cctx.fillStyle = '#ff3b55'; cctx.font = '8px "Press Start 2P", monospace'; cctx.fillText('REDLINE', 52, 12); }
      });
      paintGears();
    });
  }

  home();
  return { reset: home, destroy: () => view?.() };
}
