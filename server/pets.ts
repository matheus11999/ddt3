import type pg from 'pg';
import {randomInt,randomUUID} from 'node:crypto';
import {PET_CONFIG,PET_STAT_KEYS} from '../shared/petConfig';
import type {PetConfig,PetStats} from '../shared/petConfig';
import {cleanStats,gainPetXp,petSnapshot,petSpecies,PET_FOODS,PET_QUALITIES,placeLearned,refreshKnownSkills,skillSlotProblem,validPetName} from '../shared/pets';
import type {PlayerPet} from '../shared/pets';
import type {PetDomainEvent,PetDomainEventKind,PetResult,PetsState} from '../shared/petProtocol';
import type {Profile} from '../shared/protocol';
import {normalizeProfile,RANKING_TIME_ZONE} from './store';

/** What one pet action returns: the owner's profile (its equipment carries the active pet), the pet list and the result. */
export interface PetOutcome {profile:Profile;state:PetsState;result:PetResult;}
export interface BattlePetEntry {ownerId:string;petId:string;mode:'pvp'|'pve';won:boolean;}
/** What the game needs from the pet system (tests use the in-memory version). */
export interface PetKeeper {
 list(ownerId:string):Promise<PetsState>;
 equip(ownerId:string,petId:string):Promise<PetOutcome>;
 unequip(ownerId:string,petId:string):Promise<PetOutcome>;
 rename(ownerId:string,petId:string,name:string):Promise<PetOutcome>;
 setLocked(ownerId:string,petId:string,locked:boolean):Promise<PetOutcome>;
 release(ownerId:string,petId:string,confirmName:string):Promise<PetOutcome>;
 feed(ownerId:string,petId:string,food:string,quantity:number):Promise<PetOutcome>;
 setSkillSlot(ownerId:string,petId:string,slot:number,skill:string|null):Promise<PetOutcome>;
 /** A one-time gift (null when already received). */
 gift(ownerId:string,gift:{key:string;species:string;food?:Record<string,number>;equip?:boolean}):Promise<PetOutcome|null>;
 /** End of a battle: EXP and vitality for each pet that fought, applied once per battle and pet whatever the retries. */
 settleBattle(battleId:string,entries:BattlePetEntry[]):Promise<Map<string,PetOutcome>>;
}
/** Inside one owner's transaction: everything an operation may read or change. */
export interface PetTx {
 profile:Profile;pets:PlayerPet[];events:PetDomainEvent[];
 /** Units of a food this pet already ate today (Brasília day). */
 fedToday(petId:string,food:string):Promise<number>;
 recordFeeding(entry:{petId:string;food:string;quantity:number;vitalityBefore:number;vitalityAfter:number;xp:number}):Promise<void>;
 /** Claims (battle, pet) in the ledger; false when it was already applied. */
 claimBattle(battleId:string,entry:BattlePetEntry,applied:{xp:number;vitality:number}):Promise<boolean>;
}
export function petDay(date=new Date()){return date.toLocaleDateString('en-CA',{timeZone:RANKING_TIME_ZONE});}
const event=(tx:PetTx,kind:PetDomainEventKind,pet:PlayerPet,data:Record<string,unknown>={})=>{tx.events.push({id:randomUUID(),kind,petId:pet.id,ownerId:pet.ownerId,at:new Date().toISOString(),data});};
const ownPet=(tx:PetTx,petId:string)=>{const pet=tx.pets.find(p=>p.id===petId);if(!pet)throw Error('Este pet não é seu.');return pet;};

/**
 * Every rule of the pet system, independent of where the data lives. Subclasses only open a transaction that
 * locks the owner (player row first, then their pets) and save what changed, so concurrent actions of one player
 * run one after another and an item is never spent twice.
 */
export abstract class PetService implements PetKeeper {
 constructor(protected config:PetConfig=PET_CONFIG,protected rng:()=>number=()=>randomInt(1_000_000)/1_000_000){}
 protected abstract transact<T>(ownerId:string,run:(tx:PetTx)=>Promise<T>|T):Promise<{value:T;profile:Profile;pets:PlayerPet[]}>;
 protected state(profile:Profile,pets:PlayerPet[]):PetsState{return {pets:pets.map(p=>structuredClone(p)),capacity:this.config.maxOwned,food:{...profile.petFood}};}
 /** The equipment's snapshot follows the equipped pet; called before every save. */
 static wear(profile:Profile,pets:PlayerPet[],config:PetConfig=PET_CONFIG){
  const worn=pets.find(p=>p.equipped&&petSpecies(p.species));
  if(worn)profile.equipment.pet=petSnapshot(worn,config);else delete profile.equipment.pet;
 }
 private async act(ownerId:string,action:PetResult['action'],run:(tx:PetTx)=>Promise<{petId?:string;message:string}>|{petId?:string;message:string}):Promise<PetOutcome>{
  let events:PetDomainEvent[]=[];
  const {value,profile,pets}=await this.transact(ownerId,async tx=>{const out=await run(tx);events=tx.events;return out;});
  return {profile,state:this.state(profile,pets),result:{action,...(value.petId?{petId:value.petId}:{}),message:value.message,events}};
 }
 async list(ownerId:string){const {profile,pets}=await this.transact(ownerId,()=>null);return this.state(profile,pets);}
 /** Gives a pet to a player (rewards, events, the admin: no public way exists yet). Checks the species and capacity. */
 async grant(ownerId:string,species:string,options:{source:string;quality?:string;name?:string;stars?:number;traits?:PetStats}={source:'system'}):Promise<PetOutcome&{pet:PlayerPet}>{
  const def=petSpecies(species);if(!def||!def.enabled)throw Error('Este pet não está disponível.');
  const quality=options.quality??def.qualities[0];if(!def.qualities.includes(quality)||!PET_QUALITIES.has(quality))throw Error('Qualidade de pet inválida.');
  let created!:PlayerPet;
  const outcome=await this.act(ownerId,'grant',tx=>{created=this.create(tx,ownerId,species,quality,options);return {petId:created.id,message:`Você recebeu ${created.name}!`};});
  return {...outcome,pet:structuredClone(outcome.state.pets.find(p=>p.id===created.id)!)};
 }
 /** A new pet inside a transaction: capacity, traits rolled in the species range, skills learned and placed in the open slots. */
 private create(tx:PetTx,ownerId:string,species:string,quality:string,options:{source:string;name?:string;stars?:number;traits?:PetStats}){
  const def=petSpecies(species)!;
  if(tx.pets.length>=this.config.maxOwned)throw Error(`Você já tem ${this.config.maxOwned} pets. Libere um para receber outro.`);
  const traits=options.traits?cleanStats(options.traits):Object.fromEntries(PET_STAT_KEYS.filter(key=>def.traitRange[key]).map(key=>[key,Math.round(this.rng()*(def.traitRange[key]??0))]).filter(([,v])=>v));
  const created:PlayerPet={id:randomUUID(),ownerId,species,name:validPetName(options.name??def.name,this.config),level:1,xp:0,vitality:this.config.vitality.initial,quality,stars:Math.max(0,Math.min(def.maxStars,Math.floor(options.stars??0))),stage:0,
   traits,knownSkills:[],equippedSkills:this.config.skillSlots.map(()=>null),gear:Object.fromEntries(this.config.equipment.slots.map(slot=>[slot,null])),equipped:false,locked:false,obtainedAt:new Date().toISOString(),source:options.source.slice(0,40),evolution:{}};
  refreshKnownSkills(created);placeLearned(created,this.config);tx.pets.push(created);event(tx,'PET_OBTAINED',created,{species,quality,source:created.source});
  return created;
 }
 /**
  * A one-time gift (the starter pet): given once per player and key, with its food, and sent to battle when
  * the player has no pet out. Returns null when it was already received or the species is off.
  */
 async gift(ownerId:string,gift:{key:string;species:string;food?:Record<string,number>;equip?:boolean}):Promise<PetOutcome|null>{
  const def=petSpecies(gift.species);if(!def?.enabled)return null;
  let given=false;
  const outcome=await this.act(ownerId,'grant',tx=>{
   const gifts=tx.profile.petGifts??[];if(gifts.includes(gift.key)||tx.pets.length>=this.config.maxOwned)return {message:''};
   tx.profile.petGifts=[...gifts,gift.key];
   const pet=this.create(tx,ownerId,gift.species,def.qualities[0],{source:`gift:${gift.key}`});
   if(gift.equip!==false&&!tx.pets.some(p=>p.equipped)){pet.equipped=true;event(tx,'PET_EQUIPPED',pet,{});}
   for(const [food,n] of Object.entries(gift.food??{}))if(PET_FOODS.has(food)&&n>0)tx.profile.petFood[food]=(tx.profile.petFood[food]??0)+Math.floor(n);
   given=true;return {petId:pet.id,message:`Você recebeu ${pet.name}! Ela já está pronta para lutar ao seu lado.`};
  });
  return given?outcome:null;
 }
 equip(ownerId:string,petId:string){return this.act(ownerId,'equip',tx=>{
  const pet=ownPet(tx,petId);if(!petSpecies(pet.species))throw Error('Este pet ainda não está disponível.');
  if(pet.equipped)return {petId,message:`${pet.name} já está com você.`};
  // One active pet (configurable): the oldest equipped ones step back first.
  const active=tx.pets.filter(p=>p.equipped);
  for(const previous of active.slice(0,Math.max(0,active.length-this.config.maxEquipped+1))){previous.equipped=false;event(tx,'PET_UNEQUIPPED',previous,{replacedBy:pet.id});}
  pet.equipped=true;event(tx,'PET_EQUIPPED',pet,{vitality:pet.vitality});
  return {petId,message:pet.vitality>0?`${pet.name} agora acompanha você.`:`${pet.name} está sem vitalidade: alimente-o para ativar os bônus.`};
 });}
 unequip(ownerId:string,petId:string){return this.act(ownerId,'unequip',tx=>{
  const pet=ownPet(tx,petId);if(!pet.equipped)return {petId,message:`${pet.name} já estava descansando.`};
  pet.equipped=false;event(tx,'PET_UNEQUIPPED',pet);return {petId,message:`${pet.name} foi descansar.`};
 });}
 rename(ownerId:string,petId:string,name:string){return this.act(ownerId,'rename',tx=>{
  const pet=ownPet(tx,petId),clean=validPetName(name,this.config),from=pet.name;pet.name=clean;event(tx,'PET_RENAMED',pet,{from,to:clean});return {petId,message:`Agora ele se chama ${clean}.`};
 });}
 setLocked(ownerId:string,petId:string,locked:boolean){return this.act(ownerId,'lock',tx=>{
  const pet=ownPet(tx,petId);if(pet.locked!==locked){pet.locked=locked;event(tx,locked?'PET_LOCKED':'PET_UNLOCKED',pet);}
  return {petId,message:locked?`${pet.name} está protegido.`:`${pet.name} não está mais protegido.`};
 });}
 release(ownerId:string,petId:string,confirmName:string){return this.act(ownerId,'release',tx=>{
  const pet=ownPet(tx,petId);
  if(pet.locked)throw Error('Desbloqueie o pet antes de liberá-lo.');
  if(pet.equipped)throw Error('Desequipe o pet antes de liberá-lo.');
  if(confirmName.trim()!==pet.name)throw Error('Digite o nome do pet para confirmar.');
  tx.pets.splice(tx.pets.indexOf(pet),1);event(tx,'PET_RELEASED',pet,{species:pet.species,level:pet.level,stars:pet.stars});
  return {petId,message:`${pet.name} foi liberado.`};
 });}
 feed(ownerId:string,petId:string,foodId:string,quantity:number){return this.act(ownerId,'feed',async tx=>{
  const pet=ownPet(tx,petId),food=PET_FOODS.get(foodId);if(!food)throw Error('Alimento desconhecido.');
  const owned=tx.profile.petFood[foodId]??0,asked=Math.floor(quantity);
  if(!(asked>=1))throw Error('Escolha quantos alimentos usar.');
  if(owned<asked)throw Error('Você não tem alimentos suficientes.');
  if(food.species.length&&!food.species.includes(pet.species))throw Error('Este pet não come este alimento.');
  if(pet.level<food.minLevel)throw Error(`Este alimento é para pets a partir do nível ${food.minLevel}.`);
  if(asked>food.maxPerUse)throw Error(`Use até ${food.maxPerUse} de uma vez.`);
  if(food.dailyLimit!==undefined){const eaten=await tx.fedToday(pet.id,foodId);if(eaten+asked>food.dailyLimit)throw Error(`Hoje este pet só pode comer mais ${Math.max(0,food.dailyLimit-eaten)}.`);}
  // Never more units than the pet can use: a full pet that gains no EXP eats nothing.
  const missing=this.config.vitality.max-pet.vitality,xpUseful=!!food.xp&&!atMaxLevel(pet,this.config);
  const needed=food.vitality>0?Math.ceil(missing/food.vitality):0,used=xpUseful?asked:Math.min(asked,needed);
  if(used<=0)throw Error(`${pet.name} está satisfeito.`);
  const before=pet.vitality;pet.vitality=Math.min(this.config.vitality.max,pet.vitality+food.vitality*used);
  tx.profile.petFood[foodId]=owned-used;if(!tx.profile.petFood[foodId])delete tx.profile.petFood[foodId];
  const xp=food.xp*used;let levelText='';
  if(xp){const outcome=this.addXp(tx,pet,xp,'food');if(outcome.levelsGained)levelText=` Subiu para o nível ${pet.level}!`;}
  await tx.recordFeeding({petId:pet.id,food:foodId,quantity:used,vitalityBefore:before,vitalityAfter:pet.vitality,xp});
  event(tx,'PET_FED',pet,{food:foodId,quantity:used,vitality:pet.vitality-before,xp});
  if(pet.vitality!==before)event(tx,'PET_VITALITY_CHANGED',pet,{from:before,to:pet.vitality,reason:'food'});
  return {petId,message:`${pet.name} comeu ${used} ${food.name}: +${pet.vitality-before} de vitalidade.${levelText}`};
 });}
 setSkillSlot(ownerId:string,petId:string,slot:number,skill:string|null){return this.act(ownerId,'skill-slot',tx=>{
  const pet=ownPet(tx,petId);if(slot<0||slot>=this.config.skillSlots.length)throw Error('Espaço de habilidade inválido.');
  while(pet.equippedSkills.length<this.config.skillSlots.length)pet.equippedSkills.push(null);
  if(skill===null){const removed=pet.equippedSkills[slot];pet.equippedSkills[slot]=null;if(removed)event(tx,'PET_SKILL_UNEQUIPPED',pet,{slot,skill:removed});return {petId,message:'Espaço liberado.'};}
  const problem=skillSlotProblem(pet,slot,skill,this.config);if(problem)throw Error(problem);
  // A skill sits in one slot only: moving it frees the old slot.
  pet.equippedSkills=pet.equippedSkills.map((id,i)=>id===skill&&i!==slot?null:id);pet.equippedSkills[slot]=skill;
  event(tx,'PET_SKILL_EQUIPPED',pet,{slot,skill});return {petId,message:'Habilidade equipada.'};
 });}
 /** EXP through the one progression service: levels, skills learned, slots opened, events. */
 protected addXp(tx:PetTx,pet:PlayerPet,amount:number,source:string){
  const outcome=gainPetXp(pet,amount,this.config);
  if(outcome.gained)event(tx,'PET_XP_GAINED',pet,{amount:outcome.gained,source});
  if(outcome.levelsGained)event(tx,'PET_LEVEL_UP',pet,{from:outcome.from,to:outcome.to,slots:outcome.unlockedSlots});
  if(outcome.evolved)event(tx,'PET_EVOLVED',pet,{...outcome.evolved,kind:'level'});
  for(const skill of outcome.unlockedSkills)event(tx,'PET_SKILL_UNLOCKED',pet,{skill});
  return outcome;
 }
 async settleBattle(battleId:string,entries:BattlePetEntry[]){
  const out=new Map<string,PetOutcome>(),cfg=this.config;
  for(const entry of [...entries].sort((a,b)=>a.ownerId.localeCompare(b.ownerId))){
   if(entry.mode==='pvp'&&!cfg.battles.pvp||entry.mode==='pve'&&!cfg.battles.pve)continue;
   const outcome=await this.act(entry.ownerId,'battle',async tx=>{
    const pet=tx.pets.find(p=>p.id===entry.petId);if(!pet||pet.vitality<=0)return {message:''};
    const sources=cfg.progression.sources,xp=entry.mode==='pvp'?(entry.won?sources.pvpWin:sources.pvpLoss):(entry.won?sources.pveWin:sources.pveLoss);
    const cost=Math.min(pet.vitality,cfg.vitality.battleCost[entry.mode]);
    if(!await tx.claimBattle(battleId,entry,{xp,vitality:cost}))return {message:''};
    const before=pet.vitality;pet.vitality-=cost;
    if(cost)event(tx,'PET_VITALITY_CHANGED',pet,{from:before,to:pet.vitality,reason:'battle',battleId});
    const gained=this.addXp(tx,pet,xp,`battle:${battleId}`);
    event(tx,'PET_BATTLE_SETTLED',pet,{battleId,mode:entry.mode,won:entry.won,xp:gained.gained,vitality:-cost});
    return {petId:pet.id,message:`${pet.name} ganhou ${gained.gained} de EXP${gained.levelsGained?` e subiu para o nível ${pet.level}`:''}.${gained.evolved?` Evoluiu para ${petSpecies(pet.species)?.stages[pet.stage]?.name??'um novo estágio'}!`:''}${pet.vitality<=0?' Ele está sem vitalidade: alimente-o.':''}`};
   });
   if(outcome.result.events.length)out.set(entry.ownerId,outcome);
  }
  return out;
 }
}
/** True when the pet is already at its maximum level (EXP food is then useless). */
function atMaxLevel(pet:PlayerPet,config:PetConfig){const def=petSpecies(pet.species);return pet.level>=Math.min(config.progression.maxLevel,def?.maxLevel??config.progression.maxLevel);}

// ── Postgres ──
/** Versioned migrations, applied in order once (pet_migrations). Never edit an applied one: add a new version. */
export const PET_MIGRATIONS:readonly {version:number;name:string;sql:string}[]=[
 {version:1,name:'pet tables',sql:`
  CREATE TABLE IF NOT EXISTS player_pets(
   id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
   species varchar(40) NOT NULL,name varchar(16) NOT NULL,
   level int NOT NULL DEFAULT 1 CHECK(level>=1),xp bigint NOT NULL DEFAULT 0 CHECK(xp>=0),vitality int NOT NULL CHECK(vitality>=0),
   quality varchar(24) NOT NULL,stars int NOT NULL DEFAULT 0 CHECK(stars>=0),stage int NOT NULL DEFAULT 0 CHECK(stage>=0),
   traits jsonb NOT NULL DEFAULT '{}',known_skills jsonb NOT NULL DEFAULT '[]',equipped_skills jsonb NOT NULL DEFAULT '[]',
   gear jsonb NOT NULL DEFAULT '{}',evolution jsonb NOT NULL DEFAULT '{}',
   equipped boolean NOT NULL DEFAULT false,locked boolean NOT NULL DEFAULT false,
   source varchar(40) NOT NULL DEFAULT 'system',obtained_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS player_pets_owner ON player_pets(owner_id,obtained_at);
  CREATE INDEX IF NOT EXISTS player_pets_equipped ON player_pets(owner_id) WHERE equipped;
  -- Audit trail: kept after a pet is released, so no foreign key to player_pets.
  CREATE TABLE IF NOT EXISTS pet_events(id uuid PRIMARY KEY,pet_id uuid NOT NULL,owner_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
   kind varchar(32) NOT NULL,data jsonb NOT NULL DEFAULT '{}',at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS pet_events_owner ON pet_events(owner_id,at);
  CREATE INDEX IF NOT EXISTS pet_events_pet ON pet_events(pet_id,at);
  CREATE TABLE IF NOT EXISTS pet_feedings(id bigserial PRIMARY KEY,pet_id uuid NOT NULL REFERENCES player_pets(id) ON DELETE CASCADE,owner_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
   food varchar(48) NOT NULL,quantity int NOT NULL CHECK(quantity>0),vitality_before int NOT NULL,vitality_after int NOT NULL,xp int NOT NULL DEFAULT 0,day date NOT NULL,at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS pet_feedings_daily ON pet_feedings(pet_id,food,day);
  -- One row per (battle, pet): a battle result is applied once, whatever the retries or reconnects.
  CREATE TABLE IF NOT EXISTS pet_battle_results(battle_id uuid NOT NULL,pet_id uuid NOT NULL,owner_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
   mode varchar(8) NOT NULL,won boolean NOT NULL,xp int NOT NULL,vitality int NOT NULL,at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(battle_id,pet_id));`}
];
const json=(value:unknown)=>JSON.stringify(value);
function petRow(row:Record<string,unknown>):PlayerPet{
 return {id:row.id as string,ownerId:row.owner_id as string,species:row.species as string,name:row.name as string,level:Number(row.level),xp:Number(row.xp),vitality:Number(row.vitality),quality:row.quality as string,stars:Number(row.stars),stage:Number(row.stage),
  traits:cleanStats(row.traits),knownSkills:Array.isArray(row.known_skills)?row.known_skills as PlayerPet['knownSkills']:[],equippedSkills:Array.isArray(row.equipped_skills)?row.equipped_skills as PlayerPet['equippedSkills']:[],
  gear:(row.gear??{}) as PlayerPet['gear'],equipped:row.equipped===true,locked:row.locked===true,obtainedAt:new Date(row.obtained_at as string).toISOString(),source:row.source as string,evolution:(row.evolution??{}) as PlayerPet['evolution']};
}
export class PetStore extends PetService {
 constructor(private pool:pg.Pool,config?:PetConfig,rng?:()=>number){super(config,rng);}
 async init(){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('pet_migrations'))");
   await c.query('CREATE TABLE IF NOT EXISTS pet_migrations(version int PRIMARY KEY,name varchar(80) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   const done=new Set((await c.query('SELECT version FROM pet_migrations')).rows.map(r=>Number(r.version)));
   for(const migration of PET_MIGRATIONS)if(!done.has(migration.version)){await c.query(migration.sql);await c.query('INSERT INTO pet_migrations(version,name) VALUES($1,$2)',[migration.version,migration.name]);}
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 /** Postgres may abort one of two crossing transactions (a deadlock, 40P01): the pet action is simply run again. */
 protected async transact<T>(ownerId:string,run:(tx:PetTx)=>Promise<T>|T){
  for(let attempt=1;;attempt++){
   try{return await this.once(ownerId,run);}
   catch(e){if((e as {code?:string}).code!=='40P01'||attempt>=3)throw e;}
  }
 }
 private async once<T>(ownerId:string,run:(tx:PetTx)=>Promise<T>|T){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[ownerId]);if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}),beforeProfile=json({pet:profile.equipment.pet,food:profile.petFood,gifts:profile.petGifts});
   const pets=(await c.query('SELECT * FROM player_pets WHERE owner_id=$1 ORDER BY obtained_at,id FOR UPDATE',[ownerId])).rows.map(petRow);
   const original=new Map(pets.map(p=>[p.id,json(p)]));
   const tx:PetTx={profile,pets,events:[],
    fedToday:async(petId,food)=>Number((await c.query('SELECT coalesce(sum(quantity),0)::int AS n FROM pet_feedings WHERE pet_id=$1 AND food=$2 AND day=$3',[petId,food,petDay()])).rows[0].n),
    recordFeeding:async e=>{await c.query('INSERT INTO pet_feedings(pet_id,owner_id,food,quantity,vitality_before,vitality_after,xp,day) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[e.petId,ownerId,e.food,e.quantity,e.vitalityBefore,e.vitalityAfter,e.xp,petDay()]);},
    claimBattle:async(battleId,entry,applied)=>!!(await c.query('INSERT INTO pet_battle_results(battle_id,pet_id,owner_id,mode,won,xp,vitality) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING pet_id',[battleId,entry.petId,ownerId,entry.mode,entry.won,applied.xp,applied.vitality])).rowCount};
   const value=await run(tx);
   const kept=new Set(tx.pets.map(p=>p.id));
   for(const id of original.keys())if(!kept.has(id))await c.query('DELETE FROM player_pets WHERE id=$1 AND owner_id=$2',[id,ownerId]);
   for(const p of tx.pets){
    const values=[p.id,ownerId,p.species,p.name,p.level,p.xp,p.vitality,p.quality,p.stars,p.stage,json(p.traits),json(p.knownSkills),json(p.equippedSkills),json(p.gear),json(p.evolution),p.equipped,p.locked,p.source,p.obtainedAt];
    if(!original.has(p.id))await c.query('INSERT INTO player_pets(id,owner_id,species,name,level,xp,vitality,quality,stars,stage,traits,known_skills,equipped_skills,gear,evolution,equipped,locked,source,obtained_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',values);
    else if(original.get(p.id)!==json(p))await c.query('UPDATE player_pets SET name=$3,level=$4,xp=$5,vitality=$6,quality=$7,stars=$8,stage=$9,traits=$10,known_skills=$11,equipped_skills=$12,gear=$13,evolution=$14,equipped=$15,locked=$16 WHERE id=$1 AND owner_id=$2',[p.id,ownerId,...values.slice(3,17)]);
   }
   PetService.wear(profile,tx.pets,this.config);
   if(json({pet:profile.equipment.pet,food:profile.petFood,gifts:profile.petGifts})!==beforeProfile)await c.query('UPDATE players SET profile=$2 WHERE id=$1',[ownerId,profile]);
   for(const e of tx.events)await c.query('INSERT INTO pet_events(id,pet_id,owner_id,kind,data,at) VALUES($1,$2,$3,$4,$5,$6)',[e.id,e.petId,e.ownerId,e.kind,json(e.data),e.at]);
   await c.query('COMMIT');return {value,profile,pets:tx.pets};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
