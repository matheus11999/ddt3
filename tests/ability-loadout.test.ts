import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile,Store} from '../server/store';
import {DEFAULT_ABILITY_LOADOUT,initialAbilities,normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityLoadout} from '../shared/abilities';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
async function fixture(){
 const store=new Store();await store.pool.end();const profile=normalizeProfile({id:randomUUID(),name:'Loadout owner',gold:731,level:18,wins:7,matches:21});
 const state={profile,queries:[] as string[],connections:0,releases:0,beforeCommit:null as null|(()=>Promise<void>)};let pending=structuredClone(profile);
 const connection={async query(sql:string,values?:unknown[]){state.queries.push(sql);if(sql==='BEGIN')pending=structuredClone(state.profile);if(sql.startsWith('SELECT'))return {rows:[{profile:structuredClone(pending),name:pending.name}],rowCount:1};if(sql.startsWith('UPDATE'))pending=structuredClone(values![1] as Profile);if(sql==='COMMIT'){await state.beforeCommit?.();state.profile=structuredClone(pending);}if(sql==='ROLLBACK')pending=structuredClone(state.profile);return {rows:[],rowCount:0};},release(){state.releases++;}};
 store.pool={async connect(){state.connections++;return connection;}} as unknown as Store['pool'];
 const game=new Game(store,()=>{}),events:ServerEvent[]=[],peer=game.connect(structuredClone(profile),event=>events.push(structuredClone(event)));
 const room=()=>game.rooms.get(peer.roomId!)!;const errors=()=>events.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error');
 return {store,state,game,events,peer,room,errors};
}

test('legacy loadouts gain defaults but empty, reordered and partially valid saved slots never refill',()=>{
 assert.deepEqual(normalizeAbilityLoadout(undefined),DEFAULT_ABILITY_LOADOUT);assert.deepEqual(normalizeAbilityLoadout(null),DEFAULT_ABILITY_LOADOUT);
 for(const slots of [[null,null,null],['invisibility',null,'heal'],[null,'homing',null]] as AbilityLoadout[]){assert.deepEqual(normalizeAbilityLoadout(slots),slots);const profile=normalizeProfile({id:'owner',name:'Kit',abilityLoadout:slots,gold:719});assert.deepEqual(profile.abilityLoadout,slots);assert.deepEqual(normalizeProfile(profile).abilityLoadout,slots);assert.equal(profile.gold,719);}
 assert.deepEqual(normalizeAbilityLoadout(['heal','heal','constructor']),['heal',null,null]);assert.deepEqual(normalizeAbilityLoadout([]),[null,null,null]);assert.deepEqual(normalizeAbilityLoadout(['invisibility']),['invisibility',null,null]);
 assert.deepEqual(initialAbilities([null,'homing',null]),{heal:0,homing:1,invisibility:0,rage:0,ice:0});const a=normalizeAbilityLoadout(undefined);a[0]=null;assert.deepEqual(normalizeAbilityLoadout(undefined),DEFAULT_ABILITY_LOADOUT);
});

test('loadout commands require exactly three unique known abilities or null and reject spoofed ownership/resources',()=>{
 const valid={type:'ability-loadout',slots:['invisibility',null,'heal'],requestId:'loadout-1'};assert.equal(commandSchema.safeParse(valid).success,true);assert.equal(commandSchema.safeParse({...valid,requestId:undefined}).success,true);
 for(const slots of [[],['heal'],['heal','homing','invisibility',null],['heal','heal',null],['constructor',null,null],['flight',null,null],[false,null,null],{0:'heal',1:null,2:null}])assert.equal(commandSchema.safeParse({...valid,slots}).success,false);
 for(const requestId of ['', 'x'.repeat(65),1,null])assert.equal(commandSchema.safeParse({...valid,requestId}).success,false);
 for(const key of ['playerId','uses','price','ready'])assert.equal(commandSchema.safeParse({...valid,[key]:999}).success,false);
});

test('loadout persistence locks the profile and preserves equipment, upgrades, inventory and currency',async()=>{
 const f=await fixture(),before=structuredClone(f.state.profile),slots:AbilityLoadout=['invisibility',null,'heal'];const result=await f.store.saveAbilityLoadout(before.id,slots);
 assert.deepEqual(result,{...before,abilityLoadout:slots});assert.deepEqual(f.state.profile,result);assert.match(f.state.queries[1],/FOR UPDATE$/);assert.equal(f.state.queries.at(-1),'COMMIT');assert.equal(f.state.releases,1);
 await f.store.saveAbilityLoadout(before.id,[null,null,null]);assert.deepEqual(normalizeProfile(f.state.profile).abilityLoadout,[null,null,null]);
 const connections=f.state.connections;for(const invalid of [['heal','heal',null],['spoof',null,null],[]])await assert.rejects(f.store.saveAbilityLoadout(before.id,invalid as AbilityLoadout),/três habilidades diferentes/);assert.equal(f.state.connections,connections);
});

test('room loadouts acknowledge only after commit and block readiness, equipment, queue and practice races',async()=>{
 const f=await fixture();await f.game.command(f.peer.profile.id,{type:'create'});const room=f.room();await f.game.command(f.peer.profile.id,{type:'ready'});assert.equal(room.players[0].ready,true);
 const before=structuredClone(f.state.profile),entered=deferred(),commit=deferred();f.state.beforeCommit=async()=>{entered.resolve();await commit.promise;};f.events.length=0;
 const saving=f.game.command(before.id,{type:'ability-loadout',slots:[null,'homing','heal'],requestId:'loadout-pending'});await entered.promise;
 assert.deepEqual(f.state.profile,before);assert.deepEqual(f.peer.profile,before);assert.deepEqual(room.players[0].abilityLoadout,before.abilityLoadout);assert.equal(room.players[0].ready,false);assert.equal(f.events.some(event=>event.type==='profile'),false);
 await f.game.command(before.id,{type:'queue'});await f.game.command(before.id,{type:'start'});await f.game.command(before.id,{type:'practice-start'});await f.game.command(before.id,{type:'ready'});await f.game.command(before.id,{type:'equip',item:'ember'});
 await f.game.command(before.id,{type:'ability-loadout',slots:['heal',null,null],requestId:'loadout-busy'});assert.equal(f.errors().at(-1)!.requestId,'loadout-busy');assert.equal(room.status,'waiting');assert.equal(f.game.matches.size,0);
 commit.resolve();await saving;assert.deepEqual(room.players[0].abilityLoadout,[null,'homing','heal']);assert.equal(room.players[0].ready,false);
 const ack=f.events.filter((event):event is Extract<ServerEvent,{type:'profile'}>=>event.type==='profile');assert.equal(ack.length,1);assert.equal(ack[0].requestId,'loadout-pending');assert.deepEqual(ack[0].profile,f.state.profile);assert.equal(f.state.queries.at(-1),'COMMIT');
 await f.game.command(before.id,{type:'queue'});assert.equal(room.status,'searching');
});

test('save failures roll back slots, release the lock and echo the failed request without acknowledging success',async()=>{
 const f=await fixture();await f.game.command(f.peer.profile.id,{type:'create'});const before=structuredClone(f.state.profile);f.events.length=0;
 f.state.beforeCommit=async()=>{throw Error('Commit failed');};await f.game.command(before.id,{type:'ability-loadout',slots:[null,null,null],requestId:'loadout-failed'});
 assert.deepEqual(f.state.profile,before);assert.deepEqual(f.peer.profile,before);assert.deepEqual(f.room().players[0].abilityLoadout,before.abilityLoadout);assert.equal(f.state.queries.at(-1),'ROLLBACK');assert.equal(f.state.releases,1);assert.deepEqual(f.errors(),[{type:'error',message:'Commit failed',requestId:'loadout-failed'}]);assert.equal(f.events.some(event=>event.type==='profile'),false);
 f.state.beforeCommit=null;await f.game.command(before.id,{type:'ability-loadout',slots:['heal',null,null],requestId:'loadout-retry'});assert.deepEqual(f.peer.profile.abilityLoadout,['heal',null,null]);assert.ok(f.events.some(event=>event.type==='profile'&&event.requestId==='loadout-retry'));
});

test('loadout changes are restricted to waiting room members and preserve correlation for every guard',async()=>{
 const f=await fixture(),id=f.peer.profile.id,select=(requestId:string)=>f.game.command(id,{type:'ability-loadout',slots:[null,null,null],requestId});
 await select('outside');assert.match(f.errors().at(-1)!.message,/sala/);assert.equal(f.errors().at(-1)!.requestId,'outside');assert.equal(f.state.connections,0);
 await f.game.command(id,{type:'create'});await f.game.command(id,{type:'queue'});await select('queued');assert.match(f.errors().at(-1)!.message,/aguarda/);assert.equal(f.errors().at(-1)!.requestId,'queued');assert.equal(f.room().status,'searching');assert.equal(f.state.connections,0);
 await f.game.command(id,{type:'cancel-queue'});await f.game.command(id,{type:'practice-start'});await select('battle');assert.match(f.errors().at(-1)!.message,/aguarda/);assert.equal(f.errors().at(-1)!.requestId,'battle');assert.equal(f.state.connections,0);
});

test('battle inherits the ordered selection and only selected abilities get uses; bots retain their default kit',async()=>{
 for(const slots of [[null,'invisibility',null],[null,null,null],['homing',null,'heal']] as AbilityLoadout[]){
  const f=await fixture(),id=f.peer.profile.id;await f.game.command(id,{type:'create'});await f.game.command(id,{type:'ability-loadout',slots,requestId:'loadout-match'});await f.game.command(id,{type:'practice-start'});
  const m=[...f.game.matches.values()][0],self=m.state.players.find(player=>player.id===id)!,bot=m.state.players.find(player=>player.bot)!;assert.deepEqual(self.abilityLoadout,slots);assert.deepEqual(self.abilities,initialAbilities(slots));assert.deepEqual(bot.abilityLoadout,DEFAULT_ABILITY_LOADOUT);assert.deepEqual(bot.abilities,initialAbilities());
  for(const ability of DEFAULT_ABILITY_LOADOUT)if(!slots.includes(ability)){const before=structuredClone(self);await f.game.command(id,{type:'ability',ability});assert.match(f.errors().at(-1)!.message,/não está equipada/);assert.deepEqual(self,before);}
  await f.game.command(id,{type:'flight',active:true});assert.equal(self.flightArmed,true);await f.game.command(id,{type:'flight',active:false});assert.deepEqual(self.abilityLoadout,slots);
 }
});

test('reconnecting and changing rooms during persistence updates the current seat before a match can start',async()=>{
 for(const nextRoom of ['create','join'] as const){
  const f=await fixture(),id=f.peer.profile.id,stale=structuredClone(f.peer.profile),entered=deferred(),commit=deferred();
  const other=f.game.connect(normalizeProfile({id:randomUUID(),name:'Next room host'}),()=>{});
  await f.game.command(other.profile.id,{type:'create'});await f.game.command(other.profile.id,{type:'room-slot',slot:1,open:true});
  await f.game.command(id,{type:'create'});const originalRoom=f.room();
  f.state.beforeCommit=async()=>{entered.resolve();await commit.promise;};
  const saving=f.game.command(id,{type:'ability-loadout',slots:[null,'homing',null],requestId:`switch-${nextRoom}`});await entered.promise;
  f.game.connect(stale,event=>f.events.push(structuredClone(event)));await f.game.command(id,{type:'leave'});
  await f.game.command(id,nextRoom==='create'?{type:'create'}:{type:'join',roomId:other.roomId!});const currentRoom=f.room();
  await f.game.command(currentRoom.hostId,{type:'practice-start'});assert.equal(f.game.matches.size,0);assert.equal(currentRoom.status,'waiting');
  commit.resolve();await saving;
  assert.equal(f.game.rooms.has(originalRoom.id),false);assert.deepEqual(f.peer.profile.abilityLoadout,[null,'homing',null]);
  assert.deepEqual(currentRoom.players.find(player=>player.id===id)!.abilityLoadout,[null,'homing',null]);assert.ok(currentRoom.players.every(player=>!player.ready));
  await f.game.command(currentRoom.hostId,{type:'practice-start'});const fighter=[...f.game.matches.values()][0].state.players.find(player=>player.id===id)!;
  assert.deepEqual(fighter.abilityLoadout,[null,'homing',null]);assert.deepEqual(fighter.abilities,{heal:0,homing:1,invisibility:0,rage:0,ice:0});
 }
});

test('a delayed session snapshot cannot replace the committed profile or reconnect welcome',async()=>{
 const f=await fixture(),id=f.peer.profile.id,stale=structuredClone(f.peer.profile);await f.game.command(id,{type:'create'});
 await f.game.command(id,{type:'ability-loadout',slots:[null,null,'heal'],requestId:'committed-before-reconnect'});
 const confirmed=structuredClone(f.peer.profile),reconnected:ServerEvent[]=[];f.game.disconnect(id);
 assert.equal(f.game.connect(stale,event=>reconnected.push(structuredClone(event))),f.peer);
 assert.deepEqual(f.peer.profile,confirmed);assert.deepEqual(f.state.profile,confirmed);
 const welcome=reconnected.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;
 assert.deepEqual(welcome.profile,confirmed);assert.deepEqual(welcome.room!.players[0].abilityLoadout,[null,null,'heal']);
});

test('disconnect expiry retains a peer while its profile commit is pending and releases it afterward',async()=>{
 const f=await fixture(),id=f.peer.profile.id,entered=deferred(),commit=deferred();await f.game.command(id,{type:'create'});
 f.state.beforeCommit=async()=>{entered.resolve();await commit.promise;};
 const saving=f.game.command(id,{type:'ability-loadout',slots:[null,null,null],requestId:'slow-commit'});await entered.promise;
 f.game.disconnect(id);const expiresAt=f.peer.lastSeen+31000;f.game.tick(expiresAt);
 assert.equal(f.game.peers.get(id),f.peer);assert.ok(f.game.rooms.has(f.peer.roomId!));
 const reconnected:ServerEvent[]=[];f.game.connect(structuredClone(f.state.profile),event=>reconnected.push(structuredClone(event)));
 commit.resolve();await saving;assert.deepEqual(f.room().players[0].abilityLoadout,[null,null,null]);
 assert.ok(reconnected.some(event=>event.type==='profile'&&event.requestId==='slow-commit'&&event.profile.abilityLoadout?.every(slot=>slot===null)));
 f.game.disconnect(id);f.game.tick(f.peer.lastSeen+31000);assert.equal(f.game.peers.has(id),false);
});
