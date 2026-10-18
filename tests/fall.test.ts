import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {WEAPONS} from '../shared/catalog';
import {createFall,FALL_GRAVITY,fallDuration,fallPosition,fallVelocity} from '../shared/fall';
import {trajectory,WORLD} from '../shared/physics';
import type {Profile,ServerEvent} from '../shared/protocol';
import {TURN_GAP_MS} from '../shared/combat';
import {REWARD_RESULT_MS} from '../shared/rewards';

async function fixture(lowerFloor=true){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),game=new Game({getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore,()=>{},()=>.99);
 const players=['Falling A','Falling B'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 await game.command(players[0].id,{type:'create',practice:true,mode:'1v1',map:'garden'});const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,[actor,target]=match.state.players;match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,190*WORLD.cols,191*WORLD.cols);if(lowerFloor)match.terrain.fill(1,260*WORLD.cols,261*WORLD.cols);
 Object.assign(actor,{x:300,y:570,hp:5000,maxHp:5000,aimSlope:0});Object.assign(target,{x:430,y:570,hp:5000,maxHp:5000,aimSlope:0});
 let aim:{angle:number;power:number}|undefined;for(let angle=15;angle<=85&&!aim;angle++)for(let power=5;power<=100;power++){const result=trajectory(match.terrain,actor,angle,power,0,WEAPONS[0],[target]);if(result.hitId===target.id&&(result.hitQuality??0)>.9){aim={angle,power};break;}}
 assert.ok(aim);for(const values of events.values())values.length=0;return {game,match,actor,target,players,events,aim};
}

test('fall samples share a deterministic gravity clock and a continuing fall preserves position and velocity',()=>{
 const fall=createFall(200,650,1000);assert.equal(fall.duration,Math.sqrt(2*450/FALL_GRAVITY)*1000);assert.equal(fallPosition(fall,999),200);assert.equal(fallVelocity(fall,1000),0);
 const at=1250,position=fallPosition(fall,at),velocity=fallVelocity(fall,at);assert.equal(position,256.25);assert.equal(velocity,450);
 const next=createFall(position,1014,at,true,velocity);assert.equal(fallPosition(next,at),position);assert.equal(fallVelocity(next,at),velocity);assert.ok(next.duration<fallDuration(1014-position));
 assert.equal(fallPosition(next,at+next.duration),1014);assert.equal(fallVelocity(next,at+next.duration),0);assert.equal(fallPosition(next,at+next.duration+1000),1014);assert.equal(fallDuration(0),0);
});

test('crater fall begins only at impact, survives reconnect and delays the next turn until landing',async()=>{
 const f=await fixture(),before=f.match.terrain.slice();await f.game.command(f.actor.id,{type:'fire',...f.aim});const impact=f.match.pendingImpacts![0],originalResolve=f.match.resolveAt;
 assert.equal(f.target.fall,undefined);assert.equal(f.target.y,570);assert.deepEqual(f.match.terrain,before);f.game.tick(impact.at-.001);assert.equal(f.target.fall,undefined);
 f.game.tick(impact.at);const fall=f.target.fall!;assert.ok(fall);assert.equal(fall.fromY,570);assert.equal(fall.toY,780);assert.equal(fall.startedAt,impact.at);assert.equal(fall.void,false);assert.equal(f.target.y,780);assert.ok(f.target.hp>0);assert.notDeepEqual(f.match.terrain,before);
 assert.ok(f.match.resolveAt>originalResolve);assert.equal(f.match.resolveAt,fall.startedAt+fall.duration+TURN_GAP_MS);f.game.tick(originalResolve+.001);assert.equal(f.match.state.phase,'resolving');
 const resumed:ServerEvent[]=[];f.game.disconnect(f.actor.id);f.game.connect(f.players[0],event=>resumed.push(structuredClone(event)));
 const welcome=resumed.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;assert.deepEqual(welcome.battle!.players.find(player=>player.id===f.target.id)!.fall,fall);
 f.game.tick(f.match.resolveAt+.001);assert.equal(f.match.state.phase,'aiming');assert.equal(f.match.state.turnId,f.target.id);
});

test('a second authoritative crater continues the current fall without a jump and postpones the result until exiting the map',async()=>{
 const f=await fixture();await f.game.command(f.actor.id,{type:'fire',...f.aim});const first=f.match.pendingImpacts![0];f.game.tick(first.at);const previous=structuredClone(f.target.fall!),at=first.at+80;
 const shot=f.match.activeShot!,firstProjectile=shot.projectiles[0],mark={...first.mark,id:`${shot.id}:1`,x:f.target.x,y:780};
 shot.projectiles.push({...firstProjectile,delay:firstProjectile.delay+80,impact:{...firstProjectile.impact,x:mark.x,y:mark.y}});
 f.match.pendingImpacts!.push({at,projectileIndex:1,hits:[],mark});f.game.tick(at-.001);assert.deepEqual(f.target.fall,previous);f.game.tick(at);
 const fall=f.target.fall!;assert.equal(fall.fromY,fallPosition(previous,at));assert.equal(fall.velocity,fallVelocity(previous,at));assert.ok(fall.velocity>0);assert.equal(fall.toY,WORLD.height+150);assert.equal(fall.void,true);
 assert.equal(f.target.hp,0);assert.equal(f.target.y,fall.toY);assert.equal(f.match.state.phase,'resolving');f.game.tick(f.match.resolveAt);assert.equal(f.match.state.phase,'finished');assert.equal(f.match.state.rewards!.opensAt,fall.startedAt+fall.duration+REWARD_RESULT_MS);
 const hits=f.events.get(f.actor.id)!.filter((event):event is Extract<ServerEvent,{type:'impact'}>=>event.type==='impact').flatMap(event=>event.hits);assert.ok(hits.some(hit=>hit.id===f.target.id&&hit.kind==='fall'));
 f.game.tick(at);assert.deepEqual(f.target.fall,fall,'duplicate ticks must not restart the fall');
});

test('void falls are authoritative at contact, remain visible on own reconnect and never expose concealed coordinates',async()=>{
 const f=await fixture(false);f.target.invisibleTurns=3;await f.game.command(f.actor.id,{type:'fire',...f.aim});const at=f.match.pendingImpacts![0].at;
 assert.equal(f.target.hp,5000);assert.equal(f.match.state.rewards,undefined);f.game.tick(at);assert.equal(f.target.hp,0);assert.equal(f.target.fall!.void,true);
 for(const [index,player] of f.players.entries()){
  const events:ServerEvent[]=[];f.game.disconnect(player.id);f.game.connect(player,event=>events.push(structuredClone(event)));const welcome=events.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;
  const target=welcome.battle!.players.find(fighter=>fighter.id===f.target.id)!;if(index===0){assert.equal(target.hidden,true);assert.equal(target.fall,undefined);}else assert.deepEqual(target.fall,f.target.fall);
 }
});

test('walking off a ledge publishes a falling body and delays result presentation beyond its exit',async()=>{
 const f=await fixture(false),nextColumn=Math.floor((f.actor.x+8)/WORLD.cell);f.match.terrain[190*WORLD.cols+nextColumn]=0;
 await f.game.command(f.actor.id,{type:'walk',direction:1});assert.equal(f.actor.hp,0);assert.equal(f.actor.fall!.fromY,570);assert.equal(f.actor.fall!.toY,WORLD.height+150);assert.equal(f.actor.fall!.void,true);
 assert.equal(f.match.state.phase,'finished');assert.equal(f.match.state.rewards!.opensAt,f.actor.fall!.startedAt+f.actor.fall!.duration+REWARD_RESULT_MS);
});

test('walking falls reject turn actions until landing, then an uphill step clears the completed fall',async t=>{
 const f=await fixture(),column=Math.floor((f.actor.x+8)/WORLD.cell);let now=Date.now();t.mock.method(Date,'now',()=>now);
 f.match.terrain[190*WORLD.cols+column]=0;await f.game.command(f.actor.id,{type:'walk',direction:1});
 const fall=structuredClone(f.actor.fall!);assert.ok(fall);assert.equal(f.actor.y,780);assert.equal(f.match.state.phase,'aiming');const before=structuredClone(f.actor),phase=f.match.state.phase;
 for(const command of [{type:'walk',direction:1},{type:'fire',angle:45,power:25},{type:'aim',angle:45,power:25,charging:true},{type:'boost',boost:'damage20'},{type:'ability',ability:'heal'},{type:'flight',active:true},{type:'power'},{type:'pass'}] as const){
  await f.game.command(f.actor.id,command);assert.deepEqual(f.actor,before);assert.equal(f.match.state.phase,phase);
  const error=f.events.get(f.actor.id)!.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error').at(-1)!;assert.match(error.message,/pousar/);
 }
 now=fall.startedAt+fall.duration+1;const nextX=f.actor.x+8,nextColumn=Math.floor(nextX/WORLD.cell);f.match.terrain[258*WORLD.cols+nextColumn]=1;
 await f.game.command(f.actor.id,{type:'walk',direction:1});assert.equal(f.actor.x,nextX);assert.equal(f.actor.y,774);assert.equal(f.actor.fall,undefined);assert.equal(f.actor.stamina,before.stamina-3);
});

test('settling clears an expired fall on unchanged support and preserves a still-active fall there',async()=>{
 for(const active of [false,true]){
  const f=await fixture();f.actor.fall=createFall(450,570,Date.now()-1000);
  await f.game.command(f.actor.id,{type:'fire',...f.aim});
  // An already flying projectile can meet unchanged support while another player
  // is falling. Start that fall after launch but before the queued impact.
  if(active)f.actor.fall=createFall(450,570,f.match.pendingImpacts![0].at-40);
  const fall=structuredClone(f.actor.fall!),at=f.match.pendingImpacts![0].at;f.game.tick(at);
  assert.equal(f.actor.y,570);if(active)assert.deepEqual(f.actor.fall,fall);else assert.equal(f.actor.fall,undefined);
 }
});

test('every shot holds the turn for the pause after its last impact before the next turn opens',async()=>{
 const f=await fixture();await f.game.command(f.actor.id,{type:'fire',...f.aim});const shot=f.match.activeShot!,end=shot.startedAt+shot.duration;
 assert.ok(f.match.resolveAt>=end+TURN_GAP_MS);f.game.tick(end+TURN_GAP_MS-1);assert.equal(f.match.state.phase,'resolving');assert.equal(f.match.state.turnId,f.actor.id);
 f.game.tick(f.match.resolveAt+.001);assert.notEqual(f.match.state.turnId,f.actor.id);
});
