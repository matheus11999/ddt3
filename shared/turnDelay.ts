import {DELAY_PER_SECOND} from './stats';

/**
 * PvP turn order by accumulated Delay (DDTank 3.0 BaseGame/PVPGame `NextTurn`): the living fighter with the
 * lowest Delay plays; everyone's Delay is lowered by that amount (relative times are kept); then the player's
 * base Delay is added as their turn starts. Shots, time spent and passing add more. Nothing is random, and a
 * fighter whose Delay stays lowest plays again (consecutive turns).
 */
export interface DelayActor {id:string;hp:number;left?:boolean;delay?:number;}
export const TURN_SECONDS=30;

/** Who plays next. Ties go to the first fighter after `currentId` in roster order, so equal fighters alternate. */
export function nextByDelay<T extends DelayActor>(actors:readonly T[],currentId?:string):T|undefined {
 const start=Math.max(0,actors.findIndex(actor=>actor.id===currentId)+1);let best:T|undefined;
 for(let n=0;n<actors.length;n++){
  const actor=actors[(start+n)%actors.length];if(actor.hp<=0||actor.left)continue;
  if(!best||(actor.delay??0)<(best.delay??0))best=actor;
 }
 return best;
}
/** Opens `actor`'s turn: lowers every Delay by theirs (the chosen one reaches 0), then adds their base Delay once. */
export function startDelayTurn(actors:readonly DelayActor[],actor:DelayActor,base:number){
 const lowest=actor.delay??0;
 for(const other of actors)other.delay=(other.delay??0)-lowest;
 actor.delay=(actor.delay??0)+base;
}
/** Delay for the time used before firing, in whole seconds, capped at the turn length. */
export function timeDelay(spentMs:number){return Math.max(0,Math.min(TURN_SECONDS,Math.floor((Number.isFinite(spentMs)?spentMs:0)/1000)))*DELAY_PER_SECOND;}
