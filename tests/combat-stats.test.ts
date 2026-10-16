import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {attributes,CATALOG,DEFAULT_EQUIPMENT,itemAttributes,WEAPONS,weaponStats} from '../shared/catalog';
import type {BoostId,Equipment,Item} from '../shared/catalog';
import {damageAtImpact} from '../shared/combat';
import {trajectory} from '../shared/physics';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

test('starter totals and impact damage follow the published balance without counting upgrades twice',()=>{
 assert.deepEqual(attributes(DEFAULT_EQUIPMENT),{attack:231,defense:93,agility:138,damage:240,armor:44,hp:1479,stamina:244,power:2980});
 assert.equal(damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT),299);
 const upgraded=attributes({...DEFAULT_EQUIPMENT,upgrade:12});assert.equal(upgraded.attack,327);assert.equal(upgraded.damage,341);
 for(const weapon of WEAPONS){
  const tooltip=itemAttributes(weapon,12),totals=attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:12}),base=attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:0});
  assert.equal(totals.damage,tooltip.damage);assert.equal(totals.attack-base.attack,96);assert.equal(tooltip.attack,weapon.attack+96);
 }
});

test('falloff, multishot penalty and damage boosts combine before final rounding',()=>{
 const damage=(modifiers:Parameters<typeof damageAtImpact>[2])=>damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,modifiers);
 assert.equal(damage({attenuation:.5}),150);assert.equal(damage({attenuation:.15}),45);
 assert.equal(damage({shotMultiplier:.3}),90);assert.equal(damage({boostMultiplier:1.5}),449);
 assert.equal(damage({attenuation:.5,shotMultiplier:.3,boostMultiplier:1.5}),67);
 assert.equal(damage({attenuation:3}),299);assert.equal(damage({attenuation:0}),0);assert.equal(damage({attenuation:1e-12}),1);
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
 const store:ProfileStore={buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store),attacker=normalizeProfile({id:randomUUID(),name:'Damage A',upgrades:{ember:6}}),defender=normalizeProfile({id:randomUUID(),name:'Damage B',equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-executive',hat:'hat-knight'}});
 for(const profile of [attacker,defender]){profiles.set(profile.id,profile);game.connect(profile,event=>{if(profile.id===attacker.id)events.push(structuredClone(event));});}
 await game.command(attacker.id,{type:'create',name:'Damage verification',mode:'1v1',map:'celestial'});const roomId=game.peers.get(attacker.id)!.roomId!;
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
 const hits=shot.hits.filter(hit=>hit.id===target.id);assert.ok(hits.length>0,'server must apply damage to a real projectile hit');
 for(const hit of hits){
  const impact=shot.projectiles[hit.projectileIndex!].impact,distance=Math.hypot(hit.x-impact.x,hit.y+60-impact.y);
  const expected=damageAtImpact(shooter.equipment,target.equipment,{attenuation:Math.max(.15,1-distance/weapon.blast),shotMultiplier:boosts.includes('extra1')?.9*.5:1,boostMultiplier:boosts.includes('damage50')?1.5:1});
  assert.equal(hit.damage,expected,'authoritative shot damage must use attack, upgraded damage, armor, defense and active modifiers');
 }
 assert.equal(target.hp,Math.max(0,hp-hits.reduce((sum,hit)=>sum+hit.damage,0)));
});
