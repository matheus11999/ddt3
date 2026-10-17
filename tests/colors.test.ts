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
 const recolor=(target:string,color:string|null)=>store.paint(state.profile.id,[{target,color}]);
 const tickets=state.profile.colorTickets;
 const outcome=await recolor('hat-cap~2','#3a6fb0');
 assert.equal(outcome.profile.colorTickets,tickets-1);assert.equal(outcome.profile.itemColors['hat-cap~2'],'#3a6fb0');
 // The first copy is worn, so the equipment keeps its painted colors.
 assert.equal(outcome.profile.equipment.colors?.hat,undefined);
 const worn=await store.saveEquipment(state.profile.id,{...outcome.profile.equipment,copies:{hat:'hat-cap~2'}});
 assert.equal(worn.equipment.colors?.hat,'#3a6fb0');
 await assert.rejects(recolor('hat-cap~2','#3a6fb0'),/Nada mudou/);
 await assert.rejects(recolor('brick','#c8463d'),/visual/);
 await assert.rejects(recolor('hat-mage','#c8463d'),/visual/);
 const restored=await recolor('hat-cap~2',null);assert.equal(restored.profile.itemColors['hat-cap~2'],undefined);
 state.profile.colorTickets=0;const before=structuredClone(state.profile);
 await assert.rejects(recolor('hat-cap','#c8463d'),/Ticket de Cor/);assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');
});

test('one paint request changes pieces, skin and eyes together, charging only real changes',async()=>{
 const {store,state}=await database();state.profile.colorTickets=3;state.profile.inventory.push('hair-undercut');state.profile.itemColors={'hair-undercut':'#e8332f'};
 const outcome=await store.paint(state.profile.id,[{target:'hat-cap',color:'#3a6fb0'},{target:'hair-undercut',color:'#e8332f'},{target:'skin',color:'#b77b52'},{target:'eyes',color:'#3a78b8'}]);
 // The hair already had that color, so three tickets pay for the three real changes.
 assert.equal(outcome.profile.colorTickets,0);assert.deepEqual(outcome.result,{changes:[{target:'hat-cap',color:'#3a6fb0'},{target:'skin',color:'#b77b52'},{target:'eyes',color:'#3a78b8'}],tickets:0});
 assert.equal(outcome.profile.equipment.colors?.hat,'#3a6fb0');assert.equal(outcome.profile.equipment.skin,'#b77b52');assert.equal(outcome.profile.equipment.eyes,'#3a78b8');
 // Without a ticket for every change nothing is painted.
 state.profile.colorTickets=1;const before=structuredClone(state.profile);
 await assert.rejects(store.paint(state.profile.id,[{target:'hat-cap',color:null},{target:'skin',color:null}]),/2 Tickets de Cor/);assert.deepEqual(state.profile,before);
 await assert.rejects(store.paint(state.profile.id,[{target:'skin',color:null},{target:'skin',color:'#5a3624'}]),/duas vezes/);
});

test('only the ready colors can be painted, and colors painted before the palette stay',async()=>{
 const {store,state}=await database();state.profile.itemColors={'hat-cap':'#ff00ff'};state.profile.bodyColors={skin:'#a1311c'};
 await assert.rejects(store.paint(state.profile.id,[{target:'hat-cap',color:'#00ff00'}]),/cores prontas/);
 await assert.rejects(store.paint(state.profile.id,[{target:'skin',color:'#3a6fb0'}]),/cores prontas/);
 await assert.rejects(store.paint(state.profile.id,[{target:'eyes',color:'#c8463d'}]),/cores prontas/);
 // The old strong colors are kept on load and an unchanged entry costs nothing.
 const p=normalizeProfile(structuredClone(state.profile));assert.equal(p.itemColors['hat-cap'],'#ff00ff');assert.equal(p.bodyColors.skin,'#a1311c');
 const outcome=await store.paint(state.profile.id,[{target:'hat-cap',color:'#ff00ff'},{target:'skin',color:'#5a3624'}]);
 assert.deepEqual(outcome.result.changes,[{target:'skin',color:'#5a3624'}]);
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
 state.profile.inventory.push('hat-cap~2');state.profile.itemColors={'hat-cap':'#c8463d','hat-cap~2':'#00ff00'};state.profile.equipment.copies={hat:'hat-cap~2'};
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
