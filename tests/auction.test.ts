import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {checkPurchase,checkSale,goodsAttachment,takeGoods} from '../server/auction';
import type {AuctionHouse} from '../server/auction';
import {applyAttachments} from '../server/mail';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {AUCTION_MAX_LISTINGS,categoryLeaves,goodsCategory,goodsName,timeLeft} from '../shared/auction';
import type {AuctionListing} from '../shared/auction';
import {commandSchema} from '../shared/protocol';
import type {Profile,ServerEvent} from '../shared/protocol';

const player=(gender:'male'|'female'='female',gold=500)=>normalizeProfile({id:randomUUID(),name:'Leiloeira',gender,gold});

test('the menu groups expand into leaf categories and goods land in theirs',()=>{
 assert.deepEqual(categoryLeaves('beauty'),['face','glasses','hair','bubble']);
 assert.deepEqual(categoryLeaves('stone-3'),['stone-3']);assert.deepEqual(categoryLeaves('nada'),[]);
 assert.equal(goodsCategory({kind:'item',item:'hat-mage'}),'hat');assert.equal(goodsCategory({kind:'stone',level:4,amount:2}),'stone-4');
 assert.equal(goodsCategory({kind:'composition',stone:'armor-3',amount:1}),'composition-3');
 assert.equal(goodsCategory({kind:'item',item:'ring-ember'}),null,'rings have no auction category yet');
 assert.equal(goodsName({kind:'item',item:'brick',upgrade:12}),'Quebra-Tijolos +12');
 assert.equal(timeLeft(Date.now()+(2*60+5)*60_000+500,Date.now()),'2h 05min');
});

test('a listed copy leaves the bag with its forge level, compositions and color, and arrives whole',()=>{
 const seller=player();
 assert.throws(()=>takeGoods(seller,{kind:'item',key:seller.equipment.weapon}),/Desequipe/);
 if(!seller.inventory.includes('brick'))applyAttachments(seller,[{kind:'item',item:'brick',quantity:1}]);
 applyAttachments(seller,[{kind:'item',item:'brick',quantity:1,upgrade:12}]);seller.compositions['brick~2']={attack:20};
 const goods=takeGoods(seller,{kind:'item',key:'brick~2'});
 assert.deepEqual(goods,{kind:'item',item:'brick',upgrade:12,compositions:{attack:20}});assert.ok(!seller.inventory.includes('brick~2'));
 const buyer=player();applyAttachments(buyer,[goodsAttachment(goods)]);
 assert.equal(buyer.upgrades['brick~2'],12);assert.deepEqual(buyer.compositions['brick~2'],{attack:20});
 assert.throws(()=>takeGoods(seller,{kind:'stone',level:1,amount:9999}),/pedras/);
});

test('selling costs the gold fee, respects the listing limit; buying checks price, gender and balance',()=>{
 const seller=player('female',60),stones=seller.stones['2'];
 assert.throws(()=>checkSale(seller,AUCTION_MAX_LISTINGS,{source:{kind:'stone',level:2,amount:1},currency:'gold',price:5,hours:2}),/já tem 3/);
 assert.throws(()=>checkSale(seller,0,{source:{kind:'stone',level:2,amount:1},currency:'gold',price:5,hours:24}),/custa 100/);
 const goods=checkSale(seller,0,{source:{kind:'stone',level:2,amount:4},currency:'coupons',price:5,hours:8});
 assert.equal(seller.gold,10);assert.equal(seller.stones['2'],stones-4);
 const listing:AuctionListing={id:1,sellerId:seller.id,sellerName:'Ária',goods,currency:'coupons',price:40,createdAt:'',expiresAt:''};
 const buyer=player();
 assert.throws(()=>checkPurchase(buyer,listing,'coupons',40),/Cupons insuficientes/);
 buyer.coupons=50;assert.throws(()=>checkPurchase(buyer,listing,'gold',40),/mudou/);
 checkPurchase(buyer,listing,'coupons',40);assert.equal(buyer.coupons,10);
 const male=player('male');male.coupons=99;
 assert.throws(()=>checkPurchase(male,{...listing,goods:{kind:'item',item:'hat-mage'}},'coupons',40),/gênero/);
 assert.throws(()=>checkPurchase(seller,listing,'coupons',40),/é seu/);
});

test('auction and private chat commands are validated',()=>{
 assert.ok(commandSchema.safeParse({type:'auction-list',page:1,category:'clothing'}).success);
 assert.equal(commandSchema.safeParse({type:'auction-list',page:1,category:'joias'}).success,false);
 assert.ok(commandSchema.safeParse({type:'auction-sell',source:{kind:'item',key:'hat-mage~2'},currency:'coupons',price:10,hours:24}).success);
 assert.equal(commandSchema.safeParse({type:'auction-sell',source:{kind:'item',key:'hat-mage'},currency:'coupons',price:10,hours:3}).success,false);
 assert.equal(commandSchema.safeParse({type:'auction-sell',source:{kind:'item',key:'hat-mage'},currency:'diamante',price:10,hours:2}).success,false);
 assert.equal(commandSchema.safeParse({type:'auction-buy',id:1,currency:'gold',price:0}).success,false);
 assert.ok(commandSchema.safeParse({type:'chat',text:'oi',channel:'private',to:randomUUID()}).success);
});

function fixture(){
 const events=new Map<string,ServerEvent[]>(),profiles=new Map<string,Profile>();
 const store={getProfile:async(id:string)=>structuredClone(profiles.get(id)??null),finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store);
 const listings:AuctionListing[]=[];let next=1;const sold:string[]=[];
 const house:AuctionHouse={
  list:async()=>({listings:structuredClone(listings),total:listings.length,page:1,pages:1,category:null,search:''}),
  mine:async id=>({listings:listings.filter(l=>l.sellerId===id),notices:[],unseen:sold.filter(s=>s===id).length}),
  seen:async()=>{},
  sell:async(id,order)=>{const p=profiles.get(id)!;const goods=checkSale(p,listings.filter(l=>l.sellerId===id).length,order);const listing={id:next++,sellerId:id,sellerName:p.name,goods,currency:order.currency,price:order.price,createdAt:'',expiresAt:''};listings.push(listing);return {profile:structuredClone(p),listing};},
  buy:async(id,listingId,currency,price)=>{const l=listings.find(x=>x.id===listingId);if(!l)throw Error('Este item já foi vendido ou saiu do leilão.');const p=profiles.get(id)!;checkPurchase(p,l,currency,price);listings.splice(listings.indexOf(l),1);sold.push(l.sellerId);return {profile:structuredClone(p),listing:l};},
  cancel:async(_id,listingId)=>listings.splice(listings.findIndex(l=>l.id===listingId),1)[0],
  expireDue:async()=>[],
 };
 game.auction=house;
 const join=(p:Profile)=>{profiles.set(p.id,p);events.set(p.id,[]);game.connect(structuredClone(p),event=>events.get(p.id)!.push(structuredClone(event)));};
 const last=<T extends ServerEvent['type']>(id:string,type:T)=>events.get(id)!.filter(e=>e.type===type).at(-1) as Extract<ServerEvent,{type:T}>|undefined;
 return {game,join,last};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,5));

test('a sale updates the seller live; a purchase rings the seller bell',async()=>{
 const {game,join,last}=fixture();const seller=player(),buyer={...player(),coupons:100};join(seller);join(buyer);await settle();
 await game.command(seller.id,{type:'auction-sell',source:{kind:'stone',level:1,amount:2},currency:'coupons',price:60,hours:2});
 assert.equal(last(seller.id,'auction-result')?.result.action,'sell');assert.equal(last(seller.id,'profile')?.profile.gold,480);
 assert.equal(last(seller.id,'auction-mine')?.listings.length,1);
 await game.command(buyer.id,{type:'auction-list',page:1});const id=last(buyer.id,'auction-page')!.page.listings[0].id;
 await game.command(buyer.id,{type:'auction-buy',id,currency:'coupons',price:60});
 assert.equal(last(buyer.id,'profile')?.profile.coupons,40);assert.equal(last(seller.id,'auction-mine')?.unseen,1);
 await game.command(buyer.id,{type:'auction-buy',id,currency:'coupons',price:60});
 assert.match(last(buyer.id,'error')?.message??'',/já foi vendido/);
});

test('private messages reach only the two players',async()=>{
 const {game,join,last}=fixture();const a=player(),b=player(),c=player();join(a);join(b);join(c);await settle();
 await game.command(a.id,{type:'chat',text:'Faz por 50?',channel:'private',to:b.id});
 assert.equal(last(b.id,'chat')?.message.toName,b.name);assert.equal(last(a.id,'chat')?.message.channel,'private');assert.equal(last(c.id,'chat'),undefined);
 await game.command(a.id,{type:'chat',text:'oi',channel:'private'});assert.match(last(a.id,'error')?.message??'',/Escolha/);
});
