// Vibration is an enhancement only: feature-detected, user-toggleable, silently a no-op elsewhere.
import { settings } from './storage.js';

const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const PATTERNS = { tick: 6, click: 12, pop: 18, thud: 30, bump: [18, 40, 18], win: [30, 60, 30, 60, 60] };
let last = 0;

export const haptics = {
  supported,
  pulse(name = 'click') {
    if (!supported || !settings.get('haptics')) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const now = performance.now();
    if (now - last < 25) return; // don't flood the motor
    last = now;
    const k = settings.get('hapticStrength');
    const p = PATTERNS[name] ?? name;
    try { navigator.vibrate(Array.isArray(p) ? p.map((v, i) => i % 2 ? v : Math.round(v * k)) : Math.round(p * k)); } catch {}
  },
};
