import {enterGame} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL??'http://127.0.0.1:5177',out='test-results/rewards';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})}),context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),events=[],otherEvents=[],errors=[],commands=[];let socket;
page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>{ws.on('framereceived',f=>{try{events.push(JSON.parse(String(f.payload)));}catch{}});ws.on('framesent',f=>{try{commands.push(JSON.parse(String(f.payload)));}catch{}});});
const wait=async(journal,type,pred=()=>true,mark=0)=>{await expect.poll(()=>journal.slice(mark).some(e=>e.type===type&&pred(e)),{timeout:22000}).toBe(true);return journal.slice(mark).find(e=>e.type===type&&pred(e));};
const send=command=>page.evaluate(command=>window.__rewardSocket.send(JSON.stringify(command)),command);
const latest=()=>events.filter(e=>e.type==='battle'&&e.battle).at(-1)?.battle;
await context.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native {constructor(...args){super(...args);if(String(args[0]).endsWith('/ws'))window.__rewardSocket=this;}};});
try{
 await enterGame(page,base);const me=(await wait(events,'welcome')).profile;
 const response=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'male'})}),other=(await response.json()).profile,cookie=response.headers.get('set-cookie').split(';')[0];
 socket=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base,headers:{Cookie:cookie}});socket.on('message',raw=>otherEvents.push(JSON.parse(raw.toString())));await wait(otherEvents,'welcome');
 await send({type:'rename',name:'TEST Cartas Brasa'});socket.send(JSON.stringify({type:'rename',name:'TEST Rival Cartas'}));
 await send({type:'create'});const room=(await wait(events,'room',e=>!!e.room)).room;socket.send(JSON.stringify({type:'create'}));const otherRoom=(await wait(otherEvents,'room',e=>!!e.room)).room;
 await send({type:'queue'});socket.send(JSON.stringify({type:'queue'}));await wait(events,'battle',e=>e.battle?.phase==='aiming');
 // Finish an actual matched duel by passing all turns. No HP or client-state injection.
 for(let i=0;i<80&&latest().phase!=='finished';i++){
  const battle=latest(),mark=events.length;if(battle.turnId===me.id)await send({type:'pass'});else socket.send(JSON.stringify({type:'pass'}));
  await wait(events,'battle',e=>e.battle?.turnNumber>battle.turnNumber||e.battle?.phase==='finished',mark);
 }
 const finish=latest();assert.equal(finish.phase,'finished');assert.ok(finish.rewards.cards.every(c=>!c.prize));assert.equal(finish.rewards.deadline-finish.rewards.opensAt,5000);
 await expect(page.getByRole('dialog',{name:'EMPATE',exact:true})).toBeVisible();await expect(page.locator('.result-introduction')).toBeVisible();await expect(page.locator('.loot-card')).toHaveCount(0);await page.waitForTimeout(500);await page.screenshot({path:out+'/result-introduction.png'});
 await expect(page.locator('.loot-card')).toHaveCount(8,{timeout:4500});await page.getByRole('button',{name:'Carta 3, livre',exact:true}).click();await wait(events,'battle',e=>e.battle?.rewards?.cards[2].playerId===me.id);
 let mark=otherEvents.length;socket.send(JSON.stringify({type:'reward-pick',card:2}));await wait(otherEvents,'error',e=>/já foi escolhida/.test(e.message),mark);
 assert.ok(latest().rewards.cards.every(c=>!c.prize));await page.screenshot({path:out+'/cards-selected.png'});
 // A reconnect keeps the reserved card without delaying the shared five-second window. The party returns to the
 // room 2 s after the reveal, so the reveal itself is checked on the landscape phone layout.
 await page.setViewportSize({width:844,height:390});await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.rewards-mobile-shell .loot-card-slot.mine')).toHaveCount(1);assert.equal(latest().rewards.deadline,finish.rewards.deadline);
 const revealMark=events.length,otherReturnMark=otherEvents.length;socket.send(JSON.stringify({type:'reward-pick',card:5}));
 const final=(await wait(events,'battle',e=>e.battle?.rewards?.phase==='revealed'&&e.battle.rewards.saved,revealMark)).battle;
 assert.ok(final.rewards.revealedAt<finish.rewards.deadline,'all human choices reveal early');assert.equal(final.rewards.cards.filter(c=>c.prize).length,8,'all eight prizes reveal together');
 await expect(page.locator('.loot-card-slot.revealed')).toHaveCount(8);await expect(page.getByText('SEU PRÊMIO',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Jogar novamente|Voltar à praça|Voltar à sala/})).toHaveCount(0);await page.waitForTimeout(550);await page.screenshot({path:out+'/cards-landscape.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await expect(page.locator('.party-room')).toBeVisible({timeout:6000});await wait(otherEvents,'room',e=>e.room?.id===otherRoom.id&&e.room.status==='waiting',otherReturnMark);assert.equal(events.filter(e=>e.type==='room'&&e.room).at(-1).room.id,room.id);assert.ok(!commands.some(c=>c.type==='leave'||c.type==='rematch'),'only server returns the party');
 const own=final.rewards.cards.find(c=>c.playerId===me.id).prize,rival=final.rewards.cards.find(c=>c.playerId===other.id).prize;
 const persisted=await context.request.post(base+'/api/session',{headers:{Origin:base}}),profile=(await persisted.json()).profile;
 assert.equal(profile.gold,me.gold+25+(own.kind==='coins'?own.amount:0));assert.equal(profile.xp,me.xp+50+(own.kind==='xp'?own.amount:0));assert.equal(profile.matches,me.matches+1);
 assert.equal(new Set(final.rewards.cards.filter(c=>c.playerId).map(c=>c.playerId)).size,2);assert.deepEqual(errors,[]);
 await send({type:'leave'});socket.send(JSON.stringify({type:'leave'}));
 await writeFile(out+'/report.json',JSON.stringify({realPvp:true,resultDelay:true,pickWindow:5000,earlySharedReveal:true,allEightPrizes:true,exclusiveClaims:true,reconnect:true,persistentPayout:true,serverReturn:true,own,rival,errors},null,2));console.log('PASS: matched PvP, intro, five-second choices, exclusive claims, reconnect, early all-card reveal, PostgreSQL payout and automatic party return');
} catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(error),events:events.slice(-8),errors},null,2));throw error;}finally{socket?.close();await browser.close();}
