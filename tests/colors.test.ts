import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {ITEMS,isEmptyItem} from '../shared/catalog';
import {COLOR_SLOTS,STARTER_COLOR_TICKETS} from '../shared/colors';
import {normalizeProfile,Store} from '../server/store';
import {RECOLOR_ZONES} from '../src/game/rig/recolorZones';

async function database(){
 const store=new Store(()=>999);await store.pool.end();
 const state={profile:normalizeProfile({id:randomUUID(),name:'Pintor',gender:'male',gold:500}),queries:[] as string[]};
 let snapshot=structuredClone(state.profile);
 const client={
  async query(sql:string,values?:unknown[]){
   state.queries.push(sql);
   if(sql==='BEGIN')snapshot=structuredClone(state.profile);
   if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(state.profile),name:state.profile.name}],rowCount:1};
   if(sql.startsWith('UPDATE'))state.profile=structuredClone(values![1] as typeof state.profile);
   if(sql==='ROLLBACK')state.profile=structuredClone(snapshot);
   return {rows:[],rowCount:0};
  },release(){}
 };
 store.pool={async connect(){return client;}} as unknown as Store['pool'];
 return {store,state};
}

test('every hair, hat, glasses and outfit has a Color Ticket zone',()=>{
 for(const item of ITEMS)if((COLOR_SLOTS as readonly string[]).includes(item.slot)&&!isEmptyItem(item))assert.ok(RECOLOR_ZONES[item.id],`${item.id} sem região de cor`);
});

test('profiles without the color system start with the starter tickets and no colors',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Novo',gender:'female'});
 assert.equal(p.colorTickets,STARTER_COLOR_TICKETS);assert.deepEqual(p.itemColors,{});assert.deepEqual(p.bodyColors,{});
 assert.equal(normalizeProfile({...p,colorTickets:0}).colorTickets,0);
 // Colors of copies no longer owned, or that are not hex colors, are dropped.
 const cleaned=normalizeProfile({...p,itemColors:{'hat-ruby':'#ABCDEF','hat-cap':'#ffffff','outfit-dancer':'red'},bodyColors:{skin:'#123456',eyes:'blue'}});
 assert.deepEqual(cleaned.itemColors,{'hat-ruby':'#abcdef'});assert.deepEqual(cleaned.bodyColors,{skin:'#123456'});
 assert.equal(cleaned.equipment.colors?.hat,'#abcdef');assert.equal(cleaned.equipment.skin,'#123456');
});

test('recoloring a copy costs one ticket, follows the worn copy and refuses without tickets',async()=>{
 const {store,state}=await database();state.profile.inventory.push('hat-cap~2');
 const tickets=state.profile.colorTickets;
 const outcome=await store.recolor(state.profile.id,'hat-cap~2','#2b3fb8');
 assert.equal(outcome.profile.colorTickets,tickets-1);assert.equal(outcome.profile.itemColors['hat-cap~2'],'#2b3fb8');
 // The first copy is worn, so the equipment keeps its painted colors.
 assert.equal(outcome.profile.equipment.colors?.hat,undefined);
 const worn=await store.saveEquipment(state.profile.id,{...outcome.profile.equipment,copies:{hat:'hat-cap~2'}});
 assert.equal(worn.equipment.colors?.hat,'#2b3fb8');
 await assert.rejects(store.recolor(state.profile.id,'hat-cap~2','#2b3fb8'),/já está/);
 await assert.rejects(store.recolor(state.profile.id,'brick','#ff0000'),/visual/);
 await assert.rejects(store.recolor(state.profile.id,'hat-mage','#ff0000'),/visual/);
 const restored=await store.recolor(state.profile.id,'hat-cap~2',null);assert.equal(restored.profile.itemColors['hat-cap~2'],undefined);
 state.profile.colorTickets=0;const before=structuredClone(state.profile);
 await assert.rejects(store.recolor(state.profile.id,'hat-cap','#ff0000'),/Ticket de Cor/);assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');
});

test('skin and eye colors cost one ticket each and reach the equipment',async()=>{
 const {store,state}=await database(),tickets=state.profile.colorTickets;
 await store.bodyColor(state.profile.id,'skin','#8d5534');const outcome=await store.bodyColor(state.profile.id,'eyes','#2f7fd8');
 assert.equal(outcome.profile.colorTickets,tickets-2);assert.equal(outcome.profile.equipment.skin,'#8d5534');assert.equal(outcome.profile.equipment.eyes,'#2f7fd8');
 assert.deepEqual(outcome.result,{target:'eyes',color:'#2f7fd8',tickets:tickets-2});
});

test('tickets are bought by quantity and equipment never by quantity',async()=>{
 const {store,state}=await database(),tickets=state.profile.colorTickets;
 const outcome=await store.buy(state.profile.id,['color-ticket'],4);
 assert.equal(outcome.profile.colorTickets,tickets+4);assert.equal(outcome.profile.gold,500-240);assert.equal(outcome.result.quantity,4);
 assert.ok(!outcome.profile.inventory.includes('color-ticket'));
 await assert.rejects(store.buy(state.profile.id,['hat-mage'],2),/consumíveis/);
 await assert.rejects(store.buy(state.profile.id,['color-ticket'],5),/insuficientes/);
});

test('discarding removes a copy with its data, unequips it and keeps one of each worn type',async()=>{
 const {store,state}=await database();
 state.profile.inventory.push('hat-cap~2');state.profile.itemColors={'hat-cap':'#ff0000','hat-cap~2':'#00ff00'};state.profile.equipment.copies={hat:'hat-cap~2'};
 // Throwing away the first copy moves the newest one into the plain id, keeping what is worn.
 let p=await store.discard(state.profile.id,'hat-cap');
 assert.deepEqual(p.inventory.filter(key=>key.startsWith('hat-cap')),['hat-cap']);assert.equal(p.itemColors['hat-cap'],'#00ff00');assert.equal(p.equipment.hat,'hat-cap');assert.equal(p.equipment.copies?.hat,undefined);assert.equal(p.equipment.colors?.hat,'#00ff00');
 // Throwing away the worn hat leaves the head bare.
 p=await store.discard(state.profile.id,'hat-cap');assert.ok(!p.inventory.includes('hat-cap'));assert.equal(p.equipment.hat,'hat-none');assert.equal(p.itemColors['hat-cap'],undefined);
 await assert.rejects(store.discard(state.profile.id,'hat-cap'),/mochila/);
 // The last weapon cannot go (the test fixtures add more weapons, so throw those away first).
 for(const key of p.inventory.filter(key=>key!==p.equipment.weapon&&ITEMS.find(item=>item.id===key)?.slot==='weapon'))p=await store.discard(state.profile.id,key);
 await assert.rejects(store.discard(state.profile.id,p.equipment.weapon),/pelo menos um/);
 // A worn outfit with another owned is swapped for that one.
 const outfits=p.inventory.filter(key=>key.startsWith('outfit-'));assert.ok(outfits.length>1);
 p=await store.discard(state.profile.id,p.equipment.outfit);assert.ok(p.inventory.includes(p.equipment.outfit));
 // The copy is gone for good after a fresh read.
 assert.deepEqual(normalizeProfile(structuredClone(state.profile)).inventory,p.inventory);
});
