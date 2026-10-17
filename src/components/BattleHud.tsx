import {PowerCutIn} from './PowerCutIn';
import {Avatar} from './Avatar';
import {LevelBadge} from './LevelBadge';
import {BattleText} from './BattleText';
import {BattleRewards} from './BattleRewards';
import {AbilitySlots} from './AbilitySlots';
import {AngleGauge,PowerOrb} from './CombatGauges';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {ChevronDown,ChevronUp,Wind,Zap,SkipForward,LogOut} from 'lucide-react';
import {BOOSTS,WEAPONS} from '../../shared/catalog';
import type {BoostId} from '../../shared/catalog';
import type {AbilityId} from '../../shared/abilities';
import {clampAimAngle,weaponAimLimits} from '../../shared/aim';
import type {Fighter} from '../../shared/protocol';
import {client,useGame} from '../client';
import './BattleHud.css';
import './BattleHudRefinement.css';
import './BattleConsole.css';
type ChargeSource='keyboard'|'pointer';
const MIN_POWER=5,MAX_POWER=100,CHARGE_MS=2600;
const ignoresGameKeys=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="menu"]');

function FighterPanel({fighter,others,opponent,turnId,resolving}:{fighter:Fighter;others:Fighter[];opponent:boolean;turnId:string;resolving:boolean}){
 const active=fighter.id===turnId,ratio=Math.max(0,Math.min(1,fighter.hp/fighter.maxHp));
 return <section className={`battle-player-panel ${opponent?'opponent-panel':'own-panel'} ${active?'active-fighter':''} ${fighter.hp<=0?'defeated-fighter':''}`} aria-label={opponent?'Oponente':'Seu personagem'} data-fighter={fighter.id}>
  <div className="battle-player-portrait"><Avatar equipment={fighter.equipment} size={88} portrait animated={false} weapon={false}/><LevelBadge level={fighter.level} size={29}/>{active&&<span className="portrait-turn-point" aria-hidden="true"><ChevronDown size={19}/></span>}</div>
  <div className="battle-player-vitals">
   <div className="battle-player-heading"><strong className="battle-player-name">{fighter.name}</strong>{active&&<span className="fighter-turn-label" aria-label={`Turno de ${fighter.name}`}>{resolving?'DISPARANDO':opponent?'JOGANDO':'SUA VEZ'}</span>}</div>
   <div className={`battle-health ${ratio<=.25?'critical-health':''}`} role="meter" aria-label={opponent?`Vida de ${fighter.name}`:'Sua vida'} aria-valuenow={fighter.hp} aria-valuemin={0} aria-valuemax={fighter.maxHp}><i className="health-trail" style={{width:`${ratio*100}%`}}/><i className="health-current" style={{width:`${ratio*100}%`}}/><span><b>HP</b>{fighter.hp.toLocaleString('pt-BR')}<small>/ {fighter.maxHp.toLocaleString('pt-BR')}</small></span></div>
   <div className="battle-team-line"><span className="battle-player-team">{opponent?'OPONENTE':'VOCÊ'} · EQUIPE {fighter.team===0?'AZUL':'RUBRA'}</span>{fighter.hp<=0&&<span className="fighter-out">FORA DE COMBATE</span>}</div>
   {others.map(player=><div className={`fighter-hud ${opponent?'coral':'blue'} ${player.id===turnId?'active-fighter':''}`} key={player.id} data-fighter={player.id}><span className="fighter-mini-turn" aria-hidden="true">{player.id===turnId?'▶':''}</span><div><strong>{player.name}</strong><div className="mini-health" role="meter" aria-label={`Vida de ${player.name}`} aria-valuenow={player.hp} aria-valuemin={0} aria-valuemax={player.maxHp}><i style={{width:`${Math.max(0,player.hp/player.maxHp)*100}%`}}/></div></div><span>{player.hp}</span></div>)}
  </div>
 </section>;
}

export function BattleHud({angle,setAngle,blocked}:{angle:number;setAngle:(v:number)=>void;blocked:boolean}){
 const {battle,profile,offset,status}=useGame();
 const b=battle!,me=b.players.find(p=>p.id===profile!.id)!,turn=b.players.find(p=>p.id===b.turnId);
 const opponents=b.players.filter(player=>player.team!==me.team),opponent=turn?.team!==me.team&&turn?turn:opponents.find(player=>player.hp>0)??opponents[0];
 // Limits remain authoritative equipment data; equipment itself is not part of the HUD.
 const weapon=WEAPONS.find(item=>item.id===me.equipment.weapon)!,aimSlope=me.aimSlope??0;
 const {minAngle,maxAngle}=weaponAimLimits(weapon,aimSlope);
 const [power,setPower]=useState(MIN_POWER),[lastPower,setLastPower]=useState<number|null>(null);
 const [charging,setCharging]=useState(false),[seconds,setSeconds]=useState(30),[exit,setExit]=useState(false);
 const [submitted,setSubmitted]=useState<'shot'|'pass'|null>(null);
 const mine=b.turnId===me.id&&b.phase==='aiming';
 const canAct=mine&&!blocked&&!exit&&status==='online'&&me.hp>0&&!submitted;
 const flightBlocked=!canAct||!me.flightArmed&&(me.boosts.length>0||!!me.powerArmed||!!me.homingArmed);
 const chargeStarted=useRef<number|null>(null),chargeSource=useRef<ChargeSource|null>(null),chargingRef=useRef(false);
 const paintedPower=useRef(MIN_POWER),turnSubmitted=useRef(false),pointer=useRef<number|null>(null);
 const live=useRef({canAct,angle,minAngle,maxAngle,me});live.current={canAct,angle,minAngle,maxAngle,me};
 const terrainAim=useRef<{battleId:string;slope:number}|null>(null);
 useLayoutEffect(()=>{
  const previous=terrainAim.current,newBattle=previous?.battleId!==b.id;
  const next=clampAimAngle(weapon,aimSlope,newBattle?(me.aimAngle??45):angle+aimSlope-previous.slope);
  terrainAim.current={battleId:b.id,slope:aimSlope};
  // Layout runs before the aim publisher. Its ref must see the corrected value
  // even while the parent is committing the new visible angle.
  live.current.angle=next;
  if(next!==angle)setAngle(next);
 },[b.id,weapon,aimSlope,angle,setAngle]);

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
  if(!live.current.canAct||turnSubmitted.current||fighter.flightArmed||(id==='trident'&&fighter.boosts.includes(id))||fighter.stamina<boost.cost)return;
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
   if(!live.current.me.flightArmed&&(keys.has('a')||keys.has('arrowleft')))client.send({type:'walk',direction:-1});
   if(!live.current.me.flightArmed&&(keys.has('d')||keys.has('arrowright')))client.send({type:'walk',direction:1});
   if(keys.has('w')||keys.has('arrowup'))setAngle(Math.min(live.current.maxAngle,live.current.angle+1));
   if(keys.has('s')||keys.has('arrowdown'))setAngle(Math.max(live.current.minAngle,live.current.angle-1));
  },90);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);window.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);};
 },[beginCharge,cancelCharge,releaseCharge,passTurn,useBoost,setAngle]);

 const chargeHint=charging?(power===MAX_POWER?'FORÇA MÁXIMA · SOLTE PARA DISPARAR':'SOLTE PARA DISPARAR'):submitted?'AGUARDANDO O PRÓXIMO TURNO':canAct?(me.flightArmed?'VOO ATIVO · MIRE E CARREGUE':'SEGURE ESPAÇO PARA CARREGAR'):'AGUARDE SUA VEZ';
 const activeAbilities:AbilityId[]=[...(me.homingArmed?['homing' as const]:[]),...((me.invisibleTurns??0)>0?['invisibility' as const]:[])];
 const unavailableAbilities:AbilityId[]=[...(me.hp>=me.maxHp?['heal' as const]:[]),...(me.homingArmed?['homing' as const]:[])];

 return <div className={`artillery-hud ${b.phase==='finished'?'battle-finished':''} ${charging?'is-charging':''}`} data-party-size={Math.max(b.players.filter(player=>player.team===me.team).length,opponents.length)}>
  <div className="battle-top">
   <button className="round-button battle-exit" title="Sair da batalha" aria-label="Sair da batalha" onClick={()=>{cancelCharge();setExit(true);}}><LogOut size={20}/></button>
   <FighterPanel fighter={me} others={b.players.filter(player=>player.team===me.team&&player.id!==me.id)} opponent={false} turnId={b.turnId} resolving={b.phase==='resolving'}/>
   <div className="battle-center-status">
   <div className={`wind-pill ${Math.abs(b.wind)<.05?'calm-wind':''}`} role="status" aria-label={`Vento ${Math.abs(b.wind).toFixed(1)} para ${b.wind<0?'esquerda':'direita'}`}>
    <Wind className="wind-symbol" size={18} aria-hidden="true"/><div className="wind-reading"><small>VENTO</small><strong>{Math.abs(b.wind).toFixed(1)}</strong></div>
    <span className={`wind-direction ${b.wind<0?'wind-left':''}`} aria-hidden="true"><svg viewBox="0 0 64 30"><defs><linearGradient id="battle-wind-arrow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3fcff"/><stop offset=".5" stopColor="#a0ebff"/><stop offset="1" stopColor="#319dd1"/></linearGradient></defs><path d="M4 9h34V3a1 1 0 0 1 2-1l20 12a1.2 1.2 0 0 1 0 2L40 28a1 1 0 0 1-2-1v-6H4l6-6z" fill="url(#battle-wind-arrow)" stroke="#133954" strokeWidth="2" strokeLinejoin="round"/><path d="M13 11h25M41 7l13 8" fill="none" stroke="#fff8cc" strokeWidth="2" strokeLinecap="round"/></svg></span>
   </div>
   <div className={`turn-clock ${mine?'your-turn':''} ${seconds<=10&&b.phase==='aiming'?'urgent':''} ${seconds<=5&&b.phase==='aiming'?'critical-time':''}`}>
    <span>{b.phase==='finished'?'FINAL':b.phase==='resolving'?'DISPARO':mine?'SUA VEZ':'AGUARDE'}</span>
    <b key={`${b.turnNumber}-${seconds}`} aria-label={b.phase==='aiming'?`${seconds} segundos`:undefined}><BattleText className="clock-face">{b.phase==='aiming'?String(seconds):b.phase==='finished'?'◆':'···'}</BattleText></b>
    <small>TURNO {b.turnNumber}</small>
   </div>
   </div>
   {opponent&&<FighterPanel fighter={opponent} others={opponents.filter(player=>player.id!==opponent.id)} opponent turnId={b.turnId} resolving={b.phase==='resolving'}/>}
  </div>
  {mine&&!blocked&&!exit&&<div key={`${b.id}-${b.turnNumber}`} className="turn-announcement" role="status"><BattleText>SUA VEZ!</BattleText><span>CAPRICHE NA MIRA</span></div>}
  {!mine&&b.phase!=='finished'&&<div className="turn-label">{b.powerCutIn?'POWER!':b.phase==='resolving'?'DISPARO EM VOO':`${turn?.name??'Oponente'} está mirando`}</div>}

  <aside className="battle-ability-tray" aria-label="Habilidades e voo">
   <AbilitySlots loadout={me.abilityLoadout} counts={me.abilities} active={activeAbilities} disabled={!canAct||!!me.flightArmed} unavailable={unavailableAbilities} onUse={ability=>{if(canAct&&!me.flightArmed)client.send({type:'ability',ability});}}/>
   <span className="ability-flight-divider" aria-hidden="true"/>
   <button type="button" className={`flight-control ${me.flightArmed?'flight-armed':''}`} data-flight={!!me.flightArmed} disabled={flightBlocked} aria-pressed={!!me.flightArmed} aria-label={me.flightArmed?'Cancelar voo':'Ativar voo'} title="Voo: mire e lance o avião para se deslocar. Substitui seu disparo e não causa dano. Não combina com poderes ou mira assistida." onClick={event=>{cancelCharge();if(!flightBlocked)client.send({type:'flight',active:!me.flightArmed});if(event.detail>0)event.currentTarget.blur();}}><img src="/assets/abilities/flight.png" alt="" draggable={false}/><span>{me.flightArmed?'ATIVO':'VOO'}</span></button>
  </aside>

  <aside className="boost-bar" aria-label="Ferramentas de batalha">
   <div className="boost-caption"><Zap size={15}/> PODERES</div>
   {BOOSTS.map((boost,index)=>{
    const count=me.boosts.filter(id=>id===boost.id).length,selected=count>0,disabled=!canAct||me.flightArmed||(boost.id==='trident'&&selected)||me.stamina<boost.cost;
    const damage=boost.id.startsWith('damage'),symbol=boost.id==='trident'?'×3':boost.label;
    return <button type="button" key={boost.id} data-boost={boost.id} data-count={count} aria-label={`${boost.name}, ${boost.cost} vigor${count?`, ${count} ${count===1?'uso':'usos'}`:''}`} aria-pressed={selected} title={`${boost.name}\n${boost.detail}\n${boost.cost} de vigor${count?`\n${count} ${count===1?'uso preparado':'usos preparados'}`:''}`} className={`boost ${selected?'selected':''}`} disabled={disabled} onClick={event=>{useBoost(boost.id);if(event.detail>0)event.currentTarget.blur();}}>
     <span className="boost-painted-icon" aria-hidden="true" style={{backgroundPosition:`${(index%4)*100/3}% ${Math.floor(index/4)*100}%`}}/>
     <span className={`boost-symbol-label ${damage?'boost-damage-label':'boost-shot-label'}`} aria-hidden="true">{damage&&<i>POWER</i>}<strong>{damage?<>{symbol.replace('%','')}<small>%</small></>:symbol}</strong></span>
     <kbd>{boost.key}</kbd>{selected&&<span className="boost-ready" aria-hidden="true">×{count}</span>}
    </button>;
   })}
  </aside>

  <div className="battle-console" aria-label="Controles de batalha">
   <div className="angle-control">
    <AngleGauge angle={angle} minAngle={minAngle} maxAngle={maxAngle} facing={me.facing} slope={aimSlope}/>
    <div className="angle-buttons"><button type="button" disabled={!canAct} aria-label="Aumentar ângulo" onClick={event=>{setAngle(Math.min(maxAngle,angle+1));if(event.detail>0)event.currentTarget.blur();}}><ChevronUp size={23}/></button><button type="button" disabled={!canAct} aria-label="Diminuir ângulo" onClick={event=>{setAngle(Math.max(minAngle,angle-1));if(event.detail>0)event.currentTarget.blur();}}><ChevronDown size={23}/></button></div>
   </div>
   <div className="power-controls">
    <div className="power-label"><span>FORÇA</span><div className="power-readout"><output data-testid="shot-power" aria-label="Força atual">{power}</output><small>/ 100</small></div><span className="last-power-label">ÚLTIMO <output data-testid="last-shot-power">{lastPower??'—'}</output></span></div>
    <div role="meter" aria-label="Força do disparo" aria-valuemin={MIN_POWER} aria-valuemax={MAX_POWER} aria-valuenow={power} aria-valuetext={`${power} de 100`} aria-disabled={!canAct} aria-describedby="charge-instructions" data-charging={charging} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();if(beginCharge('pointer')){pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}} onPointerUp={event=>{if(pointer.current!==event.pointerId)return;event.preventDefault();releaseCharge('pointer');}} onPointerCancel={cancelCharge} onLostPointerCapture={()=>{if(chargeSource.current==='pointer')cancelCharge();}} onContextMenu={event=>event.preventDefault()} className={`power-track ${charging?'charging':''} ${power===MAX_POWER?'at-cap':''}`} style={{'--shot-power':`${power}%`} as CSSProperties}>
     <i className="power-fill" aria-hidden="true"/><span className="power-segments" aria-hidden="true"/><span className="power-gloss" aria-hidden="true"/>
     {lastPower!==null&&<span className="last-power-marker" aria-hidden="true" style={{left:`${lastPower}%`}}><b>{lastPower}</b></span>}
     <span className="power-cursor" aria-hidden="true" style={{left:`${power}%`}}/>
    </div>
    <div className="power-ruler" aria-hidden="true">
     <div className="power-graduations">{Array.from({length:101},(_,value)=><span key={value} className={value%10===0?'major':value%5===0?'medium':'minor'} style={{left:`${value}%`}}/>)}</div>
     <div className="power-ticks">{[0,10,20,30,40,50,60,70,80,90,100].map(value=><span key={value} style={{left:`${value}%`}}>{value}</span>)}</div>
    </div>
    <div className="power-hint"><kbd>ESPAÇO</kbd><span>{chargeHint}</span></div>
   </div>
   <span id="charge-instructions" className="battle-sr-only">Segure Espaço ou toque e segure a régua para carregar. Solte para disparar a força mostrada. Use as setas do teclado para andar e mirar.</span>
   <PowerOrb charge={me.powerCharge??0} armed={!!me.powerArmed} disabled={!canAct||!!me.flightArmed||!!me.powerArmed||(me.powerCharge??0)<100} onActivate={()=>client.send({type:'power'})}/>
   <div className="battle-actions">
    <div className="vigor-display"><div className="vigor-caption"><span><Zap size={13}/>VIGOR</span><strong>{me.stamina}<small> / {me.maxStamina}</small></strong></div><div className="vigor-bar" role="meter" aria-label="Vigor" aria-valuenow={me.stamina} aria-valuemin={0} aria-valuemax={me.maxStamina}><i style={{width:`${me.stamina/me.maxStamina*100}%`}}/></div></div>
    <button type="button" disabled={!canAct} className="skip-button" aria-label="Passar turno" onClick={passTurn}><SkipForward size={16}/><span>PASSAR</span><kbd>P</kbd></button>
   </div>
  </div>

  {exit&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="battle-exit-title"><div className="confirm-panel"><h2 id="battle-exit-title">Sair da batalha?</h2><p>Seu personagem será retirado desta partida.</p><div><button type="button" className="button quiet" autoFocus onClick={()=>setExit(false)}>Continuar</button><button type="button" className="button gold" onClick={()=>client.send({type:'leave'})}>Sair</button></div></div></div>}
  <PowerCutIn battle={b} offset={offset}/>
  {b.phase==='finished'&&<BattleRewards battle={b} me={me}/>}
 </div>;
}
