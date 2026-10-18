import {z} from 'zod';
import type {Equipment,CharacterGender} from './catalog';

/**
 * Hall da Fama (docs/hall-of-fame.md). Five boards, all computed by the server from what really happened:
 * Poder (the gearscore of shared/catalog.ts `attributes().power`), PvP (official battle results only),
 * Guildas (members' Poder, PvP contribution, GvG and level), Evolução (level and EXP) and Conquistas.
 * The daily and weekly PvP boards close on their own, keep a snapshot and record their champions for good.
 * Every number below is a default the admin panel can change (hall_config), except the achievement list.
 */
export const HALL_CATEGORIES=['power','pvp','guild','level','achievements'] as const;
export type HallCategory=typeof HALL_CATEGORIES[number];
export const HALL_CATEGORY_NAMES:Record<HallCategory,string>={power:'Poder',pvp:'PvP',guild:'Guildas',level:'Evolução',achievements:'Conquistas'};
export const HALL_PERIODS=['day','week','all'] as const;
export type HallPeriod=typeof HALL_PERIODS[number];
export const HALL_PERIOD_NAMES:Record<HallPeriod,string>={day:'Diário',week:'Semanal',all:'Geral'};
export const GUILD_BOARDS=['power','pvp','gvg','level'] as const;
export type GuildBoard=typeof GUILD_BOARDS[number];
export const GUILD_BOARD_NAMES:Record<GuildBoard,string>={power:'Mais poderosas',pvp:'Vitórias PvP',gvg:'Guerras GvG',level:'Nível'};
/** Boards that close and keep their champions. */
export const LEGEND_BOARDS=['pvp-day','pvp-week','guild-week'] as const;
export type LegendBoard=typeof LEGEND_BOARDS[number];
export const LEGEND_NAMES:Record<LegendBoard,string>={'pvp-day':'Campeão PvP diário','pvp-week':'Campeão PvP semanal','guild-week':'Guilda campeã semanal'};
export const PLACE_NAMES:Record<1|2|3,string>={1:'Campeão',2:'Vice-campeão',3:'Terceiro lugar'};
export const HALL_PAGE_SIZE=10;
/** The server scope of every board; a future multi-server game gives each server its own. */
export const HALL_SCOPE='main';

export interface RewardTier {from:number;to:number;gold:number;coupons:number;/** Guild boards only: Riqueza for the guild. */riqueza?:number;}
export interface HallConfig {
 categories:Record<HallCategory,boolean>;
 /** Positions each board shows (and keeps in the closing snapshot). */
 topSize:number;
 /** Where days and weeks start (IANA name). Timestamps stay in UTC. */
 timeZone:string;
 /** Members whose Poder makes the guild's Poder (the strongest ones). */
 guildPowerMembers:number;
 /** Contributors whose wins make the guild's PvP score (the best ones). */
 guildPvpContributors:number;
 /** Training rooms and battles against bots count for the player boards (never for guilds). */
 countPractice:boolean;
 /** How long a finished day or week waits for battles that ended just before midnight to be saved. */
 closeGraceSeconds:number;
 /** Review alerts; they never block or change a result on their own. */
 alerts:{pairPerDay:number;shortBattleSeconds:number;leavesPerDay:number;winsPerHour:number};
 rewards:Record<LegendBoard,RewardTier[]>;
}
/** Starting values (prestige first: currency and titles, never Poder). */
export const DEFAULT_HALL_CONFIG:HallConfig={
 categories:{power:true,pvp:true,guild:true,level:true,achievements:true},
 topSize:50,timeZone:'America/Sao_Paulo',guildPowerMembers:10,guildPvpContributors:20,countPractice:false,closeGraceSeconds:300,
 alerts:{pairPerDay:6,shortBattleSeconds:25,leavesPerDay:3,winsPerHour:20},
 rewards:{
  'pvp-day':[{from:1,to:1,gold:150,coupons:0},{from:2,to:2,gold:100,coupons:0},{from:3,to:3,gold:60,coupons:0}],
  'pvp-week':[{from:1,to:1,gold:1000,coupons:30},{from:2,to:2,gold:600,coupons:20},{from:3,to:3,gold:400,coupons:10},{from:4,to:10,gold:150,coupons:0}],
  'guild-week':[{from:1,to:1,gold:0,coupons:0,riqueza:0},{from:2,to:2,gold:0,coupons:0,riqueza:0},{from:3,to:3,gold:0,coupons:0,riqueza:0}],
 },
};
const tierSchema=z.object({from:z.number().int().min(1).max(100),to:z.number().int().min(1).max(100),gold:z.number().int().min(0).max(1_000_000),coupons:z.number().int().min(0).max(100_000),riqueza:z.number().int().min(0).max(100_000).optional()}).strict().refine(t=>t.to>=t.from,'A faixa termina antes de começar.');
export const validTimeZone=(zone:string)=>{try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return true;}catch{return false;}};
export const hallConfigSchema=z.object({
 categories:z.object(Object.fromEntries(HALL_CATEGORIES.map(c=>[c,z.boolean()])) as Record<HallCategory,z.ZodBoolean>).strict(),
 topSize:z.number().int().min(10).max(100),
 timeZone:z.string().min(1).max(64).refine(validTimeZone,'Fuso horário desconhecido.'),
 guildPowerMembers:z.number().int().min(1).max(100),
 guildPvpContributors:z.number().int().min(1).max(200),
 countPractice:z.boolean(),
 closeGraceSeconds:z.number().int().min(0).max(3600),
 alerts:z.object({pairPerDay:z.number().int().min(2).max(500),shortBattleSeconds:z.number().int().min(0).max(600),leavesPerDay:z.number().int().min(1).max(100),winsPerHour:z.number().int().min(2).max(500)}).strict(),
 rewards:z.object({'pvp-day':z.array(tierSchema).max(10),'pvp-week':z.array(tierSchema).max(10),'guild-week':z.array(tierSchema).max(10)}).strict(),
}).strict();
/** A stored config over the defaults, so a field added later never breaks an older row. */
export function normalizeHallConfig(raw:unknown):HallConfig{
 const stored=(raw&&typeof raw==='object'?raw:{}) as Partial<HallConfig>;
 const merged={...DEFAULT_HALL_CONFIG,...stored,categories:{...DEFAULT_HALL_CONFIG.categories,...stored.categories},alerts:{...DEFAULT_HALL_CONFIG.alerts,...stored.alerts},rewards:{...DEFAULT_HALL_CONFIG.rewards,...stored.rewards}};
 const parsed=hallConfigSchema.safeParse(merged);return parsed.success?parsed.data as HallConfig:structuredClone(DEFAULT_HALL_CONFIG);
}
export function rewardFor(tiers:readonly RewardTier[],place:number){return tiers.find(t=>place>=t.from&&place<=t.to);}

// ── Periods ──
// Half-open intervals [start, end) in UTC milliseconds, computed from the local calendar of the configured zone.
const formats=new Map<string,Intl.DateTimeFormat>();
function format(zone:string){let f=formats.get(zone);if(!f){f=new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});formats.set(zone,f);}return f;}
/** The wall clock of `zone` at an instant. */
export function zonedClock(at:number,zone:string){
 const parts=Object.fromEntries(format(zone).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 return {year:parts.year,month:parts.month,day:parts.day,hour:parts.hour%24,minute:parts.minute,second:parts.second};
}
const offsetAt=(at:number,zone:string)=>{const c=zonedClock(at,zone);return Date.UTC(c.year,c.month-1,c.day,c.hour,c.minute,c.second)-Math.floor(at/1000)*1000;};
/** The instant a local calendar day starts in `zone` (month and day may overflow, like Date.UTC). */
export function zonedMidnight(year:number,month:number,day:number,zone:string){
 const guess=Date.UTC(year,month-1,day);let at=guess-offsetAt(guess,zone);
 // Twice, so a day that starts right after a daylight-saving jump still lands on its first instant.
 at=guess-offsetAt(at,zone);return at;
}
const iso=(year:number,month:number,day:number)=>new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
export interface PeriodWindow {period:Exclude<HallPeriod,'all'>;key:string;start:number;end:number;}
/** The day (00:00 to 00:00) or week (Monday 00:00 to the next Monday 00:00) an instant belongs to. The key is the
 * local date it starts on. */
export function periodOf(period:Exclude<HallPeriod,'all'>,at:number,zone:string):PeriodWindow{
 const c=zonedClock(at,zone);
 if(period==='day')return {period,key:iso(c.year,c.month,c.day),start:zonedMidnight(c.year,c.month,c.day,zone),end:zonedMidnight(c.year,c.month,c.day+1,zone)};
 const weekday=(new Date(Date.UTC(c.year,c.month-1,c.day)).getUTCDay()+6)%7;// Monday = 0
 const first=c.day-weekday;
 return {period,key:iso(c.year,c.month,first),start:zonedMidnight(c.year,c.month,first,zone),end:zonedMidnight(c.year,c.month,first+7,zone)};
}
/** "18/10" or "12/10 a 18/10" from a period key. */
export function periodLabel(period:HallPeriod,key:string){
 if(period==='all')return 'Geral';
 const [y,m,d]=key.split('-').map(Number),day=(at:Date)=>`${String(at.getUTCDate()).padStart(2,'0')}/${String(at.getUTCMonth()+1).padStart(2,'0')}`;
 const start=new Date(Date.UTC(y,m-1,d));if(period==='day')return day(start);
 return `${day(start)} a ${day(new Date(Date.UTC(y,m-1,d+6)))}`;
}

// ── Ordering ──
/** PvP order: wins, then wins over distinct opponents, fewer losses, who got there first, the player id. */
export interface PvpScore {id:string;wins:number;distinctWins:number;losses:number;/** When the last win landed (ms); never won sorts last. */reachedAt:number|null;}
export function comparePvp(a:PvpScore,b:PvpScore){
 return b.wins-a.wins||b.distinctWins-a.distinctWins||a.losses-b.losses||(a.reachedAt??Infinity)-(b.reachedAt??Infinity)||(a.id<b.id?-1:a.id>b.id?1:0);
}
/** Poder order: Poder, then level, then the player id. */
export function comparePower(a:{id:string;power:number;level:number},b:{id:string;power:number;level:number}){return b.power-a.power||b.level-a.level||(a.id<b.id?-1:a.id>b.id?1:0);}
export const winRate=(wins:number,losses:number)=>wins+losses?Math.round(wins/(wins+losses)*1000)/10:0;
/** The guild's score from its members' values: the best `limit` of them, so a crowd never beats a strong team on size alone. */
export function topSum(values:readonly number[],limit:number){return [...values].sort((a,b)=>b-a).slice(0,Math.max(0,limit)).reduce((sum,value)=>sum+value,0);}

// ── Achievements ──
/** What the achievements look at, all read from saved data (profile, PvP results, titles, guild). */
export interface AchievementFacts {level:number;power:number;maxForge:number;pvpWins:number;inGuild:boolean;dayTitles:number;weekTitles:number;}
export interface Achievement {id:string;name:string;description:string;points:number;done:(f:AchievementFacts)=>boolean;}
export const ACHIEVEMENTS:readonly Achievement[]=[
 {id:'pvp-1',name:'Primeiro Sangue',description:'Vença uma batalha PvP válida.',points:10,done:f=>f.pvpWins>=1},
 {id:'pvp-10',name:'Duelista',description:'Vença 10 batalhas PvP válidas.',points:20,done:f=>f.pvpWins>=10},
 {id:'pvp-50',name:'Gladiador',description:'Vença 50 batalhas PvP válidas.',points:40,done:f=>f.pvpWins>=50},
 {id:'pvp-100',name:'Veterano da Arena',description:'Vença 100 batalhas PvP válidas.',points:60,done:f=>f.pvpWins>=100},
 {id:'pvp-500',name:'Lenda da Arena',description:'Vença 500 batalhas PvP válidas.',points:120,done:f=>f.pvpWins>=500},
 {id:'level-10',name:'Aprendiz',description:'Alcance o nível 10.',points:10,done:f=>f.level>=10},
 {id:'level-20',name:'Aventureiro',description:'Alcance o nível 20.',points:20,done:f=>f.level>=20},
 {id:'level-30',name:'Desbravador',description:'Alcance o nível 30.',points:30,done:f=>f.level>=30},
 {id:'level-50',name:'Herói',description:'Alcance o nível 50.',points:50,done:f=>f.level>=50},
 {id:'level-70',name:'Mestre da Brasa',description:'Alcance o nível 70.',points:100,done:f=>f.level>=70},
 {id:'power-4000',name:'Bem Equipado',description:'Chegue a 4.000 de Poder.',points:20,done:f=>f.power>=4000},
 {id:'power-5000',name:'Arsenal Temido',description:'Chegue a 5.000 de Poder.',points:40,done:f=>f.power>=5000},
 {id:'power-6000',name:'Força Lendária',description:'Chegue a 6.000 de Poder.',points:80,done:f=>f.power>=6000},
 {id:'forge-10',name:'Mão de Ferreiro',description:'Fortaleça um equipamento até +10.',points:30,done:f=>f.maxForge>=10},
 {id:'forge-15',name:'Obra-Prima',description:'Fortaleça um equipamento até +15.',points:80,done:f=>f.maxForge>=15},
 {id:'guild',name:'Irmandade',description:'Faça parte de uma guilda.',points:10,done:f=>f.inGuild},
 {id:'champion-day',name:'Campeão do Dia',description:'Termine um dia em 1º no PvP diário.',points:30,done:f=>f.dayTitles>=1},
 {id:'champion-week',name:'Campeão da Semana',description:'Termine uma semana em 1º no PvP semanal.',points:80,done:f=>f.weekTitles>=1},
];
export const ACHIEVEMENT_BY_ID:Readonly<Record<string,Achievement>>=Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,a]));
export const unlockedAchievements=(facts:AchievementFacts)=>ACHIEVEMENTS.filter(a=>a.done(facts)).map(a=>a.id);

// ── What the client receives ──
export interface HallRow {
 rank:number;
 /** A player id, or a guild id as text on guild boards. */
 id:string;name:string;
 level?:number;gender?:CharacterGender;equipment?:Equipment;guild?:string;guildId?:number;
 /** The board's main number (Poder, wins, level, points…). */
 score:number;
 power?:number;xp?:number;wins?:number;losses?:number;distinctWins?:number;winRate?:number;streak?:number;
 achievements?:number;members?:number;leader?:string;riqueza?:number;
 /** Titles still in force (last closed day and week, top 3). */
 crowns?:{board:LegendBoard;place:1|2|3}[];
}
export interface HallBoard {
 category:HallCategory;period:HallPeriod;board?:GuildBoard;
 rows:HallRow[];page:number;pages:number;total:number;topSize:number;
 /** The viewer (or the viewer's guild), even far below the top. */
 me:HallRow|null;
 /** When the day or week closes (ms), for the countdown. */
 endsAt?:number;periodKey?:string;updatedAt:number;
 /** The guild board's rule, shown under the table. */
 note?:string;
 disabled?:boolean;
}
export interface HallPvpLine {wins:number;losses:number;battles:number;winRate:number;rank:number|null;}
export interface HallTitle {board:LegendBoard;place:1|2|3;periodKey:string;score:number;name:string;awardedAt:string;}
export interface HallPlayerProfile {
 id:string;name:string;level:number;xp:number;power:number;gender:CharacterGender;equipment:Equipment;
 guild?:{id:number;name:string};
 ranks:{power:number|null;level:number|null;achievements:number|null};
 pvp:Record<HallPeriod,HallPvpLine>;streak:number;
 /** Times each place was reached, per board. */
 titleCounts:Record<LegendBoard,{1:number;2:number;3:number}>;
 titles:HallTitle[];
 achievements:{id:string;unlockedAt:string}[];points:number;
}
export interface HallGuildMember {id:string;name:string;level:number;power:number;rank:number;rankName:string;weekWins:number;totalWins:number;}
export interface HallGuildProfile {
 id:number;name:string;level:number;riqueza:number;leader:string;viceLeaders:string[];members:HallGuildMember[];
 power:number;powerRank:number|null;pvp:{week:{score:number;rank:number|null};all:{score:number;rank:number|null}};
 totalWins:number;gvgWins:number;
 contributors:{week:{id:string;name:string;wins:number}[];all:{id:string;name:string;wins:number}[]};
 titles:HallTitle[];guildPowerMembers:number;guildPvpContributors:number;
}
export interface HallLegends {
 board:LegendBoard;
 /** Closed periods, newest first. */
 periods:{key:string;label:string;closedAt:string}[];
 /** The final ranking of the chosen period, exactly as it closed. */
 key:string|null;rows:HallRow[];
 /** Who holds most titles on this board. */
 leaders:{id:string;name:string;first:number;second:number;third:number}[];
}

const legendBoard=z.enum(LEGEND_BOARDS);
export const hallCommandSchemas=[
 z.object({type:z.literal('hall-board'),category:z.enum(HALL_CATEGORIES),period:z.enum(HALL_PERIODS).optional(),board:z.enum(GUILD_BOARDS).optional(),page:z.number().int().min(1).max(10).optional()}).strict(),
 z.object({type:z.literal('hall-profile'),playerId:z.string().uuid()}).strict(),
 z.object({type:z.literal('hall-guild'),guildId:z.number().int().positive()}).strict(),
 z.object({type:z.literal('hall-legends'),board:legendBoard,key:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict(),
] as const;
export type HallEvent=
 |{type:'hall-board';board:HallBoard}
 |{type:'hall-profile';profile:HallPlayerProfile}
 |{type:'hall-guild';guild:HallGuildProfile}
 |{type:'hall-legends';legends:HallLegends}
 |{type:'hall-changed';categories:HallCategory[]};

// ── Admin ──
export interface HallAlert {id:number;kind:'pair'|'short'|'leaves'|'rate';matchId:string|null;players:{id:string;name:string}[];detail:Record<string,unknown>;createdAt:string;status:'open'|'dismissed'|'voided';reviewedBy:string|null;}
export const HALL_ALERT_NAMES:Record<HallAlert['kind'],string>={pair:'Mesmos jogadores muitas vezes no dia',short:'Batalha curta demais',leaves:'Abandonos repetidos',rate:'Vitórias demais em uma hora'};
export interface HallAdminMatch {id:string;kind:string;mode:string;finishedAt:string;startedAt:string|null;winnerTeam:number|null;counted:boolean;voidedAt:string|null;voidedBy:string|null;voidReason:string|null;
 players:{id:string;name:string;team:number;outcome:'win'|'loss'|'none';left:boolean;guild:string|null}[];}
export interface HallClosing {board:LegendBoard;key:string;closedAt:string;rows:number;rewards:{pending:number;delivered:number};}
export const hallVoidSchema=z.object({reason:z.string().trim().min(3).max(200),restore:z.boolean().optional()}).strict();
export const hallAlertSchema=z.object({status:z.enum(['open','dismissed'])}).strict();
