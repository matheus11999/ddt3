import type {Item} from './catalog';

export const COMPOSITION_STATS = ['attack','defense','agility','luck','armor'] as const;
export type CompositionStat = typeof COMPOSITION_STATS[number];
export type CompositionBonus = Partial<Record<CompositionStat,number>>;
export type Compositions = Record<string,CompositionBonus>;
export const COMPOSITION_STAT_NAMES:Record<CompositionStat,string> = {attack:'Ataque',defense:'Defesa',agility:'Agilidade',luck:'Sorte',armor:'Armadura'};
export interface CompositionStone {id:string;stat:CompositionStat;name:string;tier:number;value:number;chance:number;cost:number;color:string;}
const minerals:Record<CompositionStat,{name:string;color:string}> = {
 attack:{name:'Rubi da Fúria',color:'#f52c65'},defense:{name:'Safira Guardiã',color:'#168cff'},
 agility:{name:'Esmeralda do Vento',color:'#0cdf98'},luck:{name:'Topázio da Fortuna',color:'#ffb61c'},armor:{name:'Ametista de Aço',color:'#b36bff'}
};
export const COMPOSITION_STONES:CompositionStone[] = COMPOSITION_STATS.flatMap(stat=>[1,2,3].map(tier=>({
 id:`${stat}-${tier}`,stat,name:`${minerals[stat].name} ${['I','II','III'][tier-1]}`,tier,value:tier*10,
 chance:[100,60,30][tier-1],cost:[40,100,180][tier-1],color:minerals[stat].color
})));
export const COMPOSITION_STONE_BY_ID = Object.fromEntries(COMPOSITION_STONES.map(stone=>[stone.id,stone]));
export const STARTER_COMPOSITION_STONES:Record<string,number> = Object.fromEntries(COMPOSITION_STONES.map(stone=>[stone.id,4-stone.tier]));
/** Necklaces are never improved at the forge (matheus, 19/10). */
export function canCompose(item:Item|undefined):boolean {
 return !!item&&['weapon','hat','outfit','wristband','bracelet','ring'].includes(item.slot)&&item.visual?.variant!=='none';
}
/** Weapons never carry Armadura (matheus, 20/10), so the Ametista de Aço never goes on one. */
export function canComposeStat(item:Item|undefined,stat:CompositionStat):boolean {return canCompose(item)&&!(stat==='armor'&&item!.slot==='weapon');}
/** Only complete tiers survive persisted-data normalization; arbitrary client points never do. */
export function normalizeCompositions(value:unknown,items:readonly Item[]):Compositions {
 const result:Compositions={};
 if(!value||typeof value!=='object')return result;
 for(const item of items){
  if(!canCompose(item)||!Object.hasOwn(value,item.id))continue;
  const raw=(value as Record<string,unknown>)[item.id];if(!raw||typeof raw!=='object')continue;
  const bonus:CompositionBonus={};
  for(const stat of COMPOSITION_STATS){const amount=(raw as Record<string,unknown>)[stat];if((amount===10||amount===20||amount===30)&&canComposeStat(item,stat))bonus[stat]=amount;}
  if(Object.keys(bonus).length)result[item.id]=bonus;
 }
 return result;
}
