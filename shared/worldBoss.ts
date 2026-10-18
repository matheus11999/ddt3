/**
 * Chefão Mundial (world boss): one dragon whose life is shared by every player while the event runs.
 * Each attempt is a solo battle against the dragon; the damage dealt goes to the global life and to the
 * event ranking (both kept in Postgres, server/worldBoss.ts). Rules and art: docs/world-boss.md.
 */
import {z} from 'zod';

export const WORLD_BOSS_ID='dragon';
/** After the event ends (time out, stopped or the dragon killed) the window and its ranking stay open this long. */
export const WORLD_BOSS_RESULTS_MS=20*60_000;
export const WORLD_BOSS_DEFAULT_NAME='Dragão Ancestral';
export const WORLD_BOSS_DEFAULT_HP=1_000_000;
export const WORLD_BOSS_MAX_HP=2_100_000_000;
/** Shortest and longest event the admin panel may open. */
export const WORLD_BOSS_MIN_MINUTES=5,WORLD_BOSS_MAX_MINUTES=24*60;
export const WORLD_BOSS_RANKING_SIZE=50;
/** Fighter id of the dragon inside a battle. */
export const DRAGON_FIGHTER_ID='world-boss-dragon';
/** Battle map of the event. */
export const WORLD_BOSS_MAP='dragon-lair';
/** The `turnId` while the dragon acts. */
export const DRAGON_TURN_ID='world-boss-turn';
/** Where the dragon stands in the lair: its head is the target (a large hit circle around it). */
export const DRAGON_BODY={x:2420,y:700,hitRadius:175,hitHeight:420} as const;
/** Each round the dragon hits a little harder, so every attempt comes to an end. */
export const DRAGON_RAGE_PER_ROUND=.08;

export type WorldBossPhase='idle'|'active'|'results';
export type WorldBossEndReason='time'|'admin'|'defeated';
export interface WorldBossRankRow {rank:number;playerId:string;name:string;level:number;damage:number;attempts:number;}
/** What every client knows about the event (the lobby icon and the window). */
export interface WorldBossStatus {
 phase:WorldBossPhase;occurrenceId?:string;name:string;hp:number;maxHp:number;
 startsAt?:number;endsAt?:number;finishedAt?:number;resultsUntil?:number;endReason?:WorldBossEndReason;
 /** Who dealt the last blow, when the dragon fell. */
 finalBlow?:string;
 /** Players with damage in this event. */
 fighters:number;
}
export interface WorldBossRanking {occurrenceId:string|null;rows:WorldBossRankRow[];me:WorldBossRankRow|null;}

/** The dragon's moves. Times in ms from the start of the act. */
export type DragonAction='entrance'|'claw'|'grab'|'breath'|'firesweep'|'death'|'retreat';
export interface DragonActionDef {duration:number;/** When the blow lands (damage numbers, shake). */contact:number;/** Families never repeat back to back. */family:'intro'|'claw'|'fire'|'end';attack:number;}
export const DRAGON_ACTIONS:Record<DragonAction,DragonActionDef>={
 entrance:{duration:4200,contact:2300,family:'intro',attack:0},
 claw:{duration:2300,contact:1250,family:'claw',attack:290},
 grab:{duration:3300,contact:2300,family:'claw',attack:250},
 breath:{duration:3000,contact:1450,family:'fire',attack:320},
 firesweep:{duration:3500,contact:1300,family:'fire',attack:240},
 death:{duration:4600,contact:0,family:'end',attack:0},
 retreat:{duration:3600,contact:0,family:'end',attack:0},
};
/** firesweep: the flames run along the ground from the dragon toward the far side between these times. */
export const FIRESWEEP_WINDOW={from:1100,to:2700} as const;
export interface DragonHit {at:number;targetId:string;damage:number;x:number;y:number;}
/** One act of the dragon, shown by every client from the same server time. */
export interface DragonAct {id:string;action:DragonAction;startedAt:number;targetId?:string;targetX?:number;targetY?:number;hits:DragonHit[];}
/** World boss state inside a battle. */
export interface BattleWorldBoss {
 occurrenceId:string;name:string;hp:number;maxHp:number;endsAt:number;
 /** Controls stay locked until then (the dragon's entrance). */
 introUntil:number;round:number;
 /** Damage dealt in this attempt (already counted in the global life once committed). */
 attemptDamage:number;
 act?:DragonAct;
 /** The event ended during the attempt: the dragon fell or flew away. */
 over?:WorldBossEndReason;
 /** When the attempt closes and the player goes back to the plaza with the window open. */
 closesAt?:number;
}

/** The move the dragon picks this round: never the same family (claw or fire) twice in a row. */
export function pickDragonAction(previous:DragonAction|undefined,roll:number):DragonAction{
 const last=previous?DRAGON_ACTIONS[previous].family:undefined;
 const options:DragonAction[]=last==='claw'?['breath','firesweep']:last==='fire'?['claw','grab']:['claw','grab','breath','firesweep'];
 return options[Math.min(options.length-1,Math.floor(roll*options.length))];
}
/** Damage multiplier of a round (1 on the first). */
export const dragonRage=(round:number)=>1+Math.max(0,round-1)*DRAGON_RAGE_PER_ROUND;
/** firesweep: x of the front of the flames at `t` ms into the act (from the dragon toward the far side). */
export function sweepFrontX(t:number,fromX:number,toX:number){
 const k=Math.min(1,Math.max(0,(t-FIRESWEEP_WINDOW.from)/(FIRESWEEP_WINDOW.to-FIRESWEEP_WINDOW.from)));
 return fromX+(toX-fromX)*k;
}
/** When the sweeping flames reach `x`. */
export function sweepReachAt(x:number,fromX:number,toX:number){
 const k=Math.min(1,Math.max(0,(x-fromX)/(toX-fromX||1)));
 return FIRESWEEP_WINDOW.from+k*(FIRESWEEP_WINDOW.to-FIRESWEEP_WINDOW.from);
}

export const BRASILIA_TZ='America/Sao_Paulo';
const id=z.string().uuid();
const name=z.string().trim().min(2).max(40);
/** Admin panel bodies (server/admin.ts). Times are epoch ms; the panel converts from Brasília time. */
export const worldBossStartSchema=z.object({requestId:z.string().min(8).max(64),endsAt:z.number().int().positive(),name:name.optional(),maxHp:z.number().int().min(1).max(WORLD_BOSS_MAX_HP).optional()}).strict();
export const worldBossStopSchema=z.object({requestId:z.string().min(8).max(64),occurrenceId:id}).strict();
export const worldBossScheduleSchema=z.object({startsAt:z.number().int().positive(),endsAt:z.number().int().positive(),repeat:z.enum(['none','daily','weekly']),enabled:z.boolean()}).strict().refine(s=>s.endsAt-s.startsAt>=WORLD_BOSS_MIN_MINUTES*60_000&&s.endsAt-s.startsAt<=WORLD_BOSS_MAX_MINUTES*60_000,`A duração precisa ficar entre ${WORLD_BOSS_MIN_MINUTES} minutos e 24 horas.`);
export const worldBossSettingsSchema=z.object({name,maxHp:z.number().int().min(1).max(WORLD_BOSS_MAX_HP),enabled:z.boolean()}).strict();
export type WorldBossSchedule=z.infer<typeof worldBossScheduleSchema>&{id:string;createdBy:string;createdAt:number;nextStartsAt:number|null};
export interface WorldBossSettings {name:string;maxHp:number;enabled:boolean;}
export interface WorldBossOccurrence {id:string;origin:'manual'|'schedule';status:'active'|'ended';name:string;startsAt:number;endsAt:number;maxHp:number;hp:number;startedBy:string|null;stoppedBy:string|null;endReason:WorldBossEndReason|null;finishedAt:number|null;finalBlow:string|null;fighters:number;}
export interface WorldBossAdminState {status:WorldBossStatus;settings:WorldBossSettings;schedules:WorldBossSchedule[];history:WorldBossOccurrence[];serverTime:number;}

/** Next start of a repeating schedule at or after `now` (null when a one-off already passed). */
export function nextScheduleStart(s:{startsAt:number;endsAt:number;repeat:'none'|'daily'|'weekly'},now:number):number|null{
 const length=s.endsAt-s.startsAt;
 if(s.repeat==='none')return s.endsAt>now?s.startsAt:null;
 const step=s.repeat==='daily'?86_400_000:7*86_400_000;
 if(s.startsAt+length>now)return s.startsAt;
 // Brasília has no daylight saving time, so a fixed step keeps the local hour.
 const n=Math.ceil((now-length-s.startsAt)/step);let start=s.startsAt+n*step;if(start+length<=now)start+=step;return start;
}
/** The window of a schedule open at `now`, if any. */
export function scheduleWindowAt(s:{startsAt:number;endsAt:number;repeat:'none'|'daily'|'weekly'},now:number){
 const start=nextScheduleStart(s,now);if(start===null||start>now)return null;return {startsAt:start,endsAt:start+(s.endsAt-s.startsAt)};
}
