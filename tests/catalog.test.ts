import assert from 'node:assert/strict';
import {test} from 'node:test';
import {attributes,CATALOG,CONTENT_VERSION,DEFAULT_EQUIPMENT,ITEMS,MAX_UPGRADE,SLOTS,STONES,upgradeChance,WEAPONS,weaponStats} from '../shared/catalog';
import {COMPOSITION_STONES,normalizeCompositions,STARTER_COMPOSITION_STONES} from '../shared/composition';
import {levelForXp,levelProgress,MAX_PLAYER_LEVEL} from '../shared/progression';
import {commandSchema} from '../shared/protocol';
import {normalizeProfile} from '../server/store';

test('composition migration grants minerals once and never replenishes spent stacks',()=>{
 const legacy=normalizeProfile({id:'composition',name:'Compositor',contentVersion:7});
 assert.deepEqual(legacy.compositionStones,STARTER_COMPOSITION_STONES);
 assert.deepEqual(normalizeProfile({...legacy,compositionStones:{}}).compositionStones,Object.fromEntries(COMPOSITION_STONES.map(s=>[s.id,0])));
 assert.deepEqual(normalizeCompositions({ember:{attack:30,defense:999,armor:-10},'face-brave':{attack:30},missing:{attack:10}},ITEMS),{ember:{attack:30}});
 assert.equal(commandSchema.safeParse({type:'compose',item:'ember',stone:'attack-1'}).success,true);
 for(const command of [{type:'compose',item:'ember',stone:'attack-4'},{type:'compose',item:'ember',stone:'attack-1',chance:100},{type:'compose',item:'ember',stone:'attack-1',value:999}])assert.equal(commandSchema.safeParse(command).success,false);
});

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
 assert.deepEqual(legacy.upgrades,Object.fromEntries(WEAPONS.map(weapon=>[weapon.id,0])));assert.equal(legacy.stones['1'],30);assert.ok(legacy.inventory.includes('hat-cap'));
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

test('version six grants the two new outfits without restoring removed cosmetics or spent materials',()=>{
 const old=normalizeProfile({id:'outfit-migration',name:'Teste'});
 const migrated=normalizeProfile({...old,contentVersion:5,inventory:old.inventory.filter(id=>!['outfit-surfer','outfit-executive','hair-wavy'].includes(id)),stones:{'1':0,'2':0,'3':0,'4':0,'5':0}});
 assert.ok(migrated.inventory.includes('outfit-surfer'));assert.ok(migrated.inventory.includes('outfit-executive'));
 assert.equal(migrated.inventory.includes('hair-wavy'),false);assert.equal(migrated.stones['1'],0);
 const saved=normalizeProfile({...migrated,inventory:migrated.inventory.filter(id=>id!=='outfit-surfer')});
 assert.equal(saved.inventory.includes('outfit-surfer'),false);assert.equal(saved.contentVersion,CONTENT_VERSION);
});

test('retired cosmetic items disappear while current equipment uses the eight supported slots',()=>{
 assert.deepEqual([...SLOTS],['weapon','face','outfit','hair','hat','glasses','wristband','bracelet']);
 const migrated=normalizeProfile({id:'retired',name:'Teste',contentVersion:4,inventory:['ember','accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'],equipment:{...DEFAULT_EQUIPMENT,...{accessory:'accessory-satchel',eyes:'eyes-ocean'}}});
 for(const id of ['accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'])assert.equal(migrated.inventory.includes(id),false);
 assert.equal(migrated.equipment.face,'face-brave');assert.equal(migrated.equipment.wristband,'wristband-none');
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items:{...Object.fromEntries(SLOTS.map(slot=>[slot,migrated.equipment[slot]])),eyes:'eyes-ocean'}}}).success,false);
});

test('retired outfits migrate to a current owned costume without changing other equipment or resources',()=>{
 assert.deepEqual(ITEMS.filter(item=>item.slot==='outfit').map(item=>item.id),['outfit-surfer','outfit-executive','outfit-racer','outfit-dancer']);
 for(const retired of ['outfit-ranger','outfit-azure','outfit-royal']){
  assert.equal(CATALOG[retired],undefined);
  const before=normalizeProfile({id:'retired-outfit',name:'Teste'});
  const migrated=normalizeProfile({...before,contentVersion:6,inventory:[...before.inventory.filter(id=>id!=='outfit-surfer'),retired],equipment:{...before.equipment,outfit:retired,face:'face-taunt',hat:'hat-cap'},stones:{'1':0},upgrades:{ember:9}});
  assert.equal(migrated.equipment.outfit,'outfit-surfer');assert.ok(migrated.inventory.includes(migrated.equipment.outfit));assert.equal(migrated.inventory.includes(retired),false);
  assert.equal(migrated.equipment.face,'face-taunt');assert.equal(migrated.equipment.hat,'hat-cap');assert.equal(migrated.stones['1'],0);assert.equal(migrated.upgrades.ember,9);assert.equal(migrated.contentVersion,CONTENT_VERSION);
  assert.deepEqual(normalizeProfile(migrated),migrated);
 }
});

test('player progression continues past fifty and caps at seventy with a full XP bar',()=>{
 assert.equal(MAX_PLAYER_LEVEL,70);
 assert.equal(levelForXp(0),1);assert.equal(levelForXp(299),1);assert.equal(levelForXp(300),2);
 assert.equal(levelForXp(14699),49);assert.equal(levelForXp(14700),50);assert.equal(levelForXp(14999),50);assert.equal(levelForXp(15000),51);
 assert.equal(levelForXp(18000),61);assert.equal(levelForXp(20699),69);assert.equal(levelForXp(20700),70);assert.equal(levelForXp(999999),70);
 assert.deepEqual(levelProgress(50,14980),{current:280,required:300,percent:280/300*100,capped:false});
 assert.deepEqual(levelProgress(70,20810),{current:300,required:300,percent:100,capped:true});
 assert.equal(normalizeProfile({id:'over-level',name:'Teste',level:100}).level,70);
});

test('experience saved at the former level cap unlocks new levels without losing profile resources',()=>{
 const before=normalizeProfile({id:'old-cap',name:'Veterano',level:50,xp:14700,gold:845});
 before.xp=18540;
 const migrated=normalizeProfile(before);
 assert.equal(migrated.level,62);assert.equal(migrated.xp,18540);assert.equal(migrated.gold,845);
 assert.deepEqual({...migrated,level:50},before);assert.deepEqual(normalizeProfile(migrated),migrated);
});

test('the dynamite rollout grants only its new weapon once without refilling materials',()=>{
 const old=normalizeProfile({id:'dynamite-migration',name:'Teste',contentVersion:8,inventory:['ember','outfit-surfer'],upgrades:{ember:4},stones:{'1':0},compositionStones:{}});
 assert.ok(old.inventory.includes('dynamite'));assert.equal(old.upgrades.dynamite,0);assert.equal(old.upgrades.ember,4);assert.equal(old.stones['1'],0);
 const next=normalizeProfile({...old,inventory:old.inventory.filter(id=>id!=='dynamite')});assert.ok(!next.inventory.includes('dynamite'));
});

test('new shop cosmetics never auto-grant through legacy migrations and owned purchases remain owned',()=>{
 const ids=['outfit-racer','outfit-dancer','hair-undercut','hair-ponytail','glasses-sport','glasses-cat','face-wink','hat-thunder','hat-tide','hat-ruby','hat-tropical'];
 for(const version of [1,4,8,9]){const profile=normalizeProfile({id:'shop-migration',name:'Teste',inventory:['ember'],contentVersion:version});assert.ok(ids.every(id=>!profile.inventory.includes(id)));}
 const owned=normalizeProfile({id:'shop-purchase',name:'Teste',inventory:['ember',...ids],contentVersion:9});assert.ok(ids.every(id=>owned.inventory.includes(id)));
 assert.ok(owned.inventory.includes('hat-none')&&owned.inventory.includes('hair-none'));
});
