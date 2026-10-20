// Memory when changing areas (docs/performance.md, "Trocar de área"): plaza -> Pescaria (automatic fishing)
// -> plaza -> practice battle -> shot -> leave. At each step prints the pixel memory of the canvases, bitmaps
// and images the page still holds (scripts/memory-probe.js), before and after a forced garbage collection,
// the frame rate and the DOM/listener counts. Needs the game running (Vite on 5177).
// npx tsx scripts/probe-area-memory.mjs [pasta] [nofish]
import {chromium,expect} from '@playwright/test';
import {enterGame,startPractice} from './character-helpers.mjs';
import {FISHING_HEIGHT,FISHING_LAKES,FISHING_WIDTH,fishingFree} from '../shared/fishing.ts';
const base='http://127.0.0.1:5177',dir=process.argv[2]??'test-results/area-memory',fish=process.argv[3]!=='nofish';
import {mkdirSync} from 'node:fs';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
const context=await browser.newContext({viewport:{width:1536,height:864}});await context.addInitScript({path:'scripts/memory-probe.js'});const page=await context.newPage();let me=null,at=null;
page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const e=JSON.parse(String(payload));if(e.type==='welcome')me=e.profile.id;const p=(e.type==='lobby'||e.type==='welcome'||e.type==='zone'||e.type==='lobby-moves')&&(e.players??e.moves)?.find(q=>q.id===me);if(p)at={x:p.x,y:p.y};}catch{}}));
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
await enterGame(page,base);await page.waitForTimeout(2000);
const fps=async(label)=>{const held=await page.evaluate(()=>window.__mem());await page.evaluate(()=>window.gc?.());await page.waitForTimeout(300);const live=await page.evaluate(()=>window.__mem());console.log(label,'held',JSON.stringify({...held,big:held.big.length,dirs:undefined}),'aftergc',JSON.stringify({...live,big:undefined}),'\nBIG',live.big.join(' | '));const r=await page.evaluate(()=>new Promise(done=>{let n=0,worst=0,last=performance.now();const t0=last;const tick=()=>{const now=performance.now();worst=Math.max(worst,now-last);last=now;n++;if(now-t0<3000)requestAnimationFrame(tick);else done({fps:+(n/3).toFixed(1),worst:Math.round(worst),heap:Math.round(performance.memory.usedJSHeapSize/1e6)});};requestAnimationFrame(tick);}));
 const m=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));console.log(label,JSON.stringify(r),'nodes',m.Nodes,'listeners',m.JSEventListeners,'docs',m.Documents);};
await fps('praca');
const camera=(x,y)=>({x:Math.max(0,Math.min(FISHING_WIDTH-1536,x-768)),y:Math.max(0,Math.min(FISHING_HEIGHT-864,y-864*.6))});
const walkTo=async(x,y)=>{for(let n=0;n<8;n++){const p=at;if(Math.hypot(p.x-x,p.y-y)<10)return;const cam=camera(p.x,p.y);const w=fishingFree(cam.x+Math.max(440,Math.min(1480,x-cam.x)),cam.y+Math.max(250,Math.min(640,y-cam.y)));
 await page.locator('.world-canvas').click({position:{x:w.x-cam.x,y:w.y-cam.y}});const start=Date.now();let last={...at};while(Date.now()-start<15000){await page.waitForTimeout(500);if(Math.hypot(at.x-last.x,at.y-last.y)<.5)break;last={...at};}}};
if(fish){await page.locator('.lobby-dock-button.fishing').click();await expect(page.locator('.fishing-hud')).toBeVisible();await page.waitForTimeout(3000);
 const lake=FISHING_LAKES[0],lawn={x:1700,y:1980},view=camera(lawn.x,lawn.y);await walkTo(lawn.x,lawn.y);
 await page.locator('.fishing-auto').click();await page.locator('.fishing-main').click();await page.locator('.world-canvas').click({position:{x:lake.x-230-view.x,y:lake.y+20-view.y}});
 await page.waitForTimeout(15000);await fps('pescaria');await page.screenshot({path:`${dir}/1-pesca.png`});
 await page.locator('.fishing-exit').click();await page.waitForTimeout(3000);await fps('praca-volta');await page.screenshot({path:`${dir}/2-volta.png`});}
await startPractice(page);
for(let i=0;i<4;i++){await page.waitForTimeout(2500);await fps('batalha'+i);await page.screenshot({path:`${dir}/3-batalha${i}.png`});}
await page.keyboard.down('Space');await page.waitForTimeout(1500);await page.keyboard.up('Space');
for(let i=0;i<3;i++){await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/4-tiro${i}.png`});}
await fps('batalha-tiro');
await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForTimeout(4000);await fps('depois-batalha');await page.screenshot({path:`${dir}/5-depois.png`});
console.log('errors',errors.slice(0,20));await browser.close();
