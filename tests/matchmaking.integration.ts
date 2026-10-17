import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {BASE_URL,createSession,TestClient,pause} from './integration';
import {MAP_IDS,getMap} from '../shared/maps';
import type {Battle} from '../shared/protocol';

/** Exercises only tagged guests created here. Never joins, kicks or edits another player's room. */
async function run(){
 const started=performance.now(),clients:TestClient[]=[],checks:string[]=[],maps:string[]=[];
 const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);
 const sessions=await Promise.all(Array.from({length:9},()=>createSession()));
 const owned=new Set(sessions.map(s=>s.profile.id));
 let lastBattle:Battle|undefined;
 const latestRoom=(client:TestClient)=>{
  for(const {event} of [...client.events].reverse())if(event.type==='room'||event.type==='welcome')return event.room;
  return null;
 };
 const assertIsolatedQueue=async()=>{
  // Avoid consuming any unrelated party if this is accidentally run on a shared development server.
  const observer=clients[8];await observer.request({type:'ping',time:Date.now()},'pong');
  const current=[...observer.events].reverse().find(({event})=>event.type==='rooms'||event.type==='welcome')!.event;
  const rooms=current.type==='rooms'||current.type==='welcome'?current.rooms:[];
  assert.ok(rooms.every(room=>room.status!=='searching'||room.players.every(player=>owned.has(player.id))),'Another party is searching: run this test on an isolated development server.');
 };
 const createParty=async(indices:number[],legacy=false)=>{
  const host=clients[indices[0]],room=(await host.request({type:'create',name:`TEST MM ${indices[0]}`,...(legacy?{mode:'4v4',map:'valley'}:{})},'room',e=>!!e.room)).room!;
  assert.equal(room.practice,false);assert.equal(room.mode,'1v1');assert.equal(room.players.length,1);assert.equal(room.map,'garden');
  for(let slot=1;slot<indices.length;slot++)await host.request({type:'room-slot',slot,open:true},'room',e=>e.room?.openSlots.includes(slot)===true);
  for(const i of indices.slice(1))await clients[i].request({type:'join',roomId:room.id},'room',e=>e.room?.id===room.id);
  for(const i of indices.slice(1))await clients[i].request({type:'ready'},'room',e=>!!e.room?.players.find(p=>p.id===clients[i].profile.id)?.ready);
  return latestRoom(host)!;
 };
 const leaveAll=async()=>{for(const client of clients)if(client.socket.readyState===WebSocket.OPEN&&latestRoom(client))await client.request({type:'leave'},'room',e=>e.room===null);};
 try{
  clients.push(...sessions.map(session=>new TestClient(session)));await Promise.all(clients.map(client=>client.wait('welcome')));
  for(const [i,client] of clients.entries())await client.request({type:'rename',name:`TEST-MM-${i}-${client.profile.id.slice(0,8)}`},'profile');
  await assertIsolatedQueue();

  // A solo and a pair must wait rather than being filled by bots or merged across sizes.
  const solo=await createParty([0]),pair=await createParty([1,2]);
  await clients[0].request({type:'queue'},'room',e=>e.room?.status==='searching');
  await clients[1].request({type:'queue'},'room',e=>e.room?.status==='searching');
  await clients[8].request({type:'ping',time:Date.now()},'pong');
  assert.equal(latestRoom(clients[0])!.status,'searching');assert.equal(latestRoom(clients[1])!.status,'searching');assert.equal(pair.mode,'2v2');
  assert.ok(!clients.some(client=>client.events.some(e=>e.event.type==='battle'&&e.event.battle!==null)));
  await clients[0].request({type:'cancel-queue'},'room',e=>e.room?.id===solo.id&&e.room.status==='waiting');
  await clients[1].request({type:'cancel-queue'},'room',e=>e.room?.status==='waiting');await leaveAll();
  checks.push('different party sizes wait without artificial opponents; explicit cancel restores waiting');

  for(let size=1;size<=4;size++){
   const a=Array.from({length:size},(_,i)=>i),b=Array.from({length:size},(_,i)=>i+size);
   const ra=await createParty(a,size===1),rb=await createParty(b);
   assert.equal(ra.mode,`${size}v${size}`);assert.equal(rb.mode,`${size}v${size}`);
   assert.equal(ra.players.length,size);assert.equal(rb.players.length,size);assert.ok([...ra.players,...rb.players].every(p=>p.team===0&&!p.bot));
   await assertIsolatedQueue();
   await clients[a[0]].request({type:'queue'},'room',e=>e.room?.status==='searching');
   if(size===2){
    assert.match((await clients[a[1]].request({type:'cancel-queue'},'error')).message,/líder/);
    assert.match((await clients[8].request({type:'join',roomId:ra.id},'error')).message,/disponível/);
    assert.match((await clients[a[0]].request({type:'kick',playerId:clients[a[1]].profile.id},'error')).message,/entre as batalhas/);
    const hostMark=clients[a[0]].sequence;await clients[a[1]].close();
    await clients[a[0]].wait('room',e=>e.room?.id===ra.id&&e.room.status==='waiting',hostMark);
    clients[a[1]]=new TestClient(sessions[a[1]]);const resumed=await clients[a[1]].wait('welcome');
    assert.equal(resumed.room?.id,ra.id);assert.equal(resumed.room?.status,'waiting');assert.equal(resumed.battle,null);assert.equal(resumed.room?.players.find(p=>p.id===clients[a[1]].profile.id)?.ready,false);
    assert.match((await clients[a[0]].request({type:'queue'},'error')).message,/prontos/);
    await clients[a[1]].request({type:'ready'},'room',e=>!!e.room?.players.find(p=>p.id===clients[a[1]].profile.id)?.ready);
    await clients[a[0]].request({type:'queue'},'room',e=>e.room?.status==='searching');
    checks.push('host-only queue cancellation, searching membership guards, disconnect cancellation and explicit readiness after reconnect');
   }
   const participants=[...a,...b],marks=participants.map(i=>clients[i].sequence);
   await clients[b[0]].request({type:'queue'},'battle',e=>!!e.battle);
   const starts=await Promise.all(participants.map((i,index)=>clients[i].wait('battle',e=>!!e.battle,marks[index])));
   const battle=starts[0].battle!;lastBattle=battle;maps.push(battle.map);
   assert.ok(MAP_IDS.some(map=>map===battle.map));assert.equal(battle.players.length,size*2);assert.equal(battle.roomId,ra.id);
   assert.deepEqual(new Set(battle.players.map(p=>p.id)),new Set(participants.map(i=>clients[i].profile.id)),'Match must contain only test-owned players.');
   for(const event of starts)assert.deepEqual(event.battle,battle);
   for(const [team,indices] of [a,b].entries())for(const [slot,i] of indices.entries()){
    const fighter=battle.players.find(p=>p.id===clients[i].profile.id)!;assert.equal(fighter.team,team);assert.equal(fighter.slot,slot);assert.equal(fighter.x,getMap(battle.map).spawns[team as 0|1][slot]);
    const room=latestRoom(clients[i])!;assert.equal(room.id,team===0?ra.id:rb.id);assert.equal(room.players.length,size);assert.equal(room.mode,`${size}v${size}`);
   }
   // Reconnect a member of the second party: its roomId intentionally differs from Battle.roomId.
   const reconnectIndex=b[0];await clients[reconnectIndex].close();clients[reconnectIndex]=new TestClient(sessions[reconnectIndex]);
   const resumed=await clients[reconnectIndex].wait('welcome');assert.equal(resumed.room?.id,rb.id);assert.equal(resumed.battle?.id,battle.id);assert.equal(resumed.battle?.roomId,ra.id);assert.ok(resumed.battle?.terrain);
   checks.push(`${size}v${size}: two distinct parties, matching teams, server-selected canonical map, identical battle and second-party reconnect`);
   if(size<4)await leaveAll();
  }

  // Reach the normal turn limit over the real protocol; no client can force winner, HP or rewards.
  let battle=lastBattle!;
  for(let turn=0;turn<85&&battle.phase!=='finished';turn++){
   const current=clients.find(client=>client.profile.id===battle.turnId)!;
   const before=battle.turnNumber,mark=current.send({type:'pass'});
   battle=(await current.wait('battle',e=>!!e.battle&&(e.battle.phase==='finished'||e.battle.turnNumber>before),mark)).battle!;
  }
  assert.equal(battle.phase,'finished');assert.ok(battle.rewards);assert.equal(battle.players.length,8);
  const finishingIds=battle.players.map(p=>p.id),originalA=latestRoom(clients[0])!.id,originalB=latestRoom(clients[4])!.id;
  assert.match((await clients[0].request({type:'rematch'},'error')).message,/revelação/);
  const awards=await clients[0].wait('battle',e=>e.battle?.id===battle.id&&!!e.battle.rewards?.saved,0,25000);assert.equal(awards.battle!.rewards!.phase,'revealed');
  assert.equal(awards.battle!.rewards!.cards.filter(card=>card.playerId).length,8);assert.equal(new Set(awards.battle!.rewards!.cards.map(card=>card.playerId)).size,8);
  assert.match((await clients[1].request({type:'rematch'},'error')).message,/líder/);
  const returnMarks=clients.map(client=>client.sequence);
  await Promise.all([clients[0].wait('room',e=>e.room?.id===originalA&&e.room.status==='waiting',returnMarks[0]),clients[4].wait('room',e=>e.room?.id===originalB&&e.room.status==='waiting',returnMarks[4])]);
  for(const i of [0,1,2,3])assert.equal(latestRoom(clients[i])!.id,originalA);
  assert.equal(latestRoom(clients[0])!.players.length,4);assert.equal(latestRoom(clients[4])!.status,'waiting');
  await clients[4].close();clients[4]=new TestClient(sessions[4]);const retained=await clients[4].wait('welcome');assert.equal(retained.room?.id,originalB);assert.equal(retained.battle,null);assert.equal(retained.room?.status,'waiting');assert.equal(latestRoom(clients[4])!.players.length,4);
  for(const client of clients.slice(0,8)){
   const response=await fetch(`${BASE_URL}/api/session`,{headers:{Cookie:client.session.cookie},signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
   const {profile}=await response.json();assert.ok(profile.matches>=1);assert.ok(finishingIds.includes(profile.id));
  }
  checks.push('80-turn finish, eight automatic exclusive rewards persisted, automatic restoration of both original parties and reconnect to the same waiting room');
  await leaveAll();
  const report={ok:true,baseUrl:BASE_URL,checks,mapsObserved:maps,concurrentClients:clients.length,durationMs:Math.round(performance.now()-started),testPlayerIds:[...owned]};
  await mkdir('test-results',{recursive:true});await writeFile('test-results/matchmaking-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{
  for(const client of clients){if(client.socket.readyState===WebSocket.OPEN){client.send({type:'leave'});await pause(40);}await client.close();}
 }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
