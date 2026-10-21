import assert from 'node:assert/strict';
import {test} from 'node:test';
import {attributes,battleEquipment,CATALOG,STARTER_WEAPON,CONTENT_VERSION,DEFAULT_EQUIPMENT,isEmptyItem,ITEMS,MAX_UPGRADE,RETIRED_COSMETIC_REPLACEMENTS,RETIRED_OUTFIT_REPLACEMENTS,SLOTS,slotAccepts,slotFamily,slotsForItem,STONES,targetSlotForItem,upgradeChance,WEAPONS,weaponStats} from '../shared/catalog';
import {canColorEyes} from '../shared/colors';
import {SHOP_OFFER_BY_ID} from '../shared/shop';
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
 assert.equal(upgradeChance(14,{'5':1}),5);assert.equal(upgradeChance(14,{'5':20}),100);
 for(const stone of STONES){assert.ok(upgradeChance(9,{[stone.level]:2})>=upgradeChance(9,{[stone.level]:1}));}
 assert.equal(upgradeChance(0,{'1':1,'2':1}),100);
});

test('forge refuses invalid levels, quantities, material types and forged client outcomes',()=>{
 const invalidSelections:Record<string,number>[]=[{},{'1':0},{'1':-1},{'1':.5},{'1':21},{'1':20,'2':1},{'6':1},{'1':NaN},{'1':Infinity}];
 for(const selection of invalidSelections){
  assert.equal(upgradeChance(0,selection),0);
  assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:selection}).success,false);
 }
 for(const level of [-1,.5,15,100,NaN])assert.equal(upgradeChance(level,{'1':1}),0);
 assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:{'1':1}}).success,true);
 assert.equal(commandSchema.safeParse({type:'forge',item:'ember',stones:{'1':1},chance:100,level:15}).success,false);
});

test('all weapon upgrades keep weapon identity and apply the same attribute rules',()=>{
 for(const weapon of WEAPONS){
  const base=structuredClone(weapon),upgraded=weaponStats(weapon,12);
  assert.equal(upgraded.id,base.id);assert.equal(upgraded.effect,base.effect);assert.equal(upgraded.crater,base.crater);
  const milestone=Math.trunc(Math.trunc(base.attack*12/10)*13/10);
  assert.equal(upgraded.attack,milestone);assert.equal(upgraded.damage,Math.round(base.damage*1.1**12));
  assert.deepEqual(weapon,base);assert.deepEqual(weaponStats(weapon,0),weapon);
  assert.equal(attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:12}).attack-attributes({...DEFAULT_EQUIPMENT,weapon:weapon.id,upgrade:0}).attack,milestone-base.attack);
 }
});

test('legacy profiles gain starter materials and synchronize equipped upgrade without refilling spent stacks',()=>{
 const legacy=normalizeProfile({id:'legacy',name:'Legado',equipment:{...DEFAULT_EQUIPMENT,weapon:'volt'}});
 assert.deepEqual(legacy.upgrades,Object.fromEntries(WEAPONS.map(weapon=>[weapon.id,0])));assert.equal(legacy.stones['1'],30);assert.ok(legacy.inventory.includes('hat-cap'));
 const restored=normalizeProfile({...legacy,stones:{'1':0},upgrades:{ember:4,volt:9,crystal:99},equipment:{...legacy.equipment,upgrade:15}});
 assert.deepEqual(restored.stones,{'1':0,'2':0,'3':0,'4':0,'5':0});assert.equal(restored.equipment.upgrade,9);assert.equal(restored.upgrades.crystal,15);
});

test('protocol rejects out-of-range simulation input before the game receives it',()=>{
 for(const command of [{type:'move',x:0,y:650},{type:'move',x:900,y:Infinity},{type:'fire',angle:NaN,power:80},{type:'fire',angle:45,power:101},{type:'walk',direction:0},{type:'boost',boost:'damage1000'},{type:'rename',name:'<script>'},{type:'chat',channel:'world',text:'x'.repeat(181)}])assert.equal(commandSchema.safeParse(command).success,false);
 assert.equal(commandSchema.safeParse({type:'rename',name:'Ária do Sol'}).success,true);
});

test('customization accepts all independent slots and rejects forged upgrades, missing slots and free colors',()=>{
 const items=Object.fromEntries(SLOTS.map(slot=>[slot,DEFAULT_EQUIPMENT[slot]]));
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items}}).success,true);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,upgrade:12}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items:{...items,weapon:undefined}}}).success,false);
 // Colors are never part of customization: they cost a Color Ticket (paint command).
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,dyes:{hat:'coral'}}}).success,false);
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items,colors:{hat:'#ffffff'}}}).success,false);
 assert.equal(commandSchema.safeParse({type:'dye',slot:'hat',color:'coral'}).success,false);
 assert.equal(commandSchema.safeParse({type:'paint',changes:[{target:'hat-cap',color:'#FFAA00'},{target:'skin',color:null}]}).success,true);
 assert.equal(commandSchema.safeParse({type:'paint',changes:[{target:'hat-cap',color:'red'}]}).success,false);
 assert.equal(commandSchema.safeParse({type:'paint',changes:[]}).success,false);
 assert.equal(commandSchema.safeParse({type:'paint',changes:Array.from({length:9},(_,i)=>({target:`hat-cap~${i+2}`,color:null}))}).success,false);
 assert.equal(commandSchema.safeParse({type:'recolor',item:'hat-cap',color:'#ffaa00'}).success,false);
});

test('content migration grants new starter layers once and never refills a removed owned item',()=>{
 const migrated=normalizeProfile({id:'migration',name:'Teste',gender:'female',inventory:['ember'],contentVersion:1});
 assert.ok(migrated.inventory.includes('hair-wavy'));assert.equal(migrated.contentVersion,CONTENT_VERSION);
 const saved=normalizeProfile({...migrated,inventory:migrated.inventory.filter(id=>id!=='hair-wavy')});
 assert.equal(saved.inventory.includes('hair-wavy'),false);
});

test('the old version-six outfit grant restores nothing: without an outfit the character wears the basic look',()=>{
 const old=normalizeProfile({id:'outfit-migration',name:'Teste'});
 const migrated=normalizeProfile({...old,contentVersion:5,inventory:old.inventory.filter(id=>!['outfit-cartographer','hair-wavy'].includes(id)),stones:{'1':0,'2':0,'3':0,'4':0,'5':0}});
 assert.equal(migrated.inventory.includes('outfit-cartographer'),false);assert.equal(migrated.equipment.outfit,'outfit-basic-male');
 for(const retired of Object.keys(RETIRED_OUTFIT_REPLACEMENTS))assert.equal(migrated.inventory.includes(retired),false);
 assert.equal(migrated.inventory.includes('hair-wavy'),false);assert.equal(migrated.stones['1'],0);
 const saved=normalizeProfile(migrated);
 assert.deepEqual(saved,migrated);assert.equal(saved.contentVersion,CONTENT_VERSION);
});

test('retired cosmetic items disappear while current equipment uses the fifteen supported slots',()=>{
 assert.deepEqual([...SLOTS],['weapon','face','outfit','hair','hat','glasses','wristband','wristband2','bracelet','bracelet2','costume','ring','ring2','necklace','bubble']);
 const migrated=normalizeProfile({id:'retired',name:'Teste',contentVersion:4,inventory:['ember','accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'],equipment:{...DEFAULT_EQUIPMENT,...{accessory:'accessory-satchel',eyes:'eyes-ocean'}}});
 for(const id of ['accessory-satchel','wings-feather','eyes-ocean','ring-copper','bracelet-braid'])assert.equal(migrated.inventory.includes(id),false);
 assert.equal(migrated.equipment.face,'face-brave');assert.equal(migrated.equipment.wristband,'wristband-none');
 assert.equal(commandSchema.safeParse({type:'customize',selection:{items:{...Object.fromEntries(SLOTS.map(slot=>[slot,migrated.equipment[slot]])),eyes:'eyes-ocean'}}}).success,false);
});

test('retired outfits migrate to a current owned costume without changing other equipment or resources',()=>{
 assert.deepEqual(ITEMS.filter(item=>item.slot==='outfit'&&!item.basic).map(item=>item.id),['outfit-cartographer','outfit-explorer','outfit-idol','outfit-surf','outfit-captain','outfit-hiphop','outfit-swordsman']);
 for(const retired of ['outfit-ranger','outfit-azure','outfit-royal']){
  assert.equal(CATALOG[retired],undefined);
  const before=normalizeProfile({id:'retired-outfit',name:'Teste'});
  const migrated=normalizeProfile({...before,contentVersion:6,inventory:[...before.inventory.filter(id=>id!=='outfit-cartographer'),retired],equipment:{...before.equipment,outfit:retired,face:'face-taunt',hat:'hat-cap'},stones:{'1':0},upgrades:{ember:9}});
  assert.equal(migrated.equipment.outfit,'outfit-cartographer');assert.ok(migrated.inventory.includes(migrated.equipment.outfit));assert.equal(migrated.inventory.includes(retired),false);
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

test('removed weapons leave the profile and the starter Quebra-Tijolos takes their place',()=>{
 const old=normalizeProfile({id:'arsenal-reset',name:'Teste',contentVersion:12,inventory:['removed-cannon','outfit-cartographer'],upgrades:{'removed-cannon':9},stones:{'1':0},compositionStones:{},equipment:{...DEFAULT_EQUIPMENT,weapon:'removed-cannon'}});
 assert.ok(!old.inventory.includes('removed-cannon'));assert.equal(old.upgrades['removed-cannon'],undefined);assert.equal(old.stones['1'],0);
 assert.equal(old.equipment.weapon,DEFAULT_EQUIPMENT.weapon);assert.ok(old.inventory.includes(DEFAULT_EQUIPMENT.weapon));
});

test('new shop cosmetics never auto-grant through legacy migrations and owned purchases remain owned',()=>{
 const ids=['hair-undercut','hair-ponytail','hair-horizon','glasses-sport','glasses-cat','glasses-navigator','face-wink','hat-thunder','hat-tide','hat-ruby','hat-tropical'];
 for(const version of [1,4,8,9]){const profile=normalizeProfile({id:'shop-migration',name:'Teste',inventory:['ember'],contentVersion:version});assert.ok(ids.every(id=>!profile.inventory.includes(id)));}
 const owned=normalizeProfile({id:'shop-purchase',name:'Teste',inventory:['ember',...ids],contentVersion:9});assert.ok(ids.every(id=>owned.inventory.includes(id)));
 assert.ok(owned.inventory.every(id=>!isEmptyItem(id)),'empty-slot sentinels are never inventory possessions');
 // Without an owned outfit the character wears the basic look of the empty slot, which is never a possession.
 for(const version of [1,4,8,9,14]){const profile=normalizeProfile({id:'shop-migration',name:'Teste',inventory:['ember'],contentVersion:version});assert.ok(profile.equipment.outfit==='outfit-basic-male'||profile.inventory.includes(profile.equipment.outfit));assert.ok(!profile.inventory.includes('outfit-basic-male'));}
});

test('retired prototypes leave catalog and shop while painted equipment remains available',()=>{
 for(const id of [...Object.keys(RETIRED_COSMETIC_REPLACEMENTS),...Object.keys(RETIRED_OUTFIT_REPLACEMENTS)]){assert.equal(CATALOG[id],undefined);assert.equal(SHOP_OFFER_BY_ID[id],undefined);}
 for(const id of ['face-brave','face-smile','face-taunt','face-serene','face-fierce','outfit-cartographer','hat-cap','hat-mage','hair-wavy'])assert.ok(CATALOG[id]&&SHOP_OFFER_BY_ID[id]);
});

test('prototype retirement exchanges owned items and preserves equipment, composition and resources exactly once',()=>{
 const retired=Object.keys(RETIRED_COSMETIC_REPLACEMENTS);
 const raw={id:'prototype-migration',name:'Veterano',gender:'male' as const,contentVersion:9,inventory:['ember','face-taunt','outfit-cartographer','hat-tide',...retired],
  equipment:{...DEFAULT_EQUIPMENT,face:'face-taunt',outfit:'outfit-cartographer',hat:'hat-knight',hair:'hair-silver',glasses:'glasses-round',dyes:{hat:'coral' as const}},
  gold:575,xp:1234,wins:7,matches:10,upgrades:{ember:9},stones:{'1':0,'5':3},compositionStones:{'attack-1':0},compositions:{'hat-knight':{attack:20},'hat-tide':{attack:10,defense:30},ember:{armor:20,luck:20}}};
 const result=normalizeProfile(raw);
 assert.ok(retired.every(id=>!result.inventory.includes(id)));
 assert.ok(Object.values(RETIRED_COSMETIC_REPLACEMENTS).every(id=>result.inventory.includes(id)));
 assert.equal(result.equipment.hat,'hat-tide');assert.equal(result.equipment.hair,'hair-undercut');assert.equal(result.equipment.glasses,'glasses-sport');
 assert.equal(result.equipment.face,'face-taunt');assert.equal(result.equipment.outfit,'outfit-cartographer');
 // The retired free dye becomes the worn hat's ticket color.
 assert.equal(result.itemColors['hat-tide'],'#f24b64');assert.equal(result.equipment.colors?.hat,'#f24b64');
 // Weapons never keep Armadura, not even from an old composition.
 assert.deepEqual(result.compositions,{'hat-tide':{attack:20,defense:30},ember:{luck:20}});
 assert.equal(result.gold,575);assert.equal(result.xp,1234);assert.equal(result.wins,7);assert.equal(result.matches,10);assert.equal(result.upgrades.ember,9);
 assert.equal(result.stones['1'],0);assert.equal(result.stones['5'],3);assert.equal(result.compositionStones['attack-1'],0);
 assert.deepEqual(normalizeProfile(result),result);
 const withoutUnequipped=normalizeProfile({...result,inventory:result.inventory.filter(id=>id!=='glasses-cat')});assert.ok(!withoutUnequipped.inventory.includes('glasses-cat'));
 for(const slot of SLOTS)assert.ok(isEmptyItem(result.equipment[slot])||result.inventory.includes(result.equipment[slot]),slot);
});

test('version fourteen profiles exchange retired outfits for the Cartógrafo once, keeping their composition and resources',()=>{
 assert.ok(Object.values(RETIRED_OUTFIT_REPLACEMENTS).every(id=>id==='outfit-cartographer'));
 const raw={id:'outfit-retirement',name:'Piloto',gender:'male' as const,contentVersion:14,inventory:['ember','hat-cap','face-brave','hair-undercut','outfit-racer'],
  equipment:{...DEFAULT_EQUIPMENT,outfit:'outfit-racer'},gold:321,xp:456,upgrades:{ember:4},stones:{'1':0,'3':2},compositionStones:{'armor-1':1},compositions:{'outfit-racer':{armor:20,defense:10}}};
 const result=normalizeProfile(raw);
 assert.equal(result.equipment.outfit,'outfit-cartographer');assert.ok(result.inventory.includes('outfit-cartographer'));
 for(const retired of Object.keys(RETIRED_OUTFIT_REPLACEMENTS))assert.ok(!result.inventory.some(key=>key.startsWith(retired)),retired);
 assert.deepEqual(result.compositions['outfit-cartographer'],{armor:20,defense:10});assert.equal(result.compositions['outfit-racer'],undefined);
 assert.deepEqual(result.equipment.compositions?.['outfit-cartographer'],{armor:20,defense:10});
 assert.equal(result.equipment.hat,'hat-cap');assert.equal(result.equipment.face,'face-brave');assert.equal(result.equipment.hair,'hair-undercut');
 assert.equal(result.gold,321);assert.equal(result.xp,456);assert.equal(result.upgrades.ember,4);assert.equal(result.stones['1'],0);assert.equal(result.stones['3'],2);assert.equal(result.compositionStones['armor-1'],1);
 assert.equal(result.contentVersion,CONTENT_VERSION);assert.deepEqual(normalizeProfile(result),result);
});

test('migration ignores unknown and inherited object keys instead of granting invalid items',()=>{
 const result=normalizeProfile({id:'invalid-legacy',name:'Teste',contentVersion:9,inventory:['ember','constructor','__proto__','toString'],equipment:{...DEFAULT_EQUIPMENT,hat:'constructor',hair:'__proto__'}});
 assert.ok(result.inventory.every(id=>typeof id==='string'&&Object.hasOwn(CATALOG,id)));
 for(const slot of SLOTS)assert.equal(CATALOG[result.equipment[slot]].slot,slotFamily(slot));
});

test('both ring slots take ring items, but one owned ring cannot fill both',()=>{
 assert.deepEqual(slotsForItem(CATALOG['ring-ember']),['ring','ring2']);
 assert.equal(slotAccepts('ring2',CATALOG['ring-tide']),true);assert.equal(slotAccepts('ring2',CATALOG['necklace-star']),false);
 const both=normalizeProfile({id:'rings',name:'Teste',contentVersion:CONTENT_VERSION,inventory:['ember','ring-ember','ring-tide'],equipment:{...DEFAULT_EQUIPMENT,ring:'ring-ember',ring2:'ring-tide'}});
 assert.equal(both.equipment.ring,'ring-ember');assert.equal(both.equipment.ring2,'ring-tide');
 const twice=normalizeProfile({id:'rings',name:'Teste',contentVersion:CONTENT_VERSION,inventory:['ember','ring-ember'],equipment:{...DEFAULT_EQUIPMENT,ring:'ring-ember',ring2:'ring-ember'}});
 assert.equal(twice.equipment.ring,'ring-ember');assert.equal(twice.equipment.ring2,'ring-none');
 assert.equal(targetSlotForItem({...DEFAULT_EQUIPMENT,ring:'ring-ember'},CATALOG['ring-tide']),'ring2');
 assert.equal(targetSlotForItem({...DEFAULT_EQUIPMENT,ring:'ring-ember',ring2:'ring-tide'},CATALOG['ring-tide']),'ring2');
});

test('the Bolha Clássica comes in the starter kit and is given once to older profiles',()=>{
 assert.equal(DEFAULT_EQUIPMENT.bubble,'bubble-classic');
 const old=normalizeProfile({id:'bolha',name:'Teste',contentVersion:16,inventory:['brick'],equipment:{...DEFAULT_EQUIPMENT,bubble:'bubble-none'}});
 assert.equal(old.equipment.bubble,'bubble-classic');assert.ok(old.inventory.includes('bubble-classic'));
 const cloud=normalizeProfile({id:'nuvem',name:'Teste',contentVersion:16,inventory:['brick','bubble-cloud'],equipment:{...DEFAULT_EQUIPMENT,bubble:'bubble-cloud'}});
 assert.equal(cloud.equipment.bubble,'bubble-cloud');assert.ok(cloud.inventory.includes('bubble-classic'));
 // Taking it off later is kept: the gift happens only once.
 const off=normalizeProfile({...old,equipment:{...old.equipment,bubble:'bubble-none'}});assert.equal(off.equipment.bubble,'bubble-none');
});

test('the weapon can be taken off: no weapon in the profile, the starter weapon at +0 in battle',()=>{
 const unarmed={...DEFAULT_EQUIPMENT,weapon:'weapon-none',upgrade:0,copies:{weapon:`${DEFAULT_EQUIPMENT.weapon}~2`,ring:'ring-a~2'}};
 assert.ok(isEmptyItem('weapon-none'));assert.ok(slotAccepts('weapon',CATALOG['weapon-none']));
 const profile=normalizeProfile({id:'unarmed',name:'Sem arma',contentVersion:CONTENT_VERSION,inventory:[DEFAULT_EQUIPMENT.weapon,'outfit-cartographer'],equipment:{...DEFAULT_EQUIPMENT,weapon:'weapon-none'}});
 assert.equal(profile.equipment.weapon,'weapon-none');
 // Poder counts only what is worn: taking the weapon off removes all of its share.
 assert.ok(attributes(unarmed).power<attributes(DEFAULT_EQUIPMENT).power);
 const armed=battleEquipment(unarmed);
 assert.equal(armed.weapon,STARTER_WEAPON);assert.equal(armed.upgrade,0);assert.deepEqual(armed.copies,{ring:'ring-a~2'});
 const kept={...DEFAULT_EQUIPMENT,upgrade:7};assert.equal(battleEquipment(kept),kept);
});

test('closed-eye faces have no eye color to change',()=>{
 assert.equal(canColorEyes('face-smile'),false);assert.equal(canColorEyes('face-surf'),false);
 assert.equal(canColorEyes('face-brave'),true);assert.equal(canColorEyes('face-wink'),true);
});
