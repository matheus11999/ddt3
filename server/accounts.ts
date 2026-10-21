import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type pg from 'pg';
import {hashSecret,verifyPassword} from './adminAuth';

/**
 * Bomb Masters accounts (docs/site.md): one username, e-mail and password for the site and the game.
 * The site signs in with the `bm_account` cookie; each game server turns it into its own `brasa_session`.
 * An account has one character per game server (`account_characters`, server id from SERVER_ID), created on the
 * first Jogar there or adopted from the guest already in the browser. Characters made before servers existed are
 * the first server's (`s1`).
 */
export const ACCOUNT_COOKIE='bm_account';
export const ACCOUNT_DAYS=30;
export const USERNAME_RULE=/^[A-Za-z0-9_]{3,16}$/;
export const EMAIL_RULE=/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
export const PASSWORD_MIN=8,PASSWORD_MAX=128;

export const AVATARS=['explorer','goggles','knight','champion','dragon','verdalia'] as const;
export type AvatarId=typeof AVATARS[number];
export const FIRST_SERVER='s1';
export interface Account {id:string;username:string;email:string;avatar:AvatarId;createdAt:string;}
export interface GameServer {id:string;name:string;url:string;status:'online'|'maintenance'|'soon';}
export interface ServerCharacter {server:GameServer;character:{name:string;gender:'male'|'female';level:number;wins:number;matches:number}|null;}
export class AccountError extends Error {constructor(message:string,readonly status=400){super(message);}}

const DECOY_HASH=hashSecret(randomBytes(24).toString('hex'));
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
const row=(r:any):Account=>({id:r.id,username:r.username,email:r.email,avatar:(AVATARS as readonly string[]).includes(r.avatar)?r.avatar:'explorer',createdAt:new Date(r.created_at).toISOString()});

export function cookieOptions(){
 return {path:'/',httpOnly:true,sameSite:'lax' as const,secure:process.env.COOKIE_SECURE==='true',maxAge:ACCOUNT_DAYS*86400,...(process.env.COOKIE_DOMAIN?{domain:process.env.COOKIE_DOMAIN}:{})};
}

export class AccountStore {
 constructor(readonly pool:pg.Pool){}
 async init(){await this.pool.query(`
 CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY,username varchar(16) NOT NULL,email varchar(254) NOT NULL,password_hash text NOT NULL,player_id uuid UNIQUE REFERENCES players(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX IF NOT EXISTS accounts_username ON accounts(lower(username));
 CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(lower(email));
 CREATE TABLE IF NOT EXISTS account_sessions(token_hash char(64) PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
 CREATE INDEX IF NOT EXISTS account_sessions_expiration ON account_sessions(expires_at);
 DELETE FROM account_sessions WHERE expires_at<now();
 ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar varchar(16) NOT NULL DEFAULT 'explorer';
 CREATE TABLE IF NOT EXISTS game_servers(id varchar(16) PRIMARY KEY,name varchar(40) NOT NULL,url text NOT NULL,status varchar(12) NOT NULL DEFAULT 'online',sort int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS account_characters(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,server_id varchar(16) NOT NULL REFERENCES game_servers(id),player_id uuid NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,server_id));
 -- A game session opened by an account lives only as long as that account session (logout, new password, expiry).
 ALTER TABLE IF EXISTS sessions ADD COLUMN IF NOT EXISTS account_session char(64);
 DO $$BEGIN
  IF to_regclass('sessions') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='sessions_account_session_fkey') THEN
   DELETE FROM sessions s WHERE s.account_session IS NOT NULL AND NOT EXISTS(SELECT 1 FROM account_sessions a WHERE a.token_hash=s.account_session);
   ALTER TABLE sessions ADD CONSTRAINT sessions_account_session_fkey FOREIGN KEY(account_session) REFERENCES account_sessions(token_hash) ON DELETE CASCADE;
  END IF;
  IF to_regclass('sessions') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS sessions_account_session ON sessions(account_session); END IF;
 END$$;
 `);
  // The first server exists from the start; characters linked before servers existed belong to it.
  await this.pool.query("INSERT INTO game_servers(id,name,url,sort) VALUES($1,$2,$3,0) ON CONFLICT (id) DO NOTHING",[FIRST_SERVER,process.env.FIRST_SERVER_NAME??'Servidor 1',process.env.GAME_URL??'http://localhost:8097']);
  await this.pool.query("INSERT INTO account_characters(account_id,server_id,player_id) SELECT id,$1,player_id FROM accounts WHERE player_id IS NOT NULL ON CONFLICT DO NOTHING",[FIRST_SERVER]);
 }
 async register(username:string,email:string,password:string){
  username=username.trim();email=email.trim().toLowerCase();
  if(!USERNAME_RULE.test(username))throw new AccountError('O usuário precisa ter de 3 a 16 letras, números ou _.');
  if(email.length>254||!EMAIL_RULE.test(email))throw new AccountError('Digite um e-mail válido.');
  if(password.length<PASSWORD_MIN||password.length>PASSWORD_MAX)throw new AccountError(`A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`);
  const taken=await this.pool.query('SELECT lower(username)=lower($1) AS name FROM accounts WHERE lower(username)=lower($1) OR lower(email)=$2',[username,email]);
  if(taken.rows.length)throw new AccountError(taken.rows.some(r=>r.name)?'Esse usuário já existe.':'Esse e-mail já tem conta.',409);
  const id=randomUUID(),hash=await hashSecret(password);
  try{await this.pool.query('INSERT INTO accounts(id,username,email,password_hash) VALUES($1,$2,$3,$4)',[id,username,email,hash]);}
  catch(e){if((e as {code?:string}).code==='23505')throw new AccountError('Esse usuário ou e-mail já tem conta.',409);throw e;}
  return this.openSession(id);
 }
 /** `login` is the username or the e-mail. */
 async login(login:string,password:string){
  const r=await this.pool.query('SELECT id,password_hash FROM accounts WHERE lower(username)=lower($1) OR lower(email)=lower($1) LIMIT 1',[login.trim()]);
  const ok=await verifyPassword(password,r.rows[0]?.password_hash??await DECOY_HASH);
  if(!r.rows[0]||!ok)throw new AccountError('Usuário ou senha incorretos.',401);
  return this.openSession(r.rows[0].id);
 }
 /** New password: checks the current one and signs out every other session. */
 async changePassword(account:Account,current:string,next:string,keepToken:string){
  if(next.length<PASSWORD_MIN||next.length>PASSWORD_MAX)throw new AccountError(`A nova senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`);
  const r=await this.pool.query('SELECT password_hash FROM accounts WHERE id=$1',[account.id]);
  if(!r.rows[0]||!await verifyPassword(current,r.rows[0].password_hash))throw new AccountError('A senha atual está errada.',403);
  await this.pool.query('UPDATE accounts SET password_hash=$2 WHERE id=$1',[account.id,await hashSecret(next)]);
  // The other account sessions end, and with them (ON DELETE CASCADE) every game session they opened.
  await this.pool.query('DELETE FROM account_sessions WHERE account_id=$1 AND token_hash<>$2',[account.id,hashToken(keepToken)]);
  await this.pool.query('DELETE FROM sessions WHERE account_session IS NULL AND player_id IN (SELECT player_id FROM account_characters WHERE account_id=$1 UNION SELECT player_id FROM accounts WHERE id=$1 AND player_id IS NOT NULL)',[account.id]);
 }
 async setAvatar(account:Account,avatar:string){
  if(!(AVATARS as readonly string[]).includes(avatar))throw new AccountError('Escolha um dos avatares.');
  await this.pool.query('UPDATE accounts SET avatar=$2 WHERE id=$1',[account.id,avatar]);
 }
 /** Every server with this account's character there (null where it has none yet). */
 async characters(account:Account):Promise<ServerCharacter[]>{
  const r=await this.pool.query(`SELECT s.id,s.name,s.url,s.status,p.name AS pname,p.profile->>'gender' AS gender,(p.profile->>'level')::int AS level,(p.profile->>'wins')::int AS wins,(p.profile->>'matches')::int AS matches
   FROM game_servers s LEFT JOIN account_characters c ON c.server_id=s.id AND c.account_id=$1 LEFT JOIN players p ON p.id=c.player_id ORDER BY s.sort,s.created_at`,[account.id]);
  return r.rows.map(x=>({server:{id:x.id,name:x.name,url:x.url,status:x.status},character:x.pname?{name:x.pname,gender:x.gender==='female'?'female':'male',level:x.level??1,wins:x.wins??0,matches:x.matches??0}:null}));
 }
 /** The account's player on one game server. */
 async characterOn(account:Account,serverId:string):Promise<string|null>{
  const r=await this.pool.query('SELECT player_id FROM account_characters WHERE account_id=$1 AND server_id=$2',[account.id,serverId]);
  return r.rows[0]?.player_id??null;
 }
 private async openSession(accountId:string){
  const token=randomBytes(32).toString('hex');
  await this.pool.query(`INSERT INTO account_sessions VALUES($1,$2,now()+interval '${ACCOUNT_DAYS} days')`,[hashToken(token),accountId]);
  return token;
 }
 /** Logout ends the account session and, by cascade, the game sessions it opened on every server. */
 async logout(token:string|undefined){if(token&&/^[0-9a-f]{64}$/.test(token))await this.pool.query('DELETE FROM account_sessions WHERE token_hash=$1',[hashToken(token)]);}
 async account(token:string|undefined):Promise<Account|null>{
  if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
  const r=await this.pool.query('SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hashToken(token)]);
  return r.rows[0]?row(r.rows[0]):null;
 }
 /** The stored hash of an account cookie, which links the game sessions it opens. */
 sessionHash(token:string){return hashToken(token);}
 /**
  * Which of these game session hashes still let their player in (A01, auditoria 21/10): a guest's own session, or a
  * session opened by a live session of the account that owns the character. A character that belongs to an account
  * never plays from a bare game cookie, so logging out or changing the password locks every copy of it out.
  */
 async validGameSessions(hashes:string[]):Promise<Map<string,{playerId:string;accountSession:string|null}>>{
  const valid=new Map<string,{playerId:string;accountSession:string|null}>();if(!hashes.length)return valid;
  const r=await this.pool.query(`SELECT s.token_hash,s.player_id,s.account_session FROM sessions s
   LEFT JOIN account_sessions a ON a.token_hash=s.account_session AND a.expires_at>now()
   WHERE s.token_hash=ANY($1) AND s.expires_at>now() AND CASE WHEN s.account_session IS NULL
    THEN NOT EXISTS(SELECT 1 FROM account_characters c WHERE c.player_id=s.player_id) AND NOT EXISTS(SELECT 1 FROM accounts x WHERE x.player_id=s.player_id)
    ELSE a.token_hash IS NOT NULL AND (EXISTS(SELECT 1 FROM account_characters c WHERE c.player_id=s.player_id AND c.account_id=a.account_id) OR EXISTS(SELECT 1 FROM accounts x WHERE x.id=a.account_id AND x.player_id=s.player_id)) END`,[hashes]);
  for(const x of r.rows)valid.set(x.token_hash,{playerId:x.player_id,accountSession:x.account_session});
  return valid;
 }
 /** The player a game cookie may play, by the rule of validGameSessions. */
 async gameSession(token:string|undefined){
  if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
  return (await this.validGameSessions([hashToken(token)])).get(hashToken(token))??null;
 }
 /** True when some account already owns this player (on any server). */
 async owned(playerId:string){return (await this.pool.query('SELECT 1 FROM account_characters WHERE player_id=$1 UNION SELECT 1 FROM accounts WHERE player_id=$1',[playerId])).rows.length>0;}
 /** Links a player that no account owns yet as the account's character on this server (it keeps the name chosen at creation). */
 async linkPlayer(account:Account,playerId:string,serverId:string){
  if(await this.owned(playerId))return false;
  await this.pool.query('INSERT INTO game_servers(id,name,url,sort) VALUES($1,$1,$2,99) ON CONFLICT (id) DO NOTHING',[serverId,process.env.GAME_URL??'http://localhost:8097']);
  const r=await this.pool.query('INSERT INTO account_characters(account_id,server_id,player_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[account.id,serverId,playerId]);
  if(!r.rowCount)return false;
  return true;
 }
}
