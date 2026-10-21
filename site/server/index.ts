import Fastify,{type FastifyReply,type FastifyRequest} from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname,join,normalize,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {ACCOUNT_COOKIE,AccountError,AccountStore,cookieOptions,type Account} from '../../server/accounts';
import {ForumStore} from './forum';

/**
 * Bomb Masters site (docs/site.md): landing page, accounts shared with the game, player page and the community forum.
 * Runs in its own container next to the game and uses the game's Postgres.
 */
const PORT=Number(process.env.PORT??4120);
const GAME_URL=process.env.GAME_URL??'http://localhost:8097';
const origins=new Set((process.env.ALLOWED_ORIGINS??'http://localhost:8098,http://127.0.0.1:8098,http://localhost:5178,http://127.0.0.1:5178').split(','));
const DIST=resolve(fileURLToPath(new URL('../dist',import.meta.url)));

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa',max:6});
const accounts=new AccountStore(pool);await accounts.init();
const forum=new ForumStore(pool);await forum.init();

const app=Fastify({logger:true,bodyLimit:16384,trustProxy:process.env.BEHIND_PROXY==='true'?(_address:string,hop:number)=>hop===0:false});
await app.register(cookie);
await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],fontSrc:["'self'"],connectSrc:["'self'"],frameAncestors:["'none'"],formAction:["'self'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false});
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
async function player(account:Account){
 if(!account.playerId)return null;
 const r=await pool.query("SELECT name,profile->>'gender' AS gender,(profile->>'level')::int AS level,(profile->>'wins')::int AS wins,(profile->>'matches')::int AS matches FROM players WHERE id=$1",[account.playerId]);
 return r.rows[0]??null;
}
const signedIn=(reply:FastifyReply,token:string)=>reply.setCookie(ACCOUNT_COOKIE,token,cookieOptions());
const authLimit={config:{rateLimit:{max:12,timeWindow:'1 minute'}}};
const writeLimit={config:{rateLimit:{max:30,timeWindow:'1 minute'}}};

app.get('/api/site/health',async()=>{await pool.query('SELECT 1');return {ok:true};});
app.get('/api/site/me',async(req,reply)=>{
 reply.header('Cache-Control','no-store');const account=await viewer(req);
 return {account:account&&{username:account.username,email:account.email,createdAt:account.createdAt},player:account&&await player(account),gameUrl:GAME_URL};
});
app.get('/api/site/stats',async(_req,reply)=>{reply.header('Cache-Control','public, max-age=60');return forum.counts();});
app.post('/api/site/register',authLimit,async(req,reply)=>{
 const body=z.object({username:z.string().max(32),email:z.string().max(254),password:z.string().max(256)}).parse(req.body);
 signedIn(reply,await accounts.register(body.username,body.email,body.password));return {ok:true};
});
app.post('/api/site/login',authLimit,async(req,reply)=>{
 const body=z.object({login:z.string().min(1).max(254),password:z.string().min(1).max(256)}).parse(req.body);
 signedIn(reply,await accounts.login(body.login,body.password));return {ok:true};
});
app.post('/api/site/logout',async(req,reply)=>{
 await accounts.logout(req.cookies[ACCOUNT_COOKIE]);const {maxAge:_,...options}=cookieOptions();
 // The game session belongs to the same person: leaving the site leaves the game too.
 reply.clearCookie(ACCOUNT_COOKIE,options).clearCookie('brasa_session',{...options,sameSite:'strict'});return {ok:true};
});

const id=z.coerce.number().int().positive().max(2**52);
app.get('/api/site/forum',async(req,reply)=>{
 const q=z.object({category:z.string().max(16).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).parse(req.query);
 reply.header('Cache-Control','no-store');return forum.topics(q.category,q.page,(await viewer(req))?.id??null);
});
app.get('/api/site/forum/:id',async(req,reply)=>{const {id:topicId}=z.object({id}).parse(req.params);reply.header('Cache-Control','no-store');return forum.topic(topicId,(await viewer(req))?.id??null);});
app.post('/api/site/forum',writeLimit,async req=>{
 const account=await required(req);const body=z.object({category:z.string().max(16),title:z.string().max(200),body:z.string().max(8000)}).parse(req.body);
 return {id:await forum.createTopic(account.id,body.category,body.title,body.body)};
});
app.post('/api/site/forum/:id/replies',writeLimit,async req=>{
 const account=await required(req);const {id:topicId}=z.object({id}).parse(req.params);const body=z.object({body:z.string().max(4000)}).parse(req.body);
 return {id:await forum.reply(account.id,topicId,body.body)};
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

// The built page (site/dist): files as they are, every other path opens the page (client-side routes).
const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json'};
app.get('/*',async(req,reply)=>{
 const path=normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/,'');
 let file=join(DIST,path);
 if(!file.startsWith(DIST))return reply.code(404).send();
 const info=await stat(file).catch(()=>null);
 if(!info?.isFile()){if(extname(path))return reply.code(404).send();file=join(DIST,'index.html');}
 reply.header('Cache-Control',file.includes(`${join(DIST,'assets')}`)?'public, max-age=31536000, immutable':file.endsWith('.html')?'no-cache':'public, max-age=3600');
 return reply.type(TYPES[extname(file)]??'application/octet-stream').send(createReadStream(file));
});

await app.listen({host:'0.0.0.0',port:PORT});
