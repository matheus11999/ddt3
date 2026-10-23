// Ícones da sala montados por formas e pintados com sombra e brilho
// pelo mesmo processo dos heróis (shapes.js). Desenhados num quadro de 20x20.

import { el, poly, rr, line, arc, all, rot, part, render } from './shapes.js';

const star = (cx, cy, r1, r2, n, a0 = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = a0 + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
};

const doll = (c) => [
  part(c, all(el(10, 5, 3.6, 3.6), rr(7, 8, 6, 7, 2), line(4, 10, 16, 10, 2.6), line(8.5, 14, 7, 18.5, 2.6), line(11.5, 14, 13, 18.5, 2.6))),
];

const DEFS = {
  explosion: [
    part('#e8401e', star(10, 10, 9.5, 5, 9)),
    part('#ffb02a', star(10, 10, 7, 3.6, 8, 0.3)),
    part('#fff4a0', el(10, 10, 3, 3), { light: false }),
  ],
  target: [
    part('#d6302a', el(10, 10, 8.5, 8.5)),
    part('#fff4e4', el(10, 10, 6, 6)),
    part('#d6302a', el(10, 10, 3.8, 3.8)),
    part('#fff4e4', el(10, 10, 1.5, 1.5), { flat: true }),
  ],
  dummy: doll('#e8b84a'),
  dummyP: doll('#9a6ae0'),
  heal: [part('#4cc23a', all(rr(7, 2, 6, 16, 2), rr(2, 7, 16, 6, 2)))],
  rocket: [
    part('#ff9a2a', rot(10, 10, Math.PI / 4, poly([[-2.5, 6], [0, 11], [2.5, 6]]))),
    part('#e8eef4', rot(10, 10, Math.PI / 4, rr(-3, -6, 6, 12, 2.5))),
    part('#d6302a', rot(10, 10, Math.PI / 4, all(poly([[-3, -5], [0, -10], [3, -5]]), poly([[-3, 3], [-6, 7], [-3, 6]]), poly([[3, 3], [6, 7], [3, 6]])))),
    part('#5ab0f0', rot(10, 10, Math.PI / 4, el(0, -1.5, 1.6, 1.6)), { flat: true }),
  ],
  fire: [
    part('#e8401e', poly([[10, 1], [15, 7], [17, 12], [15, 17], [10, 19], [5, 17], [3, 12], [5, 8], [7, 10], [8, 5]])),
    part('#ffa02a', poly([[10, 7], [13, 11], [14, 15], [10, 18], [6, 15], [7, 12], [9, 13]])),
    part('#fff08a', el(10, 15.5, 2.2, 2.6), { light: false }),
  ],
  crystal: [
    part('#4aa8f0', poly([[10, 1], [16, 7], [10, 19], [4, 7]])),
    part('#a8e4ff', poly([[10, 1], [10, 19], [4, 7]]), { line: true }),
    part('#e4f8ff', poly([[4, 7], [10, 1], [16, 7], [10, 8]])),
  ],
  banana: [
    part('#ffd83a', g => { g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(4, 4, 12, 0.15 * Math.PI, 0.6 * Math.PI); g.stroke(); }),
    part('#6a4a24', all(el(15.5, 5.6, 1.6, 2.2), el(5.6, 15.5, 2.2, 1.6))),
  ],
  spike: [
    part('#4a4a5a', star(10, 10, 9.5, 6, 8)),
    part('#5a5a6c', el(10, 10, 6, 6)),
    part('#ff6a3a', rr(9, 1, 2, 3, 1), { flat: true }),
  ],
  shield: [
    part('#3a6ad0', poly([[3, 3], [17, 3], [17, 10], [10, 18], [3, 10]])),
    part('#ffd83a', all(rr(9, 4, 2.4, 12, 1), rr(4, 8, 12, 2.4, 1))),
  ],
  potion: [
    part('#a87a4a', rr(8, 1, 4, 3, 1)),
    part('#dce8f0', rr(8.5, 3.5, 3, 4, 1)),
    part('#e84a8a', el(10, 13, 6.5, 6)),
    part('#ffffff', el(7.5, 11, 1.4, 1.8), { flat: true }),
  ],
  comet: [
    part('#7ac8ff', poly([[2, 18], [9, 8], [13, 11]]), { light: false }),
    part('#ffe066', poly([[4, 18], [10, 10], [12, 12]]), { light: false }),
    part('#fff6c8', el(13, 7, 5, 5)),
  ],
  lock: [
    part('#a8b0bc', arc(10, 8, 4.5, Math.PI, 0, 2.6)),
    part('#ffcc3a', rr(4, 8, 12, 10, 2)),
    part('#5a3a10', all(el(10, 12, 1.6, 1.6), rr(9.3, 12, 1.4, 3, 0.5)), { flat: true }),
  ],
  backpack: [
    part('#8a5a32', rr(3, 4, 14, 15, 4)),
    part('#a8703c', rr(4, 4, 12, 7, 3)),
    part('#ffd83a', rr(9, 9, 2.4, 3, 0.6), { flat: true }),
    part('#6a4024', arc(10, 4, 3, Math.PI, 0, 1.6)),
  ],
  mail: [
    part('#fff6e4', rr(2, 5, 16, 11, 1.5)),
    part('#e8dcc4', poly([[2.5, 5.5], [10, 11.5], [17.5, 5.5]])),
    part('#d6302a', el(10, 11, 2.2, 2.2)),
  ],
  trophy: [
    part('#ffd03a', all(arc(4.5, 7, 2.6, 0.5 * Math.PI, 1.5 * Math.PI, 1.8), arc(15.5, 7, 2.6, -0.5 * Math.PI, 0.5 * Math.PI, 1.8))),
    part('#ffd03a', poly([[4, 3], [16, 3], [15, 9], [12, 12], [8, 12], [5, 9]])),
    part('#d09a2a', all(rr(8.8, 11, 2.4, 4, 0.5), rr(6, 15, 8, 3, 1))),
    part('#8a5a32', rr(5, 17, 10, 2.5, 1)),
  ],
  friends: [
    part('#5aa0e8', all(el(6.5, 16, 5, 5))),
    part('#f6c79a', el(6.5, 7.5, 3.5, 3.5)),
    part('#4cc23a', el(13.5, 16, 5, 5)),
    part('#f6c79a', el(13.5, 7.5, 3.5, 3.5)),
  ],
  exit: [
    part('#fff6e4', all(rr(3, 3, 3, 14, 1), rr(3, 3, 8, 3, 1), rr(3, 14, 8, 3, 1))),
    part('#fff6e4', all(line(8, 10, 15, 10, 3), poly([[13, 5.5], [18.5, 10], [13, 14.5]]))),
  ],
  swords: [
    part('#d8e0e8', all(line(3, 3, 15, 15, 2.6), line(17, 3, 5, 15, 2.6))),
    part('#ffd03a', all(line(12, 16, 16, 12, 2), line(8, 16, 4, 12, 2))),
    part('#8a5a32', all(line(15, 15, 18, 18, 2.4), line(5, 15, 2, 18, 2.4))),
  ],
};

const cache = new Map();

export function drawIcon(g, name, x, y, k = 1) {
  const key = `${name}|${k}`;
  let c = cache.get(key);
  if (!c) {
    const def = DEFS[name];
    if (!def) return false;
    c = render(def, 20, 20, k, name === 'crystal' || name === 'potion' ? (px, dot) => dot(8, 4, '#ffffff') : null);
    cache.set(key, c);
  }
  g.drawImage(c, Math.round(x), Math.round(y));
  return true;
}
