import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plateLifts} from '../src/game/fighterIndicators';

test('plates of fighters standing side by side are stacked instead of overlapping',()=>{
 assert.deepEqual(plateLifts([{x:500,y:600,width:96},{x:560,y:600,width:96},{x:620,y:600,width:96}]),[0,30,0]);
});

test('plates far apart or on different heights stay in place',()=>{
 assert.deepEqual(plateLifts([{x:200,y:600,width:96},{x:400,y:600,width:96},{x:240,y:400,width:96}]),[0,0,0]);
});
