// Two real players find a match: the loading screen (teams, VS, map) until both reach 100 %, then the battle.
// SLOW=1: the second player never reports progress and is left out after 30 s.
// Uso: node scripts/preview-match-loading.mjs  (BASE_URL, OUT, CHROME_PATH opcionais; precisa do jogo rodando)
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame,createArenaRoom} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/match-loading',suffix=process.env.VIEWPORT?`-${process.env.VIEWPORT}`:'',slow=process.env.SLOW==='1',kind=process.env.KIND??'pvp';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const pages=[];
for(let i=0;i<2;i++){const [width,height]=(process.env.VIEWPORT??'1536x864').split('x').map(Number),mobile=width<1000,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();await enterGame(page,base);pages.push(page);}
const [a,b]=pages;
if(slow)await b.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);const send=client.send.bind(client);client.send=c=>{if(c.type!=='loading-progress')send(c);};});
if(kind==='expedition'){
 await a.locator('.bottom-dock').getByRole('button',{name:/Expedi/}).click();
 const id=await a.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.send({type:'create-expedition'});await new Promise(r=>setTimeout(r,800));client.send({type:'expedition-select',expedition:'anthill',difficulty:'easy'});return client.state.room.id;});
 await b.evaluate(async id=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.send({type:'join',roomId:id});await new Promise(r=>setTimeout(r,800));client.send({type:'ready'});},id);
 await a.waitForTimeout(800);
 await a.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.send({type:'start'});});
}else{
 for(const page of pages)await createArenaRoom(page);
 for(const page of pages)await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.send({type:'queue'});});
}
await expect(a.locator('.match-loading')).toBeVisible({timeout:15000});
const started=Date.now();
await a.waitForTimeout(500);await a.screenshot({path:`${output}/${kind}-loading-a${suffix}.png`});await b.screenshot({path:`${output}/${kind}-loading-b.png`});
if(slow){
 await expect(a.locator('.match-loading')).toBeHidden({timeout:40000});
 console.log('loading closed after',Date.now()-started,'ms');
 await a.waitForTimeout(1000);await a.screenshot({path:`${output}/${kind}-slow-a-after.png`});await b.screenshot({path:`${output}/${kind}-slow-b-after.png`});
}else{
 await expect(a.locator('.battle-console')).toBeVisible({timeout:35000});await expect(b.locator('.battle-console')).toBeVisible({timeout:5000});
 console.log('battle opened after',Date.now()-started,'ms');
 await a.waitForTimeout(1200);await a.screenshot({path:`${output}/${kind}-battle-a.png`});
}
await browser.close();
