// Shared UI primitives: icons, toasts, modal, knob, range fill and canvas sizing.
const P = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  sound: 'M4 9h4l5-4v14l-5-4H4z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',
  vibrate: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M3 8v8 M21 8v8',
  vibrateOff: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M3 3l18 18',
  settings: 'M4 7h9 M17 7h3 M4 12h3 M11 12h9 M4 17h11 M19 17h1 M15 5v4 M9 10v4 M17 15v4',
  back: 'M15 18l-6-6 6-6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17.5v.01',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  full: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7z M14 4h3v16h-3z',
  undo: 'M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5 M20 9H9a5 5 0 0 0 0 10h3',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
  upload: 'M12 15V3 M7 8l5-5 5 5 M4 20h16',
  x: 'M6 6l12 12 M18 6L6 18',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6', up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14 M5 12h14',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  shuffle: 'M3 7h4l10 10h4 M3 17h4l10-10h4 M18 4l3 3-3 3 M18 14l3 3-3 3',
  save: 'M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8 3v5h7 M7 14h10v7H7z',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 9v4l2 2 M9 2h6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bucket: 'M5 11l7-7 7 7-7 7z M19 15s2 2.5 2 3.5a2 2 0 0 1-4 0c0-1 2-3.5 2-3.5z M3 21h12',
  picker: 'M14 4l6 6 M17 7L7 17l-3 1 1-3L15 5 M4 20l2-2',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6 M11 11V4a1.5 1.5 0 0 1 3 0v7 M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.5 1.5 0 0 1 2.4-1.8L8 16',
  zoomIn: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4 M11 8v6 M8 11h6',
  zoomOut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4 M8 11h6',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 9.5v.01',
  wifi: 'M2 9a15 15 0 0 1 20 0 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5v.01',
};
export const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 2700);
}

// Single <dialog> for every modal: native focus trap and Esc handling.
export function modal(title, bodyHTML, { onClose } = {}) {
  const d = document.getElementById('modal');
  d.innerHTML = `<header><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header><div class="body">${bodyHTML}</div>`;
  d.querySelector('[data-close]').onclick = () => d.close();
  d.onclose = () => { onClose?.(); d.onclose = null; };
  d.onclick = e => { if (e.target === d) d.close(); };
  d.showModal();
  initRanges(d);
  return d;
}

export function confirmBox(title, text, okLabel = 'Confirm') {
  return new Promise(res => {
    let ok = false;
    const d = modal(title, `<p class="muted">${text}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-ok>${okLabel}</button></div>`, { onClose: () => res(ok) });
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = () => { ok = true; d.close(); };
  });
}

// Filled range tracks (WebKit): keep --p in sync with the value.
export function fillRange(r) {
  const min = +r.min || 0, max = r.max === '' ? 100 : +r.max;
  r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
}
export function setRange(r, v) { r.value = v; fillRange(r); }
export function initRanges(root) { root.querySelectorAll('input[type=range]').forEach(fillRange); }
globalThis.document?.addEventListener('input', e => { if (e.target.type === 'range') fillRange(e.target); });

// Rotary knob: drag (vertical or around), wheel, arrow keys, Home/double-click to reset.
export function knob({ label, min, max, value, step = 1, def = value, fmt = v => v, onInput, signal }) {
  const el = document.createElement('div');
  el.className = 'knob';
  el.innerHTML = `<div class="knob-dial" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}">
    <svg viewBox="0 0 80 80"><path d="M17.4 62.6A32 32 0 1 1 62.6 62.6" fill="none" stroke="#2b2620" stroke-width="4" stroke-linecap="round"/>
    <path class="arc" d="" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/></svg><div class="knob-cap"></div></div>
    <div class="knob-label">${label}</div><div class="knob-val mono"></div>`;
  const dial = el.querySelector('.knob-dial'), cap = el.querySelector('.knob-cap'), arc = el.querySelector('.arc'), out = el.querySelector('.knob-val');
  let v = value;
  const span = max - min;
  const pt = a => { const r = (a - 90) * Math.PI / 180; return [40 + 32 * Math.cos(r), 40 + 32 * Math.sin(r)]; };
  function render() {
    const f = (v - min) / span, ang = -135 + f * 270;
    cap.style.transform = `rotate(${ang}deg)`;
    // Arc grows from the default (centre for bipolar controls) to the current value.
    const a0 = -135 + ((def - min) / span) * 270;
    const [s, e] = a0 < ang ? [a0, ang] : [ang, a0];
    const [x1, y1] = pt(s), [x2, y2] = pt(e);
    arc.setAttribute('d', Math.abs(e - s) < 0.5 ? '' : `M${x1} ${y1}A32 32 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2}`);
    out.textContent = fmt(v);
    dial.setAttribute('aria-valuenow', v); dial.setAttribute('aria-valuetext', fmt(v));
  }
  function set(nv, emit = true) {
    nv = Math.min(max, Math.max(min, Math.round(nv / step) * step));
    nv = +nv.toFixed(4);
    if (nv === v) return;
    v = nv; render();
    if (emit) onInput?.(v);
  }
  let startY, startV;
  dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); startY = e.clientY; startV = v; dial.focus(); }, { signal });
  dial.addEventListener('pointermove', e => { if (startY == null) return; set(startV + (startY - e.clientY) / 160 * span); }, { signal });
  dial.addEventListener('pointerup', () => { startY = null; }, { signal });
  dial.addEventListener('pointercancel', () => { startY = null; }, { signal });
  dial.addEventListener('dblclick', () => set(def), { signal });
  dial.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * step * (span / step > 40 ? 2 : 1)); }, { passive: false, signal });
  dial.addEventListener('keydown', e => {
    const big = Math.max(step, span / 10);
    const map = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big };
    if (e.key in map) { e.preventDefault(); set(v + map[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); set(def); }
  }, { signal });
  render();
  el.set = nv => set(nv, false);
  el.get = () => v;
  return el;
}

// DPR-aware canvas that tracks its CSS box size.
export function fitCanvas(canvas, { maxDpr = 2, onResize } = {}) {
  const ctx = canvas.getContext('2d');
  const st = { ctx, w: 0, h: 0, dpr: 1 };
  const ro = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const d = Math.min(devicePixelRatio || 1, maxDpr);
    st.w = r.width; st.h = r.height; st.dpr = d;
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    onResize?.(st);
  });
  ro.observe(canvas);
  st.destroy = () => ro.disconnect();
  return st;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmtTime = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function download(name, href) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.append(a); a.click(); a.remove(); }
