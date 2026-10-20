import {useEffect,useRef,useState} from 'react';
import {MessageCircle,Send} from 'lucide-react';
import type {ChatChannel} from '../../shared/protocol';
import {client,useGame} from '../client';
import {playerMenuProps} from './PlayerActions';
import './BattleChat.css';

/** Channel tag and colour of each line, as DDTank prints them over the battle. */
const TAGS:Record<ChatChannel,string>={world:'Mundo',room:'Sala',guild:'Guilda',private:'Privado'};
const typing=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]');

/** Battle chat (DDTank style): the last lines of every channel stay as transparent text over the scenery at the
 * top left, under the portrait; Enter opens the line to write in the Sala channel, which every fighter of the
 * match reads, and the balloon goes over the writer's head. On a phone a small button opens it. */
export function BattleChat(){
 const {chat,profile}=useGame(),[open,setOpen]=useState(false),[text,setText]=useState(''),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.key!=='Enter'||open||typing(e.target))return;e.preventDefault();setOpen(true);};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);},[open]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>input.current?.focus());},[open]);
 const lines=chat.slice(open?-10:-6);
 const send=()=>{const value=text.trim();if(value)client.send({type:'chat',channel:'room',text:value});setText('');setOpen(false);};
 return <div className={`battle-chat ${open?'open':''}`} aria-label="Conversa da batalha">
  {lines.length>0&&<div className="battle-chat-log" aria-live="polite">{lines.map(m=>{const mine=m.playerId===profile?.id;
   return <p key={m.id} data-channel={m.channel}><span className="battle-chat-tag">[{TAGS[m.channel]}]</span> <strong {...playerMenuProps(m.playerId&&!mine?{id:m.playerId,name:m.name,context:'battle'}:null)}>{m.channel==='private'?(mine?`Para ${m.toName}`:`De ${m.name}`):m.name}:</strong> {m.text}</p>;})}</div>}
  {open?<form className="battle-chat-input" onSubmit={e=>{e.preventDefault();send();}}><input ref={input} aria-label="Mensagem para a sala" maxLength={180} placeholder="Escreva para a sala…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setText('');setOpen(false);}}} onBlur={()=>{if(!text.trim())setOpen(false);}}/><button aria-label="Enviar para a sala"><Send size={14}/></button></form>
  :<button type="button" className="battle-chat-open" aria-label="Abrir conversa (Enter)" title="Conversar (Enter)" onClick={()=>setOpen(true)}><MessageCircle size={16}/></button>}
 </div>;
}
