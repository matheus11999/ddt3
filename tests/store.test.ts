import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {DEFAULT_EQUIPMENT} from '../shared/catalog';
import {normalizeProfile,Store} from '../server/store';

async function database(roll=999){
 const store=new Store(()=>roll);await store.pool.end();
 const state={profile:normalizeProfile({id:randomUUID(),name:'Ferreira',gold:500}),queries:[] as string[],connections:0,releases:0,failWrite:false};
 let snapshot=structuredClone(state.profile);
 const client={
  async query(sql:string,values?:unknown[]){
   state.queries.push(sql);
   if(sql==='BEGIN')snapshot=structuredClone(state.profile);
   if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(state.profile),name:state.profile.name}],rowCount:1};
   if(sql.startsWith('UPDATE')){if(state.failWrite)throw Error('Database write failed');state.profile=structuredClone(values![1] as typeof state.profile);}
   if(sql==='ROLLBACK')state.profile=structuredClone(snapshot);
   return {rows:[],rowCount:0};
  },release(){state.releases++;}
 };
 store.pool={async connect(){state.connections++;return client;}} as unknown as Store['pool'];
 return {store,state};
}

test('failed upgrades consume exactly the selected stones, keep weapon level and never charge gold',async()=>{
 const {store,state}=await database();state.profile.upgrades.ember=8;state.profile.equipment.upgrade=8;
 const before=structuredClone(state.profile),outcome=await store.forge(before.id,'ember',{'1':1,'2':2,'3':0});
 assert.equal(outcome.result.success,false);assert.equal(outcome.result.level,8);assert.equal(outcome.result.chance,9.4);
 assert.deepEqual(outcome.result.consumed,{'1':1,'2':2});assert.equal(outcome.profile.stones['1'],before.stones['1']-1);assert.equal(outcome.profile.stones['2'],before.stones['2']-2);
 assert.equal(outcome.profile.stones['3'],before.stones['3']);assert.deepEqual(outcome.profile.upgrades,before.upgrades);assert.equal(outcome.profile.gold,before.gold);assert.equal(outcome.profile.equipment.upgrade,8);
 assert.match(state.queries[1],/FOR UPDATE$/);assert.equal(state.queries.at(-1),'COMMIT');assert.equal(state.releases,1);
});

test('successful upgrades increase only the selected weapon and publish its authoritative chance',async()=>{
 const {store,state}=await database(0);state.profile.upgrades.volt=4;
 const outcome=await store.forge(state.profile.id,'volt',{'3':1});
 assert.equal(outcome.result.success,true);assert.equal(outcome.result.chance,33.3);assert.equal(outcome.profile.upgrades.volt,5);
 assert.equal(outcome.profile.upgrades.ember,0);assert.equal(outcome.profile.equipment.upgrade,0);
 assert.equal(outcome.profile.stones['3'],14);assert.deepEqual(state.profile,outcome.profile);
});

test('guaranteed upgrades reach +12 and the cap rejects further attempts without consuming material',async()=>{
 const {store,state}=await database(999);state.profile.upgrades.ember=11;state.profile.stones['5']=20;
 const outcome=await store.forge(state.profile.id,'ember',{'5':10});
 assert.equal(outcome.result.chance,100);assert.equal(outcome.result.success,true);assert.equal(outcome.result.level,12);assert.equal(outcome.profile.equipment.upgrade,12);
 const before=structuredClone(state.profile);await assert.rejects(store.forge(state.profile.id,'ember',{'5':1}),/nível máximo/);
 assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.releases,2);
});

test('insufficient, unowned and invalid materials never write a forge outcome',async()=>{
 const {store,state}=await database();state.profile.stones['5']=0;state.profile.inventory=state.profile.inventory.filter(id=>id!=='crystal');
 const before=structuredClone(state.profile);
 await assert.rejects(store.forge(state.profile.id,'ember',{'5':1}),/não tem essas pedras/);
 await assert.rejects(store.forge(state.profile.id,'crystal',{'1':1}),/arma da sua mochila/);
 await assert.rejects(store.forge(state.profile.id,'hat-cap',{'1':1}),/arma da sua mochila/);
 const connections=state.connections;
 await assert.rejects(store.forge(state.profile.id,'ember',{'1':20,'2':1}),/pedras válidas/);
 await assert.rejects(store.forge(state.profile.id,'ember',{'1':-1}),/pedras válidas/);
 assert.equal(state.connections,connections);assert.deepEqual(state.profile,before);assert.equal(state.queries.some(sql=>sql.startsWith('UPDATE')),false);assert.equal(state.releases,3);
});

test('database errors roll back the whole forge and release the locked connection',async()=>{
 const {store,state}=await database(0);state.failWrite=true;const before=structuredClone(state.profile);
 await assert.rejects(store.forge(state.profile.id,'ember',{'1':1}),/Database write failed/);
 assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.releases,1);
});

test('equipment persistence derives upgrade from the locked profile and validates every slot',async()=>{
 const {store,state}=await database();state.profile.upgrades.volt=6;
 const profile=await store.saveEquipment(state.profile.id,{...DEFAULT_EQUIPMENT,weapon:'volt',hat:'hat-cap',upgrade:12});
 assert.equal(profile.equipment.upgrade,6);assert.equal(profile.equippedOnce,true);assert.equal(profile.equipment.hat,'hat-cap');assert.match(state.queries[1],/FOR UPDATE$/);
 const before=structuredClone(state.profile);await assert.rejects(store.saveEquipment(state.profile.id,{...profile.equipment,face:'volt'}),/mochila/);assert.deepEqual(state.profile,before);
});

test('customization saves simultaneous facial, head and clothing layers with dyes atomically',async()=>{
 const {store,state}=await database();const before=structuredClone(state.profile);
 const equipment={...before.equipment,hat:'hat-cap',glasses:'glasses-round',face:'face-taunt',hair:'hair-wavy',outfit:'outfit-royal',dyes:{hat:'coral' as const,hair:'gold' as const,outfit:'violet' as const}};
 const saved=await store.saveEquipment(before.id,equipment);
 assert.deepEqual(saved.equipment,equipment);assert.deepEqual(saved.stones,before.stones);assert.deepEqual(saved.upgrades,before.upgrades);
 assert.equal(saved.equipment.wristband,before.equipment.wristband);assert.equal(saved.equipment.bracelet,before.equipment.bracelet);
 state.profile.inventory=state.profile.inventory.filter(id=>id!=='hair-silver');const locked=structuredClone(state.profile);
 await assert.rejects(store.saveEquipment(before.id,{...equipment,hair:'hair-silver',glasses:'glasses-pilot'}),/mochila/);
 assert.deepEqual(state.profile,locked);assert.equal(state.queries.at(-1),'ROLLBACK');
});
