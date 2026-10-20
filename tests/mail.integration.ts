// Mail against a real Postgres (DATABASE_URL or the local brasa database): attachments arrive exactly once.
import assert from 'node:assert/strict';
import {Store} from '../server/store';
import {MailStore} from '../server/mail';
import {PlayerDirectory} from '../server/adminPlayers';

const store=new Store();await store.init();
const mail=new MailStore(store.pool);await mail.init();
const players=new PlayerDirectory(store.pool);
try{
 const {profile}=await store.createGuest('female');
 const gold=profile.gold;
 const first=await mail.send({playerId:profile.id,subject:'Moedas',body:'Para você',attachments:[{kind:'coins',amount:700}],createdBy:'teste'});
 await mail.send({playerId:profile.id,subject:'Chapéu',body:'',attachments:[{kind:'item',item:'hat-mage',quantity:2}],createdBy:'teste'});
 await mail.send({playerId:profile.id,subject:'Só um oi',body:'Bem-vinda',attachments:[],createdBy:'teste'});
 let box=await mail.inbox(profile.id);
 assert.equal(box.mails.length,3);assert.equal(box.unread,3);assert.equal(box.mails[0].subject,'Só um oi');

 // Two claims of the same letter at once (two tabs, a double click): only one gets the coins.
 const results=await Promise.allSettled([mail.claim(profile.id,[first]),mail.claim(profile.id,[first])]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await store.getProfile(profile.id))!.gold,gold+700);

 const all=await mail.claim(profile.id,null);
 assert.equal(all.result.claimed.length,1);assert.equal(all.profile.inventory.filter(k=>k.startsWith('hat-mage')).length,2);
 await assert.rejects(mail.claim(profile.id,null),/Nenhum anexo/);
 assert.equal((await store.getProfile(profile.id))!.gold,gold+700);

 await assert.rejects(mail.remove(profile.id,999999999),/Receba/);
 await mail.markRead(profile.id,box.mails[0].id);await mail.remove(profile.id,box.mails[0].id);
 box=await mail.inbox(profile.id);assert.equal(box.mails.length,2);assert.equal(box.unread,0);
 const history=await mail.history(profile.id);assert.equal(history.length,3);assert.ok(history.some(m=>m.deleted));

 // Remover lidas: the two claimed letters go; an unread one and a read one with coins to receive stay.
 const unread=await mail.send({playerId:profile.id,subject:'Nova',body:'',attachments:[],createdBy:'teste'});
 const gift=await mail.send({playerId:profile.id,subject:'Presente',body:'',attachments:[{kind:'coins',amount:5}],createdBy:'teste'});
 await mail.markRead(profile.id,gift);
 assert.equal(await mail.removeRead(profile.id),2);
 box=await mail.inbox(profile.id);assert.deepEqual(box.mails.map(m=>m.id).sort((x,y)=>x-y),[unread,gift]);

 const presence=new Map([[profile.id,'lobby' as const]]);
 const online=await players.list({online:true},presence);assert.equal(online.total,1);assert.equal(online.players[0].presence,'lobby');
 const found=await players.list({search:profile.name.slice(0,8),sort:'gold'},new Map());assert.ok(found.players.some(p=>p.id===profile.id));
 const byId=await players.list({search:profile.id},new Map());assert.equal(byId.players[0]?.id,profile.id);
 const detail=await players.get(profile.id,new Map());assert.equal(detail?.gold,gold+700);assert.equal(detail?.presence,'offline');
 console.log('mail integration ok');
}finally{await store.pool.end();}
