import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CSSProperties} from 'react';
import {client,useGame} from '../client';
import {baseMapId,getMap} from '../../shared/maps';
import {DIFFICULTY_NAMES} from '../../shared/expeditions';
import type {LoadingPlayer,MatchLoading as Loading} from '../../shared/protocol';
import {preloadBattle} from '../game/battlePreload';
import {Avatar} from './Avatar';
import {LevelNumber} from './LevelNumber';
import {BattleText} from './BattleText';
import {StageBadge} from './ExpeditionRoom';
import './Expedition.css';
import './MatchLoading.css';

/**
 * Between finding a match (or starting an expedition stage) and its battle: the teams face each other
 * while every client loads the battle; each bar is that player's progress as the server relays it.
 * The battle opens when everyone reaches 100 %; whoever is still loading at the deadline is left out.
 */
export function MatchLoading({scale}:{scale:number}){
 const {loading,profile,offset}=useGame();
 const loadingId=loading?.id;
 const sent=useRef(-1);
 useEffect(()=>{
  const current=client.state.loading;if(!current)return;let live=true;sent.current=-1;
  const report=(progress:number)=>{if(!live||progress<=sent.current||(progress<100&&progress-sent.current<4))return;sent.current=progress;client.send({type:'loading-progress',id:current.id,progress});};
  void preloadBattle(current,report);
  return()=>{live=false;};
 },[loadingId]);
 if(!loading)return null;
 const def=getMap(loading.map),teams=[0,1].map(team=>loading.players.filter(player=>player.team===team));
 const expedition=loading.expedition,party=expedition?loading.players:null;
 // Above the room (itself on document.body): the paintings fill the window, the 1536×864 stage scales like the game.
 return createPortal(<div className={`match-loading is-${loading.kind}`} style={{'--map-color':def.color} as CSSProperties}>
  <div className="match-loading-bg" style={{backgroundImage:`url(${def.art.background})`}}/>
  <div className="match-loading-shade"/>
  <div className="match-loading-stage" style={{transform:`translate(-50%, -50%) scale(${scale})`}}>
  <div className="match-loading-field">
   <Team players={party??teams[0]} side="left" me={profile?.id}/>
   <Versus/>
   {expedition?<div className="match-loading-team right"><div className="instance-card"><img src={expedition.art} alt=""/><span className="expedition-difficulty-tag instance-difficulty" data-difficulty={expedition.difficulty}>{DIFFICULTY_NAMES[expedition.difficulty]}</span><div className="instance-stage"><StageBadge stage={expedition.stage+1}/><BattleText className="expedition-title">{expedition.name}</BattleText><small>{expedition.stageName}</small></div></div></div>:<Team players={teams[1]} side="right" me={profile?.id}/>}
  </div>
  {!expedition&&<footer className="match-loading-map">
   <div className="map-thumb"><img src={`/assets/maps/${baseMapId(loading.map)}-preview.png`} alt=""/></div>
   <div className="map-caption"><span>{expedition?'Instância':'Mapa'}</span><strong>{def.name}</strong><Countdown deadline={loading.deadline} offset={offset} players={loading.players}/></div>
  </footer>}
  </div>
 </div>,document.body);
}
/** Up to 4 per side: one or two in a row, three or four in two rows. Each is the standing avatar on the game's aura, with name and bar below. */
const AVATAR_SIZE=[0,330,250,230,230];
function Team({players,side,me}:{players:LoadingPlayer[];side:'left'|'right';me?:string}){
 const size=AVATAR_SIZE[Math.min(4,players.length)];
 return <div className={`match-loading-team ${side}`} data-count={players.length} style={{'--avatar':size+'px'} as CSSProperties}>{players.map(player=><div key={player.id} className={`loading-fighter ${player.id===me?'is-me':''} ${player.progress>=100?'is-ready':''}`}>
  <div className="loading-fighter-art"><Avatar equipment={player.equipment} size={size} animated={false} facing={side==='left'?1:-1}/></div>
  <div className="loading-fighter-name"><LevelNumber level={player.level} size={24}/><b>{player.name}</b></div>
  {player.guild&&<small>{player.guild}</small>}
  <div className="loading-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={player.progress} aria-label={`Carregamento de ${player.name}`}><i style={{width:`${player.progress}%`}}/><span>{player.progress}%</span></div>
 </div>)}</div>;
}
function Versus(){return <div className="match-loading-vs" aria-label="Versus"><span className="vs-text" data-text="VS"><span aria-hidden="true">VS</span></span></div>;}
function Countdown({deadline,offset,players}:{deadline:number;offset:number;players:LoadingPlayer[]}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[]);
 const left=Math.max(0,Math.ceil((deadline-offset-now)/1000)),ready=players.filter(player=>player.progress>=100).length;
 return <em>{ready===players.length?'Todos prontos!':`Aguardando ${players.length-ready} de ${players.length} · ${left}s`}</em>;
}
