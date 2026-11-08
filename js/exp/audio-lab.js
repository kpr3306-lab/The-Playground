import { icon, knob, fmtTime, modal, setRange } from '../core/ui.js';

const PRESETS = { Flat: [0, 0, 0], Warm: [4, -1, -3], Bright: [-1, 1, 5], 'Bass Boost': [9, 0, -1], Vocal: [-3, 5, 2] };
const MODES = [['bars', 'Spectrum'], ['wave', 'Waveform'], ['circle', 'Circular'], ['scope', 'Oscilloscope'], ['mirror', 'Mirrored'], ['particles', 'Particles']];

export function mount(root, api) {
  const saved = api.load('state', {});
  const S = { bass: 0, mid: 0, treble: 0, gain: 0, balance: 0, sens: 1, mode: 'bars', vol: 0.9, ...saved };
  let userPresets = api.load('presets', {});
  let G = null; // audio graph, built on first gesture
  let source = null; // 'demo' | 'file'
  let playing = false, demoStart = 0, sched = null, fileUrl = null, muted = false;
  let cap = null, monitor = false; // live capture (device/tab audio or microphone)
  const audioEl = new Audio(); audioEl.preload = 'metadata'; audioEl.crossOrigin = 'anonymous';

  root.innerHTML = `<div class="al">
    <div class="al-viz"><canvas id="cv" aria-label="Audio visualiser"></canvas>
      <div class="al-modes seg" id="modes">${MODES.map(([k, l]) => `<button data-m="${k}">${l}</button>`).join('')}</div>
      <div class="al-empty" id="empty"><p>Play the demo loop, open a file, or capture device audio to begin.</p></div>
    </div>
    <div class="al-src">
      <div class="row">
        <button class="btn primary" id="demo">${icon('play')} Demo loop</button>
        <button class="btn" id="open">${icon('upload')} Open audio file</button>
        <button class="btn" id="sys" hidden>${icon('sound')} Device audio (Spotify, YouTube…)</button>
        <button class="btn" id="mic" hidden>Microphone</button>
        <button class="icon-btn" id="capHelp" aria-label="How device audio works">${icon('help')}</button>
        <label class="switch" id="monWrap" hidden><input type="checkbox" id="mon"> Hear EQ’d copy</label>
        <input type="file" id="file" accept="audio/*" hidden>
        <span class="muted al-name" id="name">No source</span>
      </div>
      <div class="al-transport">
        <button class="icon-btn" id="pp" aria-label="Play" disabled>${icon('play')}</button>
        <span class="mono al-time" id="el">0:00</span>
        <input type="range" id="seek" min="0" max="1" step="0.001" value="0" aria-label="Seek" disabled>
        <span class="mono al-time" id="du">–:––</span>
        <button class="icon-btn" id="mute" aria-label="Mute output" aria-pressed="false">${icon('sound')}</button>
        <label class="al-vol"><span class="sr">Input volume</span><input type="range" id="vol" min="0" max="1" step="0.01" value="${S.vol}"></label>
      </div>
    </div>
    <div class="al-deck">
      <div class="al-knobs" id="knobs"></div>
      <div class="al-presets">
        <div class="row" id="presets"></div>
        <div class="row"><button class="btn sm" id="flat">${icon('reset')} Reset to flat</button><button class="btn sm" id="savep">${icon('save')} Save preset</button></div>
      </div>
      <p class="note">EQ applies to the demo, your files and shared browser tabs. Audio from other apps can be visualised (desktop Chrome/Edge) but a website can't change their output. Nothing leaves your device.</p>
    </div>
  </div>
  <style>
    .al { flex: 1; display: grid; grid-template-rows: minmax(260px, 1fr) auto auto; gap: 0; }
    .al-viz { position: relative; background: radial-gradient(900px 400px at 50% 100%, #1b1712, #0a0908); min-height: 280px; }
    .al-viz canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    .al-modes { position: absolute; top: 12px; left: 12px; right: 12px; width: max-content; max-width: calc(100% - 24px); background: rgba(15,14,12,.8); backdrop-filter: blur(8px); }
    .al-empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); pointer-events: none; }
    .al-src { display: grid; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--bg-2); }
    .al-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40ch; }
    .al-transport { display: flex; align-items: center; gap: 10px; }
    .al-transport input#seek { flex: 1; }
    .al-time { font-size: 12px; color: var(--text-2); min-width: 38px; }
    .al-vol { width: 110px; }
    .al-deck { display: grid; gap: 16px; padding: 18px 16px 22px; background: linear-gradient(#1c1915, #151310); }
    .al-knobs { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 18px; padding: 14px; border-radius: 18px; background: linear-gradient(#24201b, #1a1814); border: 1px solid var(--line-2); box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 10px 24px rgba(0,0,0,.4); }
    .al-presets { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .al-presets .chip .x { margin-left: 4px; opacity: .6; }
    .al.drag .al-viz { outline: 2px dashed var(--accent); outline-offset: -8px; }
    @media (max-width: 560px) { .al-vol { width: 70px; } }
  </style>`;
  const $ = s => root.querySelector(s);
  const cv = $('#cv');
  const C = api.canvas(cv);

  // ---------- Graph ----------
  function graph() {
    if (G) return G;
    const ac = api.audio.ensure(); if (!ac) { api.toast('Web Audio is not supported here'); return null; }
    const g = {
      input: ac.createGain(), low: ac.createBiquadFilter(), mid: ac.createBiquadFilter(), high: ac.createBiquadFilter(),
      pan: ac.createStereoPanner(), out: ac.createGain(), an: ac.createAnalyser(), split: ac.createChannelSplitter(2),
      anL: ac.createAnalyser(), anR: ac.createAnalyser(), mute: ac.createGain(),
    };
    g.low.type = 'lowshelf'; g.low.frequency.value = 160;
    g.mid.type = 'peaking'; g.mid.frequency.value = 1200; g.mid.Q.value = 0.8;
    g.high.type = 'highshelf'; g.high.frequency.value = 5000;
    g.an.fftSize = 2048; g.an.smoothingTimeConstant = 0.8;
    g.anL.fftSize = g.anR.fftSize = 1024;
    g.input.connect(g.low).connect(g.mid).connect(g.high).connect(g.pan).connect(g.out);
    g.out.connect(g.an); g.out.connect(g.split); g.split.connect(g.anL, 0); g.split.connect(g.anR, 1);
    g.out.connect(g.mute).connect(api.bus());
    g.media = null;
    G = g; applyAll();
    g.fd = new Uint8Array(g.an.frequencyBinCount); g.td = new Float32Array(g.an.fftSize);
    g.l = new Float32Array(1024); g.r = new Float32Array(1024);
    return g;
  }
  function applyAll() {
    if (!G) return;
    const t = G.input.context.currentTime, k = 0.03;
    G.low.gain.setTargetAtTime(S.bass, t, k); G.mid.gain.setTargetAtTime(S.mid, t, k); G.high.gain.setTargetAtTime(S.treble, t, k);
    G.out.gain.setTargetAtTime(10 ** (S.gain / 20), t, k);
    G.pan.pan.setTargetAtTime(S.balance / 100, t, k);
    G.input.gain.setTargetAtTime(S.vol, t, k);
    // Live captures are silent unless monitoring (the original is usually still playing; a mic would feed back).
    G.mute.gain.setTargetAtTime(muted || (cap && !monitor) ? 0 : 1, t, k);
  }
  const persist = () => api.save('state', S);

  // ---------- Knobs ----------
  const db = v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
  const K = {
    bass: knob({ label: 'Bass', min: -12, max: 12, step: 0.5, value: S.bass, def: 0, fmt: db, signal: api.signal, onInput: v => { S.bass = v; applyAll(); persist(); markPreset(); } }),
    mid: knob({ label: 'Mid', min: -12, max: 12, step: 0.5, value: S.mid, def: 0, fmt: db, signal: api.signal, onInput: v => { S.mid = v; applyAll(); persist(); markPreset(); } }),
    treble: knob({ label: 'Treble', min: -12, max: 12, step: 0.5, value: S.treble, def: 0, fmt: db, signal: api.signal, onInput: v => { S.treble = v; applyAll(); persist(); markPreset(); } }),
    gain: knob({ label: 'Gain', min: -24, max: 6, step: 0.5, value: S.gain, def: 0, fmt: db, signal: api.signal, onInput: v => { S.gain = v; applyAll(); persist(); } }),
    balance: knob({ label: 'Balance', min: -100, max: 100, step: 1, value: S.balance, def: 0, fmt: v => v === 0 ? 'C' : (v < 0 ? 'L ' : 'R ') + Math.abs(v), signal: api.signal, onInput: v => { S.balance = v; applyAll(); persist(); } }),
    sens: knob({ label: 'Visual sens.', min: 0.25, max: 4, step: 0.05, value: S.sens, def: 1, fmt: v => v.toFixed(2) + '×', signal: api.signal, onInput: v => { S.sens = v; persist(); } }),
  };
  Object.values(K).forEach(k => $('#knobs').append(k));

  // ---------- Presets ----------
  function renderPresets() {
    const all = { ...PRESETS, ...userPresets };
    $('#presets').innerHTML = Object.keys(all).map(n => `<button class="chip" data-p="${encodeURIComponent(n)}">${n.replace(/</g, '&lt;')}${userPresets[n] ? `<span class="x" data-del="${encodeURIComponent(n)}" role="button" aria-label="Delete preset ${n.replace(/"/g, '')}">✕</span>` : ''}</button>`).join('');
    markPreset();
  }
  function markPreset() {
    const all = { ...PRESETS, ...userPresets };
    root.querySelectorAll('[data-p]').forEach(b => { const p = all[decodeURIComponent(b.dataset.p)]; b.setAttribute('aria-pressed', !!p && p[0] === S.bass && p[1] === S.mid && p[2] === S.treble); });
  }
  function applyPreset(p) { [S.bass, S.mid, S.treble] = p; K.bass.set(S.bass); K.mid.set(S.mid); K.treble.set(S.treble); applyAll(); persist(); markPreset(); }
  $('#presets').onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) { delete userPresets[decodeURIComponent(del.dataset.del)]; api.save('presets', userPresets); renderPresets(); return; }
    const b = e.target.closest('[data-p]'); if (!b) return;
    const n = decodeURIComponent(b.dataset.p);
    applyPreset(userPresets[n] || PRESETS[n]);
    api.haptics.pulse('tick');
  };
  $('#flat').onclick = () => applyPreset([0, 0, 0]);
  $('#savep').onclick = () => {
    const d = modal('Save preset', `<label class="field">Name<input id="pn" maxlength="24" style="height:40px;padding:0 12px;border-radius:9px;border:1px solid var(--line-2);background:var(--panel-2)" placeholder="My preset"></label><div class="row" style="justify-content:flex-end"><button class="btn primary" id="pok">Save</button></div>`);
    const inp = d.querySelector('#pn'); inp.focus();
    const ok = () => { const n = inp.value.trim(); if (!n) return; userPresets[n] = [S.bass, S.mid, S.treble]; api.save('presets', userPresets); renderPresets(); d.close(); api.toast(`Saved “${n}”`); };
    d.querySelector('#pok').onclick = ok; inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
  };
  renderPresets();

  // ---------- Sources ----------
  function stopAll() {
    if (sched) { clearInterval(sched.id); sched.nodes.forEach(n => { try { n.stop(); } catch {} }); sched = null; }
    audioEl.pause();
    if (cap) { cap.stream.getTracks().forEach(t => t.stop()); try { cap.node.disconnect(); } catch {} cap = null; monitor = false; }
    playing = false;
  }
  function captureHelp(noAudio) {
    modal(noAudio ? 'No audio was shared' : 'Device audio', `<ul>
      <li><b>A browser tab</b> (Spotify Web Player, YouTube, SoundCloud…): choose the tab and keep <b>“Share tab audio”</b> on. The tab’s own sound is muted and you hear this lab’s output instead, so <b>the EQ really changes what you hear</b>.</li>
      <li><b>The Spotify app or any other app</b> (Chrome/Edge on Windows or ChromeOS): share your <b>entire screen</b> and switch on <b>“Share system audio”</b>. The visualiser follows everything you play. A website can’t change another app’s output, so the EQ only shapes a monitor copy. Turn on “Hear EQ’d copy” and lower the app’s own volume if you want to hear it.</li>
      <li><b>macOS, Firefox, Safari and phones</b> can’t share system audio with a web page. Use <b>Microphone</b> to visualise whatever is playing nearby.</li>
      <li>Nothing is recorded or uploaded. Stop sharing any time from the browser’s bar or the ⏸ button.</li></ul>`);
  }
  async function startCapture(kind) {
    const g = graph(); if (!g) return;
    const md = navigator.mediaDevices, raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    let stream;
    try {
      stream = kind === 'system'
        ? await md.getDisplayMedia({ video: true, audio: { ...raw, suppressLocalAudioPlayback: true }, systemAudio: 'include', selfBrowserSurface: 'exclude' })
        : await md.getUserMedia({ audio: raw });
    } catch (e) { if (e.name !== 'AbortError') api.toast(e.name === 'NotAllowedError' ? 'Sharing was cancelled or blocked' : 'Capture isn’t available in this browser'); return; }
    const tracks = stream.getAudioTracks();
    if (!tracks.length) { stream.getTracks().forEach(t => t.stop()); captureHelp(true); return; }
    stopAll();
    stream.getVideoTracks().forEach(t => t.enabled = false); // only the sound is used; the track keeps the share alive
    const node = g.input.context.createMediaStreamSource(new MediaStream(tracks));
    node.connect(g.input);
    const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface;
    cap = { stream, node, kind };
    monitor = kind === 'system' && surface === 'browser'; // a shared tab is muted locally, so monitor it by default
    source = kind; playing = true;
    tracks[0].addEventListener('ended', () => { if (cap?.stream === stream) { stopAll(); source = null; applyAll(); ui('Sharing ended'); } });
    $('#mon').checked = monitor;
    applyAll();
    ui(kind === 'mic' ? 'Microphone · live' : surface === 'browser' ? 'Shared tab · live (EQ active)' : 'Device audio · live (visualising)');
  }
  function startDemo() {
    const g = graph(); if (!g) return;
    stopAll(); source = 'demo';
    const ac = g.input.context, bpm = 100, step = 60 / bpm / 4;
    const s = { id: 0, next: ac.currentTime + 0.08, i: 0, nodes: new Set() };
    const track = n => { s.nodes.add(n); n.onended = () => s.nodes.delete(n); };
    const env = (node, t, a, d, v, dest) => { const gg = ac.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(v, t + a); gg.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(gg).connect(dest); return gg; };
    const panned = p => { const pn = ac.createStereoPanner(); pn.pan.value = p; pn.connect(g.input); return pn; };
    const bass = [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47];
    const chords = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62]];
    const mtof = m => 440 * 2 ** ((m - 69) / 12);
    function play(i, t) {
      const bar = Math.floor(i / 16) % 4, st = i % 16;
      if (st % 4 === 0) { const o = ac.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(o, t, 0.002, 0.3, 0.9, g.input); o.start(t); o.stop(t + 0.35); track(o); }
      if (st === 4 || st === 12) { const n = ac.createBufferSource(); n.buffer = api.audio.noise('white'); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; n.connect(f); env(f, t, 0.001, 0.18, 0.7, g.input); n.start(t, Math.random()); n.stop(t + 0.2); track(n); }
      if (st % 2 === 1) { const n = ac.createBufferSource(); n.buffer = api.audio.noise('white'); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; n.connect(f); env(f, t, 0.001, 0.05, 0.35, panned(st % 4 === 1 ? -0.5 : 0.5)); n.start(t, Math.random()); n.stop(t + 0.07); track(n); }
      { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(bass[(bar * 4 + Math.floor(st / 4)) % 16]); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + step * 0.9); o.connect(f); if (st % 2 === 0) { env(f, t, 0.005, step * 1.6, 0.35, g.input); o.start(t); o.stop(t + step * 2); track(o); } }
      if (st === 0) chords[bar].forEach((m, k) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); env(o, t, 0.25, step * 15, 0.09, panned(k - 1)); o.start(t); o.stop(t + step * 16); track(o); });
      if (st % 2 === 0) { const ch = chords[bar], m = ch[(st / 2) % 3] + 12 + (st >= 8 ? 12 : 0); const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; o.connect(f); env(f, t, 0.003, step * 0.9, 0.05, panned(Math.sin(i / 3) * 0.7)); o.start(t); o.stop(t + step); track(o); }
    }
    s.id = setInterval(() => { while (s.next < ac.currentTime + 0.12) { play(s.i++, s.next); s.next += step; } }, 25);
    sched = s; playing = true; demoStart = ac.currentTime;
    ui('Demo loop · generated live, 100 BPM');
  }
  async function loadFile(f) {
    if (!f || !f.type.startsWith('audio')) { api.toast('That doesn’t look like an audio file'); return; }
    const g = graph(); if (!g) return;
    stopAll();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = URL.createObjectURL(f);
    if (!g.media) { g.media = g.input.context.createMediaElementSource(audioEl); g.media.connect(g.input); }
    audioEl.src = fileUrl; source = 'file';
    try { await audioEl.play(); playing = true; } catch { api.toast('Couldn’t play that file in this browser'); }
    ui(f.name);
  }
  function ui(name) {
    if (name) $('#name').textContent = name;
    $('#empty').hidden = !!source;
    $('#pp').disabled = !source;
    $('#pp').innerHTML = icon(playing ? 'pause' : 'play'); $('#pp').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('#seek').disabled = source !== 'file';
    $('#monWrap').hidden = !cap || cap.kind !== 'system';
    $('#demo').innerHTML = `${icon(source === 'demo' && playing ? 'pause' : 'play')} Demo loop`;
  }
  $('#demo').onclick = () => { if (source === 'demo' && playing) { stopAll(); ui(); } else startDemo(); };
  $('#open').onclick = () => { api.audio.ensure(); $('#file').click(); };
  $('#file').onchange = e => loadFile(e.target.files[0]);
  if (navigator.mediaDevices?.getDisplayMedia) $('#sys').hidden = false;
  if (navigator.mediaDevices?.getUserMedia) $('#mic').hidden = false;
  $('#sys').onclick = () => startCapture('system');
  $('#mic').onclick = () => startCapture('mic');
  $('#capHelp').onclick = () => captureHelp(false);
  $('#mon').onchange = e => { monitor = e.target.checked; applyAll(); };
  $('#pp').onclick = () => {
    if (cap) { stopAll(); source = null; applyAll(); ui('No source'); return; }
    if (source === 'demo') { if (playing) { stopAll(); ui(); } else startDemo(); return; }
    if (audioEl.paused) audioEl.play().then(() => { playing = true; ui(); }).catch(() => {}); else { audioEl.pause(); playing = false; ui(); }
  };
  audioEl.onended = () => { playing = false; ui(); };
  audioEl.onloadedmetadata = () => { $('#du').textContent = fmtTime(audioEl.duration); };
  $('#seek').oninput = e => { if (audioEl.duration) audioEl.currentTime = e.target.value * audioEl.duration; };
  $('#vol').oninput = e => { S.vol = +e.target.value; applyAll(); persist(); };
  $('#mute').onclick = () => { muted = !muted; $('#mute').innerHTML = icon(muted ? 'mute' : 'sound'); $('#mute').setAttribute('aria-pressed', muted); applyAll(); };
  const al = root.querySelector('.al');
  al.addEventListener('dragover', e => { e.preventDefault(); al.classList.add('drag'); }, { signal: api.signal });
  al.addEventListener('dragleave', () => al.classList.remove('drag'), { signal: api.signal });
  al.addEventListener('drop', e => { e.preventDefault(); al.classList.remove('drag'); loadFile(e.dataTransfer.files[0]); }, { signal: api.signal });

  // ---------- Modes ----------
  const setMode = m => { S.mode = m; persist(); root.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m)); };
  $('#modes').onclick = e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); };
  setMode(MODES.some(([k]) => k === S.mode) ? S.mode : 'bars');

  // ---------- Render ----------
  const parts = [];
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f0a63a';
  api.loop((dt) => {
    const { ctx, w, h } = C; if (!w) return;
    ctx.clearRect(0, 0, w, h);
    if (source === 'file') {
      $('#el').textContent = fmtTime(audioEl.currentTime);
      if (audioEl.duration && document.activeElement !== $('#seek')) setRange($('#seek'), audioEl.currentTime / audioEl.duration);
    } else if (cap) { $('#el').textContent = 'LIVE'; $('#du').textContent = ''; } else if (source === 'demo' && playing) { $('#el').textContent = fmtTime(G.input.context.currentTime - demoStart); $('#du').textContent = '∞'; }
    if (!G) return;
    G.an.getByteFrequencyData(G.fd); G.an.getFloatTimeDomainData(G.td);
    const sens = S.sens, A = accent(), N = G.fd.length;
    // Log-spaced bands so bass isn't squashed into a few pixels.
    const band = (k, n) => { const a = Math.floor(2 * (N / 2) ** (k / n)), b = Math.max(a + 1, Math.floor(2 * (N / 2) ** ((k + 1) / n))); let m = 0; for (let i = a; i < b && i < N; i++) m = Math.max(m, G.fd[i]); return Math.min(1, m / 255 * sens); };
    const grad = ctx.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, A); grad.addColorStop(1, '#fff3dc');
    const mode = S.mode;
    if (mode === 'bars' || mode === 'mirror') {
      const n = Math.min(96, Math.floor(w / 9)), bw = w / n;
      ctx.fillStyle = grad;
      for (let k = 0; k < n; k++) {
        const v = band(k, n), bh = v * (mode === 'mirror' ? h * 0.45 : h * 0.82);
        if (mode === 'bars') ctx.fillRect(k * bw + 1, h - bh - 6, bw - 2, bh);
        else { // low frequencies in the centre, mirrored outward and above/below the midline
          ctx.fillRect(w / 2 + k * bw / 2, h / 2 - bh, bw / 2 - 1, bh * 2);
          ctx.fillRect(w / 2 - (k + 1) * bw / 2, h / 2 - bh, bw / 2 - 1, bh * 2);
        }
      }
    } else if (mode === 'wave') {
      ctx.lineWidth = 2.5; ctx.strokeStyle = A; ctx.shadowColor = A; ctx.shadowBlur = 12; ctx.beginPath();
      for (let i = 0; i < G.td.length; i += 2) { const x = i / G.td.length * w, y = h / 2 + G.td[i] * h * 0.42 * sens; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    } else if (mode === 'circle') {
      const n = 120, cx = w / 2, cy = h / 2, bass = band(2, 24), R = Math.min(w, h) * (0.2 + bass * 0.05);
      ctx.strokeStyle = A; ctx.lineWidth = Math.max(2, (Math.PI * 2 * R) / n * 0.55); ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const v = band(k % (n / 2) < n / 4 ? k % (n / 4) : n / 4 - 1 - (k % (n / 4)), n / 4), a = k / n * Math.PI * 2 - Math.PI / 2;
        const L = 4 + v * Math.min(w, h) * 0.24;
        ctx.globalAlpha = 0.45 + v * 0.55;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L)); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#16130f'; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,220,.15)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (mode === 'scope') {
      G.anL.getFloatTimeDomainData(G.l); G.anR.getFloatTimeDomainData(G.r);
      const cx = w / 2, cy = h / 2, s = Math.min(w, h) * 0.38 * sens;
      ctx.strokeStyle = 'rgba(255,240,220,.07)'; ctx.lineWidth = 1;
      for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(cx + k * s / 4, cy - s); ctx.lineTo(cx + k * s / 4, cy + s); ctx.moveTo(cx - s, cy + k * s / 4); ctx.lineTo(cx + s, cy + k * s / 4); ctx.stroke(); }
      ctx.strokeStyle = '#7fd19b'; ctx.shadowColor = '#7fd19b'; ctx.shadowBlur = 8; ctx.lineWidth = 1.5; ctx.beginPath();
      // Mid/side (X-Y rotated 45°): mono content draws a vertical line, stereo spreads sideways.
      for (let i = 0; i < G.l.length; i++) { const x = cx + (G.r[i] - G.l[i]) * 0.707 * s, y = cy - (G.l[i] + G.r[i]) * 0.707 * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    } else if (mode === 'particles') {
      const bass = band(1, 16), mid = band(8, 16), hi = band(13, 16);
      const cap = api.quality() === 'low' ? 160 : 420, reduced = api.reducedMotion();
      for (let k = 0; k < (reduced ? 1 : 6) * (bass + mid) && parts.length < cap; k++) {
        const a = Math.random() * Math.PI * 2, sp = (40 + bass * 380) * (0.5 + Math.random());
        parts.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: Math.random() < hi ? '#fff3dc' : Math.random() < mid ? '#5cb8ff' : A, r: 1.5 + bass * 4 });
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.7;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.hue; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = A; ctx.beginPath(); ctx.arc(w / 2, h / 2, 10 + bass * 40, 0, Math.PI * 2); ctx.fill();
    }
  });

  api.onCleanup(() => { stopAll(); audioEl.removeAttribute('src'); if (fileUrl) URL.revokeObjectURL(fileUrl); try { G?.mute.disconnect(); G?.media?.disconnect(); } catch {} });
  ui();
  return { reset() { applyPreset([0, 0, 0]); K.gain.set(S.gain = 0); K.balance.set(S.balance = 0); K.sens.set(S.sens = 1); applyAll(); persist(); } };
}
