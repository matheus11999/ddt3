import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {Profile,ServerEvent} from '../shared/protocol';
import {commandSchema} from '../shared/protocol';
import {getMap,MAP_IDS} from '../shared/maps';
import {ground,solid,WORLD} from '../shared/physics';
import {initialSlots,modeForSlots,ROOM_MODES,teamSize} from '../shared/rooms';

function fixture(count=9){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store:ProfileStore={saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store),players=Array.from({length:count},(_,i)=>normalizeProfile({id:randomUUID(),name:`Room ${i}`}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 return {game,players,events,host:players[0],lastError:(id=players[0].id)=>events.get(id)!.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error').at(-1)?.message};
}

test('one through four paired slots start supported, mirrored combat spawns on every map',async()=>{
 for(const [size,mode] of ROOM_MODES.entries())for(const map of MAP_IDS){
  const {game,players,host}=fixture((size+1)*2);await game.command(host.id,{type:'create',practice:true,name:'Team sizes',mode,map});
  const roomId=game.peers.get(host.id)!.roomId!,room=game.rooms.get(roomId)!;assert.deepEqual(room.openSlots,initialSlots(mode));assert.equal(teamSize(mode),size+1);assert.equal(modeForSlots(size+1),mode);
  for(const player of players.slice(1)){await game.command(player.id,{type:'join',roomId});await game.command(player.id,{type:'ready'});}
  await game.command(host.id,{type:'start'});const match=game.matches.get(roomId)!;assert.ok(match);assert.equal(match.state.players.length,(size+1)*2);
  const positions=new Set<string>();
  for(const fighter of match.state.players){
   assert.equal(fighter.x,getMap(map).spawns[fighter.team][fighter.slot]);assert.equal(fighter.y,ground(match.terrain,fighter.x));assert.ok(fighter.y<WORLD.height);assert.ok(solid(match.terrain,fighter.x,fighter.y));
   positions.add(`${fighter.team}:${fighter.slot}`);assert.equal(fighter.x+getMap(map).spawns[fighter.team===0?1:0][fighter.slot],getMap(map).dimensions.width);
  }
  assert.equal(positions.size,(size+1)*2);
 }
});

test('non-contiguous slots preserve their physical index instead of compacting spawns',async()=>{
 const f=fixture(4);await f.game.command(f.host.id,{type:'create',practice:true,name:'Gap seats',mode:'1v1',map:'garden'});const roomId=f.game.peers.get(f.host.id)!.roomId!;
 await f.game.command(f.host.id,{type:'room-slot',slot:3,open:true});assert.deepEqual(f.game.rooms.get(roomId)!.openSlots,[0,3]);assert.equal(f.game.rooms.get(roomId)!.mode,'2v2');
 for(const player of f.players.slice(1)){await f.game.command(player.id,{type:'join',roomId});await f.game.command(player.id,{type:'ready'});}
 assert.deepEqual(f.game.rooms.get(roomId)!.players.map(player=>[player.team,player.slot]),[[0,0],[1,0],[0,3],[1,3]]);
 await f.game.command(f.host.id,{type:'start'});const fighters=f.game.matches.get(roomId)!.state.players;
 for(const fighter of fighters)assert.equal(fighter.x,getMap('garden').spawns[fighter.team][fighter.slot]);
 assert.ok(fighters.some(fighter=>fighter.team===0&&fighter.x===getMap('garden').spawns[0][3]));
});

test('only the waiting host can alter paired slots and occupied humans are preserved',async()=>{
 const f=fixture(4);await f.game.command(f.host.id,{type:'create',practice:true,name:'Permissions',mode:'2v2',map:'park'});const roomId=f.game.peers.get(f.host.id)!.roomId!,room=f.game.rooms.get(roomId)!;
 for(const player of f.players.slice(1)){await f.game.command(player.id,{type:'join',roomId});await f.game.command(player.id,{type:'ready'});}
 const before=structuredClone(room);
 await f.game.command(f.players[1].id,{type:'room-slot',slot:3,open:true});assert.match(f.lastError(f.players[1].id)!,/líder/);assert.deepEqual(room,before);
 await f.game.command(f.host.id,{type:'room-slot',slot:1,open:false});assert.match(f.lastError()!,/ocupado por um jogador/);assert.deepEqual(room,before);
 await f.game.command(f.host.id,{type:'room-slot',slot:0,open:false});assert.match(f.lastError()!,/primeiro espaço/);assert.deepEqual(room,before);
 for(const slot of [-1,0,4,1.5,NaN])assert.equal(commandSchema.safeParse({type:'room-slot',slot,open:false}).success,false);
 await f.game.command(f.host.id,{type:'start'});await f.game.command(f.host.id,{type:'room-slot',slot:3,open:true});assert.match(f.lastError()!,/entre as batalhas/);assert.deepEqual(room.openSlots,[0,1]);
});

test('capacity changes clear readiness, reject incomplete starts and remove only bots in closed slots',async()=>{
 const f=fixture(2);await f.game.command(f.host.id,{type:'create',practice:true,name:'Capacity',mode:'1v1',map:'celestial'});const roomId=f.game.peers.get(f.host.id)!.roomId!,room=f.game.rooms.get(roomId)!;
 await f.game.command(f.players[1].id,{type:'join',roomId});await f.game.command(f.players[1].id,{type:'ready'});assert.equal(room.players[1].ready,true);
 await f.game.command(f.host.id,{type:'room-slot',slot:2,open:true});assert.equal(room.players[1].ready,false);assert.deepEqual(room.openSlots,[0,2]);
 await f.game.command(f.host.id,{type:'start'});assert.equal(f.game.matches.size,0);assert.match(f.lastError()!,/precisa de 4 jogadores|Preencha/);
 await f.game.command(f.host.id,{type:'bot'});await f.game.command(f.host.id,{type:'bot'});assert.equal(room.players.filter(player=>player.bot&&player.slot===2).length,2);
 await f.game.command(f.host.id,{type:'room-slot',slot:2,open:false});assert.equal(room.players.length,2);assert.ok(room.players.every(player=>!player.bot&&player.slot===0));assert.deepEqual(room.openSlots,[0]);assert.equal(room.mode,'1v1');
 await f.game.command(f.host.id,{type:'room-slot',slot:3,open:true});assert.equal(room.players[1].ready,false);assert.deepEqual(room.openSlots,[0,3]);
});

test('kicking requires the waiting host and cannot target self, outsiders or unknown players',async()=>{
 const f=fixture(6);await f.game.command(f.host.id,{type:'create',practice:true,name:'Kick guards',mode:'2v2',map:'garden'});const roomId=f.game.peers.get(f.host.id)!.roomId!,room=f.game.rooms.get(roomId)!;
 for(const player of f.players.slice(1,3)){await f.game.command(player.id,{type:'join',roomId});await f.game.command(player.id,{type:'ready'});}
 await f.game.command(f.players[3].id,{type:'create',practice:true,name:'Another room',mode:'1v1',map:'park'});const otherId=f.game.peers.get(f.players[3].id)!.roomId!;
 await f.game.command(f.players[4].id,{type:'join',roomId:otherId});
 const before=structuredClone(room),otherBefore=structuredClone(f.game.rooms.get(otherId));
 for(const [sender,target,reason] of [[f.players[1].id,f.players[2].id,/líder/],[f.players[1].id,f.host.id,/líder/],[f.host.id,f.host.id,/Sair da sala/],[f.host.id,f.players[4].id,/nesta sala/],[f.host.id,randomUUID(),/nesta sala/],[f.players[5].id,f.players[2].id,/Entre em uma sala/]] as const){
  const count=f.events.get(sender)!.filter(event=>event.type==='error').length;
  await f.game.command(sender,{type:'kick',playerId:target});
  assert.equal(f.events.get(sender)!.filter(event=>event.type==='error').length,count+1);assert.match(f.lastError(sender)!,reason);
  assert.deepEqual(room,before);assert.deepEqual(f.game.rooms.get(otherId),otherBefore);
 }
 for(const playerId of ['',7,'x'.repeat(65)])assert.equal(commandSchema.safeParse({type:'kick',playerId}).success,false);
 assert.equal(commandSchema.safeParse({type:'kick',playerId:f.players[1].id,roomId}).success,false);
 await f.game.command(f.host.id,{type:'bot'});for(const player of f.players.slice(1,3))if(!room.players.find(seat=>seat.id===player.id)!.ready)await f.game.command(player.id,{type:'ready'});
 await f.game.command(f.host.id,{type:'start'});assert.equal(room.status,'playing');const playing=structuredClone(room);
 await f.game.command(f.host.id,{type:'kick',playerId:f.players[1].id});assert.match(f.lastError()!,/entre as batalhas/);assert.deepEqual(room,playing);
});

test('kick preserves open slots, resets readiness and returns the recipient to a reconnectable lobby',async()=>{
 const f=fixture(4);await f.game.command(f.host.id,{type:'create',practice:true,name:'Kick membership',mode:'1v1',map:'celestial'});const roomId=f.game.peers.get(f.host.id)!.roomId!,room=f.game.rooms.get(roomId)!;
 await f.game.command(f.host.id,{type:'room-slot',slot:3,open:true});
 for(const player of f.players.slice(1)){await f.game.command(player.id,{type:'join',roomId});await f.game.command(player.id,{type:'ready'});}
 const victim=f.players[3],mark=f.events.get(victim.id)!.length;
 await f.game.command(f.host.id,{type:'kick',playerId:victim.id});
 assert.equal(room.players.length,3);assert.deepEqual(room.openSlots,[0,3]);assert.equal(room.mode,'2v2');assert.ok(room.players.every(player=>!player.ready));
 assert.equal(f.game.peers.get(victim.id)!.roomId,null);assert.equal(f.game.peers.get(victim.id)!.connected,true);assert.equal(room.hostId,f.host.id);
 const received=f.events.get(victim.id)!.slice(mark);assert.ok(received.some(event=>event.type==='room'&&event.room===null));assert.ok(received.some(event=>event.type==='battle'&&event.battle===null));
 assert.ok(f.game.lobby(f.game.peers.get(victim.id)!.channel).some(player=>player.id===victim.id));
 f.game.disconnect(victim.id);const resumed:ServerEvent[]=[];f.game.connect(victim,event=>resumed.push(event));
 const welcome=resumed.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;assert.equal(welcome.room,null);assert.equal(welcome.battle,null);
 await f.game.command(f.host.id,{type:'chat',channel:'room',text:'Only current members'});assert.equal(resumed.some(event=>event.type==='chat'),false);
 await f.game.command(victim.id,{type:'join',roomId});assert.equal(room.players.find(seat=>seat.id===victim.id)!.slot,3);assert.equal(room.players.find(seat=>seat.id===victim.id)!.team,1);
 await f.game.command(victim.id,{type:'leave'});await f.game.command(f.players[1].id,{type:'ready'});await f.game.command(f.host.id,{type:'bot'});
 const bot=room.players.find(player=>player.bot)!;assert.ok(bot);await f.game.command(f.host.id,{type:'kick',playerId:bot.id});
 assert.equal(room.players.some(player=>player.id===bot.id),false);assert.equal(room.players.length,3);assert.ok(room.players.every(player=>!player.ready));assert.deepEqual(room.openSlots,[0,3]);
});
