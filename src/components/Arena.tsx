import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bot,Check,Crown,Eye,LoaderCircle,LogOut,LockKeyhole,LockKeyholeOpen,Pencil,Shield,Swords,WifiOff,X} from 'lucide-react';
import {normalizeAbilityLoadout} from '../../shared/abilities';
import type {Seat} from '../../shared/protocol';
import {client,useGame} from '../client';
import {Chat} from './Hud';
import {Avatar} from './Avatar';
import {AbilityPreparation} from './AbilitySlots';
import {LevelBadge} from './LevelBadge';
import {RoomInvitations} from './RoomInvitations';
import {RoomSpectators} from './RoomSpectators';
import './ArenaTheme.css';
import './Arena.css';

const SLOT_INDICES=[0,1,2,3] as const;
export {Arena} from './ArenaHall';

function ArenaVip({active=false}:{active?:boolean}){
 return <span className={`party-vip ${active?'vip-active':'vip-inactive'}`} role="img" aria-label={active?'VIP ativo':'VIP inativo'} title={active?'VIP ativo':'VIP inativo'}><Crown size={16} strokeWidth={1.8} aria-hidden="true"/></span>;
}

function PlayerCard({seat,slot,open,hostId,mine,canManage}:{seat:Seat|undefined;slot:number;open:boolean;hostId:string;mine:boolean;canManage:boolean}){
 const owner=seat?.id===hostId,ready=!!seat&&(seat.ready||owner);
 return <article className={`arena-player-card party-player-card ${seat?'occupied':open?'vacant open-slot':'vacant closed-slot'} ${mine?'is-me':''}`} data-slot={slot} data-slot-state={seat?'occupied':open?'open':'closed'} aria-label={`Sua equipe, posição ${slot+1}, ${seat?.name??(open?'vaga aberta':'vaga fechada')}`}>
  {seat?<><header className="party-player-name"><div className="party-player-identity">{owner&&<Crown size={11} aria-label="Líder da sala"/>}<strong title={seat.name}>{seat.name}</strong>{!seat.connected&&<WifiOff size={11} aria-label="Reconectando"/>}</div>{canManage&&!owner&&<button className="party-kick" aria-label={`Expulsar ${seat.name}`} title="Expulsar da sala" onClick={()=>client.send({type:'kick',playerId:seat.id})}><X size={14}/></button>}</header>
   <div className="party-player-insignia"><LevelBadge level={seat.level} size={40}/><ArenaVip/></div>
   <div className="party-player-portrait"><Avatar equipment={seat.equipment} size={240} animated={false} auraAnimated showAura centerBody weaponSide={-1} weaponScale={0.72} weaponOffset={20} weaponVerticalOffset={12} groundedShadow/></div>
   {ready&&seat.connected&&<footer className="party-player-state ready" role="img" aria-label="Pronto" title="Pronto"><Check size={17} strokeWidth={3} aria-hidden="true"/></footer>}
  </>:<>
   <button type="button" className="party-slot-toggle" disabled={!canManage||slot===0} aria-label={`${open?'Fechar':'Abrir'} vaga ${slot+1}`} onClick={()=>client.send({type:'room-slot',slot,open:!open})}><span className="party-vacant-emblem" aria-hidden="true">{open?<LockKeyholeOpen size={48} strokeWidth={1.3}/>:<LockKeyhole size={48} strokeWidth={1.3}/>}</span></button>
  </>}
 </article>;
}

function PracticeConfirmation({size,onClose,onStart,enabled}:{size:number;onClose:()=>void;onStart:()=>void;enabled:boolean}){
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
 },[onClose]);
 return <div className="party-practice-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={panel} className="party-practice-dialog" role="dialog" aria-modal="true" aria-labelledby="practice-title" aria-describedby="practice-detail"><span className="party-practice-emblem"><Bot size={38}/></span><h2 id="practice-title">Treinar com bots?</h2><p id="practice-detail">Duas equipes de {size} {size===1?'jogador':'jogadores'}. Os bots preenchem as vagas livres.</p><div><button type="button" className="button quiet arena-action arena-action--subtle" onClick={onClose}>Voltar</button><button type="button" className="button gold arena-action arena-action--primary" disabled={!enabled} onClick={onStart}><Swords size={18}/>Começar treino</button></div></div></div>;
}

function RoomName({id,name,editable}:{id:string;name:string;editable:boolean}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(name);
 const input=useRef<HTMLInputElement>(null),pencil=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setEditing(false);setDraft(name);},[id,name,editable]);
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
 const finish=()=>{setEditing(false);pencil.current?.focus();};
 const save=()=>{const value=draft.trim();if(value.length<2||value.length>24)return;if(value!==name)client.send({type:'room-rename',name:value});finish();};
 return <div className="party-room-name">{editing?<form className="party-rename-form" onSubmit={event=>{event.preventDefault();save();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();finish();}}}><input ref={input} aria-label="Nome da sala" value={draft} maxLength={24} onChange={event=>setDraft(event.target.value)}/><button type="submit" aria-label="Confirmar nome da sala" disabled={draft.trim().length<2}><Check size={17}/></button><button type="button" aria-label="Cancelar alteração de nome" onClick={finish}><X size={16}/></button></form>:<><h1 title={name}>{name}</h1>{editable&&<button ref={pencil} className="party-rename-button" type="button" aria-label="Renomear sala" title="Renomear sala" onClick={()=>{setDraft(name);setEditing(true);}}><Pencil size={15}/></button>}</>}</div>;
}

function SearchInProgress({startedAt,offset,host,disabled,spectator=false}:{startedAt:number|undefined;offset:number;host:boolean;disabled:boolean;spectator?:boolean}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[startedAt]);
 const elapsed=Math.max(0,Math.floor((now+offset-(startedAt??now+offset))/1000)),time=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
 return <button className="button arena-action party-search-action is-searching" aria-label={spectator?'Buscando partida':host?'Cancelar busca':'Voltar a preparar'} disabled={disabled||spectator} onClick={()=>client.send({type:host?'cancel-queue':'ready'})}><span className="party-search-progress"><LoaderCircle size={22}/><strong>Buscando</strong><time>{time}</time></span><small>{spectator?'Aguardando partida':'Toque para parar'}</small></button>;
}

type RoomMenu='mail'|'quests'|'guild';
const ROOM_MENUS=[{id:'mail' as const,name:'Correio',art:'arena-mail.png'},{id:'quests' as const,name:'Missões',art:'arena-quests.png'},{id:'guild' as const,name:'Guilda',art:'arena-guild.png'}];
function RoomMenus({equippedOnce,matches,onInventory,disabled,online,onLeave}:{equippedOnce:boolean;matches:number;onInventory:()=>void;disabled:boolean;online:boolean;onLeave:()=>void}){
 const [open,setOpen]=useState<RoomMenu|null>(null),box=useRef<HTMLElement>(null),previous=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
  if(!open)return;
  const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!box.current?.contains(event.target))setOpen(null);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(null);previous.current?.focus();}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
 },[open]);
 const menu=ROOM_MENUS.find(entry=>entry.id===open);
 return <nav ref={box} className="party-room-actions party-bottom-actions" aria-label="Menus da sala"><button className="party-menu-button party-painted-menu" aria-label="Equipamentos" title="Equipamentos" disabled={disabled} onClick={()=>{setOpen(null);onInventory();}}><img src="/assets/ui/backpack-button.png" alt="" draggable={false}/></button>{ROOM_MENUS.map(entry=><button key={entry.id} className={`party-menu-button party-painted-menu ${open===entry.id?'active':''}`} aria-label={entry.name} title={entry.name} aria-expanded={open===entry.id} onClick={event=>{previous.current=event.currentTarget;setOpen(value=>value===entry.id?null:entry.id);}}><img src={`/assets/ui/${entry.art}`} alt="" draggable={false}/></button>)}<button className="party-menu-button party-leave-action" aria-label="Sair da sala" title="Sair da sala" disabled={!online} onClick={onLeave}><LogOut size={30}/></button>{menu&&<section className="party-menu-popover" role="dialog" aria-label={menu.name}><header><strong>{menu.name}</strong><button type="button" aria-label={`Fechar ${menu.name}`} onClick={()=>{setOpen(null);previous.current?.focus();}}><X size={17}/></button></header>{open==='quests'?<div className="party-quest-list"><button type="button" disabled={disabled} onClick={()=>{setOpen(null);onInventory();}}><span className={equippedOnce?'done':''}>{equippedOnce?<Check size={15}/>:'1'}</span><div><strong>Vista sua aventura</strong><small>Equipe um item na mochila</small></div></button><div><span className={matches>0?'done':''}>{matches>0?<Check size={15}/>:'2'}</span><div><strong>Entre na arena</strong><small>Conclua sua primeira batalha</small></div></div></div>:<p>Em breve</p>}</section>}</nav>;
}

export function RoomView({onInventory}:{onInventory:()=>void}){
 const {room,profile,status,offset,abilityLoadoutDraft,abilityLoadoutPending}=useGame(),[confirmPractice,setConfirmPractice]=useState(false);
 const closePractice=useCallback(()=>setConfirmPractice(false),[]);
 useEffect(()=>{setConfirmPractice(false);},[room?.id,room?.status]);
 if(!room||!profile)return null;
 const host=room.hostId===profile.id,me=room.players.find(seat=>seat.id===profile.id),spectator=(room.spectators??[]).some(player=>player.id===profile.id),waiting=room.status==='waiting',searching=room.status==='searching',online=status==='online';
 const members=room.players.filter(seat=>seat.team===(me?.team??0)),readyCount=members.filter(seat=>seat.connected&&(seat.ready||seat.id===room.hostId)).length,allReady=members.length>0&&readyCount===members.length;
 const canManage=host&&waiting&&online,canStart=canManage&&allReady&&!abilityLoadoutPending,canQueue=canStart&&members.length===room.openSlots.length;
 const message=searching?'':!online?'Reconectando à equipe…':spectator?'':allReady?(host?'':'Aguardando o líder.'):host?'Aguardando a equipe ficar pronta.':'Confirme quando estiver pronto.';
 const controls=<div className="party-room-actions party-primary-actions"><RoomSpectators players={room.spectators??[]} openSlots={room.spectatorSlots??[]} canManage={host&&online} onToggle={(slot,open)=>client.send({type:'room-spectator-slot',slot,open})} onKick={playerId=>client.send({type:'spectator-kick',playerId})}/>{!spectator&&<div className="party-invite-row"><RoomInvitations roomId={room.id} disabled={!canManage||members.length===room.openSlots.length}/>{host&&<button type="button" className="button light arena-action arena-action--icon party-practice-action" aria-label="Treinar com bots" title="Treinar com bots" disabled={!canStart} onClick={()=>setConfirmPractice(true)}><Bot size={20}/></button>}</div>}{searching?<SearchInProgress startedAt={room.searchStartedAt} offset={offset} host={host} disabled={!online} spectator={spectator}/>:spectator?<div className="party-spectator-status" role="status"><Eye size={18}/><span>Assistindo à sala</span></div>:host?<button className="button gold arena-action arena-action--primary party-search-action" aria-label="Buscar partida" disabled={!canQueue} onClick={()=>client.send({type:'queue'})}><Swords size={24}/><span>Início</span></button>:<button className={`button arena-action ${me?.ready?'light':'gold arena-action--primary'} party-search-action`} disabled={!waiting||!online||!me?.connected||abilityLoadoutPending} onClick={()=>client.send({type:'ready'})}><Check size={20}/>{me?.ready?'Cancelar pronto':'Estou pronto'}</button>}</div>;
 const content=<section className={`arena-room-stage compact-party-room party-room streamlined-room painted-room ${message?'has-status':''}`} aria-label={`Sala ${room.name}`}>
  <div className="party-room-body compact-party-layout"><section className="party-team" aria-label="Sua equipe"><div className="party-team-cards">{SLOT_INDICES.map(slot=><PlayerCard key={slot} seat={members.find(member=>member.slot===slot)} slot={slot} open={room.openSlots.includes(slot)} hostId={room.hostId} mine={members.find(member=>member.slot===slot)?.id===profile.id} canManage={canManage}/>)}</div></section>
   <div className="party-center-stage"><section className="party-pvp-banner" aria-label="Batalha PvP"><img src="/assets/ui/pvp-room-banner-v2.webp" alt="" draggable={false}/><h2 aria-label="Batalha PvP"><span aria-hidden="true">Batalha</span><strong aria-hidden="true" data-text="PvP">PvP</strong></h2><div className="party-pvp-caption"><h3>Junte-se ao campo de batalha</h3><p>Batalhas de até <strong>8 jogadores</strong></p><span>Mostre o seu poder e que vença o melhor</span></div></section></div>
   <aside className="party-match-panel"><header className="party-heading"><div className="party-room-number" role="img" aria-label={`Sala ${room.number}`}><span>Sala</span><strong data-value={room.number}>{room.number}</strong></div><RoomName id={room.id} name={room.name} editable={canManage}/></header><AbilityPreparation loadout={abilityLoadoutDraft??normalizeAbilityLoadout(profile.abilityLoadout)} disabled={spectator||!waiting||!online} pending={abilityLoadoutPending} onChange={slots=>client.setAbilityLoadout(slots)}/>{controls}<RoomMenus equippedOnce={profile.equippedOnce} matches={profile.matches} onInventory={onInventory} disabled={!waiting||!online} online={online} onLeave={()=>client.send({type:'leave'})}/></aside>
   <div className="party-chat arena-chat-pane"><Chat/></div>
  </div>
  {message&&<footer className="party-room-footer"><div className="party-room-status" role="status"><Shield size={15}/><span>{message}</span></div></footer>}
  {confirmPractice&&<PracticeConfirmation size={room.openSlots.length} onClose={closePractice} enabled={canStart} onStart={()=>{client.send({type:'practice-start'});setConfirmPractice(false);}}/>}
 </section>;
 return createPortal(<div className="arena-room-portal arena-theme">{content}</div>,document.body);
}
