import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';

/**
 * Admin credentials come from the environment, never from the repository:
 *   ADMIN_USERNAME=matheus
 *   ADMIN_PASSWORD_HASH=scrypt:<salt>:<hash>   (npm run admin:password)
 * The hash has no `$`, so docker compose and .env files keep it as is.
 */
const scrypt=promisify(scryptCallback) as (password:string,salt:Buffer,keylen:number,options:{N:number;r:number;p:number;maxmem:number})=>Promise<Buffer>;
const PARAMS={N:16384,r:8,p:1,maxmem:64*1024*1024},KEY_LENGTH=64;

export async function hashPassword(password:string):Promise<string>{
 if(password.length<10)throw new Error('A senha precisa ter pelo menos 10 caracteres.');
 return hashSecret(password);
}

/** scrypt hash with no length rule; player accounts (server/accounts.ts) set their own. */
export async function hashSecret(password:string):Promise<string>{
 const salt=randomBytes(16),hash=await scrypt(password,salt,KEY_LENGTH,PARAMS);
 return `scrypt:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

/** Constant-time check; a malformed hash never matches. */
export async function verifyPassword(password:string,stored:string):Promise<boolean>{
 const [scheme,salt,hash]=stored.split(':');
 if(scheme!=='scrypt'||!salt||!hash)return false;
 const expected=Buffer.from(hash,'base64url');if(expected.length!==KEY_LENGTH)return false;
 const actual=await scrypt(password.slice(0,512),Buffer.from(salt,'base64url'),KEY_LENGTH,PARAMS);
 return timingSafeEqual(actual,expected);
}

/** A hash that never matches, so a wrong username costs the same time as a wrong password. */
const DECOY=`scrypt:${randomBytes(16).toString('base64url')}:${randomBytes(KEY_LENGTH).toString('base64url')}`;

export interface AdminAccount {username:string;passwordHash:string;}
export function adminAccount(env:NodeJS.ProcessEnv=process.env):AdminAccount|null{
 const username=env.ADMIN_USERNAME?.trim(),passwordHash=env.ADMIN_PASSWORD_HASH?.trim();
 return username&&passwordHash?{username,passwordHash}:null;
}

/** Equal strings, compared in constant time over fixed-size digests: any Unicode length is just a mismatch (A07). */
export function sameSecret(a:string,b:string){
 return timingSafeEqual(createHash('sha256').update(a,'utf8').digest(),createHash('sha256').update(b,'utf8').digest());
}

/**
 * The version of the admin credentials in force: a session is valid only under the version it was opened with, so
 * changing ADMIN_USERNAME or ADMIN_PASSWORD_HASH (or removing them) ends every admin session, even after a restart (A02).
 */
export function credentialVersion(account:AdminAccount){
 return createHash('sha256').update(`${account.username}\0${account.passwordHash}`,'utf8').digest('hex');
}

export async function checkCredentials(account:AdminAccount|null,username:string,password:string):Promise<boolean>{
 const nameMatches=!!account&&sameSecret(username,account.username);
 const passwordMatches=await verifyPassword(password,nameMatches?account!.passwordHash:DECOY);
 return nameMatches&&passwordMatches;
}

/**
 * Failed logins per username and per address: after `max` failures in `windowMs`,
 * that key is locked until the window passes. A success clears the username's count.
 */
export class LoginThrottle {
 private failures=new Map<string,{count:number;since:number}>();
 constructor(private max=5,private windowMs=15*60_000,private now=()=>Date.now()){}
 private entry(key:string){const e=this.failures.get(key);if(e&&this.now()-e.since>this.windowMs){this.failures.delete(key);return undefined;}return e;}
 /** Milliseconds until the key may try again, 0 when it may try now. */
 lockedFor(...keys:string[]){let wait=0;for(const key of keys){const e=this.entry(key);if(e&&e.count>=this.max)wait=Math.max(wait,this.windowMs-(this.now()-e.since));}return wait;}
 fail(...keys:string[]){for(const key of keys){const e=this.entry(key);if(e)e.count++;else this.failures.set(key,{count:1,since:this.now()});}
  if(this.failures.size>10_000)for(const [key] of this.failures){this.entry(key);if(this.failures.size<5_000)break;}}
 succeed(key:string){this.failures.delete(key);}
}

export const newSessionToken=()=>randomBytes(32).toString('hex');
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
