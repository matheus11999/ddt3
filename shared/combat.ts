import {attributes} from './catalog';
import type {Equipment} from './catalog';

export interface DamageModifiers {attenuation?:number;shotMultiplier?:number;boostMultiplier?:number;}
/** Brasa's own balance: base damage and attack versus defense and armor.
 * Both protections have diminishing returns. No critical roll or client outcome.
 */
export function damageAtImpact(attacker:Equipment,defender:Equipment,{attenuation=1,shotMultiplier=1,boostMultiplier=1}:DamageModifiers={}) {
 const offense=attributes(attacker),protection=attributes(defender);
 const falloff=Math.max(0,Math.min(1,Number.isFinite(attenuation)?attenuation:0));
 if(falloff===0||shotMultiplier<=0||boostMultiplier<=0||offense.damage===0)return 0;
 const raw=offense.damage*(1+offense.attack/500)
  /(1+protection.defense/1000)/(1+protection.armor/600)
  *falloff*shotMultiplier*boostMultiplier;
 return Number.isFinite(raw)?Math.max(1,Math.round(raw)):0;
}
