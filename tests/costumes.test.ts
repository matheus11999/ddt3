import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {attributes,canEquipItem,CATALOG,CONTENT_VERSION,DEFAULT_EQUIPMENT,isEmptyItem,itemAttributes,itemGender,normalizeVisibility,SLOTS,STARTER_COSTUMES,starterEquipment} from '../shared/catalog';
import type {CharacterGender,Equipment} from '../shared/catalog';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';
import {normalizeProfile,Store} from '../server/store';
import {Game} from '../server/game';

test('both full-body costumes are unisex cosmetics with no combat attribute bonus',()=>{
 for(const id of STARTER_COSTUMES){
  assert.equal(CATALOG[id].slot,'costume');assert.equal(itemGender(id),'unisex');assert.equal(isEmptyItem(id),false);
  assert.deepEqual(itemAttributes(CATALOG[id]),{attack:0,defense:0,agility:0,luck:0,damage:0,armor:0});
  for(const gender of ['male','female'] as const){assert.ok(canEquipItem(id,gender));assert.deepEqual(attributes({...starterEquipment(gender),costume:id}),attributes(starterEquipment(gender)));}
 }
 assert.ok(isEmptyItem('costume-none'));assert.equal(isEmptyItem('missing-none'),false);
});

test('migration grants two costumes exactly once, removes internal empty sentinels and preserves every real possession/resource',()=>{
 const raw={id:randomUUID(),name:'Costume legacy',gender:'male' as const,contentVersion:11,equipment:DEFAULT_EQUIPMENT,inventory:['ember','hat-cap','face-brave','outfit-cartographer','hair-undercut','glasses-none','wristband-none','bracelet-none','costume-none','hat-none','hair-none','face-smile'],gold:777,upgrades:{ember:10},stones:{'1':0,'5':7},compositionStones:{'attack-1':0},compositions:{ember:{attack:10}}};
 const p=normalizeProfile(raw);assert.equal(p.contentVersion,CONTENT_VERSION);assert.equal(p.equipment.costume,'costume-none');
 for(const id of STARTER_COSTUMES)assert.equal(p.inventory.filter(item=>item===id).length,1);
 assert.ok(p.inventory.every(id=>!isEmptyItem(id)));assert.ok(raw.inventory.filter(id=>!isEmptyItem(id)).every(id=>p.inventory.includes(id)));
 assert.equal(p.gold,777);assert.equal(p.stones['1'],0);assert.equal(p.stones['5'],7);assert.equal(p.compositionStones['attack-1'],0);assert.equal(p.upgrades.ember,10);assert.equal(p.compositions.ember.attack,10);assert.deepEqual(normalizeProfile(p),p);
 const removed=normalizeProfile({...p,inventory:p.inventory.filter(id=>id!==STARTER_COSTUMES[0])});assert.equal(removed.inventory.includes(STARTER_COSTUMES[0]),false,'current-version migration cannot replenish absent costumes');
});

test('visibility defaults true and only accepts explicit boolean flags for supported slots',()=>{
 assert.deepEqual(normalizeVisibility(undefined),{hat:true,glasses:true,costume:true});assert.deepEqual(normalizeVisibility({hat:false}),{hat:false,glasses:true,costume:true});assert.deepEqual(normalizeVisibility({hat:false,glasses:false,costume:false}),{hat:false,glasses:false,costume:false});
 const items=Object.fromEntries(SLOTS.map(slot=>[slot,DEFAULT_EQUIPMENT[slot]]));
 for(const visibility of [{hat:'false'},{costume:0},{glasses:null},{hair:false}])assert.equal(commandSchema.safeParse({type:'customize',selection:{items,visibility}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,visibility:{hat:false,glasses:true,costume:false}}}).success,true);
 assert.deepEqual(attributes({...DEFAULT_EQUIPMENT,visibility:{hat:false,glasses:false,costume:false}}),attributes(DEFAULT_EQUIPMENT));
});

async function database(gender:CharacterGender='male'){
 const store=new Store();await store.pool.end();const equipment=starterEquipment(gender);
 const state={profile:normalizeProfile({id:randomUUID(),name:'Costume unit',gender,gold:500,equipment,inventory:[...new Set([...SLOTS.map(slot=>equipment[slot]),...STARTER_COSTUMES])],contentVersion:CONTENT_VERSION}),queries:[] as string[],failWrite:false};
 let snapshot=structuredClone(state.profile);
 const client={async query(sql:string,values?:unknown[]){
  state.queries.push(sql);if(sql==='BEGIN')snapshot=structuredClone(state.profile);
  if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(state.profile),name:state.profile.name}],rowCount:1};
  if(sql.startsWith('UPDATE')){if(state.failWrite)throw Error('Write failed');state.profile=structuredClone(values![1] as Profile);}
  if(sql==='ROLLBACK')state.profile=structuredClone(snapshot);return {rows:[],rowCount:0};
 },release(){}};
 store.pool={async connect(){return client;}} as unknown as Store['pool'];return {store,state};
}

test('costume and hidden flags save atomically for both genders; internal empty sentinels need no inventory entry',async()=>{
 for(const gender of ['male','female'] as const){
  const {store,state}=await database(gender),before=structuredClone(state.profile),stats=attributes(before.equipment);
  for(const costume of STARTER_COSTUMES){
   const saved=await store.saveEquipment(before.id,{...before.equipment,costume,visibility:{hat:false,glasses:false,costume:true}});
   assert.equal(saved.gender,gender);assert.equal(saved.equipment.costume,costume);assert.deepEqual(saved.equipment.visibility,{hat:false,glasses:false,costume:true});assert.deepEqual(saved.inventory,before.inventory);assert.deepEqual(attributes(saved.equipment),stats);
  }
  const cleared=await store.saveEquipment(before.id,{...state.profile.equipment,hat:'hat-none',glasses:'glasses-none',costume:'costume-none',visibility:{costume:false}});
  assert.equal(cleared.equipment.costume,'costume-none');assert.equal(cleared.equipment.hat,'hat-none');assert.ok(cleared.inventory.every(id=>!isEmptyItem(id)));assert.deepEqual(cleared.equipment.visibility,{hat:true,glasses:true,costume:false});
 }
});

test('hidden equipment still requires ownership and gender; failed persistence never partially saves a costume or flags',async()=>{
 const {store,state}=await database();state.profile.inventory=state.profile.inventory.filter(id=>id!==STARTER_COSTUMES[1]);state.profile.inventory.push('hat-ruby');const before=structuredClone(state.profile);
 await assert.rejects(store.saveEquipment(before.id,{...before.equipment,costume:STARTER_COSTUMES[1],visibility:{costume:false}}),/mochila/);
 await assert.rejects(store.saveEquipment(before.id,{...before.equipment,hat:'hat-ruby',visibility:{hat:false}}),/gênero/);
 await assert.rejects(store.saveEquipment(before.id,{...before.equipment,hat:'costume-none'}),/mochila/);
 await assert.rejects(store.saveEquipment(before.id,{...before.equipment,visibility:{costume:'false'}} as unknown as Equipment),/visual inválidas/);
 assert.deepEqual(state.profile,before);state.failWrite=true;
 await assert.rejects(store.saveEquipment(before.id,{...before.equipment,costume:STARTER_COSTUMES[0],visibility:{hat:false,glasses:false,costume:true}}),/Write failed/);assert.deepEqual(state.profile,before);assert.equal(state.queries.at(-1),'ROLLBACK');
});

test('customization publishes costume visibility, cancels queued matchmaking and is frozen throughout combat',async()=>{
 const {store,state}=await database(),game=new Game(store),owner=state.profile,observer=normalizeProfile({id:randomUUID(),name:'Observer'}),ownerEvents:ServerEvent[]=[],otherEvents:ServerEvent[]=[];
 game.connect(owner,event=>ownerEvents.push(structuredClone(event)));game.connect(observer,event=>otherEvents.push(structuredClone(event)));
 const items={...Object.fromEntries(SLOTS.map(slot=>[slot,owner.equipment[slot]])),costume:STARTER_COSTUMES[0]} as Record<typeof SLOTS[number],string>;
 await game.command(owner.id,{type:'customize',selection:{items,visibility:{hat:false,costume:true}}});
 const lobby=otherEvents.filter((event):event is Extract<ServerEvent,{type:'lobby'}>=>event.type==='lobby').at(-1)!;
 assert.equal(lobby.players.find(p=>p.id===owner.id)!.equipment.costume,STARTER_COSTUMES[0]);assert.equal(lobby.players.find(p=>p.id===owner.id)!.equipment.visibility?.hat,false);
 await game.command(owner.id,{type:'create',name:'Visibility queue'});const room=game.rooms.get(game.peers.get(owner.id)!.roomId!)!;await game.command(owner.id,{type:'queue'});assert.equal(room.status,'searching');
 await game.command(owner.id,{type:'customize',selection:{items,visibility:{costume:false}}});assert.equal(room.status,'waiting');assert.equal(room.players[0].equipment.visibility?.costume,false);
 await game.command(owner.id,{type:'leave'});await game.command(owner.id,{type:'create',practice:true,name:'Costume practice'});await game.command(owner.id,{type:'bot'});await game.command(owner.id,{type:'start'});
 const match=[...game.matches.values()][0],fighter=match.state.players.find(p=>p.id===owner.id)!;assert.equal(fighter.equipment.costume,STARTER_COSTUMES[0]);assert.equal(fighter.equipment.visibility?.costume,false);
 const before=structuredClone(state.profile),battle=structuredClone(fighter.equipment);
 await game.command(owner.id,{type:'customize',selection:{items,visibility:{costume:true}}});assert.deepEqual(state.profile,before);assert.deepEqual(fighter.equipment,battle);assert.ok(ownerEvents.some(e=>e.type==='error'&&/entre as batalhas/.test(e.message)));
});
