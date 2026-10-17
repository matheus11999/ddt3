import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {ServerEvent} from '../shared/protocol';
import {chargeFromDamage,POWER_CUT_IN_MS} from '../shared/power';

async function fixture(){
 const events:ServerEvent[]=[],store={getProfile:async()=>null,finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store,()=>{},()=>.99);
 const players=['Power Um','Power Dois'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const player of players)game.connect(player,event=>events.push(structuredClone(event)));
 await game.command(players[0].id,{type:'create',practice:true,name:'Power teste',mode:'1v1',map:'garden'});
 const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players.find(p=>p.id===match.state.turnId)!,target=match.state.players.find(p=>p.id!==shooter.id)!;
 return {game,match,shooter,target,events};
}

test('Power accumulates proportionally to actual damage; receiving grants more and total caps at100',()=>{
 assert.equal(chargeFromDamage(0,200,1000),12);assert.equal(chargeFromDamage(0,200,1000,true),20);
 assert.equal(chargeFromDamage(95,200,1000),100);assert.equal(chargeFromDamage(0,100000,1000),60);
 assert.equal(chargeFromDamage(22,0,1000),22);assert.equal(chargeFromDamage(22,NaN,1000),22);
 assert.equal(commandSchema.safeParse({type:'power',damage:9999}).success,false);
});

test('Power activation requires full charge and own living turn; duplicate consumes nothing',async()=>{
 const f=await fixture();f.target.powerCharge=100;
 await f.game.command(f.target.id,{type:'power'});assert.equal(f.target.powerCharge,100);assert.equal(f.target.powerArmed,false);
 await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerArmed,false);
 f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
 await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
});

test('Power holds all damage and projectiles until cut-in completes then fires exactly once',async()=>{
 const f=await fixture();f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});
 const before=f.match.state.players.map(p=>p.hp),terrain=f.match.terrain.slice();
 await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});
 assert.ok(f.match.state.powerCutIn);assert.equal(f.match.state.phase,'resolving');assert.deepEqual(f.match.state.players.map(p=>p.hp),before);assert.deepEqual(f.match.terrain,terrain);
 assert.equal(f.events.filter(e=>e.type==='shot').length,0);
 await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});await f.game.command(f.shooter.id,{type:'pass'});
 const end=f.match.state.powerCutIn!.endsAt;
 f.game.tick(end-1);assert.equal(f.events.filter(e=>e.type==='shot').length,0);
 f.game.tick(end);const shots=f.events.filter(e=>e.type==='shot');assert.equal(shots.length,2); // one event per peer
 assert.ok(shots.every(e=>e.type==='shot'&&e.shot.powered&&e.shot.projectiles.every(p=>p.powered)));
 assert.equal(f.match.state.powerCutIn,undefined);assert.equal(f.shooter.powerArmed,false);
 f.game.tick(end+1);assert.equal(f.events.filter(e=>e.type==='shot').length,2);
 assert.ok(POWER_CUT_IN_MS>=1000);
});

test('unused activation expires on pass and timeout, while stored charge persists between turns',async()=>{
 const f=await fixture();f.shooter.powerCharge=100;f.target.powerCharge=42;
 await f.game.command(f.shooter.id,{type:'power'});await f.game.command(f.shooter.id,{type:'pass'});
 assert.equal(f.shooter.powerArmed,false);assert.equal(f.shooter.powerCharge,0);assert.equal(f.target.powerCharge,42);
 f.target.powerCharge=100;await f.game.command(f.target.id,{type:'power'});f.game.tick(f.match.state.deadline+1);
 assert.equal(f.target.powerArmed,false);assert.equal(f.target.powerCharge,0);
});

test('leaving during Power cut-in cancels the pending shot and cannot damage after finish',async()=>{
 const f=await fixture();f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});
 const end=f.match.state.powerCutIn!.endsAt;await f.game.command(f.shooter.id,{type:'leave'});f.game.tick(end);
 assert.equal(f.match.state.phase,'finished');assert.equal(f.match.pendingPower,undefined);assert.equal(f.events.filter(e=>e.type==='shot').length,0);
});

test('Power deals greater actual enemy damage and charges both combatants without changing equipment',async()=>{
 const run=async(powered:boolean)=>{
  const f=await fixture();f.match.state.wind=0;
  // A nearby opponent intersects the launch arc, making the comparison deterministic.
  f.shooter.x=300;f.shooter.y=500;f.shooter.facing=1;f.target.x=365;f.target.y=490;
  f.match.terrain.fill(0);f.match.terrain.fill(1,170*512);
  if(powered){f.shooter.powerCharge=100;await f.game.command(f.shooter.id,{type:'power'});}
  await f.game.command(f.shooter.id,{type:'fire',angle:25,power:20});
  if(powered)f.game.tick(f.match.state.powerCutIn!.endsAt);
  const shot=f.events.find(e=>e.type==='shot');assert.ok(shot&&shot.type==='shot');
  assert.equal(shot.shot.hits.length,0);assert.equal(f.shooter.powerCharge,0);assert.equal(f.target.powerCharge,0);
  f.game.tick(f.match.resolveAt+1);
  const damage=f.events.filter((e):e is Extract<ServerEvent,{type:'impact'}>=>e.type==='impact').flatMap(e=>e.hits).filter(h=>h.id===f.target.id).reduce((sum,h)=>sum+h.damage,0)/2;
  assert.ok(damage>0);assert.ok((f.shooter.powerCharge??0)>0);assert.ok((f.target.powerCharge??0)>(f.shooter.powerCharge??0));
  assert.equal(f.shooter.equipment.upgrade,0);
  return {damage,shot:shot.shot};
 };
 const normal=await run(false),powered=await run(true);assert.ok(powered.damage>normal.damage*1.5);assert.ok(powered.shot.projectiles[0].impact.radius>normal.shot.projectiles[0].impact.radius);
});
