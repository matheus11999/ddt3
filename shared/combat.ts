import {attributes} from './catalog';
import type {BoostId,Equipment} from './catalog';
import type {HitKind} from './protocol';
import {powerUpShot} from './powerUps';
import {armorReduction,attackMultiplier,combinedReduction,CRITICAL_ROLL_MODE,criticalBonusMultiplier,criticalChancePercent,defenseReduction} from './stats';
import type {CriticalRollMode} from './stats';

/** Gap between consecutive launches of one turn (+1/+2 shots); 570 ms until 20/10, when matheus asked for 0.5 s more. */
export const VOLLEY_CADENCE_MS=1070;
/** Pause after the last impact, damage number or fall of a shot before the next turn opens and the camera moves. */
export const TURN_GAP_MS=1200;
export const SPLASH_RADIUS_SCALE=.60;
export const SPLASH_MAX_MULTIPLIER=.82;
/** Splash keeps its own body circle (radius 22, centred 31 px above the feet), separate from the player hit
 * box of shared/physics.ts: adopting the DDTank collision box did not change the splash rule (docs/hitbox-aim.md). */
export const SPLASH_BODY={radius:22,height:31} as const;
/** Chance of a critical as a probability (0–1): 45 × Sorte / (800 + Sorte) percent (DDTank 4.1). */
export function criticalChance(luck:number){return criticalChancePercent(luck)/100;}
/** The server supplies the roll, uniform in [0, 1). No outcome is inferred from client animation.
 * `legacy` reproduces the original integer draw `chance >= Random.Next(100)`. */
export function criticalFromRoll(luck:number,roll:number,mode:CriticalRollMode=CRITICAL_ROLL_MODE){
 if(!Number.isFinite(roll)||roll<0||roll>=1)return false;
 return mode==='legacy'?criticalChancePercent(luck)>=Math.floor(roll*100):roll<criticalChance(luck);
}
/** Shot shape and damage factors from the turn's power-ups (shared/powerUps.ts): consecutive volleys, the
 * Tridente spread, the shot-mode penalty per projectile and the additive percentage bonus. */
export function shotModifiers(boosts:readonly BoostId[]){
 const shot=powerUpShot(boosts);
 return {volleys:shot.sequentialShots,spread:shot.spread,projectileMultiplier:shot.modeMultiplier,damageMultiplier:shot.bonusMultiplier};
}
/** A direct contact brings its quality from the collision (path line through the player box or the
 * monster circle, shared/physics.ts); surface distance cannot distinguish a graze. */
export function impactExposure(target:{id:string;x:number;y:number;hitRadius?:number;hitHeight?:number},impact:{x:number;y:number;hitId?:string;hitQuality?:number},blast:number):{kind:HitKind;quality:number;attenuation:number}{
 if(impact.hitId===target.id){const quality=Math.max(0,Math.min(1,impact.hitQuality??0)),direct=quality>=.65;return {kind:direct?'direct':'graze',quality,attenuation:.84+.16*quality};}
 const distance=Math.max(0,Math.hypot(target.x-impact.x,target.y-(target.hitHeight??SPLASH_BODY.height)-impact.y)-(target.hitRadius??SPLASH_BODY.radius)),radius=Math.max(0,blast*SPLASH_RADIUS_SCALE),quality=radius>0&&distance<radius-1e-7?Math.max(0,1-distance/radius):0;
 return {kind:'splash',quality,attenuation:SPLASH_MAX_MULTIPLIER*(1-(1-quality)**1.5)};
}
export interface DamageModifiers {attenuation?:number;shotMultiplier?:number;boostMultiplier?:number;critical?:boolean;/** The attacker's character level: Armadura loses 3 points per level (DDTank 3.0). */attackerLevel?:number;}
/** Offense after the attacker's Ataque, reduced by the defender's Defesa (weakened by the attacker's Sorte) and Armadura. */
function mitigated(damage:number,attack:number,attackerLuck:number,attackerLevel:number,defender:{defense:number;armor:number}){
 return damage*attackMultiplier(attack)*(1-combinedReduction(defenseReduction(defender.defense,attackerLuck),armorReduction(defender.armor,attackerLevel)));
}
/**
 * One shot's damage on one target (docs/attributes.md): Dano × (1 + Ataque/1000), then Defesa and Armadura
 * combined multiplicatively, then blast falloff, shot and boost modifiers; a critical adds (0.5 + Sorte × 0.00015)
 * of that damage. Rounded once at the end. No critical roll or client outcome here.
 */
export function damageAtImpact(attacker:Equipment,defender:Equipment,{attenuation=1,shotMultiplier=1,boostMultiplier=1,critical=false,attackerLevel=1}:DamageModifiers={}) {
 const offense=attributes(attacker),protection=attributes(defender);
 const falloff=Math.max(0,Math.min(1,Number.isFinite(attenuation)?attenuation:0));
 if(falloff===0||!(shotMultiplier>0)||!(boostMultiplier>0)||offense.damage<=0)return 0;
 const landed=mitigated(offense.damage,offense.attack,offense.luck,attackerLevel,protection)*falloff*shotMultiplier*boostMultiplier;
 const raw=landed*(critical?1+criticalBonusMultiplier(offense.luck):1);
 // A barely touched blast edge can contribute less than half a health point.
 // Round once; forcing a minimum of one also turns floating-point residue at
 // the exact radius into a hit and incorrectly feeds Power on distant targets.
 return Number.isFinite(raw)?Math.max(0,Math.round(raw)):0;
}
/** A monster's hit on an adventurer: its attack is the base damage, against the same Defesa and Armadura as weapons. */
export function monsterDamage(attack:number,defender:Equipment,scale=1,monsterLevel=1){
 const raw=mitigated(attack,0,0,monsterLevel,attributes(defender))*scale;
 return Number.isFinite(raw)?Math.max(1,Math.round(raw)):0;
}

/** PvP turn cap: 20 turns per fighter, never under 80 (a 4×4 used to end in a draw after 10 turns each). */
export function pvpTurnLimit(fighters:number){return Math.max(80,20*fighters);}
/** At the turn cap the side with more life left wins (share of its total life); only an exact tie is a draw. */
export function turnLimitWinner<T extends number>(players:readonly {team:T;hp:number;maxHp:number}[]):T|null{
 const share=new Map<T,{hp:number;max:number}>();
 for(const p of players){const t=share.get(p.team)??{hp:0,max:0};t.hp+=Math.max(0,p.hp);t.max+=Math.max(0,p.maxHp);share.set(p.team,t);}
 let best:T|null=null,bestShare=-1,tie=false;
 for(const [team,t] of share){const value=t.max>0?t.hp/t.max:0;if(value>bestShare+1e-9){best=team;bestShare=value;tie=false;}else if(Math.abs(value-bestShare)<=1e-9)tie=true;}
 return tie||bestShare<=0?null:best;
}
