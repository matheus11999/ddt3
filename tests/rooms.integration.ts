import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {BASE_URL,createSession,TestClient} from './integration';
import {getMap} from '../shared/maps';
import {createTerrain,packTerrain} from '../shared/physics';
import type {Room} from '../shared/protocol';

function seats(room:Room){return room.players.map(player=>`${player.team}:${player.slot}`);}

async function run(){
 const started=performance.now(),clients:TestClient[]=[],checks:string[]=[];
 const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);
 const sessions=await Promise.all(Array.from({length:8},()=>createSession()));
 try{
  clients.push(...sessions.map(session=>new TestClient(session)));await Promise.all(clients.map(client=>client.wait('welcome')));
  for(const [i,client] of clients.entries())await client.request({type:'rename',name:`TEST-ROOM-${i}-${client.profile.id.slice(0,5)}`},'profile');
  const host=clients[0],created=await host.request({type:'create',name:'TEST eight players',mode:'1v1',map:'celestial'},'room',event=>!!event.room);const roomId=created.room!.id;
  await clients[1].request({type:'join',roomId},'room',event=>event.room?.id===roomId);await clients[1].request({type:'ready'},'room',event=>!!event.room?.players.find(p=>p.id===clients[1].profile.id)?.ready);
  assert.match((await clients[1].request({type:'room-slot',slot:3,open:true},'error')).message,/líder/);
  let room=(await host.request({type:'room-slot',slot:3,open:true},'room',event=>event.room?.openSlots.includes(3)??false)).room!;
  assert.deepEqual(room.openSlots,[0,3]);assert.equal(room.mode,'2v2');assert.ok(room.players.every(player=>!player.ready));
  for(const client of clients.slice(2,4))await client.request({type:'join',roomId},'room',event=>event.room?.id===roomId);
  room=(await clients[3].request({type:'ready'},'room',event=>!!event.room?.players.find(p=>p.id===clients[3].profile.id)?.ready)).room!;
  assert.deepEqual(seats(room),['0:0','1:0','0:3','1:3']);
  assert.match((await clients[4].request({type:'join',roomId},'error')).message,/cheia/);
  assert.match((await host.request({type:'room-slot',slot:3,open:false},'error')).message,/ocupado por um jogador/);
  checks.push('host-only paired capacity, sparse slots and occupied/full-room protection');

  assert.match((await clients[1].request({type:'kick',playerId:clients[2].profile.id},'error')).message,/líder/);
  assert.match((await clients[1].request({type:'kick',playerId:host.profile.id},'error')).message,/líder/);
  assert.match((await host.request({type:'kick',playerId:host.profile.id},'error')).message,/Sair da sala/);
  assert.match((await host.request({type:'kick',playerId:randomUUID()},'error')).message,/nesta sala/);
  const otherRoom=(await clients[4].request({type:'create',name:'TEST isolated room',mode:'1v1',map:'garden'},'room',event=>!!event.room)).room!;
  await clients[5].request({type:'join',roomId:otherRoom.id},'room',event=>event.room?.id===otherRoom.id);
  assert.match((await host.request({type:'kick',playerId:clients[5].profile.id},'error')).message,/nesta sala/);
  await clients[5].request({type:'leave'},'room',event=>event.room===null);await clients[4].request({type:'leave'},'room',event=>event.room===null);
  for(const client of clients.slice(1,3))await client.request({type:'ready'},'room',event=>!!event.room?.players.find(player=>player.id===client.profile.id)?.ready);
  const victimMark=clients[3].sequence;
  room=(await host.request({type:'kick',playerId:clients[3].profile.id},'room',event=>event.room?.id===roomId&&event.room.players.length===3)).room!;
  await clients[3].wait('room',event=>event.room===null,victimMark);await clients[3].wait('battle',event=>event.battle===null,victimMark);
  assert.deepEqual(room.openSlots,[0,3]);assert.equal(room.mode,'2v2');assert.ok(room.players.every(player=>!player.ready));assert.equal(clients[3].socket.readyState,WebSocket.OPEN);
  const roomOnlyText=`Private room after kick ${Date.now()}`,chatMark=clients[3].sequence;
  await host.request({type:'chat',channel:'room',text:roomOnlyText},'chat',event=>event.message.text===roomOnlyText);
  const ping=Date.now();await clients[3].request({type:'ping',time:ping},'pong',event=>event.time===ping);
  assert.equal(clients[3].events.some(({sequence,event})=>sequence>chatMark&&event.type==='chat'&&event.message.text===roomOnlyText),false,'kicked players must stop receiving room chat');
  await clients[3].close();clients[3]=new TestClient(sessions[3]);const kickedWelcome=await clients[3].wait('welcome');assert.equal(kickedWelcome.room,null);assert.equal(kickedWelcome.battle,null);
  room=(await clients[3].request({type:'join',roomId},'room',event=>event.room?.id===roomId)).room!;assert.deepEqual(seats(room),['0:0','1:0','0:3','1:3']);
  checks.push('host-only kick rejects self and other rooms, preserves slots, resets readiness and reconnects recipient in lobby');
  checks.push('kicked client remains connected, loses room chat and can explicitly rejoin');

  await clients[1].close();clients[1]=new TestClient(sessions[1]);let restored=await clients[1].wait('welcome');
  assert.equal(restored.room?.id,roomId);assert.deepEqual(restored.room?.openSlots,[0,3]);assert.equal(restored.room?.players.find(player=>player.id===clients[1].profile.id)?.slot,0);
  for(const client of clients.slice(2,4))await client.request({type:'leave'},'room',event=>event.room===null);
  room=(await host.request({type:'room-slot',slot:3,open:false},'room',event=>event.room?.mode==='1v1')).room!;assert.deepEqual(room.openSlots,[0]);assert.deepEqual(seats(room),['0:0','1:0']);
  for(const slot of [1,2,3])room=(await host.request({type:'room-slot',slot,open:true},'room',event=>event.room?.openSlots.includes(slot)??false)).room!;
  assert.equal(room.mode,'4v4');assert.deepEqual(room.openSlots,[0,1,2,3]);
  await clients[1].close();clients[1]=new TestClient(sessions[1]);restored=await clients[1].wait('welcome');
  assert.deepEqual(restored.room?.openSlots,[0,1,2,3]);assert.equal(restored.room?.mode,'4v4');assert.equal(restored.room?.players.find(player=>player.id===clients[1].profile.id)?.slot,0);
  checks.push('reconnect preserves capacity changes and existing seat positions');

  for(const client of clients.slice(2))await client.request({type:'join',roomId},'room',event=>event.room?.id===roomId);
  for(const client of clients.slice(1))room=(await client.request({type:'ready'},'room',event=>!!event.room?.players.find(p=>p.id===client.profile.id)?.ready)).room!;
  assert.equal(room.players.length,8);assert.equal(new Set(seats(room)).size,8);for(const team of [0,1])assert.deepEqual(room.players.filter(player=>player.team===team).map(player=>player.slot).sort(),[0,1,2,3]);
  const marks=clients.map(client=>client.sequence);host.send({type:'start'});
  const starts=await Promise.all(clients.map((client,i)=>client.wait('battle',event=>event.battle?.roomId===roomId,marks[i]))),battle=starts[0].battle!;
  const terrain=Buffer.from(packTerrain(createTerrain('celestial'))).toString('base64');
  for(const event of starts){assert.deepEqual(event.battle,battle);assert.equal(event.battle!.terrain,terrain);}
  assert.equal(battle.players.length,8);for(const fighter of battle.players)assert.equal(fighter.x,getMap('celestial').spawns[fighter.team][fighter.slot]);
  assert.match((await host.request({type:'room-slot',slot:3,open:false},'error')).message,/entre as batalhas/);
  assert.match((await host.request({type:'kick',playerId:clients[1].profile.id},'error')).message,/entre as batalhas/);
  checks.push('eight real clients start with identical snapshots and four distinct spawns per team');

  const shooter=clients.find(client=>client.profile.id===battle.turnId)!;await shooter.request({type:'boost',boost:'trident'},'battle',event=>!!event.battle?.players.find(p=>p.id===shooter.profile.id)?.boosts.includes('trident'));
  const shotMarks=clients.map(client=>client.sequence);shooter.send({type:'fire',angle:65,power:25});
  const shots=await Promise.all(clients.map((client,i)=>client.wait('shot',()=>true,shotMarks[i]))),shot=shots[0].shot;
  assert.equal(shot.projectiles.length,3);for(const event of shots)assert.deepEqual(event.shot,shot);
  await clients[4].close();clients[4]=new TestClient(sessions[4]);const welcome=await clients[4].wait('welcome');assert.equal(welcome.battle?.phase,'resolving');assert.equal(welcome.battle?.players.length,8);assert.equal(welcome.battle?.terrain,terrain);shotMarks[4]=clients[4].sequence;
  const settled=await Promise.all(clients.map((client,i)=>client.wait('battle',event=>event.battle?.id===battle.id&&event.battle.phase==='aiming'&&event.battle.turnNumber>battle.turnNumber,shotMarks[i],shot.duration+10000)));
  for(const event of settled){assert.deepEqual(event.battle,settled[0].battle);assert.equal(event.battle!.terrain,terrain);}
  checks.push('eight-client projectile fan and reconnect during resolution preserve authoritative state');

  for(const client of clients)await client.request({type:'leave'},'room',event=>event.room===null);
  for(const client of clients){
   const time=Date.now();await client.request({type:'ping',time},'pong',event=>event.time===time);
   const last=[...client.events].reverse().find(({event})=>event.type==='battle')!.event;assert.ok(last.type==='battle');assert.equal(last.battle===null,true,'a later departure must not reopen another client battle');
  }
  checks.push('all eight return to the lobby without stale battle events');
  const report={ok:true,baseUrl:BASE_URL,clients:8,modes:['1v1','2v2','1v1','4v4'],checks,durationMs:Math.round(performance.now()-started),testPlayerIds:sessions.map(session=>session.profile.id)};
  await mkdir('test-results/rooms',{recursive:true});await writeFile('test-results/rooms/integration-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{
  for(const client of clients){
   const lastRoom=[...client.events].reverse().find(({event})=>event.type==='room'||event.type==='welcome')?.event;
   if(client.socket.readyState===WebSocket.OPEN&&lastRoom&&(lastRoom.type==='room'||lastRoom.type==='welcome')&&lastRoom.room)await client.request({type:'leave'},'room',event=>event.room===null,1500).catch(()=>{});
   await client.close();
  }
 }
}

run().catch(error=>{console.error(error);process.exitCode=1;});
