import { icon, fmtTime } from '../core/ui.js';

// ---- Pure logic (tested in tests/logic.test.mjs) ----
// tiles: [{id, v, r, c}]. Returns every tile with its destination; merged-away tiles carry gone:true.
export function slide(tiles, size, dir, idStart = 1) {
  let nid = idStart, score = 0, moved = false;
  const at = new Map(tiles.map(t => [t.r * size + t.c, t]));
  const out = [];
  for (let L = 0; L < size; L++) {
    const cells = [];
    for (let k = 0; k < size; k++) {
      if (dir === 'left') cells.push([L, k]);
      else if (dir === 'right') cells.push([L, size - 1 - k]);
      else if (dir === 'up') cells.push([k, L]);
      else cells.push([size - 1 - k, L]);
    }
    const line = cells.map(([r, c]) => at.get(r * size + c)).filter(Boolean);
    let slot = 0, prev = null;
    for (const t of line) {
      if (prev && !prev.merged && prev.t.v === t.v) {
        const [r, c] = cells[slot - 1];
        prev.t.gone = true;
        out.push({ id: t.id, v: t.v, r, c, gone: true });
        const m = { id: nid++, v: t.v * 2, r, c, merged: true };
        out.push(m);
        score += m.v; moved = true;
        prev.merged = true; // a tile merges at most once per move
      } else {
        const [r, c] = cells[slot++];
        const nt = { id: t.id, v: t.v, r, c };
        if (r !== t.r || c !== t.c) moved = true;
        out.push(nt);
        prev = { t: nt, merged: false };
      }
    }
  }
  return { tiles: out, score, moved, nextId: nid };
}
export const live = tiles => tiles.filter(t => !t.gone).map(({ id, v, r, c }) => ({ id, v, r, c }));
export function canMove(tiles, size) {
  if (tiles.length < size * size) return true;
  const g = new Map(tiles.map(t => [t.r * size + t.c, t.v]));
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const v = g.get(r * size + c);
    if ((c + 1 < size && g.get(r * size + c + 1) === v) || (r + 1 < size && g.get((r + 1) * size + c) === v)) return true;
  }
  return false;
}
export function spawn(tiles, size, id, rand = Math.random) {
  const used = new Set(tiles.map(t => t.r * size + t.c));
  const empty = [];
  for (let i = 0; i < size * size; i++) if (!used.has(i)) empty.push(i);
  if (!empty.length) return null;
  const i = empty[Math.floor(rand() * empty.length)];
  return { id, v: rand() < 0.9 ? 2 : 4, r: Math.floor(i / size), c: i % size };
}

const MODES = {
  classic: { label: 'Classic 4×4', size: 4, undo: 3 },
  relaxed: { label: 'Relaxed 5×5', size: 5, undo: Infinity },
  attack: { label: 'Score Attack', size: 4, undo: 0, time: 120 },
};
const COLORS = ['#3a332b', '#efe3cf', '#f1d9b0', '#f4b26b', '#f39257', '#f2744f', '#ef5a3c', '#f3d06b', '#f2c94c', '#f0bd30', '#eeb11a', '#ffd24d', '#9c8cff'];

export function mount(root, api) {
  let mode = api.load('mode', 'classic');
  if (!MODES[mode]) mode = 'classic';
  const best = api.load('best', {});
  let size, tiles, score, nid, history, undosLeft, over, deadline, reached2048;

  root.innerHTML = `<div class="nm">
    <div class="seg" id="modes">${Object.entries(MODES).map(([k, m]) => `<button data-m="${k}">${m.label}</button>`).join('')}</div>
    <div class="nm-stats">
      <div class="stat"><span>Score</span><b id="sc">0</b></div>
      <div class="stat"><span>Best</span><b id="bs">0</b></div>
      <div class="stat" id="tWrap"><span>Time</span><b id="tm">2:00</b></div>
    </div>
    <div class="nm-board" id="board" aria-label="Number merge board. Use arrow keys or swipe." tabindex="0">
      <div class="overlay" id="over" hidden><div class="box"><h2 id="overT">Game over</h2><p class="muted" id="overS"></p><button class="btn primary lg" id="again">Play again</button></div></div>
    </div>
    <p class="sr" id="live" aria-live="polite"></p>
    <div class="row" style="justify-content:center"><button class="btn" id="undo">${icon('undo')} Undo <span class="mono" id="ul"></span></button><button class="btn primary" id="restart">${icon('reset')} New game</button></div>
  </div>
  <style>
    .nm { flex: 1; display: grid; justify-items: center; align-content: start; gap: 16px; padding: 22px 16px 40px; }
    .nm-stats { display: flex; gap: 8px; width: min(100%, 480px); } .nm-stats .stat { flex: 1; }
    .nm-board { --n: 4; --gap: 10px; position: relative; width: min(100%, 480px, 60dvh); aspect-ratio: 1; border-radius: 18px; background: #1b1814; border: 1px solid var(--line); padding: var(--gap); touch-action: none; user-select: none; box-shadow: var(--shadow); }
    .nm-board .overlay { border-radius: 18px; }
    .nm-cell, .nm-tile { position: absolute; width: calc((100% - var(--gap) * (var(--n) + 1)) / var(--n)); aspect-ratio: 1; left: calc(var(--gap) + var(--c) * (100% - var(--gap)) / var(--n)); top: calc(var(--gap) + var(--r) * (100% - var(--gap)) / var(--n)); border-radius: 10px; }
    .nm-cell { background: #26221d; }
    .nm-tile { display: grid; place-items: center; font: 700 clamp(16px, 6vw, 34px) var(--f-mono); transition: left 110ms ease-out, top 110ms ease-out; color: #2a1f12; box-shadow: inset 0 -3px 0 rgba(0,0,0,.15); }
    .nm-board[style*="--n: 5"] .nm-tile { font-size: clamp(14px, 5vw, 28px); }
    .nm-tile.big { font-size: clamp(13px, 4.4vw, 26px); color: #fff8ec; }
    .nm-tile.new { animation: nmIn 160ms 100ms both ease-out; }
    .nm-tile.merged { animation: nmPop 180ms 90ms both ease-out; z-index: 2; }
    @keyframes nmIn { from { transform: scale(0); } }
    @keyframes nmPop { 0% { transform: scale(.6); } 60% { transform: scale(1.14); } }
  </style>`;
  const $ = s => root.querySelector(s);
  const board = $('#board');
  const els = new Map();

  function newGame() {
    const m = MODES[mode];
    size = m.size; tiles = []; score = 0; nid = 1; history = []; undosLeft = m.undo; over = false; reached2048 = false;
    deadline = m.time ? performance.now() + m.time * 1000 : null;
    api.save('mode', mode);
    root.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    $('#tWrap').hidden = !m.time;
    $('#undo').hidden = m.undo === 0;
    board.style.setProperty('--n', size);
    board.querySelectorAll('.nm-cell, .nm-tile').forEach(e => e.remove());
    els.clear();
    for (let i = 0; i < size * size; i++) board.insertAdjacentHTML('beforeend', `<div class="nm-cell" style="--r:${Math.floor(i / size)};--c:${i % size}"></div>`);
    $('#over').hidden = true;
    for (let k = 0; k < 2; k++) addTile();
    paint(tiles); hud();
  }

  function addTile() { const t = spawn(tiles, size, nid++); if (t) { t.isNew = true; tiles.push(t); } }

  function tileEl(t) {
    let e = els.get(t.id);
    if (!e) { e = document.createElement('div'); e.className = 'nm-tile'; els.set(t.id, e); board.insertBefore(e, $('#over')); }
    const lvl = Math.min(COLORS.length - 1, Math.log2(t.v));
    e.style.setProperty('--r', t.r); e.style.setProperty('--c', t.c);
    e.style.background = COLORS[lvl];
    e.classList.toggle('big', t.v >= 8);
    e.textContent = t.v;
    return e;
  }

  function paint(list) {
    for (const t of list) {
      const e = tileEl(t);
      if (t.merged) e.classList.add('merged');
      if (t.isNew) e.classList.add('new');
      if (t.gone) { els.delete(t.id); setTimeout(() => e.remove(), 120); }
    }
    for (const t of list) { delete t.isNew; }
  }

  function hud() {
    $('#sc').textContent = score;
    const b = Math.max(best[mode] || 0, score);
    $('#bs').textContent = b;
    $('#ul').textContent = undosLeft === Infinity ? '' : `(${undosLeft})`;
    $('#undo').disabled = !history.length || undosLeft <= 0 || over;
  }

  function move(dir) {
    if (over) return;
    const res = slide(tiles, size, dir, nid);
    if (!res.moved) { api.haptics.pulse('tick'); return; }
    history.push({ tiles: tiles.map(t => ({ ...t })), score });
    if (history.length > 50) history.shift();
    nid = res.nextId; score += res.score;
    // Move existing tiles first, then mark the stale DOM for cleanup.
    for (const e of board.querySelectorAll('.nm-tile.merged, .nm-tile.new')) e.classList.remove('merged', 'new');
    paint(res.tiles);
    tiles = live(res.tiles);
    addTile(); paint(tiles.filter(t => t.isNew));
    const bus = api.bus();
    if (res.score) {
      const top = Math.max(...res.tiles.filter(t => t.merged).map(t => t.v));
      api.audio.tone(bus, { freq: 200 + Math.log2(top) * 60, to: 300 + Math.log2(top) * 80, dur: 0.12, type: 'triangle', vol: 0.14 });
      api.haptics.pulse('click');
      $('#live').textContent = `Merged into ${top}. Score ${score}.`;
      if (top >= 2048 && !reached2048) { reached2048 = true; api.toast('2048! Keep going?'); }
    } else api.audio.burst(bus, { dur: 0.05, vol: 0.06, freq: 1200, q: 0.8 });
    if (score > (best[mode] || 0)) { best[mode] = score; api.save('best', best); }
    if (!canMove(tiles, size)) end('No moves left');
    hud();
  }

  function end(title) {
    over = true;
    $('#overT').textContent = title;
    $('#overS').textContent = `Score ${score} · Best ${best[mode] || score}`;
    $('#over').hidden = false; $('#again').focus();
    api.haptics.pulse('bump');
    hud();
  }

  $('#undo').onclick = () => {
    const h = history.pop(); if (!h || undosLeft <= 0) return;
    undosLeft--;
    board.querySelectorAll('.nm-tile').forEach(e => e.remove()); els.clear();
    tiles = h.tiles; score = h.score; paint(tiles); hud();
  };
  $('#restart').onclick = newGame;
  $('#again').onclick = newGame;
  $('#modes').onclick = e => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; newGame(); } };

  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.getElementById('modal').open) return;
    const d = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
    if (d) { e.preventDefault(); move(d); }
  }, { signal: api.signal });
  let sx, sy;
  board.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; }, { signal: api.signal });
  board.addEventListener('pointerup', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { signal: api.signal });

  api.interval(() => {
    if (!deadline || over) return;
    const left = (deadline - performance.now()) / 1000;
    $('#tm').textContent = fmtTime(Math.ceil(left));
    if (left <= 0) end('Time!');
  }, 200);

  newGame();
  return { reset: newGame };
}
