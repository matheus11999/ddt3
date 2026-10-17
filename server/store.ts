import {SHOP_OFFER_BY_ID,MAX_SHOP_ITEMS} from '../shared/shop';
import type {MatchBonuses} from '../shared/rewards';
import pg from 'pg';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {canEquipItem,CATALOG,copyBase,equippedCompositions,equippedCopy,isCopyKey,nextCopyKey,heldInSiblingSlot,slotAccepts,CHARACTER_GENDERS,CONTENT_VERSION,isEmptyItem,ITEMS,MAX_UPGRADE,normalizeDyes,normalizeVisibility,RETIRED_COSMETIC_REPLACEMENTS,SLOT_NAMES,starterEquipment,STARTER_COSTUMES,STARTER_STONES,STONES,unequipForGender,upgradeChance,WEAPONS} from '../shared/catalog';
import type {CharacterGender,Equipment,Slot} from '../shared/catalog';
import {canCompose,COMPOSITION_STONES,COMPOSITION_STONE_BY_ID,normalizeCompositions,STARTER_COMPOSITION_STONES} from '../shared/composition';
import {abilityLoadoutSchema,equipmentVisibilitySchema,stoneSelectionSchema} from '../shared/protocol';
import {normalizeAbilityLoadout} from '../shared/abilities';
import type {AbilityLoadout} from '../shared/abilities';
import {levelForXp,normalizeLevel} from '../shared/progression';
import type {CompositionResult,ForgeResult,Profile,RankingEntry,ShopResult} from '../shared/protocol';
export interface ForgeOutcome {profile:Profile;result:ForgeResult;}
export interface CompositionOutcome {profile:Profile;result:CompositionResult;}
export interface ShopOutcome {profile:Profile;result:ShopResult;}
export interface ProfileStore {buy(id:string,items:string[]):Promise<ShopOutcome>;saveEquipment(id:string,equipment:Equipment):Promise<Profile>;saveAbilityLoadout(id:string,slots:AbilityLoadout):Promise<Profile>;forge(id:string,item:string,stones:Record<string,number>):Promise<ForgeOutcome>;compose(id:string,item:string,stone:string):Promise<CompositionOutcome>;dailyRanking?():Promise<RankingEntry[]>;rename(id:string,name:string):Promise<void>;finishMatch(matchId:string,winners:string[],players:string[],bonuses?:MatchBonuses):Promise<void>;getProfile(id:string):Promise<Profile|null>;}

export const RANKING_TIME_ZONE='America/Sao_Paulo';

type StoredProfile = Partial<Omit<Profile,'equipment'>> & Pick<Profile,'id'|'name'> & {equipment?:Partial<Equipment>};
const integer=(value:unknown,fallback=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(0,Math.floor(value))):fallback;

const SHOP_ONLY_COSMETICS=new Set(['outfit-racer','outfit-dancer','outfit-cartographer','hair-undercut','hair-ponytail','hair-horizon','glasses-sport','glasses-cat','glasses-navigator','face-wink','hat-thunder','hat-tide','hat-ruby','hat-tropical']);

// Missing fields are migrated once on read; an empty stone stack stays empty.
export function normalizeProfile(raw:StoredProfile):Profile {
 // Legacy profiles only infer once: a stored, valid gender always wins over clothing.
 const gender:CharacterGender=raw.gender==='male'||raw.gender==='female'?raw.gender:raw.equipment?.outfit==='outfit-dancer'?'female':'male';
 const defaults=starterEquipment(gender),unequip=unequipForGender(gender);
 // Extra copies (`id~2`) are kept only alongside the first copy, which keeps the plain id.
 const inventory=Array.isArray(raw.inventory)?[...new Set(raw.inventory.filter(id=>Object.hasOwn(CATALOG,id)&&!isEmptyItem(id)))]:ITEMS.filter(i=>!SHOP_ONLY_COSMETICS.has(i.id)&&!isEmptyItem(i)&&canEquipItem(i,gender)).map(i=>i.id);
 if(!raw.upgrades&&(raw.contentVersion??0)<1&&!inventory.includes(defaults.hat))inventory.push(defaults.hat);
 if((raw.contentVersion??0)<5){for(const item of ITEMS)if(item.visual&&!isEmptyItem(item)&&!SHOP_ONLY_COSMETICS.has(item.id)&&canEquipItem(item,gender)&&!inventory.includes(item.id))inventory.push(item.id);}
 else if((raw.contentVersion??0)<6){for(const id of ['outfit-surfer','outfit-executive'])if(canEquipItem(id,gender)&&!inventory.includes(id))inventory.push(id);}
 // Retired outfits migrate once to the current starter; never replenish unrelated items.
 if((raw.contentVersion??0)<7&&(!raw.equipment?.outfit||!CATALOG[raw.equipment.outfit])){
  if(!inventory.includes(defaults.outfit))inventory.push(defaults.outfit);
 }
 if((raw.contentVersion??0)<9&&CATALOG.dynamite&&!inventory.includes('dynamite'))inventory.push('dynamite');
 // Replace owned prototypes, including the equipped variant, without refilling other purchases.
 const replacements=(raw.contentVersion??0)<10?RETIRED_COSMETIC_REPLACEMENTS:{};
 for(const id of raw.inventory??[]){const replacement=Object.hasOwn(replacements,id)?replacements[id]:undefined;if(replacement&&!inventory.includes(replacement))inventory.push(replacement);}
 if((raw.contentVersion??0)<12)for(const id of STARTER_COSTUMES)if(!inventory.includes(id))inventory.push(id);
 if(Array.isArray(raw.inventory))for(const key of raw.inventory)if(typeof key==='string'&&isCopyKey(key)&&inventory.includes(copyBase(key))&&!inventory.includes(key))inventory.push(key);
 const weaponCopies=inventory.filter(key=>isCopyKey(key)&&CATALOG[copyBase(key)]?.slot==='weapon');
 const upgrades=Object.fromEntries([...WEAPONS.map(w=>w.id),...weaponCopies].map(key=>[key,integer(raw.upgrades?.[key],0,MAX_UPGRADE)]));
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
 const equipment={...defaults};
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){
  const saved=raw.equipment?.[slot],id=saved?(Object.hasOwn(replacements,saved)?replacements[saved]:saved):undefined;
  if(id&&Object.hasOwn(CATALOG,id)&&slotAccepts(slot,CATALOG[id])&&(inventory.includes(id)||isEmptyItem(id))&&canEquipItem(id,gender)&&!heldInSiblingSlot(equipment,slot,id))equipment[slot]=id;
  else equipment[slot]=isEmptyItem(defaults[slot])||inventory.includes(defaults[slot])?defaults[slot]:inventory.find(owned=>CATALOG[owned]?.slot===slot&&canEquipItem(owned,gender))??unequip[slot]??defaults[slot];
  // Every equipped fallback must actually be owned, including sparse historical profiles.
  if(!isEmptyItem(equipment[slot])&&!inventory.includes(equipment[slot]))inventory.push(equipment[slot]);
 }
 const copies=validCopies(raw.equipment?.copies,equipment,inventory);if(Object.keys(copies).length)equipment.copies=copies;
 equipment.upgrade=upgrades[equippedCopy(equipment,'weapon')]??0;
 equipment.dyes=normalizeDyes(raw.equipment?.dyes);
 equipment.visibility=normalizeVisibility(raw.equipment?.visibility);
 const worn=equippedCompositions(equipment,compositions);if(Object.keys(worn).length)equipment.compositions=worn;
 const xp=integer(raw.xp);
 // Experience earned at the former cap immediately counts toward the new levels.
 const level=Math.max(normalizeLevel(integer(raw.level,1)),levelForXp(xp));
 return {id:raw.id,name:raw.name,gender,level,xp,gold:integer(raw.gold),wins:integer(raw.wins),matches:integer(raw.matches),equipment,inventory,equippedOnce:raw.equippedOnce===true,upgrades,stones,compositions,compositionStones,contentVersion:CONTENT_VERSION,abilityLoadout:normalizeAbilityLoadout(raw.abilityLoadout)};
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
function refreshWorn(profile:Profile){
 profile.equipment.upgrade=profile.upgrades[equippedCopy(profile.equipment,'weapon')]??0;
 delete profile.equipment.compositions;
 const worn=equippedCompositions(profile.equipment,profile.compositions);if(Object.keys(worn).length)profile.equipment.compositions=worn;
}

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
   profile.equipment={...selected,dyes:normalizeDyes(equipment.dyes),visibility:normalizeVisibility(visibility.data),upgrade:0,...(Object.keys(copies).length?{copies}:{})};
   refreshWorn(profile);
   profile.equippedOnce=true;
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return profile;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async forge(id:string,item:string,selection:Record<string,number>):Promise<ForgeOutcome>{
  const parsed=stoneSelectionSchema.safeParse(selection);if(!parsed.success)throw Error('Selecione de 1 a 20 pedras válidas.');
  const consumed=Object.fromEntries(Object.entries(parsed.data).filter(([,quantity])=>quantity>0));
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   if(!WEAPONS.some(w=>w.id===copyBase(item))||!profile.inventory.includes(item))throw Error('Escolha uma arma da sua mochila.');
   const level=profile.upgrades[item]??0;if(level>=MAX_UPGRADE)throw Error('Esta arma já está no nível máximo.');
   for(const [tier,quantity] of Object.entries(consumed))if((profile.stones[tier]??0)<quantity)throw Error('Você não tem essas pedras na mochila.');
   const chance=upgradeChance(level,consumed),success=this.roll()<Math.round(chance*10);
   for(const [tier,quantity] of Object.entries(consumed))profile.stones[tier]-=quantity;
   if(success)profile.upgrades[item]=level+1;
   refreshWorn(profile);
   const result:ForgeResult={item,success,level:profile.upgrades[item],chance,consumed};
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return {profile,result};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async compose(id:string,item:string,stoneId:string):Promise<CompositionOutcome>{
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
   const success=this.roll()<stone.chance*10;
   profile.compositionStones[stoneId]--;profile.gold-=stone.cost;
   if(success)profile.compositions[item]={...profile.compositions[item],[stone.stat]:stone.value};
   refreshWorn(profile);
   const result:CompositionResult={item,stone:stoneId,stat:stone.stat,success,previous,value:profile.compositions[item]?.[stone.stat]??0,chance:stone.chance,cost:stone.cost};
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return {profile,result};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async buy(id:string,items:string[]):Promise<ShopOutcome>{
  if(!Array.isArray(items)||items.length<1||items.length>MAX_SHOP_ITEMS||new Set(items).size!==items.length)throw Error('Confira os itens do carrinho.');
  const offers=items.map(id=>Object.hasOwn(SHOP_OFFER_BY_ID,id)?SHOP_OFFER_BY_ID[id]:undefined);
  if(offers.some(offer=>!offer))throw Error('Um item não está disponível na loja.');
  const spent=offers.reduce((total,offer)=>total+offer!.price,0);
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   if(items.some(item=>!canEquipItem(item,profile.gender)))throw Error('Este item não é compatível com o gênero do seu personagem.');
   if(profile.gold<spent)throw Error('Moedas Brasa insuficientes para esta compra.');
   // An item already owned arrives as a separate copy, with its own forge level and compositions.
   profile.gold-=spent;for(const item of items){const key=nextCopyKey(profile.inventory,item);profile.inventory.push(key);if(key!==item&&WEAPONS.some(w=>w.id===item))profile.upgrades[key]=0;}
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');
   return {profile,result:{items:[...items],spent}};
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
 async rename(id:string,name:string){await this.pool.query('UPDATE players SET name=$2 WHERE id=$1',[id,name]);}
 async finishMatch(matchId:string,winners:string[],players:string[],bonuses:MatchBonuses={}){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const inserted=await c.query('INSERT INTO matches(id,winners,players) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[matchId,JSON.stringify(winners),JSON.stringify(players)]);
   if(inserted.rowCount)for(const id of [...players].sort()){
    const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])continue;
    const p=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}),win=winners.includes(id);p.matches++;p.wins+=win?1:0;p.xp+=win?120:50;p.gold+=win?80:25;const bonus=bonuses[id];if(bonus){if(bonus.kind==='coins')p.gold+=integer(bonus.amount);else p.xp+=integer(bonus.amount);}p.level=Math.max(p.level,levelForXp(p.xp));
    await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
