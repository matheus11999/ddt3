#!/usr/bin/env node
// Servidor MCP (stdio, só local) que expõe o Codex CLI para o Claude Code.
// O Codex 0.163 tirou o `codex mcp-server`, então este servidor chama
// `codex exec` / `codex exec resume` do binário mais novo do app Codex.
// Ferramentas:
//   codex / codex_reply            conversa livre (nova / continuar pelo thread_id)
//   codex_image / codex_image_fix  arte do jogo: referências obrigatórias e conferidas,
//                                  regras do projeto, caminho exato, conferência da imagem
//                                  e histórico das versões anteriores.
// Uma tarefa por vez em todo o PC (trava em %TEMP%\codex-mcp.lock).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const IMAGES_DIR = path.join(os.homedir(), '.codex', 'generated_images');
const LOCK = path.join(os.tmpdir(), 'codex-mcp.lock');
const ROOT = process.env.DDT_ROOT ?? 'D:\\APPS\\ddt';
const TIMEOUT_MS = 15 * 60 * 1000;

const PROJECT_RULES = [
  'PROJECT RULES (Brasa Arena, a browser game in the art direction of DDTank):',
  '- Production 2D painted chibi game art like DDTank: rich painted volume, saturated colors, warm dark-brown outlines, soft top-left light. Never vector, flat, pixel art, photographic, 3D render, sketchy or childish.',
  '- The attached images are the source of truth for layout, scale, camera and style. Follow the templates/molds exactly; approved pieces are style references, never designs to copy unless the brief says so.',
  '- No text, letters, numbers, logos or watermarks anywhere in the image: the game draws all text.',
  '- Paint exactly what the brief asks and nothing else: no extra props, frames, guides, labels or shadows unless asked.',
  '- Character pieces are separate layers: never paint hair, hat, glasses, face or outfit together unless the brief asks for it. The neck belongs to the head and continues under the collar; no ground shadow or circle under the character.',
  '- In a sprite sheet every cell is the same character at the same size, angle and painting; on a mold, keep green head areas and magenta untouched and paint only over the gray/beige shapes, never wider.',
].join('\n');
const BACKGROUNDS = {
  alpha: 'BACKGROUND: fully transparent (real PNG alpha). If your tool returns an opaque background, remove it cleanly before saving.',
  magenta: 'BACKGROUND: flat pure magenta #FF00FF everywhere outside the painted pieces (the game cuts it out), with clean edges and no magenta fringes on the art.',
  opaque: 'BACKGROUND: opaque, painted as part of the image.',
};

function codexBin() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const root = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
  const found = [];
  try {
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      const p = d.isDirectory() ? path.join(root, d.name, 'codex.exe') : null;
      if (p && fs.existsSync(p)) found.push({ p, t: fs.statSync(p).mtimeMs });
    }
  } catch {}
  found.sort((a, b) => b.t - a.t);
  return found[0]?.p ?? 'codex';
}

function listImages() {
  const out = new Map();
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpe?g|webp)$/i.test(e.name)) out.set(p, fs.statSync(p).mtimeMs);
    }
  };
  walk(IMAGES_DIR);
  return out;
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function takeLock() {
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    if (held.pid !== process.pid && alive(held.pid)) return held;
  } catch {}
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, since: new Date().toISOString() }));
  return null;
}

function dropLock() {
  try {
    if (JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid === process.pid) fs.unlinkSync(LOCK);
  } catch {}
}

function runCodex(args, prompt, knownThread) {
  return new Promise((resolve) => {
    const lastFile = path.join(os.tmpdir(), `codex-mcp-${process.pid}-${Date.now()}.txt`);
    const before = listImages();
    const child = spawn(codexBin(), [...args, '--json', '-o', lastFile, '-'], { windowsHide: true });
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    let threadId = knownThread ?? null;
    const errors = [];
    let stderr = '';
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'thread.started') threadId = ev.thread_id;
        if (ev.type === 'error' || ev.type === 'turn.failed') errors.push(JSON.stringify(ev));
      } catch {}
    });
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
    child.stdin.end(prompt);
    child.on('error', (e) => errors.push(String(e)));
    child.on('close', (code) => {
      clearTimeout(timer);
      let last = '';
      try { last = fs.readFileSync(lastFile, 'utf8'); fs.unlinkSync(lastFile); } catch {}
      // Só as imagens desta conversa: o Codex salva em generated_images/<thread_id>/.
      const images = [...listImages()]
        .filter(([p, t]) => before.get(p) !== t && (!threadId || p.includes(threadId)))
        .map(([p]) => p);
      resolve({ code, threadId, last, images, errors, stderr });
    });
  });
}

async function withLock(fn) {
  const held = takeLock();
  if (held) throw new Error(`Codex ocupado (pid ${held.pid} desde ${held.since}); só uma tarefa por vez.`);
  try { return await fn(); } finally { dropLock(); }
}

function effortArgs(a) {
  const out = [];
  if (a.model) out.push('-m', a.model);
  out.push('-c', `model_reasoning_effort="${a.reasoning_effort ?? 'low'}"`);
  return out;
}

const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], isError });
const failText = (r) => (r.code !== 0 ? `código de saída: ${r.code}\n${r.errors.join('\n')}\n${r.stderr}` : '');

// ---------- conversa livre ----------

async function chat(name, a) {
  if (!a.prompt) throw new Error('prompt é obrigatório');
  const imgs = (a.images ?? []).flatMap((p) => ['-i', p]);
  let args;
  if (name === 'codex') {
    args = ['exec', '--skip-git-repo-check', '-s', a.sandbox ?? 'workspace-write',
      '-C', a.cwd ?? process.cwd(), '--add-dir', IMAGES_DIR];
    for (const d of a.add_dirs ?? []) args.push('--add-dir', d);
    args.push(...imgs, ...effortArgs(a));
  } else {
    if (!a.thread_id) throw new Error('thread_id é obrigatório');
    args = ['exec', 'resume', '--skip-git-repo-check', ...imgs, ...effortArgs(a), a.thread_id];
  }
  const r = await withLock(() => runCodex(args, a.prompt, a.thread_id));
  return text([
    r.last.trim() || '(sem resposta final)', '',
    `thread_id: ${r.threadId ?? a.thread_id ?? 'desconhecido'}`,
    r.images.length ? `imagens geradas:\n${r.images.join('\n')}` : 'imagens geradas: nenhuma',
    failText(r),
  ].join('\n').trim(), r.code !== 0);
}

// ---------- arte do jogo ----------

const readText = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const abs = (p) => (path.isAbsolute(p) ? path.normalize(p) : path.resolve(ROOT, p));
const sha = (p) => createHash('sha1').update(fs.readFileSync(p)).digest('hex');
const recordPath = (output) => output.replace(/\.[^.\\/]+$/, '') + '.codex.json';

function loadSharp() {
  try { return createRequire(path.join(ROOT, 'package.json'))('sharp'); } catch { return null; }
}

// Monta o pacote: prompt, referências (todas precisam existir) e caminho de saída.
function buildJob(a) {
  const jobDir = a.job_dir ? abs(a.job_dir) : null;
  let body = a.prompt ?? '';
  if (!body && a.prompt_file) body = readText(abs(a.prompt_file));
  if (!body && jobDir && fs.existsSync(path.join(jobDir, 'prompt.txt'))) body = readText(path.join(jobDir, 'prompt.txt'));
  if (!body.trim()) throw new Error('Falta o prompt: passe prompt, prompt_file ou job_dir com prompt.txt.');
  const named = [...body.matchAll(/exact path:\s*(\S+?)\s*\.?(?:\s|$)/gi)].map((m) => abs(m[1]));
  // A linha de salvar dos scripts de prompt sai daqui: o servidor escreve a sua no topo.
  body = body.split(/\r?\n/).filter((l) => !/^Use your image generation tool/i.test(l.trim())).join('\n');

  const refs = [...(a.refs ?? [])];
  const refsFile = a.refs_file ? abs(a.refs_file) : jobDir ? path.join(jobDir, 'refs.txt') : null;
  if (refsFile && fs.existsSync(refsFile)) {
    refs.push(...readText(refsFile).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
  }
  const resolved = [...new Set(refs.map(abs))];
  const missing = resolved.filter((p) => !fs.existsSync(p));
  if (missing.length) throw new Error(`Referências que não existem (nada foi gerado):\n${missing.join('\n')}`);
  if (!resolved.length && !a.no_refs) throw new Error('Nenhuma referência: anexe o molde e as peças aprovadas (refs, refs_file ou refs.txt no job_dir). Use no_refs: true só se a peça realmente não tem referência.');

  const output = a.output ? abs(a.output) : jobDir ? path.join(jobDir, `${path.basename(jobDir)}.png`) : null;
  if (!output) throw new Error('Falta output (caminho exato do PNG) ou job_dir.');
  if (!/\.png$/i.test(output)) throw new Error('output precisa terminar em .png');
  const wrong = named.filter((p) => p.toLowerCase() !== output.toLowerCase());
  if (wrong.length) throw new Error(`O prompt manda salvar em outro caminho (${wrong[0]}) e não em ${output}.`);

  const background = a.background ?? 'alpha';
  if (!BACKGROUNDS[background]) throw new Error('background: alpha, magenta ou opaque');
  return { body: body.trim(), refs: resolved, output, background, size: a.size ?? null, jobDir };
}

function framePrompt(job, body) {
  return [
    `Use your image generation tool to create exactly ONE image, then copy the resulting PNG to this exact path: ${job.output} . Do not create or edit any other file. When done, print the final file path.`,
    job.refs.length
      ? `ATTACHED IMAGES, in this order:\n${job.refs.map((p, i) => `IMAGE ${i + 1} = ${path.relative(ROOT, p) || p}`).join('\n')}\nStudy every attached image before painting.`
      : '',
    body,
    PROJECT_RULES,
    BACKGROUNDS[job.background],
    job.size ? `SIZE: the saved PNG must be exactly ${job.size[0]}x${job.size[1]} pixels (resize the result if needed).` : '',
  ].filter(Boolean).join('\n\n');
}

// Confere a imagem salva; devolve a lista de problemas e um resumo.
async function checkOutput(job, startedAt) {
  const problems = [];
  if (!fs.existsSync(job.output)) return { problems: ['A imagem não foi salva no caminho pedido.'], info: '' };
  if (fs.statSync(job.output).mtimeMs < startedAt) problems.push('O arquivo no caminho pedido é o antigo: o Codex não salvou a imagem nova.');
  const hash = sha(job.output);
  const same = job.refs.find((r) => sha(r) === hash);
  if (same) problems.push(`A imagem salva é cópia da referência ${same}.`);
  const sharp = loadSharp();
  if (!sharp) return { problems, info: '(sharp não encontrado: sem conferência de pixels)' };
  try {
    const img = sharp(job.output);
    const meta = await img.metadata();
    if (meta.format !== 'png') problems.push(`O arquivo é ${meta.format}, não PNG.`);
    if (job.size && (meta.width !== job.size[0] || meta.height !== job.size[1])) problems.push(`Tamanho ${meta.width}x${meta.height}, pedido ${job.size[0]}x${job.size[1]}.`);
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = info.width * info.height;
    let clear = 0, magenta = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) clear++;
      else if (data[i] > 215 && data[i + 1] < 60 && data[i + 2] > 215) magenta++;
    }
    const corner = (x, y) => { const i = (y * info.width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
    const corners = [corner(0, 0), corner(info.width - 1, 0), corner(0, info.height - 1), corner(info.width - 1, info.height - 1)];
    if (job.background === 'alpha') {
      if (!meta.hasAlpha || clear / px < 0.05) problems.push('Fundo não é transparente (quase nenhum pixel com alpha).');
      else if (corners.some((c) => c[3] > 40)) problems.push('Algum canto da imagem não é transparente (fundo mal removido?).');
      if (magenta / px > 0.01) problems.push('Sobrou magenta na imagem com fundo transparente.');
    }
    if (job.background === 'magenta' && corners.some((c) => !(c[0] > 215 && c[1] < 60 && c[2] > 215 && c[3] > 200))) problems.push('Os cantos não são magenta #FF00FF.');
    return { problems, info: `${meta.width}x${meta.height}, ${Math.round((clear / px) * 100)}% transparente, ${Math.round((magenta / px) * 100)}% magenta` };
  } catch (e) {
    problems.push(`Não consegui abrir a imagem: ${e.message}`);
    return { problems, info: '' };
  }
}

// Se o Codex gerou mas não gravou no destino, copia a imagem nova mais recente desta tarefa:
// primeiro um PNG novo na pasta de saída (ex.: salvo com outro nome), senão o da conversa em generated_images.
function rescueOutput(job, startedAt, generated) {
  if (fs.existsSync(job.output) && fs.statSync(job.output).mtimeMs >= startedAt) return null;
  const dir = path.dirname(job.output);
  const fresh = fs.readdirSync(dir)
    .filter((n) => /\.png$/i.test(n)).map((n) => path.join(dir, n))
    .concat(generated)
    .filter((p) => p !== job.output && fs.existsSync(p) && fs.statSync(p).mtimeMs >= startedAt)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!fresh.length) return null;
  fs.copyFileSync(fresh[0], job.output);
  return fresh[0];
}

// Guarda a versão atual antes de a próxima geração sobrescrever.
function keepVersion(output) {
  if (!fs.existsSync(output)) return null;
  const dir = path.join(path.dirname(output), '.versions');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const copy = path.join(dir, `${path.basename(output, '.png')}.${stamp}.png`);
  fs.copyFileSync(output, copy);
  return copy;
}

async function image(name, a) {
  let job, record, args, prompt;
  if (name === 'codex_image') {
    job = buildJob(a);
    prompt = framePrompt(job, job.body);
    args = ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', path.dirname(job.output),
      '--add-dir', IMAGES_DIR, ...job.refs.flatMap((p) => ['-i', p]), ...effortArgs(a)];
  } else {
    if (!a.prompt) throw new Error('prompt é obrigatório (o que corrigir)');
    const output = a.output ? abs(a.output) : a.job_dir ? path.join(abs(a.job_dir), `${path.basename(abs(a.job_dir))}.png`) : null;
    if (!output || !fs.existsSync(recordPath(output))) throw new Error('Não achei a geração anterior: passe o mesmo output ou job_dir usado no codex_image.');
    record = JSON.parse(fs.readFileSync(recordPath(output), 'utf8'));
    const extra = [...new Set((a.refs ?? []).map(abs))];
    const missing = extra.filter((p) => !fs.existsSync(p));
    if (missing.length) throw new Error(`Referências que não existem:\n${missing.join('\n')}`);
    job = { ...record, refs: [...record.refs, ...extra], size: a.size ?? record.size };
    prompt = [
      `CORRECTION of the image you saved at ${job.output}. Keep everything that is not mentioned below exactly the same (style, layout, scale, camera, colors); change only what is asked. Then copy the new PNG over the same exact path: ${job.output} .`,
      extra.length ? `NEW ATTACHED IMAGES:\n${extra.map((p, i) => `NEW IMAGE ${i + 1} = ${path.relative(ROOT, p) || p}`).join('\n')}` : '',
      a.prompt.trim(),
      'Remember the PROJECT RULES and the BACKGROUND rule of the first message.',
      job.size ? `SIZE: exactly ${job.size[0]}x${job.size[1]} pixels.` : '',
    ].filter(Boolean).join('\n\n');
    // `exec resume` não aceita -s/--add-dir: sem isso a correção não consegue gravar no destino (Acesso negado).
    const roots = JSON.stringify([path.dirname(job.output), IMAGES_DIR]);
    args = ['exec', 'resume', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"',
      '-c', `sandbox_workspace_write.writable_roots=${roots}`,
      ...extra.flatMap((p) => ['-i', p]), ...effortArgs(a), record.thread_id];
  }
  return withLock(async () => {
    const previous = keepVersion(job.output);
    const startedAt = Date.now();
    const r = await runCodex(args, prompt, record?.thread_id);
    const rescued = rescueOutput(job, startedAt, r.images);
    const check = await checkOutput(job, startedAt);
    if (rescued) check.info += `\n(o Codex não gravou no destino; o servidor copiou ${rescued})`;
    const rec = {
      thread_id: r.threadId ?? record?.thread_id, output: job.output, refs: job.refs, background: job.background, size: job.size,
      history: [...(record?.history ?? []), { at: new Date().toISOString(), tool: name, prompt: name === 'codex_image' ? job.body : a.prompt, previous, problems: check.problems }],
    };
    fs.writeFileSync(recordPath(job.output), JSON.stringify(rec, null, 2));
    if (name === 'codex_image') fs.writeFileSync(job.output.replace(/\.png$/i, '.prompt.txt'), prompt);
    const ok = r.code === 0 && check.problems.length === 0;
    return text([
      ok ? `PRONTO: ${job.output}` : `PROBLEMAS (${job.output}):\n- ${check.problems.join('\n- ') || 'o Codex falhou'}`,
      check.info,
      `referências anexadas: ${job.refs.length}`,
      previous ? `versão anterior guardada em: ${previous}` : '',
      `thread_id: ${rec.thread_id ?? 'desconhecido'} (corrija com codex_image_fix usando o mesmo output)`,
      `Codex disse: ${r.last.trim().slice(0, 600) || '(nada)'}`,
      'Abra a imagem e rode o validador da área antes de mostrar ao matheus.',
      failText(r),
    ].filter(Boolean).join('\n'), !ok);
  });
}

// ---------- MCP ----------

const effortProps = {
  model: { type: 'string', description: 'Modelo que conduz o Codex (padrão: o da config). A ferramenta de imagem é sempre a do Codex.' },
  reasoning_effort: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Padrão low.' },
};
const TOOLS = [
  {
    name: 'codex_image',
    description: 'Gera UMA imagem de arte do jogo pelo Codex local com o pacote de referências conferido. Recusa se faltar referência (anexe sempre o molde/template e peças aprovadas), anexa na ordem IMAGE 1..N com os nomes, junta as regras do projeto (estilo DDTank pintado, sem texto) e a regra de fundo, salva no caminho exato e confere a imagem (existe, é nova, PNG, fundo transparente/magenta, tamanho, não é cópia da referência). Guarda a versão anterior em .versions/ e o histórico em <saída>.codex.json. Aceita as pastas de scripts/cosmetic-prompts.mjs (job_dir com prompt.txt e refs.txt). Uma tarefa por vez; ~2 min.',
    inputSchema: {
      type: 'object',
      properties: {
        job_dir: { type: 'string', description: 'Pasta com prompt.txt e refs.txt (ex.: test-results/codex-cosmetics/<set>/<peça>); saída padrão <pasta>/<nome-da-pasta>.png.' },
        prompt: { type: 'string', description: 'Brief da peça (no lugar de prompt.txt).' },
        prompt_file: { type: 'string', description: 'Arquivo com o brief (ex.: /mnt/project-files/mapas/<tema>/prompts/x.txt copiado, docs/combat-art-prompts/walk.txt).' },
        refs: { type: 'array', items: { type: 'string' }, description: 'Imagens anexadas, na ordem IMAGE 1..N (caminhos relativos a D:\\APPS\\ddt ou absolutos). Primeiro o molde, depois as aprovadas.' },
        refs_file: { type: 'string', description: 'Arquivo com uma referência por linha (somado a refs).' },
        output: { type: 'string', description: 'Caminho exato do PNG.' },
        background: { type: 'string', enum: ['alpha', 'magenta', 'opaque'], description: 'alpha (padrão, cosméticos/ícones), magenta (folhas de peças de mapa/pet), opaque (fundos).' },
        size: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2, description: '[largura, altura] exigidos, se houver.' },
        no_refs: { type: 'boolean', description: 'Só se a peça não tem nenhuma referência.' },
        ...effortProps,
      },
    },
  },
  {
    name: 'codex_image_fix',
    description: 'Corrige uma imagem feita pelo codex_image na MESMA conversa do Codex (ele lembra do brief, das referências e da imagem anterior). Guarda a versão anterior e confere de novo. Diga só o que mudar.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        output: { type: 'string', description: 'O mesmo output do codex_image.' },
        job_dir: { type: 'string', description: 'Ou o mesmo job_dir.' },
        prompt: { type: 'string', description: 'O que corrigir.' },
        refs: { type: 'array', items: { type: 'string' }, description: 'Referências novas para a correção.' },
        size: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 },
        ...effortProps,
      },
    },
  },
  {
    name: 'codex',
    description: 'Conversa livre nova no Codex CLI local (login do ChatGPT). Para arte do jogo prefira codex_image. Devolve a resposta final, o thread_id e as imagens novas desta conversa em ~/.codex/generated_images. Uma tarefa por vez.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string' },
        images: { type: 'array', items: { type: 'string' }, description: 'Imagens para anexar.' },
        cwd: { type: 'string', description: 'Pasta de trabalho do Codex (onde ele pode escrever).' },
        sandbox: { type: 'string', enum: ['read-only', 'workspace-write'], description: 'Padrão workspace-write.' },
        add_dirs: { type: 'array', items: { type: 'string' }, description: 'Outras pastas onde ele pode escrever.' },
        ...effortProps,
      },
    },
  },
  {
    name: 'codex_reply',
    description: 'Continua uma conversa do codex pelo thread_id.',
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'prompt'],
      properties: { thread_id: { type: 'string' }, prompt: { type: 'string' }, images: { type: 'array', items: { type: 'string' } }, ...effortProps },
    },
  },
];

async function call(name, a) {
  if (name === 'codex' || name === 'codex_reply') return chat(name, a);
  if (name === 'codex_image' || name === 'codex_image_fix') return image(name, a);
  throw new Error(`ferramenta desconhecida: ${name}`);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
process.on('exit', dropLock);
readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'codex-local', version: '2.0.0' },
      } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const result = await call(params.name, params.arguments ?? {})
        .catch((e) => text(String(e.message ?? e), true));
      send({ jsonrpc: '2.0', id, result });
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `método desconhecido: ${method}` } });
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message ?? e) } });
  }
});

// Exportado só para testes locais (node -e "import(...)").
export { buildJob, checkOutput, framePrompt };
