import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {attributes,DEFAULT_EQUIPMENT,WEAPONS,weaponStats,MAX_UPGRADE} from '../shared/catalog';
import {criticalChance,criticalFromRoll,damageAtImpact,impactExposure,shotModifiers,VOLLEY_CADENCE_MS} from '../shared/combat';
import {trajectory,unpackTerrain,volley,WORLD} from '../shared/physics';
import {STRAIGHT_BALL} from './fixtures/weapons';
import type {Profile,ServerEvent} from '../shared/protocol';

async function fixture(roll=.99){
 const profiles=new Map<string,Profile>(),events:ServerEvent[]=[],store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>roll),players=['Timing A','Timing B'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male'}));
 for(const player of players){profiles.set(player.id,player);game.connect(player,event=>{if(player.id===players[0].id)events.push(structuredClone(event));});}
 await game.command(players[0].id,{type:'create',practice:true,name:'Impact timing',mode:'1v1',map:'celestial'});
 const roomId=game.peers.get(players[0].id)!.roomId!;await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players[0],target=match.state.players[1];
 match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,200*WORLD.cols);
 Object.assign(shooter,{x:300,y:600,hp:5000,maxHp:5000});Object.assign(target,{x:430,y:600,hp:5000,maxHp:5000});
 const weapon=weaponStats(WEAPONS[0],0);let aim:{angle:number;power:number}|undefined;
 for(let angle=15;angle<=85&&!aim;angle++)for(let power=5;power<=100;power++){const path=trajectory(match.terrain,shooter,angle,power,0,weapon,[target]);if(path.hitId===target.id&&(path.hitQuality??0)>.9){aim={angle,power};break;}}
 assert.ok(aim);events.length=0;return {game,players,match,shooter,target,events,aim};
}
const impacts=(events:ServerEvent[])=>events.filter((event):event is Extract<ServerEvent,{type:'impact'}>=>event.type==='impact');

test('weapon families retain their declared four-stat budgets, fixture roles and bounded upgrades',()=>{
 // Original combat fixtures keep their budget and roles; the real arsenal has its own stat contracts.
 const budgets=Object.fromEntries(WEAPONS.map(weapon=>[weapon.id,weapon.attack+weapon.defense+weapon.agility+(weapon.luck??0)]));assert.deepEqual(budgets,{ember:360,volt:360,crystal:360,dynamite:360,brick:350,'love-boomerang':460});
 const [ember,volt,crystal,dynamite]=WEAPONS;
 const fixtures=[ember,volt,crystal,dynamite];assert.deepEqual(fixtures.map(w=>w.id),['ember','volt','crystal','dynamite']);
 assert.equal(Math.max(...fixtures.map(weapon=>weapon.attack)),ember.attack);assert.equal(Math.max(...WEAPONS.map(weapon=>weapon.defense)),crystal.defense);
 assert.equal(Math.max(...fixtures.map(weapon=>weapon.agility)),volt.agility);assert.equal(Math.max(...fixtures.map(weapon=>weapon.luck??0)),volt.luck);
 assert.ok(Math.max(dynamite.attack,dynamite.defense,dynamite.agility,dynamite.luck!)-Math.min(dynamite.attack,dynamite.defense,dynamite.agility,dynamite.luck!)<=45);
 for(const weapon of WEAPONS){const max=weaponStats(weapon,MAX_UPGRADE);assert.deepEqual(weaponStats(weapon,999),max);for(const key of ['attack','defense','agility','luck'] as const)assert.equal(max[key],Math.trunc(Math.trunc(weapon[key]!*1.2)*1.3+1e-9));assert.equal(max.damage,Math.round(weapon.damage*1.1**MAX_UPGRADE));}
});

test('critical chance follows 45 × Sorte / (800 + Sorte) and uses an explicit server roll',()=>{
 assert.equal(criticalChance(0),0);assert.equal(criticalChance(800),.225);assert.ok(Math.abs(criticalChance(100)-.05)<1e-12);assert.ok(criticalChance(1e9)<.45);
 assert.ok(criticalChance(40)<criticalChance(80));assert.equal(criticalFromRoll(100,.049),true);assert.equal(criticalFromRoll(100,.05),false);
 for(const roll of [-1,NaN,Infinity,1])assert.equal(criticalFromRoll(100,roll),false);
 const luck=attributes(DEFAULT_EQUIPMENT).luck,normal=damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT),critical=damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,{critical:true});
 assert.ok(Math.abs(critical-normal*(1.5+luck*.00015))<=1.5);
});

test('approach geometry distinguishes center contact, grazing and splash despite identical surface radius',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:50,y:100,facing:1},weapon={...WEAPONS[0],ball:STRAIGHT_BALL};
 const center={id:'center',x:300,y:91,hp:100},graze={id:'graze',x:300,y:118.99,hp:100};
 const direct=trajectory(terrain,origin,0,100,0,weapon,[center]),edge=trajectory(terrain,origin,0,100,0,weapon,[graze]);
 assert.equal(direct.hitId,'center');assert.equal(edge.hitId,'graze');assert.ok((direct.hitQuality??0)>.99);assert.ok((edge.hitQuality??1)<.05);
 for(const [target,path] of [[center,direct],[graze,edge]] as const)assert.ok(Math.abs(Math.hypot(path.x-target.x,path.y-(target.y-31))-22)<1e-7);
 const full=impactExposure(center,direct,weapon.blast),skim=impactExposure(graze,edge,weapon.blast),splash=impactExposure(center,{x:center.x-40,y:center.y-31},weapon.blast);
 assert.equal(full.kind,'direct');assert.equal(skim.kind,'graze');assert.equal(splash.kind,'splash');assert.ok(full.attenuation>skim.attenuation&&skim.attenuation>splash.attenuation);
 assert.equal(impactExposure(center,{x:0,y:0},weapon.blast).attenuation,0);
 assert.ok(Math.abs(direct.flightTime-(300-28-77)/2000*1000)<1e-8);
});

test('shot modes set the projectile penalty and percentage bonuses add up',()=>{
 assert.deepEqual(shotModifiers(['extra1','damage20','damage20']),{volleys:2,spread:[0],projectileMultiplier:.9,damageMultiplier:1.4});
 const boosted=shotModifiers(['extra2','trident','damage50','damage40']);assert.equal(boosted.volleys,3);assert.equal(boosted.spread.length,3);assert.equal(boosted.damageMultiplier,1.9);assert.ok(Math.abs(boosted.projectileMultiplier-.3)<1e-9);
});

test('splash is local with gradual falloff and no damage at or beyond its hitbox boundary',()=>{
 const target={id:'target',x:300,y:400};
 for(const weapon of WEAPONS){
  const radius=weapon.blast*.60,exposure=(distance:number)=>impactExposure(target,{x:target.x-distance,y:target.y-31},weapon.blast);
  const direct=impactExposure(target,{x:target.x-22,y:target.y-31,hitId:target.id,hitQuality:1},weapon.blast),graze=impactExposure(target,{x:target.x-22,y:target.y-31,hitId:target.id,hitQuality:.1},weapon.blast);
  const near=exposure(30),far=exposure(22+radius*.8),edge=exposure(22+radius+.00001);
  assert.ok(direct.attenuation>graze.attenuation&&graze.attenuation>near.attenuation&&near.attenuation>far.attenuation);assert.ok(near.attenuation<=.82);assert.ok(far.attenuation>.22&&far.attenuation<.24);
  for(const [fraction,lower,upper] of [[0,.819,.821],[.25,.71,.72],[.5,.52,.54],[.75,.28,.30],[1,0,0]]){const value=exposure(22+radius*fraction).attenuation;assert.ok(value>=lower&&value<=upper,`${weapon.id} at ${fraction}: ${value}`);}
  assert.equal(edge.attenuation,0);assert.equal(exposure(134).attenuation,0);assert.equal(damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,{attenuation:edge.attenuation}),0);assert.ok(22+radius<=101);
 }
});

test('sub-point splash and floating-point residue at the blast boundary never receive minimum damage',()=>{
 const target={id:'target',x:300,y:400};
 for(const weapon of WEAPONS){
  const radius=weapon.blast*.60,attacker={...DEFAULT_EQUIPMENT,weapon:weapon.id};
  for(const distance of [22+radius*.9995,22+radius,22+radius+.001]){
   const exposure=impactExposure(target,{x:target.x-distance,y:target.y-31},weapon.blast);
   for(const critical of [false,true])assert.equal(damageAtImpact(attacker,DEFAULT_EQUIPMENT,{attenuation:exposure.attenuation,critical}),0,`${weapon.id} at ${distance}`);
  }
 }
});

test('a ground strike beside the fighter deals substantial near-hit damage inside the tighter blast',()=>{
 const target={id:'target',x:300,y:400},weapon=WEAPONS[0],exposure=impactExposure(target,{x:300,y:400},weapon.blast);
 assert.equal(exposure.kind,'splash');assert.ok(exposure.attenuation>.77&&exposure.attenuation<.80);
 const full=damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT),near=damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,{attenuation:exposure.attenuation});
 assert.ok(near>=full*.75&&near<full,`${near} versus full ${full}`);
 assert.equal(impactExposure(target,{x:300,y:400+22+weapon.blast*.60+.001},weapon.blast).attenuation,0);
});

test('one impact damages two nearby enemies independently and excludes a micro-splash target from HP, Power and hits',async()=>{
 const f=await fixture(),weapon=weaponStats(WEAPONS[0],0),path=trajectory(f.match.terrain,f.shooter,f.aim.angle,f.aim.power,0,weapon,[f.target]);
 const near={...structuredClone(f.target),id:randomUUID(),name:'Nearby enemy',x:f.target.x+30,slot:1};
 const radius=22+weapon.blast*.60*.999,vertical=f.target.y-31-path.y;
 const edge={...structuredClone(f.target),id:randomUUID(),name:'Edge enemy',x:path.x+Math.sqrt(radius*radius-vertical*vertical),slot:2};
 f.match.state.players.push(near,edge);const direct=trajectory(f.match.terrain,f.shooter,f.aim.angle,f.aim.power,0,weapon,[f.target,near,edge]);assert.equal(direct.hitId,f.target.id);
 const expected=damageAtImpact(f.shooter.equipment,near.equipment,{attenuation:impactExposure(near,direct,weapon.blast).attenuation});assert.ok(expected>1);
 await f.game.command(f.shooter.id,{type:'fire',...f.aim});const at=f.match.pendingImpacts![0].at;
 assert.equal(f.target.hp,5000);assert.equal(near.hp,5000);assert.equal(edge.hp,5000);f.game.tick(at);
 const hits=impacts(f.events)[0].hits,primary=hits.find(hit=>hit.id===f.target.id)!,secondary=hits.find(hit=>hit.id===near.id)!;
 assert.equal(primary.kind,'direct');assert.equal(secondary.kind,'splash');assert.ok(primary.damage>secondary.damage);assert.equal(secondary.damage,expected);
 assert.equal(5000-f.target.hp,primary.damage);assert.equal(5000-near.hp,secondary.damage);assert.equal(edge.hp,5000);assert.equal(edge.powerCharge,0);assert.equal(hits.some(hit=>hit.id===edge.id),false);
 assert.ok(hits.every(hit=>hit.damage>0));
});

test('scheduled projectiles launch at the volley cadence and a delayed launch sees an earlier terrain change',()=>{
 const terrain=new Uint8Array(WORLD.cols*WORLD.rows),origin={x:50,y:100,facing:1};for(let row=0;row<WORLD.rows;row++)terrain[row*WORLD.cols+50]=1;
 const order:number[]=[],results=volley(terrain,origin,[0,0],100,0,{...WEAPONS[0],ball:STRAIGHT_BALL},[],(_,index)=>{order.push(index);if(index===0){terrain.fill(0);origin.y=150;}},[0,VOLLEY_CADENCE_MS]);
 assert.deepEqual(order,[0,1]);assert.equal(results[0].points[0][1],60);assert.equal(results[1].points[0][1],110);assert.equal(results[1].x,WORLD.width+80);assert.ok(results[0].flightTime<VOLLEY_CADENCE_MS);
});

test('HP, Power and authoritative terrain remain unchanged until contact, including reconnect and duplicate ticks',async()=>{
 const f=await fixture(),before=structuredClone(f.match.state.players),terrain=f.match.terrain.slice();
 await f.game.command(f.shooter.id,{type:'fire',...f.aim});const shot=f.events.find((event):event is Extract<ServerEvent,{type:'shot'}>=>event.type==='shot')!.shot;
 assert.deepEqual(shot.hits,[]);assert.deepEqual(shot.impacted,[]);assert.equal(f.target.hp,before[1].hp);assert.equal(f.target.powerCharge,0);assert.deepEqual(f.match.terrain,terrain);
 const contact=shot.startedAt+shot.projectiles[0].delay+shot.projectiles[0].flightTime;f.game.tick(contact-.001);assert.equal(f.target.hp,before[1].hp);assert.equal(impacts(f.events).length,0);
 const resumed:ServerEvent[]=[];f.game.disconnect(f.players[0].id);f.game.connect(f.players[0],event=>resumed.push(structuredClone(event)));
 const welcome=resumed.find((event):event is Extract<ServerEvent,{type:'welcome'}>=>event.type==='welcome')!;
 assert.equal(welcome.battle!.activeShot!.startedAt,shot.startedAt);assert.deepEqual(welcome.battle!.activeShot!.hits,[]);assert.deepEqual(unpackTerrain(Buffer.from(welcome.battle!.terrain!,'base64')),terrain);
 f.game.tick(contact);const hit=impacts(resumed)[0];assert.ok(hit.hits.some(value=>value.id===f.target.id&&value.kind==='direct'&&!value.critical));assert.ok(f.target.hp<before[1].hp);assert.ok((f.target.powerCharge??0)>(f.shooter.powerCharge??0));
 const hp=f.target.hp,charge=f.target.powerCharge;f.game.tick(contact);assert.equal(impacts(resumed).length,1);assert.equal(f.target.hp,hp);assert.equal(f.target.powerCharge,charge);
 const battle=resumed.filter((event):event is Extract<ServerEvent,{type:'battle'}>=>event.type==='battle').at(-1)!.battle!;assert.deepEqual(battle.activeShot!.impacted,[0]);assert.equal(battle.players[1].hp,hp);
});

test('a lethal hit kills at impact but the result waits for the shot to end, and critical roll is server-controlled',async()=>{
 for(const roll of [.99,0]){const f=await fixture(roll);f.target.hp=1;
  await f.game.command(f.shooter.id,{type:'fire',...f.aim});assert.equal(f.target.hp,1);assert.equal(f.match.state.phase,'resolving');assert.equal(f.match.state.rewards,undefined);
  const at=f.match.pendingImpacts![0].at;f.game.tick(at-.001);assert.equal(f.target.hp,1);f.game.tick(at);assert.equal(f.target.hp,0);assert.equal(f.match.state.phase,'resolving','the shot finishes playing before the result');assert.equal(f.match.state.rewards,undefined);
  f.game.tick(f.match.resolveAt);assert.equal(f.match.state.phase,'finished');assert.equal(f.match.state.winner,0);assert.ok(f.match.state.rewards);
  const hit=impacts(f.events).flatMap(event=>event.hits).find(value=>value.id===f.target.id)!;assert.equal(hit.critical,roll===0);assert.ok(hit.damage>1,'the number shows the real damage, not the HP that was left');
 }
});

test('repeated tools require the authoritative vigor budget and cannot mutate state during resolution',async()=>{
 const f=await fixture(),vigor=f.shooter.stamina;
 for(const boost of ['extra2','trident'] as const)await f.game.command(f.shooter.id,{type:'boost',boost});assert.deepEqual(f.shooter.boosts,['extra2','trident']);assert.equal(f.shooter.stamina,vigor-220);
 const before=structuredClone(f.shooter);await f.game.command(f.shooter.id,{type:'boost',boost:'damage20'});assert.deepEqual(f.shooter,before);
 await f.game.command(f.shooter.id,{type:'fire',angle:60,power:50});const shot=f.match.activeShot!;assert.deepEqual(shot.projectiles.map(projectile=>projectile.delay),[0,0,0,1,1,1,2,2,2].map(n=>n*VOLLEY_CADENCE_MS));assert.ok(shot.projectiles[0].flightTime>2*VOLLEY_CADENCE_MS);
 const snapshot=structuredClone(f.match.state);await f.game.command(f.shooter.id,{type:'boost',boost:'damage50'});assert.deepEqual(f.match.state,snapshot);
 assert.equal(attributes(f.shooter.equipment).luck,105);
});
