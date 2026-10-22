// Roda um job pelo servidor MCP local (mesmo caminho que as ferramentas codex_image/codex_image_fix).
// Uso: node output/kit-v5-mcp/run-job.mjs <id> [texto da correção]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [id, fix] = process.argv.slice(2);
const dir = `output/kit-v5-mcp/${id}`;
const { background, size } = JSON.parse(fs.readFileSync(`${dir}/job.json`, 'utf8').replace(/^\uFEFF/, ''));
const args = fix ? { name: 'codex_image_fix', arguments: { job_dir: dir, prompt: fix } }
  : { name: 'codex_image', arguments: { job_dir: dir, background, size, reasoning_effort: 'medium' } };
const srv = spawn('node', ['C:/Users/Alienware/.claude/mcp/codex-mcp.mjs'], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
srv.stdout.on('data', (d) => {
  buf += d;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines.filter(Boolean)) {
    const m = JSON.parse(line);
    if (m.id === 2) { console.log(m.result.content[0].text); srv.kill(); }
  }
});
srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'kit', version: '1' } } }) + '\n');
srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: args }) + '\n');
