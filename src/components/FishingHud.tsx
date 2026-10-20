import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {DoorOpen,Lock,ScrollText} from 'lucide-react';
import {FishingHistory} from './FishingHistory';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {FISHING_DAILY_CAPS,FISHING_RODS,FISHING_SHOP,FISHING_WEAPON,fishingDay,FISH_BY_ID,ROD_BY_ID,fishRarity,fishingLevelProgress,gradePress,markerAt,normalizeFishing,zoneAt} from '../../shared/fishing';
import type {FishingProfile,FishingRod,FishingView,PressGrade} from '../../shared/fishing';
import {WEAPON_FRAGMENT_RECIPES} from '../../shared/synthesis';
import {FishingIcon} from './FishingIcon';
import {RewardIcon} from './RewardIcon';
import {ItemCard} from './ItemCard';
import {ROD_LEVEL,useRodTip} from './FishingRodInfo';
import {FishingRanking} from './FishingRanking';
import {weightClass} from './FishingFish';
import {fishingPick} from '../game/fishingPick';
import './Fishing.css';

type GearMenu='rod'|null;
const FRAGMENTS_NEEDED=WEAPON_FRAGMENT_RECIPES.find(r=>r.weapon===FISHING_WEAPON)?.count??50;
/**
 * The Pescaria's own controls over the plaza HUD: the way back, the fisher level and Pontos de
 * Pesca, the rod and bait (switchable at any time but mid-bar), automatic mode, the timing bar and
 * the result of each cast.
 */
export function FishingHud({blocked}:{blocked:boolean}){
 const {profile,fishing,offset}=useGame();
 const f=normalizeFishing(profile!.fishing),progress=fishingLevelProgress(f.xp);
 const [history,setHistory]=useState(false);
 const [gear,setGear]=useState<GearMenu>(null),hoverLake=useHoverLake();
 const phase=fishing?.phase,busy=phase==='waiting'||phase==='bite';
 const picking=usePicking();
 // Lançar: right after a catch, casts again from the same place; otherwise asks for a lake (the scene lights them up).
 const cast=()=>{audio.play('click');if(fishing?.spot){fishingPick.set(false);client.send({type:'fish-cast',spot:fishing.spot});}else fishingPick.set(!picking);};
 const reel=()=>{client.send({type:'fish-stop'});audio.play('click');};
 const auto=fishing?.auto??false;
 const [autoPref,setAutoPref]=useState(false);
 const [autoNote,setAutoNote]=useState<{on:boolean;at:number}|null>(null);
 useEffect(()=>{if(!autoNote)return;const t=setTimeout(()=>setAutoNote(null),1800);return()=>clearTimeout(t);},[autoNote]);
 const toggleAuto=()=>{const on=!(fishing?auto:autoPref);setAutoPref(on);setAutoNote({on,at:Date.now()});client.send({type:'fish-auto',on});audio.play('click');};
 const press=useBar(fishing,offset,blocked);
 // Space casts from a spot (the bar's own Space is in useBar).
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&fishingPick.get()){fishingPick.set(false);return;}
   if(blocked||e.code!=='Space'||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;
   if(fishing?.phase==='bite')return;
   if(fishing?.phase==='idle'||!fishing){e.preventDefault();cast();}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 const rod=ROD_BY_ID.get(f.rod)!,fragments=profile!.fragments?.[FISHING_WEAPON]??0;
 const pick=(id:string)=>{client.send({type:'fish-gear',rod:id});setGear(null);audio.play('click');};
 const autoOn=fishing?auto:autoPref;
 return <div className="fishing-hud">
  <button className="fishing-exit wood-button" onClick={()=>{client.goTo('plaza');audio.play('click');}} title="Voltar para a Praça Celeste"><DoorOpen size={20}/> Sair da Pescaria</button>
  {/* Trocas de Pontos de Pesca de qualquer lugar da zona (pedido do matheus). */}
  <button className="fishing-trade" onClick={()=>{client.openFishShop();audio.play('click');}} title="Trocar Pontos de Pesca por itens"><span className="fishing-trade-art"/><span>Trocas</span></button>
  <button className="fishing-trade fishing-history-button" onClick={()=>{setHistory(true);audio.play('click');}} title="Últimas capturas"><span className="fishing-trade-art"><ScrollText size={30} strokeWidth={2.2}/></span><span>Histórico</span></button>
  {history&&<FishingHistory onClose={()=>setHistory(false)}/>}
  <FishingRanking/>
  <section className="fishing-card" aria-label="Pescador" title="Nível de pescador: sobe com a EXP de pesca">
   <b className="fishing-card-level">{progress.level}</b>
   <div className="fishing-card-title"><small>Pescador</small></div>
   <div className="fishing-xp" title="EXP de pescador"><i style={{width:`${progress.percent}%`}}/><span>{progress.required?`${progress.current} / ${progress.required}`:'MÁXIMO'}</span></div>
  </section>
  <section className="fishing-bar-panel" aria-label="Pescar">
   {autoNote&&<em key={autoNote.at} className={`fishing-auto-note ${autoNote.on?'on':''}`}>{autoNote.on?'Pesca automática ligada':'Pesca automática desligada'}</em>}
   {autoOn&&<span className="fishing-auto-badge" title="Pescando no automático: rende 25% da pesca à mão">AUTOMÁTICO</span>}
   {/* A vara equipada fica dentro do próprio círculo de Lançar (pedido do matheus); o selo de setas troca a vara. */}
   <div className={`fishing-cast ${autoOn?'auto-on':''}`}>
    {busy?<button className="fishing-main reel" onClick={reel} title="Recolher a linha"><span className="fishing-cast-rod"><FishingIcon id={rod.id} size={86}/></span><span className="fishing-cast-label">Recolher</span></button>
     :<button className={`fishing-main ${picking?'picking':''}`} disabled={phase==='result'&&!fishing?.spot} onClick={cast} title={picking?'Clique num lago (Esc cancela)':`Lançar com a ${rod.name} (Espaço)`}><span className="fishing-cast-rod"><FishingIcon id={rod.id} size={86}/></span><span className="fishing-cast-label">{picking?'Escolha o lago':'Lançar'}<kbd>{picking?'Esc':'Espaço'}</kbd></span></button>}
    <button className={`fishing-rod-swap ${gear==='rod'?'open':''}`} onClick={()=>{setGear(gear==='rod'?null:'rod');audio.play('click');}} title="Trocar de vara" aria-label="Trocar de vara"></button>
   </div>
   <button className={`fishing-auto ${autoOn?'on':''}`} onClick={toggleAuto} title="Automático: continua pescando sozinho enquanto o jogo estiver aberto, com menos acerto que o manual."><span className="fishing-switch"><i className="off"/><i className="on"/><b>Auto</b></span></button>
   {gear==='rod'&&<RodPicker fishing={f} level={progress.level} locked={phase==='bite'} onPick={pick} onClose={()=>setGear(null)}/>}
  </section>
  {picking?<p className="fishing-tip picking">{hoverLake?`${hoverLake}: clique para ir até a margem e lançar.`:'Clique num lago para pescar nele.'}</p>
   :!fishing&&!gear&&<p className="fishing-tip">Aperte Lançar e escolha um lago.</p>}
  {fishing?.phase==='waiting'&&<p className="fishing-tip waiting"><span className="fishing-dots"><i/><i/><i/></span>{auto?'Pescando no automático':'Esperando o peixe morder'}</p>}
  {/* No automático o minigame não aparece (pedido do matheus): só o aviso de que está puxando. */}
  {fishing?.phase==='bite'&&auto&&<p className="fishing-tip waiting"><span className="fishing-dots"><i/><i/><i/></span>Fisgou! Puxando no automático</p>}
  {fishing?.phase==='bite'&&fishing.challenge&&!auto&&<Challenge view={fishing} press={press} offset={offset}/>}
  {fishing?.phase==='result'&&fishing.result&&<Result view={fishing}/>}
 </div>;
}

/** Whether the player is choosing a lake after pressing Lançar. */
function usePicking(){
 const [on,setOn]=useState(fishingPick.get());
 useEffect(()=>{setOn(fishingPick.get());return fishingPick.listen(setOn);},[]);
 useEffect(()=>()=>fishingPick.set(false),[]);
 return on;
}
/** The lake under the pointer (the scene announces it), named in the tip. */
function useHoverLake(){
 const [lake,setLake]=useState<string|null>(null);
 useEffect(()=>{const on=(e:Event)=>setLake((e as CustomEvent<string|null>).detail);window.addEventListener('brasa-fishing-lake',on);return()=>window.removeEventListener('brasa-fishing-lake',on);},[]);
 return lake;
}
/** Space or a click on the bar presses; the grade shows at once (the server decides the same way). */
function useBar(view:FishingView|null,offset:number,blocked:boolean){
 const [local,setLocal]=useState<{key:string;grades:PressGrade[]}|null>(null);
 const key=view?.challenge?`${view.since}`:'';
 const press=()=>{
  const c=view?.challenge;if(!c||view.auto||view.phase!=='bite')return;
  const at=Date.now()+offset;if(at<c.start)return;
  const known=local?.key===key?local.grades:[],hits=known.filter(g=>g!=='miss').length;
  const grade=gradePress(c,hits,at-c.start);setLocal({key,grades:[...known,grade]});
  audio.play('click');client.send({type:'fish-press',at});
 };
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(blocked||e.code!=='Space'||e.repeat||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;if(view?.phase==='bite'){e.preventDefault();press();}};
  window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);
 });
 return {press,grades:local?.key===key?local.grades:[]};
}

/** Difficulty 1–5 of the fish on the line, read back from the bar's speed (fishChallenge). */
const difficultyOf=(c:{speed:number})=>Math.max(1,Math.min(5,Math.round((c.speed-.8)/.22)+1));
/**
 * The timing bar, small and close to the player: a medallion with the fish's shadow ringed by the
 * time left and its difficulty, a strip of water where the target swims (zoneAt) and a float that
 * sweeps it, and the presses as gems.
 */
function Challenge({view,press,offset}:{view:FishingView;press:{press:()=>void;grades:PressGrade[]};offset:number}){
 const c=view.challenge!,marker=useRef<HTMLDivElement>(null),zoneEl=useRef<HTMLSpanElement>(null),[now,setNow]=useState(Date.now()+offset);
 const grades=press.grades.length>c.grades.length?press.grades:c.grades;
 const hits=grades.filter(g=>g!=='miss').length,misses=grades.filter(g=>g==='miss').length;
 const hitsRef=useRef(hits);hitsRef.current=hits;
 useEffect(()=>{let frame=0;const tick=()=>{const t=Date.now()+offset,at=Math.max(0,t-c.start);setNow(t);
  if(marker.current)marker.current.style.left=`${markerAt(c,at)*100}%`;
  if(zoneEl.current)zoneEl.current.style.left=`${(zoneAt(c,Math.min(hitsRef.current,c.zones.length-1),at)-c.width/2)*100}%`;
  frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[c,offset]);
 const lead=now<c.start,left=Math.max(0,c.start+c.limitMs-now),last=grades.at(-1),stars=difficultyOf(c);
 const U='/assets/fishing/ui/';
 return <div className={`fishing-challenge ${view.auto?'auto':''} ${c.drift?'wild':''}`} role="group" aria-label="Desafio da pesca">
  <header><strong className="fishing-hooked">{lead?'Fisgou!':c.drift?'Ele está fugindo!':'Aperte no alvo!'}</strong><span className="fishing-stars" aria-label={`Dificuldade ${stars}`}>{Array.from({length:5},(_,i)=><img key={i} src={`${U}${i<stars?'mini-star':'mini-star-empty'}.webp`} alt="" draggable={false}/>)}</span></header>
  <div className="fishing-mini">
   <div className="fishing-clock" style={{'--left':`${lead?100:left/c.limitMs*100}%`} as CSSProperties} title={`${(left/1000).toFixed(1)} s`}><img src={`${U}mini-fish.webp`} alt="" draggable={false}/></div>
   <button className="fishing-track" onPointerDown={e=>{e.preventDefault();press.press();}} aria-label="Apertar a barra">
    <span ref={zoneEl} className="fishing-zone" style={{width:`${c.width*100}%`}}><span className="fishing-perfect" style={{left:`${(c.width-c.perfect)/2/c.width*100}%`,width:`${c.perfect/c.width*100}%`}}/></span>
    <div ref={marker} className="fishing-marker" style={{opacity:lead?.5:1}}><img src={`${U}mini-float.webp`} alt="" draggable={false}/></div>
   </button>
  </div>
  <footer>
   <span className="fishing-hits">{Array.from({length:c.hits},(_,i)=><img key={i} className={i<hits?'done':''} src={`${U}${i<hits?'mini-gem':'mini-gem-empty'}.webp`} alt="" draggable={false}/>)}</span>
   <span className="fishing-misses">{Array.from({length:c.misses},(_,i)=><img key={i} className={i<misses?'lost':''} src={`${U}mini-miss.webp`} alt="" draggable={false}/>)}</span>
   <small><kbd>Espaço</kbd> ou clique</small>
  </footer>
  {last&&<em key={grades.length} className={`fishing-grade ${last}`}>{last==='perfect'?'Perfeito!':last==='hit'?'Boa!':'Errou!'}</em>}
 </div>;
}
/** The fish nobody has seen yet: any fish's dark shape. */
const SHADOW='carpa-lua';

function Result({view}:{view:FishingView}){
 const r=view.result!,c=r.catch,fish=FISH_BY_ID.get(c?.fish??r.fish??'');
 if(!r.success||!c)return <div className="fishing-result lost"><strong>O peixe escapou!</strong>{fish&&<span>Era um(a) {fish.name}</span>}</div>;
 const rarity=fishRarity(fish??{difficulty:1}),glow=rarity.id==='epico'||rarity.id==='lendario';
 return <>
  {rarity.id==='lendario'&&<div className="fishing-legend-flash" aria-hidden/>}
  <div className={`fishing-result caught rarity-${rarity.id}`} style={{'--rarity':rarity.color} as CSSProperties}>
   <div className="fishing-result-art">
    {rarity.id!=='comum'&&<span className="fishing-result-glow"/>}
    {glow&&<span className="fishing-sparkles">{Array.from({length:7},(_,i)=><i key={i}/>)}</span>}
    <FishingIcon id={c.fish} size={92}/>
   </div>
   <div className="fishing-result-text">
    <em className="fishing-rarity">{rarity.name}</em>
    <strong>{fish?.name}</strong>
    <span className="fishing-result-meta"><b>{c.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</b>{fish&&(()=>{const w=weightClass(fish,c.kg);return <i className={`fishing-weight weight-${w.id}`}>{w.name}</i>;})()}</span>
    <div className="fishing-rewards"><span title={c.sold?'Sacola cheia: vendido na hora':'Vale isso na Casa de Pesca'}><FishingIcon id="fishing-points" size={20}/>{c.sold?`+${c.points}`:`Vale ${c.points}`}</span><span className="xp">+{c.xp} EXP</span>{view.auto&&<span className="auto">Auto 25%</span>}</div>
    <small className="fishing-result-bag">{c.sold?'Sacola cheia: vendido na hora':'Guardado na Sacola'}</small>
    {c.drops?.length?<div className="fishing-drops">{c.drops.map(d=><span key={d.kind} className={`fishing-drop ${d.kind}`}><PrizeArt kind={d.kind} size={22}/>+{d.amount} {dropLabel(d.kind,d.amount)}</span>)}</div>:null}
    {(c.first||c.record||c.levelUp)&&<div className="fishing-tags">{c.first&&<em className="new">Novo na coleção!</em>}{c.record&&<em className="record">Recorde!</em>}{c.levelUp&&<em className="level">Pescador Nv. {c.levelUp}!</em>}</div>}
   </div>
  </div>
 </>;
}

/** Gold and Cupons use the game's own icons; fragments the fishing one. */
export function PrizeArt({kind,size}:{kind:'gold'|'coupons'|'fragments';size:number}){
 if(kind!=='fragments')return <RewardIcon kind={kind==='gold'?'coins':'coupons'} size={size}/>;
 return <FishingIcon id="fragment" size={size}/>;
}
export const DROP_NAMES={gold:'Ouro',coupons:'Cupons',fragments:'Fragmentos'} as const;
/** "+1 Fragmento", "+2 Fragmentos", "+120 Ouro". */
export const dropLabel=(kind:keyof typeof DROP_NAMES,amount:number)=>amount!==1?DROP_NAMES[kind]:{gold:'Ouro',coupons:'Cupom',fragments:'Fragmento'}[kind];
const percent=(chance:number)=>`${(chance*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;

const shortRod=(name:string)=>name.replace(/^Vara (de |da |do )?/,'');
/** Troca de vara (pedido do matheus): as seis varas em cards de item, a equipada com brilho, as que faltam em cinza com o nível; um clique troca. As informações da vara só aparecem ao passar o mouse no card. */
function RodPicker({fishing,level,locked,onPick,onClose}:{fishing:FishingProfile;level:number;locked:boolean;onPick:(id:string)=>void;onClose:()=>void}){
 const tip=useRodTip(fishing.rods,fishing.rod,level),menu=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 // Clicar fora do menu (no mapa, em outro botão) fecha (pedido do matheus); o botão da vara abre e fecha sozinho.
 useEffect(()=>{
  const down=(e:PointerEvent)=>{const t=e.target as Element|null;if(t&&!menu.current?.contains(t)&&!t.closest('.fishing-rod-swap'))close.current();};
  document.addEventListener('pointerdown',down,true);return()=>document.removeEventListener('pointerdown',down,true);
 },[]);
 return <div ref={menu} className="fishing-gear-menu fishing-rod-picker" role="menu">
  <header>Trocar vara</header>
  <div className="fishing-rod-grid">{FISHING_RODS.map(r=>{const has=fishing.rods.includes(r.id),using=r.id===fishing.rod,lvl=ROD_LEVEL.get(r.id)??1;
   return <ItemCard key={r.id} role="menuitem" variant="detail" selected={using} className={`fishing-rod-card ${has?'':'locked'}`} aria-label={has?r.name:`${r.name}: nível ${lvl} na Casa de Pesca`}
    {...tip.handlers(r)} onClick={()=>{if(using){onClose();audio.play('click');}else if(has&&!locked)onPick(r.id);else if(!has){client.openFishShop();audio.play('click');}}}>
    <FishingIcon id={r.id} size={58}/>
    {using&&<i className="fishing-rod-using">Em uso</i>}
    {!has&&<i className="fishing-rod-lock"><Lock size={10} strokeWidth={3}/>Nv. {lvl}</i>}
    <small>{shortRod(r.name)}</small>
   </ItemCard>;})}</div>
  {tip.node}
  {locked&&<p className="fishing-gear-hint">Espere terminar a puxada para trocar.</p>}
 </div>;
}
