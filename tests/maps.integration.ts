import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {BASE_URL,createSession,TestClient} from './integration';
import {MAP_IDS,getMap} from '../shared/maps';
import type {CanonicalMapId} from '../shared/maps';
import {WEAPONS,weaponStats} from '../shared/catalog';
import {weaponAimLimits} from '../shared/aim';
import {crater,createTerrain,packTerrain,terrainMaterial,terrainTemplate,trajectory,unpackTerrain} from '../shared/physics';
import type {Battle,Shot} from '../shared/protocol';

const encoded=(terrain:Uint8Array)=>Buffer.from(packTerrain(terrain)).toString('base64');
function snapshot(battle:Battle,expected:Uint8Array,context:string){
 assert.ok(battle.terrain,`${context}: complete authoritative terrain is required`);
 assert.equal(battle.terrain,encoded(expected),`${context}: authoritative terrain differs from event replay`);
 assert.deepEqual(unpackTerrain(Buffer.from(battle.terrain,'base64')),expected,`${context}: terrain decoding`);
}
function immutable(map:CanonicalMapId,before:Uint8Array,after:Uint8Array){
 const template=terrainTemplate(map);
 for(let i=0;i<before.length;i++){
  assert.ok(after[i]<=before[i],`${map}: an impact added solid geometry at cell ${i}`);
  if(!template.definition[template.regions[i]]?.destructible)assert.equal(after[i],before[i],`${map}: immutable cell ${i} changed`);
 }
}

/** Search legal input using the public physics, then send only angle/power.
 * The backend still owns all impacts, damage and terrain. Avoid nearby fighters
 * so the nine-projectile and reconnect checks do not depend on random wind. */
function aim(battle:Battle,terrain:Uint8Array,goalX:number,material?:string){
 const fighter=battle.players.find(p=>p.id===battle.turnId)!;
 const weapon=weaponStats(WEAPONS.find(w=>w.id===fighter.equipment.weapon)!,fighter.equipment.upgrade);
 const targets=battle.players.filter(p=>p.id!==fighter.id);
 let best:{angle:number;power:number;score:number}|undefined;const limits=weaponAimLimits(weapon,fighter.aimSlope??0);
 for(let angle=Math.max(25,limits.minAngle);angle<=Math.min(75,limits.maxAngle);angle+=2)for(let power=15;power<=85;power++){
  const impact=trajectory(terrain,fighter,angle,power,battle.wind,weapon,targets);
  const surface=terrainMaterial(battle.map,impact.x,impact.y);
  if(!surface.region||material&&surface.material!==material)continue;
  const clearance=Math.min(...battle.players.filter(p=>p.hp>0).map(p=>Math.hypot(p.x-impact.x,p.y-25-impact.y)));
  const score=Math.abs(impact.x-goalX)+Math.max(0,weapon.blast+25-clearance)*8+impact.points.length*.04;
  if(!best||score<best.score)best={angle,power,score};
 }
 assert.ok(best,`${battle.map}: no legal trajectory to ${material??'terrain'}`);
 return {angle:best.angle,power:best.power};
}

async function run(){
 const started=performance.now(),clients:TestClient[]=[],results:Record<string,unknown>[]=[];
 const health=await fetch(`${BASE_URL}/api/health`,{signal:AbortSignal.timeout(10000)});
 assert.equal(health.status,200);assert.equal((await health.json() as {ok:boolean}).ok,true);
 const sessions=await Promise.all(Array.from({length:4},()=>createSession()));
 try{
  clients.push(...sessions.map(session=>new TestClient(session)));
  await Promise.all(clients.map(client=>client.wait('welcome')));
  for(const [index,client] of clients.entries())await client.request({type:'rename',name:`TEST-MAP-${index}-${client.profile.id.slice(0,6)}`},'profile');
  for(const map of MAP_IDS){
   const host=clients[0],created=await host.request({type:'create',practice:true,name:`TEST Maps ${map}`,mode:'2v2',map},'room',event=>event.room?.map===map);
   const roomId=created.room!.id;
   for(const client of clients.slice(1)){
    await client.request({type:'join',roomId},'room',event=>event.room?.id===roomId);
    await client.request({type:'ready'},'room',event=>!!event.room?.players.find(p=>p.id===client.profile.id)?.ready);
   }
   const startMarks=clients.map(c=>c.sequence);host.send({type:'start'});
   const starts=await Promise.all(clients.map((client,index)=>client.wait('battle',e=>e.battle?.roomId===roomId,startMarks[index])));
   let battle=starts[0].battle!;
   const initial=createTerrain(map),replay=initial.slice();
   for(const {battle:received} of starts){assert.deepEqual(received,battle);snapshot(received!,initial,`${map} start`);}
   const forbidden=await host.request({type:'crater',x:768,y:558,radius:500},'error');assert.equal(forbidden.message,'Comando inválido.');
   assert.equal(battle.players.length,4);assert.equal(battle.players.filter(p=>p.team===0).length,2);assert.equal(battle.players.filter(p=>p.team===1).length,2);
   for(const fighter of battle.players)assert.equal(fighter.x,getMap(map).spawns[fighter.team][fighter.slot]);
   const shots:Shot[]=[],materials=new Set<string>();let duringResolution=false;
   for(let round=0;round<2;round++){
    const shooter=clients.find(c=>c.profile.id===battle.turnId)!;
    if(round===0)for(const boost of ['extra2','trident'] as const){
     const boosted=await shooter.request({type:'boost',boost},'battle',e=>!!e.battle?.players.find(p=>p.id===shooter.profile.id)?.boosts.includes(boost));battle=boosted.battle!;
    }
    const wanted='earth';
    const goal=getMap(map).spawns[1][1];
    const command=aim(battle,replay,goal,wanted),marks=clients.map(c=>c.sequence),turn=battle.turnNumber;
    shooter.send({type:'fire',...command});
    const received=await Promise.all(clients.map((client,index)=>client.wait('shot',()=>true,marks[index])));
    const shot=received[0].shot;shots.push(shot);
    assert.equal(shot.projectiles.length,round===0?9:1,`${map}: legal multishot count`);
    assert.ok(shot.duration>0&&shot.duration<30000,`${map}: bounded resolution`);
    for(const event of received)assert.deepEqual(event.shot,shot,`${map}: four clients must receive identical trajectories and hits`);
    const beforeShot=replay.slice();
    for(const projectile of shot.projectiles){
     assert.ok(projectile.points.length>1);assert.ok(projectile.impact.radius>0);
     const expected=terrainMaterial(map,projectile.impact.x,projectile.impact.y);
     assert.deepEqual({material:projectile.impact.material,destructible:projectile.impact.destructible,...(projectile.impact.region?{region:projectile.impact.region}:{})},expected,`${map}: authoritative material metadata`);
     if(projectile.impact.region)materials.add(projectile.impact.material!);
     crater(replay,projectile.impact.x,projectile.impact.y,projectile.impact.radius,map);
    }
    immutable(map,initial,replay);
    if(round===0){
     // Reconnect an observer immediately after the shot, before resolution ends.
     const index=clients.findIndex(c=>c!==host&&c.profile.id!==shooter.profile.id),old=clients[index];
     await old.close();const resumed=new TestClient(old.session);clients[index]=resumed;
     const welcome=await resumed.wait('welcome');assert.equal(welcome.battle?.id,battle.id);
     assert.equal(welcome.battle?.phase,'resolving',`${map}: reconnect must actually occur during resolution`);
     assert.equal(welcome.battle!.activeShot?.id,shot.id);const atReconnect=beforeShot.slice();for(const projectileIndex of welcome.battle!.activeShot!.impacted){const projectile=shot.projectiles[projectileIndex];crater(atReconnect,projectile.impact.x,projectile.impact.y,projectile.impact.radius,map);}
     snapshot(welcome.battle!,atReconnect,`${map} resolving reconnect`);duringResolution=true;
     marks[index]=resumed.sequence;
    }
    const settled=await Promise.all(clients.map((client,index)=>client.wait('battle',e=>e.battle?.id===battle.id&&e.battle.phase==='aiming'&&e.battle.turnNumber>turn,marks[index],shot.duration+10000)));
    battle=settled[0].battle!;
    for(const event of settled){assert.deepEqual(event.battle,battle,`${map}: settled battle differs across clients`);snapshot(event.battle!,replay,`${map} completed shot`);}
   }
   const removed=initial.reduce((sum,cell,index)=>sum+cell-replay[index],0);
   assert.ok(removed>0,`${map}: real shots must remove destructible terrain`);
   // Ending through supported leave commands is deterministic and also exercises
   // the last battle snapshot used by connected clients and later reconnects.
   const finalMarks=clients.map(c=>c.sequence),winners=clients.filter(c=>battle.players.find(p=>p.id===c.profile.id)!.team===0);
   for(const loser of clients.filter(c=>!winners.includes(c)))await loser.request({type:'leave'},'room',e=>e.room===null);
   for(const winner of winners){
    const final=await winner.wait('battle',e=>e.battle?.id===battle.id&&e.battle.phase==='finished',finalMarks[clients.indexOf(winner)]);
    assert.equal(final.battle!.winner,0);snapshot(final.battle!,replay,`${map} finished event`);
   }
   const index=clients.indexOf(winners[1]),old=clients[index];await old.close();const resumed=new TestClient(old.session);clients[index]=resumed;
   const finalWelcome=await resumed.wait('welcome');assert.equal(finalWelcome.battle?.phase,'finished');assert.equal(finalWelcome.battle?.winner,0);snapshot(finalWelcome.battle!,replay,`${map} finished reconnect`);
   // Rematch is a fresh mask, including after destructive matches.
   await host.wait('battle',e=>e.battle?.id===battle.id&&e.battle.rewards?.saved===true,finalMarks[clients.indexOf(host)],25000);
   const resetMarks=clients.map(c=>c.sequence);
   for(const client of [host,resumed])await client.wait('room',e=>e.room?.id===roomId&&e.room.status==='waiting',resetMarks[clients.indexOf(client)]);
   for(const client of clients){
    const inRoom=client===host||client===resumed;
    if(!inRoom)await client.request({type:'join',roomId},'room',e=>e.room?.id===roomId);
    if(client!==host)await client.request({type:'ready'},'room',e=>!!e.room?.players.find(p=>p.id===client.profile.id)?.ready);
   }
   const rematchMarks=clients.map(c=>c.sequence);host.send({type:'start'});
   for(const [i,client] of clients.entries()){
    const restart=await client.wait('battle',e=>e.battle?.roomId===roomId&&e.battle.id!==battle.id,rematchMarks[i]);snapshot(restart.battle!,initial,`${map} rematch`);assert.equal(restart.battle!.turnNumber,1);
   }
   for(const client of clients)await client.request({type:'leave'},'room',e=>e.room===null);
   for(const client of clients){
    // A ping acknowledges all earlier messages on this connection. A later
    // participant leaving must never resurrect this departed player's battle.
    const time=Date.now();await client.request({type:'ping',time},'pong',e=>e.time===time);
    const lastBattle=[...client.events].reverse().find(entry=>entry.event.type==='battle')!.event;
    assert.ok(lastBattle.type==='battle');assert.equal(lastBattle.battle===null,true,`${map}: another player's departure resurrected a battle after leaving`);
   }
   results.push({map,clients:4,mode:'2v2',projectiles:shots.reduce((n,s)=>n+s.projectiles.length,0),materials:[...materials],removedCells:removed,clientTerrainEditRejected:true,reconnectDuringResolution:duringResolution,reconnectAfterFinish:true,immutableCellsPreserved:true,rematchRestoresTerrain:true,departedPlayersRemainInLobby:true});
   console.log(`${map}: 4 real WebSocket clients, 9 + 1 projectiles, resolution/final reconnect, rematch OK`);
  }
  const report={ok:true,baseUrl:BASE_URL,results,durationMs:Math.round(performance.now()-started),testPlayerIds:sessions.map(s=>s.profile.id)};
  await mkdir('test-results/maps',{recursive:true});await writeFile('test-results/maps/integration-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{
  for(const client of clients){
   const lastRoom=[...client.events].reverse().find(({event})=>event.type==='room'||event.type==='welcome')?.event;
   if(client.socket.readyState===WebSocket.OPEN&&lastRoom&&(lastRoom.type==='room'||lastRoom.type==='welcome')&&lastRoom.room)await client.request({type:'leave'},'room',e=>e.room===null,1500).catch(()=>{});
   await client.close();
  }
 }
}

run().catch(error=>{console.error(error);process.exitCode=1;});
