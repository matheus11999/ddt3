import {z} from 'zod';
import {CATALOG,isEmptyItem,MAX_UPGRADE,STONES,WEAPONS} from './catalog';
import {COMPOSITION_STONE_BY_ID} from './composition';

/**
 * Player mail ("Correio"): an inbox like e-mail, with sender, subject, text and attachments.
 * The admin panel sends messages, coins and items through it; attachments are claimed on the
 * server, once (docs/mail.md).
 */
export type MailAttachment=
 | {kind:'coins';amount:number}
 | {kind:'item';item:string;quantity:number;/** Forge level of a weapon (each copy). */upgrade?:number}
 | {kind:'stone';level:number;amount:number}
 | {kind:'composition';stone:string;amount:number}
 | {kind:'ticket';amount:number};
export interface MailMessage {id:number;sender:string;subject:string;body:string;createdAt:string;read:boolean;/** Attachments already received (a message without attachments is never "claimed"). */claimed:boolean;attachments:MailAttachment[];}
export interface MailClaimResult {claimed:number[];attachments:MailAttachment[];}

export const MAIL_SUBJECT_MAX=60,MAIL_BODY_MAX=1000,MAIL_ATTACHMENTS_MAX=10,MAIL_SENDER_MAX=32;
/** Inbox size the game shows; older messages stay in the database. */
export const MAIL_INBOX_LIMIT=100;
export const MAIL_COINS_MAX=10_000_000,MAIL_AMOUNT_MAX=9999,MAIL_ITEM_COPIES_MAX=10;
export const MAIL_DEFAULT_SENDER='Equipe Brasa';

const amount=(max:number)=>z.number().int().min(1).max(max);
export const mailAttachmentSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('coins'),amount:amount(MAIL_COINS_MAX)}).strict(),
 z.object({kind:z.literal('item'),item:z.string().min(1).max(40).refine(id=>Object.hasOwn(CATALOG,id)&&!isEmptyItem(id),'Item não existe no jogo.'),quantity:amount(MAIL_ITEM_COPIES_MAX),upgrade:z.number().int().min(0).max(MAX_UPGRADE).optional()}).strict(),
 z.object({kind:z.literal('stone'),level:z.number().int().min(1).max(STONES.length),amount:amount(MAIL_AMOUNT_MAX)}).strict(),
 z.object({kind:z.literal('composition'),stone:z.string().refine(id=>Object.hasOwn(COMPOSITION_STONE_BY_ID,id),'Pedra de composição inválida.'),amount:amount(MAIL_AMOUNT_MAX)}).strict(),
 z.object({kind:z.literal('ticket'),amount:amount(MAIL_AMOUNT_MAX)}).strict(),
]);
/** What the admin panel posts to send one message to one player. */
export const mailSendSchema=z.object({
 sender:z.string().trim().min(1).max(MAIL_SENDER_MAX).optional(),
 subject:z.string().trim().min(1,'Escreva um assunto.').max(MAIL_SUBJECT_MAX),
 body:z.string().trim().max(MAIL_BODY_MAX).default(''),
 attachments:z.array(mailAttachmentSchema).max(MAIL_ATTACHMENTS_MAX).default([]),
}).strict().refine(mail=>!mail.attachments.some(a=>a.kind==='item'&&a.upgrade!==undefined&&!WEAPONS.some(w=>w.id===a.item)),'Só armas têm nível de forja.');
export type MailSend=z.infer<typeof mailSendSchema>;

const ROMAN=['I','II','III','IV','V'];
/** How an attachment is read out in the inbox and the admin panel: "500 Moedas Brasa", "Boné Relâmpago ×2". */
export function attachmentLabel(a:MailAttachment):string{
 switch(a.kind){
  case 'coins':return `${a.amount.toLocaleString('pt-BR')} Moedas Brasa`;
  case 'item':{const name=CATALOG[a.item]?.name??a.item;return `${name}${a.upgrade?` +${a.upgrade}`:''}${a.quantity>1?` ×${a.quantity}`:''}`;}
  case 'stone':return `${a.amount}× Pedra de Fortificação ${ROMAN[a.level-1]??a.level}`;
  case 'composition':return `${a.amount}× ${COMPOSITION_STONE_BY_ID[a.stone]?.name??a.stone}`;
  case 'ticket':return `${a.amount}× Ticket de Cor`;
 }
}
