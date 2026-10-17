import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterGame} from './character-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:8097',output='test-results/arena-hall',layoutOnly=process.env.HALL_LAYOUT_ONLY==='1';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),peers=[],errors=[],checks=[];
const wait=async(peer,type,predicate=()=>true,after=0)=>{await expect.poll(()=>peer.events.slice(after).some(event=>event.type===type&&predicate(event)),{timeout:12000,message:`server ${type}`}).toBe(true);return peer.events.slice(after).find(event=>event.type===type&&predicate(event));};
async function openPeer(){
 const response=await fetch(`${base}/api/session`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'male'})});assert.equal(response.status,200);
 const session=await response.json(),peer={profile:session.profile,events:[],socket:new WebSocket(`${base.replace(/^http/,'ws')}/ws`,{origin:base,headers:{Cookie:response.headers.get('set-cookie').split(';')[0]}})};peers.push(peer);
 peer.socket.on('message',raw=>peer.events.push(JSON.parse(raw.toString())));await wait(peer,'welcome');return peer;
}
async function command(peer,value,type,predicate){const mark=peer.events.length;peer.socket.send(JSON.stringify(value));return wait(peer,type,predicate,mark);}
async function visibleInViewport(page,locator){await expect(locator).toBeVisible();const box=await locator.boundingBox(),view=page.viewportSize();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=view.width+1&&box.y+box.height<=view.height+1);}
async function fillsViewport(page){const bounds=await page.locator('.arena-hall').boundingBox(),view=page.viewportSize();assert.ok(bounds&&Math.abs(bounds.x)<1&&Math.abs(bounds.y)<1&&Math.abs(bounds.width-view.width)<1&&Math.abs(bounds.height-view.height)<1,`hall fills ${view.width}×${view.height} independently of game scale`);assert.equal(await page.locator('.arena-hall-portal').evaluate(node=>getComputedStyle(node).backdropFilter),'none');}
async function capture(page,path){await page.evaluate(async()=>{await document.fonts.ready;const image=new Image();image.src='/assets/ui/arena-sapphire-texture.webp';await image.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path});}
try{
 const context=await browser.newContext({viewport:{width:1536,height:864}}),page=await context.newPage(),live={events:[],commands:[]};
 page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>{socket.on('framereceived',frame=>{try{live.events.push(JSON.parse(String(frame.payload)));}catch{}});socket.on('framesent',frame=>{try{live.commands.push(JSON.parse(String(frame.payload)));}catch{}});});
 await enterGame(page,base);
 if(!layoutOnly){
 await wait(live,'welcome');const baseline=(await wait(live,'welcome')).arenaOnline;
 await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();await expect(page.locator('.hall-population strong')).toHaveText(String(baseline+1));
 await expect(page.getByRole('textbox',{name:'Buscar sala'})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Filtrar salas por modo'})).toHaveCount(0);
 await fillsViewport(page);
 const [full,available,playing]=await Promise.all([openPeer(),openPeer(),openPeer()]);
 const fullRoom=(await command(full,{type:'create',name:'QA Hall Completa'},'room',event=>!!event.room)).room;
 const openRoom=(await command(available,{type:'create',name:'QA Hall Dragões'},'room',event=>!!event.room)).room;await command(available,{type:'room-slot',slot:1,open:true},'room',event=>event.room?.openSlots.length===2);
 const battleRoom=(await command(playing,{type:'create',name:'QA Hall Batalha'},'room',event=>!!event.room)).room;await command(playing,{type:'practice-start'},'battle',event=>!!event.battle);
 await expect(page.locator('.hall-population strong')).toHaveText(String(baseline+4));
 const fullCard=page.locator(`[data-room-id="${fullRoom.id}"]`),openCard=page.locator(`[data-room-id="${openRoom.id}"]`),battleCard=page.locator(`[data-room-id="${battleRoom.id}"]`);
 await expect(fullCard).toBeDisabled();await expect(openCard).toBeEnabled();await expect(battleCard).toBeDisabled();await expect(battleCard.locator('time')).toHaveText(/^\d+:\d{2}$/);await expect(openCard.locator('.hall-room-format')).toContainText('2×2');
 await page.getByRole('button',{name:'Pesquisar salas',exact:true}).click();await page.getByRole('textbox',{name:'Buscar sala'}).fill('dragoes');await expect(page.locator('.hall-room')).toHaveCount(1);await expect(openCard).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.arena-hall')).toBeVisible();await expect(page.getByRole('textbox',{name:'Buscar sala'})).toHaveCount(0);
 await page.screenshot({path:`${output}/live-population-and-rooms.png`});checks.push('live population includes hall plus rooms once; full and playing rooms remain visible; server battle clock');
 await openCard.click();await expect(page.locator('.party-room')).toBeVisible();await expect.poll(()=>live.commands.filter(value=>value.type==='arena-presence').at(-1)?.open).toBe(false);
 const ping=Date.now();await command(available,{type:'ping',time:ping},'pong',event=>event.time===ping);assert.equal(live.events.filter(event=>event.type==='arena-population').at(-1).count,baseline+4);
 await page.getByRole('button',{name:'Sair da sala',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();await wait(live,'arena-population',event=>event.count===baseline+3);
 await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();await expect(page.locator('.hall-population strong')).toHaveText(String(baseline+4));
 const createMark=live.events.length;await page.getByRole('button',{name:'Criar sala',exact:true}).click();await wait(live,'room',event=>!!event.room,createMark);assert.deepEqual(live.commands.filter(value=>value.type==='create').at(-1),{type:'create'});checks.push('join/create and hall unmount do not double-count; lobby departure reduces population');
 await page.getByRole('button',{name:'Sair da sala',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
 }else await page.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
 // Presentation fixtures are deliberately separate from the real transport checks above.
 await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname==='/src/client.ts').at(-1).name,{client}=await import(url);client.stop();client.send=()=>{};window.hallClient=client;const p=client.state.profile,seat={id:p.id,name:'Valentina',level:34,equipment:p.equipment,ready:true,bot:false,team:0,slot:0,connected:true},room=(id,name,size,status,full=false)=>({id,name,hostId:p.id,mode:`${size}v${size}`,openSlots:Array.from({length:size},(_,i)=>i),map:'garden',status,players:Array.from({length:full?size:1},(_,i)=>({...seat,id:i?p.id+i:p.id,slot:i})),matchStartedAt:status==='playing'?Date.now()-125000:undefined});client.update({status:'online',arenaOnline:17,room:null,battle:null,rooms:[room('a','Cavaleiros da Brasa',2,'waiting'),room('b','Clã dos Dragões',3,'searching',true),room('c','Heróis do Crepúsculo',4,'playing',true),room('d','Duelo da Aurora',1,'waiting',true),room('e','Força da Maré',4,'waiting'),room('f','Guardiões do Vale',2,'playing',true)]});});
 await expect(page.locator('.hall-room')).toHaveCount(6);await expect(page.locator('.is-searching')).toBeDisabled();
 await expect(page.getByRole('textbox',{name:'Buscar sala'})).toHaveCount(0);await page.getByRole('button',{name:'Pesquisar salas',exact:true}).click();await page.getByRole('textbox',{name:'Buscar sala'}).fill(' DRAGOES ');await expect(page.locator('.hall-room')).toHaveCount(1);await expect(page.locator('.hall-room')).toContainText('Clã dos Dragões');await page.keyboard.press('Escape');await expect(page.locator('.hall-room')).toHaveCount(6);await expect(page.getByRole('textbox',{name:'Buscar sala'})).toHaveCount(0);
 for(const viewport of [{width:1536,height:864},{width:1280,height:720},{width:2048,height:1152},{width:587,height:700}]){
  await page.setViewportSize(viewport);await fillsViewport(page);const cards=await page.locator('.hall-room').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {width:box.width,height:box.height};}));assert.ok(cards.every(card=>card.height===120&&card.width<=380),'cards stay proportional instead of expanding with the viewport');await expect(page.locator('.hall-illustration')).toHaveCount(0);await visibleInViewport(page,page.locator('.hall-chat'));
  const images=await page.locator('.arena-hall,.hall-rooms,.hall-header').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundImage).join(' '));assert.doesNotMatch(images,/arena-foyer|parchment|wood/,'arena surfaces no longer use the rejected materials');
  for(const control of [page.getByRole('button',{name:'Sair da arena',exact:true}),page.getByRole('button',{name:'Criar sala',exact:true}),page.getByRole('button',{name:'Pesquisar salas',exact:true}),page.getByRole('textbox',{name:'Mensagem de chat'})])await visibleInViewport(page,control);
  await capture(page,`${output}/fullscreen-${viewport.width}.png`);
 }
 for(const viewport of [{width:844,height:390},{width:932,height:430},{width:667,height:375}]){
  const mobile=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1}),mp=await mobile.newPage();mp.on('pageerror',error=>errors.push(error.message));await enterGame(mp,base);await mp.locator('.bottom-dock').getByRole('button',{name:/^Arena(?:\s|$)/}).click();
  await expect(mp.locator('html')).toHaveClass(/mobile-landscape/);await fillsViewport(mp);for(const control of [mp.getByRole('button',{name:'Sair da arena',exact:true}),mp.getByRole('button',{name:'Criar sala',exact:true}),mp.getByRole('button',{name:'Pesquisar salas',exact:true}),mp.getByRole('textbox',{name:'Mensagem de chat'})])await visibleInViewport(mp,control);
  await mp.getByRole('button',{name:'Pesquisar salas',exact:true}).tap();await visibleInViewport(mp,mp.getByRole('textbox',{name:'Buscar sala'}));await capture(mp,`${output}/fullscreen-landscape-${viewport.width}.png`);
  await mp.setViewportSize({width:viewport.height,height:viewport.width});await expect(mp.getByRole('alertdialog',{name:'Vire o celular'})).toBeVisible();await mp.setViewportSize(viewport);await expect(mp.getByRole('alertdialog',{name:'Vire o celular'})).toHaveCount(0);await expect(mp.locator('.arena-hall')).toBeVisible();await mobile.close();
 }
 checks.push('search behind magnifier, accent insensitive; fullscreen1536/1280/2048/narrow587 with compact cards; landscape844/932/667 with accessible actions and portrait gate');assert.deepEqual(errors,[]);
 await writeFile(`${output}/${layoutOnly?'layout-report':'report'}.json`,JSON.stringify({layoutOnly,checks,errors},null,2));console.log(JSON.stringify({layoutOnly,checks,errors}));
}finally{
 for(const peer of peers){if(peer.socket.readyState===WebSocket.OPEN){try{await command(peer,{type:'leave'},'room',event=>event.room===null);}catch{}peer.socket.close();}}
 await browser.close();
}
