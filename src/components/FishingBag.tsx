import {useGame,client} from '../client';
import type {CSSProperties} from 'react';
import {FISH,FISHING_RODS,FISHING_WEAPON,fishRarity,normalizeFishing} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import './Fishing.css';

const SLOTS=24;

/** Sacola da Pescaria (pedido do matheus): what was fished, by species, and the rods and baits the player has. */
export function FishingBag(){
 const {profile}=useGame(),f=normalizeFishing(profile!.fishing);
 const fish=FISH.filter(x=>f.caught[x.id]).sort((a,b)=>b.difficulty-a.difficulty||a.name.localeCompare(b.name));
 const fragments=profile!.fragments?.[FISHING_WEAPON]??0;
 const gear=[...FISHING_RODS.filter(r=>f.rods.includes(r.id)).map(r=>({id:r.id,name:r.name,count:'',using:r.id===f.rod})),
  ...fragments?[{id:'fragment',name:'Fragmento da Vara das Marés',count:`×${fragments}`,using:false}]:[]];
 return <Modal title="Sacola" onClose={()=>client.closeFishBag()} className="fishing-bag-window">
  <div className="fishing-bag">
   <h3>Peixes pescados<small>{f.total.toLocaleString('pt-BR')}</small></h3>
   <ul className="fishing-bag-slots">{Array.from({length:Math.max(SLOTS,Math.ceil(fish.length/8)*8)},(_,i)=>{const x=fish[i];
    return x?<li key={x.id} className={`fishing-bag-slot rarity-${fishRarity(x).id}`} style={{'--rarity':fishRarity(x).color} as CSSProperties} title={`${x.name} (${fishRarity(x).name}): ${f.caught[x.id]} pescado(s), recorde ${f.best[x.id]?.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg`}>
     <FishingIcon id={x.id} size={46}/><em>×{f.caught[x.id]}</em><small>{x.name}</small></li>
    :<li key={`empty-${i}`} className="fishing-bag-slot empty"/>;})}</ul>
   {!fish.length&&<p className="fishing-bag-empty">A sacola está vazia. Aperte Lançar, escolha um lago e pesque!</p>}
   <h3>Varas e fragmentos</h3>
   <ul className="fishing-bag-slots">{gear.map(g=><li key={g.id} className={`fishing-bag-slot ${g.using?'using':''}`} title={g.using?`${g.name} (em uso)`:g.name}>
    <FishingIcon id={g.id} size={44}/>{g.count&&<em>{g.count}</em>}<small>{g.name}</small></li>)}</ul>
  </div>
 </Modal>;
}
