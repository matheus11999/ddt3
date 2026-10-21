import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Game} from '../server/game';
import {WORLD} from '../shared/physics';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {commandSchema} from '../shared/protocol';
import type {ServerEvent} from '../shared/protocol';
import {addPower,damageCharge,POWER_ATTACK_CHARGE,POWER_CUT_IN_MS,POWER_MAX,POWER_PASS_CHARGE,powerPercent} from '../shared/power';
import {criticalBonusMultiplier} from '../shared/stats';
import {attributes} from '../shared/catalog';
import type {Fighter} from '../shared/protocol';
import type {BoostId} from '../shared/catalog';

async function fixture(roll=.99){
 const events:ServerEvent[]=[],store={getProfile:async()=>null,finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store,()=>{},()=>roll);
 const players=['Power Um','Power Dois'].map(name=>normalizeProfile({id:randomUUID(),name}));
 for(const player of players)game.connect(player,event=>events.push(structuredClone(event)));
 await game.command(players[0].id,{type:'create',practice:true,name:'Power teste',mode:'1v1',map:'garden'});
 const roomId=game.peers.get(players[0].id)!.roomId!;
 await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players.find(p=>p.id===match.state.turnId)!,target=match.state.players.find(p=>p.id!==shooter.id)!;
 return {game,match,shooter,target,events};
}

test('raiva is whole points 0–200: damage taken follows DDTank TakeDamage, gains above 200 are dropped',()=>{
 assert.equal(POWER_MAX,200);assert.equal(POWER_ATTACK_CHARGE,20);assert.equal(POWER_PASS_CHARGE,40);
 assert.deepEqual([100,300,500].map(damageCharge),[22,62,102]);
 assert.deepEqual([0,-5,NaN].map(damageCharge),[0,0,0]);
 const f={hp:10,powerCharge:190};assert.equal(addPower(f,40),10);assert.equal(f.powerCharge,200);
 const dead={hp:0,powerCharge:50};assert.equal(addPower(dead,40),0);assert.equal(dead.powerCharge,50);
 assert.equal(powerPercent(199),99,'never shows 100% before the real 200');assert.equal(powerPercent(200),100);assert.equal(powerPercent(20),10);
 assert.equal(commandSchema.safeParse({type:'power',damage:9999}).success,false);
});

test('Power activation requires full charge and own living turn; duplicate consumes nothing',async()=>{
 const f=await fixture();f.target.powerCharge=200;
 await f.game.command(f.target.id,{type:'power'});assert.equal(f.target.powerCharge,200);assert.equal(f.target.powerArmed,false);
 await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerArmed,false);
 f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
 await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
});

test('Power holds all damage and projectiles until cut-in completes then fires exactly once',async()=>{
 const f=await fixture();f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});
 const before=f.match.state.players.map(p=>p.hp),terrain=f.match.terrain.slice();
 await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});
 assert.ok(f.match.state.powerCutIn);assert.equal(f.match.state.phase,'resolving');assert.deepEqual(f.match.state.players.map(p=>p.hp),before);assert.deepEqual(f.match.terrain,terrain);
 assert.equal(f.events.filter(e=>e.type==='shot').length,0);
 await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});await f.game.command(f.shooter.id,{type:'pass'});
 const end=f.match.state.powerCutIn!.endsAt;
 f.game.tick(end-1);assert.equal(f.events.filter(e=>e.type==='shot').length,0);
 f.game.tick(end);const shots=f.events.filter(e=>e.type==='shot');assert.equal(shots.length,2); // one event per peer
 assert.ok(shots.every(e=>e.type==='shot'&&e.shot.powered&&e.shot.projectiles.every(p=>p.powered)));
 assert.equal(f.match.state.powerCutIn,undefined);assert.equal(f.shooter.powerArmed,false);
 f.game.tick(end+1);assert.equal(f.events.filter(e=>e.type==='shot').length,2);
 assert.ok(POWER_CUT_IN_MS>=1000);
});

test('unused activation expires on pass and timeout, while stored charge persists between turns',async()=>{
 const f=await fixture();f.shooter.powerCharge=200;f.target.powerCharge=42;
 await f.game.command(f.shooter.id,{type:'power'});await f.game.command(f.shooter.id,{type:'pass'});
 assert.equal(f.shooter.powerArmed,false);assert.equal(f.shooter.powerCharge,POWER_PASS_CHARGE,'a pass after arming still earns its 40');assert.equal(f.target.powerCharge,42);
 f.target.powerCharge=200;await f.game.command(f.target.id,{type:'power'});f.game.tick(f.match.state.deadline+1);
 assert.equal(f.target.powerArmed,false);assert.equal(f.target.powerCharge,POWER_PASS_CHARGE,'the timeout is the client skip of DDTank');
});

test('leaving during Power cut-in cancels the pending shot and cannot damage after finish',async()=>{
 const f=await fixture();f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});await f.game.command(f.shooter.id,{type:'fire',angle:45,power:40});
 const end=f.match.state.powerCutIn!.endsAt;await f.game.command(f.shooter.id,{type:'leave'});f.game.tick(end);
 assert.equal(f.match.state.phase,'finished');assert.equal(f.match.pendingPower,undefined);assert.equal(f.events.filter(e=>e.type==='shot').length,0);
});

test('Power deals greater actual enemy damage and charges both combatants without changing equipment',async()=>{
 const run=async(powered:boolean)=>{
  const f=await fixture();f.match.state.wind=0;
  // A nearby opponent intersects the launch arc, making the comparison deterministic.
  f.shooter.x=300;f.shooter.y=500;f.shooter.facing=1;f.target.x=365;f.target.y=490;
  f.match.terrain.fill(0);f.match.terrain.fill(1,510*WORLD.cols);
  if(powered){f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});}
  await f.game.command(f.shooter.id,{type:'fire',angle:25,power:20});
  if(powered)f.game.tick(f.match.state.powerCutIn!.endsAt);
  const shot=f.events.find(e=>e.type==='shot');assert.ok(shot&&shot.type==='shot');
  assert.equal(shot.shot.hits.length,0);assert.equal(f.shooter.powerCharge,0);assert.equal(f.target.powerCharge,0);
  f.game.tick(f.match.resolveAt+1);
  const damage=f.events.filter((e):e is Extract<ServerEvent,{type:'impact'}>=>e.type==='impact').flatMap(e=>e.hits).filter(h=>h.id===f.target.id).reduce((sum,h)=>sum+h.damage,0)/2;
  assert.ok(damage>0);assert.ok((f.shooter.powerCharge??0)>0);assert.ok((f.target.powerCharge??0)>0); // the shooter also takes splash at this range, so its charge can be the larger one
  assert.equal(f.shooter.equipment.upgrade,0);
  return {damage,shot:shot.shot};
 };
 const normal=await run(false),powered=await run(true);assert.ok(powered.damage>normal.damage*1.5);assert.ok(powered.shot.projectiles[0].impact.radius>normal.shot.projectiles[0].impact.radius);
});

test('damage from any source charges the target Power: own shot charges only as received damage',async()=>{
 const f=await fixture();f.match.state.wind=0;
 // Straight up with little force: the shot falls back on the shooter.
 f.shooter.x=300;f.shooter.y=500;f.shooter.facing=1;f.target.x=1400;f.target.y=500;
 f.match.terrain.fill(0);f.match.terrain.fill(1,510*WORLD.cols);
 await f.game.command(f.shooter.id,{type:'fire',angle:90,power:15});
 f.game.tick(f.match.resolveAt+1);
 const taken=f.events.filter((e):e is Extract<ServerEvent,{type:'impact'}>=>e.type==='impact').flatMap(e=>e.hits).filter(h=>h.id===f.shooter.id).reduce((sum,h)=>sum+h.damage,0)/2;
 assert.ok(taken>0&&f.shooter.hp>0);assert.equal(f.target.powerCharge??0,0);
 const own=landed(f).filter(h=>h.id===f.shooter.id);
 assert.equal(f.shooter.powerCharge,Math.min(POWER_MAX,own.reduce((sum,h)=>sum+damageCharge(h.damage),0)+POWER_ATTACK_CHARGE));
});

/** Every hit that landed, once (impact events go to both peers). */
function landed(f:Awaited<ReturnType<typeof fixture>>){const seen=new Set<string>();return f.events.filter((e):e is Extract<ServerEvent,{type:'impact'}>=>e.type==='impact').filter(e=>{const key=`${e.shotId}:${e.projectileIndex}`;if(seen.has(key))return false;seen.add(key);return true;}).flatMap(e=>e.hits);}
/** A flat floor at y=510, no wind, the shooter at x=300 facing right. */
async function flat(roll=.99){
 const f=await fixture(roll);f.match.state.wind=0;f.match.terrain.fill(0);f.match.terrain.fill(1,510*WORLD.cols);
 Object.assign(f.shooter,{x:300,y:510,facing:1,hp:5000,maxHp:5000,stamina:1000,maxStamina:1000});Object.assign(f.target,{x:1400,y:510,hp:5000,maxHp:5000});
 return f;
}
/** Fires and lets every projectile land (the ticks the server would run), before the turn ends. */
async function shoot(f:Awaited<ReturnType<typeof fixture>>,angle:number,power:number,boosts:BoostId[]=[]){
 for(const boost of boosts)await f.game.command(f.shooter.id,{type:'boost',boost});
 await f.game.command(f.shooter.id,{type:'fire',angle,power});
 if(f.match.state.powerCutIn)f.game.tick(f.match.state.powerCutIn.endsAt);
 const shot=f.match.activeShot!;for(const impact of [...f.match.pendingImpacts??[]])f.game.tick(impact.at);
 return shot;
}
/** Another fighter on the field (an ally or an enemy), a copy of an existing one. */
function extra(f:Awaited<ReturnType<typeof fixture>>,from:Fighter,x:number){const copy={...structuredClone(from),id:randomUUID(),x,y:510,hp:5000,maxHp:5000,powerCharge:0};f.match.state.players.push(copy);return copy;}
const chargeOf=(hits:{id:string;damage:number}[],id:string)=>Math.min(POWER_MAX,hits.filter(h=>h.id===id).reduce((sum,h)=>sum+damageCharge(h.damage),0));

test('a missed shot earns 20, once, only after the launches end',async()=>{
 const f=await flat();await f.game.command(f.shooter.id,{type:'fire',angle:45,power:30});
 assert.equal(f.shooter.powerCharge,0,'nothing while the projectile flies');
 const shot=f.match.activeShot!;for(const impact of [...f.match.pendingImpacts!])f.game.tick(impact.at);
 assert.deepEqual(shot.hits,[]);assert.equal(f.shooter.powerCharge,POWER_ATTACK_CHARGE);assert.equal(f.target.powerCharge,0);
 f.game.tick(f.match.resolveAt+1);assert.equal(f.shooter.powerCharge,POWER_ATTACK_CHARGE,'the end of the turn adds nothing more');
});

test('+1, +2 and Tridente launch several projectiles but earn the attack raiva once',async()=>{
 for(const boosts of [['extra1'],['extra2'],['trident'],['extra1','trident']] as BoostId[][]){
  const f=await flat();const shot=await shoot(f,45,30,boosts);assert.ok(shot.projectiles.length>1);assert.deepEqual(shot.hits,[]);
  f.game.tick(f.match.resolveAt+1);assert.equal(f.shooter.powerCharge,POWER_ATTACK_CHARGE,boosts.join('+'));
 }
});

test('hitting several enemies gives the shooter nothing more; each surviving victim charges from its own damage',async()=>{
 const f=await flat();Object.assign(f.target,{x:365});const second=extra(f,f.target,380);
 await shoot(f,25,20,['trident']);const hits=landed(f);
 assert.ok(hits.some(h=>h.id===f.target.id)&&hits.some(h=>h.id===second.id),'both enemies are hit');
 assert.equal(f.target.powerCharge,chargeOf(hits,f.target.id));assert.equal(second.powerCharge,chargeOf(hits,second.id));
 assert.equal(f.shooter.powerCharge,Math.min(POWER_MAX,chargeOf(hits,f.shooter.id)+POWER_ATTACK_CHARGE),'only its own splash and the 20 of the attack');
});

test('a critical charges from the hit without its critical part',async()=>{
 const f=await flat(0);Object.assign(f.target,{x:365});
 await shoot(f,25,20);
 const hit=landed(f).find(h=>h.id===f.target.id)!;assert.ok(hit.critical&&f.target.hp>0);
 const base=Math.floor(hit.damage/(1+criticalBonusMultiplier(attributes(f.shooter.equipment,f.shooter.level).luck)));
 assert.equal(f.target.powerCharge,damageCharge(base));assert.notEqual(f.target.powerCharge,damageCharge(hit.damage));
});

test('own and ally damage charge the survivor; a frozen (rejected) hit or a death charges nothing',async()=>{
 const f=await flat();const ally=extra(f,f.shooter,330);
 await shoot(f,90,15);const hits=landed(f);
 assert.ok(hits.some(h=>h.id===ally.id),'the ally is hit');assert.ok(ally.hp>0);assert.equal(ally.powerCharge,chargeOf(hits,ally.id));assert.ok((ally.powerCharge??0)>0);
 const g=await flat();Object.assign(g.target,{x:365,frozenTurns:2});await shoot(g,25,20);
 assert.equal(g.target.frozenTurns,0,'the hit only broke the ice');assert.equal(g.target.powerCharge,0);
 const d=await flat();Object.assign(d.target,{x:365,hp:1});await shoot(d,25,20);
 assert.equal(d.target.hp,0);assert.equal(d.target.powerCharge,0);
});

test('a shooter killed by its own shot gets no attack raiva',async()=>{
 const f=await flat();f.shooter.hp=1;await shoot(f,90,15);f.game.tick(f.match.resolveAt+1);
 assert.equal(f.shooter.hp,0);assert.equal(f.shooter.powerCharge,0);
});

test('a pass earns 40 and no attack raiva; a repeated pass does nothing',async()=>{
 const f=await flat();const id=f.shooter.id;await f.game.command(id,{type:'pass'});
 assert.equal(f.shooter.powerCharge,POWER_PASS_CHARGE);
 if(f.match.state.turnId!==id){await f.game.command(id,{type:'pass'});assert.equal(f.shooter.powerCharge,POWER_PASS_CHARGE);}
 f.game.tick(f.match.resolveAt+1);assert.equal(f.shooter.powerCharge,POWER_PASS_CHARGE);
});

test('a disconnected player whose time runs out does not earn the pass raiva',async()=>{
 const f=await flat();f.shooter.connected=false;f.game.tick(f.match.state.deadline+1);assert.equal(f.shooter.powerCharge,0);
});

test('invalid activation consumes nothing; a valid one empties the bar at once and a POW shot starts again at 20',async()=>{
 const f=await flat();f.shooter.powerCharge=199;await f.game.command(f.shooter.id,{type:'power'});
 assert.equal(f.shooter.powerCharge,199);assert.equal(f.shooter.powerArmed,false);
 f.target.powerCharge=200;await f.game.command(f.target.id,{type:'power'});assert.equal(f.target.powerCharge,200);assert.equal(f.target.powerArmed,false,'not their turn');
 f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
 await f.game.command(f.shooter.id,{type:'power'});assert.equal(f.shooter.powerCharge,0);assert.equal(f.shooter.powerArmed,true);
 const shot=await shoot(f,45,30);assert.ok(shot.powered);assert.deepEqual(shot.hits,[]);
 assert.equal(f.shooter.powerCharge,POWER_ATTACK_CHARGE,'nothing spent again at launch; the POW attack earns its 20');
});

test('raiva and the armed POW survive a restart',async()=>{
 const f=await flat();f.shooter.powerCharge=200;await f.game.command(f.shooter.id,{type:'power'});f.target.powerCharge=137;
 const saved=f.game.savedState(),store={getProfile:async()=>null,finishMatch:async()=>{}} as unknown as ProfileStore,next=new Game(store,()=>{},()=>.99);
 next.restore(saved.game,saved.matches.flatMap(m=>m.stable?[{match:m.match,terrain:m.terrain}]:[]));
 const players=[...next.matches.values()][0].state.players,me=players.find(p=>p.id===f.shooter.id)!;
 assert.equal(me.powerArmed,true);assert.equal(me.powerCharge,0);assert.equal(players.find(p=>p.id===f.target.id)!.powerCharge,137);
});
