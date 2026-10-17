import test from 'node:test';
import assert from 'node:assert/strict';
import {starterEquipment} from '../shared/catalog';
import type {Equipment} from '../shared/catalog';
import type {Command} from '../shared/protocol';
import {CustomizationQueue,appearanceKey} from '../src/customization';

function fixture(){
 let confirmed=starterEquipment('male'),desired:Equipment|null=null,pending=false;
 const sent:Extract<Command,{type:'customize'}>[]=[];
 const queue=new CustomizationQueue(()=>confirmed,command=>sent.push(command),(equipment,busy)=>{desired=equipment;pending=busy;});
 return {queue,sent,get confirmed(){return confirmed;},get desired(){return desired;},get pending(){return pending;},commit(index:number){const command=sent[index];confirmed={...confirmed,...command.selection.items,visibility:command.selection.visibility};assert.equal(queue.acknowledge(command.requestId!),true);}};
}
test('quick changes merge per slot, preserve visibility and send only one transaction at a time',()=>{
 const f=fixture();f.queue.apply({items:{face:'face-taunt'}});
 f.queue.apply({items:{hat:'hat-thunder'}});f.queue.apply({items:{hat:'hat-tide'}});f.queue.apply({visibility:{glasses:false}});
 assert.equal(f.sent.length,1);assert.equal(f.desired?.hat,'hat-tide');assert.equal(f.pending,true);
 f.commit(0);assert.equal(f.sent.length,2);assert.equal(f.sent[1].selection.items.face,'face-taunt');assert.equal(f.sent[1].selection.items.hat,'hat-tide');assert.equal(f.sent[1].selection.visibility?.glasses,false);
 f.commit(1);assert.equal(f.pending,false);assert.equal(f.desired,null);assert.equal(f.confirmed.hat,'hat-tide');
});
test('returning to original appearance during an in-flight change still persists the final click',()=>{
 const f=fixture(),initial=f.confirmed.face;f.queue.apply({items:{face:'face-taunt'}});f.queue.apply({items:{face:initial}});
 assert.equal(f.sent.length,1);f.commit(0);assert.equal(f.sent.length,2);f.commit(1);assert.equal(f.confirmed.face,initial);assert.equal(f.pending,false);
});
test('matching rejection rolls back all unconfirmed choices; unrelated replies cannot clear a pending change',()=>{
 const f=fixture();f.queue.apply({items:{face:'face-taunt'}});f.queue.apply({visibility:{hat:false}});
 assert.equal(f.queue.reject('unrelated'),false);assert.equal(f.queue.acknowledge('unrelated'),false);assert.equal(f.pending,true);
 assert.equal(f.queue.reject(f.sent[0].requestId!),true);assert.equal(f.pending,false);assert.equal(f.desired,null);assert.equal(f.sent.length,1);assert.equal(f.confirmed.face,starterEquipment('male').face);
});
test('disconnect drops unsent choices and old replies cannot acknowledge a new request',()=>{
 const f=fixture();f.queue.apply({items:{face:'face-taunt'}});f.queue.apply({items:{hat:'hat-tide'}});const old=f.sent[0].requestId!;f.queue.cancel();
 assert.equal(f.pending,false);f.queue.apply({visibility:{hat:false}});assert.notEqual(f.sent[1].requestId,old);assert.equal(f.queue.acknowledge(old),false);assert.equal(f.pending,true);f.commit(1);assert.equal(f.confirmed.hat,starterEquipment('male').hat);assert.equal(f.confirmed.visibility?.hat,false);
});
test('unchanged equipment is a no-op, including explicit default visibility',()=>{
 const f=fixture();f.queue.apply({items:{face:f.confirmed.face},visibility:{hat:true}});assert.equal(f.sent.length,0);assert.equal(f.pending,false);assert.equal(appearanceKey({...f.confirmed,upgrade:12}),appearanceKey(f.confirmed));
});
