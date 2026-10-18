import type {CharacterGender,Equipment} from './catalog';

/** Players page of the admin panel (/admin/jogadores). */
export const PLAYER_SORTS=['created','name','level','gold','wins','matches'] as const;
export type PlayerSort=typeof PLAYER_SORTS[number];
export const PLAYER_LIST_PAGE=50;
/** Where an online player is right now; offline players are not in the game's peer list. */
export type PlayerPresence='offline'|'lobby'|'room'|'battle';
export const PRESENCE_NAMES:Record<PlayerPresence,string>={offline:'Offline',lobby:'Na praça',room:'Na sala',battle:'Em batalha'};
export interface AdminPlayerRow {id:string;name:string;gender:CharacterGender;level:number;xp:number;gold:number;coupons:number;wins:number;matches:number;colorTickets:number;stones:number;items:number;createdAt:string;presence:PlayerPresence;}
export interface AdminPlayerDetail extends AdminPlayerRow {inventory:string[];upgrades:Record<string,number>;stoneStacks:Record<string,number>;compositionStones:Record<string,number>;equipment:Equipment;}
