import type pg from 'pg';
import {createHash} from 'node:crypto';
import {attributes} from '../shared/catalog';
import type {Equipment,CharacterGender} from '../shared/catalog';
import {ACHIEVEMENT_BY_ID,DEFAULT_HALL_CONFIG,HALL_CATEGORIES,HALL_PAGE_SIZE,HALL_PERIODS,HALL_SCOPE,LEGEND_BOARDS,normalizeHallConfig,periodLabel,periodOf,rewardFor,topSum,unlockedAchievements,winRate} from '../shared/hall';
import type {GuildBoard,HallAdminMatch,HallAlert,HallBoard,HallCategory,HallClosing,HallConfig,HallGuildProfile,HallLegends,HallPeriod,HallPlayerProfile,HallPvpLine,HallRow,HallTitle,LegendBoard} from '../shared/hall';
import {guildRanks} from '../shared/guilds';
import type {RankingEntry} from '../shared/protocol';
import {insertMail} from './mail';
import {normalizeProfile} from './store';

/**
 * Hall da Fama in Postgres (docs/hall-of-fame.md). Postgres is the source of truth; memory only caches boards for
 * a few seconds.
 * - Poder, Evolução and Conquistas read `player_standings`, refreshed from the saved profile by a trigger queue
 *   (`standings_dirty`): every profile change, from any system, is picked up without touching that system.
 * - PvP keeps one row per official result (`pvp_results`, idempotent by match and player) and adds it to the day,
 *   week and overall totals in the same transaction that saves the battle. `rebuild` recounts them from the results.
 * - A day or week closes once it is over (plus a grace for battles still being saved): final snapshot, champions'
 *   titles and rewards, all in one transaction; rewards are then delivered one by one through the Correio.
 */
export interface MatchRecord {
 matchId:string;
 /** `pvp`: two parties paired by the queue. `gvg`: the same between guilds. `practice`: a training room (bots or not). */
 kind:'pvp'|'gvg'|'practice';
 mode:string;winnerTeam:0|1|null;startedAt:number;
 /** When the battle officially ended (its last blow), which decides the day and week it belongs to. */
 finishedAt:number;
 /** Every human who fought, including who left; bots never appear. */
 participants:{id:string;team:0|1;left:boolean}[];
}
type Db=Pick<pg.PoolClient,'query'>;
type Window={period:'day'|'week';key:string;start:number;end:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_MS=10_000;
const num=(value:unknown)=>Number(value??0)||0;
const iso=(value:unknown)=>new Date(value as string).toISOString();

interface StandingRow {player_id:string;name:string;level:number;xp:string;power:number;gender:CharacterGender;equipment:Equipment;achievement_points:number;achievements:number;guild_id:number|null;guild_name:string|null;}
const playerRow=(r:StandingRow,rank:number,score:number):HallRow=>({rank,id:r.player_id,name:r.name,level:num(r.level),gender:r.gender,equipment:r.equipment,score,power:num(r.power),xp:num(r.xp),
 achievements:num(r.achievements),...(r.guild_id?{guild:r.guild_name!,guildId:num(r.guild_id)}:{})});
const STANDING_COLUMNS=`s.player_id::text AS player_id,s.name,s.level,s.xp,s.power,s.gender,s.equipment,s.achievement_points,s.achievements,g.id AS guild_id,g.name AS guild_name`;
const STANDING_JOIN=`LEFT JOIN guild_members gm ON gm.player_id=s.player_id LEFT JOIN guilds g ON g.id=gm.guild_id`;
/** The PvP order as SQL (shared/hall.ts comparePvp). */
const PVP_ORDER=`t.wins DESC,t.distinct_wins DESC,t.losses ASC,t.reached_at ASC NULLS LAST,t.player_id`;
/** Players strictly ahead of row `m` on the PvP order. */
const PVP_AHEAD=`(o.wins>m.wins OR o.wins=m.wins AND (o.distinct_wins>m.distinct_wins OR o.distinct_wins=m.distinct_wins AND (o.losses<m.losses OR o.losses=m.losses AND
 (coalesce(o.reached_at,'infinity')<coalesce(m.reached_at,'infinity') OR coalesce(o.reached_at,'infinity')=coalesce(m.reached_at,'infinity') AND o.player_id<m.player_id))))`;
const BOARDS={
 power:{order:'s.power DESC,s.level DESC,s.player_id',ahead:'(o.power,o.level)>(m.power,m.level) OR o.power=m.power AND o.level=m.level AND o.player_id<m.player_id',score:(r:StandingRow)=>num(r.power),where:'TRUE'},
 level:{order:'s.level DESC,s.xp DESC,s.player_id',ahead:'(o.level,o.xp)>(m.level,m.xp) OR o.level=m.level AND o.xp=m.xp AND o.player_id<m.player_id',score:(r:StandingRow)=>num(r.level),where:'TRUE'},
 achievements:{order:'s.achievement_points DESC,s.achievements DESC,s.player_id',ahead:'(o.achievement_points,o.achievements)>(m.achievement_points,m.achievements) OR o.achievement_points=m.achievement_points AND o.achievements=m.achievements AND o.player_id<m.player_id',score:(r:StandingRow)=>num(r.achievement_points),where:'s.achievement_points>0'},
} as const;

export class HallStore {
 config:HallConfig=structuredClone(DEFAULT_HALL_CONFIG);
 /** Told which boards changed (the game tells the clients). */
 onChange?:(categories:HallCategory[])=>void;
 /** Told who received a reward letter. */
 onMail?:(playerId:string)=>void;
 private cache=new Map<string,{at:number;value:unknown}>();
 private changes=new Set<HallCategory>();
 private ticking:Promise<void>|null=null;
 constructor(private pool:pg.Pool,private readonly scope=HALL_SCOPE){}

 /** Needs the players, mail and guild tables (Store, MailStore and GuildStore init first). */
 async init(){
  await this.pool.query(`
  CREATE TABLE IF NOT EXISTS hall_config(id int PRIMARY KEY DEFAULT 1 CHECK(id=1),config jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),updated_by varchar(64));
  CREATE TABLE IF NOT EXISTS hall_audit(id bigserial PRIMARY KEY,at timestamptz NOT NULL DEFAULT now(),admin varchar(64),action varchar(32) NOT NULL,detail jsonb NOT NULL DEFAULT '{}');
  CREATE TABLE IF NOT EXISTS player_standings(player_id uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,name varchar(24) NOT NULL,level int NOT NULL,xp bigint NOT NULL,power int NOT NULL,
   gender varchar(8) NOT NULL,equipment jsonb NOT NULL,achievement_points int NOT NULL DEFAULT 0,achievements int NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
  CREATE INDEX IF NOT EXISTS standings_power ON player_standings(power DESC,level DESC,player_id);
  CREATE INDEX IF NOT EXISTS standings_level ON player_standings(level DESC,xp DESC,player_id);
  CREATE INDEX IF NOT EXISTS standings_achievements ON player_standings(achievement_points DESC,achievements DESC,player_id);
  CREATE TABLE IF NOT EXISTS standings_dirty(player_id uuid PRIMARY KEY,at timestamptz NOT NULL DEFAULT now());
  CREATE OR REPLACE FUNCTION hall_mark_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN
    IF TG_OP='DELETE' THEN INSERT INTO standings_dirty(player_id) VALUES(OLD.player_id) ON CONFLICT DO NOTHING;RETURN OLD;END IF;
    IF TG_TABLE_NAME='players' THEN INSERT INTO standings_dirty(player_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
    ELSE INSERT INTO standings_dirty(player_id) VALUES(NEW.player_id) ON CONFLICT DO NOTHING;END IF;
    RETURN NEW;
   END $$;
  DROP TRIGGER IF EXISTS hall_players_dirty ON players;
  CREATE TRIGGER hall_players_dirty AFTER INSERT OR UPDATE OF profile,name ON players FOR EACH ROW EXECUTE FUNCTION hall_mark_dirty();
  DROP TRIGGER IF EXISTS hall_members_dirty ON guild_members;
  CREATE TRIGGER hall_members_dirty AFTER INSERT OR DELETE ON guild_members FOR EACH ROW EXECUTE FUNCTION hall_mark_dirty();
  CREATE TABLE IF NOT EXISTS player_achievements(player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,achievement_id varchar(32) NOT NULL,unlocked_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(player_id,achievement_id));
  CREATE TABLE IF NOT EXISTS pvp_matches(match_id varchar(64) PRIMARY KEY,scope varchar(16) NOT NULL,kind varchar(12) NOT NULL,mode varchar(8) NOT NULL,winner_team smallint,
   started_at timestamptz,finished_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),day_key char(10) NOT NULL,week_key char(10) NOT NULL,roster char(40) NOT NULL,
   eligible boolean NOT NULL,voided_at timestamptz,voided_by varchar(64),void_reason varchar(200));
  CREATE INDEX IF NOT EXISTS pvp_matches_finished ON pvp_matches(scope,finished_at DESC);
  CREATE INDEX IF NOT EXISTS pvp_matches_roster ON pvp_matches(scope,roster,day_key);
  CREATE TABLE IF NOT EXISTS pvp_results(match_id varchar(64) NOT NULL REFERENCES pvp_matches(match_id),player_id uuid NOT NULL,scope varchar(16) NOT NULL,team smallint NOT NULL,
   outcome varchar(4) NOT NULL,left_battle boolean NOT NULL,guild_id int,opponents jsonb NOT NULL,counted boolean NOT NULL,finished_at timestamptz NOT NULL,
   day_key char(10) NOT NULL,week_key char(10) NOT NULL,skip_day boolean NOT NULL DEFAULT false,skip_week boolean NOT NULL DEFAULT false,PRIMARY KEY(match_id,player_id));
  CREATE INDEX IF NOT EXISTS pvp_results_player ON pvp_results(player_id,finished_at DESC);
  CREATE TABLE IF NOT EXISTS pvp_totals(scope varchar(16) NOT NULL,period varchar(4) NOT NULL,period_key char(10) NOT NULL,player_id uuid NOT NULL,wins int NOT NULL DEFAULT 0,losses int NOT NULL DEFAULT 0,
   distinct_wins int NOT NULL DEFAULT 0,reached_at timestamptz,PRIMARY KEY(scope,period,period_key,player_id));
  CREATE INDEX IF NOT EXISTS pvp_totals_rank ON pvp_totals(scope,period,period_key,wins DESC,distinct_wins DESC,losses,reached_at,player_id);
  CREATE TABLE IF NOT EXISTS pvp_beaten(scope varchar(16) NOT NULL,period varchar(4) NOT NULL,period_key char(10) NOT NULL,player_id uuid NOT NULL,opponent_id uuid NOT NULL,PRIMARY KEY(scope,period,period_key,player_id,opponent_id));
  CREATE TABLE IF NOT EXISTS guild_pvp_totals(scope varchar(16) NOT NULL,period varchar(4) NOT NULL,period_key char(10) NOT NULL,guild_id int NOT NULL,player_id uuid NOT NULL,wins int NOT NULL DEFAULT 0,PRIMARY KEY(scope,period,period_key,guild_id,player_id));
  CREATE TABLE IF NOT EXISTS hall_periods(scope varchar(16) NOT NULL,period varchar(4) NOT NULL,period_key char(10) NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
   status varchar(8) NOT NULL DEFAULT 'open',closed_at timestamptz,PRIMARY KEY(scope,period,period_key));
  CREATE INDEX IF NOT EXISTS hall_periods_due ON hall_periods(status,ends_at);
  CREATE TABLE IF NOT EXISTS hall_snapshots(id serial PRIMARY KEY,scope varchar(16) NOT NULL,board varchar(12) NOT NULL,period_key char(10) NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(),rows jsonb NOT NULL,UNIQUE(scope,board,period_key));
  CREATE TABLE IF NOT EXISTS hall_titles(id serial PRIMARY KEY,snapshot_id int NOT NULL REFERENCES hall_snapshots(id),scope varchar(16) NOT NULL,board varchar(12) NOT NULL,period_key char(10) NOT NULL,
   subject_kind varchar(6) NOT NULL,subject_id varchar(64) NOT NULL,name varchar(24) NOT NULL,place smallint NOT NULL,score int NOT NULL,awarded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(snapshot_id,subject_id));
  CREATE INDEX IF NOT EXISTS hall_titles_subject ON hall_titles(subject_kind,subject_id);
  CREATE TABLE IF NOT EXISTS hall_rewards(id serial PRIMARY KEY,snapshot_id int NOT NULL REFERENCES hall_snapshots(id),subject_kind varchar(6) NOT NULL,subject_id varchar(64) NOT NULL,place smallint NOT NULL,
   reward jsonb NOT NULL,status varchar(10) NOT NULL DEFAULT 'pending',mail_id bigint,created_at timestamptz NOT NULL DEFAULT now(),delivered_at timestamptz,UNIQUE(snapshot_id,subject_kind,subject_id));
  CREATE INDEX IF NOT EXISTS hall_rewards_pending ON hall_rewards(status,id);
  CREATE TABLE IF NOT EXISTS hall_alerts(id serial PRIMARY KEY,dedupe varchar(160) NOT NULL UNIQUE,kind varchar(8) NOT NULL,match_id varchar(64),player_ids jsonb NOT NULL,detail jsonb NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(),status varchar(10) NOT NULL DEFAULT 'open',reviewed_by varchar(64),reviewed_at timestamptz);
  CREATE INDEX IF NOT EXISTS hall_alerts_status ON hall_alerts(status,id DESC);
  `);
  await this.loadConfig();
  // Every profile is measured again on start, so a change to the Poder formula reaches the board.
  await this.pool.query('INSERT INTO standings_dirty(player_id) SELECT id FROM players ON CONFLICT DO NOTHING');
 }
 async loadConfig(){const r=await this.pool.query('SELECT config FROM hall_config WHERE id=1');this.config=normalizeHallConfig(r.rows[0]?.config);this.cache.clear();return this.config;}
 async saveConfig(config:HallConfig,admin:string){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');const before=(await c.query('SELECT config FROM hall_config WHERE id=1')).rows[0]?.config??null;
   await c.query('INSERT INTO hall_config(id,config,updated_by) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET config=EXCLUDED.config,updated_at=now(),updated_by=EXCLUDED.updated_by',[config,admin]);
   await this.audit(c,admin,'config',{before,after:config});await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  this.config=normalizeHallConfig(config);this.changed(...HALL_CATEGORIES);return this.config;
 }
 private async audit(db:Db,admin:string|null,action:string,detail:Record<string,unknown>){await db.query('INSERT INTO hall_audit(admin,action,detail) VALUES($1,$2,$3)',[admin,action,detail]);}
 private changed(...categories:HallCategory[]){for(const c of categories)this.changes.add(c);this.cache.clear();}
 private window(period:'day'|'week',at=Date.now()):Window{return periodOf(period,at,this.config.timeZone);}

 // ── Recording a battle ──
 /** Records the official result of one battle inside the transaction that saves it. False if it was already recorded. */
 async record(db:Db,rec:MatchRecord):Promise<boolean>{
  const cfg=this.config,humans=rec.participants.filter(p=>UUID.test(p.id));
  if(!humans.length)return false;
  const day=this.window('day',rec.finishedAt),week=this.window('week',rec.finishedAt),finished=new Date(rec.finishedAt);
  const eligible=rec.kind!=='practice'||cfg.countPractice;
  const roster=createHash('sha1').update(humans.map(p=>p.id).sort().join(',')).digest('hex');
  const inserted=await db.query(`INSERT INTO pvp_matches(match_id,scope,kind,mode,winner_team,started_at,finished_at,day_key,week_key,roster,eligible) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
   ON CONFLICT DO NOTHING RETURNING match_id`,[rec.matchId,this.scope,rec.kind,rec.mode.slice(0,8),rec.winnerTeam,rec.startedAt?new Date(rec.startedAt):null,finished,day.key,week.key,roster,eligible]);
  if(!inserted.rowCount)return false;
  const guildOf=new Map<string,number>((await db.query('SELECT player_id::text AS id,guild_id FROM guild_members WHERE player_id=ANY($1::uuid[])',[humans.map(p=>p.id)])).rows.map(r=>[r.id,num(r.guild_id)]));
  // The closing of a day or week waits for this battle (row lock); a battle saved after its day closed only counts overall.
  const closed:Record<'day'|'week',boolean>={day:false,week:false};
  for(const w of [day,week]){
   await db.query('INSERT INTO hall_periods(scope,period,period_key,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[this.scope,w.period,w.key,new Date(w.start),new Date(w.end)]);
   closed[w.period]=(await db.query('SELECT status FROM hall_periods WHERE scope=$1 AND period=$2 AND period_key=$3 FOR SHARE',[this.scope,w.period,w.key])).rows[0]?.status==='closed';
  }
  for(const p of humans){
   const decided=rec.winnerTeam!==null,won=decided&&p.team===rec.winnerTeam&&!p.left,lost=decided&&p.team!==rec.winnerTeam;
   const outcome=won?'win':lost?'loss':'none',opponents=humans.filter(o=>o.team!==p.team).map(o=>o.id),guild=guildOf.get(p.id)??null;
   await db.query(`INSERT INTO pvp_results(match_id,player_id,scope,team,outcome,left_battle,guild_id,opponents,counted,finished_at,day_key,week_key,skip_day,skip_week)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,[rec.matchId,p.id,this.scope,p.team,outcome,p.left,guild,JSON.stringify(opponents),eligible,finished,day.key,week.key,closed.day,closed.week]);
   if(!eligible||outcome==='none')continue;
   for(const [period,key,skip] of [['day',day.key,closed.day],['week',week.key,closed.week],['all','all',false]] as const){
    if(skip)continue;
    let distinct=0;
    if(won)for(const opponent of opponents)distinct+=(await db.query('INSERT INTO pvp_beaten VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[this.scope,period,key,p.id,opponent])).rowCount??0;
    await db.query(`INSERT INTO pvp_totals(scope,period,period_key,player_id,wins,losses,distinct_wins,reached_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(scope,period,period_key,player_id) DO UPDATE SET wins=pvp_totals.wins+EXCLUDED.wins,losses=pvp_totals.losses+EXCLUDED.losses,distinct_wins=pvp_totals.distinct_wins+EXCLUDED.distinct_wins,
     reached_at=CASE WHEN EXCLUDED.wins>0 THEN greatest(pvp_totals.reached_at,EXCLUDED.reached_at) ELSE pvp_totals.reached_at END`,[this.scope,period,key,p.id,won?1:0,lost?1:0,distinct,won?finished:null]);
    // A guild earns from wins over real opponents only, for the guild the player was in at that moment.
    if(won&&guild&&opponents.length)await db.query(`INSERT INTO guild_pvp_totals VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(scope,period,period_key,guild_id,player_id) DO UPDATE SET wins=guild_pvp_totals.wins+1`,[this.scope,period,key,guild,p.id]);
   }
  }
  await this.alerts(db,rec,humans,day.key,roster,eligible);
  this.changed('pvp','guild','achievements');
  return true;
 }
 /** Review alerts. They only flag battles for the admin; nothing here changes a result. */
 private async alerts(db:Db,rec:MatchRecord,humans:MatchRecord['participants'],dayKey:string,roster:string,eligible:boolean){
  if(!eligible||rec.winnerTeam===null||humans.length<2)return;
  const a=this.config.alerts,ids=humans.map(p=>p.id);
  const flag=(dedupe:string,kind:HallAlert['kind'],players:string[],detail:Record<string,unknown>)=>db.query(`INSERT INTO hall_alerts(dedupe,kind,match_id,player_ids,detail) VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(dedupe) DO UPDATE SET match_id=EXCLUDED.match_id,detail=EXCLUDED.detail`,[dedupe.slice(0,160),kind,rec.matchId,JSON.stringify(players),detail]);
  const pairs=num((await db.query('SELECT count(*) FROM pvp_matches WHERE scope=$1 AND roster=$2 AND day_key=$3 AND eligible AND voided_at IS NULL',[this.scope,roster,dayKey])).rows[0].count);
  if(pairs>=a.pairPerDay)await flag(`pair:${roster}:${dayKey}`,'pair',ids,{battles:pairs,day:dayKey});
  const seconds=rec.startedAt?Math.round((rec.finishedAt-rec.startedAt)/1000):null;
  if(seconds!==null&&seconds<a.shortBattleSeconds)await flag(`short:${rec.matchId}`,'short',ids,{seconds});
  for(const p of humans.filter(h=>h.left)){
   const leaves=num((await db.query('SELECT count(*) FROM pvp_results WHERE player_id=$1 AND day_key=$2 AND left_battle',[p.id,dayKey])).rows[0].count);
   if(leaves>=a.leavesPerDay)await flag(`leaves:${p.id}:${dayKey}`,'leaves',[p.id],{leaves,day:dayKey});
  }
  for(const p of humans.filter(h=>h.team===rec.winnerTeam&&!h.left)){
   const wins=num((await db.query("SELECT count(*) FROM pvp_results WHERE player_id=$1 AND counted AND outcome='win' AND finished_at>$2",[p.id,new Date(rec.finishedAt-3600_000)])).rows[0].count);
   if(wins>=a.winsPerHour)await flag(`rate:${p.id}:${Math.floor(rec.finishedAt/3600_000)}`,'rate',[p.id],{wins});
  }
 }

 // ── Standings (Poder, Evolução, Conquistas) ──
 /** Measures the profiles that changed since the last pass. Returns how many were measured. */
 async refreshStandings(batch=300):Promise<number>{
  const c=await this.pool.connect();let changed:HallCategory[]=[];let count=0;
  try{
   await c.query('BEGIN');
   const ids=(await c.query('DELETE FROM standings_dirty WHERE player_id IN (SELECT player_id FROM standings_dirty ORDER BY at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING player_id::text AS id',[batch])).rows.map(r=>r.id as string);
   if(!ids.length){await c.query('COMMIT');return 0;}
   // One client runs one query at a time.
   const players=await c.query('SELECT id::text AS id,name,profile FROM players WHERE id=ANY($1::uuid[])',[ids]);
   const previous=await c.query('SELECT player_id::text AS id,level,xp,power,achievement_points,name,equipment FROM player_standings WHERE player_id=ANY($1::uuid[])',[ids]);
   const wins=await c.query("SELECT player_id::text AS id,wins FROM pvp_totals WHERE scope=$2 AND period='all' AND player_id=ANY($1::uuid[])",[ids,this.scope]);
   const titles=await c.query("SELECT subject_id AS id,board,count(*)::int AS n FROM hall_titles WHERE subject_kind='player' AND place=1 AND scope=$2 AND subject_id=ANY($1) GROUP BY subject_id,board",[ids,this.scope]);
   const members=await c.query('SELECT player_id::text AS id FROM guild_members WHERE player_id=ANY($1::uuid[])',[ids]);
   const owned=await c.query('SELECT player_id::text AS id,achievement_id FROM player_achievements WHERE player_id=ANY($1::uuid[])',[ids]);
   const before=new Map(previous.rows.map(r=>[r.id as string,r])),winsOf=new Map(wins.rows.map(r=>[r.id as string,num(r.wins)])),inGuild=new Set(members.rows.map(r=>r.id as string));
   const titleCount=(id:string,board:LegendBoard)=>num(titles.rows.find(r=>r.id===id&&r.board===board)?.n);
   const has=new Map<string,Set<string>>();for(const r of owned.rows){const set=has.get(r.id)??new Set<string>();set.add(r.achievement_id);has.set(r.id,set);}
   const categories=new Set<HallCategory>();
   for(const row of players.rows){
    const profile=normalizeProfile({...row.profile,name:row.name}),power=attributes(profile.equipment,profile.level).power;
    const maxForge=Math.max(0,...Object.values(profile.upgrades));
    const unlocked=unlockedAchievements({level:profile.level,power,maxForge,pvpWins:winsOf.get(row.id)??0,inGuild:inGuild.has(row.id),dayTitles:titleCount(row.id,'pvp-day'),weekTitles:titleCount(row.id,'pvp-week')});
    // Achievements are for good: leaving a guild or losing Poder never takes one back.
    const mine=has.get(row.id)??new Set<string>(),fresh=unlocked.filter(id=>!mine.has(id));
    for(const id of fresh){await c.query('INSERT INTO player_achievements(player_id,achievement_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.id,id]);mine.add(id);}
    const known=[...mine].filter(id=>ACHIEVEMENT_BY_ID[id]),points=known.reduce((sum,id)=>sum+ACHIEVEMENT_BY_ID[id].points,0);
    const old=before.get(row.id);
    if(!old||num(old.power)!==power||old.name!==profile.name||JSON.stringify(old.equipment)!==JSON.stringify(profile.equipment)){categories.add('power');categories.add('guild');}
    if(!old||num(old.level)!==profile.level||num(old.xp)!==profile.xp)categories.add('level');
    if(!old||num(old.achievement_points)!==points)categories.add('achievements');
    await c.query(`INSERT INTO player_standings(player_id,name,level,xp,power,gender,equipment,achievement_points,achievements) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(player_id) DO UPDATE SET name=EXCLUDED.name,level=EXCLUDED.level,xp=EXCLUDED.xp,power=EXCLUDED.power,gender=EXCLUDED.gender,equipment=EXCLUDED.equipment,
     achievement_points=EXCLUDED.achievement_points,achievements=EXCLUDED.achievements,updated_at=now()`,[row.id,profile.name,profile.level,profile.xp,power,profile.gender,profile.equipment,points,known.length]);
    count++;
   }
   await c.query('COMMIT');changed=[...categories];
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  if(changed.length)this.changed(...changed);
  return count;
 }

 // ── Closing days and weeks ──
 /** Closes every day and week that ended (after the grace). Safe to run on several processes and after a crash:
  * each period closes in one transaction, and a closed period is never closed again. */
 async closeDue(now=Date.now()):Promise<number>{
  let closed=0;
  for(;;){
   const c=await this.pool.connect();let done=false;
   try{
    await c.query('BEGIN');
    const due=(await c.query(`SELECT period,period_key,starts_at,ends_at FROM hall_periods WHERE scope=$1 AND status='open' AND ends_at<=$2 ORDER BY ends_at,period LIMIT 1 FOR UPDATE SKIP LOCKED`,
     [this.scope,new Date(now-this.config.closeGraceSeconds*1000)])).rows[0];
    if(!due){await c.query('COMMIT');done=true;}
    else{
     const period=due.period as 'day'|'week',key=String(due.period_key);
     await this.closePeriod(c,period,key,due.starts_at,due.ends_at);
     await c.query("UPDATE hall_periods SET status='closed',closed_at=now() WHERE scope=$1 AND period=$2 AND period_key=$3",[this.scope,period,key]);
     await this.audit(c,null,'close',{period,key});
     await c.query('COMMIT');closed++;
    }
   }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   if(done)break;
  }
  if(closed)this.changed('pvp','guild','achievements');
  return closed;
 }
 private async closePeriod(db:Db,period:'day'|'week',key:string,startsAt:Date,endsAt:Date){
  const boards:{board:LegendBoard;kind:'player'|'guild';rows:HallRow[]}[]=[{board:period==='day'?'pvp-day':'pvp-week',kind:'player',rows:await this.pvpRows(db,period,key,this.config.topSize,0)}];
  if(period==='week')boards.push({board:'guild-week',kind:'guild',rows:(await this.guildBoard(db,'pvp',period,key)).slice(0,this.config.topSize)});
  for(const {board,kind,rows} of boards){
   const finals=rows.filter(r=>r.score>0).map(({equipment:_e,crowns:_c,...row})=>row);
   const snapshot=(await db.query('INSERT INTO hall_snapshots(scope,board,period_key,starts_at,ends_at,rows) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[this.scope,board,key,startsAt,endsAt,JSON.stringify(finals)])).rows[0]?.id;
   if(!snapshot)continue;
   for(const row of finals){
    if(row.rank<=3){
     await db.query('INSERT INTO hall_titles(snapshot_id,scope,board,period_key,subject_kind,subject_id,name,place,score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING',[snapshot,this.scope,board,key,kind,row.id,row.name.slice(0,24),row.rank,row.score]);
     if(kind==='player')await db.query('INSERT INTO standings_dirty(player_id) VALUES($1) ON CONFLICT DO NOTHING',[row.id]);
    }
    const tier=rewardFor(this.config.rewards[board],row.rank);
    if(tier&&(tier.gold>0||tier.coupons>0||(tier.riqueza??0)>0))await db.query('INSERT INTO hall_rewards(snapshot_id,subject_kind,subject_id,place,reward) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[snapshot,kind,row.id,row.rank,{...tier,board,key,name:row.name}]);
   }
  }
 }
 /** Hands out pending rewards, each in its own transaction with its letter, so none is paid twice. */
 async deliverRewards(limit=50):Promise<string[]>{
  const mailed:string[]=[];
  for(let i=0;i<limit;i++){
   const c=await this.pool.connect();let done=false;
   try{
    await c.query('BEGIN');
    const r=(await c.query("SELECT * FROM hall_rewards WHERE status='pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
    if(!r){await c.query('COMMIT');done=true;}
    else{
     const reward=r.reward as {gold:number;coupons:number;riqueza?:number;board:LegendBoard;key:string;name:string};
     const what=`${r.place}º lugar · ${reward.board==='pvp-day'?'PvP diário':reward.board==='pvp-week'?'PvP semanal':'Guildas semanal'} (${periodLabel(reward.board==='pvp-day'?'day':'week',reward.key)})`;
     let status='skipped',mail:number|null=null;
     if(r.subject_kind==='player'){
      if((await c.query('SELECT 1 FROM players WHERE id=$1',[r.subject_id])).rowCount){
       const attachments=[...(reward.gold>0?[{kind:'coins' as const,amount:reward.gold}]:[]),...(reward.coupons>0?[{kind:'coupons' as const,amount:reward.coupons}]:[])];
       mail=await insertMail(c,{playerId:r.subject_id,sender:'Hall da Fama',subject:`Recompensa do Hall da Fama: ${r.place}º lugar`.slice(0,60),body:`Parabéns! Você terminou em ${what}. Sua conquista ficou registrada nas Lendas do Hall da Fama.`,attachments,createdBy:'hall-da-fama'});
       status='delivered';
      }
     }else if((reward.riqueza??0)>0&&(await c.query('UPDATE guilds SET riqueza=riqueza+$2 WHERE id=$1',[Number(r.subject_id),reward.riqueza])).rowCount)status='delivered';
     await c.query('UPDATE hall_rewards SET status=$2,mail_id=$3,delivered_at=now() WHERE id=$1',[r.id,status,mail]);
     await c.query('COMMIT');if(mail)mailed.push(r.subject_id);
    }
   }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
   if(done)break;
  }
  return mailed;
 }
 /** One background pass: standings, closings, rewards, then tells who changed. Never runs twice at once. */
 tick(now=Date.now()):Promise<void>{
  if(this.ticking)return this.ticking;
  this.ticking=(async()=>{
   for(let i=0;i<20&&await this.refreshStandings()>0;i++);
   await this.closeDue(now);
   for(const id of await this.deliverRewards())this.onMail?.(id);
   if(this.changes.size){const categories=[...this.changes];this.changes.clear();this.onChange?.(categories);}
  })().finally(()=>{this.ticking=null;});
  return this.ticking;
 }

 // ── Boards ──
 private cached<T>(key:string,load:()=>Promise<T>):Promise<T>{
  const hit=this.cache.get(key);if(hit&&Date.now()-hit.at<CACHE_MS)return Promise.resolve(hit.value as T);
  return load().then(value=>{this.cache.set(key,{at:Date.now(),value});return value;});
 }
 /** Top PvP rows of a period, in order, with the current name, guild and look. */
 private async pvpRows(db:Db,period:HallPeriod,key:string,limit:number,offset:number):Promise<HallRow[]>{
  const r=await db.query(`SELECT ${STANDING_COLUMNS},t.wins,t.losses,t.distinct_wins FROM pvp_totals t JOIN player_standings s ON s.player_id=t.player_id ${STANDING_JOIN}
   WHERE t.scope=$1 AND t.period=$2 AND t.period_key=$3 ORDER BY ${PVP_ORDER} LIMIT $4 OFFSET $5`,[this.scope,period,key,limit,offset]);
  const streaks=await this.streaks(db,r.rows.map(row=>row.player_id));
  return r.rows.map((row,i)=>({...playerRow(row,offset+i+1,num(row.wins)),wins:num(row.wins),losses:num(row.losses),distinctWins:num(row.distinct_wins),winRate:winRate(num(row.wins),num(row.losses)),streak:streaks.get(row.player_id)??0}));
 }
 /** Current win streak: wins since the last counted loss. */
 private async streaks(db:Db,ids:string[]){
  if(!ids.length)return new Map<string,number>();
  const r=await db.query(`SELECT r.player_id::text AS id,count(*)::int AS n FROM pvp_results r WHERE r.player_id=ANY($1::uuid[]) AND r.scope=$2 AND r.counted AND r.outcome='win'
   AND r.finished_at>coalesce((SELECT max(l.finished_at) FROM pvp_results l WHERE l.player_id=r.player_id AND l.scope=$2 AND l.counted AND l.outcome='loss'),'-infinity') GROUP BY r.player_id`,[ids,this.scope]);
  return new Map(r.rows.map(row=>[row.id as string,num(row.n)]));
 }
 private async pvpMine(db:Db,period:HallPeriod,key:string,playerId:string):Promise<HallRow|null>{
  const r=(await db.query(`SELECT ${STANDING_COLUMNS},m.wins,m.losses,m.distinct_wins,(SELECT count(*) FROM pvp_totals o WHERE o.scope=m.scope AND o.period=m.period AND o.period_key=m.period_key AND ${PVP_AHEAD})::int+1 AS rank
   FROM pvp_totals m JOIN player_standings s ON s.player_id=m.player_id ${STANDING_JOIN} WHERE m.scope=$1 AND m.period=$2 AND m.period_key=$3 AND m.player_id=$4`,[this.scope,period,key,playerId])).rows[0];
  if(!r)return null;const streak=(await this.streaks(db,[playerId])).get(playerId)??0;
  return {...playerRow(r,num(r.rank),num(r.wins)),wins:num(r.wins),losses:num(r.losses),distinctWins:num(r.distinct_wins),winRate:winRate(num(r.wins),num(r.losses)),streak};
 }
 private async standingRows(db:Db,board:keyof typeof BOARDS,limit:number,offset:number){
  const b=BOARDS[board];
  const r=await db.query(`SELECT ${STANDING_COLUMNS} FROM player_standings s ${STANDING_JOIN} WHERE ${b.where} ORDER BY ${b.order} LIMIT $1 OFFSET $2`,[limit,offset]);
  return r.rows.map((row,i)=>playerRow(row,offset+i+1,b.score(row)));
 }
 private async standingMine(db:Db,board:keyof typeof BOARDS,playerId:string):Promise<HallRow|null>{
  const b=BOARDS[board];
  const r=(await db.query(`SELECT ${STANDING_COLUMNS},(SELECT count(*) FROM player_standings o WHERE ${b.where.replaceAll('s.','o.')} AND (${b.ahead}))::int+1 AS rank
   FROM player_standings m JOIN player_standings s ON s.player_id=m.player_id ${STANDING_JOIN} WHERE m.player_id=$1`,[playerId])).rows[0];
  if(!r)return null;const ranked=board!=='achievements'||num(r.achievement_points)>0;
  return playerRow(r,ranked?num(r.rank):0,b.score(r));
 }
 /** Every guild of one board, ranked (guild boards are small: whole lists, cached). */
 private async guildBoard(db:Db,board:GuildBoard,period:HallPeriod,key:string):Promise<HallRow[]>{
  const guilds=(await db.query(`SELECT g.id,g.name,g.level,g.riqueza,p.name AS leader,(SELECT count(*) FROM guild_members m WHERE m.guild_id=g.id)::int AS members FROM guilds g JOIN players p ON p.id=g.owner_id`)).rows;
  const score=new Map<number,number>(),extra=new Map<number,Partial<HallRow>>();
  if(board==='power'){
   const r=await db.query('SELECT gm.guild_id,s.power FROM guild_members gm JOIN player_standings s ON s.player_id=gm.player_id');
   const powers=new Map<number,number[]>();for(const row of r.rows){const list=powers.get(num(row.guild_id))??[];list.push(num(row.power));powers.set(num(row.guild_id),list);}
   for(const [id,list] of powers)score.set(id,topSum(list,this.config.guildPowerMembers));
  }else if(board==='pvp'){
   const r=await db.query('SELECT guild_id,wins FROM guild_pvp_totals WHERE scope=$1 AND period=$2 AND period_key=$3',[this.scope,period,key]);
   const wins=new Map<number,number[]>();for(const row of r.rows){const list=wins.get(num(row.guild_id))??[];list.push(num(row.wins));wins.set(num(row.guild_id),list);}
   for(const [id,list] of wins){score.set(id,topSum(list,this.config.guildPvpContributors));extra.set(id,{wins:list.reduce((a,b)=>a+b,0)});}
  }else if(board==='gvg'){
   const bounds=period==='all'?null:this.window(period);
   const r=await db.query(`SELECT guild_id,count(*)::int AS n FROM guild_gvg ${bounds?'WHERE created_at>=$1 AND created_at<$2':''} GROUP BY guild_id`,bounds?[new Date(bounds.start),new Date(bounds.end)]:[]);
   for(const row of r.rows)score.set(num(row.guild_id),num(row.n));
  }else for(const g of guilds)score.set(num(g.id),num(g.level));
  const rows=guilds.filter(g=>board==='level'||(score.get(num(g.id))??0)>0).map(g=>({id:String(g.id),name:g.name as string,level:num(g.level),leader:g.leader as string,members:num(g.members),riqueza:num(g.riqueza),score:score.get(num(g.id))??0,...extra.get(num(g.id))}));
  rows.sort((a,b)=>b.score-a.score||(board==='level'?b.riqueza-a.riqueza:0)||num(a.id)-num(b.id));
  return rows.map((row,i)=>({...row,rank:i+1}));
 }
 private periodKey(period:HallPeriod){return period==='all'?'all':this.window(period).key;}
 /** Titles still in force: the top 3 of the last closed day and week. */
 private crowns(){
  return this.cached('crowns',async()=>{
   const r=await this.pool.query(`SELECT t.subject_id,t.board,t.place FROM hall_titles t JOIN (SELECT DISTINCT ON (board) id FROM hall_snapshots WHERE scope=$1 ORDER BY board,period_key DESC) last ON last.id=t.snapshot_id`,[this.scope]);
   const map=new Map<string,NonNullable<HallRow['crowns']>>();for(const row of r.rows){const list=map.get(row.subject_id)??[];list.push({board:row.board,place:row.place});map.set(row.subject_id,list);}
   return map;
  });
 }
 async board(viewerId:string,q:{category:HallCategory;period?:HallPeriod;board?:GuildBoard;page?:number}):Promise<HallBoard>{
  const cfg=this.config,category=q.category,page=Math.max(1,q.page??1),top=cfg.topSize,pageCount=(total:number)=>Math.max(1,Math.ceil(Math.min(total,top)/HALL_PAGE_SIZE));
  const board=category==='guild'?q.board??'power':undefined;
  const period:HallPeriod=category==='pvp'||category==='guild'&&(board==='pvp'||board==='gvg')?q.period??(category==='pvp'?'day':'week'):'all';
  const base={category,period,...(board?{board}:{}),topSize:top,updatedAt:Date.now(),...(period!=='all'?{endsAt:this.window(period).end,periodKey:this.window(period).key}:{})};
  if(!cfg.categories[category])return {...base,rows:[],page:1,pages:1,total:0,me:null,disabled:true};
  const offset=(page-1)*HALL_PAGE_SIZE,limit=Math.max(0,Math.min(HALL_PAGE_SIZE,top-offset)),key=this.periodKey(period);
  const crowns=await this.crowns(),crown=(row:HallRow)=>crowns.get(row.id)?{...row,crowns:crowns.get(row.id)}:row;
  if(category==='guild'){
   const all=await this.cached(`guild:${board}:${period}:${key}`,()=>this.guildBoard(this.pool,board!,period,key));
   const mine=(await this.pool.query('SELECT guild_id FROM guild_members WHERE player_id=$1',[viewerId])).rows[0]?.guild_id;
   const note=board==='power'?`Soma do Poder dos ${cfg.guildPowerMembers} membros mais fortes.`:board==='pvp'?`Soma das vitórias PvP dos ${cfg.guildPvpContributors} maiores contribuidores. Vitórias contra bots não contam.`:board==='gvg'?'Vitórias em batalhas GvG.':'Nível da guilda; empate pela Riqueza.';
   return {...base,rows:all.slice(offset,offset+limit).map(crown),page,pages:pageCount(all.length),total:all.length,me:mine?all.find(r=>r.id===String(mine))??null:null,note};
  }
  if(category==='pvp'){
   const {rows,total}=await this.cached(`pvp:${period}:${key}:${page}`,async()=>({rows:await this.pvpRows(this.pool,period,key,limit,offset),total:num((await this.pool.query('SELECT count(*) FROM pvp_totals WHERE scope=$1 AND period=$2 AND period_key=$3',[this.scope,period,key])).rows[0].count)}));
   const me=await this.pvpMine(this.pool,period,key,viewerId)??await this.blankMine(viewerId);
   return {...base,rows:rows.map(crown),page,pages:pageCount(total),total,me};
  }
  const kind=category as keyof typeof BOARDS;
  const {rows,total}=await this.cached(`${kind}:${page}`,async()=>({rows:await this.standingRows(this.pool,kind,limit,offset),total:num((await this.pool.query(`SELECT count(*) FROM player_standings s WHERE ${BOARDS[kind].where}`)).rows[0].count)}));
  return {...base,rows:rows.map(crown),page,pages:pageCount(total),total,me:await this.standingMine(this.pool,kind,viewerId)};
 }
 /** The viewer with no result yet in this period. */
 private async blankMine(playerId:string):Promise<HallRow|null>{
  const r=(await this.pool.query(`SELECT ${STANDING_COLUMNS} FROM player_standings s ${STANDING_JOIN} WHERE s.player_id=$1`,[playerId])).rows[0];
  return r?{...playerRow(r,0,0),wins:0,losses:0,winRate:0,streak:0}:null;
 }
 /** Today's top three for the lobby podium. */
 async podium():Promise<RankingEntry[]>{
  if(!this.config.categories.pvp)return [];
  const rows=await this.pvpRows(this.pool,'day',this.window('day').key,3,0);
  return rows.filter(r=>(r.wins??0)>0).map(r=>({rank:r.rank as 1|2|3,id:r.id,name:r.name,level:r.level??1,wins:r.wins??0,equipment:r.equipment!}));
 }

 // ── Profiles ──
 async profile(playerId:string):Promise<HallPlayerProfile|null>{
  let s=(await this.pool.query(`SELECT ${STANDING_COLUMNS} FROM player_standings s ${STANDING_JOIN} WHERE s.player_id=$1`,[playerId])).rows[0];
  if(!s){
   if(!(await this.pool.query('SELECT 1 FROM players WHERE id=$1',[playerId])).rowCount)return null;
   await this.pool.query('INSERT INTO standings_dirty(player_id) VALUES($1) ON CONFLICT DO NOTHING',[playerId]);await this.refreshStandings();
   s=(await this.pool.query(`SELECT ${STANDING_COLUMNS} FROM player_standings s ${STANDING_JOIN} WHERE s.player_id=$1`,[playerId])).rows[0];if(!s)return null;
  }
  const pvp={} as Record<HallPeriod,HallPvpLine>;
  for(const period of HALL_PERIODS){
   const mine=await this.pvpMine(this.pool,period,this.periodKey(period),playerId);
   pvp[period]={wins:mine?.wins??0,losses:mine?.losses??0,battles:(mine?.wins??0)+(mine?.losses??0),winRate:mine?.winRate??0,rank:mine?mine.rank:null};
  }
  const [power,level,achievementsRank]=await Promise.all([this.standingMine(this.pool,'power',playerId),this.standingMine(this.pool,'level',playerId),this.standingMine(this.pool,'achievements',playerId)]);
  const titles=await this.titles('player',playerId),counts=titleCounts(titles);
  const achievements=(await this.pool.query('SELECT achievement_id,unlocked_at FROM player_achievements WHERE player_id=$1 ORDER BY unlocked_at',[playerId])).rows.filter(r=>ACHIEVEMENT_BY_ID[r.achievement_id]).map(r=>({id:r.achievement_id as string,unlockedAt:iso(r.unlocked_at)}));
  return {id:s.player_id,name:s.name,level:num(s.level),xp:num(s.xp),power:num(s.power),gender:s.gender,equipment:s.equipment,...(s.guild_id?{guild:{id:num(s.guild_id),name:s.guild_name}}:{}),
   ranks:{power:power?.rank||null,level:level?.rank||null,achievements:achievementsRank?.rank||null},pvp,streak:(await this.streaks(this.pool,[playerId])).get(playerId)??0,
   titleCounts:counts,titles:titles.slice(0,30),achievements,points:num(s.achievement_points)};
 }
 private async titles(kind:'player'|'guild',id:string):Promise<HallTitle[]>{
  const r=await this.pool.query('SELECT board,place,period_key,score,name,awarded_at FROM hall_titles WHERE subject_kind=$1 AND subject_id=$2 AND scope=$3 ORDER BY period_key DESC,board',[kind,id,this.scope]);
  return r.rows.map(row=>({board:row.board,place:row.place,periodKey:String(row.period_key),score:num(row.score),name:row.name,awardedAt:iso(row.awarded_at)}));
 }
 async guildProfile(guildId:number):Promise<HallGuildProfile|null>{
  const g=(await this.pool.query('SELECT g.*,p.name AS leader FROM guilds g JOIN players p ON p.id=g.owner_id WHERE g.id=$1',[guildId])).rows[0];if(!g)return null;
  const ranks=guildRanks(g.ranks),week=this.window('week').key;
  const members=(await this.pool.query(`SELECT gm.player_id::text AS id,coalesce(s.name,p.name) AS name,coalesce(s.level,1) AS level,coalesce(s.power,0) AS power,gm.rank,
   coalesce((SELECT wins FROM guild_pvp_totals t WHERE t.scope=$2 AND t.period='week' AND t.period_key=$3 AND t.guild_id=gm.guild_id AND t.player_id=gm.player_id),0) AS week_wins,
   coalesce((SELECT wins FROM guild_pvp_totals t WHERE t.scope=$2 AND t.period='all' AND t.period_key='all' AND t.guild_id=gm.guild_id AND t.player_id=gm.player_id),0) AS total_wins
   FROM guild_members gm JOIN players p ON p.id=gm.player_id LEFT JOIN player_standings s ON s.player_id=gm.player_id WHERE gm.guild_id=$1 ORDER BY gm.rank,s.power DESC NULLS LAST`,[guildId,this.scope,week])).rows
   .map(m=>({id:m.id,name:m.name,level:num(m.level),power:num(m.power),rank:num(m.rank),rankName:ranks.find(r=>r.id===num(m.rank))?.name??'Membro',weekWins:num(m.week_wins),totalWins:num(m.total_wins)}));
  const contributors=async(period:HallPeriod,key:string)=>(await this.pool.query(`SELECT t.player_id::text AS id,coalesce(s.name,p.name,'—') AS name,t.wins FROM guild_pvp_totals t LEFT JOIN players p ON p.id=t.player_id LEFT JOIN player_standings s ON s.player_id=t.player_id
   WHERE t.scope=$1 AND t.period=$2 AND t.period_key=$3 AND t.guild_id=$4 ORDER BY t.wins DESC,t.player_id LIMIT 5`,[this.scope,period,key,guildId])).rows.map(r=>({id:r.id,name:r.name,wins:num(r.wins)}));
  const find=async(board:GuildBoard,period:HallPeriod)=>{const key=this.periodKey(period);return (await this.cached(`guild:${board}:${period}:${key}`,()=>this.guildBoard(this.pool,board,period,key))).find(r=>r.id===String(guildId));};
  const [power,pvpWeek,pvpAll]=await Promise.all([find('power','all'),find('pvp','week'),find('pvp','all')]);
  const totalWins=num((await this.pool.query("SELECT sum(wins) AS n FROM guild_pvp_totals WHERE scope=$1 AND period='all' AND guild_id=$2",[this.scope,guildId])).rows[0].n);
  const gvgWins=num((await this.pool.query('SELECT count(*) FROM guild_gvg WHERE guild_id=$1',[guildId])).rows[0].count);
  return {id:num(g.id),name:g.name,level:num(g.level),riqueza:num(g.riqueza),leader:g.leader,viceLeaders:members.filter(m=>m.rank===1).map(m=>m.name),members,
   power:power?.score??0,powerRank:power?.rank??null,pvp:{week:{score:pvpWeek?.score??0,rank:pvpWeek?.rank??null},all:{score:pvpAll?.score??0,rank:pvpAll?.rank??null}},
   totalWins,gvgWins,contributors:{week:await contributors('week',week),all:await contributors('all','all')},titles:await this.titles('guild',String(guildId)),
   guildPowerMembers:this.config.guildPowerMembers,guildPvpContributors:this.config.guildPvpContributors};
 }
 async legends(board:LegendBoard,key?:string):Promise<HallLegends>{
  const periods=(await this.pool.query('SELECT period_key,created_at FROM hall_snapshots WHERE scope=$1 AND board=$2 ORDER BY period_key DESC LIMIT 60',[this.scope,board])).rows
   .map(r=>({key:String(r.period_key),label:periodLabel(board==='pvp-day'?'day':'week',String(r.period_key)),closedAt:iso(r.created_at)}));
  const chosen=key&&periods.some(p=>p.key===key)?key:periods[0]?.key??null;
  const rows=chosen?(await this.pool.query('SELECT rows FROM hall_snapshots WHERE scope=$1 AND board=$2 AND period_key=$3',[this.scope,board,chosen])).rows[0]?.rows??[]:[];
  const leaders=(await this.pool.query(`SELECT subject_id AS id,(array_agg(name ORDER BY awarded_at DESC))[1] AS name,count(*) FILTER (WHERE place=1)::int AS first,count(*) FILTER (WHERE place=2)::int AS second,count(*) FILTER (WHERE place=3)::int AS third
   FROM hall_titles WHERE scope=$1 AND board=$2 GROUP BY subject_id ORDER BY first DESC,second DESC,third DESC,id LIMIT 10`,[this.scope,board])).rows.map(r=>({id:r.id,name:r.name,first:num(r.first),second:num(r.second),third:num(r.third)}));
  return {board,periods,key:chosen,rows,leaders};
 }

 // ── Admin ──
 async alertList(status:'open'|'all'):Promise<HallAlert[]>{
  const r=await this.pool.query(`SELECT a.*,(SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) FROM players p WHERE p.id::text IN (SELECT jsonb_array_elements_text(a.player_ids))) AS players
   FROM hall_alerts a ${status==='open'?"WHERE status='open'":''} ORDER BY id DESC LIMIT 200`);
  return r.rows.map(a=>({id:a.id,kind:a.kind,matchId:a.match_id,players:a.players??[],detail:a.detail,createdAt:iso(a.created_at),status:a.status,reviewedBy:a.reviewed_by}));
 }
 async setAlert(id:number,status:'open'|'dismissed',admin:string){
  const r=await this.pool.query('UPDATE hall_alerts SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1',[id,status,admin]);
  if(r.rowCount)await this.audit(this.pool,admin,'alert',{id,status});return !!r.rowCount;
 }
 async matchList(opts:{playerId?:string;page?:number}):Promise<{matches:HallAdminMatch[];page:number}>{
  const page=Math.max(0,opts.page??0),player=opts.playerId&&UUID.test(opts.playerId)?opts.playerId:null;
  const m=await this.pool.query(`SELECT * FROM pvp_matches m WHERE scope=$1 ${player?'AND EXISTS(SELECT 1 FROM pvp_results r WHERE r.match_id=m.match_id AND r.player_id=$4)':''} ORDER BY finished_at DESC LIMIT $2 OFFSET $3`,
   player?[this.scope,30,page*30,player]:[this.scope,30,page*30]);
  const ids=m.rows.map(r=>r.match_id);
  const results=ids.length?(await this.pool.query('SELECT r.*,p.name,g.name AS guild FROM pvp_results r LEFT JOIN players p ON p.id=r.player_id LEFT JOIN guilds g ON g.id=r.guild_id WHERE r.match_id=ANY($1) ORDER BY r.team',[ids])).rows:[];
  return {page,matches:m.rows.map(r=>({id:r.match_id,kind:r.kind,mode:r.mode,finishedAt:iso(r.finished_at),startedAt:r.started_at?iso(r.started_at):null,winnerTeam:r.winner_team,counted:r.eligible&&!r.voided_at,voidedAt:r.voided_at?iso(r.voided_at):null,voidedBy:r.voided_by,voidReason:r.void_reason,
   players:results.filter(p=>p.match_id===r.match_id).map(p=>({id:p.player_id,name:p.name??'—',team:p.team,outcome:p.outcome,left:p.left_battle,guild:p.guild??null}))}))};
 }
 /** Takes a battle out of every board (or puts it back) and recounts the players in it. Closed days and weeks keep
  * their official result; the change shows on the open boards and the overall one. */
 async voidMatch(matchId:string,reason:string,admin:string,restore=false){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');
   const m=(await c.query('SELECT * FROM pvp_matches WHERE match_id=$1 FOR UPDATE',[matchId])).rows[0];if(!m)throw Error('Batalha não encontrada.');
   if(restore?!m.voided_at:m.voided_at)throw Error(restore?'Esta batalha não foi excluída.':'Esta batalha já foi excluída.');
   await c.query('UPDATE pvp_matches SET voided_at=$2,voided_by=$3,void_reason=$4 WHERE match_id=$1',[matchId,restore?null:new Date(),restore?null:admin,restore?null:reason]);
   await c.query('UPDATE pvp_results SET counted=$2 WHERE match_id=$1',[matchId,restore?m.eligible:false]);
   const players=(await c.query('SELECT player_id::text AS id FROM pvp_results WHERE match_id=$1',[matchId])).rows.map(r=>r.id as string);
   await this.recount(c,players);
   if(!restore)await c.query("UPDATE hall_alerts SET status='voided',reviewed_by=$2,reviewed_at=now() WHERE match_id=$1 AND status='open'",[matchId,admin]);
   for(const id of players)await c.query('INSERT INTO standings_dirty(player_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   await this.audit(c,admin,restore?'restore':'void',{matchId,reason,players});
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  this.changed('pvp','guild','achievements');
 }
 /** Recounts every PvP total from the recorded results (all players, or only these). */
 async rebuild(admin:string,players?:string[]){
  const c=await this.pool.connect();try{
   await c.query('BEGIN');await this.recount(c,players);await this.audit(c,admin,'rebuild',{players:players?.length??'all'});await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  this.changed('pvp','guild');
 }
 private async recount(db:Db,players?:string[]){
  const only=players?'AND player_id=ANY($2::uuid[])':'',onlyR=players?'AND r.player_id=ANY($2::uuid[])':'',args=players?[this.scope,players]:[this.scope];
  const windows=`CROSS JOIN LATERAL (VALUES ('day',r.day_key,r.skip_day),('week',r.week_key,r.skip_week),('all','all',false)) x(period,period_key,skip)`;
  await db.query(`DELETE FROM pvp_totals WHERE scope=$1 ${only}`,args);
  await db.query(`DELETE FROM pvp_beaten WHERE scope=$1 ${only}`,args);
  await db.query(`DELETE FROM guild_pvp_totals WHERE scope=$1 ${only}`,args);
  await db.query(`INSERT INTO pvp_beaten SELECT DISTINCT r.scope,x.period,x.period_key,r.player_id,o.id::uuid FROM pvp_results r ${windows} CROSS JOIN LATERAL jsonb_array_elements_text(r.opponents) o(id)
   WHERE r.scope=$1 AND r.counted AND r.outcome='win' AND NOT x.skip ${onlyR}`,args);
  await db.query(`INSERT INTO pvp_totals(scope,period,period_key,player_id,wins,losses,distinct_wins,reached_at)
   SELECT r.scope,x.period,x.period_key,r.player_id,count(*) FILTER (WHERE r.outcome='win'),count(*) FILTER (WHERE r.outcome='loss'),
    (SELECT count(*) FROM pvp_beaten b WHERE b.scope=r.scope AND b.period=x.period AND b.period_key=x.period_key AND b.player_id=r.player_id),max(r.finished_at) FILTER (WHERE r.outcome='win')
   FROM pvp_results r ${windows} WHERE r.scope=$1 AND r.counted AND r.outcome<>'none' AND NOT x.skip ${onlyR} GROUP BY r.scope,x.period,x.period_key,r.player_id`,args);
  await db.query(`INSERT INTO guild_pvp_totals SELECT r.scope,x.period,x.period_key,r.guild_id,r.player_id,count(*) FROM pvp_results r ${windows}
   WHERE r.scope=$1 AND r.counted AND r.outcome='win' AND r.guild_id IS NOT NULL AND jsonb_array_length(r.opponents)>0 AND NOT x.skip ${onlyR} GROUP BY r.scope,x.period,x.period_key,r.guild_id,r.player_id`,args);
 }
 async closings():Promise<HallClosing[]>{
  const r=await this.pool.query(`SELECT s.board,s.period_key,s.created_at,jsonb_array_length(s.rows) AS n,count(w.id) FILTER (WHERE w.status='pending')::int AS pending,count(w.id) FILTER (WHERE w.status='delivered')::int AS delivered
   FROM hall_snapshots s LEFT JOIN hall_rewards w ON w.snapshot_id=s.id WHERE s.scope=$1 GROUP BY s.id ORDER BY s.created_at DESC LIMIT 60`,[this.scope]);
  return r.rows.map(row=>({board:row.board,key:String(row.period_key),closedAt:iso(row.created_at),rows:num(row.n),rewards:{pending:num(row.pending),delivered:num(row.delivered)}}));
 }
 async auditLog(){return (await this.pool.query('SELECT at,admin,action,detail FROM hall_audit ORDER BY id DESC LIMIT 50')).rows.map(r=>({at:iso(r.at),admin:r.admin,action:r.action,detail:r.detail}));}
}
const titleCounts=(titles:HallTitle[])=>Object.fromEntries(LEGEND_BOARDS.map(board=>[board,{1:titles.filter(t=>t.board===board&&t.place===1).length,2:titles.filter(t=>t.board===board&&t.place===2).length,3:titles.filter(t=>t.board===board&&t.place===3).length}])) as HallPlayerProfile['titleCounts'];
