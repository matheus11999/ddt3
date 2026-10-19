// Frame-time probe: lobby (idle and walking), practice battle idle and one shot.
// Usage (game running on 5177): FIRE=1 node scripts/perf-probe.mjs <out-dir>; LOBBY_ONLY=1 / BATTLE_ONLY=1 narrow it.
// Prints frame times and the functions with most CPU time; saves .cpuprofile files (open in Chrome DevTools).
import {chromium} from '@playwright/test';
import {enterGame,startPractice} from './character-helpers.mjs';
import {writeFile} from 'node:fs/promises';
const base=process.env.BASE??'http://127.0.0.1:5177',out=process.argv[2]??'/tmp/claude-0/perf';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info',...(process.env.FLAGS?process.env.FLAGS.split(' '):[])]});
const page=await browser.newPage({viewport:{width:1536,height:864},deviceScaleFactor:1});
await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__frames=[];window.requestAnimationFrame=cb=>raf(t=>{const a=performance.now();cb(t);window.__frames.push(performance.now()-a);});});
const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Performance.enable');
async function sample(name,ms=5000){
 await page.evaluate(()=>{window.__frames=[];});await cdp.send('Profiler.start');const t0=Date.now();await page.waitForTimeout(ms);const {profile}=await cdp.send('Profiler.stop');
 const frames=await page.evaluate(()=>window.__frames.slice());const sorted=[...frames].sort((a,b)=>a-b);
 // Self time by function
 const self=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));const dt=profile.timeDeltas;for(let i=0;i<profile.samples.length;i++){const n=byId.get(profile.samples[i]);const k=`${n.callFrame.functionName||'(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber+1}`;self.set(k,(self.get(k)??0)+(dt[i]??0)/1000);}
 const top=[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>`${v.toFixed(0).padStart(6)}ms ${k}`);
 const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const mem=await page.evaluate(()=>({heap:performance.memory?.usedJSHeapSize/1e6,canvases:[...document.querySelectorAll('canvas')].length}));
 const report=`== ${name}: ${frames.length} frames in ${ms}ms, avg ${(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(1)}ms p50 ${sorted[Math.floor(sorted.length/2)]?.toFixed(1)} p95 ${sorted[Math.floor(sorted.length*.95)]?.toFixed(1)} max ${sorted.at(-1)?.toFixed(1)} >50ms:${frames.filter(f=>f>50).length}\nheap ${mem.heap?.toFixed(0)}MB JSHeap ${(metrics.JSHeapUsedSize/1e6).toFixed(0)}MB nodes ${metrics.Nodes}\n${top.join('\n')}\n`;
 console.log(report);await writeFile(`${out}/${name}.cpuprofile`,JSON.stringify(profile));return report;
}
await enterGame(page,base);await page.waitForTimeout(Number(process.env.SETTLE??4000));
let all='';if(!process.env.BATTLE_ONLY){all+=await sample('lobby');
await page.keyboard.down('ArrowLeft');all+=await sample('lobby-walk',4000);await page.keyboard.up('ArrowLeft');}
if(process.env.LOBBY_ONLY){await writeFile(`${out}/report.txt`,all);await browser.close();process.exit(0);}
await startPractice(page);await page.waitForTimeout(4000);
all+=await sample('battle-idle');
if(process.env.FIRE){await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.up('Space');all+=await sample('battle-shot',5000);}
await writeFile(`${out}/report.txt`,all);await browser.close();
