// Pet system with TEST-ONLY fixtures (tests/fixtures/pets.ts): service rules, progression, skills and the battle.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {MemoryPetStore} from './fixtures/pets';
import {attributes,DEFAULT_EQUIPMENT} from '../shared/catalog';
import type {Equipment} from '../shared/catalog';
import {PET_CONFIG} from '../shared/petConfig';
import {gainPetXp,levelForPetXp,petContribution,petSnapshot,petStats,vitalityFactor,xpForLevel,xpToNext} from '../shared/pets';
import type {PlayerPet} from '../shared/pets';
import {activatePetSkill,consumeShotBonus,createBattlePet,dispatchPetTrigger,incomingPetDamage,petTurnEnd,petTurnStart} from '../shared/petSkills';
import type {PetCombatant,PetEngineContext} from '../shared/petSkills';
import type {Profile,ServerEvent} from '../shared/protocol';
import {Game} from '../server/game';
import type {SavedGame,SavedMatch} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';

const profile=(name='Ária')=>normalizeProfile({id:randomUUID(),name,gender:'male',gold:500});
function service(){const a=profile('Ária'),b=profile('Bento'),profiles=new Map([[a.id,a],[b.id,b]]);return {pets:new MemoryPetStore(profiles,()=>0),profiles,a,b};}
const food=(profiles:Map<string,Profile>,id:string,amount:Record<string,number>)=>{profiles.get(id)!.petFood=amount;};

test('a player without pets has an empty list and every query works',async()=>{
 const {pets,a}=service();const state=await pets.list(a.id);
 assert.deepEqual(state.pets,[]);assert.equal(state.capacity,20);assert.equal(a.equipment.pet,undefined);
});
test('pets are granted only from a released species and up to the capacity',async()=>{
 const {pets,a}=service();
 await assert.rejects(pets.grant(a.id,'test-hidden',{source:'test'}),/não está disponível/);
 await assert.rejects(pets.grant(a.id,'nothing',{source:'test'}),/não está disponível/);
 const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});
 assert.equal(pet.level,1);assert.equal(pet.vitality,100);assert.equal(pet.equipped,false);assert.ok(pet.knownSkills.some(s=>s.id==='test-strike'));assert.ok(!pet.knownSkills.some(s=>s.id==='test-late'));
 for(let n=1;n<PET_CONFIG.maxOwned;n++)await pets.grant(a.id,'test-pet',{source:'test'});
 await assert.rejects(pets.grant(a.id,'test-pet',{source:'test'}),/Libere um/);
});
test('equip, unequip and swap the active pet; bonuses and FC follow and fully revert',async()=>{
 const {pets,a,profiles}=service();
 const first=(await pets.grant(a.id,'test-pet',{source:'test'})).pet,second=(await pets.grant(a.id,'test-pet',{source:'test',quality:'rare'})).pet;
 const bare=attributes(profiles.get(a.id)!.equipment,a.level);
 let outcome=await pets.equip(a.id,first.id);
 const worn=attributes(outcome.profile.equipment,a.level);
 assert.equal(outcome.profile.equipment.pet?.id,first.id);
 // Vida: the pet's +200 plus Defesa/10 from its +40 Defesa (the official Vida formula).
 assert.equal(worn.attack,bare.attack+100);assert.equal(worn.defense,bare.defense+40);assert.equal(worn.hp,bare.hp+200+4);assert.ok(worn.power>bare.power);
 assert.ok(outcome.result.events.some(e=>e.kind==='PET_EQUIPPED'));
 outcome=await pets.equip(a.id,second.id);
 assert.equal(outcome.state.pets.filter(p=>p.equipped).length,1);assert.equal(outcome.profile.equipment.pet?.id,second.id);
 assert.ok(outcome.result.events.some(e=>e.kind==='PET_UNEQUIPPED'&&e.petId===first.id));
 assert.equal(attributes(outcome.profile.equipment,a.level).attack,bare.attack+120);
 outcome=await pets.unequip(a.id,second.id);
 assert.equal(outcome.profile.equipment.pet,undefined);assert.deepEqual(attributes(outcome.profile.equipment,a.level),bare);
});
test('nobody can equip, feed, rename or release another player pet',async()=>{
 const {pets,a,b,profiles}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});food(profiles,b.id,{'pet-food-test':5});
 await assert.rejects(pets.equip(b.id,pet.id),/não é seu/);await assert.rejects(pets.feed(b.id,pet.id,'pet-food-test',1),/não é seu/);
 await assert.rejects(pets.rename(b.id,pet.id,'Ladrão'),/não é seu/);await assert.rejects(pets.release(b.id,pet.id,pet.name),/não é seu/);
 assert.equal(profiles.get(b.id)!.petFood['pet-food-test'],5);
});
test('releasing needs confirmation and respects locks and the equipped pet',async()=>{
 const {pets,a}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test',name:'Faísca'});
 await pets.setLocked(a.id,pet.id,true);await assert.rejects(pets.release(a.id,pet.id,'Faísca'),/Desbloqueie/);
 await pets.setLocked(a.id,pet.id,false);await pets.equip(a.id,pet.id);await assert.rejects(pets.release(a.id,pet.id,'Faísca'),/Desequipe/);
 await pets.unequip(a.id,pet.id);await assert.rejects(pets.release(a.id,pet.id,'Outro'),/Digite o nome/);
 const outcome=await pets.release(a.id,pet.id,'Faísca');assert.deepEqual(outcome.state.pets,[]);assert.ok(outcome.result.events.some(e=>e.kind==='PET_RELEASED'));
 await assert.rejects(pets.rename(a.id,pet.id,'Volta'),/não é seu/);
});
test('feeding spends real food, only what the pet needs, within the daily limit; no food means no feeding',async()=>{
 const {pets,a,profiles}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});
 await assert.rejects(pets.feed(a.id,pet.id,'pet-food-test',1),/não tem alimentos/);
 await assert.rejects(pets.feed(a.id,pet.id,'pet-food-unknown',1),/desconhecido/);
 food(profiles,a.id,{'pet-food-test':20});
 await assert.rejects(pets.feed(a.id,pet.id,'pet-food-test',1),/satisfeito/);
 pets.pets.get(pet.id)!.vitality=20;
 await assert.rejects(pets.feed(a.id,pet.id,'pet-food-test',6),/até 5/);
 let outcome=await pets.feed(a.id,pet.id,'pet-food-test',5);
 // 80 missing → 3 units (90), never the 5 asked for.
 assert.equal(outcome.state.pets[0].vitality,100);assert.equal(outcome.profile.petFood['pet-food-test'],17);
 assert.ok(outcome.result.events.some(e=>e.kind==='PET_FED')&&outcome.result.events.some(e=>e.kind==='PET_VITALITY_CHANGED'));
 pets.pets.get(pet.id)!.vitality=0;
 outcome=await pets.feed(a.id,pet.id,'pet-food-test',5);assert.equal(outcome.state.pets[0].vitality,100);
 pets.pets.get(pet.id)!.vitality=0;
 // 3 + 4 units today: the daily limit of 8 leaves one.
 await assert.rejects(pets.feed(a.id,pet.id,'pet-food-test',2),/só pode comer mais 1/);
});
test('concurrent feedings never spend the same food twice',async()=>{
 const {pets,a,profiles}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});
 pets.pets.get(pet.id)!.vitality=0;food(profiles,a.id,{'pet-food-test':2});
 const results=await Promise.allSettled([1,2,3,4].map(()=>pets.feed(a.id,pet.id,'pet-food-test',1)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
 assert.equal(profiles.get(a.id)!.petFood['pet-food-test'],undefined);assert.equal(pets.pets.get(pet.id)!.vitality,60);
});
test('vitality scales the bonuses by the configured curve and zero vitality grants nothing',()=>{
 assert.equal(vitalityFactor(100),1);assert.equal(vitalityFactor(75),1);assert.equal(vitalityFactor(74),.75);assert.equal(vitalityFactor(50),.75);
 assert.equal(vitalityFactor(30),.5);assert.equal(vitalityFactor(1),.25);assert.equal(vitalityFactor(0),0);
 const snapshot={id:randomUUID(),species:'test-pet',level:1,quality:'common',stars:0,stage:0,vitality:100,traits:{},skills:[]};
 assert.equal(petContribution(snapshot).attack,100);assert.equal(petContribution({...snapshot,vitality:60}).attack,75);
 assert.equal(petContribution({...snapshot,vitality:10}).attack,25);assert.deepEqual(petContribution({...snapshot,vitality:0}),{});
 assert.equal(petContribution({...snapshot,skills:[{id:'test-sturdy',level:1}]}).defense,90);
});
test('EXP from the central curve: several levels at once, stops at the cap, unlocks skills and slots',()=>{
 assert.equal(xpForLevel(1),0);assert.equal(xpForLevel(2),xpToNext(1));assert.equal(levelForPetXp(xpForLevel(5),60),5);assert.equal(levelForPetXp(xpForLevel(5)-1,60),4);
 const pet:PlayerPet={id:randomUUID(),ownerId:randomUUID(),species:'test-pet',name:'Teste',level:1,xp:0,vitality:100,quality:'common',stars:0,stage:0,traits:{},knownSkills:[],equippedSkills:[null,null,null,null],gear:{},equipped:false,locked:false,obtainedAt:'',source:'test',evolution:{}};
 const jump=gainPetXp(pet,xpForLevel(12));
 assert.equal(pet.level,12);assert.equal(jump.levelsGained,11);assert.deepEqual(jump.unlockedSlots,[1]);assert.ok(jump.unlockedSkills.includes('test-late'));
 const cap=gainPetXp(pet,10_000_000);assert.equal(pet.level,60);assert.equal(cap.capped,true);assert.equal(pet.xp,xpForLevel(60));
 assert.equal(gainPetXp(pet,1000).gained,0);
 assert.equal(petStats({...pet,level:11}).attack,200);assert.equal(petStats({...pet,level:1,quality:'rare'}).attack,120);assert.equal(petStats({...pet,level:1,stars:2}).attack,120);
});
test('skill slots open by level, refuse unknown or locked skills and move a skill instead of copying it',async()=>{
 const {pets,a}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});
 await assert.rejects(pets.setSkillSlot(a.id,pet.id,1,'test-strike'),/nível 10/);
 await assert.rejects(pets.setSkillSlot(a.id,pet.id,0,'test-late'),/não aprendeu/);
 await pets.setSkillSlot(a.id,pet.id,0,'test-strike');
 pets.pets.get(pet.id)!.level=10;pets.pets.get(pet.id)!.xp=xpForLevel(10);
 const outcome=await pets.setSkillSlot(a.id,pet.id,1,'test-strike');
 assert.deepEqual(outcome.state.pets[0].equippedSkills,[null,'test-strike',null,null]);
 // Unequipping the pet never forgets its skills.
 await pets.equip(a.id,pet.id);const off=await pets.unequip(a.id,pet.id);assert.ok(off.state.pets[0].knownSkills.length>=8);assert.equal(off.state.pets[0].equippedSkills[1],'test-strike');
});
test('battle results apply once per battle and pet, even when delivered again',async()=>{
 const {pets,a}=service();const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});await pets.equip(a.id,pet.id);
 const battle=randomUUID(),entry={ownerId:a.id,petId:pet.id,mode:'pvp' as const,won:true};
 const first=await pets.settleBattle(battle,[entry]),again=await pets.settleBattle(battle,[entry]);
 assert.equal(first.size,1);assert.equal(again.size,0);
 const after=pets.pets.get(pet.id)!;assert.equal(after.xp,PET_CONFIG.progression.sources.pvpWin);assert.equal(after.vitality,100-PET_CONFIG.vitality.battleCost.pvp);
 assert.equal(first.get(a.id)!.profile.equipment.pet?.vitality,after.vitality);
 pets.pets.get(pet.id)!.vitality=0;assert.equal((await pets.settleBattle(randomUUID(),[entry])).size,0);
});

// ── Skill engine ──
function fighters(){
 const owner:PetCombatant={id:'a',team:0,hp:1000,maxHp:1000,level:10},enemy:PetCombatant={id:'b',team:1,hp:1000,maxHp:1000,level:10};
 owner.pet=createBattlePet({petId:randomUUID(),species:'test-pet',skills:[{id:'test-strike',level:1},{id:'test-focus',level:1},{id:'test-guard',level:1},{id:'test-thorns',level:1},{id:'test-per-shot',level:1}]},'pvp');
 return {owner,enemy,ctx:(roll=0):PetEngineContext=>({fighters:[owner,enemy],mode:'pvp',roll:()=>roll})};
}
test('an active skill spends Magia, deals its damage, adds Delay and waits its cooldown',()=>{
 const {owner,enemy,ctx}=fighters();petTurnStart(ctx(),owner);
 assert.equal(owner.pet!.mana,PET_CONFIG.mana.initial+PET_CONFIG.mana.regenPerTurn);
 const used=activatePetSkill(ctx(),owner,'test-strike');
 assert.equal(enemy.hp,900);assert.equal(owner.pet!.mana,20);assert.equal(owner.delay,50);assert.ok(used.applications.some(a=>a.kind==='damage'&&a.amount===100));
 assert.throws(()=>activatePetSkill(ctx(),owner,'test-strike'),/Aguarde 2 turno/);
 petTurnStart(ctx(),owner);assert.throws(()=>activatePetSkill(ctx(),owner,'test-strike'),/Aguarde 1 turno/);
 petTurnStart(ctx(),owner);activatePetSkill(ctx(),owner,'test-strike');assert.equal(enemy.hp,800);
});
test('an active skill without enough Magia fails and changes nothing',()=>{
 const {owner,enemy,ctx}=fighters();owner.pet!.mana=5;
 assert.throws(()=>activatePetSkill(ctx(),owner,'test-strike'),/Magia do pet insuficiente/);assert.equal(enemy.hp,1000);assert.equal(owner.pet!.mana,5);
 assert.throws(()=>activatePetSkill(ctx(),owner,'test-sturdy'),/não está equipada/);
 assert.throws(()=>activatePetSkill(ctx(),{...owner,pet:undefined},'test-strike'),/não tem um pet/);
});
test('passive chances are rolled by the server',()=>{
 const miss=fighters();dispatchPetTrigger(miss.ctx(.9),'damaged',miss.owner,{sourceId:'b',targetId:'a',amount:50});assert.equal(miss.enemy.hp,1000);
 const hit=fighters();dispatchPetTrigger(hit.ctx(.1),'damaged',hit.owner,{sourceId:'b',targetId:'a',amount:50});assert.equal(hit.enemy.hp,970);
});
test('skills answering each other stop at the chain limit instead of looping forever',()=>{
 const a:PetCombatant={id:'a',team:0,hp:1000,maxHp:1000,level:1},b:PetCombatant={id:'b',team:1,hp:1000,maxHp:1000,level:1};
 a.pet=createBattlePet({petId:randomUUID(),species:'test-pet',skills:[{id:'test-echo-a',level:1}]},'pvp');
 b.pet=createBattlePet({petId:randomUUID(),species:'test-pet',skills:[{id:'test-echo-b',level:1}]},'pvp');
 const ctx:PetEngineContext={fighters:[a,b],mode:'pvp',roll:()=>0};
 const out=dispatchPetTrigger(ctx,'damage-dealt',a,{sourceId:'a',targetId:'b',amount:10});
 const damage=out.filter(x=>x.kind==='damage').length;
 assert.ok(damage>0&&damage<=PET_CONFIG.engine.maxChainDepth+1,`chain of ${damage}`);
});
test('a next-shot bonus is spent once per shot, whatever the number of projectiles',()=>{
 const {owner,ctx}=fighters();activatePetSkill(ctx(),owner,'test-focus');
 assert.equal(consumeShotBonus(owner),1.5);assert.equal(consumeShotBonus(owner),1);assert.equal(owner.petEffects?.length??0,0);
 // A per-shot passive fires once for three projectiles of the same shot, again for the next shot.
 const before=owner.pet!.mana;for(let n=0;n<3;n++)dispatchPetTrigger(ctx(),'hit',owner,{sourceId:'a',targetId:'b',amount:10,shotId:'shot-1'});
 assert.equal(owner.pet!.mana,before+5);dispatchPetTrigger(ctx(),'hit',owner,{sourceId:'a',targetId:'b',amount:10,shotId:'shot-2'});assert.equal(owner.pet!.mana,before+10);
});
test('shields soak damage, then expire with the carrier turns',()=>{
 const {owner,ctx}=fighters();activatePetSkill(ctx(),owner,'test-guard');
 assert.deepEqual(incomingPetDamage(owner,150),{damage:0,absorbed:150});assert.deepEqual(incomingPetDamage(owner,100),{damage:50,absorbed:50});
 const fresh=fighters();activatePetSkill(fresh.ctx(),fresh.owner,'test-guard');petTurnEnd(fresh.ctx(),fresh.owner);assert.equal(fresh.owner.petEffects?.length,1);petTurnEnd(fresh.ctx(),fresh.owner);assert.equal(fresh.owner.petEffects,undefined);
});

// ── Game ──
class MemoryStore implements ProfileStore {
 constructor(public profiles:Map<string,Profile>){}
 async saveAbilityLoadout():Promise<never>{throw Error('unused');}
 async buy():Promise<never>{throw Error('unused');}
 async compose():Promise<never>{throw Error('unused');}
 async forge():Promise<never>{throw Error('unused');}
 async getProfile(id:string){return structuredClone(this.profiles.get(id)??null);}
 async saveEquipment(id:string,equipment:Equipment){const p=this.profiles.get(id)!;p.equipment={...equipment,...(p.equipment.pet?{pet:p.equipment.pet}:{})};return structuredClone(p);}
 async rename(){}
 finishCalls:unknown[][]=[];
 async finishMatch(...args:unknown[]){this.finishCalls.push(args);}
}
async function arena(practice=true){
 const {pets,profiles,a,b}=service(),store=new MemoryStore(profiles),game=new Game(store),events=new Map<string,ServerEvent[]>();game.pets=pets;game.petRoll=()=>.99;
 for(const p of [a,b]){events.set(p.id,[]);game.connect(structuredClone(p),event=>events.get(p.id)!.push(structuredClone(event)));}
 const {pet}=await pets.grant(a.id,'test-pet',{source:'test'});
 await game.command(a.id,{type:'pet-skill-slot',pet:pet.id,slot:0,skill:'test-strike'});
 await game.command(a.id,{type:'pet-equip',pet:pet.id});
 const start=async()=>{
  if(practice){await game.command(a.id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});const roomId=game.peers.get(a.id)!.roomId!;await game.command(b.id,{type:'join',roomId});await game.command(b.id,{type:'ready'});await game.command(a.id,{type:'start'});return game.matches.get(roomId)!;}
  await game.command(a.id,{type:'create',name:'Sala A'});await game.command(b.id,{type:'create',name:'Sala B'});await game.command(a.id,{type:'queue'});await game.command(b.id,{type:'queue'});
  return game.matches.get(game.peers.get(a.id)!.roomId!)!;
 };
 return {game,pets,profiles,a,b,pet,events,start,store};
}
const errors=(events:ServerEvent[])=>events.filter((e):e is Extract<ServerEvent,{type:'error'}>=>e.type==='error');
test('a battle without pets runs exactly as before: no pet state, no pet events',async()=>{
 const {game,b,events,profiles,a}=await arena();
 await game.command(a.id,{type:'pet-unequip',pet:[...(await game.pets!.list(a.id)).pets][0].id});
 await game.command(a.id,{type:'create',practice:true,name:'Duelo',mode:'1v1',map:'sky'});const roomId=game.peers.get(a.id)!.roomId!;await game.command(b.id,{type:'join',roomId});await game.command(b.id,{type:'ready'});await game.command(a.id,{type:'start'});
 const m=game.matches.get(roomId)!;
 for(const f of m.state.players){assert.equal(f.pet,undefined);assert.equal(f.petEffects,undefined);assert.equal(f.equipment.pet,undefined);assert.equal(f.maxHp,attributes(profiles.get(f.id)!.equipment,f.level).hp);}
 assert.equal([...events.values()].flat().filter(e=>e.type==='pet-effect').length,0);
});
test('the equipped pet enters the battle snapshot: bonus Vida, Magia and skills; swapping mid-battle is refused',async()=>{
 const {game,a,pet,events,start,pets}=await arena();
 const m=await start(),me=m.state.players.find(f=>f.id===a.id)!;
 assert.equal(me.pet?.petId,pet.id);assert.deepEqual(me.pet?.skills.map(s=>s.id),['test-strike']);
 assert.equal(me.maxHp,attributes(DEFAULT_EQUIPMENT,me.level).hp+203);
 await game.command(a.id,{type:'pet-unequip',pet:pet.id});assert.match(errors(events.get(a.id)!).at(-1)!.message,/entre as batalhas/);
 assert.equal(me.equipment.pet?.id,pet.id);assert.equal((await pets.list(a.id)).pets[0].equipped,true);
});
test('pet skills: only on your turn, through the server, with Magia and cooldown',async()=>{
 const {game,a,b,events,start}=await arena();const m=await start();
 const me=m.state.players.find(f=>f.id===a.id)!,enemy=m.state.players.find(f=>f.id===b.id)!;
 if(m.state.turnId!==a.id){await game.command(b.id,{type:'pass'});}
 assert.equal(m.state.turnId,a.id);
 await game.command(b.id,{type:'pet-skill',skill:'test-strike'});assert.match(errors(events.get(b.id)!).at(-1)!.message,/sua vez|não tem um pet/);
 const hp=enemy.hp;await game.command(a.id,{type:'pet-skill',skill:'test-strike'});
 assert.equal(enemy.hp,hp-100);assert.ok(events.get(b.id)!.some(e=>e.type==='pet-effect'));
 await game.command(a.id,{type:'pet-skill',skill:'test-strike'});assert.match(errors(events.get(a.id)!).at(-1)!.message,/Aguarde/);
 me.pet!.skills[0].readyAt=0;me.pet!.mana=0;
 await game.command(a.id,{type:'pet-skill',skill:'test-strike'});assert.match(errors(events.get(a.id)!).at(-1)!.message,/Magia/);
});
test('pet battle state survives a restart and a reconnect',async()=>{
 const {game,a,start,store}=await arena();const m=await start();const me=m.state.players.find(f=>f.id===a.id)!;me.pet!.mana=77;me.petEffects=[{id:'x',kind:'shield',skill:'test-guard',sourceId:a.id,stackKey:'k',stacks:1,shield:120,turns:2}];
 const saved=JSON.parse(JSON.stringify(game.savedState())) as {game:SavedGame;matches:({key:string;stable:true;match:SavedMatch;terrain:Uint8Array}|{key:string;stable:false})[]};
 const restored=new Game(store);restored.restore(saved.game,saved.matches.filter((x):x is {key:string;stable:true;match:SavedMatch;terrain:Uint8Array}=>x.stable).map(x=>({match:x.match,terrain:m.terrain})));
 const back=[...restored.matches.values()][0].state.players.find(f=>f.id===a.id)!;
 assert.equal(back.pet?.mana,77);assert.equal(back.petEffects?.[0].shield,120);assert.equal(back.equipment.pet?.id,me.equipment.pet?.id);
 game.disconnect(a.id);game.connect(game.peers.get(a.id)!.profile,()=>{});assert.equal(m.state.players.find(f=>f.id===a.id)!.pet?.mana,77);
});
test('a finished PvP battle settles the pet once; practice battles do not count',async()=>{
 const practice=await arena(true),pm=await practice.start();
 pm.state.players.find(f=>f.id===practice.b.id)!.hp=0;pm.state.deadline=0;practice.game.tick();pm.state.rewards!.deadline=0;practice.game.tick();
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(practice.pets.pets.get(practice.pet.id)!.xp,0);
 const ranked=await arena(false),m=await ranked.start();assert.ok(m,'queue match');
 m.state.players.find(f=>f.id===ranked.b.id)!.hp=0;m.state.deadline=0;ranked.game.tick();assert.equal(m.state.phase,'finished');
 m.state.rewards!.deadline=0;ranked.game.tick();await new Promise(resolve=>setTimeout(resolve,30));
 const after=ranked.pets.pets.get(ranked.pet.id)!;assert.equal(after.xp,PET_CONFIG.progression.sources.pvpWin);assert.equal(after.vitality,100-PET_CONFIG.vitality.battleCost.pvp);
 // Replaying the save (a retry or a duplicated end) changes nothing.
 await ranked.pets.settleBattle(m.state.id,[{ownerId:ranked.a.id,petId:ranked.pet.id,mode:'pvp',won:true}]);
 assert.equal(ranked.pets.pets.get(ranked.pet.id)!.xp,after.xp);
 assert.ok(ranked.events.get(ranked.a.id)!.some(e=>e.type==='pet-result'&&e.result.action==='battle'));
 assert.equal(ranked.game.peers.get(ranked.a.id)!.profile.equipment.pet?.vitality,after.vitality);
});
test('permanent data never takes battle state: the saved pet has no Magia, cooldowns or effects',async()=>{
 const {a,start,pets,profiles}=await arena();const m=await start();const me=m.state.players.find(f=>f.id===a.id)!;me.pet!.mana=0;me.petEffects=[{id:'x',kind:'stat',skill:'s',sourceId:a.id,stackKey:'k',stacks:1,stat:'attack',value:500,turns:3}];
 const stored=pets.pets.get(me.pet!.petId)!;assert.ok(!('mana' in stored));assert.ok(!('petEffects' in profiles.get(a.id)!.equipment));
 assert.deepEqual(Object.keys(petSnapshot(stored)).sort(),['id','level','quality','skills','species','stage','stars','traits','vitality']);
});
