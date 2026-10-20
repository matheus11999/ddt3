import {CATALOG,STONES,WEAPONS,nextCopyKey} from './catalog';
import {COMPOSITION_STAT_NAMES,COMPOSITION_STATS,COMPOSITION_STONE_BY_ID,COMPOSITION_STONES} from './composition';

/** Síntese do ferreiro: 4 pedras de um nível viram 1 do nível seguinte, pagando ouro, sem falha. */
export const SYNTHESIS_INPUT=4;
/** Most syntheses one request may run at once ("Máx." in the forge). */
export const MAX_SYNTHESIS_COUNT=999;
/** Forge stones are `fortify-<level>`; composition stones keep their own ids (`attack-1`…). */
export function fortifyId(level:number):string {return `fortify-${level}`;}
export interface SynthesisStone {id:string;kind:'fortify'|'compose';/** Key in `Profile.stones` or `Profile.compositionStones`. */ key:string;level:number;name:string;}
export function synthesisStone(id:string):SynthesisStone|null {
 const fortify=/^fortify-(\d)$/.exec(id);
 if(fortify){const stone=STONES.find(s=>s.level===Number(fortify[1]));return stone?{id,kind:'fortify',key:String(stone.level),level:stone.level,name:stone.name}:null;}
 const stone=Object.hasOwn(COMPOSITION_STONE_BY_ID,id)?COMPOSITION_STONE_BY_ID[id]:undefined;
 return stone?{id,kind:'compose',key:id,level:stone.tier,name:stone.name}:null;
}
/**
 * Armas por fragmentos (pedido do matheus, 20/10): `count` Fragmentos pescados (Profile.fragments) mais ouro viram a arma,
 * que entra na mochila como item novo (ou cópia `id~2` quando já tem uma).
 */
export const WEAPON_FRAGMENT_RECIPES:readonly {weapon:string;count:number;cost:number}[]=[{weapon:'tide-rod',count:50,cost:5000}];
/** The synthesis id of a weapon's fragment (`frag-tide-rod`). */
export function fragmentId(weapon:string):string {return `frag-${weapon}`;}
/** The weapon a fragment id belongs to, when it is one. */
export function fragmentWeapon(id:string):string|null {const weapon=id.startsWith('frag-')?id.slice(5):'';return WEAPON_FRAGMENT_RECIPES.some(r=>r.weapon===weapon)?weapon:null;}
/** What a synthesis id shows in the table: a stone, a weapon fragment or the weapon it makes. */
export function synthesisName(id:string):string {
 const weapon=fragmentWeapon(id);if(weapon)return `Fragmento: ${CATALOG[weapon].name}`;
 if(WEAPONS.some(w=>w.id===id))return CATALOG[id].name;
 return synthesisStone(id)?.name??'';
}
/** One dropdown in the Síntese table. */
export interface SynthesisCategory {id:string;name:string;}
export interface SynthesisRecipe {/** Also the id sent by the client: the stone that is consumed. */ id:string;category:string;input:string;inputCount:number;result:string;/** Gold per synthesis. */ cost:number;}
/** Provisional gold prices by the level the stone reaches (matheus may tune them). */
export const FORTIFY_SYNTHESIS_COST:Record<number,number>={2:10,3:25,4:60,5:150};
export const COMPOSE_SYNTHESIS_COST:Record<number,number>={2:50,3:120};
export const SYNTHESIS_CATEGORIES:readonly SynthesisCategory[]=[
 {id:'weapons',name:'Armas por Fragmentos'},
 {id:'fortify',name:'Pedras de Fortalecimento'},
 ...COMPOSITION_STATS.map(stat=>({id:`compose-${stat}`,name:`Pedras de Composição · ${COMPOSITION_STAT_NAMES[stat]}`}))
];
export const SYNTHESIS_RECIPES:readonly SynthesisRecipe[]=[
 ...WEAPON_FRAGMENT_RECIPES.map(r=>({id:fragmentId(r.weapon),category:'weapons',input:fragmentId(r.weapon),inputCount:r.count,result:r.weapon,cost:r.cost})),
 ...STONES.slice(0,-1).map(s=>({id:fortifyId(s.level),category:'fortify',input:fortifyId(s.level),inputCount:SYNTHESIS_INPUT,result:fortifyId(s.level+1),cost:FORTIFY_SYNTHESIS_COST[s.level+1]})),
 ...COMPOSITION_STONES.filter(s=>COMPOSITION_STONE_BY_ID[`${s.stat}-${s.tier+1}`]).map(s=>({id:s.id,category:`compose-${s.stat}`,input:s.id,inputCount:SYNTHESIS_INPUT,result:`${s.stat}-${s.tier+1}`,cost:COMPOSE_SYNTHESIS_COST[s.tier+1]}))
];
export const SYNTHESIS_RECIPE_BY_ID:Readonly<Record<string,SynthesisRecipe>>=Object.fromEntries(SYNTHESIS_RECIPES.map(recipe=>[recipe.id,recipe]));
type Stock={gold:number;stones:Record<string,number>;compositionStones:Record<string,number>;fragments?:Record<string,number>;inventory?:string[];upgrades?:Record<string,number>};
export function stockOf(profile:Omit<Stock,'gold'>,id:string):number {const weapon=fragmentWeapon(id);if(weapon)return profile.fragments?.[weapon]??0;const stone=synthesisStone(id);return !stone?0:(stone.kind==='fortify'?profile.stones[stone.key]:profile.compositionStones[stone.key])??0;}
/** How many syntheses of a recipe the stock and gold allow right now. */
export function synthesisMax(profile:Stock,recipe:SynthesisRecipe):number {
 return Math.min(MAX_SYNTHESIS_COUNT,Math.floor(stockOf(profile,recipe.input)/recipe.inputCount),recipe.cost>0?Math.floor(profile.gold/recipe.cost):MAX_SYNTHESIS_COUNT);
}
/** Applies `count` syntheses to the profile (server-authoritative); throws a player-facing message when it cannot. */
export function synthesize(profile:Stock,id:string,count:number):{stone:string;target:string;count:number;consumed:number;cost:number} {
 const recipe=Object.hasOwn(SYNTHESIS_RECIPE_BY_ID,id)?SYNTHESIS_RECIPE_BY_ID[id]:undefined;
 if(!recipe)throw Error('Este material não pode ser sintetizado.');
 if(!Number.isInteger(count)||count<1||count>MAX_SYNTHESIS_COUNT)throw Error('Escolha quantas sínteses fazer.');
 const consumed=count*recipe.inputCount,cost=count*recipe.cost;
 if(stockOf(profile,recipe.input)<consumed)throw Error(recipe.category==='weapons'?`São necessários ${consumed} fragmentos para isso.`:`São necessárias ${consumed} pedras para isso.`);
 if(profile.gold<cost)throw Error('Ouro insuficiente para esta síntese.');
 const weapon=fragmentWeapon(recipe.input);
 if(weapon){
  if(!profile.fragments||!profile.inventory||!profile.upgrades)throw Error('Indisponível no momento.');
  profile.fragments[weapon]-=consumed;if(!profile.fragments[weapon])delete profile.fragments[weapon];
  // Like a shop purchase: the first copy keeps the id, later ones are `id~2`… at +0.
  for(let n=0;n<count;n++){const key=nextCopyKey(profile.inventory,weapon);profile.inventory.push(key);if(key!==weapon)profile.upgrades[key]=0;}
 }else{
  const add=(id:string,amount:number)=>{const stone=synthesisStone(id)!,bag=stone.kind==='fortify'?profile.stones:profile.compositionStones;bag[stone.key]=(bag[stone.key]??0)+amount;};
  add(recipe.input,-consumed);add(recipe.result,count);
 }
 profile.gold-=cost;
 return {stone:recipe.id,target:recipe.result,count,consumed,cost};
}
