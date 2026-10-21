import type pg from 'pg';
import {AccountError} from '../../server/accounts';
import {FORUM_CATEGORIES,FORUM_LIMITS,FORUM_PAGE,type ForumCategory} from '../src/forumRules';

/**
 * Mini fórum da comunidade (docs/site.md): tópicos por categoria, respostas e curtidas.
 * Text is stored and served as plain text; the page never renders it as HTML.
 */
export class ForumStore {
 constructor(readonly pool:pg.Pool){}
 async init(){await this.pool.query(`
 CREATE TABLE IF NOT EXISTS forum_topics(id bigserial PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,category varchar(16) NOT NULL,title varchar(90) NOT NULL,body text NOT NULL,pinned boolean NOT NULL DEFAULT false,reply_count int NOT NULL DEFAULT 0,like_count int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),last_activity_at timestamptz NOT NULL DEFAULT now(),deleted boolean NOT NULL DEFAULT false);
 CREATE INDEX IF NOT EXISTS forum_topics_activity ON forum_topics(deleted,pinned DESC,last_activity_at DESC);
 CREATE TABLE IF NOT EXISTS forum_replies(id bigserial PRIMARY KEY,topic_id bigint NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,body text NOT NULL,like_count int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),deleted boolean NOT NULL DEFAULT false);
 CREATE INDEX IF NOT EXISTS forum_replies_topic ON forum_replies(topic_id,created_at);
 CREATE TABLE IF NOT EXISTS forum_likes(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind char(1) NOT NULL,target_id bigint NOT NULL,PRIMARY KEY(account_id,kind,target_id));
 `);}
 /** Author name, avatar and the highest level among the account's characters (null before the first Jogar). */
 private readonly author=`a.username AS author,a.avatar AS author_avatar,(SELECT max((p.profile->>'level')::int) FROM account_characters c JOIN players p ON p.id=c.player_id WHERE c.account_id=a.id) AS author_level`;
 async topics(category:string|undefined,page:number,viewer:string|null){
  const cat=FORUM_CATEGORIES.some(c=>c.id===category)?category:null;
  const where=`t.deleted=false${cat?' AND t.category=$3':''}`;
  const args:unknown[]=[FORUM_PAGE,(page-1)*FORUM_PAGE];if(cat)args.push(cat);
  const viewerArg=`$${args.length+1}`;args.push(viewer);
  const [list,total]=await Promise.all([
   this.pool.query(`SELECT t.id,t.category,t.title,left(t.body,180) AS excerpt,t.pinned,t.reply_count,t.like_count,t.created_at,t.last_activity_at,${this.author},
    EXISTS(SELECT 1 FROM forum_likes l WHERE l.kind='t' AND l.target_id=t.id AND l.account_id=${viewerArg}::uuid) AS liked
    FROM forum_topics t JOIN accounts a ON a.id=t.account_id WHERE ${where} ORDER BY t.pinned DESC,t.last_activity_at DESC LIMIT $1 OFFSET $2`,args),
   this.pool.query(`SELECT count(*)::int AS n FROM forum_topics t WHERE ${where.replace('$3','$1')}`,cat?[cat]:[]),
  ]);
  return {topics:list.rows.map(topicRow),total:total.rows[0].n as number,page,pageSize:FORUM_PAGE};
 }
 async topic(id:number,viewer:string|null){
  const t=await this.pool.query(`SELECT t.*,${this.author},t.account_id=$2::uuid AS mine,EXISTS(SELECT 1 FROM forum_likes l WHERE l.kind='t' AND l.target_id=t.id AND l.account_id=$2::uuid) AS liked
   FROM forum_topics t JOIN accounts a ON a.id=t.account_id WHERE t.id=$1 AND t.deleted=false`,[id,viewer]);
  if(!t.rows[0])throw new AccountError('Tópico não encontrado.',404);
  const replies=await this.pool.query(`SELECT r.id,r.body,r.like_count,r.created_at,${this.author},r.account_id=$2::uuid AS mine,EXISTS(SELECT 1 FROM forum_likes l WHERE l.kind='r' AND l.target_id=r.id AND l.account_id=$2::uuid) AS liked
   FROM forum_replies r JOIN accounts a ON a.id=r.account_id WHERE r.topic_id=$1 AND r.deleted=false ORDER BY r.created_at LIMIT 500`,[id,viewer]);
  return {topic:{...topicRow(t.rows[0]),body:t.rows[0].body as string,mine:!!t.rows[0].mine},replies:replies.rows.map(r=>({id:Number(r.id),body:r.body,likes:r.like_count,createdAt:new Date(r.created_at).toISOString(),author:r.author,authorAvatar:r.author_avatar,authorLevel:r.author_level,mine:!!r.mine,liked:!!r.liked}))};
 }
 async createTopic(accountId:string,category:string,title:string,body:string){
  title=clean(title);body=clean(body);
  if(!FORUM_CATEGORIES.some(c=>c.id===category))throw new AccountError('Escolha uma categoria.');
  if(title.length<FORUM_LIMITS.titleMin||title.length>FORUM_LIMITS.titleMax)throw new AccountError(`O título precisa ter de ${FORUM_LIMITS.titleMin} a ${FORUM_LIMITS.titleMax} caracteres.`);
  if(body.length<FORUM_LIMITS.bodyMin||body.length>FORUM_LIMITS.topicMax)throw new AccountError(`A mensagem precisa ter de ${FORUM_LIMITS.bodyMin} a ${FORUM_LIMITS.topicMax} caracteres.`);
  const r=await this.pool.query('INSERT INTO forum_topics(account_id,category,title,body) VALUES($1,$2,$3,$4) RETURNING id',[accountId,category as ForumCategory,title,body]);
  return Number(r.rows[0].id);
 }
 async reply(accountId:string,topicId:number,body:string){
  body=clean(body);
  if(body.length<FORUM_LIMITS.bodyMin||body.length>FORUM_LIMITS.replyMax)throw new AccountError(`A resposta precisa ter de ${FORUM_LIMITS.bodyMin} a ${FORUM_LIMITS.replyMax} caracteres.`);
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const t=await c.query('UPDATE forum_topics SET reply_count=reply_count+1,last_activity_at=now() WHERE id=$1 AND deleted=false RETURNING id',[topicId]);
   if(!t.rows[0])throw new AccountError('Tópico não encontrado.',404);
   const r=await c.query('INSERT INTO forum_replies(topic_id,account_id,body) VALUES($1,$2,$3) RETURNING id',[topicId,accountId,body]);
   await c.query('COMMIT');return Number(r.rows[0].id);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 /** Like or unlike; returns the new state and count. */
 async toggleLike(accountId:string,kind:'t'|'r',targetId:number){
  const table=kind==='t'?'forum_topics':'forum_replies';
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const target=await c.query(`SELECT id FROM ${table} WHERE id=$1 AND deleted=false FOR UPDATE`,[targetId]);
   if(!target.rows[0])throw new AccountError('Mensagem não encontrada.',404);
   const removed=await c.query('DELETE FROM forum_likes WHERE account_id=$1 AND kind=$2 AND target_id=$3',[accountId,kind,targetId]);
   if(!removed.rowCount)await c.query('INSERT INTO forum_likes VALUES($1,$2,$3)',[accountId,kind,targetId]);
   const n=await c.query(`UPDATE ${table} SET like_count=like_count+$2 WHERE id=$1 RETURNING like_count`,[targetId,removed.rowCount?-1:1]);
   await c.query('COMMIT');return {liked:!removed.rowCount,likes:n.rows[0].like_count as number};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 /** Authors remove their own topic or reply. */
 async remove(accountId:string,kind:'t'|'r',targetId:number){
  if(kind==='t'){const r=await this.pool.query('UPDATE forum_topics SET deleted=true WHERE id=$1 AND account_id=$2 AND deleted=false',[targetId,accountId]);if(!r.rowCount)throw new AccountError('Tópico não encontrado.',404);return;}
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const r=await c.query('UPDATE forum_replies SET deleted=true WHERE id=$1 AND account_id=$2 AND deleted=false RETURNING topic_id',[targetId,accountId]);
   if(!r.rows[0])throw new AccountError('Resposta não encontrada.',404);
   await c.query('UPDATE forum_topics SET reply_count=greatest(reply_count-1,0) WHERE id=$1',[r.rows[0].topic_id]);
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async counts(){const r=await this.pool.query('SELECT (SELECT count(*)::int FROM accounts) AS accounts,(SELECT count(*)::int FROM forum_topics WHERE deleted=false) AS topics');return {accounts:r.rows[0].accounts as number,topics:r.rows[0].topics as number};}
}

/** Trims, drops control characters (keeps line breaks) and collapses runs of blank lines. */
function clean(text:string){return String(text??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'').replace(/\n{3,}/g,'\n\n').trim();}
function topicRow(r:any){return {id:Number(r.id),category:r.category as ForumCategory,title:r.title as string,excerpt:(r.excerpt??'') as string,pinned:!!r.pinned,replies:r.reply_count as number,likes:r.like_count as number,createdAt:new Date(r.created_at).toISOString(),lastActivityAt:new Date(r.last_activity_at).toISOString(),author:r.author as string,authorAvatar:r.author_avatar as string,authorLevel:r.author_level as number|null,liked:!!r.liked};}
