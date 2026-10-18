import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bot,Check,Crown,Eye,LoaderCircle,LogOut,LockKeyhole,Pencil,Shield,Swords,UserPlus,WifiOff,X} from 'lucide-react';
import {normalizeAbilityLoadout} from '../../shared/abilities';
import type {Seat} from '../../shared/protocol';
import {client,useGame} from '../client';
import {Chat} from './Hud';
import {Avatar} from './Avatar';
import {playerMenuProps} from './PlayerActions';
import {AbilityPreparation} from './AbilitySlots';
import {LevelBadge} from './LevelBadge';
import {VipBadge} from './VipBadge';
import {LevelNumber} from './LevelNumber';
import {RoomInvitations} from './RoomInvitations';
import {RoomSpectators} from './RoomSpectators';
import {ExpeditionRoom} from './ExpeditionRoom';
import './ArenaTheme.css';
import './Arena.css';

const SLOT_INDICES=[0,1,2,3] as const;
export {Arena} from './ArenaHall';

export function PlayerCard({seat,slot,open,hostId,mine,canManage}:{seat:Seat|undefined;slot:number;open:boolean;hostId:string;mine:boolean;canManage:boolean}){
 const owner=seat?.id===hostId,ready=!!seat&&(seat.ready||owner);
 return <article className={`arena-player-card party-player-card pr-card ${seat?'occupied':open?'vacant open-slot':'vacant closed-slot'} ${mine?'is-me':''}`} data-slot={slot} data-slot-state={seat?'occupied':open?'open':'closed'} {...playerMenuProps(seat?{id:seat.id,name:seat.name,context:'room'}:null)} aria-label={`Sua equipe, posição ${slot+1}, ${seat?.name??(open?'vaga aberta':'vaga fechada')}`}>
  {seat?<><header className={`pr-card-name wood-ribbon ${seat.guild?'has-guild':''}`}><span className="pr-card-names"><strong title={seat.name}>{seat.name}</strong>{seat.guild&&<small className="pr-card-guild" title={`Guilda ${seat.guild}`}>{seat.guild}</small>}</span>{!seat.connected&&<WifiOff size={13} aria-label="Reconectando"/>}{canManage&&!owner&&<button className="party-kick pr-card-kick" aria-label={`Expulsar ${seat.name}`} title="Expulsar da sala" onClick={()=>client.send({type:'kick',playerId:seat.id})}><X size={13}/></button>}</header>
   <div className="pr-card-stage">
    {owner&&<span className="pr-host-tag" aria-label="Líder da sala"><Crown size={12} aria-hidden="true"/>Líder da sala</span>}
    <div className="pr-card-insignia"><LevelNumber level={seat.level} size={44}/><VipBadge level={seat.vipLevel??0} size={54}/></div>
    {(seat.equipment.upgrade??0)<5&&<i className="wood-sigil pr-card-sigil" aria-hidden="true"/>}
    <div className="party-player-portrait pr-card-portrait"><Avatar equipment={seat.equipment} size={240} animated={false} auraAnimated showAura centerBody weaponSide={-1} weaponScale={0.72} weaponOffset={20} weaponVerticalOffset={12} groundedShadow/></div>
   </div>
   {seat.connected&&ready?<footer className="party-player-state ready pr-card-state" role="img" aria-label="Pronto" title="Pronto"><Check size={15} strokeWidth={3} aria-hidden="true"/><span aria-hidden="true">{owner?'Líder':'Pronto'}</span></footer>:<footer className="pr-card-state waiting"><span>{seat.connected?'Preparando':'Reconectando'}</span></footer>}
  </>:<>
   <header className="pr-card-name pr-card-name--vacant"><span>Vaga {slot+1}</span></header>
   <div className="pr-card-stage pr-card-vacant"><button type="button" className="party-slot-toggle" disabled={!canManage||slot===0} aria-label={`${open?'Fechar':'Abrir'} vaga ${slot+1}`} title={canManage?(open?'Fechar vaga':'Abrir vaga'):undefined} onClick={()=>client.send({type:'room-slot',slot,open:!open})}><span className="party-vacant-emblem" aria-hidden="true">{open?<UserPlus size={34} strokeWidth={2}/>:<LockKeyhole size={34} strokeWidth={2}/>}</span></button><span className="pr-vacant-caption" aria-hidden="true">{open?'Vaga aberta':'Vaga fechada'}</span></div>
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

export function RoomName({id,name,editable}:{id:string;name:string;editable:boolean}){
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
export function RoomMenus({equippedOnce,matches,onInventory,disabled}:{equippedOnce:boolean;matches:number;onInventory:()=>void;disabled:boolean}){
 const {mailUnread}=useGame();const [open,setOpen]=useState<RoomMenu|null>(null),box=useRef<HTMLElement>(null),previous=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
  if(!open)return;
  const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!box.current?.contains(event.target))setOpen(null);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(null);previous.current?.focus();}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
 },[open]);
 const menu=ROOM_MENUS.find(entry=>entry.id===open);
 return <nav ref={box} className="party-room-actions party-bottom-actions" aria-label="Menus da sala"><button className="party-menu-button party-painted-menu" aria-label="Equipamentos" title="Equipamentos" disabled={disabled} onClick={()=>{setOpen(null);onInventory();}}><img src="/assets/ui/backpack-button.png" alt="" draggable={false}/></button>{ROOM_MENUS.map(entry=><button key={entry.id} className={`party-menu-button party-painted-menu ${open===entry.id?'active':''}`} aria-label={entry.name} title={entry.name} aria-expanded={open===entry.id} onClick={event=>{previous.current=event.currentTarget;if(entry.id==='mail'){setOpen(null);client.openMail();return;}if(entry.id==='guild'){setOpen(null);client.openGuild();return;}setOpen(value=>value===entry.id?null:entry.id);}}><img src={`/assets/ui/${entry.art}`} alt="" draggable={false}/>{entry.id==='mail'&&mailUnread>0&&<b className="party-menu-count">{mailUnread}</b>}</button>)}{menu&&<section className="party-menu-popover" role="dialog" aria-label={menu.name}><header><strong>{menu.name}</strong><button type="button" aria-label={`Fechar ${menu.name}`} onClick={()=>{setOpen(null);previous.current?.focus();}}><X size={17}/></button></header>{open==='quests'?<div className="party-quest-list"><button type="button" disabled={disabled} onClick={()=>{setOpen(null);onInventory();}}><span className={equippedOnce?'done':''}>{equippedOnce?<Check size={15}/>:'1'}</span><div><strong>Vista sua aventura</strong><small>Equipe um item na mochila</small></div></button><div><span className={matches>0?'done':''}>{matches>0?<Check size={15}/>:'2'}</span><div><strong>Entre na arena</strong><small>Conclua sua primeira batalha</small></div></div></div>:<p>Em breve</p>}</section>}</nav>;
}

/** GvG ("guilda contra guilda"): the leader's switch beside Início; on, the search only meets parties of other guilds. */
function GvgToggle({active,host,enabled,reason}:{active:boolean;host:boolean;enabled:boolean;reason:string}){
 return <button type="button" className={`pr-gvg ${active?'active':''}`} aria-pressed={active} aria-label={active?'GvG ligado: busca só guilda contra guilda':'GvG desligado'} title={reason||(active?'GvG ligado: busca só batalhas guilda contra guilda':'Ligar GvG: buscar só batalhas guilda contra guilda')} disabled={!enabled&&!(host&&active)} onClick={()=>client.send({type:'room-gvg',active:!active})}><strong>GvG</strong><small>{active?'Ligado':'Desligado'}</small></button>;
}

export function RoomView({onInventory}:{onInventory:()=>void}){
 const {room,profile,status,offset,abilityLoadoutDraft,abilityLoadoutPending,guild}=useGame(),[confirmPractice,setConfirmPractice]=useState(false);
 const closePractice=useCallback(()=>setConfirmPractice(false),[]);
 useEffect(()=>{setConfirmPractice(false);},[room?.id,room?.status]);
 if(!room||!profile)return null;
 if(room.kind==='expedition')return <ExpeditionRoom onInventory={onInventory}/>;
 const host=room.hostId===profile.id,me=room.players.find(seat=>seat.id===profile.id),spectator=(room.spectators??[]).some(player=>player.id===profile.id),waiting=room.status==='waiting',searching=room.status==='searching',online=status==='online';
 const members=room.players.filter(seat=>seat.team===(me?.team??0)),readyCount=members.filter(seat=>seat.connected&&(seat.ready||seat.id===room.hostId)).length,allReady=members.length>0&&readyCount===members.length;
 const canManage=host&&waiting&&online,canStart=canManage&&allReady&&!abilityLoadoutPending,canQueue=canStart&&members.length===room.openSlots.length;
 const message=searching?'':!online?'Reconectando à equipe…':spectator?'':allReady?(host?'':'Aguardando o líder.'):host?'Aguardando a equipe ficar pronta.':'Confirme quando estiver pronto.';
 const size=room.openSlots.length,stateLabel=searching?'Buscando partida':room.status==='playing'?'Em batalha':'Preparando';
 const controls=<div className="party-room-actions party-primary-actions pr-actions">{message&&<p className="pr-hint" role="status"><Shield size={14}/><span>{message}</span></p>}{!spectator&&<div className="party-invite-row pr-invite-row"><RoomInvitations roomId={room.id} disabled={!canManage||members.length===room.openSlots.length}/>{host&&<button type="button" className="arena-action arena-action--icon party-practice-action" aria-label="Treinar com bots" title="Treinar com bots" disabled={!canStart} onClick={()=>setConfirmPractice(true)}><Bot size={20}/></button>}</div>}<div className="pr-start-row">{!spectator&&<GvgToggle active={!!room.gvg} host={host} enabled={canManage&&!!guild?.guild} reason={!guild?.guild?'Entre em uma guilda para buscar batalhas GvG':!host?'Só o líder liga o GvG':''}/>}{searching?<SearchInProgress startedAt={room.searchStartedAt} offset={offset} host={host} disabled={!online} spectator={spectator}/>:spectator?<div className="party-spectator-status" role="status"><Eye size={18}/><span>Assistindo à sala</span></div>:host?<button className="wood-button party-search-action pr-start" aria-label={room.gvg?'Buscar partida GvG':'Buscar partida'} disabled={!canQueue} onClick={()=>client.send({type:'queue'})}><Swords size={24}/><span>Início</span></button>:<button className={`${me?.ready?'wood-quiet':'wood-button'} party-search-action pr-start`} disabled={!waiting||!online||!me?.connected||abilityLoadoutPending} onClick={()=>client.send({type:'ready'})}><Check size={20}/>{me?.ready?'Cancelar pronto':'Estou pronto'}</button>}</div></div>;
 const content=<section className={`arena-room-stage party-room compact-party-room pvp-room wood-window ${searching?'is-searching':''}`} aria-label={`Sala ${room.name}`}>
  <header className="party-heading pr-titlebar wood-titlebar"><span className="pr-format wood-pill" aria-label={`${size} contra ${size}`}><Swords size={15} aria-hidden="true"/>{size}×{size}</span>{stateLabel!=='Preparando'&&<span className={`pr-room-state ${searching?'is-searching':''}`}>{stateLabel}</span>}<button type="button" className="wood-close pr-leave" aria-label="Sair da sala" title="Sair da sala" disabled={!online} onClick={()=>client.send({type:'leave'})}><LogOut size={20}/></button></header>
  <div className="pr-body">
   <section className="party-team pr-team wood-pane" aria-label="Sua equipe"><div className="pr-team-cards wood-cream"><div className="pr-team-grid">{SLOT_INDICES.map(slot=><PlayerCard key={slot} seat={members.find(member=>member.slot===slot)} slot={slot} open={room.openSlots.includes(slot)} hostId={room.hostId} mine={members.find(member=>member.slot===slot)?.id===profile.id} canManage={canManage}/>)}</div></div></section>
   <div className="party-chat pr-chat wood-pane wood-chat"><Chat/></div>
   <section className="party-pvp-banner pr-banner wood-pane" aria-label="Batalha PvP"><div className="pr-banner-art"><img src="/assets/ui/pvp-room-banner-v2.webp" alt="" draggable={false}/><h2 aria-label="Batalha PvP"><span aria-hidden="true">Batalha</span><strong aria-hidden="true" data-text="PvP">PvP</strong></h2><div className="party-pvp-caption"><h3>Junte-se ao campo de batalha</h3><p>Batalhas de até <strong>8 jogadores</strong></p><span>Mostre o seu poder e que vença o melhor</span></div></div></section>
   <aside className="pr-side wood-pane"><div className="pr-room-plaque"><div className="party-room-number" role="img" aria-label={`Sala ${room.number}`}><span>Sala</span><strong data-value={room.number}>{room.number}</strong></div><RoomName id={room.id} name={room.name} editable={canManage}/></div><div className="pr-side-scroll"><AbilityPreparation loadout={abilityLoadoutDraft??normalizeAbilityLoadout(profile.abilityLoadout)} disabled={spectator||!waiting||!online} pending={abilityLoadoutPending} onChange={slots=>client.setAbilityLoadout(slots)}/></div><RoomSpectators players={room.spectators??[]} openSlots={room.spectatorSlots??[]} canManage={host&&online} onToggle={(slot,open)=>client.send({type:'room-spectator-slot',slot,open})} onKick={playerId=>client.send({type:'spectator-kick',playerId})}/>{controls}<RoomMenus equippedOnce={profile.equippedOnce} matches={profile.matches} onInventory={onInventory} disabled={!waiting||!online}/></aside>
  </div>
  {confirmPractice&&<PracticeConfirmation size={room.openSlots.length} onClose={closePractice} enabled={canStart} onStart={()=>{client.send({type:'practice-start'});setConfirmPractice(false);}}/>}
 </section>;
 return createPortal(<div className="arena-room-portal arena-theme">{content}</div>,document.body);
}
