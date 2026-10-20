import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hitStackSlot,HIT_STACK_SLOTS} from '../src/game/hitFeedback';
import type {ShotHit} from '../shared/protocol';

const hit=(id='bot'):ShotHit=>({id,damage:100,x:0,y:0,projectileIndex:0,critical:false,kind:'direct',quality:1});
const impact=(i:number,at:number,ids=['bot'])=>({shotId:'s',at,projectileIndex:i,hits:ids.map(hit)});

test('a long burst reuses the slots of faded numbers instead of climbing the screen',()=>{
 const impacts=Array.from({length:8},(_,i)=>impact(i,i*570));
 assert.deepEqual(impacts.map(item=>hitStackSlot(impacts,item,item.hits[0])),[0,1,2,0,1,2,0,1]);
});

test('numbers on screen together never share a slot, and the slot stays under the limit',()=>{
 const impacts=[impact(0,0),impact(1,0),impact(2,0),impact(3,300),impact(4,300)];
 const slots=impacts.map(item=>hitStackSlot(impacts,item,item.hits[0]));
 assert.equal(new Set(slots.slice(0,4)).size,4);
 assert.ok(slots.every(slot=>slot>=0&&slot<HIT_STACK_SLOTS));
});

test('hits on other fighters or other shots do not count',()=>{
 const impacts=[impact(0,0,['other']),{...impact(1,10),shotId:'t'},impact(2,20)];
 assert.equal(hitStackSlot(impacts,impacts[2],impacts[2].hits[0]),0);
});
