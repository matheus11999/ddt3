import {z} from 'zod';
import type {CharacterGender,Equipment} from './catalog';
import type {Compositions} from './composition';

/**
 * Player info window and player reports (right click on another player: "Ver informações" / "Denunciar").
 * A report carries the reported player's chat lines of the last 30 minutes so the admin panel can judge it.
 */
export const REPORT_REASONS=[
 {id:'offensive',label:'Ofensa ou xingamento'},
 {id:'spam',label:'Spam ou flood no chat'},
 {id:'cheat',label:'Trapaça ou programa ilegal'},
 {id:'name',label:'Nome impróprio'},
 {id:'scam',label:'Golpe ou tentativa de roubo de conta'},
 {id:'antigame',label:'Atrapalhar a partida de propósito'},
 {id:'other',label:'Outro motivo'},
] as const;
export type ReportReason=typeof REPORT_REASONS[number]['id'];
export const REPORT_REASON_IDS=REPORT_REASONS.map(reason=>reason.id) as [ReportReason,...ReportReason[]];
export const REPORT_REASON_NAMES=Object.fromEntries(REPORT_REASONS.map(reason=>[reason.id,reason.label])) as Record<ReportReason,string>;
export const REPORT_DETAILS_MAX=300;
/** How far back the reported player's chat goes with the report. */
export const REPORT_CHAT_WINDOW_MS=30*60_000;
/** Anti-spam: reports one player can send per hour, and how long before the same target can be reported again. */
export const REPORTS_PER_HOUR=5;
export const REPORT_SAME_TARGET_MS=30*60_000;
export const REPORT_STATUSES=['open','resolved','dismissed'] as const;
export type ReportStatus=typeof REPORT_STATUSES[number];
export const REPORT_STATUS_NAMES:Record<ReportStatus,string>={open:'Aberta',resolved:'Resolvida',dismissed:'Descartada'};

export const reportCommandSchema=z.object({type:z.literal('report'),playerId:z.string().uuid(),reason:z.enum(REPORT_REASON_IDS),details:z.string().trim().max(REPORT_DETAILS_MAX).optional(),context:z.enum(['lobby','hall','room','battle','chat','ranking','auction']).optional()}).strict();
export const REPORT_CONTEXT_NAMES:Record<string,string>={lobby:'Praça',hall:'Salão PvP',room:'Sala PvP',battle:'Batalha',chat:'Chat',ranking:'Pódio'};
export const reportUpdateSchema=z.object({status:z.enum(REPORT_STATUSES),note:z.string().trim().max(500).optional()}).strict();

/** What another player can see about someone: only what is worn, never the bag or the wallet. */
export interface PlayerInfo {
 id:string;name:string;level:number;gender:CharacterGender;wins:number;matches:number;online:boolean;
 /** Room and match bots: shown like players, never reported. */
 bot?:boolean;
 /** As the server derives it: worn copies, upgrade, compositions, colors, skin and eyes. */
 equipment:Equipment;
 /** By copy key, only for the worn copies (what the tooltip reads). */
 upgrades:Record<string,number>;compositions:Compositions;itemColors:Record<string,string>;
}
/** One line the reported player wrote; `room` is the room number when it was the room chat. */
export interface ReportChatLine {at:number;channel:'world'|'room'|'guild'|'private';text:string;room?:number;/** Private message: who it went to. */to?:string;/** Guild message: the guild's name. */guild?:string;}
export interface ReportSummary {
 id:number;status:ReportStatus;reason:ReportReason;details:string;createdAt:string;
 reporter:{id:string;name:string};target:{id:string;name:string;level:number};
 chatCount:number;context:string;
}
export interface ReportDetail extends ReportSummary {
 chat:ReportChatLine[];note:string|null;resolvedAt:string|null;resolvedBy:string|null;
 /** Every report against the same player, newest first (this one included). */
 targetHistory:{id:number;status:ReportStatus;reason:ReportReason;createdAt:string;reporter:string}[];
}
