import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type pg from 'pg';
import {hashSecret,verifyPassword} from './adminAuth';

/**
 * Bomb Masters accounts (docs/site.md): one username, e-mail and password for the site and the game.
 * The site signs in with the `bm_account` cookie; the game turns it into its own `brasa_session`
 * and links the account to one player, created on the first Jogar or adopted from the guest already in the browser.
 */
export const ACCOUNT_COOKIE='bm_account';
export const ACCOUNT_DAYS=30;
export const USERNAME_RULE=/^[A-Za-z0-9_]{3,16}$/;
export const EMAIL_RULE=/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/;
export const PASSWORD_MIN=8,PASSWORD_MAX=128;

export interface Account {id:string;username:string;email:string;playerId:string|null;createdAt:string;}
export class AccountError extends Error {constructor(message:string,readonly status=400){super(message);}}

const DECOY_HASH=hashSecret(randomBytes(24).toString('hex'));
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
const row=(r:any):Account=>({id:r.id,username:r.username,email:r.email,playerId:r.player_id??null,createdAt:new Date(r.created_at).toISOString()});

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
 `);}
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
 private async openSession(accountId:string){
  const token=randomBytes(32).toString('hex');
  await this.pool.query(`INSERT INTO account_sessions VALUES($1,$2,now()+interval '${ACCOUNT_DAYS} days')`,[hashToken(token),accountId]);
  return token;
 }
 async logout(token:string|undefined){if(token&&/^[0-9a-f]{64}$/.test(token))await this.pool.query('DELETE FROM account_sessions WHERE token_hash=$1',[hashToken(token)]);}
 async account(token:string|undefined):Promise<Account|null>{
  if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
  const r=await this.pool.query('SELECT a.* FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hashToken(token)]);
  return r.rows[0]?row(r.rows[0]):null;
 }
 async byPlayer(playerId:string){const r=await this.pool.query('SELECT * FROM accounts WHERE player_id=$1',[playerId]);return r.rows[0]?row(r.rows[0]):null;}
 /** Links a player that no account owns yet; the player takes the account's username as its name. */
 async linkPlayer(account:Account,playerId:string){
  const r=await this.pool.query('UPDATE accounts SET player_id=$2 WHERE id=$1 AND player_id IS NULL AND NOT EXISTS(SELECT 1 FROM accounts WHERE player_id=$2)',[account.id,playerId]);
  if(!r.rowCount)return false;
  await this.pool.query("UPDATE players SET name=$2::text,profile=jsonb_set(profile,'{name}',to_jsonb($2::text)) WHERE id=$1",[playerId,account.username]);
  return true;
 }
}
