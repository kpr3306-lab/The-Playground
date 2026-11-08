// Versioned localStorage wrapper. Never throws: private mode, quota and malformed JSON all fall back to defaults.
const PREFIX = 'pg:v1:';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return fallback;
      const v = JSON.parse(raw);
      // Guard against a stored value of a different shape than expected.
      if (fallback !== undefined && fallback !== null && typeof v !== typeof fallback) return fallback;
      return v;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(PREFIX + key); } catch {} },
  exportAll() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch {}
    return out;
  },
  clearAll() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch {}
  },
};

const DEFAULTS = {
  volume: 0.8, muted: false, haptics: true, hapticStrength: 1,
  motion: 'auto', quality: 'auto', accent: 'amber', moduleSound: {},
};

// Settings: merged with defaults so new keys appear and bad types are ignored.
export const settings = (() => {
  const saved = store.get('settings', {});
  const s = { ...DEFAULTS };
  for (const k in DEFAULTS) if (saved && typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k];
  const subs = new Set();
  return {
    get: k => s[k],
    all: () => ({ ...s }),
    set(k, v) { s[k] = v; store.set('settings', s); subs.forEach(f => f(k, v)); },
    on(f) { subs.add(f); return () => subs.delete(f); },
    reset() { Object.assign(s, DEFAULTS, { moduleSound: {} }); store.set('settings', s); subs.forEach(f => f('*')); },
  };
})();

export function reducedMotion() {
  const m = settings.get('motion');
  if (m === 'reduce') return true;
  if (m === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function quality() {
  const q = settings.get('quality');
  if (q !== 'auto') return q;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || matchMedia('(pointer: coarse)').matches;
  return weak ? 'low' : 'high';
}
