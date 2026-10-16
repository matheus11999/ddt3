import assert from 'node:assert/strict';
import {test} from 'node:test';
import {attributes,CONTENT_VERSION,DEFAULT_EQUIPMENT,MAX_UPGRADE,SLOTS,STONES,upgradeChance,WEAPONS,weaponStats} from '../shared/catalog';
import {commandSchema} from '../shared/protocol';
import {normalizeProfile} from '../server/store';

test('forge chance is shown to one decimal and decreases with weapon level',()=>{
 assert.equal(upgradeChance(0,{'1':1}),75);
 for(let level=1;level<MAX_UPGRADE;level++)assert.ok(upgradeChance(level,{'1':1})<upgradeChance(level-1,{'1':1}));
 assert.equal(upgradeChance(11,{'5':1}),10.4);
 assert.equal(upgradeChance(11,{'5':10}),100);
 for(const stone of STONES){assert.ok(upgradeChance(9,{[stone.level]:2})>=upgradeChance(9,{[stone.level]:1}));}
 assert.equal(upgradeChance(0,{'1':1,'2':1}),100);
});

test('forge refuses invalid levels, quantities, material types and forged client outcomes',()=>{
 const invalidSelections:Record<string,number>[]=[{},{'1':0},{'1':-1},{'1':.5},{'1':21},{'1':20,'2':1},{'6':1},{'1':NaN},{'1':Infinity}];
 for(const selection of invalidSelections){
  assert.equal(upgradeChance(0,selection),0);
  assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:selection}).success,false);
 }
 for(const level of [-1,.5,12,100,NaN])assert.equal(upgradeChance(level,{'1':1}),0);
 assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:{'1':1}}).success,true);
 assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:{'1':1},chance:100,level:12}).success,false);
});

test('all weapon upgrades keep weapon identity and apply the same attribute rules',()=>{
 for(const weapon of WEAPONS){
  const base=structuredClone(weapon),upgraded=weaponStats(weapon,12);
  assert.equal(upgraded.id,base.id);assert.equal(upgraded.effect,base.effect);assert.equal(upgraded.crater,base.crater);
  assert.equal(upgraded.attack,base.attack+96);assert.equal(upgraded.damage,Math.round(base.damage*1.42));
  assert.deepEqual(weapon,base);assert.deepEqual(weaponStats(weapon,0),weapon);
  assert.equal(attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:12}).attack-attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:0}).attack,96);
 }
});

test('legacy profiles gain starter materials and synchronize equipped upgrade without refilling spent stacks',()=>{
 const legacy=normalizeProfile({id:'legacy',name:'Legado',equipment:{...DEFAULT_EQUIPMENT,weapon:'volt'}});
 assert.deepEqual(legacy.upgrades,{ember:0,volt:0,crystal:0});assert.equal(legacy.stones['1'],30);assert.ok(legacy.inventory.includes('hat-cap'));
 const restored=normalizeProfile({...legacy,stones:{'1':0},upgrades:{ember:4,volt:9,crystal:99},equipment:{...legacy.equipment,upgrade:12}});
 assert.deepEqual(restored.stones,{'1':0,'2':0,'3':0,'4':0,'5':0});assert.equal(restored.equipment.upgrade,9);assert.equal(restored.upgrades.crystal,12);
});

test('protocol rejects out-of-range simulation input before the game receives it',()=>{
 for(const command of [{type:'move',x:0,y:650},{type:'move',x:900,y:Infinity},{type:'fire',angle:NaN,power:80},{type:'fire',angle:45,power:101},{type:'walk',direction:0},{type:'boost',boost:'damage1000'},{type:'rename',name:'<script>'},{type:'chat',channel:'world',text:'x'.repeat(181)}])assert.equal(commandSchema.safeParse(command).success,false);
 assert.equal(commandSchema.safeParse({type:'rename',name:'Ária do Sol'}).success,true);
});

test('customization accepts all independent slots and rejects forged upgrades, missing slots and unknown dyes',()=>{
 const items=Object.fromEntries(SLOTS.map(slot=>[slot,DEFAULT_EQUIPMENT[slot]]));
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,dyes:{hat:'coral',hair:'gold',outfit:'violet'}}}).success,true);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,upgrade:12}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items:{...items,weapon:undefined}}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,dyes:{face:'gold'}}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,dyes:{hat:'#ffffff'}}}).success,false);
});

test('content migration grants new starter layers once and never refills a removed owned item',()=>{
 const migrated=normalizeProfile({id:'migration',name:'Teste',inventory:['ember'],contentVersion:1});
 assert.ok(migrated.inventory.includes('hair-wavy'));assert.equal(migrated.contentVersion,CONTENT_VERSION);
 const saved=normalizeProfile({...migrated,inventory:migrated.inventory.filter(id=>id!=='hair-wavy')});
 assert.equal(saved.inventory.includes('hair-wavy'),false);
});

test('retired cosmetic items disappear while current equipment uses the eight supported slots',()=>{
 assert.deepEqual([...SLOTS],['weapon','face','outfit','hair','hat','glasses','wristband','bracelet']);
 const migrated=normalizeProfile({id:'retired',name:'Teste',contentVersion:4,inventory:['ember','accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'],equipment:{...DEFAULT_EQUIPMENT,...{accessory:'accessory-satchel',eyes:'eyes-ocean'}}});
 for(const id of ['accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'])assert.equal(migrated.inventory.includes(id),false);
 assert.equal(migrated.equipment.face,'face-brave');assert.equal(migrated.equipment.wristband,'wristband-none');
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items:{...Object.fromEntries(SLOTS.map(slot=>[slot,migrated.equipment[slot]])),eyes:'eyes-ocean'}}}).success,false);
});
