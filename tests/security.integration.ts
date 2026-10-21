/**
 * Regressões da auditoria de segurança de 21/10/2026 (A01, A02, A04, A05, A07) contra Postgres e Redis reais.
 * Sobe o servidor do jogo e o do site em portas próprias (com ALLOW_GUESTS para conferir que o convidado de teste não é afetado); precisa de Postgres em DATABASE_URL e Redis em REDIS_URL.
 *   npm run test:security:integration
 */
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readdir,writeFile} from 'node:fs/promises';
import {connect} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import pg from 'pg';
import {WebSocket} from 'ws';
import {AdminStore} from '../server/adminStore';
import {registerAdmin} from '../server/admin';
import {hashPassword} from '../server/adminAuth';
import {AccountStore} from '../server/accounts';
import {MediaStore} from '../site/server/media';
import {FORUM_MEDIA} from '../site/src/forumRules';

const DATABASE_URL=process.env.DATABASE_URL??'postgres://brasa:brasa_local@localhost:5447/brasa';
const GAME_PORT=4197,SITE_PORT=4198,GAME=`http://127.0.0.1:${GAME_PORT}`,SITE=`http://127.0.0.1:${SITE_PORT}`;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const children:ChildProcess[]=[];
const pool=new pg.Pool({connectionString:DATABASE_URL,max:4});

async function boot(script:string,port:number,env:Record<string,string>){
 const child=spawn(process.execPath,['--import','tsx',script],{env:{...process.env,DATABASE_URL,PORT:String(port),...env},stdio:['ignore','ignore','pipe']});
 let log='';child.stderr!.on('data',d=>{log+=d;});children.push(child);
 for(let n=0;n<120;n++){
  if(child.exitCode!==null)throw Error(`${script} saiu: ${log}`);
  const ok=await fetch(`http://127.0.0.1:${port}${script.includes('site')?'/api/site/health':'/api/health'}`).then(r=>r.ok,()=>false);if(ok)return;await pause(500);
 }
 throw Error(`${script} não subiu: ${log}`);
}
const cookieOf=(response:Response,name:string)=>response.headers.getSetCookie().map(c=>c.split(';')[0]).find(c=>c.startsWith(`${name}=`)&&c.length>name.length+1);
const jar=(...cookies:(string|undefined)[])=>cookies.filter(Boolean).join('; ');
const site=(path:string,body:unknown,cookies='')=>fetch(`${SITE}${path}`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json',...(cookies?{Cookie:cookies}:{})},body:JSON.stringify(body)});
const game=(path:string,init:{body?:unknown;cookies?:string}={})=>fetch(`${GAME}${path}`,init.body===undefined?{headers:init.cookies?{Cookie:init.cookies}:{}}:{method:'POST',headers:{Origin:GAME,'Content-Type':'application/json',...(init.cookies?{Cookie:init.cookies}:{})},body:JSON.stringify(init.body)});

async function account(){
 const username=`a${randomBytes(5).toString('hex')}`,password='senha-forte-123';
 const r=await site('/api/site/register',{username,email:`${username}@exemplo.com`,password});assert.equal(r.status,200,await r.clone().text());
 return {username,password,cookie:cookieOf(r,'bm_account')!};
}
async function character(accountCookie?:string){
 const r=await game('/api/session',{body:{gender:'male',name:`P${randomBytes(4).toString('hex')}`},cookies:accountCookie});
 assert.equal(r.status,200,await r.clone().text());
 return {profile:(await r.json()).profile as {id:string},cookie:cookieOf(r,'brasa_session')!};
}
const sessionProfile=async(cookies:string)=>(await (await game('/api/session',{cookies})).json()).profile as {id:string}|null;
function socket(cookies:string){
 return new Promise<{ws:WebSocket;closed:Promise<number>}>((resolve,reject)=>{
  const ws=new WebSocket(`${GAME.replace('http','ws')}/ws`,{origin:GAME,headers:{Cookie:cookies}});
  const closed=new Promise<number>(done=>ws.once('close',code=>done(code)));
  ws.once('message',()=>resolve({ws,closed}));ws.once('unexpected-response',(_req,res)=>reject(Object.assign(Error(`upgrade ${res.statusCode}`),{status:res.statusCode})));ws.once('error',reject);
 });
}
const refused=async(cookies:string)=>{try{const s=await socket(cookies);s.ws.close();return 0;}catch(e){return (e as {status?:number}).status??-1;}};

async function a01(){
 // A: account with a character; B: another account; G: a guest.
 const a=await account(),aChar=await character(a.cookie),b=await account(),bChar=await character(b.cookie),guest=await character();
 const aGame=jar(aChar.cookie),aSocket=await socket(aGame),bSocket=await socket(jar(bChar.cookie)),guestSocket=await socket(jar(guest.cookie));
 assert.equal((await sessionProfile(aGame))?.id,aChar.profile.id);
 assert.equal((await site('/api/site/logout',{},a.cookie)).status,200);
 // The old game cookie no longer opens the character, alone or with the dead account cookie, over HTTP or a new socket.
 assert.equal(await sessionProfile(aGame),null);assert.equal(await sessionProfile(jar(a.cookie,aChar.cookie)),null);
 assert.equal(await refused(aGame),401);
 // The socket already open is closed by the periodic check.
 assert.equal(await Promise.race([aSocket.closed,pause(5000).then(()=>-1)]),4003);
 // Others are untouched: B and the guest keep playing.
 assert.equal(bSocket.ws.readyState,WebSocket.OPEN);assert.equal(guestSocket.ws.readyState,WebSocket.OPEN);
 assert.equal((await sessionProfile(jar(guest.cookie)))?.id,guest.profile.id);assert.equal((await sessionProfile(jar(bChar.cookie)))?.id,bChar.profile.id);
 // Signing in again plays the same character.
 const again=await site('/api/site/login',{login:a.username,password:a.password});const aCookie2=cookieOf(again,'bm_account')!;
 const back=await game('/api/session',{cookies:aCookie2});assert.equal((await back.json()).profile.id,aChar.profile.id);assert.ok(cookieOf(back,'brasa_session'));
 // New password from another browser: every other session of B ends, game sessions included; the one that changed it stays.
 const other=cookieOf(await site('/api/site/login',{login:b.username,password:b.password}),'bm_account')!;
 const otherGame=cookieOf(await game('/api/session',{cookies:other}),'brasa_session')!;
 assert.equal((await site('/api/site/password',{current:b.password,next:'outra-senha-456'},other)).status,200);
 assert.equal(await sessionProfile(jar(bChar.cookie)),null);assert.equal(await refused(jar(bChar.cookie)),401);
 assert.equal(await Promise.race([bSocket.closed,pause(5000).then(()=>-1)]),4003);
 assert.equal((await sessionProfile(jar(other,otherGame)))?.id,bChar.profile.id);assert.equal((await sessionProfile(jar(otherGame)))?.id,bChar.profile.id);
 // A guest keeps its character from the game cookie alone.
 assert.equal(guestSocket.ws.readyState,WebSocket.OPEN);guestSocket.ws.close();
 console.log('A01 ok: logout e troca de senha revogam HTTP, novo upgrade e socket aberto; outros e convidado intactos');
}

async function a02(){
 const hash=await hashPassword('senha-admin-longa'),store=new AdminStore(pool);
 const panel=async()=>{const app=Fastify();await app.register(cookie);await registerAdmin(app,{store,live:()=>({online:0,rooms:0,battles:0}),onMapsChanged:()=>{}});return app;};
 process.env.ADMIN_USERNAME='auditadmin';process.env.ADMIN_PASSWORD_HASH=hash;
 let app=await panel();
 const login=await app.inject({method:'POST',url:'/api/admin/login',payload:{username:'auditadmin',password:'senha-admin-longa'}});assert.equal(login.statusCode,200);
 const cookieHeader=`brasa_admin=${login.cookies.find(c=>c.name==='brasa_admin')!.value}`;
 const read=()=>app.inject({method:'GET',url:'/api/admin/stats',headers:{cookie:cookieHeader}});
 const write=()=>app.inject({method:'POST',url:'/api/admin/reports/1',headers:{cookie:cookieHeader},payload:{status:'closed'}});
 assert.equal((await read()).statusCode,200);
 // A07: any Unicode username is a counted failure, never a 500.
 const unicode=await app.inject({method:'POST',url:'/api/admin/login',payload:{username:'éuditadmin',password:'x'}});assert.equal(unicode.statusCode,401);
 assert.ok((await pool.query("SELECT 1 FROM admin_audit WHERE action='login-failed' AND username='éuditadmin'")).rows.length);
 // Panel switched off: reading and writing with the old cookie stop.
 delete process.env.ADMIN_PASSWORD_HASH;
 assert.equal((await read()).statusCode,401);assert.equal((await write()).statusCode,401);
 assert.equal((await app.inject({method:'GET',url:'/api/admin/me',headers:{cookie:cookieHeader}})).json().username,null);
 // Back on with the same credentials, and after a restart: the old cookie stays dead.
 process.env.ADMIN_PASSWORD_HASH=hash;await app.close();app=await panel();
 assert.equal((await read()).statusCode,401);
 // A fresh login, then a new password (restart): the cookie from before the change is refused.
 const second=await app.inject({method:'POST',url:'/api/admin/login',payload:{username:'auditadmin',password:'senha-admin-longa'}});
 const secondCookie=`brasa_admin=${second.cookies.find(c=>c.name==='brasa_admin')!.value}`;
 assert.equal((await app.inject({method:'GET',url:'/api/admin/stats',headers:{cookie:secondCookie}})).statusCode,200);
 process.env.ADMIN_PASSWORD_HASH=await hashPassword('nova-senha-admin');await app.close();app=await panel();
 assert.equal((await app.inject({method:'GET',url:'/api/admin/stats',headers:{cookie:secondCookie}})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/admin/reports/1',headers:{cookie:secondCookie},payload:{status:'closed'}})).statusCode,401);
 await app.close();delete process.env.ADMIN_USERNAME;delete process.env.ADMIN_PASSWORD_HASH;
 console.log('A02/A07 ok: troca de senha e painel desligado revogam leitura e escrita, também após reinício; Unicode vira 401');
}

/** Sends the headers of an upload (and maybe part of its body) and returns the first response line. */
function rawUpload(headers:Record<string,string>,body=''){
 return new Promise<string>((resolve,reject)=>{
  const s=connect(SITE_PORT,'127.0.0.1');let got='';
  s.on('data',d=>{got+=d;if(got.includes('\r\n')){resolve(got.split('\r\n')[0]);s.destroy();}});s.on('error',reject);
  s.write(`POST /api/site/forum/media HTTP/1.1\r\nHost: 127.0.0.1:${SITE_PORT}\r\nOrigin: ${SITE}\r\nContent-Type: image/png\r\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')}\r\n${body}`);
  setTimeout(()=>{resolve('TIMEOUT');s.destroy();},4000);
 });
}
function heldUpload(headers:Record<string,string>){
 const s=connect(SITE_PORT,'127.0.0.1');
 s.write(`POST /api/site/forum/media HTTP/1.1\r\nHost: 127.0.0.1:${SITE_PORT}\r\nOrigin: ${SITE}\r\nContent-Type: image/png\r\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}\r\n`).join('')}\r\nxx`);
 return s;
}

async function a04(){
 const a=await account();
 // No session: refused before the body (only the headers were sent).
 assert.match(await rawUpload({'Content-Length':String(5*1048576)}),/ 401 /);
 // Too big or with no declared size: refused before reading it.
 assert.match(await rawUpload({Cookie:a.cookie,'Content-Length':String(FORUM_MEDIA.maxBytes.video+1)}),/ 413 /);
 assert.match(await rawUpload({Cookie:a.cookie,'Transfer-Encoding':'chunked'}),/ 411 /);
 // One upload per account at a time; the shared budget refuses what would go over it.
 const held=heldUpload({Cookie:a.cookie,'Content-Length':String(10*1048576)});await pause(300);
 assert.match(await rawUpload({Cookie:a.cookie,'Content-Length':'100'}),/ 429 /);
 const b=await account(),c=await account(),d=await account();
 const big=[heldUpload({Cookie:b.cookie,'Content-Length':String(30*1048576)}),heldUpload({Cookie:c.cookie,'Content-Length':String(30*1048576)})];await pause(300);
 assert.match(await rawUpload({Cookie:d.cookie,'Content-Length':String(30*1048576)}),/ 503 /);
 // A body that never arrives is cut, and its share of the budget comes back.
 assert.equal(await new Promise(done=>{held.once('close',()=>done('closed'));setTimeout(()=>done('open'),4000);}),'closed');
 for(const s of big)s.destroy();await pause(300);
 assert.match(await rawUpload({Cookie:d.cookie,'Content-Length':'4'},'abcd'),/ 415 /);
 console.log('A04 ok: sem sessão, tamanho excessivo e sem tamanho recusados antes do corpo; concorrência e orçamento limitados; corpo lento cortado');
}

async function a05(){
 const accounts=new AccountStore(pool),token=await accounts.register(`m${randomBytes(5).toString('hex')}`,`${randomUUID()}@exemplo.com`,'senha-forte-123');
 const owner=(await accounts.account(token))!,dir=await mkdtemp(join(tmpdir(),'media-')),media=new MediaStore(pool,dir);
 for(let n=0;n<FORUM_MEDIA.perDay-1;n++)await pool.query('INSERT INTO forum_media(id,account_id,kind,ext,size) VALUES($1,$2,$3,$4,$5)',[randomBytes(12).toString('hex'),owner.id,'image','png',10]);
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d605de0000000049454e44ae426082','hex');
 const results=await Promise.allSettled([media.save(owner.id,png),media.save(owner.id,png)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM forum_media WHERE account_id=$1',[owner.id])).rows[0].n,FORUM_MEDIA.perDay);
 assert.equal((await readdir(dir)).length,1);
 // A write that fails leaves neither a row nor a file behind.
 const other=(await accounts.account(await accounts.register(`m${randomBytes(5).toString('hex')}`,`${randomUUID()}@exemplo.com`,'senha-forte-123')))!;
 const blocked=join(dir,'arquivo');await writeFile(blocked,'x');
 await assert.rejects(new MediaStore(pool,blocked).save(other.id,png));
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM forum_media WHERE account_id=$1',[other.id])).rows[0].n,0);
 console.log('A05 ok: na última vaga, dois envios simultâneos dão um sucesso; falha não deixa registro nem arquivo');
}

try{
 // The schema the servers create on start: the game first, then the site.
 const env={ALLOW_GUESTS:'true',REDIS_URL:process.env.REDIS_URL??'redis://localhost:6397',ALLOWED_ORIGINS:`${GAME},${SITE}`,SESSION_RECHECK_MS:'500',UPLOAD_TIMEOUT_MS:'2500',UPLOAD_BUDGET_BYTES:String(64*1048576),UPLOAD_DIR:await mkdtemp(join(tmpdir(),'uploads-'))};
 await boot('server/index.ts',GAME_PORT,env);await boot('site/server/index.ts',SITE_PORT,env);
 await a01();await a02();await a04();await a05();
 console.log('Auditoria: todas as regressões passaram.');
}finally{for(const c of children)c.kill('SIGTERM');await pool.end();}
