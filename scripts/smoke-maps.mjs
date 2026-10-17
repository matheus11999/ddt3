import {enterGame} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chargeWithPointer} from './charge-helpers.mjs';

// Explicit practice commands select deterministic maps through the real server.
// All battle controls below use the actual UI; matchmaking UI is smoke-rooms' job.
// Works against Docker or Vite without imported client modules or mocked state.
const base=process.env.BASE_URL??'http://127.0.0.1:8097';
const output='test-results/maps/browser';
const maps=[['garden','Jardim Encantado'],['park','Parque dos Sonhos'],['celestial','Fortaleza Celestial']];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1536,height:864}});
const page=await context.newPage(),errors=[],serverErrors=[],commands=[],events=[],results=[];
await context.addInitScript(()=>{
 const Native=window.WebSocket;
 window.WebSocket=class extends Native {constructor(...args){super(...args);if(new URL(String(args[0]),location.href).pathname==='/ws')window.__mapTestSocket=this;}};
});
const send=command=>page.evaluate(command=>{
 const socket=window.__mapTestSocket;if(!socket||socket.readyState!==WebSocket.OPEN)throw Error('The game WebSocket is not connected');
 socket.send(JSON.stringify(command));
},command);
let battle=null,profile=null,partner;
page.on('pageerror',error=>errors.push(error.message));
page.on('websocket',socket=>{
 socket.on('framesent',frame=>{try{commands.push(JSON.parse(String(frame.payload)));}catch{}});
 socket.on('framereceived',frame=>{
  const event=JSON.parse(String(frame.payload));events.push(event);
  if(event.type==='welcome'){profile=event.profile;battle=event.battle;}
  if(event.type==='battle')battle=event.battle;
  if(event.type==='error')serverErrors.push(event.message);
 });
});
async function waitEvent(journal,type,predicate=()=>true,after=0,timeout=15000){
 await expect.poll(()=>journal.slice(after).some(event=>event.type===type&&predicate(event)),{timeout,message:`waiting for actual ${type} network event`}).toBe(true);
 return journal.slice(after).find(event=>event.type===type&&predicate(event));
}
async function connectPartner(){
 const response=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'male'}),signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const {profile}=await response.json(),journal=[];
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base,headers:{Cookie:cookie},handshakeTimeout:10000});
 socket.on('message',raw=>journal.push(JSON.parse(raw.toString())));
 socket.on('error',error=>errors.push(`partner websocket: ${error.message}`));
 const send=command=>{const mark=journal.length;socket.send(JSON.stringify(command));return mark;};
 const request=async(command,type,predicate=()=>true)=>{const mark=send(command);return waitEvent(journal,type,predicate,mark);};
 await waitEvent(journal,'welcome');await request({type:'rename',name:`TEST-MAP-UI-${profile.id.slice(0,6)}`},'profile');
 return {socket,profile,events:journal,send,request};
}
async function settledFrames(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function screenshot(name){await settledFrames();await page.screenshot({path:`${output}/${name}.png`});}

try{
 await enterGame(page,base);await expect(page.locator('.bottom-dock')).toBeVisible();
 await page.evaluate(()=>Promise.all(['ember','volt','crystal'].map(async weapon=>{const image=new Image();image.src=`/assets/vfx/${weapon}-effects.png`;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw Error(`Missing painted effects for ${weapon}`);})));
 partner=await connectPartner();
 for(const [map,name] of maps){
  const createMark=events.length;await send({type:'create',practice:true,name:`TEST map ${map}`,mode:'1v1',map});
  const created=await waitEvent(events,'room',event=>event.room?.map===map,createMark);assert.equal(created.room.mode,'1v1');assert.equal(created.room.practice,true);
  await partner.request({type:'join',roomId:created.room.id},'room',event=>event.room?.id===created.room.id);
  await partner.request({type:'ready'},'room',event=>event.room?.players.some(p=>p.id===partner.profile.id&&p.ready));
  const startMark=events.length;await send({type:'start'});
  const started=await waitEvent(events,'battle',event=>event.battle?.map===map,startMark);assert.equal(started.battle.players.length,2);assert.ok(started.battle.terrain);
  await expect(page.locator('.battle-console')).toBeVisible();
  // Decode the map illustration and texture before capturing, including cold loads.
  await page.evaluate(async id=>{
   for(const suffix of ['midground','terrain-world','props']){const image=new Image();image.src=`/assets/maps/${id}-${suffix}.png`;await image.decode();}
  },map);
  const quality=page.getByRole('combobox',{name:'Qualidade do cenário'}),zoom=page.getByLabel('Zoom do cenário'),options=page.getByRole('button',{name:'Mais opções do cenário',exact:true});
  await options.click();await expect(options).toHaveAttribute('aria-expanded','true');
  await quality.selectOption('high');await expect(quality).toHaveValue('high');await options.click();
  await expect(zoom).toHaveText('100%');await screenshot(`${map}-wide`);
  const physicsCommands=()=>commands.filter(command=>!['aim','ping'].includes(command.type)).length;
  const beforeControls=physicsCommands();
  await page.getByRole('button',{name:'Aproximar cenário',exact:true}).click();
  await page.getByRole('button',{name:'Aproximar cenário',exact:true}).click();
  await expect(zoom).toHaveText('130%');await screenshot(`${map}-zoom`);
  const explore=page.getByRole('button',{name:'Explorar cenário',exact:true});await explore.click();await expect(explore).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Afastar cenário',exact:true}).click();await expect(zoom).toHaveText('115%');
  await page.getByRole('button',{name:'Restaurar câmera',exact:true}).click();await expect(zoom).toHaveText('100%');await expect(explore).toHaveAttribute('aria-pressed','false');
  // Space activates the focused camera button; it must not leak to shooting.
  const zoomIn=page.getByRole('button',{name:'Aproximar cenário',exact:true});await zoomIn.focus();await zoomIn.press('Space');await expect(zoom).toHaveText('115%');
  await page.getByRole('button',{name:'Restaurar câmera',exact:true}).click();await expect(zoom).toHaveText('100%');
  await options.click();await quality.selectOption('low');await expect(quality).toHaveValue('low');
  assert.equal(await page.evaluate(()=>localStorage.getItem('brasa-environment-quality')),'low');
  const sound=page.getByRole('button',{name:'Sons do cenário',exact:true});await expect(sound).toHaveAttribute('aria-pressed','true');await sound.click();await expect(sound).toHaveAttribute('aria-pressed','false');
  assert.equal(await page.evaluate(()=>localStorage.getItem('brasa-environment-sound')),'off');
  assert.equal(physicsCommands(),beforeControls,'camera and graphics controls must not send game commands');
  await screenshot(`${map}-low`);
  const reloadMark=events.length;await page.reload({waitUntil:'networkidle'});
  const restored=await waitEvent(events,'welcome',event=>event.battle?.id===started.battle.id,reloadMark);
  assert.equal(restored.battle.map,map);assert.ok(restored.battle.terrain);await options.click();await expect(quality).toHaveValue('low');
  await expect(sound).toHaveAttribute('aria-pressed','false');await sound.click();await expect(sound).toHaveAttribute('aria-pressed','true');
  // Return a timed-out turn through the legal opponent action, if necessary.
  if(battle.phase==='aiming'&&battle.turnId===partner.profile.id){const mark=events.length;partner.send({type:'pass'});await waitEvent(events,'battle',event=>event.battle?.turnId===profile.id&&event.battle.phase==='aiming',mark);}
  await quality.selectOption('high');await options.click();
  await page.getByRole('button',{name:'Dois disparos adicionais, 110 vigor',exact:true}).click();
  await page.getByRole('button',{name:/Tridente, 110 vigor/}).click();
  const fireMark=events.length;await chargeWithPointer(page,25);
  const shot=await waitEvent(events,'shot',()=>true,fireMark);assert.equal(shot.shot.projectiles.length,9);
  await expect(page.locator('.turn-clock')).toContainText('DISPARO');await screenshot(`${map}-firing`);
  const final=await waitEvent(events,'battle',event=>event.battle?.id===started.battle.id&&event.battle.phase!=='resolving'&&event.battle.turnNumber>started.battle.turnNumber,fireMark,shot.shot.duration+12000);
  assert.ok(final.battle.terrain,'completed shot must deliver full authoritative terrain');
  if(map==='celestial')assert.equal(final.battle.terrain,started.battle.terrain,'celestial must remain intact');else assert.notEqual(final.battle.terrain,started.battle.terrain,`${map}: real shot should create craters`);
  await screenshot(`${map}-after-impact`);
  if(map==='celestial'){
   await page.setViewportSize({width:640,height:960});
   const toggle=page.getByRole('button',{name:'Cenário e câmera',exact:true});await expect(toggle).toBeVisible();await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
   await quality.selectOption('medium');await expect(quality).toHaveValue('medium');
   await page.getByRole('button',{name:'Aproximar cenário',exact:true}).click();await expect(zoom).toHaveText('115%');await screenshot(`${map}-compact-controls`);
   await page.setViewportSize({width:1536,height:864});
  }
  await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();
  await partner.request({type:'leave'},'room',event=>event.room===null);
  results.push({map,name,setup:'practice-protocol',realPlayers:2,projectiles:9,zoom:true,qualityPersistence:true,ambientMutePersistence:true,reconnect:true,compactControls:map==='celestial'});
  console.log(`${map}: practice protocol setup, real battle UI, 9 projectiles, camera/quality/audio and reconnect OK`);
 }
 assert.deepEqual(errors,[],'browser JavaScript errors');assert.deepEqual(serverErrors,[],'game rejected an action');
 assert.deepEqual(partner.events.filter(event=>event.type==='error'),[],'partner commands rejected');
 const report={ok:true,base,setup:'practice-protocol',coverage:'battle UI and authoritative map physics; arena matchmaking UI is verified separately',results,errors,serverErrors,testPlayerIds:[profile.id,partner.profile.id]};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){
 await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});
 await writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),errors,serverErrors,lastEvents:events.slice(-15).map(event=>({type:event.type,...(event.type==='battle'?{battle:event.battle&&{id:event.battle.id,phase:event.battle.phase,map:event.battle.map}}:{}),...(event.type==='room'?{roomId:event.room?.id??null}:{}),...(event.type==='error'?{message:event.message}:{})}))},null,2));
 throw error;
}finally{
 if(partner?.socket.readyState===WebSocket.OPEN){partner.send({type:'leave'});partner.socket.close();}
 await browser.close();
}
