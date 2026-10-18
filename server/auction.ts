import type pg from 'pg';
import {canEquipItem,CATALOG,copyBase,equippedCopy,SLOTS} from '../shared/catalog';
import {AUCTION_MAX_LISTINGS,AUCTION_PAGE_SIZE,auctionFee,categoryLeaves,CURRENCY_NAMES,goodsCategory,goodsName} from '../shared/auction';
import type {AuctionCurrency,AuctionGoods,AuctionListing,AuctionMine,AuctionNotice,AuctionPage,AuctionSource} from '../shared/auction';
import type {MailAttachment} from '../shared/mail';
import type {CharacterGender} from '../shared/catalog';
import type {Profile} from '../shared/protocol';
import {applyAttachments,insertMail} from './mail';
import {normalizeProfile,refreshWorn,removeCopy} from './store';

export interface AuctionQuery {category?:string;page:number;search?:string;gender:CharacterGender;}
export interface SellOrder {source:AuctionSource;currency:AuctionCurrency;price:number;hours:number;}
/** What the game needs from the auction house (tests use a fake). */
export interface AuctionHouse {
 list(query:AuctionQuery):Promise<AuctionPage>;
 mine(playerId:string):Promise<AuctionMine>;
 seen(playerId:string):Promise<void>;
 sell(playerId:string,order:SellOrder):Promise<{profile:Profile;listing:AuctionListing}>;
 buy(playerId:string,id:number,currency:AuctionCurrency,price:number):Promise<{profile:Profile;listing:AuctionListing}>;
 cancel(playerId:string,id:number):Promise<AuctionListing>;
 /** Closes listings whose time ran out, mailing the goods back; returns the sellers to notify. */
 expireDue():Promise<string[]>;
}

/** Takes the goods out of the seller's bag: an unworn item copy (with its forge level, compositions and color) or stones.
 * `anyItem`: every equipment type may leave (the guild Depósito), not only the types the auction lists. */
export function takeGoods(profile:Profile,source:AuctionSource,anyItem=false):AuctionGoods{
 if(source.kind==='stone'){
  const tier=String(source.level);if((profile.stones[tier]??0)<source.amount)throw Error('Você não tem essas pedras na mochila.');
  profile.stones[tier]-=source.amount;return {kind:'stone',level:source.level,amount:source.amount};
 }
 if(source.kind==='composition'){
  if((profile.compositionStones[source.stone]??0)<source.amount)throw Error('Você não tem essas pedras de composição.');
  profile.compositionStones[source.stone]-=source.amount;return {kind:'composition',stone:source.stone,amount:source.amount};
 }
 const key=source.key,item=copyBase(key);
 if(!profile.inventory.includes(key)||!CATALOG[item])throw Error('Este item não está na sua mochila.');
 if(!anyItem&&!goodsCategory({kind:'item',item}))throw Error('Este tipo de item ainda não pode ir para o leilão.');
 if(SLOTS.some(slot=>equippedCopy(profile.equipment,slot)===key))throw Error('Desequipe o item antes de anunciar.');
 const kept=removeCopy(profile,key);refreshWorn(profile);
 return {kind:'item',item,...(kept.upgrade?{upgrade:kept.upgrade}:{}),...(kept.compositions&&Object.keys(kept.compositions).length?{compositions:kept.compositions}:{}),...(kept.color?{color:kept.color}:{})};
}
/** The goods as a mail attachment (returned goods) or straight into a bag (a purchase). */
export function goodsAttachment(goods:AuctionGoods):MailAttachment{
 if(goods.kind==='item')return {kind:'item',item:goods.item,quantity:1,...(goods.upgrade?{upgrade:goods.upgrade}:{}),...(goods.compositions?{compositions:goods.compositions}:{}),...(goods.color?{color:goods.color}:{})};
 return goods;
}
export const paymentAttachment=(currency:AuctionCurrency,amount:number):MailAttachment=>({kind:currency==='gold'?'coins':'coupons',amount});
const balance=(profile:Profile,currency:AuctionCurrency)=>currency==='gold'?profile.gold:profile.coupons;
const spend=(profile:Profile,currency:AuctionCurrency,amount:number)=>{if(currency==='gold')profile.gold-=amount;else profile.coupons-=amount;};
const priceLabel=(currency:AuctionCurrency,price:number)=>`${price.toLocaleString('pt-BR')} ${currency==='gold'?'de Ouro':CURRENCY_NAMES.coupons}`;

/** Pure checks shared by the Postgres store and the tests. */
export function checkSale(profile:Profile,activeListings:number,order:SellOrder){
 if(activeListings>=AUCTION_MAX_LISTINGS)throw Error(`Você já tem ${AUCTION_MAX_LISTINGS} itens no leilão. Espere vender ou retire um anúncio.`);
 const fee=auctionFee(order.hours);if(!Number.isFinite(fee))throw Error('Escolha um tempo de leilão válido.');
 if(profile.gold<fee)throw Error(`Anunciar por ${order.hours}h custa ${fee} de Ouro.`);
 const goods=takeGoods(profile,order.source);
 profile.gold-=fee;
 return goods;
}
export function checkPurchase(profile:Profile,listing:AuctionListing,currency:AuctionCurrency,price:number){
 if(listing.sellerId===profile.id)throw Error('Este anúncio é seu.');
 if(listing.currency!==currency||listing.price!==price)throw Error('O anúncio mudou. Atualize a lista.');
 if(listing.goods.kind==='item'&&!canEquipItem(listing.goods.item,profile.gender))throw Error('Este item não é compatível com o gênero do seu personagem.');
 if(balance(profile,currency)<price)throw Error(currency==='gold'?'Ouro insuficiente para esta compra.':'Cupons insuficientes para esta compra.');
 spend(profile,currency,price);
 applyAttachments(profile,[goodsAttachment(listing.goods)]);
 refreshWorn(profile);
}

const listing=(row:Record<string,unknown>):AuctionListing=>({id:Number(row.id),sellerId:row.seller_id as string,sellerName:row.seller_name as string,goods:row.goods as AuctionGoods,
 currency:row.currency as AuctionCurrency,price:Number(row.price),createdAt:new Date(row.created_at as string).toISOString(),expiresAt:new Date(row.expires_at as string).toISOString()});
const notice=(row:Record<string,unknown>):AuctionNotice=>({id:Number(row.id),kind:row.status==='sold'?'sold':'expired',goods:row.goods as AuctionGoods,currency:row.currency as AuctionCurrency,price:Number(row.price),
 ...(row.buyer_name?{buyerName:row.buyer_name as string}:{}),at:new Date(row.closed_at as string).toISOString(),seen:row.seen_at!=null});

/** The Leilão in Postgres. Selling, buying and withdrawing each lock the listing and the player in one transaction:
 * an item is never in two places and a listing is never sold twice. */
export class AuctionStore implements AuctionHouse {
 constructor(private pool:pg.Pool){}
 async init(){await this.pool.query(`
  CREATE TABLE IF NOT EXISTS auction_listings(id bigserial PRIMARY KEY,seller_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,seller_name varchar(24) NOT NULL,
   category varchar(24) NOT NULL,name varchar(80) NOT NULL,gender varchar(8),goods jsonb NOT NULL,currency varchar(8) NOT NULL,price bigint NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,status varchar(10) NOT NULL DEFAULT 'active',
   buyer_id uuid,buyer_name varchar(24),closed_at timestamptz,seen_at timestamptz);
  CREATE INDEX IF NOT EXISTS auction_active ON auction_listings(category,created_at DESC) WHERE status='active';
  CREATE INDEX IF NOT EXISTS auction_seller ON auction_listings(seller_id,status);
 `);}
 async list(query:AuctionQuery):Promise<AuctionPage>{
  const leaves=query.category?categoryLeaves(query.category):null,search=(query.search??'').trim();
  const params:unknown[]=[query.gender];const where=[`status='active'`,`expires_at>now()`,`(gender IS NULL OR gender='unisex' OR gender=$1)`];
  if(leaves){params.push(leaves);where.push(`category=ANY($${params.length}::text[])`);}
  if(search){params.push(`%${search.replace(/[\\%_]/g,m=>`\\${m}`)}%`);where.push(`name ILIKE $${params.length}`);}
  const count=await this.pool.query(`SELECT count(*)::int AS n FROM auction_listings WHERE ${where.join(' AND ')}`,params);
  const total=count.rows[0].n as number,pages=Math.max(1,Math.ceil(total/AUCTION_PAGE_SIZE)),page=Math.min(query.page,pages);
  const rows=await this.pool.query(`SELECT * FROM auction_listings WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ${AUCTION_PAGE_SIZE} OFFSET ${(page-1)*AUCTION_PAGE_SIZE}`,params);
  return {listings:rows.rows.map(listing),total,page,pages,category:query.category??null,search};
 }
 async mine(playerId:string):Promise<AuctionMine>{
  const active=await this.pool.query(`SELECT * FROM auction_listings WHERE seller_id=$1 AND status='active' ORDER BY created_at DESC`,[playerId]);
  const closed=await this.pool.query(`SELECT * FROM auction_listings WHERE seller_id=$1 AND status IN ('sold','expired') ORDER BY closed_at DESC LIMIT 20`,[playerId]);
  const unseen=await this.pool.query(`SELECT count(*)::int AS n FROM auction_listings WHERE seller_id=$1 AND status IN ('sold','expired') AND seen_at IS NULL`,[playerId]);
  return {listings:active.rows.map(listing),notices:closed.rows.map(notice),unseen:unseen.rows[0].n};
 }
 async seen(playerId:string){await this.pool.query(`UPDATE auction_listings SET seen_at=now() WHERE seller_id=$1 AND status IN ('sold','expired') AND seen_at IS NULL`,[playerId]);}
 private async transaction<T>(work:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
  const c=await this.pool.connect();try{await c.query('BEGIN');const result=await work(c);await c.query('COMMIT');return result;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 private async lockPlayer(c:pg.PoolClient,id:string){
  const r=await c.query('SELECT profile,name FROM players WHERE id=$1 FOR UPDATE',[id]);if(!r.rows[0])throw Error('Jogador não encontrado.');
  return normalizeProfile({...r.rows[0].profile,name:r.rows[0].name});
 }
 async sell(playerId:string,order:SellOrder){
  return this.transaction(async c=>{
   const profile=await this.lockPlayer(c,playerId);
   const active=await c.query(`SELECT count(*)::int AS n FROM auction_listings WHERE seller_id=$1 AND status='active'`,[playerId]);
   const goods=checkSale(profile,active.rows[0].n,order);
   const gender=goods.kind==='item'?CATALOG[goods.item]?.gender??'unisex':null;
   const r=await c.query(`INSERT INTO auction_listings(seller_id,seller_name,category,name,gender,goods,currency,price,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+make_interval(hours=>$9)) RETURNING *`,
    [playerId,profile.name,goodsCategory(goods),goodsName(goods),gender,JSON.stringify(goods),order.currency,order.price,order.hours]);
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[playerId,profile]);
   return {profile,listing:listing(r.rows[0])};
  });
 }
 async buy(playerId:string,id:number,currency:AuctionCurrency,price:number){
  return this.transaction(async c=>{
   const r=await c.query(`SELECT * FROM auction_listings WHERE id=$1 AND status='active' AND expires_at>now() FOR UPDATE`,[id]);
   if(!r.rows[0])throw Error('Este item já foi vendido ou saiu do leilão.');
   const sold=listing(r.rows[0]),profile=await this.lockPlayer(c,playerId);
   checkPurchase(profile,sold,currency,price);
   await c.query('UPDATE players SET profile=$2 WHERE id=$1',[playerId,profile]);
   await c.query(`UPDATE auction_listings SET status='sold',buyer_id=$2,buyer_name=$3,closed_at=now() WHERE id=$1`,[id,playerId,profile.name]);
   await insertMail(c,{playerId:sold.sellerId,sender:'Leilão',subject:`Vendido: ${goodsName(sold.goods)}`.slice(0,60),
    body:`${profile.name} comprou ${goodsName(sold.goods)} por ${priceLabel(currency,price)}. O pagamento está anexado.`,attachments:[paymentAttachment(currency,price)],createdBy:'auction'});
   return {profile,listing:sold};
  });
 }
 async cancel(playerId:string,id:number){
  return this.transaction(async c=>{
   const r=await c.query(`SELECT * FROM auction_listings WHERE id=$1 AND seller_id=$2 AND status='active' FOR UPDATE`,[id,playerId]);
   if(!r.rows[0])throw Error('Este anúncio já foi encerrado.');
   const own=listing(r.rows[0]);
   await c.query(`UPDATE auction_listings SET status='cancelled',closed_at=now(),seen_at=now() WHERE id=$1`,[id]);
   await insertMail(c,{playerId,sender:'Leilão',subject:`Anúncio retirado: ${goodsName(own.goods)}`.slice(0,60),body:'Você retirou este anúncio do leilão. O item voltou para você.',attachments:[goodsAttachment(own.goods)],createdBy:'auction'});
   return own;
  });
 }
 async expireDue(){
  return this.transaction(async c=>{
   const r=await c.query(`SELECT * FROM auction_listings WHERE status='active' AND expires_at<=now() ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED`);
   for(const row of r.rows){
    const own=listing(row);
    await c.query(`UPDATE auction_listings SET status='expired',closed_at=now() WHERE id=$1`,[own.id]);
    await insertMail(c,{playerId:own.sellerId,sender:'Leilão',subject:`Não vendido: ${goodsName(own.goods)}`.slice(0,60),body:'O tempo do anúncio acabou sem comprador. O item voltou para você.',attachments:[goodsAttachment(own.goods)],createdBy:'auction'});
   }
   return [...new Set(r.rows.map(row=>row.seller_id as string))];
  });
 }
}
