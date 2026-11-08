import { icon, download, setRange } from '../core/ui.js';

// ---------- Geometry ----------
export function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Bowyer–Watson. pts: [[x,y]...] → triangles as index triples.
export function delaunay(pts) {
  const n = pts.length, P = pts.slice();
  P.push([-1e5, -1e5], [1e5, -1e5], [0, 1e5]);
  const circ = (a, b, c) => {
    const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-9;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { a, b, c, x: ux, y: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [x, y] = P[i], keep = [], edges = new Map();
    for (const t of tris) {
      if ((x - t.x) ** 2 + (y - t.y) ** 2 < t.r2) {
        for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) { const k = u < v ? u * 1e6 + v : v * 1e6 + u; edges.set(k, edges.has(k) ? null : [u, v]); }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter(t => t.a < n && t.b < n && t.c < n).map(t => [t.a, t.b, t.c]);
}

// Voronoi cell of each site by clipping the canvas rectangle with perpendicular bisectors.
export function voronoi(sites, w, h) {
  return sites.map(([sx, sy], i) => {
    let poly = [[0, 0], [w, 0], [w, h], [0, h]];
    const order = sites.map((s, j) => [j, (s[0] - sx) ** 2 + (s[1] - sy) ** 2]).sort((a, b) => a[1] - b[1]);
    for (const [j, d2] of order) {
      if (j === i) continue;
      let maxR = 0; for (const [px, py] of poly) maxR = Math.max(maxR, (px - sx) ** 2 + (py - sy) ** 2);
      if (d2 > 4 * maxR) break; // farther sites can't cut this cell
      const [bx, by] = sites[j], mx = (sx + bx) / 2, my = (sy + by) / 2, nx = bx - sx, ny = by - sy;
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k], q = poly[(k + 1) % poly.length];
        const dp = (p[0] - mx) * nx + (p[1] - my) * ny, dq = (q[0] - mx) * nx + (q[1] - my) * ny;
        if (dp <= 0) out.push(p);
        if ((dp < 0) !== (dq < 0) && dp !== dq) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      poly = out; if (poly.length < 3) break;
    }
    return poly;
  });
}

function inPoly(x, y, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function kmeans(px, k, rnd) {
  let cs = Array.from({ length: k }, () => px[Math.floor(rnd() * px.length)].slice());
  for (let it = 0; it < 10; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (const p of px) { let b = 0, bd = Infinity; for (let j = 0; j < k; j++) { const c = cs[j], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } } const s = sum[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    cs = cs.map((c, j) => sum[j][3] ? sum[j].slice(0, 3).map(v => v / sum[j][3]) : px[Math.floor(rnd() * px.length)].slice());
  }
  return cs;
}
const nearest = (c, pal) => { let b = pal[0], bd = Infinity; for (const p of pal) { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
function randomPalette(rnd) {
  const h = rnd() * 360, mode = Math.floor(rnd() * 3);
  return Array.from({ length: 5 }, (_, i) => {
    const hh = mode === 0 ? h + i * 72 : mode === 1 ? h + (i % 2 ? 180 : 0) + i * 8 : h + i * 25;
    const l = [0.22, 0.4, 0.55, 0.7, 0.88][i], s = 0.45 + rnd() * 0.4;
    const a = s * Math.min(l, 1 - l), f = n => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
  });
}

const GENS = [['voronoi', 'Voronoi cells'], ['mosaic', 'Polygon mosaic'], ['lowpoly', 'Low-poly facets'], ['grid', 'Geometric grid'], ['radial', 'Radial'], ['shapes', 'Shapes']];
const STYLES = [['lowpoly', 'Low-poly'], ['voronoi', 'Cells'], ['hex', 'Hex mosaic']];

export function mount(root, api) {
  const P = { mode: 'gen', gen: 'voronoi', style: 'lowpoly', detail: 600, edge: 0.6, colors: 10, facet: 24, outline: true, seed: 1 + Math.floor(Math.random() * 1e6) };
  let palette = api.load('palette', ['#1d1b2f', '#3a4a7a', '#e46a5e', '#f2c14e', '#efe8dc']);
  let saved = api.load('palettes', []);
  let active = 2, toolMode = 'bucket', before = false;
  let doc = null, photo = null, undo = [], redo = [];
  const view = { s: 1, x: 0, y: 0 };

  root.innerHTML = `<div class="stage-wrap">
    <div class="stage ga-stage" id="stage"><canvas id="cv" aria-label="Artwork canvas"></canvas>
      <div class="hud"><span id="info"></span></div>
      <div class="ga-zoom"><button class="icon-btn" id="zi" aria-label="Zoom in">${icon('zoomIn')}</button><button class="icon-btn" id="zo" aria-label="Zoom out">${icon('zoomOut')}</button><button class="btn sm" id="fit">Fit</button></div>
      <div class="overlay" id="busy" hidden><div class="box"><div class="spinner"></div><p>Processing locally…</p></div></div>
    </div>
    <aside class="side">
      <section><div class="seg" id="mode"><button data-m="gen">Generate</button><button data-m="photo">Photo → Art</button></div></section>
      <section id="genS"><h2>Generator</h2><div class="tools" id="gens">${GENS.map(([k, l]) => `<button class="tool" data-g="${k}">${l}</button>`).join('')}</div></section>
      <section id="photoS" hidden><h2>Photo</h2>
        <button class="btn" id="load">${icon('image')} Choose a photo…</button><input type="file" id="file" accept="image/*" hidden>
        <p class="muted" style="font-size:12.5px">Or drop an image onto the canvas. It never leaves your device. Large images are scaled to 1000 px, and processing may take a few seconds.</p>
        <div class="seg" id="styles">${STYLES.map(([k, l]) => `<button data-s="${k}">${l}</button>`).join('')}</div>
        <label class="switch"><input type="checkbox" id="ba"> Show original (before/after)</label>
      </section>
      <section><h2>Shape</h2>
        <label class="field"><span class="row">Detail<output id="dtO"></output></span><input type="range" id="dt" min="40" max="3000" step="20"></label>
        <label class="field" id="edgeF"><span class="row">Edge emphasis<output id="edO"></output></span><input type="range" id="ed" min="0" max="1" step="0.05"></label>
        <label class="field" id="colF"><span class="row">Colour count<output id="ccO"></output></span><input type="range" id="cc" min="0" max="24" step="1"></label>
        <label class="field"><span class="row">Facet size<output id="fsO"></output></span><input type="range" id="fs" min="8" max="80" step="2"></label>
        <label class="switch"><input type="checkbox" id="ol" checked> Outlines</label>
        <div class="row"><button class="btn primary" id="gen">${icon('shuffle')} Generate</button><button class="btn" id="reroll">New seed</button></div>
      </section>
      <section><h2>Palette</h2>
        <div class="swatches" id="sw"></div>
        <div class="row"><input type="color" id="pick" aria-label="Active colour"><button class="btn sm" id="add">${icon('plus')} Add</button><button class="btn sm" id="rm">Remove</button><button class="btn sm" id="rand">${icon('shuffle')} Random</button></div>
        <div class="row"><button class="btn sm" id="apply">Apply palette to art</button><button class="btn sm" id="fromImg" disabled>From photo</button><button class="btn sm" id="savePal">${icon('save')} Save</button></div>
        <div id="savedPal" style="display:grid;gap:6px"></div>
      </section>
      <section><h2>Edit</h2>
        <div class="seg" id="tool"><button data-t="bucket">${icon('bucket')} Fill</button><button data-t="picker">${icon('picker')} Pick</button><button data-t="hand">${icon('hand')} Pan</button></div>
        <div class="row"><button class="btn" id="undo">${icon('undo')} Undo</button><button class="btn" id="redo">${icon('redo')} Redo</button><button class="btn primary" id="exp">${icon('download')} Export PNG</button></div>
      </section>
    </aside></div>
  <style>
    .ga-stage { background: repeating-conic-gradient(#14120f 0 25%, #191713 0 50%) 0 0 / 24px 24px; }
    .ga-zoom { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; align-items: center; background: rgba(15,14,12,.8); border: 1px solid var(--line); border-radius: 12px; padding: 4px; z-index: 2; }
    .ga-stage.drag { outline: 2px dashed var(--accent); outline-offset: -8px; }
    #savedPal .pal { display: flex; height: 26px; border-radius: 7px; overflow: hidden; cursor: pointer; border: 1px solid var(--line-2); padding: 0; }
    #savedPal .pal i { flex: 1; }
  </style>`;
  const $ = s => root.querySelector(s);
  const cv = $('#cv');
  const C = api.canvas(cv, { onResize: () => { if (!doc) generate(); else fitView(); } }); // refit after rotation
  const art = document.createElement('canvas'), actx = art.getContext('2d');

  // ---------- Controls ----------
  const bind = (id, key, fmt) => { const r = $('#' + id); setRange(r, P[key]); $('#' + id + 'O').textContent = fmt(P[key]); r.oninput = () => { P[key] = +r.value; $('#' + id + 'O').textContent = fmt(P[key]); }; };
  bind('dt', 'detail', v => v); bind('ed', 'edge', v => Math.round(v * 100) + '%'); bind('cc', 'colors', v => v ? v : 'Full'); bind('fs', 'facet', v => v + 'px');
  $('#ol').onchange = e => { P.outline = e.target.checked; renderArt(); };
  const segSel = (id, attr, v) => root.querySelectorAll(`#${id} [data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === v));
  function setMode(m) {
    P.mode = m; segSel('mode', 'm', m);
    $('#genS').hidden = m !== 'gen'; $('#photoS').hidden = m !== 'photo';
    $('#edgeF').hidden = $('#colF').hidden = m !== 'photo';
    if (m === 'photo' && !photo) { doc = null; draw(); $('#info').textContent = 'Choose or drop a photo to begin'; }
    else generate();
  }
  $('#mode').onclick = e => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); };
  $('#gens').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { P.gen = b.dataset.g; segSel('gens', 'g', P.gen); generate(); } };
  $('#styles').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { P.style = b.dataset.s; segSel('styles', 's', P.style); generate(); } };
  $('#gen').onclick = () => generate();
  $('#reroll').onclick = () => { P.seed = 1 + Math.floor(Math.random() * 1e6); generate(); };
  $('#tool').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { toolMode = b.dataset.t; segSel('tool', 't', toolMode); cv.style.cursor = toolMode === 'hand' ? 'grab' : 'crosshair'; } };
  $('#ba').onchange = e => { before = e.target.checked; draw(); };
  segSel('gens', 'g', P.gen); segSel('styles', 's', P.style); segSel('tool', 't', toolMode); segSel('mode', 'm', P.mode);
  cv.style.cursor = 'crosshair';

  // ---------- Palette ----------
  function paintPalette() {
    active = Math.min(active, palette.length - 1);
    $('#sw').innerHTML = palette.map((c, i) => `<button class="swatch" data-i="${i}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${i === active}"></button>`).join('');
    $('#pick').value = palette[active] || '#ffffff';
    $('#savedPal').innerHTML = saved.map((p, i) => `<div class="row" style="flex-wrap:nowrap"><button class="pal" data-sp="${i}" style="flex:1" aria-label="Load saved palette ${i + 1}">${p.map(c => `<i style="background:${c}"></i>`).join('')}</button><button class="icon-btn" data-dp="${i}" aria-label="Delete saved palette">${icon('x')}</button></div>`).join('');
    api.save('palette', palette);
  }
  $('#sw').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { active = +b.dataset.i; paintPalette(); } };
  $('#pick').oninput = e => { palette[active] = e.target.value; paintPalette(); };
  $('#add').onclick = () => { if (palette.length >= 16) return api.toast('16 colours max'); palette.push($('#pick').value); active = palette.length - 1; paintPalette(); };
  $('#rm').onclick = () => { if (palette.length <= 2) return api.toast('Keep at least 2 colours'); palette.splice(active, 1); paintPalette(); };
  $('#rand').onclick = () => { palette = randomPalette(Math.random); active = 0; paintPalette(); };
  $('#savePal').onclick = () => { saved = [palette.slice(), ...saved].slice(0, 12); api.save('palettes', saved); paintPalette(); api.toast('Palette saved'); };
  $('#savedPal').onclick = e => {
    const d = e.target.closest('[data-dp]'); if (d) { saved.splice(+d.dataset.dp, 1); api.save('palettes', saved); paintPalette(); return; }
    const s = e.target.closest('[data-sp]'); if (s) { palette = saved[+s.dataset.sp].slice(); active = 0; paintPalette(); }
  };
  $('#fromImg').onclick = () => { if (!photo) return; const rnd = mulberry(7); palette = kmeans(samplePixels(1500), Math.min(8, Math.max(3, P.colors || 6)), rnd).map(hex); active = 0; paintPalette(); };
  $('#apply').onclick = () => {
    if (!doc) return;
    const pal = palette.map(rgbOf), beforeC = doc.regions.map(r => r.color);
    const rnd = mulberry(P.seed);
    // Photo art maps each facet to the nearest palette colour; generated art reassigns at random.
    const after = doc.regions.map(r => P.mode === 'photo' && r.src ? hex(nearest(r.src, pal)) : palette[Math.floor(rnd() * palette.length)]);
    commit({ type: 'all', from: beforeC, to: after });
  };
  paintPalette();

  // ---------- Generation ----------
  function setBusy(b) { $('#busy').hidden = !b; }
  function generate() {
    if (!C.w) return;
    if (P.mode === 'photo' && !photo) return;
    setBusy(true);
    setTimeout(() => { // let the spinner paint before heavy work
      try { doc = P.mode === 'photo' ? fromPhoto() : fromBlank(); }
      catch (err) { console.error(err); api.toast('Generation failed. Try less detail'); }
      undo = []; redo = []; setBusy(false); renderArt(); fitView(); hist();
    }, 30);
  }
  function fromBlank() {
    const W = 1600, H = 1000, rnd = mulberry(P.seed), pal = palette, pickC = () => pal[Math.floor(rnd() * pal.length)];
    const regions = [];
    const n = Math.round(P.detail / (P.gen === 'voronoi' ? 2 : 1));
    if (P.gen === 'voronoi' || P.gen === 'mosaic') {
      const sites = [];
      if (P.gen === 'mosaic') { const s = Math.max(14, P.facet * 2); for (let y = s / 2; y < H; y += s) for (let x = s / 2; x < W; x += s) sites.push([x + (rnd() - 0.5) * s * 0.8, y + (rnd() - 0.5) * s * 0.8]); }
      else for (let i = 0; i < Math.min(n, 1500); i++) sites.push([rnd() * W, rnd() * H]);
      voronoi(sites, W, H).forEach(p => p.length > 2 && regions.push({ pts: p, color: pickC() }));
      return { w: W, h: H, regions, grout: P.gen === 'mosaic' ? '#14120f' : null };
    }
    if (P.gen === 'lowpoly') {
      const pts = [[0, 0], [W, 0], [0, H], [W, H]];
      for (let i = 0; i < 12; i++) pts.push([W * i / 12, 0], [W * i / 12, H], [0, H * i / 12], [W, H * i / 12]);
      for (let i = 0; i < Math.min(n, 2500); i++) pts.push([rnd() * W, rnd() * H]);
      const ang = rnd() * Math.PI, cs = pal.map(rgbOf);
      for (const [a, b, c] of delaunay(pts)) {
        const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3, cy = (pts[a][1] + pts[b][1] + pts[c][1]) / 3;
        const t = Math.max(0, Math.min(0.999, ((cx / W - 0.5) * Math.cos(ang) + (cy / H - 0.5) * Math.sin(ang)) * 0.9 + 0.5 + (rnd() - 0.5) * 0.12));
        const f = t * (cs.length - 1), i = Math.floor(f), k = f - i, A = cs[i], B = cs[Math.min(cs.length - 1, i + 1)];
        regions.push({ pts: [pts[a], pts[b], pts[c]], color: hex(A.map((v, j) => v + (B[j] - v) * k)) });
      }
      return { w: W, h: H, regions };
    }
    if (P.gen === 'grid') {
      const s = P.facet * 2;
      for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
        const q = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
        const d = rnd() < 0.5;
        regions.push({ pts: d ? [q[0], q[1], q[2]] : [q[0], q[1], q[3]], color: pickC() }, { pts: d ? [q[0], q[2], q[3]] : [q[1], q[2], q[3]], color: pickC() });
      }
      return { w: W, h: H, regions };
    }
    if (P.gen === 'radial') {
      const cx = W / 2, cy = H / 2, rings = Math.max(4, Math.round(P.detail / 120)), R = Math.hypot(W, H) / 2, sym = 4 + Math.floor(rnd() * 5) * 2;
      const ringC = Array.from({ length: rings }, () => Array.from({ length: 3 }, pickC));
      for (let r = 0; r < rings; r++) {
        const r0 = R * (r / rings) ** 1.2, r1 = R * ((r + 1) / rings) ** 1.2, sec = sym * (1 + Math.floor(r / 2)), off = r % 2 ? Math.PI / sec : 0;
        for (let k = 0; k < sec; k++) {
          const a0 = off + k / sec * Math.PI * 2, a1 = off + (k + 1) / sec * Math.PI * 2, pts = [];
          for (let t = 0; t <= 6; t++) { const a = a0 + (a1 - a0) * t / 6; pts.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]); }
          for (let t = 6; t >= 0; t--) { const a = a0 + (a1 - a0) * t / 6; pts.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]); }
          regions.push({ pts, color: ringC[r][k % (r % 3 === 0 ? 2 : 3)] });
        }
      }
      return { w: W, h: H, regions };
    }
    // shapes
    regions.push({ pts: [[0, 0], [W, 0], [W, H], [0, H]], color: pal[0] });
    const count = Math.max(8, Math.round(P.detail / 40));
    for (let i = 0; i < count; i++) {
      const x = rnd() * W, y = rnd() * H, s = (P.facet * 1.5 + rnd() * 220) * (1 - i / count * 0.6), kind = Math.floor(rnd() * 4), rot = rnd() * Math.PI, pts = [];
      if (kind === 0) for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]); }
      else if (kind === 1) for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]); }
      else if (kind === 2) for (let k = 0; k < 3; k++) { const a = rot + k * Math.PI * 2 / 3; pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]); }
      else for (let k = 0; k <= 20; k++) { const a = rot + k / 20 * Math.PI; pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]); }
      regions.push({ pts, color: pal[1 + Math.floor(rnd() * (pal.length - 1))] });
    }
    return { w: W, h: H, regions };
  }

  let pdata = null;
  function samplePixels(n) {
    const out = [], { w, h, d } = pdata, rnd = mulberry(3);
    for (let i = 0; i < n; i++) { const k = (Math.floor(rnd() * w) + Math.floor(rnd() * h) * w) * 4; out.push([d[k], d[k + 1], d[k + 2]]); }
    return out;
  }
  function avg(x, y, r = 2) {
    const { w, h, d } = pdata; let s = [0, 0, 0], n = 0;
    for (let yy = Math.max(0, Math.round(y - r)); yy <= Math.min(h - 1, Math.round(y + r)); yy++) for (let xx = Math.max(0, Math.round(x - r)); xx <= Math.min(w - 1, Math.round(x + r)); xx++) { const k = (yy * w + xx) * 4; s[0] += d[k]; s[1] += d[k + 1]; s[2] += d[k + 2]; n++; }
    return n ? s.map(v => v / n) : [0, 0, 0];
  }
  function fromPhoto() {
    const { w: W, h: H } = pdata, rnd = mulberry(P.seed);
    const quant = P.colors ? kmeans(samplePixels(3000), P.colors, rnd) : null;
    const col = c => quant ? nearest(c, quant) : c;
    const regions = [];
    if (P.style === 'hex') {
      const s = P.facet, hh = s * Math.sqrt(3) / 2;
      for (let row = 0, y = 0; y < H + hh; row++, y += hh) for (let x = (row % 2) * s * 0.75; x < W + s; x += s * 1.5) {
        const pts = Array.from({ length: 6 }, (_, k) => [x + Math.cos(k * Math.PI / 3) * s / 2 * 1.02, y + Math.sin(k * Math.PI / 3) * s / 2 * 1.02]);
        const src = avg(x, y, s / 4); regions.push({ pts, color: hex(col(src)), src });
      }
      return { w: W, h: H, regions, quant };
    }
    // Feature points: random + edge-weighted (Sobel) + border.
    const { mag, max } = sobel();
    const pts = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
    for (let i = 1; i < 10; i++) pts.push([W * i / 10, 0], [W * i / 10, H - 1], [0, H * i / 10], [W - 1, H * i / 10]);
    const N = Math.min(P.detail, 3000), nEdge = Math.round(N * P.edge);
    for (let i = 0; i < N - nEdge; i++) pts.push([rnd() * W, rnd() * H]);
    for (let i = 0, tries = 0; i < nEdge && tries < nEdge * 40; tries++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H); if (rnd() * max < mag[y * W + x]) { pts.push([x, y]); i++; } }
    if (P.style === 'voronoi') voronoi(pts, W, H).forEach((p, i) => { if (p.length > 2) { const src = avg(pts[i][0], pts[i][1], 2); regions.push({ pts: p, color: hex(col(src)), src }); } });
    else for (const [a, b, c] of delaunay(pts)) {
      const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3, cy = (pts[a][1] + pts[b][1] + pts[c][1]) / 3;
      const s1 = avg(cx, cy, 2), s2 = avg((cx + pts[a][0]) / 2, (cy + pts[a][1]) / 2, 1), s3 = avg((cx + pts[b][0]) / 2, (cy + pts[b][1]) / 2, 1), s4 = avg((cx + pts[c][0]) / 2, (cy + pts[c][1]) / 2, 1);
      const src = s1.map((v, j) => (v * 2 + s2[j] + s3[j] + s4[j]) / 5);
      regions.push({ pts: [pts[a], pts[b], pts[c]], color: hex(col(src)), src });
    }
    return { w: W, h: H, regions, quant };
  }
  function sobel() {
    const { w, h, d } = pdata, g = new Float32Array(w * h), mag = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    let max = 1;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      mag[i] = Math.hypot(gx, gy); if (mag[i] > max) max = mag[i];
    }
    return { mag, max };
  }
  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return api.toast('Please choose an image file');
    const url = URL.createObjectURL(file), im = new Image();
    setBusy(true);
    im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
      pdata = { w, h, d: x.getImageData(0, 0, w, h).data }; photo = c;
      URL.revokeObjectURL(url);
      $('#fromImg').disabled = false;
      generate();
    };
    im.onerror = () => { setBusy(false); URL.revokeObjectURL(url); api.toast('Couldn’t read that image'); };
    im.src = url;
  }
  $('#load').onclick = () => $('#file').click();
  $('#file').onchange = e => loadPhoto(e.target.files[0]);
  const stage = $('#stage');
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('drag'); }, { signal: api.signal });
  stage.addEventListener('dragleave', () => stage.classList.remove('drag'), { signal: api.signal });
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('drag'); if (P.mode !== 'photo') setMode('photo'); loadPhoto(e.dataTransfer.files[0]); }, { signal: api.signal });

  // ---------- Rendering ----------
  function renderArt(target = actx, scale = 1) {
    if (!doc) return;
    const c = target.canvas; c.width = doc.w * scale; c.height = doc.h * scale;
    target.setTransform(scale, 0, 0, scale, 0, 0);
    target.fillStyle = doc.grout || '#111'; target.fillRect(0, 0, doc.w, doc.h);
    target.lineJoin = 'round';
    for (const r of doc.regions) {
      target.beginPath(); r.pts.forEach(([x, y], i) => i ? target.lineTo(x, y) : target.moveTo(x, y)); target.closePath();
      target.fillStyle = r.color; target.fill();
      // Hairline in the region's own colour hides anti-aliasing seams; outlines add a dark stroke.
      if (doc.grout) { target.strokeStyle = doc.grout; target.lineWidth = 3; target.stroke(); }
      else if (P.outline) { target.strokeStyle = 'rgba(10,10,12,.55)'; target.lineWidth = 1.2; target.stroke(); }
      else { target.strokeStyle = r.color; target.lineWidth = 0.8; target.stroke(); }
    }
    if (target === actx) draw();
  }
  function fitView() {
    if (!doc || !C.w) return;
    view.s = Math.min(C.w / doc.w, C.h / doc.h) * 0.92;
    view.x = (C.w - doc.w * view.s) / 2; view.y = (C.h - doc.h * view.s) / 2;
    draw();
  }
  function draw() {
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    if (!doc) return;
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.s, view.s);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30 / view.s;
    ctx.drawImage(before && photo ? photo : art, 0, 0, doc.w, doc.h);
    ctx.restore();
    $('#info').textContent = `${doc.regions.length.toLocaleString()} regions · ${Math.round(view.s * 100)}%${before ? ' · original' : ''}`;
  }

  // ---------- Editing ----------
  function commit(op) { apply(op, 'to'); undo.push(op); if (undo.length > 200) undo.shift(); redo = []; hist(); }
  function apply(op, dir) {
    if (op.type === 'fill') doc.regions[op.i].color = op[dir];
    else doc.regions.forEach((r, i) => r.color = op[dir][i]);
    renderArt();
  }
  function hist() { $('#undo').disabled = !undo.length; $('#redo').disabled = !redo.length; }
  const doUndo = () => { const op = undo.pop(); if (!op) return; apply(op, 'from'); redo.push(op); hist(); };
  const doRedo = () => { const op = redo.pop(); if (!op) return; apply(op, 'to'); undo.push(op); hist(); };
  $('#undo').onclick = doUndo; $('#redo').onclick = doRedo;
  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || /INPUT/.test(document.activeElement?.tagName)) return;
    e.preventDefault(); e.shiftKey ? doRedo() : doUndo();
  }, { signal: api.signal });
  $('#exp').onclick = () => {
    if (!doc) return;
    const c = document.createElement('canvas');
    renderArt(c.getContext('2d'), 1);
    c.toBlob(b => { if (!b) return api.toast('Export failed'); const u = URL.createObjectURL(b); download(`playground-art-${P.seed}.png`, u); setTimeout(() => URL.revokeObjectURL(u), 2000); api.toast('PNG exported'); }, 'image/png');
  };
  const toDoc = (x, y) => [(x - view.x) / view.s, (y - view.y) / view.s];
  const hitTest = (x, y) => { for (let i = doc.regions.length - 1; i >= 0; i--) if (inPoly(x, y, doc.regions[i].pts)) return i; return -1; };
  const zoomAt = (f, cx, cy) => { const ns = Math.min(12, Math.max(0.05, view.s * f)); view.x = cx - (cx - view.x) * ns / view.s; view.y = cy - (cy - view.y) * ns / view.s; view.s = ns; draw(); };
  $('#zi').onclick = () => zoomAt(1.25, C.w / 2, C.h / 2); $('#zo').onclick = () => zoomAt(0.8, C.w / 2, C.h / 2); $('#fit').onclick = fitView;
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.offsetX, e.offsetY); }, { passive: false, signal: api.signal });
  const pointers = new Map(); let pan = null, pinch = null, moved = false;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]); moved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; pan = null; }
    else pan = { x: e.offsetX, y: e.offsetY };
  }, { signal: api.signal });
  cv.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch.d = d; moved = true; return; }
    if (pan && (toolMode === 'hand' || Math.hypot(e.offsetX - pan.x, e.offsetY - pan.y) > 6 || moved)) {
      if (!moved && toolMode !== 'hand' && Math.hypot(e.offsetX - pan.x, e.offsetY - pan.y) <= 6) return;
      view.x += e.offsetX - pan.x; view.y += e.offsetY - pan.y; pan = { x: e.offsetX, y: e.offsetY }; moved = true; draw();
    }
  }, { signal: api.signal });
  cv.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pan || moved || !doc || toolMode === 'hand' || before) { pan = null; return; }
    pan = null;
    const [x, y] = toDoc(e.offsetX, e.offsetY), i = hitTest(x, y);
    if (i < 0) return;
    if (toolMode === 'picker') { const c = doc.regions[i].color; let k = palette.indexOf(c); if (k < 0) { palette.push(c); k = palette.length - 1; } active = k; paintPalette(); api.toast(`Picked ${c}`); }
    else if (doc.regions[i].color !== palette[active]) { commit({ type: 'fill', i, from: doc.regions[i].color, to: palette[active] }); api.haptics.pulse('tick'); }
  }, { signal: api.signal });

  setMode('gen');
  return { reset: () => generate(), confirmReset: 'Regenerate the artwork? Your recolouring edits will be lost.' };
}
