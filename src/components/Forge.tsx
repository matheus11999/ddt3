import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,DragEvent} from 'react';
import {ArrowRight,Check,Flame,Gem,Hammer,LockKeyhole,Minus,Plus,Swords,X} from 'lucide-react';
import {CATALOG,MAX_FORGE_STONES,MAX_UPGRADE,STONES,WEAPONS,upgradeChance} from '../../shared/catalog';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {UpgradeBadge} from './UpgradeBadge';
import {ItemCard,ItemCardFrame,rarityLabel,stoneRarity} from './ItemCard';
import './Forge.css';

const ITEM_DRAG='application/x-brasa-item';
const STONE_DRAG='application/x-brasa-stone';
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const FORGE_ANIMATION_MS=1150;
type ForgeAttempt={level:number;chance:number;stock:Record<string,number>};

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
 return <svg className="forge-scenery" viewBox="0 0 650 310" fill="none" aria-hidden="true">
  <defs>
   <linearGradient id="forge-stone" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#83705a"/><stop offset="1" stopColor="#40312a"/></linearGradient>
   <linearGradient id="forge-metal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c5b49a"/><stop offset=".22" stopColor="#9c8b76"/><stop offset=".26" stopColor="#60574d"/><stop offset="1" stopColor="#39312c"/></linearGradient>
   <radialGradient id="forge-fire"><stop stopColor="#fff0a0"/><stop offset=".35" stopColor="#ffa745"/><stop offset="1" stopColor="#a84c2a" stopOpacity="0"/></radialGradient>
  </defs>
  <path d="M25 250V108a84 84 0 0 1 168 0v142Z" fill="url(#forge-stone)" stroke="#a0926b" strokeWidth="2"/>
  <path d="M51 245V114a58 58 0 0 1 116 0v131Z" fill="#2f241e" stroke="#ba9360" strokeWidth="3"/>
  <g stroke="#362820" strokeWidth="4" opacity=".8"><path d="m36 76 26 12m1-40 18 22m28-44v29m47-11-17 24m40 7-26 15M27 125h24m-24 44h24m-24 44h24m116-88h26m-26 44h26m-26 44h26"/></g>
  <ellipse className="forge-fire-glow" cx="110" cy="210" rx="99" ry="115" fill="url(#forge-fire)"/>
  <g className="forge-flame"><path d="M65 234c-22-28 17-45 10-74 27 18 14 27 29 30 15-19-1-33 12-56 7 41 35 38 40 67 5 25-17 39-47 39Z" fill="#e38341"/><path d="M83 232c-14-21 18-26 14-45 15 15 7 19 18 24 13-9 10-18 14-28 20 23 15 53-18 55Z" fill="#ffce6c"/><path d="M100 233c-7-13 7-17 11-29 9 9 23 31 4 33Z" fill="#fff2b1"/></g>
  <path d="M47 243h125v10H47Z" fill="#b78851" stroke="#d2aa6a"/>
  <g opacity=".46" stroke="#ccb77c" strokeWidth="3"><path d="M243 0v58m294-58v48m43-48v63"/><path d="m231 60 24-10 5 19-24 10Z" fill="#b6af91"/><path d="M246 70v32m291-55-8 22 9 14 8-14-9-22m44 17v35m-12 0h25" strokeLinecap="round"/></g>
  <ellipse cx="338" cy="290" rx="159" ry="16" fill="#20170f" opacity=".5"/>
  <path d="m272 263-11 27h141l-14-27Z" fill="#413d36" stroke="#968168" strokeWidth="2"/>
  <path d="M226 218h208v16l-44 17h-22l5 18h-83l6-30h-31Z" fill="url(#forge-metal)" stroke="#c1b39b" strokeWidth="2"/>
  <path d="M226 218h208v8H244Z" fill="#d1c5a9"/>
  <path d="M297 249h68m-67 9h65" stroke="#a99c8b" strokeOpacity=".7"/>
  <path d="M204 290h253m-417-9h113m370 0h97" stroke="#bcad8566" strokeWidth="2"/>
 </svg>;
}

export function Forge({onClose}:{onClose:()=>void}){
 const state=useGame();
 const p=state.profile!;
 const [selected,setSelected]=useState('');
 const [stones,setStones]=useState<Record<string,number>>({});
 const [pending,setPending]=useState(false);
 const [attempt,setAttempt]=useState<ForgeAttempt|null>(null);
 const [dropTarget,setDropTarget]=useState<'weapon'|'stone'|null>(null);
 const [result,setResult]=useState<typeof state.forgeResult>(null);
 const [localError,setLocalError]=useState<string|null>(null);
 const submittedResult=useRef(state.forgeResult);
 const pendingRef=useRef(false);
 const startedAt=useRef(0);
 const owned=WEAPONS.filter(w=>p.inventory.includes(w.id));
 const item=selected?CATALOG[selected]:null;
 const level=pending&&attempt?attempt.level:selected?(p.upgrades[selected]??0):0;
 const stock=pending&&attempt?attempt.stock:p.stones;
 const stoneCount=Object.values(stones).reduce((sum,count)=>sum+count,0);
 const chance=pending&&attempt?attempt.chance:selected&&level<MAX_UPGRADE?upgradeChance(level,stones):0;
 const enough=STONES.every(s=>(stones[String(s.level)]??0)<=(p.stones[String(s.level)]??0));
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 const canForge=!!item&&level<MAX_UPGRADE&&stoneCount>0&&enough&&!locked;

 useEffect(()=>{
  if(!pending)return;
  if(state.forgeResult&&state.forgeResult!==submittedResult.current&&state.forgeResult.item===selected){
   const resolved=state.forgeResult;
   const timer=window.setTimeout(()=>{
    if(!pendingRef.current)return;
    pendingRef.current=false;setPending(false);setAttempt(null);setStones({});setResult(resolved);
    audio.play(resolved.success?'turn':'impact');
   },Math.max(0,FORGE_ANIMATION_MS-(performance.now()-startedAt.current)));
   return()=>window.clearTimeout(timer);
  }else if(state.error||state.status!=='online'){
   pendingRef.current=false;setPending(false);setAttempt(null);setLocalError(state.error??'Conexão interrompida.');
  }
 },[pending,state.forgeResult,state.error,state.status,selected]);

 function choose(id:string){
  if(locked||!owned.some(w=>w.id===id))return;
  setSelected(id);setResult(null);setLocalError(null);audio.play('click');
 }
 function addStone(stoneLevel:number){
  if(locked||!STONES.some(s=>s.level===stoneLevel))return;
  setStones(current=>{
   const key=String(stoneLevel),count=current[key]??0;
   if(Object.values(current).reduce((sum,n)=>sum+n,0)>=MAX_FORGE_STONES||count>=(p.stones[key]??0))return current;
   return {...current,[key]:count+1};
  });
  setResult(null);setLocalError(null);
 }
 function removeStone(stoneLevel:number){
  if(locked)return;
  setStones(current=>{const next={...current},key=String(stoneLevel);if(next[key]>1)next[key]--;else delete next[key];return next;});
 }
 function allowDrop(event:DragEvent,kind:'weapon'|'stone'){
  if(!locked&&event.dataTransfer.types.includes(kind==='weapon'?ITEM_DRAG:STONE_DRAG)){
   event.preventDefault();event.dataTransfer.dropEffect='copy';setDropTarget(kind);
  }
 }
 function drop(event:DragEvent,kind:'weapon'|'stone'){
  event.preventDefault();setDropTarget(null);
  if(kind==='weapon')choose(event.dataTransfer.getData(ITEM_DRAG));else addStone(Number(event.dataTransfer.getData(STONE_DRAG)));
 }
 function strengthen(){
  if(!canForge||pendingRef.current)return;
  pendingRef.current=true;submittedResult.current=state.forgeResult;startedAt.current=performance.now();
  setAttempt({level,chance,stock:{...p.stones}});
  setResult(null);setLocalError(null);setPending(true);client.update({error:null});
  client.send({type:'forge',item:selected,stones:{...stones}});audio.play('click');
 }

 return <Modal title="Ferreiro" onClose={onClose} className="forge-window">
  <nav className="forge-tabs" aria-label="Serviços do ferreiro">
   <button className="active" aria-current="page"><Hammer size={17}/>Upgrade</button>
   <button disabled><LockKeyhole size={13}/>Fusão</button><button disabled><LockKeyhole size={13}/>Refino</button>
   <span><Flame size={14}/> Forja de Brasa</span>
  </nav>
  <div className="forge-body">
   <section className={`forge-workbench ${pending?'is-strengthening':''}`} aria-label="Bancada de fortalecimento" aria-busy={pending}>
    {pending&&<StrengtheningEffect levels={STONES.filter(s=>(stones[String(s.level)]??0)>0).map(s=>s.level)}/>}
    <div className={`forge-workshop ${pending?'working':''} ${result?.success?'forge-success':''}`}>
     <WorkshopBackdrop/>
     <div className="forge-embers" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
     <div className="forge-hero-label">{item?<><span>{item.name}</span><UpgradeBadge level={level} size={92}/></>:<span>Escolha uma arma</span>}</div>
     <ItemCardFrame rarity={item?.rarity} variant="hero" empty={!item} className={`forge-weapon-target ${item?'filled':''} ${dropTarget==='weapon'?'drag-over':''}`}
      onDragOver={e=>allowDrop(e,'weapon')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'weapon')}
      role="region" aria-label="Coloque a arma na bigorna">
      <span className="forge-rune-ring" aria-hidden="true"/>
      {item?<><ItemIcon id={item.id} size={174} upgrade={level}/><button className="forge-remove-weapon" aria-label="Retirar arma da bigorna" disabled={locked} onClick={()=>{setSelected('');setResult(null);}}><X size={13}/></button></>:<><Hammer size={42} strokeWidth={1.2}/><span>Arraste sua arma</span></>}
     </ItemCardFrame>
     {pending&&<span className="forge-progress-caption">Fortalecendo<span>…</span></span>}
     {result&&<div className={`forge-outcome ${result.success?'success':'failure'}`} role="status" aria-live="polite"><span className="forge-outcome-flourish" aria-hidden="true">✦</span><strong>{result.success?'SUCESSO':'FALHA'}</strong><span className="forge-outcome-level">{result.success?`Fortalecimento +${result.level}`:`Nível +${result.level} mantido`}</span><span className="forge-outcome-rule" aria-hidden="true"/></div>}
     {item&&<div className="forge-level-path" aria-label={`Fortalecimento ${level} de 12`}><span>+{level}</span><div>{Array.from({length:12},(_,i)=><i className={i<level?'complete':i===level?'next':''} key={i}/>)}</div><span>+12</span></div>}
    </div>
    <div className={`forge-materials ${dropTarget==='stone'?'drag-over':''}`} onDragOver={e=>allowDrop(e,'stone')} onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,'stone')}>
     <div className="forge-section-heading"><h2><Gem size={14}/> Pedras de fortalecimento</h2><span>{stoneCount} / {MAX_FORGE_STONES}</span></div>
     <div className="forge-sockets">{STONES.map(s=>{const count=stones[String(s.level)]??0;return <ItemCard rarity={stoneRarity(s.level)} empty={!count} className={`forge-socket ${count?'has-stone':''}`} key={s.level} disabled={!count||locked} onClick={()=>removeStone(s.level)} aria-label={`Remover uma ${s.name}, ${count} selecionadas`} title={count?`Remover uma ${s.name}`:s.name} style={{'--stone-color':s.color} as CSSProperties}>
      {count?<><StoneIcon level={s.level} size={48}/><b>×{count}</b><span className="forge-socket-minus"><Minus size={10}/></span></>:<Gem size={24} strokeWidth={1}/>}
      <small>{s.level}</small>
     </ItemCard>;})}</div>
    </div>
    <div className="forge-action">
     <div className="forge-chance-title"><span>Chance de sucesso</span><strong>{level>=12?'Máximo':`${number.format(chance)}%`}</strong></div>
     <div className="forge-chance-track" role="progressbar" aria-label="Chance de sucesso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={chance}><i style={{width:`${chance}%`}}/><span/></div>
     <div className="forge-action-bottom"><div className="forge-next-level">{item?<><span>+{level}</span><ArrowRight size={20}/><strong>+{Math.min(12,level+1)}</strong></>:<span className="forge-empty-label">Arma + pedras</span>}</div>
      <button className={`button gold forge-submit ${pending?'pending':''}`} disabled={!canForge} onClick={strengthen}><Hammer size={19}/>{pending?'Fortalecendo…':level>=12?'Nível máximo':'Fortalecer'}</button>
     </div>
     <div className="forge-feedback" aria-live="polite">
      {localError?<span>{localError}</span>:<span>{result?'Pedras consumidas.':'As pedras são consumidas em cada tentativa.'}</span>}
     </div>
    </div>
   </section>
   <aside className="forge-stock" aria-label="Itens disponíveis">
    <div className="forge-section-heading"><h2><Swords size={15}/> Suas armas</h2><span>{owned.length} / {WEAPONS.length}</span></div>
    <div className="forge-weapon-stock">{owned.map(w=>{const upgrade=pending&&selected===w.id?level:p.upgrades[w.id]??0;return <ItemCard key={w.id} rarity={w.rarity} selected={selected===w.id} className={`forge-stock-item ${w.rarity} ${selected===w.id?'selected':''}`} draggable={!locked} disabled={locked}
     onDragStart={e=>{e.dataTransfer.setData(ITEM_DRAG,w.id);e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)}
     onDoubleClick={()=>choose(w.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(w.id);}}}
     aria-label={`${w.name}, nível +${upgrade}. Duplo clique para colocar na bigorna.`} aria-describedby={`forge-tip-${w.id}`}>
     <ItemIcon id={w.id} size={86} upgrade={upgrade}/><b className="forge-item-upgrade">+{upgrade}</b>{selected===w.id&&<span className="forge-chosen"><Check size={10}/></span>}
     <span className="forge-tooltip" id={`forge-tip-${w.id}`} role="tooltip"><strong>{w.name} +{upgrade}</strong><small>Duplo clique ou arraste</small></span>
    </ItemCard>;})}</div>
    <div className="forge-stock-hint">Duplo clique ou arraste para a bigorna</div>
    <div className="forge-section-heading forge-stones-heading"><h2><Gem size={15}/> Materiais</h2><span>Nv. 1 — 5</span></div>
    <div className="forge-stone-stock">{STONES.map(s=>{const quantity=stock[String(s.level)]??0,remaining=quantity-(stones[String(s.level)]??0),disabled=locked||remaining<=0||stoneCount>=MAX_FORGE_STONES;return <div className="forge-stone-cell" key={s.level} style={{'--stone-color':s.color} as CSSProperties}>
     <ItemCard rarity={stoneRarity(s.level)} className={`forge-stock-stone ${remaining<=0?'depleted':''}`} disabled={disabled} draggable={!disabled} aria-label={`${s.name}, ${remaining} disponíveis. Duplo clique para adicionar.`} aria-describedby={`forge-stone-tip-${s.level}`}
      onDragStart={e=>{e.dataTransfer.setData(STONE_DRAG,String(s.level));e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>setDropTarget(null)}
      onDoubleClick={()=>addStone(s.level)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();addStone(s.level);}}}>
      <StoneIcon level={s.level} size={49}/><small>{s.level}</small><b>{remaining}</b>
      <span className="forge-tooltip" id={`forge-stone-tip-${s.level}`} role="tooltip"><strong>{s.name}</strong><span>{rarityLabel(stoneRarity(s.level))} · Pedra nível {s.level}</span><span>Poder de fortalecimento {s.power}</span><small>{quantity} na mochila</small></span>
     </ItemCard><div className="forge-material-name"><strong>{s.name}</strong><span>Nível {s.level}</span></div><button className="forge-add-stone" disabled={disabled} onClick={()=>addStone(s.level)} aria-label={`Adicionar ${s.name}`}><Plus size={17}/></button>
    </div>;})}</div>
   </aside>
  </div>
 </Modal>;
}
