import {TURN_GAP_MS} from './combat';
import {ground,walkPosition,WORLD} from './physics';
import {MONSTERS} from './expeditions';
import type {MonsterKind} from './expeditions';

/**
 * Instance turn (PvE): every living adventurer plays one turn per round, in agility order,
 * then the monsters act together in one shared turn (they have no turns of their own).
 * Pure and shared, so future dungeons and tests reuse it; the server (server/game.ts) runs it.
 */
export const MONSTER_TURN_ID='monsters';
/** Monster turn timeline: walking, then bites, then the queen's arrow and summons. */
export const MONSTER_MOVE_MS=1500,MONSTER_BITE_WINDUP_MS=320,MONSTER_ATTACK_MS=1900,MONSTER_TURN_END_MS=TURN_GAP_MS;
/** The queen draws her bow this long before the arrow leaves (her turn opens the monster turn). */
export const QUEEN_DRAW_MS=900;
/** Monsters walk in from the map sides when a stage opens; the first adventurer plays after it. */
export const INSTANCE_INTRO_MS=2600;
/** Later stages skip the walk-in: the monsters are already in place and only the stage title shows. */
export const STAGE_TITLE_MS=1600;
export const stageIntroMs=(stageIndex:number,taunts=0)=>taunts?bossOpening(taunts).end:stageIndex===0?INSTANCE_INTRO_MS:STAGE_TITLE_MS;
/**
 * Boss stage opening (ms from the stage start): the camera on the boss, one speech bubble per taunt,
 * then ants leave the nest and walk toward the party; the camera returns to the party before the first turn.
 */
export const TAUNT_MS=1900,OPENING_SUMMON_GAP_MS=350;
export function bossOpening(taunts:number){
 const speech=Array.from({length:taunts},(_,n)=>({from:800+n*TAUNT_MS,to:800+(n+1)*TAUNT_MS-120})),summonAt=800+taunts*TAUNT_MS,walkAt=summonAt+700;
 return {speech,summonAt,walkAt,end:walkAt+MONSTER_MOVE_MS+700};
}

export interface InstanceRound {round:number;acted:string[];}
export interface TurnActor {id:string;hp:number;team:0|1;left?:boolean;}

/** Who plays next: the first adventurer in `order` who is alive and has not acted this round, else the monsters. */
export function nextInstanceActor(order:readonly TurnActor[],round:InstanceRound):{kind:'player';id:string}|{kind:'monsters'}{
 const next=order.find(actor=>actor.team===0&&actor.hp>0&&!actor.left&&!round.acted.includes(actor.id));
 return next?{kind:'player',id:next.id}:{kind:'monsters'};
}

export interface MonsterBody {id:string;x:number;y:number;hp:number;team:0|1;monster?:MonsterKind;facing:1|-1;left?:boolean;}
export interface MonsterMove {id:string;from:[number,number];to:[number,number];facing:1|-1;}
export interface MonsterBite {id:string;targetId:string;}
export interface MonsterPlan {moves:MonsterMove[];bites:MonsterBite[];}
/** How much closer each extra ant beside the same adventurer stands. */
export const MONSTER_SPACING=56;
/** Each turn a monster walks 85%–115% of its stride (seeded by its id and spot), so ants of one kind drift apart. */
export function strideOf(monster:{id:string;x:number;monster?:MonsterKind}){
 let h=Math.round(monster.x)*2654435761;for(const ch of monster.id)h=Math.imul(h^ch.charCodeAt(0),16777619);
 return MONSTERS[monster.monster!].stride*(.85+((h>>>0)%1000)/1000*.3);
}

const feetGap=(a:{x:number},b:{x:number})=>Math.abs(a.x-b.x);

/**
 * Melee monsters: one already within reach of an adventurer bites this turn; the others walk
 * toward the nearest adventurer, up to their stride, stopping within reach (closer when others
 * already crowd that side), at a wall or at a ledge over the void. Arriving within reach does not bite until the next turn.
 */
export function planMonsterTurn(terrain:Uint8Array,bodies:readonly MonsterBody[]):MonsterPlan{
 const players=bodies.filter(body=>body.team===0&&body.hp>0&&!body.left);
 const monsters=bodies.filter(body=>body.team===1&&body.hp>0&&body.monster&&MONSTERS[body.monster].behavior==='melee');
 const plan:MonsterPlan={moves:[],bites:[]};if(!players.length)return plan;
 const placed=new Map(monsters.map(monster=>[monster.id,{x:monster.x,y:monster.y}]));
 // Closest to its target first, so the front of a column moves before the ones behind it.
 const targetOf=(monster:MonsterBody)=>players.reduce((best,player)=>feetGap(player,monster)<feetGap(best,monster)?player:best);
 for(const monster of [...monsters].sort((a,b)=>feetGap(targetOf(a),a)-feetGap(targetOf(b),b))){
  const def=MONSTERS[monster.monster!],target=targetOf(monster),direction:1|-1=target.x>=monster.x?1:-1;
  if(feetGap(target,monster)<=def.reach&&Math.abs(target.y-monster.y)<=90){plan.bites.push({id:monster.id,targetId:target.id});if(monster.facing!==direction)plan.moves.push({id:monster.id,from:[monster.x,monster.y],to:[monster.x,monster.y],facing:direction});continue;}
  // Ants crowd around their prey: each one ahead of it on this side makes it stop a little closer, so they all reach without standing on each other.
  const crowd=[...placed].filter(([id,other])=>id!==monster.id&&Math.sign(other.x-target.x)===-direction&&Math.abs(other.x-target.x)<feetGap(monster,target)).length;
  const stopAt=Math.max(def.reach*.35,def.reach*.7-MONSTER_SPACING*crowd);
  let at={x:monster.x,y:monster.y},walked=0;const stride=strideOf(monster);
  while(walked<stride){
   const next=walkPosition(terrain,at,direction);if(!next)break;
   if(next.y>WORLD.height-6||ground(terrain,next.x,Math.max(0,next.y-3))>WORLD.height)break;
   if(Math.abs(target.x-next.x)<stopAt)break;
   walked+=Math.abs(next.x-at.x);at=next;
  }
  // Never end on top of another monster: back off behind the nearest one (keeps the column readable).
  const ahead=[...placed].filter(([id,other])=>id!==monster.id&&Math.abs(other.y-at.y)<60&&(other.x-at.x)*direction>-MONSTER_SPACING&&(other.x-monster.x)*direction>0).map(([,other])=>other.x).sort((a,b)=>(a-b)*direction)[0];
  if(ahead!==undefined&&Math.abs(ahead-at.x)<MONSTER_SPACING){const x=ahead-direction*MONSTER_SPACING;if((x-monster.x)*direction>0){const y=ground(terrain,x,Math.max(0,at.y-30));if(y<=WORLD.height)at={x,y};}else at={x:monster.x,y:monster.y};}
  placed.set(monster.id,at);
  if(at.x!==monster.x||monster.facing!==direction)plan.moves.push({id:monster.id,from:[monster.x,monster.y],to:[at.x,at.y],facing:direction});
 }
 return plan;
}

/** Where a moving monster is drawn at `elapsed` ms into the monster turn (clients interpolate the same way). */
export function monsterStep(move:MonsterMove,elapsed:number):{x:number;y:number;moving:boolean}{
 // Eases in and out (half linear, half smoothstep) so ants start and stop instead of snapping to speed.
 const t=Math.max(0,Math.min(1,elapsed/MONSTER_MOVE_MS)),k=t*.5+t*t*(3-2*t)*.5,moving=t>0&&t<1&&(move.from[0]!==move.to[0]);
 return {x:move.from[0]+(move.to[0]-move.from[0])*k,y:move.from[1]+(move.to[1]-move.from[1])*k,moving};
}
