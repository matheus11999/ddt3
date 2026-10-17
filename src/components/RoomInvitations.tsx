import {useEffect,useRef,useState} from 'react';
import {Check,LoaderCircle,RefreshCw,Send,UserPlus,X} from 'lucide-react';
import {client,useGame} from '../client';
import {LevelBadge} from './LevelBadge';
import './RoomInvitations.css';

export function RoomInvitations({roomId,disabled}:{roomId:string;disabled:boolean}){
 const {invitePlayers,inviteListRoomId,inviteResults}=useGame();
 const [open,setOpen]=useState(false),[now,setNow]=useState(Date.now()),[requestedAt,setRequestedAt]=useState(0),[sentAt,setSentAt]=useState<Record<string,number>>({});
 const box=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setOpen(false);setSentAt({});},[roomId,disabled]);
 useEffect(()=>{
  if(!open)return;
  close.current?.focus();
  const timer=window.setInterval(()=>setNow(Date.now()),500);
  const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!box.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
  return()=>{clearInterval(timer);document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
 },[open]);
 const refresh=()=>{const at=Date.now();setNow(at);setRequestedAt(at);client.send({type:'room-invite-list'});};
 const loading=inviteListRoomId!==roomId,failed=loading&&now-requestedAt>8000;
 const lastSent=Math.max(0,...Object.values(sentAt));
 return <div className="party-invite-wrap" ref={box}><button ref={trigger} type="button" className="button light arena-action party-invite-action" aria-expanded={open} disabled={disabled} onClick={()=>{if(!open)refresh();setOpen(value=>!value);}}><UserPlus size={20}/><span>Convidar</span></button>
  {open&&<section className="room-invitations" role="dialog" aria-label="Convidar para a sala"><header><strong>Jogadores online</strong><button type="button" aria-label="Atualizar jogadores" title="Atualizar jogadores" disabled={now-requestedAt<1100} onClick={refresh}><RefreshCw size={16} className={loading&&!failed?'loading':''}/></button><button ref={close} type="button" aria-label="Fechar convite" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={17}/></button></header>
   <div className="room-invitation-list" aria-live="polite">{loading?<p className="room-invitation-empty">{failed?'Não foi possível atualizar.':<><LoaderCircle size={18}/>Procurando jogadores…</>}</p>:invitePlayers.length===0?<p className="room-invitation-empty">Nenhum aventureiro disponível.</p>:invitePlayers.map(player=>{
    const result=[...inviteResults].reverse().find(entry=>entry.roomId===roomId&&entry.playerId===player.id),sent=sentAt[player.id]??0,pending=sent>0&&!result&&now-sent<8000,active=result?.status==='sent',cooling=now-sent<30000;
    const label=pending?'Enviando…':active?'Enviado':result?.status==='accepted'?'Aceito':result?.status==='declined'?'Recusado':result?.status==='expired'?'Expirou':result?.status==='unavailable'?'Indisponível':'';
    return <div key={player.id} className="room-invitation-player" data-invite-player={player.id}><LevelBadge level={player.level} size={32}/><div><strong title={player.name}>{player.name}</strong>{label&&<small>{label}</small>}</div><button type="button" className="arena-action arena-action--icon" aria-label={`Convidar ${player.name}`} title={label||'Enviar convite'} disabled={now-lastSent<2100||cooling||pending||active||result?.status==='accepted'} onClick={()=>{const at=Date.now();setNow(at);setSentAt(value=>({...value,[player.id]:at}));client.send({type:'room-invite',playerId:player.id});}}>{pending?<LoaderCircle size={18}/>:active||result?.status==='accepted'?<Check size={18}/>:<Send size={17}/>}</button></div>;
   })}</div>
  </section>}
 </div>;
}
