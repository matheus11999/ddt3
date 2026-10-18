// Verdália, the first pet (shared/petContent.ts): evolution, the three skills, the starter gift and the battle.
import '../shared/petContent';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {MemoryPetStore} from './fixtures/pets';
import {PET_GIFTS} from '../shared/petContent';
import {activeSkills,gainPetXp,petSnapshot,xpForLevel} from '../shared/pets';
import {activatePetSkill,createBattlePet,dispatchPetTrigger,petTurnEnd,petTurnStart} from '../shared/petSkills';
import type {PetCombatant,PetEngineContext} from '../shared/petSkills';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {WEAPONS,weaponStats} from '../shared/catalog';
import {trajectory,WORLD} from '../shared/physics';
import type {Profile,ServerEvent} from '../shared/protocol';

const service=()=>{const a=normalizeProfile({id:randomUUID(),name:'Ária',gender:'male',gold:500}),profiles=new Map([[a.id,a]]);return {pets:new MemoryPetStore(profiles,()=>0),profiles,a};};
function duel(stage=0,skills:{id:string;level:number}[]=[{id:'verdalia-roots',level:1}]){
 const owner:PetCombatant={id:'a',team:0,hp:1000,maxHp:1000,level:10,x:100,y:500},near:PetCombatant={id:'b',team:1,hp:1000,maxHp:1000,level:10,x:600,y:500},far:PetCombatant={id:'c',team:1,hp:1000,maxHp:1000,level:10,x:900,y:500};
 owner.pet=createBattlePet({petId:randomUUID(),species:'verdalia',stage,skills},'pvp');
 const ctx:PetEngineContext={fighters:[owner,near,far],mode:'pvp',roll:()=>0,attackOf:()=>100};
 return {owner,near,far,ctx};
}

test('every player receives Verdália once, with its food, ready to fight',async()=>{
 const {pets,a}=service(),gift=PET_GIFTS[0];
 const outcome=await pets.gift(a.id,{...gift,food:{...gift.food},equip:true});
 assert.ok(outcome);const pet=outcome.state.pets[0];
 assert.equal(pet.species,'verdalia');assert.equal(pet.stage,0);assert.equal(outcome.profile.petFood['pet-food-dew'],10);assert.ok(outcome.profile.petGifts?.includes('starter-verdalia'));
 // The passive is innate (no slot); the special orb goes in the first slot by itself.
 assert.deepEqual(pet.equippedSkills,['verdalia-orb',null,null,null]);
 assert.deepEqual(activeSkills(pet).map(s=>s.id).sort(),['verdalia-orb','verdalia-roots']);
 assert.equal(await pets.gift(a.id,{...gift,food:{...gift.food}}),null);assert.equal((await pets.list(a.id)).pets.length,1);
});
test('Verdália evolves by level into three looks, and the heal unlocks at level 10',async()=>{
 const {pets,a}=service(),{pet}=await pets.grant(a.id,'verdalia',{source:'test'});
 const stored=pets.pets.get(pet.id)!;
 let jump=gainPetXp(stored,xpForLevel(10));assert.equal(stored.stage,0);assert.ok(jump.unlockedSkills.includes('verdalia-dew'));assert.ok(stored.equippedSkills.includes('verdalia-dew'));
 jump=gainPetXp(stored,xpForLevel(20)-stored.xp);assert.equal(stored.stage,1);assert.deepEqual(jump.evolved,{from:0,to:1});
 gainPetXp(stored,xpForLevel(40)-stored.xp);assert.equal(stored.stage,2);
 assert.equal(petSnapshot(stored).stage,2);
});
test('Raízes da Terra damages only the enemies in the area of the shot, and grows with the stage',()=>{
 const sprout=duel(0);
 const apps=dispatchPetTrigger(sprout.ctx,'shot-end',sprout.owner,{sourceId:'a',shotId:'s1',point:{x:620,y:460}});
 const strike=apps.find(x=>x.kind==='area-damage')!;assert.equal(strike.x,620);assert.equal(strike.stage,0);
 const sproutDamage=1000-sprout.near.hp;assert.equal(sproutDamage,60+20);assert.equal(sprout.far.hp,1000);assert.equal(sprout.owner.hp,1000);
 // Once per turn, even if the shot ends twice.
 dispatchPetTrigger(sprout.ctx,'shot-end',sprout.owner,{sourceId:'a',shotId:'s2',point:{x:620,y:460}});assert.equal(1000-sprout.near.hp,sproutDamage);
 const flower=duel(2);dispatchPetTrigger(flower.ctx,'shot-end',flower.owner,{sourceId:'a',shotId:'s1',point:{x:620,y:460}});
 assert.equal(1000-flower.near.hp,170+30);
 // No point (the shot fell off the map): nothing rises.
 const miss=duel(0);assert.ok(!dispatchPetTrigger(miss.ctx,'shot-end',miss.owner,{sourceId:'a'}).some(x=>x.kind==='area-damage'));assert.equal(miss.near.hp,1000);
});
test('Orvalho Curativo heals at the start of each of the next 3 turns',()=>{
 const {owner,ctx}=duel(0,[{id:'verdalia-dew',level:1}]);owner.pet!.mana=100;owner.hp=500;
 activatePetSkill(ctx,owner,'verdalia-dew');assert.equal(owner.hp,500);
 petTurnEnd(ctx,owner);assert.equal(owner.hp,500,'nothing at the end of the turn');
 for(const expected of [550,600,650]){petTurnStart(ctx,owner);assert.equal(owner.hp,expected);petTurnEnd(ctx,owner);}
 petTurnStart(ctx,owner);assert.equal(owner.hp,650);assert.equal(owner.petEffects,undefined);
});

// ── Game ──
async function arena(){
 const profiles=new Map<string,Profile>(),events:ServerEvent[]=[],store={getProfile:async(id:string)=>profiles.get(id)??null,finishMatch:async()=>{}} as unknown as ProfileStore;
 const game=new Game(store,()=>{},()=>.99),players=['Verde A','Verde B'].map(name=>normalizeProfile({id:randomUUID(),name,gender:'male'}));
 for(const player of players){profiles.set(player.id,player);game.connect(player,event=>{if(player.id===players[0].id)events.push(structuredClone(event));});}
 await game.command(players[0].id,{type:'create',practice:true,name:'Verdália',mode:'1v1',map:'celestial'});
 const roomId=game.peers.get(players[0].id)!.roomId!;await game.command(players[1].id,{type:'join',roomId});await game.command(players[1].id,{type:'ready'});await game.command(players[0].id,{type:'start'});
 const match=game.matches.get(roomId)!,shooter=match.state.players.find(p=>p.id===match.state.turnId)!,target=match.state.players.find(p=>p.id!==shooter.id)!;
 match.state.wind=0;match.terrain.fill(0);match.terrain.fill(1,200*WORLD.cols);
 Object.assign(shooter,{x:300,y:600,hp:5000,maxHp:5000});Object.assign(target,{x:520,y:600,hp:5000,maxHp:5000});
 shooter.pet=createBattlePet({petId:randomUUID(),species:'verdalia',stage:0,skills:[{id:'verdalia-roots',level:1},{id:'verdalia-orb',level:1}]},'pvp');shooter.pet!.mana=100;
 const weapon=weaponStats(WEAPONS.find(w=>w.id===shooter.equipment.weapon)!,0);let aim:{angle:number;power:number}|undefined;
 for(let angle=20;angle<=65&&!aim;angle++)for(let power=5;power<=100;power++){const path=trajectory(match.terrain,shooter,angle,power,0,weapon,[target]);if(path.hitId===target.id&&(path.hitQuality??0)>.9){aim={angle,power};break;}}
 assert.ok(aim);events.length=0;
 const error=()=>events.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error').at(-1)?.message;
 return {game,match,shooter,target,aim,events,error};
}
const impacts=(events:ServerEvent[])=>events.filter((e):e is Extract<ServerEvent,{type:'impact'}>=>e.type==='impact');

test('after the last projectile, Verdália strikes where the shot landed, as its own damage number',async()=>{
 const f=await arena();await f.game.command(f.shooter.id,{type:'fire',...f.aim});
 const pending=f.match.pendingImpacts!,strike=pending.find(p=>p.petStrike)!;assert.ok(strike);
 assert.ok(pending.every(p=>p===strike||p.at<strike.at),'the plant attacks after every projectile');
 f.game.tick(strike.at-1);const afterShot=f.target.hp;assert.ok(afterShot<5000);
 f.game.tick(strike.at);const pet=impacts(f.events).at(-1)!;
 assert.equal(pet.projectileIndex,1000);assert.equal(pet.hits[0].id,f.target.id);assert.equal(afterShot-f.target.hp,pet.hits[0].damage);
 assert.ok(f.events.some(e=>e.type==='pet-effect'));
 f.game.tick(f.match.resolveAt+1);assert.equal(f.match.state.turnId,f.target.id);
});
test('Orbe da Natureza: one green projectile, always critical, and no other power that turn',async()=>{
 const f=await arena();
 await f.game.command(f.shooter.id,{type:'boost',boost:'extra1'});
 await f.game.command(f.shooter.id,{type:'pet-skill',skill:'verdalia-orb'});assert.match(f.error()!,/não combina/);
 await f.game.command(f.shooter.id,{type:'boost',boost:'extra1'});f.shooter.boosts=[];
 await f.game.command(f.shooter.id,{type:'pet-skill',skill:'verdalia-orb'});
 for(const command of [{type:'boost',boost:'extra2'},{type:'power'},{type:'flight',active:true}] as const){await f.game.command(f.shooter.id,command);assert.match(f.error()!,/impede/);}
 await f.game.command(f.shooter.id,{type:'fire',...f.aim});
 const shot=f.match.activeShot!;assert.equal(shot.projectiles.length,1);assert.equal(shot.projectiles[0].pet?.projectile,'verdalia-orb');assert.equal(shot.projectiles[0].pet?.species,'verdalia');
 f.game.tick(f.match.pendingImpacts![0].at);const hit=impacts(f.events)[0].hits.find(h=>h.id===f.target.id)!;assert.equal(hit.critical,true);
 f.game.tick(f.match.resolveAt+1);assert.equal(f.shooter.petEffects?.some(e=>e.kind==='special-shot')??false,false);
});
test('Verdália strikes where the last projectile landed, the middle one of the last Tridente volley',async()=>{
 const f=await arena();
 await f.game.command(f.shooter.id,{type:'boost',boost:'extra1'});await f.game.command(f.shooter.id,{type:'boost',boost:'trident'});
 await f.game.command(f.shooter.id,{type:'fire',...f.aim});
 const projectiles=f.match.activeShot!.projectiles;assert.equal(projectiles.length,6);
 const strike=f.match.pendingImpacts!.find(p=>p.petStrike)!,last=projectiles[4].impact;
 assert.deepEqual(strike.petStrike,{x:last.x,y:last.y});
 assert.notDeepEqual(strike.petStrike,{x:projectiles[0].impact.x,y:projectiles[0].impact.y});
});
