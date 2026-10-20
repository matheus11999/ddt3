// FPS along the path the owner plays (docs/performance.md, "Caminho completo"): plaza -> Pescaria -> leave ->
// Arena hall -> practice battle (shot) -> leave -> plaza -> Pescaria again, with PLAYERS bots walking in the plaza and
// the Pescaria. For each step: frames per second, JS per frame, long tasks and the functions with most CPU time.
// Best against the production build: npm run build && npx vite preview --port 5178, then
// BASE=http://127.0.0.1:5178 npx tsx scripts/perf-flow.mjs [pasta]
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import {writeFile,mkdir} from 'node:fs/promises';
import {enterGame,startPractice} from './character-helpers.mjs';
import {FISHING_WALK} from '../shared/fishing.ts';
import {LOBBY_WALK} from '../shared/lobby.ts';
const base=process.env.BASE??'http://127.0.0.1:5177',out=process.argv[2]??'test-results/perf-flow',count=Number(process.env.PLAYERS??12),ms=Number(process.env.SAMPLE??4000);
await mkdir(out,{recursive:true});
const bots=[];
for(let n=0;n<count;n++){
 const r=await fetch(`${base}/api/session`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:n%2?'female':'male'})});
 const socket=new WebSocket(`${base.replace(/^http/,'ws')}/ws`,{origin:base,headers:{Cookie:r.headers.get('set-cookie').split(';')[0]}});
 await new Promise(ok=>socket.on('open',ok));const send=v=>socket.readyState===1&&socket.send(JSON.stringify(v));socket.on('message',()=>{});
 const zone=n%2?'fishing':'plaza';if(zone==='fishing')send({type:'zone',zone});bots.push({send,zone,socket});
}
const wander=setInterval(()=>{for(const b of bots){const w=b.zone==='fishing'?FISHING_WALK:LOBBY_WALK;b.send({type:'move',x:w.minX+Math.random()*(w.maxX-w.minX),y:b.zone==='fishing'?w.minY+Math.random()*(w.maxY-w.minY):undefined});}},1500);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium'});
const page=await browser.newPage({viewport:{width:1536,height:864},deviceScaleFactor:1});
await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__frames=[];window.__long=[];
 window.requestAnimationFrame=cb=>raf(t=>{const a=performance.now();cb(t);window.__frames.push([a,performance.now()-a]);});
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push(e.duration);}).observe({type:'longtask',buffered:false});}catch{}});
const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
const lines=[];
async function sample(name){
 await page.evaluate(()=>{window.__frames=[];window.__long=[];});await cdp.send('Profiler.start');const t0=Date.now();await page.waitForTimeout(ms);const {profile}=await cdp.send('Profiler.stop');
 const {frames,long}=await page.evaluate(()=>({frames:window.__frames,long:window.__long}));
 // Frames painted by the game: rAF callbacks that ran (several callbacks per frame are merged by timestamp).
 const stamps=[...new Set(frames.map(f=>Math.round(f[0])))],js=frames.reduce((s,f)=>s+f[1],0);
 const self=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));let busy=0;
 for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]),f=n.callFrame;const d=(profile.timeDeltas[i]??0)/1000;if(f.functionName!=='(idle)'&&f.functionName!=='(program)')busy+=d;const k=`${f.functionName||'(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber+1}`;self.set(k,(self.get(k)??0)+d);}
 const top=[...self].filter(([k])=>!k.startsWith('(idle)')&&!k.startsWith('(program)')).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`   ${v.toFixed(0).padStart(5)}ms ${k}`);
 const line=`== ${name}: ${(frames.length/ms*1000).toFixed(0)} chamadas/s, JS ${(js/Math.max(1,frames.length)).toFixed(1)} ms/quadro, CPU JS ${(busy/(Date.now()-t0)*100).toFixed(0)}%, tarefas longas ${long.length} (máx ${Math.round(Math.max(0,...long))} ms)\n${top.join('\n')}`;
 console.log(line);lines.push(line);await writeFile(`${out}/${name}.cpuprofile`,JSON.stringify(profile));
}
await enterGame(page,base);await page.waitForTimeout(4000);
await sample('1-praca');
await page.keyboard.down('ArrowRight');await sample('2-praca-andando');await page.keyboard.up('ArrowRight');
await page.locator('.lobby-dock-button.fishing').click();await expect(page.locator('.fishing-hud')).toBeVisible();await page.waitForTimeout(3000);
await sample('3-pescaria');
await page.keyboard.down('ArrowRight');await sample('4-pescaria-andando');await page.keyboard.up('ArrowRight');
await page.locator('.fishing-exit').click();await expect(page.locator('.lobby-dock-button.arena')).toBeVisible();await page.waitForTimeout(2000);
await sample('5-praca-volta');
await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();await page.waitForTimeout(2000);
await sample('6-salao-arena');
await startPractice(page);await page.waitForTimeout(3000);
await sample('7-batalha');
await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.up('Space');
await sample('8-batalha-tiro');
await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForTimeout(3000);
if(await page.locator('.party-room').isVisible()){await page.getByRole('button',{name:'Sair da sala',exact:true}).click().catch(()=>{});await page.waitForTimeout(1000);}
await page.keyboard.press('Escape');await page.waitForTimeout(1500);
await sample('9-praca-depois');
await page.locator('.lobby-dock-button.fishing').click();await expect(page.locator('.fishing-hud')).toBeVisible();await page.waitForTimeout(3000);
await sample('10-pescaria-de-novo');
await writeFile(`${out}/report.txt`,lines.join('\n'));
clearInterval(wander);for(const b of bots)b.socket.close();await browser.close();
