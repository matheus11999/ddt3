// Heróis fixos, cada um com a sua arma. O corpo é montado com formas simples
// (elipses, polígonos, traços), cada forma vira pixel duro e o código pinta a
// sombra embaixo e à direita, o brilho no alto e o contorno escuro em volta,
// como numa pixel art feita à mão. Rosto (olhos, boca) é pintado pixel a pixel.

import { ellipse, R } from './pixel.js';
import { mix, el, poly, rr, line, all, clip, part, render } from './shapes.js';

const SW = 72, SH = 86; // tamanho do herói na escala 1 (pés em y = 82)

const SKIN = '#f6c79a';

// ---- rosto padrão
function face(px, o) {
  const { blink, iris = '#4a2c1a', brow = '#3a1e10', y = 30, mouth = 'smile', lash = false } = o;
  for (const ex of [26, 40]) {
    if (blink) {
      px(ex, y + 4, 6, 1, '#2a1610');
      px(ex, y + 3, 1, 1, '#2a1610'); px(ex + 5, y + 3, 1, 1, '#2a1610');
    } else {
      px(ex, y, 6, 8, '#24140e');
      px(ex + 1, y + 1, 4, 6, iris);
      px(ex + 1, y + 5, 4, 2, mix(iris, '#ffffff', 0.3));
      px(ex + 1, y + 1, 2, 2, '#ffffff');
      px(ex + 4, y + 5, 1, 1, '#ffffff');
      if (lash) { px(ex - 1, y, 1, 1, '#24140e'); px(ex + 6, y, 1, 1, '#24140e'); }
    }
    px(ex, y - 3, 6, 1, brow);
  }
  px(23, y + 8, 3, 1, '#f39a8c'); px(46, y + 8, 3, 1, '#f39a8c');
  px(35, y + 8, 1, 1, '#d99068');
  if (mouth === 'smile') { px(33, y + 10, 1, 1, '#6a2a1a'); px(34, y + 11, 4, 1, '#6a2a1a'); px(38, y + 10, 1, 1, '#6a2a1a'); }
  else if (mouth === 'grin') { px(33, y + 10, 6, 2, '#6a2a1a'); px(34, y + 10, 4, 1, '#ffffff'); }
  else if (mouth === 'open') { px(34, y + 10, 4, 3, '#6a2a1a'); px(35, y + 11, 2, 1, '#e86a6a'); }
  else px(34, y + 10, 4, 1, '#6a2a1a');
}

// mechas de brilho no cabelo
function shine(px, pts, col) {
  for (const [x, y] of pts) { px(x, y, 2, 1, col); px(x + 2, y + 1, 1, 1, col); }
}

// ---- partes comuns do corpo
function body(o) {
  const { shirt, pants, shoes, legs = pants, arms = 'down', sleeve = shirt, skin = SKIN, skirt, coat } = o;
  const p = [];
  // pernas e sapatos
  p.push(part(legs, all(rr(28, 66, 7, 12, 2), rr(37, 66, 7, 12, 2))));
  p.push(part(shoes, all(el(31, 79, 5.5, 3.2), el(41, 79, 5.5, 3.2))));
  // calça/bermuda ou saia
  if (skirt) p.push(part(skirt, poly([[25, 60], [47, 60], [52, 73], [20, 73]])));
  else p.push(part(pants, rr(26, 61, 20, 9, 3)));
  if (coat) p.push(part(coat, poly([[24, 50], [48, 50], [50, 72], [40, 70], [36, 64], [32, 70], [22, 72]])));
  // tronco
  p.push(part(shirt, rr(25, 48, 22, 16, 6)));
  // braços: manga + antebraço + mão
  const arm = (sx, sy, ex, ey) => {
    const mx = sx + (ex - sx) * 0.45, my = sy + (ey - sy) * 0.45;
    p.push(part(sleeve, line(sx, sy, mx, my, 7)));
    p.push(part(skin, line(mx, my, ex, ey, 5)));
    p.push(part(skin, el(ex, ey + 1, 3.6, 3.6)));
  };
  if (arms === 'down') { arm(25, 52, 21, 64); arm(47, 52, 51, 64); }
  else if (arms === 'hold') { arm(26, 52, 31, 61); arm(46, 52, 46, 61); }
  else if (arms === 'staff') { arm(25, 52, 21, 64); arm(47, 52, 53, 58); }
  else if (arms === 'shoulder') { arm(25, 52, 21, 64); arm(47, 52, 50, 46); }
  return p;
}

function head(skin = SKIN) {
  return [
    part(skin, all(el(18.5, 33, 3, 4), el(53.5, 33, 3, 4))),
    part(skin, el(36, 31, 17, 16)),
  ];
}

// cabelo espetado: tampa + espetos + franja
function spikyHair(color, o = {}) {
  const len = o.len ?? 1;
  const spikes = [[-175, 8], [-150, 11], [-125, 10], [-100, 12], [-75, 11], [-50, 12], [-25, 10], [0, 7]];
  const shapes = [clip(0, 0, SW, 27, el(36, 26, 19.5, 15))];
  for (const [a, l] of spikes) {
    const r = (a * Math.PI) / 180, px = -Math.sin(r), py = Math.cos(r);
    const bx = 36 + Math.cos(r) * 13, by = 24 + Math.sin(r) * 10;
    const tx = 36 + Math.cos(r) * (13 + l * len), ty = 24 + Math.sin(r) * (10 + l * len) - 2;
    shapes.push(poly([[bx + px * 5, by + py * 5], [tx, ty], [bx - px * 5, by - py * 5]]));
  }
  shapes.push(poly([[18, 22], [21, 33], [25, 25], [28, 30], [31, 24], [35, 29], [38, 23], [42, 29], [45, 24], [48, 31], [51, 24], [54, 22], [36, 14]]));
  shapes.push(poly([[17, 24], [18, 38], [22, 28]]), poly([[55, 24], [54, 38], [50, 28]]));
  return part(color, all(...shapes));
}

// ---- armas
const W = {
  sack: () => [
    part('#c8a46a', all(el(13, 72, 10, 10), poly([[8, 64], [18, 64], [16, 58], [10, 58]]))),
    part('#e2503a', all(el(10, 58, 4.5, 4.5), el(17, 57, 4.5, 4.5))),
    part('#8a5a2a', rr(8, 62, 11, 2.5, 1), { line: false }),
  ],
  bazooka: () => [
    part('#c97a3a', g => { g.save(); g.translate(44, 44); g.rotate(-0.32); g.beginPath(); g.roundRect(-24, -5, 46, 10, 3); g.fill(); g.restore(); }),
    part('#5a3a28', g => { g.save(); g.translate(44, 44); g.rotate(-0.32); g.fillRect(19, -6.5, 6, 13); g.fillRect(-26, -6, 4, 12); g.fillRect(-6, 4, 5, 8); g.restore(); }),
  ],
  cannon: () => [
    part('#c9963a', rr(30, 52, 34, 11, 4)),
    part('#7a5a2a', all(rr(62, 50, 6, 15, 2), rr(38, 51, 3, 13, 1), rr(48, 51, 3, 13, 1))),
    part('#3a2a20', el(66, 57.5, 2, 4), { flat: true }),
  ],
  staff: () => [
    part('#8a5a32', line(56, 30, 52, 82, 3.2)),
    part('#ffc83a', poly([[50, 30], [62, 28], [60, 33], [52, 34]])),
    part('#b86aff', poly([[56, 14], [61, 22], [56, 30], [51, 22]])),
  ],
  slingshot: () => [
    part('#9a6a3a', all(line(52, 66, 52, 56, 3), line(52, 57, 48, 49, 3), line(52, 57, 57, 49, 3))),
  ],
  anchor: () => [
    part('#9aa4b0', all(line(56, 44, 56, 78, 3.4), line(51, 50, 61, 50, 3), g => { g.lineWidth = 3.4; g.beginPath(); g.arc(56, 70, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); })),
    part('#9aa4b0', g => { g.lineWidth = 2.6; g.beginPath(); g.arc(56, 41, 3, 0, Math.PI * 2); g.stroke(); }),
  ],
};

// ---- os seis heróis
export const HEROES = [
  {
    id: 'teco', name: 'Teco', title: 'Garoto da Vila', weapon: 'Saco de Bombas', color: '#e8d6a6',
    stats: [3, 3, 3, 3], skill: 'Bolsa Furada', desc: 'A bomba se abre no ar e solta três bombinhas.',
    parts: () => [...W.sack(), ...body({ shirt: '#f4f0e4', pants: '#a88456', legs: SKIN, shoes: '#7a4a2a' }), ...head(), spikyHair('#7a4422')],
    extra: px => {
      px(32, 48, 8, 1, '#d6ccb4'); px(34, 49, 4, 1, '#d6ccb4');
      px(26, 61, 20, 1, '#6a4a2a'); px(35, 61, 3, 2, '#e0b040'); px(29, 64, 3, 1, '#8a6a40'); px(36, 64, 1, 5, '#8a6a40');
      px(30, 77, 3, 1, '#c89a6a'); px(40, 77, 3, 1, '#c89a6a');
      shine(px, [[26, 15], [32, 11], [41, 12], [47, 16], [21, 22]], '#b0763c');
      px(12, 70, 3, 1, '#a8844a'); px(15, 76, 3, 1, '#a8844a'); px(9, 74, 2, 1, '#a8844a');
      px(8, 56, 2, 1, '#ffa090'); px(15, 55, 2, 1, '#ffa090');
    },
    face: { iris: '#6a3a1a', mouth: 'smile' },
  },
  {
    id: 'brasa', name: 'Brasa', title: 'Fúria Ruiva', weapon: 'Lança-Brasas', color: '#ff8a5a',
    stats: [5, 3, 4, 2], skill: 'Rastro de Fogo', desc: 'O chão atingido queima por dois turnos.',
    parts: () => [
      ...body({ shirt: '#d23a2e', pants: '#3a3440', shoes: '#22202a', arms: 'shoulder', sleeve: '#b22a24' }),
      ...W.bazooka(),
      ...head(), spikyHair('#e85a2a', { len: 1.1 }),
      part('#2a2a3a', all(rr(18, 18, 36, 5, 2), poly([[52, 18], [62, 24], [58, 28], [52, 22]]))),
    ],
    extra: px => {
      px(36, 49, 1, 13, '#f0d8c8'); px(30, 48, 4, 2, '#8a1e18'); px(38, 48, 4, 2, '#8a1e18');
      px(26, 61, 20, 2, '#1e1a20'); px(35, 61, 3, 2, '#c8c8d0'); px(29, 70, 4, 3, '#4c4656'); px(39, 71, 3, 2, '#4c4656');
      shine(px, [[25, 13], [35, 9], [44, 11], [50, 15]], '#ffa060');
      px(24, 20, 1, 1, '#ffffff'); px(31, 19, 1, 1, '#ffffff'); px(41, 19, 1, 1, '#ffffff'); px(48, 20, 1, 1, '#ffffff');
    },
    face: { iris: '#a8321a', mouth: 'grin', brow: '#8a2a10' },
  },
  {
    id: 'tork', name: 'Tork', title: 'Aviador Inventor', weapon: 'Canhão de Cobre', color: '#e0c070',
    stats: [4, 5, 3, 3], skill: 'Bala Guiada', desc: 'O vento afeta só metade do tiro neste turno.',
    parts: () => [
      ...body({ shirt: '#4a6a9a', pants: '#3a3a4a', shoes: '#6a4424', arms: 'hold', sleeve: '#7a5434' }),
      part('#d0302a', all(el(36, 48, 11, 4), poly([[42, 47], [58, 52], [54, 58], [44, 52]]))),
      ...W.cannon(),
      ...head(), spikyHair('#8a5428', { len: 0.7 }),
      part('#5a3418', rr(17, 18, 38, 5, 2)),
      part('#c9963a', all(el(29, 20, 5.2, 5), el(43, 20, 5.2, 5))),
      part('#7fd8ff', all(el(29, 20, 3.2, 3), el(43, 20, 3.2, 3)), { shade: '#3a8ac8' }),
    ],
    extra: px => {
      px(26, 63, 20, 2, '#3a2414'); px(27, 18, 1, 1, '#ffffff'); px(41, 18, 1, 1, '#ffffff');
      px(28, 21, 1, 1, '#dff8ff'); px(42, 21, 1, 1, '#dff8ff');
      px(40, 49, 3, 1, '#ff7a6a'); px(48, 53, 3, 1, '#ff7a6a');
      px(33, 54, 28, 1, '#ffe0a0'); px(64, 52, 1, 10, '#a8804a');
      shine(px, [[27, 14], [38, 12], [46, 15]], '#b07a40');
    },
    face: { iris: '#2a6ab0', mouth: 'smile' },
  },
  {
    id: 'luma', name: 'Luma', title: 'Maga Rosada', weapon: 'Cajado Mágico', color: '#ff9ad4',
    stats: [3, 4, 2, 4], skill: 'Estrela Curativa', desc: 'Cura os aliados perto de onde a magia cai.',
    parts: () => [
      part('#e8407a', all(el(12, 46, 7, 15, 0.25), el(60, 46, 7, 15, -0.25))),
      ...body({ shirt: '#d0304a', pants: '#d0304a', skirt: '#d0304a', legs: SKIN, shoes: '#8a1a3a', arms: 'staff' }),
      ...W.staff(),
      ...head(),
      part('#e8407a', all(clip(0, 0, SW, 28, el(36, 27, 19, 15)), poly([[17, 22], [19, 40], [24, 27], [30, 24], [36, 31], [41, 24], [48, 29], [53, 38], [55, 22], [36, 13]]))),
      part('#ffd84a', all(el(17, 29, 3, 3), el(55, 29, 3, 3), poly([[30, 15], [33, 9], [36, 13], [39, 9], [42, 15]]))),
    ],
    extra: (px, dot) => {
      px(21, 71, 30, 1, '#ff9ab8'); px(26, 60, 20, 2, '#ffd84a'); px(35, 60, 2, 2, '#ffffff');
      px(23, 51, 4, 2, '#e85a74'); px(45, 51, 4, 2, '#e85a74');
      px(30, 64, 1, 6, '#b0203a'); px(41, 64, 1, 6, '#b0203a');
      shine(px, [[27, 15], [36, 13], [44, 16], [10, 40], [61, 40], [12, 50], [59, 50]], '#ff90c4');
      dot(55, 18, '#ffffff'); dot(56, 19, '#ffffff');
    },
    face: { iris: '#b0307a', mouth: 'smile', lash: true, brow: '#a02a5a' },
  },
  {
    id: 'nimba', name: 'Nimba', title: 'Filha das Nuvens', weapon: 'Funda Celeste', color: '#9ad0ff',
    stats: [2, 4, 2, 4], skill: 'Rajada', desc: 'Atira três pedras leves de uma vez.',
    parts: () => [
      part('#5aa0e8', el(36, 30, 21.5, 21)),
      ...body({ shirt: '#6ab4f0', pants: '#eef2ff', shoes: '#2a4a8a', sleeve: '#5aa0e8' }),
      ...W.slingshot(),
      ...head(),
      part('#f2f6ff', all(clip(0, 0, SW, 26, el(36, 27, 18, 14)), poly([[20, 22], [24, 31], [29, 24], [35, 30], [41, 24], [47, 31], [52, 22], [36, 15]]))),
      part('#5aa0e8', g => { g.beginPath(); g.ellipse(36, 29, 22, 21, 0, 0, Math.PI * 2); g.ellipse(36, 35, 16.5, 16, 0, 0, Math.PI * 2); g.save(); g.clip('evenodd'); g.fillRect(0, 0, SW, 46); g.restore(); }),
      part('#ffffff', all(el(30, 9, 5, 3.5), el(37, 7, 6, 4.5), el(43, 9, 4.5, 3))),
    ],
    extra: px => {
      px(26, 60, 20, 2, '#2a4a8a'); px(35, 53, 3, 3, '#ffe066'); px(36, 52, 1, 5, '#ffe066'); px(34, 54, 5, 1, '#ffe066');
      px(31, 66, 1, 8, '#c8d0e8'); px(40, 66, 1, 8, '#c8d0e8');
      shine(px, [[29, 18], [40, 18], [20, 30], [52, 30]], '#ffffff');
      px(29, 6, 3, 1, '#ffffff');
    },
    face: { iris: '#2a7ac8', mouth: 'open', lash: true, brow: '#9aa8c8' },
  },
  {
    id: 'rufo', name: 'Rufo', title: 'Capitão Sem Mar', weapon: 'Âncora-Canhão', color: '#d0a8a0',
    stats: [4, 2, 5, 5], skill: 'Âncora ao Fundo', desc: 'A âncora cava uma cratera funda e empurra.',
    parts: () => [
      ...body({ shirt: '#e8dcc0', pants: '#e8dcc0', shoes: '#1e1a20', coat: '#7a2030', sleeve: '#7a2030', skin: '#e3ad7c' }),
      part('#f6c83a', all(el(36, 54, 1.6, 1.6), el(36, 59, 1.6, 1.6)), { line: false, flat: true }),
      ...W.anchor(),
      ...head('#e3ad7c'),
      part('#3a2214', all(el(36, 24, 18, 8), poly([[18, 24], [19, 36], [23, 28]]), poly([[54, 24], [53, 36], [49, 28]]))),
      part('#3a2214', poly([[21, 36], [23, 46], [29, 52], [36, 54], [43, 52], [49, 46], [51, 36], [46, 43], [40, 45], [36, 44], [32, 45], [26, 43]])),
      part('#1e2a4a', poly([[12, 22], [20, 8], [36, 3], [52, 8], [60, 22], [36, 17]])),
      part('#f6c83a', poly([[12, 22], [36, 17], [60, 22], [60, 24.5], [36, 19.5], [12, 24.5]])),
      part('#fff7e0', all(el(36, 10, 3.2, 3), line(31, 15, 41, 12, 1.6), line(31, 12, 41, 15, 1.6)), { flat: true }),
    ],
    extra: px => {
      px(30, 49, 2, 11, '#f6c83a'); px(40, 49, 2, 11, '#f6c83a');
      px(26, 62, 20, 2, '#3a2214'); px(34, 62, 4, 2, '#f6c83a');
      for (const [x, y] of [[27, 46], [31, 49], [36, 51], [41, 49], [45, 46], [25, 41], [47, 41]]) px(x, y, 1, 1, '#5a3a24');
      px(31, 42, 4, 1, '#3a2214'); px(37, 42, 4, 1, '#3a2214');
      px(22, 11, 3, 1, '#3a4a7a'); px(26, 8, 4, 1, '#3a4a7a');
    },
    face: { iris: '#2a4a6a', mouth: 'flat', brow: '#2a1a10' },
  },
];

const cache = new Map();

export function heroCanvas(h, k = 1, blink = false) {
  const key = `${h.id}|${k}|${blink}`;
  let c = cache.get(key);
  if (!c) {
    c = render(h.parts(), SW, SH, k, (px, dot) => { face(px, { ...h.face, blink }); h.extra?.(px, dot); });
    cache.set(key, c);
  }
  return c;
}

// Desenha o herói com os pés em (x, y); respira e pisca sozinho.
export function drawHero(g, h, x, y, k, t, o = {}) {
  const phase = o.phase || 0;
  const bob = Math.floor(t * 2 + phase) % 2;
  const blink = (t * 1.3 + phase * 0.37) % 4 < 0.14;
  ellipse(g, Math.round(x), Math.round(y - 1), Math.round(15 * k), Math.max(2, Math.round(2.5 * k)), 'rgba(30,14,6,0.25)');
  const c = heroCanvas(h, k, blink);
  const dx = Math.round(x - 36 * k), dy = Math.round(y - 82 * k) + bob;
  g.save();
  if (o.flip) { g.translate(Math.round(x) * 2, 0); g.scale(-1, 1); }
  g.drawImage(c, dx, dy);
  g.restore();
  if (h.id === 'luma' && Math.floor(t * 4 + phase) % 2) {
    const gx = o.flip ? x - 20 * k : x + 20 * k;
    R(g, Math.round(gx), Math.round(dy + 16 * k), 2, 2, '#ffffff');
  }
}
