import { icon, setRange } from '../core/ui.js';
import { Sim, LIQUIDS } from './liquid-sim.js';

const TOOLS = [['stir', 'Stir'], ['pour', 'Pour'], ['drop', 'Dropper'], ['splash', 'Splash'], ['grab', 'Grab']];
const OBJECTS = [['sphere', 'Sphere'], ['cube', 'Cube'], ['float', 'Float'], ['sponge', 'Sponge'], ['paddle', 'Paddle']];
const PRESETS = {
  calm: { name: 'Calm water', visc: 1, tension: 1, alpha: 0.85, speed: 1, fill: [['water', 0.55]] },
  oil: { name: 'Oil & water', visc: 1, tension: 1, alpha: 0.9, speed: 1, fill: [['water', 0.35], ['oil', 0.25]], objs: ['float'] },
  honey: { name: 'Honey pour', visc: 2.5, tension: 1.6, alpha: 0.95, speed: 0.8, fill: [['honey', 0.35]], liquid: 'honey' },
  ink: { name: 'Ink bloom', visc: 0.8, tension: 1, alpha: 0.85, speed: 1, fill: [['water', 0.5, [200, 225, 245]]], inks: true, liquid: 'ink' },
  acid: { name: 'Acid lab', visc: 1, tension: 1, alpha: 0.85, speed: 1, fill: [['water', 0.3], ['acid', 0.2]], objs: ['cube', 'cube', 'sponge'], liquid: 'acid' },
};
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

export function mount(root, api) {
  const low = api.quality() === 'low';
  const RS = low ? 5 : 3; // render grid cell (px)
  let sim, tool = 'stir', liquid = 'water', color = LIQUIDS.water.color.slice(), dens = 1;
  const S = { visc: 1, tension: 1, alpha: 0.85, speed: 1, paused: false, divider: false };
  let preset = api.load('preset', 'calm');
  let ptr = null, grabbed = null, acc = 0, stirE = 0, pourE = 0;
  let field, fr, fg, fb, img, img32, oc, octx, GW, GH;

  root.innerHTML = `<div class="stage-wrap">
    <div class="stage" id="stage"><canvas id="cv" aria-label="Liquid canvas. Drag to use the selected tool."></canvas>
      <div class="hud"><span id="cnt"></span><span>Not real chemistry</span></div></div>
    <aside class="side">
      <section><h2>Presets</h2><div class="tools" id="presets">${Object.entries(PRESETS).map(([k, p]) => `<button class="tool" data-p="${k}">${p.name}</button>`).join('')}</div></section>
      <section><h2>Tool</h2><div class="seg" id="tools">${TOOLS.map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div></section>
      <section><h2>Liquid to add</h2><div class="seg" id="liq">${Object.entries(LIQUIDS).map(([k, l]) => `<button data-l="${k}">${l.name}</button>`).join('')}</div>
        <div class="row"><input type="color" id="col" aria-label="Liquid colour"><label class="field" style="flex:1"><span class="row">Density<output id="dnO"></output></span><input type="range" id="dn" min="0.5" max="1.5" step="0.05"></label></div>
        <p class="muted" style="font-size:12.5px" id="liqInfo"></p></section>
      <section><h2>Objects</h2><div class="tools" id="objs">${OBJECTS.map(([k, l]) => `<button class="tool" data-o="${k}">${icon('plus')}${l}</button>`).join('')}<button class="tool" id="div" aria-pressed="false">${icon('drop')}Divider</button></div></section>
      <section><h2>Behaviour</h2>
        <label class="field"><span class="row">Viscosity<output id="viO"></output></span><input type="range" id="vi" min="0.2" max="3" step="0.05"></label>
        <label class="field"><span class="row">Surface tension<output id="teO"></output></span><input type="range" id="te" min="0" max="2" step="0.05"></label>
        <label class="field"><span class="row">Opacity<output id="alO"></output></span><input type="range" id="al" min="0.3" max="1" step="0.05"></label>
        <label class="field"><span class="row">Flow speed<output id="spO"></output></span><input type="range" id="sp" min="0.25" max="2" step="0.05"></label>
      </section>
      <section><div class="row"><button class="btn" id="pause">${icon('pause')} Pause</button><button class="btn" id="clr">Clear liquid</button><button class="btn" id="clo">Clear objects</button></div></section>
    </aside></div>`;
  const $ = s => root.querySelector(s);
  const cv = $('#cv');
  const C = api.canvas(cv, { onResize: st => {
    if (!sim) { sim = new Sim(st.w, st.h, { max: low ? 800 : 1600, H: low ? 30 : 26 }); loadPreset(preset); }
    else sim.resize(st.w, st.h);
    GW = Math.ceil(st.w / RS) + 1; GH = Math.ceil(st.h / RS) + 1;
    field = new Float32Array(GW * GH); fr = new Float32Array(GW * GH); fg = new Float32Array(GW * GH); fb = new Float32Array(GW * GH);
    oc = document.createElement('canvas'); oc.width = GW; oc.height = GH; octx = oc.getContext('2d');
    img = octx.createImageData(GW, GH); img32 = new Uint32Array(img.data.buffer);
    if (S.divider) setDivider(true);
  } });

  // ---------- Controls ----------
  const bind = (id, key, fmt) => { const r = $('#' + id); r.oninput = () => { S[key] = +r.value; $('#' + id + 'O').textContent = fmt(S[key]); }; };
  bind('vi', 'visc', v => v < 0.7 ? 'Thin' : v > 1.8 ? 'Thick' : 'Medium');
  bind('te', 'tension', v => v.toFixed(2));
  bind('al', 'alpha', v => Math.round(v * 100) + '%');
  bind('sp', 'speed', v => v.toFixed(2) + '×');
  const syncSliders = () => { for (const [id, k] of [['vi', 'visc'], ['te', 'tension'], ['al', 'alpha'], ['sp', 'speed']]) { setRange($('#' + id), S[k]); $('#' + id).oninput(); } };
  function setLiquid(k) {
    liquid = k; color = LIQUIDS[k].color.slice(); dens = LIQUIDS[k].grav;
    $('#col').value = hex(color); setRange($('#dn'), dens); $('#dnO').textContent = dens.toFixed(2);
    root.querySelectorAll('#liq button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === k));
    $('#liqInfo').textContent = {
      water: 'Mixes with ink and acid; colours blend.', ink: 'Blooms and blends into other water-based liquids.',
      oil: 'Lighter and immiscible: separates and floats on water.', honey: 'Very thick and a bit heavier. Keeps its colour.',
      acid: 'Slowly dissolves cubes and sponges, an abstract effect only.',
    }[k];
  }
  $('#liq').onclick = e => { const b = e.target.closest('button'); if (b) setLiquid(b.dataset.l); };
  $('#col').oninput = e => { color = rgb(e.target.value); };
  $('#dn').oninput = e => { dens = +e.target.value; $('#dnO').textContent = dens.toFixed(2); };
  $('#tools').onclick = e => { const b = e.target.closest('button'); if (b) { tool = b.dataset.t; root.querySelectorAll('#tools button').forEach(x => x.setAttribute('aria-pressed', x === b)); } };
  $('#presets').onclick = e => { const b = e.target.closest('[data-p]'); if (b) loadPreset(b.dataset.p); };
  $('#objs').onclick = e => { const b = e.target.closest('[data-o]'); if (b) { api.audio.ensure(); addObject(b.dataset.o, C.w * (0.3 + Math.random() * 0.4), C.h * 0.15); } };
  $('#div').onclick = () => setDivider(!S.divider);
  $('#pause').onclick = () => { S.paused = !S.paused; $('#pause').innerHTML = S.paused ? `${icon('play')} Resume` : `${icon('pause')} Pause`; };
  $('#clr').onclick = () => sim.clear();
  $('#clo').onclick = () => { sim.bodies = []; };
  root.querySelectorAll('#tools button')[0].setAttribute('aria-pressed', 'true');

  function setDivider(on) {
    S.divider = on; $('#div').setAttribute('aria-pressed', on);
    sim.walls = on ? [{ x0: C.w / 2 - 4, y0: C.h * 0.3, x1: C.w / 2 + 4, y1: C.h }] : [];
  }

  // Fill layers bottom-up; the particle budget is split between layers by their fraction.
  function stackFill(list) {
    const sp = sim.H * 0.37, perRow = Math.floor((sim.w - 8) / sp), sum = list.reduce((s, l) => s + l[1], 0);
    const budget = Math.min(sim.max * 0.85, perRow * Math.floor(sim.h * 0.7 / sp));
    let y = sim.h - 4;
    for (const [kind, frac, col] of list) {
      let n = Math.round(budget * frac / sum);
      for (; n > 0; y -= sp) for (let x = 4; x < sim.w - 4 && n > 0; x += sp, n--) sim.add(x, y, kind, col);
    }
  }
  function loadPreset(k) {
    const p = PRESETS[k] || PRESETS.calm; preset = PRESETS[k] ? k : 'calm'; api.save('preset', preset);
    sim.clear(); sim.bodies = []; setDivider(false);
    Object.assign(S, { visc: p.visc, tension: p.tension, alpha: p.alpha, speed: p.speed });
    syncSliders();
    stackFill(p.fill);
    if (p.inks) [[235, 60, 90], [255, 200, 40], [60, 90, 235]].forEach((c, i) => drop(sim.w * (0.25 + i * 0.25), sim.h * 0.55, 'ink', c, 40));
    (p.objs || []).forEach((o, i) => addObject(o, sim.w * (0.3 + i * 0.2), sim.h * 0.2));
    setLiquid(p.liquid || 'water');
    root.querySelectorAll('#presets .tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === preset));
  }
  function drop(x, y, kind, col, n = 14) {
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 * 3, r = Math.sqrt(k / n) * (n > 20 ? 14 : 7); sim.add(x + Math.cos(a) * r, y + Math.sin(a) * r, kind, col, kind === liquid ? dens : undefined); }
  }
  function addObject(kind, x, y) {
    if (sim.bodies.length >= 10) return api.toast('Object limit reached');
    const base = { x, y, vx: 0, vy: 0, kind, sub: 0 };
    const B = {
      sphere: { shape: 'circle', r: 20, density: 2.6, mass: 3 },
      cube: { shape: 'box', hw: 22, hh: 22, density: 0.6, mass: 1.5, reactive: true, hp: 1 },
      float: { shape: 'circle', r: 18, density: 0.35, mass: 0.6 },
      sponge: { shape: 'box', hw: 30, hh: 16, density: 0.5, mass: 1, sponge: true, held: 0, cap: 160, store: [], reactive: true, hp: 1 },
      paddle: { shape: 'box', hw: 6, hh: 60, density: 1, mass: 5, kinematic: true },
    }[kind];
    if (kind === 'paddle') base.y = sim.h * 0.55;
    const b = { ...base, ...B, base: B.hw };
    sim.bodies.push(b);
    return b;
  }

  // ---------- Input ----------
  const pick = (x, y) => [...sim.bodies].reverse().find(B => B.shape === 'circle' ? Math.hypot(x - B.x, y - B.y) < B.r + 8 : Math.abs(x - B.x) < B.hw + 8 && Math.abs(y - B.y) < B.hh + 8);
  cv.addEventListener('pointerdown', e => {
    api.audio.ensure(); cv.setPointerCapture(e.pointerId);
    const x = e.offsetX, y = e.offsetY;
    ptr = { x, y, px: x, py: y, down: true };
    const hit = pick(x, y);
    if (tool === 'grab' || (hit && tool === 'stir')) {
      if (hit) { grabbed = hit; hit.wasKin = hit.kinematic; hit.kinematic = true; api.haptics.pulse('tick'); }
      return;
    }
    if (tool === 'splash') {
      for (let i = 0; i < sim.n; i++) { const dx = sim.x[i] - x, dy = sim.y[i] - y, d = Math.hypot(dx, dy); if (d < 70 && d > 0) { const f = (1 - d / 70) * 5; sim.vx[i] += dx / d * f; sim.vy[i] += dy / d * f - f * 0.5; } }
      sfxSplash(0.6); api.haptics.pulse('thud');
    } else if (tool === 'drop') { drop(x, y, liquid, color); sfxDrop(); api.haptics.pulse('tick'); }
  }, { signal: api.signal });
  cv.addEventListener('pointermove', e => { if (!ptr) ptr = { down: false }; Object.assign(ptr, { x: e.offsetX, y: e.offsetY }); }, { signal: api.signal });
  const up = () => {
    if (grabbed) { grabbed.kinematic = grabbed.wasKin; if (grabbed.kinematic) { grabbed.vx = grabbed.vy = 0; } grabbed = null; }
    if (ptr) ptr.down = false;
  };
  cv.addEventListener('pointerup', up, { signal: api.signal });
  cv.addEventListener('pointercancel', up, { signal: api.signal });
  cv.addEventListener('dblclick', e => {
    const B = pick(e.offsetX, e.offsetY);
    if (!B?.sponge || !B.held) return;
    // Wring the sponge: release what it soaked up just below it.
    for (const [k, r, g, b] of B.store.splice(0)) sim.add(B.x + (Math.random() - 0.5) * B.hw * 2, B.y + B.hh + 4 + Math.random() * 10, k, [r, g, b]);
    B.held = 0; sfxSplash(0.3); api.haptics.pulse('bump');
  }, { signal: api.signal });

  function interact() {
    if (!ptr?.down) { if (ptr) { ptr.px = ptr.x; ptr.py = ptr.y; } return; }
    const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py;
    if (grabbed) {
      grabbed.vx = (ptr.x - grabbed.x) * 0.5; grabbed.vy = (ptr.y - grabbed.y) * 0.5;
      grabbed.x += grabbed.vx; grabbed.y += grabbed.vy;
    } else if (tool === 'stir') {
      const R = 45;
      for (let i = 0; i < sim.n; i++) {
        const ex = sim.x[i] - ptr.x, ey = sim.y[i] - ptr.y, d2 = ex * ex + ey * ey;
        if (d2 < R * R) { const f = (1 - Math.sqrt(d2) / R) * 0.12; sim.vx[i] += dx * f; sim.vy[i] += dy * f; }
      }
      stirE = Math.max(stirE, Math.min(1, Math.hypot(dx, dy) / 25));
    } else if (tool === 'pour') {
      for (let k = 0; k < 3; k++) if (sim.add(ptr.x + (Math.random() - 0.5) * 10, ptr.y + (Math.random() - 0.5) * 6, liquid, color, dens)) sim.vy[sim.n - 1] = 1.5; // start with a downward velocity
      pourE = 1;
      if (sim.n >= sim.max && !interact.warned) { interact.warned = true; api.toast('Container is full'); }
    }
    ptr.px = ptr.x; ptr.py = ptr.y;
  }

  // ---------- Sound ----------
  let wash = null;
  function sfxDrop() { const b = api.bus(); api.audio.tone(b, { freq: 380, to: 1100, dur: 0.07, vol: 0.25 }); api.audio.tone(b, { freq: 700, to: 1500, dur: 0.05, vol: 0.12, when: 0.06 }); }
  function sfxSplash(v) { api.audio.burst(api.bus(), { dur: 0.35, vol: Math.min(0.5, v), type: 'lowpass', freq: 2500, to: 400, kind: 'pink' }); }
  function washLevel(stir, pour) {
    if (!api.audio.ctx) return;
    if (!wash) {
      const ac = api.audio.ctx, s = ac.createBufferSource(); s.buffer = api.audio.noise('pink', 6); s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
      const g = ac.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(api.bus()); s.start();
      wash = { s, f, g };
    }
    const t = api.audio.ctx.currentTime;
    wash.g.gain.setTargetAtTime(stir * 0.35 + pour * 0.12, t, 0.08);
    wash.f.frequency.setTargetAtTime(pour > stir ? 1600 : 500 + stir * 600, t, 0.1);
  }
  api.onCleanup(() => { try { wash?.s.stop(); } catch {} });

  // ---------- Loop ----------
  api.loop((dt) => {
    if (!sim || !field) return;
    interact();
    if (!S.paused) {
      acc += dt * 60 * 2 * S.speed; // ~2 solver steps per 60 Hz frame at 1×
      let n = 0;
      while (acc >= 1 && n < 5) { sim.step({ viscScale: S.visc, tension: S.tension }); acc -= 1; n++; }
      if (n >= 5) acc = 0;
      // Corroded objects shrink, then dissolve.
      for (const B of sim.bodies) if (B.reactive && B.hp < 1) {
        if (B.shape === 'box') { const k = 0.35 + 0.65 * Math.max(0, B.hp); B.hw = B.base * k; B.hh = (B.sponge ? 16 : 22) * k; }
      }
      const gone = sim.bodies.filter(B => B.reactive && B.hp <= 0);
      if (gone.length) { sim.bodies = sim.bodies.filter(B => !gone.includes(B)); api.audio.ctx && api.audio.burst(api.bus(), { dur: 0.5, vol: 0.2, type: 'highpass', freq: 3000 }); }
    }
    const ev = sim.events;
    if (ev.splash && api.audio.ctx) { sfxSplash(ev.splash / 6); if (ev.splash > 3) api.haptics.pulse('thud'); }
    if (ev.fizz.length && api.audio.ctx && Math.random() < 0.3) api.audio.burst(api.bus(), { dur: 0.03, vol: 0.06, type: 'highpass', freq: 5000 });
    for (const [x, y] of ev.fizz.slice(0, 20)) bubbles.push({ x, y, life: 1 });
    ev.splash = 0; ev.fizz.length = 0; ev.absorbed = 0;
    stirE *= 0.9; pourE *= 0.85;
    washLevel(stirE, pourE);
    draw();
  });

  const bubbles = [];
  function draw() {
    const { ctx, w, h } = C;
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#12161c'); bg.addColorStop(1, '#0a0c10');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let y = h; y > 0; y -= 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(12, y + 0.5); ctx.stroke(); }
    for (const B of sim.bodies) drawBody(ctx, B);
    for (const wl of sim.walls) { ctx.fillStyle = '#6b7684'; ctx.fillRect(wl.x0, wl.y0, wl.x1 - wl.x0, wl.y1 - wl.y0); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(wl.x0, wl.y0, 2, wl.y1 - wl.y0); }
    // Splat particles into a low-res field, threshold it, and upscale smoothly: a metaball-like surface.
    field.fill(0); fr.fill(0); fg.fill(0); fb.fill(0);
    const R = sim.H * 0.55 / RS, R2 = R * R, ri = Math.ceil(R);
    for (let i = 0; i < sim.n; i++) {
      const gx = sim.x[i] / RS, gy = sim.y[i] / RS, cx = Math.round(gx), cy = Math.round(gy);
      for (let y = cy - ri; y <= cy + ri; y++) {
        if (y < 0 || y >= GH) continue;
        for (let x = cx - ri; x <= cx + ri; x++) {
          if (x < 0 || x >= GW) continue;
          const d2 = (x - gx) ** 2 + (y - gy) ** 2; if (d2 >= R2) continue;
          const wgt = (1 - d2 / R2) ** 2, j = y * GW + x;
          field[j] += wgt; fr[j] += sim.r[i] * wgt; fg[j] += sim.g[i] * wgt; fb[j] += sim.b[i] * wgt;
        }
      }
    }
    const A = S.alpha;
    for (let j = 0; j < field.length; j++) {
      const f = field[j];
      if (f < 0.3) { img32[j] = 0; continue; }
      let a = Math.min(1, (f - 0.3) / 0.45) * A;
      let r = fr[j] / f, g = fg[j] / f, b = fb[j] / f;
      if (j >= GW && field[j - GW] < 0.6) { r += 50; g += 50; b += 50; a = Math.min(1, a + 0.15); } // surface sheen
      img32[j] = ((a * 255) << 24 | Math.min(255, b) << 16 | Math.min(255, g) << 8 | Math.min(255, r)) >>> 0;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(oc, 0, 0, GW * RS, GH * RS);
    for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= 0.6; b.life -= 0.02; if (b.life <= 0) { bubbles.splice(i, 1); continue; } ctx.strokeStyle = `rgba(200,255,170,${b.life})`; ctx.beginPath(); ctx.arc(b.x, b.y, 2 + (1 - b.life) * 2, 0, 7); ctx.stroke(); }
    if (ptr && !ptr.down && (tool === 'stir' || tool === 'splash')) { ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, tool === 'stir' ? 45 : 70, 0, 7); ctx.stroke(); }
    draw.t = (draw.t || 0) + 1;
    if (draw.t % 15 === 0) $('#cnt').textContent = `${sim.n} / ${sim.max} particles`;
  }
  function drawBody(ctx, B) {
    ctx.save(); ctx.translate(B.x, B.y);
    if (B.kind === 'sphere') {
      const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, B.r); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#9aa4b0'); g.addColorStop(1, '#2c333c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, B.r, 0, 7); ctx.fill();
    } else if (B.kind === 'float') {
      ctx.lineWidth = 9; ctx.strokeStyle = '#ff6b5a'; ctx.beginPath(); ctx.arc(0, 0, B.r - 5, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.setLineDash([7, 9]); ctx.beginPath(); ctx.arc(0, 0, B.r - 5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    } else if (B.kind === 'cube') {
      ctx.fillStyle = B.hp < 1 ? `rgb(${180 + 40 * (1 - B.hp)},${150 - 40 * (1 - B.hp)},120)` : '#c99a5b';
      ctx.beginPath(); ctx.roundRect(-B.hw, -B.hh, B.hw * 2, B.hh * 2, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(-B.hw + 5, -B.hh + 5, B.hw * 2 - 10, B.hh * 2 - 10);
    } else if (B.kind === 'sponge') {
      const sat = B.held / B.cap;
      ctx.fillStyle = `rgb(${245 - sat * 90},${215 - sat * 80},${80 + sat * 40})`;
      ctx.beginPath(); ctx.roundRect(-B.hw, -B.hh, B.hw * 2, B.hh * 2, 6); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(((k * 37) % (B.hw * 2)) - B.hw + 4, ((k * 23) % (B.hh * 2)) - B.hh + 4, 2.5, 0, 7); ctx.fill(); }
    } else if (B.kind === 'paddle') {
      ctx.fillStyle = '#d7cfc2'; ctx.beginPath(); ctx.roundRect(-B.hw, -B.hh, B.hw * 2, B.hh * 2, 6); ctx.fill();
      ctx.fillStyle = '#8c8376'; ctx.fillRect(-2, -B.hh + 6, 4, B.hh * 2 - 12);
    }
    ctx.restore();
  }

  setLiquid('water');
  return { reset: () => loadPreset(preset) };
}
