import { icon, clamp } from '../core/ui.js';

const TAU = Math.PI * 2;
const SCENES = [['cradle', "Newton's cradle"], ['wave', 'Pendulum wave'], ['double', 'Double pendulum'], ['bounce', 'Bouncing balls'], ['springs', 'Springs'], ['wells', 'Gravity wells'], ['dominoes', 'Dominoes'], ['free', 'Free build']];
const HUES = ['#ff7a63', '#ffd24d', '#5fd3a8', '#5cb8ff', '#9c8cff', '#f2994a', '#ff6fb5'];

export function mount(root, api) {
  const P = { g: 1, damp: 0.02, e: 0.9, mass: 1, slow: false, paused: false };
  let scene = api.load('scene', 'cradle'), tool = 'ball';
  let balls, links, wells, dominoes, drag = null, lastSnd = 0;

  root.innerHTML = `<div class="stage-wrap">
    <div class="stage" id="stage"><canvas id="cv" aria-label="Physics sandbox. Drag objects to move them."></canvas>
      <div class="hud"><span>Approximate physics · not to scale</span></div>
    </div>
    <aside class="side">
      <section><h2>Experiment</h2><div class="tools" id="scenes">${SCENES.map(([k, l]) => `<button class="tool" data-s="${k}">${l}</button>`).join('')}</div></section>
      <section id="freeTools" hidden><h2>Build tool</h2><div class="seg" id="tool"><button data-t="ball">Ball</button><button data-t="pend">Pendulum</button><button data-t="spring">Spring</button><button data-t="well">Well</button></div><p class="note">Click empty space to place. Drag anything to move it.</p></section>
      <section><h2>World</h2>
        <label class="field"><span class="row">Gravity<output id="gO"></output></span><input type="range" id="g" min="0" max="2.5" step="0.05"></label>
        <label class="field"><span class="row">Damping<output id="dO"></output></span><input type="range" id="d" min="0" max="1" step="0.01"></label>
        <label class="field"><span class="row">Restitution (bounce)<output id="eO"></output></span><input type="range" id="e" min="0" max="1" step="0.01"></label>
        <label class="field"><span class="row">Mass of new balls<output id="mO"></output></span><input type="range" id="m" min="0.5" max="5" step="0.5"></label>
      </section>
      <section><div class="row"><button class="btn" id="pause">${icon('pause')} Pause</button><button class="btn" id="slow" aria-pressed="false">Slow motion</button><button class="btn" id="rs">${icon('reset')} Reset</button></div></section>
    </aside></div>`;
  const $ = s => root.querySelector(s);
  const cv = $('#cv');
  // On rotation/resize: presets are rebuilt to fit the new shape; free-build creations are scaled so nothing is lost off-screen.
  let lastW = 0, lastH = 0;
  const C = api.canvas(cv, { onResize: st => {
    if (!balls) build();
    else if (lastW && (Math.abs(st.w / lastW - 1) > 0.08 || Math.abs(st.h / lastH - 1) > 0.08)) {
      if (scene !== 'free') build();
      else {
        const kx = st.w / lastW, ky = st.h / lastH;
        for (const b of balls) { b.x *= kx; b.y *= ky; b.ox = b.x; b.oy = b.y; }
        for (const w of wells) { w.x *= kx; w.y *= ky; }
        for (const l of links) l.len = Math.hypot(l.a.x - l.b.x, l.a.y - l.b.y);
      }
    }
    lastW = st.w; lastH = st.h;
  } });

  function bindRange(id, key, fmt) {
    const r = $('#' + id), o = $('#' + id + 'O');
    r.value = P[key]; o.textContent = fmt(P[key]);
    r.addEventListener('input', () => { P[key] = +r.value; o.textContent = fmt(P[key]); if (key === 'mass' && drag?.b) { drag.b.m = P.mass; drag.b.r = 10 + P.mass * 4; } });
  }
  bindRange('g', 'g', v => v.toFixed(2) + '×');
  bindRange('d', 'damp', v => v.toFixed(2));
  bindRange('e', 'e', v => v.toFixed(2));
  bindRange('m', 'mass', v => v.toFixed(1));

  const ball = (x, y, r, m, o = {}) => ({ x, y, vx: 0, vy: 0, r, m, pin: false, c: HUES[Math.floor(Math.random() * HUES.length)], ...o });
  const link = (a, b, o = {}) => ({ a, b, len: Math.hypot(a.x - b.x, a.y - b.y), k: 1, ...o });

  function build() {
    const W = C.w, H = C.h;
    if (!W) return;
    balls = []; links = []; wells = []; dominoes = null;
    $('#freeTools').hidden = scene !== 'free';
    root.querySelectorAll('#scenes .tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === scene));
    if (scene === 'cradle') {
      const r = Math.min(26, W / 22), L = Math.min(H * 0.5, 260), y0 = H * 0.18;
      for (let i = 0; i < 5; i++) {
        const x = W / 2 + (i - 2) * (2 * r + 0.5);
        const a = ball(x, y0, 4, 1, { pin: true, hidden: true });
        const b = ball(x, y0 + L, r, 2, { c: 'chrome' });
        if (i === 0) { b.x = x - L * Math.sin(0.7); b.y = y0 + L * Math.cos(0.7); }
        balls.push(a, b); links.push({ a, b, len: L, k: 1 });
      }
      P.e = 0.98; P.damp = 0.01;
    } else if (scene === 'wave') {
      const n = 12, y0 = H * 0.1, top = Math.min(H * 0.78, 420);
      for (let i = 0; i < n; i++) {
        // Lengths chosen so pendulum i completes (20+i) swings in the same span: a wave pattern.
        const L = top * (20 / (20 + i)) ** 2;
        const x = W / 2 + (i - (n - 1) / 2) * Math.min(36, W / (n + 2));
        const a = ball(x, y0, 3, 1, { pin: true, hidden: true });
        const b = ball(x + Math.sin(0.5) * L, y0 + Math.cos(0.5) * L, 11, 1, { c: HUES[i % HUES.length], ghost: true });
        balls.push(a, b); links.push({ a, b, len: L, k: 1, ghost: true });
      }
      P.damp = 0; P.e = 0.9;
    } else if (scene === 'double') {
      const a = ball(W / 2, H * 0.3, 5, 1, { pin: true });
      const L = Math.min(H * 0.22, 150);
      const b = ball(W / 2 + L, H * 0.3, 14, 1, { c: '#ff7a63' });
      const c = ball(W / 2 + 2 * L, H * 0.3, 14, 1, { c: '#5cb8ff', trail: [] });
      balls.push(a, b, c); links.push({ a, b, len: L, k: 1 }, { a: b, b: c, len: L, k: 1 });
      P.damp = 0; P.e = 0.9;
    } else if (scene === 'bounce') {
      for (let i = 0; i < 18; i++) { const m = 0.5 + Math.random() * 3; balls.push(ball(40 + Math.random() * (W - 80), 30 + Math.random() * H * 0.4, 8 + m * 5, m)); }
      P.e = 0.85; P.damp = 0.02;
    } else if (scene === 'springs') {
      // A sagging spring bridge plus three hanging springs.
      const n = 14, y = H * 0.4, x0 = W * 0.1, x1 = W * 0.9;
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const b = ball(x0 + (x1 - x0) * i / n, y, i === 0 || i === n ? 6 : 9, 1, { pin: i === 0 || i === n, c: '#5fd3a8' });
        balls.push(b); if (prev) links.push({ a: prev, b, len: (x1 - x0) / n * 0.9, k: 0.25, spring: true });
        prev = b;
      }
      for (let i = 0; i < 3; i++) {
        const a = ball(W * (0.3 + i * 0.2), H * 0.06, 5, 1, { pin: true });
        const b = ball(a.x, a.y + 90, 16, 1 + i, { c: HUES[i] });
        balls.push(a, b); links.push({ a, b, len: 80, k: 0.08, spring: true });
      }
      P.e = 0.6; P.damp = 0.15;
    } else if (scene === 'wells') {
      wells.push({ x: W * 0.35, y: H * 0.5, s: 1 }, { x: W * 0.68, y: H * 0.45, s: 0.7 });
      for (let i = 0; i < 40; i++) {
        const w = wells[i % 2], a = Math.random() * TAU, d = 60 + Math.random() * 120;
        const b = ball(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 4 + Math.random() * 4, 0.5);
        const v = Math.sqrt(9e5 * w.s / d) * 0.9; b.vx = -Math.sin(a) * v; b.vy = Math.cos(a) * v;
        balls.push(b);
      }
      P.g = 0; P.e = 0.7; P.damp = 0;
    } else if (scene === 'dominoes') {
      dominoes = [];
      let x = W * 0.12;
      const floor = H - 30;
      for (let i = 0; i < 16; i++) {
        const s = 1 + i * 0.05, h = 60 * s, w = 10 * s;
        if (x + w > W * 0.92) break;
        dominoes.push({ x, w, h, th: 0, om: 0, floor, touching: false, c: HUES[i % HUES.length] });
        x += h * 0.55;
      }
    } else {
      P.e = 0.8; P.damp = 0.02;
    }
    if (scene !== 'wells') P.g = 1;
    ['g', 'd', 'e'].forEach(id => { const key = { g: 'g', d: 'damp', e: 'e' }[id]; $('#' + id).value = P[key]; $('#' + id).dispatchEvent(new Event('input', { bubbles: true })); });
    api.save('scene', scene);
  }

  const sndBus = () => api.audio.ctx ? api.bus() : null; // only after a gesture has created audio
  function impact(dv, freq = 2400) {
    const now = performance.now();
    if (dv < 60 || now - lastSnd < 25) return;
    lastSnd = now;
    const v = Math.min(0.35, dv / 2200);
    const bus = sndBus();
    if (bus) { api.audio.burst(bus, { dur: 0.04, vol: v, freq, q: 6 }); api.audio.tone(bus, { freq: freq * 1.9, dur: 0.05, vol: v * 0.3, type: 'sine' }); }
    if (dv > 500) api.haptics.pulse(dv > 1100 ? 'click' : 'tick');
  }

  // ---- Simulation: position-based constraints + sequential impulses for collisions ----
  function step(h) {
    const W = C.w, H = C.h, G = 980 * P.g;
    for (const b of balls) {
      if (b.pin || b === drag?.b) continue;
      b.vy += G * h;
      for (const w of wells) {
        const dx = w.x - b.x, dy = w.y - b.y, d2 = dx * dx + dy * dy + 400, d = Math.sqrt(d2);
        const f = 9e5 * w.s / d2; b.vx += dx / d * f * h; b.vy += dy / d * f * h;
      }
      const k = 1 - P.damp * h * 2; b.vx *= k; b.vy *= k;
      b.ox = b.x; b.oy = b.y; b.x += b.vx * h; b.y += b.vy * h;
    }
    const im = b => (b.pin || b === drag?.b) ? 0 : 1 / b.m;
    for (let it = 0; it < 8; it++) {
      for (const l of links) {
        const { a, b } = l, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        const wa = im(a), wb = im(b), ws = wa + wb; if (!ws) continue;
        const c = (d - l.len) / d * l.k;
        a.x += dx * c * wa / ws; a.y += dy * c * wa / ws; b.x -= dx * c * wb / ws; b.y -= dy * c * wb / ws;
      }
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.hidden || a.ghost) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (b.hidden || b.ghost) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2), wa = im(a), wb = im(b), ws = wa + wb; if (!ws) continue;
          const c = (rr - d) / d;
          a.x -= dx * c * wa / ws; a.y -= dy * c * wa / ws; b.x += dx * c * wb / ws; b.y += dy * c * wb / ws;
        }
        if (!a.pin && a !== drag?.b) { a.x = clamp(a.x, a.r, W - a.r); a.y = clamp(a.y, a.r, H - a.r); }
      }
    }
    for (const b of balls) if (!b.pin && b !== drag?.b) { b.vx = (b.x - b.ox) / h; b.vy = (b.y - b.oy) / h; }
    // Velocity pass: restitution along contact normals; several sweeps so cradle momentum travels down the line.
    for (let sweep = 0; sweep < 4; sweep++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (a.hidden || a.ghost) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (b.hidden || b.ghost) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > a.r + b.r + 0.75 || d === 0) continue;
          const nx = dx / d, ny = dy / d, rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel >= 0) continue;
          const wa = im(a), wb = im(b), ws = wa + wb; if (!ws) continue;
          const jn = -(1 + P.e) * rel / ws;
          a.vx -= jn * wa * nx; a.vy -= jn * wa * ny; b.vx += jn * wb * nx; b.vy += jn * wb * ny;
          if (sweep === 0) impact(-rel, a.c === 'chrome' ? 3200 : 1800);
        }
      }
    }
    for (const b of balls) {
      if (b.pin || b === drag?.b) continue;
      if (b.y >= H - b.r - 0.5 && b.vy > 0) { impact(b.vy, 900); b.vy = -b.vy * P.e; b.vx *= 0.99; }
      if (b.y <= b.r + 0.5 && b.vy < 0) b.vy = -b.vy * P.e;
      if ((b.x <= b.r + 0.5 && b.vx < 0) || (b.x >= W - b.r - 0.5 && b.vx > 0)) { impact(Math.abs(b.vx), 900); b.vx = -b.vx * P.e; }
      if (b.trail) { b.trail.push(b.x, b.y); if (b.trail.length > 600) b.trail.splice(0, 2); }
    }
    if (dominoes) stepDominoes(h);
  }

  // Dominoes: each is a rigid slab pivoting on its front-bottom edge; contact is solved geometrically.
  function stepDominoes(h) {
    const G = 980 * P.g, n = dominoes.length;
    for (let i = 0; i < n; i++) {
      const d = dominoes[i];
      if (d.th <= 0 && d.om <= 0) { d.th = 0; d.om = 0; continue; }
      d.om += (3 * G / (2 * d.h)) * Math.sin(d.th) * h;
      d.om *= 1 - P.damp * h;
      d.th += d.om * h;
      const next = dominoes[i + 1];
      if (next) {
        const gap = next.x - (d.x + d.w);
        const reach = (th) => d.h * Math.sin(th) - d.h * Math.cos(th) * Math.tan(Math.min(next.th, 1.3)) - gap;
        if (reach(d.th) > 0) {
          if (!d.touching) { d.touching = true; next.om = Math.max(next.om, d.om * 0.75); d.om *= 0.35; impact(d.om * 600 + 300, 1400); }
          let lo = 0, hi = d.th; // largest angle that keeps the slabs from overlapping
          for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (reach(m) > 0) hi = m; else lo = m; }
          d.th = lo; d.om = Math.min(d.om, next.om);
          next.om += 0.6 * Math.sin(d.th) * h * 20; // leaning weight keeps pushing
        }
      }
      const maxTh = Math.PI / 2;
      if (d.th >= maxTh) { if (d.om > 1) impact(d.om * 300, 700); d.th = maxTh; d.om = -d.om * 0.15; }
    }
  }

  // ---- Input ----
  const pt = e => [e.offsetX, e.offsetY];
  cv.addEventListener('pointerdown', e => {
    api.audio.ensure(); cv.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    if (dominoes) {
      const hit = dominoes.find(d => x > d.x - 14 && x < d.x + d.w + 14 + d.h * Math.sin(d.th) && y > d.floor - d.h - 10 && y < d.floor) || dominoes[0];
      if (hit && hit.th === 0) { hit.om = 2.2; hit.th = 0.02; }
      return;
    }
    let best = null, bd = 1e9;
    for (const b of balls) { const d = Math.hypot(b.x - x, b.y - y) - b.r; if (d < 14 && d < bd && !b.hidden) { bd = d; best = b; } }
    let well = scene === 'free' && wells.find(w => Math.hypot(w.x - x, w.y - y) < 26);
    if (best) { drag = { b: best, x, y, t: performance.now(), vx: 0, vy: 0 }; return; }
    if (well) { drag = { w: well }; return; }
    if (scene !== 'free') return;
    if (balls.filter(b => !b.pin).length > 120) return api.toast('Object limit reached. Reset to clear');
    const m = P.mass, r = 10 + m * 4;
    if (tool === 'ball') balls.push(ball(x, y, r, m));
    else if (tool === 'well') { if (wells.length < 6) wells.push({ x, y, s: 1 }); }
    else {
      const a = ball(x, y, 5, 1, { pin: true });
      const b = ball(x + 40, y + 110, r, m);
      balls.push(a, b); links.push(tool === 'spring' ? { a, b, len: 90, k: 0.06, spring: true } : link(a, b));
    }
  }, { signal: api.signal });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const [x, y] = pt(e);
    if (drag.w) { drag.w.x = x; drag.w.y = y; return; }
    const now = performance.now(), dt = Math.max(0.008, (now - drag.t) / 1000);
    drag.vx = (x - drag.x) / dt * 0.6 + drag.vx * 0.4; drag.vy = (y - drag.y) / dt * 0.6 + drag.vy * 0.4;
    drag.x = x; drag.y = y; drag.t = now;
    drag.b.x = x; drag.b.y = y;
  }, { signal: api.signal });
  const release = () => {
    if (drag?.b && !drag.b.pin) { drag.b.vx = clamp(drag.vx, -2500, 2500); drag.b.vy = clamp(drag.vy, -2500, 2500); }
    drag = null;
  };
  cv.addEventListener('pointerup', release, { signal: api.signal });
  cv.addEventListener('pointercancel', release, { signal: api.signal });

  $('#scenes').onclick = e => { const b = e.target.closest('.tool'); if (b) { scene = b.dataset.s; build(); } };
  $('#tool').onclick = e => { const b = e.target.closest('button'); if (b) { tool = b.dataset.t; root.querySelectorAll('#tool button').forEach(x => x.setAttribute('aria-pressed', x === b)); } };
  $('#tool button').setAttribute('aria-pressed', 'true');
  $('#pause').onclick = () => { P.paused = !P.paused; $('#pause').innerHTML = P.paused ? `${icon('play')} Play` : `${icon('pause')} Pause`; };
  $('#slow').onclick = () => { P.slow = !P.slow; $('#slow').setAttribute('aria-pressed', P.slow); };
  $('#rs').onclick = build;

  // ---- Render ----
  let acc = 0;
  const H_STEP = 1 / 240;
  api.loop(dt => {
    if (!balls) return;
    if (!P.paused) {
      acc += dt * (P.slow ? 0.25 : 1);
      let n = 0;
      while (acc >= H_STEP && n++ < 16) { step(H_STEP); acc -= H_STEP; }
      if (n >= 16) acc = 0;
    }
    draw();
  });

  function draw() {
    const { ctx, w: W, h: H } = C; if (!W) return;
    ctx.fillStyle = '#0d0c0a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,240,220,.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    if (scene === 'cradle' && balls.length) {
      const xs = balls.filter(b => b.pin).map(b => b.x), y0 = balls[0].y;
      ctx.fillStyle = '#4b443a'; ctx.fillRect(Math.min(...xs) - 60, y0 - 10, Math.max(...xs) - Math.min(...xs) + 120, 10);
      ctx.fillRect(Math.min(...xs) - 60, y0 - 10, 8, H - y0); ctx.fillRect(Math.max(...xs) + 52, y0 - 10, 8, H - y0);
    }
    for (const w of wells) {
      const g = ctx.createRadialGradient(w.x, w.y, 2, w.x, w.y, 70 * w.s);
      g.addColorStop(0, 'rgba(156,140,255,.9)'); g.addColorStop(0.2, 'rgba(156,140,255,.25)'); g.addColorStop(1, 'rgba(156,140,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, 70 * w.s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d0c0a'; ctx.beginPath(); ctx.arc(w.x, w.y, 8, 0, TAU); ctx.fill();
    }
    for (const b of balls) if (b.trail && b.trail.length > 4) {
      ctx.strokeStyle = 'rgba(92,184,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.trail[0], b.trail[1]);
      for (let i = 2; i < b.trail.length; i += 2) ctx.lineTo(b.trail[i], b.trail[i + 1]);
      ctx.stroke();
    }
    for (const l of links) {
      ctx.strokeStyle = l.spring ? '#9a9083' : 'rgba(200,190,175,.55)'; ctx.lineWidth = l.spring ? 2 : 1.2;
      if (l.spring) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d, coils = 12;
        ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y);
        for (let i = 1; i < coils; i++) { const t = i / coils, s = (i % 2 ? 1 : -1) * 7; ctx.lineTo(l.a.x + dx * t + nx * s, l.a.y + dy * t + ny * s); }
        ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
      } else { ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke(); }
    }
    for (const b of balls) {
      if (b.hidden) continue;
      if (b.pin) { ctx.fillStyle = '#6b6357'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); continue; }
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
      if (b.c === 'chrome') { g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#c9c4bb'); g.addColorStop(0.75, '#5d574e'); g.addColorStop(1, '#2a2621'); }
      else { g.addColorStop(0, '#fff8'); g.addColorStop(0.3, b.c); g.addColorStop(1, '#0008'); }
      ctx.fillStyle = b.c === 'chrome' ? g : b.c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (b.c !== 'chrome') { ctx.fillStyle = g; ctx.fill(); }
    }
    if (dominoes) {
      const fl = dominoes[0]?.floor ?? H - 30;
      ctx.fillStyle = '#2a2621'; ctx.fillRect(0, fl, W, H - fl);
      for (const d of dominoes) {
        ctx.save(); ctx.translate(d.x + d.w, d.floor); ctx.rotate(d.th);
        ctx.fillStyle = d.c; ctx.fillRect(-d.w, -d.h, d.w, d.h);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-d.w, -d.h, 3, d.h);
        ctx.fillStyle = '#fff6'; ctx.beginPath(); ctx.arc(-d.w / 2, -d.h * 0.3, 2, 0, TAU); ctx.arc(-d.w / 2, -d.h * 0.7, 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (dominoes.every(d => d.th === 0)) { ctx.fillStyle = '#bdb3a4'; ctx.font = '600 14px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Tap a domino to push it', W / 2, 40); }
    }
  }

  build();
  return { reset: build };
}
