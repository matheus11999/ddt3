import type {AdminMapSummary,AdminRevision,MapSave} from '../../shared/mapAdmin';

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
}
export type RevisionData=Record<string,unknown>&{kind:string;name:string;subtitle?:string;enabled?:boolean};

export const api={
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
 remove:(id:string)=>call<{ok:true}>('DELETE',`/api/admin/maps/${id}`),
};
