import {STONES} from './catalog';
import {COMPOSITION_STONE_BY_ID,COMPOSITION_STONES} from './composition';

/** Síntese do ferreiro: 4 pedras de um nível viram 1 do nível seguinte, sem custo e sem falha. */
export const SYNTHESIS_INPUT=4;
/** Most syntheses one request may run at once ("Máx." in the forge). */
export const MAX_SYNTHESIS_COUNT=999;
const MAX_FORTIFY=STONES[STONES.length-1].level,MAX_TIER=Math.max(...COMPOSITION_STONES.map(stone=>stone.tier));
/** Forge stones are `fortify-<level>`; composition stones keep their own ids (`attack-1`…). */
export function fortifyId(level:number):string {return `fortify-${level}`;}
export interface SynthesisStone {id:string;kind:'fortify'|'compose';/** Key in `Profile.stones` or `Profile.compositionStones`. */ key:string;level:number;}
export function synthesisStone(id:string):SynthesisStone|null {
 const fortify=/^fortify-(\d)$/.exec(id);
 if(fortify){const level=Number(fortify[1]);return STONES.some(s=>s.level===level)?{id,kind:'fortify',key:String(level),level}:null;}
 const stone=Object.hasOwn(COMPOSITION_STONE_BY_ID,id)?COMPOSITION_STONE_BY_ID[id]:undefined;
 return stone?{id,kind:'compose',key:id,level:stone.tier}:null;
}
/** The stone 4 of `id` become, or null when `id` is already the highest level. */
export function synthesisTarget(id:string):SynthesisStone|null {
 const stone=synthesisStone(id);if(!stone)return null;
 if(stone.kind==='fortify')return stone.level<MAX_FORTIFY?synthesisStone(fortifyId(stone.level+1)):null;
 return stone.level<MAX_TIER?synthesisStone(`${COMPOSITION_STONE_BY_ID[id].stat}-${stone.level+1}`):null;
}
/** Every stone that can be fused, in the order the forge lists them. */
export const SYNTHESIS_SOURCES:readonly string[]=[...STONES.map(s=>fortifyId(s.level)),...COMPOSITION_STONES.map(s=>s.id)].filter(id=>synthesisTarget(id));
type Stock={stones:Record<string,number>;compositionStones:Record<string,number>};
export function stockOf(profile:Stock,stone:SynthesisStone):number {return (stone.kind==='fortify'?profile.stones[stone.key]:profile.compositionStones[stone.key])??0;}
/** Applies `count` syntheses to the stock (server-authoritative); throws a player-facing message when it cannot. */
export function synthesize(profile:Stock,id:string,count:number):{stone:string;target:string;count:number;consumed:number} {
 const source=synthesisStone(id),target=synthesisTarget(id);
 if(!source||!target)throw Error('Esta pedra não pode ser sintetizada.');
 if(!Number.isInteger(count)||count<1||count>MAX_SYNTHESIS_COUNT)throw Error('Escolha quantas sínteses fazer.');
 const consumed=count*SYNTHESIS_INPUT;
 if(stockOf(profile,source)<consumed)throw Error(`São necessárias ${consumed} pedras para isso.`);
 const bag=(stone:SynthesisStone)=>stone.kind==='fortify'?profile.stones:profile.compositionStones;
 bag(source)[source.key]=stockOf(profile,source)-consumed;
 bag(target)[target.key]=stockOf(profile,target)+count;
 return {stone:source.id,target:target.id,count,consumed};
}
