import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {canEquipItem,CATALOG,CHARACTER_GENDERS,CONTENT_VERSION,DEFAULT_EQUIPMENT,isEmptyItem,itemGender,ITEMS,RETIRED_OUTFIT_REPLACEMENTS,SLOTS,starterEquipment,unequipForGender} from '../shared/catalog';
import type {CharacterGender,Equipment} from '../shared/catalog';
import {commandSchema,sessionRequestSchema} from '../shared/protocol';
import type {Profile} from '../shared/protocol';
import {SHOP_OFFERS} from '../shared/shop';
import {normalizeProfile,Store} from '../server/store';

test('gendered appearance, including the navigator glasses, rejects the opposite character gender',()=>{
 const male=['face-brave','face-taunt','face-fierce','face-captain','hat-cap','hat-thunder','hat-tide','hat-captain','hair-undercut','hair-horizon','hair-captain','glasses-navigator','glasses-captain','outfit-captain','outfit-hiphop','outfit-swordsman','hat-hiphop','hat-swordsman','hair-hiphop','hair-swordsman','glasses-hiphop'];
 const female=['face-smile','face-serene','face-wink','hat-mage','hat-ruby','hat-tropical','hair-ponytail','hair-wavy'];
 for(const [gender,ids] of [['male',male],['female',female]] as const)for(const id of ids){assert.equal(itemGender(id),gender);assert.equal(canEquipItem(id,gender),true);assert.equal(canEquipItem(CATALOG[id],gender==='male'?'female':'male'),false);}
 for(const item of ITEMS){
  if(item.id.endsWith('-none')||['weapon','outfit','wristband','bracelet','costume','ring','necklace','bubble'].includes(item.slot)&&!['outfit-captain','outfit-hiphop','outfit-swordsman'].includes(item.id)||item.slot==='glasses'&&!['glasses-navigator','glasses-captain','glasses-hiphop'].includes(item.id)){assert.equal(itemGender(item),'unisex');assert.ok(CHARACTER_GENDERS.every(gender=>canEquipItem(item,gender)));}
  else assert.notEqual(itemGender(item),'unisex');
 }
 // The Cartógrafo da Aurora is the starter outfit of both genders; the Capitão Escarlate is a male shop outfit.
 assert.deepEqual(ITEMS.filter(item=>item.slot==='outfit').map(item=>item.id),['outfit-cartographer','outfit-captain','outfit-hiphop','outfit-swordsman']);
 for(const offer of SHOP_OFFERS)assert.equal(offer.gender,itemGender(offer.id),'store categories derive from equipment compatibility');
 for(const id of ['missing','constructor','__proto__'])assert.equal(canEquipItem(id,'male'),false);
 assert.equal(canEquipItem('ember','other' as CharacterGender),false);
});

test('male and female starter equipment and removal fallbacks are compatible independent copies',()=>{
 assert.deepEqual(starterEquipment('male'),DEFAULT_EQUIPMENT);
 const female=starterEquipment('female');assert.equal(female.face,'face-smile');assert.equal(female.outfit,'outfit-cartographer');assert.equal(female.outfit,starterEquipment('male').outfit);assert.equal(female.hair,'hair-ponytail');assert.equal(female.hat,'hat-ruby');
 for(const gender of CHARACTER_GENDERS){
  assert.ok(SLOTS.every(slot=>canEquipItem(starterEquipment(gender)[slot],gender)));
  assert.ok(Object.values(unequipForGender(gender)).every(id=>canEquipItem(id,gender)));
  const first=starterEquipment(gender);first.weapon='volt';assert.equal(starterEquipment(gender).weapon,'ember');
 }
 assert.equal(unequipForGender('female').face,'face-smile');assert.equal(unequipForGender('female').outfit,'outfit-cartographer');assert.equal(unequipForGender('male').outfit,'outfit-cartographer');
});

test('legacy gender inference preserves property and resources while repairing only incompatible equipped slots',()=>{
 const raw={id:randomUUID(),name:'Legacy dancer',contentVersion:10,equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-dancer',face:'face-brave',hat:'hat-cap',hair:'hair-undercut'},inventory:['ember','outfit-dancer','face-brave','face-serene','hat-cap','hat-tropical','hair-undercut','hair-wavy','glasses-none','wristband-none','bracelet-none'],gold:137,xp:920,wins:2,matches:5,upgrades:{ember:9},stones:{'1':0,'2':3},compositionStones:{'attack-1':0},compositions:{ember:{attack:20}}};
 const p=normalizeProfile(raw);assert.equal(p.gender,'female');assert.equal(p.contentVersion,CONTENT_VERSION);
 assert.equal(p.equipment.outfit,'outfit-cartographer');assert.ok(!p.inventory.includes('outfit-dancer'),'the retired outfit becomes the Cartógrafo');assert.equal(p.equipment.face,'face-serene');assert.equal(p.equipment.hat,'hat-tropical');assert.equal(p.equipment.hair,'hair-wavy');
 assert.ok(raw.inventory.filter(id=>!isEmptyItem(id)).map(id=>RETIRED_OUTFIT_REPLACEMENTS[id]??id).every(id=>p.inventory.includes(id)),'existing opposite-gender ownership is retained');assert.ok(SLOTS.every(slot=>canEquipItem(p.equipment[slot],p.gender)));
 assert.equal(p.gold,137);assert.equal(p.xp,920);assert.equal(p.wins,2);assert.equal(p.matches,5);assert.equal(p.stones['1'],0);assert.equal(p.stones['2'],3);assert.equal(p.compositionStones['attack-1'],0);assert.equal(p.upgrades.ember,9);assert.equal(p.equipment.upgrade,9);assert.equal(p.compositions.ember.attack,20);
 assert.deepEqual(normalizeProfile(p),p);
});

test('explicit stored gender never follows incompatible equipment and sparse old profiles get only required compatible fallbacks',()=>{
 const explicit=normalizeProfile({id:randomUUID(),name:'Fixed gender',gender:'male',contentVersion:10,inventory:['ember','outfit-dancer','face-smile','hat-mage','hair-ponytail'],equipment:starterEquipment('female'),stones:{'1':0}});
 assert.equal(explicit.gender,'male');assert.ok(SLOTS.every(slot=>canEquipItem(explicit.equipment[slot],'male')));assert.equal(explicit.equipment.outfit,'outfit-cartographer');assert.equal(explicit.equipment.face,'face-brave');assert.equal(explicit.equipment.hair,'hair-none');
 for(const id of ['outfit-cartographer','face-smile','hat-mage','hair-ponytail'])assert.ok(explicit.inventory.includes(id));assert.ok(!explicit.inventory.includes('outfit-dancer'));
 assert.ok(!explicit.inventory.includes('hat-thunder')&&!explicit.inventory.includes('face-fierce'),'migration does not grant the whole compatible catalog');
 const female=normalizeProfile({id:randomUUID(),name:'Very old',equipment:{outfit:'outfit-dancer'},inventory:[],contentVersion:0});
 assert.equal(female.gender,'female');assert.ok(female.inventory.every(id=>canEquipItem(id,'female')),'old visual migrations never mass-grant opposite-gender items');
 assert.deepEqual(normalizeProfile(explicit),explicit);assert.deepEqual(normalizeProfile(female),female);
});

test('prototype retirement migration still replaces owned assets and compositions without losing opposite ownership',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Prototype veteran',contentVersion:9,gender:'male',inventory:['ember','outfit-surfer','face-brave','hat-knight','hair-silver','glasses-round'],equipment:{...DEFAULT_EQUIPMENT,hat:'hat-knight',hair:'hair-silver',glasses:'glasses-round'},compositions:{'hat-knight':{defense:20}},stones:{'1':0}});
 assert.equal(p.equipment.hat,'hat-tide');assert.equal(p.equipment.glasses,'glasses-sport');assert.notEqual(p.equipment.hair,'hair-ponytail');assert.ok(p.inventory.includes('hair-ponytail'));assert.equal(p.compositions['hat-tide'].defense,20);assert.equal(p.stones['1'],0);assert.deepEqual(normalizeProfile(p),p);
});

test('network schemas reject changing gender through equip, dyes, customization, purchases or invented commands',()=>{
 const items=Object.fromEntries(SLOTS.map(slot=>[slot,DEFAULT_EQUIPMENT[slot]]));
 for(const command of [{type:'gender',gender:'female'},{type:'set-gender',gender:'female'},{type:'equip',item:'ember',gender:'female'},{type:'recolor',item:'hat-cap',color:'#ffffff',gender:'female'},{type:'customize',gender:'female',selection:{items}},{type:'customize',selection:{items,gender:'female'}},{type:'shop-buy',items:['volt'],gender:'female'}])assert.equal(commandSchema.safeParse(command).success,false);
 for(const gender of CHARACTER_GENDERS)assert.equal(sessionRequestSchema.safeParse({gender}).success,true);
 for(const body of [{gender:'other'},{gender:null},{gender:1},{gender:'male',id:randomUUID()},['male']])assert.equal(sessionRequestSchema.safeParse(body).success,false);
});

async function database(gender:CharacterGender){
 const store=new Store();await store.pool.end();const equipment=starterEquipment(gender);
 const state={profile:normalizeProfile({id:randomUUID(),name:'Gender unit',gender,gold:500,equipment,inventory:[...new Set(SLOTS.map(slot=>equipment[slot]))],contentVersion:11}),queries:[] as string[],releases:0};
 let snapshot=structuredClone(state.profile);
 const client={async query(sql:string,values?:unknown[]){
  state.queries.push(sql);if(sql==='BEGIN')snapshot=structuredClone(state.profile);
  if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(state.profile),name:state.profile.name}],rowCount:1};
  if(sql.startsWith('UPDATE'))state.profile=structuredClone(values![1] as Profile);
  if(sql.startsWith('INSERT INTO players'))state.profile=structuredClone(values![2] as Profile);
  if(sql==='ROLLBACK')state.profile=structuredClone(snapshot);return {rows:[],rowCount:0};
 },release(){state.releases++;}};
 store.pool={async connect(){return client;}} as unknown as Store['pool'];return {store,state};
}

test('new guests persist their chosen gender and equal starting resources without receiving opposite equipment',async()=>{
 const profiles:Profile[]=[];
 for(const gender of CHARACTER_GENDERS){
  const {store,state}=await database(gender),{profile,token}=await store.createGuest(gender);profiles.push(profile);
  assert.equal(profile.gender,gender);assert.equal(profile.gold,500);assert.equal(token.length,64);assert.deepEqual(profile.equipment,normalizeProfile({...profile,equipment:starterEquipment(gender)}).equipment);assert.ok(profile.inventory.every(id=>canEquipItem(id,gender)));assert.deepEqual(state.profile,profile);assert.equal(state.queries.at(-1),'COMMIT');
  const before=structuredClone(state.profile),count=state.queries.length;await assert.rejects(store.createGuest('unisex' as CharacterGender),/masculino ou feminino/);assert.equal(state.queries.length,count);assert.deepEqual(state.profile,before);
 }
 assert.deepEqual(profiles[0].stones,profiles[1].stones);assert.deepEqual(profiles[0].compositionStones,profiles[1].compositionStones);assert.deepEqual(profiles[0].upgrades,profiles[1].upgrades);assert.equal(profiles[0].gold,profiles[1].gold);
});

test('owned opposite-gender face, hat and hair are rejected under the profile row lock with no partial equipment write',async()=>{
 for(const gender of CHARACTER_GENDERS){
  const {store,state}=await database(gender),other=starterEquipment(gender==='male'?'female':'male');
  assert.equal(other.outfit,state.profile.equipment.outfit,'the single outfit is shared by both genders');
  for(const slot of ['face','hat','hair'] as const)if(!state.profile.inventory.includes(other[slot]))state.profile.inventory.push(other[slot]);
  for(const slot of ['face','hat','hair'] as const){
   const before=structuredClone(state.profile),mark=state.queries.length;
   await assert.rejects(store.saveEquipment(before.id,{...before.equipment,[slot]:other[slot]}),/gênero/);
   assert.deepEqual(state.profile,before);assert.match(state.queries[mark+1],/FOR UPDATE$/);assert.equal(state.queries.at(-1),'ROLLBACK');assert.equal(state.queries.slice(mark).some(q=>q.startsWith('UPDATE')),false);
  }
  const before=structuredClone(state.profile);await assert.rejects(store.saveEquipment(before.id,{...before.equipment,glasses:'glasses-cat'}),/mochila/);assert.deepEqual(state.profile,before);
  const saved=await store.saveEquipment(before.id,{...before.equipment});assert.equal(saved.gender,gender);
 }
});

test('mixed shopping baskets reject incompatible items before spending or granting any item',async()=>{
 for(const gender of CHARACTER_GENDERS){
  const {store,state}=await database(gender),incompatible=gender==='male'?'face-wink':'face-taunt';
  const before=structuredClone(state.profile);await assert.rejects(store.buy(before.id,['volt',incompatible]),/gênero/);
  assert.deepEqual(state.profile,before);assert.equal(state.queries.some(q=>q.startsWith('UPDATE')),false);assert.equal(state.queries.at(-1),'ROLLBACK');
  const outcome=await store.buy(before.id,['glasses-sport','wristband-braid']);assert.equal(outcome.profile.gender,gender);assert.equal(outcome.result.spent,260);assert.equal(outcome.profile.gold,240);assert.ok(outcome.profile.inventory.includes('glasses-sport'));assert.deepEqual(outcome.profile.equipment,before.equipment);
 }
});

test('Cartógrafo da Aurora outfit is shared while its hair and glasses buy and equip only on a male character',async()=>{
 const ids=['outfit-cartographer','hair-horizon','glasses-navigator'];
 const male=await database('male');male.state.profile.gold=1000;
 const bought=await male.store.buy(male.state.profile.id,ids);
 assert.equal(bought.result.spent,680);
 assert.ok(ids.every(id=>bought.profile.inventory.includes(id)));
 const equipped=await male.store.saveEquipment(bought.profile.id,{...bought.profile.equipment,outfit:ids[0],hair:ids[1],glasses:ids[2]});
 assert.deepEqual(ids.map((_,index)=>equipped.equipment[['outfit','hair','glasses'][index] as 'outfit'|'hair'|'glasses']),ids);
 const female=await database('female');female.state.profile.gold=1000;
 const before=structuredClone(female.state.profile);
 await assert.rejects(female.store.buy(before.id,['glasses-sport',...ids]),/gênero/);
 assert.deepEqual(female.state.profile,before);
 assert.equal(before.equipment.outfit,'outfit-cartographer');
 const outfit=await female.store.buy(before.id,['outfit-cartographer']);assert.equal(outfit.result.spent,360);assert.ok(outfit.profile.inventory.includes('outfit-cartographer~2'));
});
