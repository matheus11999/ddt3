import type {BoostId} from './catalog';

/**
 * Shot power-ups after classic DDTank (docs/power-ups.md). Pure numbers and rules: the server validates
 * every activation with them, the HUD greys out what they refuse, and damage reads `powerUpShot`.
 *
 * Final multiplier per impact = shot-mode multiplier × (1 + sum of the percentage bonuses).
 * The bonuses add (+50% and +20% make ×1.70, never ×1.80) and never change the character's attributes.
 */
export interface ShotMode {/** Consecutive shots in the turn (+1 → 2, +2 → 3). */ sequentialShots:number;/** Projectiles per shot (Tridente → 3, at once). */ projectilesPerShot:number;/** Damage of each projectile before the bonuses. */ multiplier:number;}
export const SHOT_MODES:Record<'extra1'|'extra2'|'trident',ShotMode>={
 extra1:{sequentialShots:2,projectilesPerShot:1,multiplier:.9},
 extra2:{sequentialShots:3,projectilesPerShot:1,multiplier:.6},
 trident:{sequentialShots:1,projectilesPerShot:3,multiplier:.5}
};
/** Percentage damage bonuses (+0.10 to +0.50). */
export const DAMAGE_BONUSES:Partial<Record<BoostId,number>>={damage50:.5,damage40:.4,damage30:.3,damage20:.2,damage10:.1};
/** Angle offsets of the Tridente's three projectiles (the project's existing spread). */
export const TRIDENT_SPREAD=[-9,0,9] as const;

/**
 * Combination matrix (configurable). +1 and +2 are one sequential mode: only one of them, once per turn
 * (+1 twice would be a cheaper +2). The Tridente is once per turn and, as the project already allowed,
 * combines with +1 or +2: every consecutive shot fires the three-way spread and the two penalties multiply
 * (+2 + Tridente = 9 projectiles at 0.60 × 0.50 = 0.30 each). Percentage bonuses repeat while Vigor lasts.
 */
export const POWER_UP_RULES={sequentialModesPerTurn:1,tridentWithSequential:true,repeatDamageBonuses:true};
const sequential=(id:BoostId)=>id==='extra1'||id==='extra2';

/** Why `id` cannot join the power-ups already chosen this turn, or undefined when it can. Vigor is checked apart. */
export function powerUpConflict(chosen:readonly BoostId[],id:BoostId):string|undefined {
 if(id==='trident'&&chosen.includes('trident'))return 'O tridente já foi usado neste turno.';
 if(sequential(id)&&chosen.filter(sequential).length>=POWER_UP_RULES.sequentialModesPerTurn)return chosen.includes(id)?`O ${id==='extra1'?'+1':'+2'} já foi usado neste turno.`:'+1 e +2 não combinam no mesmo turno.';
 if(!POWER_UP_RULES.tridentWithSequential&&(id==='trident'&&chosen.some(sequential)||sequential(id)&&chosen.includes('trident')))return 'O tridente não combina com +1 ou +2.';
 if(!POWER_UP_RULES.repeatDamageBonuses&&id in DAMAGE_BONUSES&&chosen.includes(id))return 'Este bônus já foi usado neste turno.';
 return undefined;
}
/** Total Vigor of a selection: the sum of each power-up's cost. */
export function powerUpCost(chosen:readonly BoostId[],costs:Readonly<Record<string,number>>){return chosen.reduce((sum,id)=>sum+(costs[id]??0),0);}

/** The temporary modifiers of one shot (or sequence). Nothing here touches the fighter's attributes. */
export interface PowerUpShot {sequentialShots:number;projectilesPerShot:number;spread:number[];modeMultiplier:number;bonus:number;bonusMultiplier:number;finalMultiplier:number;}
export function powerUpShot(boosts:readonly BoostId[]):PowerUpShot {
 const mode=boosts.find(sequential) as 'extra1'|'extra2'|undefined,trident=boosts.includes('trident');
 const sequentialShots=mode?SHOT_MODES[mode].sequentialShots:1,projectilesPerShot=trident?SHOT_MODES.trident.projectilesPerShot:1;
 const modeMultiplier=(mode?SHOT_MODES[mode].multiplier:1)*(trident?SHOT_MODES.trident.multiplier:1);
 const bonus=Math.round(boosts.reduce((sum,id)=>sum+(DAMAGE_BONUSES[id]??0),0)*100)/100,bonusMultiplier=1+bonus;
 return {sequentialShots,projectilesPerShot,spread:trident?[...TRIDENT_SPREAD]:[0],modeMultiplier,bonus,bonusMultiplier,finalMultiplier:modeMultiplier*bonusMultiplier};
}
