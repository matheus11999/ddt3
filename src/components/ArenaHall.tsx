import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Clock3,Crown,Eye,LoaderCircle,LockKeyhole,Plus,Search,Swords,Trophy,Users,X,Zap} from 'lucide-react';
import {client,useGame} from '../client';
import {arenaMatchTime,arenaRooms} from '../arenaHall';
import {Chat} from './Hud';
import {Avatar} from './Avatar';
import {LevelNumber} from './LevelNumber';
import './ArenaTheme.css';
import './ArenaHall.css';

export function Arena({onClose}:{onClose:()=>void}){
 const {rooms,status,arenaOnline,offset,profile,onlinePlayers,onlineTotal}=useGame();
 const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false),[now,setNow]=useState(Date.now);
 const input=useRef<HTMLInputElement>(null),searchButton=useRef<HTMLButtonElement>(null);
 const visible=arenaRooms(rooms,query),online=status==='online',playing=visible.some(room=>room.status==='playing');
 useEffect(()=>{if(!online)return;client.send({type:'arena-presence',open:true});return()=>{if(client.state.status==='online')client.send({type:'arena-presence',open:false});};},[online]);
 // The online list is a snapshot: refresh it while the hall is open.
 useEffect(()=>{if(!online)return;const refresh=()=>client.send({type:'online-list'});refresh();const timer=window.setInterval(refresh,10000);return()=>clearInterval(timer);},[online]);
 useEffect(()=>{if(!playing)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[playing]);
 useEffect(()=>{if(searchOpen)input.current?.focus();},[searchOpen]);
 const quick=visible.find(room=>room.status==='waiting'&&room.players.length<room.openSlots.length);
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

  </section>
  <div className="hall-bottom"><aside className="hall-chat wood-pane wood-chat" aria-label="Conversa da arena"><Chat/></aside>
   <nav className="hall-actions wood-pane" aria-label="Ações do salão">
    <button type="button" className="hall-big hall-create" disabled={!online} onClick={()=>client.send({type:'create'})}><span className="hall-big-icon"><Plus size={30}/></span><span>Criar sala</span></button>
    <button type="button" className="hall-big hall-quick" disabled={!online||!quick} title={quick?`Entrar na sala ${quick.number}`:'Nenhuma sala com vaga'} onClick={()=>quick&&client.send({type:'join',roomId:quick.id})}><span className="hall-big-icon"><Zap size={30}/></span><span>Entrar rápido</span></button>
   </nav></div>
  <aside className="hall-side" aria-label="Informações do jogador">
   <section className="hall-me wood-pane" aria-label="Meu personagem">
    <h2 className="hall-side-title wood-ribbon">Meu personagem</h2>
    <div className="hall-me-card wood-cream">
     {profile&&<><div className="hall-me-head"><LevelNumber level={profile.level} size={26}/><strong title={profile.name}>{profile.name}</strong></div>
     <div className="hall-me-avatar"><Avatar equipment={profile.equipment} size={230} animated={false} auraAnimated showAura centerBody weaponSide={-1} weaponScale={0.72} weaponOffset={18} weaponVerticalOffset={10} groundedShadow/></div>
     <dl className="hall-me-stats"><div><dt><Trophy size={13}/>Vitórias</dt><dd>{profile.wins}</dd></div><div><dt><Swords size={13}/>Partidas</dt><dd>{profile.matches}</dd></div></dl></>}
    </div>
   </section>
   <section className="hall-online wood-pane" aria-label="Jogadores online">
    <h2 className="hall-side-title wood-ribbon"><Users size={15} aria-hidden="true"/>Jogadores online<b>{onlineTotal}</b></h2>
    <div className="hall-online-list wood-cream" role="table" aria-label="Lista de jogadores online">
     <div className="hall-online-row hall-online-headrow" role="row"><span role="columnheader">Nível</span><span role="columnheader">Nome</span><span role="columnheader">Gênero</span></div>
     {onlinePlayers.map(player=><div key={player.id} role="row" className={`hall-online-row ${player.id===profile?.id?'is-me':''}`}><span role="cell" className="hall-online-level" data-tier={Math.min(6,Math.floor((player.level-1)/10)+1)}>{player.level}</span><span role="cell" className="hall-online-name" title={player.name}>{player.name}</span><span role="cell" className={`hall-online-gender is-${player.gender}`} aria-label={player.gender==='female'?'Feminino':'Masculino'}>{player.gender==="female"?"♀":"♂"}</span></div>)}
    </div>
   </section>
  </aside></div>
 </section>;
 return createPortal(<div className="arena-hall-portal">{content}</div>,document.body);
}
