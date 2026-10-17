import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WEAPONS} from '../shared/catalog';
import {createTerrain,leftArena,trajectory,WORLD} from '../shared/physics';
import {SCORCH_FADE,SCORCH_HOLD,scorchAmount,scorchFilter} from '../src/game/scorch';

test('a shot that leaves the arena ends outside it, so no collision sound plays', () => {
 const terrain=createTerrain();terrain.fill(0);
 const out=trajectory(terrain,{x:WORLD.width-60,y:200,facing:1},20,100,0,WEAPONS[0]);
 assert.equal(leftArena(out),true);
 assert.equal(leftArena({x:600,y:500}),false);
 assert.equal(leftArena({x:WORLD.width,y:WORLD.height-1}),false);
});

test('critical scorch holds, then fades back to the normal look', () => {
 assert.equal(scorchAmount(-1),0);
 assert.equal(scorchAmount(SCORCH_HOLD-1),1);
 assert.ok(scorchAmount(SCORCH_HOLD+SCORCH_FADE/2)>0&&scorchAmount(SCORCH_HOLD+SCORCH_FADE/2)<1);
 assert.equal(scorchAmount(SCORCH_HOLD+SCORCH_FADE),0);
 assert.match(scorchFilter(1),/brightness\(0\.420\)/);
});

test('pain faces follow the hit kind and fighters blink and move the head now and then', async () => {
 const {blinking,hitFace,idleHeadTilt,CRITICAL_FACE_MS,HURT_FACE_MS}=await import('../src/game/faceExpressions');
 assert.equal(hitFace(100,false),'hurt');
 assert.equal(hitFace(100,true),'critical');
 assert.equal(hitFace(HURT_FACE_MS+1,false),undefined);
 assert.equal(hitFace(CRITICAL_FACE_MS+1,true),undefined);
 let closed=0,tilted=0;
 for(let t=0;t<60000;t+=10){if(blinking(t,123))closed++;if(Math.abs(idleHeadTilt(t,123))>.01)tilted++;}
 assert.ok(closed>0&&closed<6000/10,'blinks, but the eyes stay open most of the time');
 assert.ok(tilted>0&&tilted<3000,'the head moves sometimes and rests most of the time');
});
