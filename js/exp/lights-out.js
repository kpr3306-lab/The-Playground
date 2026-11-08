import { icon, fmtTime } from '../core/ui.js';

// ---- Pure logic (tested in tests/logic.test.mjs) ----
export function press(board, n, i) {
  const b = board.slice();
  const r = Math.floor(i / n), c = i % n;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) b[rr * n + cc] ^= 1;
  }
  return b;
}
// Scramble a solved board with random presses: always solvable, and the press set is a known solution.
export function generate(n, rand = Math.random) {
  for (;;) {
    let b = new Array(n * n).fill(0);
    const sol = new Array(n * n).fill(0);
    const k = Math.max(3, Math.round(n * n * 0.4));
    for (let j = 0; j < k; j++) { const i = Math.floor(rand() * n * n); b = press(b, n, i); sol[i] ^= 1; }
    if (b.some(Boolean)) return { board: b, sol };
  }
}

export function mount(root, api) {
  const best = api.load('best', {});
  let n = api.load('size', 5), relaxed = api.load('relaxed', true);
  let board, start, sol, pressed, moves, history, t0, elapsed, won, limit, hintAt = -1, focusI = 0;

  root.innerHTML = `<div class="lo">
    <div class="lo-top">
      <div class="seg" id="size">${[3, 4, 5, 6].map(s => `<button data-n="${s}">${s}×${s}</button>`).join('')}</div>
      <div class="seg" id="mode"><button data-r="1">Relaxed</button><button data-r="0">Move limit</button></div>
    </div>
    <div class="lo-stats" aria-live="polite">
      <div class="stat"><span>Moves</span><b id="mv">0</b></div>
      <div class="stat"><span>Time</span><b id="tm">0:00</b></div>
      <div class="stat"><span>Lights on</span><b id="on">0</b></div>
      <div class="stat"><span>Best</span><b id="bst">–</b></div>
    </div>
    <div class="lo-board-wrap"><div class="lo-board" id="board" role="grid" aria-label="Lights Out board"></div>
      <div class="overlay" id="win" hidden><div class="box"><h2>Lights out!</h2><p class="muted" id="winTxt"></p><button class="btn primary lg" id="again">New puzzle</button></div></div>
    </div>
    <div class="row lo-actions">
      <button class="btn" id="undo">${icon('undo')} Undo</button>
      <button class="btn" id="hint">${icon('bulb')} Hint</button>
      <button class="btn" id="restart">${icon('reset')} Restart</button>
      <button class="btn primary" id="new">${icon('shuffle')} New puzzle</button>
    </div>
  </div>
  <style>
    .lo { flex: 1; display: grid; justify-items: center; align-content: start; gap: 18px; padding: 22px 16px 40px; }
    .lo-top { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    .lo-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(100%, 520px); }
    .lo-board-wrap { position: relative; width: min(100%, 520px, 62dvh); aspect-ratio: 1; }
    .lo-board { display: grid; gap: 8px; width: 100%; height: 100%; padding: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow); touch-action: manipulation; }
    .lo-board-wrap .overlay { border-radius: 22px; }
    .lt { border: 0; border-radius: 22%; cursor: pointer; position: relative; background: #24211c; box-shadow: inset 0 -4px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04); transition: background 200ms, box-shadow 200ms, transform 90ms; }
    .lt::after { content: ""; position: absolute; inset: 34%; border-radius: 50%; border: 2px solid #3b362e; transition: all 200ms; }
    .lt.on { background: radial-gradient(circle at 50% 40%, #fff4c2, #ffd24d 55%, #e6a91d); box-shadow: 0 0 22px rgba(255, 210, 77, .45), inset 0 -4px 0 rgba(150, 90, 0, .35); }
    .lt.on::after { border-color: rgba(120, 70, 0, .5); background: rgba(255,255,255,.35); }
    .lt:active { transform: scale(.94); }
    .lt.hint { outline: 3px dashed var(--accent); outline-offset: 2px; }
    .lo-actions { justify-content: center; }
    @media (max-width: 480px) { .lo-stats { grid-template-columns: repeat(2, 1fr); } }
  </style>`;
  const $ = s => root.querySelector(s);
  const boardEl = $('#board');

  function tone(on) {
    const bus = api.bus();
    api.audio.tone(bus, { freq: on ? 660 : 440, to: on ? 880 : 330, dur: 0.09, type: 'triangle', vol: 0.12 });
  }

  function newGame(keep) {
    if (!keep) ({ board: start, sol } = generate(n));
    board = start.slice(); pressed = new Array(n * n).fill(0);
    moves = 0; history = []; t0 = null; elapsed = 0; won = false; hintAt = -1;
    limit = relaxed ? Infinity : sol.reduce((a, b) => a + b, 0) * 2 + n;
    $('#win').hidden = true;
    api.save('size', n); api.save('relaxed', relaxed);
    root.querySelectorAll('#size button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === n));
    root.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-pressed', !!+b.dataset.r === relaxed));
    build(); render();
  }

  function build() {
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    boardEl.innerHTML = board.map((_, i) => `<button class="lt" data-i="${i}" role="gridcell" tabindex="${i === 0 ? 0 : -1}"></button>`).join('');
    focusI = 0;
  }

  function render() {
    boardEl.querySelectorAll('.lt').forEach((b, i) => {
      b.classList.toggle('on', !!board[i]);
      b.classList.toggle('hint', i === hintAt);
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, ${board[i] ? 'on' : 'off'}`);
    });
    $('#mv').textContent = limit === Infinity ? moves : `${moves}/${limit}`;
    $('#on').textContent = board.filter(Boolean).length;
    const b = best[n];
    $('#bst').textContent = b ? `${b.moves} · ${fmtTime(b.time)}` : '–';
    $('#undo').disabled = !history.length || won;
  }

  function act(i) {
    if (won) return;
    if (t0 == null) t0 = performance.now();
    history.push(i);
    board = press(board, n, i); pressed[i] ^= 1; moves++;
    if (hintAt === i) hintAt = -1;
    tone(board[i]); api.haptics.pulse('click');
    if (!board.some(Boolean)) return win();
    if (moves >= limit) { render(); api.toast('Out of moves. Restart or undo'); return; }
    render();
  }

  function win() {
    won = true; elapsed = (performance.now() - t0) / 1000;
    const prev = best[n];
    const isBest = !prev || moves < prev.moves || (moves === prev.moves && elapsed < prev.time);
    if (isBest) { best[n] = { moves, time: Math.round(elapsed) }; api.save('best', best); }
    render();
    $('#winTxt').textContent = `${moves} moves in ${fmtTime(elapsed)}${isBest ? ' · new best!' : ''}`;
    $('#win').hidden = false; $('#again').focus();
    const bus = api.bus();
    [523, 659, 784, 1047].forEach((f, k) => api.audio.tone(bus, { freq: f, dur: 0.25, type: 'triangle', vol: 0.12, when: k * 0.09 }));
    api.haptics.pulse('win');
  }

  boardEl.addEventListener('click', e => { const b = e.target.closest('.lt'); if (b) act(+b.dataset.i); });
  boardEl.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: n, ArrowUp: -n }[e.key];
    if (d == null) return;
    e.preventDefault();
    const nx = focusI + d;
    if (nx < 0 || nx >= n * n || (Math.abs(d) === 1 && Math.floor(nx / n) !== Math.floor(focusI / n))) return;
    const btns = boardEl.querySelectorAll('.lt');
    btns[focusI].tabIndex = -1; focusI = nx; btns[focusI].tabIndex = 0; btns[focusI].focus();
  });
  $('#undo').onclick = () => { const i = history.pop(); if (i == null) return; board = press(board, n, i); pressed[i] ^= 1; moves--; render(); };
  $('#hint').onclick = () => {
    // Remaining solution = original solution XOR presses so far (presses commute and are self-inverse).
    const rem = sol.map((s, i) => s ^ pressed[i]);
    hintAt = rem.findIndex(Boolean); render();
  };
  $('#restart').onclick = () => newGame(true);
  $('#new').onclick = () => newGame(false);
  $('#again').onclick = () => newGame(false);
  $('#size').onclick = e => { const b = e.target.closest('button'); if (b) { n = +b.dataset.n; newGame(false); } };
  $('#mode').onclick = e => { const b = e.target.closest('button'); if (b) { relaxed = !!+b.dataset.r; newGame(true); } };
  api.interval(() => { if (t0 != null && !won) $('#tm').textContent = fmtTime((performance.now() - t0) / 1000); else if (t0 == null) $('#tm').textContent = '0:00'; }, 250);

  newGame(false);
  return { reset: () => newGame(true) };
}
