import {PowerCutIn} from './PowerCutIn';
import {Avatar} from './Avatar';
import {LevelBadge} from './LevelBadge';
import {BattleText} from './BattleText';
import {BattleRewards} from './BattleRewards';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,ChevronDown,ChevronUp,Flag,Wind,Zap,Target,SkipForward,Trophy,RotateCcw,LogOut,Plus,Minus,Move,SlidersHorizontal,Volume2,VolumeX,X} from 'lucide-react';
import {getEnvironmentQuality,setEnvironmentQuality} from '../game/environment';
import {getEnvironmentAudioEnabled,setEnvironmentAudioEnabled} from '../game/audio';
import {getMap} from '../../shared/maps';
import type {EnvironmentQuality} from '../../shared/maps';
import './EnvironmentControls.css';
import {BOOSTS,WEAPONS} from '../../shared/catalog';
import type {BoostId} from '../../shared/catalog';
import {client,useGame} from '../client';
import './BattleHud.css';
function EnvironmentControls({map,blocked}:{map:Parameters<typeof getMap>[0];blocked:boolean}){
 const [quality,setQuality]=useState(getEnvironmentQuality),[sound,setSound]=useState(getEnvironmentAudioEnabled),[pan,setPan]=useState(false),[zoom,setZoom]=useState(1),[expanded,setExpanded]=useState(false),[advanced,setAdvanced]=useState(false),[compact,setCompact]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width: 700px)'),change=()=>setCompact(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{const changed=(event:Event)=>{const detail=(event as CustomEvent<{zoom:number;panning:boolean}>).detail;if(detail&&Number.isFinite(detail.zoom)){setZoom(detail.zoom);setPan(detail.panning);}};window.addEventListener('brasa-camera-state',changed);return()=>window.removeEventListener('brasa-camera-state',changed);},[]);
 const togglePan=(value:boolean)=>{setPan(value);window.dispatchEvent(new CustomEvent('brasa-camera-pan',{detail:value}));};
 useEffect(()=>{if(blocked){setPan(false);window.dispatchEvent(new CustomEvent('brasa-camera-pan',{detail:false}));}},[blocked]);
 useEffect(()=>()=>{window.dispatchEvent(new CustomEvent('brasa-camera-pan',{detail:false}));},[]);
 const camera=(action:'in'|'out'|'reset')=>{window.dispatchEvent(new CustomEvent('brasa-camera',{detail:action}));if(action==='reset')togglePan(false);};
 const controls=<aside className={`environment-controls ${compact?'compact':''} ${expanded?'expanded':''}`} aria-label="Controles do cenário" hidden={blocked} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}>
  {compact&&<button className="environment-toggle" aria-label="Cenário e câmera" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><SlidersHorizontal size={19}/><span>Cenário e câmera</span>{expanded&&<X size={17}/>}</button>}
  {(!compact||expanded)&&<div className="environment-controls-content" onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}>
   <div className="environment-caption"><small>CAMPO DE BATALHA</small><strong>{getMap(map).name}</strong></div>
   <div className="environment-zoom" role="group" aria-label="Zoom"><button type="button" aria-label="Afastar cenário" title="Afastar cenário" onClick={()=>camera('out')}><Minus size={20}/></button><output aria-label="Zoom do cenário">{Math.round(zoom*100)}%</output><button type="button" aria-label="Aproximar cenário" title="Aproximar cenário" onClick={()=>camera('in')}><Plus size={20}/></button><button type="button" aria-label="Restaurar câmera" title="Restaurar câmera" onClick={()=>camera('reset')}><RotateCcw size={18}/></button></div>
   <button type="button" className={`environment-pan ${pan?'active':''}`} aria-label="Explorar cenário" aria-pressed={pan} onClick={()=>togglePan(!pan)}><Move size={17}/><span>{pan?'Arraste para explorar':'Explorar cenário'}</span></button>
   {!compact&&<button type="button" className="environment-advanced" aria-label="Mais opções do cenário" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={14}/><span>{advanced?'Menos opções':'Mais opções'}</span><ChevronDown size={14}/></button>}
   {(compact||advanced)&&<><label className="environment-quality"><span>Detalhes do cenário</span><select aria-label="Qualidade do cenário" value={quality} onChange={e=>{const value=e.target.value as EnvironmentQuality;setQuality(value);setEnvironmentQuality(value);}}><option value="low">Leve</option><option value="medium">Equilibrada</option><option value="high">Detalhada</option></select></label>
   <button type="button" className="environment-sound" aria-label="Sons do cenário" aria-pressed={sound} onClick={()=>{setEnvironmentAudioEnabled(!sound);setSound(!sound);}}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>Sons do cenário</span><b>{sound?'Ligados':'Desligados'}</b></button></>}
  </div>}
 </aside>;
 return compact?createPortal(controls,document.body):controls;
}

type ChargeSource='keyboard'|'pointer';
const MIN_POWER=5,MAX_POWER=100,CHARGE_MS=2090;
const ignoresGameKeys=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="menu"]');

export function BattleHud({angle,setAngle,blocked}:{angle:number;setAngle:(v:number)=>void;blocked:boolean}){
 const {battle,profile,offset,status}=useGame();
 const b=battle!,me=b.players.find(p=>p.id===profile!.id)!,turn=b.players.find(p=>p.id===b.turnId);
 // Limits remain authoritative equipment data; equipment itself is not part of the HUD.
 const {minAngle,maxAngle}=WEAPONS.find(item=>item.id===me.equipment.weapon)!;
 const [power,setPower]=useState(MIN_POWER),[lastPower,setLastPower]=useState<number|null>(null);
 const [charging,setCharging]=useState(false),[seconds,setSeconds]=useState(30),[exit,setExit]=useState(false);
 const [submitted,setSubmitted]=useState<'shot'|'pass'|null>(null);
 const mine=b.turnId===me.id&&b.phase==='aiming';
 const canAct=mine&&!blocked&&!exit&&status==='online'&&me.hp>0&&!submitted;
 const chargeStarted=useRef<number|null>(null),chargeSource=useRef<ChargeSource|null>(null),chargingRef=useRef(false);
 const paintedPower=useRef(MIN_POWER),turnSubmitted=useRef(false),pointer=useRef<number|null>(null);
 const live=useRef({canAct,angle,minAngle,maxAngle,me});live.current={canAct,angle,minAngle,maxAngle,me};

 // This ref represents the value committed to the visible meter, not a pending
 // RAF/state update. Release never recalculates elapsed time or uses stale state.
 useLayoutEffect(()=>{paintedPower.current=power;},[power]);
 const cancelCharge=useCallback(()=>{
  chargeStarted.current=null;chargeSource.current=null;chargingRef.current=false;pointer.current=null;setCharging(false);
 },[]);
 const beginCharge=useCallback((source:ChargeSource)=>{
  if(!live.current.canAct||turnSubmitted.current||chargingRef.current)return false;
  chargeStarted.current=performance.now();chargeSource.current=source;chargingRef.current=true;
  setPower(MIN_POWER);setCharging(true);return true;
 },[]);
 const releaseCharge=useCallback((source:ChargeSource)=>{
  if(!chargingRef.current||chargeSource.current!==source)return;
  const value=paintedPower.current;
  cancelCharge();
  if(!live.current.canAct||turnSubmitted.current)return;
  // A RAF update may already be queued when keyup arrives. Replace it with
  // the committed release value so the frozen meter agrees with the shot.
  turnSubmitted.current=true;setSubmitted('shot');setPower(value);setLastPower(value);
  client.send({type:'fire',angle:live.current.angle,power:value});
 },[cancelCharge]);
 const passTurn=useCallback(()=>{
  if(!live.current.canAct||turnSubmitted.current)return;
  cancelCharge();turnSubmitted.current=true;setSubmitted('pass');client.send({type:'pass'});
 },[cancelCharge]);
 const useBoost=useCallback((id:BoostId)=>{
  const boost=BOOSTS.find(item=>item.id===id)!,fighter=live.current.me;
  if(!live.current.canAct||turnSubmitted.current||fighter.boosts.includes(id)||fighter.stamina<boost.cost)return;
  if(id.startsWith('extra')&&fighter.boosts.some(item=>item.startsWith('extra')))return;
  client.send({type:'boost',boost:id});
 },[]);

 useLayoutEffect(()=>{
  cancelCharge();turnSubmitted.current=false;setSubmitted(null);
 },[b.id,b.turnId,b.turnNumber,cancelCharge]);
 useLayoutEffect(()=>{if(!canAct)cancelCharge();},[canAct,cancelCharge]);
 useEffect(()=>{
  const tick=()=>setSeconds(Math.max(0,Math.ceil((b.deadline-Date.now()-offset)/1000)));
  tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);
 },[b.deadline,offset]);
 useEffect(()=>{
  if(!charging)return;
  let frame=0;
  const paint=(now:number)=>{
   if(!chargingRef.current||chargeStarted.current===null)return;
   const value=Math.min(MAX_POWER,Math.round(MIN_POWER+(now-chargeStarted.current)/CHARGE_MS*(MAX_POWER-MIN_POWER)));
   setPower(value);
   // Cap visibly at 100. A full bar still waits for a real release to fire.
   if(value<MAX_POWER)frame=requestAnimationFrame(paint);
  };
  frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);
 },[charging]);
 useEffect(()=>{
  if(!canAct)return;
  let previous='';
  const sync=()=>{
   if(!live.current.canAct||turnSubmitted.current)return;
   const next={type:'aim' as const,angle:live.current.angle,power:paintedPower.current,charging:chargingRef.current};
   const key=JSON.stringify(next);if(key!==previous){previous=key;client.send(next);}
  };
  sync();const timer=setInterval(sync,160);return()=>clearInterval(timer);
 },[canAct,b.turnNumber]);
 useEffect(()=>{
  const keys=new Set<string>();
  const down=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||ignoresGameKeys(event.target)||!live.current.canAct)return;
   const key=event.key.toLowerCase();
   if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))event.preventDefault();
   if(event.repeat)return;
   keys.add(key);
   if(key===' ')beginCharge('keyboard');
   const boost=BOOSTS.find(item=>item.key===key);if(boost)useBoost(boost.id);
   if(key==='p')passTurn();
  };
  const up=(event:KeyboardEvent)=>{
   keys.delete(event.key.toLowerCase());
   if(event.key===' '&&chargeSource.current==='keyboard'){
    event.preventDefault();
    if(ignoresGameKeys(event.target))cancelCharge();else releaseCharge('keyboard');
   }
  };
  const blur=()=>{keys.clear();cancelCharge();};
  const focus=(event:FocusEvent)=>{if(ignoresGameKeys(event.target)&&chargeSource.current==='keyboard')blur();};
  const visibility=()=>{if(document.hidden)blur();};
  const timer=setInterval(()=>{
   if(!live.current.canAct||turnSubmitted.current||ignoresGameKeys(document.activeElement))return;
   if(keys.has('a')||keys.has('arrowleft'))client.send({type:'walk',direction:-1});
   if(keys.has('d')||keys.has('arrowright'))client.send({type:'walk',direction:1});
   if(keys.has('w')||keys.has('arrowup'))setAngle(Math.min(live.current.maxAngle,live.current.angle+1));
   if(keys.has('s')||keys.has('arrowdown'))setAngle(Math.max(live.current.minAngle,live.current.angle-1));
  },90);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);window.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);};
 },[beginCharge,cancelCharge,releaseCharge,passTurn,useBoost,setAngle]);

 const chargeHint=charging?(power===MAX_POWER?'FORÇA MÁXIMA · SOLTE PARA DISPARAR':'SOLTE PARA DISPARAR'):submitted?'AGUARDANDO O PRÓXIMO TURNO':canAct?'SEGURE ESPAÇO PARA CARREGAR':'AGUARDE SUA VEZ';
 const angleStyle={'--aim-angle':`${-angle}deg`} as CSSProperties;

 return <div className={`artillery-hud ${b.phase==='finished'?'battle-finished':''} ${charging?'is-charging':''}`}>
  <div className="battle-top">
   <button className="round-button battle-exit" title="Sair da batalha" aria-label="Sair da batalha" onClick={()=>{cancelCharge();setExit(true);}}><LogOut size={20}/></button>
   <div className="battle-player-panel">
    <div className="battle-player-portrait"><Avatar equipment={me.equipment} size={126} showAura weapon={false}/><LevelBadge level={me.level} size={34}/></div>
    <div className="battle-player-vitals"><strong className="battle-player-name">{me.name}</strong><div className={`battle-health ${me.hp/me.maxHp<=.25?'critical-health':''}`} role="meter" aria-label="Sua vida" aria-valuenow={me.hp} aria-valuemin={0} aria-valuemax={me.maxHp}><i className="health-trail" style={{width:`${me.hp/me.maxHp*100}%`}}/><i className="health-current" style={{width:`${me.hp/me.maxHp*100}%`}}/><span><b>HP</b>{me.hp.toLocaleString('pt-BR')}<small>/ {me.maxHp.toLocaleString('pt-BR')}</small></span></div><span className="battle-player-team">EQUIPE {me.team===0?'AZUL':'RUBRA'}</span>
    {b.players.filter(p=>p.team===me.team&&p.id!==me.id).map(p=><div className="fighter-hud blue" key={p.id}><div><strong>{p.name}</strong><div className="mini-health"><i style={{width:`${p.hp/p.maxHp*100}%`}}/></div></div><span>{p.hp}</span></div>)}</div>
   </div>
   <div className={`turn-clock ${mine?'your-turn':''} ${seconds<=10&&b.phase==='aiming'?'urgent':''} ${seconds<=5&&b.phase==='aiming'?'critical-time':''}`}>
    <span>{b.phase==='finished'?'FINAL':b.phase==='resolving'?'DISPARO':mine?'SUA VEZ':'AGUARDE'}</span>
    <b key={`${b.turnNumber}-${seconds}`} aria-label={b.phase==='aiming'?`${seconds} segundos`:undefined}><BattleText className="clock-face">{b.phase==='aiming'?String(seconds):b.phase==='finished'?'◆':'···'}</BattleText></b>
    <small>TURNO {b.turnNumber}</small>
   </div>
   <div className="battle-team-bars opponent-bars">{b.players.filter(p=>p.team!==me.team).map(p=><div className={`fighter-hud coral ${p.id===b.turnId?'active-fighter':''}`} key={p.id}><Flag size={18}/><div><strong>{p.name}</strong><div className="mini-health"><i style={{width:`${p.hp/p.maxHp*100}%`}}/></div></div><span>{p.hp}</span></div>)}</div>
   <div className="wind-pill"><Wind size={23}/><div><small>VENTO</small><strong>{Math.abs(b.wind).toFixed(1)} <span>{b.wind>=0?'→':'←'}</span></strong></div></div>
  </div>
  {mine&&!blocked&&!exit&&<div key={`${b.id}-${b.turnNumber}`} className="turn-announcement" role="status"><BattleText>SUA VEZ!</BattleText><span>CAPRICHE NA MIRA</span></div>}
  {!mine&&b.phase!=='finished'&&<div className="turn-label">{b.powerCutIn?'POWER!':b.phase==='resolving'?'DISPARO EM VOO':`${turn?.name??'Oponente'} está mirando`}</div>}
  <EnvironmentControls map={b.map} blocked={blocked||exit||b.phase==='finished'}/>

  <aside className="boost-bar" aria-label="Ferramentas de batalha">
   <div className="boost-caption"><Zap size={15}/> PODERES</div>
   {BOOSTS.map((boost,index)=>{
    const selected=me.boosts.includes(boost.id),disabled=!canAct||selected||me.stamina<boost.cost||(boost.id.startsWith('extra')&&me.boosts.some(id=>id.startsWith('extra')));
    const damage=boost.id.startsWith('damage'),symbol=boost.id==='trident'?'×3':boost.label;
    return <button type="button" key={boost.id} data-boost={boost.id} aria-label={`${boost.name}, ${boost.cost} vigor`} aria-pressed={selected} title={`${boost.name}\n${boost.detail}\n${boost.cost} de vigor`} className={`boost ${selected?'selected':''}`} disabled={disabled} onClick={event=>{useBoost(boost.id);if(event.detail>0)event.currentTarget.blur();}}>
     <span className="boost-painted-icon" aria-hidden="true" style={{backgroundPosition:`${(index%4)*100/3}% ${Math.floor(index/4)*100}%`}}/>
     <span className={`boost-symbol-label ${damage?'boost-damage-label':'boost-shot-label'}`} aria-hidden="true">{damage&&<i>POWER</i>}<strong>{damage?<>{symbol.replace('%','')}<small>%</small></>:symbol}</strong></span>
     <kbd>{boost.key}</kbd>{selected&&<span className="boost-ready" aria-hidden="true">✓</span>}
    </button>;
   })}
  </aside>

  <div className="battle-console" aria-label="Controles de batalha">
   <div className="angle-control" style={angleStyle}>
    <div className="angle-dial"><div className="angle-needle"/><Target size={18}/><strong>{angle}<small>°</small></strong><span>ÂNGULO</span></div>
    <div className="angle-buttons"><button type="button" disabled={!canAct} aria-label="Aumentar ângulo" onClick={event=>{setAngle(Math.min(maxAngle,angle+1));if(event.detail>0)event.currentTarget.blur();}}><ChevronUp size={23}/></button><button type="button" disabled={!canAct} aria-label="Diminuir ângulo" onClick={event=>{setAngle(Math.max(minAngle,angle-1));if(event.detail>0)event.currentTarget.blur();}}><ChevronDown size={23}/></button></div>
   </div>
   <div className="power-controls">
    <div className="power-label"><span>FORÇA</span><div className="power-readout"><output data-testid="shot-power" aria-label="Força atual">{power}</output><small>/ 100</small></div><span className="last-power-label">ÚLTIMO <output data-testid="last-shot-power">{lastPower??'—'}</output></span></div>
    <div role="meter" aria-label="Força do disparo" aria-valuemin={MIN_POWER} aria-valuemax={MAX_POWER} aria-valuenow={power} aria-valuetext={`${power} de 100`} aria-disabled={!canAct} aria-describedby="charge-instructions" data-charging={charging} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();if(beginCharge('pointer')){pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}} onPointerUp={event=>{if(pointer.current!==event.pointerId)return;event.preventDefault();releaseCharge('pointer');}} onPointerCancel={cancelCharge} onLostPointerCapture={()=>{if(chargeSource.current==='pointer')cancelCharge();}} onContextMenu={event=>event.preventDefault()} className={`power-track ${charging?'charging':''} ${power===MAX_POWER?'at-cap':''}`}>
     <i className="power-fill" style={{width:`${power}%`}}/><div className="power-graduations" aria-hidden="true">{Array.from({length:101},(_,value)=><span key={value} className={value%10===0?'major':value%5===0?'medium':'minor'} style={{left:`${value}%`}}/>)}</div>
     {lastPower!==null&&<span className="last-power-marker" aria-hidden="true" style={{left:`${lastPower}%`}}/>}
     <span className="power-cursor" aria-hidden="true" style={{left:`${power}%`}}/>
    </div>
    <div className="power-ticks" aria-hidden="true">{[0,10,20,30,40,50,60,70,80,90,100].map(value=><span key={value} style={{left:`${value}%`}}>{value}</span>)}</div>
    <div className="power-hint"><kbd>ESPAÇO</kbd><span>{chargeHint}</span></div>
   </div>
   <span id="charge-instructions" className="battle-sr-only">Segure Espaço ou toque e segure a régua para carregar. Solte para disparar a força mostrada. Use as setas do teclado para andar e mirar.</span>
   <button type="button" className={`combat-power ${(me.powerCharge??0)>=100?'power-full':''} ${me.powerArmed?'power-armed':''}`} style={{'--power-charge':`${me.powerArmed?100:me.powerCharge??0}%`} as CSSProperties} disabled={!canAct||me.powerArmed||(me.powerCharge??0)<100} aria-label={me.powerArmed?'Power preparado':`Ativar Power, ${Math.floor(me.powerCharge??0)} de 100`} aria-pressed={!!me.powerArmed} title="Acumule ao acertar e receber dano. Com 100, ative para fortalecer o próximo tiro. Passar ou deixar o tempo acabar perde a ativação." onClick={event=>{client.send({type:'power'});if(event.detail>0)event.currentTarget.blur();}}>
    <span className="combat-power-orbit" aria-hidden="true"/><span className="combat-power-core"><strong>POWER</strong><small>{me.powerArmed?'ATIVADO':(me.powerCharge??0)>=100?'ATIVAR':`${Math.floor(me.powerCharge??0)} / 100`}</small></span>
   </button>
   <div className="battle-actions">
    <div className="vigor-bar" aria-label={`Vigor ${me.stamina} de ${me.maxStamina}`}><i style={{width:`${me.stamina/me.maxStamina*100}%`}}/><span><Zap size={12}/>{me.stamina}<small>VIGOR</small></span></div>
    <button type="button" disabled={!canAct} className="skip-button" aria-label="Passar turno" onClick={passTurn}><SkipForward size={16}/><span>PASSAR</span><kbd>P</kbd></button>
   </div>
  </div>

  {exit&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="battle-exit-title"><div className="confirm-panel"><h2 id="battle-exit-title">Sair da batalha?</h2><p>Seu personagem será retirado desta partida.</p><div><button type="button" className="button quiet" autoFocus onClick={()=>setExit(false)}>Continuar</button><button type="button" className="button gold" onClick={()=>client.send({type:'leave'})}>Sair</button></div></div></div>}
  <PowerCutIn battle={b} offset={offset}/>
  {b.phase==='finished'&&<BattleRewards battle={b} me={me}/>}
 </div>;
}
