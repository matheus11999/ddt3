import type {CSSProperties} from 'react';
import {client,useGame} from '../client';
import {FISH_BY_ID,fishRarity} from '../../shared/fishing';
import type {AutoFishingSummary as Summary} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {prizeArt} from './FishingCatchFx';
import {audio} from '../game/audio';
import './Fishing.css';

/** "1 h 05 min", "12 min 30 s", "40 s". */
export function fishingDuration(ms:number){
 const s=Math.max(0,Math.round(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;
 return h?`${h} h ${String(m).padStart(2,'0')} min`:m?`${m} min ${String(r).padStart(2,'0')} s`:`${r} s`;
}
/**
 * Resumo da pesca automática (pedido do matheus, 20/10): ao desligar o Auto (ou sair da Pescaria),
 * quanto tempo pescou, cada peixe por espécie, os prêmios das varas, Pontos e EXP.
 */
export function FishingAutoSummary(){
 const {fishAutoSummary:s}=useGame();if(!s)return null;
 return <AutoRunSummary summary={s} onClose={()=>{client.closeFishAutoSummary();audio.play('click');}}/>;
}
/** The fish of a session by kind, rarest first. */
export function runFish(s:Summary){return Object.entries(s.fish).map(([id,n])=>({fish:FISH_BY_ID.get(id),id,n})).filter(f=>f.fish).sort((a,b)=>b.fish!.difficulty-a.fish!.difficulty||b.n-a.n);}
/** One automatic session's window: also opened again from the history (Ver). */
export function AutoRunSummary({summary:s,onClose:close,subtitle='Resumo da pescaria'}:{summary:Summary;onClose:()=>void;subtitle?:string}){
 const fish=runFish(s);
 const caught=fish.reduce((a,f)=>a+f.n,0),prizes=(['coupons','fragments','gold'] as const).filter(k=>s[k]>0);
 const best=s.best&&FISH_BY_ID.get(s.best.fish);
 return <Modal title="Pesca automática" subtitle={subtitle} onClose={close} className="fishing-auto-summary">
  <div className="fishing-summary-head">
   <div><small>Tempo pescando</small><b>{fishingDuration(s.until-s.since)}</b></div>
   <div><small>Lançamentos</small><b>{s.casts}</b></div>
   <div><small>Peixes</small><b>{caught}</b></div>
   <div><small>Escaparam</small><b>{s.missed}</b></div>
  </div>
  {fish.length||prizes.length?<div className="fishing-summary-items">
   {prizes.map(k=><div key={k} className={`fishing-summary-item prize ${k}`} title={k==='gold'?'Ouro':k==='coupons'?'Cupons':'Fragmentos da Vara das Marés'}>{prizeArt(k,48)}<b>×{s[k].toLocaleString('pt-BR')}</b></div>)}
   {fish.map(f=>{const r=fishRarity(f.fish!);return <div key={f.id} className={`fishing-summary-item rarity-${r.id}`} style={{'--rarity':r.color} as CSSProperties} title={`${f.fish!.name} (${r.name})`}><FishingIcon id={f.id} size={48}/><b>×{f.n}</b></div>;})}
  </div>:<p className="fishing-bag-empty">Nada veio no anzol desta vez.</p>}
  <div className="fishing-summary-foot">
   <span><FishingIcon id="fishing-points" size={20}/>Peixes valem <b>{s.points.toLocaleString('pt-BR')}</b></span>
   <span className="xp">+{s.xp.toLocaleString('pt-BR')} EXP</span>
   {best&&s.best&&<span>Maior: <b>{best.name}</b> {s.best.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</span>}
  </div>
  <button className="wood-button fishing-summary-ok" onClick={close}>OK</button>
 </Modal>;
}
