import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {HIDDEN_POSITION,homingTargets,initialAbilities} from '../shared/abilities';
import {FLIGHT_AIM,weaponAimLimits} from '../shared/aim';
import {WEAPONS} from '../shared/catalog';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';
import {createTerrain,flightLanding,ground,terrainWidth,trajectory,volley,WORLD} from '../shared/physics';
import {getMap} from '../shared/maps';
import {createFall} from '../shared/fall';

async function fixture(count=2){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>(),store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>.99),players=Array.from({length:count},(_,i)=>normalizeProfile({id:randomUUID(),name:`Ability ${i}`}));
 for(const player of players){profiles.set(player.id,player);events.set(player.id,[]);game.connect(player,event=>events.get(player.id)!.push(structuredClone(event)));}
 await game.command(players[0].id,{type:'create',practice:true,name:'Ability rules',mode:count===4?'2v2':'1v1',map:'celestial'});const roomId=game.peers.get(players[0].id)!.roomId!;
 for(const player of players.slice(1)){await game.command(player.id,{type:'join',roomId});await game.command(player.id,{type:'ready'});}await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!;match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,600*WORLD.cols);
 for(const [index,fighter] of match.state.players.entries())Object.assign(fighter,{x:300+index*200,y:600,hp:5000,maxHp:5000});
 const actor=match.state.players.find(player=>player.id===match.state.turnId)!,enemy=match.state.players.find(player=>player.team!==actor.team)!,ally=match.state.players.find(player=>player.team===actor.team&&player.id!==actor.id);
 const error=(id=actor.id)=>events.get(id)!.filter((event):event is Extract<ServerEvent,{type:'error'}>=>event.type==='error').at(-1)?.message;
 const latest=(id=actor.id)=>events.get(id)!.filter((event):event is Extract<ServerEvent,{type:'battle'}>=>event.type==='battle').at(-1)!.battle!;
 for(const list of events.values())list.length=0;return {game,players,events,match,actor,enemy,ally,error,latest};
}

test('abilities reject forged uses, amounts, positions and unsupported commands',()=>{
 for(const value of [{type:'ability',ability:'heal',amount:9999},{type:'ability',ability:'flight'},{type:'ability',ability:'heal',uses:20},{type:'flight',active:true,x:800},{type:'flight',active:1},{type:'practice-start',map:'celestial'}])assert.equal(commandSchema.safeParse(value).success,false);
 for(const ability of ['heal','homing','invisibility'])assert.equal(commandSchema.safeParse({type:'ability',ability}).success,true);
 assert.equal(commandSchema.safeParse({type:'create'}).success,true);assert.equal(commandSchema.safeParse({type:'flight',active:false}).success,true);
});

test('healing is one use, capped at maximum HP, and invalid attempts consume nothing',async()=>{
 const f=await fixture();assert.deepEqual(f.actor.abilities,initialAbilities());
 await f.game.command(f.actor.id,{type:'ability',ability:'heal'});assert.match(f.error()!,/completa/);assert.equal(f.actor.abilities!.heal,1);
 f.actor.hp-=125;await f.game.command(f.enemy.id,{type:'ability',ability:'heal'});assert.equal(f.enemy.abilities!.heal,1);assert.match(f.error(f.enemy.id)!,/sua vez/);
 await f.game.command(f.actor.id,{type:'ability',ability:'heal'});assert.equal(f.actor.hp,f.actor.maxHp);assert.equal(f.actor.abilities!.heal,0);
 const effect=f.events.get(f.actor.id)!.find((event):event is Extract<ServerEvent,{type:'ability-effect'}>=>event.type==='ability-effect')!;assert.equal(effect.amount,125);
 f.actor.hp-=1000;await f.game.command(f.actor.id,{type:'ability',ability:'heal'});assert.equal(f.actor.hp,f.actor.maxHp-1000);assert.match(f.error()!,/já foi usada/);
 const other=await fixture();other.actor.hp-=800;await other.game.command(other.actor.id,{type:'ability',ability:'heal'});assert.equal(other.actor.hp,other.actor.maxHp-500);
});

test('homing consumes once when armed, expires without firing and cannot be changed in resolution',async()=>{
 const f=await fixture();await f.game.command(f.actor.id,{type:'ability',ability:'homing'});assert.equal(f.actor.abilities!.homing,0);assert.equal(f.actor.homingArmed,true);
 await f.game.command(f.actor.id,{type:'ability',ability:'homing'});assert.match(f.error()!,/já foi usada/);
 await f.game.command(f.actor.id,{type:'pass'});assert.equal(f.actor.homingArmed,false);assert.equal(f.actor.abilities!.homing,0);
 await f.game.command(f.enemy.id,{type:'fire',angle:45,power:25});const before=structuredClone(f.enemy);
 await f.game.command(f.enemy.id,{type:'ability',ability:'invisibility'});assert.deepEqual(f.enemy,before);assert.match(f.error(f.enemy.id)!,/próximo turno/);
});

test('homing magnet also targets invisible enemies but never allies or the dead',async()=>{
 const f=await fixture(4),shooter=f.actor,players=f.match.state.players,enemies=players.filter(p=>p.team!==shooter.team);
 enemies[0].invisibleTurns=2;enemies[1].hp=0;
 assert.deepEqual(homingTargets(players,shooter).map(p=>p.id),[enemies[0].id]);
});

test('homing magnet locks onto an enemy the projectile passes near and curves into it',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:300,y:600,facing:1},weapon=WEAPONS[0];
 const base=trajectory(terrain,origin,60,45,0,weapon),apex=base.points.reduce((best,p,i)=>p[1]<base.points[best][1]?i:best,0),point=base.points[apex];
 // An enemy 180 below the apex is never touched by the plain arc, but the magnet pulls the shot into it.
 const target={id:'assist',x:point[0]+60,y:point[1]+180+31,hp:100};assert.equal(volley(terrain,origin,[60],45,0,weapon,[target])[0].hitId,undefined);
 const result=volley(terrain,origin,[60,60],45,0,weapon,[target],undefined,[0,0],{projectileIndex:0,targets:[target]});
 assert.equal(result[0].hitId,'assist');assert.ok((result[0].hitQuality??0)>.9,'a locked shot lands near the centre of the hitbox');
 assert.notEqual(result[1].hitId,'assist','projectileIndex limits guidance to one projectile');
 // Server shots guide every projectile of the turn: a Trident-like spread plus a delayed +1 volley all lock on.
 const spread=[56,60,64,56,60,64],all=volley(terrain,origin,spread,45,0,weapon,[target],undefined,[0,0,0,300,300,300],{targets:[target]});
 assert.deepEqual(all.map(r=>r.hitId),spread.map(()=>'assist'));
 // The lock survives wind: a strong headwind still cannot pull a locked projectile away.
 assert.equal(volley(terrain,origin,[60],45,-6,weapon,[target],undefined,[],{projectileIndex:0,targets:[target]})[0].hitId,'assist');
 // Out of range or dead enemies are never acquired.
 const far=volley(terrain,origin,[60],45,0,weapon,[],undefined,[],{projectileIndex:0,targets:[{...target,x:1400}]})[0];assert.deepEqual(far,base);
 assert.deepEqual(volley(terrain,origin,[60],45,0,weapon,[],undefined,[],{projectileIndex:0,targets:[{...target,hp:0}]})[0],base);
 // Terrain still blocks a locked projectile.
 const wall=terrain.slice(),wallX=Math.ceil(point[0]+30);for(let row=0;row<WORLD.rows;row++)wall[row*WORLD.cols+wallX]=1;
 const blocked=volley(wall,origin,[60],45,0,weapon,[target],undefined,[],{projectileIndex:0,targets:[target]})[0];assert.equal(blocked.hitId,undefined);assert.ok(blocked.points.every(p=>p[0]<wallX));
});

test('invisibility redacts snapshots, aims, effects, shot origins and reconnect while allies retain coordinates',async()=>{
 const f=await fixture(4);await f.game.command(f.actor.id,{type:'ability',ability:'invisibility'});
 const concealed=f.latest(f.enemy.id).players.find(player=>player.id===f.actor.id)!;assert.equal(concealed.hidden,true);assert.equal(concealed.x,HIDDEN_POSITION);assert.equal(concealed.y,HIDDEN_POSITION);assert.equal(concealed.aimAngle,undefined);
 const ally=f.latest(f.ally!.id).players.find(player=>player.id===f.actor.id)!;assert.equal(ally.x,f.actor.x);assert.equal(ally.hidden,undefined);assert.equal(ally.invisibleTurns,3);
 await f.game.command(f.actor.id,{type:'aim',angle:50,power:60,charging:true});const aimed=f.latest(f.enemy.id).players.find(player=>player.id===f.actor.id)!;assert.equal(aimed.aimAngle,undefined);assert.equal(aimed.chargePower,undefined);assert.equal(aimed.charging,undefined);
 f.actor.hp-=700;await f.game.command(f.actor.id,{type:'ability',ability:'heal'});
 const effects=f.events.get(f.enemy.id)!.filter((event):event is Extract<ServerEvent,{type:'ability-effect'}>=>event.type==='ability-effect');assert.ok(effects.length>=2);for(const effect of effects){assert.equal(effect.hidden,true);assert.equal(effect.x,HIDDEN_POSITION);assert.equal(effect.y,HIDDEN_POSITION);}
 await f.game.command(f.actor.id,{type:'fire',angle:60,power:35});
 const shot=f.events.get(f.enemy.id)!.find((event):event is Extract<ServerEvent,{type:'shot'}>=>event.type==='shot')!.shot;assert.equal(shot.hidden,true);assert.deepEqual(shot.projectiles,[]);
 const actual=f.match.activeShot!;assert.ok(actual.projectiles.length);const resumed:ServerEvent[]=[];f.game.disconnect(f.enemy.id);f.game.connect(f.players.find(player=>player.id===f.enemy.id)!,event=>resumed.push(structuredClone(event)));
 const welcome=resumed.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;assert.equal(welcome.battle!.players.find(player=>player.id===f.actor.id)!.x,HIDDEN_POSITION);assert.equal(welcome.battle!.activeShot!.hidden,true);assert.deepEqual(welcome.battle!.activeShot!.projectiles,[]);
});

test('invisibility expires after three subsequent own turns, never on opponents turns or activation turn',async()=>{
 const f=await fixture();await f.game.command(f.actor.id,{type:'ability',ability:'invisibility'});await f.game.command(f.actor.id,{type:'pass'});assert.equal(f.actor.invisibleTurns,3);
 for(let remaining=2;remaining>=0;remaining--){while(f.match.state.turnId!==f.actor.id){await f.game.command(f.match.state.turnId,{type:'pass'});assert.equal(f.actor.invisibleTurns,remaining+1);}await f.game.command(f.actor.id,{type:'pass'});assert.equal(f.actor.invisibleTurns,remaining);}
 assert.equal(f.latest(f.enemy.id).players.find(player=>player.id===f.actor.id)!.hidden,undefined);assert.equal(f.actor.abilities!.invisibility,0);
});

test('flight cannot refund spent tools or combine with shot tools, Power or homing and is cancelable before firing',async()=>{
 for(const action of ['boost','power','homing'] as const){const f=await fixture();
  if(action==='boost')await f.game.command(f.actor.id,{type:'boost',boost:'extra1'});else if(action==='power'){f.actor.powerCharge=200;await f.game.command(f.actor.id,{type:'power'});}else await f.game.command(f.actor.id,{type:'ability',ability:'homing'});
  const before=structuredClone(f.actor);await f.game.command(f.actor.id,{type:'flight',active:true});assert.deepEqual(f.actor,before);assert.match(f.error()!,/não combina/);
 }
 const f=await fixture();await f.game.command(f.actor.id,{type:'flight',active:true});const before=structuredClone(f.actor);
 for(const command of [{type:'boost',boost:'extra1'},{type:'power'},{type:'ability',ability:'homing'}] as const){await f.game.command(f.actor.id,command);assert.deepEqual(f.actor,before);}
 await f.game.command(f.actor.id,{type:'flight',active:false});assert.equal(f.actor.flightArmed,false);assert.deepEqual(f.actor.abilities,initialAbilities());await f.game.command(f.actor.id,{type:'boost',boost:'extra1'});assert.deepEqual(f.actor.boosts,['extra1']);
});

test('flight combines with walking, heal and invisibility in the same turn',async()=>{
 const f=await fixture();f.actor.hp=f.actor.maxHp-200;await f.game.command(f.actor.id,{type:'flight',active:true});
 const x=f.actor.x;await f.game.command(f.actor.id,{type:'walk',direction:1});assert.notEqual(f.actor.x,x);assert.equal(f.actor.flightArmed,true);
 await f.game.command(f.actor.id,{type:'ability',ability:'heal'});assert.equal(f.actor.hp,f.actor.maxHp);
 await f.game.command(f.actor.id,{type:'ability',ability:'invisibility'});assert.equal(f.actor.invisibleTurns,3);assert.equal(f.actor.flightArmed,true);
});

test('flight opens the whole 5–90° aim envelope and cancelling it restores the weapon limits',async()=>{
 const f=await fixture(),weapon=WEAPONS.find(item=>item.id===f.actor.equipment.weapon)!,slope=f.actor.aimSlope??0,weaponMax=weaponAimLimits(weapon,slope).maxAngle,flightMax=weaponAimLimits(FLIGHT_AIM,slope).maxAngle;
 assert.ok(flightMax>weaponMax,'the plane must reach steeper than the weapon');
 await f.game.command(f.actor.id,{type:'flight',active:true});await f.game.command(f.actor.id,{type:'aim',angle:90,power:20,charging:false});assert.equal(f.actor.aimAngle,flightMax);
 await f.game.command(f.actor.id,{type:'flight',active:false});assert.equal(f.actor.aimAngle,weaponMax);
});

test('flight teleports only at authoritative contact to clear supported ground, deals no damage and consumes the turn',async()=>{
 const f=await fixture(),beforeTerrain=f.match.terrain.slice(),beforeHP=f.match.state.players.map(player=>player.hp),origin=f.actor.x;f.enemy.x=1100;
 f.actor.fall=createFall(500,600,Date.now()-1000);
 await f.game.command(f.actor.id,{type:'flight',active:true});await f.game.command(f.actor.id,{type:'fire',angle:45,power:25});
 const shot=f.match.activeShot!,impact=f.match.pendingImpacts![0];assert.equal(shot.projectiles[0].kind,'flight');assert.equal(shot.projectiles[0].impact.radius,0);assert.equal(f.actor.x,origin);
 f.game.tick(impact.at-.001);assert.equal(f.actor.x,origin);f.game.tick(impact.at);assert.notEqual(f.actor.x,origin);assert.equal(f.actor.y,600);assert.equal(f.actor.fall,undefined);assert.deepEqual(f.match.terrain,beforeTerrain);assert.deepEqual(f.match.state.players.map(player=>player.hp),beforeHP);assert.deepEqual(f.match.state.terrainMarks,undefined);
 assert.equal(f.events.get(f.actor.id)!.filter(event=>event.type==='ability-effect'&&event.ability==='flight').length,1);
 f.game.tick(f.match.resolveAt+1);assert.equal(f.match.state.turnId,f.enemy.id);assert.equal(f.actor.flightArmed,false);assert.deepEqual(f.actor.abilities,initialAbilities());
 assert.equal(flightLanding(f.match.terrain,{x:1600,y:600}),null);assert.equal(flightLanding(f.match.terrain,{x:400,y:WORLD.height}),null);
});

test('flight puts the fighter exactly where the plane touched and lets it fall from there',()=>{
 const terrain=createTerrain('snow');
 // Top of the lantern on the floating ledge between the bridges: stands right there.
 assert.deepEqual(flightLanding(terrain,{x:1536,y:345}),{x:1536,y:345,fromY:339});
 // Side of the lantern, flying right: set just outside it, then drops onto the ledge below.
 const side=flightLanding(terrain,{x:1515,y:400,points:[[1490,398],[1510,400]]})!;assert.ok(side.x<1515&&side.x>1475,`x ${side.x}`);assert.equal(side.fromY,394);assert.ok(side.y>=417&&side.y<=430,`y ${side.y}`);
 // Underside of the ledge, flying up: starts just below it and falls into the void.
 const under=flightLanding(terrain,{x:1560,y:546,points:[[1550,560],[1560,546]]})!;assert.equal(under.x,1560);assert.ok(under.fromY>=540);assert.ok(under.y>WORLD.height);
 // A plane that leaves the map leaves the shooter in place.
 assert.equal(flightLanding(terrain,{x:1500,y:WORLD.height}),null);
});

test('flight that falls into the void kills the shooter',async()=>{
 const f=await fixture();f.match.terrain.fill(0);f.match.terrain.fill(1,600*WORLD.cols,600*WORLD.cols+360);
 await f.game.command(f.actor.id,{type:'flight',active:true});await f.game.command(f.actor.id,{type:'fire',angle:45,power:25});
 const impact=f.match.pendingImpacts![0];impact.mark.x=900;impact.mark.y=300;f.match.activeShot!.projectiles[0].points=[[880,310],[900,300]];
 f.game.tick(impact.at);assert.equal(f.actor.x,900);assert.equal(f.actor.hp,0);assert.ok(f.actor.fall?.void);assert.ok(f.match.activeShot?.hits.some(hit=>hit.id===f.actor.id&&hit.kind==='fall'));
});

test('abilities add their Delay when used',async()=>{
 const f=await fixture(),start=f.actor.delay!;f.actor.hp-=100;
 await f.game.command(f.actor.id,{type:'ability',ability:'heal'});assert.equal(f.actor.delay,start+150);
});
