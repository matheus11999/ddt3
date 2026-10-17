import {itemGender} from './catalog';
import type {ItemGender} from './catalog';
/** Permanent, unstrengthened equipment. Prices are shared for display; the server charges them. */
export interface ShopOffer {id:string;price:number;gender?:ItemGender;}
export const MAX_SHOP_ITEMS=20;
export const SHOP_OFFERS:readonly ShopOffer[]=[
 {id:'ember',price:420},{id:'volt',price:360},{id:'crystal',price:560},{id:'dynamite',price:480},{id:'brick',price:500},
 {id:'outfit-surfer',price:280},{id:'outfit-executive',price:340},
 {id:'outfit-racer',price:360},{id:'outfit-dancer',price:360},
 {id:'outfit-cartographer',price:360},
 {id:'face-brave',price:100},{id:'face-smile',price:120},{id:'face-serene',price:150},{id:'face-taunt',price:180},{id:'face-fierce',price:220},{id:'face-wink',price:180},
 {id:'hat-cap',price:100},{id:'hat-mage',price:250},
 {id:'hat-thunder',price:140},{id:'hat-tide',price:140},{id:'hat-ruby',price:180},{id:'hat-tropical',price:180},
 {id:'hair-wavy',price:160},
 {id:'hair-undercut',price:180},{id:'hair-ponytail',price:180},
 {id:'hair-horizon',price:180},
 {id:'glasses-sport',price:140},{id:'glasses-cat',price:140},
 {id:'glasses-navigator',price:140},
 {id:'wristband-braid',price:120},{id:'bracelet-sun',price:240},
 {id:'costume-thunder-chick',price:480},{id:'costume-arcane-fox',price:480}
].map(offer=>({...offer,gender:itemGender(offer.id)}));
export const SHOP_OFFER_BY_ID:Readonly<Record<string,ShopOffer>>=Object.fromEntries(SHOP_OFFERS.map(offer=>[offer.id,offer]));
