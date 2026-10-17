import {RewardIcon} from './RewardIcon';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CSSProperties,DragEvent,FocusEvent,PointerEvent as ReactPointerEvent} from 'react';
import {ArrowRight,Check,Gem,Hammer,LoaderCircle,Minus,Sparkles,Swords,X} from 'lucide-react';
import {CATALOG,copyBase,ITEMS,MAX_FORGE_STONES,MAX_UPGRADE,SLOT_NAMES,STONES,WEAPONS,upgradeChance} from '../../shared/catalog';
import {COMPOSITION_STATS,COMPOSITION_STONES,COMPOSITION_STONE_BY_ID,COMPOSITION_STAT_NAMES,canCompose} from '../../shared/composition';
import type {CompositionBonus,CompositionStat} from '../../shared/composition';
import {CompositionIcon} from './CompositionIcon';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {UpgradeTag} from './UpgradeTag';
import {InventoryTooltip} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard,ItemCardFrame,rarityLabel,stoneRarity} from './ItemCard';
import './Forge.css';

const ITEM_DRAG='application/x-brasa-item';
const STONE_DRAG='application/x-brasa-stone';
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
// Pedras voam para a bigorna, o martelo bate duas vezes e só então o resultado aparece.
const FORGE_ANIMATION_MS=1300;
type ForgeMode='strengthen'|'compose';
type ForgeAttempt={mode:ForgeMode;level:number;chance:number;stock:Record<string,number>;compositionStock:Record<string,number>;bonus:CompositionBonus};
type ForgeOutcome={mode:ForgeMode;success:boolean;level?:number;stat?:CompositionStat;value?:number;cost?:number};

function StrengtheningEffect(){
 return <div className="forge-strengthening" aria-hidden="true">
  <svg className="forge-striking-hammer" viewBox="0 0 100 120"><defs><linearGradient id="strike-metal" x2="0" y2="1"><stop stopColor="#fff1c1"/><stop offset=".45" stopColor="#d89a54"/><stop offset="1" stopColor="#985536"/></linearGradient></defs><path d="m48 35 14 4-9 73q-5 8-13-2Z" fill="#8e5838" stroke="#e0a263" strokeWidth="3"/><path d="m47 67 11 2m-13 10 11 2m-12 10 11 2" stroke="#f1bd78" strokeWidth="3"/><path d="M15 13q30-9 67 7l-4 29q-32 0-65-9Z" fill="url(#strike-metal)" stroke="#ffdc97" strokeWidth="3"/><path d="m23 15-3 26m52-24-3 30" stroke="#6f3f2b" strokeWidth="4"/><path d="M30 22q14-2 31 4" stroke="#fff3bf" strokeWidth="4" strokeLinecap="round"/></svg>
  <div className="forge-strike-sparks">{Array.from({length:12},(_,i)=><i key={i} style={{'--spark-angle':`${i*30}deg`,'--spark-distance':`${53+(i%3)*23}px`,'--spark-delay':`${(i%3)*.035}s`} as CSSProperties}/>)}</div>
 </div>;
}

/** Letreiro de resultado com volume: camadas extrudadas, contorno grosso, bisel claro e brilho no topo (Lilita One, como o HUD). */
function OutcomeBanner({success}:{success:boolean}){
 const id=success?'win':'fail',word=success?'SUCESSO!':'FALHOU',size=success?80:76,depth=11;
 const [light,mid,deep]=success?['#fffbd0','#ffd42e','#ff7a0a']:['#ffffff','#cfd6e0','#7d8999'];
 const [side,sideDeep]=success?['#d4560a','#7a2604']:['#5d6878','#262c36'];
 const [ribbon,ribbonDeep]=success?['#ef4a2e','#a3210f']:['#56606e','#2a3039'];
 const font={fontFamily:"'Lilita One','Nunito',sans-serif",fontSize:size,textAnchor:'middle' as const,letterSpacing:2};
 const word_=(props:Record<string,unknown>,key?:string|number,dy=0)=><text key={key} {...font} transform={dy?`translate(0 ${dy})`:undefined}><textPath href={`#${id}-arc`} startOffset="50%" strokeLinejoin="round" {...props}>{word}</textPath></text>;
 return <svg className="smith-outcome-banner" viewBox="0 0 420 190" role="img" aria-label={word}>
  <defs>
   <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1"><stop offset=".05" stopColor={light}/><stop offset=".48" stopColor={mid}/><stop offset="1" stopColor={deep}/></linearGradient>
   <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={side}/><stop offset="1" stopColor={sideDeep}/></linearGradient>
   <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1"><stop offset=".08" stopColor="#fff" stopOpacity=".95"/><stop offset=".42" stopColor="#fff" stopOpacity=".35"/><stop offset=".43" stopColor="#fff" stopOpacity="0"/></linearGradient>
   <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={ribbon}/><stop offset=".55" stopColor={ribbon}/><stop offset="1" stopColor={ribbonDeep}/></linearGradient>
   <path id={`${id}-arc`} d={success?'M28 108 Q210 34 392 108':'M38 94 Q210 82 382 94'}/>
  </defs>
  <g className="smith-outcome-ribbon">
   <path d="M30 122 4 142l34 4-12 26 58-25Z" fill={ribbonDeep} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M390 122l26 20-34 4 12 26-58-25Z" fill={ribbonDeep} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M50 120Q210 78 370 120l-8 44Q210 122 58 164Z" fill="#2a0f05" transform="translate(0 6)"/>
   <path d="M50 116Q210 74 370 116l-8 44Q210 118 58 160Z" fill={`url(#${id}-ribbon)`} stroke="#2a0f05" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M60 124Q210 86 360 124" fill="none" stroke="#ffffff66" strokeWidth="4" strokeLinecap="round"/>
   <path d="M64 150Q210 112 356 150" fill="none" stroke="#00000033" strokeWidth="3" strokeLinecap="round"/>
  </g>
  <g className="smith-outcome-word">
   {word_({fill:'#2a0f05',stroke:'#2a0f05',strokeWidth:18},'shadow',depth+3)}
   {Array.from({length:depth},(_,i)=>word_({fill:`url(#${id}-side)`,stroke:`url(#${id}-side)`,strokeWidth:12},i,depth-i))}
   {word_({fill:'none',stroke:'#2a0f05',strokeWidth:12},'outline')}
   {word_({fill:`url(#${id}-face)`,stroke:light,strokeWidth:2.5,paintOrder:'stroke'},'face')}
   {word_({fill:`url(#${id}-gloss)`},'gloss')}
  </g>
  {success&&<g fill="#fffbe0">{[[44,54,1.1],[378,46,.9],[306,18,.65],[112,20,.75]].map(([x,y,k],i)=><path key={i} className="smith-outcome-twinkle" style={{animationDelay:`${i*.18}s`}} transform={`translate(${x} ${y}) scale(${k})`} d="M0-14 4-4 14 0 4 4 0 14-4 4-14 0-4-4Z"/>)}</g>}
 </svg>;
}

/** Estrelas douradas no sucesso; fumaça e lascas na falha. */
function OutcomeBurst({success}:{success:boolean}){
 return <div className={`smith-outcome-burst ${success?'stars':'smoke'}`} aria-hidden="true">{Array.from({length:success?14:8},(_,i)=><i key={i} style={{'--burst-angle':`${i*(360/(success?14:8))+(i%2)*9}deg`,'--burst-distance':`${(success?120:70)+(i%3)*34}px`,'--burst-delay':`${(i%4)*.04}s`} as CSSProperties}/>)}</div>;
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

/** `initial` comes from the backpack's "Aprimorar": that copy starts on the anvil, in the mode it supports. */
export function Forge({onClose,initial}:{onClose:()=>void;initial?:string}){
 const state=useGame(),p=state.profile!;
 const [tooltip,setTooltip]=useState<Tip|null>(null),[chanceDelta,setChanceDelta]=useState<{value:number;key:number}|null>(null),[resultKey,setResultKey]=useState(0);
 const previousChance=useRef<{item:string;mode:ForgeMode;chance:number}|null>(null);
 const [mineralStat,setMineralStat]=useState<CompositionStat>('attack');
 const startsComposing=!!initial&&CATALOG[copyBase(initial)]?.slot!=='weapon';
 const [mode,setMode]=useState<ForgeMode>(startsComposing?'compose':'strengthen'),[selected,setSelected]=useState(()=>initial&&p.inventory.includes(initial)?initial:''),[stones,setStones]=useState<Record<string,number>>({}),[selectedStone,setSelectedStone]=useState('');
 const [pending,setPending]=useState(false),[attempt,setAttempt]=useState<ForgeAttempt|null>(null),[dropTarget,setDropTarget]=useState<'weapon'|'stone'|null>(null);
 const [result,setResult]=useState<ForgeOutcome|null>(null),[localError,setLocalError]=useState<string|null>(null),[materialPulse,setMaterialPulse]=useState<{level:number;key:number}|null>(null);
 const submittedResult=useRef(state.forgeResult),submittedComposition=useRef(state.compositionResult),pendingRef=useRef(false),startedAt=useRef(0);
 const composing=mode==='compose',owned=(composing?ITEMS.filter(canCompose):WEAPONS).flatMap(item=>p.inventory.filter(key=>copyBase(key)===item.id).map(key=>({key,item})));
 const item=selected?CATALOG[copyBase(selected)]:null,stone=COMPOSITION_STONE_BY_ID[selectedStone];
 const level=pending&&attempt?attempt.level:selected?(p.upgrades[selected]??0):0,stock=pending&&attempt?attempt.stock:p.stones,compositionStock=pending&&attempt?attempt.compositionStock:p.compositionStones??{};
 const bonus=pending&&attempt?attempt.bonus:p.compositions?.[selected]??{},stoneCount=Object.values(stones).reduce((sum,n)=>sum+n,0);
 const chance=pending&&attempt?attempt.chance:composing?stone?.chance??0:selected&&level<MAX_UPGRADE?upgradeChance(level,stones):0;
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 const enough=STONES.every(s=>(stones[String(s.level)]??0)<=(p.stones[String(s.level)]??0));
 const canForge=!!item&&!locked&&(composing?canCompose(item)&&!!stone&&(compositionStock[stone.id]??0)>0&&p.gold>=stone.cost&&stone.value>(bonus[stone.stat]??0):level<MAX_UPGRADE&&stoneCount>0&&enough);
 const guidance=!item?`Escolha ${composing?'um equipamento':'uma arma'}.`:composing?!stone?'Escolha um mineral.':stone.value<=(bonus[stone.stat]??0)?'Escolha uma pedra que aumente o atributo.':(compositionStock[stone.id]??0)<1?'Você não tem mais esta pedra.':p.gold<stone.cost?'Moedas Brasa insuficientes para esta composição.':null:level>=MAX_UPGRADE?'Esta arma atingiu o fortalecimento máximo.':stoneCount===0?'Adicione pedras para fortalecer.':null;
 const tipHandlers=(id:string)=>({onPointerEnter:(e:ReactPointerEvent<HTMLElement>)=>{if(e.pointerType==='mouse')setTooltip({id,anchor:e.currentTarget,mode:'hover'});},onPointerLeave:()=>setTooltip(null),onFocus:(e:FocusEvent<HTMLElement>)=>{if(e.currentTarget.matches(':focus-visible'))setTooltip({id,anchor:e.currentTarget,mode:'focus'});},onBlur:()=>setTooltip(null),onDragStartCapture:()=>setTooltip(null)});
 useEffect(()=>{if(pending)setTooltip(null);},[pending]);
 const stageRef=useRef<HTMLDivElement>(null),anvilRef=useRef<HTMLDivElement>(null),socketRefs=useRef<(HTMLDivElement|null)[]>([]);
 const [geometry,setGeometry]=useState<{w:number;h:number;anvil:{x:number;y:number};sockets:{x:number;y:number}[]}|null>(null);
 useLayoutEffect(()=>{
  const stage=stageRef.current;if(!stage)return;
  const measure=()=>{const box=stage.getBoundingClientRect(),card=anvilRef.current?.firstElementChild?.getBoundingClientRect();if(!card||!box.width)return;
   const center=(r:DOMRect)=>({x:r.left+r.width/2-box.left,y:r.top+r.height/2-box.top});
   setGeometry({w:box.width,h:box.height,anvil:center(card),sockets:socketRefs.current.slice(0,composing?1:STONES.length).filter((el):el is HTMLDivElement=>!!el).map(el=>center(el.getBoundingClientRect()))});};
  measure();const observer=new ResizeObserver(measure);observer.observe(stage);return()=>observer.disconnect();
 },[composing,!!item]);
 const flight=(i:number)=>{const from=geometry?.sockets[i];return (from&&geometry?{'--fly-x':`${geometry.anvil.x-from.x}px`,'--fly-y':`${geometry.anvil.y-from.y}px`,'--fly-delay':`${i*45}ms`}:{}) as CSSProperties;};
 useEffect(()=>{
  const before=previousChance.current;previousChance.current={item:selected,mode,chance};
  if(pending||!before||before.item!==selected||before.mode!==mode||!selected)return;
  const value=Math.round((chance-before.chance)*10)/10;if(value)setChanceDelta({value,key:Date.now()});
 },[chance,selected,mode,pending]);
 useEffect(()=>{if(!chanceDelta)return;const timer=setTimeout(()=>setChanceDelta(null),900);return()=>clearTimeout(timer);},[chanceDelta]);
 useEffect(()=>{if(result)setResultKey(k=>k+1);},[result]);
 useEffect(()=>{if(!materialPulse)return;const timer=setTimeout(()=>setMaterialPulse(null),450);return()=>clearTimeout(timer);},[materialPulse]);
 useEffect(()=>{
  if(!pending||!attempt)return;
  const forge=state.forgeResult,composition=state.compositionResult;
  const resolved:ForgeOutcome|null=attempt.mode==='strengthen'&&forge&&forge!==submittedResult.current&&forge.item===selected?{mode:'strengthen',success:forge.success,level:forge.level}:attempt.mode==='compose'&&composition&&composition!==submittedComposition.current&&composition.item===selected&&composition.stone===selectedStone?{mode:'compose',success:composition.success,stat:composition.stat,value:composition.value,cost:composition.cost}:null;
  if(resolved){const timer=window.setTimeout(()=>{if(!pendingRef.current)return;pendingRef.current=false;setPending(false);setAttempt(null);setStones({});if(resolved.mode==='compose')setSelectedStone('');setResult(resolved);audio.play(resolved.success?'turn':'impact');},Math.max(0,FORGE_ANIMATION_MS-(performance.now()-startedAt.current)));return()=>window.clearTimeout(timer);}
  if(state.error||state.status!=='online'){pendingRef.current=false;setPending(false);setAttempt(null);setLocalError(state.error??'Conexão interrompida.');}
 },[pending,attempt,state.forgeResult,state.compositionResult,state.error,state.status,selected,selectedStone]);
 function changeMode(next:ForgeMode){if(locked||next===mode)return;setMode(next);setResult(null);setLocalError(null);setSelectedStone('');setStones({});if(next==='strengthen'&&item?.slot!=='weapon')setSelected('');audio.play('click');}
 function choose(id:string){if(locked||!owned.some(w=>w.key===id))return;setSelected(id);setResult(null);setLocalError(null);audio.play('click');}
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
 const GRID_COLUMNS=7,fill=(count:number,rows=1)=>Math.max(GRID_COLUMNS*rows,Math.ceil(count/GRID_COLUMNS)*GRID_COLUMNS)-count;
 const stoneTotal=STONES.reduce((sum,s)=>sum+(p.stones[String(s.level)]??0),0),mineralTotal=Object.values(p.compositionStones??{}).reduce((sum,n)=>sum+n,0);
 const steps:[string,boolean][]=composing?[['Equipamento',!!item],['Mineral',!!stone],['Compor',false]]:[['Arma',!!item],['Pedras',stoneCount>0],['Forjar',false]];
 const currentStep=Math.max(0,steps.findIndex(([,done])=>!done));
 const chanceTone=chance>=70?'high':chance>=30?'mid':'low';
 const socketItems=composing?[{key:'mineral',filled:!!stone}]:STONES.map(s=>({key:String(s.level),filled:(stones[String(s.level)]??0)>0}));
 return <Modal title="Ferreiro" onClose={onClose} className="smith-window" viewport>
  <div className="smith-layout">
   <section className={`smith-bench forge-workbench ${pending?'is-strengthening':''} ${composing?'is-composing':''}`} id="forge-service-content" role="tabpanel" aria-label={composing?'Bancada de composição':'Bancada de fortalecimento'} aria-busy={pending}>
    <header className="smith-head">
     <span className="smith-head-icon" aria-hidden="true">{composing?<Sparkles size={22}/>:<Hammer size={22}/>}</span>
     <div className="smith-identity"><small>{composing?'Composição':'Fortalecimento'}</small><h2>{item?.name??(composing?'Escolha um equipamento':'Escolha uma arma')}</h2></div>
     <ol className="smith-steps" aria-label="Etapas">{steps.map(([label,done],i)=><li key={label} data-state={done?'done':i===currentStep||(i===steps.length-1&&canForge)?'current':'todo'}><span>{done?<Check size={12}/>:i+1}</span>{label}</li>)}</ol>
    </header>
    <div ref={stageRef} className={`smith-stage forge-workshop ${pending?'working':''} ${result?result.success?'is-success':'is-failure':''}`}>
     <span className="smith-coals" aria-hidden="true"/>
     {geometry&&<svg className="smith-channels" width={geometry.w} height={geometry.h} aria-hidden="true">{geometry.sockets.map((pos,i)=><path key={socketItems[i]?.key??i} data-lit={socketItems[i]?.filled||undefined} d={`M${pos.x} ${pos.y} C${pos.x} ${(pos.y+geometry.anvil.y)/2} ${geometry.anvil.x} ${pos.y} ${geometry.anvil.x} ${geometry.anvil.y}`}/>)}</svg>}
     <div className={`forge-materials ${composing?'composition-materials':''} ${dropTarget==='stone'?'drag-over':''}`} onDragOver={e=>allowDrop(e,'stone')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'stone')}>
      {composing?<div className="composition-selection"><div className="smith-socket" ref={el=>{socketRefs.current[0]=el;}} style={flight(0)}><ItemCard rarity="common" empty={!stone} disabled={!stone||locked} className="composition-selected-stone forge-socket" aria-label={stone?`Remover ${stone.name}`:'Escolha uma pedra de composição'} onClick={()=>setSelectedStone('')}>{stone?<CompositionIcon stat={stone.stat} size={44}/>:<Gem className="smith-slot-placeholder" size={20}/>}</ItemCard></div>{stone?<div className="composition-preview" aria-label={`Prévia de composição: ${COMPOSITION_STAT_NAMES[stone.stat]} de ${bonus[stone.stat]??0} para ${stone.value}`}><span>{COMPOSITION_STAT_NAMES[stone.stat]} +{bonus[stone.stat]??0}</span><ArrowRight size={14}/><b>+{stone.value}</b></div>:<div className="composition-preview is-empty"><span>Escolha um mineral ao lado</span></div>}</div>
      :<div className="forge-sockets">{STONES.map((s,i)=>{const count=stones[String(s.level)]??0;return <div className="smith-socket" key={s.level} ref={el=>{socketRefs.current[i]=el;}} style={flight(i)}><ItemCard rarity={stoneRarity(s.level)} empty={!count} className={`forge-socket ${count?'has-stone':''}`} disabled={!count||locked} onClick={()=>removeStone(s.level)} aria-label={`Remover uma ${s.name}, ${count} selecionadas`}>{materialPulse?.level===s.level&&<i key={materialPulse.key} className="forge-material-pulse" aria-hidden="true"/>}{count?<><StoneIcon level={s.level} size={38}/><b>×{count}</b><span className="forge-socket-minus"><Minus size={10}/></span></>:<small>{['I','II','III','IV','V'][s.level-1]}</small>}</ItemCard></div>;})}</div>}
     </div>
     <div className="smith-anvil" ref={anvilRef}>
      <ItemCardFrame rarity={item?.rarity} variant="hero" empty={!item} className={`forge-weapon-target ${item?'filled':''} ${dropTarget==='weapon'?'drag-over':''}`} onDragOver={e=>allowDrop(e,'weapon')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'weapon')} role="region" aria-label="Coloque o equipamento na bigorna">
       {item?<><ItemIcon id={item.id} size={116} upgrade={level}/>{item.slot==='weapon'&&<UpgradeTag level={level} size={66} className="smith-upgrade-badge"/>}<button className="forge-remove-weapon" aria-label="Retirar equipamento da bigorna" disabled={locked} onClick={()=>{setSelected('');setResult(null);}}><X size={13}/></button></>:<><Hammer className="smith-target-placeholder" size={34}/><span>{composing?'Escolha um equipamento':'Escolha uma arma'}</span></>}
      </ItemCardFrame>
      <span className="smith-anvil-base" aria-hidden="true"/>
      {pending&&<StrengtheningEffect/>}
     </div>
     <div className="smith-forge-controls">
      <div className="smith-chance" data-tone={item&&(composing?!!stone:stoneCount>0)?chanceTone:undefined}>
       <div className="forge-chance-track" role="progressbar" aria-label="Chance de sucesso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={chance}><i style={{width:`${chance}%`}}/><strong>{!composing&&level>=MAX_UPGRADE?'Nível máximo':`Chance ${number.format(chance)}%`}</strong>{chanceDelta&&<em key={chanceDelta.key} className={chanceDelta.value>0?'up':'down'}>{chanceDelta.value>0?'+':''}{number.format(chanceDelta.value)}%</em>}</div>
       {composing&&<div className={`composition-cost ${stone&&p.gold<stone.cost?'insufficient':''}`} title="Custo em Moedas Brasa"><RewardIcon size={16}/><strong>{stone?.cost??0}</strong></div>}
      </div>
      <button className={`smith-action forge-submit ${pending?'pending':''} ${canForge?'is-ready':''}`} disabled={!canForge} aria-busy={pending} aria-describedby="forge-action-feedback" onClick={submit}>{pending?<LoaderCircle className="button-spinner" size={20}/>:composing?<Sparkles size={20}/>:<Hammer size={20}/>}{pending?composing?'Compondo…':'Fortalecendo…':composing?'Compor atributo':level>=MAX_UPGRADE?'Nível máximo':'Fortalecer'}</button>
      <div id="forge-action-feedback" className={`forge-feedback ${localError?'is-error':guidance?'is-guidance':result?result.success?'is-success':'is-failure':''}`} role="status" aria-live="polite">{localError??(pending?'A forja está trabalhando…':result?result.mode==='compose'?'Pedra e ouro consumidos.':'Pedras consumidas.':guidance??(composing?`Custa ${stone?.cost??0} moedas. A pedra e o ouro são gastos mesmo se falhar.`:`${stoneCount} / ${MAX_FORGE_STONES} pedras. As pedras são gastas em cada tentativa.`))}</div>
     </div>
     {result&&<div key={resultKey} className={`forge-outcome ${result.success?'success':'failure'}`} role="status" aria-live="polite"><OutcomeBurst success={result.success}/><OutcomeBanner success={result.success}/>{result.mode==='strengthen'&&result.success?<UpgradeTag level={result.level!} size={92} className="smith-outcome-tag"/>:<span className="forge-outcome-level">{result.mode==='strengthen'?`Continua +${result.level}`:result.success?`${COMPOSITION_STAT_NAMES[result.stat!]} +${result.value}`:'Atributo anterior mantido'}</span>}</div>}
    </div>
    {composing&&<div className="smith-console composition-current" aria-label="Composições aplicadas">{COMPOSITION_STATS.map(stat=><span key={stat} data-active={stone?.stat===stat||undefined}><CompositionIcon stat={stat} size={20}/><small>{COMPOSITION_STAT_NAMES[stat]}</small><b>+{item?bonus[stat]??0:0}</b></span>)}</div>}
   </section>
   <section className="smith-pane forge-stock" aria-label="Itens disponíveis">
    <div className="smith-toolbar"><h2><Swords size={16}/>{composing?'Equipamentos':'Suas armas'}</h2><span className="capacity">{owned.length} {owned.length===1?'item':'itens'}</span></div>
    <div className="smith-shelf">
     <div className="smith-grid">
      <div className={`forge-weapon-stock ${composing?'composition-equipment-stock':''}`}>{owned.map(({key,item:w})=>{const upgrade=pending&&selected===key?level:p.upgrades[key]??0;return <ItemCard key={key} rarity={w.rarity} selected={selected===key} className={`forge-stock-item ${selected===key?'selected':''}`} draggable={!locked} disabled={locked} onDragStart={e=>{e.dataTransfer.setData(ITEM_DRAG,key);e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>choose(key)} aria-pressed={selected===key} aria-label={`${w.name}${w.slot==='weapon'?`, nível +${upgrade}`:''}. Clique para colocar na bigorna.`} aria-describedby={tooltip?.id===key?'item-tooltip':undefined} {...tipHandlers(key)}><ItemIcon id={w.id} size={64} upgrade={upgrade}/>{w.slot==='weapon'&&<UpgradeTag level={upgrade} className="bag-upgrade-tag"/>}{selected===key&&<span className="forge-chosen"><Check size={11}/></span>}</ItemCard>;})}{Array.from({length:fill(owned.length,3)},(_,i)=><ItemCardFrame key={`empty-${i}`} empty variant="slot" className={`smith-empty ${i>=fill(owned.length)?'smith-empty-extra':''}`} aria-hidden="true"/>)}</div>
      <div className="smith-section-heading"><h3><Gem size={14}/>Materiais</h3><span>{composing?'Atributos · I a III':'Fortalecimento · I a V'}</span></div>
      {composing?<div className="composition-minerals">
       <div className="composition-attributes" role="group" aria-label="Atributo para composição">{COMPOSITION_STATS.map(stat=><button key={stat} className={mineralStat===stat?'active':''} aria-pressed={mineralStat===stat} disabled={locked} onClick={()=>{setMineralStat(stat);setSelectedStone('');setResult(null);}}><CompositionIcon stat={stat} size={22}/><span>{COMPOSITION_STAT_NAMES[stat]}</span></button>)}</div>
       <div className="composition-tier-grid">{COMPOSITION_STONES.filter(s=>s.stat===mineralStat).map(s=>{const quantity=compositionStock[s.id]??0,disabled=locked||quantity<=0;return <div className="composition-tier" key={s.id}><ItemCard rarity="common" selected={selectedStone===s.id} className="composition-stock-stone" disabled={disabled} draggable={!disabled} onDragStart={e=>{e.dataTransfer.setData(STONE_DRAG,s.id);e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>chooseStone(s.id)} aria-pressed={selectedStone===s.id} aria-label={`${s.name}, ${quantity} disponíveis, ${COMPOSITION_STAT_NAMES[s.stat]} +${s.value}`} title={`${s.name} · ${s.chance}% · ${s.cost} ouro`}><CompositionIcon stat={s.stat} size={56}/><small>{['I','II','III'][s.tier-1]}</small><b>{quantity}</b></ItemCard><strong>+{s.value}</strong><span>{s.chance}%</span></div>;})}</div>
      </div>:<div className="forge-stone-stock">{STONES.map(s=>{const quantity=stock[String(s.level)]??0,remaining=quantity-(stones[String(s.level)]??0),disabled=locked||remaining<=0||stoneCount>=MAX_FORGE_STONES;return <ItemCard key={s.level} rarity={stoneRarity(s.level)} className={`forge-stock-stone ${remaining<=0?'depleted':''}`} disabled={disabled} draggable={!disabled} aria-label={`${s.name}, ${remaining} disponíveis. Clique para adicionar.`} {...tipHandlers(`stone-${s.level}`)} onDragStart={e=>{e.dataTransfer.setData(STONE_DRAG,String(s.level));e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)} onClick={()=>addStone(s.level)}><StoneIcon level={s.level} size={56}/><small>{['I','II','III','IV','V'][s.level-1]}</small><b>{remaining}</b></ItemCard>;})}{Array.from({length:fill(STONES.length)},(_,i)=><ItemCardFrame key={`empty-${i}`} empty variant="slot" className="smith-empty" aria-hidden="true"/>)}</div>}
     </div>
     <nav className="smith-tabs forge-services" aria-label="Serviços do ferreiro" role="tablist" aria-orientation="vertical">
      <button role="tab" aria-selected={!composing} aria-controls="forge-service-content" className={!composing?'active':''} disabled={locked} onClick={()=>changeMode('strengthen')}><Hammer size={20}/><span>Fortalecer</span></button>
      <button role="tab" aria-selected={composing} aria-controls="forge-service-content" className={composing?'active':''} disabled={locked} onClick={()=>changeMode('compose')}><Sparkles size={20}/><span>Composição</span></button>
     </nav>
    </div>
    <footer className="smith-footer">
     <div className="smith-wallet"><span title="Moedas Brasa"><RewardIcon size={18}/><b>{p.gold.toLocaleString('pt-BR')}</b></span><span title={composing?'Minerais de composição':'Pedras de fortalecimento'}>{composing?<CompositionIcon stat="attack" size={20}/>:<img src="/assets/stone-1.png" alt="" width={20} height={20}/>}<b>{(composing?mineralTotal:stoneTotal).toLocaleString('pt-BR')}</b></span></div>
     <span className="smith-hint">Clique ou arraste para a bigorna</span>
    </footer>
   </section>
  </div>
  {tooltip&&createPortal(<InventoryTooltip tip={tooltip} gender={p.gender} equipment={p.equipment} upgrades={p.upgrades} compositions={p.compositions} action={tooltip.id.startsWith('stone-')?'Clique para adicionar à bigorna':'Clique ou arraste para a bigorna'}/>,document.body)}
 </Modal>;
}
