import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL??'http://127.0.0.1:5177',out='test-results/rewards';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),events=[],otherEvents=[],errors=[];let socket;
page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>ws.on('framereceived',f=>{try{events.push(JSON.parse(String(f.payload)));}catch{}}));
const wait=async(journal,type,pred=()=>true,mark=0)=>{await expect.poll(()=>journal.slice(mark).some(e=>e.type===type&&pred(e)),{timeout:22000}).toBe(true);return journal.slice(mark).find(e=>e.type===type&&pred(e));};
const send=command=>page.evaluate(command=>window.__rewardSocket.send(JSON.stringify(command)),command);
const latest=()=>events.filter(e=>e.type==='battle'&&e.battle).at(-1)?.battle;
await context.addInitScript(()=>{const Native=window.WebSocket;window.WebSocket=class extends Native {constructor(...args){super(...args);if(String(args[0]).endsWith('/ws'))window.__rewardSocket=this;}};});
try{
 await page.goto(base,{waitUntil:'networkidle'});await expect(page.locator('.bottom-dock')).toBeVisible();const me=(await wait(events,'welcome')).profile;
 const response=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base}}),other=(await response.json()).profile,cookie=response.headers.get('set-cookie').split(';')[0];
 socket=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base,headers:{Cookie:cookie}});socket.on('message',raw=>otherEvents.push(JSON.parse(raw.toString())));await wait(otherEvents,'welcome');
 await send({type:'rename',name:'TEST Cartas Brasa'});socket.send(JSON.stringify({type:'rename',name:'TEST Rival Cartas'}));
 await send({type:'create',name:'TEST Recompensas',mode:'1v1',map:'garden'});const room=(await wait(events,'room',e=>!!e.room)).room;
 socket.send(JSON.stringify({type:'join',roomId:room.id}));await wait(otherEvents,'room',e=>e.room?.players.length===2);socket.send(JSON.stringify({type:'ready'}));await wait(events,'room',e=>e.room?.players.some(p=>p.id===other.id&&p.ready));await send({type:'start'});await wait(events,'battle',e=>e.battle?.phase==='aiming');
 // Exercise a real server-finished draw; no client state injection or health cheats.
 for(let i=0;i<80&&latest().phase!=='finished';i++){
  const battle=latest(),mark=events.length;if(battle.turnId===me.id)await send({type:'pass'});else socket.send(JSON.stringify({type:'pass'}));
  await wait(events,'battle',e=>e.battle?.turnNumber>battle.turnNumber||e.battle?.phase==='finished',mark);
 }
 const finish=latest();assert.equal(finish.phase,'finished');assert.ok(finish.rewards.cards.every(c=>!c.prize));
 await expect(page.getByRole('dialog',{name:'EMPATE',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Carta 3, livre',exact:true}).click();await wait(events,'battle',e=>e.battle?.rewards?.cards[2].playerId===me.id);
 let mark=otherEvents.length;socket.send(JSON.stringify({type:'reward-pick',card:2}));await wait(otherEvents,'error',e=>/já foi escolhida/.test(e.message),mark);
 socket.send(JSON.stringify({type:'reward-pick',card:5}));await wait(events,'battle',e=>e.battle?.rewards?.cards[5].playerId===other.id);
 assert.ok(latest().rewards.cards.every(c=>!c.prize));await page.screenshot({path:out+'/cards-selected.png'});
 // Reconnect preserves claims and the common deadline without exposing hidden prizes.
 await page.reload({waitUntil:'networkidle'});await expect(page.locator('.loot-deck')).toBeVisible();
 await expect(page.locator('.loot-card-slot.mine')).toHaveCount(1);await expect(page.locator('.loot-card-slot.revealed')).toHaveCount(0);
 await wait(events,'battle',e=>e.battle?.rewards?.saved===true);await expect(page.getByRole('button',{name:'Jogar novamente',exact:true})).toBeEnabled();
 await page.waitForFunction(()=>document.querySelectorAll('.loot-card-slot.revealed').length===2);await page.evaluate(()=>new Promise(r=>setTimeout(r,800)));
 await page.screenshot({path:out+'/cards-revealed.png'});
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.rewards-mobile-shell')).toBeVisible();await page.screenshot({path:out+'/cards-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1536,height:864});
 const final=latest(),own=final.rewards.cards.find(c=>c.playerId===me.id).prize,rival=final.rewards.cards.find(c=>c.playerId===other.id).prize;
 const persisted=await context.request.post(base+'/api/session',{headers:{Origin:base}}),profile=(await persisted.json()).profile;
 assert.equal(profile.gold,me.gold+25+(own.kind==='coins'?own.amount:0));assert.equal(profile.xp,me.xp+50+(own.kind==='xp'?own.amount:0));assert.equal(profile.matches,me.matches+1);
 assert.equal(new Set(final.rewards.cards.filter(c=>c.playerId).map(c=>c.playerId)).size,2);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Jogar novamente',exact:true}).click();await expect(page.locator('.fullscreen-room')).toBeVisible();
 await send({type:'leave'});socket.send(JSON.stringify({type:'leave'}));
 await writeFile(out+'/report.json',JSON.stringify({realPvp:true,sharedReveal:true,exclusiveClaims:true,reconnect:true,persistentPayout:true,own,rival,errors},null,2));console.log('PASS: real PvP choices, exclusivity, hidden payload, reconnect, reveal, PostgreSQL payout and rematch');
} catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(error),events:events.slice(-8),errors},null,2));throw error;}finally{socket?.close();await browser.close();}
