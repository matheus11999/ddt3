import {CATALOG,DEFAULT_EQUIPMENT,ITEMS,itemGender,WEAPONS} from '../../shared/catalog';
import type {Weapon} from '../../shared/catalog';
import {SHOP_OFFER_BY_ID,SHOP_OFFERS} from '../../shared/shop';
import type {ShopOffer} from '../../shared/shop';

/**
 * Test-only weapons. The game's arsenal is being rebuilt from zero (docs/weapon-kit.md) and today holds
 * only the Quebra-Tijolos, a single brick per shot. The generic combat, forge,
 * shop and migration tests keep their former single-projectile weapons as fixtures, loaded before
 * every test file by `npm test` (--import). Tests about the real starter use STARTER_WEAPON.
 */
export const FIXTURE_WEAPONS:Weapon[]=[
 {id:'ember',name:'Dragão de Brasa',slot:'weapon',rarity:'epic',color:'#ff9b44',description:'Uma pequena fera. Uma enorme explosão.',attack:150,defense:55,agility:70,luck:85,damage:230,crater:66,blast:110,projectileRadius:6,effect:'fire',minAngle:15,maxAngle:85,hold:'hand'},
 {id:'volt',name:'Tempestade',slot:'weapon',rarity:'rare',color:'#80d9ff',description:'Um núcleo elétrico de precisão.',attack:100,defense:45,agility:120,luck:95,damage:215,crater:38,blast:94,projectileRadius:3,effect:'electric',minAngle:15,maxAngle:80,hold:'hand'},
 {id:'crystal',name:'Flor de Cristal',slot:'weapon',rarity:'legendary',color:'#d6a1ff',description:'Fragmentos arcanos que abrem caminho.',attack:110,defense:130,agility:55,luck:65,damage:220,crater:86,blast:102,projectileRadius:9,effect:'crystal',minAngle:20,maxAngle:85,hold:'hand'},
 {id:'dynamite',name:'Cesto de Pavio',slot:'weapon',rarity:'epic',color:'#ff553c',description:'Dinamites de pavio aceso. Uma chuva de faíscas e uma explosão de personalidade.',attack:120,defense:85,agility:75,luck:80,damage:225,crater:56,blast:118,projectileRadius:7,effect:'dynamite',minAngle:15,maxAngle:85},
];
/** The shard mechanic (`fragments`) has no real weapon today (matheus did not want shrapnel on the Quebra-Tijolos), so it is tested here, added to the arsenal only while a test needs it. */
export const SHRAPNEL_FIXTURE:Weapon={id:'shrapnel',name:'Estilhaço de teste',slot:'weapon',rarity:'rare',color:'#d8432a',description:'Arma de teste com cacos.',attack:85,defense:95,agility:85,luck:85,damage:200,crater:30,blast:92,projectileRadius:8,effect:'brick',minAngle:20,maxAngle:80,fragments:{count:[2,3,4,5],damage:.24,crater:10,blast:44,speed:235,radius:3,gravity:420}};
const prices:Record<string,number>={ember:420,volt:360,crystal:560,dynamite:480};
// Same order as the former arsenal (brick last), which some tests destructure.
WEAPONS.unshift(...FIXTURE_WEAPONS.filter(weapon=>!CATALOG[weapon.id]));ITEMS.unshift(...FIXTURE_WEAPONS.filter(weapon=>!CATALOG[weapon.id]));
for(const weapon of FIXTURE_WEAPONS){
 if(CATALOG[weapon.id]&&CATALOG[weapon.id]!==weapon)continue;
(CATALOG as Record<string,typeof weapon>)[weapon.id]=weapon;
 const offer:ShopOffer={id:weapon.id,price:prices[weapon.id],gender:itemGender(weapon)};(SHOP_OFFERS as ShopOffer[]).push(offer);(SHOP_OFFER_BY_ID as Record<string,ShopOffer>)[weapon.id]=offer;
}
DEFAULT_EQUIPMENT.weapon='ember';
/** Runs `body` with the shrapnel fixture in the arsenal, then takes it out again. */
export async function withShrapnel<T>(body:()=>Promise<T>|T):Promise<T>{
 WEAPONS.push(SHRAPNEL_FIXTURE);(CATALOG as Record<string,Weapon>).shrapnel=SHRAPNEL_FIXTURE;
 try{return await body();}finally{WEAPONS.splice(WEAPONS.indexOf(SHRAPNEL_FIXTURE),1);delete (CATALOG as Record<string,Weapon>).shrapnel;}
}
/** No gravity and no drag: the shot flies straight at 20 px/s per point of force. */
export const STRAIGHT_BALL={mass:10,weight:0,wind:240,drag:0};
