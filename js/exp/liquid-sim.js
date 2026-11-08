// Particle liquid: double-density relaxation (Clavet et al. 2005), simplified for 2D and mobile.
// Units: pixels and simulation steps (dt = 1). Pure logic; rendering lives in liquid-playground.js.

export const LIQUIDS = {
  water: { name: 'Water', color: [70, 150, 235], grav: 1, visc: 1, cls: 0 },
  ink: { name: 'Ink', color: [235, 70, 120], grav: 1, visc: 1, cls: 0 },
  oil: { name: 'Oil', color: [240, 190, 60], grav: 0.72, visc: 1.6, cls: 1 },
  honey: { name: 'Honey', color: [225, 150, 40], grav: 1.15, visc: 9, cls: 0, noBlend: true },
  acid: { name: 'Acid', color: [140, 235, 90], grav: 1, visc: 1, cls: 0, acid: true },
};
const KINDS = Object.keys(LIQUIDS);

export class Sim {
  constructor(w, h, { max = 1400, H = 18 } = {}) {
    this.w = w; this.h = h; this.H = H; this.max = max;
    this.n = 0;
    const F = () => new Float32Array(max);
    this.x = F(); this.y = F(); this.px = F(); this.py = F(); this.vx = F(); this.vy = F();
    this.r = F(); this.g = F(); this.b = F(); this.gs = F(); this.vs = F();
    this.kind = new Uint8Array(max);
    this.rho = F(); this.rhoN = F();
    this.pairs = new Int32Array(max * 48); this.np = 0;
    this.p = { gravity: 0.11, rest: 2.6, k: 0.09, kNear: 0.35, visc: 0.08, tension: 0.6, sep: 0.06, maxV: H * 0.45 };
    this.bodies = [];
    this.walls = []; // static axis-aligned rects {x0,y0,x1,y1}
    this.events = { splash: 0, absorbed: 0, fizz: [] };
  }
  resize(w, h) { this.w = w; this.h = h; }
  add(x, y, kind, color, gs) {
    if (this.n >= this.max) return false;
    const i = this.n++, L = LIQUIDS[kind];
    this.x[i] = this.px[i] = x + (Math.random() - 0.5); this.y[i] = this.py[i] = y + (Math.random() - 0.5);
    this.vx[i] = this.vy[i] = 0;
    const c = color || L.color;
    this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2];
    this.kind[i] = KINDS.indexOf(kind); this.gs[i] = gs ?? L.grav; this.vs[i] = L.visc;
    return true;
  }
  remove(i) { // swap-remove
    const j = --this.n;
    if (i === j) return;
    for (const a of [this.x, this.y, this.px, this.py, this.vx, this.vy, this.r, this.g, this.b, this.gs, this.vs, this.kind]) a[i] = a[j];
  }
  clear() { this.n = 0; }

  // Spatial hash via counting sort; produces the neighbour pair list.
  neighbours() {
    const { H, n, x, y } = this;
    const cw = Math.ceil(this.w / H) + 2, ch = Math.ceil(this.h / H) + 2, cells = cw * ch;
    if (!this.cellStart || this.cellStart.length < cells + 1) { this.cellStart = new Int32Array(cells + 1); }
    if (!this.cellOf || this.cellOf.length < this.max) { this.cellOf = new Int32Array(this.max); this.sorted = new Int32Array(this.max); }
    const cs = this.cellStart, co = this.cellOf, so = this.sorted;
    cs.fill(0, 0, cells + 1);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cw - 1, Math.max(0, Math.floor(x[i] / H) + 1)), cy = Math.min(ch - 1, Math.max(0, Math.floor(y[i] / H) + 1));
      co[i] = cy * cw + cx; cs[co[i] + 1]++;
    }
    for (let c = 0; c < cells; c++) cs[c + 1] += cs[c];
    const fill = this._fill && this._fill.length >= cells ? this._fill : (this._fill = new Int32Array(cells));
    fill.fill(0, 0, cells);
    for (let i = 0; i < n; i++) so[cs[co[i]] + fill[co[i]]++] = i;
    let np = 0;
    const P = this.pairs, maxP = P.length / 3, H2 = H * H;
    for (let i = 0; i < n; i++) {
      const c = co[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cc = c + dy * cw + dx;
        if (cc < 0 || cc >= cells) continue;
        for (let s = cs[cc], e = cs[cc + 1]; s < e; s++) {
          const j = so[s];
          if (j <= i) continue;
          const ddx = x[j] - x[i], ddy = y[j] - y[i], d2 = ddx * ddx + ddy * ddy;
          if (d2 < H2 && np < maxP) { P[np * 3] = i; P[np * 3 + 1] = j; P[np * 3 + 2] = Math.sqrt(d2) * 1000; np++; }
        }
      }
    }
    this.np = np;
  }

  step(opts = {}) {
    const p = this.p, { n, x, y, px, py, vx, vy, H } = this;
    const visc = p.visc * (opts.viscScale ?? 1), tension = p.tension * (opts.tension ?? 1);
    for (let i = 0; i < n; i++) vy[i] += p.gravity * this.gs[i];
    // Viscosity impulses (uses neighbour list from the previous step; cheap and stable enough).
    const P = this.pairs;
    for (let k = 0; k < this.np; k++) {
      const i = P[k * 3], j = P[k * 3 + 1];
      if (i >= n || j >= n) continue;
      const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy);
      if (d === 0 || d >= H) continue;
      const q = d / H, nx = dx / d, ny = dy / d;
      const u = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
      if (u > 0) {
        const s = visc * (this.vs[i] + this.vs[j]) * 0.5;
        const I = 0.5 * (1 - q) * Math.min(u, s * u + 0.02 * u * u);
        vx[i] -= I * nx; vy[i] -= I * ny; vx[j] += I * nx; vy[j] += I * ny;
      }
    }
    for (let i = 0; i < n; i++) {
      const m = p.maxV, sp = Math.hypot(vx[i], vy[i]);
      if (sp > m) { vx[i] *= m / sp; vy[i] *= m / sp; }
      px[i] = x[i]; py[i] = y[i]; x[i] += vx[i]; y[i] += vy[i];
    }
    this.neighbours();
    // Double density relaxation.
    const rho = this.rho, rhoN = this.rhoN;
    rho.fill(0, 0, n); rhoN.fill(0, 0, n);
    for (let k = 0; k < this.np; k++) {
      const i = P[k * 3], j = P[k * 3 + 1], q = 1 - P[k * 3 + 2] / 1000 / H;
      const q2 = q * q, q3 = q2 * q;
      rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
    }
    const kind = this.kind, cls = KINDS.map(k => LIQUIDS[k].cls), blend = opts.blend ?? 0.01;
    for (let k = 0; k < this.np; k++) {
      const i = P[k * 3], j = P[k * 3 + 1];
      const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy) || 0.01;
      const q = 1 - d / H; if (q <= 0) continue;
      const Pi = p.k * (rho[i] - p.rest), Pj = p.k * (rho[j] - p.rest);
      let D = (Pi + Pj) * 0.5 * q + p.kNear * (rhoN[i] + rhoN[j]) * 0.5 * q * q;
      const same = cls[kind[i]] === cls[kind[j]];
      if (same) D -= tension * 0.04 * q * (1 - q); // cohesion: soft attraction at mid range
      else D += p.sep * q; // immiscible liquids push apart and form separate regions
      const hx = dx / d * D * 0.5, hy = dy / d * D * 0.5;
      x[i] -= hx; y[i] -= hy; x[j] += hx; y[j] += hy;
      if (same && blend && q > 0.4 && !LIQUIDS[KINDS[kind[i]]].noBlend && !LIQUIDS[KINDS[kind[j]]].noBlend) {
        const r = (this.r[j] - this.r[i]) * blend, g = (this.g[j] - this.g[i]) * blend, b = (this.b[j] - this.b[i]) * blend;
        this.r[i] += r; this.g[i] += g; this.b[i] += b; this.r[j] -= r; this.g[j] -= g; this.b[j] -= b;
      }
    }
    this.collide();
    for (let i = 0; i < this.n; i++) { vx[i] = x[i] - px[i]; vy[i] = y[i] - py[i]; }
    this.stepBodies();
  }

  collide() {
    const { x, y, w, h } = this, pad = 2;
    for (let i = 0; i < this.n; i++) {
      if (x[i] < pad) x[i] = pad + Math.random() * 0.1; else if (x[i] > w - pad) x[i] = w - pad - Math.random() * 0.1;
      if (y[i] > h - pad) y[i] = h - pad - Math.random() * 0.1; else if (y[i] < pad) y[i] = pad;
      for (const wl of this.walls) pushOutRect(this, i, wl.x0, wl.y0, wl.x1, wl.y1);
    }
    for (const B of this.bodies) {
      B.sub = 0;
      for (let i = this.n - 1; i >= 0; i--) {
        const dx = x[i] - B.x, dy = y[i] - B.y;
        const R = B.shape === 'circle' ? B.r + 3 : 0;
        let inside;
        if (B.shape === 'circle') inside = dx * dx + dy * dy < R * R;
        else inside = Math.abs(dx) < B.hw + 3 && Math.abs(dy) < B.hh + 3;
        if (!inside) continue;
        B.sub++;
        if (B.sponge && B.held < B.cap) {
          B.held++; B.store.push([KINDS[this.kind[i]], this.r[i], this.g[i], this.b[i]]);
          this.events.absorbed++; this.remove(i); continue;
        }
        if (B.reactive && this.kind[i] === KINDS.indexOf('acid')) {
          B.hp -= 0.08;
          if (Math.random() < 0.1) { this.events.fizz.push([x[i], y[i]]); this.kind[i] = 0; this.r[i] = 120; this.g[i] = 200; this.b[i] = 150; } // spent acid turns into a watery residue
        }
        const ox = x[i], oy = y[i];
        if (B.shape === 'circle') { const d = Math.hypot(dx, dy) || 1; x[i] = B.x + dx / d * R; y[i] = B.y + dy / d * R; }
        else pushOutRect(this, i, B.x - B.hw - 3, B.y - B.hh - 3, B.x + B.hw + 3, B.y + B.hh + 3);
        // Particles carry the body's motion (stirring); the body feels a small reaction.
        x[i] += B.vx * 0.6; y[i] += B.vy * 0.6;
        if (!B.kinematic) { B.vx -= (x[i] - ox) * 0.002 / B.mass; B.vy -= (y[i] - oy) * 0.002 / B.mass; }
      }
    }
  }

  stepBodies() {
    const p = this.p;
    for (const B of this.bodies) {
      if (B.kinematic) continue;
      const area = B.shape === 'circle' ? Math.PI * B.r * B.r : 4 * B.hw * B.hh;
      const full = area / this.cellArea; // particles expected if fully submerged
      const frac = Math.min(1, B.sub / Math.max(1, full));
      const dens = B.density + (B.sponge ? B.held / B.cap * 1.2 : 0);
      B.vy += p.gravity * (1 - frac / dens);
      const drag = 1 - 0.06 * frac - 0.002; B.vx *= drag; B.vy *= drag;
      if (frac > 0.05 && !B.wet && B.vy > 1.2) { this.events.splash = Math.max(this.events.splash, B.vy); }
      B.wet = frac > 0.05;
      B.x += B.vx; B.y += B.vy;
      const ex = B.shape === 'circle' ? B.r : B.hw, ey = B.shape === 'circle' ? B.r : B.hh;
      if (B.y > this.h - ey) { B.y = this.h - ey; B.vy *= -0.2; B.vx *= 0.95; }
      if (B.y < ey) { B.y = ey; B.vy = 0; }
      if (B.x < ex) { B.x = ex; B.vx *= -0.3; }
      if (B.x > this.w - ex) { B.x = this.w - ex; B.vx *= -0.3; }
      for (const wl of this.walls) {
        if (B.y + ey > wl.y0 && B.y - ey < wl.y1 && B.x + ex > wl.x0 && B.x - ex < wl.x1) {
          const left = B.x < (wl.x0 + wl.x1) / 2;
          B.x = left ? wl.x0 - ex : wl.x1 + ex; B.vx *= -0.3;
        }
      }
    }
    // Bodies don't overlap each other (circle approximation).
    for (let a = 0; a < this.bodies.length; a++) for (let b = a + 1; b < this.bodies.length; b++) {
      const A = this.bodies[a], Bb = this.bodies[b];
      const ra = A.r || Math.max(A.hw, A.hh), rb = Bb.r || Math.max(Bb.hw, Bb.hh);
      const dx = Bb.x - A.x, dy = Bb.y - A.y, d = Math.hypot(dx, dy) || 1, o = ra + rb - d;
      if (o > 0) {
        const wa = A.kinematic ? 0 : 1, wb = Bb.kinematic ? 0 : 1, s = wa + wb; if (!s) continue;
        A.x -= dx / d * o * wa / s; A.y -= dy / d * o * wa / s; Bb.x += dx / d * o * wb / s; Bb.y += dy / d * o * wb / s;
      }
    }
  }
  // Average area per particle at rest; calibrated in tests/liquid.test.mjs.
  get cellArea() { return (this.H * 0.373) ** 2; }
}

function pushOutRect(s, i, x0, y0, x1, y1) {
  const x = s.x[i], y = s.y[i];
  if (x <= x0 || x >= x1 || y <= y0 || y >= y1) return;
  const l = x - x0, r = x1 - x, t = y - y0, b = y1 - y, m = Math.min(l, r, t, b);
  if (m === l) s.x[i] = x0; else if (m === r) s.x[i] = x1; else if (m === t) s.y[i] = y0; else s.y[i] = y1;
}
