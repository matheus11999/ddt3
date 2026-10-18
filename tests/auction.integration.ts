// Leilão against a real Postgres (DATABASE_URL or the local brasa database): goods are never duplicated or sold twice.
import assert from 'node:assert/strict';
import {Store} from '../server/store';
import {MailStore} from '../server/mail';
import {AuctionStore} from '../server/auction';

const store=new Store();await store.init();
const mail=new MailStore(store.pool);await mail.init();
const auction=new AuctionStore(store.pool);await auction.init();
try{
 const seller=(await store.createGuest('female')).profile,buyer=(await store.createGuest('female')).profile,rival=(await store.createGuest('female')).profile;
 await mail.send({playerId:seller.id,subject:'Arma',body:'',attachments:[{kind:'item',item:'brick',quantity:1,upgrade:10}],createdBy:'teste'});
 await mail.claim(seller.id,null);
 for(const id of [buyer.id,rival.id]){await mail.send({playerId:id,subject:'Cupons',body:'',attachments:[{kind:'coupons',amount:1000}],createdBy:'teste'});await mail.claim(id,null);}
 assert.equal((await store.getProfile(buyer.id))!.coupons,1000);

 // Worn items stay home; the forged copy goes up with its level, and the fee is paid in gold.
 await assert.rejects(auction.sell(seller.id,{source:{kind:'item',key:'brick'},currency:'coupons',price:300,hours:2}),/Desequipe/);
 const listed=await auction.sell(seller.id,{source:{kind:'item',key:'brick~2'},currency:'coupons',price:300,hours:2});
 assert.equal(listed.listing.goods.kind,'item');assert.deepEqual(listed.listing.goods,{kind:'item',item:'brick',upgrade:10});
 assert.ok(!listed.profile.inventory.includes('brick~2'));assert.equal(listed.profile.gold,seller.gold-20);
 await auction.sell(seller.id,{source:{kind:'stone',level:1,amount:5},currency:'gold',price:50,hours:8});
 const stoneListing=(await auction.sell(seller.id,{source:{kind:'stone',level:2,amount:3},currency:'gold',price:90,hours:24})).listing;
 await assert.rejects(auction.sell(seller.id,{source:{kind:'stone',level:3,amount:1},currency:'gold',price:9,hours:2}),/já tem 3 itens/);
 const after=(await store.getProfile(seller.id))!;assert.equal(after.stones['1'],seller.stones['1']-5);assert.equal(after.gold,seller.gold-20-50-100);

 const page=await auction.list({category:'weapons',page:1,gender:'female'});assert.ok(page.listings.some(l=>l.id===listed.listing.id));
 assert.ok(!(await auction.list({category:'stones',page:1,gender:'female'})).listings.some(l=>l.id===listed.listing.id));
 assert.ok((await auction.list({page:1,search:'tijolos',gender:'female'})).listings.some(l=>l.id===listed.listing.id));

 // Two buyers at once: one gets it, the other is told it is gone.
 await assert.rejects(auction.buy(buyer.id,listed.listing.id,'coupons',200),/mudou/);
 const races=await Promise.allSettled([auction.buy(buyer.id,listed.listing.id,'coupons',300),auction.buy(rival.id,listed.listing.id,'coupons',300)]);
 assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
 const winner=races[0].status==='fulfilled'?buyer.id:rival.id,loser=winner===buyer.id?rival.id:buyer.id;
 const bought=(await store.getProfile(winner))!;assert.equal(bought.coupons,700);assert.equal(bought.upgrades['brick~2'],10);
 assert.equal((await store.getProfile(loser))!.coupons,1000);
 await assert.rejects(auction.buy(seller.id,stoneListing.id,'gold',90),/é seu/);

 // The seller is paid by mail and sees the notice.
 let box=await mail.inbox(seller.id);assert.deepEqual(box.mails[0].attachments,[{kind:'coupons',amount:300}]);
 await mail.claim(seller.id,[box.mails[0].id]);assert.equal((await store.getProfile(seller.id))!.coupons,300);
 let mine=await auction.mine(seller.id);assert.equal(mine.listings.length,2);assert.equal(mine.unseen,1);assert.equal(mine.notices[0].kind,'sold');
 await auction.seen(seller.id);assert.equal((await auction.mine(seller.id)).unseen,0);

 // Withdrawn and expired listings come back by mail.
 await auction.cancel(seller.id,stoneListing.id);await assert.rejects(auction.cancel(seller.id,stoneListing.id),/encerrado/);
 await store.pool.query(`UPDATE auction_listings SET expires_at=now()-interval '1 minute' WHERE seller_id=$1 AND status='active'`,[seller.id]);
 assert.ok((await auction.expireDue()).includes(seller.id));
 mine=await auction.mine(seller.id);assert.equal(mine.listings.length,0);assert.equal(mine.unseen,1);
 const stones=(await store.getProfile(seller.id))!.stones;await mail.claim(seller.id,null);
 const back=(await store.getProfile(seller.id))!;assert.equal(back.stones['1'],stones['1']+5);assert.equal(back.stones['2'],stones['2']+3);
 box=await mail.inbox(seller.id);assert.ok(box.mails.some(m=>m.subject.startsWith('Não vendido')));
 console.log('auction integration ok');
}finally{await store.pool.end();}
