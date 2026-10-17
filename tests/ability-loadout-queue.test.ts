import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AbilityLoadoutQueue} from '../src/abilityLoadout';
import type {AbilityLoadout} from '../shared/abilities';
import type {Command} from '../shared/protocol';

type SaveCommand=Extract<Command,{type:'ability-loadout'}>;
function setup(){
 let confirmed:AbilityLoadout=['heal','homing','invisibility'];
 const sent:SaveCommand[]=[],published:{draft:AbilityLoadout|null;pending:boolean}[]=[];
 const queue=new AbilityLoadoutQueue(()=>confirmed,command=>sent.push(command),(draft,pending)=>published.push({draft,pending}));
 return {queue,sent,published,commit(command:SaveCommand){confirmed=command.slots;return queue.acknowledge(command.requestId!);}};
}

test('rapid preparation changes save only the in-flight choice and latest intent',()=>{
 const {queue,sent,published,commit}=setup();
 queue.apply(['homing','heal',null]);
 queue.apply(['invisibility','heal',null]);
 queue.apply([null,'invisibility','homing']);
 assert.equal(sent.length,1);
 assert.deepEqual(published.at(-1),{draft:[null,'invisibility','homing'],pending:true});
 commit(sent[0]);
 assert.equal(sent.length,2);
 assert.deepEqual(sent[1].slots,[null,'invisibility','homing']);
 commit(sent[1]);
 assert.deepEqual(published.at(-1),{draft:null,pending:false});
});

test('unrelated profile/error acknowledgments cannot clear a pending loadout',()=>{
 const {queue,sent,published,commit}=setup();
 queue.apply([null,'homing',null]);
 assert.equal(queue.acknowledge('appearance-1'),false);
 assert.equal(queue.reject('loadout-other'),false);
 assert.equal(queue.matches(sent[0].requestId!),true);
 assert.equal(published.at(-1)?.pending,true);
 commit(sent[0]);
 assert.equal(published.at(-1)?.pending,false);
});

test('rejection and reconnect discard unconfirmed choices without accepting stale ACKs',()=>{
 const {queue,sent,published}=setup();
 queue.apply(['invisibility',null,null]);
 queue.apply(['homing',null,null]);
 assert.equal(queue.reject(sent[0].requestId!),true);
 assert.equal(sent.length,1);
 assert.deepEqual(published.at(-1),{draft:null,pending:false});
 queue.apply([null,null,'heal']);
 queue.cancel();
 queue.apply([null,'homing',null]);
 assert.notEqual(sent[1].requestId,sent[2].requestId);
 assert.equal(queue.acknowledge(sent[1].requestId!),false);
 assert.equal(queue.matches(sent[2].requestId!),true);
});

test('returning to confirmed slots avoids a write and the queued snapshot is immutable',()=>{
 const {queue,sent,published,commit}=setup();
 queue.apply(['heal','homing','invisibility']);
 assert.equal(sent.length,0);
 const slots:AbilityLoadout=['homing','heal',null];
 queue.apply(slots);slots[0]='invisibility';
 assert.deepEqual(sent[0].slots,['homing','heal',null]);
 queue.apply(['heal','homing','invisibility']);
 commit(sent[0]);
 assert.equal(sent.length,2);
 assert.deepEqual(sent[1].slots,['heal','homing','invisibility']);
 commit(sent[1]);
 assert.deepEqual(published.at(-1),{draft:null,pending:false});
});
