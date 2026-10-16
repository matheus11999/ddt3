import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {crater,createTerrain,ground,packTerrain,solid,trajectory,unpackTerrain,WORLD} from '../shared/physics';

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
