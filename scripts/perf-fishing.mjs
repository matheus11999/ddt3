// Pescaria under load (docs/performance.md, "Pescaria"): PLAYERS bots (default 20) walk around and fish in
// automatic while a browser stands in the Pescaria; prints frame times, the functions with most CPU time and the
// WebSocket traffic the browser receives. Needs the game running (Vite on 5177).
// npx tsx scripts/perf-fishing.mjs [pasta]   (PLAYERS=40, MOVING=1 walks the browser player too; VW/VH/DPR set the window,
// SOFTWARE=1 paints the canvas on the CPU so drawing cost shows up in the profile)
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import {writeFile,mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';
import {FISHING_SPOTS,FISHING_WALK} from '../shared/fishing.ts';
const base=process.env.BASE??'http://127.0.0.1:5177',out=process.argv[2]??'test-results/perf-fishing',count=Number(process.env.PLAYERS??20);
await mkdir(out,{recursive:true});
const bots=[];
async function bot(n){
 const r=await fetch(`${base}/api/session`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:n%2?'female':'male'})});
 const socket=new WebSocket(`${base.replace(/^http/,'ws')}/ws`,{origin:base,headers:{Cookie:r.headers.get('set-cookie').split(';')[0]}});
 await new Promise(ok=>socket.on('open',ok));const send=v=>socket.readyState===1&&socket.send(JSON.stringify(v));socket.on('message',()=>{});
 send({type:'zone',zone:'fishing'});return {socket,send,n};
}
for(let n=0;n<count;n++)bots.push(await bot(n));
// Half fish in automatic at a spot each; the rest wander.
const fishers=bots.slice(0,Math.min(FISHING_SPOTS.length,Math.floor(count/2)));
for(const [i,b] of fishers.entries()){const s=FISHING_SPOTS[i];b.send({type:'move',x:s.x,y:s.y});b.send({type:'fish-auto',on:true});}
setTimeout(()=>{for(const [i,b] of fishers.entries())b.send({type:'fish-cast',spot:FISHING_SPOTS[i].id});},6000);
const wander=setInterval(()=>{for(const b of bots.slice(fishers.length))b.send({type:'move',x:FISHING_WALK.minX+Math.random()*(FISHING_WALK.maxX-FISHING_WALK.minX),y:FISHING_WALK.minY+Math.random()*(FISHING_WALK.maxY-FISHING_WALK.minY)});},1500);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium',args:process.env.SOFTWARE?['--disable-gpu','--disable-accelerated-2d-canvas']:[]});
const page=await browser.newPage({viewport:{width:Number(process.env.VW??1536),height:Number(process.env.VH??864)},deviceScaleFactor:Number(process.env.DPR??1)});
await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__frames=[];window.requestAnimationFrame=cb=>raf(t=>{const a=performance.now();cb(t);window.__frames.push(performance.now()-a);});});
let bytes=0,messages=0;const kinds={};page.on('websocket',ws=>ws.on('framereceived',({payload})=>{bytes+=payload.length;messages++;try{const k=JSON.parse(String(payload)).type;kinds[k]=(kinds[k]??0)+1;}catch{}}));
const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
await enterGame(page,base);await page.locator('.lobby-dock-button.fishing').click();await expect(page.locator('.fishing-hud')).toBeVisible();await page.waitForTimeout(8000);
if(process.env.MOVING)await page.keyboard.down('ArrowRight');
await page.evaluate(()=>{window.__frames=[];});bytes=messages=0;for(const k in kinds)delete kinds[k];
const ms=8000;await cdp.send('Profiler.start');await page.waitForTimeout(ms);const {profile}=await cdp.send('Profiler.stop');
const frames=await page.evaluate(()=>window.__frames.slice()),sorted=[...frames].sort((a,b)=>a-b);
const self=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]);const k=`${n.callFrame.functionName||'(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber+1}`;self.set(k,(self.get(k)??0)+(profile.timeDeltas[i]??0)/1000);}
const report=`== Pescaria com ${count} jogadores: ${frames.length} quadros em ${ms}ms, média ${(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(1)}ms p50 ${sorted[Math.floor(sorted.length/2)].toFixed(1)} p95 ${sorted[Math.floor(sorted.length*.95)].toFixed(1)} máx ${sorted.at(-1).toFixed(1)}
rede: ${(messages/ms*1000).toFixed(1)} msg/s, ${(bytes/ms).toFixed(1)} KB/s ${JSON.stringify(kinds)}
${[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>`${v.toFixed(0).padStart(6)}ms ${k}`).join('\n')}\n`;
console.log(report);await writeFile(`${out}/report.txt`,report);await writeFile(`${out}/fishing.cpuprofile`,JSON.stringify(profile));await page.screenshot({path:`${out}/fishing.png`});
clearInterval(wander);for(const b of bots)b.socket.close();await browser.close();
