// Peças de pixel art desenhadas por código: degradê pontilhado, fontes, ícones.

// ---------------------------------------------------------------- básicos

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// Degradê vertical com pontilhado ordenado, como nos jogos de 16 bits.
const ditherCache = new Map();
export function dither(g, x, y, w, h, colors) {
  const key = `${w}x${h}|${colors.join()}`;
  let c = ditherCache.get(key);
  if (!c) { [c] = mk(w, h); ditherFill(c.getContext('2d'), w, h, colors); ditherCache.set(key, c); }
  g.drawImage(c, x, y);
}

export function ditherFill(g, w, h, colors) {
  const img = g.createImageData(w, h);
  const cols = colors.map(hex);
  for (let py = 0; py < h; py++) {
    const t = (py / Math.max(1, h - 1)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(t));
    const f = t - i;
    for (let px = 0; px < w; px++) {
      const c = f > BAYER[(py & 3) * 4 + (px & 3)] ? cols[i + 1] : cols[i];
      const o = (py * w + px) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

export function drawMap(g, rows, pal, x, y) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
    }
  }
}

export function ellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

export const PAL = {
  k: '#24150e', ink: '#3a2414',
  woodLL: '#e0a45c', woodL: '#c98a46', wood: '#a5652f', woodD: '#7a4520', woodDD: '#4e2a12',
  cream: '#f6e7c6', creamD: '#e4cc9c', creamDD: '#c9a874',
  head: '#5b3520', headL: '#7a4a2c', headText: '#fbecc9',
  gold: '#ffd84a', goldD: '#d18e1e', goldDD: '#7a4a0c',
  slotDark: '#3a2a22', slotDark2: '#4c382c', slotLine: '#614634',
  blue: '#2b5fae', blueD: '#1b3a74', blueL: '#5f95e0', navy: '#16264e',
  red: '#d23a2e', redD: '#8a1e18', green: '#55b83a', greenD: '#2f7a22', greenL: '#8de05a',
  orange: '#ee8a2a', orangeD: '#b45a14',
  stone: '#8b8f98', stoneD: '#5f636c', stoneL: '#b4b8c0',
  white: '#fff8e8', gray: '#8a7a6a',
};

// ---------------------------------------------------------------- fontes

export const F5 = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.|.|.|.|.|.|#', ',': '..|..|..|..|..|.#|#.', ':': '.|.|#|.|.|#|.', '!': '#|#|#|#|#|.|#',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', '-': '....|....|....|####|....|....|....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....', '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', "'": '#|#|.|.|.|.|.',
  '>': '#...|.#..|..#.|...#|..#.|.#..|#...', '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  '_': '.....|.....|.....|.....|.....|.....|#####', '[': '##|#.|#.|#.|#.|#.|##', ']': '##|.#|.#|.#|.#|.#|##',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.', '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  a: '....|....|.###|...#|.###|#..#|.###', b: '#...|#...|###.|#..#|#..#|#..#|###.', c: '....|....|.###|#...|#...|#...|.###',
  d: '...#|...#|.###|#..#|#..#|#..#|.###', e: '....|....|.##.|#..#|####|#...|.###', f: '..##|.#..|###.|.#..|.#..|.#..|.#..',
  g: '....|....|.###|#..#|#..#|.###|...#|###.', h: '#...|#...|###.|#..#|#..#|#..#|#..#', i: '#|.|#|#|#|#|#',
  j: '..#|...|..#|..#|..#|..#|#.#|.#.', k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '#.|#.|#.|#.|#.|#.|.#',
  m: '.....|.....|####.|#.#.#|#.#.#|#.#.#|#.#.#', n: '....|....|###.|#..#|#..#|#..#|#..#', o: '....|....|.##.|#..#|#..#|#..#|.##.',
  p: '....|....|###.|#..#|#..#|###.|#...|#...', q: '....|....|.###|#..#|#..#|.###|...#|...#', r: '...|...|#.#|##.|#..|#..|#..',
  s: '....|....|.###|#...|.##.|...#|###.', t: '.#.|.#.|###|.#.|.#.|.#.|..#', u: '....|....|#..#|#..#|#..#|#..#|.###',
  v: '...|...|#.#|#.#|#.#|#.#|.#.', w: '.....|.....|#...#|#.#.#|#.#.#|#.#.#|.#.#.', x: '...|...|#.#|#.#|.#.|#.#|#.#',
  y: '....|....|#..#|#..#|#..#|.###|...#|###.', z: '....|....|####|..#.|.#..|#...|####',
  'í': '.#|#.|.#|.#|.#|.#|.#', ';': '..|..|.#|..|..|.#|#.',
};

export const F3 = {
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###', F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.', K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###',
  M: '#...#|##.##|#.#.#|#...#|#...#', N: '#..#|##.#|#.##|#..#|#..#', O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..', Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.', U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#...#|#...#|#.#.#|##.##|#...#',
  X: '#.#|#.#|.#.|#.#|#.#', Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###',
  0: '###|#.#|#.#|#.#|###', 1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.',
  4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|###|#.#|###', 7: '###|..#|.#.|.#.|.#.',
  8: '###|#.#|###|#.#|###', 9: '###|#.#|###|..#|##.',
  '.': '.|.|.|.|#', ',': '.|.|.|#|#', '!': '#|#|#|.|#', '?': '##.|..#|.#.|...|.#.', ':': '.|#|.|#|.',
  '-': '...|...|###|...|...', '+': '...|.#.|###|.#.|...', '/': '..#|..#|.#.|#..|#..', '(': '.#|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|#.', "'": '#|#|.|.|.', '%': '#.#|..#|.#.|#..|#.#', '>': '#..|.#.|..#|.#.|#..',
  '<': '..#|.#.|#..|.#.|..#', '_': '...|...|...|...|###', '[': '##|#.|#.|#.|##', ']': '##|.#|.#|.#|##',
  '#': '#.#|###|#.#|###|#.#', '*': '#.#|.#.|#.#|...|...', '@': '###|#.#|#.#|#..|###',
};

const ACC = {
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'],
  'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'], 'Ç': ['C', 'ced'],
  'á': ['a', 'lacute'], 'à': ['a', 'lgrave'], 'â': ['a', 'lcirc'], 'ã': ['a', 'ltilde'], 'é': ['e', 'lacute'],
  'ê': ['e', 'lcirc'], 'ó': ['o', 'lacute'], 'ô': ['o', 'lcirc'], 'õ': ['o', 'ltilde'], 'ú': ['u', 'lacute'], 'ç': ['c', 'lced'],
};
const MARK = {
  5: { acute: [[3, -2], [2, -1]], grave: [[1, -2], [2, -1]], circ: [[2, -2], [1, -1], [3, -1]],
    tilde: [[1, -2], [2, -2], [4, -2], [0, -1], [2, -1], [3, -1]], ced: [[2, 7], [1, 8], [2, 8]],
    lacute: [[2, 0], [1, 1]], lgrave: [[1, 0], [2, 1]], lcirc: [[1, 0], [0, 1], [2, 1]],
    ltilde: [[1, 0], [3, 0], [0, 1], [2, 1]], lced: [[1, 7], [2, 7]] },
  3: { acute: [[2, -2], [1, -1]], grave: [[0, -2], [1, -1]], circ: [[1, -2], [0, -1], [2, -1]],
    tilde: [[0, -2], [1, -2], [1, -1], [2, -1]], ced: [[1, 5]] },
};

const textCache = new Map();

// Desenha o texto num canvas próprio (com contorno e sombra opcionais) e guarda.
export function textImg(str, o) {
  const font = o.font || 5;
  const key = `${font}|${o.color}|${o.color2}|${o.outline}|${o.shadow}|${str}`;
  let hit = textCache.get(key);
  if (hit) return hit;
  const F = font === 5 ? F5 : F3, gh = font === 5 ? 7 : 5;
  const on = new Set(), pts = [];
  let x = 0;
  for (const raw of font === 3 ? str.toUpperCase() : str) {
    if (raw === ' ') { x += font === 5 ? 4 : 3; continue; }
    let ch = raw, mark = null;
    if (ACC[raw] && !F[raw]) [ch, mark] = ACC[raw];
    let g = F[ch];
    if (!g && font === 5) g = F5[ch.toUpperCase()];
    if (!g) { x += font === 5 ? 4 : 3; continue; }
    const rows = g.split('|');
    rows.forEach((r, ry) => { for (let rx = 0; rx < r.length; rx++) if (r[rx] === '#') pts.push([x + rx, ry]); });
    if (mark) for (const [mx, my] of MARK[font][mark]) pts.push([x + mx, my]);
    x += rows[0].length + 1;
  }
  const w = Math.max(1, x - 1);
  const ox = 1, oy = 3;
  const cw = w + 2, ch = gh + 7;
  for (const [px, py] of pts) on.add(`${px + ox},${py + oy}`);
  const [c, g] = mk(cw, ch);
  const paint = (set, color, dy = 0) => {
    g.fillStyle = color;
    for (const s of set) { const [px, py] = s.split(',').map(Number); g.fillRect(px, py + dy, 1, 1); }
  };
  let outline = new Set();
  if (o.outline) {
    for (const s of on) {
      const [px, py] = s.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = `${px + dx},${py + dy}`;
        if (!on.has(k)) outline.add(k);
      }
    }
  }
  if (o.shadow) paint(new Set([...on, ...outline]), o.shadow, 1);
  if (o.outline) paint(outline, o.outline);
  if (o.color2) {
    for (const s of on) {
      const [px, py] = s.split(',').map(Number);
      g.fillStyle = py - oy >= Math.ceil(gh / 2) ? o.color2 : o.color;
      g.fillRect(px, py, 1, 1);
    }
  } else paint(on, o.color);
  hit = { c, w, ox, oy };
  textCache.set(key, hit);
  return hit;
}

export function text(g, str, x, y, o = {}) {
  o = { color: PAL.ink, ...o };
  const t = textImg(str, o);
  const s = o.scale || 1;
  let dx = x;
  if (o.align === 'center') dx = Math.round(x - (t.w * s) / 2);
  else if (o.align === 'right') dx = x - t.w * s;
  g.drawImage(t.c, dx - t.ox * s, y - t.oy * s, t.c.width * s, t.c.height * s);
  return t.w * s;
}

export function measure(str, font = 5) { return textImg(str, { font, color: '#000' }).w; }

export function wrap(str, maxW, font = 3) {
  const out = [];
  let line = '';
  for (const word of str.split(' ')) {
    const tryL = line ? `${line} ${word}` : word;
    if (measure(tryL, font) > maxW && line) { out.push(line); line = word; } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}

// ---------------------------------------------------------------- ícones

export const IP = {
  k: '#24150e', W: '#fff7e0', R: '#d63a2c', r: '#8e1f18', O: '#f08a24', Y: '#f6c83a', y: '#c28a1e',
  G: '#c4ccd4', g: '#6e7884', C: '#8fe0ff', c: '#3a8ac8', B: '#8a5a32', b: '#5a3418', P: '#e04a8a',
  p: '#9a2a5a', D: '#3a3a4a', S: '#f7c99b', M: '#a46ae0', m: '#5e3290', N: '#4a7ad8', n: '#2a4a98', L: '#7cd05a',
};

export const ICONS = {
  explosion: ['..R...R...', '...ROOR.R.', '.RROYYOR..', '..OYYYYOR.', 'ROYYWWYYOR', '.OYYWWYYO.', '..OYYYYOR.', '.RROYYORR.', '..R.OOR...', '....R....R'],
  target: ['...kkkk...', '.kkRRRRkk.', '.kRWWWWRk.', 'kRWRRRRWRk', 'kRWRWWRWRk', 'kRWRWWRWRk', 'kRWRRRRWRk', '.kRWWWWRk.', '.kkRRRRkk.', '...kkkk...'],
  dummy: ['...kkkk...', '..kYYYYk..', '..kYkYkk..', '..kYYYYk..', 'kkkkYYkkkk', 'kYYYYYYYYk', 'kkkYYYYkkk', '..kYyyYk..', '..kYkkYk..', '..kk..kk..'],
  dummyP: ['...kkkk...', '..kMMMMk..', '..kMWMWk..', '..kMMMMk..', 'kkkkMMkkkk', 'kMMMMMMMMk', 'kkkMMMMkkk', '..kMmmMk..', '..kMkkMk..', '..kk..kk..'],
  heal: ['...kkkk...', '...kLLk...', '...kLLk...', 'kkkkLLkkkk', 'kLLLWLLLLk', 'kLLLLLLLLk', 'kkkkLLkkkk', '...kLLk...', '...kLLk...', '...kkkk...'],
  rocket: ['......kkk.', '.....kWWk.', '....kWRWk.', '...kWWWk..', '..kWWWk...', '.kRkWk....', 'kRRkk.....', 'kOYk......', '.kk.......', 'YO........'],
  fire: ['....k.....', '...kRk....', '...kRRk...', '..kRORk.k.', '.kRROORkRk', '.kROOYORRk', 'kROYYYYORk', 'kROYWWYORk', '.kROYYORk.', '..kkkkkk..'],
  crystal: ['....kk....', '...kCWk...', '..kCCWCk..', '.kCCCWCCk.', 'kCCCCWCCck', 'kcCCCWCCck', '.kcCCCCck.', '..kcCCck..', '...kcck...', '....kk....'],
  banana: ['........kk', '.......kBk', '......kYk.', '.....kYYk.', '....kYYYk.', '...kYYYk..', 'kkkYYYyk..', 'kYYYYyk...', '.kyyyk....', '..kkk.....'],
  spike: ['....k.....', '.k..k..k..', '..kkkkkk..', '..kDDDDk..', 'kkkDWDDkkk', '..kDDDDk..', '..kDDDDk..', '..kkkkkk..', '.k..k..k..', '....k.....'],
  shield: ['kkkkkkkkkk', 'kNNNNYNNNk', 'kNWNNYNNnk', 'kNNNNYNNnk', 'kYYYYYYYYk', 'kNNNNYNNnk', '.kNNNYNnk.', '.knNNYNnk.', '..knnYnk..', '...kkkk...'],
  potion: ['...kkkk...', '...kBBk...', '....kk....', '...kCCk...', '..kCWCCk..', '.kPPPPPPk.', 'kPWPPPPPpk', 'kPPPPPPPpk', '.kpPPPPpk.', '..kkkkkk..'],
  comet: ['......kkk.', '.....kYYYk', '...O.kYWYk', '..OO.kYYYk', '.OOYO.kkk.', 'OOY.O.....', 'OY..O.....', 'Y.........'],
  lock: ['...kkkk...', '..kGkkGk..', '..kG..Gk..', '..kG..Gk..', '.kkkkkkkk.', '.kYYYYYYk.', '.kYYkkYYk.', '.kYYkkYYk.', '.kyYYYYyk.', '.kkkkkkkk.'],
  backpack: ['...kkkk...', '..kb..bk..', '.kkkkkkkk.', 'kBBBBBBBBk', 'kBbbbbbbBk', 'kBbYYYYbBk', 'kBbbYYbbBk', 'kBBBBBBBBk', 'kbBBBBBBbk', '.kkkkkkkk.'],
  mail: ['kkkkkkkkkk', 'kWkWWWWkWk', 'kWWkWWkWWk', 'kWWWkkWWWk', 'kWWWWWWWWk', 'kWWWWWWWWk', 'kkkkkkkkkk'],
  trophy: ['kkkkkkkkkk', 'YkYYWYYYkY', 'YkYWYYYYkY', '.kYYYYYYk.', '..kYYYYk..', '...kYYk...', '....kk....', '...kYyk...', '..kkkkkk..', '..kBBBBk..', '..kkkkkk..'],
  swords: ['k........k', 'kGk....kGk', '.kGk..kGk.', '..kGkkGk..', '...kGGk...', '...kGGk...', '..kGkkGk..', 'BkBk..kBkB', '.BB....BB.', 'B........B'],
  crown: ['k...k...k', 'kYk.kYk.k', 'kYYkYkYYk', 'kYRYYYRYk', 'kyyyyyyyk', 'kkkkkkkkk'],
  scroll: ['.kkkkkkkk.', 'kYyyyyyyYk', '.kWWWWWWk.', '.kWkkkkWk.', '.kWWWWWWk.', '.kWkkkWWk.', '.kWWWWWWk.', 'kYyyyyyyYk', '.kkkkkkkk.'],
  pencil: ['.......kk', '......kRk', '.....kYk.', '....kYk..', '...kYk...', '..kYk....', '.kWk.....', 'kkk......'],
  friends: ['.kkk..kkk.', 'kSSSkkSSSk', 'kSSSkkSSSk', '.kkk..kkk.', 'kNNNkkLLLk', 'kNNNNkLLLk', 'kNNNNkLLLk', 'kkkkkkkkkk'],
  exit: ['kkkkkk....', 'kWWWWk....', 'kW...k.k..', 'kW...kkWk.', 'kW.WWWWWWk', 'kW...kkWk.', 'kW...k.k..', 'kWWWWk....', 'kkkkkk....'],
  send: ['k.......', 'kWk.....', 'kWWk....', 'kWWWk...', 'kWWWWk..', 'kWWWk...', 'kWWk....', 'kWk.....', 'k.......'],
  rank: ['.kkkkkkk.', 'kNNNNNNNk', 'kNYNNNYNk', 'kNNYNYNNk', 'kNNNYNNNk', '.kNNNNNk.', '..kNNNk..', '...kkk...'],
};

export function icon(g, name, x, y, s = 1, pal = IP) {
  const rows = ICONS[name];
  if (s === 1) { drawMap(g, rows, pal, x, y); return; }
  const key = `icon:${name}`;
  let c = textCache.get(key);
  if (!c) { [c] = mk(12, 12); drawMap(c.getContext('2d'), rows, pal, 0, 0); textCache.set(key, c); }
  g.drawImage(c, x, y, 12 * s, 12 * s);
}

export function gear(g, cx, cy, r, color, dark) {
  for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x);
    const tooth = Math.cos(a * 8) > 0.3 ? 2 : 0;
    if (d <= r + tooth && d > r * 0.38) {
      g.fillStyle = d > r - 1 + tooth || x + y > r ? dark : color;
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

