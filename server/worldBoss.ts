import type pg from 'pg';
import {nextScheduleStart,scheduleWindowAt,WORLD_BOSS_DEFAULT_HP,WORLD_BOSS_DEFAULT_NAME,WORLD_BOSS_ID,WORLD_BOSS_MAX_MINUTES,WORLD_BOSS_MIN_MINUTES,WORLD_BOSS_RANKING_SIZE,WORLD_BOSS_RESULTS_MS} from '../shared/worldBoss';
import type {WorldBossAdminState,WorldBossEndReason,WorldBossOccurrence,WorldBossRanking,WorldBossRankRow,WorldBossSchedule,WorldBossSettings,WorldBossStatus} from '../shared/worldBoss';

/** One turn of damage from one attempt. The key (occurrence, battle, turn, player) makes a retry count once. */
export interface WorldBossDamage {occurrenceId:string;battleId:string;turn:number;playerId:string;name:string;level:number;damage:number;}
export interface WorldBossCommit {applied:number;hp:number;defeated:boolean;}
/** What the game needs from the event (tests use a fake). */
export interface WorldBossRealm {
 status():WorldBossStatus;
 commit(entry:WorldBossDamage):Promise<WorldBossCommit>;
 attempt(occurrenceId:string,playerId:string,name:string,level:number):Promise<void>;
 ranking(playerId:string|null):Promise<WorldBossRanking>;
}

const ms=(value:unknown)=>value==null?null:new Date(value as string).getTime();
const occurrence=(row:Record<string,unknown>):WorldBossOccurrence=>({id:row.id as string,origin:row.origin as 'manual'|'schedule',status:row.status as 'active'|'ended',name:row.name as string,
 startsAt:ms(row.starts_at)!,endsAt:ms(row.ends_at)!,maxHp:Number(row.max_hp),hp:Number(row.hp),startedBy:row.started_by as string|null,stoppedBy:row.stopped_by as string|null,
 endReason:row.end_reason as WorldBossEndReason|null,finishedAt:ms(row.finished_at),finalBlow:row.final_blow as string|null,fighters:Number(row.fighters??0)});
const rankRow=(row:Record<string,unknown>):WorldBossRankRow=>({rank:Number(row.rank),playerId:row.player_id as string,name:row.name as string,level:Number(row.level),damage:Number(row.damage),attempts:Number(row.attempts)});

/**
 * The Chefão Mundial in Postgres: settings, schedules, each occurrence with its global life, the damage ledger and the ranking.
 * Nothing lives only in memory: a restart picks the event up where it was (docs/world-boss.md).
 */
export class WorldBossService implements WorldBossRealm {
 private current:WorldBossStatus={phase:'idle',name:WORLD_BOSS_DEFAULT_NAME,hp:0,maxHp:0,fighters:0};
 private ticking=false;
 /** Called whenever the status clients see changes (start, end, life). */
 onChange?:(status:WorldBossStatus)=>void;
 constructor(private pool:pg.Pool,private now:()=>number=Date.now){}
 async init(){
  await this.pool.query(`
  CREATE TABLE IF NOT EXISTS world_boss_settings(id varchar(16) PRIMARY KEY,name varchar(40) NOT NULL,max_hp bigint NOT NULL,enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now(),updated_by varchar(64));
  CREATE TABLE IF NOT EXISTS world_boss_schedules(id bigserial PRIMARY KEY,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,repeat varchar(8) NOT NULL DEFAULT 'none',enabled boolean NOT NULL DEFAULT true,created_by varchar(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
  CREATE TABLE IF NOT EXISTS world_boss_occurrences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slot_key varchar(120) NOT NULL UNIQUE,origin varchar(10) NOT NULL,status varchar(8) NOT NULL,name varchar(40) NOT NULL,
   starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,max_hp bigint NOT NULL,hp bigint NOT NULL CHECK(hp>=0),started_by varchar(64),stopped_by varchar(64),end_reason varchar(10),finished_at timestamptz,final_blow varchar(24),created_at timestamptz NOT NULL DEFAULT now());
  CREATE UNIQUE INDEX IF NOT EXISTS world_boss_one_active ON world_boss_occurrences((true)) WHERE status='active';
  CREATE INDEX IF NOT EXISTS world_boss_occurrences_recent ON world_boss_occurrences(starts_at DESC);
  CREATE TABLE IF NOT EXISTS world_boss_damage(occurrence_id uuid NOT NULL REFERENCES world_boss_occurrences(id) ON DELETE CASCADE,battle_id uuid NOT NULL,turn integer NOT NULL,player_id uuid NOT NULL,
   damage bigint NOT NULL,applied bigint NOT NULL,at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(occurrence_id,battle_id,turn,player_id));
  CREATE TABLE IF NOT EXISTS world_boss_ranking(occurrence_id uuid NOT NULL REFERENCES world_boss_occurrences(id) ON DELETE CASCADE,player_id uuid NOT NULL,name varchar(24) NOT NULL,level integer NOT NULL,
   damage bigint NOT NULL DEFAULT 0,attempts integer NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(occurrence_id,player_id));
  CREATE INDEX IF NOT EXISTS world_boss_ranking_damage ON world_boss_ranking(occurrence_id,damage DESC,updated_at);
  `);
  await this.pool.query('INSERT INTO world_boss_settings(id,name,max_hp) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[WORLD_BOSS_ID,WORLD_BOSS_DEFAULT_NAME,WORLD_BOSS_DEFAULT_HP]);
  await this.tick();
 }
 status(){return this.current;}
 async settings():Promise<WorldBossSettings>{
  const r=await this.pool.query('SELECT name,max_hp,enabled FROM world_boss_settings WHERE id=$1',[WORLD_BOSS_ID]);
  const row=r.rows[0];return {name:row.name,maxHp:Number(row.max_hp),enabled:row.enabled};
 }
 async saveSettings(settings:WorldBossSettings,by:string){
  await this.pool.query('UPDATE world_boss_settings SET name=$2,max_hp=$3,enabled=$4,updated_at=now(),updated_by=$5 WHERE id=$1',[WORLD_BOSS_ID,settings.name,settings.maxHp,settings.enabled,by]);
  await this.tick();
 }
 /**
  * Opens the scheduled windows, closes events whose time ran out and reloads what clients see.
  * Runs every second; a window that was stopped by hand does not open again (its slot key is taken).
  */
 async tick(){
  if(this.ticking)return;this.ticking=true;
  try{
   const now=new Date(this.now());
   await this.pool.query(`UPDATE world_boss_occurrences SET status='ended',end_reason='time',finished_at=ends_at WHERE status='active' AND ends_at<=$1`,[now]);
   const settings=await this.settings();
   if(settings.enabled){
    const schedules=await this.pool.query('SELECT id,starts_at,ends_at,repeat FROM world_boss_schedules WHERE enabled ORDER BY starts_at');
    for(const row of schedules.rows){
     const window=scheduleWindowAt({startsAt:ms(row.starts_at)!,endsAt:ms(row.ends_at)!,repeat:row.repeat},now.getTime());if(!window)continue;
     await this.pool.query(`INSERT INTO world_boss_occurrences(slot_key,origin,status,name,starts_at,ends_at,max_hp,hp) VALUES($1,'schedule','active',$2,$3,$4,$5,$5)
      ON CONFLICT DO NOTHING`,[`sched:${row.id}:${new Date(window.startsAt).toISOString()}`,settings.name,new Date(window.startsAt),new Date(window.endsAt),settings.maxHp]);
    }
   }
   await this.reload();
  }finally{this.ticking=false;}
 }
 private async reload(){
  const now=this.now();
  const r=await this.pool.query(`SELECT o.*,(SELECT count(*) FROM world_boss_ranking k WHERE k.occurrence_id=o.id AND k.damage>0) AS fighters FROM world_boss_occurrences o
   WHERE status='active' OR finished_at>$1 ORDER BY (status='active') DESC,finished_at DESC LIMIT 1`,[new Date(now-WORLD_BOSS_RESULTS_MS)]);
  const o=r.rows[0]?occurrence(r.rows[0]):null;
  const next:WorldBossStatus=!o?{phase:'idle',name:(await this.settings()).name,hp:0,maxHp:0,fighters:0}
   :{phase:o.status==='active'?'active':'results',occurrenceId:o.id,name:o.name,hp:o.hp,maxHp:o.maxHp,startsAt:o.startsAt,endsAt:o.endsAt,fighters:o.fighters,
    ...(o.finishedAt!==null?{finishedAt:o.finishedAt,resultsUntil:o.finishedAt+WORLD_BOSS_RESULTS_MS}:{}),...(o.endReason?{endReason:o.endReason}:{}),...(o.finalBlow?{finalBlow:o.finalBlow}:{})};
  if(JSON.stringify(next)!==JSON.stringify(this.current)){this.current=next;this.onChange?.(next);}
 }
 /** Iniciar agora: always with an end. The same request id never opens two events. */
 async startNow(requestId:string,endsAt:number,by:string,options:{name?:string;maxHp?:number}={}){
  const now=this.now(),minutes=(endsAt-now)/60_000;
  if(minutes<WORLD_BOSS_MIN_MINUTES-.5||minutes>WORLD_BOSS_MAX_MINUTES)throw Error(`Escolha um fim entre ${WORLD_BOSS_MIN_MINUTES} minutos e 24 horas a partir de agora.`);
  const settings=await this.settings(),name=options.name??settings.name,maxHp=options.maxHp??settings.maxHp;
  try{
   const r=await this.pool.query(`INSERT INTO world_boss_occurrences(slot_key,origin,status,name,starts_at,ends_at,max_hp,hp,started_by) VALUES($1,'manual','active',$2,$3,$4,$5,$5,$6)
    ON CONFLICT(slot_key) DO NOTHING RETURNING id`,[`manual:${requestId}`,name,new Date(now),new Date(endsAt),maxHp,by]);
   await this.reload();
   if(!r.rows[0]){const again=await this.pool.query('SELECT id FROM world_boss_occurrences WHERE slot_key=$1',[`manual:${requestId}`]);return {id:again.rows[0].id as string,repeated:true};}
   return {id:r.rows[0].id as string,repeated:false};
  }catch(error){if((error as {code?:string}).code==='23505')throw Error('Já existe um Chefão Mundial ativo. Pare o atual antes de iniciar outro.');throw error;}
 }
 /** Parar agora: ends this occurrence only (schedules stay as they are). Stopping twice is harmless. */
 async stopNow(occurrenceId:string,by:string){
  const r=await this.pool.query(`UPDATE world_boss_occurrences SET status='ended',end_reason='admin',stopped_by=$2,finished_at=$3 WHERE id=$1 AND status='active' RETURNING id`,[occurrenceId,by,new Date(this.now())]);
  await this.reload();return {stopped:!!r.rows[0]};
 }
 async attempt(occurrenceId:string,playerId:string,name:string,level:number){
  await this.pool.query(`INSERT INTO world_boss_ranking(occurrence_id,player_id,name,level,attempts) VALUES($1,$2,$3,$4,1)
   ON CONFLICT(occurrence_id,player_id) DO UPDATE SET attempts=world_boss_ranking.attempts+1,name=EXCLUDED.name,level=EXCLUDED.level`,[occurrenceId,playerId,name,level]);
 }
 /**
  * Counts one turn of damage: the occurrence row is locked, the ledger key makes a retry a no-op,
  * the life only goes down (never below 0) and the blow that takes it to 0 ends the event.
  */
 async commit(entry:WorldBossDamage):Promise<WorldBossCommit>{
  const client=await this.pool.connect();let result:WorldBossCommit;
  try{
   await client.query('BEGIN');
   const o=await client.query('SELECT hp,status,ends_at FROM world_boss_occurrences WHERE id=$1 FOR UPDATE',[entry.occurrenceId]);
   const row=o.rows[0];
   if(!row||row.status!=='active'||ms(row.ends_at)!<=this.now()||entry.damage<=0){await client.query('ROLLBACK');return {applied:0,hp:row?Number(row.hp):0,defeated:false};}
   const hp=Number(row.hp),applied=Math.min(hp,Math.max(0,Math.round(entry.damage)));
   const ledger=await client.query('INSERT INTO world_boss_damage(occurrence_id,battle_id,turn,player_id,damage,applied) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING applied',
    [entry.occurrenceId,entry.battleId,entry.turn,entry.playerId,Math.round(entry.damage),applied]);
   if(!ledger.rows[0]){await client.query('ROLLBACK');return {applied:0,hp,defeated:false};}
   const left=hp-applied,defeated=left===0;
   await client.query(`UPDATE world_boss_occurrences SET hp=$2${defeated?`,status='ended',end_reason='defeated',finished_at=$4,final_blow=$3`:''} WHERE id=$1`,defeated?[entry.occurrenceId,left,entry.name,new Date(this.now())]:[entry.occurrenceId,left]);
   await client.query(`INSERT INTO world_boss_ranking(occurrence_id,player_id,name,level,damage) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(occurrence_id,player_id) DO UPDATE SET damage=world_boss_ranking.damage+EXCLUDED.damage,name=EXCLUDED.name,level=EXCLUDED.level,updated_at=now()`,[entry.occurrenceId,entry.playerId,entry.name,entry.level,applied]);
   await client.query('COMMIT');result={applied,hp:left,defeated};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
  await this.reload();return result;
 }
 /** The table of the window: top 50 by damage (ties: who got there first) and the viewer's own line. */
 async ranking(playerId:string|null):Promise<WorldBossRanking>{
  const occurrenceId=this.current.occurrenceId??null;if(!occurrenceId)return {occurrenceId:null,rows:[],me:null};
  const r=await this.pool.query(`WITH ranked AS (SELECT player_id,name,level,damage,attempts,row_number() OVER (ORDER BY damage DESC,updated_at) AS rank FROM world_boss_ranking WHERE occurrence_id=$1 AND damage>0)
   SELECT * FROM ranked WHERE rank<=$2 OR player_id=$3 ORDER BY rank`,[occurrenceId,WORLD_BOSS_RANKING_SIZE,playerId]);
  const rows=r.rows.map(rankRow);
  return {occurrenceId,rows:rows.filter(row=>row.rank<=WORLD_BOSS_RANKING_SIZE),me:rows.find(row=>row.playerId===playerId)??null};
 }
 async addSchedule(s:{startsAt:number;endsAt:number;repeat:string;enabled:boolean},by:string){
  const r=await this.pool.query('INSERT INTO world_boss_schedules(starts_at,ends_at,repeat,enabled,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[new Date(s.startsAt),new Date(s.endsAt),s.repeat,s.enabled,by]);
  await this.tick();return String(r.rows[0].id);
 }
 async updateSchedule(id:string,s:{startsAt:number;endsAt:number;repeat:string;enabled:boolean}){
  const r=await this.pool.query('UPDATE world_boss_schedules SET starts_at=$2,ends_at=$3,repeat=$4,enabled=$5 WHERE id=$1 RETURNING id',[id,new Date(s.startsAt),new Date(s.endsAt),s.repeat,s.enabled]);
  if(!r.rows[0])throw Error('Agendamento não encontrado.');await this.tick();
 }
 /** Removing a schedule never ends an event that is already running. */
 async removeSchedule(id:string){await this.pool.query('DELETE FROM world_boss_schedules WHERE id=$1',[id]);}
 async adminState():Promise<WorldBossAdminState>{
  const now=this.now();
  const schedules=await this.pool.query('SELECT * FROM world_boss_schedules ORDER BY starts_at');
  const history=await this.pool.query(`SELECT o.*,(SELECT count(*) FROM world_boss_ranking k WHERE k.occurrence_id=o.id AND k.damage>0) AS fighters FROM world_boss_occurrences o ORDER BY starts_at DESC LIMIT 20`);
  return {status:this.current,settings:await this.settings(),serverTime:now,history:history.rows.map(occurrence),
   schedules:schedules.rows.map(row=>{const base={startsAt:ms(row.starts_at)!,endsAt:ms(row.ends_at)!,repeat:row.repeat as WorldBossSchedule['repeat']};
    return {id:String(row.id),...base,enabled:row.enabled as boolean,createdBy:row.created_by as string,createdAt:ms(row.created_at)!,nextStartsAt:nextScheduleStart(base,now)};})};
 }
}
