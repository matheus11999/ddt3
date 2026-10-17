import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {BASE_URL,createSession,TestClient,pause} from './integration';
import {DEFAULT_ABILITY_LOADOUT,initialAbilities} from '../shared/abilities';
import type {Profile} from '../shared/protocol';

const sessions=await Promise.all([createSession(),createSession()]),clients=sessions.map(session=>new TestClient(session)),checks:string[]=[];
try{
 await Promise.all(clients.map(client=>client.wait('welcome')));for(const [i,client] of clients.entries())await client.request({type:'rename',name:`TEST Loadout ${i}`},'profile');
 const [host,member]=clients;assert.deepEqual(host.profile.abilityLoadout,DEFAULT_ABILITY_LOADOUT);
 const outside=await host.request({type:'ability-loadout',slots:[null,null,null],requestId:'loadout-outside'},'error');assert.equal(outside.requestId,'loadout-outside');
 const room=(await host.request({type:'create'},'room',e=>!!e.room)).room!;await host.request({type:'room-slot',slot:1,open:true},'room',e=>e.room?.openSlots.includes(1)===true);await member.request({type:'join',roomId:room.id},'room');await member.request({type:'ready'},'room',e=>e.room?.players.some(p=>p.id===member.profile.id&&p.ready)===true);
 const before=structuredClone(member.profile),hostMark=host.sequence;
 const saved=await member.request({type:'ability-loadout',slots:['invisibility',null,'heal'],requestId:'loadout-member-1'},'profile',e=>e.requestId==='loadout-member-1');
 assert.deepEqual(saved.profile,{...before,abilityLoadout:['invisibility',null,'heal']});
 const published=(await host.wait('room',e=>e.room?.players.some(p=>p.id===member.profile.id&&p.abilityLoadout?.[0]==='invisibility')===true,hostMark)).room!;assert.ok(published.players.every(p=>!p.ready));assert.deepEqual(published.players.find(p=>p.id===member.profile.id)!.abilityLoadout,['invisibility',null,'heal']);
 const malformed=await member.request({type:'ability-loadout',slots:['heal','heal',null],requestId:'loadout-duplicate'},'error');assert.equal(malformed.message,'Comando inválido.');
 const persistedResponse=await fetch(BASE_URL+'/api/session',{headers:{Cookie:member.session.cookie},signal:AbortSignal.timeout(10000)});const persisted=(await persistedResponse.json() as {profile:Profile}).profile;assert.deepEqual(persisted.abilityLoadout,['invisibility',null,'heal']);assert.equal(persisted.gold,before.gold);assert.deepEqual(persisted.equipment,before.equipment);
 await member.close();clients[1]=new TestClient(member.session);const resumed=await clients[1].wait('welcome');assert.equal(resumed.room?.id,room.id);assert.deepEqual(resumed.profile.abilityLoadout,['invisibility',null,'heal']);assert.deepEqual(resumed.room!.players.find(p=>p.id===member.profile.id)!.abilityLoadout,['invisibility',null,'heal']);
 checks.push('bounded correlated ACK, room readiness reset, duplicate rejection and durable HTTP/reconnect selection');
 await host.request({type:'ability-loadout',slots:[null,null,null],requestId:'loadout-empty'},'profile',e=>e.requestId==='loadout-empty');
 const emptyResponse=await fetch(BASE_URL+'/api/session',{headers:{Cookie:host.session.cookie},signal:AbortSignal.timeout(10000)});assert.deepEqual((await emptyResponse.json() as {profile:Profile}).profile.abilityLoadout,[null,null,null]);
 const battle=(await host.request({type:'practice-start'},'battle',e=>e.battle?.phase==='aiming')).battle!,self=battle.players.find(p=>p.id===host.profile.id)!;
 assert.deepEqual(self.abilityLoadout,[null,null,null]);assert.deepEqual(self.abilities,{heal:0,homing:0,invisibility:0});assert.deepEqual(battle.players.find(p=>p.id===member.profile.id)!.abilities,{heal:1,homing:0,invisibility:1});assert.ok(battle.players.filter(p=>p.bot).every(p=>JSON.stringify(p.abilities)===JSON.stringify(initialAbilities())));
 for(const ability of DEFAULT_ABILITY_LOADOUT)assert.match((await host.request({type:'ability',ability},'error')).message,/não está equipada/);
 const locked=await host.request({type:'ability-loadout',slots:[...DEFAULT_ABILITY_LOADOUT],requestId:'loadout-battle'},'error');assert.equal(locked.requestId,'loadout-battle');assert.match(locked.message,/aguarda/);
 await host.request({type:'flight',active:true},'battle',e=>e.battle?.players.some(p=>p.id===self.id&&p.flightArmed)===true);await host.request({type:'flight',active:false},'battle',e=>e.battle?.players.some(p=>p.id===self.id&&p.flightArmed===false)===true);
 checks.push('explicit empty slots persist; match has only chosen abilities; default bots and independent flight remain available');
 const script=`
 import assert from 'node:assert/strict';
 import {Store} from './server/store.ts';
 const store=new Store();let id,name;
 try {
  const guest=await store.createGuest();id=guest.profile.id;name='TEST-LOADOUT-DB-'+id.slice(0,6);await store.rename(id,name);
  const initial=await store.getProfile(id),equipment={...initial.equipment,visibility:{hat:false,glasses:false,costume:true}};
  await Promise.all([store.saveAbilityLoadout(id,[null,'homing','heal']),store.saveEquipment(id,equipment)]);
  const final=await store.getProfile(id);assert.deepEqual(final.abilityLoadout,[null,'homing','heal']);assert.equal(final.equipment.visibility.hat,false);assert.equal(final.equipment.visibility.glasses,false);assert.equal(final.gold,initial.gold);assert.deepEqual(final.upgrades,initial.upgrades);assert.deepEqual(final.stones,initial.stones);
  await assert.rejects(store.saveAbilityLoadout(id,['heal','heal',null]));assert.deepEqual(await store.getProfile(id),final);
  await store.saveAbilityLoadout(id,[null,null,null]);assert.deepEqual((await store.session(guest.token)).abilityLoadout,[null,null,null]);
  console.log(JSON.stringify({concurrentEquipmentProtected:true,invalidSelectionNoWrite:true,emptySlotsPersistAfterSessionReload:true}));
 } finally {if(id&&name)await store.pool.query('DELETE FROM players WHERE id=$1 AND name=$2',[id,name]);await store.pool.end();}
 `;
 const result=spawnSync('docker',['compose','exec','-T','server','node','--import','tsx','--input-type=module'],{input:script,cwd:resolve(fileURLToPath(new URL('..',import.meta.url))),encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(result.status,0,result.stderr||result.error||result.stdout);const database=JSON.parse(result.stdout.trim());
 console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,checks,database},null,2));
}finally{for(const client of clients){if(client.socket.readyState===1){client.send({type:'leave'});await pause(60);}await client.close();}}
