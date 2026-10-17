import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ChevronRight,Clock3,Crown,Eye,LoaderCircle,LockKeyhole,Plus,Search,Swords,Users,X} from 'lucide-react';
import {client,useGame} from '../client';
import {arenaMatchTime,arenaRooms} from '../arenaHall';
import {Chat} from './Hud';
import './ArenaTheme.css';
import './ArenaHall.css';

export function Arena({onClose}:{onClose:()=>void}){
 const {rooms,status,arenaOnline,offset}=useGame();
 const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[now,setNow]=useState(Date.now);
 const input=useRef<HTMLInputElement>(null),searchButton=useRef<HTMLButtonElement>(null);
 const visible=arenaRooms(rooms,query),online=status==='online',playing=visible.some(room=>room.status==='playing');
 useEffect(()=>{if(!online)return;client.send({type:'arena-presence',open:true});return()=>{if(client.state.status==='online')client.send({type:'arena-presence',open:false});};},[online]);
 useEffect(()=>{if(!playing)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[playing]);
 useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
 const closeSearch=()=>{setQuery('');setSearchOpen(false);searchButton.current?.focus();};
 const content=<section className="arena-screen party-arena arena-hall" aria-label="Arena de Brasa">
  <header className="hall-header"><span className="hall-crest" aria-hidden="true"><Swords size={32}/></span><h1>Arena</h1><div className="hall-population" aria-label={`${arenaOnline} jogadores na arena`}><Users size={19}/><strong>{arenaOnline}</strong><span>na arena</span></div><button className="hall-back arena-action arena-action--subtle" type="button" aria-label="Sair da arena" onClick={onClose}><ArrowLeft size={18}/><span>Voltar</span></button></header>
  <div className="hall-body"><section className="hall-rooms" aria-label="Salas da arena">
   <div className="hall-toolbar"><h2>Salas</h2><div className={`hall-search ${searchOpen?'is-open':''}`}>{searchOpen&&<><input ref={input} aria-label="Buscar sala" placeholder="Nome da sala" value={query} maxLength={64} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}}/><button type="button" className="hall-search-close arena-action arena-action--icon arena-action--subtle" aria-label="Fechar pesquisa" onClick={closeSearch}><X size={15}/></button></>}<button ref={searchButton} type="button" className="hall-search-trigger arena-action arena-action--icon" aria-label="Pesquisar salas" aria-expanded={searchOpen} onClick={()=>searchOpen?input.current?.focus():setSearchOpen(true)}><Search size={19}/></button></div></div>
   <div className="hall-room-list">
    {visible.length?visible.map(room=>{
     const full=room.players.length>=room.openSlots.length,searching=room.status==='searching',inBattle=room.status==='playing',owner=room.players.find(player=>player.id===room.hostId),available=online&&room.status==='waiting'&&!full;
     const label=inBattle?'Em batalha':searching?'Buscando partida':full?'Completa':'Disponível',watchAvailable=online&&!searching&&(room.spectatorSlots??[]).some(slot=>!(room.spectators??[]).some(player=>player.slot===slot));
     return <div key={room.id} className="hall-room-wrap"><button type="button" className={`arena-room-entry hall-room ${inBattle?'is-playing':searching?'is-searching':full?'is-full':'is-open'}`} data-room-id={room.id} disabled={!available} aria-label={`${room.name}, ${room.openSlots.length} contra ${room.openSlots.length}, ${label}`} onClick={()=>client.send({type:'join',roomId:room.id})}>
      <strong className="hall-room-name" title={room.name}>{room.name}</strong>
      <span className="hall-room-format" aria-label={`${room.openSlots.length} contra ${room.openSlots.length}`}><Swords size={23} aria-hidden="true"/><b>{room.openSlots.length}<small>×</small>{room.openSlots.length}</b></span>
      <span className="hall-room-info"><span className="hall-room-owner"><Crown size={12}/>{owner?.name??'Aventureiros'}</span><span className="hall-room-status">{inBattle?<Clock3 size={12}/>:searching?<LoaderCircle size={12}/>:full?<LockKeyhole size={12}/>:<i/>}{label}{inBattle&&<time className="hall-room-time" aria-label="Tempo de batalha">{arenaMatchTime(room.matchStartedAt,now+offset)}</time>}</span></span>
      {available&&<ChevronRight className="hall-room-arrow" size={19} aria-hidden="true"/>}
     </button><button type="button" className="hall-spectate" aria-label={`Assistir ${room.name}`} title={watchAvailable?'Assistir à sala':'Sem vaga para espectadores'} disabled={!watchAvailable} onClick={()=>client.send({type:'spectate',roomId:room.id})}><Eye size={15}/><span>Assistir</span></button></div>;
    }):<div className="hall-empty"><Swords size={48} aria-hidden="true"/><h3>{query?'Nenhuma sala encontrada':'Nenhuma sala criada'}</h3></div>}
   </div>
   <footer className="hall-actions"><button type="button" className="hall-create arena-action arena-action--primary" disabled={!online} onClick={()=>client.send({type:'create'})}><Plus size={21}/><span>Criar sala</span></button></footer>
  </section><aside className="hall-chat" aria-label="Conversa da arena"><Chat/></aside></div>
 </section>;
 return createPortal(<div className="arena-hall-portal">{content}</div>,document.body);
}
