import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {Equipment} from '../shared/catalog';
import {MAP_IDS,getMap} from '../shared/maps';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';

function fixture(count=10){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),finishCalls:string[][]=[];
 const store:ProfileStore={
  saveAbilityLoadout:async()=>{throw Error('unused');},
  buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,
  saveEquipment:async(id,equipment)=>{const p=profiles.get(id)!;p.equipment=structuredClone(equipment);return p;},
  rename:async()=>{},finishMatch:async(_id,_winners,players)=>{finishCalls.push(players);},
  forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}
 };
 const game=new Game(store),players=Array.from({length:count},(_,i)=>normalizeProfile({id:randomUUID(),name:`Queue ${i}`}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 const roomFor=(p:Profile)=>game.rooms.get(game.peers.get(p.id)!.roomId!)!;
 const error=(p:Profile)=>events.get(p.id)!.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1)?.message;
 const party=async(members:Profile[])=>{
  await game.command(members[0].id,{type:'create',name:'Queue party'});const r=roomFor(members[0]);
  for(let slot=1;slot<members.length;slot++)await game.command(members[0].id,{type:'room-slot',slot,open:true});
  for(const p of members.slice(1))await game.command(p.id,{type:'join',roomId:r.id});
  for(const p of members.slice(1))await game.command(p.id,{type:'ready'});
  return r;
 };
 return {game,store,profiles,players,events,finishCalls,party,roomFor,error};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('party size determines 1v1 through 4v4; only two equally sized human parties match',async()=>{
 for(let size=1;size<=4;size++){
  const f=fixture(size*2),a=f.players.slice(0,size),b=f.players.slice(size),ra=await f.party(a),rb=await f.party(b);
  assert.equal(ra.mode,`${size}v${size}`);assert.equal(rb.mode,`${size}v${size}`);
  assert.deepEqual(ra.openSlots,Array.from({length:size},(_,i)=>i));assert.ok([...ra.players,...rb.players].every(p=>p.team===0&&!p.bot));
  await f.game.command(a[0].id,{type:'queue'});assert.equal(ra.status,'searching');assert.equal(f.game.matches.size,0);
  await f.game.command(b[0].id,{type:'queue'});assert.equal(f.game.matches.size,1);
  const match=[...f.game.matches.values()][0];assert.equal(match.state.players.length,size*2);assert.equal(ra.status,'playing');assert.equal(rb.status,'playing');
  assert.deepEqual(ra.players.map(p=>p.id),a.map(p=>p.id));assert.deepEqual(rb.players.map(p=>p.id),b.map(p=>p.id));
  for(const [team,members] of [a,b].entries())for(const [slot,p] of members.entries()){
   const fighter=match.state.players.find(s=>s.id===p.id)!;assert.equal(fighter.team,team);assert.equal(fighter.slot,slot);
   assert.equal(fighter.x,getMap(match.state.map).spawns[team as 0|1][slot]);
   assert.equal(f.game.peers.get(p.id)!.roomId,team===0?ra.id:rb.id);
   assert.ok(f.events.get(p.id)!.some(e=>e.type==='battle'&&e.battle?.id===match.state.id));
  }
 }
});

test('legacy client-selected map/mode cannot control PvP; queue payload cannot smuggle a selection',async()=>{
 const f=fixture(2);
 await f.game.command(f.players[0].id,{type:'create',name:'Requested override',mode:'4v4',map:'valley'});
 const ra=f.roomFor(f.players[0]);assert.equal(ra.mode,'1v1');assert.equal(ra.map,'garden');assert.equal(ra.practice,false);
 const rb=await f.party([f.players[1]]);await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[1].id,{type:'queue'});
 const match=[...f.game.matches.values()][0];assert.ok(MAP_IDS.some(id=>id===match.state.map));assert.equal(ra.map,match.state.map);assert.equal(rb.map,match.state.map);
 assert.equal(commandSchema.safeParse({type:'create',name:'Fresh party'}).success,true);
 assert.equal(commandSchema.safeParse({type:'queue',map:'celestial'}).success,false);
 assert.equal(commandSchema.safeParse({type:'cancel-queue',roomId:ra.id}).success,false);
});

test('different team sizes wait without bots and duplicate queue requests cannot consume a party twice',async()=>{
 const f=fixture(5),solo=await f.party([f.players[0]]),pair=await f.party(f.players.slice(1,3));
 await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[1].id,{type:'queue'});
 assert.equal(f.game.matches.size,0);assert.equal(solo.status,'searching');assert.equal(pair.status,'searching');
 await f.game.command(f.players[0].id,{type:'queue'});assert.match(f.error(f.players[0])!,/já está buscando/);
 const other=await f.party(f.players.slice(3));await f.game.command(f.players[3].id,{type:'queue'});
 assert.equal(f.game.matches.size,1);assert.equal(solo.status,'searching');assert.equal(pair.status,'playing');assert.equal(other.status,'playing');
 assert.ok([...f.game.matches.values()][0].state.players.every(p=>!p.bot));
});

test('only leader queues a ready connected party; searching denies joins, kicks and bot insertion',async()=>{
 const f=fixture(5),r=await f.party(f.players.slice(0,2)),[host,mate,outsider]=f.players;
 await f.game.command(mate.id,{type:'queue'});assert.match(f.error(mate)!,/líder/);
 await f.game.command(mate.id,{type:'ready'});await f.game.command(host.id,{type:'queue'});assert.equal(r.status,'waiting');assert.match(f.error(host)!,/prontos/);
 await f.game.command(mate.id,{type:'ready'});await f.game.command(host.id,{type:'bot'});assert.match(f.error(host)!,/somente no treino/);
 await f.game.command(mate.id,{type:'room-slot',slot:3,open:true});assert.match(f.error(mate)!,/líder/);
 await f.game.command(host.id,{type:'queue'});assert.equal(r.status,'searching');
 const before=structuredClone(r);
 await f.game.command(outsider.id,{type:'join',roomId:r.id});await f.game.command(host.id,{type:'kick',playerId:mate.id});await f.game.command(mate.id,{type:'cancel-queue'});
 assert.deepEqual(r,before);assert.equal(f.game.peers.get(outsider.id)!.roomId,null);assert.match(f.error(mate)!,/líder/);
 await f.game.command(host.id,{type:'cancel-queue'});assert.equal(r.status,'waiting');assert.ok(r.players.every(p=>!p.ready));
 const opposing=await f.party([f.players[3],f.players[4]]);await f.game.command(f.players[3].id,{type:'queue'});assert.equal(opposing.status,'searching');assert.equal(f.game.matches.size,0);
});

test('membership changes reset readiness and preserve the leader-selected capacity without opponent seats',async()=>{
 const f=fixture(5),r=await f.party(f.players.slice(0,4));assert.equal(r.mode,'4v4');assert.ok(r.players.every(p=>p.team===0));
 await f.game.command(f.players[4].id,{type:'join',roomId:r.id});assert.match(f.error(f.players[4])!,/cheia/);
 await f.game.command(f.players[0].id,{type:'kick',playerId:f.players[2].id});assert.equal(r.mode,'4v4');assert.equal(r.players.length,3);assert.ok(r.players.every(p=>!p.ready));
 await f.game.command(f.players[0].id,{type:'queue'});assert.equal(r.status,'waiting');assert.match(f.error(f.players[0])!,/vagas abertas/);
 await f.game.command(f.players[0].id,{type:'room-slot',slot:2,open:false});assert.equal(r.mode,'3v3');
 for(const p of r.players.slice(1))await f.game.command(p.id,{type:'ready'});
 await f.game.command(f.players[0].id,{type:'queue'});assert.equal(r.status,'searching');
 await f.game.command(f.players[0].id,{type:'leave'});assert.equal(r.status,'waiting');assert.equal(r.mode,'3v3');assert.equal(r.hostId,f.players[1].id);assert.equal(r.players.find(p=>p.id===r.hostId)!.slot,0);assert.ok(r.players.every(p=>!p.ready));
 await f.game.command(f.players[4].id,{type:'join',roomId:r.id});assert.equal(r.mode,'3v3');assert.equal(new Set(r.players.map(s=>s.slot)).size,3);
});

test('disconnect cancels search and reconnect never silently returns a party to the queue',async()=>{
 const f=fixture(4),r=await f.party(f.players.slice(0,2));await f.game.command(f.players[0].id,{type:'queue'});
 f.game.disconnect(f.players[1].id);assert.equal(r.status,'waiting');assert.equal(r.players[1].connected,false);
 const other=await f.party(f.players.slice(2));await f.game.command(f.players[2].id,{type:'queue'});assert.equal(f.game.matches.size,0);
 f.game.connect(f.players[1],e=>f.events.get(f.players[1].id)!.push(structuredClone(e)));
 assert.equal(r.status,'waiting');assert.equal(r.players[1].connected,true);assert.equal(r.players[1].ready,false);
 await f.game.command(f.players[0].id,{type:'queue'});assert.equal(r.status,'waiting');
 await f.game.command(f.players[1].id,{type:'ready'});await f.game.command(f.players[0].id,{type:'queue'});assert.equal(r.status,'playing');assert.equal(other.status,'playing');
});

test('a teammate withdrawing readiness cancels the search; expired disconnected occupants are removed safely',async()=>{
 const f=fixture(3),r=await f.party(f.players.slice(0,2));await f.game.command(f.players[0].id,{type:'queue'});
 await f.game.command(f.players[1].id,{type:'ready'});assert.equal(r.status,'waiting');assert.ok(r.players.every(p=>!p.ready));
 await f.game.command(f.players[1].id,{type:'ready'});await f.game.command(f.players[0].id,{type:'queue'});
 f.game.disconnect(f.players[0].id);f.game.tick(f.game.peers.get(f.players[0].id)!.lastSeen+30001);
 assert.equal(r.status,'waiting');assert.equal(r.mode,'2v2');assert.equal(r.hostId,f.players[1].id);assert.equal(r.players.length,1);
 assert.equal(f.game.peers.has(f.players[0].id),false);await f.party([f.players[2]]);await f.game.command(f.players[2].id,{type:'queue'});assert.equal(f.game.matches.size,0);
 await f.game.command(f.players[1].id,{type:'room-slot',slot:1,open:false});await f.game.command(f.players[1].id,{type:'queue'});assert.equal(f.game.matches.size,1);
});

test('matching revalidates stale connection membership before consuming a queued party',async()=>{
 const f=fixture(2),r=await f.party([f.players[0]]);await f.game.command(f.players[0].id,{type:'queue'});
 // Defensive case: a stale transport record must never be sufficient to reserve an opponent.
 f.game.peers.get(f.players[0].id)!.connected=false;
 const other=await f.party([f.players[1]]);await f.game.command(f.players[1].id,{type:'queue'});
 assert.equal(f.game.matches.size,0);assert.equal(r.status,'waiting');assert.equal(other.status,'searching');
});

test('equipment persistence cancels a queue immediately and blocks matching until the updated gear is committed',async()=>{
 const f=fixture(2),r=await f.party([f.players[0]]);await f.game.command(f.players[0].id,{type:'queue'});
 let complete!:(profile:Profile)=>void;
 f.store.saveEquipment=async(id:string,equipment:Equipment)=>new Promise<Profile>(resolve=>{complete=resolve;const p=f.profiles.get(id)!;p.equipment=structuredClone(equipment);});
 const change=f.game.command(f.players[0].id,{type:'equip',item:f.players[0].equipment.weapon});assert.equal(r.status,'waiting');
 const other=await f.party([f.players[1]]);await f.game.command(f.players[1].id,{type:'queue'});await f.game.command(f.players[0].id,{type:'queue'});
 assert.equal(f.game.matches.size,0);assert.equal(r.status,'waiting');assert.equal(other.status,'searching');
 complete(f.profiles.get(f.players[0].id)!);await change;
 await f.game.command(f.players[0].id,{type:'queue'});assert.equal(f.game.matches.size,1);
});

test('both source parties reconnect to the shared battle, receive shots and use authoritative turns',async()=>{
 const f=fixture(2),ra=await f.party([f.players[0]]),rb=await f.party([f.players[1]]);
 await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[1].id,{type:'queue'});const m=[...f.game.matches.values()][0];
 f.game.disconnect(f.players[1].id);const resumed:ServerEvent[]=[];f.game.connect(f.players[1],e=>resumed.push(structuredClone(e)));
 const welcome=resumed.find((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome')!;assert.equal(welcome.room!.id,rb.id);assert.equal(welcome.battle!.roomId,ra.id);assert.equal(welcome.battle!.id,m.state.id);assert.ok(welcome.battle!.terrain);
 await f.game.command(m.state.turnId,{type:'pass'});await f.game.command(m.state.turnId,{type:'fire',angle:45,power:35});
 assert.ok(resumed.some(e=>e.type==='shot'));assert.ok(f.events.get(f.players[0].id)!.some(e=>e.type==='shot'));
});

test('chat remains party-private before and after battle and is shared only during the active match',async()=>{
 const f=fixture(2);await f.party([f.players[0]]);await f.party([f.players[1]]);
 const chat=(text:string)=>f.game.command(f.players[0].id,{type:'chat',channel:'room',text});
 await chat('before');assert.equal(f.events.get(f.players[1].id)!.some(e=>e.type==='chat'),false);
 await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[1].id,{type:'queue'});const m=[...f.game.matches.values()][0];
 await chat('during');assert.ok(f.events.get(f.players[1].id)!.some(e=>e.type==='chat'&&e.message.text==='during'));
 m.state.players.find(p=>p.id===f.players[1].id)!.hp=0;await f.game.command(m.state.turnId,{type:'pass'});assert.equal(m.state.phase,'finished');
 await chat('after');assert.equal(f.events.get(f.players[1].id)!.some(e=>e.type==='chat'&&e.message.text==='after'),false);
});

test('finished parties return automatically together after reveal and persistence, retaining independent room identities',async()=>{
 const f=fixture(3),ra=await f.party([f.players[0]]),rb=await f.party([f.players[1]]);
 await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[1].id,{type:'queue'});const first=[...f.game.matches.values()][0];
 first.state.players.find(p=>p.id===f.players[1].id)!.hp=0;await f.game.command(first.state.turnId,{type:'pass'});
 await f.game.command(f.players[0].id,{type:'rematch'});assert.equal(ra.status,'playing');assert.match(f.error(f.players[0])!,/revelação/);
 f.game.tick(first.state.rewards!.deadline+1);await flush();assert.equal(first.state.rewards!.saved,true);assert.equal(f.finishCalls.length,1);
 f.game.tick(first.state.rewards!.revealedAt!+1999);assert.equal(ra.status,'playing');assert.equal(rb.status,'playing');assert.equal(ra.players.length,1);assert.equal(f.game.matches.size,1);
 f.game.disconnect(f.players[1].id);const resumed:ServerEvent[]=[];f.game.connect(f.players[1],e=>resumed.push(structuredClone(e)));
 const welcome=resumed.find((e):e is Extract<ServerEvent,{type:'welcome'}>=>e.type==='welcome')!;assert.equal(welcome.battle!.id,first.state.id);assert.equal(welcome.battle!.phase,'finished');
 f.game.tick(first.state.rewards!.revealedAt!+2000);assert.equal(ra.status,'waiting');assert.equal(rb.status,'waiting');assert.equal(f.game.matches.size,0);assert.equal(f.game.peers.get(f.players[0].id)!.roomId,ra.id);assert.equal(f.game.peers.get(f.players[1].id)!.roomId,rb.id);
 const rc=await f.party([f.players[2]]);await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[2].id,{type:'queue'});assert.equal(f.game.matches.size,1);assert.equal(rc.status,'playing');assert.equal(rb.status,'waiting');
});

test('leaving a matched party keeps remaining allies together and pending rewards settle even if every party leaves',async()=>{
 const f=fixture(4),ra=await f.party(f.players.slice(0,2)),rb=await f.party(f.players.slice(2));
 await f.game.command(f.players[0].id,{type:'queue'});await f.game.command(f.players[2].id,{type:'queue'});const m=[...f.game.matches.values()][0];
 await f.game.command(f.players[0].id,{type:'leave'});assert.equal(ra.hostId,f.players[1].id);assert.equal(ra.players.length,1);assert.equal(rb.players.length,2);assert.equal(m.state.phase,'aiming');
 const mark=f.events.get(f.players[0].id)!.length;
 await f.game.command(f.players[1].id,{type:'leave'});assert.equal(m.state.phase,'finished');assert.equal(f.game.rooms.has(ra.id),false);
 for(const player of f.players.slice(2))await f.game.command(player.id,{type:'leave'});
 assert.equal(f.game.rooms.size,0);assert.equal(f.game.matches.size,1);
 f.game.tick(m.state.rewards!.deadline+1);await flush();f.game.tick(Date.now());assert.equal(f.game.matches.size,0);assert.equal(f.finishCalls.length,1);// The two who left mid-match forfeit; the opponents left only after the result and keep it.
 assert.deepEqual([...f.finishCalls[0]].sort(),f.players.slice(2).map(p=>p.id).sort());
 assert.equal(f.events.get(f.players[0].id)!.slice(mark).some(e=>e.type==='battle'&&e.battle!==null),false);
});

test('practice remains explicit and does not enter matchmaking or borrow a queued opponent',async()=>{
 const f=fixture(2),party=await f.party([f.players[0]]);await f.game.command(f.players[0].id,{type:'queue'});
 await f.game.command(f.players[1].id,{type:'create',practice:true,name:'Training',map:'celestial',mode:'1v1'});const practice=f.roomFor(f.players[1]);
 await f.game.command(f.players[1].id,{type:'queue'});assert.match(f.error(f.players[1])!,/treino/);assert.equal(practice.status,'waiting');
 await f.game.command(f.players[1].id,{type:'bot'});await f.game.command(f.players[1].id,{type:'start'});
 assert.equal(party.status,'searching');assert.equal(practice.status,'playing');assert.equal(f.game.matches.size,1);assert.equal([...f.game.matches.values()][0].state.map,'celestial');
});
