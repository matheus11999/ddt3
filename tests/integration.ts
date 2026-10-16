import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {WebSocket} from 'ws';
import type {Command,Profile,ServerEvent} from '../shared/protocol';
import {SMITH_POSITION} from '../shared/catalog';

export const BASE_URL=process.env.BASE_URL??'http://127.0.0.1:8097';
export const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
type EventOf<T extends ServerEvent['type']>=Extract<ServerEvent,{type:T}>;
export interface TestSession {profile:Profile;cookie:string;}

export async function createSession():Promise<TestSession>{
 const response=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:BASE_URL},signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200,`session HTTP ${response.status}: ${await response.clone().text()}`);
 const header=response.headers.get('set-cookie')??'';assert.match(header,/HttpOnly/i);assert.match(header,/SameSite=Strict/i);
 const cookie=header.split(';')[0];assert.ok(cookie.startsWith('brasa_session='));
 const {profile}=await response.json() as {profile:Profile};return {profile,cookie};
}

/** Events are journaled before any waits are installed, preventing response races. */
export class TestClient {
 readonly socket:WebSocket;
 readonly events:{sequence:number;event:ServerEvent}[]=[];
 private listeners=new Set<()=>void>();
 private failure:Error|null=null;
 profile:Profile;
 sequence=0;
 constructor(readonly session:TestSession){
  this.profile=session.profile;
  this.socket=new WebSocket(`${BASE_URL.replace(/^http/,'ws')}/ws`,{origin:BASE_URL,headers:{Cookie:session.cookie},handshakeTimeout:10000});
  this.socket.on('message',raw=>{
   const event=JSON.parse(raw.toString()) as ServerEvent;
   if(event.type==='welcome'||event.type==='profile')this.profile=event.profile;
   this.events.push({sequence:++this.sequence,event});for(const listener of [...this.listeners])listener();
  });
  this.socket.on('error',error=>{this.failure=error;for(const listener of [...this.listeners])listener();});
  this.socket.on('close',(code,reason)=>{this.failure=new Error(`WebSocket closed ${code}: ${reason.toString()}`);for(const listener of [...this.listeners])listener();});
 }
 wait<T extends ServerEvent['type']>(type:T,predicate:(event:EventOf<T>)=>boolean=()=>true,after=0,timeout=10000):Promise<EventOf<T>>{
  return new Promise((resolve,reject)=>{
   let timer:ReturnType<typeof setTimeout>;
   const cleanup=()=>{clearTimeout(timer);this.listeners.delete(check);};
   const check=()=>{
    const found=this.events.find(entry=>entry.sequence>after&&entry.event.type===type&&predicate(entry.event as EventOf<T>));
    if(found){cleanup();resolve(found.event as EventOf<T>);}else if(this.failure){cleanup();reject(this.failure);}
   };
   timer=setTimeout(()=>{cleanup();reject(Error(`Timed out waiting for ${type} after event ${after}`));},timeout);
   this.listeners.add(check);check();
  });
 }
 send(command:Command|Record<string,unknown>){const mark=this.sequence;this.socket.send(JSON.stringify(command));return mark;}
 async request<T extends ServerEvent['type']>(command:Command|Record<string,unknown>,type:T,predicate:(event:EventOf<T>)=>boolean=()=>true,timeout=10000){
  await pause(80);const mark=this.send(command);return this.wait(type,predicate,mark,timeout);
 }
 async close(){
  if(this.socket.readyState===WebSocket.CLOSED)return;
  await new Promise<void>(resolve=>{const timer=setTimeout(()=>{this.socket.terminate();resolve();},1500);this.socket.once('close',()=>{clearTimeout(timer);resolve();});this.socket.close();});
 }
}

async function verifyDatabaseForge(){
 // A dedicated, tagged account exercises deterministic success/failure with real PostgreSQL.
 // The injectable roll is server-side test code; the network protocol never accepts it.
 const script=`
 import assert from 'node:assert/strict';
 import {Store} from './server/store.ts';
 const failureStore=new Store(()=>999),successStore=new Store(()=>0);
 let ownedId,ownedName;
 try {
  const guest=await failureStore.createGuest();ownedId=guest.profile.id;ownedName='TEST-DB-'+ownedId.slice(0,8);await failureStore.rename(ownedId,ownedName);
  const failed=await failureStore.forge(ownedId,'ember',{'1':1});
  assert.equal(failed.result.success,false);assert.equal(failed.profile.stones['1'],29);assert.equal(failed.profile.upgrades.ember,0);assert.equal(failed.profile.gold,500);
  const succeeded=await successStore.forge(ownedId,'ember',{'1':1});
  assert.equal(succeeded.result.success,true);assert.equal(succeeded.profile.stones['1'],28);assert.equal(succeeded.profile.equipment.upgrade,1);
  const seeded=await failureStore.pool.query("UPDATE players SET profile=jsonb_set(profile,'{stones,1}','1') WHERE id=$1 AND name=$2 RETURNING id",[ownedId,ownedName]);assert.equal(seeded.rowCount,1);
  const attempts=await Promise.allSettled([failureStore.forge(ownedId,'ember',{'1':1}),failureStore.forge(ownedId,'ember',{'1':1})]);
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.filter(r=>r.status==='rejected').length,1);
  const current=await failureStore.getProfile(ownedId);assert.equal(current.stones['1'],0);assert.equal(current.upgrades.ember,1);
  await Promise.all([successStore.saveEquipment(ownedId,{...current.equipment,weapon:'volt',upgrade:12}),successStore.forge(ownedId,'volt',{'2':1})]);
  const final=await failureStore.getProfile(ownedId);assert.equal(final.equipment.weapon,'volt');assert.equal(final.equipment.upgrade,1);assert.equal(final.upgrades.volt,1);
  console.log(JSON.stringify({success:true,failureConsumes:true,successConsumes:true,concurrentSpendProtected:true,equipmentUpgradeRaceProtected:true}));
 } finally {
  if(ownedId&&ownedName)await failureStore.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[ownedId,ownedName]);
  await failureStore.pool.end();await successStore.pool.end();
 }
 `;
 const result=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:script,cwd:resolve(fileURLToPath(new URL('..',import.meta.url))),encoding:'utf8',timeout:30000,windowsHide:true});
 assert.equal(result.status,0,`real PostgreSQL forge checks failed: ${result.stderr||result.error||result.stdout}`);
 return JSON.parse(result.stdout.trim()) as Record<string,boolean>;
}

async function run(){
 const start=performance.now(),checks:string[]=[],clients:TestClient[]=[];
 const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);assert.equal((await health.json() as {ok:boolean}).ok,true);
 const invalidOrigin=await fetch(`${BASE_URL}/api/session`,{method:'POST',headers:{Origin:'https://invalid.example'}});assert.equal(invalidOrigin.status,403);checks.push('HTTP origin rejection');
 try {
  const sessions=await Promise.all([createSession(),createSession()]);
  clients.push(...sessions.map(session=>new TestClient(session)));await Promise.all(clients.map(client=>client.wait('welcome')));
  let [a,b]=clients;
  await a.request({type:'rename',name:`TEST-A-${a.profile.id.slice(0,8)}`},'profile');await b.request({type:'rename',name:`TEST-B-${b.profile.id.slice(0,8)}`},'profile');
  for(const item of ['hat-cap','face-smile','outfit-azure'])await a.request({type:'equip',item},'profile');
  assert.equal(a.profile.equipment.hat,'hat-cap');assert.equal(a.profile.equipment.face,'face-smile');checks.push('equipment and starter cosmetics');
  assert.match((await a.request({type:'forge',item:'ember',stones:{'1':1}},'error')).message,/Aproxime-se/);
  const invalidSelections:Record<string,number>[]=[{'1':-1},{'1':21},{'6':1}];
  for(const stones of invalidSelections)assert.equal((await a.request({type:'forge',item:'ember',stones},'error')).message,'Comando inválido.');
  const malformedMark=a.sequence;a.socket.send('{"type":"fire","angle":NaN,"power":50}');assert.equal((await a.wait('error',()=>true,malformedMark)).message,'Comando inválido.');
  checks.push('forge proximity and malformed quantity/NaN rejection');
  const movement=a.send({type:'move',...SMITH_POSITION});
  await a.wait('lobby',event=>event.players.some(p=>p.id===a.profile.id&&Math.hypot(p.x-SMITH_POSITION.x,p.y-SMITH_POSITION.y)<140),movement,10000);
  const stonesBefore=a.profile.stones['2'];const forged=await a.request({type:'forge',item:'ember',stones:{'2':1}},'forge-result');
  assert.equal(forged.result.success,true);assert.equal(forged.result.chance,100);assert.equal(a.profile.stones['2'],stonesBefore-1);assert.equal(a.profile.equipment.upgrade,1);checks.push('network forge consumption and upgrade');
  const saved=await fetch(`${BASE_URL}/api/session`,{headers:{Cookie:a.session.cookie}});const persisted=(await saved.json() as {profile:Profile}).profile;
  assert.equal(persisted.equipment.upgrade,1);assert.equal(persisted.equipment.hat,'hat-cap');assert.equal(persisted.stones['2'],stonesBefore-1);checks.push('HTTP profile persistence');
  for(const face of ['face-brave','face-smile','face-serene','face-fierce','face-taunt']){
   const observerMark=b.sequence;await a.request({type:'equip',item:face},'profile');
   await b.wait('lobby',event=>event.players.some(player=>player.id===a.profile.id&&player.equipment.face===face),observerMark);
   const response=await fetch(BASE_URL+'/api/session',{headers:{Cookie:a.session.cookie}});const profile=(await response.json() as {profile:Profile}).profile;assert.equal(profile.equipment.face,face);
  }
  checks.push('five faces persist and broadcast to a second real WebSocket client');
  const room=await a.request({type:'create',name:'TEST Integration',mode:'1v1',map:'sky'},'room',event=>!!event.room);
  const roomId=room.room!.id;await b.request({type:'join',roomId},'room',event=>event.room?.id===roomId);
  assert.match((await a.request({type:'forge',item:'ember',stones:{'1':1}},'error')).message,/ferreiro da praça/);
  await b.request({type:'ready'},'room',event=>event.room?.players.some(p=>p.id===b.profile.id&&p.ready)??false);
  const startMark=b.sequence;const started=await a.request({type:'start'},'battle',event=>!!event.battle);const battle=started.battle!;
  await b.wait('battle',event=>event.battle?.id===battle.id,startMark);assert.ok(battle.terrain);assert.equal(battle.players.find(player=>player.id===a.profile.id)!.equipment.face,'face-taunt');checks.push('two-player room create join ready start with saved face');
  const shooter=battle.turnId===a.profile.id?a:b,opponent=shooter===a?b:a;
  assert.match((await opponent.request({type:'fire',angle:45,power:25},'error')).message,/sua vez/);checks.push('out-of-turn action rejected');
  const initialVigor=battle.players.find(player=>player.id===shooter.profile.id)!.stamina;
  const boosted=await shooter.request({type:'boost',boost:'extra2'},'battle',event=>event.battle?.players.find(player=>player.id===shooter.profile.id)?.boosts.includes('extra2')??false);
  assert.equal(boosted.battle!.players.find(player=>player.id===shooter.profile.id)!.stamina,initialVigor-110);
  assert.match((await shooter.request({type:'boost',boost:'extra2'},'error')).message,/já foi usada/);
  await shooter.request({type:'boost',boost:'trident'},'battle',event=>event.battle?.players.find(player=>player.id===shooter.profile.id)?.boosts.includes('trident')??false);
  assert.match((await shooter.request({type:'boost',boost:'damage20'},'error')).message,/Vigor insuficiente/);checks.push('vigor costs duplicate tool rejection and overspend rejection');
  const shot=await shooter.request({type:'fire',angle:45,power:25},'shot');assert.equal(shot.shot.projectiles.length,9);assert.ok(shot.shot.projectiles.every(projectile=>projectile.points.length>1&&projectile.impact.radius>0));
  checks.push('nine authoritative projectiles from +2 and trident');
  const index=clients.indexOf(shooter);await shooter.close();const reconnected=new TestClient(shooter.session);clients[index]=reconnected;
  const welcome=await reconnected.wait('welcome');assert.equal(welcome.battle?.id,battle.id);assert.ok(welcome.battle?.terrain);assert.notEqual(welcome.battle?.terrain,battle.terrain);assert.equal(welcome.profile.equipment.hat,shooter.profile.equipment.hat);checks.push('reconnect restores battle snapshot and destroyed terrain');
  for(const client of clients)await client.request({type:'leave'},'room',event=>event.room===null);
  checks.push('rooms left cleanly');
  const database=verifyDatabaseForge();
  console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,checks,database:await database,durationMs:Math.round(performance.now()-start),testPlayerIds:sessions.map(s=>s.profile.id)},null,2));
 }finally{for(const client of clients){if(client.socket.readyState===WebSocket.OPEN){client.send({type:'leave'});await pause(100);}await client.close();}}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(error=>{console.error(error);process.exitCode=1;});
