/** Provisional Brasa balance. Charge uses effective enemy HP lost, never overkill. */
export const POWER_MAX=100;
export const POWER_CUT_IN_MS=1400;
export const POWER_DAMAGE_MULTIPLIER=1.65;
export const POWER_BLAST_MULTIPLIER=1.15;
/** POW digs only a little more than a normal shot (matheus, 17/10/2026: it dug too much at 1.18). */
export const POWER_CRATER_MULTIPLIER=1.05;
export function chargeFromDamage(current:number,damage:number,maxHp:number,receiving=false){
 if(!Number.isFinite(damage)||damage<=0||!Number.isFinite(maxHp)||maxHp<=0)return Math.max(0,Math.min(100,current||0));
 return Math.min(POWER_MAX,Math.max(0,current||0)+Math.min(damage,maxHp)/maxHp*(receiving?100:60));
}
