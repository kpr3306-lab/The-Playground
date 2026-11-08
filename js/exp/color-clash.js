import { icon } from '../core/ui.js';

const NAMED = [['Red', '#ef4a4a'], ['Blue', '#3b8cff'], ['Green', '#3fbf6a'], ['Yellow', '#ffd23f'], ['Purple', '#a35cff'], ['Orange', '#ff8a2a'], ['Pink', '#ff6fb5']];
const MODES = { match: 'Match the swatch', odd: 'Odd one out', stroop: 'Name vs colour', survival: 'Survival' };
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hsl = (h, s, l) => `hsl(${(h + 360) % 360} ${s}% ${l}%)`;

function roundMatch(level) {
  const k = Math.min(8, 4 + Math.floor(level / 3));
  const h = rnd(360), s = 55 + rnd(30), l = 45 + rnd(15);
  const delta = Math.max(5, 38 - level * 2.5);
  const opts = [{ bg: hsl(h, s, l), ok: true }];
  const used = new Set([0]);
  while (opts.length < k) {
    const off = (rnd(2) ? 1 : -1) * (delta * (1 + rnd(3)));
    const key = Math.round(off);
    if (used.has(key)) continue;
    used.add(key);
    opts.push({ bg: hsl(h + off, s, l + (rnd(3) - 1) * 4) });
  }
  return { prompt: `<div class="cc-target" style="background:${hsl(h, s, l)}" aria-label="Target colour"></div><p>Find this exact colour</p>`, opts: shuffle(opts), cols: k > 6 ? 4 : k > 4 ? 3 : 2 };
}
function roundOdd(level) {
  const n = Math.min(6, 2 + Math.floor(level / 3)), total = n * n;
  const h = rnd(360), s = 50 + rnd(35), l = 42 + rnd(18);
  const d = Math.max(3, 20 - level * 1.4) * (l > 50 ? -1 : 1);
  const odd = rnd(total);
  return { prompt: `<p>Which tile is different?</p>`, opts: Array.from({ length: total }, (_, i) => ({ bg: hsl(h, s, i === odd ? l + d : l), ok: i === odd })), cols: n };
}
function roundStroop() {
  const [word, ink] = shuffle([...NAMED]).slice(0, 2);
  const askInk = rnd(2) === 0;
  const answer = askInk ? ink[0] : word[0];
  const choices = shuffle([word, ink, ...shuffle(NAMED.filter(c => c !== word && c !== ink)).slice(0, 2)]);
  return {
    prompt: `<p class="cc-ask">${askInk ? 'Pick the colour of the <b>INK</b>' : 'Pick what the <b>WORD</b> says'}</p><div class="cc-word" style="color:${ink[1]}">${word[0].toUpperCase()}</div>`,
    opts: choices.map(c => ({ label: c[0], dot: c[1], ok: c[0] === answer })), cols: 2,
  };
}

export function mount(root, api) {
  const best = api.load('best', {});
  let mode = api.load('mode', 'match'), length = api.load('len', 60);
  let S = null; // run state

  root.innerHTML = `<div class="cc">
    <div class="cc-hud">
      <div class="stat"><span>Score</span><b id="sc">0</b></div>
      <div class="stat"><span>Time</span><b id="tm">–</b></div>
      <div class="stat"><span>Streak</span><b id="st">0</b></div>
      <div class="stat"><span>Accuracy</span><b id="ac">–</b></div>
      <button class="btn" id="pause" aria-label="Pause">${icon('pause')}</button>
    </div>
    <div class="cc-bar"><i id="bar"></i></div>
    <div class="cc-stage">
      <div class="cc-prompt" id="prompt"></div>
      <div class="cc-opts" id="opts"></div>
      <div class="overlay" id="ov"><div class="box" id="ovBox"></div></div>
    </div>
  </div>
  <style>
    .cc { flex: 1; display: grid; grid-template-rows: auto auto 1fr; gap: 12px; padding: 16px; max-width: 760px; width: 100%; margin: 0 auto; }
    .cc-hud { display: flex; gap: 8px; } .cc-hud .stat { flex: 1; } .cc-hud .btn { align-self: stretch; height: auto; }
    .cc-bar { height: 6px; border-radius: 6px; background: var(--panel-3); overflow: hidden; } .cc-bar i { display: block; height: 100%; width: 100%; background: var(--accent); transform-origin: left; transition: transform 200ms linear; }
    .cc-stage { position: relative; display: grid; align-content: start; gap: 18px; min-height: min(440px, 70dvh); padding-top: 6px; }
    .cc-stage .overlay { border-radius: 18px; }
    .cc-prompt { display: grid; justify-items: center; gap: 10px; text-align: center; font-weight: 700; font-size: 17px; }
    .cc-target { width: 120px; height: 72px; border-radius: 16px; box-shadow: 0 0 0 4px var(--panel), 0 0 0 5px var(--line-2); }
    .cc-word { font: 800 clamp(48px, 12vw, 84px)/1 var(--f-display); letter-spacing: -.03em; padding: 8px 24px; background: #f4efe6; border-radius: 16px; }
    .cc-ask b { color: var(--accent); }
    .cc-opts { display: grid; gap: 10px; width: min(100%, 520px, 90dvh); margin: 0 auto; }
    .cc-opt { position: relative; aspect-ratio: 1.6; border-radius: 14px; border: 0; cursor: pointer; display: grid; place-items: center; font: 800 18px var(--f-display); color: #111; transition: transform 80ms; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18); touch-action: manipulation; }
    .cc-opt.sq { aspect-ratio: 1; }
    .cc-opt.named { background: var(--panel-2); color: var(--text); border: 1px solid var(--line-2); aspect-ratio: auto; min-height: 64px; display: flex; gap: 10px; justify-content: center; }
    .cc-opt.named i { width: 18px; height: 18px; border-radius: 50%; }
    .cc-opt:active { transform: scale(.96); }
    .cc-opt .k { position: absolute; left: 8px; top: 6px; font: 700 11px var(--f-mono); color: rgba(0,0,0,.45); }
    .cc-opt.named .k { color: var(--muted); }
    .cc-opt.good { outline: 4px solid var(--ok); outline-offset: 2px; } .cc-opt.bad { outline: 4px dashed var(--bad); outline-offset: 2px; }
    .cc-opt.good::after { content: "✓"; position: absolute; font-size: 28px; color: #fff; text-shadow: 0 2px 4px #000; } .cc-opt.bad::after { content: "✕"; position: absolute; font-size: 28px; color: #fff; text-shadow: 0 2px 4px #000; }
    .cc .overlay .seg { justify-content: center; }
  </style>`;
  const $ = s => root.querySelector(s);

  function menu(result) {
    const b = best[`${mode}:${length}`] || 0;
    $('#ovBox').innerHTML = `${result ? `<h2>${result.title}</h2>
      <div class="stats"><div class="stat"><span>Score</span><b>${result.score}</b></div><div class="stat"><span>Accuracy</span><b>${result.acc}</b></div><div class="stat"><span>Best streak</span><b>${result.streak}</b></div><div class="stat"><span>Best</span><b>${result.best}</b></div></div>`
      : `<h2>Color Clash</h2><p class="muted">How fast can you read colour?</p>`}
      <div class="seg" id="mSel">${Object.entries(MODES).map(([k, l]) => `<button data-m="${k}" aria-pressed="${k === mode}">${l}</button>`).join('')}</div>
      <div class="seg" id="lSel" ${mode === 'survival' ? 'hidden' : ''}>${[30, 60, 90].map(l => `<button data-l="${l}" aria-pressed="${l === length}">${l}s</button>`).join('')}</div>
      <p class="muted" style="font-size:13px">Best: <span class="mono">${mode === 'survival' ? best.survival || 0 : b}</span></p>
      <button class="btn primary lg" id="go">${icon('play')} ${result ? 'Play again' : 'Start'}</button>`;
    $('#ov').hidden = false;
    $('#mSel').onclick = e => { const x = e.target.closest('button'); if (x) { mode = x.dataset.m; api.save('mode', mode); menu(result); } };
    $('#lSel').onclick = e => { const x = e.target.closest('button'); if (x) { length = +x.dataset.l; api.save('len', length); menu(result); } };
    $('#go').onclick = start;
    $('#go').focus();
  }

  function start() {
    const surv = mode === 'survival';
    S = { score: 0, streak: 0, bestStreak: 0, right: 0, total: 0, level: 0, time: surv ? 15 : length, max: surv ? 15 : length, paused: false, last: performance.now(), shown: 0, lock: false };
    $('#ov').hidden = true;
    next(); hud();
  }

  function next() {
    const kind = mode === 'survival' ? ['match', 'odd', 'stroop'][rnd(3)] : mode;
    const r = kind === 'match' ? roundMatch(S.level) : kind === 'odd' ? roundOdd(S.level) : roundStroop();
    $('#prompt').innerHTML = r.prompt;
    const opts = $('#opts');
    opts.style.gridTemplateColumns = `repeat(${r.cols}, 1fr)`;
    opts.innerHTML = r.opts.map((o, i) => o.label
      ? `<button class="cc-opt named" data-i="${i}"><span class="k">${i + 1}</span><i style="background:${o.dot}"></i>${o.label}</button>`
      : `<button class="cc-opt ${kind === 'odd' ? 'sq' : ''}" data-i="${i}" style="background:${o.bg}" aria-label="Option ${i + 1}">${r.opts.length <= 9 ? `<span class="k">${i + 1}</span>` : ''}</button>`).join('');
    S.opts = r.opts; S.shown = performance.now(); S.lock = false;
  }

  function answer(i) {
    if (!S || S.paused || S.lock || !S.opts[i]) return;
    S.lock = true; S.total++;
    const ok = S.opts[i].ok, btns = $('#opts').children;
    const bus = api.bus();
    if (ok) {
      const rt = (performance.now() - S.shown) / 1000;
      S.streak++; S.right++; S.level++;
      S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.score += Math.round((100 + Math.max(0, 100 * (1 - rt / 3))) * (1 + Math.floor(S.streak / 5) * 0.5));
      if (mode === 'survival') S.time = Math.min(S.max + 10, S.time + Math.max(0.8, 2.2 - S.level * 0.05));
      btns[i].classList.add('good');
      api.audio.tone(bus, { freq: 660 + Math.min(S.streak, 12) * 40, dur: 0.1, type: 'triangle', vol: 0.12 });
      api.haptics.pulse('tick');
    } else {
      S.streak = 0; S.time -= mode === 'survival' ? 3 : 2;
      S.level = Math.max(0, S.level - 2);
      btns[i].classList.add('bad');
      const good = S.opts.findIndex(o => o.ok); btns[good]?.classList.add('good');
      api.audio.tone(bus, { freq: 180, to: 120, dur: 0.18, type: 'sawtooth', vol: 0.08 });
      api.haptics.pulse('bump');
    }
    hud();
    setTimeout(() => { if (S && S.time > 0) next(); }, ok ? 160 : 520);
  }

  function hud() {
    if (!S) return;
    $('#sc').textContent = S.score;
    $('#st').textContent = S.streak;
    $('#ac').textContent = S.total ? Math.round(S.right / S.total * 100) + '%' : '–';
    $('#tm').textContent = Math.max(0, S.time).toFixed(1);
    $('#bar').style.transform = `scaleX(${Math.max(0, Math.min(1, S.time / S.max))})`;
  }

  function finish() {
    const key = mode === 'survival' ? 'survival' : `${mode}:${length}`;
    const isBest = S.score > (best[key] || 0);
    if (isBest) { best[key] = S.score; api.save('best', best); }
    const res = { title: isBest && S.score ? 'New best!' : 'Time!', score: S.score, acc: S.total ? Math.round(S.right / S.total * 100) + '%' : '–', streak: S.bestStreak, best: best[key] || 0 };
    S = null;
    api.haptics.pulse('win');
    menu(res);
  }

  function togglePause() {
    if (!S) return;
    S.paused = !S.paused;
    if (S.paused) {
      $('#ovBox').innerHTML = `<h2>Paused</h2><div class="row"><button class="btn primary lg" id="res">${icon('play')} Resume</button><button class="btn lg" id="quit">Quit</button></div>`;
      $('#ov').hidden = false; $('#res').focus();
      $('#res').onclick = togglePause; $('#quit').onclick = () => { S = null; menu(); };
    } else { $('#ov').hidden = true; S.last = performance.now(); }
  }

  $('#opts').addEventListener('click', e => { const b = e.target.closest('.cc-opt'); if (b) answer(+b.dataset.i); });
  $('#pause').onclick = togglePause;
  addEventListener('keydown', e => {
    if (document.getElementById('modal').open) return;
    if (/^[1-9]$/.test(e.key)) answer(+e.key - 1);
    else if (e.key === 'p' || e.key === 'P') togglePause();
  }, { signal: api.signal });
  api.loop(dt => {
    if (!S || S.paused) return;
    S.time -= dt;
    hud();
    if (S.time <= 0) finish();
  });
  addEventListener('blur', () => { if (S && !S.paused) togglePause(); }, { signal: api.signal });

  menu();
  return { reset: () => { S = null; menu(); } };
}
