import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Clover,Flag,Flame,Footprints,Heart,IdCard,LoaderCircle,MessageCircle,Send,Shield,ShieldCheck,Swords,X,Zap} from 'lucide-react';
import {attributes,canStrengthen,CATALOG,SLOT_NAMES,equippedCopy,isEmptyItem} from '../../shared/catalog';
import type {Slot} from '../../shared/catalog';
import {REPORT_DETAILS_MAX,REPORT_REASONS} from '../../shared/reports';
import type {PlayerInfo,ReportReason} from '../../shared/reports';
import {client,useGame} from '../client';
import type {PlayerTarget} from '../client';
import {audio} from '../game/audio';
import {Avatar} from './Avatar';
import {BagContextMenu} from './ColorStudio';
import {InventoryTooltip,LEFT_SLOTS,LOWER_SLOTS,RIGHT_SLOTS,SLOT_ICONS} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {LevelNumber} from './LevelNumber';
import {Modal} from './Modal';
import {PowerIcon} from './PowerIcon';
import {UpgradeTag} from './UpgradeTag';
import './Backpack.css';
import './ColorStudio.css';
import './PlayerActions.css';

/** Right-click props for anything that shows another player (portraits, seats, names). */
export function playerMenuProps(target:PlayerTarget|null|undefined){
 return target?{onContextMenu:(event:React.MouseEvent)=>{event.stopPropagation();client.openPlayerMenu(event,target);},'data-player-menu':''}:{};
}

/** The player menu ("Ver informações" / "Denunciar") and the window each one opens; mounted once by the App. */
export function PlayerActions(){
 const {playerPanel:panel,profile}=useGame();
 if(!panel||!profile)return null;
 const target:PlayerTarget={id:panel.id,name:panel.name,context:panel.context},self=panel.id===profile.id,bot=panel.id.startsWith('bot-');
 if(panel.kind==='menu')return createPortal(<BagContextMenu x={panel.x} y={panel.y} title={panel.name} onClose={()=>client.closePlayerPanel()} actions={[
  {id:'info',label:'Ver informações',icon:<IdCard size={16}/>,onSelect:()=>{client.openPlayerPanel('info',target);audio.play('click');}},
  ...(self||bot?[]:[{id:'message',label:'Enviar mensagem',icon:<MessageCircle size={16}/>,onSelect:()=>{client.messagePlayer(target);audio.play('click');}}]),
  ...(self||bot?[]:[{id:'report',label:'Denunciar',icon:<Flag size={16}/>,danger:true,onSelect:()=>{client.openPlayerPanel('report',target);audio.play('click');}}]),
 ]}/>,document.body);
 return panel.kind==='info'?<PlayerInfoWindow target={target} self={self||bot}/>:<ReportWindow target={target}/>;
}

/** Read-only "Informações pessoais" of another player, laid out like the backpack's left side. */
function PlayerInfoWindow({target,self}:{target:PlayerTarget;self:boolean}){
 const {playerInfo,error}=useGame(),info=playerInfo?.id===target.id?playerInfo:null;
 const [tip,setTip]=useState<Tip|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{if(error&&!info)setFailed(true);},[error,info]);
 const close=()=>client.closePlayerPanel();
 return <Modal title="Informações do jogador" onClose={close} className="bag-window player-info-window" viewport>
  <div className="inventory-body bag-layout player-info-body" onContextMenu={event=>event.preventDefault()}>
   {info?<PlayerSheet info={info} tip={tip} setTip={setTip} onReport={self?undefined:()=>{setTip(null);client.openPlayerPanel('report',target);audio.play('click');}}/>:<div className="player-info-loading">{failed?<p>Não foi possível abrir as informações de {target.name}.</p>:<><LoaderCircle size={34} className="button-spinner"/><p>Carregando {target.name}…</p></>}</div>}
  </div>
  {tip&&info&&createPortal(<InventoryTooltip tip={tip} gender={info.gender} equipment={info.equipment} upgrades={info.upgrades} compositions={info.compositions} colors={info.itemColors}/>,document.body)}
 </Modal>;
}

function PlayerSheet({info,tip,setTip,onReport}:{info:PlayerInfo;tip:Tip|null;setTip:(tip:Tip|null)=>void;onReport?:()=>void}){
 const equipment=info.equipment,stats=attributes(equipment,info.level),upgrade=equipment.upgrade??0;
 // No title system yet: the plate shows the character's class name, like the plaza HUD.
 const title=info.bot?'Bot do jogo':info.gender==='female'?'Aventureira':'Aventureiro';
 useEffect(()=>{if(!tip)return;const outside=(event:Event)=>{if(!tip.anchor.contains(event.target as Node))setTip(null);};window.addEventListener('pointerdown',outside,true);window.addEventListener('scroll',()=>setTip(null),true);return()=>window.removeEventListener('pointerdown',outside,true);},[tip,setTip]);
 const slot=(slot:Slot)=>{
  const id=equipment[slot],copy=equippedCopy(equipment,slot),it=CATALOG[id],empty=!it||isEmptyItem(it),Placeholder=SLOT_ICONS[slot];
  const show=(mode:Tip['mode'])=>(event:React.SyntheticEvent<HTMLElement>)=>{if(!empty)setTip({id:copy,anchor:event.currentTarget,mode});};
  return <ItemCard key={slot} empty={empty} data-slot={slot} className="bag-slot equipment-slot" aria-label={`${SLOT_NAMES[slot]}: ${empty?'Vazio':it.name}`} aria-describedby={!empty&&tip?.id===copy?'item-tooltip':undefined}
   onMouseEnter={show('hover')} onMouseLeave={()=>setTip(null)} onFocus={show('focus')} onBlur={()=>setTip(null)} onClick={event=>{if(tip?.id===copy)setTip(null);else show('touch')(event);}}>
   {empty?<Placeholder className="bag-slot-placeholder" aria-hidden="true"/>:<ItemIcon id={id} upgrade={slot==='weapon'?upgrade:0} size={60} color={info.itemColors[copy]} skin={equipment.skin} eyes={equipment.eyes}/>}
   <span className="equipment-slot-label">{SLOT_NAMES[slot]}</span>{canStrengthen(it)&&!empty&&<UpgradeTag level={slot==='weapon'?upgrade:info.upgrades[copy]??0} className="bag-upgrade-tag"/>}
  </ItemCard>;
 };
 return <section className="bag-profile" aria-label={`Informações de ${info.name}`}>
  <div className="bag-stage">
   <div className="equipment-slots left">{LEFT_SLOTS.map(slot)}</div>
   <div className="dressing-room">
    {upgrade<5&&<i className="bag-sigil" aria-hidden="true"/>}
    <header className="player-info-plate"><div><LevelNumber level={info.level} size={36}/><h2>{info.name}</h2></div><small>{title}</small></header>
    <Avatar equipment={equipment} size={340} animated={false} auraAnimated showAura weapon={false}/>
    {onReport&&<button className="player-info-report" onClick={onReport} aria-label={`Denunciar ${info.name}`} title="Denunciar"><Flag size={16}/></button>}
   </div>
   <div className="equipment-slots right">{RIGHT_SLOTS.map(slot)}</div>
   <div className="bag-stage-foot"><div className="equipment-slots lower">{LOWER_SLOTS.map(slot)}</div></div>
  </div>
  <div className="bag-progress player-info-power">
   <div className="combat-power" title="Poder (gearscore): atributos do equipamento e Vida"><PowerIcon size={28}/><span>Poder</span><strong>{stats.power.toLocaleString('pt-BR')}</strong></div>
  </div>
  <div className="stat-grid" aria-label="Atributos do personagem">
   <span data-stat="attack"><Swords size={14}/>Ataque<b>{stats.attack}</b></span><span data-stat="agility"><Zap size={14}/>Agilidade<b>{stats.agility}</b></span>
   <span data-stat="defense"><Shield size={14}/>Defesa<b>{stats.defense}</b></span><span data-stat="luck"><Clover size={14}/>Sorte<b>{stats.luck}</b></span>
   <span data-stat="damage"><Flame size={14}/>Dano<b>{stats.damage}</b></span><span data-stat="armor"><ShieldCheck size={14}/>Armadura<b>{stats.armor}</b></span>
   <span data-stat="hp"><Heart size={14}/>Vida<b>{stats.hp}</b></span><span data-stat="stamina"><Footprints size={14}/>Vigor<b>{stats.stamina}</b></span>
  </div>
 </section>;
}

/** Reason, optional text, send. The server attaches the reported player's chat of the last 30 minutes. */
function ReportWindow({target}:{target:PlayerTarget}){
 const {reportResult,error,status}=useGame();
 const [reason,setReason]=useState<ReportReason|null>(null),[details,setDetails]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState<string|null>(null);
 const sentAt=useRef(0),done=!!reportResult&&reportResult.playerId===target.id&&reportResult.at>=sentAt.current&&sentAt.current>0;
 useEffect(()=>{if(done)setPending(false);},[done]);
 useEffect(()=>{if(pending&&(error||status!=='online')){setPending(false);setMessage(error??'Sem conexão. Tente novamente.');}},[pending,error,status]);
 const close=()=>{if(!pending)client.closePlayerPanel();};
 useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);});
 const send=(event:React.FormEvent)=>{event.preventDefault();if(!reason||pending)return;sentAt.current=Date.now();setPending(true);setMessage(null);client.update({error:null});
  client.send({type:'report',playerId:target.id,reason,...(details.trim()?{details:details.trim()}:{}),context:target.context});audio.play('click');};
 return createPortal(<div className="color-studio-layer player-report-layer" onPointerDown={event=>{if(event.target===event.currentTarget)close();}}>
  <form className="color-studio player-report" role="dialog" aria-modal="true" aria-label={`Denunciar ${target.name}`} onSubmit={send}>
   <header><strong>Denunciar jogador</strong><button type="button" className="wood-close" aria-label="Fechar" disabled={pending} onClick={close}><X size={18}/></button></header>
   {done?<div className="player-report-body done"><Flag size={34}/><b>Denúncia enviada</b><p>Obrigado. A equipe vai analisar a denúncia contra <strong>{target.name}</strong> junto com as mensagens recentes do chat.</p></div>:
   <div className="player-report-body">
    <p className="player-report-target">Contra <strong>{target.name}</strong></p>
    <fieldset><legend>Motivo</legend>{REPORT_REASONS.map(option=><label key={option.id} className={reason===option.id?'on':''}><input type="radio" name="report-reason" value={option.id} checked={reason===option.id} onChange={()=>setReason(option.id)}/>{option.label}</label>)}</fieldset>
    <label className="player-report-details">Conte o que aconteceu (opcional)<textarea value={details} maxLength={REPORT_DETAILS_MAX} rows={3} onChange={event=>setDetails(event.target.value)} placeholder="Ex.: xingou no chat da sala durante a partida"/><small>{details.length}/{REPORT_DETAILS_MAX}</small></label>
    <p className="player-report-note">As mensagens que {target.name} enviou no chat nos últimos 30 minutos vão junto com a denúncia.</p>
    {message&&<p className="player-report-error" role="alert">{message}</p>}
   </div>}
   <footer>{done?<button type="button" className="wood-button" onClick={close}>Fechar</button>:<><button type="button" className="wood-quiet" disabled={pending} onClick={close}>Cancelar</button><button className="wood-button danger" disabled={!reason||pending} aria-busy={pending}>{pending?<LoaderCircle size={18} className="button-spinner"/>:<Send size={17}/>}{pending?'Enviando…':'Enviar denúncia'}</button></>}</footer>
  </form>
 </div>,document.body);
}
