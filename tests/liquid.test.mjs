// Stability check for the liquid solver: particles settle in a box without exploding or leaking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../js/exp/liquid-sim.js';

function settle(n = 900, steps = 900) {
  const s = new Sim(600, 400, { max: 1400, H: 18 });
  for (let i = 0; i < n; i++) s.add(40 + (i % 45) * 7, 40 + Math.floor(i / 45) * 7, i < n / 2 ? 'water' : 'oil');
  for (let k = 0; k < steps; k++) s.step();
  return s;
}

test('liquid settles in a stable pool', () => {
  const s = settle();
  let maxV = 0, minY = Infinity, out = 0;
  for (let i = 0; i < s.n; i++) {
    maxV = Math.max(maxV, Math.hypot(s.vx[i], s.vy[i]));
    minY = Math.min(minY, s.y[i]);
    if (s.x[i] < 0 || s.x[i] > s.w || s.y[i] < 0 || s.y[i] > s.h || Number.isNaN(s.x[i])) out++;
  }
  const area = s.w * (s.h - minY);
  console.log({ maxV: maxV.toFixed(3), depth: (s.h - minY).toFixed(1), areaPerParticle: (area / s.n).toFixed(1), cellArea: s.cellArea.toFixed(1) });
  assert.equal(out, 0, 'no particle escapes or becomes NaN');
  assert.ok(maxV < 1.5, `pool should be nearly still, maxV=${maxV}`);
  assert.ok(s.h - minY < 300 && s.h - minY > 40, 'pool has a sensible depth');
});

test('oil (lighter, immiscible) ends up mostly above water', () => {
  const s = settle(900, 2500);
  let wy = 0, oy = 0, wn = 0, on = 0;
  for (let i = 0; i < s.n; i++) if (s.kind[i] === 0) { wy += s.y[i]; wn++; } else { oy += s.y[i]; on++; }
  console.log({ waterMeanY: (wy / wn).toFixed(1), oilMeanY: (oy / on).toFixed(1) });
  assert.ok(oy / on < wy / wn, 'oil mean height is above water');
});
