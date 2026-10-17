import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {attributes,CATALOG,DEFAULT_EQUIPMENT,itemAttributes,WEAPONS,weaponStats} from '../shared/catalog';
import type {BoostId,Equipment,Item} from '../shared/catalog';
import {damageAtImpact,shotModifiers} from '../shared/combat';
import {trajectory} from '../shared/physics';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

test('starter totals and impact damage follow the published balance without counting upgrades twice',()=>{
 // Painted starter cap: 8 DEF / 8 AGI / 5 armor. Retired pilot cap is no longer equipped.
 assert.deepEqual(attributes(DEFAULT_EQUIPMENT),{attack:236,defense:109,agility:146,luck:105,damage:230,armor:41,hp:1527,stamina:244,power:3377});
 assert.equal(damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT),286);
 const upgraded=attributes({...DEFAULT_EQUIPMENT,upgrade:12});assert.equal(upgraded.attack,284);assert.equal(upgraded.damage,285);
 for(const weapon of WEAPONS){
  const tooltip=itemAttributes(weapon,12),totals=attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:12}),base=attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:0});
  assert.equal(totals.damage,tooltip.damage);assert.equal(totals.attack-base.attack,48);assert.equal(tooltip.attack,weapon.attack+48);
 }
});

test('falloff, multishot penalty and damage boosts combine before final rounding',()=>{
 const damage=(modifiers:Parameters<typeof damageAtImpact>[2])=>damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,modifiers);
 // Raw impact is 230 * 1.472 / 1.109 / (1 + 41/600), before one final rounding.
 assert.equal(damage({attenuation:.5}),143);assert.equal(damage({attenuation:.15}),43);
 assert.equal(damage({shotMultiplier:.3}),86);assert.equal(damage({boostMultiplier:1.5}),429);
 assert.equal(damage({attenuation:.5,shotMultiplier:.3,boostMultiplier:1.5}),64);
 assert.equal(damage({attenuation:3}),286);assert.equal(damage({attenuation:0}),0);assert.equal(damage({attenuation:1e-12}),0);
 assert.equal(damage({attenuation:.001}),0,'sub-half-point exposure must not become an artificial minimum hit');assert.equal(damage({attenuation:.002}),1,'one point remains valid when the final combined damage rounds to one');
 for(const invalid of [-1,NaN,Infinity,-Infinity])assert.equal(damage({attenuation:invalid}),0);
 for(const key of ['shotMultiplier','boostMultiplier'] as const)for(const invalid of [0,-1,NaN,Infinity,-Infinity])assert.equal(damage({[key]:invalid}),0);
});

test('attack, armor and defense have separate effects with diminishing protection returns',()=>{
 const neutral={...DEFAULT_EQUIPMENT,hat:'hat-none'},ids:string[]=[];
 const equipment=(values:Partial<Item>):Equipment=>{
  const id=`qa-stat-${ids.length}`;ids.push(id);CATALOG[id]={...CATALOG['hat-none'],...values,id};return {...neutral,hat:id};
 };
 try{
  const base=damageAtImpact(neutral,neutral),attack=equipment({attack:300}),armor=equipment({armor:600}),defense=equipment({defense:1000});
  assert.ok(damageAtImpact(attack,neutral)>base);assert.equal(damageAtImpact(neutral,attack),base,'attack alone is not protection');
  assert.ok(damageAtImpact(neutral,armor)<base);assert.equal(damageAtImpact(armor,neutral),base,'armor must not change offense');
  assert.ok(damageAtImpact(neutral,defense)<base);assert.equal(damageAtImpact(defense,neutral),base,'defense must not change offense');
  for(const key of ['armor','defense'] as const){
   const step=key==='armor'?600:1000,first=damageAtImpact(neutral,equipment({[key]:step})),second=damageAtImpact(neutral,equipment({[key]:step*2}));
   assert.ok(second<first&&first<base);assert.ok(base-first>first-second,'each additional protection step removes less damage');
  }
  assert.ok(damageAtImpact({...neutral,upgrade:12},neutral)>base,'weapon strengthening increases actual impact damage');
 }finally{for(const id of ids)delete CATALOG[id];}
});

async function combatFixture(){
 const profiles=new Map<string,Profile>(),events:ServerEvent[]=[];
 const store:ProfileStore={saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store,()=>{},()=>.99),attacker=normalizeProfile({id:randomUUID(),name:'Damage A',upgrades:{ember:6}}),defender=normalizeProfile({id:randomUUID(),name:'Damage B',equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-executive',hat:'hat-tide'}});
 for(const profile of [attacker,defender]){profiles.set(profile.id,profile);game.connect(profile,event=>{if(profile.id===attacker.id)events.push(structuredClone(event));});}
 await game.command(attacker.id,{type:'create',practice:true,name:'Damage verification',mode:'1v1',map:'celestial'});const roomId=game.peers.get(attacker.id)!.roomId!;
 await game.command(defender.id,{type:'join',roomId});await game.command(defender.id,{type:'ready'});await game.command(attacker.id,{type:'start'});
 const match=game.matches.get(roomId)!;match.state.wind=0;assert.equal(match.state.turnId,attacker.id);
 return {game,events,match,attacker,defender};
}

for(const boosts of [['damage50'],['extra1','trident']] as BoostId[][])test(`server impacts use the same formula for ${boosts.join(' + ')}`,async()=>{
 const {game,events,match,attacker,defender}=await combatFixture(),shooter=match.state.players.find(p=>p.id===attacker.id)!,target=match.state.players.find(p=>p.id===defender.id)!;
 const hp=target.hp,weapon=weaponStats(WEAPONS.find(w=>w.id===shooter.equipment.weapon)!,shooter.equipment.upgrade);
 let command:{angle:number;power:number}|undefined;
 for(let angle=25;angle<=75&&!command;angle+=2)for(let power=30;power<=100;power++)if(trajectory(match.terrain,shooter,angle,power,0,weapon,[target]).hitId===target.id){command={angle,power};break;}
 assert.ok(command,'a legal shot must reach the test target');
 for(const boost of boosts)await game.command(attacker.id,{type:'boost',boost});await game.command(attacker.id,{type:'fire',...command});
 const shot=events.find((event):event is Extract<ServerEvent,{type:'shot'}>=>event.type==='shot')!.shot;
 assert.equal(shot.projectiles.length,boosts.includes('extra1')?6:1);
 assert.equal(shot.hits.length,0);assert.equal(target.hp,hp);game.tick(match.resolveAt+1);
 const hits=events.filter((event):event is Extract<ServerEvent,{type:'impact'}>=>event.type==='impact').flatMap(event=>event.hits).filter(hit=>hit.id===target.id);assert.ok(hits.length>0,'server must apply damage to a real projectile hit');
 const modifiers=shotModifiers(boosts);
 for(const hit of hits){
  const attenuation=hit.kind==='splash'?.82*(1-(1-hit.quality)**1.5):.84+.16*hit.quality;
  const expected=damageAtImpact(shooter.equipment,target.equipment,{attenuation,shotMultiplier:modifiers.projectileMultiplier,boostMultiplier:modifiers.damageMultiplier});
  assert.equal(hit.damage,expected,'authoritative shot damage must use attack, upgraded damage, armor, defense and active modifiers');
 }
 assert.equal(target.hp,Math.max(0,hp-hits.reduce((sum,hit)=>sum+hit.damage,0)));
});
