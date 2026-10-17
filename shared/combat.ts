import {attributes} from './catalog';
import type {BoostId,Equipment} from './catalog';
import type {HitKind} from './protocol';
import {FIGHTER_HIT_RADIUS} from './physics';

export const CRITICAL_MULTIPLIER=1.5;
export const CRITICAL_CHANCE_CAP=.30;
export const VOLLEY_CADENCE_MS=380;
export const SPLASH_RADIUS_SCALE=.60;
export const SPLASH_MAX_MULTIPLIER=.82;
export function criticalChance(luck:number){return Math.min(CRITICAL_CHANCE_CAP,(20+Math.max(0,Number.isFinite(luck)?luck:0))/1000);}
/** The server supplies the roll. No outcome is inferred from client animation. */
export function criticalFromRoll(luck:number,roll:number){return Number.isFinite(roll)&&roll>=0&&roll<criticalChance(luck);}
export function shotModifiers(boosts:readonly BoostId[]){
 const volleys=1+boosts.reduce((count,id)=>count+(id==='extra1'?1:id==='extra2'?2:0),0),trident=boosts.includes('trident');
 return {volleys,spread:trident?[-9,0,9]:[0],projectileMultiplier:Math.min(1,1.8/volleys)*(trident?.5:1),damageMultiplier:1+boosts.reduce((n,id)=>n+(id.startsWith('damage')?Number(id.slice(6))/100:0),0)};
}
/** Approach quality is the penetration of the projectile's travel line through
 * the expanded fighter circle; surface distance cannot distinguish a graze. */
export function impactExposure(target:{id:string;x:number;y:number},impact:{x:number;y:number;hitId?:string;hitQuality?:number},blast:number):{kind:HitKind;quality:number;attenuation:number}{
 if(impact.hitId===target.id){const quality=Math.max(0,Math.min(1,impact.hitQuality??0)),direct=quality>=.65;return {kind:direct?'direct':'graze',quality,attenuation:.84+.16*quality};}
 const distance=Math.max(0,Math.hypot(target.x-impact.x,target.y-31-impact.y)-FIGHTER_HIT_RADIUS),radius=Math.max(0,blast*SPLASH_RADIUS_SCALE),quality=radius>0&&distance<radius-1e-7?Math.max(0,1-distance/radius):0;
 return {kind:'splash',quality,attenuation:SPLASH_MAX_MULTIPLIER*(1-(1-quality)**1.5)};
}
export interface DamageModifiers {attenuation?:number;shotMultiplier?:number;boostMultiplier?:number;critical?:boolean;}
/** Brasa's own balance: base damage and attack versus defense and armor.
 * Both protections have diminishing returns. No critical roll or client outcome.
 */
export function damageAtImpact(attacker:Equipment,defender:Equipment,{attenuation=1,shotMultiplier=1,boostMultiplier=1,critical=false}:DamageModifiers={}) {
 const offense=attributes(attacker),protection=attributes(defender);
 const falloff=Math.max(0,Math.min(1,Number.isFinite(attenuation)?attenuation:0));
 if(falloff===0||shotMultiplier<=0||boostMultiplier<=0||offense.damage===0)return 0;
 const raw=offense.damage*(1+offense.attack/500)
  /(1+protection.defense/1000)/(1+protection.armor/600)
  *falloff*shotMultiplier*boostMultiplier*(critical?CRITICAL_MULTIPLIER:1);
 // A barely touched blast edge can contribute less than half a health point.
 // Round once; forcing a minimum of one also turns floating-point residue at
 // the exact radius into a hit and incorrectly feeds Power on distant targets.
 return Number.isFinite(raw)?Math.max(0,Math.round(raw)):0;
}
