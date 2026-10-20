import type {CSSProperties} from 'react';
import {useGame} from '../client';
import {FISH_BY_ID,fishRarity,normalizeFishing} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import './Fishing.css';

const ago=(at:number,now:number)=>{const s=Math.max(0,Math.round((now-at)/1000));return s<60?'agora':s<3600?`há ${Math.floor(s/60)} min`:s<86400?`há ${Math.floor(s/3600)} h`:`há ${Math.floor(s/86400)} d`;};

/** Histórico da Pescaria (pedido do matheus): the last catches, newest first, with rarity, weight and rewards. */
export function FishingHistory({onClose}:{onClose:()=>void}){
 const {profile,offset}=useGame(),f=normalizeFishing(profile!.fishing),now=Date.now()+offset;
 return <Modal title="Últimas capturas" onClose={onClose} className="fishing-history-window">
  {f.history.length?<ol className="fishing-history">{f.history.map((h,i)=>{const fish=FISH_BY_ID.get(h.fish)!,r=fishRarity(fish);
   return <li key={`${h.at}-${i}`} className={`rarity-${r.id}`} style={{'--rarity':r.color} as CSSProperties}>
    <span className="fishing-history-art"><FishingIcon id={fish.id} size={40}/></span>
    <span className="fishing-history-name"><b>{fish.name}</b><em>{r.name}</em></span>
    <span className="fishing-history-kg">{h.kg.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg</span>
    <span className="fishing-history-reward"><FishingIcon id="fishing-points" size={16}/>+{h.points}<small>+{h.xp} EXP</small></span>
    <span className="fishing-history-when">{h.auto&&<i>Auto</i>}{ago(h.at,now)}</span>
   </li>;})}</ol>
  :<p className="fishing-bag-empty">Nenhuma captura ainda. Aperte Lançar, escolha um lago e pesque!</p>}
 </Modal>;
}
