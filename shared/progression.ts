export const MAX_PLAYER_LEVEL=70;
export const XP_PER_LEVEL=300;
export function normalizeLevel(level:number){return Number.isFinite(level)?Math.max(1,Math.min(MAX_PLAYER_LEVEL,Math.floor(level))):1;}
export function levelForXp(xp:number){return normalizeLevel(1+Math.floor(Math.max(0,Number.isFinite(xp)?xp:0)/XP_PER_LEVEL));}
export function levelProgress(level:number,xp:number){
 const capped=normalizeLevel(level)===MAX_PLAYER_LEVEL;
 const current=capped?XP_PER_LEVEL:Math.max(0,Math.min(XP_PER_LEVEL,xp-(normalizeLevel(level)-1)*XP_PER_LEVEL));
 return {current,required:XP_PER_LEVEL,percent:capped?100:current/XP_PER_LEVEL*100,capped};
}
