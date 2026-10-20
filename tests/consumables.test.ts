import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {ICE_FROZEN_TURNS,iceTargets,RAGE_CHARGE} from '../shared/ice';
import {powerUpConflict} from '../shared/powerUps';
import type {Profile,ServerEvent,Shot} from '../shared/protocol';
import {WORLD} from '../shared/physics';

async function battle(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>.99),players=[0,1].map(i=>normalizeProfile({id:randomUUID(),name:`Gelo ${i}`}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 await game.command(players[0].id,{type:'create',practice:true,name:'Gelo',mode:'1v1',map:'celestial'});const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!;match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,600*WORLD.cols);
 for(const [index,fighter] of match.state.players.entries())Object.assign(fighter,{x:300+index*500,y:600,hp:5000,maxHp:5000,delay:0});
 const shooter=match.state.players.find(player=>player.id===match.state.turnId)!,target=match.state.players.find(player=>player.id!==shooter.id)!;
 const errors=()=>events.get(shooter.id)!.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error').map(event=>event.message);
 const internals=game as unknown as {applyImpact(m:unknown,i:unknown):void;nextTurn(m:unknown):void};
 return {game,match,shooter,target,errors,applyImpact:(i:unknown)=>internals.applyImpact(match,i),nextTurn:()=>internals.nextTurn(match)};
}

test('Enfurecer adds 50 POW points (DDTank AddDander 100 of 200), costs 120 Vigor and 450 Delay, and stops at a full bar',async()=>{
 const f=await battle();f.shooter.powerCharge=30;const vigor=f.shooter.stamina,delay=f.shooter.delay!;
 await f.game.command(f.shooter.id,{type:'boost',boost:'rage'});
 assert.equal(f.shooter.powerCharge,30+RAGE_CHARGE);assert.equal(f.shooter.stamina,vigor-120);assert.equal(f.shooter.delay,delay+450);assert.equal(f.shooter.powerArmed,false,'using the POW is its own action');
 f.shooter.stamina=1000;await f.game.command(f.shooter.id,{type:'boost',boost:'rage'});assert.equal(f.shooter.powerCharge,100);
 await f.game.command(f.shooter.id,{type:'boost',boost:'rage'});assert.match(f.errors().at(-1)!,/já está cheia/);assert.equal(f.shooter.boosts.filter(id=>id==='rage').length,2);
});

test('Gelo replaces the shot: no other tool, no POW, no homing; Enfurecer still fits',async()=>{
 assert.match(powerUpConflict(['extra1'],'ice')!,/gelo/i);assert.match(powerUpConflict(['ice'],'damage50')!,/gelo/i);assert.match(powerUpConflict(['ice'],'ice')!,/já foi usado/);
 assert.equal(powerUpConflict(['rage'],'ice'),undefined);assert.equal(powerUpConflict(['ice'],'rage'),undefined);
 const f=await battle();f.shooter.powerCharge=100;f.shooter.stamina=1000;
 await f.game.command(f.shooter.id,{type:'power'});await f.game.command(f.shooter.id,{type:'boost',boost:'ice'});assert.match(f.errors().at(-1)!,/POW/);assert.deepEqual(f.shooter.boosts,[]);
});

test('ice ball: one projectile, no crater, no damage; enemies it touches freeze, allies do not',async()=>{
 const f=await battle();f.shooter.stamina=1000;const terrain=Uint8Array.from(f.match.terrain);
 await f.game.command(f.shooter.id,{type:'boost',boost:'ice'});await f.game.command(f.shooter.id,{type:'fire',angle:60,power:40});
 const shot=f.match.activeShot!;assert.equal(shot.projectiles.length,1);assert.equal(shot.projectiles[0].kind,'ice');
 const impact=f.match.pendingImpacts![0];Object.assign(f.target,{x:impact.mark.x,y:impact.mark.y+30});
 f.applyImpact(impact);
 assert.equal(f.target.frozenTurns,ICE_FROZEN_TURNS);assert.equal(f.target.hp,5000);assert.equal(f.shooter.frozenTurns??0,0);
 assert.deepEqual(f.match.terrain,terrain,'Ball1 has no crater');
 assert.equal(iceTargets([{team:1,hp:1,x:0,y:0,boss:'dragon'}],0,{x:0,y:-20}).length,0,'the world boss never freezes');
});

test('a frozen fighter loses 2 turns, then thaws and plays',async()=>{
 const f=await battle();f.target.frozenTurns=ICE_FROZEN_TURNS;f.match.state.phase='resolving';const seen:number[]=[];
 for(let n=0;n<8&&f.match.state.turnId!==f.target.id;n++){f.shooter.delay=(f.shooter.delay??0)+600;f.nextTurn();seen.push(f.target.frozenTurns??0);}
 assert.equal(f.match.state.turnId,f.target.id,'the ice thaws and the fighter plays');assert.equal(f.target.frozenTurns,0);
 assert.ok(seen.includes(0)&&!seen.slice(0,-1).includes(0),'never played while frozen');
 // Each own turn start took one: 3 → 2 → 1 skipped, 0 plays.
 const f2=await battle();f2.target.frozenTurns=ICE_FROZEN_TURNS;f2.shooter.delay=99999;f2.match.state.phase='resolving';f2.nextTurn();
 assert.equal(f2.match.state.turnId,f2.target.id,'with nobody else ready the two frozen turns pass and it plays');assert.equal(f2.target.frozenTurns,0);
});

test('frozen fighters take no damage: the first attack only breaks the ice, the rest of that shot too',async()=>{
 const f=await battle();f.target.frozenTurns=ICE_FROZEN_TURNS;f.match.state.phase='resolving';
 const hit=(index:number)=>({at:Date.now(),projectileIndex:index,hits:[{id:f.target.id,damage:700,x:f.target.x,y:f.target.y,projectileIndex:index,critical:false,kind:'direct',quality:1}],mark:{id:`m${index}`,x:f.target.x,y:f.target.y,radius:0,effect:'brick',level:0}});
 const shot=(id:string):Shot=>({id,shooterId:f.shooter.id,startedAt:Date.now(),duration:1000,hits:[],impacted:[],projectiles:[0,1].map(()=>({points:[[0,0]],delay:0,flightTime:0,impact:{x:f.target.x,y:f.target.y,radius:0},effect:'brick' as const}))});
 f.match.activeShot=shot('first');f.applyImpact(hit(0));assert.equal(f.target.hp,5000);assert.equal(f.target.frozenTurns,0);
 f.applyImpact(hit(1));assert.equal(f.target.hp,5000,'same shot: still spent on the ice');
 f.match.activeShot=shot('second');f.applyImpact(hit(0));assert.equal(f.target.hp,4300);
});
