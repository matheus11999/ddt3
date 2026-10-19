// Two real players find a match: the loading screen (teams, VS, map) until both reach 100 %, then the battle.
// SLOW=1: the second player never reports progress and is left out after 30 s.
// Uso: node scripts/preview-match-loading.mjs  (BASE_URL, OUT, CHROME_PATH opcionais; precisa do jogo rodando)
import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/match-loading',suffix=process.env.VIEWPORT?`-${process.env.VIEWPORT}`:'',slow=process.env.SLOW==='1',kind=process.env.KIND??'pvp';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const size=Math.max(1,Math.min(4,Number(process.env.PLAYERS??1))),pages=[];
for(let i=0;i<(kind==='expedition'?Math.max(2,size):size*2);i++){const [width,height]=(process.env.VIEWPORT??'1536x864').split('x').map(Number),mobile=width<1000,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();await enterGame(page,base);pages.push(page);}
const [a]=pages,b=pages.at(-1);
const run=(page,fn,arg)=>page.evaluate(async([fn,arg])=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);return new Function('client','arg','return ('+fn+')(client,arg)')(client,arg);},[fn.toString(),arg]);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/** One party: the first page creates the room, opens the seats, the rest join and get ready. */
async function party(members,expedition=false){
 await run(members[0],(client,expedition)=>client.send(expedition?{type:'create-expedition'}:{type:'create',name:'Prévia'}),expedition);await wait(700);
 if(expedition){await run(members[0],client=>client.send({type:'expedition-select',expedition:'anthill',difficulty:'easy'}));await wait(400);}
 else for(let slot=1;slot<members.length;slot++){await run(members[0],(client,slot)=>client.send({type:'room-slot',slot,open:true}),slot);await wait(250);}
 const id=await run(members[0],client=>client.state.room.id);
 for(const page of members.slice(1)){await run(page,(client,id)=>client.send({type:'join',roomId:id}),id);await wait(400);await run(page,client=>client.send({type:'ready'}));await wait(250);}
 // A fresh character may still be saving its equipment: retry until every member is ready.
 for(let tries=0;tries<20;tries++){
  const states=await Promise.all(members.slice(1).map(page=>run(page,client=>client.state.room?.players.find(p=>p.id===client.state.profile.id)?.ready)));
  if(states.every(Boolean))break;
  for(const [index,ready] of states.entries())if(!ready)await run(members[index+1],client=>client.send({type:'ready'}));
  await wait(600);
 }
 return id;
}
if(slow)await b.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);const send=client.send.bind(client);client.send=c=>{if(c.type!=='loading-progress')send(c);};});
// HOLD=ms: the last player reports its progress that much later, so a screenshot catches everyone loading.
if(process.env.HOLD)await run(b,(client,hold)=>{const send=client.send.bind(client);client.send=c=>{if(c.type==='loading-progress')setTimeout(()=>send(c),hold);else send(c);};},Number(process.env.HOLD));
if(kind==='expedition'){
 await a.locator('.bottom-dock').getByRole('button',{name:/Expedi/}).click();
 await party(pages,true);
 await run(a,client=>client.send({type:'start'}));
}else{
 await party(pages.slice(0,size));await party(pages.slice(size));await wait(500);
 for(const page of [pages[0],pages[size]])await run(page,client=>client.send({type:'queue'}));
}
const dbg=await Promise.all(pages.map(page=>run(page,client=>({room:client.state.room&&{id:client.state.room.id,status:client.state.room.status,players:client.state.room.players.length,open:client.state.room.openSlots},error:client.state.error}))));if(process.env.DEBUG)console.log(JSON.stringify(dbg));
await expect(a.locator('.match-loading')).toBeVisible({timeout:15000});
const started=Date.now();
await a.waitForTimeout(500);await a.screenshot({path:`${output}/${kind}-${size}v${size}-loading${suffix}.png`});
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
