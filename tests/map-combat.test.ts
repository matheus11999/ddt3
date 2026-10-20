import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import type {Profile,ServerEvent} from '../shared/protocol';
import {crater,ground,supportBelow,unpackTerrain} from '../shared/physics';
import {VOLLEY_CADENCE_MS} from '../shared/combat';

async function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store:ProfileStore={saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store),players=['TERRA-A','TERRA-B'].map(name=>normalizeProfile({id:randomUUID(),name,gold:500}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 const [a,b]=players;await game.command(a.id,{type:'create',practice:true,name:'Terrain regression',mode:'1v1',map:'garden'});const roomId=game.peers.get(a.id)!.roomId!;
 await game.command(b.id,{type:'join',roomId});await game.command(b.id,{type:'ready'});await game.command(a.id,{type:'start'});
 const match=game.matches.get(roomId)!;match.state.wind=0;const shooter=match.state.players.find(player=>player.id===match.state.turnId)!;
 return {game,events,players,roomId,match,shooter};
}
function lastBattle(events:ServerEvent[]){return events.filter((event):event is Extract<ServerEvent,{type:'battle'}>=>event.type==='battle').at(-1)!.battle!;}

test('leaving players never receive a stale match after another player leaves',async()=>{
 const {game,events,players}=await fixture();const [a,b]=players;
 await game.command(a.id,{type:'leave'});assert.equal(game.peers.get(a.id)!.roomId,null);
 const mark=events.get(a.id)!.length;
 await game.command(b.id,{type:'leave'});
 assert.equal(events.get(a.id)!.slice(mark).some(e=>e.type==='battle'&&e.battle!==null),false);
});

test('the server rejects walking into a crate without consuming movement vigor',async()=>{
 const {game,match,shooter}=await fixture();shooter.x=496;shooter.y=ground(match.terrain,shooter.x);
 // A shorter step reaches the crate's foot (2 px, one vigor); after that the crate is a wall and nothing is charged.
 await game.command(shooter.id,{type:'walk',direction:1});assert.equal(shooter.x,498);(game as unknown as {peers:Map<string,{lastWalk:number}>}).peers.get(shooter.id)!.lastWalk=0;
 const before={x:shooter.x,y:shooter.y,stamina:shooter.stamina};
 await game.command(shooter.id,{type:'walk',direction:1});
 assert.deepEqual({x:shooter.x,y:shooter.y,stamina:shooter.stamina},before);
});

test('extra volleys use a fixed cadence before the first impact and terrain settles only at impact',async()=>{
 const {game,events,match,shooter}=await fixture();shooter.x=650;shooter.y=ground(match.terrain,650);shooter.hp=shooter.maxHp=10000;const before=match.terrain.slice();
 await game.command(shooter.id,{type:'boost',boost:'extra1'});await game.command(shooter.id,{type:'fire',angle:85,power:20});
 const shot=events.get(shooter.id)!.find((event):event is Extract<ServerEvent,{type:'shot'}>=>event.type==='shot')!.shot;
 assert.equal(shot.projectiles.length,2);const [first,second]=shot.projectiles;
 assert.equal(second.delay,VOLLEY_CADENCE_MS);assert.ok(second.delay<first.flightTime);assert.deepEqual(second.points[0],first.points[0]);assert.deepEqual(match.terrain,before);
 game.tick(shot.startedAt+first.flightTime-.001);assert.deepEqual(match.terrain,before);
 crater(before,first.impact.x,first.impact.y,first.impact.radius,'garden');
 const settled=supportBelow(before,shooter.x,first.points[0][1]+40-3);
 game.tick(shot.startedAt+first.flightTime);assert.equal(shooter.y,settled);assert.deepEqual(match.terrain,before);
 game.tick(match.resolveAt+1);assert.equal(shooter.y,supportBelow(match.terrain,shooter.x,settled-3));
});

test('resolution completion and battle end publish authoritative terrain snapshots',async()=>{
 const {game,events,players,match,shooter}=await fixture();
 await game.command(shooter.id,{type:'fire',angle:65,power:20});game.tick(match.resolveAt+1);
 for(const player of players){const battle=lastBattle(events.get(player.id)!);assert.equal(battle.phase,'aiming');assert.ok(battle.terrain);assert.deepEqual(unpackTerrain(Buffer.from(battle.terrain,'base64')),match.terrain);}
 await game.command(players[1].id,{type:'leave'});const finished=lastBattle(events.get(players[0].id)!);
 assert.equal(finished.phase,'finished');assert.ok(finished.terrain);assert.deepEqual(unpackTerrain(Buffer.from(finished.terrain,'base64')),match.terrain);
});
