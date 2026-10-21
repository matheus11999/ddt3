import type {ForumCategory} from './forumRules';

export type AvatarId='explorer'|'goggles'|'knight'|'champion'|'dragon'|'verdalia';
export const AVATARS:{id:AvatarId;name:string}[]=[{id:'explorer',name:'Explorador'},{id:'goggles',name:'Aviadora'},{id:'knight',name:'Cavaleira'},{id:'champion',name:'Campeão'},{id:'dragon',name:'Dragão Ancestral'},{id:'verdalia',name:'Verdália'}];
export interface GameServer {id:string;name:string;url:string;status:'online'|'maintenance'|'soon';}
export interface ServerCharacter {server:GameServer;character:{name:string;gender:'male'|'female';level:number;wins:number;matches:number}|null;}
export interface Me {
 account:{username:string;email:string;createdAt:string;avatar:AvatarId}|null;
 servers:ServerCharacter[];
}
export interface TopicSummary {id:number;category:ForumCategory;title:string;excerpt:string;pinned:boolean;replies:number;likes:number;createdAt:string;lastActivityAt:string;author:string;authorAvatar:AvatarId;authorLevel:number|null;liked:boolean;}
export interface TopicPage {topics:TopicSummary[];total:number;page:number;pageSize:number;}
export interface Reply {id:number;body:string;likes:number;createdAt:string;author:string;authorAvatar:AvatarId;authorLevel:number|null;mine:boolean;liked:boolean;}
export interface TopicDetail {topic:TopicSummary&{body:string;mine:boolean};replies:Reply[];}

export class ApiError extends Error {constructor(message:string,readonly status:number){super(message);}}

async function call<T>(path:string,init?:{method?:string;body?:unknown}):Promise<T>{
 const response=await fetch(`/api/site${path}`,{method:init?.method??'GET',credentials:'same-origin',headers:init?.body!==undefined?{'Content-Type':'application/json'}:undefined,body:init?.body!==undefined?JSON.stringify(init.body):undefined});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new ApiError((data as {error?:string}).error??'Não foi possível concluir. Tente novamente.',response.status);
 return data as T;
}

export const api={
 me:()=>call<Me>('/me'),
 stats:()=>call<{accounts:number;topics:number}>('/stats'),
 login:(login:string,password:string)=>call('/login',{method:'POST',body:{login,password}}),
 register:(username:string,email:string,password:string)=>call('/register',{method:'POST',body:{username,email,password}}),
 logout:()=>call('/logout',{method:'POST',body:{}}),
 avatar:(avatar:AvatarId)=>call('/avatar',{method:'POST',body:{avatar}}),
 password:(current:string,next:string)=>call('/password',{method:'POST',body:{current,next}}),
 topics:(category:string|null,page=1)=>call<TopicPage>(`/forum?page=${page}${category?`&category=${encodeURIComponent(category)}`:''}`),
 topic:(id:number)=>call<TopicDetail>(`/forum/${id}`),
 createTopic:(category:string,title:string,body:string)=>call<{id:number}>('/forum',{method:'POST',body:{category,title,body}}),
 reply:(topicId:number,body:string)=>call<{id:number}>(`/forum/${topicId}/replies`,{method:'POST',body:{body}}),
 like:(kind:'topics'|'replies',id:number)=>call<{liked:boolean;likes:number}>(`/forum/${kind}/${id}/like`,{method:'POST',body:{}}),
 remove:(kind:'topics'|'replies',id:number)=>call(`/forum/${kind}/${id}`,{method:'DELETE'}),
};
