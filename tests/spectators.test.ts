import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {Command,Profile,ServerEvent} from '../shared/protocol';
import type {Equipment} from '../shared/catalog';
import {WEAPONS,weaponStats} from '../shared/catalog';
import {trajectory,WORLD} from '../shared/physics';
import {HIDDEN_POSITION} from '../shared/abilities';
import {createFall} from '../shared/fall';

type EventOf<T extends ServerEvent['type']>=Extract<ServerEvent,{type:T}>;
function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),paid:string[][]=[];
 const store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async(_id:string,_winners:string[],humans:string[])=>{paid.push([...humans]);},saveEquipment:async(id:string,equipment:Equipment)=>{const value={...profiles.get(id)!,equipment};profiles.set(id,value);return value;}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>0),players=Array.from({length:7},(_,index)=>normalizeProfile({id:randomUUID(),name:`Spectator ${index}`}));
 const connect=(index:number)=>{const profile=players[index];if(!profiles.has(profile.id))profiles.set(profile.id,profile);if(!events.has(profile.id))events.set(profile.id,[]);game.connect(profile,event=>events.get(profile.id)!.push(structuredClone(event)));};players.forEach((_,index)=>connect(index));
 const received=<T extends ServerEvent['type']>(index:number,type:T)=>events.get(players[index].id)!.filter((event):event is EventOf<T>=>event.type===type);
 const last=<T extends ServerEvent['type']>(index:number,type:T)=>received(index,type).at(-1)!;
 const send=(index:number,command:Command)=>game.command(players[index].id,command);
 const room=(index=0)=>game.rooms.get(game.peers.get(players[index].id)!.roomId!)!;
 return {game,players,profiles,paid,events,connect,received,last,send,room};
}
async function combat(){
 const f=fixture();await f.send(0,{type:'create',practice:true,mode:'1v1',map:'celestial'});const room=f.room();await f.send(1,{type:'join',roomId:room.id});await f.send(1,{type:'ready'});
 await f.send(0,{type:'room-spectator-slot',slot:0,open:true});await f.send(0,{type:'room-spectator-slot',slot:1,open:true});await f.send(2,{type:'spectate',roomId:room.id});await f.send(0,{type:'start'});
 const match=[...f.game.matches.values()][0],actor=match.state.players[0],target=match.state.players[1];match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,200*WORLD.cols);Object.assign(actor,{x:300,y:600,hp:5000,maxHp:5000});Object.assign(target,{x:430,y:600,hp:5000,maxHp:5000});
 let aim:{angle:number;power:number}|undefined;for(let angle=15;angle<=85&&!aim;angle++)for(let power=5;power<=100;power++){const path=trajectory(match.terrain,actor,angle,power,0,weaponStats(WEAPONS[0],0),[target]);if(path.hitId===target.id&&(path.hitQuality??0)>.9){aim={angle,power};break;}}
 assert.ok(aim);return {...f,match,actor,target,aim};
}

test('spectator commands reject forged identity, capacity, invalid slots and unbounded identifiers',()=>{
 for(const command of [{type:'spectate',roomId:randomUUID()},{type:'spectator-kick',playerId:randomUUID()},{type:'room-spectator-slot',slot:0,open:true},{type:'room-spectator-slot',slot:1,open:false}])assert.equal(commandSchema.safeParse(command).success,true);
 for(const command of [{type:'spectate',roomId:randomUUID(),team:0},{type:'spectate',roomId:randomUUID(),playerId:randomUUID()},{type:'spectate',roomId:'missing'},{type:'room-spectator-slot',slot:2,open:true},{type:'room-spectator-slot',slot:-1,open:true},{type:'room-spectator-slot',slot:0,open:1},{type:'spectator-kick',playerId:'bot-123'},{type:'spectator-kick',playerId:randomUUID(),hostId:randomUUID()}])assert.equal(commandSchema.safeParse(command).success,false);
});

test('two spectator places start closed, are host-managed, atomic at entry and independent from fighter vacancies',async()=>{
 const f=fixture();await f.send(0,{type:'create'});const room=f.room(),players=structuredClone(room.players);assert.deepEqual([...(room.spectators??[])],[]);assert.deepEqual([...(room.spectatorSlots??[])],[]);
 await f.send(2,{type:'spectate',roomId:room.id});assert.match(f.last(2,'error').message,/lugar aberto/);assert.equal(f.game.peers.get(f.players[2].id)!.roomId,null);
 await f.send(0,{type:'room-slot',slot:1,open:true});await f.send(1,{type:'join',roomId:room.id});await f.send(1,{type:'room-spectator-slot',slot:0,open:true});assert.match(f.last(1,'error').message,/líder/);await f.send(1,{type:'leave'});
 await f.send(0,{type:'room-slot',slot:1,open:false});await f.send(0,{type:'room-spectator-slot',slot:0,open:true});await f.send(2,{type:'spectate',roomId:room.id});assert.equal(room.spectators!.length,1);assert.deepEqual(room.players,players);assert.deepEqual(room.openSlots,[0]);assert.equal(room.mode,'1v1');
 await f.send(0,{type:'room-spectator-slot',slot:0,open:false});assert.match(f.last(0,'error').message,/Retire/);assert.deepEqual(room.spectatorSlots,[0]);
 await f.send(0,{type:'room-spectator-slot',slot:1,open:true});await Promise.all([f.send(3,{type:'spectate',roomId:room.id}),f.send(4,{type:'spectate',roomId:room.id})]);assert.equal(room.spectators!.length,2);assert.equal(new Set(room.spectators!.map(s=>s.slot)).size,2);assert.equal(f.game.peers.get(f.players[4].id)!.roomId,null);assert.equal(f.last(4,'arena-population').count,3);
 await f.send(2,{type:'spectator-kick',playerId:f.players[3].id});assert.match(f.last(2,'error').message,/assistindo/);await f.send(0,{type:'spectator-kick',playerId:f.players[1].id});assert.match(f.last(0,'error').message,/não está/);
 await f.send(0,{type:'spectator-kick',playerId:f.players[2].id});assert.equal(f.last(2,'room').room,null);assert.equal(f.last(2,'battle').battle,null);assert.equal(room.spectators!.length,1);await f.send(0,{type:'room-spectator-slot',slot:0,open:false});assert.deepEqual(room.spectatorSlots,[1]);assert.deepEqual(room.players,players);
});

test('watching cannot cancel a queue or change readiness, skills or players; personal equipment and reconnect remain independent',async()=>{
 const f=fixture();await f.send(0,{type:'create'});const room=f.room();await f.send(0,{type:'room-spectator-slot',slot:0,open:true});await f.send(2,{type:'spectate',roomId:room.id});await f.send(0,{type:'queue'});const before=structuredClone(room.players),startedAt=room.searchStartedAt;
 for(const command of [{type:'ready'},{type:'queue'},{type:'cancel-queue'},{type:'start'},{type:'practice-start'},{type:'room-slot',slot:1,open:true},{type:'ability-loadout',slots:[null,null,null],requestId:'spectator-readonly'},{type:'kick',playerId:f.players[0].id}] as Command[]){await f.send(2,command);assert.match(f.last(2,'error').message,/assistindo/);assert.equal(room.status,'searching');assert.deepEqual(room.players,before);assert.equal(room.searchStartedAt,startedAt);}
 assert.equal(f.received(2,'error').find(event=>event.requestId==='spectator-readonly')?.requestId,'spectator-readonly');
 await f.send(2,{type:'equip',item:f.players[2].equipment.face});assert.ok(f.last(2,'profile'));assert.equal(room.status,'searching');assert.deepEqual(room.players,before);
 f.game.disconnect(f.players[2].id);assert.equal(room.status,'searching');assert.equal(room.spectators![0].connected,false);f.connect(2);assert.equal(f.last(2,'welcome').room?.spectators?.[0].connected,true);assert.equal(room.searchStartedAt,startedAt);
 await f.send(3,{type:'spectate',roomId:room.id});assert.match(f.last(3,'error').message,/não está disponível/);
 await f.send(2,{type:'leave'});assert.equal(room.status,'searching');assert.equal(room.searchStartedAt,startedAt);assert.equal(room.spectators!.length,0);assert.deepEqual(room.players,before);
});

test('spectators receive live shots, impacts and full hydration, cannot act, and leaving a resolving battle changes no fighters',async()=>{
 const f=await combat();assert.equal(f.last(2,'battle').battle?.players.length,2);assert.ok(!f.match.state.players.some(player=>player.id===f.players[2].id));
 const before=structuredClone(f.match.state);
 for(const command of [{type:'fire',angle:45,power:50},{type:'aim',angle:45,power:50,charging:true},{type:'walk',direction:1},{type:'pass'},{type:'power'},{type:'ability',ability:'heal'},{type:'flight',active:true},{type:'boost',boost:'extra1'},{type:'reward-pick',card:0},{type:'rematch'}] as Command[]){await f.send(2,command);assert.match(f.last(2,'error').message,/assistindo/);assert.deepEqual(f.match.state,before);}
 await f.game.command(f.actor.id,{type:'fire',...f.aim});const shot=f.last(2,'shot').shot;assert.ok(shot.projectiles.length);assert.equal(shot.hidden,undefined);
 await f.send(3,{type:'spectate',roomId:f.room().id});const hydration=f.last(3,'battle').battle!;assert.equal(hydration.activeShot!.id,shot.id);assert.ok(hydration.terrain);assert.deepEqual(hydration.activeShot!.projectiles,shot.projectiles);
 const fighters=structuredClone(f.match.state.players),turn=f.match.state.turnId,phase=f.match.state.phase;await f.send(2,{type:'leave'});assert.equal(f.last(2,'battle').battle,null);assert.deepEqual(f.match.state.players,fighters);assert.equal(f.match.state.turnId,turn);assert.equal(f.match.state.phase,phase);
 const departed=f.received(2,'impact').length;f.game.tick(f.match.pendingImpacts![0].at);assert.equal(f.received(2,'impact').length,departed);assert.ok(f.last(3,'impact').hits.some(hit=>hit.id===f.target.id&&hit.critical));assert.equal(f.last(3,'battle').battle!.players[1].hp,f.target.hp);
});

test('observer snapshots, effects, shots and critical impacts conceal invisible players from both teams, also after reconnect',async()=>{
 const f=await combat();await f.game.command(f.actor.id,{type:'pass'});await f.game.command(f.target.id,{type:'ability',ability:'invisibility'});await f.game.command(f.target.id,{type:'pass'});await f.game.command(f.actor.id,{type:'ability',ability:'invisibility'});f.actor.hp-=300;await f.game.command(f.actor.id,{type:'ability',ability:'heal'});
 f.actor.fall=createFall(500,600,Date.now()-1000);await f.game.command(f.actor.id,{type:'aim',angle:50,power:70,charging:true});
 const hidden=f.last(2,'battle').battle!.players;for(const fighter of hidden){assert.equal(fighter.hidden,true);assert.equal(fighter.x,HIDDEN_POSITION);assert.equal(fighter.y,HIDDEN_POSITION);assert.equal(fighter.aimAngle,undefined);assert.equal(fighter.aimSlope,undefined);assert.equal(fighter.chargePower,undefined);assert.equal(fighter.charging,undefined);assert.equal(fighter.fall,undefined);assert.ok(fighter.name);assert.ok(fighter.hp>0);}
 for(const effect of f.received(2,'ability-effect')){assert.equal(effect.hidden,true);assert.equal(effect.x,HIDDEN_POSITION);assert.equal(effect.y,HIDDEN_POSITION);}
 await f.game.command(f.actor.id,{type:'fire',...f.aim});const shot=f.last(2,'shot').shot;assert.equal(shot.hidden,true);assert.deepEqual(shot.projectiles,[]);
 f.game.disconnect(f.players[2].id);f.connect(2);const resumed=f.last(2,'welcome').battle!;assert.equal(resumed.activeShot!.hidden,true);assert.deepEqual(resumed.activeShot!.projectiles,[]);assert.ok(resumed.players.every(player=>player.hidden&&player.x===HIDDEN_POSITION));
 await f.send(3,{type:'spectate',roomId:f.room().id});assert.ok(f.last(3,'battle').battle!.players.every(player=>player.x===HIDDEN_POSITION));
 f.game.tick(f.match.pendingImpacts![0].at);const hit=f.last(2,'impact').hits.find(hit=>hit.id===f.target.id)!;assert.ok(hit.damage>0);assert.equal(hit.critical,true);assert.equal(hit.hidden,true);assert.equal(hit.x,HIDDEN_POSITION);assert.equal(hit.y,HIDDEN_POSITION);
 for(const index of [2,3]){const latest=f.last(index,'battle').battle!;assert.ok(latest.players.every(player=>player.x===HIDDEN_POSITION));assert.ok(latest.activeShot!.hits.every(hit=>hit.hidden&&hit.x===HIDDEN_POSITION));assert.deepEqual(latest.activeShot!.projectiles,[]);}
 assert.equal(f.last(0,'battle').battle!.players.find(player=>player.id===f.actor.id)!.x,f.actor.x,'fighter keeps their own visible position');
});

test('flight shots and landing effects are delivered to observers and filtered when the flying player is invisible',async()=>{
 for(const invisible of [false,true]){const f=await combat();if(invisible)await f.game.command(f.actor.id,{type:'ability',ability:'invisibility'});await f.game.command(f.actor.id,{type:'flight',active:true});await f.game.command(f.actor.id,{type:'fire',angle:45,power:25});
  const shot=f.last(2,'shot').shot;if(invisible){assert.equal(shot.hidden,true);assert.deepEqual(shot.projectiles,[]);}else assert.equal(shot.projectiles[0].kind,'flight');
  f.game.tick(f.match.pendingImpacts![0].at);const effect=f.received(2,'ability-effect').find(effect=>effect.ability==='flight')!;assert.ok(effect);assert.equal(effect.hidden,invisible?true:undefined);assert.equal(effect.x,invisible?HIDDEN_POSITION:f.actor.x);assert.equal(f.last(2,'impact').hits.length,0);
 }
});

test('two parties preserve their watchers on return; observers neither select cards nor receive match rewards',async()=>{
 const f=fixture();for(const host of [0,1]){await f.send(host,{type:'create'});await f.send(host,{type:'room-spectator-slot',slot:0,open:true});await f.send(host+2,{type:'spectate',roomId:f.room(host).id});}
 const originalRooms=[f.room(0),f.room(1)],profiles=[structuredClone(f.profiles.get(f.players[2].id)),structuredClone(f.profiles.get(f.players[3].id))];await f.send(0,{type:'queue'});await f.send(1,{type:'queue'});const match=[...f.game.matches.values()][0];assert.equal(match.state.players.length,2);
 for(const index of [2,3])assert.equal(f.last(index,'battle').battle?.id,match.state.id);
 await f.send(2,{type:'chat',channel:'room',text:'Watching both groups'});assert.equal(f.last(3,'chat').message.text,'Watching both groups');
 const actor=match.state.players.find(player=>player.id===match.state.turnId)!;for(const target of match.state.players)if(target.team!==actor.team)target.hp=0;await f.game.command(actor.id,{type:'pass'});
 for(const index of [2,3]){assert.equal(f.last(index,'battle').battle!.phase,'finished');await f.send(index,{type:'reward-pick',card:index});assert.match(f.last(index,'error').message,/assistindo/);}
 f.game.tick(match.state.rewards!.deadline+1);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.paid[0].sort(),f.players.slice(0,2).map(player=>player.id).sort());assert.equal(match.state.rewards!.cards.filter(card=>!!card.playerId).length,2);assert.ok(match.state.rewards!.cards.every(card=>card.prize));
 f.game.tick(match.state.rewards!.revealedAt!+2000);for(const [offset,index] of [2,3].entries()){assert.equal(f.last(index,'battle').battle,null);assert.equal(f.game.peers.get(f.players[index].id)!.roomId,originalRooms[offset].id);assert.equal(originalRooms[offset].status,'waiting');assert.deepEqual(originalRooms[offset].spectatorSlots,[0]);assert.equal(originalRooms[offset].spectators![0].id,f.players[index].id);assert.deepEqual(f.profiles.get(f.players[index].id),profiles[offset]);}
});

test('disconnect expiry releases only observer membership; last human leaving closes observers cleanly',async()=>{
 const f=fixture();await f.send(0,{type:'create'});const room=f.room();await f.send(0,{type:'room-spectator-slot',slot:0,open:true});await f.send(0,{type:'room-spectator-slot',slot:1,open:true});await f.send(2,{type:'spectate',roomId:room.id});await f.send(3,{type:'spectate',roomId:room.id});await f.send(0,{type:'queue'});
 f.game.disconnect(f.players[2].id);f.game.tick(Date.now()+30001);assert.equal(room.status,'searching');assert.equal(room.spectators!.length,1);assert.equal(room.players.length,1);assert.equal(f.game.peers.has(f.players[2].id),false);
 await f.send(0,{type:'leave'});assert.equal(f.game.rooms.has(room.id),false);assert.equal(f.game.peers.get(f.players[3].id)!.roomId,null);assert.equal(f.last(3,'room').room,null);assert.equal(f.last(3,'battle').battle,null);
 f.connect(3);assert.equal(f.last(3,'welcome').room,null);assert.equal(f.last(3,'welcome').battle,null);
});
