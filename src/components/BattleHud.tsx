import {BattleChat} from './BattleChat';
import {PowerCutIn} from './PowerCutIn';
import {powBoostConflict} from '../../shared/weaponKit';
import {BattleText} from './BattleText';
import {BattleRewards} from './BattleRewards';
import {AbilitySlots} from './AbilitySlots';
import {PetSkillBar} from './PetSkillBar';
import {AngleGauge,PowerOrb,WindGauge} from './CombatGauges';
import {ActivePortrait,FighterRoster,Minimap} from './BattleTopBar';
import {ExpeditionFoes,ExpeditionBanners,ExpeditionObjective} from './ExpeditionBattle';
import {MONSTER_TURN_ID} from '../../shared/instanceTurn';
import {DRAGON_TURN_ID} from '../../shared/worldBoss';
import {WorldBossBanner,WorldBossBar} from './WorldBoss';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {ChevronDown,ChevronUp,Zap} from 'lucide-react';
import {BOOSTS,WEAPONS} from '../../shared/catalog';
import {powerUpConflict} from '../../shared/powerUps';
import {FORCE_BAR_MAX,forceBarValue} from '../../shared/forceBar';
import type {BoostId} from '../../shared/catalog';
import type {AbilityId} from '../../shared/abilities';
import {aimSource,clampAimAngle,weaponAimLimits} from '../../shared/aim';
import type {Fighter} from '../../shared/protocol';
import {client,useGame} from '../client';
import './BattleHud.css';
import './BattleHudRefinement.css';
import './BattleConsole.css';
type ChargeSource='keyboard'|'pointer';
const MIN_POWER=1,MAX_POWER=FORCE_BAR_MAX;
const ignoresGameKeys=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],[role="menu"]');
// A HUD button that kept focus after a click (PASS, a boost, an ability) must not swallow walking, turning or aiming.
const ignoresMoveKeys=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]');

export function BattleHud({angle,setAngle,blocked}:{angle:number;setAngle:(v:number)=>void;blocked:boolean}){
 const {battle,profile,offset,status}=useGame();
 const b=battle!,me=b.players.find(p=>p.id===profile!.id)!,turn=b.players.find(p=>p.id===b.turnId);
 const opponents=b.players.filter(player=>player.team!==me.team),instance=b.instance,worldBoss=b.worldBoss,monsterTurn=b.turnId===MONSTER_TURN_ID||b.turnId===DRAGON_TURN_ID;
 const introUntil=instance?.introUntil??worldBoss?.introUntil;
 const [intro,setIntro]=useState(()=>introUntil!==undefined&&introUntil-Date.now()-offset>0);
 // Limits remain authoritative equipment data; equipment itself is not part of the HUD.
 // With the paper plane armed the plane's wider envelope replaces the weapon's.
 const weapon=aimSource(me),aimSlope=me.aimSlope??0;
 const {minAngle,maxAngle}=weaponAimLimits(weapon,aimSlope);
 const [power,setPower]=useState(MIN_POWER),[falling,setFalling]=useState(false),[lastPower,setLastPower]=useState<number|null>(null),[lastWind,setLastWind]=useState<number|null>(null);
 const [charging,setCharging]=useState(false),[seconds,setSeconds]=useState(30),[exit,setExit]=useState(false);
 const [submitted,setSubmitted]=useState<'shot'|'pass'|null>(null);
 const mine=b.turnId===me.id&&b.phase==='aiming';
 // A fallen fighter keeps watching until the end (and keeps the reward) but plays no more.
 const fallen=me.hp<=0&&b.phase!=='finished'&&!worldBoss;
 const canAct=mine&&!intro&&!blocked&&!exit&&status==='online'&&me.hp>0&&!submitted;
 // Turning in place is free and allowed at any time of the match: anyone's turn, a shot in flight, the monsters' turn (the server checks it too).
 const canFace=b.phase!=='finished'&&!blocked&&!exit&&status==='online'&&me.hp>0;
 // The angle can be set at any time too (user request, 18/10/2026); off turn it stays local and is sent when the turn starts.
 const canAim=canFace&&!charging&&!(mine&&!!submitted);
 // POW × Tridente follows the weapon's rule (shared/weaponKit.ts); the server enforces it too.
 const powBlocks=(id:BoostId)=>!!me.powerArmed&&!!powBoostConflict(me.equipment.weapon,id),powerBlocked=me.boosts.some(id=>powBoostConflict(me.equipment.weapon,id));
 const flightBlocked=!canAct||!me.flightArmed&&(me.boosts.length>0||!!me.powerArmed||!!me.homingArmed);
 const chargeStarted=useRef<number|null>(null),chargeSource=useRef<ChargeSource|null>(null),chargingRef=useRef(false);
 const paintedPower=useRef(MIN_POWER),turnSubmitted=useRef(false),pointer=useRef<number|null>(null);
 const live=useRef({canAct,canFace,canAim,angle,minAngle,maxAngle,me,wind:b.wind});live.current={canAct,canFace,canAim,angle,minAngle,maxAngle,me,wind:b.wind};
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
  setPower(MIN_POWER);setFalling(false);setCharging(true);return true;
 },[]);
 const releaseCharge=useCallback((source:ChargeSource)=>{
  if(!chargingRef.current||chargeSource.current!==source)return;
  const value=paintedPower.current;
  cancelCharge();
  if(!live.current.canAct||turnSubmitted.current)return;
  // A RAF update may already be queued when keyup arrives. Replace it with
  // the committed release value so the frozen meter agrees with the shot.
  turnSubmitted.current=true;setSubmitted('shot');setPower(value);setLastPower(value);setLastWind(live.current.wind);
  client.send({type:'fire',angle:live.current.angle,power:value});
 },[cancelCharge]);
 const passTurn=useCallback(()=>{
  if(!live.current.canAct||turnSubmitted.current)return;
  cancelCharge();turnSubmitted.current=true;setSubmitted('pass');client.send({type:'pass'});
 },[cancelCharge]);
 const useBoost=useCallback((id:BoostId)=>{
  const boost=BOOSTS.find(item=>item.id===id)!,fighter=live.current.me;
  if(!live.current.canAct||turnSubmitted.current||fighter.flightArmed||powerUpConflict(fighter.boosts,id)||(fighter.powerArmed&&powBoostConflict(fighter.equipment.weapon,id))||fighter.stamina<boost.cost)return;
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
 // Expeditions open with the monsters walking in; nobody plays until they arrive (the server agrees).
 useEffect(()=>{
  const until=introUntil??0,left=until-Date.now()-offset;setIntro(left>0);if(left<=0)return;
  const timer=setTimeout(()=>setIntro(false),left);return()=>clearTimeout(timer);
 },[introUntil,offset]);
 useEffect(()=>{
  if(!charging)return;
  let frame=0;
  const paint=(now:number)=>{
   if(!chargingRef.current||chargeStarted.current===null)return;
   // DDTank bar: rises to 100, falls back, and passes the turn if it is still held at zero.
   const bar=forceBarValue(now-chargeStarted.current);
   if(bar.power<=0){passTurn();return;}
   setPower(bar.power);setFalling(bar.falling);frame=requestAnimationFrame(paint);
  };
  frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);
 },[charging,passTurn]);
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
   if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
   const key=event.key.toLowerCase(),side=key==='a'||key==='arrowleft'?-1:key==='d'||key==='arrowright'?1:0;
   const move=side!==0||['w','s','arrowup','arrowdown'].includes(key);
   if(move?ignoresMoveKeys(event.target):ignoresGameKeys(event.target))return;
   if(!live.current.canAct){
    if(side&&live.current.canFace){event.preventDefault();if(!event.repeat&&live.current.me.facing!==side)client.send({type:'face',direction:side});}
    if(!side&&move&&live.current.canAim){event.preventDefault();keys.add(key);}
    return;
   }
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
   if(ignoresMoveKeys(document.activeElement))return;
   if(live.current.canAim){
    if(keys.has('w')||keys.has('arrowup'))setAngle(Math.min(live.current.maxAngle,live.current.angle+1));
    if(keys.has('s')||keys.has('arrowdown'))setAngle(Math.max(live.current.minAngle,live.current.angle-1));
   }
   if(!live.current.canAct||turnSubmitted.current)return;
   if(keys.has('a')||keys.has('arrowleft'))client.send({type:'walk',direction:-1});
   if(keys.has('d')||keys.has('arrowright'))client.send({type:'walk',direction:1});
  },90);
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);window.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);};
 },[beginCharge,cancelCharge,releaseCharge,passTurn,useBoost,setAngle]);

 const chargeHint=charging?(power===MAX_POWER?'FORÇA MÁXIMA · SOLTE PARA DISPARAR':falling?'A FORÇA ESTÁ CAINDO · SOLTE PARA DISPARAR':'SOLTE PARA DISPARAR'):submitted?'AGUARDANDO O PRÓXIMO TURNO':canAct?(me.flightArmed?'VOO ATIVO · MIRE E CARREGUE':'SEGURE ESPAÇO PARA CARREGAR'):'AGUARDE SUA VEZ';
 // Why the POW orb can't be used right now; the orb says it when clicked instead of ignoring the click.
 const powerOrbBlock=me.powerArmed?'POW pronto: dispare!':(me.powerCharge??0)<100?'Acerte e receba dano para encher o POW':!mine||monsterTurn?'Ative o POW na sua vez':me.flightArmed?'Cancele o voo para usar o POW':powerBlocked?'O POW desta arma não combina com +1, +2 ou Tridente':!canAct?'Aguarde':undefined;
 const activeAbilities:AbilityId[]=[...(me.homingArmed?['homing' as const]:[]),...((me.invisibleTurns??0)>0?['invisibility' as const]:[])];
 const unavailableAbilities:AbilityId[]=[...(me.hp>=me.maxHp?['heal' as const]:[]),...(me.homingArmed||me.flightArmed?['homing' as const]:[])];

 return <div className={`artillery-hud ${b.phase==='finished'?'battle-finished':''} ${charging?'is-charging':''} ${fallen?'fighter-fallen':''}`} data-party-size={instance?b.players.filter(player=>player.team===me.team).length:Math.max(b.players.filter(player=>player.team===me.team).length,opponents.length)} data-expedition={instance?'':undefined}>
  <div className="battle-top">
   {turn&&<ActivePortrait fighter={turn} mine={turn.id===me.id} resolving={b.phase==='resolving'} ally={turn.team===me.team}/>}
   <FighterRoster players={b.players} myTeam={me.team} turnId={b.turnId} side="ally"/>
   {worldBoss?<WorldBossBar battle={b}/>:instance?<ExpeditionFoes battle={b}/>:<FighterRoster players={b.players} myTeam={me.team} turnId={b.turnId} side="enemy"/>}
   <div className="battle-center-status">
   <WindGauge wind={b.wind} last={lastWind}/>
   <div className={`turn-clock ${mine?'your-turn':''} ${seconds<=10&&b.phase==='aiming'?'urgent':''} ${seconds<=5&&b.phase==='aiming'?'critical-time':''}`}>
    <span>{b.phase==='finished'?'FINAL':b.turnId===DRAGON_TURN_ID?'DRAGÃO':monsterTurn?'MONSTROS':intro?'CHEGANDO':b.phase==='resolving'?'DISPARO':mine?'SUA VEZ':'AGUARDE'}</span>
    <b key={`${b.turnNumber}-${seconds}`} aria-label={b.phase==='aiming'?`${seconds} segundos`:undefined}><BattleText className="clock-face">{b.phase==='aiming'?String(seconds):b.phase==='finished'?'◆':'···'}</BattleText></b>
    <small>TURNO {b.turnNumber}</small>
   </div>
   {mine&&!intro&&<button type="button" disabled={!canAct} className="skip-button" aria-label="Passar turno" onClick={passTurn}><span>PASS</span><kbd>P</kbd></button>}
   </div>
   {instance?<div className="instance-side"><Minimap battle={b} myTeam={me.team} myId={me.id} onExit={()=>{cancelCharge();setExit(true);}}/><ExpeditionObjective battle={b}/></div>
    :<Minimap battle={b} myTeam={me.team} myId={me.id} onExit={()=>{cancelCharge();setExit(true);}}/>}
  </div>
  {instance&&<ExpeditionBanners battle={b} intro={intro}/>}
  {worldBoss&&<WorldBossBanner battle={b}/>}
  {mine&&!intro&&!blocked&&!exit&&<div key={`${b.id}-${b.turnNumber}`} className="turn-announcement" role="status"><BattleText>SUA VEZ!</BattleText><span>CAPRICHE NA MIRA</span></div>}

  {fallen&&<div className="fallen-banner" role="status"><strong>VOCÊ CAIU</strong><span>{me.left?'Você saiu da partida':'Assista até o fim para receber a recompensa'}</span></div>}
  <aside className="battle-ability-tray" aria-label="Habilidades e voo">
   <AbilitySlots loadout={me.abilityLoadout} counts={me.abilities} active={activeAbilities} disabled={!canAct} unavailable={unavailableAbilities} onUse={ability=>{if(canAct&&!(me.flightArmed&&ability==='homing'))client.send({type:'ability',ability});}}/>
   <span className="ability-flight-divider" aria-hidden="true"/>
   <button type="button" className={`flight-control ${me.flightArmed?'flight-armed':''}`} data-flight={!!me.flightArmed} disabled={flightBlocked} aria-pressed={!!me.flightArmed} aria-label={me.flightArmed?'Cancelar voo':'Ativar voo'} title="Voo: mire e lance o avião para se deslocar. Substitui seu disparo e não causa dano. Combina com andar, cura e invisibilidade." onClick={event=>{cancelCharge();if(!flightBlocked)client.send({type:'flight',active:!me.flightArmed});if(event.detail>0)event.currentTarget.blur();}}><img src="/assets/abilities/flight.png" alt="" draggable={false}/><span>{me.flightArmed?'ATIVO':'VOO'}</span></button>
  </aside>

  <PetSkillBar fighter={me} canAct={canAct} mode={instance?'pve':'pvp'}/>
  <aside className="boost-bar" aria-label="Ferramentas de batalha">
   <div className="boost-caption"><Zap size={15}/> PODERES</div>
   {BOOSTS.map((boost,index)=>{
     const count=b.turnId===me.id?me.boosts.filter(id=>id===boost.id).length:0,selected=count>0,disabled=!canAct||me.flightArmed||(b.turnId===me.id&&!!powerUpConflict(me.boosts,boost.id))||powBlocks(boost.id)||me.stamina<boost.cost;
    const damage=boost.id.startsWith('damage'),symbol=boost.id==='trident'?'×3':boost.label;
    return <button type="button" key={boost.id} data-boost={boost.id} data-count={count} aria-label={`${boost.name}, ${boost.cost} vigor${count?`, ${count} ${count===1?'uso':'usos'}`:''}`} aria-pressed={selected} title={`${boost.name}\n${boost.detail}\n${boost.cost} de vigor${count?`\n${count} ${count===1?'uso preparado':'usos preparados'}`:''}`} className={`boost ${selected?'selected':''}`} disabled={disabled} onClick={event=>{useBoost(boost.id);if(event.detail>0)event.currentTarget.blur();}}>
     <span className="boost-painted-icon" aria-hidden="true" style={{backgroundPosition:`${(index%4)*100/3}% ${Math.floor(index/4)*100}%`}}/>
     <span className={`boost-symbol-label ${damage?'boost-damage-label':'boost-shot-label'}`} aria-hidden="true">{damage&&<i>POWER</i>}<strong>{damage?<>{symbol.replace('%','')}<small>%</small></>:symbol}</strong></span>
     <kbd>{boost.key}</kbd>{selected&&<span className="boost-ready" aria-hidden="true">×{count}</span>}
    </button>;
   })}
  </aside>

  {/* Powers of whoever is playing this turn; the server clears them when that fighter's next turn begins, so the row only follows the turn player. */}
  {turn&&b.phase!=='finished'&&turn.boosts.length>0&&<div className={`boost-queue ${turn.id===me.id?'boost-queue-mine':turn.team===me.team?'boost-queue-ally':'boost-queue-enemy'}`} role="status" aria-label={`Poderes de ${turn.id===me.id?'você':turn.name}: ${turn.boosts.map(id=>BOOSTS.find(item=>item.id===id)?.name).join(', ')}`}>
   {turn.id!==me.id&&<span className="boost-queue-owner" aria-hidden="true">{turn.name}</span>}
   {turn.boosts.map((id,order)=>{
    const index=BOOSTS.findIndex(item=>item.id===id),boost=BOOSTS[index],damage=id.startsWith('damage'),symbol=id==='trident'?'×3':boost.label;
    return <span key={`${turn.id}-${order}`} className="queued-boost" data-boost={id} aria-hidden="true">
     <span className="boost-painted-icon" style={{backgroundPosition:`${(index%4)*100/3}% ${Math.floor(index/4)*100}%`}}/>
     <span className={`boost-symbol-label ${damage?'boost-damage-label':'boost-shot-label'}`}>{damage&&<i>POWER</i>}<strong>{damage?<>{symbol.replace('%','')}<small>%</small></>:symbol}</strong></span>
    </span>;
   })}
  </div>}

  <div className="battle-console" aria-label="Controles de batalha">
   <div className="angle-control">
    <AngleGauge angle={angle} minAngle={minAngle} maxAngle={maxAngle} facing={me.facing} slope={aimSlope}/>
    <div className="angle-buttons"><button type="button" disabled={!canAim} aria-label="Aumentar ângulo" onClick={event=>{setAngle(Math.min(maxAngle,angle+1));if(event.detail>0)event.currentTarget.blur();}}><ChevronUp size={23}/></button><button type="button" disabled={!canAim} aria-label="Diminuir ângulo" onClick={event=>{setAngle(Math.max(minAngle,angle-1));if(event.detail>0)event.currentTarget.blur();}}><ChevronDown size={23}/></button></div>
   </div>
   <div className="power-controls">
    <div className="power-label"><span>Força</span><div className="power-readout"><output data-testid="shot-power" aria-label="Força atual">{power}</output><small>/ 100</small></div><span className="last-power-label">Último <output data-testid="last-shot-power">{lastPower??'—'}</output></span></div>
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
   <span id="charge-instructions" className="battle-sr-only">Segure Espaço ou toque e segure a régua para carregar. Solte para disparar a força mostrada; depois de 100 ela volta a cair e, se chegar a zero, você passa a vez. Use as setas do teclado para andar e mirar.</span>
   <div className="battle-actions">
    <div className="vigor-display"><span className="hud-bar-label">Energia</span><div className="vigor-bar" role="meter" aria-label="Vigor" aria-valuenow={me.stamina} aria-valuemin={0} aria-valuemax={me.maxStamina}><i style={{width:`${me.stamina/me.maxStamina*100}%`}}/><b>{me.stamina}/{me.maxStamina}</b></div></div>
    <div className="vida-display"><span className="hud-bar-label">Vida</span><div className={`vida-bar ${me.hp/me.maxHp<=.25?'critical-health':''}`} role="meter" aria-label="Vida no console" aria-valuenow={me.hp} aria-valuemin={0} aria-valuemax={me.maxHp}><i style={{width:`${Math.max(0,me.hp/me.maxHp)*100}%`}}/><b>{me.hp.toLocaleString('pt-BR')}</b></div></div>
   </div>
   <PowerOrb charge={me.powerCharge??0} armed={!!me.powerArmed} blocked={powerOrbBlock} onActivate={()=>client.send({type:'power'})}/>
  </div>

  {exit&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="battle-exit-title"><div className="confirm-panel"><h2 id="battle-exit-title">Sair da batalha?</h2><p>{worldBoss?'O dano que você já causou continua no ranking.':b.phase==='finished'?'Seu personagem será retirado desta partida.':fallen?'Se sair agora, você não recebe a recompensa do fim da partida.':'Seu personagem será retirado desta partida e você não recebe a recompensa do fim da partida.'}</p><div><button type="button" className="button quiet" autoFocus onClick={()=>setExit(false)}>Continuar</button><button type="button" className="button gold" onClick={()=>client.send({type:'leave'})}>Sair</button></div></div></div>}
  <BattleChat/>
  <PowerCutIn battle={b} offset={offset}/>
  {b.phase==='finished'&&!worldBoss&&<BattleRewards battle={b} me={me}/>}
 </div>;
}
