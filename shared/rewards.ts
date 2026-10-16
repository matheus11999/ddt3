/** Temporary economy values; every award is rolled and validated by the server. */
export const REWARD_CARD_COUNT=8;
export const REWARD_PICK_MS=15000;
export const CURRENCY_NAME='Moedas Brasa';
export interface CardPrize {kind:'coins'|'xp';amount:number;}
export const CARD_PRIZES:readonly CardPrize[]=[
 {kind:'coins',amount:40},{kind:'coins',amount:60},{kind:'coins',amount:80},
 {kind:'coins',amount:100},{kind:'coins',amount:150},{kind:'xp',amount:40},
 {kind:'xp',amount:60},{kind:'xp',amount:100}
];
export interface RewardCard {index:number;playerId?:string;prize?:CardPrize;automatic?:boolean;}
export interface BattleRewards {deadline:number;phase:'picking'|'revealed';saved:boolean;cards:RewardCard[];}
export type MatchBonuses=Record<string,CardPrize>;
