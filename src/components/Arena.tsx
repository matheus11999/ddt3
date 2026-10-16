import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,Backpack,Bot,Check,ChevronRight,Crown,Flag,LockKeyhole,LogOut,MapPin,Plus,Search,Shield,Sparkles,Swords,UnlockKeyhole,Users,WifiOff,X} from 'lucide-react';
import {attributes,CATALOG,MAPS} from '../../shared/catalog';
import {getMap} from '../../shared/maps';
import {ROOM_MODES,teamSize} from '../../shared/rooms';
import type {MapId} from '../../shared/catalog';
import type {RoomMode} from '../../shared/rooms';
import type {Seat} from '../../shared/protocol';
import {client,useGame} from '../client';
import {Chat} from './Hud';
import {Avatar} from './Avatar';
import {ItemIcon} from './ItemIcon';
import {LevelBadge} from './LevelBadge';
import {PowerIcon} from './PowerIcon';
import './EnvironmentControls.css';
import './Arena.css';

const MAP_GUIDES={
 garden:'Flores gigantes, raízes e terra viva. Abra crateras e mude o rumo do duelo.',
 park:'Luzes de festa e pontes resistentes. Escolha entre o abrigo e o risco.',
 celestial:'Torres sobre as nuvens. Conquiste as pontes de uma fortaleza indestrutível.'
};
const MODE_NAMES:Record<RoomMode,string>={'1v1':'Duelo','2v2':'Duplas','3v3':'Trios','4v4':'Esquadrões'};
const TEAM_NAMES=['Safira','Rubi'] as const;
const SLOT_INDICES=[0,1,2,3] as const;
const modeLabel=(mode:RoomMode)=>teamSize(mode)+' × '+teamSize(mode);
function mapBehavior(id:MapId){const regions=getMap(id).regions;return regions.every(r=>r.destructible)?'Destrutível':regions.some(r=>r.destructible)?'Híbrido':'Indestrutível';}
function MapArtwork({map,className=''}:{map:MapId;className?:string}){
 const definition=getMap(map);
 return <div className={'map-artwork '+definition.id+' '+className} aria-hidden="true" style={{background:'linear-gradient('+definition.lighting.sky+','+definition.lighting.horizon+')'}}><img className="map-render-thumbnail" src={'/assets/maps/'+definition.id+'-preview.png'} alt="" draggable={false}/></div>;
}
function useCompactArena(){
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width: 700px)'),update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return compact;
}

export function Arena({onClose,onPractice}:{onClose:()=>void;onPractice:()=>void}){
 const {rooms,profile}=useGame(),compact=useCompactArena();
 const [filter,setFilter]=useState<RoomMode|'all'>('all');
 const [query,setQuery]=useState(''),[creating,setCreating]=useState(false);
 const [name,setName]=useState('Sala de '+(profile?.name.slice(0,15)??'aventureiros'));
 const [mode,setMode]=useState<RoomMode>('1v1'),[map,setMap]=useState<MapId>('garden');
 const filtered=rooms.filter(room=>(filter==='all'||room.mode===filter)&&room.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const available=rooms.filter(room=>room.status==='waiting'&&room.players.length<teamSize(room.mode)*2).length,selectedMap=getMap(map);
 const content=<section className={'arena-screen arena-redesign '+(compact?'compact-arena-screen ':'')+(creating?'creating-room':'')} aria-label="Arena de Brasa">
  <header className="arena-screen-heading"><span className="arena-screen-crest"><Swords size={31}/></span><div><small>BRASA · SALÃO DOS DESAFIOS</small><h1>{creating?'Prepare sua batalha':'Arena de Brasa'}</h1></div><span className="arena-screen-presence"><Users size={16}/>{available} {available===1?'sala com vaga':'salas com vagas'}</span><button className="button quiet" onClick={onClose} aria-label="Sair da arena"><LogOut size={17}/><span>Voltar à rua</span></button></header>
  {creating?<div className="arena-preparation-shell">
   <form className="create-panel arena-create-panel arena-preparation" onSubmit={event=>{event.preventDefault();client.send({type:'create',name,mode,map});}}>
    <div className="arena-preparation-map">
     <header className="arena-map-chapter"><span><MapPin size={17}/>ESCOLHA O CAMPO DE BATALHA</span><small>TRÊS MUNDOS. INÚMERAS ESTRATÉGIAS.</small></header>
     <div className={'arena-map-theatre '+selectedMap.id}><MapArtwork map={map}/><span className="arena-theatre-crest"><Swords size={33}/></span><div className="arena-theatre-title"><small>CAMPO DE BATALHA</small><h2>{selectedMap.name}</h2><span className="map-behavior">{mapBehavior(map)}</span><p>{MAP_GUIDES[selectedMap.id]}</p></div></div>
     <div className="arena-map-choices" role="group" aria-label="Campo de batalha">{MAPS.map(option=><button type="button" key={option.id} onClick={()=>setMap(option.id)} aria-label={option.name+', '+mapBehavior(option.id)} aria-pressed={map===option.id} className={'arena-map-choice '+(map===option.id?'chosen ':'')+option.id}><MapArtwork map={option.id}/><span className="arena-map-choice-copy"><strong>{option.name}</strong><span className="map-behavior">{mapBehavior(option.id)}</span></span>{map===option.id&&<Check className="map-selected-check" size={18} aria-hidden="true"/>}</button>)}</div>
    </div>
    <aside className="arena-preparation-controls">
     <header className="arena-create-heading"><div><small>SEU GRUPO DE AVENTUREIROS</small><h2>Nova sala</h2></div><button type="button" className="round-button" aria-label="Voltar à lista de salas" onClick={()=>setCreating(false)}><X size={19}/></button></header>
     <label className="arena-name-field">Nome da sala<input autoFocus maxLength={24} minLength={2} pattern="[\p{L}\p{N} _!.\-]+" required value={name} onChange={event=>setName(event.target.value)}/></label>
     <div className="arena-field-caption" id="arena-mode-label"><Swords size={15}/> Tamanho das equipes</div>
     <div className="arena-mode-choices" role="group" aria-labelledby="arena-mode-label">{ROOM_MODES.map(value=><button type="button" key={value} aria-pressed={mode===value} className={mode===value?'chosen':''} onClick={()=>setMode(value)}><strong>{modeLabel(value)}</strong><span>{MODE_NAMES[value]}</span>{mode===value&&<Check size={15}/>}</button>)}</div>
     <div className="arena-preparation-summary"><Shield size={28}/><div><strong>{MODE_NAMES[mode]} · {modeLabel(mode)}</strong><span>{teamSize(mode)*2} aventureiros entram. Uma equipe vence.</span></div></div>
     <footer className="arena-create-footer"><button className="button quiet" type="button" onClick={()=>setCreating(false)}>Voltar</button><button className="button gold" type="submit">Criar sala <ArrowRight size={18}/></button></footer>
    </aside>
   </form>
   <div className="arena-chat-pane arena-preparation-chat"><Chat/></div>
  </div>:<>
   <div className="arena-hall-banner"><div className="arena-hall-art"><MapArtwork map="celestial"/></div><span className="arena-hall-crest"><Swords size={38}/></span><div className="arena-hall-title"><span>O DESAFIO COMEÇA AQUI</span><h2>Sua próxima grande batalha.</h2><p>De um duelo de mira a um encontro entre esquadrões.</p></div><button className="button light" onClick={onPractice}><Bot size={19}/> Treinar com bot</button></div>
   <div className="arena-hall-layout">
    <div className="arena-hall-content">
     <div className="arena-hall-toolbar"><nav className="arena-mode-filters" aria-label="Filtrar salas por modo"><button className={filter==='all'?'active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Todas</button>{ROOM_MODES.map(value=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{modeLabel(value)}</button>)}</nav><label className="arena-room-search"><Search size={17}/><input aria-label="Buscar sala" placeholder="Encontre uma sala" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
     <div className="arena-list-caption"><span><i className="green-dot"/> {available} {available===1?'sala com vaga':'salas com vagas'}</span><small>ATÉ 8 AVENTUREIROS</small></div>
     <div className="arena-hall-rooms">
      {filtered.length?filtered.map(room=>{const capacity=teamSize(room.mode)*2,full=room.players.length>=capacity,playing=room.status==='playing',owner=room.players.find(player=>player.id===room.hostId);return <button className={'arena-room-entry '+(playing?'playing':'')} key={room.id} onClick={()=>client.send({type:'join',roomId:room.id})} disabled={playing||full} aria-label={room.name+', '+modeLabel(room.mode)+', '+room.players.length+' de '+capacity+' jogadores, '+(playing?'em batalha':full?'sala completa':'entrar')}><div className="arena-entry-art"><MapArtwork map={room.map}/><strong>{modeLabel(room.mode)}</strong></div><div className="arena-entry-copy"><span className="arena-entry-map"><MapPin size={11}/>{getMap(room.map).name}</span><h3>{room.name}</h3><span className="arena-entry-owner"><Crown size={12}/>{owner?.name??'Sala de aventureiros'}</span><div className="arena-entry-status"><span className={playing?'is-playing':full?'is-full':'is-open'}>{playing?'Em batalha':full?'Completa':'Pode entrar'}</span><b><Users size={13}/>{room.players.length}<i>/{capacity}</i></b></div></div><ChevronRight className="arena-entry-arrow" size={20}/></button>;}):<div className="arena-hall-empty"><span><Swords size={44}/></span><h3>{query?'Nenhuma sala com esse nome':'Uma arena. Muitas histórias.'}</h3><p>{query?'Experimente outra busca.':'Convide sua equipe ou seja o primeiro a lançar o desafio.'}</p><button className="button gold" onClick={()=>setCreating(true)}><Plus size={18}/> Criar sala</button></div>}
     </div>
     <footer className="arena-hall-footer"><span><Shield size={17}/> Duelo, duplas, trios e esquadrões</span><button className="button gold" onClick={()=>setCreating(true)}><Plus size={18}/> Criar sala</button></footer>
    </div>
    <aside className="arena-social-rail"><div className="arena-featured-world"><MapArtwork map="garden"/><span><MapPin size={14}/> Mundos que mudam com cada disparo.</span></div><div className="arena-chat-pane"><Chat/></div></aside>
   </div>
  </>}
 </section>;
 return compact?createPortal(<div className="arena-screen-portal">{content}</div>,document.body):content;
}

function PlayerCard({seat,team,slot,open,hostId,mine,canConfigure,onOpen}:{seat:Seat|undefined;team:0|1;slot:number;open:boolean;hostId:string;mine:boolean;canConfigure:boolean;onOpen:()=>void}){
 const owner=seat?.id===hostId,ready=!!seat&&(seat.ready||owner);
 const power=seat?attributes(seat.equipment).power:0;
 return <article className={'player-seat arena-player-card '+(seat?'occupied':open?'vacant':'locked')+(mine?' is-me':'')} data-team={team} data-slot={slot} data-slot-state={seat?'occupied':open?'open':'closed'} aria-label={'Equipe '+TEAM_NAMES[team]+', posição '+(slot+1)+', '+(seat?.name??(open?'vaga aberta':'vaga fechada'))}>
  {seat?<>
   <header className="arena-player-name">{owner?<Crown size={15} aria-label="Dono da sala"/>:seat.bot?<Bot size={14}/>:<Shield size={13}/>}<strong title={seat.name}>{seat.name}</strong>{mine&&<small>VOCÊ</small>}{canConfigure&&!owner&&<button className="arena-kick-player" aria-label={'Expulsar '+seat.name} title="Expulsar da sala" onClick={()=>client.send({type:'kick',playerId:seat.id})}><X size={13}/></button>}</header>
   <LevelBadge level={seat.level} size={46} className="arena-player-level"/>
   {owner&&<span className="arena-owner-ribbon">LÍDER</span>}
   <div className="arena-player-portrait"><Avatar equipment={seat.equipment} size={204} facing={team===0?1:-1} showAura/></div>
   <span className="arena-player-power" aria-label={'Poder '+power.toLocaleString('pt-BR')}><PowerIcon size={22}/><b>{power.toLocaleString('pt-BR')}</b></span>
   <span className="arena-player-weapon" title={CATALOG[seat.equipment.weapon]?.name}><ItemIcon id={seat.equipment.weapon} upgrade={seat.equipment.upgrade} size={34}/>{seat.equipment.upgrade>0&&<b>+{seat.equipment.upgrade}</b>}</span>
   <footer className={'arena-player-state '+(!seat.connected?'disconnected':ready?'ready':'preparing')}>{!seat.connected?<><WifiOff size={13}/> Reconectando…</>:ready?<><Check size={14}/> {seat.bot?'Bot pronto':'Pronto para a batalha'}</>:<><span className="arena-ready-dot"/> Preparando equipamentos</>}</footer>
  </>:<>
   <span className="arena-slot-number">{String(slot+1).padStart(2,'0')}</span>
   <div className="arena-vacant-emblem">{open?<Users size={36}/>:<LockKeyhole size={31}/>}</div>
   <strong>{open?'Aguardando aventureiro':'Vaga fechada'}</strong>
   <span className="arena-vacant-note">{open?'Esta equipe tem lugar para você.':'A batalha será em equipes menores.'}</span>
   {!open&&canConfigure&&<button className="arena-open-slot" onClick={onOpen} aria-label={'Abrir posição '+(slot+1)+', equipe '+TEAM_NAMES[team]}><UnlockKeyhole size={13}/> Abrir vaga</button>}
  </>}
 </article>;
}

export function RoomView({onInventory}:{onInventory:()=>void}){
 const {room,profile}=useGame(),compact=useCompactArena();
 const [visibleTeam,setVisibleTeam]=useState<0|1>(0);
 const ownTeam=room?.players.find(seat=>seat.id===profile?.id)?.team;
 useEffect(()=>{if(ownTeam!==undefined)setVisibleTeam(ownTeam);},[ownTeam,room?.id]);
 if(!room||!profile)return null;
 const host=room.hostId===profile.id,capacity=teamSize(room.mode)*2,me=room.players.find(seat=>seat.id===profile.id);
 const map=getMap(room.map),openSlots=room.openSlots,waiting=room.status==='waiting';
 const readyPlayers=room.players.filter(seat=>seat.connected&&(seat.ready||seat.id===room.hostId)).length;
 const vacancies=Math.max(0,capacity-room.players.length),allReady=room.players.length===capacity&&readyPlayers===capacity;
 const configure=(slot:number,open:boolean)=>client.send({type:'room-slot',slot,open});
 const status=vacancies>0?'Faltam '+vacancies+' '+(vacancies===1?'aventureiro':'aventureiros')+' para começar.':allReady?'Equipes prontas. A arena espera por vocês.':'Aguardando todos ficarem prontos.';
 const teamPanel=(team:0|1)=><section className={'arena-team arena-team-'+team} key={team} hidden={compact&&visibleTeam!==team} aria-label={'Equipe '+TEAM_NAMES[team]}><header className="arena-team-heading"><span><Flag size={16}/><strong>Equipe {TEAM_NAMES[team]}</strong></span><b>{room.players.filter(seat=>seat.team===team).length}<small>/{teamSize(room.mode)}</small></b></header><div className="arena-team-cards">{SLOT_INDICES.map(slot=><PlayerCard key={slot} seat={room.players.find(seat=>seat.team===team&&seat.slot===slot)} team={team} slot={slot} open={openSlots.includes(slot)} hostId={room.hostId} mine={room.players.some(seat=>seat.team===team&&seat.slot===slot&&seat.id===profile.id)} canConfigure={host&&waiting} onOpen={()=>configure(slot,true)}/>)}</div></section>;
 const content=<div className={'room-stage arena-room-stage fullscreen-room '+(compact?'compact-arena-room':'')}>
  <div className="arena-room-backdrop"><MapArtwork map={room.map}/></div>
  <header className="arena-room-heading"><button className="button quiet" aria-label="Sair da sala" onClick={()=>client.send({type:'leave'})}><LogOut size={16}/><span>Sair da sala</span></button><div><small>SALA DE BATALHA <i/> {MODE_NAMES[room.mode].toUpperCase()}</small><h1>{room.name}</h1></div><span className="arena-room-count"><Users size={18}/><strong>{room.players.length}<small>/{capacity}</small></strong><b>{modeLabel(room.mode)}</b></span></header>
  {compact&&<nav className="arena-team-tabs" aria-label="Ver equipe">{([0,1] as const).map(team=><button key={team} className={'team-tab-'+team+(visibleTeam===team?' active':'')} aria-pressed={visibleTeam===team} onClick={()=>setVisibleTeam(team)}><Flag size={14}/>Equipe {TEAM_NAMES[team]}<span>{room.players.filter(seat=>seat.team===team).length}/{teamSize(room.mode)}</span></button>)}</nav>}
  <div className="arena-room-body">
   {teamPanel(0)}
   <aside className="arena-room-center">
    <div className="selected-map arena-selected-map"><MapArtwork map={room.map}/><span className="arena-map-seal"><Swords size={22}/></span><div><small>CAMPO DE BATALHA</small><strong>{map.name}</strong><span className={'arena-map-material '+map.id}><Shield size={12}/>{mapBehavior(room.map)}</span></div></div>
    <p className="arena-room-map-guide">{MAP_GUIDES[map.id]}</p>
    <div className="arena-room-settings"><div className="arena-room-format"><span>FORMATO DA BATALHA</span><strong>{modeLabel(room.mode)}</strong><small>{MODE_NAMES[room.mode]} · {capacity} aventureiros</small></div>
    <div className="arena-slot-controls"><span>{host?'Vagas por equipe':'Vagas abertas por equipe'}</span><div>{SLOT_INDICES.map(slot=>{const open=openSlots.includes(slot),humanOccupied=room.players.some(seat=>seat.slot===slot&&!seat.bot);const disabled=!host||!waiting||slot===0||(open&&humanOccupied);const reason=slot===0?'A primeira posição permanece aberta.':!host?'Somente o líder pode alterar as vagas.':!waiting?'Aguarde o fim da batalha.':open&&humanOccupied?'Há um aventureiro nesta posição. A vaga precisa estar livre de jogadores nas duas equipes.':open?'Fechar nas duas equipes; bots desta posição serão removidos.':'Abrir esta posição nas duas equipes.';return <button key={slot} aria-label={(open?'Fechar':'Abrir')+' posição '+(slot+1)} aria-pressed={open} title={reason} disabled={disabled} className={open?'open':'closed'} onClick={()=>configure(slot,!open)}>{open?<Users size={16}/>:<LockKeyhole size={15}/>}<b>{slot+1}</b></button>;})}</div><small>{host?'Fechar remove os bots desta posição nas duas equipes.':'O líder escolhe o tamanho das equipes.'}</small></div>
    </div><div className="arena-ready-summary"><span><Check size={16}/>{readyPlayers}/{capacity} prontos</span><div><i style={{width:readyPlayers/capacity*100+'%'}}/></div></div>
    {!compact&&<div className="arena-chat-pane arena-room-chat"><Chat/></div>}
   </aside>
   {teamPanel(1)}
  </div>
  {compact&&<div className="arena-chat-pane arena-room-chat"><Chat/></div>}
  <footer className="arena-room-footer"><div className="arena-room-status" role="status"><Sparkles size={18}/><span>{status}</span></div><div className="arena-room-actions"><button className="button light" onClick={onInventory}><Backpack size={17}/>Equipamentos</button>{host&&<button className="button light" disabled={!waiting||vacancies===0} onClick={()=>client.send({type:'bot'})}><Bot size={18}/>Adicionar bot</button>}{host?<button className="button gold arena-start-button" disabled={!waiting||!allReady} onClick={()=>client.send({type:'start'})}><Swords size={21}/>Iniciar batalha</button>:<button className={'button '+(me?.ready?'light':'gold')+' arena-start-button'} disabled={!waiting||!me?.connected} onClick={()=>client.send({type:'ready'})}><Check size={20}/>{me?.ready?'Cancelar pronto':'Estou pronto'}</button>}</div></footer>
 </div>;
 return compact?createPortal(<div className="arena-room-portal">{content}</div>,document.body):content;
}
