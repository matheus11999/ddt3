import {enterGame} from './character-helpers.mjs';
import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {animationFrames,observeChargeReleases,waitForCharge} from './charge-helpers.mjs';

const base=process.env.BASE_URL??'http://127.0.0.1:5177',output='test-results/battle-controls';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:1536,height:864},hasTouch:true});
const page=await context.newPage(),commands=[],events=[],errors=[],checks=[],shots=[];
// Deterministic practice setup uses the real game socket. Everything asserted
// after launch is exercised through the rendered battle HUD and server events.
await context.addInitScript(()=>{
 const Native=window.WebSocket;
 window.WebSocket=class extends Native {constructor(...args){super(...args);if(new URL(String(args[0]),location.href).pathname==='/ws')window.__battleTestSocket=this;}};
});
const send=command=>page.evaluate(command=>{
 const socket=window.__battleTestSocket;if(!socket||socket.readyState!==WebSocket.OPEN)throw Error('The game WebSocket is not connected');
 socket.send(JSON.stringify(command));
},command);
let partner,profile;
page.on('pageerror',error=>errors.push(error.message));
page.on('websocket',socket=>{
 socket.on('framesent',frame=>{try{commands.push(JSON.parse(String(frame.payload)));}catch{}});
 socket.on('framereceived',frame=>{try{events.push(JSON.parse(String(frame.payload)));}catch{}});
});
const fires=()=>commands.filter(command=>command.type==='fire');
async function waitEvent(journal,type,predicate=()=>true,after=0,timeout=15000){
 await expect.poll(()=>journal.slice(after).some(event=>event.type===type&&predicate(event)),{timeout,message:`waiting for actual ${type} event`}).toBe(true);
 return journal.slice(after).find(event=>event.type===type&&predicate(event));
}
async function connectPartner(){
 const response=await fetch(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({gender:'male'}),signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const {profile}=await response.json(),journal=[];
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base,headers:{Cookie:cookie},handshakeTimeout:10000});
 socket.on('message',raw=>journal.push(JSON.parse(raw.toString())));socket.on('error',error=>errors.push(`partner: ${error.message}`));
 const send=command=>{const mark=journal.length;socket.send(JSON.stringify(command));return mark;};
 const request=async(command,type,predicate=()=>true)=>waitEvent(journal,type,predicate,send(command));
 await waitEvent(journal,'welcome');await request({type:'rename',name:`TEST-HUD-${profile.id.slice(0,6)}`},'profile');return {socket,profile,events:journal,send,request};
}
async function blurControl(){await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});}
async function assertNoFire(before,check){await animationFrames(page);assert.equal(fires().length,before,check);checks.push(check);}
async function assertRelease(before,mark,input,expectedPower){
 const shot=await waitEvent(events,'shot',()=>true,mark);await animationFrames(page);
 assert.equal(fires().length,before+1,'a release must send exactly one fire command');
 const command=fires().at(-1),visible=await page.evaluate(input=>window.__brasaChargeQA.releases.filter(release=>release.input===input).at(-1),input);
 assert.ok(visible,`missing ${input} release observation`);assert.equal(visible.power,visible.meter,'meter and displayed power must agree');
 assert.equal(command.power,visible.power,'server command must equal the last committed visible power at release');
 assert.ok(Number.isInteger(command.power)&&command.power>=5&&command.power<=100);
 if(expectedPower!==undefined)assert.equal(command.power,expectedPower);
 await expect(page.getByTestId('last-shot-power')).toHaveText(String(command.power));
 assert.equal(shot.shot.projectiles.length,1,'one unboosted release must create one authoritative projectile');
 // Observe consecutive paints after the server starts the shot: a RAF already
 // queued at release must not overwrite the frozen value with a later charge.
 const frozen=await page.evaluate(()=>new Promise(resolve=>{
  const start=performance.now(),samples=[];
  const sample=now=>{
   samples.push({power:Number(document.querySelector('[data-testid="shot-power"]')?.textContent),meter:Number(document.querySelector('[role="meter"][aria-label="Força do disparo"]')?.getAttribute('aria-valuenow')),last:Number(document.querySelector('[data-testid="last-shot-power"]')?.textContent)});
   if(now-start<220)requestAnimationFrame(sample);else resolve(samples);
  };requestAnimationFrame(sample);
 }));
 assert.ok(frozen.length>=2,'release power must be observed across multiple paints');
 for(const sample of frozen)assert.deepEqual(sample,{power:command.power,meter:command.power,last:command.power},'displayed power must stay frozen at the released value during shot startup');
 shots.push({input,power:command.power,projectiles:shot.shot.projectiles.length,frozenFrames:frozen.length});
 return shot.shot;
}
async function returnTurn(shot,mark){
 const settled=await waitEvent(events,'battle',event=>event.battle?.phase==='aiming'&&event.battle.turnId===partner.profile.id,mark,shot.duration+12000);
 assert.ok(settled.battle.terrain);const passMark=events.length;partner.send({type:'pass'});
 await waitEvent(events,'battle',event=>event.battle?.phase==='aiming'&&event.battle.turnId===profile.id,passMark);
 await expect(page.getByRole('meter',{name:'Força do disparo',exact:true})).toHaveAttribute('aria-disabled','false');
}

try{
 await enterGame(page,base);await expect(page.locator('.bottom-dock')).toBeVisible();
 profile=(await waitEvent(events,'welcome')).profile;partner=await connectPartner();
 let mark=events.length;await send({type:'create',practice:true,name:'TEST Charge controls',mode:'1v1',map:'snow'});const room=(await waitEvent(events,'room',event=>!!event.room,mark)).room;
 assert.equal(room.practice,true);assert.equal(room.map,'snow');assert.equal(room.mode,'1v1');
 await partner.request({type:'join',roomId:room.id},'room',event=>event.room?.id===room.id);await partner.request({type:'ready'},'room',event=>event.room?.players.some(p=>p.id===partner.profile.id&&p.ready));
 mark=events.length;await send({type:'start'});await waitEvent(events,'battle',event=>event.battle?.turnId===profile.id,mark);
 const meter=page.getByRole('meter',{name:'Força do disparo',exact:true}),charge=page.getByRole('meter',{name:'Força do disparo',exact:true});
 await expect(meter).toHaveAttribute('aria-valuemin','5');await expect(meter).toHaveAttribute('aria-valuemax','100');await expect(charge).toHaveAttribute('aria-disabled','false');
 await expect(page.getByRole('slider',{name:'Força do disparo'})).toHaveCount(0);await expect(page.locator('.battle-console')).not.toContainText('ARMA EQUIPADA');
 await observeChargeReleases(page);await page.screenshot({path:`${output}/hud.png`});

 let before=fires().length;
 const control=page.getByRole('button',{name:'Aumentar ângulo',exact:true});await control.focus();await control.press('Space');await assertNoFire(before,'Space on a focused battle button does not shoot');
 await blurControl();
 await page.keyboard.down('Space');await waitForCharge(page,20);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');await assertNoFire(before,'window blur cancels a held charge');

 await blurControl();await page.keyboard.down('Space');await waitForCharge(page,20);await page.keyboard.press('b');
 const bag=page.getByRole('dialog',{name:'Mochila'});await expect(bag).toBeVisible();await page.keyboard.up('Space');await assertNoFire(before,'opening a modal cancels rather than releasing a shot');
 const search=bag.getByRole('textbox',{name:'Buscar item'});await search.focus();await search.press('Space');await assertNoFire(before,'Space in a focused text input does not shoot');await bag.getByRole('button',{name:'Fechar',exact:true}).click();

 const cdp=await context.newCDPSession(page);
 const touch=async(type)=>{const box=await charge.boundingBox();assert.ok(box);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchStart'?[{x:box.x+box.width/2,y:box.y+box.height/2,radiusX:4,radiusY:4,force:1,id:1}]:[]});};
 await touch('touchStart');await waitForCharge(page,20);await touch('touchCancel');await assertNoFire(before,'touch cancellation does not release a shot');

 await blurControl();mark=events.length;await page.keyboard.down('Space');await waitForCharge(page,35);
 const held=Number(await meter.getAttribute('aria-valuenow'));await page.keyboard.down('Space');await animationFrames(page,2);assert.ok(Number(await meter.getAttribute('aria-valuenow'))>=held,'keyboard repeat must not restart charging');
 assert.equal(fires().length,before,'holding Space must not submit before release');await page.keyboard.up('Space');const keyboardShot=await assertRelease(before,mark,'keyboard');await page.keyboard.up('Space');await animationFrames(page);assert.equal(fires().length,before+1,'duplicate keyup cannot shoot twice');checks.push('keyboard release uses the committed visible power once');
 await page.screenshot({path:`${output}/keyboard-shot.png`});await returnTurn(keyboardShot,mark);

 before=fires().length;mark=events.length;await blurControl();await page.keyboard.down('Space');await waitForCharge(page,100);await animationFrames(page,8);await expect(meter).toHaveAttribute('aria-valuenow','100');assert.equal(fires().length,before,'a full charge must wait for release instead of auto-firing');await page.screenshot({path:`${output}/maximum-charge.png`});await page.keyboard.up('Space');
 const maximumShot=await assertRelease(before,mark,'keyboard',100);checks.push('holding at the cap stays at 100 and sends 100 once');await returnTurn(maximumShot,mark);

 before=fires().length;mark=events.length;await touch('touchStart');await waitForCharge(page,35);assert.equal(fires().length,before,'holding a touch must not fire before release');await touch('touchEnd');const touchShot=await assertRelease(before,mark,'touch');checks.push('real touch hold/release matches keyboard power semantics');await returnTurn(touchShot,mark);
 await cdp.detach();
 await page.getByRole('button',{name:'Sair da batalha',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.locator('.bottom-dock')).toBeVisible();await partner.request({type:'leave'},'room',event=>event.room===null);
 await animationFrames(page);await expect(page.locator('.bottom-dock')).toBeVisible();
 assert.deepEqual(errors,[]);assert.deepEqual(events.filter(event=>event.type==='error'),[]);assert.deepEqual(partner.events.filter(event=>event.type==='error'),[]);
 const report={ok:true,base,setup:'practice-protocol',map:'snow',coverage:'real battle HUD inputs and authoritative shot events; arena matchmaking UI is verified separately',checks,shots,testPlayerIds:[profile.id,partner.profile.id]};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){
 await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),errors,commands,serverErrors:events.filter(event=>event.type==='error')},null,2));throw error;
}finally{
 if(partner?.socket.readyState===WebSocket.OPEN){partner.send({type:'leave'});partner.socket.close();}await browser.close();
}
