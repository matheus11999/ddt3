/** Permanent, unstrengthened equipment. Prices are shared for display; the server charges them. */
export interface ShopOffer {id:string;price:number;gender?:'male'|'female'|'unisex';}
export const MAX_SHOP_ITEMS=20;
export const SHOP_OFFERS:readonly ShopOffer[]=[
 {id:'ember',price:420},{id:'volt',price:360},{id:'crystal',price:560},{id:'dynamite',price:480},
 {id:'outfit-surfer',price:280,gender:'male'},{id:'outfit-executive',price:340,gender:'male'},
 {id:'outfit-racer',price:360,gender:'male'},{id:'outfit-dancer',price:360,gender:'female'},
 {id:'face-brave',price:100},{id:'face-smile',price:120},{id:'face-serene',price:150},{id:'face-taunt',price:180},{id:'face-fierce',price:220},{id:'face-wink',price:180},
 {id:'hat-cap',price:100},{id:'hat-pilot',price:180},{id:'hat-mage',price:250},{id:'hat-knight',price:220},
 {id:'hat-thunder',price:140},{id:'hat-tide',price:140},{id:'hat-ruby',price:180},{id:'hat-tropical',price:180},
 {id:'hair-spiky',price:80},{id:'hair-wavy',price:160},{id:'hair-silver',price:200},
 {id:'hair-undercut',price:180,gender:'male'},{id:'hair-ponytail',price:180,gender:'female'},
 {id:'glasses-round',price:100},{id:'glasses-pilot',price:160},{id:'glasses-sport',price:140},{id:'glasses-cat',price:140},
 {id:'wristband-braid',price:120},{id:'bracelet-sun',price:240}
];
export const SHOP_OFFER_BY_ID:Readonly<Record<string,ShopOffer>>=Object.fromEntries(SHOP_OFFERS.map(offer=>[offer.id,offer]));
