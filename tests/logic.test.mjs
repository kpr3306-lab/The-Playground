import { test } from 'node:test';
import assert from 'node:assert/strict';
import { press, generate } from '../js/exp/lights-out.js';
import { slide, live, canMove } from '../js/exp/number-merge.js';
import { CARS, makeDrive, stepDrive, tryStart, tryShift } from '../js/exp/garage-engine.js';
import { delaunay, voronoi, mulberry } from '../js/exp/generative-art.js';

test('geometry: Voronoi cells tile the canvas; Delaunay triangulates a square', () => {
  const rnd = mulberry(42), W = 400, H = 300;
  const sites = Array.from({ length: 60 }, () => [rnd() * W, rnd() * H]);
  const area = p => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  const total = voronoi(sites, W, H).reduce((s, p) => s + area(p), 0);
  assert.ok(Math.abs(total - W * H) < 1, `cells cover the canvas (${total})`);
  assert.equal(delaunay([[0, 0], [1, 0], [1, 1], [0, 1]]).length, 2);
  assert.equal(delaunay(sites).length, 2 * 60 - 2 - hullSize(sites));
});
// Euler: triangles = 2n - 2 - h for n points with h on the convex hull.
function hullSize(p) {
  const s = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of s) { while (lo.length > 1 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of s.reverse()) { while (up.length > 1 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.length + up.length - 2;
}

test('lights out: press toggles cross pattern and is self-inverse', () => {
  const b = press(new Array(9).fill(0), 3, 4);
  assert.deepEqual(b, [0, 1, 0, 1, 1, 1, 0, 1, 0]);
  assert.deepEqual(press(b, 3, 4), new Array(9).fill(0));
  assert.deepEqual(press(new Array(9).fill(0), 3, 0), [1, 1, 0, 1, 0, 0, 0, 0, 0]);
});

test('lights out: generated puzzle is solved by its press set', () => {
  for (const n of [3, 4, 5, 6]) {
    const { board, sol } = generate(n);
    let b = board;
    sol.forEach((s, i) => { if (s) b = press(b, n, i); });
    assert.ok(b.every(v => v === 0), `size ${n}`);
  }
});

const row = (vals) => vals.map((v, c) => v && { id: c + 1, v, r: 0, c }).filter(Boolean);
const vals = (tiles, size) => { const out = new Array(size).fill(0); for (const t of live(tiles)) out[t.c] = t.v; return out; };

test('number merge: each tile merges at most once per move', () => {
  assert.deepEqual(vals(slide(row([2, 2, 2, 2]), 4, 'left', 10).tiles, 4), [4, 4, 0, 0]);
  assert.deepEqual(vals(slide(row([2, 2, 4, 0]), 4, 'left', 10).tiles, 4), [4, 4, 0, 0]);
  assert.deepEqual(vals(slide(row([4, 4, 8, 0]), 4, 'left', 10).tiles, 4), [8, 8, 0, 0]);
  assert.deepEqual(vals(slide(row([2, 0, 2, 4]), 4, 'right', 10).tiles, 4), [0, 0, 4, 4]);
  const r = slide(row([2, 2, 2, 2]), 4, 'left', 10);
  assert.equal(r.score, 8);
});

test('number merge: no-op move is reported as not moved', () => {
  assert.equal(slide(row([2, 4, 8, 16]), 4, 'left', 10).moved, false);
});

test('number merge: game over detection', () => {
  const full = [2, 4, 2, 4].flatMap((_, r) => [0, 1, 2, 3].map(c => ({ id: r * 4 + c + 1, v: (r + c) % 2 ? 4 : 2, r, c })));
  assert.equal(canMove(full, 4), false);
  full[0].v = 4;
  assert.equal(canMove(full, 4), true);
});

test('arcade auto-box never shows RPM past the redline, for every car', async () => {
  const { arcadeMax, autoBox } = await import('../js/exp/garage-engine.js');
  for (const c of CARS) {
    let g = 1;
    for (let v = 90; v <= arcadeMax(c); v += 3) { const b = autoBox(c, v * 0.6, g); g = b.gear; assert.ok(b.rpm <= c.red, `${c.id} at ${v}px/s: ${b.rpm}`); }
  }
});

function run(d, secs, ev = []) { for (let t = 0; t < secs * 240; t++) stepDrive(d, 1 / 240, ev); return ev; }

test('drivetrain: start, pull away in first, and gain speed only when coupled', () => {
  const d = makeDrive(CARS[0]);
  assert.equal(tryStart(d), null);
  run(d, 1.5);
  assert.ok(d.running, 'engine starts');
  d.thrIn = 1; run(d, 1);
  assert.ok(d.rpm > 4000, 'free revs in neutral');
  assert.equal(Math.abs(d.v), 0, 'no speed in neutral');
  d.thrIn = 0; d.clutchIn = 1; run(d, 1);
  assert.equal(tryShift(d, 1).ok, true);
  d.thrIn = 0.5; d.clutchIn = 0; run(d, 3);
  assert.ok(d.running, 'did not stall with throttle');
  assert.ok(d.v > 5, `car moves, v=${d.v}`);
});

test('drivetrain: gear change needs the clutch; dumping it with no throttle stalls', () => {
  const d = makeDrive(CARS[2]);
  tryStart(d); run(d, 1.5);
  assert.equal(tryShift(d, 1).ok, false, 'no clutch → refused');
  d.clutchIn = 1; run(d, 0.3);
  assert.equal(tryShift(d, 2).ok, true);
  d.thrIn = 0; d.clutchIn = 0; d.clutch = 0; // dump the clutch from standstill in 2nd
  const ev = run(d, 2);
  assert.ok(ev.includes('stall') && !d.running, 'stalls');
  assert.ok(tryStart(d), 'cannot restart in gear without clutch');
});
