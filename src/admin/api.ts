import type {AdminMapSummary,AdminRevision,MapSave} from '../../shared/mapAdmin';
import type {ReportDetail,ReportStatus,ReportSummary} from '../../shared/reports';
import type {AdminPlayerDetail,AdminPlayerRow,PlayerSort} from '../../shared/adminPlayers';
import type {MailAttachment,MailMessage} from '../../shared/mail';
import type {HallAdminMatch,HallAlert,HallClosing,HallConfig} from '../../shared/hall';

/** Admin API client. Every call is same-origin; the session cookie is scoped to /api/admin. */
export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
let onUnauthorized:()=>void=()=>{};
export function whenSignedOut(callback:()=>void){onUnauthorized=callback;}

async function call<T>(method:string,path:string,body?:unknown):Promise<T>{
 const response=await fetch(path,{method,credentials:'same-origin',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(response.status===401&&path!=='/api/admin/login')onUnauthorized();
 if(!response.ok)throw new ApiError(data.error??`Erro ${response.status}`,response.status);
 return data as T;
}

export interface Stats {
 live:{online:number;rooms:number;battles:number};
 players:{total:number;newToday:number;newWeek:number};
 today:{matches:number;wins:number;botMatches:number;activePlayers:number};
 days:{day:string;matches:number;players:number}[];
 topToday:{id:string;name:string;level:number;wins:number}[];
 newestPlayers:{id:string;name:string;level:number;createdAt:string}[];
 audit:{at:string;username:string|null;action:string;detail:Record<string,unknown>}[];
 openReports:number;
}
export interface PlayerList {players:AdminPlayerRow[];total:number;page:number;pageSize:number;online:number;registered:number;}
export interface SentMail extends MailMessage {createdBy:string;claimedAt:string|null;deleted:boolean;}
export interface MailDraft {sender?:string;subject:string;body:string;attachments:MailAttachment[];}
export type RevisionData=Record<string,unknown>&{kind:string;name:string;subtitle?:string;enabled?:boolean};

export interface HallAdmin {config:HallConfig;closings:HallClosing[];audit:{at:string;admin:string|null;action:string;detail:Record<string,unknown>}[];}
export const api={
 hall:()=>call<HallAdmin>('GET','/api/admin/hall'),
 hallConfig:(config:HallConfig)=>call<{config:HallConfig}>('PUT','/api/admin/hall/config',config),
 hallAlerts:(status:'open'|'all')=>call<{alerts:HallAlert[]}>('GET',`/api/admin/hall/alerts?status=${status}`),
 hallAlert:(id:number,status:'open'|'dismissed')=>call<{ok:true}>('POST',`/api/admin/hall/alerts/${id}`,{status}),
 hallMatches:(page:number,player?:string)=>call<{matches:HallAdminMatch[];page:number}>('GET',`/api/admin/hall/matches?page=${page}${player?`&player=${encodeURIComponent(player)}`:''}`),
 hallVoid:(id:string,reason:string,restore=false)=>call<{ok:true}>('POST',`/api/admin/hall/matches/${id}/void`,{reason,...(restore?{restore}:{})}),
 hallRebuild:()=>call<{ok:true}>('POST','/api/admin/hall/rebuild',{}),
 me:()=>call<{username:string|null;enabled:boolean}>('GET','/api/admin/me'),
 login:(username:string,password:string)=>call<{username:string}>('POST','/api/admin/login',{username,password}),
 logout:()=>call<{ok:true}>('POST','/api/admin/logout',{}),
 stats:()=>call<Stats>('GET','/api/admin/stats'),
 maps:()=>call<{maps:AdminMapSummary[]}>('GET','/api/admin/maps'),
 map:(id:string)=>call<{map:AdminMapSummary;draft:RevisionData|null;revisions:AdminRevision[]}>('GET',`/api/admin/maps/${id}`),
 revision:(id:string,revision:number)=>call<{revision:{id:number;data:RevisionData}}>('GET',`/api/admin/maps/${id}/revisions/${revision}`),
 create:(input:{id:string;name:string;kind:'pvp'|'instance';base:string})=>call<{map:AdminMapSummary}>('POST','/api/admin/maps',input),
 save:(id:string,save:MapSave,base?:string)=>call<{revision:number;blockers:string[]}>('PUT',`/api/admin/maps/${id}${base?`?base=${encodeURIComponent(base)}`:''}`,save),
 publish:(id:string,revision:number)=>call<{ok:true}>('POST',`/api/admin/maps/${id}/publish`,{revision}),
 unpublish:(id:string)=>call<{ok:true}>('POST',`/api/admin/maps/${id}/unpublish`,{}),
 reports:(status:ReportStatus|'all')=>call<{reports:ReportSummary[];counts:Record<ReportStatus,number>}>('GET',`/api/admin/reports?status=${status}`),
 report:(id:number)=>call<{report:ReportDetail}>('GET',`/api/admin/reports/${id}`),
 updateReport:(id:number,status:ReportStatus,note?:string)=>call<{report:ReportDetail}>('POST',`/api/admin/reports/${id}`,{status,...(note!==undefined?{note}:{})}),
 players:(query:{search:string;online:boolean;sort:PlayerSort;page:number})=>call<PlayerList>('GET',`/api/admin/players?${new URLSearchParams({search:query.search,online:query.online?'1':'0',sort:query.sort,page:String(query.page)})}`),
 player:(id:string)=>call<{player:AdminPlayerDetail;mail:SentMail[]}>('GET',`/api/admin/players/${id}`),
 sendMail:(id:string,mail:MailDraft)=>call<{id:number;mail:SentMail[]}>('POST',`/api/admin/players/${id}/mail`,mail),
 remove:(id:string)=>call<{ok:true}>('DELETE',`/api/admin/maps/${id}`),
};
