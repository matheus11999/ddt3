import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {test} from 'node:test';
import atlases from '../src/game/combatAtlas.json';
import {COMBAT_ATLAS,COMBAT_FRAME_NAMES,COMBAT_FRAMES,COMBAT_SEQUENCES,COMBAT_STEP_MS,combatFrame} from '../src/game/rig/combatFrames';
import contract from '../src/game/rig/combatFrames.json';

test('the combat contract names every frame once, in atlas order, and both sheets cover them',()=>{
 assert.deepEqual(Object.keys(COMBAT_FRAMES),[...COMBAT_FRAME_NAMES]);
 assert.deepEqual(contract.sheets.flatMap(sheet=>sheet.frames),[...COMBAT_FRAME_NAMES]);
 assert.ok(COMBAT_ATLAS.columns*COMBAT_ATLAS.rows>=COMBAT_FRAME_NAMES.length);
});

test('fighters lie down until they charge, rise and hold to charge, then throw and lie down again',()=>{
 assert.equal(combatFrame('idle',0,0,0),'rest');
 assert.equal(combatFrame('aim',500,0,0),'rest');
 assert.equal(combatFrame('charge',0,0,0),'rise');
 assert.equal(combatFrame('charge',COMBAT_STEP_MS,0,0),'ready');
 assert.equal(combatFrame('charge',5000,0,0),'ready');
 assert.deepEqual([0,60,170,300,450,1000].map(t=>combatFrame('fire',t,0,0)),['windup','release','follow','settle','rise','rest']);
 assert.equal(combatFrame('hit',0,0,0),'hurt');
});

test('crawling walks through the four crawl drawings, each held two steps, by distance',()=>{
 const seen=Array.from({length:8},(_,i)=>combatFrame('walk',0,(i+.5)*Math.PI*2/8,1));
 assert.deepEqual(seen,[...COMBAT_SEQUENCES.walk]);
 assert.equal(combatFrame('walk',0,1,.1),'rest','barely moving stays at rest');
});

test('every combat atlas has its image and a measured head for all twelve frames',()=>{
 for(const [outfit,entry] of Object.entries(atlases as Record<string,{path:string;frames:{head:number[]}[]}>)){
  assert.ok(existsSync(`public${entry.path}`),`${outfit}: ${entry.path}`);
  assert.equal(entry.frames.length,COMBAT_FRAME_NAMES.length,outfit);
  entry.frames.forEach((frame,i)=>{
   const spec=COMBAT_FRAMES[COMBAT_FRAME_NAMES[i]];
   assert.equal(frame.head[0],spec.head[0],`${outfit} ${COMBAT_FRAME_NAMES[i]}: head x follows the contract`);
   assert.ok(Math.abs(frame.head[1]-spec.head[1])<30,`${outfit} ${COMBAT_FRAME_NAMES[i]}: head at ${frame.head[1]}, contract ${spec.head[1]}`);
  });
 }
});
