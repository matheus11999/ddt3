import {petContribution} from './pets';
import type {PetSnapshot} from './pets';
import type {PetStats} from './petConfig';
import {COMPOSITION_STATS} from './composition';
import type {CompositionBonus,Compositions} from './composition';
import type {ColorSlot} from './colors';
import {baseDelay,hpPower,MAX_STRENGTHEN,maxHpFor,maxStaminaFor,strengthenedValue,strengthenLevel,weaponMilestoneValue} from './stats';
export const SLOTS = ['weapon','face','outfit','hair','hat','glasses','wristband','bracelet','costume','ring','ring2','necklace','bubble'] as const;
export type Slot = typeof SLOTS[number];
/** Equipment slots that accept the items of another slot family (two rings share one item type). */
export const SLOT_FAMILY:Partial<Record<Slot,Slot>>={ring2:'ring'};
export function slotFamily(slot:Slot):Slot {return SLOT_FAMILY[slot]??slot;}
export function slotAccepts(slot:Slot,item:Item|undefined):boolean {return !!item&&item.slot===slotFamily(slot);}
/** Every equipment slot an item can occupy, in preference order. */
export function slotsForItem(item:Item|undefined):Slot[] {return item?SLOTS.filter(slot=>slotFamily(slot)===item.slot):[];}
/** One owned copy cannot fill both slots of a family (e.g. the same ring twice). */
export function heldInSiblingSlot(equipment:Partial<Record<Slot,string>>,slot:Slot,id:string):boolean {
 return !id.endsWith('-none')&&SLOTS.some(other=>other!==slot&&slotFamily(other)===slotFamily(slot)&&equipment[other]===id);
}
/** Where equipping an item lands: its current slot, else the first empty sibling, else the first slot. */
export function targetSlotForItem(equipment:Partial<Record<Slot,string>>,item:Item):Slot {
 const slots=slotsForItem(item);
 return slots.find(slot=>equipment[slot]===item.id)??slots.find(slot=>String(equipment[slot]??'').endsWith('-none'))??slots[0]??item.slot;
}
/** Only these item types show a rarity class ("Comum", "Normal", "Épico", "Lendário") for now. */
export const CLASSED_SLOTS:readonly Slot[]=['weapon','outfit','hat'];
export const CHARACTER_GENDERS=['male','female'] as const;
export type CharacterGender=typeof CHARACTER_GENDERS[number];
export type ItemGender=CharacterGender|'unisex';
/** Colors of the retired free dyes, kept only to migrate old profiles to ticket colors (shared/colors.ts). */
export const LEGACY_DYE_COLORS:Readonly<Record<string,string>>={coral:'#f24b64',azure:'#168cf0',violet:'#9836e7',gold:'#ffbb24'};
export const VISIBILITY_SLOTS=['hat','glasses','costume'] as const;
export type EquipmentVisibility=Partial<Record<typeof VISIBILITY_SLOTS[number],boolean>>;
/** Which owned copy fills a slot when it is not the first one (the key of a repeated purchase). */
/** Hats and outfits strengthen their Armadura at the forge level they carry. */
export const ARMOR_SLOTS=['hat','outfit'] as const;
export type ArmorSlot=typeof ARMOR_SLOTS[number];
export function isArmorSlot(slot:Slot):slot is ArmorSlot {return (ARMOR_SLOTS as readonly Slot[]).includes(slot);}
/** The forge strengthens weapons (Dano) and hats and outfits (Armadura). */
export function canStrengthen(item:Item|undefined):boolean {return !!item&&(item.slot==='weapon'||isArmorSlot(item.slot))&&!(item.id.endsWith('-none')&&item.visual?.variant==='none');}
export type EquipmentCopies=Partial<Record<Slot,string>>;
export type Equipment = Record<Slot, string> & {upgrade:number;/** Forge level of the worn hat and outfit copies (derived by the server, like `upgrade` for the weapon). */ slotUpgrades?:Partial<Record<ArmorSlot,number>>;compositions?:Compositions;/** Derived by the server from the worn copies' ticket colors and the character's body colors. */ colors?:Partial<Record<ColorSlot,string>>;skin?:string;eyes?:string;visibility?:EquipmentVisibility;copies?:EquipmentCopies;/** The active pet as the server last saved it (server/pets.ts): its bonuses enter `attributes`. */pet?:PetSnapshot;/** Temporary pet-skill attribute changes, only on the copy a battle builds for one calculation. */battleBuffs?:PetStats};
/** Buying an item again adds a separate copy: the first keeps the item id, later ones are `id~2`, `id~3`… */
export const COPY_SEPARATOR='~';
export function copyBase(key:string):string {const at=key.indexOf(COPY_SEPARATOR);return at<0?key:key.slice(0,at);}
export function isCopyKey(key:string):boolean {return /^[^~]+~[1-9]\d{0,3}$/.test(key)&&Number(key.slice(key.indexOf(COPY_SEPARATOR)+1))>=2;}
export function nextCopyKey(inventory:readonly string[],id:string):string {
 if(!inventory.includes(id))return id;
 let n=2;while(inventory.includes(`${id}${COPY_SEPARATOR}${n}`))n++;return `${id}${COPY_SEPARATOR}${n}`;
}
/** The owned copy that fills a slot: its saved copy key, or the item id itself. */
export function equippedCopy(equipment:Equipment,slot:Slot):string {const copy=equipment.copies?.[slot];return copy&&copyBase(copy)===equipment[slot]?copy:equipment[slot];}
/** Compositions as the battle reads them (by item id), taken from the copies actually equipped. */
export function equippedCompositions(equipment:Equipment,compositions:Compositions):Compositions {
 const result:Compositions=Object.fromEntries(Object.entries(compositions).filter(([key])=>!key.includes(COPY_SEPARATOR)));
 for(const slot of SLOTS){const copy=equipment.copies?.[slot];if(!copy||copyBase(copy)!==equipment[slot])continue;if(compositions[copy])result[equipment[slot]]=compositions[copy];else delete result[equipment[slot]];}
 return result;
}
export function normalizeVisibility(value:unknown):Record<typeof VISIBILITY_SLOTS[number],boolean> {
 const input=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {hat:input.hat!==false,glasses:input.glasses!==false,costume:input.costume!==false};
}
export interface ItemVisual {variant:string;visible?:boolean;pose?:'adventurer'|'confident'|'regal'|'surfer'|'executive'|'racer'|'dancer'|'cartographer';asset?:string;color?:string;secondary?:string;hideHair?:boolean;offset?:[number,number];scale?:number;rotation?:number;}
export type Rarity = 'common'|'uncommon'|'rare'|'epic'|'legendary';
export interface Item { id:string; name:string; slot:Slot; rarity:Rarity; color:string; description:string; attack:number; defense:number; agility:number; luck?:number; damage?:number; armor?:number; /** Extra Vida in percent (guild necklaces); several add up. */ hpPercent?:number; visual?:ItemVisual; gender?:ItemGender; }
export interface ItemAttributes {attack:number;defense:number;agility:number;luck:number;damage:number;armor:number;}
const cosmetic=(id:string,name:string,slot:Slot,variant:string,color:string,rarity:Rarity='common',visual:Partial<ItemVisual>={}):Item=>({id,name,slot,rarity,color,description:variant==='none'?'Visual natural.':'Personalize sua aventura.',attack:0,defense:0,agility:0,visual:{variant,color,...visual}});
export type CraterShape='square';
export type WeaponEffect='fire'|'electric'|'crystal'|'dynamite'|'brick'|'boomerang';
export interface WeaponFragments {count:readonly [number,number,number,number];damage:number;crater:number;blast:number;speed:number;radius:number;gravity:number;}
export interface Weapon extends Item { damage:number; crater:number; blast:number; gravity:number; projectileRadius:number; effect:WeaponEffect; minAngle:number; maxAngle:number; fragments?:WeaponFragments; /** Jagged crater edge, 0 = round; defaults to CRATER_ROUGHNESS (shared/physics.ts). */ craterRoughness?:number; /** 'square': a box-shaped, shallower hole (Quebra-Tijolos, user 19/10/2026); round otherwise. */ craterShape?:CraterShape; /** Combat presentation only: guns and wands are held and fire from the tip; others are thrown by hand. */ hold?:'hand'; /** Delay added by each shot (DDTank ball Delay + weapon Property8); 0 when omitted. */ shotDelay?:number; }
export const WEAPONS: Weapon[] = [
 {id:'brick',name:'Quebra-Tijolos',slot:'weapon',rarity:'rare',color:'#d8432a',description:'A primeira arma de todo artilheiro: um recipiente de tijolos de olaria que cresce com a forja. Cada tijolo arremessado abre só uma cratera pequena.',attack:85,defense:95,agility:85,luck:85,damage:200,crater:22,craterRoughness:.04,craterShape:'square',blast:92,gravity:345,projectileRadius:8,effect:'brick',minAngle:20,maxAngle:65,shotDelay:150},
 {id:'love-boomerang',name:'Bumerangue do Amor',slot:'weapon',rarity:'rare',color:'#ef5198',description:'Lâminas curvas com coração de rubi. Alta agilidade e sorte, defesa baixa e um POW alado próprio. Evolui na forja em +10, +12 e +15.',attack:145,defense:25,agility:145,luck:145,damage:230,crater:26,craterRoughness:0,blast:82,gravity:345,projectileRadius:5,effect:'boomerang',minAngle:15,maxAngle:65,shotDelay:150}
];
export const ITEMS: Item[] = [...WEAPONS,
 {id:'hat-cap',name:'Boné do Explorador',slot:'hat',rarity:'common',color:'#e09c55',description:'O começo de uma grande jornada.',attack:0,defense:8,agility:8,armor:5},
 {id:'hat-mage',name:'Chapéu Astral',slot:'hat',rarity:'epic',color:'#9b83df',description:'Um pedacinho do céu.',attack:8,defense:14,agility:0,armor:10},
 {id:'outfit-cartographer',name:'Cartógrafo da Aurora',slot:'outfit',rarity:'rare',color:'#137fba',description:'Casaco de viagem, mapa no cinto e postura de explorador.',attack:10,defense:22,agility:14,armor:20,visual:{variant:'cartographer',pose:'cartographer',asset:'/assets/outfits/cartographer-atlas.png'}},
 {id:'outfit-explorer',name:'Exploradora da Aurora',slot:'outfit',rarity:'rare',color:'#1f5fc4',description:'Casaco curto de viagem, saia pregueada e botinhas: a roupa inicial das aventureiras.',attack:10,defense:22,agility:14,armor:20,visual:{variant:'explorer',asset:'/assets/outfits/explorer-atlas.png'}},
 {id:'outfit-idol',name:'Estrela Pop',slot:'outfit',rarity:'epic',color:'#f06aa8',description:'Vestido de palco com babados, laço no peito e botas brancas.',attack:12,defense:18,agility:18,armor:18,visual:{variant:'idol',asset:'/assets/outfits/idol-atlas.png'}},
 {id:'outfit-surf',name:'Onda Tropical',slot:'outfit',rarity:'rare',color:'#19b4c8',description:'Blusa de surfe com hibiscos, short jeans e canga laranja.',attack:12,defense:16,agility:20,armor:18,visual:{variant:'surf',asset:'/assets/outfits/surf-atlas.png'}},
 {id:'outfit-captain',name:'Capitão Escarlate',slot:'outfit',rarity:'rare',color:'#c4162a',description:'Casaca escarlate de capitão dos céus, dragonas douradas e botas altas.',attack:14,defense:20,agility:12,armor:20,visual:{variant:'captain',asset:'/assets/outfits/captain-atlas.png'}},
 {id:'outfit-hiphop',name:'Rima de Rua',slot:'outfit',rarity:'rare',color:'#7a2fd6',description:'Moletom largo com estrela grafitada, corrente dourada e tênis de cano alto.',attack:12,defense:18,agility:18,armor:18,visual:{variant:'hiphop',asset:'/assets/outfits/hiphop-atlas.png'}},
 {id:'outfit-swordsman',name:'Espadachim Errante',slot:'outfit',rarity:'epic',color:'#1d8f97',description:'Haori de ondas sobre quimono, faixa vermelha e hakama de viajante.',attack:16,defense:18,agility:16,armor:18,visual:{variant:'swordsman',asset:'/assets/outfits/swordsman-atlas.png'}},
 cosmetic('face-captain','Olhar do Capitão','face','captain','#c98a5e','rare',{asset:'/assets/faces/face-captain.png'}),
 cosmetic('face-idol','Brilho de Palco','face','idol','#f08fb8','rare',{asset:'/assets/faces/face-idol.png'}),
 cosmetic('face-surf','Sorriso de Verão','face','surf','#e7a26b','rare',{asset:'/assets/faces/face-surf.png'}),
 cosmetic('face-wink','Piscadela Confiante','face','wink','#e6a16f','rare',{asset:'/assets/faces/face-wink.png'}),
 cosmetic('hair-undercut','Corte Tempestade','hair','undercut','#1555c2','rare',{asset:'/assets/shop-accessories.png'}),
 cosmetic('hair-ponytail','Rabo de Cavalo Rubi','hair','ponytail','#a34528','rare',{asset:'/assets/shop-accessories.png'}),
 cosmetic('hair-horizon','Corte Horizonte','hair','horizon','#163e72','rare',{asset:'/assets/hair-horizon.png'}),
 cosmetic('hair-captain','Corte Capitão','hair','captain','#7a3a1c','rare',{asset:'/assets/hair-captain.png'}),
 cosmetic('hair-hiphop','Degradê Trançado','hair','hiphop','#3a1f4f','rare',{asset:'/assets/hair-hiphop.png'}),
 cosmetic('hair-swordsman','Coque do Errante','hair','swordsman','#1b2f6b','rare',{asset:'/assets/hair-swordsman.png'}),
 cosmetic('hair-idol','Maria-Chiquinha Estelar','hair','idol','#f27fb2','rare',{asset:'/assets/hair-idol.png'}),
 cosmetic('hair-surf','Ondas de Praia','hair','surf','#e2b46a','rare',{asset:'/assets/hair-surf.png'}),
 cosmetic('glasses-sport','Óculos Sprint','glasses','sport','#19bde8','uncommon',{asset:'/assets/shop-accessories.png'}),
 cosmetic('glasses-cat','Óculos Gatinho','glasses','cat','#e82553','uncommon',{asset:'/assets/shop-accessories.png'}),
 cosmetic('glasses-navigator','Óculos de Navegação','glasses','navigator','#17a8c9','uncommon',{asset:'/assets/glasses-navigator.png'}),
 cosmetic('glasses-hiphop','Óculos Escuros Neon','glasses','hiphop','#b04dff','uncommon',{asset:'/assets/glasses-hiphop.png'}),
 cosmetic('glasses-idol','Óculos Coração','glasses','idol','#ff5aa5','uncommon',{asset:'/assets/glasses-idol.png'}),
 cosmetic('glasses-surf','Óculos Sol Poente','glasses','surf','#f08a3c','uncommon',{asset:'/assets/glasses-surf.png'}),
 cosmetic('glasses-captain','Óculos do Capitão','glasses','captain','#e3a62b','uncommon',{asset:'/assets/glasses-captain.png'}),
 {...cosmetic('hat-hiphop','Boné Aba Reta','hat','hiphop','#8a2be2','uncommon',{asset:'/assets/hat-hiphop.png'}),description:'Boné roxo de aba reta com estrela dourada.'},
 {...cosmetic('hat-swordsman','Chapéu de Palha Errante','hat','swordsman','#d9a441','rare',{asset:'/assets/hat-swordsman.png'}),description:'Chapéu cônico de palha trançada com cordão vermelho e borla.'},
 {...cosmetic('hat-idol','Laço de Palco','hat','idol','#ff4f9a','rare',{asset:'/assets/hat-idol.png'}),description:'Tiara com um grande laço de cetim e uma estrela dourada.'},
 {...cosmetic('hat-surf','Viseira de Praia','hat','surf','#22c3d6','uncommon',{asset:'/assets/hat-surf.png'}),description:'Viseira branca com aba turquesa e uma flor de hibisco.'},
 {...cosmetic('hat-captain','Quepe Escarlate','hat','captain','#d01f2e','rare',{asset:'/assets/hat-captain.png'}),description:'Quepe de capitão dos céus com cordão dourado e emblema de âncora.'},
 {...cosmetic('hat-thunder','Boné Relâmpago','hat','thunder','#ff334b','uncommon',{asset:'/assets/shop-hats.png'}),description:'Boné vermelho com aba azul e um raio de energia.'},
 {...cosmetic('hat-tide','Bucket da Maré','hat','tide','#00bdd0','uncommon',{asset:'/assets/shop-hats.png'}),description:'Tecido turquesa, faixa laranja e uma concha da praia.'},
 {...cosmetic('hat-ruby','Boina Rubi','hat','ruby','#db1761','rare',{asset:'/assets/shop-hats.png'}),description:'Boina de veludo rubi com uma pena turquesa.'},
 {...cosmetic('hat-tropical','Chapéu Tropical','hat','tropical','#ffc83d','rare',{asset:'/assets/shop-hats.png'}),description:'Palha dourada, faixa esmeralda e uma flor de verão.'},
 cosmetic('hat-none','Sem chapéu','hat','none','#bca28c'),
 cosmetic('face-brave','Rosto Aventureiro','face','brave','#b18a68','common',{asset:'/assets/faces/face-brave.png'}),
 cosmetic('face-smile','Sorriso Radiante','face','smile','#d89791','common',{asset:'/assets/faces/face-smile.png'}),
 cosmetic('face-taunt','Sorriso Provocador','face','taunt','#be95c7','rare',{asset:'/assets/faces/face-taunt.png'}),
 cosmetic('face-serene','Rosto Sereno','face','serene','#8fb9bd','uncommon',{asset:'/assets/faces/face-serene.png'}),
 cosmetic('face-fierce','Rosto Determinado','face','fierce','#cc8a72','epic',{asset:'/assets/faces/face-fierce.png'}),
 cosmetic('hair-wavy','Cabelo Ondulado','hair','wavy','#c79352','rare',{asset:'/assets/hair-wavy.png'}),
 cosmetic('hair-none','Sem cabelo','hair','none','#bca28c'),
 cosmetic('glasses-none','Sem óculos','glasses','none','#a9b3bc'),
 cosmetic('wristband-none','Sem pulseira','wristband','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('wristband-braid','Pulseira Trançada','wristband','braid','#b38c62','common',{visible:false}),attack:3,defense:6,agility:6,luck:5},
 cosmetic('bracelet-none','Sem bracelete','bracelet','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('bracelet-sun','Bracelete Solar','bracelet','sun','#dfb861','rare',{visible:false}),attack:4,defense:14,agility:2,luck:4,armor:10},
 cosmetic('costume-none','Sem fantasia','costume','none','#bfb3a5','common',{visible:false}),
 cosmetic('ring-none','Sem anel','ring','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('ring-ember','Anel da Brasa','ring','ember','#ff7a2e','rare',{visible:false}),description:'Aro dourado com uma brasa que nunca apaga.',attack:6,luck:6,agility:2,defense:0},
 {...cosmetic('ring-tide','Anel da Maré','ring','tide','#18b9d6','uncommon',{visible:false}),description:'Prata polida com uma pérola azul do mar.',attack:2,defense:6,agility:4,luck:2},
 cosmetic('necklace-none','Sem colar','necklace','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('necklace-star','Colar Estelar','necklace','star','#ffc93a','epic',{visible:false}),description:'Uma estrela cadente presa num cordão de ouro.',attack:6,defense:10,agility:4,luck:8,armor:6},
 // Loja da Guilda (shared/guilds.ts): sold only to guild members.
 {...cosmetic('necklace-guild-1','Colar da Guilda Nv. 1','necklace','guild-1','#3f8fe0','rare',{visible:false,asset:'/assets/items/necklace-guild-1.png'}),description:'Medalhão da guilda num cordão trançado. Só membros de uma guilda podem comprá-lo.',attack:0,defense:0,agility:0,hpPercent:5},
 cosmetic('bubble-none','Sem bolha','bubble','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('bubble-classic','Bolha Clássica','bubble','classic','#f4ead6','common',{visible:false}),description:'O balão de fala de todo aventureiro.'},
 {...cosmetic('bubble-cloud','Bolha Nuvem','bubble','cloud','#7ec8ff','uncommon',{visible:false}),description:'Balão de nuvem fofinha que solta nuvenzinhas.'},
 {...cosmetic('bubble-ember','Bolha Brasa','bubble','ember','#ff9a3c','rare',{visible:false}),description:'Moldura de brasa viva; faíscas sobem enquanto você fala.'},
 {...cosmetic('bubble-royal','Bolha Real','bubble','royal','#e2b84a','epic',{visible:false}),description:'Pergaminho com moldura de ouro que cintila.'},
 {...cosmetic('bubble-starlight','Bolha Estelar','bubble','starlight','#9d7cff','legendary',{visible:false}),description:'Cristal das estrelas; pequenas estrelas giram em volta do balão.'},
 {...cosmetic('bubble-dragon','Bolha do Dragão','bubble','dragon','#3fbf6a','legendary',{visible:false}),description:'Escamas do Dragão Ancestral; chamas verdes nas garras.'},
 cosmetic('costume-thunder-chick','Pintinho do Trovão','costume','thunder-chick','#ffcc27','epic',{asset:'/assets/costumes/costume-thunder-chick.png'}),
 cosmetic('costume-arcane-fox','Raposa Arcana','costume','arcane-fox','#9f59ff','epic',{asset:'/assets/costumes/costume-arcane-fox.png'})
];
const GENDERED_ITEMS:Readonly<Record<string,CharacterGender>>={
 'face-brave':'male','face-taunt':'male','face-fierce':'male','face-captain':'male',
 'face-smile':'female','face-serene':'female','face-wink':'female',
  'hat-cap':'male','hat-thunder':'male','hat-tide':'male','hat-captain':'male','hat-hiphop':'male','hat-swordsman':'male','hat-mage':'female','hat-ruby':'female','hat-tropical':'female',
 'hair-undercut':'male','hair-ponytail':'female','hair-wavy':'female','hair-horizon':'male','hair-captain':'male','hair-hiphop':'male','hair-swordsman':'male',
 'glasses-navigator':'male','glasses-captain':'male','outfit-captain':'male','glasses-hiphop':'male','outfit-hiphop':'male','outfit-swordsman':'male','outfit-explorer':'female','outfit-idol':'female','outfit-surf':'female','face-idol':'female','face-surf':'female','hair-idol':'female','hair-surf':'female','hat-idol':'female','hat-surf':'female','glasses-idol':'female','glasses-surf':'female'
};
for(const item of ITEMS){
 if(GENDERED_ITEMS[item.id])item.gender=GENDERED_ITEMS[item.id];
}
export const CATALOG = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
/** Unknown IDs never grant compatibility; omitted item gender means explicitly shared equipment. */
export function itemGender(item:Item|string):ItemGender {return (typeof item==='string'?CATALOG[item]:item)?.gender??'unisex';}
export function canEquipItem(item:Item|string,gender:CharacterGender):boolean {
 const value=typeof item==='string'?(Object.hasOwn(CATALOG,item)?CATALOG[item]:undefined):item;
 return !!value&&CHARACTER_GENDERS.includes(gender)&&(itemGender(value)==='unisex'||itemGender(value)===gender);
}
export function isEmptyItem(item:Item|string):boolean {const value=typeof item==='string'?(Object.hasOwn(CATALOG,item)?CATALOG[item]:undefined):item;return !!value&&value.id.endsWith('-none')&&value.visual?.variant==='none';}
export const STARTER_COSTUMES=['costume-thunder-chick','costume-arcane-fox'] as const;
/** Every new character starts with the Quebra-Tijolos (docs/weapon-kit.md). */
export const STARTER_WEAPON='brick';
export const DEFAULT_EQUIPMENT: Equipment = {weapon:STARTER_WEAPON,hat:'hat-cap',face:'face-brave',outfit:'outfit-cartographer',hair:'hair-undercut',glasses:'glasses-none',wristband:'wristband-none',bracelet:'bracelet-none',costume:'costume-none',ring:'ring-none',ring2:'ring-none',necklace:'necklace-none',bubble:'bubble-classic',upgrade:0};
export function starterEquipment(gender:CharacterGender):Equipment {
 return gender==='female'?{...DEFAULT_EQUIPMENT,face:'face-smile',hair:'hair-ponytail',hat:'hat-ruby',outfit:'outfit-explorer'}:{...DEFAULT_EQUIPMENT};
}
/** Retired prototypes are rejected by the live catalog; existing ownership is exchanged once. */
export const RETIRED_COSMETIC_REPLACEMENTS:Readonly<Record<string,string>>={
 'hat-pilot':'hat-cap','hat-knight':'hat-tide',
 'hair-spiky':'hair-undercut','hair-silver':'hair-ponytail',
 'glasses-round':'glasses-sport','glasses-pilot':'glasses-cat'
};
/** The game keeps a single outfit (matheus, 18/10): the others were retired and become the Cartógrafo once. */
export const RETIRED_OUTFIT_REPLACEMENTS:Readonly<Record<string,string>>={
 'outfit-surfer':'outfit-cartographer','outfit-executive':'outfit-cartographer','outfit-racer':'outfit-cartographer','outfit-dancer':'outfit-cartographer'
};
export const SLOT_NAMES:Record<Slot,string> = {weapon:'Arma',hat:'Chapéu',face:'Rosto',outfit:'Roupa',hair:'Cabelo',glasses:'Óculos',wristband:'Pulseira',bracelet:'Bracelete',costume:'Fantasia',ring:'Anel',ring2:'Anel',necklace:'Colar',bubble:'Bolha'};
export const UNEQUIP:Partial<Record<Slot,string>>={hat:'hat-none',hair:'hair-none',glasses:'glasses-none',face:'face-brave',outfit:'outfit-cartographer',wristband:'wristband-none',bracelet:'bracelet-none',costume:'costume-none',ring:'ring-none',ring2:'ring-none',necklace:'necklace-none',bubble:'bubble-none'};
export function unequipForGender(gender:CharacterGender):Partial<Record<Slot,string>> {return gender==='female'?{...UNEQUIP,face:'face-smile',outfit:'outfit-explorer'}:{...UNEQUIP};}
/** 16: female characters get the Exploradora da Aurora (feminine starter outfit) and wear it instead of the Cartógrafo. */
export const CONTENT_VERSION=17;
export const MAX_UPGRADE = MAX_STRENGTHEN;
export const MAX_FORGE_STONES = 20;
/** Where players stand to use the forge: beside the smith in Praça Celeste. */
/** Where players stand to use the forge, just in front of the smith (moves with the forge station, shared/lobby.ts). */
export const SMITH_POSITION:{x:number;y:number} = {x:3640,y:640};
export const STONES = [
 {level:1,name:'Pedra de Fortificação I',color:'#c9d0ca',power:1},
 {level:2,name:'Pedra de Fortificação II',color:'#65cffa',power:2},
 {level:3,name:'Pedra de Fortificação III',color:'#ed6bb1',power:4},
 {level:4,name:'Pedra de Fortificação IV',color:'#ffc44f',power:8},
 {level:5,name:'Pedra de Fortificação V',color:'#ba8dec',power:16}
] as const;
export const STARTER_STONES:Record<string,number> = {'1':30,'2':20,'3':15,'4':10,'5':8};
// Each entry is the material power needed for a 75% chance of the next level.
export const UPGRADE_REQUIREMENTS = [1,2,4,6,9,13,19,28,40,58,82,115,150,190,240] as const;
export function upgradeChance(currentLevel:number,stones:Record<string,number>):number {
 if(!Number.isInteger(currentLevel)||currentLevel<0||currentLevel>=MAX_UPGRADE)return 0;
 let count=0,power=0;
 for(const [level,amount] of Object.entries(stones)){
  const stone=STONES.find(s=>String(s.level)===level);
  if(!stone||!Number.isInteger(amount)||amount<0||amount>MAX_FORGE_STONES)return 0;
  count+=amount;power+=stone.power*amount;
 }
 if(count<1||count>MAX_FORGE_STONES)return 0;
 return Math.min(100,Math.round(750*power/UPGRADE_REQUIREMENTS[currentLevel])/10);
}
export function upgradeProgress(level:number):number {return Math.max(0,Math.min(MAX_UPGRADE,level))/MAX_UPGRADE*100;}
/** Forge: Dano × 1.10^level; Ataque, Defesa, Agilidade and Sorte only gain at the +10 and +12 milestones (shared/stats.ts). */
export function weaponStats(weapon:Weapon,level:number):Weapon {
 const upgrade=strengthenLevel(level);
 return {...weapon,damage:strengthenedValue(weapon.damage,upgrade),attack:weaponMilestoneValue(weapon.attack,upgrade),defense:weaponMilestoneValue(weapon.defense,upgrade),agility:weaponMilestoneValue(weapon.agility,upgrade),...(weapon.luck===undefined?{}:{luck:weaponMilestoneValue(weapon.luck,upgrade)})};
}
/** Item tooltips and character totals use the same authoritative numbers: original values, then forge, then composition. */
export function itemAttributes(item:Item,level=0,composition:CompositionBonus={}):ItemAttributes {
 const value=item.slot==='weapon'?weaponStats(item as Weapon,level):item;
 const armor=isArmorSlot(item.slot)?strengthenedValue(item.armor??0,level):value.armor??0;
 const stats={attack:value.attack,defense:value.defense,agility:value.agility,luck:value.luck??0,damage:value.damage??0,armor};
 for(const stat of COMPOSITION_STATS)stats[stat]+=composition[stat]??0;
 return stats;
}
/** DDTank phases: one look for +0 to +9, then new art at +10, +12 and +15. */
export function weaponVisualStage(level:number):0|10|12|15 {
 if(level>=15)return 15;if(level>=12)return 12;if(level>=10)return 10;return 0;
}
/** Phase index 0–3: column of the effect atlas and tier of per-phase mechanics. */
export function weaponPhaseTier(level:number):0|1|2|3 {const stage=weaponVisualStage(level);return stage===15?3:stage===12?2:stage===10?1:0;}
export function weaponFragmentCount(weapon:Weapon,level:number,powered=false):number {
 if(!weapon.fragments)return 0;
 return weapon.fragments.count[weaponPhaseTier(level)]+(powered?2:0);
}
/** Every weapon keeps its art in public/assets/weapons/<id>/ (contract: shared/weaponKit.ts). */
export function weaponAssetPath(id:string,level=0):string {return `/assets/weapons/${id}/held-${weaponVisualStage(level)}.png`;}
export function weaponIconPath(id:string,level=0):string {return `/assets/weapons/${id}/icon-${weaponVisualStage(level)}.png`;}
/** Tools spend Vigor (`cost`) and add Delay (`delay`, like DDTank item Property5). Brasa balance: Delay equals the Vigor cost. */
export const BOOSTS = [
 {id:'extra1',label:'+1',name:'Disparo adicional',cost:110,detail:'2 disparos seguidos · 90% de dano cada · não combina com +2',key:'1',delay:110},
 {id:'extra2',label:'+2',name:'Dois disparos adicionais',cost:110,detail:'3 disparos seguidos · 60% de dano cada · não combina com +1',key:'2',delay:110},
 {id:'trident',label:'Ⅲ',name:'Tridente',cost:110,detail:'3 projéteis ao mesmo tempo · 50% de dano cada · uma vez',key:'3',delay:110},
 {id:'damage50',label:'50%',name:'Dano +50%',cost:85,detail:'Aumenta o dano em 50%',key:'4',delay:85},
 {id:'damage40',label:'40%',name:'Dano +40%',cost:80,detail:'Aumenta o dano em 40%',key:'5',delay:80},
 {id:'damage30',label:'30%',name:'Dano +30%',cost:70,detail:'Aumenta o dano em 30%',key:'6',delay:70},
 {id:'damage20',label:'20%',name:'Dano +20%',cost:55,detail:'Aumenta o dano em 20%',key:'7',delay:55},
 {id:'damage10',label:'10%',name:'Dano +10%',cost:50,detail:'Aumenta o dano em 10%',key:'8',delay:50}
] as const;
export type BoostId = typeof BOOSTS[number]['id'];
export {MAPS} from './maps';
export type {MapId} from './maps';
/** Base attributes of every character before equipment. */
export const CHARACTER_BASE:ItemAttributes={attack:80,defense:30,agility:50,luck:20,damage:0,armor:20};
/** The forge level an equipped slot is read at. */
export function slotUpgrade(eq:Equipment,slot:Slot):number {return slot==='weapon'?eq.upgrade??0:isArmorSlot(slot)?eq.slotUpgrades?.[slot]??0:0;}
/**
 * The one place character totals are made (docs/attributes.md): character base + every equipped item
 * (forged, plus composition). Vida comes from level and Defesa, Vigor from Agilidade, Delay from Agilidade and Ataque.
 */
export function attributes(eq:Equipment,level=1) {
 const stats:ItemAttributes={...CHARACTER_BASE};let hpPercent=0;
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const item=CATALOG[eq[slot]];if(item){hpPercent+=item.hpPercent??0;const values=itemAttributes(item,slotUpgrade(eq,slot),eq.compositions?.[item.id]);for(const key of Object.keys(stats) as (keyof ItemAttributes)[])stats[key]+=values[key];}}
 // The active pet adds like one more item (scaled by its vitality, shared/pets.ts); battle buffs last only for that battle.
 const pet=petContribution(eq.pet),buffs=eq.battleBuffs??{};
 for(const key of Object.keys(stats) as (keyof ItemAttributes)[])stats[key]+=(pet[key]??0)+(buffs[key]??0);
 const hp=maxHpFor(level,stats.defense,1+hpPercent/100)+(pet.hp??0);
 return {...stats,hp,stamina:maxStaminaFor(stats.agility)+(pet.stamina??0)+(buffs.stamina??0),delay:baseDelay(stats.agility,stats.attack),power:Math.round(stats.attack*6+stats.defense*4+stats.agility*3+stats.luck*3+stats.damage*3+stats.armor*2)+hpPower(hp)};
}
