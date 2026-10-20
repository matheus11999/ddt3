import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {Game} from '../server/game';
import {applyAttachments} from '../server/mail';
import type {MailBox} from '../server/mail';
import {normalizeProfile} from '../server/store';
import type {ProfileStore} from '../server/store';
import {attachmentLabel,mailSendSchema} from '../shared/mail';
import type {MailAttachment,MailMessage} from '../shared/mail';
import {commandSchema} from '../shared/protocol';
import './fixtures/pets';
import type {Profile,ServerEvent} from '../shared/protocol';

test('attachments add coins, stones, tickets and one separate copy per item',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Carteiro',gender:'male',gold:100});
 const stones=p.stones['3'],tickets=p.colorTickets,composition=p.compositionStones['attack-2']??0,owned=p.inventory.includes('hat-thunder');
 applyAttachments(p,[{kind:'coins',amount:500},{kind:'stone',level:3,amount:4},{kind:'composition',stone:'attack-2',amount:2},{kind:'ticket',amount:5},
  {kind:'item',item:'hat-thunder',quantity:2},{kind:'item',item:'brick',quantity:1,upgrade:10}]);
 assert.equal(p.gold,600);assert.equal(p.stones['3'],stones+4);assert.equal(p.compositionStones['attack-2'],composition+2);assert.equal(p.colorTickets,tickets+5);
 assert.equal(p.inventory.filter(key=>key.split('~')[0]==='hat-thunder').length,owned?3:2);
 // The starter Quebra-Tijolos is already owned: the mailed one is a new copy with its own forge level.
 assert.ok(p.inventory.includes('brick~2'));assert.equal(p.upgrades['brick~2'],10);assert.equal(p.upgrades.brick,0);
});

test('the admin can only mail real items, within limits',()=>{
 const ok=mailSendSchema.safeParse({subject:'Presente',attachments:[{kind:'item',item:'hat-mage',quantity:1},{kind:'coins',amount:1000}]});
 assert.ok(ok.success);assert.equal(ok.data.body,'');
 for(const attachments of [[{kind:'item',item:'nada',quantity:1}],[{kind:'item',item:'hat-none',quantity:1}],[{kind:'item',item:'hat-mage',quantity:1,upgrade:3}],[{kind:'coins',amount:0}],[{kind:'stone',level:6,amount:1}],Array.from({length:11},()=>({kind:'coins',amount:1}))])
  assert.equal(mailSendSchema.safeParse({subject:'X',attachments}).success,false,JSON.stringify(attachments).slice(0,60));
 assert.equal(mailSendSchema.safeParse({subject:'  ',attachments:[]}).success,false);
 assert.equal(attachmentLabel({kind:'item',item:'brick',quantity:2,upgrade:12}),'Quebra-Tijolos +12 ×2');
 assert.equal(attachmentLabel({kind:'coins',amount:1500}),'1.500 Moedas Brasa');
});

test('mail commands are validated',()=>{
 assert.ok(commandSchema.safeParse({type:'mail-claim'}).success);
 assert.ok(commandSchema.safeParse({type:'mail-claim',id:3}).success);
 assert.equal(commandSchema.safeParse({type:'mail-claim',id:-1}).success,false);
 assert.equal(commandSchema.safeParse({type:'mail-delete'}).success,false);
});

function fixture(){
 const profiles=new Map<string,Profile>(),events=new Map<string,ServerEvent[]>();
 const store={getProfile:async(id:string)=>structuredClone(profiles.get(id)??null),finishMatch:async()=>{}} as unknown as ProfileStore,game=new Game(store);
 const letters:MailMessage[]=[];let nextId=1;
 const box:MailBox={
  inbox:async()=>({mails:structuredClone(letters),unread:letters.filter(m=>!m.read||!m.claimed&&m.attachments.length>0).length}),
  markRead:async(_player,id)=>{const m=letters.find(l=>l.id===id);if(m)m.read=true;},
  claim:async(player,ids)=>{
   const open=letters.filter(m=>!m.claimed&&m.attachments.length&&(!ids||ids.includes(m.id)));if(!open.length)throw Error('Nenhum anexo para receber.');
   const profile=profiles.get(player)!,attachments=open.flatMap(m=>m.attachments);applyAttachments(profile,attachments);for(const m of open){m.claimed=true;m.read=true;}
   return {profile:structuredClone(profile),result:{claimed:open.map(m=>m.id),attachments}};
  },
  remove:async(_player,id)=>{const at=letters.findIndex(m=>m.id===id);if(letters[at]&&!letters[at].claimed&&letters[at].attachments.length)throw Error('Receba os anexos antes de apagar a carta.');letters.splice(at,1);},
  removeRead:async()=>{const keep=letters.filter(m=>!m.read||!m.claimed&&m.attachments.length>0);const removed=letters.length-keep.length;letters.splice(0,letters.length,...keep);return removed;},
 };
 game.mail=box;
 const send=(attachments:MailAttachment[])=>{letters.unshift({id:nextId++,sender:'Equipe Brasa',subject:'Presente',body:'Oi',createdAt:new Date().toISOString(),read:false,claimed:false,attachments});};
 const a=normalizeProfile({id:randomUUID(),name:'Ária',gender:'female',gold:50});profiles.set(a.id,a);events.set(a.id,[]);
 const connect=()=>game.connect(structuredClone(a),event=>events.get(a.id)!.push(structuredClone(event)));
 const last=<T extends ServerEvent['type']>(type:T)=>events.get(a.id)!.filter(e=>e.type===type).at(-1) as Extract<ServerEvent,{type:T}>|undefined;
 return {game,a,send,connect,last,events,letters};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,5));

test('the inbox arrives on connect and new mail reaches an online player',async()=>{
 const {game,a,send,connect,last}=fixture();
 send([{kind:'coins',amount:10}]);connect();await settle();
 assert.equal(last('mail')?.mails.length,1);assert.equal(last('mail')?.unread,1);
 send([]);await game.mailArrived(a.id);
 assert.equal(last('mail')?.mails.length,2);assert.equal(last('mail')?.unread,2);
});

test('"Receber tudo" claims every letter once and updates the live profile',async()=>{
 const {game,a,send,connect,last,letters}=fixture();
 send([{kind:'coins',amount:300}]);send([{kind:'item',item:'hat-mage',quantity:1},{kind:'ticket',amount:2}]);send([]);
 connect();await settle();
 await game.command(a.id,{type:'mail-claim'});
 assert.equal(last('profile')?.profile.gold,350);assert.ok(last('profile')?.profile.inventory.includes('hat-mage'));
 assert.equal(last('mail-claim-result')?.result.claimed.length,2);
 assert.equal(last('mail')?.unread,1,'the letter without attachments is still unread');
 await game.command(a.id,{type:'mail-claim'});
 assert.equal(last('error')?.message,'Nenhum anexo para receber.');assert.equal(last('profile')?.profile.gold,350);
 await game.command(a.id,{type:'mail-read',id:3});await game.command(a.id,{type:'mail-delete',id:3});
 assert.equal(letters.length,2);assert.equal(last('mail')?.unread,0);
});

test('"Remover lidas" keeps unread letters and letters with attachments to receive',async()=>{
 const {game,a,send,connect,last,letters}=fixture();
 send([]);send([{kind:'coins',amount:10}]);send([]);send([{kind:'coins',amount:20}]);
 connect();await settle();
 for(const id of [1,2,4])await game.command(a.id,{type:'mail-read',id});
 await game.command(a.id,{type:'mail-claim',id:4});
 await game.command(a.id,{type:'mail-delete-read'});
 assert.deepEqual(letters.map(m=>m.id).sort(),[2,3],'unread letter 3 and unclaimed letter 2 stay');
 assert.deepEqual(last('mail')?.mails.map(m=>m.id).sort(),[2,3]);
 assert.ok(commandSchema.safeParse({type:'mail-delete-read'}).success);
 assert.equal(commandSchema.safeParse({type:'mail-delete-read',id:1}).success,false);
});

test('pet food arrives by mail and stacks; unknown food is refused by the panel and skipped on claim',()=>{
 const p=normalizeProfile({id:randomUUID(),name:'Ária',gender:'male'});
 assert.ok(mailSendSchema.safeParse({subject:'Comida',attachments:[{kind:'pet-food',food:'pet-food-test',amount:10}]}).success);
 assert.equal(mailSendSchema.safeParse({subject:'Comida',attachments:[{kind:'pet-food',food:'pet-food-nada',amount:10}]}).success,false);
 applyAttachments(p,[{kind:'pet-food',food:'pet-food-test',amount:10},{kind:'pet-food',food:'pet-food-test',amount:5},{kind:'pet-food',food:'pet-food-nada',amount:3}]);
 assert.equal(p.petFood['pet-food-test'],15);assert.equal(p.petFood['pet-food-nada'],undefined);
 assert.equal(attachmentLabel({kind:'pet-food',food:'pet-food-test',amount:10}),'10× Ração de teste');
});
