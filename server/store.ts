import pg from 'pg';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {CATALOG,CONTENT_VERSION,DEFAULT_EQUIPMENT,ITEMS,MAX_UPGRADE,normalizeDyes,SLOT_NAMES,STARTER_STONES,STONES,upgradeChance,WEAPONS} from '../shared/catalog';
import type {Equipment,Slot} from '../shared/catalog';
import {stoneSelectionSchema} from '../shared/protocol';
import type {ForgeResult,Profile} from '../shared/protocol';
export interface ForgeOutcome {profile:Profile;result:ForgeResult;}
export interface ProfileStore {saveEquipment(id:string,equipment:Equipment):Promise<Profile>;forge(id:string,item:string,stones:Record<string,number>):Promise<ForgeOutcome>;rename(id:string,name:string):Promise<void>;finishMatch(matchId:string,winners:string[],players:string[]):Promise<void>;getProfile(id:string):Promise<Profile|null>;}

type StoredProfile = Partial<Omit<Profile,'equipment'>> & Pick<Profile,'id'|'name'> & {equipment?:Partial<Equipment>};
const integer=(value:unknown,fallback=0,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(0,Math.floor(value))):fallback;

// Missing fields are migrated once on read; an empty stone stack stays empty.
export function normalizeProfile(raw:StoredProfile):Profile {
 const inventory=Array.isArray(raw.inventory)?[...new Set(raw.inventory.filter(id=>Object.hasOwn(CATALOG,id)))]:ITEMS.map(i=>i.id);
 if(!raw.upgrades&&!inventory.includes('hat-cap'))inventory.push('hat-cap');
 if((raw.contentVersion??0)<CONTENT_VERSION)for(const item of ITEMS)if(item.visual&&!inventory.includes(item.id))inventory.push(item.id);
 const upgrades=Object.fromEntries(WEAPONS.map(w=>[w.id,integer(raw.upgrades?.[w.id],0,MAX_UPGRADE)]));
 const stones=Object.fromEntries(STONES.map(s=>[String(s.level),raw.stones?integer(raw.stones[String(s.level)]):STARTER_STONES[String(s.level)]]));
 const equipment={...DEFAULT_EQUIPMENT};
 for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const id=raw.equipment?.[slot];if(id&&Object.hasOwn(CATALOG,id)&&CATALOG[id].slot===slot&&inventory.includes(id))equipment[slot]=id;}
 equipment.upgrade=upgrades[equipment.weapon]??0;
 equipment.dyes=normalizeDyes(raw.equipment?.dyes);
 return {id:raw.id,name:raw.name,level:Math.max(1,integer(raw.level,1)),xp:integer(raw.xp),gold:integer(raw.gold),wins:integer(raw.wins),matches:integer(raw.matches),equipment,inventory,equippedOnce:raw.equippedOnce===true,upgrades,stones,contentVersion:CONTENT_VERSION};
}

export class Store implements ProfileStore {
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa',max:12});
 constructor(private readonly roll:()=>number=()=>randomInt(1000)){}
 async init(){await this.pool.query(`
 CREATE TABLE IF NOT EXISTS players(id uuid PRIMARY KEY,name varchar(24) NOT NULL,profile jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS sessions(token_hash char(64) PRIMARY KEY,player_id uuid REFERENCES players(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions(expires_at);
 CREATE TABLE IF NOT EXISTS matches(id uuid PRIMARY KEY,winners jsonb NOT NULL,players jsonb NOT NULL,finished_at timestamptz NOT NULL DEFAULT now());
 DELETE FROM sessions WHERE expires_at<now();
 `);}
 hash(token:string){return createHash('sha256').update(token).digest('hex');}
 async session(token:string|undefined):Promise<Profile|null>{if(!token||!/^[0-9a-f]{64}$/.test(token))return null;const r=await this.pool.query('SELECT p.profile,p.name FROM sessions s JOIN players p ON p.id=s.player_id WHERE token_hash=$1 AND expires_at>now()',[this.hash(token)]);return r.rows[0]?normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}):null;}
 async createGuest(){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const profile=normalizeProfile({id,name:`Aventureiro${randomBytes(2).readUInt16BE()%10000}`,level:1,xp:0,gold:500,wins:0,matches:0,equipment:{...DEFAULT_EQUIPMENT},inventory:ITEMS.map(i=>i.id),equippedOnce:false});
  const conn=await this.pool.connect();try{await conn.query('BEGIN');await conn.query('INSERT INTO players(id,name,profile) VALUES($1,$2,$3)',[id,profile.name,profile]);await conn.query("INSERT INTO sessions VALUES($1,$2,now()+interval '30 days')",[this.hash(token),id]);await conn.query('COMMIT');}catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
  return {token,profile};
 }
 async getProfile(id:string){const r=await this.pool.query('SELECT profile,name FROM players WHERE id=$1',[id]);return r.rows[0]?normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}):null;}
 async saveEquipment(id:string,equipment:Equipment):Promise<Profile>{
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);
   if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
   for(const slot of Object.keys(SLOT_NAMES) as Slot[]){const item=CATALOG[equipment[slot]];if(!item||item.slot!==slot||!profile.inventory.includes(item.id))throw Error('Este item não está na sua mochila.');}
   profile.equipment={...equipment,dyes:normalizeDyes(equipment.dyes),upgrade:profile.upgrades[equipment.weapon]??0};profile.equippedOnce=true;
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
   if(!WEAPONS.some(w=>w.id===item)||!profile.inventory.includes(item))throw Error('Escolha uma arma da sua mochila.');
   const level=profile.upgrades[item]??0;if(level>=MAX_UPGRADE)throw Error('Esta arma já está no nível máximo.');
   for(const [tier,quantity] of Object.entries(consumed))if((profile.stones[tier]??0)<quantity)throw Error('Você não tem essas pedras na mochila.');
   const chance=upgradeChance(level,consumed),success=this.roll()<Math.round(chance*10);
   for(const [tier,quantity] of Object.entries(consumed))profile.stones[tier]-=quantity;
   if(success)profile.upgrades[item]=level+1;
   profile.equipment.upgrade=profile.upgrades[profile.equipment.weapon]??0;
   const result:ForgeResult={item,success,level:profile.upgrades[item],chance,consumed};
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,profile]);await c.query('COMMIT');return {profile,result};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async rename(id:string,name:string){await this.pool.query('UPDATE players SET name=$2 WHERE id=$1',[id,name]);}
 async finishMatch(matchId:string,winners:string[],players:string[]){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const inserted=await c.query('INSERT INTO matches(id,winners,players) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[matchId,JSON.stringify(winners),JSON.stringify(players)]);
   if(inserted.rowCount)for(const id of [...players].sort()){
    const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])continue;
    const p=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}),win=winners.includes(id);p.matches++;p.wins+=win?1:0;p.xp+=win?120:50;p.gold+=win?80:25;p.level=1+Math.floor(p.xp/300);
    await c.query('UPDATE players SET profile=$2 WHERE id=$1',[id,p]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
