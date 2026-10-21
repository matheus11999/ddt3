import assert from 'node:assert/strict';
import {BASE_URL,createSession,TestClient,pause} from './integration';
import {WEAPONS,weaponStats} from '../shared/catalog';
import {weaponAimLimits} from '../shared/aim';
import {flightLanding,trajectory,unpackTerrain} from '../shared/physics';
import {HIDDEN_POSITION,initialAbilities} from '../shared/abilities';
import type {Battle,Fighter} from '../shared/protocol';

const sessions=await Promise.all(Array.from({length:4},()=>createSession())),clients=sessions.map(session=>new TestClient(session)),checks:string[]=[];
const room=(client:TestClient)=>{for(const {event} of [...client.events].reverse())if(event.type==='room'||event.type==='welcome')return event.room;return null;};
const lastBattle=(client:TestClient)=>{for(const {event} of [...client.events].reverse())if(event.type==='battle'||event.type==='welcome')return event.battle;return null;};
const actor=(battle:Battle)=>clients.find(client=>client.profile.id===battle.turnId)!;
const fighter=(battle:Battle,id:string)=>battle.players.find(player=>player.id===id)!;
async function pass(battle:Battle){const current=actor(battle);return (await current.request({type:'pass'},'battle',e=>!!e.battle&&(e.battle.phase==='finished'||e.battle.turnNumber>battle.turnNumber))).battle!;}
try{
 await Promise.all(clients.map(client=>client.wait('welcome')));for(const [i,client] of clients.entries())await client.request({type:'rename',name:`TEST Skills ${i}`},'profile');
 for(const start of [0,2]){
  const host=clients[start],member=clients[start+1],created=(await host.request({type:'create'},'room',e=>!!e.room)).room!;assert.deepEqual(created.openSlots,[0]);assert.equal(created.mode,'1v1');
  assert.match((await member.request({type:'join',roomId:created.id},'error')).message,/cheia/);
  await host.request({type:'room-slot',slot:1,open:true},'room',e=>e.room?.mode==='2v2');
  assert.match((await host.request({type:'queue'},'error')).message,/vagas abertas/);
  await member.request({type:'join',roomId:created.id},'room');assert.match((await member.request({type:'practice-start'},'error')).message,/líder/);
  await member.request({type:'ready'},'room',e=>e.room?.players.some(player=>player.id===member.profile.id&&player.ready)===true);
 }
 const originalRooms=[room(clients[0])!,room(clients[2])!].map(value=>structuredClone(value));
 await clients[0].request({type:'queue'},'room',e=>e.room?.status==='searching');let battle=(await clients[2].request({type:'queue'},'battle',e=>e.battle?.phase==='aiming')).battle!;
 checks.push('single-click rooms, closed extra seats, host opening, complete-ready parties and 2v2 pairing');
 assert.ok(battle.players.every(player=>JSON.stringify(player.abilities)===JSON.stringify(initialAbilities())));
 const shooter=actor(battle),self=fighter(battle,shooter.profile.id),observer=clients.find(client=>fighter(battle,client.profile.id).team!==self.team)!,ally=clients.find(client=>client!==shooter&&fighter(battle,client.profile.id).team===self.team)!;
 assert.match((await shooter.request({type:'ability',ability:'heal'},'error')).message,/completa/);
 await shooter.request({type:'ability',ability:'homing'},'battle',e=>e.battle?.players.some(player=>player.id===self.id&&player.homingArmed)===true);
 battle=(await shooter.request({type:'ability',ability:'invisibility'},'battle',e=>e.battle?.players.some(player=>player.id===self.id&&player.invisibleTurns===3)===true)).battle!;
 await observer.request({type:'ping',time:Date.now()},'pong');const hidden=fighter(lastBattle(observer)!,self.id);assert.equal(hidden.hidden,true);assert.equal(hidden.x,HIDDEN_POSITION);assert.equal(hidden.y,HIDDEN_POSITION);assert.equal(hidden.aimSlope,undefined);assert.equal(fighter(lastBattle(ally)!,self.id).hidden,undefined);
 const aimed=await shooter.request({type:'aim',angle:45,power:60,charging:true},'battle',e=>e.battle?.players.some(player=>player.id===self.id&&player.charging)===true);battle=aimed.battle!;
 await observer.request({type:'ping',time:Date.now()},'pong');assert.equal(fighter(lastBattle(observer)!,self.id).aimAngle,undefined);assert.equal(fighter(lastBattle(observer)!,self.id).charging,undefined);
 checks.push('one-use abilities and audience-specific invisibility for status, aim and allied ghost coordinates');
 const terrain=unpackTerrain(Buffer.from(battle.terrain??lastBattle(shooter)?.terrain??'', 'base64'));
 // Incremental snapshots omit terrain; the initial battle has the complete mask.
 const initial=shooter.events.find(({event})=>event.type==='battle'&&event.battle?.id===battle.id&&event.battle.terrain)?.event;
 const mask=initial?.type==='battle'?unpackTerrain(Buffer.from(initial.battle!.terrain!,'base64')):terrain;
 const actual=fighter(battle,self.id),weapon=weaponStats(WEAPONS.find(weapon=>weapon.id===actual.equipment.weapon)!,actual.equipment.upgrade),limits=weaponAimLimits(weapon,actual.aimSlope??0),targets=battle.players.filter(player=>player.id!==self.id),enemies=targets.filter(player=>player.team!==self.team);
 let aim={angle:45,power:50,score:Infinity};
 for(let angle=limits.minAngle;angle<=limits.maxAngle;angle+=2)for(let power=10;power<=100;power+=2){const path=trajectory(mask,actual,angle,power,battle.wind,weapon,targets),score=Math.min(...enemies.map(target=>Math.hypot(path.x-target.x,path.y-(target.y-31))));if(score<aim.score)aim={angle,power,score};}
 assert.ok(aim.score<32,`legal shot must contact an enemy, nearest distance ${aim.score}`);
 await shooter.charge(aim.power,aim.angle);const observerMark=observer.sequence,mark=shooter.send({type:'fire',angle:aim.angle,power:aim.power}),shot=(await shooter.wait('shot',()=>true,mark)).shot;
 const enemyShot=(await observer.wait('shot',e=>e.shot.id===shot.id,observerMark)).shot;assert.equal(enemyShot.hidden,true);assert.deepEqual(enemyShot.projectiles,[]);assert.deepEqual(shot.hits,[]);
 const observerIndex=clients.indexOf(observer);await observer.close();clients[observerIndex]=new TestClient(observer.session);const resumed=await clients[observerIndex].wait('welcome');assert.equal(resumed.battle?.activeShot?.hidden,true);assert.deepEqual(resumed.battle?.activeShot?.projectiles,[]);assert.equal(fighter(resumed.battle!,self.id).x,HIDDEN_POSITION);
 const contact=await shooter.wait('impact',event=>event.shotId===shot.id&&event.hits.some(hit=>enemies.some(enemy=>enemy.id===hit.id)),mark,shot.duration+10000);const damagedId=contact.hits.find(hit=>enemies.some(enemy=>enemy.id===hit.id))!.id;
 battle=(await shooter.wait('battle',e=>e.battle?.phase==='aiming'&&e.battle.turnNumber>battle.turnNumber,mark,shot.duration+10000)).battle!;
 checks.push('hidden firing trajectory and resolving reconnect, authoritative homing impact and damage');
 for(let steps=0;battle.turnId!==damagedId&&steps<8;steps++)battle=await pass(battle);assert.equal(battle.turnId,damagedId);
 const healer=actor(battle),before=fighter(battle,damagedId).hp,max=fighter(battle,damagedId).maxHp;
 battle=(await healer.request({type:'ability',ability:'heal'},'battle',e=>e.battle?.players.some(player=>player.id===damagedId&&player.abilities?.heal===0)===true)).battle!;assert.equal(fighter(battle,damagedId).hp,Math.min(max,before+300));assert.match((await healer.request({type:'ability',ability:'heal'},'error')).message,/já foi usada/);
 const flyer=fighter(battle,damagedId),flightWeapon={...weaponStats(WEAPONS.find(weapon=>weapon.id===flyer.equipment.weapon)!,flyer.equipment.upgrade),projectileRadius:6},flightLimits=weaponAimLimits(flightWeapon,flyer.aimSlope??0),flightTerrain=unpackTerrain(Buffer.from(battle.terrain??lastBattle(healer)?.terrain??'', 'base64'));
 const complete=[...healer.events].reverse().find(({event})=>event.type==='battle'&&event.battle?.id===battle.id&&event.battle.terrain)!.event;
 const flightMask=complete.type==='battle'?unpackTerrain(Buffer.from(complete.battle!.terrain!,'base64')):flightTerrain;let flightAim:{angle:number;power:number;landing:{x:number;y:number;fromY:number}}|undefined;
 for(let angle=flightLimits.minAngle;angle<=flightLimits.maxAngle&&!flightAim;angle+=3)for(let power=15;power<=70;power+=3){const path=trajectory(flightMask,flyer,angle,power,battle.wind,flightWeapon),landing=flightLanding(flightMask,path);if(landing&&landing.y<=landing.fromY+9&&Math.abs(landing.x-flyer.x)>50){flightAim={angle,power,landing};break;}}
 assert.ok(flightAim,'a supported clear landing is available');await healer.request({type:'flight',active:true},'battle',e=>e.battle?.players.some(player=>player.id===flyer.id&&player.flightArmed)===true);assert.match((await healer.request({type:'boost',boost:'extra1'},'error')).message,/voo/);
 await healer.charge(flightAim.power,flightAim.angle);const flightMark=healer.send({type:'fire',angle:flightAim.angle,power:flightAim.power}),flight=(await healer.wait('shot',()=>true,flightMark)).shot;assert.equal(flight.projectiles[0].kind,'flight');assert.equal(flight.projectiles[0].impact.radius,0);
 const landed=await healer.wait('ability-effect',e=>e.ability==='flight'&&e.playerId===flyer.id,flightMark,flight.duration+10000);assert.ok(Math.abs(landed.x-flightAim.landing.x)<.01);assert.equal(landed.y,flightAim.landing.fromY);
 battle=(await healer.wait('battle',e=>e.battle?.phase==='aiming'&&e.battle.turnNumber>battle.turnNumber,flightMark,flight.duration+10000)).battle!;assert.deepEqual(unpackTerrain(Buffer.from(battle.terrain!,'base64')),flightMask);
 checks.push('capped real healing, repeated-use rejection and safe flight without damage or terrain edits');
 for(let turn=0;battle.phase!=='finished'&&turn<85;turn++)battle=await pass(battle);assert.equal(battle.phase,'finished');const rewards=battle.rewards!;assert.equal(rewards.deadline-rewards.opensAt!,5000);
 assert.match((await clients[0].request({type:'reward-pick',card:0},'error')).message,/abertura/);
 await pause(Math.max(0,rewards.opensAt!-Date.now()+30));
 const pickMarks=clients.map(client=>client.sequence);for(const [index,client] of clients.entries())await client.request({type:'reward-pick',card:index},'battle',e=>e.battle?.rewards?.cards[index].playerId===client.profile.id);
 const revealed=(await clients[0].wait('battle',e=>e.battle?.id===battle.id&&e.battle.rewards?.saved===true,pickMarks[0])).battle!.rewards!;assert.equal(revealed.phase,'revealed');assert.ok(revealed.revealedAt!<rewards.deadline);assert.ok(revealed.cards.every(card=>card.prize));
 await Promise.all(clients.map((client,index)=>client.wait('room',e=>e.room?.id===originalRooms[index<2?0:1].id&&e.room.status==='waiting',pickMarks[index])));
 for(const [index,client] of clients.entries()){const restored=room(client)!;assert.deepEqual(restored.openSlots,[0,1]);assert.equal(restored.name,originalRooms[index<2?0:1].name);assert.equal(restored.players.length,2);assert.equal(lastBattle(client),null);}
 checks.push('three-second result, five-second choices, early all-human reveal, eight prizes and automatic same-room return');
 await clients[1].request({type:'leave'},'room',e=>e.room===null);const training=(await clients[0].request({type:'practice-start'},'battle',e=>e.battle?.phase==='aiming')).battle!;assert.equal(training.players.length,4);assert.equal(training.players.filter(player=>player.bot).length,3);assert.equal(room(clients[0])!.id,originalRooms[0].id);assert.equal(room(clients[0])!.practice,false);assert.equal(room(clients[0])!.players.length,1);assert.deepEqual(room(clients[0])!.openSlots,[0,1]);checks.push('in-room training fills missing ally and enemies with ephemeral bots');
 console.log(JSON.stringify({ok:true,baseUrl:BASE_URL,checks,clients:clients.length},null,2));
}finally{for(const client of clients){if(client.socket.readyState===1){client.send({type:'leave'});await pause(60);}await client.close();}}
