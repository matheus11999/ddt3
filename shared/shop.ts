import {itemGender} from './catalog';
import type {ItemGender} from './catalog';
/** Permanent, unstrengthened equipment. Prices are shared for display; the server charges them. */
export interface ShopOffer {id:string;price:number;gender?:ItemGender;}
export const MAX_SHOP_ITEMS=20;
export const SHOP_OFFERS:readonly ShopOffer[]=[
 {id:'brick',price:300},
 {id:'love-boomerang',price:480},
 {id:'outfit-cartographer',price:360},{id:'outfit-captain',price:380},
 {id:'face-brave',price:100},{id:'face-smile',price:120},{id:'face-serene',price:150},{id:'face-taunt',price:180},{id:'face-fierce',price:220},{id:'face-wink',price:180},
 {id:'hat-cap',price:100},{id:'hat-mage',price:250},
 {id:'hat-thunder',price:140},{id:'hat-tide',price:140},{id:'hat-ruby',price:180},{id:'hat-tropical',price:180},{id:'hat-captain',price:180},
 {id:'hair-wavy',price:160},
 {id:'hair-undercut',price:180},{id:'hair-ponytail',price:180},
 {id:'hair-horizon',price:180},{id:'hair-captain',price:180},
 {id:'glasses-sport',price:140},{id:'glasses-cat',price:140},
 {id:'glasses-navigator',price:140},{id:'glasses-captain',price:140},
 {id:'wristband-braid',price:120},{id:'bracelet-sun',price:240},
 {id:'ring-ember',price:200},{id:'ring-tide',price:160},{id:'necklace-star',price:320},{id:'bubble-cloud',price:150},
 {id:'costume-thunder-chick',price:480},{id:'costume-arcane-fox',price:480}
].map(offer=>({...offer,gender:itemGender(offer.id)}));
/** Stackable goods bought by quantity; they never become equipment copies. */
export interface ConsumableOffer {id:string;price:number;}
export const CONSUMABLE_OFFERS:readonly ConsumableOffer[]=[{id:'color-ticket',price:60}];
export const CONSUMABLE_OFFER_BY_ID:Readonly<Record<string,ConsumableOffer>>=Object.fromEntries(CONSUMABLE_OFFERS.map(offer=>[offer.id,offer]));
export const isConsumableOffer=(id:string)=>Object.hasOwn(CONSUMABLE_OFFER_BY_ID,id);
export const SHOP_OFFER_BY_ID:Readonly<Record<string,ShopOffer>>=Object.fromEntries(SHOP_OFFERS.map(offer=>[offer.id,offer]));
