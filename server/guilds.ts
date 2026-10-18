import type pg from 'pg';
import {canEquipItem,nextCopyKey} from '../shared/catalog';
import {addMissionProgress,BUILDING_NAMES,guildRanks,LEADER_RANK,MEMBER_RANK,rankCan,validRankName,buildingLevelCost,claimMission,dailyFor,guildDay,canRaiseBuilding,GUILD_BUILDINGS,GUILD_CREATE_COST,GUILD_MAX_LEVEL,GUILD_OFFER_BY_ID,GUILD_PAGE_SIZE,guildLevelCost,guildMemberCap,storageCapacity,validGuildName} from '../shared/guilds';
import type {GuildApplication,GuildBuilding,GuildMissionId,GuildPermission,GuildRank,GuildMember,GuildRole,GuildState,GuildStored,GuildSummary,GuildView} from '../shared/guilds';
import type {AuctionGoods,AuctionSource} from '../shared/auction';
import type {Profile} from '../shared/protocol';
import {goodsAttachment,takeGoods} from './auction';
import {applyAttachments} from './mail';
import {normalizeProfile,refreshWorn} from './store';

/** What the game keeps in memory about a player's guild: the name under their name, the forge bonus, GvG pairing. */
export interface Membership {guildId:number;name:string;role:GuildRole;smith:number;}
export type GuildTarget='guild'|GuildBuilding;
/** What the game needs from the guilds (tests use a fake). Every change returns the guild it touched. */
export interface GuildHall {
 membership(playerId:string):Promise<Membership|null>;
 state(playerId:string):Promise<GuildState>;
 list(search?:string):Promise<GuildSummary[]>;
 memberIds(guildId:number):Promise<string[]>;
 create(playerId:string,name:string):Promise<{profile:Profile;guildId:number}>;
 apply(playerId:string,guildId:number):Promise<{ownerId:string}>;
 cancelApply(playerId:string,guildId:number):Promise<void>;
 answer(ownerId:string,playerId:string,accept:boolean):Promise<{guildId:number}>;
 kick(ownerId:string,playerId:string):Promise<{guildId:number}>;
 leave(playerId:string):Promise<{guildId:number;dissolved:boolean}>;
 upgrade(ownerId:string,target:GuildTarget):Promise<{guildId:number;level:number}>;
 buy(playerId:string,item:string):Promise<{profile:Profile}>;
 deposit(playerId:string,source:AuctionSource):Promise<{profile:Profile;guildId:number}>;
 withdraw(playerId:string,id:number):Promise<{profile:Profile;guildId:number}>;
 /** GvG win: each winner adds Riqueza to the guild and contribution to their own record, once per battle. */
 gvgWin(matchId:string,guildId:number,winners:string[],amount:number):Promise<boolean>;
 /** Daily mission progress for these players (members only); returns who counted. */
 missionProgress(playerIds:string[],mission:GuildMissionId,amount?:number):Promise<string[]>;
 /** Claims a finished daily mission: contribution for the member, the same Riqueza for the guild. */
 claimMission(playerId:string,mission:GuildMissionId):Promise<{guildId:number;reward:number}>;
 /** Gives a member a lower rank than the actor's (permission "promote"). */
 setRank(actorId:string,playerId:string,rank:number):Promise<{guildId:number}>;
 /** The leader renames the ranks and picks their permissions. */
 saveRanks(leaderId:string,ranks:GuildRank[]):Promise<{guildId:number}>;
 /** The leader closes the guild; whatever is in the Depósito goes back to the leader. */
 disband(leaderId:string):Promise<{guildId:number;members:string[];profile:Profile|null}>;
}
type Buildings=Record<GuildBuilding,number>;
interface GuildRow {id:number;name:string;level:number;riqueza:number;ownerId:string;buildings:Buildings;ranks:GuildRank[];createdAt:string;}

/** Pure checks shared by the Postgres store and the tests. */
export function checkCreate(profile:Profile,name:string){
 const clean=validGuildName(name);
 if(profile.gold<GUILD_CREATE_COST)throw Error(`Fundar uma guilda custa ${GUILD_CREATE_COST.toLocaleString('pt-BR')} de Ouro.`);
 profile.gold-=GUILD_CREATE_COST;return clean;
}
/** Riqueza an upgrade costs; buildings stop at the guild level, the guild at the maximum level. */
export function upgradeCost(guild:{level:number;riqueza:number;buildings:Buildings},target:GuildTarget){
 const current=target==='guild'?guild.level:guild.buildings[target];
 if(target==='guild'){if(current>=GUILD_MAX_LEVEL)throw Error('A guilda já está no nível máximo.');}
 else if(!canRaiseBuilding(guild.level,current))throw Error(current>=GUILD_MAX_LEVEL?`${BUILDING_NAMES[target]} já está no nível máximo.`:`${BUILDING_NAMES[target]} não pode passar do nível da guilda (${guild.level}). Evolua a guilda primeiro.`);
 const cost=target==='guild'?guildLevelCost(current):buildingLevelCost(current);
 if(guild.riqueza<cost)throw Error(`Faltam ${(cost-guild.riqueza).toLocaleString('pt-BR')} de Riqueza para esta melhoria.`);
 return {cost,level:current+1};
}
export function checkGuildPurchase(profile:Profile,item:string,shopLevel:number){
 const offer=GUILD_OFFER_BY_ID[item];if(!offer)throw Error('Item não está na loja da guilda.');
 if(shopLevel<offer.level)throw Error(`A Loja da Guilda precisa do nível ${offer.level} para vender este item.`);
 if(!canEquipItem(item,profile.gender))throw Error('Este item não é compatível com o gênero do seu personagem.');
 if(profile.gold<offer.price)throw Error('Ouro insuficiente para esta compra.');
 profile.gold-=offer.price;profile.inventory.push(nextCopyKey(profile.inventory,item));
}

const guildRow=(row:Record<string,unknown>):GuildRow=>({id:Number(row.id),name:row.name as string,level:Number(row.level),riqueza:Number(row.riqueza),ownerId:row.owner_id as string,
 buildings:{shop:0,smith:0,storage:0,...(row.buildings as Partial<Buildings>)},ranks:guildRanks(row.ranks),createdAt:new Date(row.created_at as string).toISOString()});

/** Guilds in Postgres. Each change locks the guild (and the player, when their bag changes) in one transaction. */
export class GuildStore implements GuildHall {
 constructor(private pool:pg.Pool){}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS guilds(id serial PRIMARY KEY,name varchar(16) NOT NULL,name_key varchar(16) NOT NULL UNIQUE,owner_id uuid NOT NULL REFERENCES players(id),
   level int NOT NULL DEFAULT 0,riqueza bigint NOT NULL DEFAULT 0,buildings jsonb NOT NULL DEFAULT '{"shop":0,"smith":0,"storage":0}',created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS guild_members(player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,guild_id int NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
   role varchar(8) NOT NULL DEFAULT 'member',contribution bigint NOT NULL DEFAULT 0,joined_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS guild_members_guild ON guild_members(guild_id);
  ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS daily jsonb NOT NULL DEFAULT '{}';
  ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS rank int NOT NULL DEFAULT 4;
  ALTER TABLE guilds ADD COLUMN IF NOT EXISTS ranks jsonb NOT NULL DEFAULT '[]';
  UPDATE guild_members SET rank=0 WHERE role='owner' AND rank<>0;
  CREATE TABLE IF NOT EXISTS guild_applications(guild_id int NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
   created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(guild_id,player_id));
  CREATE TABLE IF NOT EXISTS guild_storage(id bigserial PRIMARY KEY,guild_id int NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,goods jsonb NOT NULL,by_name varchar(24) NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS guild_storage_guild ON guild_storage(guild_id,id);
  CREATE TABLE IF NOT EXISTS guild_gvg(match_id varchar(64) PRIMARY KEY,guild_id int NOT NULL,winners jsonb NOT NULL,amount int NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 `);}
 private async transaction<T>(work:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 private async lockPlayer(c:pg.PoolClient,id:string){
  const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])throw Error('Jogador não encontrado.');
  return normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
 }
 private async saveProfile(c:pg.PoolClient,profile:Profile){await c.query('UPDATE players SET profile=$2 WHERE id=$1',[profile.id,profile]);}
 /** The guild a player belongs to, locked for the rest of the transaction. */
 private async myGuild(c:pg.PoolClient,playerId:string,role?:GuildRole){return (await this.actor(c,playerId,role)).g;}
 /** The guild a player belongs to (locked) and their rank; with a permission, refuses ranks without it. */
 private async actor(c:pg.PoolClient,playerId:string,need?:GuildRole|GuildPermission){
  const r=await c.query('SELECT g.*,m.role,m.rank AS member_rank FROM guild_members m JOIN guilds g ON g.id=m.guild_id WHERE m.player_id=$1 FOR UPDATE OF g',[playerId]);
  if(!r.rows[0])throw Error('Você não faz parte de uma guilda.');
  const g=guildRow(r.rows[0]),rank=r.rows[0].role==='owner'?LEADER_RANK:Number(r.rows[0].member_rank);
  if(need==='owner'&&rank!==LEADER_RANK)throw Error('Só o líder da guilda pode fazer isso.');
  else if(need&&need!=='owner'&&need!=='member'&&!rankCan(g.ranks,rank,need))throw Error('Seu cargo não tem permissão para isso.');
  return {g,rank};
 }
 /** Another member of the same guild, who must be below the actor's rank. */
 private async target(c:pg.PoolClient,guildId:number,actorRank:number,playerId:string){
  const r=await c.query('SELECT role,rank FROM guild_members WHERE guild_id=$1 AND player_id=$2 FOR UPDATE',[guildId,playerId]);
  if(!r.rows[0])throw Error('Este jogador não está na guilda.');
  const rank=r.rows[0].role==='owner'?LEADER_RANK:Number(r.rows[0].rank);
  if(rank<=actorRank)throw Error('Você só pode fazer isso com membros de cargo abaixo do seu.');
  return rank;
 }
 async membership(playerId:string):Promise<Membership|null>{
  const r=await this.pool.query('SELECT g.id,g.name,g.buildings,m.role FROM guild_members m JOIN guilds g ON g.id=m.guild_id WHERE m.player_id=$1',[playerId]);
  const row=r.rows[0];return row?{guildId:Number(row.id),name:row.name,role:row.role,smith:Number(row.buildings?.smith??0)}:null;
 }
 async memberIds(guildId:number){return (await this.pool.query('SELECT player_id FROM guild_members WHERE guild_id=$1',[guildId])).rows.map(row=>row.player_id as string);}
 async state(playerId:string):Promise<GuildState>{
  const applied=(await this.pool.query('SELECT guild_id FROM guild_applications WHERE player_id=$1',[playerId])).rows.map(row=>Number(row.guild_id));
  const r=await this.pool.query('SELECT g.*,m.role,m.rank AS member_rank,m.daily FROM guild_members m JOIN guilds g ON g.id=m.guild_id WHERE m.player_id=$1',[playerId]);
  if(!r.rows[0])return {guild:null,applied};
  const g=guildRow(r.rows[0]),myRank=r.rows[0].role==='owner'?LEADER_RANK:Number(r.rows[0].member_rank),day=guildDay();
  const members=(await this.pool.query(`SELECT m.player_id,m.role,m.rank,m.contribution,m.joined_at,m.daily,p.name,p.profile->>'level' AS level FROM guild_members m JOIN players p ON p.id=m.player_id WHERE m.guild_id=$1 ORDER BY m.rank,m.contribution DESC,m.joined_at`,[g.id])).rows
   .map((row):GuildMember=>({id:row.player_id,name:row.name,level:Number(row.level??1),role:row.role,rank:row.role==='owner'?LEADER_RANK:Number(row.rank),contribution:Number(row.contribution),today:dailyFor(row.daily,day).today,joinedAt:new Date(row.joined_at).toISOString()}));
  const storage=(await this.pool.query('SELECT * FROM guild_storage WHERE guild_id=$1 ORDER BY id',[g.id])).rows
   .map((row):GuildStored=>({id:Number(row.id),goods:row.goods as AuctionGoods,by:row.by_name,at:new Date(row.created_at).toISOString()}));
  const applications=rankCan(g.ranks,myRank,'recruit')?(await this.pool.query(`SELECT a.player_id,a.created_at,p.name,p.profile->>'level' AS level FROM guild_applications a JOIN players p ON p.id=a.player_id WHERE a.guild_id=$1 ORDER BY a.created_at`,[g.id])).rows
   .map((row):GuildApplication=>({playerId:row.player_id,name:row.name,level:Number(row.level??1),at:new Date(row.created_at).toISOString()})):undefined;
  const view:GuildView={id:g.id,name:g.name,level:g.level,riqueza:g.riqueza,ownerId:g.ownerId,ownerName:members.find(m=>m.id===g.ownerId)?.name??'',daily:dailyFor(r.rows[0].daily,day),ranks:g.ranks,myRank,buildings:g.buildings,members,storage,createdAt:g.createdAt,...(applications?{applications}:{})};
  return {guild:view,applied};
 }
 async list(search=''){
  const term=search.trim(),params:unknown[]=[];let where='';
  if(term){params.push(`%${term.replace(/[\\%_]/g,m=>`\\${m}`)}%`);where='WHERE g.name ILIKE $1';}
  const r=await this.pool.query(`SELECT g.id,g.name,g.level,p.name AS owner_name,(SELECT count(*)::int FROM guild_members m WHERE m.guild_id=g.id) AS members
   FROM guilds g JOIN players p ON p.id=g.owner_id ${where} ORDER BY g.level DESC,g.riqueza DESC,g.id LIMIT ${GUILD_PAGE_SIZE}`,params);
  return r.rows.map((row):GuildSummary=>({id:Number(row.id),name:row.name,level:Number(row.level),members:row.members,capacity:guildMemberCap(Number(row.level)),ownerName:row.owner_name}));
 }
 async create(playerId:string,name:string){
  return this.transaction(async c=>{
   const profile=await this.lockPlayer(c,playerId);
   if((await c.query('SELECT 1 FROM guild_members WHERE player_id=$1',[playerId])).rowCount)throw Error('Saia da sua guilda antes de fundar outra.');
   const clean=checkCreate(profile,name),key=clean.toLocaleLowerCase('pt-BR');
   if((await c.query('SELECT 1 FROM guilds WHERE name_key=$1',[key])).rowCount)throw Error('Já existe uma guilda com esse nome.');
   const r=await c.query('INSERT INTO guilds(name,name_key,owner_id) VALUES($1,$2,$3) RETURNING id',[clean,key,playerId]);const guildId=Number(r.rows[0].id);
   await c.query(`INSERT INTO guild_members(player_id,guild_id,role,rank) VALUES($1,$2,'owner',0)`,[playerId,guildId]);
   await c.query('DELETE FROM guild_applications WHERE player_id=$1',[playerId]);
   await this.saveProfile(c,profile);
   return {profile,guildId};
  });
 }
 async apply(playerId:string,guildId:number){
  return this.transaction(async c=>{
   if((await c.query('SELECT 1 FROM guild_members WHERE player_id=$1',[playerId])).rowCount)throw Error('Você já faz parte de uma guilda.');
   const g=await c.query('SELECT owner_id FROM guilds WHERE id=$1',[guildId]);if(!g.rows[0])throw Error('Esta guilda não existe mais.');
   const pending=await c.query('SELECT count(*)::int AS n FROM guild_applications WHERE player_id=$1',[playerId]);if(pending.rows[0].n>=5)throw Error('Você já pediu para entrar em 5 guildas. Espere uma resposta.');
   await c.query('INSERT INTO guild_applications(guild_id,player_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[guildId,playerId]);
   return {ownerId:g.rows[0].owner_id as string};
  });
 }
 async cancelApply(playerId:string,guildId:number){await this.pool.query('DELETE FROM guild_applications WHERE guild_id=$1 AND player_id=$2',[guildId,playerId]);}
 async answer(ownerId:string,playerId:string,accept:boolean){
  return this.transaction(async c=>{
   const {g}=await this.actor(c,ownerId,'recruit');
   const app=await c.query('DELETE FROM guild_applications WHERE guild_id=$1 AND player_id=$2 RETURNING player_id',[g.id,playerId]);
   if(!app.rowCount)throw Error('Este pedido não existe mais.');
   if(accept){
    if((await c.query('SELECT 1 FROM guild_members WHERE player_id=$1',[playerId])).rowCount)throw Error('Este jogador já entrou em outra guilda.');
    const count=(await c.query('SELECT count(*)::int AS n FROM guild_members WHERE guild_id=$1',[g.id])).rows[0].n;
    if(count>=guildMemberCap(g.level))throw Error(`A guilda está cheia (${guildMemberCap(g.level)} membros). Evolua a guilda para receber mais.`);
    await c.query(`INSERT INTO guild_members(player_id,guild_id,role,rank) VALUES($1,$2,'member',$3)`,[playerId,g.id,MEMBER_RANK]);
    await c.query('DELETE FROM guild_applications WHERE player_id=$1',[playerId]);
   }
   return {guildId:g.id};
  });
 }
 async kick(ownerId:string,playerId:string){
  return this.transaction(async c=>{
   if(ownerId===playerId)throw Error('Para sair, use Sair da guilda.');
   const {g,rank}=await this.actor(c,ownerId,'kick');await this.target(c,g.id,rank,playerId);
   await c.query('DELETE FROM guild_members WHERE guild_id=$1 AND player_id=$2',[g.id,playerId]);
   return {guildId:g.id};
  });
 }
 /** Leaving as the owner hands the guild to the member with the most contribution; the last one out closes it,
  * and whatever is left in the Depósito goes back to them by mail. */
 async leave(playerId:string){
  return this.transaction(async c=>{
   const g=await this.myGuild(c,playerId);
   await c.query('DELETE FROM guild_members WHERE player_id=$1',[playerId]);
   if(g.ownerId!==playerId)return {guildId:g.id,dissolved:false};
   const heir=await c.query('SELECT player_id FROM guild_members WHERE guild_id=$1 ORDER BY rank,contribution DESC,joined_at LIMIT 1',[g.id]);
   if(heir.rows[0]){await c.query(`UPDATE guild_members SET role='owner',rank=0 WHERE player_id=$1`,[heir.rows[0].player_id]);await c.query('UPDATE guilds SET owner_id=$2 WHERE id=$1',[g.id,heir.rows[0].player_id]);return {guildId:g.id,dissolved:false};}
   const stored=await c.query('SELECT goods FROM guild_storage WHERE guild_id=$1',[g.id]);
   if(stored.rows.length){const profile=await this.lockPlayer(c,playerId);applyAttachments(profile,stored.rows.map(row=>goodsAttachment(row.goods as AuctionGoods)));refreshWorn(profile);await this.saveProfile(c,profile);}
   await c.query('DELETE FROM guilds WHERE id=$1',[g.id]);
   return {guildId:g.id,dissolved:true};
  });
 }
 async upgrade(ownerId:string,target:GuildTarget){
  return this.transaction(async c=>{
   const {g}=await this.actor(c,ownerId,'upgrade');const {cost,level}=upgradeCost(g,target);
   if(target==='guild')await c.query('UPDATE guilds SET level=$2,riqueza=riqueza-$3 WHERE id=$1',[g.id,level,cost]);
   else await c.query('UPDATE guilds SET buildings=$2,riqueza=riqueza-$3 WHERE id=$1',[g.id,JSON.stringify({...g.buildings,[target]:level}),cost]);
   return {guildId:g.id,level};
  });
 }
 async buy(playerId:string,item:string){
  return this.transaction(async c=>{
   const g=await this.myGuild(c,playerId),profile=await this.lockPlayer(c,playerId);
   checkGuildPurchase(profile,item,g.buildings.shop);await this.saveProfile(c,profile);
   return {profile};
  });
 }
 async deposit(playerId:string,source:AuctionSource){
  return this.transaction(async c=>{
   const g=await this.myGuild(c,playerId),capacity=storageCapacity(g.buildings.storage);
   if(!capacity)throw Error('Construa o Depósito da Guilda para guardar itens.');
   const used=(await c.query('SELECT count(*)::int AS n FROM guild_storage WHERE guild_id=$1',[g.id])).rows[0].n;
   if(used>=capacity)throw Error(`O depósito está cheio (${capacity} itens). Evolua o Depósito para guardar mais.`);
   const profile=await this.lockPlayer(c,playerId),goods=takeGoods(profile,source,true);
   await c.query('INSERT INTO guild_storage(guild_id,goods,by_name) VALUES($1,$2,$3)',[g.id,JSON.stringify(goods),profile.name]);
   await this.saveProfile(c,profile);
   return {profile,guildId:g.id};
  });
 }
 async withdraw(playerId:string,id:number){
  return this.transaction(async c=>{
   const {g}=await this.actor(c,playerId,'withdraw');
   const r=await c.query('DELETE FROM guild_storage WHERE id=$1 AND guild_id=$2 RETURNING goods',[id,g.id]);if(!r.rows[0])throw Error('Alguém já retirou este item.');
   const goods=r.rows[0].goods as AuctionGoods,profile=await this.lockPlayer(c,playerId);
   if(goods.kind==='item'&&!canEquipItem(goods.item,profile.gender))throw Error('Este item não é compatível com o gênero do seu personagem.');
   applyAttachments(profile,[goodsAttachment(goods)]);refreshWorn(profile);await this.saveProfile(c,profile);
   return {profile,guildId:g.id};
  });
 }
 async gvgWin(matchId:string,guildId:number,winners:string[],amount:number){
  return this.transaction(async c=>{
   const inserted=await c.query('INSERT INTO guild_gvg(match_id,guild_id,winners,amount) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING match_id',[matchId,guildId,JSON.stringify(winners),amount]);
   if(!inserted.rowCount)return false;
   const r=await c.query('SELECT player_id,daily FROM guild_members WHERE guild_id=$1 AND player_id=ANY($2::uuid[]) FOR UPDATE',[guildId,winners]),day=guildDay();
   for(const row of r.rows){const daily=dailyFor(row.daily,day);daily.today+=amount;await c.query('UPDATE guild_members SET contribution=contribution+$2,daily=$3 WHERE player_id=$1',[row.player_id,amount,JSON.stringify(daily)]);}
   await c.query('UPDATE guilds SET riqueza=riqueza+$2 WHERE id=$1',[guildId,amount*r.rows.length]);
   return true;
  });
 }
 async missionProgress(playerIds:string[],mission:GuildMissionId,amount=1){
  if(!playerIds.length)return [];
  return this.transaction(async c=>{
   const r=await c.query('SELECT player_id,daily FROM guild_members WHERE player_id=ANY($1::uuid[]) FOR UPDATE',[playerIds]),day=guildDay();
   for(const row of r.rows)await c.query('UPDATE guild_members SET daily=$2 WHERE player_id=$1',[row.player_id,JSON.stringify(addMissionProgress(dailyFor(row.daily,day),mission,amount))]);
   return r.rows.map(row=>row.player_id as string);
  });
 }
 async claimMission(playerId:string,mission:GuildMissionId){
  return this.transaction(async c=>{
   const g=await this.myGuild(c,playerId);
   const row=(await c.query('SELECT daily FROM guild_members WHERE player_id=$1 FOR UPDATE',[playerId])).rows[0];
   const daily=dailyFor(row.daily,guildDay()),reward=claimMission(daily,mission);
   await c.query('UPDATE guild_members SET contribution=contribution+$2,daily=$3 WHERE player_id=$1',[playerId,reward,JSON.stringify(daily)]);
   await c.query('UPDATE guilds SET riqueza=riqueza+$2 WHERE id=$1',[g.id,reward]);
   return {guildId:g.id,reward};
  });
 }
 async setRank(actorId:string,playerId:string,rank:number){
  return this.transaction(async c=>{
   if(actorId===playerId)throw Error('Você não pode trocar o próprio cargo.');
   const {g,rank:mine}=await this.actor(c,actorId,'promote');await this.target(c,g.id,mine,playerId);
   if(rank<=mine||rank>MEMBER_RANK)throw Error('Você só pode dar cargos abaixo do seu.');
   await c.query('UPDATE guild_members SET rank=$2 WHERE player_id=$1',[playerId,rank]);
   return {guildId:g.id};
  });
 }
 async saveRanks(leaderId:string,ranks:GuildRank[]){
  return this.transaction(async c=>{
   const {g}=await this.actor(c,leaderId,'owner');
   const clean=guildRanks(ranks.map(r=>({...r,name:validRankName(r.name)})));
   const names=clean.map(r=>r.name.toLocaleLowerCase('pt-BR'));if(new Set(names).size!==names.length)throw Error('Cada cargo precisa de um nome diferente.');
   await c.query('UPDATE guilds SET ranks=$2 WHERE id=$1',[g.id,JSON.stringify(clean)]);
   return {guildId:g.id};
  });
 }
 async disband(leaderId:string){
  return this.transaction(async c=>{
   const {g}=await this.actor(c,leaderId,'owner');
   const members=(await c.query('SELECT player_id FROM guild_members WHERE guild_id=$1',[g.id])).rows.map(row=>row.player_id as string);
   const stored=await c.query('SELECT goods FROM guild_storage WHERE guild_id=$1',[g.id]);let profile:Profile|null=null;
   if(stored.rows.length){profile=await this.lockPlayer(c,leaderId);applyAttachments(profile,stored.rows.map(row=>goodsAttachment(row.goods as AuctionGoods)));refreshWorn(profile);await this.saveProfile(c,profile);}
   await c.query('DELETE FROM guilds WHERE id=$1',[g.id]);
   return {guildId:g.id,members,profile};
  });
 }
}
