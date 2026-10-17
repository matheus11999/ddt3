import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {Profile,ServerEvent} from '../shared/protocol';
import {commandSchema} from '../shared/protocol';

function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store),players=Array.from({length:5},(_,i)=>normalizeProfile({id:randomUUID(),name:`Party ${i}`}));
 for(const p of players){profiles.set(p.id,p);events.set(p.id,[]);game.connect(p,e=>events.get(p.id)!.push(structuredClone(e)));}
 const room=()=>game.rooms.get(game.peers.get(players[0].id)!.roomId!)!;
 const error=(index=0)=>events.get(players[index].id)!.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1)?.message;
 return {game,players,events,room,error};
}

test('room numbers are unique for the server session and survive rename and reconnect',async()=>{
 const f=fixture(),[host,other]=f.players;
 await f.game.command(host.id,{type:'create'});const first=f.room();
 await f.game.command(other.id,{type:'create'});const second=f.game.rooms.get(f.game.peers.get(other.id)!.roomId!)!;
 assert.ok(Number.isSafeInteger(first.number)&&first.number>0);assert.notEqual(first.number,second.number);
 const original=first.number;await f.game.command(host.id,{type:'room-rename',name:'Nova sala'});
 f.game.disconnect(host.id);const received:ServerEvent[]=[];f.game.connect(host,event=>received.push(structuredClone(event)));
 const welcome=received.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome');
 assert.equal(welcome?.room?.number,original);assert.equal(welcome?.room?.name,'Nova sala');
 await f.game.command(host.id,{type:'leave'});await f.game.command(host.id,{type:'create'});
 assert.ok(f.room().number>second.number);assert.notEqual(f.room().number,original);
});

test('new rooms start with one open seat; only host opens vacancies and all open seats must be ready humans for PvP',async()=>{
 const f=fixture(),[host,mate]=f.players;await f.game.command(host.id,{type:'create'});const room=f.room();assert.deepEqual(room.openSlots,[0]);assert.equal(room.mode,'1v1');assert.ok(room.name.length);
 await f.game.command(mate.id,{type:'join',roomId:room.id});assert.match(f.error(1)!,/cheia/);assert.equal(room.players.length,1);
 await f.game.command(host.id,{type:'room-slot',slot:3,open:true});assert.deepEqual(room.openSlots,[0,3]);assert.equal(room.mode,'2v2');
 await f.game.command(host.id,{type:'queue'});assert.equal(room.status,'waiting');assert.match(f.error()!,/vagas abertas/);
 await f.game.command(mate.id,{type:'join',roomId:room.id});assert.equal(room.players.find(player=>player.id===mate.id)!.slot,3);
 await f.game.command(mate.id,{type:'room-slot',slot:1,open:true});assert.match(f.error(1)!,/líder/);
 await f.game.command(host.id,{type:'room-slot',slot:3,open:false});assert.match(f.error()!,/ocupado/);assert.deepEqual(room.openSlots,[0,3]);
 await f.game.command(host.id,{type:'queue'});assert.equal(room.status,'waiting');await f.game.command(mate.id,{type:'ready'});await f.game.command(host.id,{type:'queue'});assert.equal(room.status,'searching');
 await f.game.command(host.id,{type:'room-slot',slot:2,open:true});assert.deepEqual(room.openSlots,[0,3]);assert.match(f.error()!,/entre as batalhas/);
});

test('in-room practice fills both teams with ephemeral bots and restores the same human party and slots',async()=>{
 for(let size=1;size<=4;size++){
  const f=fixture(),[host,mate]=f.players;await f.game.command(host.id,{type:'create'});const room=f.room(),id=room.id,number=room.number;
  for(let slot=1;slot<size;slot++)await f.game.command(host.id,{type:'room-slot',slot,open:true});
  if(size>1)await f.game.command(mate.id,{type:'join',roomId:id});
  const members=room.players.map(player=>player.id),slots=[...room.openSlots];
  if(size>1){await f.game.command(mate.id,{type:'practice-start'});assert.match(f.error(1)!,/líder/);assert.equal(f.game.matches.size,0);}
  await f.game.command(host.id,{type:'practice-start'});const match=[...f.game.matches.values()][0];assert.ok(match);assert.equal(match.state.players.length,size*2);assert.equal(match.state.players.filter(player=>player.team===0).length,size);assert.equal(match.state.players.filter(player=>player.team===1).length,size);
  assert.equal(match.state.players.filter(player=>player.bot).length,size*2-members.length);assert.deepEqual(room.players.map(player=>player.id),members);assert.equal(room.practice,false);assert.equal(room.id,id);assert.deepEqual(room.openSlots,slots);assert.ok(room.players.every(player=>!player.bot));
  for(const fighter of match.state.players.filter(player=>player.team===1))fighter.hp=0;await f.game.command(host.id,{type:'pass'});assert.equal(match.state.phase,'finished');
  f.game.tick(match.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));assert.equal(match.state.rewards!.saved,true);
  f.game.tick(match.state.rewards!.revealedAt!+2000);assert.equal(room.status,'waiting');assert.equal(room.id,id);assert.equal(room.number,number);assert.deepEqual(room.openSlots,slots);assert.deepEqual(room.players.map(player=>player.id),members);assert.equal(room.practice,false);assert.ok(room.players.every(player=>!player.bot&&!player.ready));
 }
});

test('practice cannot begin while queued, disconnected or already in battle',async()=>{
 const f=fixture(),[host,mate]=f.players;await f.game.command(host.id,{type:'create'});const room=f.room();await f.game.command(host.id,{type:'queue'});await f.game.command(host.id,{type:'practice-start'});assert.equal(f.game.matches.size,0);assert.equal(room.status,'searching');
 await f.game.command(host.id,{type:'cancel-queue'});await f.game.command(host.id,{type:'room-slot',slot:1,open:true});await f.game.command(mate.id,{type:'join',roomId:room.id});f.game.disconnect(mate.id);await f.game.command(host.id,{type:'practice-start'});assert.equal(f.game.matches.size,0);assert.match(f.error()!,/conectados/);
 f.game.connect(mate,e=>f.events.get(mate.id)!.push(structuredClone(e)));await f.game.command(host.id,{type:'practice-start'});const match=[...f.game.matches.values()][0];await f.game.command(host.id,{type:'practice-start'});assert.equal(f.game.matches.size,1);assert.equal([...f.game.matches.values()][0],match);
});

test('room renaming is trimmed, strict and restricted to the waiting host, with its name retained after battle',async()=>{
 const parsed=commandSchema.parse({type:'room-rename',name:'  Amigos da Brasa  '});assert.deepEqual(parsed,{type:'room-rename',name:'Amigos da Brasa'});
 for(const name of ['', ' ', 'a', 'x'.repeat(25),1,null])assert.equal(commandSchema.safeParse({type:'room-rename',name}).success,false);
 assert.equal(commandSchema.safeParse({type:'room-rename',name:'Sala',hostId:'spoof'}).success,false);
 const f=fixture(),[host,mate,outsider]=f.players;await f.game.command(host.id,{type:'create'});const room=f.room(),original=room.name;
 await f.game.command(outsider.id,parsed);assert.equal(room.name,original);
 await f.game.command(host.id,{type:'room-slot',slot:1,open:true});await f.game.command(mate.id,{type:'join',roomId:room.id});await f.game.command(mate.id,parsed);assert.equal(room.name,original);assert.match(f.error(1)!,/líder/);
 await f.game.command(host.id,parsed);assert.equal(room.name,'Amigos da Brasa');assert.ok(f.events.get(mate.id)!.some(event=>event.type==='room'&&event.room?.name==='Amigos da Brasa'));
 f.game.tick();assert.ok(f.events.get(outsider.id)!.some(event=>event.type==='rooms'&&event.rooms.some(value=>value.id===room.id&&value.name==='Amigos da Brasa')));
 await f.game.command(mate.id,{type:'ready'});await f.game.command(host.id,{type:'queue'});await f.game.command(host.id,{type:'room-rename',name:'Fila alterada'});assert.equal(room.name,'Amigos da Brasa');assert.match(f.error()!,/entre as batalhas/);
 await f.game.command(host.id,{type:'cancel-queue'});await f.game.command(host.id,{type:'practice-start'});await f.game.command(host.id,{type:'room-rename',name:'Combate alterado'});assert.equal(room.name,'Amigos da Brasa');assert.match(f.error()!,/entre as batalhas/);
 const match=[...f.game.matches.values()][0];for(const fighter of match.state.players.filter(player=>player.team===1))fighter.hp=0;await f.game.command(host.id,{type:'pass'});
 f.game.tick(match.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));f.game.tick(match.state.rewards!.revealedAt!+2000);
 assert.equal(room.status,'waiting');assert.equal(room.name,'Amigos da Brasa');await f.game.command(host.id,{type:'room-rename',name:'Nova rodada'});assert.equal(room.name,'Nova rodada');
});
