import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {attributes,DEFAULT_EQUIPMENT} from '../shared/catalog';
import {normalizeProfile,Store} from '../server/store';

async function database(roll=999){
 const store=new Store(()=>roll);await store.pool.end();
 const state={profile:normalizeProfile({id:randomUUID(),name:'Ferreira',gender:'male',gold:500}),queries:[] as string[],connections:0,releases:0,failWrite:false};
 let snapshot=structuredClone(state.profile);
 const client={
  async query(sql:string,values?:unknown[]){
   state.queries.push(sql);
   if(sql==='BEGIN')snapshot=structuredClone(state.profile);
   if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(state.profile),name:state.profile.name}],rowCount:1};
   if(sql.startsWith('UPDATE')){if(state.failWrite)throw Error('Database write failed');state.profile=structuredClone(values![1] as typeof state.profile);}
   if(sql.startsWith('INSERT INTO matches'))return {rows:[{id:'match'}],rowCount:1};
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

test('guaranteed upgrades reach +15 and the cap rejects further attempts without consuming material',async()=>{
 const {store,state}=await database(999);state.profile.upgrades.ember=14;state.profile.stones['5']=20;
 const outcome=await store.forge(state.profile.id,'ember',{'5':20});
 assert.equal(outcome.result.chance,100);assert.equal(outcome.result.success,true);assert.equal(outcome.result.level,15);assert.equal(outcome.profile.equipment.upgrade,15);
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
 const profile=await store.saveEquipment(state.profile.id,{...state.profile.equipment,weapon:'volt',hat:'hat-cap',upgrade:12});
 assert.equal(profile.equipment.upgrade,6);assert.equal(profile.equippedOnce,true);assert.equal(profile.equipment.hat,'hat-cap');assert.match(state.queries[1],/FOR UPDATE$/);
 const before=structuredClone(state.profile);await assert.rejects(store.saveEquipment(state.profile.id,{...profile.equipment,face:'volt'}),/mochila/);assert.deepEqual(state.profile,before);
});

test('customization saves simultaneous facial, head and clothing layers with dyes atomically',async()=>{
 const {store,state}=await database();state.profile.inventory.push('glasses-sport','hair-undercut');const before=structuredClone(state.profile);
 const equipment={...before.equipment,hat:'hat-cap',glasses:'glasses-sport',face:'face-taunt',hair:'hair-undercut',outfit:'outfit-executive',dyes:{hat:'coral' as const,hair:'gold' as const,outfit:'violet' as const}};
 const saved=await store.saveEquipment(before.id,equipment);
 assert.deepEqual(saved.equipment,equipment);assert.deepEqual(saved.stones,before.stones);assert.deepEqual(saved.upgrades,before.upgrades);
 assert.equal(saved.equipment.wristband,before.equipment.wristband);assert.equal(saved.equipment.bracelet,before.equipment.bracelet);
 state.profile.inventory=state.profile.inventory.filter(id=>id!=='hair-silver');const locked=structuredClone(state.profile);
 await assert.rejects(store.saveEquipment(before.id,{...equipment,hair:'hair-silver',glasses:'glasses-pilot'}),/mochila/);
 assert.deepEqual(state.profile,locked);assert.equal(state.queries.at(-1),'ROLLBACK');
});

test('retired outfit IDs are rejected even when supplied by a stale customization client',async()=>{
 const {store,state}=await database(),before=structuredClone(state.profile);
 for(const outfit of ['outfit-ranger','outfit-azure','outfit-royal'])await assert.rejects(store.saveEquipment(before.id,{...before.equipment,outfit}),/mochila/);
 assert.deepEqual(state.profile,before);
});

test('match rewards advance a player beyond the former level fifty cap',async()=>{
 const {store,state}=await database();state.profile.level=50;state.profile.xp=14990;
 await store.finishMatch(randomUUID(),[state.profile.id],[state.profile.id]);
 assert.equal(state.profile.level,51);assert.equal(state.profile.xp,15110);
});

test('match rewards reach level seventy and subsequent wins never create level seventy-one',async()=>{
 const {store,state}=await database();state.profile.level=69;state.profile.xp=20690;
 await store.finishMatch(randomUUID(),[state.profile.id],[state.profile.id]);
 assert.equal(state.profile.level,70);assert.equal(state.profile.xp,20810);
 for(let i=0;i<4;i++)await store.finishMatch(randomUUID(),[state.profile.id],[state.profile.id]);
 assert.equal(state.profile.level,70);assert.equal(state.profile.matches,5);assert.equal(state.profile.wins,5);
});

test('composition persists one tier per attribute and participates in equipped combat totals',async()=>{
 const {store,state}=await database(0),before=structuredClone(state.profile),base=attributes(before.equipment);
 const first=await store.compose(before.id,'ember','attack-1');
 assert.equal(first.result.success,true);assert.equal(first.result.value,10);assert.equal(first.profile.gold,460);
 assert.equal(first.profile.compositionStones['attack-1'],before.compositionStones['attack-1']-1);
 assert.equal(attributes(first.profile.equipment).attack,base.attack+10);
 const second=await store.compose(before.id,'ember','attack-2');
 assert.equal(second.result.previous,10);assert.equal(second.result.value,20);
 assert.equal(attributes(second.profile.equipment).attack,base.attack+20);
 const equipped=await store.saveEquipment(before.id,{...second.profile.equipment,weapon:'volt',compositions:{volt:{attack:999}}});
 assert.equal(attributes(equipped.equipment).attack,attributes({...DEFAULT_EQUIPMENT,weapon:'volt'}).attack);
 assert.deepEqual(equipped.compositions,{ember:{attack:20}});
 const restored=await store.saveEquipment(before.id,{...equipped.equipment,weapon:'ember'});
 assert.equal(attributes(restored.equipment).attack,base.attack+20);
});

test('failed composition consumes one stone and its shown cost while preserving previous bonuses',async()=>{
 const {store,state}=await database(999);state.profile.compositions={ember:{attack:10}};
 const before=structuredClone(state.profile),outcome=await store.compose(before.id,'ember','attack-2');
 assert.equal(outcome.result.success,false);assert.equal(outcome.result.chance,60);assert.equal(outcome.result.value,10);
 assert.equal(outcome.profile.gold,before.gold-100);assert.equal(outcome.profile.compositionStones['attack-2'],before.compositionStones['attack-2']-1);
 assert.deepEqual(outcome.profile.compositions,before.compositions);assert.deepEqual(outcome.profile.stones,before.stones);
 assert.deepEqual(outcome.profile.upgrades,before.upgrades);assert.match(state.queries[1],/FOR UPDATE$/);
});

test('composition rejects incompatible equipment, downgrades, absent materials and insufficient gold atomically',async()=>{
 const {store,state}=await database(0);state.profile.compositions={ember:{attack:20}};state.profile.compositionStones['defense-1']=0;state.profile.gold=30;
 state.profile.inventory=state.profile.inventory.filter(id=>id!=='crystal');const before=structuredClone(state.profile);
 for(const [item,stone] of [['face-brave','attack-1'],['hat-none','attack-1'],['crystal','attack-1'],['ember','attack-1'],['ember','attack-2'],['ember','defense-1'],['ember','agility-1'],['ember','constructor']])await assert.rejects(store.compose(before.id,item,stone));
 assert.deepEqual(state.profile,before);assert.equal(state.queries.some(sql=>sql.startsWith('UPDATE')),false);
});

test('composition rollback restores both currency and mineral on database failure',async()=>{
 const {store,state}=await database(0);state.failWrite=true;const before=structuredClone(state.profile);
 await assert.rejects(store.compose(before.id,'outfit-surfer','armor-1'),/Database write failed/);
 assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.releases,1);
});

test('shop purchase atomically deducts the server price and grants all selected items without equipping',async()=>{
 const {store,state}=await database();state.profile.inventory=state.profile.inventory.filter(id=>!['volt','face-taunt'].includes(id));state.profile.gold=1000;
 const before=structuredClone(state.profile),outcome=await store.buy(before.id,['volt','face-taunt']);
 assert.equal(outcome.result.spent,540);assert.equal(outcome.profile.gold,460);
 assert.ok(outcome.profile.inventory.includes('volt')&&outcome.profile.inventory.includes('face-taunt'));
 assert.deepEqual(outcome.profile.equipment,before.equipment);assert.match(state.queries[1],/FOR UPDATE$/);assert.equal(state.queries.at(-1),'COMMIT');
 const again=await store.buy(before.id,['volt']);assert.equal(again.profile.gold,100);assert.deepEqual(again.result.items,['volt']);
 assert.ok(again.profile.inventory.includes('volt~2'));assert.equal(again.profile.upgrades['volt~2'],0);
});
test('repeat purchases become separate copies with their own forge level, compositions and equip state',async()=>{
 const {store,state}=await database(0);state.profile.gold=2000;const id=state.profile.id,base=attributes(state.profile.equipment);
 await store.buy(id,['ember']);await store.buy(id,['ember']);
 assert.deepEqual(state.profile.inventory.filter(key=>key.startsWith('ember')),['ember','ember~2','ember~3']);
 // Forging and composing the copy leaves the first ember untouched.
 const forged=await store.forge(id,'ember~2',{'3':1});assert.equal(forged.result.level,1);assert.equal(forged.profile.upgrades.ember,0);assert.equal(forged.profile.upgrades['ember~2'],1);
 const composed=await store.compose(id,'ember~2','attack-1');assert.equal(composed.result.value,10);assert.deepEqual(composed.profile.compositions,{'ember~2':{attack:10}});
 assert.equal(composed.profile.equipment.upgrade,0);assert.equal(attributes(composed.profile.equipment).attack,base.attack);
 // Wearing the copy brings its own level and bonus into combat; the first copy stays plain.
 const worn=await store.saveEquipment(id,{...composed.profile.equipment,copies:{weapon:'ember~2'}});
 assert.equal(worn.equipment.weapon,'ember');assert.deepEqual(worn.equipment.copies,{weapon:'ember~2'});assert.equal(worn.equipment.upgrade,1);
 assert.deepEqual(worn.equipment.compositions,{ember:{attack:10}});
 const plain=await store.saveEquipment(id,{...worn.equipment,copies:{}});assert.equal(plain.equipment.upgrade,0);assert.equal(plain.equipment.compositions,undefined);
 await assert.rejects(store.saveEquipment(id,{...plain.equipment,copies:{weapon:'ember~9'}}),/cópia/);
 // Copies survive a reload and a stale copy for another item is dropped.
 const reloaded=normalizeProfile({...structuredClone(worn),equipment:{...worn.equipment,copies:{weapon:'ember~2',hat:'ember~3'}}});
 assert.deepEqual(reloaded.equipment.copies,{weapon:'ember~2'});assert.equal(reloaded.upgrades['ember~2'],1);assert.deepEqual(reloaded.compositions['ember~2'],{attack:10});
 assert.ok(!normalizeProfile({...structuredClone(worn),inventory:['volt~2']}).inventory.includes('volt~2'));
});
test('shop rejects duplicate, unavailable, owned or unaffordable carts without partial purchases',async()=>{
 const {store,state}=await database();state.profile.inventory=state.profile.inventory.filter(id=>id!=='volt');state.profile.gold=10;
 const before=structuredClone(state.profile);
 for(const ids of [[],['volt','volt'],['not-a-real-item'],['volt','ember'],['volt']])await assert.rejects(store.buy(before.id,ids));
 assert.deepEqual(state.profile,before);assert.ok(!state.queries.some(q=>q.startsWith('UPDATE')));
});
test('shop database failures roll back the entire basket and balance',async()=>{
 const {store,state}=await database();state.profile.inventory=state.profile.inventory.filter(id=>id!=='volt');state.failWrite=true;
 const before=structuredClone(state.profile);await assert.rejects(store.buy(before.id,['volt']),/Database write failed/);
 assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.releases,1);
});
test('card rewards are included in the same atomic match payout and progression',async()=>{
 const {store,state}=await database();state.profile.xp=14990;state.profile.level=50;const id=state.profile.id;
 await store.finishMatch(randomUUID(),[id],[id],{[id]:{kind:'xp',amount:100}});
 assert.equal(state.profile.xp,15210);assert.equal(state.profile.level,51);assert.equal(state.profile.gold,580);
 await store.finishMatch(randomUUID(),[],[id],{[id]:{kind:'coins',amount:150}});assert.equal(state.profile.gold,755);assert.equal(state.profile.matches,2);
});

test('card payout database errors roll back the base reward, bonus and level together',async()=>{
 const {store,state}=await database();state.failWrite=true;const before=structuredClone(state.profile),id=before.id;
 await assert.rejects(store.finishMatch(randomUUID(),[id],[id],{[id]:{kind:'coins',amount:100}}),/Database write failed/);
 assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.releases,1);
});
