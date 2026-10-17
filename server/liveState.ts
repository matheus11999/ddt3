import {deflateSync,inflateSync} from 'node:zlib';
import type {Pool} from 'pg';
import type {Redis} from 'ioredis';
import type {Game,SavedGame,SavedMatch} from './game';

/**
 * Keeps rooms and matches alive across server restarts (docs/live-state.md).
 * The state is a set of fields: `meta` (rooms, seats, clock), `m:<key>` (a match) and `t:<key>` (its terrain, deflated).
 * Only changed fields are written: Redis every half second (hot copy) and Postgres every few seconds (durable copy).
 * On start the newest of the two copies wins.
 */
export interface LiveBackend {name:string;load():Promise<Map<string,string>>;write(set:Map<string,string>,remove:string[]):Promise<void>;}

const REDIS_KEY='brasa:live:v1',REDIS_TTL_S=86400;
export class RedisLive implements LiveBackend {
 name='redis';
 constructor(private redis:Redis){}
 async load(){return new Map(Object.entries(await this.redis.hgetall(REDIS_KEY)));}
 async write(set:Map<string,string>,remove:string[]){
  const tx=this.redis.multi();if(set.size)tx.hset(REDIS_KEY,Object.fromEntries(set));if(remove.length)tx.hdel(REDIS_KEY,...remove);tx.expire(REDIS_KEY,REDIS_TTL_S);
  const results=await tx.exec();for(const [error] of results??[])if(error)throw error;
 }
}
export class PostgresLive implements LiveBackend {
 name='postgres';
 constructor(private pool:Pool){}
 async init(){await this.pool.query('CREATE TABLE IF NOT EXISTS live_state(field text PRIMARY KEY,value text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())');}
 async load(){const r=await this.pool.query('SELECT field,value FROM live_state');return new Map(r.rows.map(row=>[row.field as string,row.value as string]));}
 async write(set:Map<string,string>,remove:string[]){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   if(set.size)await c.query('INSERT INTO live_state(field,value) SELECT * FROM unnest($1::text[],$2::text[]) ON CONFLICT(field) DO UPDATE SET value=excluded.value,updated_at=now()',[[...set.keys()],[...set.values()]]);
   if(remove.length)await c.query('DELETE FROM live_state WHERE field=ANY($1::text[])',[remove]);
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
}

interface Target {backend:LiveBackend;every:number;lastAt:number;pending:Map<string,string|null>;writing:Promise<void>|null;}
const savedAt=(fields:Map<string,string>)=>{try{return (JSON.parse(fields.get('meta')??'') as SavedGame).savedAt??0;}catch{return 0;}};

export class LiveState {
 /** Last value of every field as known by the backends (written or loaded). */
 private stored=new Map<string,string>();private targets:Target[];
 constructor(private game:Game,backends:{backend:LiveBackend;every:number}[],private report:(e:unknown)=>void=console.error){
  this.targets=backends.map(({backend,every})=>({backend,every,lastAt:0,pending:new Map(),writing:null}));
 }
 /** Loads the newest saved copy into the game. Returns how many rooms and matches came back. */
 async restore(now=Date.now()){
  const loaded:Map<string,string>[]=[];
  for(const {backend} of this.targets)loaded.push(await backend.load().catch(error=>{this.report(error);return new Map<string,string>();}));
  // Fields of every copy are remembered so stale ones are deleted on the next write.
  for(const fields of loaded)for(const field of fields.keys())this.stored.set(field,'');
  const best=loaded.reduce<Map<string,string>|null>((a,b)=>!a||savedAt(b)>savedAt(a)?b:a,null);
  if(!best?.has('meta'))return {rooms:0,matches:0};
  for(const [field,value] of best)this.stored.set(field,value);
  try{
   const game=JSON.parse(best.get('meta')!) as SavedGame,matches:{match:SavedMatch;terrain:Uint8Array}[]=[];
   for(const [field,value] of best){
    if(!field.startsWith('m:'))continue;const terrain=best.get(`t:${field.slice(2)}`);if(!terrain)continue;
    matches.push({match:JSON.parse(value) as SavedMatch,terrain:new Uint8Array(inflateSync(Buffer.from(terrain.slice(terrain.indexOf('|')+1),'base64')))});
   }
   this.game.restore(game,matches,now);
   return {rooms:this.game.rooms.size,matches:this.game.matches.size};
  }catch(error){this.report(error);return {rooms:0,matches:0};}
 }
 /** Collects the changed fields and writes them to each backend that is due (all of them when `force`). */
 async save(force=false,now=Date.now()){
  const {game,matches}=this.game.savedState(now),current=new Map<string,string>();
  current.set('meta',JSON.stringify(game));
  const keep=new Set<string>();
  for(const m of matches){
   // Mid-shot: keep the copy from the start of the turn.
   if(!m.stable){keep.add(`m:${m.key}`);keep.add(`t:${m.key}`);continue;}
   current.set(`m:${m.key}`,JSON.stringify(m.match));
   const old=this.stored.get(`t:${m.key}`)??'';
   current.set(`t:${m.key}`,old.startsWith(`${m.terrainTag}|`)?old:`${m.terrainTag}|${deflateSync(m.terrain,{level:1}).toString('base64')}`);
  }
  const changes=new Map<string,string|null>();
  for(const [field,value] of current)if(this.stored.get(field)!==value)changes.set(field,value);
  for(const field of this.stored.keys())if(!current.has(field)&&!keep.has(field))changes.set(field,null);
  // Only the clock changed: nothing worth writing.
  const worth=[...changes.keys()].some(field=>field!=='meta')||(changes.has('meta')&&withoutClock(changes.get('meta'))!==withoutClock(this.stored.get('meta')));
  if(worth){for(const [field,value] of changes){if(value===null)this.stored.delete(field);else this.stored.set(field,value);}for(const target of this.targets)for(const [field,value] of changes)target.pending.set(field,value);}
  await Promise.all(this.targets.map(target=>this.flush(target,force,now)));
 }
 private async flush(target:Target,force:boolean,now:number){
  if(target.writing){if(!force)return;await target.writing;}
  if(!target.pending.size||(!force&&now-target.lastAt<target.every))return;
  const batch=target.pending;target.pending=new Map();target.lastAt=now;
  const set=new Map<string,string>(),remove:string[]=[];for(const [field,value] of batch)if(value===null)remove.push(field);else set.set(field,value);
  target.writing=target.backend.write(set,remove).catch(error=>{
   this.report(error);
   // Put the batch back under anything newer so the next write retries it.
   for(const [field,value] of batch)if(!target.pending.has(field))target.pending.set(field,value);
  }).finally(()=>{target.writing=null;});
  await target.writing;
 }
}
const withoutClock=(meta:string|null|undefined)=>meta?meta.replace(/^\{"savedAt":\d+,/,'{'):meta;
