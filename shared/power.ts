/**
 * POW (raiva) on the DDTank 4.1 scale: whole points 0–200, 200 = full bar (TurnedLiving.AddDander/SetDander).
 * Earned only by events: the end of the turn's launches (Player.Shoot), a pass (Player.Skip), damage taken
 * by a survivor (Player.TakeDamage) and Enfurecer (AttackUpSpell). Dealing damage earns nothing.
 */
export const POWER_MAX=200;
/** Player.Shoot: once, when the launch count of the turn reaches zero, if the shooter is alive. */
export const POWER_ATTACK_CHARGE=20;
/** Player.Skip: a pass (the turn timer running out on the client also sends the skip). */
export const POWER_PASS_CHARGE=40;
export const POWER_CUT_IN_MS=1400;
export const POWER_DAMAGE_MULTIPLIER=1.65;
export const POWER_BLAST_MULTIPLIER=1.15;
/** POW digs only a little more than a normal shot (matheus, 17/10/2026: it dug too much at 1.18). */
export const POWER_CRATER_MULTIPLIER=1.05;
/** Player.TakeDamage: (damageAmount × 2 / 5 + 5) / 2 in integer steps; damageAmount is the hit without its critical part. */
export function damageCharge(damageAmount:number){
 if(!Number.isFinite(damageAmount)||damageAmount<=0)return 0;
 return Math.floor((Math.floor(Math.floor(damageAmount)*2/5)+5)/2);
}
/** AddDander: a positive gain for a living fighter, the excess above 200 dropped. Returns the points actually added. */
export function addPower(f:{powerCharge?:number;hp:number},value:number){
 const current=Math.max(0,Math.min(POWER_MAX,Math.floor(f.powerCharge??0)));
 if(!(value>0)||f.hp<=0){f.powerCharge=current;return 0;}
 f.powerCharge=Math.min(POWER_MAX,current+Math.floor(value));return f.powerCharge-current;
}
/** Damage received: charges only a survivor and only for a hit that landed (rejected, healed or blocked hits give nothing). */
export function chargeOnDamage(f:{powerCharge?:number;hp:number},damageAmount:number){return addPower(f,damageCharge(damageAmount));}
export const powerFull=(charge:number|undefined)=>(charge??0)>=POWER_MAX;
/** The bar's fill in percent; never rounded up, so 199 never shows 100%. */
export const powerPercent=(charge:number|undefined)=>Math.max(0,Math.min(100,Math.floor((charge??0)*100/POWER_MAX)));
