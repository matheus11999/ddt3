import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

// Expedition Center against a running game (Vite + server, or Docker): the hall lists a friend's room,
// the player creates a room, opens the expedition picker, chooses Formigueiro Fácil, the friend joins
// (over a raw socket) and the run starts on stage 1. Screenshots of the walk-in, the ants' shared turn
// and their first bite; then a stage 2 preview (queen and her plate, nest summons, the goal under the minimap) drawn from sample data.
// Usage: node scripts/smoke-expedition.mjs  (BASE_URL, OUT and CHROME_PATH optional)
const base=process.env.BASE_URL??'http://127.0.0.1:5177',output=process.env.OUT??'test-results/expedition';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[],wait=async(peer,type,predicate=()=>true,after=0)=>{await expect.poll(()=>peer.events.slice(after).some(e=>e.type===type&&predicate(e)),{timeout:15000,message:`server ${type}`}).toBe(true);return peer.events.slice(after).findLast(e=>e.type===type&&predicate(e));};
async function openPeer(){
 const response=await fetch(`${base}/api/session`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'female'})});assert.equal(response.status,200);
 const session=await response.json(),peer={profile:session.profile,events:[],socket:new WebSocket(`${base.replace(/^http/,'ws')}/ws`,{origin:base,headers:{Cookie:response.headers.get('set-cookie').split(';')[0]}})};
 peer.socket.on('message',raw=>peer.events.push(JSON.parse(raw.toString())));await wait(peer,'welcome');return peer;
}
const send=(peer,value)=>peer.socket.send(JSON.stringify(value));
const state=page=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);const b=client.state.battle;return b&&{turnId:b.turnId,phase:b.phase,me:client.state.profile.id,intro:b.instance?.introUntil-Date.now()-client.state.offset,bites:b.instance?.monsterTurn?.bites.length??0,startedAt:b.instance?.monsterTurn?.startedAt,offset:client.state.offset,stage:b.instance?.stage,ants:b.players.filter(p=>p.monster&&p.hp>0).map(p=>Math.round(p.x))};});
try{
 const friend=await openPeer();
 send(friend,{type:'create-expedition'});await wait(friend,'room',e=>!!e.room);
 send(friend,{type:'expedition-select',expedition:'anthill',difficulty:'easy'});await wait(friend,'room',e=>!!e.room?.expedition);
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await enterGame(page,base);
 await page.locator('.bottom-dock').getByRole('button',{name:/Expedições/}).click();await page.locator('.expedition-hall').waitFor();
 await expect(page.locator('.hall-room').first()).toBeVisible();await page.waitForTimeout(600);await page.screenshot({path:`${output}/01-hall.png`});
 await page.getByRole('button',{name:'Criar sala',exact:true}).click();await page.locator('.expedition-room').waitFor();await page.waitForTimeout(900);
 await page.screenshot({path:`${output}/02-room-empty.png`});
 await page.locator('.expedition-banner-art').click();await page.getByRole('dialog',{name:'Expedições'}).waitFor();await page.waitForTimeout(600);
 await expect(page.locator('.expedition-difficulty[disabled]')).toHaveCount(3);await expect(page.locator('.expedition-stage-pick button')).toHaveCount(2);await expect(page.locator('.expedition-power')).toContainText('Poder recomendado');
 await page.screenshot({path:`${output}/03-picker.png`});
 await page.getByRole('button',{name:'Escolher',exact:true}).click();await expect(page.locator('.expedition-banner-choice')).toBeVisible();
 const roomId=await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);return client.state.room.id;});
 send(friend,{type:'leave'});await wait(friend,'room',e=>!e.room);send(friend,{type:'join',roomId});await wait(friend,'room',e=>e.room?.id===roomId);send(friend,{type:'ready'});
 await expect(page.getByRole('button',{name:'Iniciar expedição'})).toBeEnabled();await page.waitForTimeout(500);
 await page.screenshot({path:`${output}/04-room-ready.png`});
 await page.getByRole('button',{name:'Iniciar expedição'}).click();await page.locator('.artillery-hud').waitFor();
 await page.waitForTimeout(1100);await page.screenshot({path:`${output}/05-walk-in.png`});
 await expect(page.locator('.expedition-objective')).toContainText('0/6');
 await expect.poll(async()=>(await state(page)).intro,{timeout:6000}).toBeLessThan(0);await page.waitForTimeout(700);
 await page.screenshot({path:`${output}/06-first-turn.png`});
 // Everybody passes; the ants walk in turn after turn until the first bite.
 let walked=false,bitten=false;
 for(let round=0;round<14&&!bitten;round++){
  for(let guard=0;guard<40;guard++){const s=await state(page);if(s.turnId==='monsters')break;if(s.phase==='aiming'){if(s.turnId===s.me){await page.keyboard.press('p');}else send(friend,{type:'pass'});}await page.waitForTimeout(350);}
  const s=await state(page);
  if(!walked){await page.waitForTimeout(700);await page.screenshot({path:`${output}/07-ants-turn.png`});walked=true;}
  if(s.bites){const at=s.startedAt+1500+320-Date.now()-s.offset;await page.waitForTimeout(Math.max(0,at+60));await page.screenshot({path:`${output}/08-bite.png`});bitten=true;}
  await expect.poll(async()=>(await state(page)).turnId,{timeout:12000}).not.toBe('monsters');
 }
 assert.ok(bitten,'as formigas chegaram e morderam');
 // Stage 2 preview with sample data (the queen on her throne with her plate and two ants leaving the nest).
 await page.evaluate(async()=>{
  const find=path=>performance.getEntriesByType('resource').map(e=>e.name).filter(name=>new URL(name).pathname===path).at(-1)??path;
  const {client}=await import(find('/src/client.ts')),{createTerrain,ground}=await import(find('/shared/physics.ts')),{getMap}=await import(find('/shared/maps.ts')),{MONSTERS,partyHpScale}=await import(find('/shared/expeditions.ts'));
  client.stop();client.send=()=>{};
  const b=client.state.battle,terrain=createTerrain('anthill-2'),map=getMap('anthill-2'),now=Date.now()+client.state.offset,people=b.players.filter(p=>!p.monster);
  const players=people.map((p,i)=>({...p,x:map.spawns[0][i],y:ground(terrain,map.spawns[0][i]),hp:Math.round(p.maxHp*(i?.7:.9))}));
  const mob=(kind,x,id,hp)=>{const max=Math.round(MONSTERS[kind].hp*partyHpScale(2));return {...people[0],id,name:MONSTERS[kind].name,monster:kind,team:1,bot:true,x,y:ground(terrain,x),hp:hp??max,maxHp:max,facing:-1,hitRadius:MONSTERS[kind].hitRadius,hitHeight:MONSTERS[kind].hitHeight};};
  const queen=mob('ant-queen',2600,'q',3900),fresh=[mob('ant-worker',1735,'s1'),mob('ant-soldier',1699,'s2')];
  client.update({battle:{...b,id:'preview-stage-2',map:'anthill-2',terrain:undefined,terrainMarks:[],players:[...players,queen,mob('ant-worker',1250,'w1',300),...fresh],turnId:'monsters',phase:'resolving',
   instance:{...b.instance,stage:2,stageName:'A câmara da rainha',boss:'q',nest:{x:1735,y:ground(terrain,1735)},introUntil:0,monsterTurn:{id:'t',startedAt:now-2000,moves:[],bites:[],summons:[{id:'s1',at:now-300},{id:'s2',at:now-50}],arrowAt:now+1400}}},shot:null,impacts:[]});
 });
 await page.waitForTimeout(1100);await page.screenshot({path:`${output}/09-queen.png`});
 await expect(page.locator('.expedition-objective')).toContainText('Derrotar a Rainha Formiga');
 // Phone in landscape: the room keeps the expedition choice reachable from the side panel.
 const phone=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2}),mp=await phone.newPage();mp.on('pageerror',e=>errors.push(e.message));
 await enterGame(mp,base);await mp.locator('.bottom-dock').getByRole('button',{name:/Expedições/}).tap();await mp.locator('.expedition-hall').waitFor();
 await mp.screenshot({path:`${output}/12-hall-phone.png`});await mp.getByRole('button',{name:'Criar sala',exact:true}).tap();await mp.locator('.expedition-room').waitFor();await mp.waitForTimeout(800);
 await mp.screenshot({path:`${output}/13-room-phone.png`});await phone.close();
 assert.deepEqual(errors,[]);
 await context.close();friend.socket.close();
 console.log(`Expedição: OK. Imagens em ${output}/`);
}finally{await browser.close();}
