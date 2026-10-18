import {z} from 'zod';
/**
 * Every adjustable number of the pet system (docs/pets.md). Provisional Brasa balance, not official DDTank
 * values: change them here, never inside the services. Validated once at load, so a bad edit fails at boot.
 */
/** Attributes a pet can grant: the character's own (shared/catalog.ts `ItemAttributes`) plus flat Vida and Vigor. */
export const PET_STAT_KEYS=['attack','defense','agility','luck','damage','armor','hp','stamina'] as const;
export type PetStatKey=typeof PET_STAT_KEYS[number];
export type PetStats=Partial<Record<PetStatKey,number>>;
export const PET_STAT_NAMES:Record<PetStatKey,string>={attack:'Ataque',defense:'Defesa',agility:'Agilidade',luck:'Sorte',damage:'Dano',armor:'Armadura',hp:'Vida',stamina:'Vigor'};
const count=z.number().int().min(0);
const xpCurveSchema=z.discriminatedUnion('kind',[
 /** EXP from level n to n+1: round(base × growth^(n−1) + linear × (n−1)). */
 z.object({kind:z.literal('formula'),base:z.number().positive(),growth:z.number().min(1).max(2),linear:z.number().min(0)}).strict(),
 /** EXP from level n to n+1 read from `table[n−1]`; past the end the last step repeats. */
 z.object({kind:z.literal('table'),table:z.array(z.number().int().positive()).min(1)}).strict()
]);
export type PetXpCurve=z.infer<typeof xpCurveSchema>;
export const petConfigSchema=z.object({
 /** Pets one character can own, and how many can be active at once. */
 maxOwned:z.number().int().min(1).max(500),
 maxEquipped:z.number().int().min(1).max(4),
 nameLength:z.object({min:z.number().int().min(1),max:z.number().int().max(16)}).strict(),
 progression:z.object({
  /** Highest level any pet reaches; a species may stop earlier (PetDefinition.maxLevel). */
  maxLevel:z.number().int().min(1).max(200),
  curve:xpCurveSchema,
  /** Global EXP multiplier (events): 1 = normal, 2 = double EXP. */
  multiplier:z.number().positive().max(10),
  /** EXP an equipped, active pet earns per finished battle. */
  sources:z.object({pvpWin:count,pvpLoss:count,pveWin:count,pveLoss:count}).strict()
 }).strict(),
 vitality:z.object({
  max:z.number().int().min(1).max(10000),
  initial:z.number().int().min(0),
  /** Vitality spent per finished battle the pet took part in. */
  battleCost:z.object({pvp:count,pve:count}).strict(),
  /** Share of the pet's bonuses granted at each vitality percentage; first match from the top, 0% always grants nothing. */
  efficiency:z.array(z.object({minPercent:z.number().min(0).max(100),factor:z.number().min(0).max(1)}).strict()).min(1)
 }).strict(),
 /** Battles that grant pet EXP and spend vitality. Practice rooms (with bots) count only when `practice` is true. */
 battles:z.object({pvp:z.boolean(),pve:z.boolean(),practice:z.boolean()}).strict(),
 stars:z.object({max:z.number().int().min(0).max(20)}).strict(),
 /** Skill slots in order; each opens at a pet level and may accept only some skill kinds. */
 skillSlots:z.array(z.object({unlockLevel:z.number().int().min(1),kinds:z.array(z.enum(['active','passive','permanent','conditional'])).optional()}).strict()).min(1).max(8),
 /** Pet gear (future): slot ids, closed until `enabled`. */
 equipment:z.object({enabled:z.boolean(),slots:z.array(z.string().regex(/^[a-z][a-z0-9-]{1,23}$/)).max(8)}).strict(),
 /** Evolution of stage and stars (future): the contracts exist, the commands stay closed until enabled. */
 evolution:z.object({enabled:z.boolean()}).strict(),
 /** Pet Magia: the battle resource of active pet skills, apart from Vigor, Delay and Power. */
 mana:z.object({initial:count,max:z.number().int().min(1),regenPerTurn:count}).strict(),
 /** Skill engine safety: how deep effects may trigger other skills and how many activations one action may cause. */
 engine:z.object({maxChainDepth:z.number().int().min(0).max(8),maxActivationsPerAction:z.number().int().min(1).max(64)}).strict()
}).strict().superRefine((config,ctx)=>{
 if(config.vitality.initial>config.vitality.max)ctx.addIssue({code:'custom',message:'Vitalidade inicial acima da máxima.'});
 if(config.mana.initial>config.mana.max)ctx.addIssue({code:'custom',message:'Magia inicial acima da máxima.'});
 const levels=config.skillSlots.map(slot=>slot.unlockLevel);
 if(levels.some((level,i)=>i>0&&level<levels[i-1]))ctx.addIssue({code:'custom',message:'Os espaços de habilidade abrem em níveis crescentes.'});
 if(levels.some(level=>level>config.progression.maxLevel))ctx.addIssue({code:'custom',message:'Espaço de habilidade acima do nível máximo.'});
 const tiers=config.vitality.efficiency.map(tier=>tier.minPercent);
 if(tiers.some((value,i)=>i>0&&value>=tiers[i-1]))ctx.addIssue({code:'custom',message:'A curva de vitalidade vai do maior percentual ao menor.'});
});
export type PetConfig=z.infer<typeof petConfigSchema>;
export function validatePetConfig(config:unknown):PetConfig{
 const parsed=petConfigSchema.safeParse(config);
 if(!parsed.success)throw Error(`Configuração de pets inválida: ${parsed.error.issues.map(issue=>issue.message).join('; ')}`);
 return parsed.data;
}
export const PET_CONFIG:PetConfig=validatePetConfig({
 maxOwned:20,maxEquipped:1,nameLength:{min:2,max:16},
 progression:{maxLevel:60,curve:{kind:'formula',base:100,growth:1.08,linear:20},multiplier:1,sources:{pvpWin:60,pvpLoss:25,pveWin:50,pveLoss:20}},
 vitality:{max:100,initial:100,battleCost:{pvp:4,pve:3},efficiency:[{minPercent:75,factor:1},{minPercent:50,factor:.75},{minPercent:25,factor:.5},{minPercent:0,factor:.25}]},
 battles:{pvp:true,pve:true,practice:false},
 stars:{max:5},
 skillSlots:[{unlockLevel:1},{unlockLevel:10},{unlockLevel:25},{unlockLevel:40}],
 equipment:{enabled:false,slots:['head','body','charm']},
 evolution:{enabled:false},
 mana:{initial:30,max:100,regenPerTurn:10},
 engine:{maxChainDepth:2,maxActivationsPerAction:12}
});
