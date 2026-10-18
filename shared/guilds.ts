import {z} from 'zod';
import {auctionSourceSchema} from './auction';
import type {AuctionGoods} from './auction';

/**
 * Guildas (docs/guilds.md). A player founds a guild with gold and it starts at level 0. The owner spends the
 * guild's own currency, Riqueza, to raise the guild level and its three buildings, never past the guild level:
 * the Ferreiro adds success chance to every member's forge, the Loja sells members-only items for gold and the
 * Depósito keeps items any member can take. Riqueza only comes from GvG wins and never leaves the guild.
 * Every number below is a default meant to be tuned here.
 */
export const GUILD_CREATE_COST=1000;
export const GUILD_MAX_LEVEL=10;
export const GUILD_NAME_MIN=3,GUILD_NAME_MAX=16;
export const GUILD_BUILDINGS=['shop','smith','storage'] as const;
export type GuildBuilding=typeof GUILD_BUILDINGS[number];
export const BUILDING_NAMES:Record<GuildBuilding,string>={shop:'Loja da Guilda',smith:'Ferreiro da Guilda',storage:'Depósito da Guilda'};
/** Riqueza to raise the guild from level n to n+1 (index n). */
export const GUILD_LEVEL_COSTS=[100,250,500,900,1400,2000,2800,3800,5000,6500] as const;
/** Riqueza to raise a building from level n to n+1 (index n). */
export const BUILDING_LEVEL_COSTS=[50,120,250,450,700,1000,1400,1900,2500,3200] as const;
export const guildLevelCost=(level:number)=>GUILD_LEVEL_COSTS[level]??Infinity;
export const buildingLevelCost=(level:number)=>BUILDING_LEVEL_COSTS[level]??Infinity;
/** Riqueza each member of the winning team brings to their guild from a GvG battle (also their own contribution). */
export const GVG_CONTRIBUTION=10;
/** Forge success points every Ferreiro level adds (Fortalecer and Composição). */
export const SMITH_BONUS_PER_LEVEL=2;
export const smithBonus=(level:number)=>Math.max(0,Math.floor(level))*SMITH_BONUS_PER_LEVEL;
/** The Ferreiro da Guilda adds its points to a chance that exists, up to 100%. */
export function guildChance(chance:number,bonus:number){return chance>0?Math.min(100,chance+Math.max(0,bonus)):0;}
/** Items the Depósito holds: 10 per level, closed at level 0. */
export const storageCapacity=(level:number)=>Math.max(0,Math.floor(level))*10;
export const guildMemberCap=(level:number)=>10+Math.max(0,Math.floor(level))*5;
/** What the Loja da Guilda sells (for gold) and the shop level that unlocks each item. */
export interface GuildOffer {id:string;price:number;level:number;}
export const GUILD_SHOP:readonly GuildOffer[]=[{id:'necklace-guild-1',price:800,level:1}];
export const GUILD_OFFER_BY_ID:Readonly<Record<string,GuildOffer>>=Object.fromEntries(GUILD_SHOP.map(offer=>[offer.id,offer]));
export const GUILD_PAGE_SIZE=20;

export type GuildRole='owner'|'member';
export interface GuildSummary {id:number;name:string;level:number;members:number;capacity:number;ownerName:string;}
export interface GuildMember {id:string;name:string;level:number;role:GuildRole;contribution:number;joinedAt:string;online?:boolean;}
export interface GuildApplication {playerId:string;name:string;level:number;at:string;}
/** One stored copy or stack in the Depósito; `by` is who put it there. */
export interface GuildStored {id:number;goods:AuctionGoods;by:string;at:string;}
export interface GuildView {id:number;name:string;level:number;riqueza:number;ownerId:string;buildings:Record<GuildBuilding,number>;members:GuildMember[];storage:GuildStored[];/** Only the owner sees who asked to join. */applications?:GuildApplication[];createdAt:string;}
/** My guild (null without one) and the guilds I asked to join. */
export interface GuildState {guild:GuildView|null;applied:number[];}

export function validGuildName(raw:string){
 const name=raw.trim().replace(/\s+/g,' ');
 if(name.length<GUILD_NAME_MIN||name.length>GUILD_NAME_MAX)throw Error(`O nome da guilda precisa ter de ${GUILD_NAME_MIN} a ${GUILD_NAME_MAX} letras.`);
 if(!/^[\p{L}\p{N} _.-]+$/u.test(name))throw Error('Use só letras, números, espaço, ponto, hífen ou sublinhado no nome da guilda.');
 return name;
}
/** Buildings never go past the guild level. */
export function canRaiseBuilding(guildLevel:number,buildingLevel:number){return buildingLevel<guildLevel&&buildingLevel<GUILD_MAX_LEVEL;}

const guildId=z.number().int().positive();
const playerId=z.string().uuid();
export const guildCommandSchemas=[
 z.object({type:z.literal('guild-state')}).strict(),
 z.object({type:z.literal('guild-list'),search:z.string().trim().max(GUILD_NAME_MAX).optional()}).strict(),
 z.object({type:z.literal('guild-create'),name:z.string().max(40)}).strict(),
 z.object({type:z.literal('guild-apply'),id:guildId}).strict(),
 z.object({type:z.literal('guild-cancel-apply'),id:guildId}).strict(),
 z.object({type:z.literal('guild-answer'),playerId,accept:z.boolean()}).strict(),
 z.object({type:z.literal('guild-kick'),playerId}).strict(),
 z.object({type:z.literal('guild-leave')}).strict(),
 z.object({type:z.literal('guild-upgrade'),target:z.enum(['guild',...GUILD_BUILDINGS])}).strict(),
 z.object({type:z.literal('guild-buy'),item:z.string().refine(id=>Object.hasOwn(GUILD_OFFER_BY_ID,id),'Item não está na loja da guilda.')}).strict(),
 z.object({type:z.literal('guild-deposit'),source:auctionSourceSchema}).strict(),
 z.object({type:z.literal('guild-withdraw'),id:z.number().int().positive()}).strict(),
 z.object({type:z.literal('room-gvg'),active:z.boolean()}).strict(),
] as const;
