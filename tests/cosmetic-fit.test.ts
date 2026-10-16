import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CATALOG,ITEMS} from '../shared/catalog';
import {COSMETIC_FIT,HEAD_ANCHORS,HEAD_WIDTH} from '../src/game/rig/anchors';
import {evaluateBody,evaluateGlassesVisibility,evaluateItem,keepoutPixels} from '../src/game/rig/fit';
import type {FitMask} from '../src/game/rig/fit';

const SIZE=HEAD_ANCHORS.atlasSize;
function rect(x:number,y:number,width:number,height:number):FitMask{
 const data=new Uint8Array(SIZE*SIZE);for(let row=y;row<y+height;row++)data.fill(1,row*SIZE+x,row*SIZE+x+width);
 return {width:SIZE,height:SIZE,originX:0,originY:0,data};
}

test('every visible hair, hat and glasses item declares a fit class',()=>{
 const visible=ITEMS.filter(item=>['hair','hat','glasses'].includes(item.slot)&&item.visual?.variant!=='none'&&!item.id.endsWith('-none'));
 for(const item of visible)assert.ok(COSMETIC_FIT[item.id],`${item.id} has no fit class`);
 for(const id of Object.keys(COSMETIC_FIT))assert.ok(CATALOG[id],`${id} is not in the catalog`);
});

test('hair inside its zone passes; oversized hair reports width and height',()=>{
 const crown=HEAD_ANCHORS.crown[1];
 assert.deepEqual(evaluateItem('hair-spiky',rect(400,crown-60,Math.round(HEAD_WIDTH*1.3),200)).issues,[]);
 const codes=evaluateItem('hair-spiky',rect(300,crown-150,Math.round(HEAD_WIDTH*1.62),200)).issues.map(issue=>issue.code);
 assert.deepEqual(codes.sort(),['height','width']);
});

test('hair over the eyes is reported; hats may cover the brow',()=>{
 const [x,y]=HEAD_ANCHORS.nearEye,eyes=rect(x-30,y-20,60,40);
 assert.ok(keepoutPixels(eyes)>1000);
 assert.ok(evaluateItem('hair-wavy',eyes).issues.some(issue=>issue.code==='keepout'));
 assert.ok(!evaluateItem('hat-cap',eyes).issues.some(issue=>issue.code==='keepout'));
});

test('pieces reaching the template frame are reported',()=>{
 assert.ok(evaluateItem('hat-mage',rect(300,0,500,400)).issues.some(issue=>issue.code==='frame'));
});

test('unregistered items, hidden glasses and body proportions are reported',()=>{
 assert.equal(evaluateItem('hat-unknown',rect(500,200,10,10)).issues[0].code,'unregistered');
 const glasses=rect(500,400,200,80),half=rect(500,400,100,80);
 assert.equal(evaluateGlassesVisibility('glasses-sport',glasses,glasses),null);
 assert.equal(evaluateGlassesVisibility('glasses-sport',glasses,half)?.code,'hidden');
 assert.deepEqual(evaluateBody('outfit-test',.45,.95).issues,[]);
 assert.equal(evaluateBody('outfit-test',.55,.7).issues.length,2);
});
