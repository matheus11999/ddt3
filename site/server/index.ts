import Fastify,{type FastifyReply,type FastifyRequest} from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname,join,normalize,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {ACCOUNT_COOKIE,AccountError,AccountStore,cookieOptions} from '../../server/accounts';
import {LoginThrottle} from '../../server/adminAuth';
import {ForumStore} from './forum';
import {MEDIA_FILE,MEDIA_MIME,MediaStore,UPLOAD_TYPES} from './media';
import {FORUM_MEDIA} from '../src/forumRules';

/**
 * Bomb Masters site (docs/site.md): landing page, accounts shared with the game, player page and the community forum.
 * Runs in its own container next to the game and uses the game's Postgres.
 */
const PORT=Number(process.env.PORT??4120);
const origins=new Set((process.env.ALLOWED_ORIGINS??'http://localhost:8098,http://127.0.0.1:8098,http://localhost:5178,http://127.0.0.1:5178').split(','));
const DIST=resolve(fileURLToPath(new URL('../dist',import.meta.url)));

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa',max:6});
const accounts=new AccountStore(pool);await accounts.init();
const forum=new ForumStore(pool,new MediaStore(pool,resolve(process.env.UPLOAD_DIR??'site/uploads')));await forum.init();await forum.media.init();
const UPLOADS=resolve(process.env.UPLOAD_DIR??'site/uploads');

const app=Fastify({logger:true,bodyLimit:16384,trustProxy:process.env.BEHIND_PROXY==='true'?(_address:string,hop:number)=>hop===0:false});
await app.register(cookie);
await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],mediaSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'self'"],fontSrc:["'self'"],connectSrc:["'self'"],frameAncestors:["'none'"],formAction:["'self'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false});
await app.register(rateLimit,{max:240,timeWindow:'1 minute'});
app.addHook('onRequest',async(req,reply)=>{if(req.method!=='GET'&&req.url.startsWith('/api/')&&(!req.headers.origin||!origins.has(req.headers.origin)))return reply.code(403).send({error:'Origem não permitida.'});});
app.setErrorHandler((error,_req,reply)=>{
 if(error instanceof AccountError)return reply.code(error.status).send({error:error.message});
 if(error instanceof z.ZodError)return reply.code(400).send({error:'Dados inválidos.'});
 const status=(error as {statusCode?:number}).statusCode??500;
 if(status===429)return reply.code(429).send({error:'Muitas tentativas. Espere um pouco.'});
 if(status<500)return reply.code(status).send({error:'Pedido inválido.'});
 app.log.error(error);return reply.code(500).send({error:'Algo deu errado. Tente novamente.'});
});

async function viewer(req:FastifyRequest){return accounts.account(req.cookies[ACCOUNT_COOKIE]);}
async function required(req:FastifyRequest){const account=await viewer(req);if(!account)throw new AccountError('Entre na sua conta para continuar.',401);return account;}
const signedIn=(reply:FastifyReply,token:string)=>reply.setCookie(ACCOUNT_COOKIE,token,cookieOptions());
const authLimit={config:{rateLimit:{max:12,timeWindow:'1 minute'}}};
// Wrong passwords lock that login name for 15 min after 5 tries (same rule as /admin); one address gets 20, since a
// whole house or school can share it.
const throttle=new LoginThrottle(),ipThrottle=new LoginThrottle(20);
const ipOf=(req:FastifyRequest)=>req.ip;
const tooMany=(wait:number)=>new AccountError(`Muitas tentativas erradas. Tente de novo em ${Math.ceil(wait/60000)} min.`,429);
const writeLimit={config:{rateLimit:{max:30,timeWindow:'1 minute'}}};

app.get('/api/site/health',async()=>{await pool.query('SELECT 1');return {ok:true};});
app.get('/api/site/me',async(req,reply)=>{
 reply.header('Cache-Control','no-store');const account=await viewer(req);
 return {account:account&&{username:account.username,email:account.email,createdAt:account.createdAt,avatar:account.avatar},servers:account?await accounts.characters(account):[]};
});
app.get('/api/site/stats',async(_req,reply)=>{reply.header('Cache-Control','public, max-age=60');return forum.counts();});
app.post('/api/site/register',authLimit,async(req,reply)=>{
 const body=z.object({username:z.string().max(32),email:z.string().max(254),password:z.string().max(256)}).parse(req.body);
 signedIn(reply,await accounts.register(body.username,body.email,body.password));return {ok:true};
});
app.post('/api/site/login',authLimit,async(req,reply)=>{
 const body=z.object({login:z.string().min(1).max(254),password:z.string().min(1).max(256)}).parse(req.body);
 const name=`login:${body.login.trim().toLowerCase()}`,ip=`ip:${ipOf(req)}`,wait=Math.max(throttle.lockedFor(name),ipThrottle.lockedFor(ip));
 if(wait)throw tooMany(wait);
 let token;try{token=await accounts.login(body.login,body.password);}catch(e){throttle.fail(name);ipThrottle.fail(ip);throw e;}
 throttle.succeed(name);signedIn(reply,token);return {ok:true};
});
app.post('/api/site/avatar',writeLimit,async req=>{
 const account=await required(req);const body=z.object({avatar:z.string().max(16)}).parse(req.body);
 await accounts.setAvatar(account,body.avatar);return {ok:true};
});
app.post('/api/site/password',authLimit,async req=>{
 const account=await required(req);const body=z.object({current:z.string().min(1).max(256),next:z.string().max(256)}).parse(req.body);
 const key=`password:${account.id}`,wait=throttle.lockedFor(key);if(wait)throw tooMany(wait);
 try{await accounts.changePassword(account,body.current,body.next,req.cookies[ACCOUNT_COOKIE]!);}catch(e){if((e as AccountError).status===403)throttle.fail(key);throw e;}
 throttle.succeed(key);return {ok:true};
});
app.post('/api/site/logout',async(req,reply)=>{
 await accounts.logout(req.cookies[ACCOUNT_COOKIE]);const {maxAge:_,...options}=cookieOptions();
 // The game session belongs to the same person: leaving the site leaves the game too.
 reply.clearCookie(ACCOUNT_COOKIE,options).clearCookie('brasa_session',{...options,sameSite:'strict'});return {ok:true};
});

const id=z.coerce.number().int().positive().max(2**52);
const mediaIds=z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(FORUM_MEDIA.perPost).default([]);
// Uploads: the raw file is the request body; the server decides its type from the bytes (site/server/media.ts).
app.addContentTypeParser(UPLOAD_TYPES,{parseAs:'buffer',bodyLimit:FORUM_MEDIA.maxBytes.video},(_req,body,done)=>done(null,body));
/**
 * Upload budget (A04, auditoria 21/10): the account is checked in onRequest, before a single byte of the file is read;
 * the size must be declared up front, one account sends one file at a time, all uploads together hold at most
 * UPLOAD_BUDGET in memory, and a body that has not arrived in UPLOAD_MS is cut.
 */
const UPLOAD_BUDGET=Number(process.env.UPLOAD_BUDGET_BYTES??96*1048576),UPLOAD_MS=Number(process.env.UPLOAD_TIMEOUT_MS??120_000);
let uploadBytes=0;const uploading=new Set<string>();
const uploadAccount=new WeakMap<FastifyRequest,{id:string}>();
app.post('/api/site/forum/media',{bodyLimit:FORUM_MEDIA.maxBytes.video,config:{rateLimit:{max:20,timeWindow:'10 minutes'}},
 onRequest:async(req,reply)=>{
  const account=await viewer(req);if(!account)return reply.code(401).send({error:'Entre na sua conta para continuar.'});
  const length=Number(req.headers['content-length']);
  if(!req.headers['content-length']||!Number.isSafeInteger(length)||length<1)return reply.code(411).send({error:'Envie uma imagem ou um vídeo.'});
  if(length>FORUM_MEDIA.maxBytes.video)return reply.code(413).send({error:`O vídeo pode ter até ${FORUM_MEDIA.maxBytes.video/1048576} MB.`});
  if(uploading.has(account.id))return reply.code(429).send({error:'Espere o envio anterior terminar.'});
  if(uploadBytes+length>UPLOAD_BUDGET)return reply.code(503).send({error:'Muitos envios agora. Tente de novo em instantes.'});
  uploading.add(account.id);uploadBytes+=length;uploadAccount.set(req,account);
  let released=false;const timer=setTimeout(()=>req.raw.destroy(),UPLOAD_MS);
  const release=()=>{if(released)return;released=true;clearTimeout(timer);uploading.delete(account.id);uploadBytes-=length;};
  reply.raw.once('close',release);reply.raw.once('finish',release);
 }},async(req,reply)=>{
 const account=uploadAccount.get(req)??await required(req);
 if(!Buffer.isBuffer(req.body)||!req.body.length)return reply.code(415).send({error:'Envie uma imagem ou um vídeo.'});
 return forum.media.save(account.id,req.body);
});
app.get('/api/site/forum',async(req,reply)=>{
 const q=z.object({category:z.string().max(16).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).parse(req.query);
 reply.header('Cache-Control','no-store');return forum.topics(q.category,q.page,(await viewer(req))?.id??null);
});
app.get('/api/site/forum/:id',async(req,reply)=>{const {id:topicId}=z.object({id}).parse(req.params);reply.header('Cache-Control','no-store');return forum.topic(topicId,(await viewer(req))?.id??null);});
app.post('/api/site/forum',writeLimit,async req=>{
 const account=await required(req);const body=z.object({category:z.string().max(16),title:z.string().max(200),body:z.string().max(8000),media:mediaIds}).parse(req.body);
 return {id:await forum.createTopic(account.id,body.category,body.title,body.body,body.media)};
});
app.post('/api/site/forum/:id/replies',writeLimit,async req=>{
 const account=await required(req);const {id:topicId}=z.object({id}).parse(req.params);const body=z.object({body:z.string().max(4000),media:mediaIds}).parse(req.body);
 return {id:await forum.reply(account.id,topicId,body.body,body.media)};
});
app.post('/api/site/forum/:kind/:id/like',writeLimit,async req=>{
 const account=await required(req);const p=z.object({kind:z.enum(['topics','replies']),id}).parse(req.params);
 return forum.toggleLike(account.id,p.kind==='topics'?'t':'r',p.id);
});
app.delete('/api/site/forum/:kind/:id',writeLimit,async req=>{
 const account=await required(req);const p=z.object({kind:z.enum(['topics','replies']),id}).parse(req.params);
 await forum.remove(account.id,p.kind==='topics'?'t':'r',p.id);return {ok:true};
});
app.all('/api/*',async(_req,reply)=>reply.code(404).send({error:'Não encontrado.'}));

// Forum uploads: only names this server made, served with their own type, never sniffed or run as a page.
app.get('/media/:file',async(req,reply)=>{
 const m=MEDIA_FILE.exec((req.params as {file:string}).file??'');if(!m)return reply.code(404).send();
 const file=join(UPLOADS,m[0]),info=await stat(file).catch(()=>null);if(!info?.isFile())return reply.code(404).send();
 reply.header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox").header('Content-Disposition','inline').header('Cache-Control','public, max-age=31536000, immutable').header('Accept-Ranges','bytes');
 const range=/^bytes=(d*)-(d*)$/.exec(req.headers.range??'');
 if(range&&(range[1]||range[2])){
  const end=range[2]&&range[1]?Math.min(Number(range[2]),info.size-1):info.size-1;
  const start=range[1]?Number(range[1]):Math.max(0,info.size-Number(range[2]));
  if(start>end||start>=info.size)return reply.code(416).header('Content-Range',`bytes */${info.size}`).send();
  return reply.code(206).type(MEDIA_MIME[m[2]]).header('Content-Range',`bytes ${start}-${end}/${info.size}`).header('Content-Length',end-start+1).send(createReadStream(file,{start,end}));
 }
 return reply.type(MEDIA_MIME[m[2]]).header('Content-Length',info.size).send(createReadStream(file));
});

// The built page (site/dist): files as they are, every other path opens the page (client-side routes).
const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json'};
app.get('/*',async(req,reply)=>{
 const path=normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/,'');
 let file=join(DIST,path);
 if(file!==DIST&&!file.startsWith(DIST+sep))return reply.code(404).send();
 const info=await stat(file).catch(()=>null);
 if(!info?.isFile()){if(extname(path))return reply.code(404).send();file=join(DIST,'index.html');}
 reply.header('Cache-Control',file.includes(`${join(DIST,'assets')}`)?'public, max-age=31536000, immutable':file.endsWith('.html')?'no-cache':'public, max-age=3600');
 return reply.type(TYPES[extname(file)]??'application/octet-stream').send(createReadStream(file));
});

await app.listen({host:'0.0.0.0',port:PORT});
