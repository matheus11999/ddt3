import type {Profile} from '../shared/protocol';
import {MAX_COLOR_TICKETS} from '../shared/colors';
import {PET_FOODS} from '../shared/pets';
import {FISHING_DAILY_CAPS,FISHING_OFFER_BY_ID,FISH_BAG_MAX,FISH_BY_ID,MAX_FISH_SELL,ROD_BY_ID,FISHING_HISTORY,fishingDay,fishingLevel,fishingWeek,normalizeFishing} from '../shared/fishing';
import type {FishingCatch,FishingDrop} from '../shared/fishing';

/**
 * Pescaria rules that change a profile (docs/fishing.md). Pure functions over a profile: the
 * Store runs them inside its row lock, tests run them directly. The session itself (cast, bite,
 * bar, automatic mode) lives in server/game.ts.
 */
export interface FishSettle {fish?:{id:string;kg:number;points:number;xp:number};/** Caught in automatic mode (shown in the history). */auto?:boolean;/** When (the history's clock and the daily caps' day; tests pass their own). */at?:number;/** The rod's prize rolled with this catch (rollRodDrops, at most one); it replaces the fish unless the daily cap is full. */drops?:FishingDrop[];}
/** `weekRecord`: the catch is the player's new heaviest fish of the week (the ranking needs updating). */
export interface FishSettleOutcome {profile:Profile;catch?:FishingCatch;/** The rod's prize came up instead of the fish (one reward per cast). */prize?:FishingDrop;/** Fisher EXP the cast gave (the fish's, also when a prize came up instead). */xp?:number;levelUp?:number;weekRecord?:{week:string;fish:string;kg:number};}
export interface FishBuyOutcome {profile:Profile;spent:number;}
export interface FishSellOutcome {profile:Profile;sold:number;points:number;}

/**
 * One cast ends with one reward (pedido do matheus, 20/10: nunca peixe, Cupom e Ouro juntos): the rod's prize
 * when one came up and the daily cap still has room, otherwise the fish (Pontos de Pesca, the collection entry,
 * the Sacola). Fisher EXP comes either way.
 */
export function settleFishing(profile:Profile,settle:FishSettle):FishSettleOutcome{
 const f=profile.fishing=normalizeFishing(profile.fishing);
 if(!settle.fish)return {profile};
 const fish=FISH_BY_ID.get(settle.fish.id);if(!fish)throw Error('Peixe desconhecido.');
 const at=settle.at??Date.now(),day=fishingDay(at);
 if(f.daily.day!==day)f.daily={day,gold:0,coupons:0,fragments:0};
 for(const drop of settle.drops??[]){
  const amount=Math.min(drop.amount,FISHING_DAILY_CAPS[drop.kind]-f.daily[drop.kind]);if(amount<=0)continue;
  if(drop.kind==='fragments'&&!drop.weapon)continue;
  f.daily[drop.kind]+=amount;
  if(drop.kind==='gold')profile.gold+=amount;
  else if(drop.kind==='coupons')profile.coupons+=amount;
  else profile.fragments[drop.weapon!]=(profile.fragments[drop.weapon!]??0)+amount;
  const before=fishingLevel(f.xp);f.xp+=settle.fish.xp;const after=fishingLevel(f.xp);
  return {profile,prize:{...drop,amount},xp:settle.fish.xp,...(after>before?{levelUp:after}:{})};
 }
 const before=fishingLevel(f.xp),first=!f.caught[fish.id],record=settle.fish.kg>(f.best[fish.id]??0);
 f.caught[fish.id]=(f.caught[fish.id]??0)+1;f.total++;f.xp+=settle.fish.xp;
 if(record)f.best[fish.id]=settle.fish.kg;
 const weekKey=fishingWeek(at);
 // The fish goes into the Sacola to be sold at the Casa de Pesca; with the Sacola full it is sold right away.
 const sold=f.bag.length>=FISH_BAG_MAX,bagId=`${at.toString(36)}-${f.total.toString(36)}`;
 if(sold)f.points+=settle.fish.points;
 else f.bag.unshift({id:bagId,fish:fish.id,kg:settle.fish.kg,value:settle.fish.points,at,...(settle.auto?{auto:true}:{})});
 const weekRecord=f.week?.key!==weekKey||settle.fish.kg>f.week.kg;
 if(weekRecord)f.week={key:weekKey,fish:fish.id,kg:settle.fish.kg};
 f.history=[{fish:fish.id,kg:settle.fish.kg,points:settle.fish.points,xp:settle.fish.xp,at,...(settle.auto?{auto:true}:{})},...f.history].slice(0,FISHING_HISTORY);
 const after=fishingLevel(f.xp);
 return {profile,...(weekRecord?{weekRecord:{week:weekKey,fish:fish.id,kg:settle.fish.kg}}:{}),catch:{fish:fish.id,kg:settle.fish.kg,points:settle.fish.points,xp:settle.fish.xp,record:record&&!first,first,...(sold?{sold:true}:{bagId}),...(after>before?{levelUp:after}:{})}};
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
 else if(prize.kind==='fragment')profile.fragments={...profile.fragments,[prize.weapon]:(profile.fragments?.[prize.weapon]??0)+prize.amount*quantity};
 return {profile,spent};
}
/** Sells fish from the Sacola at the Casa de Pesca: each one pays its own value in Pontos de Pesca. */
export function sellFish(profile:Profile,ids:readonly string[]):FishSellOutcome{
 const f=profile.fishing=normalizeFishing(profile.fishing),wanted=new Set(ids);
 if(!wanted.size)throw Error('Escolha os peixes para vender.');
 if(wanted.size>MAX_FISH_SELL)throw Error('Peixes demais numa venda.');
 const sold=f.bag.filter(b=>wanted.has(b.id));
 if(sold.length!==wanted.size)throw Error('Algum desses peixes não está mais na Sacola.');
 const points=sold.reduce((sum,b)=>sum+b.value,0);
 f.bag=f.bag.filter(b=>!wanted.has(b.id));f.points+=points;
 return {profile,sold:sold.length,points};
}
