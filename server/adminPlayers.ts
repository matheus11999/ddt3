import type pg from 'pg';
import {normalizeProfile} from './store';
import {PLAYER_LIST_PAGE,PLAYER_SORTS} from '../shared/adminPlayers';
import type {AdminPlayerDetail,AdminPlayerRow,PlayerPresence,PlayerSort} from '../shared/adminPlayers';

/** Columns the player table can sort by (whitelisted SQL, never built from the request). */
const ORDER:Record<PlayerSort,string>={
 created:'created_at DESC',name:'lower(name) ASC',level:`(profile->>'level')::int DESC NULLS LAST,(profile->>'xp')::bigint DESC NULLS LAST`,
 gold:`(profile->>'gold')::bigint DESC NULLS LAST`,wins:`(profile->>'wins')::int DESC NULLS LAST`,matches:`(profile->>'matches')::int DESC NULLS LAST`,
};

/** Players for the admin panel (/admin/jogadores): the table and one player's details. */
export class PlayerDirectory {
 constructor(private pool:pg.Pool){}
 private row(row:Record<string,unknown>,presence:ReadonlyMap<string,PlayerPresence>):AdminPlayerRow{
  const p=normalizeProfile({...(row.profile as object),id:row.id as string,name:row.name as string});
  const stones=Object.values(p.stones).reduce((a,b)=>a+b,0);
  return {id:p.id,name:p.name,gender:p.gender,level:p.level,xp:p.xp,gold:p.gold,coupons:p.coupons,wins:p.wins,matches:p.matches,colorTickets:p.colorTickets,stones,items:p.inventory.length,
   createdAt:new Date(row.created_at as string).toISOString(),presence:presence.get(p.id)??'offline'};
 }
 async list(query:{search?:string;online?:boolean;sort?:string;page?:number},presence:ReadonlyMap<string,PlayerPresence>){
  const sort=(PLAYER_SORTS as readonly string[]).includes(query.sort??'')?query.sort as PlayerSort:'created';
  const page=Math.max(0,Math.floor(query.page??0)),where:string[]=[],values:unknown[]=[];
  const search=query.search?.trim().slice(0,40);
  if(search){
   values.push(`%${search.replace(/[\\%_]/g,m=>`\\${m}`)}%`);
   if(/^[0-9a-f-]{36}$/i.test(search)){values.push(search.toLowerCase());where.push(`(name ILIKE $${values.length-1} OR id::text=$${values.length})`);}
   else where.push(`name ILIKE $${values.length}`);
  }
  if(query.online){values.push([...presence.keys()]);where.push(`id=ANY($${values.length}::uuid[])`);}
  const filter=where.length?`WHERE ${where.join(' AND ')}`:'';
  const total=await this.pool.query(`SELECT count(*)::int AS n FROM players ${filter}`,values);
  const rows=await this.pool.query(`SELECT id,name,profile,created_at FROM players ${filter} ORDER BY ${ORDER[sort]},id LIMIT ${PLAYER_LIST_PAGE} OFFSET ${page*PLAYER_LIST_PAGE}`,values);
  const all=await this.pool.query('SELECT count(*)::int AS n FROM players');
  return {players:rows.rows.map(row=>this.row(row,presence)),total:total.rows[0].n as number,page,pageSize:PLAYER_LIST_PAGE,online:presence.size,registered:all.rows[0].n as number};
 }
 async get(id:string,presence:ReadonlyMap<string,PlayerPresence>):Promise<AdminPlayerDetail|null>{
  const r=await this.pool.query('SELECT id,name,profile,created_at FROM players WHERE id=$1',[id]);const row=r.rows[0];if(!row)return null;
  const p=normalizeProfile({...row.profile,id:row.id,name:row.name});
  return {...this.row(row,presence),inventory:p.inventory,upgrades:p.upgrades,stoneStacks:p.stones,compositionStones:p.compositionStones,equipment:p.equipment};
 }
}
