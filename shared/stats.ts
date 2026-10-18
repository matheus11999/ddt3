/**
 * Attribute math after the classic DDTank servers (docs/attributes.md): strengthening, Vida, Vigor,
 * Delay, damage mitigation and criticals. Pure numbers, no catalog, so the server, the client and
 * the tests all read one set of formulas.
 *
 * Verified sources: DDTank 3.0 Player.cs / Living.cs / TurnedLiving.cs / BaseGame.cs (Vida, Vigor,
 * Delay, mitigation) and DDTank 4.1 Living.cs (critical chance and bonus). Adaptations are marked.
 */
const finite=(value:number)=>Number.isFinite(value)?value:0;
const positive=(value:number)=>Math.max(0,finite(value));

// ── Strengthening (+0 to +15) ──
export const MAX_STRENGTHEN=15;
/** Every forge level multiplies the item's main attribute by 1.10 (+13 to +15 extend the classic table). */
export const STRENGTHEN_STEP=1.1;
export function strengthenLevel(level:number){return Number.isFinite(level)?Math.max(0,Math.min(MAX_STRENGTHEN,Math.floor(level))):0;}
export function strengthenMultiplier(level:number){return STRENGTHEN_STEP**strengthenLevel(level);}
/** Main attribute (weapon Dano, hat and outfit Armadura): always from the original value, rounded once at the end. */
export function strengthenedValue(base:number,level:number){return Math.round(finite(base)*strengthenMultiplier(level));}
/** Weapon Ataque/Defesa/Agilidade/Sorte: unchanged up to +9, ×1.2 (truncated) at +10, then ×1.3 (truncated) on that at +12.
 * Integer arithmetic, so 40 → 48 → 62 never loses a point to floating-point error. */
export function weaponMilestoneValue(base:number,level:number){
 const value=finite(base),at=strengthenLevel(level);if(at<10)return value;
 const at10=Math.trunc(value*12/10);return at<12?at10:Math.trunc(at10*13/10);
}

// ── Vida and Vigor ──
/** Extra Vida for every level past 10, 20 … 60 (DDTank 3.0 `LevelPlusBlood`). */
export function levelHpBonus(level:number){
 const grade=Number.isFinite(level)?Math.floor(level):1;let bonus=0;
 for(let step=10;step<=60;step+=10)if(grade>step)bonus+=(grade-step)*(step+20);
 return bonus;
}
/** (950 + Nível×50 + bônus de nível + Defesa/10) × multiplicador, truncated like the original `(int)`. */
export function maxHpFor(level:number,defense:number,multiplier=1){
 const grade=Number.isFinite(level)?Math.max(1,Math.floor(level)):1,scale=Number.isFinite(multiplier)&&multiplier>0?multiplier:1;
 return Math.max(1,Math.floor((950+grade*50+levelHpBonus(grade)+Math.floor(positive(defense)/10))*scale));
}
/** A new maximum keeps the current Vida (never above the maximum, never below zero). */
export function clampHp(hp:number,maxHp:number){return Math.max(0,Math.min(Math.max(0,finite(maxHp)),finite(hp)));}
export function maxStaminaFor(agility:number){return 240+Math.floor(positive(agility)/30);}

// ── Delay ──
/** Delay a fighter adds each time their turn starts: 1600 − 1200×Agi/(Agi+1200) + Ataque/10, with the original integer divisions. */
export function baseDelay(agility:number,attack:number){
 const agi=Math.floor(positive(agility)),atk=Math.floor(positive(attack));
 return 1600-Math.floor(1200*agi/(agi+1200))+Math.floor(atk/10);
}
/** Delay for the seconds spent before firing (DDTank `PrepareShoot`: time × 20, capped at the turn length). */
export const DELAY_PER_SECOND=20;
/** Delay for passing the turn (DDTank 3.0 `Skip`). */
export const PASS_DELAY=100;

// ── Damage ──
export function attackMultiplier(attack:number){return 1+positive(attack)/1000;}
/** Armadura: 0.95 × A / (500 + A) with A = Armadura − 3 × attacker level. Safety adaptation: A never goes below 0. */
export function armorReduction(armor:number,attackerLevel:number){const value=Math.max(0,finite(armor)-3*positive(attackerLevel));return .95*value/(500+value);}
/** Defesa: 0.95 × D / (600 + D) with D = Defesa − attacker Sorte, never below 0. */
export function defenseReduction(defense:number,attackerLuck:number){const value=Math.max(0,finite(defense)-positive(attackerLuck));return .95*value/(600+value);}
/** The two protections combine multiplicatively: 30% and 20% make 44%, not 50%. */
export function combinedReduction(defense:number,armor:number){return 1-(1-defense)*(1-armor);}

// ── Criticals (DDTank 4.1) ──
/** Chance in percent: 45 × Sorte / (800 + Sorte), plus any separate bonus. */
export function criticalChancePercent(luck:number,bonus=0){const value=positive(luck);return 45*value/(800+value)+finite(bonus);}
/** `normalized`: 0% never crits. `legacy`: the original `chance >= Random.Next(100)`, where 0% still crits on a roll of 0 (1 in 100). */
export type CriticalRollMode='normalized'|'legacy';
export const CRITICAL_ROLL_MODE:CriticalRollMode='normalized';
/** Extra damage of a critical, as a fraction of the damage it lands on: 0.5 + Sorte × 0.00015. */
export function criticalBonusMultiplier(luck:number){return .5+positive(luck)*.00015;}
