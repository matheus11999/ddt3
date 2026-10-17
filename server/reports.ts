import type pg from 'pg';
import {REPORTS_PER_HOUR,REPORT_SAME_TARGET_MS} from '../shared/reports';
import type {ReportChatLine,ReportDetail,ReportReason,ReportStatus,ReportSummary} from '../shared/reports';

export interface NewReport {
 reporterId:string;reporterName:string;targetId:string;targetName:string;targetLevel:number;
 reason:ReportReason;details:string;context:string;chat:ReportChatLine[];
}
/** Where the game sends reports; it refuses (with a message for the player) when the anti-spam limits are hit. */
export interface ReportSink {submit(report:NewReport):Promise<void>;}

/** Player reports in Postgres, read and resolved in the admin panel (/admin/denuncias). */
export class ReportStore implements ReportSink {
 constructor(private pool:pg.Pool){}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS player_reports(id bigserial PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),status varchar(12) NOT NULL DEFAULT 'open',
   reporter_id uuid NOT NULL,reporter_name varchar(24) NOT NULL,target_id uuid NOT NULL,target_name varchar(24) NOT NULL,target_level int NOT NULL DEFAULT 1,
   reason varchar(16) NOT NULL,details varchar(300) NOT NULL DEFAULT '',context varchar(16) NOT NULL DEFAULT '',chat jsonb NOT NULL DEFAULT '[]',
   note varchar(500),resolved_at timestamptz,resolved_by varchar(64));
  CREATE INDEX IF NOT EXISTS player_reports_status ON player_reports(status,id DESC);
  CREATE INDEX IF NOT EXISTS player_reports_reporter ON player_reports(reporter_id,created_at);
  CREATE INDEX IF NOT EXISTS player_reports_target ON player_reports(target_id,id DESC);
 `);}
 async submit(report:NewReport){
  const recent=await this.pool.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE target_id=$2 AND created_at>now()-make_interval(secs=>$3))::int AS same FROM player_reports WHERE reporter_id=$1 AND created_at>now()-interval '1 hour'`,[report.reporterId,report.targetId,REPORT_SAME_TARGET_MS/1000]);
  if(recent.rows[0].same>0)throw Error('Você já denunciou este jogador há pouco. Nossa equipe vai analisar.');
  if(recent.rows[0].total>=REPORTS_PER_HOUR)throw Error('Você enviou muitas denúncias. Tente novamente mais tarde.');
  await this.pool.query('INSERT INTO player_reports(reporter_id,reporter_name,target_id,target_name,target_level,reason,details,context,chat) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
   [report.reporterId,report.reporterName,report.targetId,report.targetName,report.targetLevel,report.reason,report.details,report.context,JSON.stringify(report.chat)]);
 }
 private summary(row:Record<string,unknown>):ReportSummary{
  return {id:Number(row.id),status:row.status as ReportStatus,reason:row.reason as ReportReason,details:row.details as string,createdAt:new Date(row.created_at as string).toISOString(),
   reporter:{id:row.reporter_id as string,name:row.reporter_name as string},target:{id:row.target_id as string,name:row.target_name as string,level:Number(row.target_level)},
   chatCount:Number(row.chat_count??(row.chat as unknown[]|undefined)?.length??0),context:row.context as string};
 }
 async list(status:ReportStatus|'all',limit=200){
  const rows=await this.pool.query(`SELECT id,created_at,status,reporter_id,reporter_name,target_id,target_name,target_level,reason,details,context,jsonb_array_length(chat) AS chat_count FROM player_reports ${status==='all'?'':'WHERE status=$2'} ORDER BY id DESC LIMIT $1`,status==='all'?[limit]:[limit,status]);
  const counts=await this.pool.query('SELECT status,count(*)::int AS n FROM player_reports GROUP BY status');
  const total=Object.fromEntries(counts.rows.map(row=>[row.status,row.n])) as Partial<Record<ReportStatus,number>>;
  return {reports:rows.rows.map(row=>this.summary(row)),counts:{open:total.open??0,resolved:total.resolved??0,dismissed:total.dismissed??0}};
 }
 async openCount(){const r=await this.pool.query(`SELECT count(*)::int AS n FROM player_reports WHERE status='open'`);return r.rows[0].n as number;}
 async get(id:number):Promise<ReportDetail|null>{
  const r=await this.pool.query('SELECT * FROM player_reports WHERE id=$1',[id]);const row=r.rows[0];if(!row)return null;
  const history=await this.pool.query('SELECT id,status,reason,created_at,reporter_name FROM player_reports WHERE target_id=$1 ORDER BY id DESC LIMIT 50',[row.target_id]);
  return {...this.summary(row),chat:row.chat as ReportChatLine[],note:row.note,resolvedAt:row.resolved_at?new Date(row.resolved_at).toISOString():null,resolvedBy:row.resolved_by,
   targetHistory:history.rows.map(h=>({id:Number(h.id),status:h.status,reason:h.reason,createdAt:new Date(h.created_at).toISOString(),reporter:h.reporter_name}))};
 }
 async setStatus(id:number,status:ReportStatus,username:string,note?:string){
  const r=await this.pool.query(`UPDATE player_reports SET status=$2::varchar,note=coalesce($3::varchar,note),resolved_at=CASE WHEN $2::varchar='open' THEN NULL ELSE now() END,resolved_by=CASE WHEN $2::varchar='open' THEN NULL ELSE $4::varchar END WHERE id=$1`,[id,status,note??null,username]);
  return (r.rowCount??0)>0;
 }
}
