import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {Profile,Room,ServerEvent} from '../shared/protocol';
import {arenaMatchTime,arenaRooms} from '../src/arenaHall';

function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store);
 const players=Array.from({length:5},(_,i)=>normalizeProfile({id:randomUUID(),name:`Arena ${i}`}));
 const connect=(index:number)=>{const p=players[index];profiles.set(p.id,p);if(!events.has(p.id))events.set(p.id,[]);return game.connect(p,event=>events.get(p.id)!.push(structuredClone(event)));};
 players.forEach((_,index)=>connect(index));
 const presence=()=>events.get(players[4].id)!.filter((event):event is Extract<ServerEvent,{type:'arena-population'}>=>event.type==='arena-population');
 const count=()=>presence().at(-1)?.count??0;
 const room=(index=0)=>game.rooms.get(game.peers.get(players[index].id)!.roomId!)!;
 return {game,players,events,connect,presence,count,room};
}

test('arena presence accepts only a boolean and rejects client-supplied population or identity',()=>{
 for(const open of [true,false])assert.equal(commandSchema.safeParse({type:'arena-presence',open}).success,true);
 for(const open of [undefined,null,0,1,'true'])assert.equal(commandSchema.safeParse({type:'arena-presence',open}).success,false);
 for(const key of ['count','playerId','connected'])assert.equal(commandSchema.safeParse({type:'arena-presence',open:true,[key]:17}).success,false);
});

test('arena population counts connected humans once across hall, rooms and training; unchanged states do not broadcast',async()=>{
 const f=fixture(),[host,mate,viewer,lobby]=f.players;assert.equal(f.count(),0);assert.equal(f.presence().length,0);
 await f.game.command(viewer.id,{type:'arena-presence',open:true});assert.equal(f.count(),1);
 const before=f.presence().length;for(let i=0;i<20;i++)await f.game.command(viewer.id,{type:'arena-presence',open:true});assert.equal(f.presence().length,before);
 await f.game.command(host.id,{type:'arena-presence',open:true});assert.equal(f.count(),2);
 await f.game.command(host.id,{type:'create'});assert.equal(f.count(),2);assert.equal(f.presence().length,before+1);
 await f.game.command(host.id,{type:'arena-presence',open:false});assert.equal(f.count(),2);assert.equal(f.presence().length,before+1);
 await f.game.command(host.id,{type:'room-slot',slot:1,open:true});await f.game.command(mate.id,{type:'join',roomId:f.room().id});assert.equal(f.count(),3);
 await f.game.command(mate.id,{type:'arena-presence',open:true});assert.equal(f.count(),3);
 const countEvents=f.presence().length;await f.game.command(host.id,{type:'practice-start'});assert.equal([...f.game.matches.values()][0].state.players.length,4);assert.equal(f.count(),3);assert.equal(f.presence().length,countEvents);
 await f.game.command(lobby.id,{type:'move',x:700,y:660});await f.game.command(lobby.id,{type:'ping',time:Date.now()});assert.equal(f.count(),3);assert.equal(f.presence().length,countEvents);
 await f.game.command(mate.id,{type:'leave'});assert.equal(f.count(),3,'a player returning to the visible hall is still counted once');
 await f.game.command(mate.id,{type:'arena-presence',open:false});assert.equal(f.count(),2);
 await f.game.command(host.id,{type:'leave'});assert.equal(f.count(),1);await f.game.command(viewer.id,{type:'arena-presence',open:false});assert.equal(f.count(),0);
});

test('inactive peers are excluded immediately and reconnect only restores actual room membership',async()=>{
 const f=fixture(),[hall,roomPlayer]=f.players;await f.game.command(hall.id,{type:'arena-presence',open:true});await f.game.command(roomPlayer.id,{type:'create'});assert.equal(f.count(),2);
 f.game.disconnect(hall.id);assert.equal(f.count(),1);await f.game.command(hall.id,{type:'arena-presence',open:true});assert.equal(f.count(),1);
 f.connect(0);assert.equal(f.count(),1,'reload at the lobby does not retain a stale hall flag');assert.equal(f.game.peers.get(hall.id)!.arenaOpen,false);
 const welcome=f.events.get(hall.id)!.filter((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome').at(-1)!;assert.equal(welcome.arenaOnline,1);
 await f.game.command(hall.id,{type:'arena-presence',open:true});assert.equal(f.count(),2);f.game.disconnect(roomPlayer.id);assert.equal(f.count(),1);
 f.connect(1);assert.equal(f.count(),2);f.connect(1);assert.equal(f.count(),2,'a replacement connection is not a second player');
 f.game.disconnect(roomPlayer.id);assert.equal(f.count(),1);const notifications=f.presence().length;f.game.tick(Date.now()+30001);assert.equal(f.count(),1);assert.equal(f.presence().length,notifications);assert.equal(f.game.rooms.size,0);
});

test('both matched parties share one authoritative start time, stable on reconnect and removed after return',async()=>{
 const f=fixture(),[a,b]=f.players;await f.game.command(a.id,{type:'create'});await f.game.command(b.id,{type:'create'});const left=f.room(),right=f.room(1);
 assert.equal(left.matchStartedAt,undefined);await f.game.command(a.id,{type:'queue'});assert.equal(left.matchStartedAt,undefined);
 await f.game.command(b.id,{type:'queue'});const match=[...f.game.matches.values()][0];assert.equal(left.matchStartedAt,match.createdAt);assert.equal(right.matchStartedAt,match.createdAt);assert.equal(f.count(),2);
 const startedAt=left.matchStartedAt;f.game.disconnect(a.id);f.connect(0);assert.equal(left.matchStartedAt,startedAt);
 const welcome=f.events.get(a.id)!.filter((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome').at(-1)!;assert.equal(welcome.room?.matchStartedAt,startedAt);
 const active=match.state.players.find(player=>player.id===match.state.turnId)!;for(const fighter of match.state.players)if(fighter.team!==active.team)fighter.hp=0;await f.game.command(active.id,{type:'pass'});
 assert.equal(left.matchStartedAt,startedAt,'battle timing remains available during result presentation');f.game.tick(match.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));f.game.tick(match.state.rewards!.revealedAt!+2000);
 assert.equal(left.status,'waiting');assert.equal(right.status,'waiting');assert.equal(left.matchStartedAt,undefined);assert.equal(right.matchStartedAt,undefined);assert.equal(f.count(),2);
});

test('hall search retains full, searching and playing rooms and only filters names, case and accents',()=>{
 const room=(name:string,status:Room['status'],full=false):Room=>({id:randomUUID(),number:1,name,hostId:'owner',mode:'2v2',openSlots:[0,1],map:'garden',status,players:Array.from({length:full?2:1},(_,index)=>({id:`p-${index}`,name:'Owner',level:1,equipment:normalizeProfile({id:'p',name:'P'}).equipment,ready:false,bot:false,team:0,slot:index,connected:true}))});
 const rooms=[room('Dragões', 'waiting'),room('Dragões cheia','waiting',true),room('Dragões fila','searching',true),room('Dragões combate','playing',true),{...room('Treino','waiting'),practice:true}];
 assert.deepEqual(arenaRooms(rooms,''),rooms.slice(0,4));assert.deepEqual(arenaRooms(rooms,' DRAGOES '),rooms.slice(0,4));assert.deepEqual(arenaRooms(rooms,'FILA'),[rooms[2]]);assert.deepEqual(arenaRooms(rooms,'sem sala'),[]);
});

test('battle elapsed time uses the server timestamp, floors seconds and never shows negative time',()=>{
 const start=100000;assert.equal(arenaMatchTime(start,start+125999),'02:05');assert.equal(arenaMatchTime(start,start+3600000),'60:00');assert.equal(arenaMatchTime(start,start-500),'00:00');assert.equal(arenaMatchTime(undefined,start),'—');assert.equal(arenaMatchTime(NaN,start),'—');assert.equal(arenaMatchTime(start,Infinity),'—');
});
