import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile,Store} from '../server/store';
import {CONTENT_VERSION,SLOTS,starterEquipment} from '../shared/catalog';
import type {Equipment} from '../shared/catalog';
import {commandSchema} from '../shared/protocol';
import type {Command,Profile,ServerEvent} from '../shared/protocol';

function deferred(){
 let resolve!:()=>void;
 const promise=new Promise<void>(done=>{resolve=done;});
 return {promise,resolve};
}

function customization(equipment:Equipment,requestId?:string):Extract<Command,{type:'customize'}>{
 return commandSchema.parse({type:'customize',requestId,selection:{
  items:Object.fromEntries(SLOTS.map(slot=>[slot,equipment[slot]])),
  visibility:equipment.visibility??{}
 }}) as Extract<Command,{type:'customize'}>;
}

async function fixture(){
 const store=new Store();await store.pool.end();
 const state={
  profile:normalizeProfile({id:randomUUID(),name:'Customization ACK',gender:'male',contentVersion:CONTENT_VERSION,equipment:starterEquipment('male'),inventory:[...SLOTS.map(slot=>starterEquipment('male')[slot]),'face-taunt','face-smile','costume-thunder-chick'],gold:500}),
  queries:[] as string[],beforeCommit:null as null|(()=>Promise<void>)
 };
 let pending=structuredClone(state.profile);
 const connection={
  async query(sql:string,values?:unknown[]){
   state.queries.push(sql);
   if(sql==='BEGIN')pending=structuredClone(state.profile);
   if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(pending),name:pending.name}],rowCount:1};
   if(sql.startsWith('UPDATE'))pending=structuredClone(values![1] as Profile);
   if(sql==='COMMIT'){await state.beforeCommit?.();state.profile=structuredClone(pending);}
   if(sql==='ROLLBACK')pending=structuredClone(state.profile);
   return {rows:[],rowCount:0};
  },release(){}
 };
 store.pool={async connect(){return connection;}} as unknown as Store['pool'];
 const events:ServerEvent[]=[],observerEvents:ServerEvent[]=[],game=new Game(store);
 const peer=game.connect(structuredClone(state.profile),event=>events.push(structuredClone(event)));
 game.connect(normalizeProfile({id:randomUUID(),name:'Observer'}),event=>observerEvents.push(structuredClone(event)));
 events.length=0;observerEvents.length=0;
 return {game,peer,state,events,observerEvents};
}

test('customization request IDs are optional bounded strings and cannot be attached to unrelated commands',()=>{
 const legacy=customization(starterEquipment('male'));
 assert.equal(commandSchema.safeParse(legacy).success,true);
 assert.equal(commandSchema.safeParse({...legacy,requestId:'a'.repeat(64)}).success,true);
 for(const requestId of ['', 'a'.repeat(65),42,null])assert.equal(commandSchema.safeParse({...legacy,requestId}).success,false);
 for(const type of ['equip','dye','shop-buy'])assert.equal(commandSchema.safeParse({type,requestId:'unexpected',item:'ember',items:['volt'],slot:'hat',color:'coral'}).success,false);
});

test('customization acknowledges the exact request only after commit, then publishes the saved equipment',async()=>{
 const f=await fixture(),before=structuredClone(f.state.profile),entered=deferred(),commit=deferred();
 f.state.beforeCommit=async()=>{entered.resolve();await commit.promise;};
 const selected={...before.equipment,face:'face-taunt',costume:'costume-thunder-chick',visibility:{hat:false,glasses:false,costume:true}};
 const saving=f.game.command(before.id,customization(selected,'appearance-1'));
 await entered.promise;
 assert.deepEqual(f.state.profile,before,'uncommitted state is not durable');
 assert.deepEqual(f.peer.profile,before,'peer remains authoritative until persistence finishes');
 assert.equal(f.events.length,0);assert.equal(f.observerEvents.length,0);
 commit.resolve();await saving;
 const acknowledgements=f.events.filter(event=>event.type==='profile');
 assert.equal(acknowledgements.length,1);assert.equal(acknowledgements[0].requestId,'appearance-1');
 assert.deepEqual(acknowledgements[0].profile,f.state.profile);
 assert.equal(f.state.profile.equipment.face,'face-taunt');
 assert.equal(f.state.profile.equipment.costume,'costume-thunder-chick');
 assert.deepEqual(f.state.profile.equipment.visibility,selected.visibility);
 const publication=f.observerEvents.find(event=>event.type==='lobby');
 assert.equal(publication?.type,'lobby');
 if(publication?.type==='lobby')assert.deepEqual(publication.players.find(player=>player.id===before.id)?.equipment,f.state.profile.equipment);
 assert.equal(f.state.queries.at(-1),'COMMIT');
 assert.equal(f.events.some(event=>event.type!=='profile'&&Object.hasOwn(event,'requestId')),false);
});

test('gender and ownership failures return the matching request ID without partially changing equipment',async()=>{
 for(const [requestId,changes,message] of [
  ['gender-rejection',{face:'face-smile'},/gênero/],
  ['ownership-rejection',{glasses:'glasses-cat'},/mochila/]
 ] as const){
  const f=await fixture(),before=structuredClone(f.state.profile);
  await f.game.command(before.id,customization({...before.equipment,...changes,hat:'hat-none',visibility:{hat:false}},requestId));
  assert.deepEqual(f.state.profile,before);assert.deepEqual(f.peer.profile,before);
  assert.equal(f.events.length,1);const event=f.events[0];assert.equal(event.type,'error');
  if(event.type==='error'){assert.equal(event.requestId,requestId);assert.match(event.message,message);}
  assert.equal(f.state.queries.at(-1),'ROLLBACK');assert.equal(f.state.queries.some(sql=>sql.startsWith('UPDATE')),false);
  assert.deepEqual(f.observerEvents,[]);
 }
});

test('failed persistence returns a correlated error and retains the last committed appearance',async()=>{
 const f=await fixture(),before=structuredClone(f.state.profile);
 f.state.beforeCommit=async()=>{throw Error('Persistence unavailable');};
 await f.game.command(before.id,customization({...before.equipment,face:'face-taunt'},'commit-error'));
 assert.deepEqual(f.state.profile,before);assert.deepEqual(f.peer.profile,before);
 assert.deepEqual(f.events,[{type:'error',message:'Persistence unavailable',requestId:'commit-error'}]);
 assert.equal(f.state.queries.at(-1),'ROLLBACK');assert.deepEqual(f.observerEvents,[]);
});

test('battle and in-flight equipment guards preserve correlation without emitting success',async()=>{
 const f=await fixture(),before=structuredClone(f.state.profile),entered=deferred(),commit=deferred();
 f.state.beforeCommit=async()=>{entered.resolve();await commit.promise;};
 const saving=f.game.command(before.id,customization({...before.equipment,face:'face-taunt'},'first'));
 await entered.promise;
 await f.game.command(before.id,customization(before.equipment,'busy'));
 assert.deepEqual(f.events,[{type:'error',message:'Aguarde a atualização do seu equipamento.',requestId:'busy'}]);
 commit.resolve();await saving;
 assert.equal(f.events.filter(event=>event.type==='profile'&&event.requestId==='first').length,1);
 await f.game.command(before.id,{type:'create',name:'Guard practice',practice:true});
 await f.game.command(before.id,{type:'bot'});await f.game.command(before.id,{type:'start'});
 const committed=structuredClone(f.state.profile),queryCount=f.state.queries.length;f.events.length=0;f.observerEvents.length=0;
 await f.game.command(before.id,customization(before.equipment,'battle'));
 assert.deepEqual(f.events,[{type:'error',message:'Troque seus equipamentos entre as batalhas.',requestId:'battle'}]);
 assert.equal(f.state.queries.length,queryCount);assert.deepEqual(f.state.profile,committed);assert.deepEqual(f.peer.profile,committed);
});

test('legacy customization and unrelated profile/error replies do not gain a request ID',async()=>{
 const f=await fixture(),id=f.peer.profile.id;
 const commands:Command[]=[customization(f.peer.profile.equipment),{type:'equip',item:'face-taunt'},{type:'equip',item:'missing'}];
 for(const command of commands){
  f.events.length=0;await f.game.command(id,command);
  const reply=f.events.find(event=>event.type==='profile'||event.type==='error');
  assert.ok(reply);assert.equal(Object.hasOwn(reply,'requestId'),false);
 }
});
