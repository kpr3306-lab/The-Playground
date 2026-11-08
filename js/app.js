import { EXPERIENCES, CATS, byId } from './registry.js';
import { store, settings, reducedMotion, quality } from './core/storage.js';
import { audio } from './core/audio.js';
import { haptics } from './core/haptics.js';
import { icon, toast, modal, confirmBox, fitCanvas, initRanges, download } from './core/ui.js';

const $ = s => document.querySelector(s);
const main = $('#main');
let current = null; // { id, destroy }
let filter = 'All';
let installEvt = null;

// ---------- Global chrome ----------
$('#homeBtn').innerHTML = icon('home');
$('#settingsBtn').innerHTML = icon('settings');

function applyDisplay() {
  const root = document.documentElement;
  root.dataset.accent = settings.get('accent');
  root.dataset.motion = reducedMotion() ? 'reduce' : 'full';
  const snd = !settings.get('muted');
  $('#soundBtn').innerHTML = icon(snd ? 'sound' : 'mute');
  $('#soundBtn').setAttribute('aria-pressed', snd);
  $('#soundBtn').setAttribute('aria-label', snd ? 'Mute all sound' : 'Unmute sound');
  const hp = settings.get('haptics') && haptics.supported;
  $('#hapticsBtn').innerHTML = icon(hp ? 'vibrate' : 'vibrateOff');
  $('#hapticsBtn').setAttribute('aria-pressed', hp);
  $('#hapticsBtn').setAttribute('aria-label', haptics.supported ? (hp ? 'Turn haptics off' : 'Turn haptics on') : 'Haptics not supported on this device');
  renderCapPill();
}
settings.on(applyDisplay);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyDisplay);

$('#soundBtn').onclick = () => { settings.set('muted', !settings.get('muted')); audio.ensure(); };
$('#hapticsBtn').onclick = () => {
  if (!haptics.supported) return toast('Vibration isn’t available in this browser or device');
  settings.set('haptics', !settings.get('haptics'));
  haptics.pulse('click');
};
$('#settingsBtn').onclick = openSettings;
$('#capBtn').onclick = openCaps;

const search = $('#search');
search.addEventListener('input', () => { if (current) location.hash = '#/'; else renderHome(); });
addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); }
});

function renderCapPill() {
  const sw = navigator.serviceWorker?.controller;
  const dots = [audio.supported, haptics.supported, !!sw];
  $('#capBtn').innerHTML = dots.map(d => `<span class="dot ${d ? '' : 'off'}"></span>`).join('') + `<span class="lbl">${navigator.onLine ? 'Online' : 'Offline'}</span>`;
  $('#capBtn').setAttribute('aria-label', `Device capabilities: audio ${dots[0] ? 'yes' : 'no'}, haptics ${dots[1] ? 'yes' : 'no'}, offline ${dots[2] ? 'ready' : 'not ready'}`);
}
addEventListener('online', renderCapPill);
addEventListener('offline', renderCapPill);

function openCaps() {
  const row = (ok, name, text) => `<div class="kv"><div><b>${name}</b><div class="muted" style="font-size:13px">${text}</div></div><span class="badge" style="color:${ok ? 'var(--ok)' : 'var(--muted)'}">${ok ? '✓ Yes' : '— No'}</span></div>`;
  const standalone = matchMedia('(display-mode: standalone)').matches;
  modal('Device capabilities', `<div class="grp">
    ${row(audio.supported, 'Web Audio', 'Sound effects, synthesis and the audio lab.')}
    ${row(haptics.supported, 'Vibration', haptics.supported ? 'Haptic feedback is available.' : 'Not exposed here (common on desktop and iOS). Nothing depends on it.')}
    ${row(!!document.fullscreenEnabled, 'Fullscreen', 'Expand an experience to fill the screen.')}
    ${row(!!navigator.serviceWorker?.controller, 'Offline ready', 'The app shell is cached. Every experience works offline; fonts fall back to system fonts if not yet cached.')}
    ${row(navigator.onLine, 'Network', 'Not required after first load.')}
    ${row(standalone, 'Installed', standalone ? 'Running as an app.' : 'Install from Settings → Install.')}
  </div>`);
}

// ---------- Settings ----------
function openSettings() {
  const s = settings.all();
  const seg = (key, opts) => `<div class="seg" data-seg="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${s[key] === v}">${l}</button>`).join('')}</div>`;
  const accents = { amber: '#f0a63a', mint: '#5fd3a8', coral: '#ff7a63', iris: '#9c8cff', sky: '#5cb8ff' };
  const d = modal('Settings', `
    <div class="grp"><h3>Sound</h3>
      <label class="field"><span class="row"><span>Master volume</span><output id="volOut">${Math.round(s.volume * 100)}%</output></span><input id="vol" type="range" min="0" max="1" step="0.01" value="${s.volume}"></label>
      <label class="switch"><input type="checkbox" id="mute" ${s.muted ? 'checked' : ''}> Mute everything</label>
      <details><summary class="muted" style="cursor:pointer;font-size:13px">Sound per experience</summary><div class="grp" style="margin-top:10px">
        ${EXPERIENCES.map(e => `<label class="switch"><input type="checkbox" data-ms="${e.id}" ${s.moduleSound[e.id] !== false ? 'checked' : ''}> ${e.title}</label>`).join('')}
      </div></details>
    </div>
    <div class="grp"><h3>Haptics</h3>
      ${haptics.supported ? `<label class="switch"><input type="checkbox" id="hap" ${s.haptics ? 'checked' : ''}> Vibration feedback</label>
        <div class="kv"><span>Strength</span>${seg('hapticStrength', [[0.6, 'Light'], [1, 'Normal'], [1.6, 'Strong']])}</div>`
      : `<p class="note">This browser or device doesn’t expose vibration. Every experience works without it.</p>`}
    </div>
    <div class="grp"><h3>Display</h3>
      <div class="kv"><span>Motion</span>${seg('motion', [['auto', 'System'], ['reduce', 'Reduced'], ['full', 'Full']])}</div>
      <div class="kv"><span>Visual quality</span>${seg('quality', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low']])}</div>
      <div class="kv"><span>Accent</span><div class="swatches">${Object.entries(accents).map(([k, c]) => `<button class="swatch" style="background:${c}" data-accent="${k}" aria-label="${k}" aria-pressed="${s.accent === k}"></button>`).join('')}</div></div>
    </div>
    <div class="grp"><h3>Install</h3>
      ${installEvt ? `<button class="btn primary" id="install">${icon('download')} Install The Playground</button>`
      : `<p class="note">To install: in Chrome/Edge use the install icon in the address bar or menu → “Install app”. On iPhone/iPad, tap Share → “Add to Home Screen”. Once installed, the app opens offline.</p>`}
    </div>
    <div class="grp"><h3>Your data</h3>
      <p class="muted" style="font-size:13px">Settings, scores, presets and palettes are stored only in this browser.</p>
      <div class="row"><button class="btn" id="export">${icon('download')} Export data</button><button class="btn danger" id="wipe">${icon('reset')} Reset all data</button></div>
    </div>`);
  const vol = d.querySelector('#vol');
  vol.oninput = () => { settings.set('volume', +vol.value); d.querySelector('#volOut').textContent = Math.round(vol.value * 100) + '%'; };
  d.querySelector('#mute').onchange = e => settings.set('muted', e.target.checked);
  d.querySelectorAll('[data-ms]').forEach(c => c.onchange = () => settings.set('moduleSound', { ...settings.get('moduleSound'), [c.dataset.ms]: c.checked }));
  d.querySelector('#hap')?.addEventListener('change', e => { settings.set('haptics', e.target.checked); haptics.pulse('click'); });
  d.querySelectorAll('[data-seg]').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const key = g.dataset.seg, raw = b.dataset.v;
    settings.set(key, key === 'hapticStrength' ? +raw : raw);
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (key === 'hapticStrength') haptics.pulse('thud');
    if (key === 'quality' && current) toast('Re-open the experience to apply quality');
  });
  d.querySelectorAll('[data-accent]').forEach(b => b.onclick = () => {
    settings.set('accent', b.dataset.accent);
    d.querySelectorAll('[data-accent]').forEach(x => x.setAttribute('aria-pressed', x === b));
  });
  d.querySelector('#install')?.addEventListener('click', () => { d.close(); promptInstall(); });
  d.querySelector('#export').onclick = () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); download('playground-data.json', url); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  d.querySelector('#wipe').onclick = async () => {
    d.close();
    if (await confirmBox('Reset all data?', 'This deletes settings, best scores, saved presets, mixes and palettes from this browser. It can’t be undone.', 'Delete everything')) {
      store.clearAll(); settings.reset(); toast('All local data cleared'); route();
    }
  };
}

// ---------- Home ----------
const pinned = () => store.get('pinned', []);
const recent = () => store.get('recent', []);

function cardHTML(e) {
  const isPinned = pinned().includes(e.id);
  return `<article class="card" style="--h:${e.hue}">
    <div class="card-art">${e.art}</div>
    <div class="card-body">
      <div class="meta"><i></i>${e.cat}</div>
      <h3>${e.title}</h3>
      <p>${e.desc}</p>
    </div>
    <a class="card-link" href="#/${e.id}" aria-label="Open ${e.title}"></a>
    <button class="pin" data-pin="${e.id}" aria-pressed="${isPinned}" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${e.title}" title="${isPinned ? 'Unpin' : 'Pin to top'}">${icon('star')}</button>
    <span class="go">${icon('arrow')}</span>
  </article>`;
}

function renderHome() {
  document.title = 'The Playground';
  const q = search.value.trim().toLowerCase();
  const match = e => (filter === 'All' || e.cat === filter) && (!q || (e.title + ' ' + e.desc + ' ' + e.cat).toLowerCase().includes(q));
  const pins = pinned().map(byId).filter(Boolean);
  const list = EXPERIENCES.filter(match).sort((a, b) => pins.includes(b) - pins.includes(a));
  const rec = recent().map(byId).filter(Boolean);
  main.innerHTML = `<div class="home">
    <section class="hero">
      <h1>The <em>Playground</em></h1>
      <p>Eleven small things to poke at: tactile toys, audio tools, visual experiments and arcade games. No account needed, and everything stays on your device.</p>
      <div id="installSlot"></div>
    </section>
    ${rec.length && !q ? `<div class="shelf-title">Jump back in</div><nav class="recent" aria-label="Recently used">${rec.map(e => `<a href="#/${e.id}" style="--h:${e.hue}"><span class="sw"></span>${e.title}</a>`).join('')}</nav>` : ''}
    <div class="filters" role="group" aria-label="Filter by category">${['All', ...CATS].map(c => `<button class="chip" data-cat="${c}" aria-pressed="${filter === c}">${c}</button>`).join('')}</div>
    ${list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : `<div class="empty">Nothing matches “${q.replace(/</g, '&lt;')}”. Try another word or category.</div>`}
    <footer class="foot"><span>Everything runs locally in your browser.</span><span>Sounds are synthesised live; art is drawn in code.</span><span>Press <kbd class="mono">/</kbd> to search.</span></footer>
  </div>`;
  renderInstall();
  main.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { filter = b.dataset.cat; renderHome(); });
  main.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
    const id = b.dataset.pin, p = pinned();
    store.set('pinned', p.includes(id) ? p.filter(x => x !== id) : [id, ...p]);
    renderHome();
    main.querySelector(`[data-pin="${id}"]`)?.focus();
  });
}

// ---------- Experience shell ----------
async function openExperience(e) {
  document.title = `${e.title} · The Playground`;
  store.set('recent', [e.id, ...recent().filter(x => x !== e.id)].slice(0, 6));
  const soundOn = () => settings.get('moduleSound')[e.id] !== false;
  main.innerHTML = `<div class="exp" id="exp">
    <div class="exp-bar">
      <a class="icon-btn" href="#/" aria-label="Back to home" title="Home">${icon('back')}</a>
      <div class="exp-title"><span>${e.cat}</span><h1>${e.title}</h1></div>
      <div class="sp"></div>
      <button class="icon-btn" id="xSound" title="Sound for this experience"></button>
      <button class="icon-btn" id="xHelp" aria-label="Help and controls" title="Help & controls">${icon('help')}</button>
      <button class="icon-btn" id="xReset" aria-label="Reset" title="Reset">${icon('reset')}</button>
      ${document.fullscreenEnabled ? `<button class="icon-btn" id="xFull" aria-label="Fullscreen" title="Fullscreen">${icon('full')}</button>` : ''}
    </div>
    <div class="exp-body" id="expBody"><div class="loading"><div class="spinner"></div>Loading…</div></div>
  </div>`;
  const xs = $('#xSound');
  const paintSound = () => { const on = soundOn(); xs.innerHTML = icon(on ? 'sound' : 'mute'); xs.setAttribute('aria-pressed', on); xs.setAttribute('aria-label', on ? 'Mute this experience' : 'Unmute this experience'); };
  paintSound();
  xs.onclick = () => { settings.set('moduleSound', { ...settings.get('moduleSound'), [e.id]: !soundOn() }); paintSound(); };
  $('#xHelp').onclick = () => modal(e.title, `<ul>${e.help.map(h => `<li>${h}</li>`).join('')}</ul>`);
  $('#xFull')?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : $('#exp').requestFullscreen?.().catch(() => {}));

  const ac = new AbortController();
  const cleanups = [];
  const api = {
    id: e.id, signal: ac.signal, audio, haptics, toast, store, settings,
    bus: () => audio.bus(e.id),
    load: (k, d) => store.get(`${e.id}:${k}`, d),
    save: (k, v) => store.set(`${e.id}:${k}`, v),
    reducedMotion, quality,
    onCleanup: f => cleanups.push(f),
    canvas(c, opts) { const s = fitCanvas(c, opts); cleanups.push(s.destroy); return s; },
    interval(f, ms) { const t = setInterval(f, ms); cleanups.push(() => clearInterval(t)); return t; },
    // rAF loop with dt in seconds (clamped so tab switches don't explode simulations).
    loop(fn) {
      let raf, last = performance.now(), on = true;
      const tick = t => { const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t); if (on) raf = requestAnimationFrame(tick); };
      const ctl = {
        start() { if (!on) { on = true; last = performance.now(); raf = requestAnimationFrame(tick); } },
        stop() { on = false; cancelAnimationFrame(raf); },
        get running() { return on; },
      };
      raf = requestAnimationFrame(tick);
      cleanups.push(ctl.stop);
      return ctl;
    },
  };
  const token = {};
  current = { id: e.id, token, destroy() { ac.abort(); cleanups.splice(0).forEach(f => { try { f(); } catch {} }); try { inst?.destroy?.(); } catch {} audio.closeBus(e.id); } };
  let inst;
  try {
    const mod = await import(`./exp/${e.id}.js`);
    if (current?.token !== token) return; // navigated away while loading
    const body = $('#expBody');
    body.innerHTML = '';
    inst = mod.mount(body, api) || {};
    initRanges(body);
    $('#xReset').onclick = async () => {
      if (inst.confirmReset && !(await confirmBox('Reset?', inst.confirmReset, 'Reset'))) return;
      inst.reset?.(); haptics.pulse('click');
    };
    if (!inst.reset) $('#xReset').hidden = true;
  } catch (err) {
    console.error(err);
    $('#expBody').innerHTML = `<div class="loading"><p>This experience failed to load.</p><a class="btn" href="#/">Back home</a></div>`;
  }
}

// ---------- Router (hash-based so refresh works on any GitHub Pages subpath) ----------
function route() {
  const id = location.hash.replace(/^#\/?/, '');
  const d = $('#modal'); if (d.open) d.close();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  current?.destroy(); current = null;
  scrollTo(0, 0);
  const e = id && byId(id);
  if (id && !e) { toast('That experience doesn’t exist'); history.replaceState(null, '', '#/'); }
  document.body.classList.toggle('in-exp', !!e); // lets landscape phones drop the global bar inside experiences
  if (e) openExperience(e); else renderHome();
  main.focus({ preventScroll: true });
}
addEventListener('hashchange', route);

// Install ("download") the app: native prompt where the browser offers one, instructions on iOS.
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function promptInstall() {
  if (!installEvt) return;
  try { await installEvt.prompt(); } catch { return toast('Use the install icon in the address bar'); }
  const { outcome } = await installEvt.userChoice;
  installEvt = null; renderInstall();
  if (outcome === 'accepted') toast('Installing The Playground…');
}
function renderInstall() {
  const slot = document.getElementById('installSlot'); if (!slot) return;
  if (isStandalone()) { slot.innerHTML = ''; return; }
  if (installEvt) {
    slot.innerHTML = `<button class="btn primary" id="installBtn">${icon('download')} Install app · works offline</button>`;
    slot.querySelector('#installBtn').onclick = promptInstall;
  } else if (isIOS()) {
    slot.innerHTML = `<p class="note" style="max-width:460px">To install on iPhone or iPad: open in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>.</p>`;
  } else slot.innerHTML = '';
}
addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installEvt = ev; renderInstall(); });
addEventListener('appinstalled', () => { installEvt = null; renderInstall(); toast('Installed. Find The Playground with your apps'); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', renderCapPill);
}

applyDisplay();
route();
