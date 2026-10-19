import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adjustAimToTerrain,terrainAimOffset,weaponAimLimits,clampAimAngle} from '../shared/aim';
import {WORLD} from '../shared/physics';
import {DEFAULT_EQUIPMENT,WEAPONS} from '../shared/catalog';
import type {Fighter} from '../shared/protocol';
const floor=(gradient:number)=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows);
 for(let x=0;x<WORLD.cols;x++)for(let y=0;y<WORLD.rows;y++)if(y*3>=600+(x*3-600)*gradient)terrain[y*WORLD.cols+x]=1;
 return terrain;
};
function fighter():Fighter{return {id:'aim',name:'Mira',team:0,level:1,slot:0,ready:true,bot:false,connected:true,equipment:{...DEFAULT_EQUIPMENT},x:600,y:600,facing:1,hp:100,maxHp:100,stamina:100,maxStamina:100,boosts:[],aimAngle:45,aimSlope:0};}
test('support raises aim uphill and lowers it downhill, mirrored by facing',()=>{
 assert.equal(terrainAimOffset(floor(0),fighter()),0);
 const uphill=terrainAimOffset(floor(-.5),fighter()),downhill=terrainAimOffset(floor(.5),fighter());
 assert.ok(uphill>=24&&uphill<=28);assert.equal(downhill,-uphill);
 assert.equal(terrainAimOffset(floor(-.5),{...fighter(),facing:-1}),-uphill);
});
test('crater support changes preserve relative elevation without accumulating drift',()=>{
 const f=fighter(),terrain=floor(.5);adjustAimToTerrain(f,terrain);
 assert.equal(f.aimAngle,45+f.aimSlope!);const angle=f.aimAngle;
 adjustAimToTerrain(f,terrain);assert.equal(f.aimAngle,angle);
 adjustAimToTerrain(f,floor(0));assert.equal(f.aimAngle,45);
});
test('every weapon keeps its own relative limits inside the forward firing envelope',()=>{
 for(const weapon of WEAPONS)for(const slope of [-30,0,30]){
  const limits=weaponAimLimits(weapon,slope);assert.ok(limits.minAngle>=5&&limits.maxAngle<=90&&limits.minAngle<=limits.maxAngle);
  assert.equal(clampAimAngle(weapon,slope,-300),limits.minAngle);assert.equal(clampAimAngle(weapon,slope,300),limits.maxAngle);
 }
 assert.notEqual(weaponAimLimits(WEAPONS[0],0).minAngle,weaponAimLimits(WEAPONS[2],0).minAngle);
});
test('a cliff without local support does not tilt aim toward a distant floor',()=>{
 const terrain=floor(0);for(let x=201;x<WORLD.cols;x++)for(let y=0;y<WORLD.rows;y++)terrain[y*WORLD.cols+x]=0;
 assert.equal(terrainAimOffset(terrain,fighter()),0);
});
test('a small bump beside the feet does not tip the body',()=>{
 const terrain=floor(0);
 // A pebble two cells wide and two cells high, a few pixels to the side.
 for(const cx of [204,205])for(const cy of [198,199])terrain[cy*WORLD.cols+cx]=1;
 assert.equal(terrainAimOffset(terrain,fighter()),0);
 // A one-cell step under the body is still flat ground, not a steep ramp (it read 9° before).
 const step=floor(0);for(let x=201;x<WORLD.cols;x++)step[199*WORLD.cols+x]=1;
 assert.ok(Math.abs(terrainAimOffset(step,fighter()))<=4);
});
