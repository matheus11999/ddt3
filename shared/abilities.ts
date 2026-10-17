export const ABILITY_IDS=['heal','homing','invisibility'] as const;
export type AbilityId=typeof ABILITY_IDS[number];
export type AbilityLoadout=[AbilityId|null,AbilityId|null,AbilityId|null];
export const DEFAULT_ABILITY_LOADOUT=['heal','homing','invisibility'] as const;
/** Old profiles gain the default kit. Explicit empty slots stay empty on every
 * later read; malformed saved entries are removed rather than replenished. */
export function normalizeAbilityLoadout(value:unknown):AbilityLoadout {
 if(!Array.isArray(value))return [...DEFAULT_ABILITY_LOADOUT];
 const seen=new Set<AbilityId>();return Array.from({length:3},(_,index)=>{const ability=value[index];if(!ABILITY_IDS.includes(ability)||seen.has(ability))return null;seen.add(ability);return ability;}) as AbilityLoadout;
}
export const HEAL_AMOUNT=300;
export const HOMING_RADIUS=100;
export const HOMING_TURN_RATE=1.8;
export const INVISIBILITY_TURNS=3;
export const HIDDEN_POSITION=-10000;
export const ABILITIES:readonly {id:AbilityId;name:string;detail:string;uses:number;cost:number}[]=[
 {id:'heal',name:'Cura',detail:'Recupera até 300 de vida. Uma vez por partida.',uses:1,cost:0},
 {id:'homing',name:'Mira assistida',detail:'O primeiro projétil curva na descida ao passar a até 100 de um inimigo. Uma vez por partida.',uses:1,cost:0},
 {id:'invisibility',name:'Invisibilidade',detail:'Oculta sua posição dos inimigos por três turnos próprios completos. Uma vez por partida.',uses:1,cost:0}
];
export function initialAbilities(loadout?:unknown):Record<AbilityId,number>{const slots=normalizeAbilityLoadout(loadout);return {heal:slots.includes('heal')?1:0,homing:slots.includes('homing')?1:0,invisibility:slots.includes('invisibility')?1:0};}
export interface AbilityEffect {playerId:string;ability:AbilityId|'flight';x:number;y:number;amount?:number;at:number;hidden?:boolean;}
