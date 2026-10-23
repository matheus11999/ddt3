// Transforma formas simples em pixel art: cada forma vira pixel duro e o código
// pinta sombra em duas camadas (com pontilhado na passagem), brilho no alto,
// sombra projetada embaixo das peças de cima e contorno na cor escura de cada
// peça, como numa pixel art feita à mão.

import { mk, hex } from './pixel.js';

export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
function toRgb(c) { return c.startsWith('#') ? hex(c) : c.match(/\d+/g).map(Number); }

export const shadeOf = c => mix(c, '#3a1640', 0.3);
export const deepOf = c => mix(c, '#24102a', 0.52);
export const lightOf = c => mix(c, '#fffbe8', 0.42);
export const lineOf = c => mix(c, '#160a06', 0.74);

// ---- formas (coordenadas na escala 1)
export const el = (cx, cy, rx, ry, rot = 0) => g => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
export const poly = pts => g => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
export const rr = (x, y, w, h, r) => g => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
export const line = (x1, y1, x2, y2, w) => g => { g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
export const arc = (cx, cy, r, a0, a1, w) => g => { g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke(); };
export const all = (...fs) => g => fs.forEach(f => f(g));
export const clip = (x, y, w, h, f) => g => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); f(g); g.restore(); };
export const rot = (cx, cy, a, f) => g => { g.save(); g.translate(cx, cy); g.rotate(a); f(g); g.restore(); };

export function part(color, draw, o = {}) {
  return {
    c: color, d: o.shade ?? shadeOf(color), dd: o.deep ?? deepOf(color),
    l: o.light === false ? null : o.light ?? lightOf(color), o: o.outline ?? lineOf(color),
    line: o.line ?? true, flat: o.flat, ao: o.ao ?? true, draw,
  };
}

function maskOf(w, h, k, draw) {
  const [, g] = mk(w, h);
  g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  draw(g);
  const d = g.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 120 ? 1 : 0;
  return m;
}

export function render(parts, w0, h0, k, details) {
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const lab = new Int16Array(w * h).fill(-1);
  parts.forEach((p, i) => {
    const m = maskOf(w, h, k, p.draw);
    for (let j = 0; j < m.length; j++) if (m[j]) lab[j] = i;
  });
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : lab[y * w + x]);
  const [c, g] = mk(w, h);
  const img = g.createImageData(w, h);
  const cache = new Map();
  const put = (x, y, col) => {
    let v = cache.get(col);
    if (!v) { v = toRgb(col); cache.set(col, v); }
    const o = (y * w + x) * 4;
    img.data[o] = v[0]; img.data[o + 1] = v[1]; img.data[o + 2] = v[2]; img.data[o + 3] = 255;
  };
  const s = Math.max(2, Math.round(2.4 * k));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const L = at(x, y);
    if (L < 0) {
      let best = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const n = at(x + dx, y + dy);
        if (n > best) best = n;
      }
      if (best >= 0) put(x, y, parts[best].o);
      continue;
    }
    const p = parts[L];
    const own = (dx, dy) => at(x + dx, y + dy) === L;
    const chk = (x + y) & 1;
    let col = p.c;
    if (!p.flat) {
      if (!own(1, 1) && !own(0, 1)) col = p.dd;
      else if (!own(s, s)) col = p.d;
      else if (!own(s + 1, s + 1) && chk) col = p.d;
      else if (p.l && (!own(-1, -1) || !own(0, -1))) col = p.l;
      else if (p.l && !own(-2, -2) && chk) col = p.l;
      if (p.ao && col !== p.dd) {
        const up1 = at(x, y - 1), up2 = at(x, y - 2);
        if ((up1 > L && parts[up1].c !== p.c) || (up2 > L && parts[up2].c !== p.c && chk)) col = p.d;
      }
    }
    if (p.line) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at(x + dx, y + dy);
        if (n >= 0 && n < L && parts[n].c !== p.c) { col = p.o; break; }
      }
    }
    put(x, y, col);
  }
  g.putImageData(img, 0, 0);
  if (details) {
    const px = (x, y, ww, hh, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(ww * k)), Math.max(1, Math.round(hh * k)));
    };
    // pixel único na escala real (para brilhos de 1 px mesmo em escala grande)
    const dot = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x * k), Math.round(y * k), 1, 1); };
    details(px, dot, k, g);
  }
  return c;
}
