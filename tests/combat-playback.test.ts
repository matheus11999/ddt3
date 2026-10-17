import assert from 'node:assert/strict';
import {test} from 'node:test';
import {client} from '../src/client';
import {DEFAULT_EQUIPMENT} from '../shared/catalog';
import {createTerrain} from '../shared/physics';
import type {Battle,ServerEvent,Shot} from '../shared/protocol';
import {applyDueImpacts} from '../src/game/terrainPlayback';
import {flightTime,projectileFrame,recoveredImpacts,projectileVisible} from '../src/game/shotPlayback';

const shot:Shot={id:'timed-shot',shooterId:'shooter',startedAt:1000,duration:2000,impacted:[],hits:[],projectiles:[{effect:'fire',delay:240,flightTime:1000,points:[[0,0],[50,30],[100,60]],impact:{x:100,y:60,radius:50}}]};
const hit={id:'target',damage:125,x:100,y:60,projectileIndex:0,critical:false,kind:'direct' as const,quality:1};
const fighter={id:'target',name:'Alvo',team:1 as const,slot:0,level:1,ready:true,connected:true,bot:false,equipment:{...DEFAULT_EQUIPMENT},x:100,y:60,hp:500,maxHp:500,stamina:240,maxStamina:240,facing:-1 as const,boosts:[]};
const battle:Battle={id:'timed-battle',roomId:'timed-room',map:'garden',players:[fighter],phase:'resolving',turnId:'shooter',turnNumber:1,wind:0,deadline:20000,winner:null};
const receive=(event:ServerEvent)=>(client as unknown as {receive(event:ServerEvent):void}).receive(event);

test('flight interpolation uses authoritative time, including fractional frames',()=>{
 const p=shot.projectiles[0];assert.equal(flightTime(p),1000);assert.equal(projectileFrame(p,125),.25);assert.equal(projectileFrame(p,1000),2);assert.equal(projectileFrame(p,2000),2);
});

test('impacts never predict HP and duplicate packets do not duplicate feedback',()=>{
 const before=client.state;
 try{
  client.update({battle,shot,impacts:[],abilityEffects:[]});
  const event:ServerEvent={type:'impact',shotId:shot.id,projectileIndex:0,at:2240,hits:[hit]};
  receive(event);receive(event);
  assert.equal(client.state.battle!.players[0].hp,500,'damage needs an authoritative snapshot');
  assert.equal(client.state.impacts.length,1);assert.equal(client.state.shot!.hits.length,1);
  receive({type:'battle',battle:{...battle,phase:'aiming',terrain:'snapshot',players:[{...fighter,hp:375}]}});
  assert.equal(client.state.battle!.players[0].hp,375);assert.equal(client.state.shot,null);
  assert.equal(client.state.impacts.length,1,'last hit feedback survives turn advancement');
 }finally{client.update(before);}
});

test('reconnection restores applied feedback with the original impact time',()=>{
 assert.deepEqual(recoveredImpacts({...shot,impacted:[0],hits:[hit]}),[{type:'impact',shotId:shot.id,projectileIndex:0,at:2240,hits:[hit]}]);
});

test('a flight projectile does not excavate terrain even with a nonzero visual radius',()=>{
 const terrain=createTerrain(),before=terrain.slice(),flight={...shot,projectiles:[{...shot.projectiles[0],kind:'flight' as const,impact:{x:750,y:600,radius:100}}]};
 const applied=new Set<number>(),result=applyDueImpacts(terrain,'garden',flight,5000,applied);
 assert.deepEqual(result,{removed:0,indices:[0]});assert.deepEqual(terrain,before);assert.ok(applied.has(0));
});

test('victory cancels every unconfirmed future projectile and its local crater',()=>{
 const terrain=createTerrain(),before=terrain.slice(),canceled={...shot,projectiles:[{...shot.projectiles[0],impact:{x:750,y:600,radius:100}}]};
 assert.equal(projectileVisible(canceled,0,true),false);
 assert.deepEqual(applyDueImpacts(terrain,'garden',canceled,5000,new Set(),true),{removed:0,indices:[]});assert.deepEqual(terrain,before);
 assert.equal(projectileVisible({...canceled,impacted:[0]},0,true),true,'the final confirmed explosion remains visible');
});

test('hidden ability effects are not retained and visible effects reset between matches',()=>{
 const before=client.state;
 try{
  client.update({battle,abilityEffects:[]});
  receive({type:'ability-effect',playerId:'opponent',ability:'invisibility',x:-10000,y:-10000,hidden:true,at:100});
  assert.equal(client.state.abilityEffects.length,0);
  const heal:ServerEvent={type:'ability-effect',playerId:'target',ability:'heal',x:100,y:60,amount:300,at:150};
  receive(heal);receive(heal);assert.equal(client.state.abilityEffects.length,1);
  receive({type:'battle',battle:{...battle,id:'next-match'}});assert.equal(client.state.abilityEffects.length,0);
 }finally{client.update(before);}
});
