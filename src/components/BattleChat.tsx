import {useEffect,useRef,useState} from 'react';
import {MessageCircle,Send} from 'lucide-react';
import {client,useGame} from '../client';
import {playerMenuProps} from './PlayerActions';
import './BattleChat.css';

/** Lines stay this long over the battlefield before fading. */
const LOG_MS=12000;
const typing=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]');

/** Battle chat (DDTank style): Enter opens a small line to write in the Sala channel, which every fighter of
 * the match reads; the last lines float at the lower left and the balloon goes over the writer's head. */
export function BattleChat(){
 const {chat,offset,profile}=useGame(),[open,setOpen]=useState(false),[text,setText]=useState(''),[,tick]=useState(0),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.key!=='Enter'||open||typing(e.target))return;e.preventDefault();setOpen(true);};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);},[open]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>input.current?.focus());},[open]);
 const now=Date.now()+offset,lines=chat.filter(m=>(m.channel==='room'||m.channel==='private')&&(open||now-m.time<LOG_MS)).slice(open?-8:-4);
 const send=()=>{const value=text.trim();if(value)client.send({type:'chat',channel:'room',text:value});setText('');setOpen(false);};
 return <div className={`battle-chat ${open?'open':''}`} aria-label="Conversa da batalha">
  {lines.length>0&&<div className="battle-chat-log" aria-live="polite">{lines.map(m=>{const age=now-m.time,fade=open?1:Math.max(0,Math.min(1,(LOG_MS-age)/1500));const mine=m.playerId===profile?.id;
   return <p key={m.id} className={m.channel==='private'?'private':undefined} style={{opacity:fade}}><strong {...playerMenuProps(m.playerId&&!mine?{id:m.playerId,name:m.name,context:'battle'}:null)}>{m.channel==='private'?(mine?`Para ${m.toName}`:`De ${m.name}`):m.name}:</strong> {m.text}</p>;})}</div>}
  {open?<form className="battle-chat-input" onSubmit={e=>{e.preventDefault();send();}}><input ref={input} aria-label="Mensagem para a sala" maxLength={180} placeholder="Escreva para a sala…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setText('');setOpen(false);}}} onBlur={()=>{if(!text.trim())setOpen(false);}}/><button aria-label="Enviar para a sala"><Send size={14}/></button></form>
  :<button type="button" className="battle-chat-open" aria-label="Abrir conversa (Enter)" title="Conversar (Enter)" onClick={()=>setOpen(true)}><MessageCircle size={16}/></button>}
 </div>;
}
