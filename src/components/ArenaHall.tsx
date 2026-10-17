import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Clock3,Crown,Eye,LoaderCircle,LockKeyhole,Plus,Search,Swords,Users,X} from 'lucide-react';
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
 const content=<section className="arena-screen party-arena arena-hall pvp-hall wood-window" aria-label="Salão PvP">
  <header className="hall-header wood-titlebar"><span className="hall-crest" aria-hidden="true"><Swords size={24}/></span><h1 className="wood-title">Salão PvP</h1><div className="hall-population wood-pill" aria-label={`${arenaOnline} jogadores na arena`}><Users size={16}/><strong>{arenaOnline}</strong><span>na arena</span></div><button className="hall-back wood-close" type="button" aria-label="Sair da arena" title="Voltar à praça" onClick={onClose}><X size={23}/></button></header>
  <div className="hall-body"><section className="hall-rooms wood-pane" aria-label="Salas da arena">
   <div className="hall-toolbar"><h2 className="hall-tab wood-ribbon"><Swords size={16} aria-hidden="true"/>Salas<b>{visible.length}</b></h2><div className={`hall-search ${searchOpen?'is-open':''}`}>{searchOpen&&<><input ref={input} aria-label="Buscar sala" placeholder="Nome da sala" value={query} maxLength={64} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSearch();}}}/><button type="button" className="hall-search-close" aria-label="Fechar pesquisa" onClick={closeSearch}><X size={15}/></button></>}<button ref={searchButton} type="button" className="hall-search-trigger" aria-label="Pesquisar salas" aria-expanded={searchOpen} onClick={()=>searchOpen?input.current?.focus():setSearchOpen(true)}><Search size={18}/></button></div></div>
   <div className="hall-room-list wood-cream">
    {visible.length?visible.map(room=>{
     const size=room.openSlots.length,full=room.players.length>=size,searching=room.status==='searching',inBattle=room.status==='playing',owner=room.players.find(player=>player.id===room.hostId),available=online&&room.status==='waiting'&&!full;
     const label=inBattle?'Em batalha':searching?'Buscando partida':full?'Completa':'Disponível',watchAvailable=online&&!searching&&(room.spectatorSlots??[]).some(slot=>!(room.spectators??[]).some(player=>player.slot===slot));
     return <div key={room.id} className="hall-room-wrap"><button type="button" className={`arena-room-entry hall-room ${inBattle?'is-playing':searching?'is-searching':full?'is-full':'is-open'}`} data-room-id={room.id} disabled={!available} aria-label={`${room.name}, ${size} contra ${size}, ${label}`} onClick={()=>client.send({type:'join',roomId:room.id})}>
      <span className="hall-room-number" aria-hidden="true">{room.number}</span>
      <span className="hall-room-main"><strong className="hall-room-name" title={room.name}>{room.name}</strong><span className="hall-room-owner"><Crown size={12}/>{owner?.name??'Aventureiros'}</span></span>
      <span className="hall-room-format" aria-label={`${size} contra ${size}`}><Swords size={18} aria-hidden="true"/><b>{size}<small>×</small>{size}</b></span>
      <span className="hall-room-foot"><span className="hall-room-seats" aria-hidden="true">{room.openSlots.map((slot,index)=><i key={slot} className={index<room.players.length?'taken':''}/>)}</span><span className="hall-room-status">{inBattle?<Clock3 size={13}/>:searching?<LoaderCircle size={13}/>:full?<LockKeyhole size={13}/>:<i/>}{label}{inBattle&&<time className="hall-room-time" aria-label="Tempo de batalha">{arenaMatchTime(room.matchStartedAt,now+offset)}</time>}</span></span>
     </button><button type="button" className="hall-spectate" aria-label={`Assistir ${room.name}`} title={watchAvailable?'Assistir à sala':'Sem vaga para espectadores'} disabled={!watchAvailable} onClick={()=>client.send({type:'spectate',roomId:room.id})}><Eye size={15}/></button></div>;
    }):<div className="hall-empty"><Swords size={44} aria-hidden="true"/><h3>{query?'Nenhuma sala encontrada':'Nenhuma sala criada'}</h3><p>{query?'Tente outro nome.':'Crie uma sala e chame a sua equipe.'}</p></div>}
   </div>
   <footer className="hall-actions"><p>Grupos de 1 a 4 aliados. O tamanho da equipe define o duelo.</p><button type="button" className="hall-create wood-button" disabled={!online} onClick={()=>client.send({type:'create'})}><Plus size={20}/><span>Criar sala</span></button></footer>
  </section><aside className="hall-chat wood-pane wood-chat" aria-label="Conversa da arena"><Chat/></aside></div>
 </section>;
 return createPortal(<div className="arena-hall-portal">{content}</div>,document.body);
}
