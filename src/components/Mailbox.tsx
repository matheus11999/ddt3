import {useEffect,useMemo,useState} from 'react';
import {Gift,Inbox,LoaderCircle,Mail,MailOpen,PackageCheck,Paperclip,Trash2} from 'lucide-react';
import {CATALOG,STONES} from '../../shared/catalog';
import {COMPOSITION_STONES} from '../../shared/composition';
import type {MailAttachment,MailMessage} from '../../shared/mail';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {CompositionIcon} from './CompositionIcon';
import {ItemCardFrame} from './ItemCard';
import type {ItemRarity} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {RewardIcon} from './RewardIcon';
import {UpgradeTag} from './UpgradeTag';
import './Backpack.css';
import './Mailbox.css';

const pending=(m:MailMessage)=>!m.claimed&&m.attachments.length>0;
const day=(iso:string)=>new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
const when=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

function attachmentName(a:MailAttachment){
 if(a.kind==='item')return CATALOG[a.item]?.name??'Item';
 if(a.kind==='coins')return 'Moedas Brasa';
 if(a.kind==='coupons')return 'Cupons';
 if(a.kind==='stone')return STONES[a.level-1]?.name??'Pedra de Fortificação';
 if(a.kind==='ticket')return 'Ticket de Cor';
 return COMPOSITION_STONES.find(s=>s.id===a.stone)?.name??'Pedra de composição';
}
const attachmentCount=(a:MailAttachment)=>a.kind==='item'?a.quantity:a.amount;

/** One attachment as a bag cell: painted art, forge level and the amount in the corner. */
function AttachmentCell({a,claimed}:{a:MailAttachment;claimed?:boolean}){
 const count=attachmentCount(a),name=attachmentName(a);
 const art=a.kind==='item'?<ItemIcon id={a.item} size={58} upgrade={a.upgrade??0}/>:a.kind==='composition'?<CompositionIcon stat={COMPOSITION_STONES.find(s=>s.id===a.stone)?.stat??'attack'} size={52}/>:<RewardIcon kind={a.kind==='coins'?'coins':a.kind} level={a.kind==='stone'?a.level:1} size={52}/>;
 const rarity=(a.kind==='item'?CATALOG[a.item]?.rarity:'common') as ItemRarity|undefined;
 return <div className={`mail-attachment ${claimed?'claimed':''}`} title={`${name}${count>1?` ×${count.toLocaleString('pt-BR')}`:''}`}>
  <ItemCardFrame rarity={rarity??'common'} variant="slot" className="mail-attachment-card">{art}{a.kind==="item"&&!!a.upgrade&&<UpgradeTag level={a.upgrade} size={34} className="bag-upgrade-tag"/>}{count>1&&<b className="mail-attachment-count">{count.toLocaleString('pt-BR')}</b>}{claimed&&<span className="mail-attachment-done"><PackageCheck size={18}/></span>}</ItemCardFrame>
  <small>{name}</small>
 </div>;
}

/** Correio: the player's inbox, like e-mail. Letters from the team carry coins and items to receive. */
export function Mailbox(){
 const {mails,mailLoaded,mailClaim,mailPending}=useGame();
 const [selected,setSelected]=useState<number|null>(null);
 const letter=mails.find(m=>m.id===selected)??null,toClaim=useMemo(()=>mails.filter(pending),[mails]);
 useEffect(()=>{if(selected!==null&&!mails.some(m=>m.id===selected))setSelected(null);},[mails,selected]);
 useEffect(()=>{if(selected===null&&mails.length)setSelected(mails[0].id);},[mails,selected]);
 useEffect(()=>{if(letter&&!letter.read)client.readMail(letter.id);},[letter?.id,letter?.read]);
 useEffect(()=>{if(!mailClaim)return;audio.play('click');const t=setTimeout(()=>client.update({mailClaim:null}),2600);return()=>clearTimeout(t);},[mailClaim]);
 const close=()=>client.closeMail();
 return <Modal title="Correio" onClose={close} className="bag-window mail-window" viewport>
  <div className="mail-layout">
   <section className="mail-pane mail-inbox" aria-label="Caixa de entrada">
    <header className="mail-head"><span className="mail-head-icon"><Inbox size={20}/></span><div><small>Caixa de entrada</small><h2>{mails.length} {mails.length===1?'carta':'cartas'}</h2></div></header>
    <ul className="mail-list wood-cream">{!mailLoaded?<li className="mail-empty"><LoaderCircle className="mail-spin" size={22}/>Abrindo o correio…</li>:mails.length?mails.map(m=><li key={m.id}><button className={`mail-row ${m.id===selected?'selected':''} ${m.read?'':'unread'}`} onClick={()=>{setSelected(m.id);audio.play('click');}}>
     <span className="mail-envelope">{m.read?<MailOpen size={19}/>:<Mail size={19}/>}</span>
     <span className="mail-row-text"><b>{m.subject}</b><small>{m.sender}</small></span>
     <span className="mail-row-side"><time>{day(m.createdAt)}</time>{pending(m)?<Gift className="mail-gift" size={16} aria-label="Com anexos para receber"/>:m.attachments.length?<Paperclip size={14} aria-label="Anexos recebidos"/>:null}</span>
    </button></li>):<li className="mail-empty"><Mail size={26}/>Nenhuma carta por enquanto.</li>}</ul>
    <button className="mail-claim-all" disabled={!toClaim.length||mailPending} onClick={()=>client.claimMail()}><Gift size={18}/>Receber tudo{toClaim.length>0&&<b>{toClaim.length}</b>}</button>
   </section>
   <section className="mail-pane mail-reader" aria-label="Carta">
    {letter?<>
     <header className="mail-letter-head wood-cream"><h2>{letter.subject}</h2><dl><div><dt>De</dt><dd>{letter.sender}</dd></div><div><dt>Recebida</dt><dd>{when(letter.createdAt)}</dd></div></dl></header>
     <article className="mail-letter wood-cream">{letter.body?letter.body.split('\n').map((line,i)=><p key={i}>{line||' '}</p>):<p className="mail-letter-quiet">Esta carta não tem texto.</p>}</article>
     <div className="mail-attachments wood-cream">
      <h3><Paperclip size={15}/>Anexos{letter.attachments.length>0&&<small>{letter.claimed?'recebidos':'para receber'}</small>}</h3>
      {letter.attachments.length?<div className="mail-attachment-grid">{letter.attachments.map((a,i)=><AttachmentCell key={i} a={a} claimed={letter.claimed}/>)}</div>:<p className="mail-letter-quiet">Sem anexos.</p>}
     </div>
     <footer className="mail-actions">
      <button className="mail-delete" disabled={pending(letter)} title={pending(letter)?'Receba os anexos antes de apagar':'Apagar carta'} onClick={()=>{client.deleteMail(letter.id);audio.play('click');}}><Trash2 size={16}/>Apagar</button>
      {pending(letter)&&<button className="mail-claim" disabled={mailPending} onClick={()=>client.claimMail(letter.id)}><Gift size={17}/>Receber</button>}
     </footer>
    </>:<div className="mail-reader-empty wood-cream"><MailOpen size={40}/><p>{mails.length?'Escolha uma carta para ler.':'Quando a equipe enviar presentes, eles chegam aqui.'}</p></div>}
   </section>
  </div>
  {mailClaim&&<div className="mail-received" role="status"><div><strong>Você recebeu</strong><div className="mail-attachment-grid">{mailClaim.attachments.slice(0,12).map((a,i)=><AttachmentCell key={i} a={a}/>)}</div>{mailClaim.attachments.length>12&&<small>e mais {mailClaim.attachments.length-12} anexos</small>}</div></div>}
 </Modal>;
}
