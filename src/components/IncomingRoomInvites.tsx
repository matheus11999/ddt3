import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Swords,X} from 'lucide-react';
import {client,useGame} from '../client';
import './IncomingRoomInvites.css';

export function IncomingRoomInvites(){
 const {roomInvitations,room,battle,status,offset,error}=useGame();
 const [now,setNow]=useState(Date.now()),[pending,setPending]=useState<string|null>(null);
 const invite=roomInvitations[0];
 useEffect(()=>{
  if(!invite)return;
  const tick=()=>{
   const time=Date.now();setNow(time);
   const current=client.state;
   const active=current.roomInvitations.filter(item=>item.expiresAt>time+current.offset);
   if(active.length!==current.roomInvitations.length)client.update({roomInvitations:active});
  };
  tick();const timer=window.setInterval(tick,1000);return()=>clearInterval(timer);
 },[invite?.id]);
 useEffect(()=>setPending(null),[invite?.id,error]);
 useEffect(()=>{if(!pending)return;const timer=setTimeout(()=>setPending(null),10000);return()=>clearTimeout(timer);},[pending]);
 if(!invite||room||battle||status!=='online')return null;
 const seconds=Math.max(0,Math.ceil((invite.expiresAt-now-offset)/1000));
 const answer=(accept:boolean)=>{setPending(invite.id);client.send({type:'room-invite-answer',inviteId:invite.id,accept});};
 return createPortal(<aside className="incoming-room-invite" role="dialog" aria-label="Convite para jogar">
  <header><span><Swords size={18}/>Convite para jogar</span><button type="button" aria-label="Recusar convite" disabled={!!pending} onClick={()=>answer(false)}><X size={17}/></button></header>
  <div className="incoming-invite-details"><strong>{invite.fromName}</strong><span>Sala {invite.roomNumber} · {invite.roomName}</span></div>
  <footer><small aria-label={`Convite expira em ${seconds} segundos`}>{seconds}s{roomInvitations.length>1?` · +${roomInvitations.length-1} convite(s)`:''}</small><button type="button" disabled={!!pending||seconds===0} onClick={()=>answer(true)}>{pending?'Entrando…':'Aceitar convite'}</button></footer>
 </aside>,document.body);
}
