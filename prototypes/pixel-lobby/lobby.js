// Sala de Batalha em pixel art (protótipo). Tudo é desenhado por código:
// nenhuma imagem é carregada. Tela lógica de 720x540 (cada pixel da arte vira
// 2x2 numa tela de 1080 de altura).

import { rng, mk, R, dither, drawMap, ellipse, PAL, text, measure, wrap, IP, ICONS, icon, gear } from './pixel.js';
import { HEROES, drawHero } from './heroes.js';

const W = 720, H = 540;
const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
ctx.imageSmoothingEnabled = false;

function fit() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  const s = k >= 1 ? Math.max(1, Math.floor(k * 2) / 2) : k;
  cv.style.width = `${W * s}px`;
  cv.style.height = `${H * s}px`;
}
addEventListener('resize', fit);
fit();

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
  { icon: 'explosion', name: 'Explosão', desc: '+50% de dano no próximo tiro.' },
  { icon: 'target', name: 'Mira', desc: 'Mostra a trajetória por um turno.' },
  { icon: 'dummy', name: 'Boneco', desc: 'Cria um alvo falso no campo.' },
  { icon: 'heal', name: 'Cura', desc: 'Recupera 30% da vida.' },
];
const OTHER_TOOLS = [
  { icon: 'rocket', name: 'Foguete', desc: 'Voa até onde o tiro cair.' },
  { icon: 'target', name: 'Tiro Certeiro', desc: 'O próximo tiro ignora o vento.' },
  { icon: 'dummyP', name: 'Boneco Sombrio', desc: 'Alvo falso que explode.' },
  { icon: 'fire', name: 'Chama', desc: 'O tiro deixa fogo no chão.' },
  { icon: 'crystal', name: 'Cristal de Gelo', desc: 'Congela o alvo por um turno.' },
  { icon: 'banana', name: 'Casca de Banana', desc: 'O inimigo escorrega ao andar.' },
  { icon: 'spike', name: 'Bomba de Espinhos', desc: 'Espalha espinhos ao cair.' },
  { icon: 'shield', name: 'Escudo', desc: 'Bloqueia o próximo dano.' },
  { icon: 'potion', name: 'Poção', desc: 'Recupera energia para andar.' },
  { icon: 'comet', name: 'Cometa', desc: 'Chuva de estrelas no alvo.' },
];

const BOT_NAMES = ['nuvenzinha', 'capitao_r', 'torkinho', 'luma.exe', 'brasinha22', 'pedrita', 'zerograu'];
const BOT_LINES = ['oi gente!', 'bora!', 'vamos nessa', 'esse mapa é bom', 'sem vento hoje?', 'pronto aqui', 'gg antes de começar'];

const state = {
  slots: [
    { kind: 'me', name: 'matheus119', lv: 30, hero: 0, host: true, ready: true, ping: 3 },
    { kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' },
  ],
  tab: 'Sala',
  chat: [
    { ch: 'Mundo', who: 'pedrita', text: 'alguém pra um 2x2?' },
    { ch: 'Mundo', who: 'zerograu', text: 'vendendo cristal de gelo no leilão' },
    { ch: 'Guilda', who: 'lider_brasa', text: 'GvG hoje às 21h!' },
    { ch: 'Info', who: '', text: 'Conversa da sala: só quem está nela (e na batalha) lê.' },
    { ch: 'Info', who: '', text: 'matheus119 entrou na sala.' },
  ],
  input: '', focus: false,
  extra: [null, null, null, null],
  modal: null, pick: 0,
  toast: null, countdown: null, sound: true,
  unreadMail: true, timers: [],
};

let now = 0;
function later(sec, fn) { state.timers.push({ at: now + sec, fn }); }
function toast(msg) { state.toast = { msg, at: now }; }
function say(ch, who, msg) { state.chat.push({ ch, who, text: msg }); if (state.chat.length > 60) state.chat.shift(); }
const pickOne = a => a[Math.floor(Math.random() * a.length)];

function addBot(i) {
  const used = new Set(state.slots.filter(s => s.kind !== 'empty').map(s => s.hero));
  const free = HEROES.map((_, k) => k).filter(k => !used.has(k));
  const hero = pickOne(free.length ? free : HEROES.map((_, k) => k));
  const name = pickOne(BOT_NAMES);
  const slot = { kind: 'bot', name, lv: 5 + Math.floor(Math.random() * 40), hero, ready: false, ping: 1 + Math.floor(Math.random() * 3) };
  state.slots[i] = slot;
  beep(880, 0.08); beep(1320, 0.08);
  say('Info', '', `${name} entrou na sala com ${HEROES[hero].name}.`);
  later(1.5 + Math.random() * 3, () => {
    if (state.slots[i] !== slot) return;
    slot.ready = true;
    beep(990, 0.05);
    if (Math.random() < 0.7) say('Sala', name, pickOne(BOT_LINES));
  });
}

function sendChat() {
  const msg = state.input.trim();
  if (msg) {
    say(state.tab, 'matheus119', msg);
    beep(520, 0.04);
    const bots = state.slots.filter(s => s.kind === 'bot');
    if (bots.length && state.tab === 'Sala' && Math.random() < 0.6) {
      const b = pickOne(bots);
      later(1 + Math.random() * 2, () => say('Sala', b.name, pickOne(BOT_LINES)));
    }
  }
  state.input = '';
  state.focus = false;
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
  else if (e.key.length === 1 && state.input.length < 60) state.input += e.key;
  e.preventDefault();
});

// ---------------------------------------------------------------- peças de interface

const CREAM = { k: PAL.k, a: PAL.woodD, b: PAL.woodL, c: PAL.woodDD };

function panel(g, x, y, w, h, fill = PAL.cream) {
  R(g, x, y, w, h, CREAM.k);
  R(g, x + 1, y + 1, w - 2, h - 2, CREAM.a);
  R(g, x + 1, y + 1, w - 2, 1, CREAM.b);
  R(g, x + 2, y + 2, w - 4, h - 4, CREAM.c);
  R(g, x + 3, y + 3, w - 6, h - 6, fill);
  // cantos arredondados
  for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) R(g, cx, cy, 1, 1, '#2a160c');
}

function header(g, x, y, w, label, o = {}) {
  R(g, x, y, w, 15, PAL.k);
  R(g, x + 1, y + 1, w - 2, 13, PAL.head);
  R(g, x + 1, y + 1, w - 2, 1, PAL.headL);
  if (o.left) text(g, label, x + 6, y + 4, { color: PAL.headText, shadow: PAL.k });
  else text(g, label, x + w / 2, y + 4, { align: 'center', color: PAL.headText, shadow: PAL.k });
}

function rivet(g, x, y) {
  R(g, x, y, 4, 4, PAL.stoneD);
  R(g, x, y, 3, 3, PAL.stoneL);
  R(g, x + 1, y + 1, 2, 2, PAL.stone);
}

function wood(g, x, y, w, h, seed = 1, plank = 12) {
  const r = rng(seed);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  R(g, x, y, w, h, PAL.wood);
  for (let py = y; py < y + h; py += plank) {
    R(g, x, py, w, 1, PAL.woodL);
    R(g, x, py + plank - 1, w, 1, PAL.woodDD);
    R(g, x, py + plank - 2, w, 1, PAL.woodD);
    for (let i = 0; i < w / 4; i++) {
      const gx = x + Math.floor(r() * w), gy = py + 2 + Math.floor(r() * (plank - 5)), gl = 4 + Math.floor(r() * 14);
      R(g, gx, gy, gl, 1, r() < 0.6 ? PAL.woodD : PAL.woodL);
    }
    let jx = x + Math.floor(r() * 60);
    while (jx < x + w) { R(g, jx, py + 1, 1, plank - 2, PAL.woodDD); R(g, jx + 1, py + 1, 1, plank - 2, PAL.woodL); jx += 60 + Math.floor(r() * 80); }
  }
  g.restore();
}

function framed(g, x, y, w, h) {
  R(g, x, y, w, 1, PAL.k); R(g, x, y + h - 1, w, 1, PAL.k); R(g, x, y, 1, h, PAL.k); R(g, x + w - 1, y, 1, h, PAL.k);
  R(g, x + 1, y + 1, w - 2, 1, PAL.woodLL);
}

function woodButton(g, id, x, y, w, h, o = {}) {
  const st = region(id, x, y, w, h, o);
  const down = st.press ? 1 : 0;
  const face = o.face || [PAL.woodL, PAL.wood, PAL.woodD];
  R(g, x, y, w, h, PAL.k);
  R(g, x + 1, y + 1, w - 2, h - 2, face[2]);
  R(g, x + 1, y + 1 + down, w - 2, h - 4, st.hover ? o.hoverFace || face[0] : face[1]);
  R(g, x + 2, y + 2 + down, w - 4, 1, o.shine || PAL.woodLL);
  return { ...st, down };
}

function bigButton(g, id, x, y, w, h, o = {}) {
  const st = region(id, x, y, w, h, o);
  const down = st.press ? 2 : 0;
  R(g, x, y + 2, w, h - 2, PAL.k);
  R(g, x, y + down, w, h - 2, PAL.k);
  R(g, x + 1, y + 1 + down, w - 2, h - 4, o.dark || PAL.goldD);
  dither(g, x + 1, y + 1 + down, w - 2, h - 8, st.hover ? [o.hover2 || '#fff0a0', o.hover || '#ffe066'] : [o.shine || '#fff4b8', o.face || PAL.gold]);
  R(g, x + 2, y + 2 + down, w - 4, 1, '#ffffff');
  return { ...st, down };
}

function slotBox(g, x, y, s, o = {}) {
  R(g, x, y, s, s, PAL.k);
  R(g, x + 1, y + 1, s - 2, s - 2, o.rim || PAL.blueD);
  dither(g, x + 2, y + 2, s - 4, s - 4, o.fills || ['#4a86d8', PAL.blue]);
  R(g, x + 2, y + 2, s - 4, 1, PAL.blueL);
  if (o.hover) { R(g, x, y, s, 1, PAL.gold); R(g, x, y + s - 1, s, 1, PAL.gold); R(g, x, y, 1, s, PAL.gold); R(g, x + s - 1, y, 1, s, PAL.gold); }
}

function itemBox(g, x, y, s, hover) {
  R(g, x, y, s, s, PAL.creamDD);
  R(g, x + 1, y + 1, s - 2, s - 2, hover ? '#fff6dc' : '#f9ecd0');
  R(g, x + 1, y + s - 2, s - 2, 1, PAL.creamD);
  if (hover) { R(g, x, y, s, 1, PAL.goldD); R(g, x, y + s - 1, s, 1, PAL.goldD); R(g, x, y, 1, s, PAL.goldD); R(g, x + s - 1, y, 1, s, PAL.goldD); }
}

function dashedSlot(g, x, y, s, hover) {
  R(g, x, y, s, s, hover ? '#f6e2b4' : '#efdcb4');
  g.fillStyle = hover ? PAL.goldD : PAL.creamDD;
  for (let i = 0; i < s; i += 4) {
    g.fillRect(x + i, y, 2, 1); g.fillRect(x + i, y + s - 1, 2, 1);
    g.fillRect(x, y + i, 1, 2); g.fillRect(x + s - 1, y + i, 1, 2);
  }
}

const ARROW_L = ['...k', '..kk', '.kkk', 'kkkk', '.kkk', '..kk', '...k'];
const ARROW_R = ['k...', 'kk..', 'kkk.', 'kkkk', 'kkk.', 'kk..', 'k...'];
const CROSS = ['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'];

// ---------------------------------------------------------------- camada fixa

let STATIC = null, BANNER = null, ARENA = null, waterfalls = [];

function vineAt(g, r, pts) {
  const leaf = (x, y) => {
    const c1 = r() < 0.5 ? '#4f9a2e' : '#3a7a22';
    R(g, x, y, 4, 3, c1); R(g, x + 1, y - 1, 2, 1, c1); R(g, x + 1, y + 3, 2, 1, '#2a5a18');
    if (r() < 0.4) R(g, x + 1, y, 2, 1, '#7cc04a');
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
      R(g, x, y, 1, 1, '#2f6a1c');
      if (s % 4 === 0) leaf(x + (r() < 0.5 ? -4 : 1), y + (r() < 0.5 ? -3 : 1));
    }
  }
}

function bush(g, r, cx, cy, n) {
  for (let i = 0; i < n; i++) {
    const x = cx + Math.floor((r() - 0.5) * 30), y = cy + Math.floor((r() - 0.5) * 16);
    ellipse(g, x, y, 5 + Math.floor(r() * 4), 3 + Math.floor(r() * 3), r() < 0.5 ? '#3a7a22' : '#4f9a2e');
    R(g, x - 2, y - 2, 3, 1, '#7cc04a');
  }
}

function island(g, cx, cy, rw, rh, r, o = {}) {
  for (let y = 0; y < rh; y++) {
    const k = 1 - y / rh;
    const w = Math.round(rw * Math.pow(k, 0.65));
    for (let x = -w; x <= w; x++) {
      const n = r();
      g.fillStyle = Math.abs(x) > w - 2 ? '#4a3a30' : n < 0.12 ? '#6a5242' : n < 0.28 ? '#a08060' : x > w * 0.3 ? '#705646' : '#856a54';
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  for (let x = -rw - 1; x <= rw + 1; x++) {
    const h = 4 + Math.round(1.5 * Math.sin(x * 0.6) + r() * 2);
    R(g, cx + x, cy - 3, 1, h, '#4fa83a');
    R(g, cx + x, cy - 3, 1, 1, '#9ae866');
    if (r() < 0.3) R(g, cx + x, cy + h - 3, 1, 2, '#2f7a22');
  }
  if (o.castle != null) castle(g, cx + o.castle, cy - 3, o.cs || 1);
  if (o.tree != null) tree(g, cx + o.tree, cy - 3);
}

function castle(g, x, y, s = 1) {
  const S = v => Math.round(v * s);
  R(g, x - S(10), y - S(16), S(20), S(16), '#d8d0c4'); R(g, x - S(10), y - S(16), S(20), 1, '#f0e8dc');
  R(g, x + S(4), y - S(16), S(6), S(16), '#b8b0a4');
  for (const tx of [x - S(15), x + S(9)]) {
    R(g, tx, y - S(24), S(6), S(24), '#c8c0b4'); R(g, tx + S(4), y - S(24), S(2), S(24), '#a8a094');
    for (let i = 0; i < S(9); i++) R(g, tx - S(1) + Math.floor(i / 2), y - S(25) - i, S(8) - i, 1, i < 2 ? PAL.redD : PAL.red);
    R(g, tx + S(2), y - S(18), S(2), S(3), '#4a3a30');
  }
  R(g, x - S(3), y - S(8), S(6), S(8), '#5a4232');
  for (let i = -S(10); i < S(10); i += S(4)) R(g, x + i, y - S(18), S(2), S(2), '#d8d0c4');
  R(g, x + S(11), y - S(36), 1, S(6), '#4a3a30'); R(g, x + S(12), y - S(36), S(4), S(3), PAL.red);
}

function tree(g, x, y) {
  R(g, x, y - 8, 3, 8, '#6a4424'); R(g, x + 2, y - 8, 1, 8, '#4a2c14');
  ellipse(g, x + 1, y - 12, 7, 5, '#2f7a22'); ellipse(g, x, y - 13, 5, 3, '#4fa83a'); R(g, x - 3, y - 15, 3, 1, '#8ee060');
}

function buildBanner() {
  const [c, g] = mk(308, 40);
  dither(g, 0, 0, 308, 40, ['#3d7fd6', '#7ab8ee', '#cfe8f8']);
  g.fillStyle = '#8fa8cc';
  for (let x = 0; x < 308; x++) { const h = 14 + Math.round(8 * Math.sin(x / 19) + 4 * Math.sin(x / 7.3)); g.fillRect(x, 40 - h, 1, h); }
  g.fillStyle = '#e8eef6';
  for (let x = 0; x < 308; x++) { const h = 14 + Math.round(8 * Math.sin(x / 19) + 4 * Math.sin(x / 7.3)); if (h > 22) g.fillRect(x, 40 - h, 1, Math.min(3, h - 22)); }
  g.fillStyle = '#5a9a4a';
  for (let x = 0; x < 308; x++) { const h = 6 + Math.round(3 * Math.sin(x / 11 + 1)); g.fillRect(x, 40 - h, 1, h); }
  castle(g, 154, 36, 1.2);
  castle(g, 110, 38, 0.6); castle(g, 200, 38, 0.6);
  const r = rng(9);
  for (let i = 0; i < 50; i++) R(g, Math.floor(r() * 308), 32 + Math.floor(r() * 8), 2, 1, '#3f7a34');
  return c;
}

function buildArena(w, h) {
  const [c, g] = mk(w, h);
  dither(g, 0, 0, w, h, ['#2f6ed0', '#5a9ae8', '#9ad0f6', '#e8f4fa']);
  ellipse(g, 200, 64, 12, 12, '#fff6c8'); ellipse(g, 200, 64, 9, 9, '#ffe680');
  // montanhas e castelos ao fundo
  g.fillStyle = '#9ab6de';
  for (let x = 0; x < w; x++) { const hh = 50 + Math.round(16 * Math.sin(x / 23) + 7 * Math.sin(x / 9)); g.fillRect(x, 190 - hh, 1, hh); }
  g.fillStyle = '#b8d0ec';
  for (let x = 0; x < w; x++) { const hh = 26 + Math.round(9 * Math.sin(x / 13 + 2)); g.fillRect(x, 190 - hh, 1, hh); }
  const r = rng(77);
  island(g, 34, 96, 22, 30, r, { castle: 0, cs: 0.8 });
  island(g, 222, 90, 24, 32, r, { castle: 2, cs: 0.9 });
  island(g, 128, 128, 16, 18, r, { tree: -4 });
  island(g, 82, 70, 9, 12, r, { tree: 0 });
  island(g, 176, 140, 10, 12, r);
  // ponte de pedra ao fundo
  for (let x = 40; x < 214; x++) {
    const arch = Math.abs(Math.sin(((x - 40) / 174) * Math.PI * 3)) * 8;
    R(g, x, 150, 1, 6, '#a8a498'); R(g, x, 150, 1, 1, '#d0ccc0');
    R(g, x, 156, 1, Math.max(0, 8 - Math.round(arch)), '#8a8678');
  }
  // penhascos da frente, onde ficam os heróis
  island(g, 58, 214, 62, 70, r);
  island(g, 198, 214, 62, 70, r);
  bush(g, r, 16, 214, 6); bush(g, r, 238, 214, 6);
  waterfalls = [{ x: 44, y: 98, h: 50 }, { x: 236, y: 92, h: 58 }, { x: 122, y: 218, h: 60 }, { x: 132, y: 218, h: 60 }];
  return c;
}

function buildStatic() {
  const [c, g] = mk(W, H);
  wood(g, 0, 0, W, H, 7, 14);
  framed(g, 0, 0, W, H);
  R(g, 10, 62, W - 20, H - 70, PAL.woodDD);
  R(g, 11, 63, W - 22, H - 72, '#3a2012');
  for (const [x, y] of [[4, 4], [W - 8, 4], [4, H - 8], [W - 8, H - 8], [4, 270], [W - 8, 270], [180, H - 7], [360, H - 7], [540, H - 7]]) rivet(g, x, y);

  const r = rng(42);
  vineAt(g, r, [[0, 70], [8, 100], [3, 140], [9, 180], [3, 220]]);
  vineAt(g, r, [[W - 1, 70], [W - 9, 110], [W - 3, 150], [W - 8, 200]]);
  vineAt(g, r, [[0, H - 60], [8, H - 30], [40, H - 5], [100, H - 8]]);
  vineAt(g, r, [[W - 1, H - 70], [W - 9, H - 40], [W - 60, H - 4]]);
  bush(g, r, 12, H - 12, 7); bush(g, r, W - 14, H - 14, 7);

  // placa do título
  wood(g, 14, 8, 236, 48, 3, 12);
  framed(g, 14, 8, 236, 48);
  rivet(g, 18, 12); rivet(g, 242, 12); rivet(g, 18, 48); rivet(g, 242, 48);
  {
    const [sc, sg] = mk(11, 11);
    drawMap(sg, ['.kkkkkkkkk.', 'kNNNNNNNNNk', 'kNWNNNNNNnk', 'kNNNNNNNNnk', 'kNNNNNNNNnk', 'kNNNNNNNNnk', '.kNNNNNNnk.', '.kNNNNNNnk.', '..knNNNnk..', '...knnnk...', '....kkk....'], IP, 0, 0);
    g.drawImage(sc, 22, 13, 33, 33);
    icon(g, 'swords', 28, 18, 2);
  }
  text(g, 'SALA DE BATALHA', 62, 22, { scale: 2, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });

  // faixa do topo
  BANNER = buildBanner();
  R(g, 254, 8, 316, 48, PAL.k);
  R(g, 255, 9, 314, 46, PAL.goldD);
  R(g, 256, 10, 312, 44, PAL.woodDD);

  ARENA = buildArena(254, 282);

  // piso de tijolos
  {
    const x0 = 14, y0 = 432, w = 250, h = 100;
    R(g, x0, y0, w, h, '#45454e');
    for (let row = 0; row * 10 < h; row++) {
      const off = row % 2 ? 0 : -10;
      for (let bx = off; bx < w; bx += 20) {
        const sx = Math.max(x0, x0 + bx + 1), ex = Math.min(x0 + w, x0 + bx + 20);
        if (ex <= sx) continue;
        const shade = ['#7f838c', '#8b8f98', '#767a83', '#969aa3'][(row * 7 + bx) & 3];
        R(g, sx, y0 + row * 10 + 1, ex - sx - 1, 8, shade);
        R(g, sx, y0 + row * 10 + 1, ex - sx - 1, 1, '#aeb2ba');
        R(g, sx, y0 + row * 10 + 8, ex - sx - 1, 1, '#62666e');
      }
    }
    R(g, x0, y0, w, 3, 'rgba(0,0,0,0.35)');
    rivet(g, 18, 436); rivet(g, 256, 436);
  }

  // coluna direita: painéis fixos
  panel(g, 538, 66, 168, 50, '#4a2c18');
  panel(g, 538, 120, 168, 68);
  panel(g, 538, 192, 168, 142);
  text(g, 'Arraste os itens para o slot acima', 622, 314, { align: 'center', color: PAL.woodD });
  panel(g, 538, 338, 168, 50);

  // chat
  panel(g, 270, 376, 262, 120);

  STATIC = c;
}

// ---------------------------------------------------------------- desenho por quadro

const clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 52, y: 8 + (i * 23) % 70, s: 0.7 + (i % 3) * 0.35 }));

function cloud(g, x, y, s = 1) {
  x = Math.round(x); y = Math.round(y);
  ellipse(g, x, y + 1, Math.round(9 * s), Math.round(4 * s), '#c8dcf0');
  ellipse(g, x - Math.round(6 * s), y - 1, Math.round(6 * s), Math.round(3 * s), '#ffffff');
  ellipse(g, x + Math.round(4 * s), y - Math.round(3 * s), Math.round(7 * s), Math.round(4 * s), '#ffffff');
}

function torch(g, x, y) {
  R(g, x + 3, y + 9, 4, 18, PAL.woodDD); R(g, x + 3, y + 9, 1, 18, PAL.woodD);
  R(g, x, y + 8, 10, 4, PAL.stoneD); R(g, x, y + 8, 10, 1, PAL.stoneL);
  const f = Math.floor(now * 10) % 3;
  const flames = [
    ['...R...', '..ROR..', '.ROYOR.', 'ROYYYOR', 'ROYWYOR', '.ROYOR.', '..RRR..'],
    ['..R....', '..RR...', '.ROOR..', 'ROYYOR.', 'ROYWYOR', '.ROYOR.', '..RRR..'],
    ['....R..', '...RR..', '..ROOR.', '.ROYYOR', 'ROYWYOR', '.ROYOR.', '..RRR..'],
  ];
  drawMap(g, flames[f], IP, x + 1, y + 1);
  g.fillStyle = 'rgba(255,170,60,0.10)';
  g.beginPath(); g.arc(x + 5, y + 4, 18, 0, Math.PI * 2); g.fill();
}

function drawTopBar(g) {
  g.drawImage(BANNER, 258, 12);
  g.save(); g.beginPath(); g.rect(258, 12, 308, 40); g.clip();
  for (const c of clouds) cloud(g, 258 + ((c.x + now * 4 * c.s) % 360) - 26, 14 + (c.y % 14), 0.8);
  g.restore();
  // estandartes
  for (const bx of [270, 540]) {
    R(g, bx - 2, 10, 18, 3, PAL.woodDD);
    const wave = Math.floor(now * 3) % 2;
    R(g, bx, 13, 14, 30, PAL.k);
    R(g, bx + 1, 13, 12, 29, PAL.blue); R(g, bx + 1, 13, 3, 29, PAL.blueL); R(g, bx + 10, 13, 2, 29, PAL.blueD);
    R(g, bx + 1, 41 + wave, 5, 4, PAL.blue); R(g, bx + 8, 41 + (1 - wave), 5, 4, PAL.blue);
    R(g, bx, 41 + wave, 1, 4, PAL.k); R(g, bx + 13, 41 + (1 - wave), 1, 4, PAL.k);
    drawMap(g, ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '..Y.Y..'], IP, bx + 4, 23);
  }
  const tops = [
    { id: 'top-gear', x: 584, draw: (x, y) => gear(g, x + 19, y + 19, 9, '#e0e4ec', '#7a808c'), tip: 'Ajustes', fn: () => openSettings() },
    { id: 'top-friends', x: 628, draw: (x, y) => icon(g, 'friends', x + 9, y + 11, 2), tip: 'Amigos', fn: () => toast('Lista de amigos (protótipo)') },
    { id: 'top-exit', x: 672, red: true, draw: (x, y) => icon(g, 'exit', x + 9, y + 10, 2), tip: 'Sair da sala', fn: () => toast('Sair da sala (protótipo)') },
  ];
  for (const b of tops) {
    const st = woodButton(g, b.id, b.x, 12, 40, 40, {
      tip: b.tip, onClick: () => { beep(); b.fn(); },
      face: b.red ? ['#f05a48', PAL.red, PAL.redD] : undefined, hoverFace: b.red ? '#ff7a64' : undefined, shine: b.red ? '#ff9a8a' : undefined,
    });
    b.draw(b.x, 12 + st.down);
  }
  torch(g, 1, 64);
  torch(g, W - 12, 64);
}

const SLOT_POS = [[14, 66], [141, 66], [14, 248], [141, 248]];

function drawSlots(g) {
  state.slots.forEach((s, i) => {
    const [x, y] = SLOT_POS[i];
    const w = 123, h = 178;
    if (s.kind === 'empty') {
      const st = region(`slot-${i}`, x, y, w, h, { tip: 'Adicionar um bot', onClick: () => addBot(i) });
      panel(g, x, y, w, h, st.hover ? '#4a3628' : PAL.slotDark);
      text(g, `Vaga ${i + 1}`, x + 8, y + 8, { color: '#f0dcb0', shadow: PAL.k });
      R(g, x + 6, y + 20, w - 12, h - 26, PAL.k);
      R(g, x + 7, y + 21, w - 14, h - 28, st.hover ? '#3e2c22' : '#2e2018');
      g.globalAlpha = 0.18;
      icon(g, 'swords', x + 26, y + 34, 7, IP);
      g.globalAlpha = 1;
      const cx = x + 61, cy = y + 84;
      const ring = st.hover ? PAL.gold : '#e9d3a5';
      ellipse(g, cx, cy, 16, 16, PAL.k);
      ellipse(g, cx, cy, 15, 15, ring);
      ellipse(g, cx, cy, 12, 12, st.hover ? '#6a4a2a' : '#4a3426');
      R(g, cx - 1, cy - 8, 3, 17, ring); R(g, cx - 8, cy - 1, 17, 3, ring);
      text(g, 'Aguardando', cx, y + 112, { align: 'center', color: '#e2cfa4', shadow: PAL.k });
      text(g, 'jogador...', cx, y + 123, { align: 'center', color: '#e2cfa4', shadow: PAL.k });
      return;
    }
    const hero = HEROES[s.hero];
    const isMe = s.kind === 'me';
    const st = region(`slot-${i}`, x, y, w, h, { tip: isMe ? 'Clique para trocar de herói' : `${hero.name}: ${hero.weapon}`, onClick: () => { if (isMe) openPicker(); } });
    R(g, x, y, w, h, PAL.k);
    R(g, x + 1, y + 1, w - 2, h - 2, isMe ? '#f0a028' : PAL.woodD);
    R(g, x + 2, y + 2, w - 4, h - 4, isMe ? PAL.goldD : PAL.woodDD);
    R(g, x + 3, y + 3, w - 6, h - 6, PAL.cream);
    // cabeçalho com nome, coroa e nível
    R(g, x + 3, y + 3, w - 6, 16, '#7a4a24'); R(g, x + 3, y + 3, w - 6, 1, '#9a6234');
    const wName = text(g, s.name, x + 8, y + 8, { color: PAL.white, shadow: PAL.k });
    if (s.host) icon(g, 'crown', x + 11 + wName, y + 8);
    R(g, x + w - 36, y + 6, 30, 11, PAL.k); R(g, x + w - 35, y + 7, 28, 9, '#c88a2a');
    text(g, `Lv. ${s.lv}`, x + w - 21, y + 9, { align: 'center', color: PAL.white, outline: '#7a4a10' });
    // fundo e herói
    dither(g, x + 3, y + 19, w - 6, 118, [PAL.cream, '#f0dcae', '#e6c896']);
    g.globalAlpha = 0.25;
    icon(g, 'swords', x + 76, y + 104, 3, IP);
    g.globalAlpha = 1;
    drawHero(g, hero, x + 58, y + 132, 1.2, now, { phase: i * 0.7 });
    // medalhas
    R(g, x + w - 26, y + 24, 20, 13, PAL.k); R(g, x + w - 25, y + 25, 18, 11, '#5a6a8a');
    text(g, String(10 + i * 7).padStart(2, '0'), x + w - 16, y + 28, { align: 'center', color: PAL.white });
    icon(g, 'rank', x + w - 21, y + 42);
    // herói, arma e estado
    R(g, x + 3, y + 137, w - 6, 1, PAL.creamDD);
    text(g, hero.name, x + w / 2, y + 141, { align: 'center', color: PAL.ink });
    text(g, hero.weapon, x + w / 2, y + 151, { align: 'center', color: PAL.woodD });
    const ready = s.ready || isMe;
    const label = isMe ? 'Dono' : ready ? 'Pronto' : 'Esperando';
    R(g, x + 30, y + 162, 60, 12, PAL.k);
    R(g, x + 31, y + 163, 58, 10, isMe ? PAL.orange : ready ? PAL.green : PAL.gray);
    R(g, x + 31, y + 163, 58, 1, isMe ? '#ffb060' : ready ? PAL.greenL : '#aa9a8a');
    text(g, label, x + 60, y + 165, { align: 'center', color: PAL.white, outline: isMe ? PAL.orangeD : ready ? PAL.greenD : '#5a4a3a' });
    for (let b = 0; b < 4; b++) R(g, x + w - 22 + b * 4, y + 172 - b * 3, 3, 3 + b * 3, b < s.ping + 1 ? PAL.green : PAL.creamDD);
    const near = hoverId === `slot-${i}` || (hoverId || '').startsWith(isMe ? 'slot-arrow' : `slot-kick-${i}`);
    if (isMe && near) {
      for (const [dir, ax] of [[-1, x + 6], [1, x + w - 20]]) {
        const ab = woodButton(g, `slot-arrow-${dir}`, ax, y + 70, 14, 20, {
          tip: dir < 0 ? 'Herói anterior' : 'Próximo herói',
          onClick: () => { s.hero = (s.hero + dir + HEROES.length) % HEROES.length; beep(740); },
        });
        drawMap(g, dir < 0 ? ARROW_L : ARROW_R, { k: PAL.cream }, ax + 5, y + 76 + ab.down);
      }
    }
    if (s.kind === 'bot' && near) {
      const xb = woodButton(g, `slot-kick-${i}`, x + 6, y + 24, 13, 13, {
        tip: 'Tirar da sala', onClick: () => { say('Info', '', `${s.name} saiu da sala.`); state.slots[i] = { kind: 'empty' }; beep(330); },
        face: ['#f05a48', PAL.red, PAL.redD], hoverFace: '#ff7a64', shine: '#ff9a8a',
      });
      drawMap(g, CROSS, { k: PAL.white }, x + 10, y + 28 + xb.down);
    }
  });
}

function drawFloorSign(g) {
  const me = state.slots[0];
  const hero = HEROES[me.hero];
  for (const cx of [70, 208]) for (let y = 432; y < 446; y += 3) { R(g, cx, y, 2, 2, PAL.stoneL); R(g, cx + 1, y + 1, 1, 1, PAL.stoneD); }
  wood(g, 26, 446, 226, 80, 11, 13);
  framed(g, 26, 446, 226, 80);
  rivet(g, 30, 450); rivet(g, 244, 450); rivet(g, 30, 518); rivet(g, 244, 518);
  text(g, 'Seu herói', 139, 452, { align: 'center', color: PAL.gold, outline: PAL.k });
  text(g, hero.name, 139, 464, { align: 'center', scale: 2, color: PAL.white, color2: '#ffe6b0', outline: PAL.k, shadow: PAL.woodDD });
  text(g, hero.weapon, 139, 484, { align: 'center', color: '#ffe6b0', outline: PAL.woodDD });
  for (const [dir, ax] of [[-1, 36], [1, 220]]) {
    const ab = woodButton(g, `sign-arrow-${dir}`, ax, 462, 22, 24, {
      tip: dir < 0 ? 'Herói anterior' : 'Próximo herói',
      onClick: () => { me.hero = (me.hero + dir + HEROES.length) % HEROES.length; beep(740); },
    });
    drawMap(g, dir < 0 ? ARROW_L : ARROW_R, { k: PAL.cream }, ax + 9, 470 + ab.down);
  }
  const vb = bigButton(g, 'sign-all', 94, 498, 90, 20, { tip: 'Ver todos os heróis', onClick: () => { beep(); openPicker(); } });
  text(g, 'Ver todos', 139, 504 + vb.down, { align: 'center', color: PAL.goldDD });
}

function drawArena(g) {
  const x0 = 274, y0 = 70;
  panel(g, 270, 66, 262, 290);
  g.drawImage(ARENA, x0, y0);
  g.save(); g.beginPath(); g.rect(x0, y0, 254, 282); g.clip();
  for (const c of clouds) cloud(g, x0 + ((c.x * 1.4 + now * 3 * c.s) % 300) - 24, y0 + 74 + c.y, c.s * 1.2);
  for (const f of waterfalls) {
    for (let y = 0; y < f.h; y++) {
      const k = (y + Math.floor(now * 16)) % 8;
      R(g, x0 + f.x, y0 + f.y + y, 4, 1, k < 2 ? '#ffffff' : k < 5 ? '#b8e8ff' : '#6ac0f0');
      R(g, x0 + f.x + 4, y0 + f.y + y, 1, 1, '#4a9ad8');
    }
    const s = Math.floor(now * 6) % 2;
    ellipse(g, x0 + f.x + 2, y0 + f.y + f.h, 4 + s, 2, '#ffffff');
  }
  // os dois heróis se enfrentando
  const tork = HEROES[2], luma = HEROES[3];
  drawHero(g, tork, x0 + 60, y0 + 214, 1.6, now, { phase: 0.3 });
  drawHero(g, luma, x0 + 196, y0 + 214, 1.6, now, { phase: 1.1, flip: true });
  // tiro em arco de tempos em tempos
  const p = (now % 3.2) / 1.6;
  const sx = x0 + 110, sy = y0 + 174, ex = x0 + 168, ey = y0 + 168;
  if (p < 1) {
    for (let k = 0; k < 8; k++) {
      const q = Math.max(0, p - k * 0.025);
      const bx = sx + (ex - sx) * q, by = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 52;
      const s = k ? Math.max(1, 3 - Math.floor(k / 3)) : 5;
      R(g, Math.round(bx) - (s >> 1), Math.round(by) - (s >> 1), s, s, k ? `rgba(255,${210 - k * 16},80,${0.85 - k * 0.09})` : '#3a2a20');
    }
    if (p < 0.12) { ellipse(g, sx, sy, 6, 4, '#ffe080'); ellipse(g, sx, sy, 3, 2, '#ffffff'); }
  } else if (p < 1.3) {
    const s = Math.floor((p - 1) * 30);
    ellipse(g, ex, ey, 4 + s, 3 + Math.floor(s * 0.7), 'rgba(255,200,90,0.75)');
    ellipse(g, ex, ey, 2 + Math.floor(s / 2), 1 + Math.floor(s / 3), '#ffffff');
  }
  g.restore();
  // logotipo BATALHA PvP
  const lx = x0 + 127;
  wood(g, lx - 70, y0 + 16, 140, 56, 5, 14);
  framed(g, lx - 70, y0 + 16, 140, 56);
  rivet(g, lx - 66, y0 + 20); rivet(g, lx + 62, y0 + 20); rivet(g, lx - 66, y0 + 64); rivet(g, lx + 62, y0 + 64);
  for (const bx of [lx - 82, lx + 70]) {
    R(g, bx, y0 + 22, 12, 34, PAL.k); R(g, bx + 1, y0 + 22, 10, 33, PAL.blue); R(g, bx + 1, y0 + 22, 3, 33, PAL.blueL);
    R(g, bx + 1, y0 + 52, 4, 6, PAL.blue); R(g, bx + 7, y0 + 52, 4, 6, PAL.blue);
  }
  icon(g, 'swords', lx - 10, y0 + 2, 2);
  text(g, 'BATALHA', lx, y0 + 26, { align: 'center', scale: 2, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  text(g, 'PVP', lx, y0 + 46, { align: 'center', scale: 2, color: '#ff7a3a', color2: PAL.red, outline: PAL.k, shadow: PAL.woodDD });
  // faixa de baixo
  const by = y0 + 228;
  R(g, x0 + 14, by, 226, 48, PAL.k);
  R(g, x0 + 15, by + 1, 224, 46, PAL.goldD);
  R(g, x0 + 17, by + 3, 220, 42, PAL.navy);
  R(g, x0 + 17, by + 3, 220, 1, '#3a5aa0');
  text(g, 'ENTRE NO CAMPO DE BATALHA', lx, by + 8, { align: 'center', color: PAL.gold, outline: PAL.k });
  text(g, 'Mostre sua força, estratégia', lx, by + 21, { align: 'center', color: '#e6eeff' });
  text(g, 'e seja o último de pé!', lx, by + 32, { align: 'center', color: '#e6eeff' });
}

const TABS = ['Mundo', 'Sala', 'Guilda', 'Privado'];

function drawChat(g) {
  TABS.forEach((t, i) => {
    const x = 276 + i * 62, y = 360, w = 60;
    const active = state.tab === t;
    const st = region(`tab-${t}`, x, y, w, 17, { onClick: () => { state.tab = t; beep(600, 0.03); } });
    const top = active ? 0 : 2;
    R(g, x, y + top, w, 17 - top, PAL.k);
    R(g, x + 1, y + 1 + top, w - 2, 16 - top, active ? PAL.orange : st.hover ? PAL.woodL : PAL.woodD);
    R(g, x + 1, y + 1 + top, w - 2, 1, active ? '#ffb060' : PAL.woodL);
    text(g, t, x + w / 2, y + 6 + top / 2, { align: 'center', color: active ? PAL.white : PAL.cream, outline: active ? PAL.orangeD : PAL.woodDD });
  });
  const box = { x: 277, y: 382, w: 248, h: 108 };
  R(g, box.x - 1, box.y - 1, box.w + 2, box.h + 2, '#fffaf0');
  const colorOf = { Sala: '#c0501a', Mundo: '#2a6ab0', Guilda: '#2a8a3a', Privado: '#a02a90', Info: '#2f8a3a' };
  const visible = state.chat.filter(m => m.ch === state.tab || m.ch === 'Info' || m.ch === 'Privado');
  const lines = [];
  for (const m of visible) {
    const prefix = m.who ? `${m.who}: ` : '';
    wrap(`${prefix}${m.text}`, box.w - 6, 5).forEach((p, k) => lines.push({ p, k, prefix, m }));
  }
  const max = Math.floor(box.h / 11);
  lines.slice(-max).forEach((l, row) => {
    const y = box.y + row * 11 + 3;
    if (l.k === 0 && l.prefix) {
      const wName = text(g, l.m.who + ':', box.x + 3, y, { color: colorOf[l.m.ch] });
      text(g, l.p.slice(l.prefix.length), box.x + 3 + wName + 4, y, { color: PAL.ink });
    } else text(g, l.p, box.x + 3, y, { color: l.m.ch === 'Info' && !l.prefix ? colorOf.Info : PAL.ink });
  });
  // campo de digitar
  const st = region('chat-input', 270, 500, 200, 24, { onClick: () => { state.focus = true; } });
  R(g, 270, 500, 200, 24, PAL.k);
  R(g, 271, 501, 198, 22, state.focus ? '#fffaf0' : st.hover ? '#fbf0d8' : '#f3e4c4');
  R(g, 271, 501, 198, 1, PAL.creamDD);
  if (state.input || state.focus) {
    let shown = state.input;
    while (measure(shown, 5) > 188) shown = shown.slice(1);
    const wTxt = text(g, shown, 277, 509, { color: PAL.ink });
    if (state.focus && Math.floor(now * 2) % 2) R(g, 278 + wTxt + 1, 507, 1, 10, PAL.ink);
  } else text(g, 'Digite sua mensagem...', 277, 509, { color: '#b49a74' });
  const eb = bigButton(g, 'chat-emoji', 476, 500, 26, 24, { tip: 'Emojis', onClick: () => { state.input += ' :)'; state.focus = true; beep(); } });
  const ey = 511 + eb.down;
  ellipse(g, 489, ey, 7, 7, PAL.k); ellipse(g, 489, ey, 6, 6, '#ffe060'); ellipse(g, 488, ey - 2, 3, 2, '#fff4a0');
  R(g, 486, ey - 2, 2, 2, PAL.k); R(g, 491, ey - 2, 2, 2, PAL.k); R(g, 486, ey + 2, 1, 1, PAL.k); R(g, 492, ey + 2, 1, 1, PAL.k); R(g, 487, ey + 3, 5, 1, PAL.k);
  const sb = bigButton(g, 'chat-send', 506, 500, 26, 24, { tip: 'Enviar', onClick: sendChat });
  drawMap(g, ICONS.send, { k: PAL.goldDD, W: PAL.goldDD }, 515, 506 + sb.down);
}

function drawRight(g) {
  // sala
  text(g, 'SALA', 560, 78, { color: '#ffe6b0', outline: PAL.k });
  text(g, '143', 590, 72, { scale: 3, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: '#2a160c' });
  icon(g, 'scroll', 668, 74, 2);
  R(g, 544, 98, 156, 14, '#3a2012');
  text(g, 'SALA DE MATHEUS119', 548, 102, { color: '#ffe6b0', outline: PAL.k });
  const pb = woodButton(g, 'room-edit', 684, 97, 16, 16, { tip: 'Mudar o nome da sala', onClick: () => { beep(); toast('Nome da sala (protótipo)'); } });
  icon(g, 'pencil', 688, 101 + pb.down);

  // minhas ferramentas
  header(g, 541, 123, 102, 'Minhas ferramentas', { left: true });
  R(g, 643, 123, 60, 15, PAL.k); R(g, 644, 124, 58, 13, '#f9d878');
  text(g, '1 USO POR', 673, 126, { font: 3, align: 'center', color: PAL.goldDD });
  text(g, 'HABILIDADE', 673, 132, { font: 3, align: 'center', color: PAL.goldDD });
  MY_TOOLS.forEach((t, i) => {
    const x = 546 + i * 40, y = 146;
    const st = region(`my-${i}`, x, y, 34, 34, { tip: `${t.name}: ${t.desc}` });
    slotBox(g, x, y, 34, { hover: st.hover });
    icon(g, t.icon, x + 7, y + 7, 2);
    R(g, x + 1, y + 1, 9, 9, PAL.k); R(g, x + 2, y + 2, 7, 7, '#2a3a6a');
    text(g, String(i + 1), x + 6, y + 3, { font: 3, align: 'center', color: PAL.white });
  });

  // outras ferramentas
  text(g, 'OUTRAS FERRAMENTAS', 546, 200, { color: PAL.woodDD });
  R(g, 660, 203, 40, 1, PAL.creamDD);
  OTHER_TOOLS.forEach((t, i) => {
    const x = 546 + (i % 5) * 31, y = 212 + Math.floor(i / 5) * 31;
    const st = region(`other-${i}`, x, y, 28, 28, { tip: `${t.name}: ${t.desc} Arraste para um slot livre.`, drag: t });
    itemBox(g, x, y, 28, st.hover);
    if (!(drag && drag.item === t)) icon(g, t.icon, x + 4, y + 4, 2);
  });
  state.extra.forEach((t, i) => {
    const x = 550 + i * 38, y = 276;
    const st = region(`extra-${i}`, x, y, 30, 30, {
      tip: t ? `${t.name} (clique para tirar)` : 'Solte um item aqui',
      onDrop: item => {
        const j = state.extra.indexOf(item);
        if (j >= 0) state.extra[j] = null;
        state.extra[i] = item; beep(880, 0.05);
      },
      onClick: () => { if (state.extra[i]) { state.extra[i] = null; beep(440, 0.04); } },
    });
    if (t) { itemBox(g, x, y, 30, st.hover); icon(g, t.icon, x + 5, y + 5, 2); }
    else dashedSlot(g, x, y, 30, st.hover);
  });

  // espectadores
  drawMap(g, ['..kkkk..', '.kWWWWk.', 'kWWkkWWk', 'kWkCCkWk', 'kWWkkWWk', '.kWWWWk.', '..kkkk..'], { ...IP, C: '#3a8ac8' }, 546, 344);
  text(g, 'ESPECTADORES', 558, 344, { color: PAL.woodDD });
  for (let i = 0; i < 3; i++) {
    const x = 546 + i * 52, y = 357;
    const st = region(`spec-${i}`, x, y, 48, 26, { tip: 'Vaga de espectador trancada', onClick: () => { beep(300); toast('Vagas de espectador trancadas'); } });
    dashedSlot(g, x, y, 48, false);
    R(g, x + 1, y + 1, 46, 24, st.hover ? '#f6e2b4' : '#efdcb4');
    icon(g, 'lock', x + 19, y + 8);
  }

  // convidar e ajustes
  const cb = bigButton(g, 'invite', 538, 394, 132, 26, {
    tip: 'Convidar um amigo', face: '#e8d2a4', shine: '#fff4dc', hover: '#f6e2b8', hover2: '#fffaf0', dark: PAL.creamDD,
    onClick: () => {
      beep();
      const i = state.slots.findIndex(s => s.kind === 'empty');
      if (i < 0) { toast('A sala está cheia'); return; }
      toast('Convite enviado!');
      later(1.2, () => { if (state.slots[i].kind === 'empty') addBot(i); });
    },
  });
  icon(g, 'friends', 566, 401 + cb.down);
  text(g, 'Convidar', 612, 402 + cb.down, { align: 'center', color: PAL.woodDD, scale: 1 });
  const gb = woodButton(g, 'room-gear', 674, 394, 32, 26, { tip: 'Ajustes da sala', onClick: () => { beep(); openSettings(); } });
  gear(g, 690, 406 + gb.down, 7, '#e0e4ec', '#7a808c');

  // iniciar
  const ib = bigButton(g, 'start', 538, 426, 168, 44, { tip: 'Iniciar batalha', onClick: startBattle });
  icon(g, 'swords', 548, 435 + ib.down, 2);
  text(g, 'INICIAR BATALHA', 632, 441 + ib.down, { align: 'center', scale: 1, color: '#5a2806', shadow: '#ffeaa0' });

  // atalhos
  const shortcuts = [
    { id: 'bag', icon: 'backpack', tip: 'Mochila' }, { id: 'mail', icon: 'mail', tip: 'Correio' },
    { id: 'trophy', icon: 'trophy', tip: 'Ranking' }, { id: 'shield', icon: 'shield', tip: 'Guilda' },
  ];
  shortcuts.forEach((sct, i) => {
    const x = 538 + i * 43, y = 478;
    const st = woodButton(g, `sc-${sct.id}`, x, y, 39, 44, {
      tip: sct.tip, onClick: () => { beep(); if (sct.id === 'mail') state.unreadMail = false; toast(`${sct.tip} (protótipo)`); },
    });
    icon(g, sct.icon, x + 9, y + (sct.icon === 'mail' ? 15 : 11) + st.down, 2);
    if (sct.id === 'mail' && state.unreadMail) { ellipse(g, x + 34, y + 5, 5, 5, PAL.k); ellipse(g, x + 34, y + 5, 4, 4, PAL.red); R(g, x + 32, y + 3, 2, 1, '#ff9a8a'); }
  });
}

// ---------------------------------------------------------------- janelas

function openPicker() { state.modal = 'picker'; state.pick = state.slots[0].hero; }
function openSettings() { state.modal = 'settings'; }

function statBars(g, x, y, hero) {
  ['Dano', 'Alcance', 'Cratera', 'Vida'].forEach((n, i) => {
    const yy = y + i * 12;
    text(g, n, x, yy, { color: PAL.woodD });
    for (let p = 0; p < 5; p++) {
      R(g, x + 50 + p * 16, yy - 1, 14, 9, PAL.k);
      R(g, x + 51 + p * 16, yy, 12, 7, p < hero.stats[i] ? PAL.orange : PAL.creamD);
      if (p < hero.stats[i]) R(g, x + 51 + p * 16, yy, 12, 2, '#ffc070');
    }
  });
}

function drawPicker(g) {
  region('modal-block', 0, 0, W, H, { onClick: () => {} });
  g.fillStyle = 'rgba(16,8,4,0.72)'; g.fillRect(0, 0, W, H);
  const px = 56, py = 34, pw = 608, ph = 472;
  panel(g, px, py, pw, ph);
  header(g, px + 3, py + 3, pw - 6, 'ESCOLHA SEU HERÓI');
  const cb = woodButton(g, 'picker-close', px + pw - 20, py + 4, 15, 13, {
    tip: 'Fechar', onClick: () => { state.modal = null; beep(400); }, face: ['#f05a48', PAL.red, PAL.redD], hoverFace: '#ff7a64', shine: '#ff9a8a',
  });
  drawMap(g, CROSS, { k: PAL.white }, px + pw - 15, py + 8 + cb.down);
  text(g, 'Cada herói é único e luta com a própria arma. Sem personalização.', px + pw / 2, py + 24, { align: 'center', color: PAL.woodD });
  HEROES.forEach((h, i) => {
    const x = px + 12 + (i % 3) * 124, y = py + 40 + Math.floor(i / 3) * 214;
    const sel = state.pick === i;
    const st = region(`pick-${i}`, x, y, 118, 206, { onClick: () => { state.pick = i; beep(700 + i * 60); } });
    R(g, x, y, 118, 206, PAL.k);
    R(g, x + 1, y + 1, 116, 204, sel ? PAL.gold : st.hover ? PAL.woodL : PAL.woodD);
    R(g, x + 2, y + 2, 114, 202, sel ? PAL.goldD : PAL.woodDD);
    R(g, x + 3, y + 3, 112, 200, PAL.cream);
    dither(g, x + 3, y + 3, 112, 150, [h.color, '#fbefd4', PAL.cream]);
    drawHero(g, h, x + 59, y + 150, 1.5, now, { phase: i * 0.5 });
    text(g, h.name, x + 59, y + 160, { align: 'center', scale: 2, color: PAL.ink });
    text(g, h.weapon, x + 59, y + 182, { align: 'center', color: PAL.woodD });
  });
  const h = HEROES[state.pick];
  const dx = px + 386, dy = py + 40, dw = 210, dh = 420;
  R(g, dx, dy, dw, dh, PAL.k);
  R(g, dx + 1, dy + 1, dw - 2, dh - 2, '#efdcb4');
  dither(g, dx + 2, dy + 2, dw - 4, 168, ['#3d7fd6', '#7ab8ee', '#d8eef8']);
  for (const c of clouds.slice(0, 3)) cloud(g, dx + 20 + ((c.x + now * 5) % (dw - 30)), dy + 20 + c.y % 50, 1);
  R(g, dx + 2, dy + 160, dw - 4, 12, '#4fa83a'); R(g, dx + 2, dy + 160, dw - 4, 2, '#9ae866');
  drawHero(g, h, dx + dw / 2, dy + 166, 1.9, now, { phase: 0.2 });
  text(g, h.name, dx + dw / 2, dy + 180, { align: 'center', scale: 3, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  text(g, h.title, dx + dw / 2, dy + 208, { align: 'center', color: PAL.woodD });
  text(g, `Arma: ${h.weapon}`, dx + 10, dy + 226, { color: PAL.ink });
  statBars(g, dx + 10, dy + 244, h);
  text(g, `Habilidade: ${h.skill}`, dx + 10, dy + 300, { color: '#a0401a' });
  wrap(h.desc, dw - 20, 5).forEach((l, k) => text(g, l, dx + 10, dy + 314 + k * 11, { color: PAL.ink }));
  const taken = state.slots.some((s, i) => i > 0 && s.kind !== 'empty' && s.hero === state.pick);
  if (taken) text(g, 'Outro jogador da sala já usa', dx + dw / 2, dy + 356, { align: 'center', color: PAL.red });
  const ok = bigButton(g, 'picker-ok', dx + 30, dy + 372, dw - 60, 32, {
    onClick: () => {
      if (taken) { beep(200, 0.12, 'sawtooth'); toast('Esse herói já está na sala'); return; }
      state.slots[0].hero = state.pick; state.modal = null; beep(990); beep(1480, 0.1);
      say('Info', '', `Você escolheu ${h.name}.`);
    },
    face: taken ? '#c8b89a' : undefined, shine: taken ? '#e0d4bc' : undefined, dark: taken ? '#8a7a6a' : undefined,
  });
  text(g, 'ESCOLHER', dx + dw / 2, dy + 383 + ok.down, { align: 'center', color: taken ? '#6a5a4a' : '#5a2806', shadow: '#ffeaa0' });
}

function drawSettings(g) {
  region('modal-block', 0, 0, W, H, { onClick: () => { state.modal = null; } });
  g.fillStyle = 'rgba(16,8,4,0.6)'; g.fillRect(0, 0, W, H);
  const px = 250, py = 190, pw = 220, ph = 130;
  region('settings-panel', px, py, pw, ph, { onClick: () => {} });
  panel(g, px, py, pw, ph);
  header(g, px + 3, py + 3, pw - 6, 'AJUSTES');
  const sb = bigButton(g, 'set-sound', px + 30, py + 36, pw - 60, 28, { onClick: () => { state.sound = !state.sound; beep(); } });
  text(g, state.sound ? 'Som: ligado' : 'Som: desligado', px + pw / 2, py + 46 + sb.down, { align: 'center', color: '#5a2806' });
  const cb = bigButton(g, 'set-close', px + 60, py + 80, pw - 120, 26, { onClick: () => { state.modal = null; beep(400); }, face: '#e8d2a4', shine: '#fff4dc', hover: '#f6e2b8', hover2: '#fffaf0', dark: PAL.creamDD });
  text(g, 'Fechar', px + pw / 2, py + 89 + cb.down, { align: 'center', color: PAL.woodDD });
}

function startBattle() {
  const players = state.slots.filter(s => s.kind !== 'empty');
  if (players.length < 2) { beep(200, 0.12, 'sawtooth'); toast('Chame pelo menos 1 jogador (clique no +)'); return; }
  if (players.some(s => !s.ready)) { beep(200, 0.12, 'sawtooth'); toast('Aguarde todos ficarem prontos'); return; }
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
    const s = 9 + Math.max(0, Math.round((1 - (e % 1)) * 4));
    text(g, String(n), W / 2, H / 2 - 3.5 * s, { align: 'center', scale: s, color: PAL.gold, color2: '#f09a20', outline: PAL.k, shadow: PAL.woodDD });
  } else if (e < 5) {
    if (prev > 0) { beep(784, 0.3); beep(1046, 0.4); }
    text(g, 'LUTA!', W / 2, H / 2 - 40, { align: 'center', scale: 12, color: '#ff6a3a', color2: PAL.red, outline: PAL.k, shadow: PAL.woodDD });
    text(g, 'Protótipo: a batalha em pixel art ainda não existe.', W / 2, H / 2 + 52, { align: 'center', color: PAL.cream, outline: PAL.k });
  } else state.countdown = null;
}

function drawToast(g) {
  if (!state.toast) return;
  const e = now - state.toast.at;
  if (e > 2.4) { state.toast = null; return; }
  const w = measure(state.toast.msg, 5) + 24;
  const y = 70 - Math.max(0, Math.round((e - 2) * 30));
  R(g, W / 2 - w / 2, y, w, 20, PAL.k);
  R(g, W / 2 - w / 2 + 1, y + 1, w - 2, 18, PAL.head);
  R(g, W / 2 - w / 2 + 1, y + 1, w - 2, 1, PAL.headL);
  text(g, state.toast.msg, W / 2, y + 7, { align: 'center', color: PAL.headText, shadow: PAL.k });
}

function drawTip(g) {
  if (!tip || drag || state.countdown != null) return;
  const lines = wrap(tip, 170, 5);
  const w = Math.max(...lines.map(l => measure(l, 5))) + 10, h = lines.length * 11 + 7;
  let x = Math.round(mouse.x + 10), y = Math.round(mouse.y + 14);
  if (x + w > W - 2) x = W - 2 - w;
  if (y + h > H - 2) y = Math.round(mouse.y - h - 4);
  R(g, x, y, w, h, PAL.k);
  R(g, x + 1, y + 1, w - 2, h - 2, '#2e1c10');
  R(g, x + 1, y + 1, w - 2, 1, '#4a3020');
  lines.forEach((l, k) => text(g, l, x + 5, y + 5 + k * 11, { color: PAL.cream }));
}

const CURSOR = ['k..........', 'kk.........', 'kWk........', 'kWWk.......', 'kWWWk......', 'kWWWWk.....', 'kWWWWWk....', 'kWWWWWWk...', 'kWWWWWWWk..', 'kWWWWWkkkk.', 'kWWkWWk....', 'kWk.kWWk...', 'kk..kWWk...', 'k....kWWk..', '.....kkk...'];

function drawCursor(g) {
  if (mouse.x < 0) return;
  if (drag) icon(g, drag.item.icon, Math.round(mouse.x) - 10, Math.round(mouse.y) - 10, 2);
  const clickable = hoverId && regions.find(r => r.id === hoverId)?.onClick;
  drawMap(g, CURSOR, { k: PAL.k, W: clickable ? PAL.gold : PAL.white }, Math.round(mouse.x), Math.round(mouse.y));
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
  hoverId = pickRegion(mouse.x, mouse.y)?.id ?? null;
  requestAnimationFrame(frame);
}

buildStatic();
requestAnimationFrame(frame);
