import {z} from 'zod';
import {PET_CONFIG,PET_STAT_KEYS} from './petConfig';
import type {PetConfig,PetStatKey,PetStats,PetXpCurve} from './petConfig';
import {petSkill,skillLevel} from './petSkills';
/**
 * Pet domain (docs/pets.md): species definitions (PetDefinition), each player's pets (PlayerPet), the snapshot
 * the equipment carries into battle (PetSnapshot), progression and the bonus a pet grants. Pure functions: the
 * server, the client and the tests share them. No species is registered: the game starts with zero pets.
 */

// ── Qualities (extensible: register more, never an enum) ──
export interface PetQuality {id:string;name:string;/** Multiplies the species' base + growth. */multiplier:number;order:number;}
export const PET_QUALITIES=new Map<string,PetQuality>();
export function registerPetQuality(quality:PetQuality){if(PET_QUALITIES.has(quality.id))throw Error(`Qualidade repetida: ${quality.id}`);PET_QUALITIES.set(quality.id,quality);}
// The game's own rarity tiers (provisional multipliers).
for(const quality of [{id:'common',name:'Comum',multiplier:1,order:0},{id:'uncommon',name:'Normal',multiplier:1.1,order:1},{id:'rare',name:'Raro',multiplier:1.2,order:2},{id:'epic',name:'Épico',multiplier:1.35,order:3},{id:'legendary',name:'Lendário',multiplier:1.5,order:4}])registerPetQuality(quality);

// ── Species ──
const stats=z.partialRecord(z.enum(PET_STAT_KEYS),z.number().finite().min(-100000).max(100000));
const asset=z.string().regex(/^\/assets\/[a-z0-9/_.-]+$/).max(160);
/** Art contract of a species or stage; every field optional until the art exists. */
export const petVisualSchema=z.object({
 sprite:asset.optional(),atlas:asset.optional(),icon:asset.optional(),portrait:asset.optional(),
 animations:z.partialRecord(z.enum(['idle','skill','hit','walk','victory']),z.object({row:z.number().int().min(0),frames:z.number().int().min(1),fps:z.number().positive()}).strict()).optional(),
 sounds:z.partialRecord(z.enum(['skill','hit','idle']),asset).optional(),
 scale:z.number().positive().max(4).optional(),
 /** Where the pet stands relative to its owner (battle and plaza) and in the windows. */
 offset:z.object({x:z.number(),y:z.number()}).strict().optional(),
 ui:z.object({x:z.number(),y:z.number(),scale:z.number().positive()}).strict().optional()
}).strict();
export type PetVisual=z.infer<typeof petVisualSchema>;
export const petDefinitionSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),name:z.string().min(1).max(32),description:z.string().max(400).default(''),
 /** Off until the species is released: no one can receive it. */
 enabled:z.boolean().default(false),
 qualities:z.array(z.string()).min(1).default(['common']),
 maxLevel:z.number().int().min(1).optional(),
 maxStars:z.number().int().min(0).default(0),
 base:stats.default({}),
 /** Gained per level after the first. */
 growth:stats.default({}),
 /** Multiplier added per star (0.05 = +5% per star). */
 starBonus:z.number().min(0).max(2).default(0),
 /** Evolution stages: stage 0 is the starting form. Requirements are checked by the (future) evolution service. */
 stages:z.array(z.object({name:z.string().min(1).max(32),multiplier:z.number().positive().max(10).default(1),bonus:stats.default({}),
  requires:z.object({level:z.number().int().min(1).default(1),stars:z.number().int().min(0).default(0),items:z.record(z.string(),z.number().int().positive()).default({})}).strict().default({level:1,stars:0,items:{}}),
  visual:petVisualSchema.optional()}).strict()).min(1).default([{name:'Base',multiplier:1,bonus:{},requires:{level:1,stars:0,items:{}}}]),
 /** Caps on the final attributes (before vitality). */
 limits:stats.default({}),
 /** Skills this species can learn and when. */
 skills:z.array(z.object({skill:z.string(),level:z.number().int().min(1).default(1),stage:z.number().int().min(0).default(0),stars:z.number().int().min(0).default(0)}).strict()).default([]),
 /** Range of the individual trait rolled per attribute when a pet is obtained (0 = none). */
 traitRange:stats.default({}),
 /** Pet gear slots this species accepts (when gear opens). */
 gearSlots:z.array(z.string()).default([]),
 visual:petVisualSchema.default({})
}).strict();
export type PetDefinition=z.infer<typeof petDefinitionSchema>;
/** The species catalog. Empty on purpose. */
export const PET_SPECIES=new Map<string,PetDefinition>();
export function registerPetSpecies(raw:unknown):PetDefinition{
 const parsed=petDefinitionSchema.safeParse(raw);if(!parsed.success)throw Error(`Espécie de pet inválida: ${parsed.error.issues.map(i=>i.message).join('; ')}`);
 const def=parsed.data;if(PET_SPECIES.has(def.id))throw Error(`Espécie de pet repetida: ${def.id}`);
 for(const quality of def.qualities)if(!PET_QUALITIES.has(quality))throw Error(`${def.id}: qualidade desconhecida ${quality}.`);
 for(const entry of def.skills)if(!petSkill(entry.skill))throw Error(`${def.id}: habilidade desconhecida ${entry.skill}. Registre a habilidade antes da espécie.`);
 if(def.maxStars>PET_CONFIG.stars.max)throw Error(`${def.id}: estrelas acima do limite (${PET_CONFIG.stars.max}).`);
 PET_SPECIES.set(def.id,def);return def;
}
export function petSpecies(id:string){return PET_SPECIES.get(id);}

// ── Food (pet items) ──
export const petFoodSchema=z.object({
 id:z.string().regex(/^pet-food-[a-z0-9-]{1,32}$/),name:z.string().min(1).max(40),description:z.string().max(200).default(''),
 vitality:z.number().int().min(0).max(10000),xp:z.number().int().min(0).default(0),
 /** Only these species may eat it (empty = all). */
 species:z.array(z.string()).default([]),
 minLevel:z.number().int().min(1).default(1),
 /** Units one feeding may use, and per pet per day (Brasília). */
 maxPerUse:z.number().int().min(1).max(99).default(10),
 dailyLimit:z.number().int().min(1).optional(),
 icon:asset.optional()
}).strict().refine(food=>food.vitality>0||food.xp>0,'O alimento precisa recuperar vitalidade ou dar EXP.');
export type PetFood=z.infer<typeof petFoodSchema>;
/** Pet food catalog. Empty on purpose. */
export const PET_FOODS=new Map<string,PetFood>();
export function registerPetFood(raw:unknown){const parsed=petFoodSchema.safeParse(raw);if(!parsed.success)throw Error(`Alimento de pet inválido: ${parsed.error.issues.map(i=>i.message).join('; ')}`);if(PET_FOODS.has(parsed.data.id))throw Error(`Alimento repetido: ${parsed.data.id}`);PET_FOODS.set(parsed.data.id,parsed.data);return parsed.data;}

// ── Instances ──
export interface PetSkillEntry {id:string;level:number;}
/** One pet a player owns. Derived attributes are never stored: `petStats` recomputes them. */
export interface PlayerPet {id:string;ownerId:string;species:string;name:string;level:number;/** Total EXP ever earned (level comes from it). */xp:number;vitality:number;quality:string;stars:number;stage:number;
 /** Individual rolls, added after the multipliers. */traits:PetStats;knownSkills:PetSkillEntry[];/** One entry per skill slot (null = empty). */equippedSkills:(string|null)[];
 gear:Record<string,string|null>;equipped:boolean;locked:boolean;obtainedAt:string;source:string;evolution:{history?:{at:string;kind:string;from:number;to:number}[]};}
/** What the equipment carries about the active pet (into the room, the battle snapshot and the attribute sum). */
export interface PetSnapshot {id:string;species:string;level:number;quality:string;stars:number;stage:number;vitality:number;traits:PetStats;skills:PetSkillEntry[];}

const finite=(value:unknown,fallback=0)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
export function cleanStats(value:unknown):PetStats{
 if(!value||typeof value!=='object')return {};const out:PetStats={};
 for(const key of PET_STAT_KEYS){const n=finite((value as Record<string,unknown>)[key],NaN);if(Number.isFinite(n)&&n!==0)out[key]=Math.max(-100000,Math.min(100000,n));}
 return out;
}
/** Accepts only a well-formed snapshot (it comes back from the saved profile). */
export function normalizePetSnapshot(value:unknown):PetSnapshot|undefined{
 if(!value||typeof value!=='object')return undefined;const raw=value as Record<string,unknown>;
 if(typeof raw.id!=='string'||!/^[0-9a-f-]{36}$/i.test(raw.id)||typeof raw.species!=='string'||!/^[a-z][a-z0-9-]{1,39}$/.test(raw.species))return undefined;
 const int=(v:unknown,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Math.floor(finite(v,lo))));
 const skills=Array.isArray(raw.skills)?raw.skills.filter((s):s is {id:string;level:number}=>!!s&&typeof s==='object'&&typeof (s as {id:unknown}).id==='string').slice(0,8).map(s=>({id:s.id,level:int(s.level,1,20)})):[];
 return {id:raw.id,species:raw.species,level:int(raw.level,1,200),quality:typeof raw.quality==='string'?raw.quality:'common',stars:int(raw.stars,0,20),stage:int(raw.stage,0,20),vitality:int(raw.vitality,0,10000),traits:cleanStats(raw.traits),skills};
}

// ── Progression ──
export function petMaxLevel(def:PetDefinition|undefined,config:PetConfig=PET_CONFIG){return Math.min(config.progression.maxLevel,def?.maxLevel??config.progression.maxLevel);}
/** EXP needed to go from `level` to `level + 1`. */
export function xpToNext(level:number,curve:PetXpCurve=PET_CONFIG.progression.curve){
 const n=Math.max(1,Math.floor(level));
 if(curve.kind==='table')return curve.table[Math.min(curve.table.length-1,n-1)];
 return Math.max(1,Math.round(curve.base*curve.growth**(n-1)+curve.linear*(n-1)));
}
/** Total EXP at which a pet reaches `level`. */
export function xpForLevel(level:number,curve:PetXpCurve=PET_CONFIG.progression.curve){let total=0;for(let n=1;n<Math.floor(level);n++)total+=xpToNext(n,curve);return total;}
export function levelForPetXp(xp:number,maxLevel:number,curve:PetXpCurve=PET_CONFIG.progression.curve){let level=1,total=0;while(level<maxLevel){const step=xpToNext(level,curve);if(total+step>xp)break;total+=step;level++;}return level;}
export function petLevelProgress(pet:Pick<PlayerPet,'level'|'xp'|'species'>,config:PetConfig=PET_CONFIG){
 const max=petMaxLevel(petSpecies(pet.species),config),start=xpForLevel(pet.level,config.progression.curve);
 if(pet.level>=max)return {current:0,required:0,percent:100,capped:true};
 const required=xpToNext(pet.level,config.progression.curve),current=Math.max(0,pet.xp-start);return {current,required,percent:Math.min(100,current/required*100),capped:false};
}
export interface XpOutcome {gained:number;levelsGained:number;from:number;to:number;capped:boolean;unlockedSkills:string[];unlockedSlots:number[];}
/** Adds EXP (once validated by the caller): may climb several levels; at the cap the extra EXP is not kept. */
export function gainPetXp(pet:PlayerPet,amount:number,config:PetConfig=PET_CONFIG):XpOutcome{
 const def=petSpecies(pet.species),max=petMaxLevel(def,config),cap=xpForLevel(max,config.progression.curve),from=pet.level;
 const before=pet.xp,gain=Math.max(0,Math.floor(finite(amount)*config.progression.multiplier));
 pet.xp=Math.min(cap,pet.xp+gain);pet.level=levelForPetXp(pet.xp,max,config.progression.curve);
 const unlockedSkills=refreshKnownSkills(pet),unlockedSlots=config.skillSlots.map((slot,i)=>({slot,i})).filter(({slot})=>slot.unlockLevel>from&&slot.unlockLevel<=pet.level).map(({i})=>i);
 return {gained:pet.xp-before,levelsGained:pet.level-from,from,to:pet.level,capped:pet.level>=max,unlockedSkills,unlockedSlots};
}
/** Learns every species skill whose level, stage and stars are met. Never forgets one. */
export function refreshKnownSkills(pet:PlayerPet):string[]{
 const def=petSpecies(pet.species);if(!def)return [];const learned:string[]=[];
 for(const entry of def.skills){
  const skill=petSkill(entry.skill);if(!skill||pet.knownSkills.some(s=>s.id===entry.skill))continue;
  const need=skill.requirements;
  if(pet.level>=Math.max(entry.level,need.petLevel)&&pet.stage>=Math.max(entry.stage,need.stage)&&pet.stars>=Math.max(entry.stars,need.stars)){pet.knownSkills.push({id:entry.skill,level:1});learned.push(entry.skill);}
 }
 return learned;
}
export function openSkillSlots(level:number,config:PetConfig=PET_CONFIG){return config.skillSlots.filter(slot=>slot.unlockLevel<=level).length;}
/** Why a skill cannot sit in a slot right now (null when it can). */
export function skillSlotProblem(pet:PlayerPet,slot:number,skillId:string,config:PetConfig=PET_CONFIG):string|null{
 const rule=config.skillSlots[slot];if(!rule)return 'Espaço de habilidade inválido.';
 if(pet.level<rule.unlockLevel)return `Este espaço abre no nível ${rule.unlockLevel} do pet.`;
 const skill=petSkill(skillId),known=pet.knownSkills.find(s=>s.id===skillId);
 if(!skill||!known)return 'O pet ainda não aprendeu esta habilidade.';
 if(rule.kinds&&!rule.kinds.includes(skill.kind))return 'Este espaço não aceita este tipo de habilidade.';
 const need=skill.requirements;if(pet.level<need.petLevel||pet.stage<need.stage||pet.stars<need.stars)return 'O pet não cumpre os requisitos desta habilidade.';
 return null;
}
/** Skills that work now: equipped, in an open slot and with their requirements met. */
export function activeSkills(pet:Pick<PlayerPet,'level'|'stage'|'stars'|'knownSkills'|'equippedSkills'>,config:PetConfig=PET_CONFIG):PetSkillEntry[]{
 const out:PetSkillEntry[]=[];
 pet.equippedSkills.forEach((id,slot)=>{
  if(!id||slot>=config.skillSlots.length||pet.level<config.skillSlots[slot].unlockLevel)return;
  const skill=petSkill(id),known=pet.knownSkills.find(s=>s.id===id);if(!skill||!known)return;
  const need=skill.requirements;if(pet.level<need.petLevel||pet.stage<need.stage||pet.stars<need.stars)return;
  out.push({...known});
 });
 return out;
}

// ── Vitality and attributes ──
/** Share of the bonuses granted at this vitality (curve in PET_CONFIG). 0 vitality always grants nothing. */
export function vitalityFactor(vitality:number,config:PetConfig=PET_CONFIG){
 if(!(vitality>0))return 0;const percent=Math.min(100,vitality/config.vitality.max*100);
 return config.vitality.efficiency.find(tier=>percent>=tier.minPercent)?.factor??0;
}
export function petCanFight(pet:{vitality:number}){return pet.vitality>0;}
/** The pet's own attributes: (base + growth × (level − 1)) × quality × stars × stage, plus stage bonus and traits, capped. */
export function petStats(pet:Pick<PetSnapshot,'species'|'level'|'quality'|'stars'|'stage'|'traits'>):Required<PetStats>{
 const out=Object.fromEntries(PET_STAT_KEYS.map(key=>[key,0])) as Required<PetStats>;
 const def=petSpecies(pet.species);if(!def)return out;
 const stage=def.stages[Math.min(def.stages.length-1,Math.max(0,pet.stage))],quality=PET_QUALITIES.get(pet.quality)?.multiplier??1;
 const scale=quality*(1+def.starBonus*Math.min(def.maxStars,pet.stars))*stage.multiplier;
 for(const key of PET_STAT_KEYS){
  let value=((def.base[key]??0)+(def.growth[key]??0)*(Math.max(1,pet.level)-1))*scale+(stage.bonus[key]??0)+(pet.traits[key]??0);
  const cap=def.limits[key];if(cap!==undefined)value=Math.min(cap,value);
  out[key]=Math.round(value);
 }
 return out;
}
/** What the equipped pet adds to its owner: its attributes plus permanent skills, scaled by vitality. */
export function petContribution(snapshot:PetSnapshot|undefined):PetStats{
 if(!snapshot)return {};const def=petSpecies(snapshot.species);if(!def)return {};
 const factor=vitalityFactor(snapshot.vitality);if(!factor)return {};
 const own=petStats(snapshot),out:PetStats={};
 for(const entry of snapshot.skills){const skill=petSkill(entry.id);if(skill?.kind!=='permanent')continue;const granted=skillLevel(skill,entry.level).stats??{};for(const key of PET_STAT_KEYS)own[key]+=granted[key as PetStatKey]??0;}
 for(const key of PET_STAT_KEYS){const value=Math.round(own[key]*factor);if(value)out[key]=value;}
 return out;
}
/** The snapshot of a pet as its owner's equipment carries it. */
export function petSnapshot(pet:PlayerPet,config:PetConfig=PET_CONFIG):PetSnapshot{
 return {id:pet.id,species:pet.species,level:pet.level,quality:pet.quality,stars:pet.stars,stage:pet.stage,vitality:pet.vitality,traits:{...pet.traits},skills:activeSkills(pet,config)};
}
/** The visual of a pet's current stage, falling back to the species art (renderers read only this). */
export function petVisual(snapshot:Pick<PetSnapshot,'species'|'stage'>|undefined):PetVisual|null{
 const def=snapshot&&petSpecies(snapshot.species);if(!def)return null;
 return {...def.visual,...(def.stages[snapshot.stage]?.visual??{})};
}
export const PET_NAME=/^[\p{L}\p{N} _'.-]+$/u;
export function validPetName(name:string,config:PetConfig=PET_CONFIG){
 const clean=name.trim().replace(/\s+/g,' ');
 if(clean.length<config.nameLength.min||clean.length>config.nameLength.max||!PET_NAME.test(clean))throw Error(`O nome do pet precisa de ${config.nameLength.min} a ${config.nameLength.max} letras ou números.`);
 return clean;
}
