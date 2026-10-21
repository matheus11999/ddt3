import {useState,type CSSProperties} from 'react';
import {useGame} from '../client';
import {FISH_BY_ID,fishRarity,normalizeFishing} from '../../shared/fishing';
import type {AutoFishingSummary,FishingHistoryEntry} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {DROP_NAMES,PrizeArt} from './FishingHud';
import {AutoRunSummary,fishingDuration,runFish} from './FishingAutoSummary';
import {audio} from '../game/audio';
import './Fishing.css';

const ago=(at:number,now:number)=>{const s=Math.max(0,Math.round((now-at)/1000));return s<60?'agora':s<3600?`há ${Math.floor(s/60)} min`:s<86400?`há ${Math.floor(s/3600)} h`:`há ${Math.floor(s/86400)} d`;};
const PRIZES=['coupons','fragments','gold'] as const;

type Row={kind:'catch';at:number;entry:FishingHistoryEntry}|{kind:'auto';at:number;run:AutoFishingSummary};

/**
 * Histórico da Pescaria (pedidos do matheus): the last manual catches, and each automatic session as a single
 * line ("Pescaria automática · há x min") whose Ver opens that session's summary (items, time, prizes).
 */
export function FishingHistory({onClose}:{onClose:()=>void}){
 const {profile,offset}=useGame(),f=normalizeFishing(profile!.fishing),now=Date.now()+offset;
 const [open,setOpen]=useState<AutoFishingSummary|null>(null);
 // Automatic catches inside a saved session are shown by the session's line, not one by one.
 const inRun=(h:FishingHistoryEntry)=>h.auto&&f.autoRuns.some(r=>h.at>=r.since&&h.at<=r.until);
 const rows:Row[]=[...f.history.filter(h=>!inRun(h)).map(entry=>({kind:'catch' as const,at:entry.at,entry})),...f.autoRuns.map(run=>({kind:'auto' as const,at:run.until,run}))].sort((a,b)=>b.at-a.at);
 return <>
  <Modal title="Últimas capturas" onClose={onClose} className="fishing-history-window">
   {rows.length?<ol className="fishing-history">{rows.map((row,i)=>row.kind==='auto'?<AutoRow key={`run-${row.run.since}`} run={row.run} now={now} onOpen={()=>{setOpen(row.run);audio.play('click');}}/>:<CatchRow key={`${row.at}-${i}`} h={row.entry} now={now}/>)}</ol>
   :<p className="fishing-bag-empty">Nenhuma captura ainda. Aperte Lançar, escolha um lago e pesque!</p>}
  </Modal>
  {open&&<AutoRunSummary summary={open} subtitle={`Terminou ${ago(open.until,now)}`} onClose={()=>{setOpen(null);audio.play('click');}}/>}
 </>;
}
function CatchRow({h,now}:{h:FishingHistoryEntry;now:number}){
 const fish=FISH_BY_ID.get(h.fish)!,r=fishRarity(fish);
 return <li className={`rarity-${r.id}`} style={{'--rarity':r.color} as CSSProperties}>
  <span className="fishing-history-art"><FishingIcon id={fish.id} size={40}/></span>
  <span className="fishing-history-name"><b>{fish.name}</b><em>{r.name} · {h.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</em></span>
  <span className="fishing-history-reward"><FishingIcon id="fishing-points" size={16}/>{h.points}<small>+{h.xp} EXP</small>{h.drops?.map(d=><span key={d.kind} className={`fishing-drop ${d.kind}`} title={DROP_NAMES[d.kind]}><PrizeArt kind={d.kind} size={16}/>+{d.amount}</span>)}</span>
  <span className="fishing-history-when">{h.auto&&<i>Auto</i>}{ago(h.at,now)}</span>
 </li>;
}
function AutoRow({run,now,onOpen}:{run:AutoFishingSummary;now:number;onOpen:()=>void}){
 const fish=runFish(run),caught=fish.reduce((a,x)=>a+x.n,0),prizes=PRIZES.filter(k=>run[k]>0);
 return <li className="auto-run">
  <span className="fishing-history-art stack">{fish.slice(0,3).map(x=><FishingIcon key={x.id} id={x.id} size={30}/>)}{!fish.length&&<PrizeArt kind={prizes[0]??'gold'} size={34}/>}</span>
  <span className="fishing-history-name"><b>Pescaria automática</b><em>{fishingDuration(run.until-run.since)} · {caught} {caught===1?'peixe':'peixes'}</em></span>
  <span className="fishing-history-reward">{prizes.map(k=><span key={k} className={`fishing-drop ${k}`} title={DROP_NAMES[k]}><PrizeArt kind={k} size={16}/>+{run[k].toLocaleString('pt-BR')}</span>)}<small>+{run.xp.toLocaleString('pt-BR')} EXP</small></span>
  <span className="fishing-history-when">{ago(run.until,now)}<button className="wood-button fishing-history-see" onClick={onOpen}>Ver</button></span>
 </li>;
}
