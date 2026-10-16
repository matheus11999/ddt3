import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {crater,createTerrain,ground,packTerrain,solid,terrainMaterial,trajectory,unpackTerrain,volley,WORLD} from '../shared/physics';

test('terrain is deterministic, map-specific and round-trips its compact network representation',()=>{
 const sky=createTerrain('sky'),valley=createTerrain('valley');
 assert.deepEqual(sky,createTerrain('sky'));assert.notDeepEqual(sky,valley);
 assert.equal(packTerrain(sky).byteLength,sky.byteLength/8);assert.deepEqual(unpackTerrain(packTerrain(sky)),sky);
 assert.equal(solid(sky,-1,600),false);assert.equal(solid(sky,WORLD.width,600),false);
});

test('a crater removes only material inside its radius and opens a new landing surface',()=>{
 const terrain=createTerrain(),before=terrain.slice(),x=600,y=ground(terrain,x);
 crater(terrain,x,y,60);
 assert.equal(solid(terrain,x,y),false);assert.ok(ground(terrain,x,y)>=y+57);
 assert.equal(solid(terrain,x+66,y+60),solid(before,x+66,y+60));
 for(let cell=0;cell<terrain.length;cell++)if(terrain[cell]!==before[cell]){
  assert.equal(terrain[cell],0);const cx=(cell%WORLD.cols)*3,cy=Math.floor(cell/WORLD.cols)*3;
  assert.ok(Math.hypot(cx-x,cy-y)<=60);
 }
});

test('server trajectories account for wind, weapon gravity and facing',()=>{
 const terrain=createTerrain(),origin={x:350,y:ground(terrain,350),facing:1};
 const calm=trajectory(terrain,origin,50,45,0,WEAPONS[0]),wind=trajectory(terrain,origin,50,45,5,WEAPONS[0]);
 const light=trajectory(terrain,origin,50,45,0,WEAPONS[1]),heavy=trajectory(terrain,origin,50,45,0,WEAPONS[2]);
 assert.ok(wind.x>calm.x);assert.ok(light.x>heavy.x);
 const left=trajectory(terrain,{...origin,facing:-1},50,25,0,WEAPONS[0]);assert.ok(left.x<origin.x);
 assert.ok(calm.points.length>10);assert.ok(calm.points.every(point=>point.every(Number.isFinite)));
});

test('projectiles collide with living fighters and ignore defeated fighters',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:50,y:100,facing:1};
 const target={id:'target',x:90,y:95,hp:100};
 assert.equal(trajectory(terrain,origin,45,10,0,WEAPONS[0],[target]).hitId,'target');
 assert.equal(trajectory(terrain,origin,45,10,0,WEAPONS[0],[{...target,hp:0}]).hitId,undefined);
});

test('fast projectiles sweep through thin terrain cells in both directions',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);
 for(let row=0;row<WORLD.rows;row++)terrain[row*WORLD.cols+27]=1;
 for(const weapon of WEAPONS)for(const origin of [{x:40,y:100,facing:1},{x:125,y:100,facing:-1}]){
  const result=trajectory(terrain,origin,0,100,0,{...weapon,gravity:0});
  assert.ok(result.x>=81&&result.x<84,`missed the 3px wall: ${result.x}`);
  assert.ok(solid(terrain,result.x,result.y));assert.ok(result.flightTime>0&&result.flightTime<2*1000/120);
  const center=result.points.at(-1)!;assert.ok(!solid(terrain,center[0],center[1]));
  assert.ok(Math.abs(Math.hypot(result.x-center[0],result.y-center[1])-weapon.projectileRadius)<.0001);
 }
});

test('a grazing fighter collision is detected between fixed integration positions',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),rad=5*Math.PI/180,dx=Math.cos(rad)*980/120,dy=-Math.sin(rad)*980/120,radius=24+WEAPONS[0].projectileRadius;
 // Both integration endpoints are outside the circle; the segment crosses its rim.
 const target={id:'grazing',x:77+dx/2+Math.sin(rad)*(radius-.1),y:60+dy/2+Math.cos(rad)*(radius-.1)+31,hp:100};
 for(const [x,y] of [[77,60],[77+dx,60+dy]])assert.ok(Math.hypot(x-target.x,y-(target.y-31))>radius);
 const result=trajectory(terrain,{x:50,y:100,facing:1},5,100,0,WEAPONS[0],[target]);
 assert.equal(result.hitId,target.id);assert.ok(result.flightTime<1000/120);
});

test('weapon disks reach a wall at different times without changing its contact surface',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);for(let row=0;row<WORLD.rows;row++)terrain[row*WORLD.cols+100]=1;
 const origin={x:50,y:100,facing:1};
 const results=WEAPONS.map(weapon=>{
  const result=trajectory(terrain,origin,0,100,0,{...weapon,gravity:0});
  assert.ok(Math.abs(result.flightTime-(300-weapon.projectileRadius-77)/980*1000)<1e-8);
  assert.ok(Math.abs(result.points.at(-1)![0]-(300-weapon.projectileRadius))<1e-8);
  assert.ok(Math.abs(result.x-300)<.0001);return result;
 });
 assert.equal(new Set(WEAPONS.map(w=>w.projectileRadius)).size,WEAPONS.length,'every family has its own hitbox');
 assert.ok(results[2].flightTime<results[0].flightTime&&results[0].flightTime<results[1].flightTime);
});

test('disk tangency detects the top and bottom of a cell without square corner false positives',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);terrain[20*WORLD.cols+50]=1;
 const weapon={...WEAPONS[0],gravity:0},radius=weapon.projectileRadius;
 for(const y of [60-radius,63+radius]){
  const result=trajectory(terrain,{x:50,y:y+40,facing:1},0,100,0,weapon);
  assert.ok(result.x>=150&&result.x<153);assert.ok(solid(terrain,result.x,result.y));
  assert.ok(Math.abs(result.points.at(-1)![0]-150)<1e-7);
 }
 const result=trajectory(terrain,{x:50,y:60-radius+.1+40,facing:1},0,100,0,weapon);
 const expected=150-Math.sqrt(radius*radius-(radius-.1)**2);
 assert.ok(Math.abs(result.points.at(-1)![0]-expected)<1e-7,'round corner contact must follow the circle, not its bounding square');
 assert.equal(trajectory(terrain,{x:50,y:60-radius-.01+40,facing:1},0,100,0,weapon).x,WORLD.width+80);
 // This diagonal crosses the expanded square's upper-left corner but stays
 // more than 6px from the actual cell, so the disk must pass unobstructed.
 assert.equal(trajectory(terrain,{x:50,y:162,facing:1},45,100,0,weapon).x,WORLD.width+80);
});

test('fighter collision uses body plus weapon radius and returns a body surface contact',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:50,y:100,facing:1},target={id:'tangent',x:300,y:121,hp:100};
 const results=WEAPONS.map(weapon=>trajectory(terrain,origin,0,100,0,{...weapon,gravity:0},[target]));
 assert.equal(results[0].hitId,target.id,'6px ember disk must detect an exact body tangent');
 assert.equal(results[1].hitId,undefined,'3px volt disk clears the same gap');
 assert.equal(results[2].hitId,target.id,'9px crystal disk reaches the body earlier');
 assert.ok(results[2].flightTime<results[0].flightTime);
 for(const index of [0,2]){
  const result=results[index],center=result.points.at(-1)!;
  assert.ok(Math.abs(Math.hypot(center[0]-target.x,center[1]-(target.y-31))-(24+WEAPONS[index].projectileRadius))<1e-7);
  assert.ok(Math.abs(Math.hypot(result.x-target.x,result.y-(target.y-31))-24)<1e-7);
 }
});

test('surface metadata follows the touched cell and fortress disks never destroy terrain',()=>{
 for(const [map,x,material,destructible] of [['garden',300,'earth',true],['park',768,'metal',false],['celestial',300,'stone',false],['celestial',768,'magic',false]] as const)for(const weapon of WEAPONS){
  const terrain=createTerrain(map),before=terrain.slice();
  const result=trajectory(terrain,{x:x-27,y:200,facing:1},-90,100,0,{...weapon,gravity:0});
  const center=result.points.at(-1)!;assert.ok(solid(terrain,result.x,result.y));assert.ok(!solid(terrain,center[0],center[1]));
  assert.deepEqual({...terrainMaterial(map,result.x,result.y),region:undefined},{material,destructible,region:undefined});
  const removed=crater(terrain,result.x,result.y,weapon.crater,map);
  if(destructible)assert.ok(removed>0);else assert.ok(solid(terrain,result.x,result.y));
  if(map==='celestial'){assert.equal(removed,0);assert.deepEqual(terrain,before);}
 }
});

test('simultaneous projectiles resolve by arrival and see earlier terrain removal',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);terrain.fill(1,100*WORLD.cols);
 const arrival:{index:number;time:number}[]=[];
 const results=volley(terrain,{x:100,y:100,facing:1},[75,5,40],30,0,WEAPONS[0],[],(result,index)=>{
  arrival.push({index,time:result.flightTime});if(arrival.length===1)terrain.fill(0);
 });
 assert.deepEqual(arrival.map(hit=>hit.index),[1,2,0]);
 assert.ok(arrival.every((hit,index)=>index===0||hit.time>arrival[index-1].time));
 assert.ok(results[1].y>=300&&results[1].y<303);assert.equal(results[0].y,WORLD.height+50);assert.equal(results[2].y,WORLD.height+50);
});

test('an impact rechecks other projectiles within the same fixed simulation step',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);for(let row=0;row<WORLD.rows;row++)terrain[row*WORLD.cols+27]=1;
 const results=volley(terrain,{x:50,y:100,facing:1},[5,5],100,0,WEAPONS[0],[],(_,index)=>{if(index===0)terrain.fill(0);});
 assert.ok(results[0].x>=81&&results[0].x<84);assert.equal(results[1].x,WORLD.width+80);assert.ok(results[1].flightTime>results[0].flightTime);
});

test('dynamite uses its own physical footprint and destruction budget',()=>{
 const dynamite=WEAPONS.find(w=>w.id==='dynamite')!;
 assert.ok(dynamite);assert.equal(dynamite.effect,'dynamite');
 const terrain=createTerrain('garden'),origin={x:350,y:ground(terrain,350),facing:1};
 const impact=trajectory(terrain,origin,45,38,0,dynamite);
 assert.ok(impact.points.length>10);assert.ok(impact.points.every(point=>point.every(Number.isFinite)));
 const removed=crater(terrain,impact.x,impact.y,dynamite.crater,'garden');assert.ok(removed>0);
 const brasa=WEAPONS.find(w=>w.id==='ember')!,crystal=WEAPONS.find(w=>w.id==='crystal')!;
 assert.ok(dynamite.crater<brasa.crater&&dynamite.crater<crystal.crater);
 assert.ok(dynamite.damage<brasa.damage,'smaller crater does not exceed the dragon damage budget');
 assert.notEqual(dynamite.blast,dynamite.crater,'blast and terrain destruction have independent radii');
});
