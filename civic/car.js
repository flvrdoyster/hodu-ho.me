(function () {
  'use strict';
  const cv = document.getElementById('car');
  if (!cv || !cv.getContext) return;
  const box = cv.parentElement;
  const ctx = cv.getContext('2d');

  const H = 56, LIFT = 1.5, FPS = 12, SPIN = 0.45, PITCH = 0.36, REST = -0.6;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const PAL = {
    body: ['#f7f7f2', '#d8dadb', '#a9aeb3'],
    glass: ['#6a7f95', '#465769', '#2d3845'],
    trim: ['#50555b', '#383c41', '#26292d'],
    tire: ['#3b3e43', '#2c2f33', '#1f2124'],
    hub: ['#d7dbdf', '#a7adb3', '#7a8188'],
    lamp: ['#9fb4c8', '#7790a6', '#536a80'],
    tail: ['#e0524b', '#b63b36', '#7f2925'],
    lens: ['#ff8a7c', '#e8564d', '#a8352f'],
    chrome: ['#f2f4f6', '#c3c9cf', '#8d949b'],
  };
  const M = k => MAT.indexOf(k);
  const MAT = Object.keys(PAL);
  const RGB = MAT.map(k => PAL[k].map(hex));
  const LINE = hex('#1b2026');
  const LIGHT = norm([-0.45, 0.8, 0.4]);

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  const V = [], T = [];
  function vert(p) { V.push(p); return V.length - 1; }
  function poly(ids, mat, part, paint) {
    for (let i = 1; i < ids.length - 1; i++) {
      const a = V[ids[0]], b = V[ids[i]], c = V[ids[i + 1]];
      const n = cross(sub(b, a), sub(c, a));
      if (Math.hypot(n[0], n[1], n[2]) < 1e-6) continue;
      T.push({ v: [ids[0], ids[i], ids[i + 1]], n: norm(n), m: M(mat), part, paint });
    }
  }
  function loft(rings, matAt, capMat, part, paint) {
    const R = rings.map(r => r.map(vert));
    const n = R[0].length;
    for (let i = 0; i < R.length - 1; i++)
      for (let j = 0; j < n; j++)
        poly([R[i][j], R[i][(j + 1) % n], R[i + 1][(j + 1) % n], R[i + 1][j]], matAt(i, j), part, paint);
    poly(R[0], capMat[0], part, paint);
    poly(R[R.length - 1], capMat[1], part, paint);
  }

  const CURVES = new Map();
  function curve(tab) {
    const xs = tab.map(p => p[0]).reverse(), ys = tab.map(p => p[1]).reverse(), n = xs.length;
    const d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    for (let i = 0; i < n; i++) m.push(i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    for (let i = 0; i < n - 1; i++) {
      if (!d[i]) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  function interp(tab, x) {
    if (!CURVES.has(tab)) CURVES.set(tab, curve(tab));
    return CURVES.get(tab)(x);
  }
  const AXLE = [1.35, -1.33], WR = .34, ARCH = .43;
  const SILL = [[2.28, .44], [2.26, .35], [2.22, .29], [2.12, .24], [-2.10, .26], [-2.20, .30], [-2.26, .36], [-2.28, .45]];
  const BELT = [[2.28, .50], [2.26, .59], [2.22, .67], [2.17, .72], [2.10, .76], [1.88, .81], [1.68, .85], [1.49, .90], [1.29, .97],
    [.90, 1.03], [.70, 1.04], [-.09, 1.08], [-.87, 1.13], [-1.18, 1.16], [-1.81, 1.12], [-1.97, 1.10], [-2.13, 1.07],
    [-2.18, 1.04], [-2.22, .96], [-2.25, .84], [-2.27, .70], [-2.28, .56]];
  const HALF = [[2.28, .50], [2.25, .64], [2.20, .73], [2.12, .80], [2.00, .85], [1.80, .875], [-1.95, .875], [-2.10, .85], [-2.20, .79], [-2.26, .70], [-2.28, .60]];
  const ROOF = [[1.17, .99], [1.00, 1.08], [.80, 1.17], [.60, 1.26], [.40, 1.34], [.22, 1.40], [.05, 1.44], [-.09, 1.45],
    [-.48, 1.46], [-.87, 1.44], [-1.07, 1.41], [-1.26, 1.34], [-1.46, 1.26], [-1.66, 1.19], [-1.85, 1.11]];

  function stations(x0, x1, step) {
    const out = [];
    for (let x = x0; x > x1; x -= step) out.push(x);
    out.push(x1);
    return out;
  }
  function sill(x) {
    let y = interp(SILL, x);
    for (const a of AXLE) {
      const d = x - a;
      if (Math.abs(d) < ARCH) y = Math.max(y, WR + Math.sqrt(ARCH * ARCH - d * d));
    }
    return y;
  }
  function facePaint(x, y, z) {
    const az = Math.abs(z);
    if (x > 1.6) {
      const lo = .58 + (az - .44) * .2, hi = .72 + (az - .44) * .24;
      if (az > .42 && y > lo - .02 && y < hi + .015 && x > 2.26 - (y - .58) * 2.4) {
        if (az < .45 || y < lo || y > hi || x < 2.32 - (y - .58) * 2.4) return M('trim');
        if (Math.hypot(az - .56, y - .65) < .05 || Math.hypot(az - .71, y - .69) < .05) return M('chrome');
        return M('lamp');
      }
      if (x > 2.0) {
        if (az < .46 && y > .66 && y < .70) return M('chrome');
        if (az < .05 && y > .58) return M('chrome');
        if (az < .44 && y > .57 && y < .66) return M('trim');
        if (az < .44 && y > .29 && y < .45) return M('trim');
        if (az > .54 && az < .78 && y > .32 && y < .42) return M('trim');
      }
    }
    if (x < -1.9 && az > .42 && y > .86 && y < 1.05) {
      if (Math.hypot(az - .60, y - .95) < .05 || Math.hypot(az - .74, y - .95) < .05) return M('lens');
      return M('tail');
    }
    return -1;
  }
  const K = 5;
  function quarter(w, y0, y1, n) {
    const q = [];
    for (let t = 1; t < K; t++) {
      const f = t / K * Math.PI / 2;
      q.push([w * Math.pow(Math.cos(f), 2 / n), y0 + (y1 - y0) * Math.pow(Math.sin(f), 2 / n)]);
    }
    return q;
  }
  function crown(x, q, ytop) {
    return [...q.map(p => [x, p[1], p[0]]), [x, ytop, 0], ...q.slice().reverse().map(p => [x, p[1], -p[0]])];
  }

  const BX = stations(2.28, -2.28, .04);
  loft(BX.map(x => {
    const yt = interp(BELT, x), w = interp(HALF, x), ytop = yt + .03, ys = yt - .17;
    const yb = Math.min(sill(x), ys - .02), yc = Math.min(yb + .12, ys - .01);
    return [[x, yb, -w * .88], [x, yb, w * .88], [x, yc, w], [x, ys, w], ...crown(x, quarter(w, ys, ytop, 3), ytop), [x, ys, -w], [x, yc, -w]];
  }), (i, j) => j === 0 && (BX[i] + BX[i + 1]) / 2 < 2.2 ? 'trim' : 'body', ['body', 'body'], 1, facePaint);

  const GX = stations(1.17, -1.85, .04);
  function roof(x) {
    const yb = interp(BELT, x);
    return [yb, yb + Math.max((interp(ROOF, x) - yb) * LIFT, .005)];
  }
  function glassPaint(x, y, z) {
    const [yb, yt] = roof(x), u = (y - yb) / (yt - yb), az = Math.abs(z);
    const edge = x > .27 ? .53 + (x - .27) / .90 * .17 : x < -1.07 ? .53 + (-1.07 - x) / .78 * .15 : 0;
    if (edge) {
      if (az < edge) return M('glass');
      if (az < edge + .11 || u > .8) return M('body');
    } else if (u > .8) return M('body');
    if (x > 1.05 || x < -1.18) return M('body');
    if ((x < .66 && x > .61) || (x < -.23 && x > -.36)) return M('trim');
    return M('glass');
  }
  loft(GX.map(x => {
    const [yb, yt] = roof(x), wb = .76;
    return [[x, yb, -wb], [x, yb, wb], ...crown(x, quarter(wb, yb, yt, 3.5), yt)];
  }), () => 'body', ['body', 'body'], 1, glassPaint);

  function cuboid(x0, x1, y0, y1, z0, z1, mat, part) {
    const c = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) c.push(vert([x, y, z]));
    [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
      .forEach(f => poly(f.map(i => c[i]), mat, part));
  }
  cuboid(.58, .70, .92, 1.06, .86, 1.0, 'body', 1);
  cuboid(.58, .70, .92, 1.06, -1.0, -.86, 'body', 1);

  function spokes(cx) {
    const step = Math.PI * 2 / 5;
    return (x, y) => {
      const dx = x - cx, dy = y - WR, r = Math.hypot(dx, dy) / WR;
      if (r > .64 || r < .2) return M('hub');
      const f = (Math.atan2(dy, dx) + Math.PI / 2) / step;
      return Math.abs(f - Math.round(f)) < .17 ? M('hub') : M('tire');
    };
  }
  function wheel(cx, side) {
    const N = 12, r = WR, ro = .80 * side, ri = .60 * side, rh = r * .74;
    const ring = (z, rad) => Array.from({ length: N }, (_, k) => {
      const a = (k / N) * Math.PI * 2;
      return vert([cx + Math.cos(a) * rad, r + Math.sin(a) * rad, z]);
    });
    const out = ring(ro, r), hub = ring(ro, rh), inn = ring(ri, r);
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      poly([out[k], out[k2], inn[k2], inn[k]], 'tire', 2);
      poly([out[k], out[k2], hub[k2], hub[k]], 'tire', 2);
    }
    poly(hub, 'hub', 2, spokes(cx));
    poly(inn, 'tire', 2);
  }
  AXLE.forEach(x => { wheel(x, 1); wheel(x, -1); });

  const SHADOW = [[2.36, 0, .96], [2.36, 0, -.96], [-2.36, 0, -.96], [-2.36, 0, .96]];

  let W = 0, P = 3, img = null, zb = null, id = null;
  function size() {
    P = box.clientWidth >= 600 ? 4 : 3;
    const w = Math.min(Math.floor(box.clientWidth / P), 150);
    if (w === W || w < 40) return;
    W = w;
    cv.width = W; cv.height = H;
    cv.style.width = W * P + 'px'; cv.style.height = H * P + 'px';
    img = ctx.createImageData(W, H);
    zb = new Float32Array(W * H);
    id = new Int8Array(W * H);
  }

  function cssColor(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? hex(v) : [200, 200, 200];
  }

  function draw(yaw) {
    if (!img) return;
    const ca = Math.cos(yaw), sa = Math.sin(yaw), ce = Math.cos(PITCH), se = Math.sin(PITCH);
    const s = Math.min(W / 5.0, H / 3.1), cx = W / 2, cy = H * .7;
    const proj = p => {
      const X = p[0] * ca + p[2] * sa, Z = -p[0] * sa + p[2] * ca;
      return [cx + X * s, cy - (p[1] * ce - Z * se) * s, Z * ce + p[1] * se];
    };
    const viewZ = n => (-n[0] * sa + n[2] * ca) * ce + n[1] * se;
    const px = img.data;
    zb.fill(-1e9); id.fill(0);
    const col = new Uint8Array(W * H * 3);

    function raster(a, b, c, rgb, part, t, tone) {
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) return;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const qx = x + .5, qy = y + .5;
        const w0 = ((b[0] - qx) * (c[1] - qy) - (b[1] - qy) * (c[0] - qx)) / area;
        const w1 = ((c[0] - qx) * (a[1] - qy) - (c[1] - qy) * (a[0] - qx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = part < 0 ? -1e8 : w0 * a[2] + w1 * b[2] + w2 * c[2];
        const i = y * W + x;
        if (z <= zb[i]) continue;
        zb[i] = z; id[i] = part;
        if (t && t.paint) {
          const A = V[t.v[0]], B = V[t.v[1]], Cv = V[t.v[2]];
          const m = t.paint(w0 * A[0] + w1 * B[0] + w2 * Cv[0], w0 * A[1] + w1 * B[1] + w2 * Cv[1], w0 * A[2] + w1 * B[2] + w2 * Cv[2]);
          rgb = m >= 0 ? RGB[m][tone] : RGB[t.m][tone];
        }
        col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2];
      }
    }

    const sh = SHADOW.map(proj), shc = cssColor('--line');
    raster(sh[0], sh[1], sh[2], shc, -1);
    raster(sh[0], sh[2], sh[3], shc, -1);

    const PV = V.map(proj);
    for (const t of T) {
      let n = t.n;
      if (viewZ(n) < 0) n = [-n[0], -n[1], -n[2]];
      const k = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      const tone = n[1] > .8 || k > .62 ? 0 : k > .2 ? 1 : 2;
      raster(PV[t.v[0]], PV[t.v[1]], PV[t.v[2]], RGB[t.m][tone], t.part, t, tone);
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      let line = false;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      if (id[i] <= 0) line = nb.some(j => j >= 0 && id[j] > 0);
      else line = nb.some(j => j < 0 || id[j] <= 0 ? false : zb[j] - zb[i] > .35);
      if (line) { px[o] = LINE[0]; px[o + 1] = LINE[1]; px[o + 2] = LINE[2]; px[o + 3] = 255; }
      else if (id[i] !== 0) { px[o] = col[i * 3]; px[o + 1] = col[i * 3 + 1]; px[o + 2] = col[i * 3 + 2]; px[o + 3] = 255; }
      else px[o + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let yaw = REST, last = 0, acc = 0, raf = 0, seen = true, drag = null;

  function tick(t) {
    raf = 0;
    const dt = last ? Math.min(t - last, 100) : 0;
    last = t;
    if (!drag && !still.matches) yaw += SPIN * dt / 1000;
    acc += dt;
    if (acc >= 1000 / FPS || !dt) { acc = 0; draw(yaw); }
    loop();
  }
  function loop() {
    if (raf || !seen || document.hidden || (still.matches && !drag)) { last = 0; return; }
    raf = requestAnimationFrame(tick);
  }

  cv.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, yaw };
    cv.setPointerCapture(e.pointerId);
    loop();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.015;
    if (still.matches) draw(yaw);
  });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  new IntersectionObserver(es => { seen = es[0].isIntersecting; loop(); }).observe(cv);
  document.addEventListener('visibilitychange', loop);
  still.addEventListener('change', () => { draw(yaw); loop(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw(yaw));
  new ResizeObserver(() => { size(); draw(yaw); }).observe(box);

  size();
  draw(yaw);
  loop();
})();
