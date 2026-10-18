import type pg from 'pg';
import {CATALOG,isArmorSlot,MAX_UPGRADE,nextCopyKey,WEAPONS} from '../shared/catalog';
import {canCompose,normalizeCompositions} from '../shared/composition';
import {MAX_COLOR_TICKETS} from '../shared/colors';
import {MAIL_DEFAULT_SENDER,MAIL_INBOX_LIMIT} from '../shared/mail';
import type {MailAttachment,MailClaimResult,MailMessage} from '../shared/mail';
import type {Profile} from '../shared/protocol';
import {normalizeProfile} from './store';

export interface NewMail {playerId:string;sender?:string;subject:string;body:string;attachments:MailAttachment[];createdBy:string;}
/** A message as the admin panel sees it, with who sent it and when it was received or deleted. */
export interface AdminMail extends MailMessage {createdBy:string;claimedAt:string|null;deleted:boolean;}
/** What the game needs from the mail store (tests use a fake). */
export interface MailBox {
 inbox(playerId:string):Promise<{mails:MailMessage[];unread:number}>;
 markRead(playerId:string,id:number):Promise<void>;
 claim(playerId:string,ids:number[]|null):Promise<{profile:Profile;result:MailClaimResult}>;
 remove(playerId:string,id:number):Promise<void>;
}

/** Puts the attachments into the profile: coins, stones and tickets add up; each item arrives as its own copy. */
export function applyAttachments(profile:Profile,attachments:readonly MailAttachment[]){
 for(const a of attachments){
  if(a.kind==='coins')profile.gold+=a.amount;
  else if(a.kind==='coupons')profile.coupons+=a.amount;
  else if(a.kind==='stone'){const tier=String(a.level);profile.stones[tier]=(profile.stones[tier]??0)+a.amount;}
  else if(a.kind==='composition')profile.compositionStones[a.stone]=(profile.compositionStones[a.stone]??0)+a.amount;
  else if(a.kind==='ticket')profile.colorTickets=Math.min(MAX_COLOR_TICKETS,profile.colorTickets+a.amount);
  else if(a.kind==='item'){
   // An item removed from the game after it was sent is simply skipped.
   if(!Object.hasOwn(CATALOG,a.item))continue;
   const item=CATALOG[a.item],weapon=WEAPONS.some(w=>w.id===a.item),level=Math.max(0,Math.min(MAX_UPGRADE,Math.floor(a.upgrade??0)));
   const compositions=a.compositions&&canCompose(item)?normalizeCompositions({[a.item]:a.compositions},[item])[a.item]:undefined;
   for(let i=0;i<a.quantity;i++){
    const key=nextCopyKey(profile.inventory,a.item);profile.inventory.push(key);
    if(weapon)profile.upgrades[key]=level;else if(isArmorSlot(item.slot)&&level)profile.upgrades[key]=level;
    if(compositions)profile.compositions[key]=compositions;
    if(a.color&&/^#[0-9a-f]{6}$/.test(a.color))profile.itemColors[key]=a.color;
   }
  }
 }
}

/** Writes a letter; inside a transaction when given its client (the Leilão pays and returns goods this way). */
export async function insertMail(db:Pick<pg.Pool,'query'>,mail:NewMail):Promise<number>{
 const r=await db.query('INSERT INTO player_mail(player_id,sender,subject,body,attachments,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
  [mail.playerId,mail.sender??MAIL_DEFAULT_SENDER,mail.subject,mail.body,JSON.stringify(mail.attachments),mail.createdBy]);
 return Number(r.rows[0].id);
}

const message=(row:Record<string,unknown>):MailMessage=>({id:Number(row.id),sender:row.sender as string,subject:row.subject as string,body:row.body as string,createdAt:new Date(row.created_at as string).toISOString(),
 read:row.read_at!=null,claimed:row.claimed_at!=null,attachments:row.attachments as MailAttachment[]});

/** Player mail in Postgres. Claiming locks the messages and the player in one transaction, so attachments arrive once. */
export class MailStore implements MailBox {
 constructor(private pool:pg.Pool){}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS player_mail(id bigserial PRIMARY KEY,player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),
   sender varchar(32) NOT NULL,subject varchar(60) NOT NULL,body varchar(1000) NOT NULL DEFAULT '',attachments jsonb NOT NULL DEFAULT '[]',
   read_at timestamptz,claimed_at timestamptz,deleted_at timestamptz,created_by varchar(64) NOT NULL);
  CREATE INDEX IF NOT EXISTS player_mail_inbox ON player_mail(player_id,id DESC);
 `);}
 async send(mail:NewMail):Promise<number>{return insertMail(this.pool,mail);}
 async inbox(playerId:string){
  const rows=await this.pool.query('SELECT * FROM player_mail WHERE player_id=$1 AND deleted_at IS NULL ORDER BY id DESC LIMIT $2',[playerId,MAIL_INBOX_LIMIT]);
  const mails=rows.rows.map(message);
  return {mails,unread:mails.filter(m=>!m.read||(!m.claimed&&m.attachments.length>0)).length};
 }
 async markRead(playerId:string,id:number){await this.pool.query('UPDATE player_mail SET read_at=now() WHERE id=$1 AND player_id=$2 AND read_at IS NULL',[id,playerId]);}
 /** Receives the attachments of the given messages (null: every message with something to receive). */
 async claim(playerId:string,ids:number[]|null){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const rows=await c.query(`SELECT id,attachments FROM player_mail WHERE player_id=$1 AND deleted_at IS NULL AND claimed_at IS NULL AND jsonb_array_length(attachments)>0 ${ids?'AND id=ANY($2::bigint[])':''} ORDER BY id FOR UPDATE`,ids?[playerId,ids]:[playerId]);
   if(!rows.rows.length)throw Error(ids?.length===1?'Esta carta já foi recebida.':'Nenhum anexo para receber.');
   const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[playerId]);if(!r.rows[0])throw Error('Jogador não encontrado.');
   const profile=normalizeProfile({...r.rows[0].profile,name:r.rows[0].name}),attachments=rows.rows.flatMap(row=>row.attachments as MailAttachment[]);
   applyAttachments(profile,attachments);
   const claimed=rows.rows.map(row=>Number(row.id));
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[playerId,profile]);
   await c.query('UPDATE player_mail SET claimed_at=now(),read_at=coalesce(read_at,now()) WHERE id=ANY($1::bigint[])',[claimed]);
   await c.query('COMMIT');
   return {profile,result:{claimed,attachments}};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 /** A message leaves the inbox only when nothing is left to receive in it. */
 async remove(playerId:string,id:number){
  const r=await this.pool.query(`UPDATE player_mail SET deleted_at=now(),read_at=coalesce(read_at,now()) WHERE id=$1 AND player_id=$2 AND deleted_at IS NULL AND (claimed_at IS NOT NULL OR jsonb_array_length(attachments)=0)`,[id,playerId]);
  if(!r.rowCount)throw Error('Receba os anexos antes de apagar a carta.');
 }
 async history(playerId:string,limit=50):Promise<AdminMail[]>{
  const rows=await this.pool.query('SELECT * FROM player_mail WHERE player_id=$1 ORDER BY id DESC LIMIT $2',[playerId,limit]);
  return rows.rows.map(row=>({...message(row),createdBy:row.created_by,claimedAt:row.claimed_at?new Date(row.claimed_at).toISOString():null,deleted:row.deleted_at!=null}));
 }
}
