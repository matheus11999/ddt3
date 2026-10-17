import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {MAP_IDS,getMap} from '../shared/maps';
import {crater,createTerrain,ground,packTerrain,solid,terrainMaterial,terrainTemplate,trajectory,unpackTerrain,walkPosition,WORLD} from '../shared/physics';
import {WEAPONS} from '../shared/catalog';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {Profile,ServerEvent} from '../shared/protocol';

test('every map has four balanced, supported mirrored spawns per team',()=>{
 for(const id of MAP_IDS){const map=getMap(id),terrain=createTerrain(id);assert.deepEqual(terrain,createTerrain(id));
  const width=map.dimensions.width;assert.equal(terrain.length,width/WORLD.cell*WORLD.rows);
  if(width===WORLD.width)assert.deepEqual(map.spawns.map(team=>team.slice(0,2)),[[260,395],[1276,1141]]);
  // Two players start a good distance apart, never at opposite ends of a wide map.
  const duel=map.spawns[1][0]-map.spawns[0][0];assert.ok(duel>=900&&duel<=1200,`${id} 1v1 distance ${duel}`);
  for(const team of map.spawns){assert.equal(team.length,4);const sorted=[...team].sort((a,b)=>a-b);for(let n=1;n<sorted.length;n++)assert.ok(sorted[n]-sorted[n-1]>=72,`${id} spawn separation`);}
  for(let n=0;n<4;n++){const left=map.spawns[0][n],right=map.spawns[1][n],ly=ground(terrain,left),ry=ground(terrain,right);assert.equal(left+right,width);assert.ok(Math.abs(ly-ry)<=3,`${id} spawn height`);assert.ok(ly<650&&ry<650);
   for(const x of [left,right]){const y=ground(terrain,x);assert.ok(solid(terrain,x,y));for(const dx of [-12,0,12])for(const dy of [-50,-25,-12])assert.ok(!solid(terrain,x+dx,y+dy),`${id} clear spawn body at ${x}`);assert.ok(walkPosition(terrain,{x,y},-1));assert.ok(walkPosition(terrain,{x,y},1));}
  }
  assert.deepEqual(unpackTerrain(packTerrain(terrain)),terrain);
 }
});

test('garden crater changes support, falls to the new surface, and repeated impacts persist',()=>{
 const terrain=createTerrain('garden'),x=650,y=ground(terrain,x),before=terrain.slice();
 assert.ok(crater(terrain,x,y,65,'garden')>0);assert.ok(ground(terrain,x,y)>y+60);assert.equal(solid(terrain,x,y),false);
 const after=terrain.slice();crater(terrain,x,y+30,65,'garden');assert.notDeepEqual(terrain,after);assert.notDeepEqual(terrain,before);
 assert.deepEqual(unpackTerrain(packTerrain(terrain)),terrain);
});

test('celestial geometry remains intact through overlapping impacts at every material',()=>{
 const terrain=createTerrain('celestial'),before=terrain.slice();for(let x=80;x<1450;x+=25)for(let y=490;y<800;y+=31)assert.equal(crater(terrain,x,y,86,'celestial'),0);
 assert.deepEqual(terrain,before);assert.equal(terrainMaterial('celestial',768,555).destructible,false);assert.equal(terrainMaterial('celestial',768,555).material,'magic');
});

test('hybrid ground breaks while its metal bridge and stone piers remain solid',()=>{
 const terrain=createTerrain('park'),original=terrain.slice(),template=terrainTemplate('park');
 crater(terrain,350,ground(terrain,350),86,'park');assert.notDeepEqual(terrain,original);
 assert.equal(terrainMaterial('park',768,552).material,'metal');crater(terrain,768,552,180,'park');
 for(let i=0;i<terrain.length;i++){const region=template.definition[template.regions[i]];if(region&&!region.destructible)assert.equal(terrain[i],original[i]);}
 assert.equal(solid(terrain,768,552),true);
});

test('interactive containers block shots and their collision disappears with their artwork mask',()=>{
 const terrain=createTerrain('park');assert.equal(solid(terrain,666,522),true);assert.equal(terrainMaterial('park',666,522).region,'park-barrel-a');
 const shot=trajectory(terrain,{x:620,y:558,facing:1},15,10,0,WEAPONS[0]);assert.ok(shot.x>=644&&shot.x<=690);
 crater(terrain,666,522,50,'park');assert.equal(solid(terrain,666,522),false);assert.equal(solid(terrain,666,552),true);
});

test('craters do not modify immutable regions',()=>{
 const terrain=createTerrain('garden');crater(terrain,420,738,24,'garden');assert.equal(solid(terrain,441,738),false);assert.equal(solid(terrain,447,738),true);
});

test('walking cannot enter tall containers and still climbs both park ramps',()=>{
 const garden=createTerrain('garden'),besideCrate={x:496,y:ground(garden,496)};
 assert.equal(walkPosition(garden,besideCrate,1),null);
 const park=createTerrain('park');
 for(const direction of [1,-1] as const){
  const x=direction===1?430:1106;let position={x,y:ground(park,x)};
  for(let step=0;step<23;step++){const next=walkPosition(park,position,direction);assert.ok(next,'a supported park ramp must remain walkable');position=next;}
  assert.equal(position.y,549);assert.equal(terrainMaterial('park',position.x,position.y).region,'park-bridge');
 }
});

for(const map of MAP_IDS)test(`${map}: two clients receive identical impacts and reconnect gets authoritative terrain`,async()=>{
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store:ProfileStore={saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store),players=['MAP-A','MAP-B'].map(name=>normalizeProfile({id:randomUUID(),name,gold:500}));
 for(const p of players){profiles.set(p.id,p);events.set(p.id,[]);game.connect(p,e=>events.get(p.id)!.push(structuredClone(e)));}
 const [a,b]=players;await game.command(a.id,{type:'create',practice:true,name:'Map verification',mode:'1v1',map});const roomId=game.peers.get(a.id)!.roomId!;
 await game.command(b.id,{type:'join',roomId});await game.command(b.id,{type:'ready'});await game.command(a.id,{type:'start'});
 const match=game.matches.get(roomId)!,before=match.terrain.slice(),first=match.state.players.find(f=>f.id===match.state.turnId)!;
 await game.command(first.id,{type:'fire',angle:65,power:20});
 const shotA=events.get(a.id)!.find((e):e is Extract<ServerEvent,{type:'shot'}>=>e.type==='shot')!.shot;
 const shotB=events.get(b.id)!.find((e):e is Extract<ServerEvent,{type:'shot'}>=>e.type==='shot')!.shot;assert.deepEqual(shotA,shotB);
 assert.deepEqual(match.terrain,before,'fire does not apply future destruction');game.tick(match.resolveAt+1);
 const local=before.slice();for(const p of shotA.projectiles){assert.ok(p.impact.material);crater(local,p.impact.x,p.impact.y,p.impact.radius,map);}assert.deepEqual(local,match.terrain);
 assert.notDeepEqual(match.terrain,before);
 game.disconnect(a.id);const resumed:ServerEvent[]=[];game.connect(a,e=>resumed.push(e));const welcome=resumed.find((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome')!;
 assert.equal(welcome.battle?.map,map);assert.deepEqual(unpackTerrain(Buffer.from(welcome.battle!.terrain!,'base64')),match.terrain);
 await game.command(a.id,{type:'leave'});await game.command(b.id,{type:'leave'});for(const match of game.matches.values())if(match.state.rewards)game.tick(match.state.rewards.deadline+1);await new Promise(resolve=>setImmediate(resolve));game.tick(Date.now()+30000);assert.equal(game.matches.size,0);
});
