import {attributes} from './catalog';
import type {BoostId,Equipment} from './catalog';
import type {HitKind} from './protocol';
import {FIGHTER_HIT_RADIUS} from './physics';
import {armorReduction,attackMultiplier,combinedReduction,CRITICAL_ROLL_MODE,criticalBonusMultiplier,criticalChancePercent,defenseReduction} from './stats';
import type {CriticalRollMode} from './stats';

export const VOLLEY_CADENCE_MS=570;
/** Pause after the last impact, damage number or fall of a shot before the next turn opens and the camera moves. */
export const TURN_GAP_MS=1200;
export const SPLASH_RADIUS_SCALE=.60;
export const SPLASH_MAX_MULTIPLIER=.82;
/** Chance of a critical as a probability (0–1): 45 × Sorte / (800 + Sorte) percent (DDTank 4.1). */
export function criticalChance(luck:number){return criticalChancePercent(luck)/100;}
/** The server supplies the roll, uniform in [0, 1). No outcome is inferred from client animation.
 * `legacy` reproduces the original integer draw `chance >= Random.Next(100)`. */
export function criticalFromRoll(luck:number,roll:number,mode:CriticalRollMode=CRITICAL_ROLL_MODE){
 if(!Number.isFinite(roll)||roll<0||roll>=1)return false;
 return mode==='legacy'?criticalChancePercent(luck)>=Math.floor(roll*100):roll<criticalChance(luck);
}
export function shotModifiers(boosts:readonly BoostId[]){
 const volleys=1+boosts.reduce((count,id)=>count+(id==='extra1'?1:id==='extra2'?2:0),0),trident=boosts.includes('trident');
 return {volleys,spread:trident?[-9,0,9]:[0],projectileMultiplier:Math.min(1,1.8/volleys)*(trident?.5:1),damageMultiplier:1+boosts.reduce((n,id)=>n+(id.startsWith('damage')?Number(id.slice(6))/100:0),0)};
}
/** Approach quality is the penetration of the projectile's travel line through
 * the expanded fighter circle; surface distance cannot distinguish a graze. */
export function impactExposure(target:{id:string;x:number;y:number;hitRadius?:number;hitHeight?:number},impact:{x:number;y:number;hitId?:string;hitQuality?:number},blast:number):{kind:HitKind;quality:number;attenuation:number}{
 if(impact.hitId===target.id){const quality=Math.max(0,Math.min(1,impact.hitQuality??0)),direct=quality>=.65;return {kind:direct?'direct':'graze',quality,attenuation:.84+.16*quality};}
 const distance=Math.max(0,Math.hypot(target.x-impact.x,target.y-(target.hitHeight??31)-impact.y)-(target.hitRadius??FIGHTER_HIT_RADIUS)),radius=Math.max(0,blast*SPLASH_RADIUS_SCALE),quality=radius>0&&distance<radius-1e-7?Math.max(0,1-distance/radius):0;
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
