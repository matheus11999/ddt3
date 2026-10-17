import {randomInt,randomUUID} from 'node:crypto';
import {attributes,DEFAULT_EQUIPMENT} from '../shared/catalog';
import type {Weapon} from '../shared/catalog';
import {expeditionStages,isMonsterKind,MONSTERS,partyHpScale} from '../shared/expeditions';
import type {Difficulty,MonsterKind,StageDef} from '../shared/expeditions';
import {stageIntroMs} from '../shared/instanceTurn';
import {getMap} from '../shared/maps';
import type {MapId} from '../shared/maps';
import {ground,trajectory,WORLD} from '../shared/physics';
import type {BattleInstance,Fighter,Seat} from '../shared/protocol';
import type {CardPrize} from '../shared/rewards';

/** The queen's arrow flies like a light, fast projectile; it hurts but does not dig. */
export const ARROW:Weapon={id:'brick',name:'Flecha da Rainha',slot:'weapon',rarity:'common',color:'#ffb347',description:'',attack:0,defense:0,agility:0,luck:0,damage:0,crater:0,blast:70,gravity:300,projectileRadius:6,effect:'brick',minAngle:-40,maxAngle:80} as Weapon;

export function monsterFighter(kind:MonsterKind,x:number,y:number,level:number,players:number,slot:number,facing:1|-1):Fighter{
 const def=MONSTERS[kind],hp=Math.round(def.hp*partyHpScale(players));
 return {id:`mob-${randomUUID()}`,name:def.name,level,equipment:{...DEFAULT_EQUIPMENT},ready:true,bot:true,team:1,slot,connected:true,x,y,hp,maxHp:hp,stamina:0,maxStamina:0,facing,boosts:[],monster:kind,hitRadius:def.hitRadius,hitHeight:def.hitHeight};
}

export interface StageSetup {map:MapId;fighters:Fighter[];order:string[];instance:BattleInstance;stage:StageDef;}
/** A stage's opening: the party on the map's spawns at full health, the monsters where the map places them. */
export function setupStage(seats:readonly Seat[],expedition:string,difficulty:Difficulty,stageIndex:number,terrain:Uint8Array,now=Date.now()):StageSetup{
 const stages=expeditionStages(expedition,difficulty),stage=stages[stageIndex],map=stage.map as MapId,def=getMap(map),width=def.dimensions.width;
 const players:Fighter[]=seats.map((s,index)=>{const stats=attributes(s.equipment),x=def.spawns[0][s.slot]??def.spawns[0][index%def.spawns[0].length];
  return {...s,team:0,equipment:structuredClone(s.equipment),x,y:ground(terrain,x),hp:stats.hp,maxHp:stats.hp,stamina:stats.stamina,maxStamina:stats.stamina,facing:x<width/2?1:-1,boosts:[],powerCharge:0,powerArmed:false,homingArmed:false,flightArmed:false,invisibleTurns:0};});
 const level=Math.max(1,Math.round(players.reduce((n,p)=>n+p.level,0)/Math.max(1,players.length)));
 const monsters:Fighter[]=[];let boss:string|undefined,nest:{x:number;y:number}|undefined;
 for(const placement of def.monsters??[]){
  const y=placement.y??ground(terrain,placement.x);
  if(placement.kind==='nest'){nest={x:placement.x,y};continue;}
  if(!isMonsterKind(placement.kind))continue;
  const centre=players.reduce((n,p)=>n+p.x,0)/Math.max(1,players.length);
  const monster=monsterFighter(placement.kind,placement.x,placement.y??ground(terrain,placement.x),level,players.length,monsters.length,centre>=placement.x?1:-1);
  if(MONSTERS[placement.kind].behavior==='queen')boss=monster.id;monsters.push(monster);
 }
 const order=[...players].sort((a,b)=>attributes(b.equipment).agility-attributes(a.equipment).agility).map(p=>p.id);
 return {map,stage,fighters:[...players,...monsters],order,instance:{expedition,difficulty,stage:stageIndex+1,stageCount:stages.length,stageName:stage.name,round:1,introUntil:now+stageIntroMs(stageIndex),...(boss?{boss}:{}),...(nest?{nest}:{})}};
}

export function stageDeck(stage:StageDef):CardPrize[]{return Array.from({length:stage.cards},()=>({...stage.prizes[randomInt(stage.prizes.length)]}));}

/**
 * The queen aims at an adventurer (lowest health first, ties at random) with a bounded search, then
 * misses a little on purpose: on Fácil she is a threat, not a sniper.
 */
export function queenAim(terrain:Uint8Array,queen:Fighter,targets:readonly Fighter[],wind:number,error=5){
 const living=targets.filter(t=>t.hp>0&&!t.left&&!(t.invisibleTurns??0));if(!living.length)return null;
 const lowest=Math.min(...living.map(t=>t.hp)),pool=living.filter(t=>t.hp<=lowest*1.35),target=pool[randomInt(pool.length)];
 const facing:1|-1=target.x>=queen.x?1:-1,origin={x:queen.x,y:queen.y-(queen.hitHeight??60)+10,facing};
 let best={score:Infinity,angle:30,power:60};
 for(let angle=-35;angle<=75;angle+=5)for(let power=20;power<=100;power+=4){const r=trajectory(terrain,origin,angle,power,wind,ARROW,[target]);const score=r.hitId===target.id?0:Math.hypot(r.x-target.x,r.y-(target.y-30));if(score<best.score)best={score,angle,power};}
 const power=Math.max(10,Math.min(100,best.power+(Math.random()*2-1)*error));
 return {target,facing,origin,angle:best.angle,power};
}

export const fellOff=(f:{y:number})=>f.y>WORLD.height;
