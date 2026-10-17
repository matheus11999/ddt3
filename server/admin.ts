import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {adminAccount,checkCredentials,LoginThrottle} from './adminAuth';
import {AdminStore,ADMIN_SESSION_HOURS} from './adminStore';
import type {StoredMap,StoredRevision} from './adminStore';
import {applyMapOverride,contains,getMap,INSTANCE_MAP_IDS,MAP_IDS,removeMapOverride} from '../shared/maps';
import type {MapId,MapRegion} from '../shared/maps';
import {applyLobbyLayout,LOBBY_OBSTACLES,LOBBY_SPAWN,LOBBY_WALK} from '../shared/lobby';
import type {LobbyLayoutOverride} from '../shared/lobby';
import {LOBBY_MAP_ID,mapCreateSchema,mapSaveSchema,MAP_ID_PATTERN,MAP_KIND_NAMES} from '../shared/mapAdmin';
import type {AdminMapSummary,EditableLayout,LobbyLayout,PublishedMaps} from '../shared/mapAdmin';
import type {ReportStore} from './reports';
import {REPORT_STATUSES,reportUpdateSchema} from '../shared/reports';
import type {ReportStatus} from '../shared/reports';

/**
 * Admin panel API (/api/admin/*) and the published maps the game reads (/api/maps).
 * Login with ADMIN_USERNAME / ADMIN_PASSWORD_HASH (server/adminAuth.ts); without them the panel stays closed.
 * Sessions live in Postgres behind an httpOnly, SameSite=Strict cookie scoped to /api/admin;
 * every write also passes the server's Origin check.
 */
const COOKIE='brasa_admin';
const BUILT_IN_NAMES:Record<string,string>={[LOBBY_MAP_ID]:'Praça Celeste'};
/** Station spots of the plaza as shipped (src/game/lobbyWorld.ts); only the forge moves a server rule (SMITH_POSITION). */
const DEFAULT_STATIONS=[{id:'forge',x:3720,y:632,height:300}];

export interface AdminContext {store:AdminStore;reports?:ReportStore;live:()=>{online:number;rooms:number;battles:number};onMapsChanged:()=>void;}

const png=(base64:string)=>{const buffer=Buffer.from(base64,'base64');if(buffer.length<24||buffer.readUInt32BE(0)!==0x89504e47)throw new Error('Imagem inválida.');return {buffer,width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};};
const ipOf=(req:FastifyRequest)=>req.ip??'unknown';

/** Rules the server enforces before a map goes live: every spawn on ground, regions inside the map. */
export function mapBlockers(layout:EditableLayout,regions:readonly MapRegion[]):string[]{
 const width=layout.width??1536,cols=width/3,blockers:string[]=[];
 for(const r of regions){if(r.shape.kind!=='cells')continue;const s=r.shape;
  if(s.col+s.cols>cols||s.row+s.rows>288)blockers.push(`${r.id}: colisão fora do mapa`);
  if(Buffer.from(s.bits,'base64').length!==Math.ceil(s.cols*s.rows/8))blockers.push(`${r.id}: colisão corrompida`);}
 if(blockers.length)return blockers;
 const instance=layout.kind==='instance'||!!layout.monsters;
 const floor=(x:number)=>{let y=0;while(y<864&&!regions.some(r=>contains(r.shape,x,y)))y+=3;return y;};
 if(instance){if(!layout.monsters?.some(m=>m.kind!=='nest'))blockers.push('instância: coloque pelo menos um monstro');
  for(const m of layout.monsters??[])if(m.y===undefined&&floor(m.x)>=864)blockers.push(`${m.kind} (x ${Math.round(m.x)}): sem chão`);}
 layout.spawns.forEach((team,t)=>{if(instance?(t===0&&team.length!==4):team.length!==4)blockers.push(`time ${t+1}: precisa de 4 spawns`);
  team.forEach((x,slot)=>{let y=0;while(y<864&&!regions.some(r=>contains(r.shape,x,y)))y+=3;if(y>=864)blockers.push(`spawn time ${t+1} jogador ${slot+1}: sem chão`);if(x<0||x>width)blockers.push(`spawn time ${t+1} jogador ${slot+1}: fora do mapa`);});});
 return blockers;
}

export async function registerAdmin(app:FastifyInstance,ctx:AdminContext){
 const {store}=ctx,throttle=new LoginThrottle();
 const defaultLobby:LobbyLayoutOverride=structuredClone({spawn:{...LOBBY_SPAWN},walk:{...LOBBY_WALK},obstacles:[...LOBBY_OBSTACLES],stations:DEFAULT_STATIONS});
 const terrainUrl=(id:string,revision:number)=>`/api/maps/${id}/terrain/${revision}.png`;
 let published:PublishedMaps={maps:[],lobby:null};

 /** Applies what is published to the running game (collision, spawns, names, lobby footprints). */
 const refresh=async()=>{
  const rows=await store.published(),next:PublishedMaps={maps:[],lobby:null};
  for(const {map,revision} of rows){
   const data=revision.data;
   if(map.kind==='lobby'){next.lobby={id:map.id,kind:'lobby',name:data.name,revision:revision.id,lobby:data.lobby as LobbyLayout};continue;}
   const layout=data.layout as EditableLayout;
   next.maps.push({id:map.id,kind:map.kind==='instance'?'instance':'pvp',name:data.name,subtitle:String(data.subtitle??''),enabled:data.enabled!==false,revision:revision.id,base:map.base,width:layout.width??1536,spawns:[layout.spawns[0],layout.spawns[1]],regions:data.regions as PublishedMaps['maps'][number]['regions'],terrain:terrainUrl(map.id,revision.id),...(layout.monsters?{monsters:layout.monsters}:{})});
  }
  for(const old of published.maps)if(!next.maps.some(m=>m.id===old.id))removeMapOverride(old.id);
  for(const m of next.maps)applyMapOverride(m as Parameters<typeof applyMapOverride>[0]);
  applyLobbyLayout(next.lobby?.lobby??defaultLobby);
  published=next;
 };
 await refresh();

 // ── Public: what the game client applies on start ──
 app.get('/api/maps',async(_req,reply)=>{reply.header('Cache-Control','no-cache');return published;});
 app.get<{Params:{id:string;revision:string}}>('/api/maps/:id/terrain/:revision.png',async(req,reply)=>{
  const revision=Number(req.params.revision);
  if(!MAP_ID_PATTERN.test(req.params.id)||!Number.isSafeInteger(revision)||!published.maps.some(m=>m.id===req.params.id&&m.revision===revision))return reply.code(404).send({error:'Mapa não encontrado.'});
  const image=await store.image(req.params.id,revision,'terrain');if(!image)return reply.code(404).send({error:'Mapa não encontrado.'});
  return reply.header('Content-Type','image/png').header('Cache-Control','public, max-age=31536000, immutable').send(image);
 });

 // ── Session ──
 const user=async(req:FastifyRequest)=>store.session(req.cookies[COOKIE]);
 const guard=async(req:FastifyRequest,reply:FastifyReply)=>{
  reply.header('Cache-Control','no-store');
  const name=await user(req);if(!name){reply.code(401).send({error:'Entre no painel novamente.'});return null;}
  return name;
 };
 const cookieOptions={path:'/api/admin',httpOnly:true,sameSite:'strict' as const,secure:process.env.COOKIE_SECURE==='true'};

 app.post('/api/admin/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  const parsed=z.object({username:z.string().min(1).max(64),password:z.string().min(1).max(512)}).strict().safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'Informe usuário e senha.'});
  const account=adminAccount();
  if(!account)return reply.code(503).send({error:'Painel desativado: defina ADMIN_USERNAME e ADMIN_PASSWORD_HASH no servidor.'});
  const ip=ipOf(req),keys=[`user:${parsed.data.username.toLowerCase()}`,`ip:${ip}`],wait=throttle.lockedFor(...keys);
  if(wait)return reply.code(429).send({error:`Muitas tentativas. Tente de novo em ${Math.ceil(wait/60000)} min.`});
  if(!await checkCredentials(account,parsed.data.username,parsed.data.password)){
   throttle.fail(...keys);await store.audit(parsed.data.username.slice(0,64),ip,'login-failed');
   return reply.code(401).send({error:'Usuário ou senha incorretos.'});
  }
  for(const key of keys)throttle.succeed(key);
  const token=await store.createSession(account.username,ip);await store.audit(account.username,ip,'login');
  reply.setCookie(COOKIE,token,{...cookieOptions,maxAge:ADMIN_SESSION_HOURS*3600});
  return {username:account.username};
 });
 app.post('/api/admin/logout',async(req,reply)=>{
  reply.header('Cache-Control','no-store');const name=await user(req);
  await store.endSession(req.cookies[COOKIE]);if(name)await store.audit(name,ipOf(req),'logout');
  reply.clearCookie(COOKIE,cookieOptions);return {ok:true};
 });
 app.get('/api/admin/me',async(req,reply)=>{reply.header('Cache-Control','no-store');const name=await user(req);return {username:name,enabled:!!adminAccount()};});

 // ── Statistics ──
 app.get('/api/admin/stats',async(req,reply)=>{if(!await guard(req,reply))return;return {live:ctx.live(),...await store.stats(),audit:await store.recentAudit(12),openReports:await ctx.reports?.openCount()??0};});

 // ── Player reports (sent from the game with the reported player's last 30 minutes of chat) ──
 app.get('/api/admin/reports',async(req,reply)=>{
  if(!await guard(req,reply))return;if(!ctx.reports)return reply.code(503).send({error:'Denúncias indisponíveis.'});
  const status=String((req.query as Record<string,unknown>)?.status??'open');
  return ctx.reports.list((REPORT_STATUSES as readonly string[]).includes(status)?status as ReportStatus:'all');
 });
 app.get<{Params:{id:string}}>('/api/admin/reports/:id',async(req,reply)=>{
  if(!await guard(req,reply))return;const id=Number(req.params.id);
  const report=ctx.reports&&Number.isSafeInteger(id)?await ctx.reports.get(id):null;
  return report?{report}:reply.code(404).send({error:'Denúncia não encontrada.'});
 });
 app.post<{Params:{id:string}}>('/api/admin/reports/:id',async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;const id=Number(req.params.id);
  const parsed=reportUpdateSchema.safeParse(req.body);if(!parsed.success||!Number.isSafeInteger(id))return reply.code(400).send({error:'Dados inválidos.'});
  if(!ctx.reports||!await ctx.reports.setStatus(id,parsed.data.status,name,parsed.data.note))return reply.code(404).send({error:'Denúncia não encontrada.'});
  await store.audit(name,ipOf(req),'report-status',{id,status:parsed.data.status});
  return {report:await ctx.reports.get(id)};
 });

 // ── Maps ──
 const builtIn=(id:string)=>id===LOBBY_MAP_ID||(MAP_IDS as readonly string[]).includes(id)||(INSTANCE_MAP_IDS as readonly string[]).includes(id);
 const builtInKind=(id:string)=>id===LOBBY_MAP_ID?'lobby' as const:(INSTANCE_MAP_IDS as readonly string[]).includes(id)?'instance' as const:'pvp' as const;
 const summary=(id:string,row:(StoredMap&{draft?:StoredRevision['data']|null})|null):AdminMapSummary=>{
  const live=published.maps.find(m=>m.id===id),isLobby=id===LOBBY_MAP_ID,draft=row?.draft,original=!isLobby&&builtIn(id)?getMap(id as MapId):null;
  const layout=draft?.layout as EditableLayout|undefined;
  return {id,kind:row?.kind??builtInKind(id),name:draft?.name??original?.name??BUILT_IN_NAMES[id]??id,subtitle:String(draft?.subtitle??original?.subtitle??''),builtIn:builtIn(id),
   enabled:live?.enabled??(draft?draft.enabled!==false:true),base:row?.base??id,draftRevision:row?.draftRevision??null,publishedRevision:row?.publishedRevision??null,updatedAt:row?.updatedAt??null,updatedBy:row?.updatedBy??null,
   preview:row?.draftRevision&&!isLobby?`/api/admin/maps/${id}/preview/${row.draftRevision}.png`:isLobby?'/assets/lobby/plaza.webp':`/assets/maps/${id}-preview.png`,
   width:isLobby?4608:layout?.width??original?.dimensions.width??1536};
 };
 app.get('/api/admin/maps',async(req,reply)=>{
  if(!await guard(req,reply))return;
  const rows=await store.maps(),ids=[...MAP_IDS,...INSTANCE_MAP_IDS,LOBBY_MAP_ID,...rows.map(r=>r.id)];
  return {maps:[...new Set(ids)].map(id=>summary(id,rows.find(r=>r.id===id)??null))};
 });
 app.get<{Params:{id:string}}>('/api/admin/maps/:id',async(req,reply)=>{
  if(!await guard(req,reply))return;const {id}=req.params;
  const row=MAP_ID_PATTERN.test(id)?await store.map(id):null;if(!row&&!builtIn(id))return reply.code(404).send({error:'Mapa não encontrado.'});
  const draft=row?.draftRevision?await store.revision(id,row.draftRevision):null;
  return {map:summary(id,row?{...row,draft:draft?.data}:null),draft:draft?.data??null,revisions:row?await store.revisions(id,row.publishedRevision):[]};
 });
 app.get<{Params:{id:string;revision:string}}>('/api/admin/maps/:id/revisions/:revision',async(req,reply)=>{
  if(!await guard(req,reply))return;const revision=await store.revision(req.params.id,Number(req.params.revision));
  return revision?{revision}:reply.code(404).send({error:'Versão não encontrada.'});
 });
 app.get<{Params:{id:string;revision:string}}>('/api/admin/maps/:id/preview/:revision.png',async(req,reply)=>{
  if(!await guard(req,reply))return;const image=await store.image(req.params.id,Number(req.params.revision),'preview');
  return image?reply.header('Content-Type','image/png').header('Cache-Control','private, max-age=86400').send(image):reply.code(404).send({error:'Prévia não encontrada.'});
 });
 app.post('/api/admin/maps',async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;
  const parsed=mapCreateSchema.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:parsed.error.issues[0]?.message??'Dados inválidos.'});
  const {id,base}=parsed.data;
  if(builtIn(id)||await store.map(id))return reply.code(409).send({error:'Já existe um mapa com esse código.'});
  if(base===LOBBY_MAP_ID||(!builtIn(base)&&!await store.map(base)))return reply.code(400).send({error:'Escolha um mapa de base com peças.'});
  await store.audit(name,ipOf(req),'map-create',{id,base,kind:parsed.data.kind});
  // The map row is created by its first save, so an abandoned "new map" leaves nothing behind.
  return {map:{...summary(id,null),name:parsed.data.name,kind:parsed.data.kind,base,builtIn:false}};
 });
 app.put<{Params:{id:string}}>('/api/admin/maps/:id',{bodyLimit:32*1024*1024},async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;const {id}=req.params;
  if(!MAP_ID_PATTERN.test(id))return reply.code(400).send({error:'Código de mapa inválido.'});
  const parsed=mapSaveSchema.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:`Dados inválidos: ${parsed.error.issues.slice(0,3).map(i=>`${i.path.join('.')} ${i.message}`).join('; ')}`});
  const save=parsed.data,row=await store.map(id);
  if((id===LOBBY_MAP_ID)!==(save.kind==='lobby'))return reply.code(400).send({error:'Só a Praça Celeste é um mapa de lobby por enquanto.'});
  // A map's kind is chosen when it is created and never changes (a PvP map does not become an instance, nor the reverse).
  const kind=row?.kind??(builtIn(id)?builtInKind(id):null);
  if(kind&&save.kind!==kind)return reply.code(400).send({error:`O tipo do mapa não muda depois de criado (este é ${MAP_KIND_NAMES[kind]}).`});
  const base=row?.base??(builtIn(id)?id:z.string().regex(MAP_ID_PATTERN).safeParse((req.query as Record<string,unknown>)?.base).data);
  if(!base)return reply.code(400).send({error:'Mapa novo precisa de um mapa de base.'});
  let terrain:Buffer|null=null,preview:Buffer|null=null,data:Record<string,unknown>;
  if(save.kind==='lobby')data={kind:'lobby',name:save.name,subtitle:save.subtitle,enabled:true,lobby:save.lobby,warnings:save.warnings,blockers:[]};
  else{
   const width=save.layout.width??1536;
   try{const t=png(save.terrain),p=png(save.preview);if(t.width!==width||t.height!==864)throw new Error(`O terreno precisa ter ${width}×864.`);terrain=t.buffer;preview=p.buffer;}
   catch(e){return reply.code(400).send({error:(e as Error).message});}
   const blockers=mapBlockers(save.layout,save.regions as MapRegion[]);
   data={kind:save.kind,name:save.name,subtitle:save.subtitle,enabled:save.enabled,layout:{...save.layout,name:save.name,subtitle:save.subtitle,kind:save.kind},regions:save.regions,warnings:save.warnings,blockers};
  }
  const revision=await store.saveRevision({mapId:id,kind:save.kind,base,data,terrain,preview,note:save.note,username:name});
  await store.audit(name,ipOf(req),'map-save',{id,revision,warnings:save.warnings.length});
  return {revision,blockers:data.blockers};
 });
 app.post<{Params:{id:string}}>('/api/admin/maps/:id/publish',async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;const {id}=req.params;
  const parsed=z.object({revision:z.number().int().positive()}).strict().safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'Versão inválida.'});
  const revision=await store.revision(id,parsed.data.revision);if(!revision)return reply.code(404).send({error:'Versão não encontrada.'});
  const blockers=(revision.data.blockers as string[]|undefined)??[];
  if(blockers.length)return reply.code(409).send({error:`Corrija antes de publicar: ${blockers.slice(0,3).join('; ')}`});
  if(!await store.publish(id,revision.id,name))return reply.code(404).send({error:'Versão não encontrada.'});
  await refresh();await store.audit(name,ipOf(req),'map-publish',{id,revision:revision.id});ctx.onMapsChanged();
  return {ok:true};
 });
 app.post<{Params:{id:string}}>('/api/admin/maps/:id/unpublish',async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;const {id}=req.params;
  if(!await store.map(id))return reply.code(404).send({error:'Mapa sem versão publicada.'});
  await store.unpublish(id,name);await refresh();await store.audit(name,ipOf(req),'map-unpublish',{id});ctx.onMapsChanged();
  return {ok:true};
 });
 app.delete<{Params:{id:string}}>('/api/admin/maps/:id',async(req,reply)=>{
  const name=await guard(req,reply);if(!name)return;const {id}=req.params;
  if(builtIn(id))return reply.code(400).send({error:'Mapas originais não podem ser apagados; use "Voltar ao original".'});
  if(!await store.map(id))return reply.code(404).send({error:'Mapa não encontrado.'});
  await store.deleteMap(id);await refresh();await store.audit(name,ipOf(req),'map-delete',{id});ctx.onMapsChanged();
  return {ok:true};
 });
}
