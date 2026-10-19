import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {LOADING_SECONDS} from '../shared/protocol';
import type {MatchLoading,Profile,ServerEvent} from '../shared/protocol';

function fixture(count:number){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store:ProfileStore={
  saveAbilityLoadout:async()=>{throw Error('unused');},
  buy:async()=>{throw Error('unused');},getProfile:async id=>structuredClone(profiles.get(id)??null),
  saveEquipment:async(id,equipment)=>{const p=profiles.get(id)!;p.equipment=structuredClone(equipment);return p;},
  rename:async()=>{},finishMatch:async()=>{},finishExpedition:async()=>{},
  forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}
 } as ProfileStore;
 const game=new Game(store),players=Array.from({length:count},(_,i)=>normalizeProfile({id:randomUUID(),name:`Loader ${i}`,gender:'male'}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 const roomFor=(p:Profile)=>game.rooms.get(game.peers.get(p.id)!.roomId!)!;
 const party=async(members:Profile[])=>{
  await game.command(members[0].id,{type:'create',name:'Loading party'});const r=roomFor(members[0]);
  for(let slot=1;slot<members.length;slot++)await game.command(members[0].id,{type:'room-slot',slot,open:true});
  for(const p of members.slice(1))await game.command(p.id,{type:'join',roomId:r.id});
  for(const p of members.slice(1))await game.command(p.id,{type:'ready'});
  return r;
 };
 const screen=async(members:Profile[])=>{for(const p of members)await game.command(p.id,{type:'client-features',loading:true});};
 const loading=(p:Profile)=>events.get(p.id)!.filter((e):e is Extract<ServerEvent,{type:'loading'}>=>e.type==='loading').at(-1);
 return {game,players,events,party,screen,loading,roomFor};
}

test('a match waits for every loading screen and starts once all report 100 %',async()=>{
 const f=fixture(2),[a,b]=f.players;await f.screen([a,b]);
 const ra=await f.party([a]),rb=await f.party([b]);
 await f.game.command(a.id,{type:'queue'});await f.game.command(b.id,{type:'queue'});
 assert.equal(f.game.matches.size,0);assert.equal(ra.status,'playing');assert.equal(rb.status,'playing');
 const view=f.loading(a)!.loading as MatchLoading;assert.equal(view.kind,'pvp');assert.deepEqual(view.players.map(p=>[p.name,p.team,p.progress]),[['Loader 0',0,0],['Loader 1',1,0]]);
 assert.ok(view.deadline>Date.now()+(LOADING_SECONDS-1)*1000);
 await f.game.command(a.id,{type:'loading-progress',id:view.id,progress:40});
 assert.equal(f.loading(b)!.loading!.players.find(p=>p.id===a.id)!.progress,40,'the others see the bar move');
 await f.game.command(a.id,{type:'loading-progress',id:view.id,progress:10});
 assert.equal(f.loading(b)!.loading!.players.find(p=>p.id===a.id)!.progress,40,'progress never goes back');
 await f.game.command(a.id,{type:'loading-progress',id:view.id,progress:100});assert.equal(f.game.matches.size,0);
 await f.game.command(b.id,{type:'loading-progress',id:view.id,progress:100});
 assert.equal(f.game.matches.size,1);const match=[...f.game.matches.values()][0];
 assert.equal(match.state.map,view.map,'the battle plays the map the screen showed');
 assert.ok(f.events.get(b.id)!.some(e=>e.type==='battle'&&e.battle?.id===match.state.id));
});

test('clients without the loading screen (and bots) start at once',async()=>{
 const f=fixture(2),[a,b]=f.players;await f.screen([a]);
 await f.party([a]);await f.party([b]);
 await f.game.command(a.id,{type:'queue'});await f.game.command(b.id,{type:'queue'});
 assert.equal(f.game.matches.size,0,'still waits for the one that shows it');
 await f.game.command(a.id,{type:'loading-progress',id:f.loading(a)!.loading!.id,progress:100});
 assert.equal(f.game.matches.size,1);
 const g=fixture(1);await g.screen(g.players);await g.party(g.players);await g.game.command(g.players[0].id,{type:'practice-start'});
 const practice=g.loading(g.players[0])!.loading!;assert.ok(practice.players.some(p=>p.bot&&p.progress===100));
 await g.game.command(g.players[0].id,{type:'loading-progress',id:practice.id,progress:100});assert.equal(g.game.matches.size,1);
});

test('after 30 s the ones still loading leave and go back to the hall; the rest play',async()=>{
 const f=fixture(4),[a1,a2,b1,b2]=f.players;await f.screen(f.players);
 const ra=await f.party([a1,a2]),rb=await f.party([b1,b2]);
 await f.game.command(a1.id,{type:'queue'});await f.game.command(b1.id,{type:'queue'});
 const view=f.loading(a1)!.loading!;
 for(const p of [a1,a2,b1])await f.game.command(p.id,{type:'loading-progress',id:view.id,progress:100});
 assert.equal(f.game.matches.size,0);
 f.game.tick(view.deadline+1);
 assert.equal(f.game.matches.size,1);const match=[...f.game.matches.values()][0];
 assert.deepEqual(match.state.players.map(p=>p.id).sort(),[a1.id,a2.id,b1.id].sort());
 assert.equal(f.game.peers.get(b2.id)!.roomId,null);assert.equal(f.loading(b2)!.dropped,'pvp');assert.ok(!rb.players.some(p=>p.id===b2.id));
 assert.equal(ra.status,'playing');
});

test('a side left empty by the deadline sends everyone back to the room',async()=>{
 const f=fixture(2),[a,b]=f.players;await f.screen([a,b]);
 const ra=await f.party([a]);await f.party([b]);
 await f.game.command(a.id,{type:'queue'});await f.game.command(b.id,{type:'queue'});
 const view=f.loading(a)!.loading!;await f.game.command(a.id,{type:'loading-progress',id:view.id,progress:100});
 f.game.tick(view.deadline+1);
 assert.equal(f.game.matches.size,0);assert.equal(ra.status,'waiting');assert.equal(f.loading(a)!.loading,null);
 assert.equal(f.game.peers.get(b.id)!.roomId,null);assert.equal(f.loading(b)!.dropped,'pvp');
});

test('leaving during the loading screen stops the others from waiting for you',async()=>{
 const f=fixture(4),[a1,a2,b1,b2]=f.players;await f.screen(f.players);
 await f.party([a1,a2]);await f.party([b1,b2]);
 await f.game.command(a1.id,{type:'queue'});await f.game.command(b1.id,{type:'queue'});
 const view=f.loading(a1)!.loading!;
 for(const p of [a1,a2,b1])await f.game.command(p.id,{type:'loading-progress',id:view.id,progress:100});
 await f.game.command(b2.id,{type:'leave'});
 assert.equal(f.loading(b2)!.loading,null);
 assert.equal(f.game.matches.size,1);assert.equal([...f.game.matches.values()][0].state.players.length,3);
});

test('an expedition stage loads its instance first',async()=>{
 const f=fixture(2),[a,b]=f.players;await f.screen([a,b]);
 await f.game.command(a.id,{type:'create-expedition'});const room=f.roomFor(a);
 await f.game.command(b.id,{type:'join',roomId:room.id});
 await f.game.command(a.id,{type:'expedition-select',expedition:'anthill',difficulty:'easy'});
 await f.game.command(b.id,{type:'ready'});await f.game.command(a.id,{type:'start'});
 const view=f.loading(a)!.loading!;assert.equal(view.kind,'expedition');assert.equal(view.expedition?.id,'anthill');assert.equal(view.expedition?.stage,0);assert.ok(view.expedition?.art);
 assert.equal(f.game.matches.size,0);
 for(const p of [a,b])await f.game.command(p.id,{type:'loading-progress',id:view.id,progress:100});
 const match=[...f.game.matches.values()][0];assert.ok(match?.state.instance);assert.equal(match.state.map,view.map);
});
