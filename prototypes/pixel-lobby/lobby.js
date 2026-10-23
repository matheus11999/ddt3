// Sala de Batalha em pixel art (protótipo). Tudo é desenhado por código:
// nenhuma imagem é carregada. Tela lógica de 480x360 ampliada em escala inteira.

const W = 480, H = 360;
const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
ctx.imageSmoothingEnabled = false;

function fit() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  const s = k >= 1 ? Math.floor(k) : k;
  cv.style.width = `${W * s}px`;
  cv.style.height = `${H * s}px`;
}
addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- básicos

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// Degradê vertical com pontilhado ordenado, como nos jogos de 16 bits.
const ditherCache = new Map();
function dither(g, x, y, w, h, colors) {
  const key = `${w}x${h}|${colors.join()}`;
  let c = ditherCache.get(key);
  if (!c) { [c] = mk(w, h); ditherFill(c.getContext('2d'), w, h, colors); ditherCache.set(key, c); }
  g.drawImage(c, x, y);
}

function ditherFill(g, w, h, colors) {
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

function drawMap(g, rows, pal, x, y) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (col) { g.fillStyle = col; g.fillRect(x + c, y + r, 1, 1); }
    }
  }
}

function ellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

const PAL = {
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

const F5 = {
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
};

const F3 = {
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
};
const MARK = {
  5: { acute: [[3, -2], [2, -1]], grave: [[1, -2], [2, -1]], circ: [[2, -2], [1, -1], [3, -1]],
    tilde: [[1, -2], [2, -2], [4, -2], [0, -1], [2, -1], [3, -1]], ced: [[2, 7], [1, 8], [2, 8]] },
  3: { acute: [[2, -2], [1, -1]], grave: [[0, -2], [1, -1]], circ: [[1, -2], [0, -1], [2, -1]],
    tilde: [[0, -2], [1, -2], [1, -1], [2, -1]], ced: [[1, 5]] },
};

const textCache = new Map();

// Desenha o texto num canvas próprio (com contorno e sombra opcionais) e guarda.
function textImg(str, o) {
  const font = o.font || 5;
  const key = `${font}|${o.color}|${o.color2}|${o.outline}|${o.shadow}|${str}`;
  let hit = textCache.get(key);
  if (hit) return hit;
  const F = font === 5 ? F5 : F3, gh = font === 5 ? 7 : 5;
  const on = new Set(), pts = [];
  let x = 0;
  for (const raw of str.toUpperCase()) {
    if (raw === ' ') { x += font === 5 ? 4 : 3; continue; }
    let ch = raw, mark = null;
    if (ACC[raw]) [ch, mark] = ACC[raw];
    const g = F[ch];
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

function text(g, str, x, y, o = {}) {
  o = { color: PAL.ink, ...o };
  const t = textImg(str, o);
  const s = o.scale || 1;
  let dx = x;
  if (o.align === 'center') dx = Math.round(x - (t.w * s) / 2);
  else if (o.align === 'right') dx = x - t.w * s;
  g.drawImage(t.c, dx - t.ox * s, y - t.oy * s, t.c.width * s, t.c.height * s);
  return t.w * s;
}

function measure(str, font = 5) { return textImg(str, { font, color: '#000' }).w; }

function wrap(str, maxW, font = 3) {
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

const IP = {
  k: '#24150e', W: '#fff7e0', R: '#d63a2c', r: '#8e1f18', O: '#f08a24', Y: '#f6c83a', y: '#c28a1e',
  G: '#c4ccd4', g: '#6e7884', C: '#8fe0ff', c: '#3a8ac8', B: '#8a5a32', b: '#5a3418', P: '#e04a8a',
  p: '#9a2a5a', D: '#3a3a4a', S: '#f7c99b', M: '#a46ae0', m: '#5e3290', N: '#4a7ad8', n: '#2a4a98', L: '#7cd05a',
};

const ICONS = {
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

function icon(g, name, x, y, s = 1, pal = IP) {
  const rows = ICONS[name];
  if (s === 1) { drawMap(g, rows, pal, x, y); return; }
  const key = `icon:${name}`;
  let c = textCache.get(key);
  if (!c) { [c] = mk(12, 12); drawMap(c.getContext('2d'), rows, pal, 0, 0); textCache.set(key, c); }
  g.drawImage(c, x, y, 12 * s, 12 * s);
}

function gear(g, cx, cy, r, color, dark) {
  for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x);
    const tooth = Math.cos(a * 8) > 0.3 ? 2 : 0;
    if (d <= r + tooth && d > r * 0.38) {
      g.fillStyle = d > r - 1 + tooth || x + y > r ? dark : color;
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- heróis

const BODY = [
  '....................', '....................', '......kkkkkkkk......', '....kkSSSSSSSSkk....',
  '...kSSSSSSSSSSSSk...', '..kSSSSSSSSSSSSSSk..', '..kSSSSSSSSSSSSSSk..', '..kSSSSSSSSSSSSSSk..',
  '..kSSSkwSSSSkwSSSk..', '..kSSSkkSSSSkkSSSk..', '..kSrrSSSSSSSSrrSk..', '...kSSSSSkkSSSSSk...',
  '....kksSSSSSSskk....', '......kkkkkkkk......', '.....kOOOOOOOOk.....', '....kOOOOOOOOOOk....',
  '...kSkOOOOOOOOkSk...', '...kskoOOOOOOoksk...', '....kkPPPPPPPPkk....', '.....kPPPkkPPPk.....',
  '.....kLLk..kLLk.....', '.....kbbk..kbbk.....', '....kbbbk..kbbbk....', '....kkkkk..kkkkk....',
];

const SPIKY = [
  '....k..k...k..k.....', '...kHk.kHkkHk.kHk...', '..kHHHkHHHHHHkHHHk..', '.kHHHHHHHHHHHHHHHHk.',
  '.kHHHHHHHHHHHHHHHHk.', '.kHHHHhHHHHHHhHHHHk.', '.kHH.HH..HH..HH.HHk.', '.kH..H........H..Hk.',
  '..k..............k..',
];
const BANDANA = [...SPIKY];
BANDANA[4] = '.kAAAAAAAAAAAAAAAAkA';
BANDANA[5] = '.kaAAAAWAAAAWAAAAakA';
BANDANA[6] = '.kHH.HH..HH..HH.HHkk';

const GOGGLES = [
  '....................', '.....k.kkkk.k.......', '....kHkHHHHkHkk.....', '...kHHHHHHHHHHHk....',
  '..kAAAAAAAAAAAAAAk..', '..kAkGGkAAAAkGGkAk..', '..kHkGgkHHHHkGgkHk..', '..kH.kk......kk.Hk..',
];
const TWINTAILS = [
  '....................', '......kkkkkkkk......', '....kkHHHHHHHHkk....', '...kHHHHHHHHHHHHk...',
  '..kHHHHHHHHHHHHHHk..', '.kAkHHHhHHHHhHHHkAk.', 'kHHkHH.hH..Hh.HHkHHk', 'kHHk.H........H.kHHk',
  'kHHk............kHHk', 'kHHk............kHHk', 'kHhk............khHk', '.kHk............kHk.',
  '.khk............khk.', '..k..............k..',
];
const HOOD = [
  '......kkkkkkkk......', '....kkAAAAAAAAkk....', '...kAAAAAAAAAAAAk...', '..kAAAAAAAAAAAAAAk..',
  '.kAAAHHHHHHHHHHAAAk.', '.kAAHHHHhHHhHHHHAAk.', '.kAAH..........HAAk.', '.kAAH..........HAAk.',
  '.kAA............AAk.', '.kAA............AAk.', '.kaA............Aak.', '..ka............ak..',
  '..kk............kk..',
];
const PIRATE = [
  '......kkkkkkkk......', '....kkAAAAAAAAkk....', '..kkAAAAAWWAAAAAkk..', '.kAAAAAAWAAWAAAAAAk.',
  'kAAAAAAAAWWAAAAAAAAk', 'kYYYYYYYYYYYYYYYYYYk', '.kkkkkkkkkkkkkkkkkk.', '..kHH..........HHk..',
  '..kH............Hk..', '', '', '', '', '', '',
  '...kHHHHHkkHHHHHk...', '....kkHHHHHHHHkk....', '......kHHHHHHk......', '.......kkkkkk.......',
];

const WEAPONS = {
  sack: { dx: -4, dy: 14, map: ['..kk...', '.kAAk..', '..kk...', '.kAAAk.', 'kAAaAAk', 'kAaAAAk', 'kAAAAak', '.kkkkk.'], pal: { A: '#dcc48e', a: '#a88a52' } },
  bazooka: { dx: 6, dy: 14, map: ['kkkkkkkkkkkkkkk', 'kAAWAAAAAAAAAak', 'kaaaaaaaaaaaaak', 'kkkkkkkkkkkkkkk', '.....kk..kk....'], pal: { A: '#de8f3c', a: '#9a5420', W: '#ffd08a' }, muzzle: [20, 12] },
  cannon: { dx: 13, dy: 12, map: ['..kkkkkkk.', '.kAAAAAAAk', 'kAAWAAAAAk', 'kAAAAAAAAk', '.kaaaaaaak', '..kkkkkkk.', '...kBk....', '..kBBBk...', '..kkkkk...'], pal: { A: '#c98a3a', a: '#7a4a1a', W: '#ffe0a0', B: '#5a3418' }, muzzle: [22, 14] },
  staff: { dx: 14, dy: 3, map: ['..k..', '.kYk.', 'kYWYk', '.kYk.', '..k..', '..B..', '..B..', '..B..', '..B..', '..B..', '..B..', '..B..', '..B..', '..B..', '..k..'], pal: { Y: '#ff8ad0', W: '#fff0ff', B: '#8a5a32' }, glow: [16, 5] },
  slingshot: { dx: 15, dy: 11, map: ['k...k', 'Ak.kA', '.kAk.', '..A..', '..A..', '..k..'], pal: { A: '#9a6a3a' } },
  anchor: { dx: 15, dy: 10, map: ['..kkk..', '..kAk..', '.kkAkk.', '..kAk..', '..kAk..', 'k.kAk.k', 'kAkAkAk', '.kAAAk.', '..kkk..'], pal: { A: '#9aa4b0' } },
};

const BASE_PAL = { k: '#24150e', w: '#ffffff', S: '#f7c99b', s: '#d99a6c', r: '#f29a8a' };

const HEROES = [
  {
    id: 'teco', name: 'TECO', title: 'GAROTO DA VILA', weapon: 'SACO DE BOMBAS', wkey: 'sack', hair: SPIKY, hairTop: 0,
    pal: { H: '#7a4a24', h: '#4e2c12', O: '#f6f1e2', o: '#cfc6ae', P: '#3c6fb4', L: '#f7c99b', b: '#6a3a1a' },
    stats: [3, 3, 3, 3], skill: 'BOLSA FURADA', desc: 'A BOMBA SE ABRE NO AR E SOLTA TRÊS BOMBINHAS.', color: '#e8d6a6',
  },
  {
    id: 'brasa', name: 'BRASA', title: 'FÚRIA RUIVA', weapon: 'LANÇA-BRASAS', wkey: 'bazooka', hair: BANDANA, hairTop: 0,
    pal: { H: '#e8562a', h: '#a83218', A: '#2a2a3a', a: '#14141e', W: '#ffffff', O: '#d23a2e', o: '#8a1e18', P: '#3a3440', L: '#3a3440', b: '#1e1a20' },
    stats: [5, 3, 4, 2], skill: 'RASTRO DE FOGO', desc: 'O CHÃO ATINGIDO QUEIMA POR DOIS TURNOS.', color: '#ff8a5a',
  },
  {
    id: 'tork', name: 'TORK', title: 'AVIADOR INVENTOR', weapon: 'CANHÃO DE COBRE', wkey: 'cannon', hair: GOGGLES, hairTop: 0,
    pal: { H: '#8a5428', h: '#5a3418', A: '#5a3418', G: '#8fe0ff', g: '#3a8ac8', O: '#9a8a4a', o: '#6a5a2a', P: '#6a4424', L: '#6a4424', b: '#3a2210' },
    stats: [4, 5, 3, 3], skill: 'BALA GUIADA', desc: 'O VENTO AFETA METADE DO TIRO NESTE TURNO.', color: '#e0c070',
  },
  {
    id: 'luma', name: 'LUMA', title: 'MAGA ROSADA', weapon: 'CAJADO MÁGICO', wkey: 'staff', hair: TWINTAILS, hairTop: 0,
    pal: { H: '#ff7ac0', h: '#c0408a', A: '#ffd84a', O: '#a24ad0', o: '#6a2a90', P: '#a24ad0', L: '#f7c99b', b: '#5a2a7a' },
    stats: [3, 4, 2, 4], skill: 'ESTRELA CURATIVA', desc: 'CURA OS ALIADOS PERTO DE ONDE A MAGIA CAI.', color: '#ff9ad4',
  },
  {
    id: 'nimba', name: 'NIMBA', title: 'FILHA DAS NUVENS', weapon: 'FUNDA CELESTE', wkey: 'slingshot', hair: HOOD, hairTop: 0,
    pal: { H: '#f0f4ff', h: '#b8c4e0', A: '#6ab0f0', a: '#3a70b8', O: '#6ab0f0', o: '#3a70b8', P: '#f0f4ff', L: '#f0f4ff', b: '#2a4a8a' },
    stats: [2, 4, 2, 4], skill: 'RAJADA', desc: 'ATIRA TRÊS PEDRAS LEVES DE UMA VEZ.', color: '#9ad0ff',
  },
  {
    id: 'rufo', name: 'RUFO', title: 'CAPITÃO SEM MAR', weapon: 'ÂNCORA-CANHÃO', wkey: 'anchor', hair: PIRATE, hairTop: -4,
    pal: { S: '#e3ad7c', s: '#b77c4e', H: '#4a2c1a', h: '#2a1a10', A: '#1e2a4a', Y: '#f6c83a', W: '#fff7e0', O: '#7a2030', o: '#4a1018', P: '#e8dcc0', L: '#e8dcc0', b: '#1e1a20' },
    stats: [4, 2, 5, 5], skill: 'ÂNCORA AO FUNDO', desc: 'A ÂNCORA CAVA UMA CRATERA FUNDA E EMPURRA.', color: '#d0a8a0',
  },
];

const HERO_W = 38, HERO_H = 32, HOX = 8, HOY = 6;
const heroCache = new Map();

function heroImg(h, blink) {
  const key = `${h.id}|${blink}`;
  let c = heroCache.get(key);
  if (c) return c;
  let g;
  [c, g] = mk(HERO_W, HERO_H);
  const pal = { ...BASE_PAL, ...h.pal };
  const wp = WEAPONS[h.wkey];
  const wpal = { ...IP, ...wp.pal };
  if (h.wkey === 'sack') drawMap(g, wp.map, wpal, HOX + wp.dx, HOY + wp.dy);
  drawMap(g, BODY, pal, HOX, HOY);
  if (blink) {
    R(g, HOX + 6, HOY + 8, 2, 2, pal.S); R(g, HOX + 12, HOY + 8, 2, 2, pal.S);
    R(g, HOX + 6, HOY + 9, 2, 1, pal.k); R(g, HOX + 12, HOY + 9, 2, 1, pal.k);
  }
  drawMap(g, h.hair, pal, HOX, HOY + h.hairTop);
  if (h.wkey !== 'sack') drawMap(g, wp.map, wpal, HOX + wp.dx, HOY + wp.dy);
  heroCache.set(key, c);
  return c;
}

// Desenha o herói com os pés em (x, y), na escala s; respira e pisca sozinho.
function drawHero(g, h, x, y, s, t, o = {}) {
  const phase = o.phase || 0;
  const bob = Math.floor(t * 2 + phase) % 2;
  const blink = (t * 1.3 + phase * 0.37) % 4 < 0.12;
  ellipse(g, x, y - 1, 7 * s, Math.max(1, s), 'rgba(20,10,4,0.28)');
  const img = heroImg(h, blink);
  const dx = x - (HOX + 10) * s, dy = y - (HOY + 24) * s + bob * s;
  g.save();
  if (o.flip) {
    g.translate(x * 2, 0);
    g.scale(-1, 1);
  }
  g.drawImage(img, dx, dy, HERO_W * s, HERO_H * s);
  g.restore();
  const wp = WEAPONS[h.wkey];
  if (wp.glow && Math.floor(t * 4 + phase) % 2) {
    const gx = o.flip ? x - (wp.glow[0] - 10) * s - s : x + (wp.glow[0] - 10) * s;
    R(g, gx, dy + (HOY + wp.glow[1]) * s, s, s, '#ffffff');
  }
}

// ---------------------------------------------------------------- som

let audio = null;
function beep(freq = 660, dur = 0.06, type = 'square', vol = 0.05) {
  if (!state.sound) return;
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), v = audio.createGain();
    o.type = type; o.frequency.value = freq;
    v.gain.setValueAtTime(vol, audio.currentTime);
    v.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(v).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch { /* sem som */ }
}

// ---------------------------------------------------------------- estado

const MY_TOOLS = [
  { icon: 'explosion', name: 'EXPLOSÃO', desc: '+50% DE DANO NO PRÓXIMO TIRO.' },
  { icon: 'target', name: 'MIRA', desc: 'MOSTRA A TRAJETÓRIA POR UM TURNO.' },
  { icon: 'dummy', name: 'BONECO', desc: 'CRIA UM ALVO FALSO NO CAMPO.' },
  { icon: 'heal', name: 'CURA', desc: 'RECUPERA 30% DA VIDA.' },
];
const OTHER_TOOLS = [
  { icon: 'rocket', name: 'FOGUETE', desc: 'VOA ATÉ ONDE O TIRO CAIR.' },
  { icon: 'target', name: 'TIRO CERTEIRO', desc: 'O PRÓXIMO TIRO IGNORA O VENTO.' },
  { icon: 'dummyP', name: 'BONECO SOMBRIO', desc: 'ALVO FALSO QUE EXPLODE.' },
  { icon: 'fire', name: 'CHAMA', desc: 'O TIRO DEIXA FOGO NO CHÃO.' },
  { icon: 'crystal', name: 'CRISTAL DE GELO', desc: 'CONGELA O ALVO POR UM TURNO.' },
  { icon: 'banana', name: 'CASCA DE BANANA', desc: 'O INIMIGO ESCORREGA AO ANDAR.' },
  { icon: 'spike', name: 'BOMBA DE ESPINHOS', desc: 'ESPALHA ESPINHOS AO CAIR.' },
  { icon: 'shield', name: 'ESCUDO', desc: 'BLOQUEIA O PRÓXIMO DANO.' },
  { icon: 'potion', name: 'POÇÃO', desc: 'RECUPERA ENERGIA PARA ANDAR.' },
  { icon: 'comet', name: 'COMETA', desc: 'CHUVA DE ESTRELAS NO ALVO.' },
];

const BOT_NAMES = ['NUVENZINHA', 'CAPITAO_R', 'TORKINHO', 'LUMA.EXE', 'BRASINHA22', 'PEDRITA', 'ZEROGRAU'];
const BOT_LINES = ['OI GENTE!', 'BORA!', 'VAMOS NESSA', 'ESSE MAPA É BOM', 'SEM VENTO HOJE?', 'PRONTO AQUI', 'GG ANTES DE COMEÇAR'];

const state = {
  slots: [
    { kind: 'me', name: 'MATHEUS119', lv: 30, hero: 0, host: true, ready: true, ping: 3 },
    { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' },
  ],
  tab: 'SALA',
  chat: [
    { ch: 'MUNDO', who: 'PEDRITA', text: 'ALGUÉM PRA UM 2X2?' },
    { ch: 'MUNDO', who: 'ZEROGRAU', text: 'VENDENDO CRISTAL DE GELO NO LEILÃO' },
    { ch: 'GUILDA', who: 'LIDER_BRASA', text: 'GVG HOJE ÀS 21H!' },
    { ch: 'SISTEMA', who: 'SISTEMA', text: 'BEM-VINDO À SALA 143. CHAME AMIGOS OU CLIQUE NO + PARA TREINAR COM BOTS.' },
  ],
  input: '', focus: false,
  extra: [null, null, null, null],
  modal: null, pick: 0,
  toast: null, countdown: null, sound: true,
  shots: [], unreadMail: true, timers: [],
};

function later(sec, fn) { state.timers.push({ at: now + sec, fn }); }
function toast(msg) { state.toast = { msg, at: now }; }
function say(ch, who, text) { state.chat.push({ ch, who, text }); if (state.chat.length > 60) state.chat.shift(); }

function addBot(i) {
  const used = new Set(state.slots.filter(s => s.kind !== 'empty').map(s => s.hero));
  const free = HEROES.map((_, k) => k).filter(k => !used.has(k));
  const hero = (free.length ? free : HEROES.map((_, k) => k))[Math.floor(Math.random() * (free.length || HEROES.length))];
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  state.slots[i] = { kind: 'bot', name, lv: 5 + Math.floor(Math.random() * 40), hero, ready: false, ping: 1 + Math.floor(Math.random() * 3), joined: now };
  beep(880, 0.08); beep(1320, 0.08);
  say('SISTEMA', 'SISTEMA', `${name} ENTROU NA SALA COM ${HEROES[hero].name}.`);
  const slot = state.slots[i];
  later(1.5 + Math.random() * 3, () => {
    if (state.slots[i] !== slot) return;
    slot.ready = true;
    beep(990, 0.05);
    if (Math.random() < 0.7) say('SALA', name, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]);
  });
}

// ---------------------------------------------------------------- interface (modo imediato)

const mouse = { x: -100, y: -100, down: false };
let regions = [], hoverId = null, pressId = null, drag = null, tip = null;

function region(id, x, y, w, h, o = {}) {
  regions.push({ id, x, y, w, h, ...o });
  const hover = hoverId === id;
  if (hover && o.tip) tip = o.tip;
  return { hover, press: hover && pressId === id && mouse.down };
}

function pickRegion(x, y) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
  }
  return null;
}

function toLogical(e) {
  const b = cv.getBoundingClientRect();
  return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H];
}

cv.addEventListener('mousemove', e => {
  [mouse.x, mouse.y] = toLogical(e);
  hoverId = pickRegion(mouse.x, mouse.y)?.id ?? null;
});
cv.addEventListener('mouseleave', () => { mouse.x = mouse.y = -100; hoverId = null; });
cv.addEventListener('mousedown', e => {
  [mouse.x, mouse.y] = toLogical(e);
  mouse.down = true;
  const r = pickRegion(mouse.x, mouse.y);
  pressId = r?.id ?? null;
  if (r?.drag) drag = { item: r.drag, from: r.id };
  if (!r || r.id !== 'chat-input') state.focus = false;
});
addEventListener('mouseup', e => {
  [mouse.x, mouse.y] = toLogical(e);
  mouse.down = false;
  const r = pickRegion(mouse.x, mouse.y);
  if (drag) {
    if (r?.onDrop) r.onDrop(drag.item);
    else if (r && r.id === drag.from) r.onClick?.();
    drag = null;
  } else if (r && r.id === pressId) r.onClick?.();
  pressId = null;
});
cv.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (state.modal && e.key === 'Escape') { state.modal = null; return; }
  if (!state.focus) {
    if (e.key === 'Enter') { state.focus = true; e.preventDefault(); }
    return;
  }
  if (e.key === 'Enter') sendChat();
  else if (e.key === 'Backspace') state.input = state.input.slice(0, -1);
  else if (e.key === 'Escape') state.focus = false;
  else if (e.key.length === 1 && state.input.length < 48) state.input += e.key;
  e.preventDefault();
});

function sendChat() {
  {
    const msg = state.input.trim();
    if (msg) {
      say(state.tab === 'MUNDO' || state.tab === 'GUILDA' || state.tab === 'PRIVADO' ? state.tab : 'SALA', 'MATHEUS119', msg.toUpperCase());
      beep(520, 0.04);
      const bots = state.slots.filter(s => s.kind === 'bot');
      if (bots.length && Math.random() < 0.6) {
        const b = bots[Math.floor(Math.random() * bots.length)];
        later(1 + Math.random() * 2, () => say('SALA', b.name, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]));
      }
    }
    state.input = '';
    state.focus = false;
  }
}

// ---------------------------------------------------------------- peças de interface

function panel(g, x, y, w, h, fill = PAL.cream) {
  R(g, x, y, w, h, PAL.k);
  R(g, x + 1, y + 1, w - 2, h - 2, PAL.woodD);
  R(g, x + 1, y + 1, w - 2, 1, PAL.woodL);
  R(g, x + 2, y + 2, w - 4, h - 4, PAL.woodDD);
  R(g, x + 3, y + 3, w - 6, h - 6, fill);
}

function header(g, x, y, w, label, sub) {
  R(g, x, y, w, 11, PAL.k);
  R(g, x + 1, y + 1, w - 2, 9, PAL.head);
  R(g, x + 1, y + 1, w - 2, 1, PAL.headL);
  text(g, label, x + w / 2, y + 2, { align: 'center', color: PAL.headText, shadow: PAL.k });
  if (sub) text(g, sub, x + w / 2, y + 14, { font: 3, align: 'center', color: PAL.woodD });
}

function rivet(g, x, y) {
  R(g, x, y, 3, 3, PAL.stoneD);
  R(g, x, y, 2, 2, PAL.stoneL);
  R(g, x + 1, y + 1, 1, 1, PAL.stone);
}

function wood(g, x, y, w, h, seed = 1, plank = 8) {
  const r = rng(seed);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  R(g, x, y, w, h, PAL.wood);
  for (let py = y; py < y + h; py += plank) {
    R(g, x, py, w, 1, PAL.woodL);
    R(g, x, py + plank - 1, w, 1, PAL.woodDD);
    for (let i = 0; i < w / 5; i++) {
      const gx = x + Math.floor(r() * w), gy = py + 2 + Math.floor(r() * (plank - 4)), gl = 3 + Math.floor(r() * 9);
      R(g, gx, gy, gl, 1, r() < 0.6 ? PAL.woodD : PAL.woodL);
    }
    let jx = x + Math.floor(r() * 40);
    while (jx < x + w) { R(g, jx, py + 1, 1, plank - 2, PAL.woodD); jx += 40 + Math.floor(r() * 50); }
  }
  g.restore();
}

function woodButton(g, id, x, y, w, h, o = {}) {
  const st = region(id, x, y, w, h, o);
  const down = st.press ? 1 : 0;
  R(g, x, y, w, h, PAL.k);
  const face = o.face || [PAL.woodL, PAL.wood, PAL.woodD];
  R(g, x + 1, y + 1, w - 2, h - 2, face[2]);
  R(g, x + 1, y + 1 + down, w - 2, h - 3, st.hover ? o.hoverFace || face[0] : face[1]);
  R(g, x + 2, y + 2 + down, w - 4, 1, o.shine || PAL.woodLL);
  return { ...st, down };
}

function bigButton(g, id, x, y, w, h, label, o = {}) {
  const st = region(id, x, y, w, h, o);
  const down = st.press ? 2 : 0;
  R(g, x, y + 2, w, h - 2, PAL.k);
  R(g, x, y + down, w, h - 2, PAL.k);
  R(g, x + 1, y + 1 + down, w - 2, h - 4, o.dark || PAL.goldD);
  R(g, x + 1, y + 1 + down, w - 2, h - 7, st.hover ? o.hover || '#ffe680' : o.face || PAL.gold);
  R(g, x + 2, y + 2 + down, w - 4, 2, o.shine || '#fff4b8');
  return { ...st, down };
}

function slotBox(g, x, y, s, o = {}) {
  R(g, x, y, s, s, PAL.k);
  R(g, x + 1, y + 1, s - 2, s - 2, o.rim || PAL.blueD);
  R(g, x + 2, y + 2, s - 4, s - 4, o.fill || PAL.blue);
  R(g, x + 2, y + 2, s - 4, 1, o.shine || PAL.blueL);
  if (o.hover) { R(g, x, y, s, 1, PAL.gold); R(g, x, y + s - 1, s, 1, PAL.gold); R(g, x, y, 1, s, PAL.gold); R(g, x + s - 1, y, 1, s, PAL.gold); }
}

function dashedSlot(g, x, y, s, hover) {
  R(g, x, y, s, s, hover ? '#f2dca8' : PAL.creamD);
  g.fillStyle = hover ? PAL.goldD : PAL.creamDD;
  for (let i = 0; i < s; i += 3) {
    g.fillRect(x + i, y, 2, 1); g.fillRect(x + i, y + s - 1, 2, 1);
    g.fillRect(x, y + i, 1, 2); g.fillRect(x + s - 1, y + i, 1, 2);
  }
}

// ---------------------------------------------------------------- camada fixa

let STATIC = null;
let banner = null, arena = null, waterfalls = [];

function buildStatic() {
  const [c, g] = mk(W, H);
  // moldura de madeira
  wood(g, 0, 0, W, H, 7, 10);
  R(g, 0, 0, W, 1, PAL.k); R(g, 0, H - 1, W, 1, PAL.k); R(g, 0, 0, 1, H, PAL.k); R(g, W - 1, 0, 1, H, PAL.k);
  // fundo escuro atrás das colunas
  R(g, 8, 42, W - 16, H - 48, PAL.woodDD);
  R(g, 9, 43, W - 18, H - 50, '#3a2012');
  for (const [x, y] of [[3, 3], [W - 6, 3], [3, H - 6], [W - 6, H - 6], [3, 180], [W - 6, 180], [240, H - 5]]) rivet(g, x, y);

  // vinhas nas bordas
  const r = rng(42);
  const leaf = (x, y) => {
    const c1 = r() < 0.5 ? '#4f9a2e' : '#3a7a22';
    R(g, x, y, 3, 2, c1); R(g, x + 1, y - 1, 1, 1, c1); R(g, x, y + 2, 1, 1, '#2a5a18');
    if (r() < 0.3) R(g, x + 1, y, 1, 1, '#7cc04a');
  };
  const vine = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
        R(g, x, y, 1, 1, '#2f6a1c');
        if (k % 5 === 0) leaf(x + (r() < 0.5 ? -3 : 1), y + (r() < 0.5 ? -2 : 1));
      }
    }
  };
  vine([[0, 44], [6, 60], [2, 90], [7, 120], [2, 150]]);
  vine([[W - 1, 46], [W - 7, 70], [W - 2, 100], [W - 6, 140]]);
  vine([[0, H - 40], [6, H - 20], [30, H - 4], [70, H - 6]]);
  vine([[W - 1, H - 50], [W - 7, H - 26], [W - 40, H - 3]]);

  // placa do título
  wood(g, 12, 8, 142, 30, 3, 10);
  R(g, 12, 8, 142, 1, PAL.k); R(g, 12, 37, 142, 1, PAL.k); R(g, 12, 8, 1, 30, PAL.k); R(g, 153, 8, 1, 30, PAL.k);
  R(g, 14, 10, 138, 1, PAL.woodLL);
  rivet(g, 15, 11); rivet(g, 148, 11); rivet(g, 15, 32); rivet(g, 148, 32);
  // escudo com espadas
  drawMap(g, ['.kkkkkkkkk.', 'kNNNNNNNNNk', 'kNWNNNNNNnk', 'kNNNNNNNNnk', 'kNNNNNNNNnk', 'kNNNNNNNNnk', '.kNNNNNNnk.', '.kNNNNNNnk.', '..knNNNnk..', '...knnnk...', '....kkk....'], IP, 22, 13);
  icon(g, 'swords', 23, 14);
  text(g, 'SALA DE BATALHA', 40, 19, { color: PAL.gold, color2: '#f0a028', outline: PAL.k, shadow: PAL.woodDD });

  // faixa central (céu, montanhas e castelo)
  {
    const [bc, bg] = mk(212, 26);
    dither(bg, 0, 0, 212, 26, ['#4a8ad8', '#8ac4f0', '#d8eef8']);
    const rr = rng(9);
    bg.fillStyle = '#7f9cc8';
    for (let x = 0; x < 212; x++) { const h = 8 + Math.round(5 * Math.sin(x / 13) + 3 * Math.sin(x / 5.3)); bg.fillRect(x, 26 - h, 1, h); }
    bg.fillStyle = '#5a8a4a';
    for (let x = 0; x < 212; x++) { const h = 4 + Math.round(2 * Math.sin(x / 9 + 1)); bg.fillRect(x, 26 - h, 1, h); }
    // castelo
    const cx = 96;
    R(bg, cx, 8, 20, 14, '#c8c0b8'); R(bg, cx - 4, 4, 6, 18, '#b0a8a0'); R(bg, cx + 18, 4, 6, 18, '#b0a8a0');
    R(bg, cx + 7, 2, 6, 6, '#b8b0a8');
    for (const [tx, ty] of [[cx - 4, 1], [cx + 18, 1], [cx + 7, -1]]) { R(bg, tx + 1, ty, 4, 2, PAL.red); R(bg, tx + 2, ty - 1, 2, 1, PAL.red); }
    R(bg, cx + 8, 15, 4, 7, '#4a3a30'); R(bg, cx - 2, 9, 2, 2, '#4a3a30'); R(bg, cx + 20, 9, 2, 2, '#4a3a30');
    R(bg, cx + 9, 3, 2, 2, '#4a3a30');
    for (let i = 0; i < 30; i++) R(bg, Math.floor(rr() * 212), 20 + Math.floor(rr() * 6), 2, 1, '#4a7a3a');
    banner = bc;
  }
  R(g, 160, 8, 216, 30, PAL.k);
  R(g, 161, 9, 214, 28, PAL.goldD);

  // botões do topo: base
  // (desenhados por quadro para reagir ao mouse)

  // arte central
  arena = buildArena(162, 160);

  // piso de tijolos abaixo das vagas
  {
    const x0 = 12, y0 = 288, w = 148, h = 64;
    R(g, x0, y0, w, h, '#4a4a52');
    for (let row = 0; row * 8 < h; row++) {
      const off = row % 2 ? 0 : -8;
      for (let bx = off; bx < w; bx += 16) {
        const sx = Math.max(x0, x0 + bx + 1), ex = Math.min(x0 + w, x0 + bx + 16);
        if (ex <= sx) continue;
        const shade = ['#7f838c', '#8b8f98', '#767a83', '#9a9ea6'][(row * 7 + bx) & 3];
        R(g, sx, y0 + row * 8 + 1, ex - sx - 1, 6, shade);
        R(g, sx, y0 + row * 8 + 1, ex - sx - 1, 1, '#a8acb4');
      }
    }
    // sombra no alto do piso
    R(g, x0, y0, w, 2, 'rgba(0,0,0,0.35)');
  }

  // painéis fixos da coluna direita
  panel(g, 336, 44, 132, 32);
  panel(g, 336, 78, 132, 46);
  header(g, 339, 81, 126, 'MINHAS FERRAMENTAS');
  text(g, '(1 USO POR HABILIDADE)', 402, 94, { font: 3, align: 'center', color: PAL.woodD });
  panel(g, 336, 126, 132, 104);
  header(g, 339, 129, 126, 'OUTRAS FERRAMENTAS');
  text(g, 'ARRASTE OS ITENS PARA', 402, 214, { font: 3, align: 'center', color: PAL.woodD });
  text(g, 'OS SLOTS ACIMA', 402, 221, { font: 3, align: 'center', color: PAL.woodD });
  panel(g, 336, 232, 132, 38);
  header(g, 339, 235, 126, 'ESPECTADORES');

  // painel do chat
  panel(g, 164, 228, 168, 108);

  STATIC = c;
}

function island(g, cx, cy, rw, rh, r, o = {}) {
  // rocha que afina para baixo
  for (let y = 0; y < rh; y++) {
    const k = 1 - y / rh;
    const w = Math.round(rw * Math.pow(k, 0.7));
    for (let x = -w; x <= w; x++) {
      const edge = Math.abs(x) > w - 2;
      const n = r();
      g.fillStyle = edge ? '#4a3a30' : n < 0.15 ? '#6a5242' : n < 0.3 ? '#9a7a5a' : '#806450';
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  // grama em cima
  for (let x = -rw; x <= rw; x++) {
    const h = 3 + Math.round(1.5 * Math.sin(x * 0.7) + r());
    R(g, cx + x, cy - 2, 1, h, '#4fa83a');
    R(g, cx + x, cy - 2, 1, 1, '#8ee060');
    if (r() < 0.25) R(g, cx + x, cy + h - 2, 1, 2, '#2f7a22');
  }
  R(g, cx - rw - 1, cy - 1, 1, 3, '#24150e'); R(g, cx + rw + 1, cy - 1, 1, 3, '#24150e');
  if (o.castle) {
    const x = cx + o.castle, y = cy - 3;
    R(g, x - 8, y - 14, 16, 14, '#d8d0c4'); R(g, x - 8, y - 14, 16, 1, '#f0e8dc');
    R(g, x - 12, y - 20, 6, 20, '#c4bcb0'); R(g, x + 6, y - 20, 6, 20, '#c4bcb0');
    for (const tx of [x - 12, x + 6]) { R(g, tx - 1, y - 23, 8, 3, PAL.blue); R(g, tx + 1, y - 25, 4, 2, PAL.blue); R(g, tx + 2, y - 27, 2, 2, PAL.blueD); }
    R(g, x - 2, y - 7, 4, 7, '#5a4232'); R(g, x - 10, y - 15, 2, 3, '#5a4232'); R(g, x + 8, y - 15, 2, 3, '#5a4232');
    for (let i = -8; i < 8; i += 3) R(g, x + i, y - 16, 2, 2, '#d8d0c4');
  }
  if (o.tree) {
    const x = cx + o.tree, y = cy - 3;
    R(g, x, y - 6, 2, 6, '#6a4424');
    ellipse(g, x + 1, y - 9, 5, 4, '#3a8a2a'); ellipse(g, x, y - 10, 3, 2, '#5ab03a');
  }
}

function buildArena(w, h) {
  const [c, g] = mk(w, h);
  dither(g, 0, 0, w, h, ['#3d7fd6', '#6aaaf0', '#a8d8f8', '#f6e8c8']);
  // sol e montanhas ao fundo
  ellipse(g, 128, 40, 9, 9, '#fff2b0'); ellipse(g, 128, 40, 7, 7, '#ffe680');
  g.fillStyle = '#9ab8e0';
  for (let x = 0; x < w; x++) { const hh = 34 + Math.round(10 * Math.sin(x / 17) + 5 * Math.sin(x / 7)); g.fillRect(x, h - 28 - hh, 1, hh); }
  g.fillStyle = '#bcd4ee';
  for (let x = 0; x < w; x++) { const hh = 18 + Math.round(6 * Math.sin(x / 11 + 2)); g.fillRect(x, h - 28 - hh, 1, hh); }
  const r = rng(77);
  island(g, 30, 110, 26, 30, r, { castle: -14 });
  island(g, 132, 116, 28, 32, r, { castle: 16 });
  island(g, 82, 92, 12, 14, r, { tree: 2 });
  island(g, 8, 58, 7, 8, r);
  island(g, 152, 66, 8, 9, r);
  waterfalls = [{ x: 46, y: 112, h: 34 }, { x: 116, y: 118, h: 30 }, { x: 88, y: 94, h: 22 }];
  return c;
}

// ---------------------------------------------------------------- desenho por quadro

let now = 0;
const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 40, y: 6 + (i * 17) % 40, s: 0.6 + (i % 3) * 0.3 }));

function cloud(g, x, y, s = 1) {
  const c1 = '#ffffff', c2 = '#dce8f4';
  ellipse(g, x, y, 6 * s, 3 * s, c2);
  ellipse(g, x - 4 * s, y - 1, 4 * s, 2 * s, c1);
  ellipse(g, x + 3 * s, y - 2, 5 * s, 3 * s, c1);
}

function torch(g, x, y) {
  R(g, x + 2, y + 6, 3, 12, PAL.woodDD); R(g, x + 2, y + 6, 1, 12, PAL.woodD);
  R(g, x, y + 5, 7, 3, PAL.stoneD); R(g, x, y + 5, 7, 1, PAL.stoneL);
  const f = Math.floor(now * 10) % 3;
  const flames = [
    ['..R..', '.ROR.', 'ROYOR', 'ROYOR', '.RYR.'],
    ['.R...', '.RR..', 'ROOR.', 'ROYOR', '.RYR.'],
    ['...R.', '..RR.', '.ROOR', 'ROYOR', '.RYR.'],
  ];
  drawMap(g, flames[f], IP, x + 1, y);
  g.fillStyle = 'rgba(255,170,60,0.10)';
  g.beginPath(); g.arc(x + 3, y + 3, 14, 0, Math.PI * 2); g.fill();
}

function drawTopBar(g) {
  // faixa do meio com nuvens
  g.drawImage(banner, 162, 10);
  g.save(); g.beginPath(); g.rect(162, 10, 212, 26); g.clip();
  for (const c of clouds) cloud(g, 162 + ((c.x + now * 4 * c.s) % 240) - 14, 10 + (c.y % 12) + 3, 0.7);
  g.restore();
  // estandarte azul pendurado
  for (const bx of [176, 350]) {
    R(g, bx - 1, 9, 12, 2, PAL.woodDD);
    const wave = Math.floor(now * 3) % 2;
    R(g, bx, 11, 10, 18, PAL.k);
    R(g, bx + 1, 11, 8, 17, PAL.blue);
    R(g, bx + 1, 11, 2, 17, PAL.blueL);
    R(g, bx + 1, 27 + wave, 3, 3, PAL.blue); R(g, bx + 6, 27 + (1 - wave), 3, 3, PAL.blue);
    drawMap(g, ['..Y..', '.YYY.', 'YYYYY', '.Y.Y.'], IP, bx + 3, 17);
  }
  // botões do topo
  const tops = [
    { id: 'top-gear', x: 384, draw: (x, y) => gear(g, x + 12, y + 12, 6, '#d8dce4', '#7a808c'), tip: 'AJUSTES', fn: () => openSettings() },
    { id: 'top-friends', x: 413, draw: (x, y) => icon(g, 'friends', x + 7, y + 8), tip: 'AMIGOS', fn: () => toast('LISTA DE AMIGOS (PROTÓTIPO)') },
    { id: 'top-exit', x: 442, red: true, draw: (x, y) => icon(g, 'exit', x + 7, y + 7), tip: 'SAIR DA SALA', fn: () => toast('SAIR DA SALA (PROTÓTIPO)') },
  ];
  for (const b of tops) {
    const st = woodButton(g, b.id, b.x, 10, 26, 26, {
      tip: b.tip, onClick: () => { beep(); b.fn(); },
      face: b.red ? ['#f05a48', PAL.red, PAL.redD] : undefined, hoverFace: b.red ? '#ff7a64' : undefined, shine: b.red ? '#ff9a8a' : undefined,
    });
    b.draw(b.x, 10 + st.down);
  }
  torch(g, 2, 46);
  torch(g, W - 9, 46);
}

function drawSlots(g) {
  const pos = [[12, 44], [87, 44], [12, 165], [87, 165]];
  state.slots.forEach((s, i) => {
    const [x, y] = pos[i];
    const w = 73, h = 119;
    if (s.kind === 'empty') {
      const st = region(`slot-${i}`, x, y, w, h, { tip: 'ADICIONAR UM BOT', onClick: () => addBot(i) });
      R(g, x, y, w, h, PAL.k);
      R(g, x + 1, y + 1, w - 2, h - 2, PAL.slotLine);
      R(g, x + 2, y + 2, w - 4, h - 4, st.hover ? PAL.slotDark2 : PAL.slotDark);
      g.globalAlpha = 0.16;
      icon(g, 'swords', x + 16, y + 24, 4, IP);
      g.globalAlpha = 1;
      const cx = x + 36, cy = y + 54;
      const ring = st.hover ? PAL.gold : '#e9d3a5';
      ellipse(g, cx, cy, 12, 12, PAL.k);
      ellipse(g, cx, cy, 11, 11, ring);
      ellipse(g, cx, cy, 9, 9, st.hover ? '#6a4a2a' : '#4a3426');
      R(g, cx - 1, cy - 6, 3, 13, ring); R(g, cx - 6, cy - 1, 13, 3, ring);
      text(g, 'AGUARDANDO', cx, y + 80, { font: 3, align: 'center', color: '#d8c49a' });
      text(g, 'JOGADOR...', cx, y + 88, { font: 3, align: 'center', color: '#d8c49a' });
      return;
    }
    const hero = HEROES[s.hero];
    const isMe = s.kind === 'me';
    const st = region(`slot-${i}`, x, y, w, h, { tip: isMe ? 'CLIQUE PARA TROCAR DE HERÓI' : `${hero.name}: ${hero.weapon}`, onClick: () => { if (isMe) openPicker(); } });
    R(g, x, y, w, h, PAL.k);
    R(g, x + 1, y + 1, w - 2, h - 2, isMe ? PAL.goldD : PAL.woodD);
    R(g, x + 2, y + 2, w - 4, h - 4, PAL.cream);
    dither(g, x + 3, y + 22, w - 6, 64, [PAL.cream, '#ecd8ae']);
    // nome e nível
    if (s.host) icon(g, 'crown', x + 3, y + 4);
    text(g, s.name, x + 37 + (s.host ? 4 : 0), y + 4, { align: 'center', color: PAL.ink });
    text(g, `LV. ${s.lv}`, x + 37, y + 14, { font: 3, align: 'center', color: PAL.woodD });
    // herói
    drawHero(g, hero, x + 36, y + 84, 2, now, { phase: i * 0.7 });
    text(g, hero.name, x + 37, y + 89, { font: 3, align: 'center', color: PAL.ink });
    text(g, hero.weapon, x + 37, y + 96, { font: 3, align: 'center', color: PAL.woodD });
    // rodapé: patente, pronto, sinal
    icon(g, 'rank', x + 5, y + 106);
    const ready = s.ready || isMe;
    const label = isMe ? 'DONO' : ready ? 'PRONTO' : '...';
    R(g, x + 20, y + 106, 33, 9, PAL.k);
    R(g, x + 21, y + 107, 31, 7, isMe ? PAL.orange : ready ? PAL.green : PAL.gray);
    text(g, label, x + 37, y + 108, { font: 3, align: 'center', color: PAL.white });
    for (let b = 0; b < 4; b++) R(g, x + 58 + b * 3, y + 113 - b * 2, 2, 2 + b * 2, b < s.ping + 1 ? PAL.green : PAL.creamDD);
    const near = hoverId === `slot-${i}` || (hoverId || '').startsWith(isMe ? 'slot-arrow' : `slot-kick-${i}`);
    if (isMe && near) {
      for (const [dir, ax] of [[-1, x + 4], [1, x + 61]]) {
        const ab = woodButton(g, `slot-arrow-${dir}`, ax, y + 44, 9, 14, {
          tip: dir < 0 ? 'HERÓI ANTERIOR' : 'PRÓXIMO HERÓI',
          onClick: () => { s.hero = (s.hero + dir + HEROES.length) % HEROES.length; beep(740); },
        });
        drawMap(g, dir < 0 ? ['..k', '.kk', 'kkk', '.kk', '..k'] : ['k..', 'kk.', 'kkk', 'kk.', 'k..'], { k: PAL.cream }, ax + 3, y + 48 + ab.down);
      }
    }
    if (s.kind === 'bot' && near) {
      const xb = woodButton(g, `slot-kick-${i}`, x + w - 12, y + 3, 9, 9, {
        tip: 'TIRAR DA SALA', onClick: () => { say('SISTEMA', 'SISTEMA', `${s.name} SAIU DA SALA.`); state.slots[i] = { kind: 'empty' }; beep(330); },
        face: ['#f05a48', PAL.red, PAL.redD], hoverFace: '#ff7a64', shine: '#ff9a8a',
      });
      drawMap(g, ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], { k: PAL.white }, x + w - 10, y + 5 + xb.down);
    }
  });
}

function drawFloorSign(g) {
  const me = state.slots[0];
  const hero = HEROES[me.hero];
  // corrente e placa
  R(g, 40, 288, 1, 8, PAL.stoneD); R(g, 130, 288, 1, 8, PAL.stoneD);
  wood(g, 18, 296, 136, 50, 11, 10);
  R(g, 18, 296, 136, 1, PAL.k); R(g, 18, 345, 136, 1, PAL.k); R(g, 18, 296, 1, 50, PAL.k); R(g, 153, 296, 1, 50, PAL.k);
  rivet(g, 21, 299); rivet(g, 148, 299);
  text(g, 'SEU HERÓI', 86, 300, { font: 3, align: 'center', color: PAL.gold, outline: PAL.k });
  text(g, hero.name, 86, 309, { align: 'center', color: PAL.white, outline: PAL.k, shadow: PAL.woodDD });
  text(g, hero.weapon, 86, 320, { font: 3, align: 'center', color: '#ffe6b0', outline: PAL.woodDD });
  for (const [dir, ax] of [[-1, 24], [1, 134]]) {
    const ab = woodButton(g, `sign-arrow-${dir}`, ax, 306, 14, 14, {
      tip: dir < 0 ? 'HERÓI ANTERIOR' : 'PRÓXIMO HERÓI',
      onClick: () => { me.hero = (me.hero + dir + HEROES.length) % HEROES.length; beep(740); },
    });
    drawMap(g, dir < 0 ? ['..k', '.kk', 'kkk', '.kk', '..k'] : ['k..', 'kk.', 'kkk', 'kk.', 'k..'], { k: PAL.cream }, ax + 6, 310 + ab.down);
  }
  const vb = bigButton(g, 'sign-all', 56, 329, 60, 13, '', { tip: 'VER TODOS OS HERÓIS', onClick: () => { beep(); openPicker(); } });
  text(g, 'VER TODOS', 86, 332 + vb.down, { font: 3, align: 'center', color: PAL.goldDD });
}

function drawArena(g) {
  const x0 = 167, y0 = 47;
  panel(g, 164, 44, 168, 166);
  g.drawImage(arena, x0, y0);
  g.save(); g.beginPath(); g.rect(x0, y0, 162, 160); g.clip();
  for (const c of clouds) cloud(g, x0 + ((c.x * 1.3 + now * 3 * c.s) % 200) - 20, y0 + 28 + c.y, c.s);
  // cachoeiras
  for (const f of waterfalls) {
    for (let y = 0; y < f.h; y++) {
      const k = (y + Math.floor(now * 14)) % 6;
      R(g, x0 + f.x, y0 + f.y + y, 3, 1, k < 2 ? '#ffffff' : k < 4 ? '#a8e0ff' : '#6ac0f0');
    }
    if (Math.floor(now * 6) % 2) R(g, x0 + f.x - 1, y0 + f.y + f.h, 5, 1, '#ffffff');
  }
  // heróis duelando: aviador com canhão contra a maga
  const tork = HEROES[2], luma = HEROES[3];
  drawHero(g, tork, x0 + 40, y0 + 108, 2, now, { phase: 0.3 });
  drawHero(g, luma, x0 + 116, y0 + 114, 2, now, { phase: 1.1, flip: true });
  // tiro em arco de tempos em tempos
  const p = (now % 3.2) / 1.6;
  if (p < 1) {
    const sx = x0 + 64, sy = y0 + 88, ex = x0 + 112, ey = y0 + 98;
    for (let k = 0; k < 6; k++) {
      const q = Math.max(0, p - k * 0.03);
      const bx = sx + (ex - sx) * q, by = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 34;
      R(g, Math.round(bx), Math.round(by), k ? 2 : 4, k ? 2 : 4, k ? `rgba(255,${200 - k * 20},80,${0.8 - k * 0.12})` : '#3a2a20');
    }
  } else if (p < 1.25) {
    const s = Math.floor((p - 1) * 16);
    ellipse(g, x0 + 112, y0 + 98, 3 + s, 2 + s, 'rgba(255,220,120,0.8)');
    ellipse(g, x0 + 112, y0 + 98, 1 + s, 1 + Math.floor(s / 2), '#ffffff');
  }
  g.restore();
  // logotipo
  const lx = x0 + 81;
  wood(g, lx - 56, y0 + 4, 112, 26, 5, 9);
  R(g, lx - 56, y0 + 4, 112, 1, PAL.k); R(g, lx - 56, y0 + 29, 112, 1, PAL.k); R(g, lx - 56, y0 + 4, 1, 26, PAL.k); R(g, lx + 55, y0 + 4, 1, 26, PAL.k);
  rivet(g, lx - 53, y0 + 7); rivet(g, lx + 51, y0 + 7);
  text(g, 'BATALHA', lx - 13, y0 + 10, { align: 'center', scale: 2, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  R(g, lx + 31, y0 + 11, 21, 12, PAL.k); R(g, lx + 32, y0 + 12, 19, 10, PAL.red); R(g, lx + 32, y0 + 12, 19, 1, '#ff7a64');
  text(g, 'PVP', lx + 42, y0 + 14, { align: 'center', color: PAL.white, outline: PAL.redD });
  // faixa de baixo
  R(g, x0, y0 + 126, 162, 34, PAL.k);
  R(g, x0, y0 + 127, 162, 33, PAL.navy);
  R(g, x0, y0 + 127, 162, 1, '#3a5aa0');
  text(g, 'ENTRE NO CAMPO DE BATALHA', lx, y0 + 131, { align: 'center', color: PAL.gold, outline: PAL.k });
  const lines = wrap('MOSTRE SUA FORÇA, ESTRATÉGIA E SEJA O ÚLTIMO DE PÉ!', 150, 3);
  lines.forEach((l, k) => text(g, l, lx, y0 + 142 + k * 8, { font: 3, align: 'center', color: '#dfe8ff' }));
}

const TABS = ['MUNDO', 'SALA', 'GUILDA', 'PRIVADO'];

function drawChat(g) {
  // abas
  TABS.forEach((t, i) => {
    const x = 164 + i * 42, y = 214, w = 41;
    const active = state.tab === t;
    const st = region(`tab-${t}`, x, y, w, 14, { onClick: () => { state.tab = t; beep(600, 0.03); } });
    R(g, x, y + (active ? 0 : 2), w, 14 - (active ? 0 : 2), PAL.k);
    R(g, x + 1, y + 1 + (active ? 0 : 2), w - 2, 13 - (active ? 0 : 2), active ? PAL.orange : st.hover ? PAL.woodL : PAL.woodD);
    R(g, x + 1, y + 1 + (active ? 0 : 2), w - 2, 1, active ? '#ffb060' : PAL.woodL);
    text(g, t, x + w / 2, y + 5 + (active ? 0 : 1), { font: 3, align: 'center', color: active ? PAL.white : PAL.cream, outline: active ? PAL.orangeD : undefined });
  });
  // mensagens
  const box = { x: 169, y: 233, w: 158, h: 98 };
  const colorOf = { SALA: '#c0501a', MUNDO: '#2a6ab0', GUILDA: '#2a8a3a', PRIVADO: '#a02a90', SISTEMA: '#8a6a1a' };
  const visible = state.chat.filter(m => m.ch === state.tab || m.ch === 'SISTEMA' || m.ch === 'PRIVADO');
  const lines = [];
  for (const m of visible) {
    const prefix = m.ch === 'SISTEMA' ? '' : `${m.who}: `;
    const parts = wrap(`${prefix}${m.text}`, box.w - 4, 3);
    parts.forEach((p, k) => lines.push({ p, k, prefix, color: colorOf[m.ch] }));
  }
  const max = Math.floor(box.h / 8);
  lines.slice(-max).forEach((l, row) => {
    const y = box.y + row * 8 + 2;
    if (l.k === 0 && l.prefix && l.p.startsWith(l.prefix.trim())) {
      const wName = text(g, l.prefix.trim(), box.x + 2, y, { font: 3, color: l.color });
      text(g, l.p.slice(l.prefix.length), box.x + 2 + wName + 4, y, { font: 3, color: PAL.ink });
    } else text(g, l.p, box.x + 2, y, { font: 3, color: l.prefix ? PAL.ink : l.color });
  });
  // campo de digitar
  const st = region('chat-input', 164, 338, 136, 14, { onClick: () => { state.focus = true; } });
  R(g, 164, 338, 136, 14, PAL.k);
  R(g, 165, 339, 134, 12, state.focus ? '#fff8e6' : st.hover ? '#f8ecd0' : PAL.creamD);
  R(g, 165, 339, 134, 1, PAL.creamDD);
  if (state.input || state.focus) {
    const shown = state.input.toUpperCase();
    const wTxt = text(g, shown.slice(-30), 168, 343, { font: 3, color: PAL.ink });
    if (state.focus && Math.floor(now * 2) % 2) R(g, 169 + wTxt + 1, 342, 1, 6, PAL.ink);
  } else text(g, 'DIGITE SUA MENSAGEM... (ENTER)', 168, 343, { font: 3, color: PAL.creamDD });
  const eb = bigButton(g, 'chat-emoji', 302, 338, 14, 14, '', { tip: 'EMOJIS', onClick: () => { state.input += ' :)'; state.focus = true; beep(); } });
  ellipse(g, 309, 344 + eb.down, 4, 4, PAL.k); ellipse(g, 309, 344 + eb.down, 3, 3, '#ffe060');
  R(g, 307, 343 + eb.down, 1, 1, PAL.k); R(g, 310, 343 + eb.down, 1, 1, PAL.k); R(g, 307, 346 + eb.down, 4, 1, PAL.k);
  const sb = bigButton(g, 'chat-send', 318, 338, 14, 14, '', { tip: 'ENVIAR', onClick: sendChat });
  drawMap(g, ICONS.send, { k: PAL.goldDD, W: PAL.white }, 322, 340 + sb.down);
}

function drawRight(g) {
  // sala
  icon(g, 'scroll', 342, 51);
  text(g, 'SALA 143', 356, 50, { color: PAL.ink });
  text(g, 'SALA DE MATHEUS119', 356, 60, { font: 3, color: PAL.woodD });
  const pb = woodButton(g, 'room-edit', 446, 50, 16, 16, { tip: 'MUDAR NOME DA SALA', onClick: () => { beep(); toast('NOME DA SALA (PROTÓTIPO)'); } });
  icon(g, 'pencil', 450, 54 + pb.down);

  // minhas ferramentas
  MY_TOOLS.forEach((t, i) => {
    const x = 344 + i * 30, y = 98;
    const st = region(`my-${i}`, x, y, 24, 22, { tip: `${t.name}: ${t.desc}` });
    slotBox(g, x, y, 22, { hover: st.hover });
    icon(g, t.icon, x + 6, y + 6);
    R(g, x + 15, y + 15, 7, 7, PAL.k); R(g, x + 16, y + 16, 5, 5, PAL.gold);
    text(g, String(i + 1), x + 18, y + 16, { font: 3, align: 'center', color: PAL.k });
  });

  // outras ferramentas
  OTHER_TOOLS.forEach((t, i) => {
    const x = 342 + (i % 5) * 25, y = 143 + Math.floor(i / 5) * 24;
    const st = region(`other-${i}`, x, y, 22, 22, { tip: `${t.name}: ${t.desc} (ARRASTE)`, drag: t });
    slotBox(g, x, y, 22, { hover: st.hover, fill: '#3a6ab8' });
    if (!(drag && drag.item === t)) icon(g, t.icon, x + 6, y + 6);
  });
  state.extra.forEach((t, i) => {
    const x = 348 + i * 28, y = 191;
    const st = region(`extra-${i}`, x, y, 22, 22, {
      tip: t ? `${t.name} (CLIQUE PARA TIRAR)` : 'SOLTE UM ITEM AQUI',
      onDrop: item => {
        const j = state.extra.indexOf(item);
        if (j >= 0) state.extra[j] = null;
        state.extra[i] = item; beep(880, 0.05);
      },
      onClick: () => { if (state.extra[i]) { state.extra[i] = null; beep(440, 0.04); } },
    });
    if (t) { slotBox(g, x, y, 22, { hover: st.hover }); icon(g, t.icon, x + 6, y + 6); }
    else dashedSlot(g, x, y, 22, st.hover || (drag && st.hover));
  });

  // espectadores
  for (let i = 0; i < 3; i++) {
    const x = 352 + i * 36, y = 248;
    const st = region(`spec-${i}`, x, y, 26, 18, { tip: 'VAGA DE ESPECTADOR TRANCADA', onClick: () => { beep(300); toast('VAGAS DE ESPECTADOR TRANCADAS'); } });
    R(g, x, y, 26, 18, PAL.k);
    R(g, x + 1, y + 1, 24, 16, st.hover ? PAL.slotDark2 : PAL.slotDark);
    icon(g, 'lock', x + 8, y + 4);
  }

  // convidar + ajustes
  const cb = bigButton(g, 'invite', 336, 274, 104, 18, '', {
    tip: 'CONVIDAR UM AMIGO', face: '#f0dcb0', hover: '#fff0cc', dark: PAL.creamDD, shine: '#fff8e8',
    onClick: () => {
      beep();
      const i = state.slots.findIndex(s => s.kind === 'empty');
      if (i < 0) { toast('A SALA ESTÁ CHEIA'); return; }
      toast('CONVITE ENVIADO!');
      later(1.2, () => { if (state.slots[i].kind === 'empty') addBot(i); });
    },
  });
  text(g, 'CONVIDAR', 388, 279 + cb.down, { align: 'center', color: PAL.woodDD });
  const gb = woodButton(g, 'room-gear', 444, 274, 24, 18, { tip: 'AJUSTES DA SALA', onClick: () => { beep(); openSettings(); } });
  gear(g, 456, 283 + gb.down, 5, '#d8dce4', '#7a808c');

  // iniciar
  const ib = bigButton(g, 'start', 336, 296, 132, 30, '', { tip: 'INICIAR BATALHA', onClick: startBattle });
  icon(g, 'swords', 343, 305 + ib.down);
  text(g, 'INICIAR BATALHA', 409, 306 + ib.down, { align: 'center', color: PAL.white, outline: PAL.goldDD, shadow: PAL.k });

  // atalhos
  const shortcuts = [
    { id: 'bag', icon: 'backpack', tip: 'MOCHILA' }, { id: 'mail', icon: 'mail', tip: 'CORREIO' },
    { id: 'trophy', icon: 'trophy', tip: 'RANKING' }, { id: 'shield', icon: 'shield', tip: 'GUILDA' },
  ];
  shortcuts.forEach((sct, i) => {
    const x = 338 + i * 33, y = 330;
    const st = woodButton(g, `sc-${sct.id}`, x, y, 26, 22, {
      tip: sct.tip, onClick: () => { beep(); if (sct.id === 'mail') state.unreadMail = false; toast(`${sct.tip} (PROTÓTIPO)`); },
    });
    icon(g, sct.icon, x + 8, y + (sct.icon === 'mail' ? 8 : 6) + st.down);
    if (sct.id === 'mail' && state.unreadMail) { ellipse(g, x + 23, y + 3, 3, 3, PAL.k); ellipse(g, x + 23, y + 3, 2, 2, PAL.red); }
  });
}

// ---------------------------------------------------------------- janelas

function openPicker() { state.modal = 'picker'; state.pick = state.slots[0].hero; }
function openSettings() { state.modal = 'settings'; }

function statBars(g, x, y, hero) {
  const names = ['DANO', 'ALCANCE', 'CRATERA', 'VIDA'];
  names.forEach((n, i) => {
    text(g, n, x, y + i * 9, { font: 3, color: PAL.woodD });
    for (let p = 0; p < 5; p++) {
      R(g, x + 34 + p * 11, y + i * 9 - 1, 10, 7, PAL.k);
      R(g, x + 35 + p * 11, y + i * 9, 8, 5, p < hero.stats[i] ? PAL.orange : PAL.creamD);
      if (p < hero.stats[i]) R(g, x + 35 + p * 11, y + i * 9, 8, 1, '#ffc070');
    }
  });
}

function drawPicker(g) {
  region('modal-block', 0, 0, W, H, { onClick: () => {} });
  g.fillStyle = 'rgba(16,8,4,0.7)'; g.fillRect(0, 0, W, H);
  const px = 50, py = 34, pw = 380, ph = 292;
  panel(g, px, py, pw, ph);
  header(g, px + 3, py + 3, pw - 6, 'ESCOLHA SEU HERÓI');
  const cb = woodButton(g, 'picker-close', px + pw - 16, py + 4, 11, 9, {
    tip: 'FECHAR', onClick: () => { state.modal = null; beep(400); }, face: ['#f05a48', PAL.red, PAL.redD], hoverFace: '#ff7a64', shine: '#ff9a8a',
  });
  drawMap(g, ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], { k: PAL.white }, px + pw - 13, py + 6 + cb.down);
  text(g, 'CADA HERÓI É ÚNICO E LUTA COM A PRÓPRIA ARMA. SEM PERSONALIZAÇÃO.', px + pw / 2, py + 18, { font: 3, align: 'center', color: PAL.woodD });
  // grade 3x2
  HEROES.forEach((h, i) => {
    const x = px + 10 + (i % 3) * 72, y = py + 28 + Math.floor(i / 3) * 128;
    const sel = state.pick === i;
    const st = region(`pick-${i}`, x, y, 68, 122, { onClick: () => { state.pick = i; beep(700 + i * 60); } });
    R(g, x, y, 68, 122, PAL.k);
    R(g, x + 1, y + 1, 66, 120, sel ? PAL.gold : st.hover ? PAL.woodL : PAL.woodD);
    R(g, x + 2, y + 2, 64, 118, PAL.cream);
    dither(g, x + 3, y + 3, 62, 92, [h.color, PAL.cream]);
    drawHero(g, h, x + 34, y + 92, 2, now, { phase: i * 0.5 });
    text(g, h.name, x + 34, y + 99, { align: 'center', color: PAL.ink });
    text(g, h.weapon, x + 34, y + 110, { font: 3, align: 'center', color: PAL.woodD });
  });
  // detalhes
  const h = HEROES[state.pick];
  const dx = px + 230, dy = py + 28, dw = 140;
  R(g, dx, dy, dw, 256, PAL.k);
  R(g, dx + 1, dy + 1, dw - 2, 254, PAL.creamD);
  dither(g, dx + 2, dy + 2, dw - 4, 100, ['#5a9ae8', '#a8d8f8', '#f6e8c8']);
  R(g, dx + 2, dy + 92, dw - 4, 10, '#5aa83a'); R(g, dx + 2, dy + 92, dw - 4, 1, '#8ee060');
  drawHero(g, h, dx + dw / 2, dy + 96, 3, now, { phase: 0.2 });
  text(g, h.name, dx + dw / 2, dy + 108, { align: 'center', scale: 2, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  text(g, h.title, dx + dw / 2, dy + 128, { font: 3, align: 'center', color: PAL.woodD });
  text(g, `ARMA: ${h.weapon}`, dx + 6, dy + 140, { font: 3, color: PAL.ink });
  statBars(g, dx + 6, dy + 152, h);
  text(g, `HABILIDADE: ${h.skill}`, dx + 6, dy + 192, { font: 3, color: '#a0401a' });
  wrap(h.desc, dw - 12, 3).forEach((l, k) => text(g, l, dx + 6, dy + 201 + k * 8, { font: 3, color: PAL.ink }));
  const taken = state.slots.some((s, i) => i > 0 && s.kind !== 'empty' && s.hero === state.pick);
  if (taken) text(g, 'OUTRO JOGADOR DA SALA JÁ USA', dx + dw / 2, dy + 222, { font: 3, align: 'center', color: PAL.red });
  const ok = bigButton(g, 'picker-ok', dx + 20, dy + 232, dw - 40, 18, '', {
    onClick: () => {
      if (taken) { beep(200, 0.12, 'sawtooth'); toast('ESSE HERÓI JÁ ESTÁ NA SALA'); return; }
      state.slots[0].hero = state.pick; state.modal = null; beep(990); beep(1480, 0.1);
      say('SISTEMA', 'SISTEMA', `VOCÊ ESCOLHEU ${h.name}.`);
    },
    face: taken ? '#c8b89a' : undefined, hover: taken ? '#d8c8aa' : undefined, dark: taken ? '#8a7a6a' : undefined,
  });
  text(g, 'ESCOLHER', dx + dw / 2, dy + 237 + ok.down, { align: 'center', color: PAL.white, outline: taken ? '#6a5a4a' : PAL.goldDD });
}

function drawSettings(g) {
  region('modal-block', 0, 0, W, H, { onClick: () => { state.modal = null; } });
  g.fillStyle = 'rgba(16,8,4,0.6)'; g.fillRect(0, 0, W, H);
  const px = 160, py = 120, pw = 160, ph = 90;
  region('settings-panel', px, py, pw, ph, { onClick: () => {} });
  panel(g, px, py, pw, ph);
  header(g, px + 3, py + 3, pw - 6, 'AJUSTES');
  const sb = bigButton(g, 'set-sound', px + 20, py + 26, pw - 40, 18, '', { onClick: () => { state.sound = !state.sound; beep(); } });
  text(g, state.sound ? 'SOM: LIGADO' : 'SOM: DESLIGADO', px + pw / 2, py + 31 + sb.down, { align: 'center', color: PAL.white, outline: PAL.goldDD });
  const cb = bigButton(g, 'set-close', px + 40, py + 56, pw - 80, 18, '', { onClick: () => { state.modal = null; beep(400); }, face: '#f0dcb0', hover: '#fff0cc', dark: PAL.creamDD, shine: '#fff8e8' });
  text(g, 'FECHAR', px + pw / 2, py + 61 + cb.down, { align: 'center', color: PAL.woodDD });
}

function startBattle() {
  const players = state.slots.filter(s => s.kind !== 'empty');
  if (players.length < 2) { beep(200, 0.12, 'sawtooth'); toast('CHAME PELO MENOS 1 JOGADOR (CLIQUE NO +)'); return; }
  if (players.some(s => !s.ready)) { beep(200, 0.12, 'sawtooth'); toast('AGUARDE TODOS FICAREM PRONTOS'); return; }
  state.countdown = now;
  beep(523, 0.15);
}

function drawCountdown(g) {
  const e = now - state.countdown;
  region('modal-block', 0, 0, W, H, {});
  g.fillStyle = `rgba(16,8,4,${Math.min(0.75, e)})`; g.fillRect(0, 0, W, H);
  const n = 3 - Math.floor(e);
  const prev = 3 - Math.floor(e - 1 / 60);
  if (n !== prev && n > 0) beep(523 + (3 - n) * 120, 0.15);
  if (n > 0) {
    const s = 6 + Math.max(0, Math.round((1 - (e % 1)) * 3));
    text(g, String(n), W / 2, H / 2 - 3.5 * s, { align: 'center', scale: s, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  } else if (e < 5) {
    if (prev > 0) { beep(784, 0.3); beep(1046, 0.4); }
    text(g, 'LUTA!', W / 2, H / 2 - 28, { align: 'center', scale: 8, color: '#ff6a3a', color2: PAL.red, outline: PAL.k, shadow: PAL.woodDD });
    text(g, 'PROTÓTIPO: A BATALHA EM PIXEL ART AINDA NÃO EXISTE.', W / 2, H / 2 + 36, { font: 3, align: 'center', color: PAL.cream, outline: PAL.k });
  } else state.countdown = null;
}

function drawToast(g) {
  if (!state.toast) return;
  const e = now - state.toast.at;
  if (e > 2.4) { state.toast = null; return; }
  const w = measure(state.toast.msg, 5) + 16;
  const y = 52 - Math.max(0, Math.round((e - 2) * 20));
  R(g, W / 2 - w / 2, y, w, 15, PAL.k);
  R(g, W / 2 - w / 2 + 1, y + 1, w - 2, 13, PAL.head);
  R(g, W / 2 - w / 2 + 1, y + 1, w - 2, 1, PAL.headL);
  text(g, state.toast.msg, W / 2, y + 4, { align: 'center', color: PAL.headText, shadow: PAL.k });
}

function drawTip(g) {
  if (!tip || drag || state.countdown != null) return;
  const lines = wrap(tip, 120, 3);
  const w = Math.max(...lines.map(l => measure(l, 3))) + 8, h = lines.length * 8 + 5;
  let x = Math.round(mouse.x + 8), y = Math.round(mouse.y + 12);
  if (x + w > W - 2) x = W - 2 - w;
  if (y + h > H - 2) y = Math.round(mouse.y - h - 4);
  R(g, x, y, w, h, PAL.k);
  R(g, x + 1, y + 1, w - 2, h - 2, '#2e1c10');
  lines.forEach((l, k) => text(g, l, x + 4, y + 4 + k * 8, { font: 3, color: PAL.cream }));
}

const CURSOR = ['k.........', 'kk........', 'kWk.......', 'kWWk......', 'kWWWk.....', 'kWWWWk....', 'kWWWWWk...', 'kWWWWWWk..', 'kWWWWkkkk.', 'kWkWWk....', 'kk.kWWk...', 'k...kWk...', '....kk....'];

function drawCursor(g) {
  if (mouse.x < 0) return;
  if (drag) icon(g, drag.item.icon, Math.round(mouse.x) - 5, Math.round(mouse.y) - 5);
  drawMap(g, CURSOR, { k: PAL.k, W: hoverId && regions.find(r => r.id === hoverId)?.onClick ? PAL.gold : PAL.white }, Math.round(mouse.x), Math.round(mouse.y));
}

function frame(ts) {
  now = ts / 1000;
  for (const t of state.timers.splice(0)) (t.at <= now ? t.fn() : state.timers.push(t));
  regions = []; tip = null;
  ctx.drawImage(STATIC, 0, 0);
  drawTopBar(ctx);
  drawSlots(ctx);
  drawFloorSign(ctx);
  drawArena(ctx);
  drawChat(ctx);
  drawRight(ctx);
  if (state.modal === 'picker') drawPicker(ctx);
  if (state.modal === 'settings') drawSettings(ctx);
  if (state.countdown != null) drawCountdown(ctx);
  drawToast(ctx);
  drawTip(ctx);
  drawCursor(ctx);
  // recalcula o alvo do mouse com as regiões deste quadro
  hoverId = pickRegion(mouse.x, mouse.y)?.id ?? null;
  requestAnimationFrame(frame);
}

buildStatic();
requestAnimationFrame(frame);
