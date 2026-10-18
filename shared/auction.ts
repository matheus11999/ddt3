import {z} from 'zod';
import {CATALOG,STONES} from './catalog';
import type {Slot} from './catalog';
import {COMPOSITION_STONE_BY_ID} from './composition';
import type {CompositionBonus} from './composition';

/**
 * Leilão (auction house): players list items and stones for gold (Moedas Brasa) or Cupons, the cash currency.
 * The server holds the goods while listed; payment and unsold goods reach the seller by mail (docs/auction.md).
 */
export const AUCTION_CURRENCIES=['gold','coupons'] as const;
export type AuctionCurrency=typeof AUCTION_CURRENCIES[number];
export const CURRENCY_NAMES:Record<AuctionCurrency,string>={gold:'Ouro',coupons:'Cupons'};

/** Listings a regular player keeps at once (VIP may raise it once VIP exists on the server). */
export const AUCTION_MAX_LISTINGS=3;
export const AUCTION_PAGE_SIZE=8;
export const AUCTION_PRICE_MAX=9_999_999;
/** How long a listing stays up and the gold it costs to list (never refunded). */
export const AUCTION_DURATIONS=[{hours:2,fee:20},{hours:8,fee:50},{hours:24,fee:100}] as const;
export type AuctionHours=typeof AUCTION_DURATIONS[number]['hours'];
export const auctionFee=(hours:number)=>AUCTION_DURATIONS.find(d=>d.hours===hours)?.fee??Infinity;

/** The menu on the left: groups that expand into leaf categories. A listing stores its leaf. */
export const AUCTION_CATEGORIES=[
 {id:'weapons',name:'Arma',children:[{id:'weapon',name:'Arma'},{id:'secondary',name:'Arma Secundária'}]},
 {id:'clothing',name:'Vestuário',children:[{id:'outfit',name:'Roupa'},{id:'hat',name:'Chapéu'}]},
 {id:'beauty',name:'Beleza',children:[{id:'face',name:'Rosto'},{id:'glasses',name:'Óculos'},{id:'hair',name:'Cabelos'},{id:'bubble',name:'Bolha'}]},
 {id:'stones',name:'Pedra de Upgrade',children:STONES.map(s=>({id:`stone-${s.level}`,name:`Pedra Nv. ${s.level}`}))},
 {id:'compositions',name:'Pedra de Composição',children:[1,2,3].map(tier=>({id:`composition-${tier}`,name:`Composição Nv. ${tier}`}))},
] as const;
export const AUCTION_LEAVES:string[]=AUCTION_CATEGORIES.flatMap(group=>group.children.map(child=>child.id));
export const AUCTION_GROUPS:string[]=AUCTION_CATEGORIES.map(group=>group.id);
/** A group or a leaf of the menu, as the leaf categories it covers. */
export function categoryLeaves(id:string):string[] {
 const group=AUCTION_CATEGORIES.find(g=>g.id===id);
 return group?group.children.map(child=>child.id):AUCTION_LEAVES.includes(id)?[id]:[];
}
/** Item types that can be listed (secondary weapons will join once they exist). */
const LISTABLE_SLOTS:readonly Slot[]=['weapon','outfit','hat','face','glasses','hair','bubble'];

/** What a listing holds: one item copy with its forge level, compositions and color, or a stack of stones. */
export type AuctionGoods=
 | {kind:'item';item:string;upgrade?:number;compositions?:CompositionBonus;color?:string}
 | {kind:'stone';level:number;amount:number}
 | {kind:'composition';stone:string;amount:number};
export interface AuctionListing {id:number;sellerId:string;sellerName:string;goods:AuctionGoods;currency:AuctionCurrency;price:number;createdAt:string;expiresAt:string;}
export interface AuctionPage {listings:AuctionListing[];total:number;page:number;pages:number;category:string|null;search:string;}
/** Something that happened to one of my listings: sold (payment in the mail) or expired (goods back in the mail). */
export interface AuctionNotice {id:number;kind:'sold'|'expired';goods:AuctionGoods;currency:AuctionCurrency;price:number;buyerName?:string;at:string;seen:boolean;}
export interface AuctionMine {listings:AuctionListing[];notices:AuctionNotice[];unseen:number;}
export interface AuctionResult {action:'sell'|'buy'|'cancel';listing:AuctionListing;}

export function goodsCategory(goods:AuctionGoods):string|null {
 if(goods.kind==='stone')return STONES.some(s=>s.level===goods.level)?`stone-${goods.level}`:null;
 if(goods.kind==='composition'){const stone=COMPOSITION_STONE_BY_ID[goods.stone];return stone?`composition-${stone.tier}`:null;}
 const slot=CATALOG[goods.item]?.slot;
 return slot&&LISTABLE_SLOTS.includes(slot)?slot:null;
}
export function goodsName(goods:AuctionGoods):string {
 if(goods.kind==='stone')return STONES[goods.level-1]?.name??'Pedra de Fortificação';
 if(goods.kind==='composition')return COMPOSITION_STONE_BY_ID[goods.stone]?.name??'Pedra de composição';
 const name=CATALOG[goods.item]?.name??goods.item;
 return goods.upgrade?`${name} +${goods.upgrade}`:name;
}
export const goodsAmount=(goods:AuctionGoods)=>goods.kind==='item'?1:goods.amount;
export function isListableItem(id:string):boolean {return goodsCategory({kind:'item',item:id})!==null;}

const price=z.number().int().min(1).max(AUCTION_PRICE_MAX);
const id=z.number().int().positive();
export const auctionSourceSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('item'),key:z.string().min(1).max(48)}).strict(),
 z.object({kind:z.literal('stone'),level:z.number().int().min(1).max(STONES.length),amount:z.number().int().min(1).max(9999)}).strict(),
 z.object({kind:z.literal('composition'),stone:z.string().regex(/^(attack|defense|agility|armor)-[1-3]$/),amount:z.number().int().min(1).max(9999)}).strict(),
]);
export type AuctionSource=z.infer<typeof auctionSourceSchema>;
export const auctionCommandSchemas=[
 z.object({type:z.literal('auction-list'),category:z.string().max(24).refine(c=>categoryLeaves(c).length>0,'Categoria inválida.').optional(),page:z.number().int().min(1).max(10_000),search:z.string().trim().max(24).optional()}).strict(),
 z.object({type:z.literal('auction-mine')}).strict(),
 z.object({type:z.literal('auction-seen')}).strict(),
 z.object({type:z.literal('auction-sell'),source:auctionSourceSchema,currency:z.enum(AUCTION_CURRENCIES),price,hours:z.union(AUCTION_DURATIONS.map(d=>z.literal(d.hours)) as [z.ZodLiteral<2>,z.ZodLiteral<8>,z.ZodLiteral<24>])}).strict(),
 z.object({type:z.literal('auction-buy'),id,currency:z.enum(AUCTION_CURRENCIES),price}).strict(),
 z.object({type:z.literal('auction-cancel'),id}).strict(),
] as const;

/** "1h 20min", "35min", "Encerrando" for the time column. */
export function timeLeft(expiresAt:string|number,now:number):string {
 const ms=(typeof expiresAt==='number'?expiresAt:Date.parse(expiresAt))-now;
 if(ms<=60_000)return 'Encerrando';
 const minutes=Math.floor(ms/60_000),hours=Math.floor(minutes/60);
 return hours?`${hours}h ${String(minutes%60).padStart(2,'0')}min`:`${minutes}min`;
}
