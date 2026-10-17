import type pg from 'pg';
import {newSessionToken,tokenHash} from './adminAuth';
import {RANKING_TIME_ZONE} from './store';
import type {AdminRevision,MapKind} from '../shared/mapAdmin';

/** Admin sessions, the audit log and the maps edited in the panel (revisions with their terrain art). */
export const ADMIN_SESSION_HOURS=8;
const TODAY=`(date_trunc('day',now() AT TIME ZONE '${RANKING_TIME_ZONE}') AT TIME ZONE '${RANKING_TIME_ZONE}')`;

export interface StoredRevision {id:number;mapId:string;data:Record<string,unknown>&{kind:MapKind;name:string};note:string|null;createdAt:string;createdBy:string;}
export interface StoredMap {id:string;kind:MapKind;base:string;draftRevision:number|null;publishedRevision:number|null;updatedAt:string;updatedBy:string|null;}

export class AdminStore {
 constructor(private pool:pg.Pool){}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS admin_sessions(token_hash char(64) PRIMARY KEY,username varchar(64) NOT NULL,ip varchar(64),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_audit(id bigserial PRIMARY KEY,at timestamptz NOT NULL DEFAULT now(),username varchar(64),ip varchar(64),action varchar(40) NOT NULL,detail jsonb);
  CREATE TABLE IF NOT EXISTS game_maps(id varchar(32) PRIMARY KEY,kind varchar(12) NOT NULL,base varchar(32) NOT NULL,draft_revision bigint,published_revision bigint,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),updated_by varchar(64));
  CREATE TABLE IF NOT EXISTS game_map_revisions(id bigserial PRIMARY KEY,map_id varchar(32) NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,data jsonb NOT NULL,terrain bytea,preview bytea,note varchar(200),created_at timestamptz NOT NULL DEFAULT now(),created_by varchar(64) NOT NULL);
  CREATE INDEX IF NOT EXISTS game_map_revisions_map ON game_map_revisions(map_id,id DESC);
 `);}

 async createSession(username:string,ip:string){
  const token=newSessionToken();
  await this.pool.query(`DELETE FROM admin_sessions WHERE expires_at<now()`);
  await this.pool.query(`INSERT INTO admin_sessions(token_hash,username,ip,expires_at) VALUES($1,$2,$3,now()+interval '${ADMIN_SESSION_HOURS} hours')`,[tokenHash(token),username,ip.slice(0,64)]);
  return token;
 }
 async session(token:string|undefined):Promise<string|null>{
  if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
  const r=await this.pool.query('SELECT username FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()',[tokenHash(token)]);
  return r.rows[0]?.username??null;
 }
 async endSession(token:string|undefined){if(token&&/^[0-9a-f]{64}$/.test(token))await this.pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[tokenHash(token)]);}
 /** Every session of the user ends, e.g. after the password changes. */
 async endSessionsOf(username:string){await this.pool.query('DELETE FROM admin_sessions WHERE username=$1',[username]);}
 async audit(username:string|null,ip:string,action:string,detail:Record<string,unknown>={}){
  await this.pool.query('INSERT INTO admin_audit(username,ip,action,detail) VALUES($1,$2,$3,$4)',[username,ip.slice(0,64),action,detail]);
 }
 async recentAudit(limit=30){
  const r=await this.pool.query('SELECT at,username,action,detail FROM admin_audit ORDER BY id DESC LIMIT $1',[limit]);
  return r.rows.map(row=>({at:new Date(row.at).toISOString(),username:row.username as string|null,action:row.action as string,detail:row.detail as Record<string,unknown>}));
 }

 // ── Maps ─────────────────────────────────────────────────────────────
 private mapRow(row:Record<string,unknown>):StoredMap{
  return {id:row.id as string,kind:row.kind as MapKind,base:row.base as string,draftRevision:row.draft_revision==null?null:Number(row.draft_revision),publishedRevision:row.published_revision==null?null:Number(row.published_revision),updatedAt:new Date(row.updated_at as string).toISOString(),updatedBy:row.updated_by as string|null};
 }
 private revisionRow(row:Record<string,unknown>):StoredRevision{
  return {id:Number(row.id),mapId:row.map_id as string,data:row.data as StoredRevision['data'],note:row.note as string|null,createdAt:new Date(row.created_at as string).toISOString(),createdBy:row.created_by as string};
 }
 async maps():Promise<(StoredMap&{draft:StoredRevision['data']|null})[]>{
  const r=await this.pool.query('SELECT m.*,r.data FROM game_maps m LEFT JOIN game_map_revisions r ON r.id=coalesce(m.draft_revision,m.published_revision) ORDER BY m.created_at');
  return r.rows.map(row=>({...this.mapRow(row),draft:row.data??null}));
 }
 async map(id:string){const r=await this.pool.query('SELECT * FROM game_maps WHERE id=$1',[id]);return r.rows[0]?this.mapRow(r.rows[0]):null;}
 async revision(mapId:string,revision:number){
  const r=await this.pool.query('SELECT id,map_id,data,note,created_at,created_by FROM game_map_revisions WHERE map_id=$1 AND id=$2',[mapId,revision]);
  return r.rows[0]?this.revisionRow(r.rows[0]):null;
 }
 async revisions(mapId:string,publishedRevision:number|null):Promise<AdminRevision[]>{
  const r=await this.pool.query(`SELECT id,note,created_at,created_by,jsonb_array_length(coalesce(data->'warnings','[]'::jsonb)) AS warnings FROM game_map_revisions WHERE map_id=$1 ORDER BY id DESC LIMIT 50`,[mapId]);
  return r.rows.map(row=>({id:Number(row.id),createdAt:new Date(row.created_at).toISOString(),createdBy:row.created_by,note:row.note,published:Number(row.id)===publishedRevision,warnings:Number(row.warnings)}));
 }
 async image(mapId:string,revision:number,kind:'terrain'|'preview'):Promise<Buffer|null>{
  const r=await this.pool.query(`SELECT ${kind==='terrain'?'terrain':'preview'} AS image FROM game_map_revisions WHERE map_id=$1 AND id=$2`,[mapId,revision]);
  return r.rows[0]?.image??null;
 }
 /** Saves a revision as the map's draft, creating the map row the first time. */
 async saveRevision(input:{mapId:string;kind:MapKind;base:string;data:Record<string,unknown>;terrain:Buffer|null;preview:Buffer|null;note?:string;username:string}){
  const c=await this.pool.connect();
  try{
   await c.query('BEGIN');
   await c.query(`INSERT INTO game_maps(id,kind,base,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET updated_at=now(),updated_by=EXCLUDED.updated_by`,[input.mapId,input.kind,input.base,input.username]);
   const r=await c.query('INSERT INTO game_map_revisions(map_id,data,terrain,preview,note,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[input.mapId,input.data,input.terrain,input.preview,input.note??null,input.username]);
   const id=Number(r.rows[0].id);
   await c.query('UPDATE game_maps SET draft_revision=$2 WHERE id=$1',[input.mapId,id]);
   // Old drafts beyond the latest 50 are dropped, but never the published one.
   await c.query('DELETE FROM game_map_revisions WHERE map_id=$1 AND id NOT IN (SELECT id FROM game_map_revisions WHERE map_id=$1 ORDER BY id DESC LIMIT 50) AND id IS DISTINCT FROM (SELECT published_revision FROM game_maps WHERE id=$1)',[input.mapId]);
   await c.query('COMMIT');return id;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async publish(mapId:string,revision:number,username:string){
  const r=await this.pool.query('UPDATE game_maps m SET published_revision=$2,draft_revision=$2,updated_at=now(),updated_by=$3 WHERE id=$1 AND EXISTS(SELECT 1 FROM game_map_revisions WHERE id=$2 AND map_id=$1) RETURNING id',[mapId,revision,username]);
  return (r.rowCount??0)>0;
 }
 async unpublish(mapId:string,username:string){await this.pool.query('UPDATE game_maps SET published_revision=NULL,updated_at=now(),updated_by=$2 WHERE id=$1',[mapId,username]);}
 async deleteMap(mapId:string){await this.pool.query('DELETE FROM game_maps WHERE id=$1',[mapId]);}
 /** Every map with a published revision, as the game applies them. */
 async published():Promise<{map:StoredMap;revision:StoredRevision}[]>{
  const r=await this.pool.query('SELECT m.*,r.id AS rev_id,r.map_id,r.data,r.note,r.created_at AS rev_created_at,r.created_by FROM game_maps m JOIN game_map_revisions r ON r.id=m.published_revision ORDER BY m.created_at');
  return r.rows.map(row=>({map:this.mapRow(row),revision:this.revisionRow({...row,id:row.rev_id,created_at:row.rev_created_at})}));
 }

 // ── Statistics (Brasília day, like the daily ranking) ────────────────
 async stats(){
  const [players,today,days,top,recent]=await Promise.all([
   this.pool.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE created_at>=${TODAY})::int AS new_today,count(*) FILTER (WHERE created_at>=now()-interval '7 days')::int AS new_week FROM players`),
   this.pool.query(`SELECT count(*)::int AS matches,coalesce(sum(jsonb_array_length(winners)),0)::int AS wins,
     count(*) FILTER (WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(players) p WHERE p LIKE 'bot-%'))::int AS bot_matches,
     (SELECT count(DISTINCT p)::int FROM matches m2 CROSS JOIN LATERAL jsonb_array_elements_text(m2.players) p WHERE m2.finished_at>=${TODAY} AND p NOT LIKE 'bot-%') AS active
     FROM matches WHERE finished_at>=${TODAY}`),
   this.pool.query(`SELECT to_char(d,'YYYY-MM-DD') AS day,count(m.id)::int AS matches,count(DISTINCT p.id)::int AS players
     FROM generate_series((now() AT TIME ZONE '${RANKING_TIME_ZONE}')::date-13,(now() AT TIME ZONE '${RANKING_TIME_ZONE}')::date,interval '1 day') AS d
     LEFT JOIN matches m ON (m.finished_at AT TIME ZONE '${RANKING_TIME_ZONE}')::date=d::date
     LEFT JOIN LATERAL (SELECT x AS id FROM jsonb_array_elements_text(m.players) x WHERE x NOT LIKE 'bot-%') p ON true
     GROUP BY d ORDER BY d`),
   this.pool.query(`SELECT w.id,p.name,(p.profile->>'level')::int AS level,count(*)::int AS wins FROM matches m CROSS JOIN LATERAL jsonb_array_elements_text(m.winners) AS w(id) JOIN players p ON p.id::text=w.id
     WHERE m.finished_at>=${TODAY} GROUP BY w.id,p.name,p.profile ORDER BY wins DESC,max(m.finished_at) ASC LIMIT 10`),
   this.pool.query(`SELECT id,name,(profile->>'level')::int AS level,created_at FROM players ORDER BY created_at DESC LIMIT 8`),
  ]);
  return {
   players:{total:players.rows[0].total,newToday:players.rows[0].new_today,newWeek:players.rows[0].new_week},
   today:{matches:today.rows[0].matches,wins:today.rows[0].wins,botMatches:today.rows[0].bot_matches,activePlayers:today.rows[0].active??0},
   days:days.rows.map(row=>({day:row.day as string,matches:row.matches as number,players:row.players as number})),
   topToday:top.rows.map(row=>({id:row.id as string,name:row.name as string,level:row.level??1,wins:row.wins as number})),
   newestPlayers:recent.rows.map(row=>({id:row.id as string,name:row.name as string,level:row.level??1,createdAt:new Date(row.created_at).toISOString()})),
  };
 }
}
