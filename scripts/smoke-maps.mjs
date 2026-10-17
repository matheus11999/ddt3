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
const maps=[['snow','Sonho Nevado']];
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
   for(const file of ['background.webp','terrain-world.png']){const image=new Image();image.src=`/assets/maps/${id}/${file}`;await image.decode();}
  },map);
  // The camera has no zoom buttons: holding and dragging the minimap (or the field) looks around, and letting go
  // hands the camera back to the turn. Read where the minimap draws the camera frame (its white outline).
  const minimap=page.getByRole('region',{name:'Minimapa',exact:true}).locator('canvas');
  const frameX=()=>minimap.evaluate(canvas=>{const {width,height}=canvas,data=canvas.getContext('2d').getImageData(0,0,width,height).data,columns=[];
   for(let x=0;x<width;x++){let white=0;for(let y=0;y<height;y++){const i=(y*width+x)*4;if(data[i]>200&&data[i+1]>200&&data[i+2]>200)white++;}if(white>height*.7)columns.push(x);}
   return columns.length?(columns[0]+columns.at(-1))/2/width:null;});
  await screenshot(`${map}-wide`);
  const physicsCommands=()=>commands.filter(command=>!['aim','ping'].includes(command.type)).length;
  const beforeControls=physicsCommands();await expect.poll(frameX).not.toBeNull();const following=await frameX();
  const mini=await minimap.boundingBox(),hold=async x=>{await page.mouse.move(mini.x+mini.width*x,mini.y+mini.height/2);await expect.poll(frameX).toBeCloseTo(Math.min(.75,Math.max(.25,x)),1);};
  await page.mouse.move(mini.x+mini.width*.02,mini.y+mini.height/2);await page.mouse.down();await hold(.02);await screenshot(`${map}-look-left`);
  await hold(.98);await screenshot(`${map}-look-right`);await page.mouse.up();
  await expect.poll(frameX,{message:'letting go returns the camera to the turn'}).toBeCloseTo(following,1);
  assert.equal(physicsCommands(),beforeControls,'looking around the map must not send game commands');
  const reloadMark=events.length;await page.reload({waitUntil:'networkidle'});
  const restored=await waitEvent(events,'welcome',event=>event.battle?.id===started.battle.id,reloadMark);
  assert.equal(restored.battle.map,map);assert.ok(restored.battle.terrain);await expect(minimap).toBeVisible();
  // Return a timed-out turn through the legal opponent action, if necessary.
  if(battle.phase==='aiming'&&battle.turnId===partner.profile.id){const mark=events.length;partner.send({type:'pass'});await waitEvent(events,'battle',event=>event.battle?.turnId===profile.id&&event.battle.phase==='aiming',mark);}
  await page.getByRole('button',{name:'Dois disparos adicionais, 110 vigor',exact:true}).click();
  await page.getByRole('button',{name:/Tridente, 110 vigor/}).click();
  const fireMark=events.length;await chargeWithPointer(page,25);
  const shot=await waitEvent(events,'shot',()=>true,fireMark);assert.equal(shot.shot.projectiles.length,9);
  await expect(page.locator('.turn-clock')).toContainText('DISPARO');await screenshot(`${map}-firing`);
  const final=await waitEvent(events,'battle',event=>event.battle?.id===started.battle.id&&event.battle.phase!=='resolving'&&event.battle.turnNumber>started.battle.turnNumber,fireMark,shot.shot.duration+12000);
  assert.ok(final.battle.terrain,'completed shot must deliver full authoritative terrain');
  assert.notEqual(final.battle.terrain,started.battle.terrain,`${map}: real shot should create craters`);
  await screenshot(`${map}-after-impact`);
  await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();
  await partner.request({type:'leave'},'room',event=>event.room===null);
  results.push({map,name,setup:'practice-protocol',realPlayers:2,projectiles:9,minimapLook:true,reconnect:true});
  console.log(`${map}: practice protocol setup, real battle UI, 9 projectiles, minimap camera and reconnect OK`);
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
