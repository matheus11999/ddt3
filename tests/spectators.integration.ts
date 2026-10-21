import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {BASE_URL,createSession,TestClient,pause} from './integration';
import type {Profile} from '../shared/protocol';
import {HIDDEN_POSITION} from '../shared/abilities';

const clients:TestClient[]=[],checks:string[]=[];let stage='sessions';
const currentRoom=(client:TestClient)=>[...client.events].reverse().find(({event})=>event.type==='room'||event.type==='welcome')?.event;
async function leave(client:TestClient){const event=currentRoom(client);if(client.socket.readyState===1&&event&&(event.type==='room'||event.type==='welcome')&&event.room){const mark=client.send({type:'leave'});await client.wait('room',event=>event.room===null,mark);}}
try{
 const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);
 const sessions=await Promise.all(Array.from({length:4},()=>createSession()));clients.push(...sessions.map(session=>new TestClient(session)));await Promise.all(clients.map(client=>client.wait('welcome')));
 for(const [index,client] of clients.entries())await client.request({type:'rename',name:`TEST Watching ${index}`},'profile');
 const [host,mate,observer,late]=clients,observerProfile=structuredClone(observer.profile),lateProfile=structuredClone(late.profile);
 stage='waiting room';const room=(await host.request({type:'create',practice:true,mode:'1v1',map:'celestial'},'room',event=>!!event.room)).room!;assert.deepEqual(room.spectatorSlots,[]);assert.deepEqual(room.spectators,[]);
 assert.match((await observer.request({type:'spectate',roomId:room.id},'error')).message,/lugar aberto/);
 for(const slot of [0,1] as const)await host.request({type:'room-spectator-slot',slot,open:true},'room',event=>event.room?.spectatorSlots?.includes(slot)===true);
 await observer.request({type:'spectate',roomId:room.id},'room',event=>event.room?.spectators?.some(value=>value.id===observer.profile.id)===true);
 assert.match((await host.request({type:'room-spectator-slot',slot:0,open:false},'error')).message,/Retire/);
 await mate.request({type:'join',roomId:room.id},'room',event=>event.room?.id===room.id);await mate.request({type:'ready'},'room',event=>event.room?.players.some(player=>player.id===mate.profile.id&&player.ready)===true);
 assert.match((await observer.request({type:'ready'},'error')).message,/assistindo/);
 const observedStart=observer.sequence;let battle=(await host.request({type:'start'},'battle',event=>event.battle?.phase==='aiming')).battle!;assert.equal(battle.players.length,2);assert.ok(!battle.players.some(player=>player.id===observer.profile.id));await observer.wait('battle',event=>event.battle?.id===battle.id,observedStart);
 checks.push('closed defaults, host-only capacity, waiting observer and fighter slots remain separate at start');

 stage='visible shot';const shooter=clients.find(client=>client.profile.id===battle.turnId)!,shotMark=observer.sequence;
 await shooter.charge(20,65);await shooter.request({type:'fire',angle:65,power:20},'shot');const shot=(await observer.wait('shot',()=>true,shotMark)).shot;assert.ok(shot.projectiles.length);
 const lateMark=late.sequence;await late.request({type:'spectate',roomId:room.id},'room',event=>event.room?.spectators?.some(value=>value.id===late.profile.id)===true);
 const hydration=(await late.wait('battle',event=>event.battle?.id===battle.id,lateMark)).battle!;assert.equal(hydration.activeShot!.id,shot.id);assert.deepEqual(hydration.activeShot!.projectiles,shot.projectiles);assert.ok(hydration.terrain);
 await observer.close();clients[2]=new TestClient(sessions[2]);const resumed=await clients[2].wait('welcome');assert.equal(resumed.room?.id,room.id);assert.ok(resumed.room!.spectators!.some(value=>value.id===observer.profile.id&&value.connected));assert.equal(resumed.battle?.id,battle.id);
 const landed=await late.wait('impact',event=>event.shotId===shot.id,lateMark,shot.duration+5000);assert.equal(landed.projectileIndex,0);
 battle=(await late.wait('battle',event=>event.battle?.id===battle.id&&event.battle.phase==='aiming'&&event.battle.turnNumber>battle.turnNumber,lateMark,shot.duration+5000)).battle!;
 for(const command of [{type:'fire',angle:45,power:50},{type:'walk',direction:1},{type:'boost',boost:'extra1'},{type:'ability',ability:'heal'},{type:'flight',active:true},{type:'pass'},{type:'reward-pick',card:3},{type:'ability-loadout',slots:[null,null,null],requestId:'watcher-lock'}])assert.match((await clients[2].request(command,'error')).message,/assistindo/);
 const equipped=await clients[2].request({type:'equip',item:observer.profile.equipment.face},'profile');observerProfile.equippedOnce=true;assert.deepEqual(equipped.profile,observerProfile);
 checks.push('live weapon/impact delivery, mid-shot terrain hydration, reconnect and read-only battle controls');

 stage='hidden shot';const invisible=clients.find(client=>client.profile.id===battle.turnId)!,hiddenMark=late.sequence;
 await invisible.request({type:'ability',ability:'invisibility'},'battle',event=>event.battle?.players.some(player=>player.id===invisible.profile.id&&(player.invisibleTurns??0)>0)===true);
 const effect=await late.wait('ability-effect',event=>event.playerId===invisible.profile.id&&event.ability==='invisibility',hiddenMark);assert.equal(effect.hidden,true);assert.equal(effect.x,HIDDEN_POSITION);
 const hiddenBattle=(await late.wait('battle',event=>event.battle?.players.some(player=>player.id===invisible.profile.id&&player.hidden)===true,hiddenMark)).battle!;assert.equal(hiddenBattle.players.find(player=>player.id===invisible.profile.id)!.y,HIDDEN_POSITION);
 const secondShot=late.sequence;await invisible.charge(20,65);await invisible.request({type:'fire',angle:65,power:20},'shot');const concealed=(await late.wait('shot',event=>event.shot.shooterId===invisible.profile.id,secondShot)).shot;assert.equal(concealed.hidden,true);assert.deepEqual(concealed.projectiles,[]);
 await clients[2].close();clients[2]=new TestClient(sessions[2]);const concealedReconnect=await clients[2].wait('welcome');assert.equal(concealedReconnect.battle!.players.find(player=>player.id===invisible.profile.id)!.x,HIDDEN_POSITION);assert.equal(concealedReconnect.battle!.activeShot!.hidden,true);assert.deepEqual(concealedReconnect.battle!.activeShot!.projectiles,[]);
 await late.request({type:'leave'},'room',event=>event.room===null);const reentry=late.sequence;await late.request({type:'spectate',roomId:room.id},'room',event=>event.room?.id===room.id);await late.wait('battle',event=>event.battle?.id===battle.id,reentry);
 battle=(await late.wait('battle',event=>event.battle?.id===battle.id&&event.battle.phase==='aiming'&&event.battle.turnNumber>battle.turnNumber,secondShot,concealed.duration+5000)).battle!;
 checks.push('invisibility hides shot paths and positional ability data from observers, including reconnect; leave/rejoin cannot affect turns');

 stage='finish match';while(battle.phase!=='finished'){
  const actor=clients.find(client=>client.profile.id===battle.turnId)!;
  battle=(await actor.request({type:'pass'},'battle',event=>event.battle?.id===battle.id&&(event.battle.phase==='finished'||event.battle.turnNumber>battle.turnNumber))).battle!;
 }
 stage='rewards and return';const endMarks=clients.map(client=>client.sequence);for(const index of [2,3])assert.match((await clients[index].request({type:'reward-pick',card:index},'error')).message,/assistindo/);
 await pause(Math.max(0,(battle.rewards!.opensAt??0)-Date.now()+40));
 await Promise.all([host.request({type:'reward-pick',card:0},'battle',event=>event.battle?.rewards?.cards[0].playerId===host.profile.id),mate.request({type:'reward-pick',card:1},'battle',event=>event.battle?.rewards?.cards[1].playerId===mate.profile.id)]);
 const reveal=(await clients[2].wait('battle',event=>event.battle?.rewards?.phase==='revealed',endMarks[2])).battle!;assert.ok(reveal.rewards!.cards.every(card=>card.prize));assert.equal(reveal.rewards!.cards.filter(card=>card.playerId).length,2);
 await Promise.all(clients.map((client,index)=>client.wait('battle',event=>event.battle===null,endMarks[index],10000)));
 const returned=(await clients[2].wait('room',event=>event.room?.id===room.id&&event.room.status==='waiting',endMarks[2])).room!;assert.deepEqual(returned.spectatorSlots,[0,1]);assert.equal(returned.spectators!.length,2);assert.equal(returned.number,room.number);assert.equal(returned.players.length,2);
 for(const [index,original] of [[2,observerProfile],[3,lateProfile]] as const){const response=await fetch(`${BASE_URL}/api/session`,{headers:{Cookie:sessions[index].cookie},signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);assert.deepEqual((await response.json() as {profile:Profile}).profile,original);}
 checks.push('observer sees revealed cards but cannot choose; only fighters receive rewards and all watchers return to the same room');

 stage='leave restored room';for(const client of clients)await leave(client);
 stage='current practice with bots';
 const party=(await host.request({type:'create'},'room',event=>!!event.room)).room!;await host.request({type:'room-spectator-slot',slot:0,open:true},'room',event=>event.room?.spectatorSlots?.includes(0)===true);await clients[2].request({type:'spectate',roomId:party.id},'room',event=>event.room?.id===party.id);
 const practiceMark=clients[2].sequence,practice=(await host.request({type:'practice-start'},'battle',event=>event.battle?.phase==='aiming')).battle!;assert.equal(practice.players.length,2);assert.equal(practice.players.filter(player=>player.bot).length,1);await clients[2].wait('battle',event=>event.battle?.id===practice.id,practiceMark);
 const detachMark=clients[2].sequence;await host.request({type:'leave'},'room',event=>event.room===null);await clients[2].wait('room',event=>event.room===null,detachMark);await clients[2].wait('battle',event=>event.battle===null,detachMark);
 checks.push('current in-room practice still creates balanced temporary bots; last human leaving releases spectators');
 const report={ok:true,baseUrl:BASE_URL,clients:4,checks};await mkdir('test-results/spectators',{recursive:true});await writeFile('test-results/spectators/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.error(JSON.stringify({stage,checks,events:clients.map(client=>client.events.slice(-4).map(({sequence,event})=>({sequence,type:event.type,...(event.type==='room'?{room:event.room?.id??null}:{}),...(event.type==='error'?{message:event.message}:{})})))}));throw error;}
finally{for(const client of clients){await leave(client).catch(()=>{});await client.close();}}
