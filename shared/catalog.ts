import {COMPOSITION_STATS} from './composition';
import type {CompositionBonus,Compositions} from './composition';
export const SLOTS = ['weapon','face','outfit','hair','hat','glasses','wristband','bracelet'] as const;
export type Slot = typeof SLOTS[number];
export const DYE_IDS = ['original','coral','azure','violet','gold'] as const;
export type DyeId = typeof DYE_IDS[number];
export const DYE_SLOTS = ['hat','outfit','hair','glasses'] as const;
export type DyeSlot = typeof DYE_SLOTS[number];
export const DYES: {id:DyeId;name:string;color:string}[] = [
 {id:'original',name:'Original',color:'#b89870'}, {id:'coral',name:'Coral',color:'#f24b64'},
 {id:'azure',name:'Celeste',color:'#168cf0'}, {id:'violet',name:'Violeta',color:'#9836e7'}, {id:'gold',name:'Ouro',color:'#ffbb24'}
];
export type Equipment = Record<Slot, string> & {upgrade:number;compositions?:Compositions;dyes?:Partial<Record<DyeSlot,DyeId>>};
export function normalizeDyes(value:unknown):Partial<Record<DyeSlot,DyeId>> {
 const dyes:Partial<Record<DyeSlot,DyeId>>={};
 if(value&&typeof value==='object')for(const slot of DYE_SLOTS){const id=(value as Record<string,unknown>)[slot];if(DYE_IDS.includes(id as DyeId))dyes[slot]=id as DyeId;}
 return dyes;
}
export interface ItemVisual {variant:string;visible?:boolean;pose?:'adventurer'|'confident'|'regal'|'surfer'|'executive'|'racer'|'dancer';asset?:string;color?:string;secondary?:string;hideHair?:boolean;offset?:[number,number];scale?:number;rotation?:number;}
export type Rarity = 'common'|'uncommon'|'rare'|'epic'|'legendary';
export interface Item { id:string; name:string; slot:Slot; rarity:Rarity; color:string; description:string; attack:number; defense:number; agility:number; damage?:number; armor?:number; visual?:ItemVisual; }
export interface ItemAttributes {attack:number;defense:number;agility:number;damage:number;armor:number;}
const cosmetic=(id:string,name:string,slot:Slot,variant:string,color:string,rarity:Rarity='common',visual:Partial<ItemVisual>={}):Item=>({id,name,slot,rarity,color,description:variant==='none'?'Visual natural.':'Personalize sua aventura.',attack:0,defense:0,agility:0,visual:{variant,color,...visual}});
export interface Weapon extends Item { damage:number; crater:number; blast:number; gravity:number; projectileRadius:number; effect:'fire'|'electric'|'crystal'|'dynamite'; minAngle:number; maxAngle:number; }
export const WEAPONS: Weapon[] = [
 {id:'ember',name:'Dragão de Brasa',slot:'weapon',rarity:'epic',color:'#ff9b44',description:'Uma pequena fera. Uma enorme explosão.',attack:145,defense:35,agility:60,damage:240,crater:66,blast:110,gravity:260,projectileRadius:6,effect:'fire',minAngle:15,maxAngle:85},
 {id:'volt',name:'Tempestade',slot:'weapon',rarity:'rare',color:'#80d9ff',description:'Um núcleo elétrico de precisão.',attack:110,defense:55,agility:135,damage:205,crater:38,blast:94,gravity:220,projectileRadius:3,effect:'electric',minAngle:15,maxAngle:80},
 {id:'crystal',name:'Flor de Cristal',slot:'weapon',rarity:'legendary',color:'#d6a1ff',description:'Fragmentos arcanos que abrem caminho.',attack:125,defense:95,agility:80,damage:220,crater:86,blast:102,gravity:290,projectileRadius:9,effect:'crystal',minAngle:20,maxAngle:85},
 {id:'dynamite',name:'Cesto de Pavio',slot:'weapon',rarity:'epic',color:'#ff553c',description:'Dinamites de pavio aceso. Uma chuva de faíscas e uma explosão de personalidade.',attack:135,defense:45,agility:70,damage:230,crater:56,blast:118,gravity:310,projectileRadius:7,effect:'dynamite',minAngle:15,maxAngle:85}
];
export const ITEMS: Item[] = [...WEAPONS,
 {id:'hat-cap',name:'Boné do Explorador',slot:'hat',rarity:'common',color:'#e09c55',description:'O começo de uma grande jornada.',attack:0,defense:8,agility:8,armor:5},
 {id:'hat-pilot',name:'Óculos de Voo',slot:'hat',rarity:'rare',color:'#cf9c57',description:'Prontos para qualquer aventura.',attack:0,defense:12,agility:10,armor:8},
 {id:'hat-mage',name:'Chapéu Astral',slot:'hat',rarity:'epic',color:'#9b83df',description:'Um pedacinho do céu.',attack:8,defense:14,agility:0,armor:10},
 {id:'hat-knight',name:'Elmo do Guardião',slot:'hat',rarity:'rare',color:'#8bc4c9',description:'Coragem forjada em prata.',attack:0,defense:24,agility:0,armor:18},
 {id:'outfit-surfer',name:'Surfista da Maré',slot:'outfit',rarity:'rare',color:'#00b8c8',description:'Bermuda, sandálias e o jeito tranquilo de quem vive na praia.',attack:6,defense:16,agility:18,armor:16},
 {id:'outfit-executive',name:'Executivo',slot:'outfit',rarity:'rare',color:'#215bd1',description:'Terno alinhado, sapatos sociais e uma postura de confiança.',attack:14,defense:26,agility:6,armor:28},
 {id:'outfit-racer',name:'Piloto Relâmpago',slot:'outfit',rarity:'rare',color:'#1265e8',description:'Macacão azul e laranja, luvas e uma postura firme com as mãos na cintura.',attack:8,defense:20,agility:16,armor:20,visual:{variant:'racer',pose:'racer',asset:'/assets/outfits/shop-outfits.png'}},
 {id:'outfit-dancer',name:'Dançarina Rubi',slot:'outfit',rarity:'rare',color:'#ec2447',description:'Jaqueta rubi, tênis de cano alto e uma pose de dança exclusiva.',attack:8,defense:16,agility:20,armor:16,visual:{variant:'dancer',pose:'dancer',asset:'/assets/outfits/shop-outfits.png'}},
 cosmetic('face-wink','Piscadela Confiante','face','wink','#e6a16f','rare',{asset:'/assets/faces/face-wink.png'}),
 cosmetic('hair-undercut','Corte Tempestade','hair','undercut','#1555c2','rare',{asset:'/assets/shop-accessories.png'}),
 cosmetic('hair-ponytail','Rabo de Cavalo Rubi','hair','ponytail','#a34528','rare',{asset:'/assets/shop-accessories.png'}),
 cosmetic('glasses-sport','Óculos Sprint','glasses','sport','#19bde8','uncommon',{asset:'/assets/shop-accessories.png'}),
 cosmetic('glasses-cat','Óculos Gatinho','glasses','cat','#e82553','uncommon',{asset:'/assets/shop-accessories.png'}),
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
 cosmetic('hair-spiky','Cabelo Aventureiro','hair','spiky','#714331','common',{asset:'/assets/hair-spiky.png'}),
 cosmetic('hair-wavy','Cabelo Ondulado','hair','wavy','#c79352','rare',{asset:'/assets/hair-wavy.png'}),
 cosmetic('hair-silver','Cabelo Lunar','hair','spiky','#c5c8e3','epic',{asset:'/assets/hair-spiky.png'}),
 cosmetic('hair-none','Sem cabelo','hair','none','#bca28c'),
 cosmetic('glasses-none','Sem óculos','glasses','none','#a9b3bc'),
 cosmetic('glasses-round','Óculos de Estudo','glasses','round','#c5a264','uncommon'),
 cosmetic('glasses-pilot','Óculos Aviador','glasses','pilot','#5aacc5','rare'),
 cosmetic('wristband-none','Sem pulseira','wristband','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('wristband-braid','Pulseira Trançada','wristband','braid','#b38c62','common',{visible:false}),agility:8},
 cosmetic('bracelet-none','Sem bracelete','bracelet','none','#bfb3a5','common',{visible:false}),
 {...cosmetic('bracelet-sun','Bracelete Solar','bracelet','sun','#dfb861','rare',{visible:false}),attack:4,defense:12,armor:10}
];
for(const item of ITEMS)if(item.slot==='outfit'&&!item.visual)item.visual={variant:item.id.replace('outfit-',''),asset:`/assets/${item.id}-body.png`,pose:item.id==='outfit-surfer'?'surfer':'executive',color:item.color};
export const CATALOG = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
export const DEFAULT_EQUIPMENT: Equipment = {weapon:'ember',hat:'hat-pilot',face:'face-brave',outfit:'outfit-surfer',hair:'hair-spiky',glasses:'glasses-none',wristband:'wristband-none',bracelet:'bracelet-none',upgrade:0};
export const SLOT_NAMES:Record<Slot,string> = {weapon:'Arma',hat:'Chapéu',face:'Rosto',outfit:'Roupa',hair:'Cabelo',glasses:'Óculos',wristband:'Pulseira',bracelet:'Bracelete'};
export const UNEQUIP:Partial<Record<Slot,string>>={hat:'hat-none',hair:'hair-none',glasses:'glasses-none',face:'face-brave',outfit:'outfit-surfer',wristband:'wristband-none',bracelet:'bracelet-none'};
export const CONTENT_VERSION=9;
export const MAX_UPGRADE = 12;
export const MAX_FORGE_STONES = 20;
export const SMITH_POSITION = {x:310,y:610} as const;
export const STONES = [
 {level:1,name:'Pedra de Fortificação I',color:'#c9d0ca',power:1},
 {level:2,name:'Pedra de Fortificação II',color:'#65cffa',power:2},
 {level:3,name:'Pedra de Fortificação III',color:'#ed6bb1',power:4},
 {level:4,name:'Pedra de Fortificação IV',color:'#ffc44f',power:8},
 {level:5,name:'Pedra de Fortificação V',color:'#ba8dec',power:16}
] as const;
export const STARTER_STONES:Record<string,number> = {'1':30,'2':20,'3':15,'4':10,'5':8};
// Each entry is the material power needed for a 75% chance of the next level.
export const UPGRADE_REQUIREMENTS = [1,2,4,6,9,13,19,28,40,58,82,115] as const;
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
export function weaponStats(weapon:Weapon,level:number):Weapon {
 const upgrade=Number.isFinite(level)?Math.max(0,Math.min(MAX_UPGRADE,Math.floor(level))):0;
 return {...weapon,attack:weapon.attack+upgrade*8,damage:Math.round(weapon.damage*(1+.035*upgrade))};
}
/** Item tooltips and character totals use the same authoritative numbers. */
export function itemAttributes(item:Item,level=0,composition:CompositionBonus={}):ItemAttributes {
 const value=item.slot==='weapon'?weaponStats(item as Weapon,level):item;
 const stats={attack:value.attack,defense:value.defense,agility:value.agility,damage:value.damage??0,armor:value.armor??0};
 for(const stat of COMPOSITION_STATS)stats[stat]+=composition[stat]??0;
 return stats;
}
export function weaponVisualStage(level:number):0|9|10|12 {
 if(level>=12)return 12;if(level>=10)return 10;if(level>=9)return 9;return 0;
}
export function weaponAssetPath(id:string,level=0):string {
 const stage=weaponVisualStage(level),suffix=stage===12?'':stage===10?'-awakened':stage===9?'-evolved':'-base';
 return `/assets/weapon-${id}${suffix}.png`;
}
export const BOOSTS = [
 {id:'extra1',label:'+1',name:'Disparo adicional',cost:110,detail:'2 disparos · 90% de dano por tiro',key:'1'},
 {id:'extra2',label:'+2',name:'Dois disparos adicionais',cost:110,detail:'3 disparos · 60% de dano por tiro',key:'2'},
 {id:'trident',label:'Ⅲ',name:'Tridente',cost:110,detail:'3 projéteis em leque · 50% de dano',key:'3'},
 {id:'damage50',label:'50%',name:'Dano +50%',cost:85,detail:'Aumenta o dano em 50%',key:'4'},
 {id:'damage40',label:'40%',name:'Dano +40%',cost:80,detail:'Aumenta o dano em 40%',key:'5'},
 {id:'damage30',label:'30%',name:'Dano +30%',cost:70,detail:'Aumenta o dano em 30%',key:'6'},
 {id:'damage20',label:'20%',name:'Dano +20%',cost:55,detail:'Aumenta o dano em 20%',key:'7'}
] as const;
export type BoostId = typeof BOOSTS[number]['id'];
export {MAPS} from './maps';
export type {MapId} from './maps';
export function attributes(eq:Equipment) {
 const stats:ItemAttributes={attack:80,defense:30,agility:50,damage:0,armor:20};
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const item=CATALOG[eq[slot]];if(item){const values=itemAttributes(item,slot==='weapon'?eq.upgrade:0,eq.compositions?.[item.id]);for(const key of Object.keys(stats) as (keyof ItemAttributes)[])stats[key]+=values[key];}}
 return {...stats,hp:1200+stats.defense*3,stamina:240+Math.floor(stats.agility/30),power:Math.round(stats.attack*6+stats.defense*4+stats.agility*3+stats.damage*3+stats.armor*2)};
}
