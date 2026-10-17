import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {Command,Profile,ServerEvent} from '../shared/protocol';

type EventOf<T extends ServerEvent['type']>=Extract<ServerEvent,{type:T}>;
function fixture(count=9){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),game=new Game({getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore);
 const players=Array.from({length:count},(_,index)=>normalizeProfile({id:randomUUID(),name:`Convite ${index}`}));
 const connect=(index:number)=>{const profile=players[index];profiles.set(profile.id,profile);if(!events.has(profile.id))events.set(profile.id,[]);game.connect(profile,event=>events.get(profile.id)!.push(structuredClone(event)));};players.forEach((_,index)=>connect(index));
 const received=<T extends ServerEvent['type']>(index:number,type:T)=>events.get(players[index].id)!.filter((event):event is EventOf<T>=>event.type===type);
 const last=<T extends ServerEvent['type']>(index:number,type:T)=>received(index,type).at(-1)!;
 const send=(index:number,command:Command)=>game.command(players[index].id,command);
 const room=(index=0)=>game.rooms.get(game.peers.get(players[index].id)!.roomId!)!;
 const create=async(index=0)=>{await send(index,{type:'create'});await send(index,{type:'room-slot',slot:1,open:true});return room(index);};
 const invite=async(from:number,to:number)=>{await send(from,{type:'room-invite',playerId:players[to].id});return last(to,'room-invitation').invite;};
 return {game,players,events,connect,received,last,send,room,create,invite};
}

test('online invite commands are strict and accept only server-generated UUID identities and boolean answers',()=>{
 const playerId=randomUUID(),inviteId=randomUUID();
 for(const command of [{type:'room-invite-list'},{type:'room-invite',playerId},{type:'room-invite-answer',inviteId,accept:true},{type:'room-invite-answer',inviteId,accept:false}])assert.equal(commandSchema.safeParse(command).success,true);
 for(const command of [{type:'room-invite-list',roomId:randomUUID()},{type:'room-invite',playerId,fromId:randomUUID()},{type:'room-invite',playerId:'bot-123'},{type:'room-invite',playerId:''},{type:'room-invite-answer',inviteId,accept:1},{type:'room-invite-answer',inviteId,accept:'true'},{type:'room-invite-answer',inviteId:'spoof',accept:true},{type:'room-invite-answer',inviteId,accept:true,playerId}])assert.equal(commandSchema.safeParse(command).success,false);
});

test('only a waiting leader with an open vacancy can list or invite; lists expose connected free humans only',async()=>{
 const f=fixture(),room=await f.create();
 await f.send(1,{type:'arena-presence',open:true});f.game.peers.get(f.players[1].id)!.channel=2;
 await f.send(2,{type:'create'});f.game.disconnect(f.players[3].id);
 await f.send(4,{type:'join',roomId:room.id});
 await f.send(0,{type:'room-invite-list'});assert.match(f.last(0,'error').message,/cheia/);
 await f.send(0,{type:'room-slot',slot:2,open:true});await f.send(0,{type:'room-invite-list'});
 const list=f.last(0,'room-invite-list');assert.equal(list.roomId,room.id);
 assert.deepEqual(list.players.map(player=>player.id).sort(),[1,5,6,7,8].map(index=>f.players[index].id).sort());
 assert.ok(list.players.every(player=>Object.keys(player).sort().join(',')==='id,level,name'));
 await f.send(0,{type:'room-invite-list'});assert.match(f.last(0,'error').message,/instante/);
 await f.send(4,{type:'room-invite-list'});assert.match(f.last(4,'error').message,/líder/);
 await f.send(4,{type:'room-invite',playerId:f.players[1].id});assert.match(f.last(4,'error').message,/líder/);
 await f.send(5,{type:'room-invite-list'});assert.match(f.last(5,'error').message,/sala primeiro/);
 for(const playerId of [f.players[0].id,f.players[2].id,f.players[3].id,'bot-missing',randomUUID()]){await f.send(0,{type:'room-invite',playerId});assert.ok(f.last(0,'error'));}
 assert.equal(f.received(1,'room-invitation').length,0);
 await f.send(0,{type:'practice-start'});await f.send(0,{type:'room-invite-list'});assert.match(f.last(0,'error').message,/aguarda/);
 await f.send(0,{type:'room-invite',playerId:f.players[1].id});assert.match(f.last(0,'error').message,/aguarda/);
});

test('invitation acceptance is targeted, single-use, publishes both results and preserves profiles and the room',async t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);const f=fixture(),room=await f.create(),profiles=structuredClone(f.players),invite=await f.invite(0,1);
 assert.equal(invite.roomId,room.id);assert.equal(invite.roomNumber,room.number);assert.equal(invite.roomName,room.name);assert.equal(invite.fromId,f.players[0].id);assert.equal(invite.expiresAt,now+60000);
 assert.equal(f.last(0,'room-invite-result').status,'sent');assert.equal(f.game.peers.get(f.players[1].id)!.roomId,null);assert.equal(room.players.length,1,'an invitation does not reserve a slot');
 await f.send(2,{type:'room-invite-answer',inviteId:invite.id,accept:true});assert.match(f.last(2,'error').message,/inválido/);assert.equal(room.players.length,1);
 await f.send(1,{type:'room-invite-answer',inviteId:invite.id,accept:true});assert.equal(f.game.peers.get(f.players[1].id)!.roomId,room.id);assert.equal(room.players.length,2);assert.equal(room.players[1].slot,1);
 for(const index of [0,1]){const result=f.last(index,'room-invite-result');assert.equal(result.status,'accepted');assert.equal(result.inviteId,invite.id);assert.equal(result.playerId,f.players[1].id);}
 await f.send(1,{type:'room-invite-answer',inviteId:invite.id,accept:true});assert.match(f.last(1,'error').message,/encerrado/);assert.equal(room.players.length,2);
 assert.equal(f.received(2,'room-invitation').length,0);assert.equal(f.received(2,'room-invite-result').length,0);assert.deepEqual(f.players,profiles);
 now+=100;f.connect(1);assert.equal(f.last(1,'welcome').room?.id,room.id);assert.equal(f.last(1,'welcome').room?.number,room.number);assert.deepEqual(f.last(1,'welcome').profile,profiles[1]);
});

test('declining retains lobby state; resend cooldowns and pending limits prevent invitation spam',async t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);const f=fixture();await f.create();
 const first=await f.invite(0,1);await f.send(0,{type:'room-invite',playerId:f.players[1].id});assert.match(f.last(0,'error').message,/já enviou/);
 await f.send(0,{type:'room-invite',playerId:f.players[2].id});assert.match(f.last(0,'error').message,/2 segundos/);
 await f.send(1,{type:'room-invite-answer',inviteId:first.id,accept:false});assert.equal(f.last(0,'room-invite-result').status,'declined');assert.equal(f.game.peers.get(f.players[1].id)!.roomId,null);
 now+=2001;await f.send(0,{type:'room-invite',playerId:f.players[1].id});assert.match(f.last(0,'error').message,/30 segundos/);
 for(const index of [2,3,4]){await f.invite(0,index);now+=2001;}
 await f.send(0,{type:'room-invite',playerId:f.players[5].id});assert.match(f.last(0,'error').message,/resposta/);assert.equal(f.received(5,'room-invitation').length,0);
 now=f.last(4,'room-invitation').invite.expiresAt+1;f.game.tick(now);assert.equal(f.last(2,'room-invite-result').status,'expired');
 await f.invite(0,1);assert.equal(f.received(1,'room-invitation').length,2,'TTL and pair cooldown release their bounded entries');
});

test('a recipient has at most five pending invitations from independent leaders',async()=>{
 const f=fixture(8);for(let index=0;index<6;index++)await f.create(index);
 for(let index=0;index<5;index++)await f.invite(index,7);
 await f.send(5,{type:'room-invite',playerId:f.players[7].id});assert.match(f.last(5,'error').message,/outros convites/);assert.equal(f.received(7,'room-invitation').length,5);
});

test('competing acceptances cannot overbook and closed slots, occupied targets and changed leaders invalidate without moving anyone',async t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);
 {
  const f=fixture(),room=await f.create(),a=await f.invite(0,1);now+=2001;const b=await f.invite(0,2);
  await Promise.all([f.send(1,{type:'room-invite-answer',inviteId:a.id,accept:true}),f.send(2,{type:'room-invite-answer',inviteId:b.id,accept:true})]);
  assert.equal(room.players.length,2);assert.equal(new Set(room.players.map(player=>player.slot)).size,2);assert.equal(f.game.peers.get(f.players[2].id)!.roomId,null);assert.equal(f.last(2,'room-invite-result').status,'unavailable');
 }
 for(const reason of ['closed','joined','host-left','host-changed','playing','full'] as const){
  const f=fixture(),room=await f.create();
  if(reason==='host-changed'){await f.send(0,{type:'room-slot',slot:2,open:true});await f.send(2,{type:'join',roomId:room.id});}
  const invite=await f.invite(0,1);
  if(reason==='closed')await f.send(0,{type:'room-slot',slot:1,open:false});
  if(reason==='joined')await f.send(1,{type:'create'});
  if(reason==='host-left'||reason==='host-changed')await f.send(0,{type:'leave'});
  if(reason==='playing')await f.send(0,{type:'practice-start'});
  if(reason==='full')await f.send(2,{type:'join',roomId:room.id});
  const before=f.game.peers.get(f.players[1].id)!.roomId;
  assert.equal(f.last(1,'room-invite-result').status,'unavailable',reason);
  await f.send(1,{type:'room-invite-answer',inviteId:invite.id,accept:true});assert.equal(f.game.peers.get(f.players[1].id)!.roomId,before,reason);assert.ok(!room.players.some(player=>player.id===f.players[1].id),reason);
 }
});

test('expiration is checked at answer and tick; disconnect invalidates while replacement sockets replay only valid invitations',async t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);
 {
  const f=fixture();await f.create();const invite=await f.invite(0,1);now=invite.expiresAt;await f.send(1,{type:'room-invite-answer',inviteId:invite.id,accept:true});assert.equal(f.last(1,'room-invite-result').status,'expired');assert.equal(f.room().players.length,1);
 }
 for(const disconnected of [0,1]){
  const f=fixture();await f.create();await f.invite(0,1);f.connect(1);assert.equal(f.received(1,'room-invitation').length,2,'replacing an active socket replays the same invitation');
  f.game.disconnect(f.players[disconnected].id);assert.equal(f.last(disconnected===0?1:0,'room-invite-result').status,'unavailable');f.connect(disconnected);
  assert.equal(f.received(1,'room-invitation').length,2,'a disconnected invitation never resurrects');
 }
});

test('queue timestamps use the server clock, survive active socket replacement and clear on cancellation, disconnect and match start',async t=>{
 let now=100000;t.mock.method(Date,'now',()=>now);const f=fixture();await f.send(0,{type:'create'});const room=f.room();assert.equal(room.searchStartedAt,undefined);
 await f.send(0,{type:'queue'});assert.equal(room.searchStartedAt,now);
 await f.send(0,{type:'room-invite-list'});assert.match(f.last(0,'error').message,/aguarda/);await f.send(0,{type:'room-invite',playerId:f.players[1].id});assert.match(f.last(0,'error').message,/aguarda/);
 now+=1600;f.connect(0);assert.equal(f.last(0,'welcome').room?.searchStartedAt,100000);
 await f.send(0,{type:'cancel-queue'});assert.equal(room.searchStartedAt,undefined);await f.send(0,{type:'queue'});assert.equal(room.searchStartedAt,now);
 await f.send(0,{type:'ready'});assert.equal(room.status,'waiting');assert.equal(room.searchStartedAt,undefined);
 await f.send(0,{type:'queue'});f.game.disconnect(f.players[0].id);assert.equal(room.status,'waiting');assert.equal(room.searchStartedAt,undefined);f.connect(0);
 await f.send(1,{type:'create'});await f.send(0,{type:'queue'});now+=1200;await f.send(1,{type:'queue'});assert.equal(room.status,'playing');assert.equal(f.room(1).status,'playing');assert.equal(room.searchStartedAt,undefined);assert.equal(f.room(1).searchStartedAt,undefined);
 const match=[...f.game.matches.values()][0],active=match.state.players.find(player=>player.id===match.state.turnId)!;for(const fighter of match.state.players)if(fighter.team!==active.team)fighter.hp=0;await f.game.command(active.id,{type:'pass'});f.game.tick(match.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));f.game.tick(match.state.rewards!.revealedAt!+2000);
 assert.equal(room.status,'waiting');assert.equal(room.searchStartedAt,undefined);assert.equal(f.room(1).searchStartedAt,undefined);
});
