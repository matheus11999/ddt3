import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {attributes,BOOSTS,DEFAULT_EQUIPMENT,WEAPONS} from '../shared/catalog';
import type {BoostId} from '../shared/catalog';
import {damageAtImpact,VOLLEY_CADENCE_MS} from '../shared/combat';
import {powerUpConflict,powerUpCost,powerUpShot} from '../shared/powerUps';
import type {Profile,ServerEvent} from '../shared/protocol';
import {WORLD} from '../shared/physics';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ≠ ${expected}`);
const COSTS=Object.fromEntries(BOOSTS.map(boost=>[boost.id,boost.cost]));

test('shot modes: +1 is 2 shots at 90%, +2 is 3 shots at 60%, Tridente 3 simultaneous projectiles at 50%',()=>{
 const one=powerUpShot(['extra1']),two=powerUpShot(['extra2']),trident=powerUpShot(['trident']),plain=powerUpShot([]);
 assert.deepEqual([plain.sequentialShots,plain.projectilesPerShot],[1,1]);close(plain.finalMultiplier,1);
 assert.deepEqual([one.sequentialShots,one.projectilesPerShot],[2,1]);close(one.modeMultiplier,.9);
 assert.deepEqual([two.sequentialShots,two.projectilesPerShot],[3,1]);close(two.modeMultiplier,.6);
 assert.deepEqual([trident.sequentialShots,trident.projectilesPerShot],[1,3]);close(trident.modeMultiplier,.5);
});

test('percentage bonuses add (never multiply) and the DDTank examples A to E hold for 1000 damage',()=>{
 close(powerUpShot(['damage50']).bonusMultiplier,1.5);close(powerUpShot(['damage50','damage20']).bonusMultiplier,1.7);
 close(powerUpShot(['damage50','damage50','damage40']).bonusMultiplier,2.4);close(powerUpShot(['damage10']).bonusMultiplier,1.1);
 const cases:[BoostId[],number,number,number][]=[
  [['extra1','damage50','damage20'],1.53,2,3060],[['extra2','damage50','damage20'],1.02,3,3060],
  [['trident','damage50','damage20'],.85,3,2550],[['damage50'],1.5,1,1500],[['damage50','damage50','damage40'],2.4,1,2400]
 ];
 for(const [boosts,multiplier,impacts,total] of cases){
  const shot=powerUpShot(boosts);close(shot.finalMultiplier,multiplier);
  assert.equal(shot.sequentialShots*shot.projectilesPerShot,impacts);assert.equal(Math.round(1000*shot.finalMultiplier)*impacts,total);
 }
});

test('the power-up multiplier enters the existing damage pipeline once per impact, with Ataque, Defesa, Armadura and criticals',()=>{
 const attacker={...DEFAULT_EQUIPMENT,upgrade:10},defender=DEFAULT_EQUIPMENT;
 for(const boosts of [['extra1','damage50','damage20'],['extra2','damage50','damage20'],['trident','damage50','damage20']] as BoostId[][]){
  const shot=powerUpShot(boosts);
  for(const critical of [false,true]){
   const plain=damageAtImpact(attacker,defender,{critical,attackerLevel:5}),boosted=damageAtImpact(attacker,defender,{critical,attackerLevel:5,shotMultiplier:shot.modeMultiplier,boostMultiplier:shot.bonusMultiplier});
   assert.ok(Math.abs(boosted-plain*shot.finalMultiplier)<=1,`${boosts} ${critical}: ${boosted} vs ${plain*shot.finalMultiplier}`);
  }
 }
 assert.ok(damageAtImpact({...DEFAULT_EQUIPMENT,upgrade:10},defender,{boostMultiplier:1.5})>damageAtImpact(DEFAULT_EQUIPMENT,defender,{boostMultiplier:1.5}),'forged Dano still counts');
});

test('combination matrix: one of +1/+2 per turn, trident once, bonuses repeat, costs add up',()=>{
 assert.equal(powerUpConflict([],'extra1'),undefined);assert.match(powerUpConflict(['extra1'],'extra1')!,/\+1 já/);
 assert.match(powerUpConflict(['extra1'],'extra2')!,/não combinam/);assert.match(powerUpConflict(['extra2'],'extra1')!,/não combinam/);
 assert.match(powerUpConflict(['trident'],'trident')!,/tridente já/);assert.equal(powerUpConflict(['extra2'],'trident'),undefined);
 assert.equal(powerUpConflict(['damage50','damage50'],'damage50'),undefined);
 assert.equal(powerUpCost(['extra1','damage50','damage20'],COSTS),250);
 assert.deepEqual(BOOSTS.map(boost=>[boost.id,boost.cost]),[['extra1',110],['extra2',110],['trident',110],['damage50',85],['damage40',80],['damage30',70],['damage20',55],['damage10',50]]);
});

async function battle(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>.99),players=[0,1].map(i=>normalizeProfile({id:randomUUID(),name:`Power ${i}`}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 await game.command(players[0].id,{type:'create',practice:true,name:'Power-ups',mode:'1v1',map:'celestial'});const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!;match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,600*WORLD.cols);
 for(const [index,fighter] of match.state.players.entries())Object.assign(fighter,{x:300+index*500,y:600,hp:5000,maxHp:5000});
 const shooter=match.state.players.find(player=>player.id===match.state.turnId)!;
 const errors=()=>events.get(shooter.id)!.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error').map(event=>event.message);
 return {game,match,shooter,errors};
}

for(const [boost,delays] of [['extra1',[0,1]],['extra2',[0,1,2]],['trident',[0,0,0]]] as const){
 test(`server: ${boost} fires ${delays.length} projectiles in one action, charges Vigor and Delay once and leaves attributes untouched`,async()=>{
  const f=await battle(),before={equipment:structuredClone(f.shooter.equipment),stats:attributes(f.shooter.equipment,f.shooter.level)},vigor=f.shooter.stamina,delay=f.shooter.delay!;
  await f.game.command(f.shooter.id,{type:'boost',boost});assert.equal(f.shooter.stamina,vigor-110);assert.equal(f.shooter.delay,delay+110);
  await f.game.command(f.shooter.id,{type:'fire',angle:50,power:55});
  const shot=f.match.activeShot!;assert.deepEqual(shot.projectiles.filter(p=>!p.fragment).map(p=>p.delay),delays.map(n=>n*VOLLEY_CADENCE_MS));
  const shotDelay=WEAPONS.find(weapon=>weapon.id===f.shooter.equipment.weapon)?.shotDelay??0;
  assert.equal(f.shooter.delay,delay+110+shotDelay,'shot Delay is added once, not per projectile');assert.equal(f.match.state.phase,'resolving');
  assert.deepEqual(f.shooter.equipment,before.equipment);assert.deepEqual(attributes(f.shooter.equipment,f.shooter.level),before.stats);
  await f.game.command(f.shooter.id,{type:'fire',angle:50,power:55});assert.equal(f.match.activeShot,shot,'no second action while the sequence resolves');
 });
}

test('server: insufficient Vigor refuses a power-up without consuming anything',async()=>{
 const f=await battle();f.shooter.stamina=84;const before=structuredClone(f.shooter);
 await f.game.command(f.shooter.id,{type:'boost',boost:'damage50'});assert.deepEqual(f.shooter,before);assert.match(f.errors().at(-1)!,/Vigor insuficiente/);
 await f.game.command(f.shooter.id,{type:'boost',boost:'damage10'});assert.equal(f.shooter.stamina,34);assert.deepEqual(f.shooter.boosts,['damage10']);
});

test('server: a projectile impact processed twice never deals damage twice',async()=>{
 const f=await battle(),target=f.match.state.players.find(player=>player.id!==f.shooter.id)!;
 target.x=f.shooter.x+40;target.y=600;
 await f.game.command(f.shooter.id,{type:'boost',boost:'trident'});await f.game.command(f.shooter.id,{type:'fire',angle:89,power:1});
 const pending=[...f.match.pendingImpacts!],apply=(f.game as unknown as {applyImpact(m:unknown,i:unknown):void}).applyImpact.bind(f.game);
 for(const impact of pending)apply(f.match,impact);const hp=target.hp,hits=f.match.activeShot!.hits.length;
 for(const impact of pending)apply(f.match,impact);assert.equal(target.hp,hp);assert.equal(f.match.activeShot!.hits.length,hits);
});
