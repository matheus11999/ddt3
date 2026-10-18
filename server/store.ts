import {SHOP_OFFER_BY_ID,MAX_SHOP_ITEMS,CONSUMABLE_OFFER_BY_ID,isConsumableOffer} from '../shared/shop';
import {COLOR_SLOTS,isBodyColorPart,isPaletteColor,MAX_COLOR_TICKETS,STARTER_COLOR_TICKETS,equippedColors,isColorSlot,normalizeBodyColors,normalizeItemColors} from '../shared/colors';
import type {MatchBonuses} from '../shared/rewards';
import pg from 'pg';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {ARMOR_SLOTS,isArmorSlot,canStrengthen,canEquipItem,CATALOG,copyBase,equippedCompositions,equippedCopy,isCopyKey,nextCopyKey,heldInSiblingSlot,slotAccepts,CHARACTER_GENDERS,CONTENT_VERSION,isEmptyItem,ITEMS,LEGACY_DYE_COLORS,MAX_UPGRADE,normalizeVisibility,RETIRED_COSMETIC_REPLACEMENTS,RETIRED_OUTFIT_REPLACEMENTS,SLOT_NAMES,starterEquipment,STARTER_COSTUMES,STARTER_STONES,STONES,unequipForGender,upgradeChance,WEAPONS,slotsForItem} from '../shared/catalog';
import type {CharacterGender,Equipment,Slot} from '../shared/catalog';
import {canCompose,COMPOSITION_STONES,COMPOSITION_STONE_BY_ID,normalizeCompositions,STARTER_COMPOSITION_STONES} from '../shared/composition';
import {abilityLoadoutSchema,equipmentVisibilitySchema,stoneSelectionSchema} from '../shared/protocol';
import {normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityLoadout} from '../shared/abilities';
import {levelForXp,normalizeLevel} from '../shared/progression';
import {guildChance} from '../shared/guilds';
import {normalizePetSnapshot,PET_FOODS} from '../shared/pets';
import type {ColorChange,ColorResult,CompositionResult,ForgeResult,Profile,RankingEntry,ShopResult} from '../shared/protocol';
export interface ForgeOutcome {profile:Profile;result:ForgeResult;}
export interface CompositionOutcome {profile:Profile;result:CompositionResult;}
export interface ShopOutcome {profile:Profile;result:ShopResult;}
export interface ColorOutcome {profile:Profile;result:ColorResult;}
export interface ProfileStore {buy(id:string,items:string[],quantity?:number):Promise<ShopOutcome>;paint?(id:string,changes:readonly ColorChange[]):Promise<ColorOutcome>;discard?(id:string,item:string):Promise<Profile>;saveEquipment(id:string,equipment:Equipment):Promise<Profile>;saveAbilityLoadout(id:string,slots:AbilityLoadout):Promise<Profile>;/** `bonus`: success points added by the Ferreiro da Guilda (shared/guilds.ts). */forge(id:string,item:string,stones:Record<string,number>,bonus?:number):Promise<ForgeOutcome>;compose(id:string,item:string,stone:string,bonus?:number):Promise<CompositionOutcome>;dailyRanking?():Promise<RankingEntry[]>;rename(id:string,name:string):Promise<void>;finishMatch(matchId:string,winners:string[],players:string[],bonuses?:MatchBonuses):Promise<void>;/** An expedition stage: fixed award plus each player's card; no PvP match, win or ranking. */finishExpedition?(stageId:string,players:string[],award:{coins:number;xp:number},bonuses?:MatchBonuses):Promise<void>;getProfile(id:string):Promise<Profile|null>;}

/** One reward card into the profile: coins, EXP, forge stones or Color Tickets. */
export function applyPrize(p:Profile,prize:MatchBonuses[string]|undefined){
 if(!prize)return;const amount=integer(prize.amount);
 if(prize.kind==='coins')p.gold+=amount;else if(prize.kind==='xp')p.xp+=amount;
 else if(prize.kind==='stone'){const tier=String(Math.max(1,Math.min(5,integer(prize.level??1))));p.stones[tier]=(p.stones[tier]??0)+amount;}
 else if(prize.kind==='ticket')p.colorTickets=Math.min(MAX_COLOR_TICKETS,p.colorTickets+amount);
}
export const RANKING_TIME_ZONE='America/Sao_Paulo';

type StoredProfile = Partial<Omit<Profile,'equipment'>> & Pick<Profile,'id'|'name'> & {equipment?:Partial<Equipment>&{dyes?:Record<string,string>}};
const integer=(value:unknown,fallback=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(0,Math.floor(value))):fallback;

const SHOP_ONLY_COSMETICS=new Set(['necklace-guild-1','love-boomerang','hair-undercut','hair-ponytail','hair-horizon','glasses-sport','glasses-cat','glasses-navigator','face-wink','hat-thunder','hat-tide','hat-ruby','hat-tropical']);

// Missing fields are migrated once on read; an empty stone stack stays empty.
export function normalizeProfile(raw:StoredProfile):Profile {
 // Legacy profiles only infer once: a stored, valid gender always wins over clothing.
 const gender:CharacterGender=raw.gender==='male'||raw.gender==='female'?raw.gender:raw.equipment?.outfit==='outfit-dancer'?'female':'male';
 const defaults=starterEquipment(gender),unequip=unequipForGender(gender);
 // Extra copies (`id~2`) are kept only alongside the first copy, which keeps the plain id.
 const inventory=Array.isArray(raw.inventory)?[...new Set(raw.inventory.filter(id=>Object.hasOwn(CATALOG,id)&&!isEmptyItem(id)))]:ITEMS.filter(i=>!SHOP_ONLY_COSMETICS.has(i.id)&&!isEmptyItem(i)&&canEquipItem(i,gender)).map(i=>i.id);
 if(!raw.upgrades&&(raw.contentVersion??0)<1&&!inventory.includes(defaults.hat))inventory.push(defaults.hat);
 if((raw.contentVersion??0)<5){for(const item of ITEMS)if(item.visual&&!isEmptyItem(item)&&!SHOP_ONLY_COSMETICS.has(item.id)&&canEquipItem(item,gender)&&!inventory.includes(item.id))inventory.push(item.id);}
 // Retired outfits migrate once to the current starter; never replenish unrelated items.
 if((raw.contentVersion??0)<7&&(!raw.equipment?.outfit||!CATALOG[raw.equipment.outfit])){
  if(!inventory.includes(defaults.outfit))inventory.push(defaults.outfit);
 }
 // Replace owned prototypes, including the equipped variant, without refilling other purchases.
 const replacements={...(raw.contentVersion??0)<10?RETIRED_COSMETIC_REPLACEMENTS:{},...(raw.contentVersion??0)<15?RETIRED_OUTFIT_REPLACEMENTS:{}};
 for(const id of raw.inventory??[]){const replacement=Object.hasOwn(replacements,id)?replacements[id]:undefined;if(replacement&&!inventory.includes(replacement))inventory.push(replacement);}
 if((raw.contentVersion??0)<12)for(const id of STARTER_COSTUMES)if(!inventory.includes(id))inventory.push(id);
 if(Array.isArray(raw.inventory))for(const key of raw.inventory)if(typeof key==='string'&&isCopyKey(key)&&inventory.includes(copyBase(key))&&!inventory.includes(key))inventory.push(key);
 const weaponCopies=inventory.filter(key=>isCopyKey(key)&&CATALOG[copyBase(key)]?.slot==='weapon');
 const upgrades=Object.fromEntries([...WEAPONS.map(w=>w.id),...weaponCopies].map(key=>[key,integer(raw.upgrades?.[key],0,MAX_UPGRADE)]));
 // Hats and outfits keep a forge level only once they have one (their Armadura grows with it, shared/stats.ts).
 for(const key of inventory)if(isArmorSlot(CATALOG[copyBase(key)]?.slot)){const level=integer(raw.upgrades?.[key],0,MAX_UPGRADE);if(level>0)upgrades[key]=level;}
 const stones=Object.fromEntries(STONES.map(s=>[String(s.level),raw.stones?integer(raw.stones[String(s.level)]):STARTER_STONES[String(s.level)]]));
 const migratedCompositions={...raw.compositions};
 for(const [oldId,newId] of Object.entries(replacements))if(raw.inventory?.includes(oldId)&&raw.compositions?.[oldId]){
  const previous=migratedCompositions[newId]??{};
  migratedCompositions[newId]={...previous,...Object.fromEntries(Object.entries(raw.compositions[oldId]).map(([stat,value])=>[stat,Math.max(value??0,previous[stat as keyof typeof previous]??0)]))};
 }
 const compositions=normalizeCompositions(migratedCompositions,inventory.map(id=>CATALOG[id]).filter(Boolean));
 // Each extra copy keeps its own compositions under its copy key.
 for(const key of inventory.filter(isCopyKey)){const own=normalizeCompositions({[copyBase(key)]:(raw.compositions as Record<string,unknown>|undefined)?.[key]},[CATALOG[copyBase(key)]])[copyBase(key)];if(own)compositions[key]=own;}
 const compositionStones=Object.fromEntries(COMPOSITION_STONES.map(stone=>[stone.id,raw.compositionStones?integer(raw.compositionStones[stone.id]):(raw.contentVersion??0)<8?STARTER_COMPOSITION_STONES[stone.id]:0]));
 // Sorte stones arrived with content version 14: existing adventurers get the same starter set once.
 if((raw.contentVersion??0)<14&&raw.compositionStones)for(const stone of COMPOSITION_STONES)if(stone.stat==='luck')compositionStones[stone.id]=Math.max(compositionStones[stone.id],STARTER_COMPOSITION_STONES[stone.id]);
 const equipment={...defaults};
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){
  const saved=raw.equipment?.[slot],id=saved?(Object.hasOwn(replacements,saved)?replacements[saved]:saved):undefined;
  if(id&&Object.hasOwn(CATALOG,id)&&slotAccepts(slot,CATALOG[id])&&(inventory.includes(id)||isEmptyItem(id))&&canEquipItem(id,gender)&&!heldInSiblingSlot(equipment,slot,id))equipment[slot]=id;
  else equipment[slot]=isEmptyItem(defaults[slot])||inventory.includes(defaults[slot])?defaults[slot]:inventory.find(owned=>CATALOG[owned]?.slot===slot&&canEquipItem(owned,gender))??unequip[slot]??defaults[slot];
  // Every equipped fallback must actually be owned, including sparse historical profiles.
  if(!isEmptyItem(equipment[slot])&&!inventory.includes(equipment[slot]))inventory.push(equipment[slot]);
 }
 const copies=validCopies(raw.equipment?.copies,equipment,inventory);if(Object.keys(copies).length)equipment.copies=copies;
 equipment.visibility=normalizeVisibility(raw.equipment?.visibility);
 const itemColors=normalizeItemColors(raw.itemColors,inventory);
 // The retired free dyes become the ticket color of the copy that wore them.
 if(raw.itemColors===undefined&&raw.equipment?.dyes)for(const slot of COLOR_SLOTS){const hex=LEGACY_DYE_COLORS[raw.equipment.dyes[slot]];const key=equippedCopy(equipment,slot);if(hex&&!isEmptyItem(key))itemColors[key]=hex;}
 const xp=integer(raw.xp);
 // Experience earned at the former cap immediately counts toward the new levels.
 const level=Math.max(normalizeLevel(integer(raw.level,1)),levelForXp(xp));
 const profile:Profile={id:raw.id,name:raw.name,gender,level,xp,gold:integer(raw.gold),coupons:integer(raw.coupons),wins:integer(raw.wins),matches:integer(raw.matches),equipment,inventory,equippedOnce:raw.equippedOnce===true,upgrades,stones,compositions,compositionStones,contentVersion:CONTENT_VERSION,abilityLoadout:normalizeAbilityLoadout(raw.abilityLoadout),
  itemColors,bodyColors:normalizeBodyColors(raw.bodyColors),colorTickets:raw.colorTickets===undefined?STARTER_COLOR_TICKETS:integer(raw.colorTickets,0,MAX_COLOR_TICKETS),
  petFood:Object.fromEntries(Object.entries(raw.petFood??{}).filter(([food,n])=>PET_FOODS.has(food)&&integer(n)>0).map(([food,n])=>[food,integer(n)]))};
 // The active pet's snapshot is written only by server/pets.ts; here it is just checked.
 const pet=normalizePetSnapshot(raw.equipment?.pet);if(pet)profile.equipment.pet=pet;
 refreshWorn(profile);return profile;
}

/** Keeps only the copy keys that are owned and match the item in their slot. */
function validCopies(value:unknown,equipment:Record<Slot,string>,inventory:readonly string[]):Partial<Record<Slot,string>> {
 if(!value||typeof value!=='object')return {};
 const result:Partial<Record<Slot,string>>={};
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const key=(value as Record<string,unknown>)[slot];if(typeof key==='string'&&isCopyKey(key)&&inventory.includes(key)&&copyBase(key)===equipment[slot])result[slot]=key;}
 // A copy can only be worn in one slot of a family (two ring slots).
 const seen=new Set<string>();for(const [slot,key] of Object.entries(result))if(seen.has(key))delete result[slot as Slot];else seen.add(key);
 return result;
}
/** Everything renderers and battles read from the equipment comes from the copies actually worn. */
export function refreshWorn(profile:Profile){
 const equipment=profile.equipment;
 equipment.upgrade=profile.upgrades[equippedCopy(equipment,'weapon')]??0;
 const slotUpgrades=Object.fromEntries(ARMOR_SLOTS.map(slot=>[slot,profile.upgrades[equippedCopy(equipment,slot)]??0]).filter(([,level])=>level));
 if(Object.keys(slotUpgrades).length)equipment.slotUpgrades=slotUpgrades;else delete equipment.slotUpgrades;
 delete equipment.compositions;delete equipment.colors;delete equipment.skin;delete equipment.eyes;delete (equipment as {dyes?:unknown}).dyes;
 const worn=equippedCompositions(equipment,profile.compositions);if(Object.keys(worn).length)equipment.compositions=worn;
 const colors=equippedColors(equipment,profile.itemColors);if(Object.keys(colors).length)equipment.colors=colors;
 if(profile.bodyColors.skin)equipment.skin=profile.bodyColors.skin;
 if(profile.bodyColors.eyes)equipment.eyes=profile.bodyColors.eyes;
}
/** Takes one owned copy out of the profile and returns what made it unique (forge level, compositions, color).
 * The plain id always stays with a remaining copy: when it leaves, the newest copy moves into it. */
export function removeCopy(profile:Profile,item:string):{upgrade?:number;compositions?:Profile['compositions'][string];color?:string}{
 const base=copyBase(item),equipment=profile.equipment;
 const kept={upgrade:profile.upgrades[item],compositions:profile.compositions[item],color:profile.itemColors[item]};
 const forget=(key:string)=>{profile.inventory=profile.inventory.filter(owned=>owned!==key);delete profile.upgrades[key];delete profile.compositions[key];delete profile.itemColors[key];};
 const copies=profile.inventory.filter(key=>isCopyKey(key)&&copyBase(key)===base);
 if(item===base&&copies.length){
  const last=copies.sort((a,b)=>Number(a.split('~')[1])-Number(b.split('~')[1])).at(-1)!;
  const move=<T,>(record:Record<string,T>)=>{if(Object.hasOwn(record,last))record[base]=record[last];else delete record[base];};
  move(profile.upgrades);move(profile.compositions);move(profile.itemColors);
  for(const slot of Object.keys(equipment.copies??{}) as Slot[])if(equipment.copies?.[slot]===last)delete equipment.copies[slot];
  forget(last);
 }else forget(item);
 if(equipment.copies&&!Object.keys(equipment.copies).length)delete equipment.copies;
 return kept;
}
/** Item types the character always wears something of: the last owned one cannot be discarded. */
const ALWAYS_WORN=new Set(['weapon','outfit','face']);

export class Store implements ProfileStore {
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa',max:12});
 constructor(private readonly roll:()=>number=()=>randomInt(1000)){}
 async init(){await this.pool.query(`
 CREATE TABLE IF NOT EXISTS players(id uuid PRIMARY KEY,name varchar(24) NOT NULL,profile jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS sessions(token_hash char(64) PRIMARY KEY,player_id uuid REFERENCES players(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions(expires_at);
 CREATE TABLE IF NOT EXISTS matches(id uuid PRIMARY KEY,winners jsonb NOT NULL,players jsonb NOT NULL,finished_at timestamptz NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS matches_finished ON matches(finished_at);
 DELETE FROM sessions WHERE expires_at<now();
 `);}
 hash(token:string){return createHash('sha256').update(token).digest('hex');}
 async session(token:string|undefined):Promise<Profile|null>{if(!token||!/^[0-9a-f]{64}$/.test(token))return null;const r=await this.pool.query('SELECT p.profile,p.name FROM sessions s JOIN players p ON p.id=s.player_id WHERE token_hash=$1 AND expires_at>now()',[this.hash(token)]);return r.rows[0]?normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}):null;}
 async createGuest(gender:CharacterGender='male'){
  if(!CHARACTER_GENDERS.includes(gender))throw Error('Escolha um personagem masculino ou feminino.');
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const equipment=starterEquipment(gender);
  const profile=normalizeProfile({id,name:`Aventureiro${randomBytes(2).readUInt16BE()%10000}`,gender,level:1,xp:0,gold:500,wins:0,matches:0,equipment,inventory:[...new Set([...Object.values(equipment),...Object.values(unequipForGender(gender)),...STARTER_COSTUMES])].filter((id):id is string=>typeof id==='string'&&Object.hasOwn(CATALOG,id)&&!isEmptyItem(id)),contentVersion:CONTENT_VERSION,compositionStones:{...STARTER_COMPOSITION_STONES},equippedOnce:false});
  const conn=await this.pool.connect();try{await conn.query('BEGIN');await conn.query('INSERT INTO players(id,name,profile) VALUES($1,$2,$3)',[id,profile.name,profile]);await conn.query("INSERT INTO sessions VALUES($1,$2,now()+interval '30 days')",[this.hash(token),id]);await conn.query('COMMIT');}catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
  return {token,profile};
 }
 async getProfile(id:string){const r=await this.pool.query('SELECT profile,name FROM players WHERE id=$1',[id]);return r.rows[0]?normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}):null;}
 async saveAbilityLoadout(id:string,slots:AbilityLoadout):Promise<Profile>{
  const parsed=abilityLoadoutSchema.safeParse(slots);if(!parsed.success)throw Error('Escolha até três habilidades diferentes.');
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});profile.abilityLoadout=[...parsed.data];
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return profile;
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 }
 async saveEquipment(id:string,equipment:Equipment):Promise<Profile>{
  const visibility=equipmentVisibilitySchema.safeParse(equipment.visibility??{});if(!visibility.success)throw Error('Preferências de visual inválidas.');
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const item=CATALOG[equipment[slot]];if(!item||!slotAccepts(slot,item)||heldInSiblingSlot(equipment,slot,item.id)||(!isEmptyItem(item)&&!profile.inventory.includes(item.id)))throw Error('Este item não está na sua mochila.');if(!canEquipItem(item,profile.gender))throw Error('Este item não é compatível com o gênero do seu personagem.');}
   const selected=Object.fromEntries((Object.keys(SLOT_NAMES) as Slot[]).map(slot=>[slot,equipment[slot]])) as Record<Slot,string>;
   const copies=validCopies(equipment.copies,selected,profile.inventory);
   if(Object.keys(equipment.copies??{}).some(slot=>!copies[slot as Slot]&&isCopyKey(String(equipment.copies?.[slot as Slot]))))throw Error('Esta cópia não está na sua mochila.');
   // The pet snapshot never comes from the client: it stays as server/pets.ts saved it.
   profile.equipment={...selected,visibility:normalizeVisibility(visibility.data),upgrade:0,...(Object.keys(copies).length?{copies}:{}),...(profile.equipment.pet?{pet:profile.equipment.pet}:{})};
   refreshWorn(profile);
   profile.equippedOnce=true;
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return profile;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async forge(id:string,item:string,selection:Record<string,number>,bonus=0):Promise<ForgeOutcome>{
  const parsed=stoneSelectionSchema.safeParse(selection);if(!parsed.success)throw Error('Selecione de 1 a 20 pedras válidas.');
  const consumed=Object.fromEntries(Object.entries(parsed.data).filter(([,quantity])=>quantity>0));
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   if(!canStrengthen(CATALOG[copyBase(item)])||!profile.inventory.includes(item))throw Error('Escolha uma arma, roupa ou chapéu da sua mochila.');
   const level=profile.upgrades[item]??0;if(level>=MAX_UPGRADE)throw Error('Este equipamento já está no nível máximo.');
   for(const [tier,quantity] of Object.entries(consumed))if((profile.stones[tier]??0)<quantity)throw Error('Você não tem essas pedras na mochila.');
   const chance=guildChance(upgradeChance(level,consumed),bonus),success=this.roll()<Math.round(chance*10);
   for(const [tier,quantity] of Object.entries(consumed))profile.stones[tier]-=quantity;
   if(success)profile.upgrades[item]=level+1;
   refreshWorn(profile);
   const result:ForgeResult={item,success,level:profile.upgrades[item],chance,consumed};
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return {profile,result};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async compose(id:string,item:string,stoneId:string,bonus=0):Promise<CompositionOutcome>{
  const stone=Object.hasOwn(COMPOSITION_STONE_BY_ID,stoneId)?COMPOSITION_STONE_BY_ID[stoneId]:undefined;
  if(!stone)throw Error('Escolha uma pedra de composição válida.');
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   if(!profile.inventory.includes(item)||!canCompose(CATALOG[copyBase(item)]))throw Error('Escolha um equipamento compatível da sua mochila.');
   const previous=profile.compositions[item]?.[stone.stat]??0;
   if(stone.value<=previous)throw Error('Este atributo já possui uma composição igual ou melhor.');
   if((profile.compositionStones[stoneId]??0)<1)throw Error('Você não tem essa pedra de composição.');
   if(profile.gold<stone.cost)throw Error('Ouro insuficiente para esta composição.');
   const chance=guildChance(stone.chance,bonus),success=this.roll()<Math.round(chance*10);
   profile.compositionStones[stoneId]--;profile.gold-=stone.cost;
   if(success)profile.compositions[item]={...profile.compositions[item],[stone.stat]:stone.value};
   refreshWorn(profile);
   const result:CompositionResult={item,stone:stoneId,stat:stone.stat,success,previous,value:profile.compositions[item]?.[stone.stat]??0,chance,cost:stone.cost};
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return {profile,result};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async buy(id:string,items:string[],quantity=1):Promise<ShopOutcome>{
  if(!Array.isArray(items)||items.length<1||items.length>MAX_SHOP_ITEMS||new Set(items).size!==items.length)throw Error('Confira os itens do carrinho.');
  if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('Escolha uma quantidade de 1 a 20.');
  // Consumables (the color ticket) are bought alone and by quantity; equipment always one each.
  const consumable=items.length===1&&isConsumableOffer(items[0])?CONSUMABLE_OFFER_BY_ID[items[0]]:undefined;
  if(!consumable&&quantity!==1)throw Error('Só consumíveis são comprados em quantidade.');
  const offers=consumable?[]:items.map(id=>Object.hasOwn(SHOP_OFFER_BY_ID,id)?SHOP_OFFER_BY_ID[id]:undefined);
  if(offers.some(offer=>!offer))throw Error('Um item não está disponível na loja.');
  const spent=consumable?consumable.price*quantity:offers.reduce((total,offer)=>total+offer!.price,0);
  return this.mutate(id,profile=>{
   if(!consumable&&items.some(item=>!canEquipItem(item,profile.gender)))throw Error('Este item não é compatível com o gênero do seu personagem.');
   if(profile.gold<spent)throw Error('Moedas Brasa insuficientes para esta compra.');
   profile.gold-=spent;
   if(consumable){if(profile.colorTickets+quantity>MAX_COLOR_TICKETS)throw Error('Sua mochila já tem tickets demais.');profile.colorTickets+=quantity;return {profile,result:{items:[...items],spent,quantity}};}
   // An item already owned arrives as a separate copy, with its own forge level and compositions.
   for(const item of items){const key=nextCopyKey(profile.inventory,item);profile.inventory.push(key);if(key!==item&&WEAPONS.some(w=>w.id===item))profile.upgrades[key]=0;}
   return {profile,result:{items:[...items],spent}};
  });
 }
 /** Paints several owned cosmetic copies, the skin and the eyes in one go, one color ticket per real change.
  * `null` restores the painted original. All or nothing: without enough tickets nothing changes. */
 async paint(id:string,changes:readonly ColorChange[]):Promise<ColorOutcome>{
  return this.mutate(id,profile=>{
   const applied:ColorChange[]=[],seen=new Set<string>();
   for(const change of changes){
    if(seen.has(change.target))throw Error('A mesma peça apareceu duas vezes.');seen.add(change.target);
    let now:string|null;
    if(isBodyColorPart(change.target))now=profile.bodyColors[change.target]??null;
    else{
     const base=CATALOG[copyBase(change.target)];
     if(!base||!profile.inventory.includes(change.target)||!isColorSlot(base.slot)||isEmptyItem(base))throw Error('Escolha um visual da sua mochila que possa mudar de cor.');
     now=profile.itemColors[change.target]??null;
    }
    if(now===change.color)continue;
    // Only the window's ready colors; a color painted before the palette existed stays until changed.
    if(!isPaletteColor(change.target,change.color))throw Error('Escolha uma das cores prontas da janela.');
    applied.push(change);
   }
   if(!applied.length)throw Error('Nada mudou: escolha uma cor diferente da atual.');
   if(profile.colorTickets<applied.length)throw Error(applied.length===1?'Você precisa de um Ticket de Cor. Compre na loja.':`Você precisa de ${applied.length} Tickets de Cor. Compre na loja.`);
   profile.colorTickets-=applied.length;
   for(const {target,color} of applied){
    if(isBodyColorPart(target)){if(color)profile.bodyColors[target]=color;else delete profile.bodyColors[target];}
    else if(color)profile.itemColors[target]=color;else delete profile.itemColors[target];
   }
   refreshWorn(profile);
   return {profile,result:{changes:applied,tickets:profile.colorTickets}};
  });
 }
 /** Throws an owned copy away for good, with its forge level, compositions and color. */
 async discard(id:string,item:string):Promise<Profile>{
  return (await this.mutate(id,profile=>{
   const base=CATALOG[copyBase(item)];
   if(!base||!profile.inventory.includes(item))throw Error('Este item não está na sua mochila.');
   const sameKind=profile.inventory.filter(key=>CATALOG[copyBase(key)]?.slot===base.slot&&canEquipItem(copyBase(key),profile.gender));
   if(ALWAYS_WORN.has(base.slot)&&sameKind.length<=1)throw Error(`Você precisa ficar com pelo menos um item de ${SLOT_NAMES[base.slot].toLowerCase()}.`);
   const equipment=profile.equipment,unequip=unequipForGender(profile.gender);
   const worn=slotsForItem(base).filter(slot=>equippedCopy(equipment,slot)===item);
   removeCopy(profile,item);
   for(const slot of worn){
    delete equipment.copies?.[slot];
    const fallback=unequip[slot];
    if(fallback&&isEmptyItem(fallback))equipment[slot]=fallback;
    else{const other=profile.inventory.find(key=>CATALOG[copyBase(key)]?.slot===base.slot&&canEquipItem(copyBase(key),profile.gender)&&!slotsForItem(base).some(s=>s!==slot&&equippedCopy(equipment,s)===key));if(!other)throw Error('Não foi possível trocar o item equipado.');equipment[slot]=copyBase(other);if(isCopyKey(other))(equipment.copies??={})[slot]=other;}
   }
   if(equipment.copies&&!Object.keys(equipment.copies).length)delete equipment.copies;
   refreshWorn(profile);
   return {profile};
  })).profile;
 }
 /** Reads, changes and saves one profile inside a row lock. */
 private async mutate<T extends {profile:Profile}>(id:string,change:(profile:Profile)=>T):Promise<T>{
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const outcome=change(normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}));
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,outcome.profile]);await c.query('COMMIT');return outcome;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 /**
  * Top three of today's PvP ranking (Brasília day): most wins, ties to whoever got
  * there first. Every saved match counts, including training against bots.
  */
 async dailyRanking():Promise<RankingEntry[]>{
  const r=await this.pool.query(`SELECT w.id,count(*)::int AS wins,p.profile,p.name FROM matches m CROSS JOIN LATERAL jsonb_array_elements_text(m.winners) AS w(id) JOIN players p ON p.id::text=w.id
   WHERE m.finished_at>=(date_trunc('day',now() AT TIME ZONE '${RANKING_TIME_ZONE}') AT TIME ZONE '${RANKING_TIME_ZONE}')
   GROUP BY w.id,p.profile,p.name ORDER BY wins DESC,max(m.finished_at) ASC,w.id LIMIT 3`);
  return r.rows.map((row,i)=>{const profile=normalizeProfile({...row.profile,name:row.name});return {rank:(i+1) as 1|2|3,id:profile.id,name:profile.name,level:profile.level,wins:row.wins,equipment:profile.equipment};});
 }
 async finishExpedition(stageId:string,players:string[],award:{coins:number;xp:number},bonuses:MatchBonuses={}){
  const c=await this.pool.connect();try{
   // Same idempotency key table as matches, with no winners: expeditions never count for the PvP ranking.
   await c.query('BEGIN');const inserted=await c.query('INSERT INTO matches(id,winners,players) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[stageId,'[]',JSON.stringify(players)]);
   if(inserted.rowCount)for(const id of [...players].sort()){
    const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])continue;
    const p=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});p.gold+=integer(award.coins);p.xp+=integer(award.xp);applyPrize(p,bonuses[id]);p.level=Math.max(p.level,levelForXp(p.xp));
    await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async rename(id:string,name:string){await this.pool.query('UPDATE players SET name=$2 WHERE id=$1',[id,name]);}
 async finishMatch(matchId:string,winners:string[],players:string[],bonuses:MatchBonuses={}){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const inserted=await c.query('INSERT INTO matches(id,winners,players) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[matchId,JSON.stringify(winners),JSON.stringify(players)]);
   if(inserted.rowCount)for(const id of [...players].sort()){
    const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])continue;
    const p=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}),win=winners.includes(id);p.matches++;p.wins+=win?1:0;p.xp+=win?120:50;p.gold+=win?80:25;applyPrize(p,bonuses[id]);p.level=Math.max(p.level,levelForXp(p.xp));
    await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
