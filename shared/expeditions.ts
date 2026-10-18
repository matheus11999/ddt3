import type {CardPrize} from './rewards';

/**
 * Expedition Center (Central de Expedições): co-op dungeons played in rooms like the PvP hall.
 * Each expedition has four difficulties; only Fácil is open for now. Each stage is an instance map
 * (kind 'instance' in the admin map editor) whose layout places the monsters (`monsters`).
 * Combat rules of the instance turn live in shared/instanceTurn.ts.
 */
export const DIFFICULTIES=['easy','normal','hard','hero'] as const;
export type Difficulty=typeof DIFFICULTIES[number];
export const DIFFICULTY_NAMES:Record<Difficulty,string>={easy:'Fácil',normal:'Normal',hard:'Difícil',hero:'Herói'};

export const MONSTER_KINDS=['ant-worker','ant-soldier','ant-brute','ant-queen'] as const;
export type MonsterKind=typeof MONSTER_KINDS[number];
/** Map markers that are not creatures: where the queen's ants come out. */
export const MARKER_KINDS=['nest'] as const;
export type MarkerKind=typeof MARKER_KINDS[number];
/** A monster or marker placed on an instance map (layout `monsters`). Without `y` it stands on the ground under x. */
export interface MonsterPlacement {kind:MonsterKind|MarkerKind;x:number;y?:number;}

export interface MonsterSprite {
 /** 4-frame strip cut from a 2x2 sheet by scripts/cut-monster-sheet.mjs: walk A, walk B, wind-up, bite (queen: idle, draw, release, hurt). */
 src:string;
 /** Drawn height of the creature in world px and where its feet sit in the cell (0-1 from the top). */
 height:number;feet:number;
 /** Direction the painting faces. */
 faces:1|-1;
 /** Melee ants: a 4-frame walk cycle (same cell size and baseline as `src`), stepped by the distance walked, one cycle every `cycle` px. */
 walk?:{src:string;cycle:number};
}
export interface MonsterDef {
 kind:MonsterKind;name:string;
 hp:number;
 /** Damage before the target's defense and armor. */
 attack:number;
 /** Incoming damage is divided by this. */
 toughness:number;
 /** Distance (feet to feet) from which a melee monster bites. */
 reach:number;
 /** How far a melee monster walks per monster turn. */
 stride:number;
 hitRadius:number;hitHeight:number;
 behavior:'melee'|'queen';
 sprite:MonsterSprite;
 /** Ranged monsters: where the projectile leaves (the bow), in world px ahead of and above the feet. */
 muzzle?:{forward:number;up:number};
 /** Where speech bubbles point (the mouth), in world px ahead of and above the feet. */
 mouth?:{forward:number;up:number};
}
export const MONSTERS:Record<MonsterKind,MonsterDef>={
 'ant-worker':{kind:'ant-worker',name:'Formiga Operária',hp:450,attack:120,toughness:1,reach:84,stride:175,hitRadius:36,hitHeight:48,behavior:'melee',
  sprite:{walk:{src:'/assets/expeditions/anthill/ant-worker-walk.png',cycle:56},src:'/assets/expeditions/anthill/ant-worker.png',height:108,feet:.97,faces:1}},
 'ant-soldier':{kind:'ant-soldier',name:'Formiga Soldado',hp:750,attack:170,toughness:1.1,reach:92,stride:115,hitRadius:44,hitHeight:58,behavior:'melee',
  sprite:{walk:{src:'/assets/expeditions/anthill/ant-soldier-walk.png',cycle:60},src:'/assets/expeditions/anthill/ant-soldier.png',height:128,feet:.97,faces:1}},
 'ant-brute':{kind:'ant-brute',name:'Formiga Guerreira',hp:1200,attack:240,toughness:1.25,reach:104,stride:65,hitRadius:54,hitHeight:74,behavior:'melee',
  sprite:{walk:{src:'/assets/expeditions/anthill/ant-brute-walk.png',cycle:48},src:'/assets/expeditions/anthill/ant-brute.png',height:156,feet:.97,faces:1}},
 'ant-queen':{kind:'ant-queen',name:'Rainha Formiga',hp:5200,attack:260,toughness:1.2,reach:0,stride:0,hitRadius:70,hitHeight:170,behavior:'queen',muzzle:{forward:85,up:128},mouth:{forward:8,up:148},
  sprite:{src:'/assets/expeditions/anthill/ant-queen.png',height:260,feet:.98,faces:-1}},
};
export const isMonsterKind=(kind:string):kind is MonsterKind=>(MONSTER_KINDS as readonly string[]).includes(kind);

export interface StageDef {
 /** Instance map (shared/maps.ts) with the monster placements. */
 map:string;name:string;
 /** Portrait card for the room's board once this stage is chosen (scripts/compose-expedition-cover.py). */
 art:string;
 /** Goal shown under the minimap (stages without a boss count the monsters down); a boss stage reads "Derrotar a <boss>". */
 objective?:string;
 /** Number of reward cards on the table and what they hold. */
 cards:number;prizes:readonly CardPrize[];
 /** Fixed award for clearing the stage, before the card. */
 award:{coins:number;xp:number};
 /** Queen stages: the boss falling ends the stage; she summons ants every `summonEvery` monster turns, up to `summonLimit` alive. */
 boss?:{summonEvery:number;summonCount:number;summonLimit:number;summonKinds:readonly MonsterKind[];
  /** Opening scene: the boss speaks these lines (one speech bubble each), then `openingSummons` ants leave the nest toward the party. */
  taunts?:readonly string[];openingSummons?:number};
}
export interface ExpeditionDef {
 id:string;name:string;subtitle:string;description:string;cover:string;minLevel:number;
 /** Wide art at the top of the expedition window (scripts/compose-expedition-cover.py). */
 art:string;
 /** Portrait art on the room's board once the expedition is chosen, the same for every stage. */
 board:string;
 /** Items listed under "Chances de drop" (more slots stay empty for future drops). */
 drops:readonly {kind:'stone';level:number}[];
 /** Power (gearscore) the team should have, per difficulty. */
 recommendedPower:Record<Difficulty,number>;
 /** Stages per difficulty; a difficulty without stages is shown locked ("Em breve"). */
 stages:Partial<Record<Difficulty,readonly StageDef[]>>;
}
export const EXPEDITIONS:readonly ExpeditionDef[]=[
 {id:'anthill',name:'Formigueiro',subtitle:'Tronco caído e a câmara da rainha',cover:'/assets/expeditions/anthill/cover.webp',minLevel:1,
  art:'/assets/expeditions/anthill/picker-art.webp',board:'/assets/expeditions/anthill/board.webp',drops:[{kind:'stone',level:1}],recommendedPower:{easy:3000,normal:6000,hard:12000,hero:20000},
  description:'Formigas cercam o tronco caído. Derrote todas e enfrente a Rainha Formiga dentro do formigueiro.',
  stages:{easy:[
   {map:'anthill-1',name:'O tronco caído',art:'/assets/expeditions/anthill/stage-1.webp',objective:'Derrotar todas as formigas',cards:4,award:{coins:20,xp:40},prizes:[
    {kind:'coins',amount:30},{kind:'coins',amount:50},{kind:'coins',amount:70},{kind:'xp',amount:40},{kind:'xp',amount:60},{kind:'stone',amount:1,level:1},{kind:'ticket',amount:1}]},
   {map:'anthill-2',name:'A câmara da rainha',art:'/assets/expeditions/anthill/stage-2.webp',cards:8,award:{coins:60,xp:120},boss:{summonEvery:2,summonCount:2,summonLimit:5,summonKinds:['ant-worker','ant-soldier'],taunts:['Peguem esses invasores!!!','Não deixem ninguém sobreviver!'],openingSummons:2},prizes:[
    {kind:'coins',amount:100},{kind:'coins',amount:150},{kind:'coins',amount:250},{kind:'xp',amount:120},{kind:'xp',amount:200},
    {kind:'stone',amount:2,level:1},{kind:'stone',amount:1,level:2},{kind:'stone',amount:1,level:3},{kind:'ticket',amount:1},{kind:'ticket',amount:2}]},
  ]}},
];
export function getExpedition(id:string){return EXPEDITIONS.find(expedition=>expedition.id===id);}
export function expeditionStages(id:string,difficulty:Difficulty):readonly StageDef[]{return getExpedition(id)?.stages[difficulty]??[];}
/** Chance (0–1) that one reward card of the stage holds this item. */
export function dropChance(stage:StageDef,drop:{kind:string;level?:number}){return stage.prizes.length?stage.prizes.filter(prize=>prize.kind===drop.kind&&(prize.level??1)===(drop.level??1)).length/stage.prizes.length:0;}
/** Monster HP grows with the party: a full team of four fights 1.9x tougher monsters than one adventurer. */
export function partyHpScale(players:number){return .6+.325*Math.max(1,Math.min(4,players));}
