import {RewardIcon} from './RewardIcon';
import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,DragEvent} from 'react';
import {ArrowRight,Check,Gem,Hammer,LoaderCircle,Minus,Sparkles,Swords,X} from 'lucide-react';
import {CATALOG,ITEMS,MAX_FORGE_STONES,MAX_UPGRADE,STONES,WEAPONS,upgradeChance} from '../../shared/catalog';
import {COMPOSITION_STATS,COMPOSITION_STONES,COMPOSITION_STONE_BY_ID,COMPOSITION_STAT_NAMES,canCompose} from '../../shared/composition';
import type {CompositionBonus,CompositionStat} from '../../shared/composition';
import {CompositionIcon} from './CompositionIcon';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {UpgradeBadge} from './UpgradeBadge';
import {ItemCard,ItemCardFrame,stoneRarity} from './ItemCard';
import './Forge.css';

const ITEM_DRAG='application/x-brasa-item';
const STONE_DRAG='application/x-brasa-stone';
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const FORGE_ANIMATION_MS=1150;
type ForgeMode='strengthen'|'compose';
type ForgeAttempt={mode:ForgeMode;level:number;chance:number;stock:Record<string,number>;compositionStock:Record<string,number>;bonus:CompositionBonus};
type ForgeOutcome={mode:ForgeMode;success:boolean;level?:number;stat?:CompositionStat;value?:number;cost?:number};

function StrengtheningEffect({levels}:{levels:number[]}){
 return <div className="forge-strengthening" aria-hidden="true">
  <svg className="forge-energy-paths" viewBox="0 0 650 420"><g className="forge-energy-trails">{levels.map((level,i)=>{const x=153+(level-1)*87;return <path key={level} style={{animationDelay:`${i*-.12}s`}} d={`M${x} 375 Q${x} 275 325 160`}/>;})}</g><g className="forge-energy-aura"><circle cx="325" cy="160" r="89"/><circle cx="325" cy="160" r="108"/></g></svg>
  <svg className="forge-striking-hammer" viewBox="0 0 100 120"><defs><linearGradient id="strike-metal" x2="0" y2="1"><stop stopColor="#fff1c1"/><stop offset=".45" stopColor="#d89a54"/><stop offset="1" stopColor="#985536"/></linearGradient></defs><path d="m48 35 14 4-9 73q-5 8-13-2Z" fill="#8e5838" stroke="#e0a263" strokeWidth="3"/><path d="m47 67 11 2m-13 10 11 2m-12 10 11 2" stroke="#f1bd78" strokeWidth="3"/><path d="M15 13q30-9 67 7l-4 29q-32 0-65-9Z" fill="url(#strike-metal)" stroke="#ffdc97" strokeWidth="3"/><path d="m23 15-3 26m52-24-3 30" stroke="#6f3f2b" strokeWidth="4"/><path d="M30 22q14-2 31 4" stroke="#fff3bf" strokeWidth="4" strokeLinecap="round"/></svg>
  <div className="forge-strike-sparks">{Array.from({length:12},(_,i)=><i key={i} style={{'--spark-angle':`${i*30}deg`,'--spark-distance':`${53+(i%3)*23}px`,'--spark-delay':`${(i%3)*.035}s`} as CSSProperties}/>)}</div>
 </div>;
}

function StoneIcon({level,size=54}:{level:number;size?:number}){
 const [missing,setMissing]=useState(false);
 const stone=STONES.find(s=>s.level===level)!;
 return missing?<svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={stone.name}>
  <path d="m40 5 22 17 8 31-30 22L10 53l8-31Z" fill={stone.color} stroke="#e9ead6" strokeWidth="2"/>
  <path d="m40 5-9 28 9 42 12-42Zm-22 17 13 11-21 20m52-31L52 33l18 20M31 33h21" fill="#ffffff25" stroke="#fff8e6" strokeOpacity=".55" strokeWidth="1.5"/>
  <path d="m40 27 4 8 9 3-8 5-5 10-4-10-9-5 9-3Z" fill="#fff4c9"/>
 </svg>:<img src={`/assets/stone-${level}.png`} width={size} height={size} alt={stone.name} draggable={false} onError={()=>setMissing(true)}/>;
}

function WorkshopBackdrop(){
 return <><img className="forge-scenery forge-painted-workshop" src="/assets/ui/forge-workshop.png" alt="" draggable={false}/><div className="forge-painted-firelight" aria-hidden="true"/></>;
}

export function Forge({onClose}:{onClose:()=>void}){
 const state=useGame(),p=state.profile!;
 const [mineralStat,setMineralStat]=useState<CompositionStat>('attack');
 const [mode,setMode]=useState<ForgeMode>('strengthen'),[selected,setSelected]=useState(''),[stones,setStones]=useState<Record<string,number>>({}),[selectedStone,setSelectedStone]=useState('');
 const [pending,setPending]=useState(false),[attempt,setAttempt]=useState<ForgeAttempt|null>(null),[dropTarget,setDropTarget]=useState<'weapon'|'stone'|null>(null);
 const [result,setResult]=useState<ForgeOutcome|null>(null),[localError,setLocalError]=useState<string|null>(null),[materialPulse,setMaterialPulse]=useState<{level:number;key:number}|null>(null);
 const submittedResult=useRef(state.forgeResult),submittedComposition=useRef(state.compositionResult),pendingRef=useRef(false),startedAt=useRef(0);
 const composing=mode==='compose',owned=(composing?ITEMS.filter(canCompose):WEAPONS).filter(item=>p.inventory.includes(item.id));
 const item=selected?CATALOG[selected]:null,stone=COMPOSITION_STONE_BY_ID[selectedStone];
 const level=pending&&attempt?attempt.level:selected?(p.upgrades[selected]??0):0,stock=pending&&attempt?attempt.stock:p.stones,compositionStock=pending&&attempt?attempt.compositionStock:p.compositionStones??{};
 const bonus=pending&&attempt?attempt.bonus:p.compositions?.[selected]??{},stoneCount=Object.values(stones).reduce((sum,n)=>sum+n,0);
 const chance=pending&&attempt?attempt.chance:composing?stone?.chance??0:selected&&level<MAX_UPGRADE?upgradeChance(level,stones):0;
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 const enough=STONES.every(s=>(stones[String(s.level)]??0)<=(p.stones[String(s.level)]??0));
 const canForge=!!item&&!locked&&(composing?canCompose(item)&&!!stone&&(compositionStock[stone.id]??0)>0&&p.gold>=stone.cost&&stone.value>(bonus[stone.stat]??0):level<MAX_UPGRADE&&stoneCount>0&&enough);
 const guidance=!item?`Escolha ${composing?'um equipamento':'uma arma'}.`:composing?!stone?'Escolha um mineral.':stone.value<=(bonus[stone.stat]??0)?'Escolha uma pedra que aumente o atributo.':(compositionStock[stone.id]??0)<1?'Você não tem mais esta pedra.':p.gold<stone.cost?'Moedas Brasa insuficientes para esta composição.':null:level>=MAX_UPGRADE?'Esta arma atingiu o fortalecimento máximo.':stoneCount===0?'Adicione pedras para fortalecer.':null;
 useEffect(()=>{if(!materialPulse)return;const timer=setTimeout(()=>setMaterialPulse(null),450);return()=>clearTimeout(timer);},[materialPulse]);
 useEffect(()=>{
  if(!pending||!attempt)return;
  const forge=state.forgeResult,composition=state.compositionResult;
  const resolved:ForgeOutcome|null=attempt.mode==='strengthen'&&forge&&forge!==submittedResult.current&&forge.item===selected?{mode:'strengthen',success:forge.success,level:forge.level}:attempt.mode==='compose'&&composition&&composition!==submittedComposition.current&&composition.item===selected&&composition.stone===selectedStone?{mode:'compose',success:composition.success,stat:composition.stat,value:composition.value,cost:composition.cost}:null;
  if(resolved){const timer=window.setTimeout(()=>{if(!pendingRef.current)return;pendingRef.current=false;setPending(false);setAttempt(null);setStones({});if(resolved.mode==='compose')setSelectedStone('');setResult(resolved);audio.play(resolved.success?'turn':'impact');},Math.max(0,FORGE_ANIMATION_MS-(performance.now()-startedAt.current)));return()=>window.clearTimeout(timer);}
  if(state.error||state.status!=='online'){pendingRef.current=false;setPending(false);setAttempt(null);setLocalError(state.error??'Conexão interrompida.');}
 },[pending,attempt,state.forgeResult,state.compositionResult,state.error,state.status,selected,selectedStone]);
 function changeMode(next:ForgeMode){if(locked||next===mode)return;setMode(next);setResult(null);setLocalError(null);setSelectedStone('');setStones({});if(next==='strengthen'&&item?.slot!=='weapon')setSelected('');audio.play('click');}
 function choose(id:string){if(locked||!owned.some(w=>w.id===id))return;setSelected(id);setResult(null);setLocalError(null);audio.play('click');}
 function chooseStone(id:string){if(locked||!(compositionStock[id]??0)||!COMPOSITION_STONE_BY_ID[id])return;setSelectedStone(id);setResult(null);setLocalError(null);audio.play('click');}
 function addStone(stoneLevel:number){
  if(locked||!STONES.some(s=>s.level===stoneLevel)||stoneCount>=MAX_FORGE_STONES||(stones[String(stoneLevel)]??0)>=(p.stones[String(stoneLevel)]??0))return;
  setStones(current=>{const key=String(stoneLevel),count=current[key]??0;if(Object.values(current).reduce((sum,n)=>sum+n,0)>=MAX_FORGE_STONES||count>=(p.stones[key]??0))return current;return{...current,[key]:count+1};});setResult(null);setLocalError(null);setMaterialPulse({level:stoneLevel,key:Date.now()});audio.play('click');
 }
 function removeStone(stoneLevel:number){if(locked||!(stones[String(stoneLevel)]??0))return;setStones(current=>{const next={...current},key=String(stoneLevel);if(next[key]>1)next[key]--;else delete next[key];return next;});setResult(null);audio.play('click');}
 function allowDrop(event:DragEvent,kind:'weapon'|'stone'){if(!locked&&event.dataTransfer.types.includes(kind==='weapon'?ITEM_DRAG:STONE_DRAG)){event.preventDefault();event.dataTransfer.dropEffect='copy';setDropTarget(kind);}}
 function drop(event:DragEvent,kind:'weapon'|'stone'){event.preventDefault();setDropTarget(null);if(kind==='weapon')choose(event.dataTransfer.getData(ITEM_DRAG));else if(composing)chooseStone(event.dataTransfer.getData(STONE_DRAG));else addStone(Number(event.dataTransfer.getData(STONE_DRAG)));}
 function submit(){
  if(!canForge||pendingRef.current)return;pendingRef.current=true;submittedResult.current=state.forgeResult;submittedComposition.current=state.compositionResult;startedAt.current=performance.now();
  setAttempt({mode,level,chance,stock:{...p.stones},compositionStock:{...p.compositionStones},bonus:{...bonus}});setResult(null);setLocalError(null);setPending(true);client.update({error:null});
  if(composing)client.send({type:'compose',item:selected,stone:selectedStone});else client.send({type:'forge',item:selected,stones:{...stones}});audio.play('click');
 }
 return <Modal title="Ferreiro" onClose={onClose} className="forge-window forge-workshop-shell forge-redesigned" viewport>
  <div className="forge-layout">
   <nav className="forge-services" aria-label="Serviços do ferreiro" role="tablist" aria-orientation="horizontal">
    <button role="tab" aria-selected={!composing} aria-controls="forge-service-content" className={!composing?'active':''} disabled={locked} onClick={()=>changeMode('strengthen')}><Hammer size={24}/><span>Fortalecer</span></button>
    <button role="tab" aria-selected={composing} aria-controls="forge-service-content" className={composing?'active':''} disabled={locked} onClick={()=>changeMode('compose')}><Sparkles size={24}/><span>Composição</span></button>
   </nav>
   <div className="forge-body" id="forge-service-content" role="tabpanel" aria-label={composing?'Composição':'Fortalecer'}>
    <section className={`forge-workbench ${pending?'is-strengthening':''} ${composing?'is-composing':''}`} aria-label={composing?'Bancada de composição':'Bancada de fortalecimento'} aria-busy={pending}>
     <div className={`forge-workshop ${pending?'working':''} ${result?.success?'forge-success':''}`}>
     {pending&&<StrengtheningEffect levels={composing?[stone?.tier??1]:STONES.filter(s=>(stones[String(s.level)]??0)>0).map(s=>s.level)}/>}
      <WorkshopBackdrop/><div className="forge-embers" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="forge-hero-label">{item?<><span>{item.name}</span>{item.slot==='weapon'&&<UpgradeBadge level={level} size={156}/>}</>:<span>{composing?'Escolha um equipamento':'Escolha uma arma'}</span>}</div>
      <ItemCardFrame rarity={item?.rarity} variant="slot" empty={!item} className={`forge-weapon-target ${item?'filled':''} ${dropTarget==='weapon'?'drag-over':''}`} onDragOver={e=>allowDrop(e,'weapon')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'weapon')} role="region" aria-label="Coloque o equipamento na bigorna">
       <span className="forge-rune-ring" aria-hidden="true"/>{item?<><ItemIcon id={item.id} size={158} upgrade={level}/><button className="forge-remove-weapon" aria-label="Retirar equipamento da bigorna" disabled={locked} onClick={()=>{setSelected('');setResult(null);}}><X size={13}/></button></>:<><Hammer size={38}/><span>Clique ou arraste</span></>}
      </ItemCardFrame>
      {pending&&<span className="forge-progress-caption">{composing?'Compondo':'Fortalecendo'}…</span>}
      {result&&<div className={`forge-outcome ${result.success?'success':'failure'}`} role="status" aria-live="polite"><span className="forge-outcome-flourish" aria-hidden="true">✦</span><strong>{result.success?'SUCESSO':'FALHA'}</strong><span className="forge-outcome-level">{result.mode==='strengthen'?result.success?`Fortalecimento +${result.level}`:`Nível +${result.level} mantido`:result.success?`${COMPOSITION_STAT_NAMES[result.stat!]} +${result.value}`:'Atributo anterior mantido'}</span><span className="forge-outcome-rule" aria-hidden="true"/></div>}
     </div>
     <div className={`forge-materials ${composing?'composition-materials':''} ${dropTarget==='stone'?'drag-over':''}`} onDragOver={e=>allowDrop(e,'stone')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'stone')}>
      <div className="forge-section-heading"><h2><Gem size={14}/>{composing?'Mineral selecionado':'Pedras selecionadas'}</h2><span>{composing?'1 pedra por tentativa':`${stoneCount} / ${MAX_FORGE_STONES}`}</span></div>
      {composing?<div className="composition-selection"><ItemCard rarity="common" empty={!stone} disabled={!stone||locked} className="composition-selected-stone" aria-label={stone?`Remover ${stone.name}`:'Escolha uma pedra de composição'} onClick={()=>setSelectedStone('')}>{stone?<CompositionIcon stat={stone.stat} size={57}/>:<Gem size={27}/>}</ItemCard><div>{stone?<><strong>{stone.name}</strong><span>{COMPOSITION_STAT_NAMES[stone.stat]}</span><div className="composition-preview" aria-label={`Prévia de composição: ${COMPOSITION_STAT_NAMES[stone.stat]} de ${bonus[stone.stat]??0} para ${stone.value}`}><span>+{bonus[stone.stat]??0}</span><ArrowRight size={16}/><b>+{stone.value}</b></div></>:<span>Escolha o atributo e um mineral ao lado.</span>}</div></div>:<div className="forge-sockets">{STONES.map(s=>{const count=stones[String(s.level)]??0;return <ItemCard rarity={stoneRarity(s.level)} empty={!count} className={`forge-socket ${count?'has-stone':''}`} key={s.level} disabled={!count||locked} onClick={()=>removeStone(s.level)} aria-label={`Remover uma ${s.name}, ${count} selecionadas`} style={{'--stone-color':s.color} as CSSProperties}>{materialPulse?.level===s.level&&<i key={materialPulse.key} className="forge-material-pulse" aria-hidden="true"/>}{count?<><StoneIcon level={s.level} size={43}/><b>×{count}</b><span className="forge-socket-minus"><Minus size={10}/></span></>:<Gem size={23} strokeWidth={1}/>}<small>{s.level}</small></ItemCard>;})}</div>}
     </div>
     <div className="forge-action">
      <div className="forge-chance-title"><Gem size={14}/><span>Chance de sucesso</span></div>
      <div className="forge-chance-track" role="progressbar" aria-label="Chance de sucesso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={chance}><i style={{width:`${chance}%`}}/><span/><strong>{!composing&&level>=12?'Máximo':`${number.format(chance)}%`}</strong></div>
      <div className="forge-action-bottom">{composing?<div className={`composition-cost ${stone&&p.gold<stone.cost?'insufficient':''}`}><RewardIcon size={19}/><strong>{stone?.cost??0}</strong><span>moedas</span></div>:null}
       <button className={`button gold forge-submit ${pending?'pending':''}`} disabled={!canForge} aria-busy={pending} aria-describedby="forge-action-feedback" onClick={submit}>{pending?<LoaderCircle className="button-spinner" size={19}/>:composing?<Sparkles size={19}/>:<Hammer size={19}/>}{pending?composing?'Compondo…':'Fortalecendo…':composing?'Compor atributo':level>=12?'Nível máximo':'Fortalecer'}</button>
      </div>
      <div id="forge-action-feedback" className={`forge-feedback ${localError?'is-error':guidance?'is-guidance':''}`} role="status" aria-live="polite">{localError??(pending?'A forja está trabalhando…':result?result.mode==='compose'?'Pedra e ouro consumidos.':'Pedras consumidas.':guidance??(composing?'A pedra e o ouro são consumidos, mesmo em caso de falha.':'As pedras são consumidas em cada tentativa.'))}</div>
      {composing&&item&&<div className="composition-current" aria-label="Composições aplicadas">{COMPOSITION_STATS.map(stat=><span key={stat}><CompositionIcon stat={stat} size={22}/><small>{COMPOSITION_STAT_NAMES[stat]}</small><b>+{bonus[stat]??0}</b></span>)}</div>}
     </div>
    </section>
    <aside className="forge-stock" aria-label="Itens disponíveis">
     <div className="forge-section-heading"><h2><Swords size={15}/>{composing?'Equipamentos':'Suas armas'}</h2><span className="forge-wallet"><RewardIcon size={13}/>{p.gold.toLocaleString('pt-BR')}</span></div>
     <div className={`forge-weapon-stock ${composing?'composition-equipment-stock':''}`} style={{'--forge-columns':Math.max(1,Math.min(owned.length,6)),'--forge-mobile-columns':Math.max(1,Math.min(owned.length,8))} as CSSProperties}>{owned.map(w=>{const upgrade=pending&&selected===w.id?level:p.upgrades[w.id]??0;return <ItemCard key={w.id} rarity={w.rarity} selected={selected===w.id} className={`forge-stock-item ${w.rarity} ${selected===w.id?'selected':''}`} draggable={!locked} disabled={locked} onDragStart={e=>{e.dataTransfer.setData(ITEM_DRAG,w.id);e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>choose(w.id)} aria-pressed={selected===w.id} aria-label={`${w.name}${w.slot==='weapon'?`, nível +${upgrade}`:''}. Clique para colocar na bigorna.`} title={w.name} aria-describedby={`forge-tip-${w.id}`}><ItemIcon id={w.id} size={64} upgrade={upgrade}/>{w.slot==='weapon'&&<b className="forge-item-upgrade">+{upgrade}</b>}{selected===w.id&&<span className="forge-chosen"><Check size={10}/></span>}<span className="forge-tooltip" id={`forge-tip-${w.id}`} role="tooltip"><strong>{w.name}{w.slot==='weapon'?` +${upgrade}`:''}</strong><small>Clique ou arraste</small></span></ItemCard>;})}</div>
     <div className="forge-section-heading forge-stones-heading"><h2><Gem size={15}/>Materiais</h2><span>{composing?'Atributos · I a III':'Fortalecimento · I a V'}</span></div>
     {composing?<div className="composition-minerals">
      <div className="composition-attributes" role="group" aria-label="Atributo para composição">{COMPOSITION_STATS.map(stat=><button key={stat} className={mineralStat===stat?'active':''} aria-pressed={mineralStat===stat} disabled={locked} onClick={()=>{setMineralStat(stat);setSelectedStone('');setResult(null);}}><CompositionIcon stat={stat} size={26}/><span>{COMPOSITION_STAT_NAMES[stat]}</span></button>)}</div>
      <div className="composition-tier-grid">{COMPOSITION_STONES.filter(s=>s.stat===mineralStat).map(s=>{const quantity=compositionStock[s.id]??0,disabled=locked||quantity<=0;return <div className="composition-tier" key={s.id}><ItemCard rarity="common" selected={selectedStone===s.id} className="composition-stock-stone" disabled={disabled} draggable={!disabled} onDragStart={e=>{e.dataTransfer.setData(STONE_DRAG,s.id);e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>chooseStone(s.id)} aria-pressed={selectedStone===s.id} aria-label={`${s.name}, ${quantity} disponíveis, ${COMPOSITION_STAT_NAMES[s.stat]} +${s.value}`} title={`${s.name} · ${s.chance}% · ${s.cost} ouro`}><CompositionIcon stat={s.stat} size={60}/><small>{['I','II','III'][s.tier-1]}</small><b>×{quantity}</b></ItemCard><strong>+{s.value}</strong><span>{s.chance}% de chance</span></div>;})}</div>
     </div>:<div className="forge-stone-stock">{STONES.map(s=>{const quantity=stock[String(s.level)]??0,remaining=quantity-(stones[String(s.level)]??0),disabled=locked||remaining<=0||stoneCount>=MAX_FORGE_STONES;return <div className="forge-stone-cell" key={s.level} style={{'--stone-color':s.color} as CSSProperties}><ItemCard rarity={stoneRarity(s.level)} className={`forge-stock-stone ${remaining<=0?'depleted':''}`} disabled={disabled} draggable={!disabled} aria-label={`${s.name}, ${remaining} disponíveis. Clique para adicionar.`} title={s.name} onDragStart={e=>{e.dataTransfer.setData(STONE_DRAG,String(s.level));e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>addStone(s.level)}><StoneIcon level={s.level} size={60}/><small>{['I','II','III','IV','V'][s.level-1]}</small><b>×{remaining}</b></ItemCard></div>;})}</div>}

    </aside>
   </div>
  </div>
 </Modal>;
}
