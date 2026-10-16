import assert from 'node:assert/strict';
import {test} from 'node:test';
import {client} from '../src/client';
import {DEFAULT_EQUIPMENT} from '../shared/catalog';
import {applyDueImpacts} from '../src/game/terrainPlayback';
import {crater,createTerrain,ground,packTerrain,terrainTemplate,unpackTerrain} from '../shared/physics';
import type {MapId} from '../shared/maps';
import type {Battle,ServerEvent,Shot} from '../shared/protocol';

function shotFor(map:MapId='garden',id='playback',offset=0):Shot {
 const terrain=createTerrain(map);
 const projectiles=[{x:650+offset,delay:200},{x:870+offset,delay:0},{x:760+offset,delay:200},{x:520+offset,delay:100}].map(({x,delay})=>({
  delay,points:Array.from({length:6},()=>[x,ground(terrain,x)]),impact:{x,y:ground(terrain,x),radius:65},effect:'fire' as const
 }));
 return {id,shooterId:'player',projectiles,hits:[],duration:850};
}
function authoritativeAfter(terrain:Uint8Array,map:MapId,shot:Shot){
 const result=terrain.slice();for(const projectile of shot.projectiles)crater(result,projectile.impact.x,projectile.impact.y,projectile.impact.radius,map);return result;
}

test('terrain playback waits for impacts, orders simultaneous arrivals, and applies each once',()=>{
 const shot=shotFor(),terrain=createTerrain(),before=terrain.slice(),applied=new Set<number>();
 assert.deepEqual(applyDueImpacts(terrain,'garden',shot,99,applied),{removed:0,indices:[]});assert.deepEqual(terrain,before);
 assert.deepEqual(applyDueImpacts(terrain,'garden',shot,100,applied).indices,[1]);
 assert.deepEqual(applyDueImpacts(terrain,'garden',shot,200,applied).indices,[3]);
 assert.deepEqual(applyDueImpacts(terrain,'garden',shot,300,applied).indices,[0,2]);
 assert.deepEqual(terrain,authoritativeAfter(before,'garden',shot));
 const settled=terrain.slice();assert.deepEqual(applyDueImpacts(terrain,'garden',shot,100000,applied),{removed:0,indices:[]});assert.deepEqual(terrain,settled);
});

test('a frame resumed long after the visual effects window still applies every missed crater',()=>{
 const shot=shotFor(),terrain=createTerrain(),expected=authoritativeAfter(terrain,'garden',shot),applied=new Set<number>();
 const result=applyDueImpacts(terrain,'garden',shot,shot.duration+60000,applied);
 assert.ok(result.removed>0);assert.deepEqual(result.indices,[1,3,0,2]);assert.deepEqual(terrain,expected);
});

test('immutable fortress impacts finish playback without changing collision',()=>{
 const terrain=createTerrain('celestial'),before=terrain.slice(),shot=shotFor('celestial'),applied=new Set<number>();
 const result=applyDueImpacts(terrain,'celestial',shot,100000,applied);
 assert.equal(result.removed,0);assert.equal(result.indices.length,shot.projectiles.length);assert.deepEqual(terrain,before);
 assert.deepEqual(applyDueImpacts(terrain,'celestial',shot,100001,applied),{removed:0,indices:[]});
});

test('hybrid playback damages soil while preserving every immutable region',()=>{
 const terrain=createTerrain('park'),before=terrain.slice(),template=terrainTemplate('park'),shot=shotFor('park');
 shot.projectiles.push({points:[[350,600]],delay:0,impact:{x:350,y:ground(terrain,350),radius:86},effect:'fire'});
 const result=applyDueImpacts(terrain,'park',shot,100000,new Set());assert.ok(result.removed>0);
 for(let index=0;index<terrain.length;index++){const region=template.definition[template.regions[index]];if(region&&!region.destructible)assert.equal(terrain[index],before[index]);}
 assert.deepEqual(terrain,authoritativeAfter(before,'park',shot));
});

test('remount replays only the active shot on the preceding authoritative snapshot',()=>{
 const first=shotFor('garden','previous',-250),active=shotFor('garden','active'),live=createTerrain();
 applyDueImpacts(live,'garden',first,100000,new Set());const checkpoint=packTerrain(live),applied=new Set<number>();
 applyDueImpacts(live,'garden',active,100,applied);
 // A new renderer has no local exploded set, but receives the preceding snapshot and original elapsed time.
 const remounted=unpackTerrain(checkpoint),remountedApplied=new Set<number>();
 applyDueImpacts(remounted,'garden',active,220,remountedApplied);applyDueImpacts(live,'garden',active,220,applied);
 assert.deepEqual(remounted,live);
 applyDueImpacts(remounted,'garden',active,100000,remountedApplied);
 const finalSnapshot=authoritativeAfter(unpackTerrain(checkpoint),'garden',active);assert.deepEqual(remounted,finalSnapshot);
 // Receiving the final snapshot then repeating a historical effect cannot remove additional cells.
 const restored=unpackTerrain(packTerrain(finalSnapshot));assert.equal(applyDueImpacts(restored,'garden',active,100000,new Set()).removed,0);assert.deepEqual(restored,finalSnapshot);
});

test('client retains the shot clock and base snapshot until authoritative resolution completes',()=>{
 const original=client.state,receive=(event:ServerEvent)=>(client as unknown as {receive(event:ServerEvent):void}).receive(event);
 const terrain=createTerrain(),shot=shotFor(),snapshot=Buffer.from(packTerrain(terrain)).toString('base64');
 const player={id:'player',name:'Teste',level:1,team:0 as const,slot:0,ready:true,connected:true,bot:false,equipment:{...DEFAULT_EQUIPMENT},x:600,y:550,hp:1000,maxHp:1000,stamina:100,maxStamina:100,facing:1 as const,boosts:[]};
 const battle:Battle={id:'playback-match',roomId:'playback-room',map:'garden',players:[player],turnId:'player',turnNumber:1,wind:0,deadline:Date.now()+30000,phase:'aiming',winner:null,terrain:snapshot};
 try{
  client.update({battle,shot:null,shotReceivedAt:0});const before=performance.now();receive({type:'shot',shot});const receivedAt=client.state.shotReceivedAt;
  assert.ok(receivedAt>=before&&receivedAt<=performance.now());
  receive({type:'battle',battle:{...battle,players:[{...player,y:640,hp:650}],terrain:undefined,phase:'resolving'}});
  assert.equal(client.state.shot,shot);assert.equal(client.state.shotReceivedAt,receivedAt);assert.equal(client.state.battle!.terrain,snapshot);
  // A remounted renderer must animate from the pre-impact position and HP, not apply damage twice.
  assert.deepEqual(client.state.shotBaseline.player,{x:600,y:550,hp:1000});
  assert.equal(client.state.battle!.players[0].hp,650);
  const finalTerrain=authoritativeAfter(terrain,'garden',shot),finalSnapshot=Buffer.from(packTerrain(finalTerrain)).toString('base64');
  receive({type:'battle',battle:{...battle,phase:'aiming',turnNumber:2,terrain:finalSnapshot}});
  assert.equal(client.state.shot,null);assert.equal(client.state.battle!.terrain,finalSnapshot);
 }finally{client.update(original);}
});
