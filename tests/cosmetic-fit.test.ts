import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CATALOG,ITEMS} from '../shared/catalog';
import {HEAD_ANCHORS,HEAD_WIDTH,RIG_VERSION} from '../src/game/rig/anchors';
import {COSMETIC_MANIFEST} from '../src/game/rig/manifest';
import {evaluateBody,evaluateCombatSheet,evaluateGlassesVisibility,evaluateItem,evaluatePin,evaluateProne,evaluateWalkSheet,keepoutPixels} from '../src/game/rig/fit';
import type {FitMask} from '../src/game/rig/fit';

const SIZE=HEAD_ANCHORS.atlasSize;
function rect(x:number,y:number,width:number,height:number):FitMask{
 const data=new Uint8Array(SIZE*SIZE);for(let row=y;row<y+height;row++)data.fill(1,row*SIZE+x,row*SIZE+x+width);
 return {width:SIZE,height:SIZE,originX:0,originY:0,data};
}

test('every visible hair, hat and glasses item declares a fit class',()=>{
 const visible=ITEMS.filter(item=>['hair','hat','glasses'].includes(item.slot)&&item.visual?.variant!=='none'&&!item.id.endsWith('-none'));
 for(const item of visible)assert.ok(COSMETIC_MANIFEST[item.id],`${item.id} has no fit class`);
 for(const id of Object.keys(COSMETIC_MANIFEST))assert.ok(CATALOG[id],`${id} is not in the catalog`);
});

test('hair inside its zone passes; oversized hair reports width and height',()=>{
 const crown=HEAD_ANCHORS.crown[1];
 assert.deepEqual(evaluateItem('hair-undercut',rect(400,crown-60,Math.round(HEAD_WIDTH*1.3),200)).issues,[]);
 const codes=evaluateItem('hair-undercut',rect(300,crown-150,Math.round(HEAD_WIDTH*1.62),200)).issues.map(issue=>issue.code);
 assert.deepEqual(codes.sort(),['height','width']);
});

test('hair over the eyes is reported; hats may cover the brow',()=>{
 const [x,y]=HEAD_ANCHORS.nearEye,eyes=rect(x-30,y-20,60,40);
 assert.ok(keepoutPixels(eyes)>1000);
 assert.ok(evaluateItem('hair-wavy',eyes).issues.some(issue=>issue.code==='keepout'));
 assert.ok(!evaluateItem('hat-cap',eyes).issues.some(issue=>issue.code==='keepout'));
});

test('atlas pieces are placed by their pin, so the template frame does not apply',()=>{
 assert.ok(!evaluateItem('hat-mage',rect(300,0,500,400)).issues.some(issue=>issue.code==='frame'));
 assert.ok(!evaluateItem('hair-undercut',rect(300,10,500,400)).issues.some(issue=>issue.code==='frame'));
});

test('unregistered items, hidden glasses and body proportions are reported',()=>{
 assert.equal(evaluateItem('hat-unknown',rect(500,200,10,10)).issues[0].code,'unregistered');
 const glasses=rect(500,400,200,80),half=rect(500,400,100,80);
 assert.equal(evaluateGlassesVisibility('glasses-sport',glasses,glasses),null);
 assert.equal(evaluateGlassesVisibility('glasses-sport',glasses,half)?.code,'hidden');
 assert.deepEqual(evaluateBody('outfit-test',.5,.61).issues,[]);
 assert.equal(evaluateBody('outfit-test',.55,.95).issues.length,2);
 assert.deepEqual(evaluateProne('outfit-test',.2,1.2,8).issues,[]);
 assert.equal(evaluateProne('outfit-test',.01,.7,90).issues.length,3);
});

test('manifests target the current rig and painted art declares a pin inside its atlas region',()=>{
 for(const [id,manifest] of Object.entries(COSMETIC_MANIFEST)){
  assert.equal(manifest.rig,RIG_VERSION,`${id} was authored for another rig`);
  assert.equal(manifest.slot,CATALOG[id].slot,`${id} slot differs from the catalog`);
  assert.ok(manifest.procedural||manifest.worn,`${id} has neither painted art nor a procedural drawing`);
  for(const region of [manifest.worn,manifest.covered])if(region){
   const [a,b]=region.pin.from;assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])>0,`${id} pin points coincide`);
   const [x,y,w,h]=region.source;for(const [px,py] of region.clip??[])assert.ok(px>=x&&py>=y&&px<=x+w&&py<=y+h,`${id} clip leaves its region`);
  }
 }
});

test('every pinned hat and glasses item lands on the universal anchors',()=>{
 for(const [id,manifest] of Object.entries(COSMETIC_MANIFEST))if(manifest.slot!=='hair')assert.equal(evaluatePin(id),null,id);
});

test('lobby walk sheets and battle atlases are measured frame by frame',()=>{
 const frame=(head:[number,number],extra:object={})=>({painted:true,cut:false,groundGap:0,head,hands:true,...extra});
 assert.equal(evaluateWalkSheet('outfit-test',null).issues[0].code,'missing');
 const walk=[0,1,2,3,4,5].map(i=>frame([0,-112-(i%3)]));
 assert.deepEqual(evaluateWalkSheet('outfit-test',walk).issues,[]);
 const codes=evaluateWalkSheet('outfit-test',[...walk.slice(0,4),frame([0,-140],{cut:true}),frame([0,-112],{groundGap:9})]).issues.map(issue=>issue.code).sort();
 assert.deepEqual(codes,['bob','cut','ground']);
 const expected=Array.from({length:12},(_,i):[number,number]=>[i<6?28:8,i<6?-44:-72]);
 assert.equal(evaluateCombatSheet('outfit-test',null,expected).issues[0].code,'missing');
 assert.deepEqual(evaluateCombatSheet('outfit-test',expected.map(head=>frame(head)),expected).issues,[]);
 const bad=evaluateCombatSheet('outfit-test',[...expected.slice(0,11).map(head=>frame(head)),frame([30,-30],{hands:false})],expected).issues.map(issue=>issue.code).sort();
 assert.deepEqual(bad,['anchor','missing']);
});
