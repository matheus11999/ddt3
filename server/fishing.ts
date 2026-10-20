import type {Profile} from '../shared/protocol';
import {MAX_COLOR_TICKETS} from '../shared/colors';
import {PET_FOODS} from '../shared/pets';
import {FISHING_DAILY_CAPS,FISHING_OFFER_BY_ID,FISH_BY_ID,ROD_BY_ID,FISHING_HISTORY,fishingDay,fishingLevel,normalizeFishing} from '../shared/fishing';
import type {FishingCatch,FishingDrop} from '../shared/fishing';

/**
 * Pescaria rules that change a profile (docs/fishing.md). Pure functions over a profile: the
 * Store runs them inside its row lock, tests run them directly. The session itself (cast, bite,
 * bar, automatic mode) lives in server/game.ts.
 */
export interface FishSettle {fish?:{id:string;kg:number;points:number;xp:number};/** Caught in automatic mode (shown in the history). */auto?:boolean;/** When (the history's clock and the daily caps' day; tests pass their own). */at?:number;/** The rod's prizes rolled with this catch (rollRodDrops); the daily caps cut them here. */drops?:FishingDrop[];}
export interface FishSettleOutcome {profile:Profile;catch?:FishingCatch;}
export interface FishBuyOutcome {profile:Profile;spent:number;}

/** One cast ends: a catch adds Pontos de Pesca, fisher EXP, the collection entry and the rod's prizes (up to the daily caps). */
export function settleFishing(profile:Profile,settle:FishSettle):FishSettleOutcome{
 const f=profile.fishing=normalizeFishing(profile.fishing);
 if(!settle.fish)return {profile};
 const fish=FISH_BY_ID.get(settle.fish.id);if(!fish)throw Error('Peixe desconhecido.');
 const before=fishingLevel(f.xp),first=!f.caught[fish.id],record=settle.fish.kg>(f.best[fish.id]??0);
 f.caught[fish.id]=(f.caught[fish.id]??0)+1;f.total++;f.points+=settle.fish.points;f.xp+=settle.fish.xp;
 if(record)f.best[fish.id]=settle.fish.kg;
 const at=settle.at??Date.now(),day=fishingDay(at);
 if(f.daily.day!==day)f.daily={day,gold:0,coupons:0,fragments:0};
 const drops:FishingDrop[]=[];
 for(const drop of settle.drops??[]){
  const amount=Math.min(drop.amount,FISHING_DAILY_CAPS[drop.kind]-f.daily[drop.kind]);if(amount<=0)continue;
  if(drop.kind==='fragments'&&!drop.weapon)continue;
  f.daily[drop.kind]+=amount;drops.push({...drop,amount});
  if(drop.kind==='gold')profile.gold+=amount;
  else if(drop.kind==='coupons')profile.coupons+=amount;
  else profile.fragments[drop.weapon!]=(profile.fragments[drop.weapon!]??0)+amount;
 }
 f.history=[{fish:fish.id,kg:settle.fish.kg,points:settle.fish.points,xp:settle.fish.xp,at,...(settle.auto?{auto:true}:{}),...(drops.length?{drops}:{})},...f.history].slice(0,FISHING_HISTORY);
 const after=fishingLevel(f.xp);
 return {profile,catch:{fish:fish.id,kg:settle.fish.kg,points:settle.fish.points,xp:settle.fish.xp,record:record&&!first,first,...(drops.length?{drops}:{}),...(after>before?{levelUp:after}:{})}};
}
/** Picks the rod to fish with; only owned ones. */
export function chooseFishingGear(profile:Profile,rod:string):Profile{
 const f=profile.fishing=normalizeFishing(profile.fishing);
 if(!ROD_BY_ID.has(rod)||!f.rods.includes(rod))throw Error('Você não tem essa vara.');f.rod=rod;
 return profile;
}
/** Trades Pontos de Pesca at the Casa de Pesca. */
export function buyFishingOffer(profile:Profile,offerId:string,quantity:number):FishBuyOutcome{
 const offer=FISHING_OFFER_BY_ID.get(offerId);if(!offer)throw Error('Essa troca não existe.');
 const f=profile.fishing=normalizeFishing(profile.fishing);
 if(offer.level&&fishingLevel(f.xp)<offer.level)throw Error(`Precisa do nível de pescador ${offer.level}.`);
 const prize=offer.prize;
 if(prize.kind==='rod'){if(quantity!==1)throw Error('Compre uma vara por vez.');if(f.rods.includes(prize.rod))throw Error('Você já tem essa vara.');}
 if(prize.kind==='ticket'&&profile.colorTickets+prize.amount*quantity>MAX_COLOR_TICKETS)throw Error('Você já tem o máximo de Tickets de Cor.');
 if(prize.kind==='pet-food'&&!PET_FOODS.has(prize.food))throw Error('Essa comida não está disponível.');
 const spent=offer.cost*quantity;if(f.points<spent)throw Error('Pontos de Pesca insuficientes.');
 f.points-=spent;
 if(prize.kind==='gold')profile.gold+=prize.amount*quantity;
 else if(prize.kind==='stone'){const tier=String(prize.level);profile.stones[tier]=(profile.stones[tier]??0)+prize.amount*quantity;}
 else if(prize.kind==='ticket')profile.colorTickets+=prize.amount*quantity;
 else if(prize.kind==='pet-food')profile.petFood[prize.food]=(profile.petFood[prize.food]??0)+prize.amount*quantity;
 else if(prize.kind==='rod')f.rods.push(prize.rod);
 return {profile,spent};
}
