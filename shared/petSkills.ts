import {z} from 'zod';
import {PET_CONFIG,PET_STAT_KEYS} from './petConfig';
import type {PetConfig,PetStatKey,PetStats} from './petConfig';
/**
 * Pet Skill Engine (docs/pets.md). Skills are typed DATA (effects, triggers, limits), never code: a new skill is a
 * new definition, and the server runs every definition through the same functions below. No skill is registered
 * here; the registry starts empty and only tests register fixtures in their own process.
 */
export const PET_SKILL_KINDS=['active','passive','permanent','conditional'] as const;
export type PetSkillKind=typeof PET_SKILL_KINDS[number];
/** Battle events a passive or conditional skill can listen to. Add new ones at the end. */
export const PET_TRIGGERS=['battle-start','turn-start','turn-end','before-fire','before-damage','hit','multi-hit','damage-dealt','critical','damaged','critical-received','absorbed','healed','heal-ally','debuff-applied','debuff-removed','kill','ally-died','hp-below','battle-won','battle-end',
 /** The owner's shot is over: every projectile landed (event carries the main impact point). */'shot-end'] as const;
export type PetTrigger=typeof PET_TRIGGERS[number];
/** Who an effect lands on. `event-source`/`event-target`: the two sides of the event that triggered a passive. */
export const PET_TARGETS=['self','ally','allies','enemy','enemies','event-source','event-target'] as const;
export type PetTarget=typeof PET_TARGETS[number];
export const PET_ACTIONS=['fire','walk','boost','ability','power','flight','pet-skill'] as const;
export type PetBlockedAction=typeof PET_ACTIONS[number];

const amount=z.number().finite().min(0).max(1_000_000);
const turns=z.number().int().min(1).max(99);
const stack=z.object({key:z.string().regex(/^[a-z0-9:-]{1,48}$/).optional(),max:z.number().int().min(1).max(20),mode:z.enum(['stack','refresh','replace','ignore'])}).strict();
const effectBase={target:z.enum(PET_TARGETS),stack:stack.optional(),
 /** Debuffs can be removed by cleanse and blocked by immunity; tags let immunities aim at families (e.g. "dot"). */
 debuff:z.boolean().optional(),tags:z.array(z.string().regex(/^[a-z0-9-]{1,24}$/)).max(6).optional()};
/** Every effect category the motor supports. These are categories, not skills. */
export const petEffectSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('damage'),...effectBase,amount:amount.optional(),attackPercent:amount.optional(),maxHpPercent:amount.optional()}).strict(),
 z.object({kind:z.literal('heal'),...effectBase,amount:amount.optional(),maxHpPercent:amount.optional()}).strict(),
 /** Multiplies the damage of the carrier's next shot(s); spent once per shot, however many projectiles it has. */
 z.object({kind:z.literal('next-shot'),...effectBase,multiplier:z.number().positive().max(10),shots:z.number().int().min(1).max(9),turns:turns.optional()}).strict(),
 /** Temporary attribute change, through the official attribute sum (shared/catalog.ts `attributes`). */
 z.object({kind:z.literal('stat'),...effectBase,stat:z.enum(PET_STAT_KEYS),value:z.number().finite().min(-100000).max(100000),turns}).strict(),
 /** Outgoing/incoming damage multipliers for some turns (0.8 incoming = 20% less damage taken). */
 z.object({kind:z.literal('damage-modifier'),...effectBase,outgoing:z.number().positive().max(10).optional(),incoming:z.number().min(0).max(10).optional(),turns}).strict(),
 z.object({kind:z.literal('shield'),...effectBase,amount:amount.optional(),maxHpPercent:amount.optional(),turns}).strict(),
 /** Damage (dot) or healing (hot) at the end (default) or the start of each of the carrier's turns. */
 z.object({kind:z.literal('dot'),...effectBase,amount:amount.optional(),maxHpPercent:amount.optional(),at:z.enum(['turn-start','turn-end']).optional(),turns}).strict(),
 z.object({kind:z.literal('hot'),...effectBase,amount:amount.optional(),maxHpPercent:amount.optional(),at:z.enum(['turn-start','turn-end']).optional(),turns}).strict(),
 /** Damage to every enemy within `radius` px of the event's point (no projectile: the effect rises where the shot landed). */
 z.object({kind:z.literal('area-damage'),...effectBase,radius:z.number().positive().max(600),amount:amount.optional(),attackPercent:amount.optional(),maxHpPercent:amount.optional()}).strict(),
 /** The carrier's next shot becomes the pet's own projectile: one projectile, no tools, damage × multiplier, optionally always critical. */
 z.object({kind:z.literal('special-shot'),...effectBase,projectile:z.string().regex(/^[a-z0-9-]{1,32}$/),multiplier:z.number().positive().max(10).default(1),critical:z.boolean().default(false),turns:turns.default(1)}).strict(),
 z.object({kind:z.literal('immunity'),...effectBase,against:z.array(z.string().regex(/^[a-z0-9-]{1,24}$/)).min(1).max(6),turns}).strict(),
 z.object({kind:z.literal('block'),...effectBase,actions:z.array(z.enum(PET_ACTIONS)).min(1),turns}).strict(),
 z.object({kind:z.literal('cleanse'),...effectBase,remove:z.enum(['debuffs','buffs']),count:z.number().int().min(1).max(20)}).strict(),
 z.object({kind:z.literal('mana'),...effectBase,amount:z.number().int().min(-1000).max(1000)}).strict(),
 /** Turn order: adds (or removes) Delay (shared/turnDelay.ts). */
 z.object({kind:z.literal('delay'),...effectBase,amount:z.number().int().min(-5000).max(5000)}).strict()
]);
export type PetEffectDef=z.infer<typeof petEffectSchema>;
const levelSchema=z.object({
 cost:z.number().int().min(0).max(1000).default(0),
 cooldown:z.number().int().min(0).max(99).default(0),
 /** 0–1, resolved by the server's random roll. */
 chance:z.number().min(0).max(1).default(1),
 effects:z.array(petEffectSchema).max(8).default([]),
 /** Permanent skills: attributes granted while the pet is equipped and active. */
 stats:z.partialRecord(z.enum(PET_STAT_KEYS),z.number().finite()).optional(),
 /** Delay added when an active skill is used. */
 delay:z.number().int().min(0).max(2000).default(0)
}).strict();
export const petSkillSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),name:z.string().min(1).max(40),description:z.string().max(400),
 kind:z.enum(PET_SKILL_KINDS),
 /** Listened events (passive/conditional only). */
 triggers:z.array(z.enum(PET_TRIGGERS)).max(8).default([]),
 conditions:z.object({hpBelowPercent:z.number().min(0).max(100).optional(),minDamage:z.number().min(0).optional(),critical:z.boolean().optional()}).strict().default({}),
 requirements:z.object({petLevel:z.number().int().min(1).default(1),stage:z.number().int().min(0).default(0),stars:z.number().int().min(0).default(0)}).strict().default({petLevel:1,stage:0,stars:0}),
 modes:z.array(z.enum(['pvp','pve'])).min(1).default(['pvp','pve']),
 /** Battle level follows the pet's evolution stage (stage 0 → level 1, stage 1 → level 2…), capped by `levels`. */
 stageScaling:z.boolean().default(false),
 /** Higher runs first when several skills listen to the same event. */
 priority:z.number().int().min(-100).max(100).default(0),
 limits:z.object({perTurn:z.number().int().min(1).optional(),perShot:z.number().int().min(1).optional(),perBattle:z.number().int().min(1).optional()}).strict().default({}),
 /** May an effect of another skill trigger this one? A skill never re-triggers itself. */
 allowFromSkills:z.boolean().default(false),
 /** Level 1 is `levels[0]`; later levels are full parameter sets (more power, less cost, longer…). */
 levels:z.array(levelSchema).min(1).max(20),
 /** Art: `{stage}` in a path is replaced by the pet's evolution stage. `effect` is a horizontal strip of `frames` cells played
  *  in `duration` ms, `size` px wide in the world; `projectile` (2 frames) and `impact` belong to a special shot.
  *  `style: 'whirl'` spins `effect` (one round image) as a whirlwind at the point, with `particles` (a strip of square cells, `pieces`
  *  loose pieces; by default as many as fit) flying out around it. */
 visual:z.object({icon:z.string().max(120).optional(),effect:z.string().max(120).optional(),style:z.enum(['strip','whirl']).optional(),particles:z.string().max(120).optional(),pieces:z.number().int().min(1).max(16).optional(),frames:z.number().int().min(1).max(32).optional(),duration:z.number().int().min(100).max(5000).optional(),size:z.number().positive().max(800).optional(),
  projectile:z.string().max(120).optional(),impact:z.string().max(120).optional(),sound:z.string().max(120).optional()}).strict().optional()
}).strict().superRefine((skill,ctx)=>{
 const listens=skill.kind==='passive'||skill.kind==='conditional';
 if(listens&&!skill.triggers.length)ctx.addIssue({code:'custom',message:`${skill.id}: habilidade passiva precisa de um gatilho.`});
 if(!listens&&skill.triggers.length)ctx.addIssue({code:'custom',message:`${skill.id}: só passivas e condicionais têm gatilhos.`});
 if(skill.kind==='permanent'&&skill.levels.some(level=>level.effects.length))ctx.addIssue({code:'custom',message:`${skill.id}: habilidade permanente concede atributos, não efeitos.`});
});
export type PetSkillDefinition=z.infer<typeof petSkillSchema>;
export type PetSkillLevel=PetSkillDefinition['levels'][number];

/** The skill catalog. Empty on purpose: no real skill exists yet. */
export const PET_SKILLS=new Map<string,PetSkillDefinition>();
export function registerPetSkill(raw:unknown):PetSkillDefinition{
 const parsed=petSkillSchema.safeParse(raw);if(!parsed.success)throw Error(`Habilidade de pet inválida: ${parsed.error.issues.map(i=>i.message).join('; ')}`);
 if(PET_SKILLS.has(parsed.data.id))throw Error(`Habilidade de pet repetida: ${parsed.data.id}`);
 PET_SKILLS.set(parsed.data.id,parsed.data);return parsed.data;
}
export function petSkill(id:string){return PET_SKILLS.get(id);}
/** Parameters of a skill at a level (clamped to the levels it defines). */
export function skillLevel(skill:PetSkillDefinition,level:number):PetSkillLevel{return skill.levels[Math.max(0,Math.min(skill.levels.length-1,Math.floor(level)-1))];}

// ── Battle state ──
/** The pet's temporary battle state, kept on its owner's Fighter (plain JSON: survives restarts, docs/live-state.md). */
export interface BattlePetSkill {id:string;level:number;/** Owner turn from which it can be used again. */readyAt:number;uses:number;}
export interface BattlePetState {petId:string;species:string;/** Evolution stage at battle start (picks the art of its effects). */stage?:number;mana:number;maxMana:number;regen:number;/** Turns of the owner started in this battle. */turns:number;skills:BattlePetSkill[];/** Passive activations per skill: turn counted, count this turn, shots seen. */fired?:Record<string,{turn:number;count:number;shots:string[]}>;}
/** A buff, debuff or lingering effect on a fighter (from any pet, own or enemy). */
export interface PetEffect {id:string;kind:Exclude<PetEffectDef['kind'],'damage'|'heal'|'cleanse'|'mana'|'delay'|'area-damage'>;skill:string;sourceId:string;stackKey:string;stacks:number;turns?:number;debuff?:boolean;tags?:string[];
 value?:number;stat?:PetStatKey;outgoing?:number;incoming?:number;multiplier?:number;shots?:number;shield?:number;against?:string[];actions?:PetBlockedAction[];
 /** dot/hot: when it ticks. */at?:'turn-start'|'turn-end';/** dot/hot: share of the carrier's Vida per tick. */maxHpPercent?:number;
 /** special-shot */projectile?:string;critical?:boolean;}
/** What the engine needs from a fighter; the game's Fighter matches it. */
export interface PetCombatant {id:string;team:number;hp:number;maxHp:number;level:number;x?:number;y?:number;delay?:number;left?:boolean;pet?:BattlePetState;petEffects?:PetEffect[];}
/** One visible result, sent to clients (`pet-effect`) so future art can play it. */
export interface PetApplication {skill:string;kind:PetEffectDef['kind']|'activate';sourceId:string;targetId:string;amount?:number;absorbed?:number;killed?:boolean;
 /** Where an area effect rises, and the stage of the pet that cast it (for its art). */x?:number;y?:number;radius?:number;stage?:number;}
export interface PetEventInfo {sourceId?:string;targetId?:string;amount?:number;critical?:boolean;shotId?:string;/** Where it happened (shot-end: the main impact). */point?:{x:number;y:number};/** Set when the event was caused by a pet skill (loop prevention). */origin?:{skill:string;depth:number};}
export interface PetEngineContext {fighters:PetCombatant[];mode:'pvp'|'pve';roll:()=>number;config?:PetConfig;/** Fresh ids for effects. */id?:()=>string;
 /** Activations left for the current player action (shared by the whole chain). */budget?:{left:number};
/** The fighter's official Ataque, for effects that scale with it. */attackOf?:(f:PetCombatant)=>number;
 /** Called for every damage a skill deals (the game turns it into the match's own bookkeeping). */onDamage?:(target:PetCombatant,amount:number,source:PetCombatant,skill:string)=>void;}

let counter=0;const nextId=()=>`pe-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const alive=(f:PetCombatant)=>f.hp>0&&!f.left;
/** Builds the battle state of an equipped pet, or nothing when it cannot fight (unknown species, no vitality, mode closed). */
export function createBattlePet(input:{petId:string;species:string;stage?:number;skills:{id:string;level:number}[]}|undefined,mode:'pvp'|'pve',config:PetConfig=PET_CONFIG):BattlePetState|undefined{
 if(!input)return undefined;
 const skills=input.skills.filter(s=>{const def=petSkill(s.id);return def&&(def.kind==='active'||def.kind==='passive'||def.kind==='conditional')&&def.modes.includes(mode);}).map(s=>{const def=petSkill(s.id)!,own=Math.max(1,Math.floor(s.level));return {id:s.id,level:def.stageScaling?Math.max(own,(input.stage??0)+1):own,readyAt:0,uses:0};});
 return {petId:input.petId,species:input.species,stage:input.stage??0,mana:config.mana.initial,maxMana:config.mana.max,regen:config.mana.regenPerTurn,turns:0,skills};
}
function targetsFor(ctx:PetEngineContext,owner:PetCombatant,target:PetTarget,event?:PetEventInfo,chosen?:string):PetCombatant[]{
 const byId=(id?:string)=>id?ctx.fighters.find(f=>f.id===id):undefined;
 const enemies=ctx.fighters.filter(f=>f.team!==owner.team&&alive(f)),allies=ctx.fighters.filter(f=>f.team===owner.team&&alive(f));
 switch(target){
  case 'self':return [owner];
  case 'allies':return allies;
  case 'enemies':return enemies;
  case 'ally':{const pick=byId(chosen);return pick&&allies.includes(pick)?[pick]:[owner];}
  // The chosen enemy, else the enemy of the triggering event, else the first one standing.
  case 'enemy':{const pick=[byId(chosen),byId(event?.targetId),byId(event?.sourceId)].find(f=>f&&enemies.includes(f));return pick?[pick]:enemies.slice(0,1);}
  case 'event-source':{const f=byId(event?.sourceId);return f?[f]:[];}
  case 'event-target':{const f=byId(event?.targetId);return f?[f]:[];}
 }
}
function immune(target:PetCombatant,effect:PetEffectDef){
 const tags=new Set([...(effect.tags??[]),effect.kind,...(effect.debuff?['debuff']:[])]);
 return (target.petEffects??[]).some(e=>e.kind==='immunity'&&e.against?.some(tag=>tags.has(tag)));
}
/** Adds a lasting effect following its stack rule. */
function addEffect(ctx:PetEngineContext,target:PetCombatant,effect:PetEffect,rule?:PetEffectDef['stack']){
 const list=target.petEffects??=[];const existing=list.filter(e=>e.stackKey===effect.stackKey);
 const mode=rule?.mode??'refresh',max=rule?.max??1;
 if(existing.length){
  if(mode==='ignore')return false;
  if(mode==='replace'||mode==='refresh'&&max<=1){target.petEffects=list.filter(e=>e.stackKey!==effect.stackKey);target.petEffects.push(effect);return true;}
  if(mode==='refresh'){existing.forEach(e=>{e.turns=effect.turns;e.shots=effect.shots;e.shield=effect.shield;});const first=existing[0];if(first.stacks<max)first.stacks++;return true;}
  if(existing.length>=max)return false;
 }
 list.push(effect);return true;
}
function damage(ctx:PetEngineContext,source:PetCombatant,target:PetCombatant,raw:number,skill:string):PetApplication{
 const {damage:dealt,absorbed}=incomingPetDamage(target,Math.max(0,Math.round(raw)));
 const taken=Math.min(target.hp,dealt);target.hp-=taken;ctx.onDamage?.(target,taken,source,skill);
 return {skill,kind:'damage',sourceId:source.id,targetId:target.id,amount:taken,...(absorbed?{absorbed}:{}),...(target.hp<=0?{killed:true}:{})};
}
/** Applies one skill level's effects; returns what happened and the secondary events the results cause. */
function applyEffects(ctx:PetEngineContext,owner:PetCombatant,skill:PetSkillDefinition,level:PetSkillLevel,event:PetEventInfo|undefined,chosen:string|undefined,depth:number):PetApplication[]{
 const out:PetApplication[]=[],follow:{trigger:PetTrigger;owner:PetCombatant;info:PetEventInfo}[]=[];
 for(const effect of level.effects){
  if(effect.kind==='area-damage'){
   const point=event?.point;if(!point)continue;
   out.push({skill:skill.id,kind:'area-damage',sourceId:owner.id,targetId:owner.id,x:point.x,y:point.y,radius:effect.radius,...(owner.pet?.stage!==undefined?{stage:owner.pet.stage}:{})});
   const origin={skill:skill.id,depth:depth+1};
   for(const target of ctx.fighters.filter(f=>f.team!==owner.team&&alive(f)&&f.x!==undefined&&Math.hypot((f.x??0)-point.x,(f.y??0)-40-point.y)<=effect.radius)){
    if(immune(target,effect))continue;
    const raw=(effect.amount??0)+(effect.attackPercent??0)/100*(ctx.attackOf?.(owner)??0)+(effect.maxHpPercent??0)/100*target.maxHp;
    const hit={...damage(ctx,owner,target,raw,skill.id),kind:'area-damage' as const};out.push(hit);
    if(hit.amount)follow.push({trigger:'damage-dealt',owner,info:{sourceId:owner.id,targetId:target.id,amount:hit.amount,origin}},{trigger:'damaged',owner:target,info:{sourceId:owner.id,targetId:target.id,amount:hit.amount,origin}});
    if(hit.killed){follow.push({trigger:'kill',owner,info:{sourceId:owner.id,targetId:target.id,origin}});for(const ally of ctx.fighters.filter(f=>f.team===target.team&&f.id!==target.id&&alive(f)))follow.push({trigger:'ally-died',owner:ally,info:{sourceId:owner.id,targetId:target.id,origin}});}
   }
   continue;
  }
  for(const target of targetsFor(ctx,owner,effect.target,event,chosen)){
   if(!alive(target)&&effect.kind!=='cleanse')continue;
   if(target.team!==owner.team&&immune(target,effect))continue;
   const key=effect.stack?.key??`${skill.id}:${effect.kind}`,base={id:(ctx.id??nextId)(),skill:skill.id,sourceId:owner.id,stackKey:key,stacks:1,...(effect.debuff?{debuff:true}:{}),...(effect.tags?{tags:effect.tags}:{})};
   const origin={skill:skill.id,depth:depth+1};
   switch(effect.kind){
    case 'damage':{const raw=(effect.amount??0)+(effect.attackPercent??0)/100*(ctx.attackOf?.(owner)??0)+(effect.maxHpPercent??0)/100*target.maxHp;const hit=damage(ctx,owner,target,raw,skill.id);out.push(hit);
     if(hit.amount){follow.push({trigger:'damage-dealt',owner,info:{sourceId:owner.id,targetId:target.id,amount:hit.amount,origin}},{trigger:'damaged',owner:target,info:{sourceId:owner.id,targetId:target.id,amount:hit.amount,origin}});}
     if(hit.killed){follow.push({trigger:'kill',owner,info:{sourceId:owner.id,targetId:target.id,origin}});for(const ally of ctx.fighters.filter(f=>f.team===target.team&&f.id!==target.id&&alive(f)))follow.push({trigger:'ally-died',owner:ally,info:{sourceId:owner.id,targetId:target.id,origin}});}
     break;}
    case 'heal':{const healed=Math.max(0,Math.min(target.maxHp-target.hp,Math.round((effect.amount??0)+(effect.maxHpPercent??0)/100*target.maxHp)));target.hp+=healed;out.push({skill:skill.id,kind:'heal',sourceId:owner.id,targetId:target.id,amount:healed});
     if(healed){follow.push({trigger:'healed',owner:target,info:{sourceId:owner.id,targetId:target.id,amount:healed,origin}});if(target.id!==owner.id)follow.push({trigger:'heal-ally',owner,info:{sourceId:owner.id,targetId:target.id,amount:healed,origin}});}break;}
    case 'cleanse':{const list=target.petEffects??[],removing=list.filter(e=>effect.remove==='debuffs'?e.debuff:!e.debuff).slice(0,effect.count);target.petEffects=list.filter(e=>!removing.includes(e));out.push({skill:skill.id,kind:'cleanse',sourceId:owner.id,targetId:target.id,amount:removing.length});
     if(removing.length&&effect.remove==='debuffs')follow.push({trigger:'debuff-removed',owner,info:{sourceId:owner.id,targetId:target.id,amount:removing.length,origin}});break;}
    case 'mana':{if(target.pet){const before=target.pet.mana;target.pet.mana=Math.max(0,Math.min(target.pet.maxMana,before+effect.amount));out.push({skill:skill.id,kind:'mana',sourceId:owner.id,targetId:target.id,amount:target.pet.mana-before});}break;}
    case 'delay':{target.delay=Math.max(0,(target.delay??0)+effect.amount);out.push({skill:skill.id,kind:'delay',sourceId:owner.id,targetId:target.id,amount:effect.amount});break;}
    case 'shield':{const shield=Math.round((effect.amount??0)+(effect.maxHpPercent??0)/100*target.maxHp);if(addEffect(ctx,target,{...base,kind:'shield',shield,turns:effect.turns},effect.stack))out.push({skill:skill.id,kind:'shield',sourceId:owner.id,targetId:target.id,amount:shield});break;}
    default:{
     const lasting:PetEffect={...base,kind:effect.kind,
      ...('turns' in effect&&effect.turns!==undefined?{turns:effect.turns}:{}),
      ...(effect.kind==='stat'?{stat:effect.stat,value:effect.value}:{}),
      ...(effect.kind==='damage-modifier'?{...(effect.outgoing!==undefined?{outgoing:effect.outgoing}:{}),...(effect.incoming!==undefined?{incoming:effect.incoming}:{})}:{}),
      ...(effect.kind==='next-shot'?{multiplier:effect.multiplier,shots:effect.shots}:{}),
      ...(effect.kind==='dot'||effect.kind==='hot'?{value:effect.amount??0,...(effect.maxHpPercent?{maxHpPercent:effect.maxHpPercent}:{}),...(effect.at?{at:effect.at}:{})}:{}),
      ...(effect.kind==='special-shot'?{projectile:effect.projectile,multiplier:effect.multiplier,critical:effect.critical,shots:1}:{}),
      ...(effect.kind==='immunity'?{against:effect.against}:{}),
      ...(effect.kind==='block'?{actions:effect.actions}:{})};
     if(addEffect(ctx,target,lasting,effect.stack)){out.push({skill:skill.id,kind:effect.kind,sourceId:owner.id,targetId:target.id,...(lasting.value!==undefined?{amount:lasting.value}:{})});
      if(effect.debuff&&target.team!==owner.team)follow.push({trigger:'debuff-applied',owner,info:{sourceId:owner.id,targetId:target.id,origin}});}
    }
   }
  }
 }
 for(const next of follow)out.push(...dispatchPetTrigger(ctx,next.trigger,next.owner,next.info));
 return out;
}
/** Whether a skill of this pet may be used right now (null) or why not. */
export function petSkillBlocked(owner:PetCombatant,skillId:string,mode:'pvp'|'pve'):string|null{
 const pet=owner.pet;if(!pet)return 'Você não tem um pet ativo nesta batalha.';
 const slot=pet.skills.find(s=>s.id===skillId),def=petSkill(skillId);
 if(!slot||!def)return 'Esta habilidade não está equipada no seu pet.';
 if(def.kind!=='active')return 'Esta habilidade age sozinha.';
 if(!def.modes.includes(mode))return 'Esta habilidade não vale neste modo.';
 if(blocked(owner,'pet-skill'))return 'Seu pet está impedido de agir.';
 const level=skillLevel(def,slot.level);
 if(pet.turns<slot.readyAt)return `Aguarde ${slot.readyAt-pet.turns} turno(s) para usar de novo.`;
 if(def.limits.perBattle&&slot.uses>=def.limits.perBattle)return 'Esta habilidade já foi usada o máximo de vezes nesta batalha.';
 if(pet.mana<level.cost)return 'Magia do pet insuficiente.';
 return null;
}
/** Uses an active skill (the server has already checked the turn). Throws a player-facing message when it cannot. */
export function activatePetSkill(ctx:PetEngineContext,owner:PetCombatant,skillId:string,chosen?:string):{applications:PetApplication[];delay:number}{
 const reason=petSkillBlocked(owner,skillId,ctx.mode);if(reason)throw Error(reason);
 const pet=owner.pet!,slot=pet.skills.find(s=>s.id===skillId)!,def=petSkill(skillId)!,level=skillLevel(def,slot.level);
 pet.mana-=level.cost;slot.uses++;slot.readyAt=pet.turns+level.cooldown+1;
 ctx.budget??={left:(ctx.config??PET_CONFIG).engine.maxActivationsPerAction};ctx.budget.left--;
 const applications:PetApplication[]=[{skill:skillId,kind:'activate',sourceId:owner.id,targetId:owner.id}];
 applications.push(...applyEffects(ctx,owner,def,level,undefined,chosen,0));
 owner.delay=(owner.delay??0)+level.delay;
 return {applications,delay:level.delay};
}
/**
 * Fires every passive/conditional skill of `owner`'s pet that listens to `trigger`, in priority order, with its
 * chance, conditions and limits. Effects caused by skills carry an origin: they stop at the configured chain depth,
 * never re-trigger the skill that caused them and only reach skills that allow it.
 */
export function dispatchPetTrigger(ctx:PetEngineContext,trigger:PetTrigger,owner:PetCombatant,info:PetEventInfo={}):PetApplication[]{
 const pet=owner.pet;if(!pet||!alive(owner)&&trigger!=='battle-end'&&trigger!=='ally-died')return [];
 const config=ctx.config??PET_CONFIG,depth=info.origin?.depth??0;
 if(depth>config.engine.maxChainDepth)return [];
 ctx.budget??={left:config.engine.maxActivationsPerAction};
 const listening=pet.skills.map(slot=>({slot,def:petSkill(slot.id)})).filter((entry):entry is {slot:BattlePetSkill;def:PetSkillDefinition}=>!!entry.def&&(entry.def.kind==='passive'||entry.def.kind==='conditional')&&entry.def.triggers.includes(trigger)&&entry.def.modes.includes(ctx.mode))
  .sort((a,b)=>b.def.priority-a.def.priority||a.slot.id.localeCompare(b.slot.id));
 const out:PetApplication[]=[];
 for(const {slot,def} of listening){
  if(ctx.budget.left<=0)break;
  if(info.origin&&(info.origin.skill===def.id||!def.allowFromSkills))continue;
  if(blocked(owner,'pet-skill'))continue;
  const c=def.conditions;
  if(c.hpBelowPercent!==undefined&&owner.hp/Math.max(1,owner.maxHp)*100>=c.hpBelowPercent)continue;
  if(c.minDamage!==undefined&&(info.amount??0)<c.minDamage)continue;
  if(c.critical!==undefined&&!!info.critical!==c.critical)continue;
  const fired=(pet.fired??={})[def.id]??={turn:pet.turns,count:0,shots:[]};
  if(fired.turn!==pet.turns){fired.turn=pet.turns;fired.count=0;}
  if(def.limits.perTurn&&fired.count>=def.limits.perTurn)continue;
  if(def.limits.perBattle&&slot.uses>=def.limits.perBattle)continue;
  if(info.shotId&&def.limits.perShot&&fired.shots.filter(id=>id===info.shotId).length>=def.limits.perShot)continue;
  if(pet.turns<slot.readyAt)continue;
  const level=skillLevel(def,slot.level);if(pet.mana<level.cost)continue;
  if(level.chance<1&&!(ctx.roll()<level.chance))continue;
  pet.mana-=level.cost;slot.uses++;fired.count++;if(info.shotId){fired.shots.push(info.shotId);fired.shots=fired.shots.slice(-12);}
  if(level.cooldown)slot.readyAt=pet.turns+level.cooldown+1;
  ctx.budget.left--;
  out.push({skill:def.id,kind:'activate',sourceId:owner.id,targetId:info.targetId??owner.id});
  out.push(...applyEffects(ctx,owner,def,level,info,undefined,depth));
 }
 return out;
}
/** Runs a trigger for every fighter's pet (battle start, a kill seen by everyone…). */
export function dispatchAll(ctx:PetEngineContext,trigger:PetTrigger,info:(f:PetCombatant)=>PetEventInfo=()=>({})){
 return ctx.fighters.flatMap(f=>f.pet?dispatchPetTrigger(ctx,trigger,f,info(f)):[]);
}
// ── Hooks the combat calls ──
export function blocked(f:PetCombatant,action:PetBlockedAction){return (f.petEffects??[]).some(e=>e.kind==='block'&&e.actions?.includes(action));}
/** Temporary attribute changes, summed into the official attributes for this battle. */
export function petStatBuffs(f:PetCombatant):PetStats|undefined{
 const stats=(f.petEffects??[]).filter(e=>e.kind==='stat'&&e.stat);if(!stats.length)return undefined;
 const sum:PetStats={};for(const e of stats)sum[e.stat!]=(sum[e.stat!]??0)+(e.value??0)*e.stacks;return sum;
}
/** Damage multiplier from the carrier's outgoing modifiers (per projectile, like boosts). */
export function outgoingPetFactor(f:PetCombatant){return (f.petEffects??[]).reduce((n,e)=>e.kind==='damage-modifier'&&e.outgoing!==undefined?n*e.outgoing**e.stacks:n,1);}
/** Spends one shot of every next-shot bonus: call ONCE per shot, never per projectile. */
export function consumeShotBonus(f:PetCombatant){
 let factor=1;const list=f.petEffects??[];
 for(const e of list)if(e.kind==='next-shot'&&(e.shots??0)>0){factor*=(e.multiplier??1)**e.stacks;e.shots!--;}
 if(list.length)f.petEffects=list.filter(e=>e.kind!=='next-shot'||(e.shots??0)>0);
 return factor;
}
/** Incoming multipliers, then shields soak what is left. Mutates the shields of `target`. */
export function incomingPetDamage(target:PetCombatant,raw:number):{damage:number;absorbed:number}{
 const list=target.petEffects;if(!list?.length||raw<=0)return {damage:raw,absorbed:0};
 let value=Math.round(list.reduce((n,e)=>e.kind==='damage-modifier'&&e.incoming!==undefined?n*e.incoming**e.stacks:n,raw));
 let absorbed=0;for(const e of list)if(e.kind==='shield'&&(e.shield??0)>0&&value>0){const take=Math.min(e.shield!,value);e.shield!-=take;value-=take;absorbed+=take;}
 target.petEffects=list.filter(e=>e.kind!=='shield'||(e.shield??0)>0);
 return {damage:value,absorbed};
}
/** Drains shields by an amount already decided (a planned hit landing on the real fighter). */
export function drainShield(target:PetCombatant,amount:number){
 let left=amount;for(const e of target.petEffects??[])if(e.kind==='shield'&&left>0){const take=Math.min(e.shield??0,left);e.shield=(e.shield??0)-take;left-=take;}
 if(target.petEffects)target.petEffects=target.petEffects.filter(e=>e.kind!=='shield'||(e.shield??0)>0);
}
/** One tick of the dot/hot effects of `f` that run at `at`; then those effects lose a turn. */
function tickPeriodic(ctx:PetEngineContext,f:PetCombatant,at:'turn-start'|'turn-end'):PetApplication[]{
 const out:PetApplication[]=[];const mine=(e:PetEffect)=>(e.kind==='dot'||e.kind==='hot')&&(e.at??'turn-end')===at;
 for(const e of f.petEffects??[]){
  if(!alive(f))break;if(!mine(e))continue;
  const value=Math.round(((e.value??0)+(e.maxHpPercent??0)/100*f.maxHp)*e.stacks);
  if(e.kind==='dot'){const source=ctx.fighters.find(x=>x.id===e.sourceId)??f;out.push(damage(ctx,source,f,value,e.skill));}
  else{const healed=Math.max(0,Math.min(f.maxHp-f.hp,value));f.hp+=healed;out.push({skill:e.skill,kind:'hot',sourceId:e.sourceId,targetId:f.id,amount:healed});}
 }
 if(at==='turn-start'&&f.petEffects){for(const e of f.petEffects)if(mine(e)&&e.turns!==undefined)e.turns--;f.petEffects=f.petEffects.filter(e=>e.turns===undefined||e.turns>0);if(!f.petEffects.length)delete f.petEffects;}
 return out;
}
/** Start of a fighter's turn: turn-start heals and damage tick; for the pet's owner Magia regenerates, cooldowns advance and `turn-start` passives run. */
export function petTurnStart(ctx:PetEngineContext,f:PetCombatant){
 const out=tickPeriodic(ctx,f,'turn-start');
 if(!f.pet)return out;
 f.pet.turns++;f.pet.mana=Math.min(f.pet.maxMana,f.pet.mana+f.pet.regen);
 return [...out,...dispatchPetTrigger(ctx,'turn-start',f,{sourceId:f.id})];
}
/** The pending special shot of a fighter (spent by `consumeSpecialShot` when it fires). */
export function specialShot(f:PetCombatant){return (f.petEffects??[]).find(e=>e.kind==='special-shot'&&(e.shots??0)>0);}
export function consumeSpecialShot(f:PetCombatant){const e=specialShot(f);if(!e)return undefined;f.petEffects=(f.petEffects??[]).filter(x=>x!==e);if(!f.petEffects.length)delete f.petEffects;return e;}
/** Does any active skill level of this skill arm a special shot? (Such skills cannot mix with tools.) */
export function armsSpecialShot(skillId:string,level:number){const def=petSkill(skillId);return !!def&&skillLevel(def,level).effects.some(e=>e.kind==='special-shot');}
/** Does this pet listen to the end of its owner's shot? */
export function listensTo(pet:BattlePetState|undefined,trigger:PetTrigger){return !!pet?.skills.some(s=>petSkill(s.id)?.triggers.includes(trigger));}
/** End of the carrier's turn: periodic damage and healing, then durations run down and expire. */
export function petTurnEnd(ctx:PetEngineContext,f:PetCombatant):PetApplication[]{
 const out=tickPeriodic(ctx,f,'turn-end');
 if(f.petEffects){for(const e of f.petEffects)if(e.turns!==undefined&&!((e.kind==='dot'||e.kind==='hot')&&e.at==='turn-start'))e.turns--;f.petEffects=f.petEffects.filter(e=>e.turns===undefined||e.turns>0);if(!f.petEffects.length)delete f.petEffects;}
 if(f.pet&&alive(f))out.push(...dispatchPetTrigger(ctx,'turn-end',f,{sourceId:f.id}));
 return out;
}
