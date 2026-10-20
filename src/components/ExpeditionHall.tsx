import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Clock3,Compass,Crown,LockKeyhole,Search,Users,X} from 'lucide-react';
import {DIFFICULTY_NAMES,getExpedition} from '../../shared/expeditions';
import {client,useGame} from '../client';
import {arenaMatchTime,expeditionRooms} from '../arenaHall';
import {Chat} from './Hud';
import {Avatar} from './Avatar';
import {LevelNumber} from './LevelNumber';
import {HallEmpty,HallOnlineList} from './HallParts';
import './ArenaTheme.css';
import './ArenaHall.css';
import './Expedition.css';

/** Central de Expedições: the PvP hall's twin for co-op expedition rooms. */
export function ExpeditionHall({onClose}:{onClose:()=>void}){
 const {rooms,status,offset,profile,onlinePlayers,onlineTotal}=useGame();
 const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[now,setNow]=useState(Date.now);
 const input=useRef<HTMLInputElement>(null),searchButton=useRef<HTMLButtonElement>(null);
 const visible=expeditionRooms(rooms,query),online=status==='online',playing=visible.some(room=>room.status==='playing');
 useEffect(()=>{if(!online)return;const refresh=()=>client.send({type:'online-list'});refresh();const timer=window.setInterval(refresh,10000);return()=>clearInterval(timer);},[online]);
 useEffect(()=>{if(!playing)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[playing]);
 useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
 const quick=visible.find(room=>room.status==='waiting'&&room.players.length<room.openSlots.length);
 const closeSearch=()=>{setQuery('');setSearchOpen(false);searchButton.current?.focus();};
 const content=<section className="arena-screen party-arena arena-hall pvp-hall expedition-hall wood-window" aria-label="Central de Expedições">
  <header className="hall-header wood-titlebar"><span className="hall-crest" aria-hidden="true"><Compass size={24}/></span><h1 className="wood-title">Central de Expedições</h1><div className="hall-population wood-pill" aria-label={`${visible.length} salas de expedição`}><Users size={16}/><strong>{visible.reduce((n,room)=>n+room.players.length,0)}</strong><span>em expedição</span></div><button className="hall-back wood-close" type="button" aria-label="Sair da central" title="Voltar à praça" onClick={onClose}><X size={23}/></button></header>
  <div className="hall-body"><section className="hall-rooms wood-pane" aria-label="Salas de expedição">
   <div className="hall-toolbar"><h2 className="hall-tab wood-ribbon"><Compass size={16} aria-hidden="true"/>Salas<b>{visible.length}</b></h2><div className={`hall-search ${searchOpen?'is-open':''}`}>{searchOpen&&<><input ref={input} aria-label="Buscar sala" placeholder="Nome da sala" value={query} maxLength={64} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}}/><button type="button" className="hall-search-close" aria-label="Fechar pesquisa" onClick={closeSearch}><X size={15}/></button></>}<button ref={searchButton} type="button" className="hall-search-trigger" aria-label="Pesquisar salas" aria-expanded={searchOpen} onClick={()=>searchOpen?input.current?.focus():setSearchOpen(true)}><Search size={18}/></button></div></div>
   <div className={`hall-room-list wood-cream ${visible.length?'':'is-empty'}`}>
    {visible.length?visible.map(room=>{
     const size=room.openSlots.length,full=room.players.length>=size,inBattle=room.status==='playing',owner=room.players.find(player=>player.id===room.hostId),available=online&&room.status==='waiting'&&!full;
     const expedition=room.expedition?getExpedition(room.expedition.id):undefined,label=inBattle?'Em expedição':full?'Completa':'Disponível';
     return <div key={room.id} className="hall-room-wrap"><button type="button" className={`arena-room-entry hall-room ${inBattle?'is-playing':full?'is-full':'is-open'}`} data-room-id={room.id} disabled={!available} aria-label={`${room.name}, ${expedition?`${expedition.name} ${DIFFICULTY_NAMES[room.expedition!.difficulty]}`:'sem expedição escolhida'}, ${label}`} onClick={()=>client.send({type:'join',roomId:room.id})}>
      <span className="hall-room-number" aria-hidden="true">{room.number}</span>
      <span className="hall-room-main"><strong className="hall-room-name" title={room.name}>{room.name}</strong><span className="hall-room-owner"><Crown size={12}/>{owner?.name??'Aventureiros'}</span></span>
      <span className="hall-room-format expedition-room-choice">{expedition?<><b>{expedition.name}</b><small>{DIFFICULTY_NAMES[room.expedition!.difficulty]}</small></>:<small>Escolhendo…</small>}</span>
      <span className="hall-room-foot"><span className="hall-room-seats" aria-hidden="true">{room.openSlots.map((slot,index)=><i key={slot} className={index<room.players.length?'taken':''}/>)}</span><span className="hall-room-status">{inBattle?<Clock3 size={13}/>:full?<LockKeyhole size={13}/>:<i/>}{label}{inBattle&&<time className="hall-room-time" aria-label="Tempo de expedição">{arenaMatchTime(room.matchStartedAt,now+offset)}</time>}</span></span>
     </button></div>;
    }):<HallEmpty art="/assets/ui/expedition-button.png" searching={!!query} title="Nenhuma expedição aberta agora" hint="Crie uma sala, chame seus amigos e escolha a próxima expedição."/>}
   </div>
  </section>
  <div className="hall-bottom"><aside className="hall-chat wood-pane wood-chat" aria-label="Conversa"><Chat/></aside>
   <nav className="hall-actions wood-pane" aria-label="Ações da central">
    <button type="button" className="hall-big hall-create" disabled={!online} onClick={()=>client.send({type:'create-expedition'})}><span className="hall-big-icon hall-big-art"><img src="/assets/ui/arena-quests.png" alt="" draggable={false}/></span><span>Criar sala</span></button>
    <button type="button" className="hall-big hall-quick" disabled={!online||!quick} title={quick?`Entrar na sala ${quick.number}`:'Nenhuma sala com vaga'} onClick={()=>quick&&client.send({type:'join',roomId:quick.id})}><span className="hall-big-icon hall-big-art"><img src="/assets/ui/expedition-button.png" alt="" draggable={false}/></span><span>Entrar rápido</span></button>
   </nav></div>
  <aside className="hall-side" aria-label="Informações do jogador">
   <section className="hall-me wood-pane" aria-label="Meu personagem">
    <h2 className="hall-side-title wood-ribbon">Meu personagem</h2>
    <div className="hall-me-card wood-cream">
     {profile&&<><div className="hall-me-head"><LevelNumber level={profile.level} size={26}/><strong title={profile.name}>{profile.name}</strong></div>
     <div className="hall-me-avatar"><Avatar equipment={profile.equipment} size={230} animated={false} auraAnimated showAura centerBody weaponSide={-1} weaponScale={0.72} weaponOffset={18} weaponVerticalOffset={10} groundedShadow/></div></>}
    </div>
   </section>
   <section className="hall-online wood-pane" aria-label="Jogadores online">
    <h2 className="hall-side-title wood-ribbon"><Users size={15} aria-hidden="true"/>Jogadores online<b>{onlineTotal}</b></h2>
    <HallOnlineList players={onlinePlayers} meId={profile?.id}/>
   </section>
  </aside></div>
 </section>;
 return createPortal(<div className="arena-hall-portal">{content}</div>,document.body);
}
