import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {DoorOpen,Hand,Anchor} from 'lucide-react';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {BAIT_BY_ID,FISHING_BAITS,FISHING_RODS,FISHING_SPOTS,FISH_BY_ID,ROD_BY_ID,SPOT_REACH,fishingLevelProgress,gradePress,markerAt,normalizeFishing,zoneAt} from '../../shared/fishing';
import type {FishingView,PressGrade} from '../../shared/fishing';
import {FishingIcon} from './FishingIcon';
import './Fishing.css';

type GearMenu='rod'|'bait'|null;
/**
 * The Pescaria's own controls over the plaza HUD: the way back, the fisher level and Pontos de
 * Pesca, the rod and bait (switchable at any time but mid-bar), automatic mode, the timing bar and
 * the result of each cast.
 */
export function FishingHud({blocked}:{blocked:boolean}){
 const {profile,fishing,players,offset}=useGame();
 const f=normalizeFishing(profile!.fishing),progress=fishingLevelProgress(f.xp);
 const [gear,setGear]=useState<GearMenu>(null),hoverLake=useHoverLake();
 const me=players.find(p=>p.id===profile!.id);
 const nearSpot=me?FISHING_SPOTS.find(s=>Math.hypot(s.x-me.x,s.y-me.y)<=SPOT_REACH):undefined;
 const phase=fishing?.phase,busy=phase==='waiting'||phase==='bite';
 const cast=()=>{const spot=fishing?.spot??nearSpot?.id;if(spot){client.send({type:'fish-cast',spot});audio.play('click');}};
 const reel=()=>{client.send({type:'fish-stop'});audio.play('click');};
 const auto=fishing?.auto??false;
 const [autoPref,setAutoPref]=useState(false);
 const toggleAuto=()=>{const on=!(fishing?auto:autoPref);setAutoPref(on);client.send({type:'fish-auto',on});audio.play('click');};
 const press=useBar(fishing,offset,blocked);
 // Space casts from a spot (the bar's own Space is in useBar).
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(blocked||e.code!=='Space'||['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;
   if(fishing?.phase==='bite')return;
   if(fishing?.phase==='idle'||!fishing&&nearSpot){e.preventDefault();cast();}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 const rod=ROD_BY_ID.get(f.rod)!,bait=BAIT_BY_ID.get(f.bait)!;
 const pick=(c:{rod?:string;bait?:string})=>{client.send({type:'fish-gear',...c});setGear(null);audio.play('click');};
 const autoOn=fishing?auto:autoPref;
 return <div className="fishing-hud">
  <button className="fishing-exit wood-button" onClick={()=>{client.goTo('plaza');audio.play('click');}} title="Voltar para a Praça Celeste"><DoorOpen size={20}/> Sair da Pescaria</button>
  <section className="fishing-card" aria-label="Pescador">
   <div className="fishing-medal"><img src="/assets/ui/aura-blue-sigil.png" alt="" draggable={false}/><FishingIcon id={rod.id} size={40}/><b className="fishing-medal-level">{progress.level}</b></div>
   <div className="fishing-card-lines">
    <small>Pescador</small><strong>Nível {progress.level}</strong>
    <div className="fishing-xp" title="EXP de pescador"><i style={{width:`${progress.percent}%`}}/><span>{progress.required?`${progress.current} / ${progress.required}`:'MÁXIMO'}</span></div>
    <div className="fishing-points" title="Pontos de Pesca: troque na Casa de Pesca"><FishingIcon id="fishing-points" size={22}/><b>{f.points.toLocaleString('pt-BR')}</b><span>Pontos de Pesca</span></div>
   </div>
  </section>
  <section className="fishing-bar-panel" aria-label="Pescar">
   <div className="fishing-gear">
    <button className={`fishing-slot ${gear==='rod'?'open':''}`} onClick={()=>setGear(gear==='rod'?null:'rod')} title={`${rod.name}: ${rod.description}`}><span className="fishing-slot-art"><FishingIcon id={rod.id} size={42}/></span><span>Vara</span></button>
    <button className={`fishing-slot ${gear==='bait'?'open':''}`} onClick={()=>setGear(gear==='bait'?null:'bait')} title={`${bait.name}: ${bait.description}`}><span className="fishing-slot-art"><FishingIcon id={bait.id} size={42}/><em>{bait.infinite?'∞':f.baits[bait.id]??0}</em></span><span>Isca</span></button>
    {gear&&<div className="fishing-gear-menu" role="menu">
     <header>{gear==='rod'?'Suas varas':'Suas iscas'}</header>
     {gear==='rod'?FISHING_RODS.filter(r=>f.rods.includes(r.id)).map(r=><button key={r.id} role="menuitem" className={r.id===f.rod?'selected':''} disabled={phase==='bite'} onClick={()=>pick({rod:r.id})}><span className="fishing-slot-art"><FishingIcon id={r.id} size={36}/></span><span><b>{r.name}</b><small>{r.description}</small></span>{r.id===f.rod&&<i>Em uso</i>}</button>)
      :FISHING_BAITS.filter(b=>b.infinite||f.baits[b.id]).map(b=><button key={b.id} role="menuitem" className={b.id===f.bait?'selected':''} disabled={phase==='bite'} onClick={()=>pick({bait:b.id})}><span className="fishing-slot-art"><FishingIcon id={b.id} size={36}/></span><span><b>{b.name}{b.infinite?'':` ×${f.baits[b.id]}`}</b><small>{b.description}</small></span>{b.id===f.bait&&<i>Em uso</i>}</button>)}
     <p className="fishing-gear-hint">Mais varas e iscas na Casa de Pesca.</p>
    </div>}
   </div>
   <button className={`fishing-auto ${autoOn?'on':''}`} onClick={toggleAuto} title="Automático: continua pescando sozinho enquanto o jogo estiver aberto, com menos acerto que o manual."><span className="fishing-switch"><i/></span><span>Auto</span></button>
   {busy?<button className="fishing-main reel" onClick={reel}><Anchor size={20}/> Recolher</button>
    :<button className="fishing-main" disabled={!fishing&&!nearSpot} onClick={cast}><Hand size={20}/> Lançar <kbd>Espaço</kbd></button>}
  </section>
  {!fishing&&!nearSpot&&<p className="fishing-tip">{hoverLake?`${hoverLake}: clique para ir até um lugar livre e pescar.`:'Clique na água de um lago para ir até um lugar livre e pescar.'}</p>}
  {fishing?.phase==='waiting'&&<p className="fishing-tip waiting"><span className="fishing-dots"><i/><i/><i/></span>{auto?'Pescando no automático':'Esperando o peixe morder'}</p>}
  {fishing?.phase==='bite'&&fishing.challenge&&<Challenge view={fishing} press={press} offset={offset}/>}
  {fishing?.phase==='result'&&fishing.result&&<Result view={fishing}/>}
 </div>;
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
 return <div className={`fishing-challenge ${view.auto?'auto':''} ${c.drift?'wild':''}`} role="group" aria-label="Desafio da pesca">
  <div className="fishing-clock" style={{'--left':`${lead?100:left/c.limitMs*100}%`} as CSSProperties} title={`${(left/1000).toFixed(1)} s`}>
   <span><FishingIcon id={SHADOW} size={40} unknown/></span>
  </div>
  <div className="fishing-challenge-body">
   <header><strong className="fishing-hooked">{lead?'Fisgou!':view.auto?'Puxando…':c.drift?'Ele está fugindo!':'Aperte no alvo!'}</strong><span className="fishing-stars" aria-label={`Dificuldade ${stars}`}>{Array.from({length:5},(_,i)=><i key={i} className={i<stars?'on':''}>★</i>)}</span></header>
   <button className="fishing-track" onPointerDown={e=>{e.preventDefault();press.press();}} disabled={view.auto} aria-label="Apertar a barra">
    <span ref={zoneEl} className="fishing-zone" style={{width:`${c.width*100}%`}}><span className="fishing-perfect" style={{left:`${(c.width-c.perfect)/2/c.width*100}%`,width:`${c.perfect/c.width*100}%`}}/></span>
    <div ref={marker} className="fishing-marker" style={{opacity:lead?.4:1}}/>
   </button>
   <footer>
    <span className="fishing-hits">{Array.from({length:c.hits},(_,i)=><i key={i} className={i<hits?'done':''}/>)}</span>
    {!view.auto&&<span className="fishing-misses">{Array.from({length:c.misses},(_,i)=><i key={i} className={i<misses?'lost':''}/>)}</span>}
    {!view.auto&&<small><kbd>Espaço</kbd> ou clique</small>}
   </footer>
  </div>
  {last&&!view.auto&&<em key={grades.length} className={`fishing-grade ${last}`}>{last==='perfect'?'Perfeito!':last==='hit'?'Boa!':'Errou!'}</em>}
 </div>;
}
/** The fish nobody has seen yet: any fish's dark shape. */
const SHADOW='carpa-lua';

function Result({view}:{view:FishingView}){
 const r=view.result!,c=r.catch,fish=FISH_BY_ID.get(c?.fish??r.fish??'');
 if(!r.success||!c)return <div className="fishing-result lost"><strong>O peixe escapou!</strong>{fish&&<span>Era um(a) {fish.name}</span>}</div>;
 return <div className="fishing-result caught">
  <div className="fishing-result-art"><img src="/assets/ui/aura-gold-sigil.png" alt="" draggable={false}/><FishingIcon id={c.fish} size={92}/></div>
  <div className="fishing-result-text">
   <strong>{fish?.name}</strong>
   <span className="fishing-result-meta"><b>{c.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</b>{fish&&<span className="fishing-stars">{Array.from({length:fish.difficulty},(_,i)=><i key={i} className="on">★</i>)}</span>}</span>
   <div className="fishing-rewards"><span><FishingIcon id="fishing-points" size={20}/>+{c.points}</span><span className="xp">+{c.xp} EXP</span></div>
   {(c.first||c.record||c.levelUp)&&<div className="fishing-tags">{c.first&&<em className="new">Novo na coleção!</em>}{c.record&&<em className="record">Recorde!</em>}{c.levelUp&&<em className="level">Pescador Nv. {c.levelUp}!</em>}</div>}
  </div>
 </div>;
}
