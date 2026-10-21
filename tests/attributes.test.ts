import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {attributes,CATALOG,DEFAULT_EQUIPMENT,ITEMS,itemAttributes,MAX_UPGRADE,WEAPONS,weaponStats} from '../shared/catalog';
import type {Equipment,Item,Weapon} from '../shared/catalog';
import {criticalChance,criticalFromRoll,damageAtImpact,monsterDamage} from '../shared/combat';
import {armorReduction,baseDelay,clampHp,hpPower,combinedReduction,criticalBonusMultiplier,criticalChancePercent,defenseReduction,levelHpBonus,maxHpFor,maxStaminaFor,PASS_DELAY,strengthenedValue,strengthenMultiplier,weaponMilestoneValue} from '../shared/stats';
import {nextByDelay,startDelayTurn,timeDelay} from '../shared/turnDelay';
import type {DelayActor} from '../shared/turnDelay';
import type {Profile} from '../shared/protocol';
import {Game} from '../server/game';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {chargedFire} from './fixtures/charge';

const close=(actual:number,expected:number,digits=6)=>assert.ok(Math.abs(actual-expected)<10**-digits,`${actual} ≈ ${expected}`);
const neutral:Equipment={...DEFAULT_EQUIPMENT,hat:'hat-none'};
/** A temporary hat carrying the given attributes, removed after the body runs. */
function withItems(values:Partial<Item>[],body:(equipment:Equipment[])=>void){
 const ids=values.map(()=>`qa-attr-${randomUUID()}`);
 values.forEach((value,index)=>{CATALOG[ids[index]]={...CATALOG['hat-none'],...value,id:ids[index]};});
 try{body(ids.map(id=>({...neutral,hat:id})));}finally{for(const id of ids)delete CATALOG[id];}
}

test('strengthening multiplies the main attribute by 1.10 per level from +0 to +15 and never past it',()=>{
 close(strengthenMultiplier(0),1);close(strengthenMultiplier(10),2.5937424601);close(strengthenMultiplier(12),3.138428376721);close(strengthenMultiplier(15),4.177248169415656);
 assert.equal(strengthenMultiplier(16),strengthenMultiplier(15));assert.equal(strengthenMultiplier(99),strengthenMultiplier(MAX_UPGRADE));assert.equal(strengthenMultiplier(-3),1);assert.equal(strengthenMultiplier(NaN),1);
 // The prompt's worked examples: weapon Dano 200, outfit Armadura 100, hat Armadura 90.
 for(const [base,expected] of [[200,[200,322,519,628,835]],[100,[100,161,259,314,418]],[90,[90,145,233,282,376]]] as const)
  assert.deepEqual([0,5,10,12,15].map(level=>strengthenedValue(base,level)),expected);
});

test('weapons strengthen Dano; hats and outfits strengthen Armadura; recalculating never compounds',()=>{
 const weapon={...WEAPONS[0],damage:200} as Weapon,original=structuredClone(weapon);
 assert.equal(weaponStats(weapon,10).damage,519);assert.equal(weaponStats(weapon,12).damage,628);assert.equal(weaponStats(weapon,15).damage,835);assert.equal(weaponStats(weapon,16).damage,835);
 // Feeding a strengthened copy back must not be how the game works: the catalog item stays original.
 weaponStats(weapon,15);weaponStats(weapon,15);assert.deepEqual(weapon,original);assert.equal(itemAttributes(weapon,15).damage,itemAttributes(weapon,15).damage);
 const outfit=ITEMS.find(item=>item.slot==='outfit'&&(item.armor??0)>0)!,hat=ITEMS.find(item=>item.slot==='hat'&&(item.armor??0)>0)!;
 for(const item of [outfit,hat])for(const level of [0,10,12,15]){
  const values=itemAttributes(item,level);
  assert.equal(values.armor,Math.round(item.armor!*1.1**level));
  // Secondary attributes of hats and outfits never gain the weapon milestones.
  assert.deepEqual([values.attack,values.defense,values.agility,values.luck],[item.attack,item.defense,item.agility,item.luck??0]);
 }
 assert.equal(itemAttributes(weapon,10).armor,weapon.armor??0,'weapons do not strengthen Armadura');
});

test('weapon Ataque, Defesa, Agilidade and Sorte gain only at +10 (×1.2) and +12 (×1.3 on top), truncated',()=>{
 assert.deepEqual([0,9,10,11,12,15].map(level=>weaponMilestoneValue(100,level)),[100,100,120,120,156,156]);
 assert.deepEqual([9,10,12].map(level=>weaponMilestoneValue(40,level)),[40,48,62]);
 for(let base=0;base<=400;base++)assert.equal(weaponMilestoneValue(base,12),Math.floor(Math.floor(base*12/10)*13/10),`base ${base}`);
 const weapon=WEAPONS[0],at9=weaponStats(weapon,9),at10=weaponStats(weapon,10),at12=weaponStats(weapon,12);
 for(const key of ['attack','defense','agility','luck'] as const){assert.equal(at9[key],weapon[key]);assert.equal(at10[key],weaponMilestoneValue(weapon[key]!,10));assert.equal(at12[key],weaponMilestoneValue(weapon[key]!,12));}
});

test('composition is added after strengthening and is never multiplied',()=>{
 const weapon=WEAPONS[0],plain=itemAttributes(weapon,12),composed=itemAttributes(weapon,12,{attack:30,defense:20,agility:10,armor:10});
 assert.equal(composed.attack-plain.attack,30);assert.equal(composed.defense-plain.defense,20);assert.equal(composed.agility-plain.agility,10);assert.equal(composed.armor-plain.armor,10);
 const outfit=ITEMS.find(item=>item.slot==='outfit'&&(item.armor??0)>0)!;assert.equal(itemAttributes(outfit,15,{armor:30}).armor,Math.round(outfit.armor!*1.1**15)+30);
});

test('worn hat and outfit levels reach the character totals and survive a save and load',()=>{
 const outfit=ITEMS.find(item=>item.slot==='outfit'&&(item.armor??0)>0&&item.gender!=='female')!;
 const saved=normalizeProfile({id:randomUUID(),name:'Forjado',gender:'male',inventory:[outfit.id,'brick'],equipment:{...DEFAULT_EQUIPMENT,weapon:'brick',outfit:outfit.id},upgrades:{brick:10,[outfit.id]:12}});
 assert.equal(saved.equipment.upgrade,10);assert.deepEqual(saved.equipment.slotUpgrades,{outfit:12});
 const loaded=normalizeProfile(JSON.parse(JSON.stringify(saved)));assert.deepEqual(loaded.equipment,saved.equipment);assert.deepEqual(loaded.upgrades,saved.upgrades);
 const bare=attributes({...loaded.equipment,slotUpgrades:{}});assert.equal(attributes(loaded.equipment).armor-bare.armor,Math.round(outfit.armor!*1.1**12)-outfit.armor!);
 // Levels past +15 are clamped when read back.
 assert.equal(normalizeProfile({...JSON.parse(JSON.stringify(saved)),upgrades:{brick:40,[outfit.id]:40}}).equipment.slotUpgrades?.outfit,15);
});

test('Vida = (950 + Nível×50 + bônus de nível + Defesa/10) and Vigor = 240 + Agilidade/30',()=>{
 assert.equal(levelHpBonus(10),0);assert.equal(levelHpBonus(11),30);assert.equal(levelHpBonus(30),20*30+10*40);
 assert.equal(levelHpBonus(70),60*30+50*40+40*50+30*60+20*70+10*80);
 assert.equal(maxHpFor(1,0),1000);assert.equal(maxHpFor(1,300),1030);assert.equal(maxHpFor(1,800),1080);assert.equal(maxHpFor(1,1500),1150);
 assert.equal(maxHpFor(30,800),950+1500+1000+80);assert.equal(maxHpFor(10,95),1450+9);assert.equal(maxHpFor(1,100,1.5),1515);
 assert.deepEqual([0,300,600,900,1200,1500,3000].map(maxStaminaFor),[240,250,260,270,280,290,340]);
 withItems([{defense:0},{defense:800},{agility:900}],([low,high,agile])=>{
  assert.equal(attributes(high,20).hp-attributes(low,20).hp,80);assert.equal(attributes(agile).stamina-attributes(low).stamina,30);
 });
 assert.equal(clampHp(1500,1200),1200);assert.equal(clampHp(-4,1200),0);assert.equal(clampHp(700,1200),700);assert.equal(clampHp(NaN,1200),0);
});

test('damage: Ataque multiplies, Defesa and Armadura reduce separately and combine multiplicatively',()=>{
 close(defenseReduction(800,300),.95*500/1100);assert.equal(defenseReduction(200,300),0);
 close(armorReduction(100,10),.95*70/570);assert.equal(armorReduction(20,10),0,'Armadura below 3 × level never turns into a bonus');
 close(combinedReduction(.3,.2),.44);
 withItems([{attack:0},{attack:1000},{defense:800},{armor:600},{luck:300}],([plain,strong,guarded,armored,lucky])=>{
  const base=damageAtImpact(plain,plain);
  assert.ok(damageAtImpact(strong,plain)>base);assert.equal(damageAtImpact(plain,strong),base,'Ataque is not protection');
  assert.ok(damageAtImpact(plain,guarded)<base);assert.ok(damageAtImpact(plain,armored)<base);
  assert.ok(damageAtImpact(lucky,guarded)>damageAtImpact(plain,guarded)*1.0001,'Sorte weakens the target Defesa');
  // A higher attacker level wears down Armadura.
  assert.ok(damageAtImpact(plain,armored,{attackerLevel:60})>damageAtImpact(plain,armored,{attackerLevel:1}));
 });
});

test('critical chance and bonus grow with Sorte; the legacy roll keeps the original integer draw',()=>{
 for(const [luck,percent] of [[0,0],[100,5],[300,12.2727],[500,17.3077],[800,22.5],[1200,27],[2000,32.1429]] as const)close(criticalChancePercent(luck),percent,3);
 close(criticalBonusMultiplier(1000),.65);
 assert.equal(criticalFromRoll(0,0),false,'normalized: 0% never crits');assert.equal(criticalFromRoll(0,0,'legacy'),true,'legacy: chance 0 >= Random.Next(100) = 0');
 assert.equal(criticalFromRoll(0,.01,'legacy'),false);assert.equal(criticalFromRoll(100,.05,'legacy'),true);assert.equal(criticalFromRoll(100,.06,'legacy'),false);
 assert.ok(criticalChance(300)<criticalChance(600));
 withItems([{luck:0},{luck:1000}],([plain,lucky])=>{
  const luck=attributes(lucky).luck,normal=damageAtImpact(lucky,plain),critical=damageAtImpact(lucky,plain,{critical:true});
  assert.ok(Math.abs(critical-normal*(1.5+luck*.00015))<=1.5);assert.ok(damageAtImpact(lucky,plain,{critical:true})/normal>damageAtImpact(plain,plain,{critical:true})/damageAtImpact(plain,plain));
 });
});

test('no formula yields NaN, infinity or a negative result on bad input',()=>{
 const values=[NaN,Infinity,-Infinity,-1e9,0,1e12];
 for(const a of values)for(const b of values){
  for(const result of [defenseReduction(a,b),armorReduction(a,b),criticalChancePercent(a),criticalBonusMultiplier(a),baseDelay(a,b),maxHpFor(a,b),maxStaminaFor(a),timeDelay(a)]){assert.ok(Number.isFinite(result),`${a}, ${b}`);assert.ok(result>=0||result===baseDelay(a,b));}
  assert.ok(defenseReduction(a,b)<.95&&armorReduction(a,b)<.95);
 }
 assert.ok(Number.isFinite(monsterDamage(NaN,DEFAULT_EQUIPMENT)));assert.equal(damageAtImpact(DEFAULT_EQUIPMENT,DEFAULT_EQUIPMENT,{attenuation:NaN}),0);
});

test('base Delay rises with Ataque and falls with Agilidade, with the original integer divisions',()=>{
 assert.deepEqual([500,1000,1500,2000].map(attack=>baseDelay(1000,attack)),[1105,1155,1205,1255]);
 assert.equal(baseDelay(0,0),1600);assert.ok(baseDelay(600,300)<baseDelay(300,300));assert.ok(baseDelay(300,600)>baseDelay(300,300));
 // Diminishing returns: the first 600 Agilidade saves more than the next 600.
 assert.ok(baseDelay(0,0)-baseDelay(600,0)>baseDelay(600,0)-baseDelay(1200,0));
 withItems([{agility:0},{agility:600},{attack:600}],([plain,agile,strong])=>{
  assert.ok(attributes(agile).delay<attributes(plain).delay);assert.ok(attributes(strong).delay>attributes(plain).delay);
 });
 assert.equal(timeDelay(0),0);assert.equal(timeDelay(9999),180);assert.equal(timeDelay(10_000),200);assert.equal(timeDelay(120_000),600);
});

test('turn order: lowest living Delay plays, relative Delay is kept, ties alternate, consecutive turns happen',()=>{
 const actors:DelayActor[]=[{id:'a',hp:1,delay:1400},{id:'b',hp:1,delay:1400},{id:'c',hp:0,delay:0}];
 const first=nextByDelay(actors)!;assert.equal(first.id,'a','dead fighters never play, ties go to roster order');
 startDelayTurn(actors,first,1400);assert.deepEqual(actors.map(a=>a.delay),[1400,0,-1400]);
 actors[0].delay!+=200;// a fired after 10 s
 const second=nextByDelay(actors,'a')!;assert.equal(second.id,'b');startDelayTurn(actors,second,1400);assert.deepEqual(actors.map(a=>a.delay),[1600,1400,-1400]);
 actors[1].delay!+=PASS_DELAY;// b passed: 1500 < 1600
 assert.equal(nextByDelay(actors,'b')!.id,'b','the faster fighter plays again; no forced A → B rotation');
 const tie:DelayActor[]=[{id:'a',hp:1,delay:0},{id:'b',hp:1,delay:0}];assert.equal(nextByDelay(tie,'a')!.id,'b');assert.equal(nextByDelay(tie,'b')!.id,'a');
 assert.equal(nextByDelay([{id:'x',hp:0},{id:'y',hp:5,left:true}]),undefined);
});

function duel(){
 const profiles=new Map<string,Profile>();
 const store:ProfileStore={saveAbilityLoadout:async()=>{throw Error('unused');},buy:async()=>{throw Error('unused');},getProfile:async id=>profiles.get(id)??null,saveEquipment:async id=>profiles.get(id)!,rename:async()=>{},finishMatch:async()=>{},forge:async()=>{throw Error('unused');},compose:async()=>{throw Error('unused');}};
 const game=new Game(store,()=>{},()=>.99),a=normalizeProfile({id:randomUUID(),name:'Delay A'}),b=normalizeProfile({id:randomUUID(),name:'Delay B'});
 for(const profile of [a,b]){profiles.set(profile.id,profile);game.connect(profile,()=>{});}
 return {game,a,b};
}

test('the server orders turns by Delay: a slow shot lets a quick passer play twice, the base Delay counts once per turn',async()=>{
 const {game,a,b}=duel();
 await game.command(a.id,{type:'create',practice:true,name:'Delay',mode:'1v1',map:'celestial'});const roomId=game.peers.get(a.id)!.roomId!;
 await game.command(b.id,{type:'join',roomId});await game.command(b.id,{type:'ready'});await game.command(a.id,{type:'start'});
 const m=game.matches.get(roomId)!,s=m.state,fa=s.players.find(p=>p.id===a.id)!,fb=s.players.find(p=>p.id===b.id)!,base=attributes(fa.equipment,fa.level).delay;
 assert.equal(attributes(fb.equipment,fb.level).delay,base,'same equipment, same base Delay');
 assert.equal(s.turnId,a.id);assert.equal(fa.delay,base);assert.equal(fb.delay,0);
 // A fires after spending 20 s: +400 on top of the base Delay added when the turn opened.
 s.deadline-=20_000;await chargedFire(game,a.id,{angle:45,power:5});assert.equal(fa.delay,base+400);
 game.tick(m.resolveAt+1);assert.equal(s.turnId,b.id);assert.equal(fa.delay,base+400);assert.equal(fb.delay,base);
 // B passes at once: +100, still below A, so B plays again.
 await game.command(b.id,{type:'pass'});assert.equal(s.turnId,b.id,'consecutive turn earned by Delay');
 assert.equal(fb.delay,base,'normalized to 0, then one base Delay for the new turn');assert.equal(fa.delay,base+400-(base+100));
 // A turn that runs out adds nothing but the next base Delay.
 const before=fb.delay;game.tick(s.deadline+1);assert.equal(s.turnId,a.id);assert.equal(fa.delay,base);assert.equal(fb.delay,before-(base+400-(base+100)));
});

test('Vida counts in Poder like DDTank 4.1 (Vida × 0.95)',()=>{
 assert.deepEqual([hpPower(0),hpPower(1000),hpPower(1011),hpPower(3000)],[0,950,960,2850]);
 const low=attributes(DEFAULT_EQUIPMENT,1),high=attributes(DEFAULT_EQUIPMENT,40);
 assert.equal(high.power-low.power,hpPower(high.hp)-hpPower(low.hp));assert.ok(high.power>low.power);
});
