import { icon, download } from '../core/ui.js';

const COLORS = { Natural: [222, 184, 135], Terracotta: [214, 120, 84], Sage: [150, 178, 128], Rose: [232, 150, 168], Sky: [130, 180, 230], Lavender: [176, 156, 230] };
const TOOLS = [['pour', 'Pour'], ['scoop', 'Scoop'], ['push', 'Push'], ['rake', 'Rake'], ['wall', 'Wall'], ['stone', 'Stone']];
const EMPTY = 0, SAND = 1, WALL = 2;
const pack = (r, g, b) => (255 << 24 | b << 16 | g << 8 | r) >>> 0;

export function mount(root, api) {
  const low = api.quality() === 'low';
  const CS = low ? 5 : 3; // CSS pixels per grain
  let tool = 'pour', mat = 'sand', colorName = api.load('color', 'Natural'), brush = 8, density = 0.5, paused = false;
  let W = 0, H = 0, type, col, glit, img, img32, oc, octx;
  let ptr = null, activity = 0, noise = null;

  root.innerHTML = `<div class="stage-wrap">
    <div class="stage" id="stage"><canvas id="cv" aria-label="Sand canvas. Drag to use the selected tool."></canvas>
      <div class="hud"><span id="cnt">0 grains</span></div></div>
    <aside class="side">
      <section><h2>Tool</h2><div class="tools" id="tools">${TOOLS.map(([k, l]) => `<button class="tool" data-t="${k}">${l}</button>`).join('')}</div></section>
      <section><h2>Material</h2><div class="seg" id="mat"><button data-m="sand">Sand</button><button data-m="dark">Dark sand</button><button data-m="glitter">Glitter</button></div>
        <div class="swatches" id="cols">${Object.entries(COLORS).map(([k, c]) => `<button class="swatch" data-c="${k}" aria-label="${k}" title="${k}" style="background:rgb(${c})"></button>`).join('')}</div></section>
      <section><h2>Brush</h2>
        <label class="field"><span class="row">Size<output id="bsO">${brush}</output></span><input type="range" id="bs" min="2" max="30" value="${brush}"></label>
        <label class="field"><span class="row">Density<output id="dnO">50%</output></span><input type="range" id="dn" min="0.05" max="1" step="0.05" value="${density}"></label>
      </section>
      <section><div class="row"><button class="btn" id="pause">${icon('pause')} Pause</button><button class="btn" id="clear">Clear sand</button><button class="btn" id="shot">${icon('download')} PNG</button></div>
      <p class="note">Quality: <b>${low ? 'Low' : 'High'}</b>${low ? ' (larger grains for smoother performance)' : ''}. Change it in Settings.</p></section>
    </aside></div>`;
  const $ = s => root.querySelector(s);
  const cv = $('#cv');
  const C = api.canvas(cv, { onResize: resize });

  function resize() {
    const nw = Math.max(20, Math.floor(C.w / CS)), nh = Math.max(20, Math.floor(C.h / CS));
    if (nw === W && nh === H) return;
    const old = type && { type, col, glit, W, H };
    W = nw; H = nh;
    type = new Uint8Array(W * H); col = new Uint32Array(W * H); glit = new Uint8Array(W * H);
    oc = document.createElement('canvas'); oc.width = W; oc.height = H; octx = oc.getContext('2d');
    img = octx.createImageData(W, H); img32 = new Uint32Array(img.data.buffer);
    if (old) { // keep existing sand, anchored to the bottom
      const dy = H - old.H;
      for (let y = 0; y < old.H; y++) for (let x = 0; x < Math.min(W, old.W); x++) {
        const ny = y + dy; if (ny < 0 || ny >= H) continue;
        const i = y * old.W + x, j = ny * W + x; type[j] = old.type[i]; col[j] = old.col[i]; glit[j] = old.glit[i];
      }
    } else seed();
  }

  function grainColor(g = glit) {
    const base = COLORS[colorName];
    const dark = mat === 'dark' ? 0.55 : 1, j = 0.86 + Math.random() * 0.22;
    const lift = mat === 'glitter' ? 1.12 : 1;
    return pack(...base.map(v => Math.min(255, Math.round(v * dark * j * lift))));
  }
  function put(x, y, t) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (t === SAND && type[i] !== EMPTY) return;
    type[i] = t; glit[i] = t === SAND && mat === 'glitter' ? 1 : 0;
    col[i] = t === SAND ? grainColor() : 0;
  }
  function seed() {
    const keepMat = mat, keepCol = colorName;
    for (let x = 0; x < W; x++) {
      const h = Math.floor(H * (0.18 + 0.08 * Math.sin(x / W * 5.5) + 0.05 * Math.sin(x / W * 17)));
      for (let y = H - h; y < H; y++) { mat = y > H - h * 0.4 ? 'dark' : 'sand'; put(x, y, SAND); }
    }
    for (let k = 0; k < 2; k++) { const cx = Math.floor(W * (0.3 + k * 0.4)), cy = Math.floor(H * 0.45), r = Math.floor(Math.min(W, H) * 0.05); disc(cx, cy, r, WALL); }
    mat = keepMat; colorName = keepCol;
  }
  function disc(cx, cy, r, t, p = 1) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && Math.random() < p) {
      if (t === EMPTY) { const X = cx + x, Y = cy + y; if (X >= 0 && Y >= 0 && X < W && Y < H) { const i = Y * W + X; if (type[i] === SAND) activity++; type[i] = EMPTY; } }
      else put(cx + x, cy + y, t);
    }
  }

  // Cellular update, bottom-up with alternating scan direction. Diagonal slides are damped to make sand "kinetic" (steeper piles).
  function update() {
    const flip = Math.random() < 0.5;
    for (let y = H - 2; y >= 0; y--) {
      const ltr = (y & 1) ^ flip;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k, i = y * W + x;
        if (type[i] !== SAND) continue;
        const b = i + W;
        if (type[b] === EMPTY) { move(i, b); continue; }
        if (Math.random() < 0.35) continue; // cohesion
        const d = Math.random() < 0.5 ? -1 : 1;
        if (x + d >= 0 && x + d < W && type[b + d] === EMPTY && type[i + d] === EMPTY) move(i, b + d);
        else if (x - d >= 0 && x - d < W && type[b - d] === EMPTY && type[i - d] === EMPTY) move(i, b - d);
      }
    }
  }
  function move(a, b) { type[b] = type[a]; col[b] = col[a]; glit[b] = glit[a]; type[a] = EMPTY; glit[a] = 0; }

  function render(t) {
    const bg = pack(20, 17, 13), wall = pack(62, 56, 48), wallHi = pack(88, 80, 70);
    let n = 0;
    for (let i = 0; i < W * H; i++) {
      const ty = type[i];
      if (ty === EMPTY) img32[i] = bg;
      else if (ty === WALL) img32[i] = i >= W && type[i - W] !== WALL ? wallHi : wall;
      else {
        n++;
        let c = col[i];
        if (glit[i] && Math.random() < 0.04) c = pack(255, 250, 235);
        else if (i >= W && type[i - W] === EMPTY) { // light the top surface a touch
          c = pack(Math.min(255, (c & 255) + 18), Math.min(255, (c >> 8 & 255) + 16), Math.min(255, (c >> 16 & 255) + 12));
        }
        img32[i] = c;
      }
    }
    octx.putImageData(img, 0, 0);
    const { ctx, w, h } = C;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#14110d'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(oc, 0, 0, W * CS, H * CS);
    if (ptr && ptr.inside) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ptr.x * CS, ptr.y * CS, brush * CS, 0, Math.PI * 2); ctx.stroke(); }
    if (Math.floor(t / 250) !== render.tick) { render.tick = Math.floor(t / 250); $('#cnt').textContent = n.toLocaleString() + ' grains'; }
  }

  // ---- Tools ----
  function applyTool(dx, dy) {
    const cx = Math.round(ptr.x), cy = Math.round(ptr.y), r = brush;
    if (tool === 'pour') {
      for (let k = 0; k < r * r * density * 0.5; k++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (x >= 0 && y >= 0 && x < W && y < H && type[y * W + x] === EMPTY) { put(x, y, SAND); activity++; }
      }
    } else if (tool === 'scoop') {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r && Math.random() < density + 0.2) {
        const X = cx + x, Y = cy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = Y * W + X; if (type[i] === SAND) activity++; if (type[i] === SAND || density > 0.6) type[i] = EMPTY;
      }
    } else if (tool === 'push' || tool === 'rake') {
      const len = Math.hypot(dx, dy); if (len < 0.3) return;
      const sx = Math.sign(Math.round(dx / len)), sy = Math.sign(Math.round(dy / len));
      const steps = Math.min(4, Math.ceil(len));
      for (let s = 0; s < steps; s++) {
        const xs = sx > 0 ? [r, -r, -1] : [-r, r, 1], ys = sy > 0 ? [r, -r, -1] : [-r, r, 1];
        for (let y = ys[0]; y !== ys[1] + ys[2]; y += ys[2]) for (let x = xs[0]; x !== xs[1] + xs[2]; x += xs[2]) {
          if (x * x + y * y > r * r) continue;
          const X = cx + x, Y = cy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const i = Y * W + X; if (type[i] !== SAND) continue;
          let tx = sx, ty = sy;
          if (tool === 'rake') {
            // Tines: cells on every 4th line across the stroke get pushed sideways, carving grooves.
            const perp = Math.round(-y * (dx / len) + x * (dy / len));
            if (((perp % 4) + 4) % 4 !== 0) continue;
            tx = Math.round(dy / len) || 1; ty = -Math.round(dx / len);
            if (s % 2) { tx = -tx; ty = -ty; }
          }
          const X2 = X + tx, Y2 = Y + ty;
          if (X2 < 0 || Y2 < 0 || X2 >= W || Y2 >= H) continue;
          const j = Y2 * W + X2;
          if (type[j] === EMPTY) { move(i, j); activity++; }
          else if (Y2 - 1 >= 0 && type[j - W] === EMPTY) { move(i, j - W); activity++; }
        }
      }
    } else if (tool === 'wall') {
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
      for (let k = 0; k <= n; k++) disc(Math.round(cx - dx * k / n), Math.round(cy - dy * k / n), Math.max(1, Math.round(r / 3)), WALL);
    }
  }

  function setSound(level) {
    if (!api.audio.ctx) return;
    if (!noise) {
      const ac = api.audio.ctx, s = ac.createBufferSource(); s.buffer = api.audio.noise('white'); s.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7;
      const g = ac.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(api.bus()); s.start();
      noise = { s, g, f };
    }
    noise.g.gain.setTargetAtTime(Math.min(0.22, level), api.audio.ctx.currentTime, 0.06);
  }
  api.onCleanup(() => { try { noise?.s.stop(); } catch {} });

  const toGrid = e => ({ x: e.offsetX / CS, y: e.offsetY / CS, inside: true });
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); api.audio.ensure();
    ptr = { ...toGrid(e), down: true, lx: e.offsetX / CS, ly: e.offsetY / CS };
    if (tool === 'stone') { disc(Math.round(ptr.x), Math.round(ptr.y), Math.max(2, brush), WALL); api.haptics.pulse('thud'); api.audio.tone(api.bus(), { freq: 110, to: 70, dur: 0.12, type: 'triangle', vol: 0.2 }); }
    else applyTool(0, 0);
    if (tool === 'pour') api.haptics.pulse('tick');
  }, { signal: api.signal });
  cv.addEventListener('pointermove', e => {
    const g = toGrid(e);
    if (ptr?.down) {
      const dx = g.x - ptr.lx, dy = g.y - ptr.ly;
      Object.assign(ptr, g, { lx: g.x, ly: g.y });
      if (tool !== 'stone') applyTool(dx, dy);
    } else ptr = g;
  }, { signal: api.signal });
  const up = () => { if (ptr) ptr.down = false; };
  cv.addEventListener('pointerup', up, { signal: api.signal });
  cv.addEventListener('pointercancel', up, { signal: api.signal });
  cv.addEventListener('pointerleave', () => { if (ptr && !ptr.down) ptr = null; }, { signal: api.signal });

  const sel = (id, attr, val) => root.querySelectorAll(`#${id} [data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === val));
  $('#tools').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tool = b.dataset.t; sel('tools', 't', tool); } };
  $('#mat').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { mat = b.dataset.m; sel('mat', 'm', mat); } };
  $('#cols').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { colorName = b.dataset.c; api.save('color', colorName); sel('cols', 'c', colorName); } };
  sel('tools', 't', tool); sel('mat', 'm', mat); sel('cols', 'c', colorName);
  $('#bs').oninput = e => { brush = +e.target.value; $('#bsO').textContent = brush; };
  $('#dn').oninput = e => { density = +e.target.value; $('#dnO').textContent = Math.round(density * 100) + '%'; };
  $('#pause').onclick = () => { paused = !paused; $('#pause').innerHTML = paused ? `${icon('play')} Resume` : `${icon('pause')} Pause`; };
  $('#clear').onclick = () => { for (let i = 0; i < type.length; i++) if (type[i] === SAND) type[i] = EMPTY; };
  $('#shot').onclick = () => download('kinetic-sand.png', cv.toDataURL('image/png'));

  api.loop((dt, t) => {
    if (!W) return;
    if (ptr?.down && tool === 'pour') applyTool(0, 0); // keep pouring while held still
    if (!paused) update();
    render(t);
    setSound(ptr?.down ? activity / (tool === 'pour' ? 900 : 300) : 0);
    activity = 0;
  });

  return { reset() { type.fill(0); seed(); }, confirmReset: 'Clear the canvas and start over with a fresh dune?' };
}
