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
