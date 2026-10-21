import '../shared/petContent';
import Fastify,{type FastifyReply,type FastifyRequest} from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {Redis} from 'ioredis';
import {WebSocket,WebSocketServer} from 'ws';
import {Store} from './store';
import {Game} from './game';
import {AdminStore} from './adminStore';
import {registerAdmin} from './admin';
import {ReportStore} from './reports';
import {MailStore} from './mail';
import {AuctionStore} from './auction';
import {GuildStore} from './guilds';
import {PetStore} from './pets';
import {PET_GIFTS} from '../shared/petContent';
import {HallStore} from './hall';
import {WorldBossService} from './worldBoss';
import {PlayerDirectory} from './adminPlayers';
import {LiveState,PostgresLive,RedisLive} from './liveState';
import {commandSchema,sessionRequestSchema} from '../shared/protocol';
import {ACCOUNT_COOKIE,AccountStore,FIRST_SERVER} from './accounts';
import {characterNameError} from '../shared/characterName';
const app=Fastify({logger:true,bodyLimit:4096,trustProxy:process.env.BEHIND_PROXY==='true'?(_address:string,hop:number)=>hop===0:false});
const origins=new Set((process.env.ALLOWED_ORIGINS??'http://localhost:8097,http://127.0.0.1:8097,http://localhost:5177,http://127.0.0.1:5177').split(','));
const redis=new Redis(process.env.REDIS_URL??'redis://localhost:6397',{maxRetriesPerRequest:2});redis.on('error',e=>app.log.error({err:e},'Redis unavailable'));
const store=new Store();await store.init();
await app.register(cookie);await app.register(helmet);await app.register(rateLimit,{max:180,timeWindow:'1 minute',redis});
app.addHook('onRequest',async(req,reply)=>{if(req.method!=='GET'&&(!req.headers.origin||!origins.has(req.headers.origin)))return reply.code(403).send({error:'Origem não permitida.'});});
app.get('/api/health',async()=>{await store.pool.query('SELECT 1');await redis.ping();return {ok:true,version:'0.1.0',online:connections.size,rooms:game.rooms.size};});
const accounts=new AccountStore(store.pool);await accounts.init();
const gameCookie=()=>({path:'/',httpOnly:true,sameSite:'strict' as const,secure:process.env.COOKIE_SECURE==='true',maxAge:2592000,...(process.env.COOKIE_DOMAIN?{domain:process.env.COOKIE_DOMAIN}:{})});
/** This game server's id among the Bomb Masters servers (docs/site.md); one character per account here. */
const SERVER_ID=process.env.SERVER_ID??FIRST_SERVER;
/**
 * The game only opens for a Bomb Masters account signed in on the site (pedido do matheus, 21/10): no guests and no
 * account creation inside the game. ALLOW_GUESTS=true brings guests back for local tests and load scripts only.
 */
const ALLOW_GUESTS=process.env.ALLOW_GUESTS==='true';
/**
 * The game session for this browser. A Bomb Masters account signed in on the site (docs/site.md) decides the player:
 * its character on this server, or the creation screen when it has none; another account's player is never used.
 */
async function accountSession(req:FastifyRequest,reply:FastifyReply){
 // A character that belongs to an account plays only while that account is signed in (accounts.validGameSessions).
 const current=await accounts.gameSession(req.cookies.brasa_session);
 let profile=current?await store.getProfile(current.playerId):null;
 const accountToken=req.cookies[ACCOUNT_COOKIE],account=await accounts.account(accountToken);
 if(!account)return {profile,account,accountSession:null};
 const accountSession=accounts.sessionHash(accountToken!);
 // A signed-in account always plays its own character here; with none yet it goes through character creation
 // (the guest already in this browser is never taken over, pedido do matheus 21/10).
 const playerId=await accounts.characterOn(account,SERVER_ID);
 if(playerId){
  // The game session is reissued under this account session, so the site's logout or a new password ends it too.
  if(profile?.id!==playerId||current?.accountSession!==accountSession){profile=await store.getProfile(playerId);if(profile)reply.setCookie('brasa_session',await store.createSession(profile.id,accountSession),gameCookie());}
 }else profile=null;
 return {profile,account,accountSession};
}
// Creation screen: is this name valid and free on this server?
app.get('/api/character-name',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply)=>{
 const name=String((req.query as {name?:unknown}).name??'').trim().slice(0,32);reply.header('Cache-Control','no-store');
 const invalid=characterNameError(name);if(invalid)return {ok:false,error:invalid};
 return await store.nameTaken(name)?{ok:false,error:'Esse nome já está em uso neste servidor.'}:{ok:true};
});
app.get('/api/session',async(req,reply)=>{
 const {profile,account}=await accountSession(req,reply);reply.header('Cache-Control','no-store');
 if(!account&&!ALLOW_GUESTS)return {profile:null,signIn:true};
 return {profile};
});
app.post('/api/session', {config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{
 const parsed=sessionRequestSchema.safeParse(req.body??{});if(!parsed.success)return reply.code(400).send({error:'Escolha um personagem masculino ou feminino.'});
 let {profile,account,accountSession:linked}=await accountSession(req,reply);
 if(!account&&!ALLOW_GUESTS)return reply.code(401).send({error:'Entre na sua conta no site para jogar.',signIn:true});
 if(profile&&parsed.data.gender&&parsed.data.gender!==profile.gender)return reply.code(409).send({error:'O gênero do personagem é definido na criação e não pode ser alterado.'});
 if(!profile){
  if(!parsed.data.gender)return reply.code(400).send({error:'Escolha um personagem masculino ou feminino.'});
  // The creation screen always sends a name; only bare API clients without an account (tests, load scripts) skip it.
  if(parsed.data.name===undefined&&account)return reply.code(400).send({error:'Escolha o nome do seu personagem.'});
  let created;try{created=await store.createGuest(parsed.data.gender,parsed.data.name,linked??undefined);}catch(e){return reply.code(409).send({error:(e as Error).message});}profile=created.profile;reply.setCookie('brasa_session',created.token,gameCookie());
  if(account)await accounts.linkPlayer(account,profile.id,SERVER_ID);
 }
 reply.header('Cache-Control','no-store');return {profile};
});
const game=new Game(store,e=>app.log.error(e));await game.refreshRanking();
// Rooms and matches survive restarts: hot copy in Redis, durable copy in Postgres (docs/live-state.md).
const postgresLive=new PostgresLive(store.pool);await postgresLive.init();
const live=new LiveState(game,[{backend:new RedisLive(redis),every:500},{backend:postgresLive,every:3000}],e=>app.log.error(e));
const restored=await live.restore();if(restored.rooms||restored.matches)app.log.info(restored,'Restored rooms and matches');
const connections=new Map<string,WebSocket>();
/** The game session each open socket signed in with: checked again every few seconds, so a logout or a new password
 * on the site also closes the sockets already open (A01). */
const socketSessions=new Map<WebSocket,string>();
const SESSION_RECHECK_MS=Number(process.env.SESSION_RECHECK_MS??10_000);
// Admin panel (/admin) and the maps it publishes; clients reload the map list when told.
const adminStore=new AdminStore(store.pool);await adminStore.init();
const reports=new ReportStore(store.pool);await reports.init();game.reports=reports;
const mail=new MailStore(store.pool);await mail.init();game.mail=mail;
const auction=new AuctionStore(store.pool);await auction.init();game.auction=auction;
const guilds=new GuildStore(store.pool);await guilds.init();game.guilds=guilds;
// Pets: the system is live with zero species (docs/pets.md).
const pets=new PetStore(store.pool);await pets.init();game.pets=pets;game.petGifts=PET_GIFTS;
// Hall da Fama (docs/hall-of-fame.md): standings, PvP boards, closings and rewards run in the background.
const hall=new HallStore(store.pool);await hall.init();store.hall=hall;game.hall=hall;
hall.onChange=categories=>game.hallChanged(categories);hall.onMail=id=>{void game.mailArrived(id).catch(e=>app.log.error(e));};
setInterval(()=>{void hall.tick().catch(e=>app.log.error(e));},2000).unref();void hall.tick().then(()=>game.refreshRanking()).catch(e=>app.log.error(e));
// Chefão Mundial: life, schedules and ranking in Postgres; a restart picks the event up where it was.
const worldBoss=new WorldBossService(store.pool);worldBoss.onChange=status=>game.worldBossChanged(status);await worldBoss.init();game.worldBoss=worldBoss;
await registerAdmin(app,{store:adminStore,hall,reports,mail,worldBoss,players:new PlayerDirectory(store.pool),presence:()=>game.presence(),onMail:id=>{void game.mailArrived(id).catch(e=>app.log.error(e));},live:()=>({online:connections.size,rooms:game.rooms.size,battles:game.matches.size}),pinnedMaps:()=>game.pinnedMaps(),
 onMapsChanged:()=>{const event=JSON.stringify({type:'maps'});for(const ws of connections.values())if(ws.readyState===WebSocket.OPEN)ws.send(event);}});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
const upgradeLimit=new Map<string,{time:number,count:number}>();
app.server.on('upgrade',async(req,socket,head)=>{
 try{
  const origin=req.headers.origin;const ip=process.env.BEHIND_PROXY==='true'&&typeof req.headers['x-real-ip']==='string'?req.headers['x-real-ip']:req.socket.remoteAddress??'unknown';const now=Date.now();let limit=upgradeLimit.get(ip);if(!limit||now-limit.time>60000){limit={time:now,count:0};upgradeLimit.set(ip,limit);}
  if(req.url!=='/ws'||!origin||!origins.has(origin)||++limit.count>120||connections.size>=Number(process.env.MAX_CONNECTIONS??1000)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  const token=app.parseCookie(req.headers.cookie??'').brasa_session;const signedIn=await accounts.gameSession(token);const profile=signedIn&&await store.getProfile(signedIn.playerId);
  if(!profile){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  // Without guests, the socket also needs the site account that owns this character here.
  if(!ALLOW_GUESTS){const account=await accounts.account(app.parseCookie(req.headers.cookie??'')[ACCOUNT_COOKIE]);if(!account||await accounts.characterOn(account,SERVER_ID)!==profile.id){socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();return;}}
  wss.handleUpgrade(req,socket,head,ws=>{
   const previous=connections.get(profile.id);connections.set(profile.id,ws);socketSessions.set(ws,store.hash(token!));previous?.close(4001,'Conectado em outra aba');
   const send=(event:unknown)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>512*1024){ws.close(4002,'Conexão lenta');return;}ws.send(JSON.stringify(event));}};
   game.connect(profile,send);let windowStart=Date.now(),count=0,chatAt=0,queue=Promise.resolve(),pending=0,alive=true;
   ws.on('pong',()=>alive=true);
   const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},20000);
   ws.on('message',raw=>{
    if(connections.get(profile.id)!==ws)return;
    const now=Date.now();if(now-windowStart>1000){windowStart=now;count=0;}if(++count>35||pending>24){ws.close(4008,'Muitas ações');return;}
    let data:unknown;try{data=JSON.parse(raw.toString());}catch{send({type:'error',message:'Comando inválido.'});return;}
    const parsed=commandSchema.safeParse(data);if(!parsed.success){send({type:'error',message:'Comando inválido.'});return;}
    if(parsed.data.type==='chat'){if(now-chatAt<800){send({type:'error',message:'Espere um instante para conversar.'});return;}chatAt=now;}
    pending++;queue=queue.then(async()=>{if(connections.get(profile.id)===ws)await game.command(profile.id,parsed.data);}).catch(e=>app.log.error(e)).finally(()=>pending--);
   });
   ws.on('error',e=>app.log.warn({err:e},'Socket error'));ws.on('close',()=>{clearInterval(heartbeat);socketSessions.delete(ws);if(connections.get(profile.id)===ws){connections.delete(profile.id);game.disconnect(profile.id);}});
  });
 }catch(e){app.log.error(e);socket.destroy();}
});
const tick=setInterval(()=>game.tick(),50);
const sessionSweep=setInterval(()=>{void (async()=>{
 if(!socketSessions.size)return;const valid=await accounts.validGameSessions([...new Set(socketSessions.values())]);
 for(const [ws,hash] of socketSessions)if(!valid.has(hash)){socketSessions.delete(ws);ws.close(4003,'Sessão encerrada');}
})().catch(e=>app.log.error(e));},SESSION_RECHECK_MS);
// Listings whose time ran out go back to their sellers by mail.
const auctionSweep=setInterval(()=>{void game.auctionSweep().catch(e=>app.log.error(e));},15000);
// Opens scheduled events and closes the ones whose time ran out.
const worldBossTick=setInterval(()=>{void worldBoss.tick().catch(e=>app.log.error(e));},1000);
const saving=setInterval(()=>{void live.save().catch(e=>app.log.error(e));},500);
const presence=setInterval(()=>{redis.set('brasa:shard:1:online',connections.size,'EX',25).catch(e=>app.log.error(e));for(const [ip,l]of upgradeLimit)if(Date.now()-l.time>60000)upgradeLimit.delete(ip);},10000);
await app.listen({port:Number(process.env.PORT??4107),host:'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM']as const)process.on(signal,async()=>{clearInterval(tick);clearInterval(sessionSweep);clearInterval(presence);clearInterval(auctionSweep);clearInterval(worldBossTick);clearInterval(saving);await live.save(true).catch(e=>app.log.error(e));for(const ws of connections.values())ws.close(1001,'Servidor reiniciando');await app.close();await store.pool.end();redis.disconnect();process.exit(0);});
