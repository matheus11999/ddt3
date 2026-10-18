import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Compass,LockKeyhole,LogOut,Shield,Swords,X} from 'lucide-react';
import {normalizeAbilityLoadout} from '../../shared/abilities';
import {attributes} from '../../shared/catalog';
import {DIFFICULTIES,DIFFICULTY_NAMES,EXPEDITIONS,expeditionStages,getExpedition} from '../../shared/expeditions';
import type {Difficulty,ExpeditionDef} from '../../shared/expeditions';
import {STONES} from '../../shared/catalog';
import {client,useGame} from '../client';
import {Chat} from './Hud';
import {AbilityPreparation} from './AbilitySlots';
import {PowerIcon} from './PowerIcon';
import {BattleText} from './BattleText';
import {RoomInvitations} from './RoomInvitations';
import {PlayerCard,RoomMenus,RoomName} from './Arena';
import './ArenaTheme.css';
import './Arena.css';
import './Expedition.css';

const SLOT_INDICES=[0,1,2,3] as const;
const DROP_SLOTS=4;

/** "Drops": the items the stage's reward cards can hold (no chances shown), with empty slots kept for future drops. */
function ExpeditionDrops({expedition}:{expedition:ExpeditionDef}){
 return <div className="expedition-drops"><small>Drops</small><ul>{Array.from({length:DROP_SLOTS},(_,index)=>{const drop=expedition.drops[index];if(!drop)return <li key={index} className="is-empty" aria-hidden="true"/>;
  const stone=STONES.find(item=>item.level===drop.level);
  return <li key={index} title={stone?.name??'Pedra'}><img src={`/assets/stone-${drop.level}.png`} alt={stone?.name??'Pedra'} draggable={false}/></li>;})}</ul></div>;
}
/** Stage badge on the board: the gold plaque of the room number ("SALA 29"), reading "ESTÁGIO 1". */
function StageBadge({stage}:{stage:number}){return <span className="expedition-stage-badge" role="img" aria-label={`Estágio ${stage}`}><small>Estágio</small><b data-value={stage}>{stage}</b></span>;}

/** The expedition list and its difficulties; only the leader confirms a choice. */
export function ExpeditionPicker({current,canChoose,onClose}:{current:{id:string;difficulty:Difficulty;stage:number}|null|undefined;canChoose:boolean;onClose:()=>void}){
 const [chosen,setChosen]=useState(current?.id??EXPEDITIONS[0].id),[difficulty,setDifficulty]=useState<Difficulty>(current?.difficulty??'easy'),[stage,setStage]=useState(current?.stage??0);
 const panel=useRef<HTMLDivElement>(null),expedition=getExpedition(chosen)!,stages=expeditionStages(chosen,difficulty),{profile}=useGame();
 const power=profile?attributes(profile.equipment).power:0,recommended=expedition.recommendedPower[difficulty];
 useEffect(()=>{panel.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onClose]);
 return <div className="expedition-picker-overlay" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div ref={panel} tabIndex={-1} className="expedition-picker wood-window" role="dialog" aria-modal="true" aria-labelledby="expedition-picker-title">
   <header className="wood-titlebar"><span className="hall-crest" aria-hidden="true"><Compass size={20}/></span><h2 id="expedition-picker-title" className="wood-title">Expedições</h2><button type="button" className="wood-close" aria-label="Fechar" onClick={onClose}><X size={20}/></button></header>
   <div className="expedition-picker-body">
    <nav className="expedition-list wood-pane" aria-label="Expedições disponíveis"><div className="wood-cream">{EXPEDITIONS.map(item=><button key={item.id} type="button" className={`expedition-entry ${item.id===chosen?'is-active':''}`} aria-pressed={item.id===chosen} onClick={()=>setChosen(item.id)}><img src={item.art} alt="" draggable={false}/><span><strong>{item.name}</strong><small>Nível {item.minLevel}+</small></span></button>)}</div></nav>
    <section className="expedition-detail wood-pane" aria-label={expedition.name}><div className="wood-cream">
     <div className="expedition-cover"><img src={expedition.art} alt="" draggable={false}/>
      <div className="expedition-cover-top"><h3><BattleText className="expedition-title">{expedition.name}</BattleText></h3><small>{expedition.subtitle}</small></div>
      <span className="expedition-cover-level">Nível {expedition.minLevel}+</span>
      <div className="expedition-cover-info"><div className="expedition-cover-stats">
       <div className={`expedition-power ${power>=recommended?'is-ready':'is-weak'}`} role="note"><PowerIcon size={30}/><span><small>Poder recomendado</small><strong>{recommended.toLocaleString('pt-BR')}</strong></span><span className="expedition-power-mine"><small>Seu poder</small><strong>{power.toLocaleString('pt-BR')}</strong></span></div>
       <ExpeditionDrops expedition={expedition}/>
      </div>
      <div className="expedition-controls">
      <div className="expedition-difficulties" role="radiogroup" aria-label="Dificuldade">{DIFFICULTIES.map(level=>{const open=expeditionStages(chosen,level).length>0;return <button key={level} type="button" role="radio" aria-checked={difficulty===level} disabled={!open} data-difficulty={level} className={`expedition-difficulty ${difficulty===level?'is-active':''}`} title={open?DIFFICULTY_NAMES[level]:`${DIFFICULTY_NAMES[level]}: em breve`} onClick={()=>setDifficulty(level)}>{!open&&<LockKeyhole size={11} aria-hidden="true"/>}<span>{DIFFICULTY_NAMES[level]}</span></button>;})}</div>
      {stages.length>1&&<div className="expedition-stage-pick" role="radiogroup" aria-label="Estágio"><span>Estágio</span>{stages.map((_,index)=><button key={index} type="button" role="radio" aria-checked={Math.min(stage,stages.length-1)===index} className={Math.min(stage,stages.length-1)===index?'is-active':''} onClick={()=>setStage(index)}>{index+1}</button>)}</div>}
      <button type="button" className="wood-button expedition-confirm" disabled={!canChoose||!stages.length} onClick={()=>{client.send({type:'expedition-select',expedition:chosen,difficulty,stage:Math.min(stage,stages.length-1)});onClose();}}><Check size={18}/>{canChoose?'Escolher':'Só o líder escolhe'}</button>
       </div>
      </div>
     </div>
    </div></section>
   </div>
  </div>
 </div>;
}

/** Expedition room: the PvP room's party and chat, with the expedition banner to pick where to go. */
export function ExpeditionRoom({onInventory}:{onInventory:()=>void}){
 const {room,profile,status,abilityLoadoutDraft,abilityLoadoutPending}=useGame(),[picking,setPicking]=useState(false);
 useEffect(()=>{setPicking(false);},[room?.id,room?.status]);
 if(!room||!profile)return null;
 const host=room.hostId===profile.id,me=room.players.find(seat=>seat.id===profile.id),waiting=room.status==='waiting',online=status==='online';
 const readyCount=room.players.filter(seat=>seat.connected&&(seat.ready||seat.id===room.hostId)).length,allReady=room.players.length>0&&readyCount===room.players.length;
 const canManage=host&&waiting&&online,choice=room.expedition?getExpedition(room.expedition.id):undefined,stages=room.expedition?expeditionStages(room.expedition.id,room.expedition.difficulty):[],stageIndex=Math.min(room.expedition?.stage??0,Math.max(0,stages.length-1)),stage=choice?stages[stageIndex]:undefined,canStart=canManage&&allReady&&!!choice&&!abilityLoadoutPending;
 const message=!online?'Reconectando à equipe…':!choice?(host?'Escolha para onde a equipe vai.':'Aguardando o líder escolher a expedição.'):allReady?(host?'':'Aguardando o líder iniciar.'):host?'Aguardando a equipe ficar pronta.':'Confirme quando estiver pronto.';
 const content=<section className="arena-room-stage party-room compact-party-room pvp-room expedition-room wood-window" aria-label={`Sala ${room.name}`}>
  <header className="party-heading pr-titlebar wood-titlebar"><span className="pr-format wood-pill"><Compass size={15} aria-hidden="true"/>Expedição</span>{room.status==='playing'&&<span className="pr-room-state">Em expedição</span>}<button type="button" className="wood-close pr-leave" aria-label="Sair da sala" title="Sair da sala" disabled={!online} onClick={()=>client.send({type:'leave'})}><LogOut size={20}/></button></header>
  <div className="pr-body">
   <section className="party-team pr-team wood-pane" aria-label="Sua equipe"><div className="pr-team-cards wood-cream"><div className="pr-team-grid">{SLOT_INDICES.map(slot=><PlayerCard key={slot} seat={room.players.find(member=>member.slot===slot)} slot={slot} open={room.openSlots.includes(slot)} hostId={room.hostId} mine={room.players.find(member=>member.slot===slot)?.id===profile.id} canManage={canManage}/>)}</div></div></section>
   <div className="party-chat pr-chat wood-pane wood-chat"><Chat/></div>
   <section className="party-pvp-banner pr-banner wood-pane expedition-banner" aria-label="Expedição escolhida">
    <button type="button" className="pr-banner-art expedition-banner-art" disabled={!online} onClick={()=>setPicking(true)} aria-label={choice?`Expedição ${choice.name}, ${DIFFICULTY_NAMES[room.expedition!.difficulty]}, estágio ${stageIndex+1}. Ver expedições`:'Selecionar uma expedição'}>
     <img src={choice?choice.board:'/assets/expeditions/room-banner.webp'} alt="" draggable={false}/>
     {!stage&&<h2 aria-hidden="true"><span>Central de</span><strong data-text="Expedições">Expedições</strong></h2>}
     {choice&&stage&&<StageBadge stage={stageIndex+1}/>}
     {choice&&stage?<div className="expedition-banner-choice"><BattleText className="expedition-title">{choice.name}</BattleText><span className="expedition-difficulty-tag" data-difficulty={room.expedition!.difficulty}>{DIFFICULTY_NAMES[room.expedition!.difficulty]}</span><ExpeditionDrops expedition={choice}/></div>
      :<div className="expedition-banner-call"><Compass size={28} aria-hidden="true"/><strong>Selecione uma expedição</strong><span>{host?'Clique aqui para ver as expedições':'O líder escolhe para onde a equipe vai'}</span></div>}
    </button>
   </section>
   <aside className="pr-side wood-pane"><div className="pr-room-plaque"><div className="party-room-number" role="img" aria-label={`Sala ${room.number}`}><span>Sala</span><strong data-value={room.number}>{room.number}</strong></div><RoomName id={room.id} name={room.name} editable={canManage}/></div>
    <div className="pr-side-scroll"><AbilityPreparation loadout={abilityLoadoutDraft??normalizeAbilityLoadout(profile.abilityLoadout)} disabled={!waiting||!online} pending={abilityLoadoutPending} onChange={slots=>client.setAbilityLoadout(slots)}/></div>
    <div className="party-room-actions party-primary-actions pr-actions"><button type="button" className="pr-expedition-pick" disabled={!online} onClick={()=>setPicking(true)}>{choice?<><img src={choice.cover} alt="" draggable={false}/><span>{choice.name}<small>{DIFFICULTY_NAMES[room.expedition!.difficulty]} · Estágio {stageIndex+1}</small></span></>:<><Compass size={20}/><span>Selecione uma expedição</span></>}</button>{message&&<p className="pr-hint" role="status"><Shield size={14}/><span>{message}</span></p>}
     <div className="party-invite-row pr-invite-row"><RoomInvitations roomId={room.id} disabled={!canManage||room.players.length>=room.openSlots.length}/></div>
     {host?<button className="wood-button party-search-action pr-start" aria-label="Iniciar expedição" disabled={!canStart} onClick={()=>client.send({type:'start'})}><Swords size={24}/><span>Iniciar</span></button>
      :<button className={`${me?.ready?'wood-quiet':'wood-button'} party-search-action pr-start`} disabled={!waiting||!online||!me?.connected||abilityLoadoutPending} onClick={()=>client.send({type:'ready'})}><Check size={20}/>{me?.ready?'Cancelar pronto':'Estou pronto'}</button>}</div>
    <RoomMenus equippedOnce={profile.equippedOnce} matches={profile.matches} onInventory={onInventory} disabled={!waiting||!online}/></aside>
  </div>
  {picking&&<ExpeditionPicker current={room.expedition} canChoose={canManage} onClose={()=>setPicking(false)}/>}
 </section>;
 return createPortal(<div className="arena-room-portal arena-theme">{content}</div>,document.body);
}
