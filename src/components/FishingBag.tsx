import {useState} from 'react';
import type {CSSProperties} from 'react';
import {useGame,client} from '../client';
import {FISH,FISHING_RODS,FISHING_WEAPON,fishRarity,fishingLevel,normalizeFishing} from '../../shared/fishing';
import {WEAPON_FRAGMENT_RECIPES} from '../../shared/synthesis';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {ROD_LEVEL,useRodTip} from './FishingRodInfo';
import './Fishing.css';

const SLOTS=24;
const FRAGMENTS_NEEDED=WEAPON_FRAGMENT_RECIPES.find(r=>r.weapon===FISHING_WEAPON)?.count??50;

/** Sacola da Pescaria (pedido do matheus): abas Peixes (o que foi pescado, por espécie) e Varas (todas, com as informações ao passar o mouse, e os Fragmentos). */
export function FishingBag(){
 const {profile}=useGame(),f=normalizeFishing(profile!.fishing),level=fishingLevel(f.xp);
 const [tab,setTab]=useState<'fish'|'rods'>('fish'),rodTip=useRodTip(f.rods,f.rod,level);
 const fish=FISH.filter(x=>f.caught[x.id]).sort((a,b)=>b.difficulty-a.difficulty||a.name.localeCompare(b.name));
 const fragments=profile!.fragments?.[FISHING_WEAPON]??0;
 return <Modal title="Sacola" onClose={()=>client.closeFishBag()} className="fishing-bag-window">
  <div className="fishing-bag">
   <nav className="fishing-bag-tabs">
    <button className={tab==='fish'?'active':''} onClick={()=>setTab('fish')}>Peixes<small>{f.total.toLocaleString('pt-BR')}</small></button>
    <button className={tab==='rods'?'active':''} onClick={()=>setTab('rods')}>Varas<small>{f.rods.length}/{FISHING_RODS.length}</small></button>
   </nav>
   {tab==='fish'?<>
    <ul className="fishing-bag-slots">{Array.from({length:Math.max(SLOTS,Math.ceil(fish.length/8)*8)},(_,i)=>{const x=fish[i];
     return x?<li key={x.id} className={`fishing-bag-slot rarity-${fishRarity(x).id}`} style={{'--rarity':fishRarity(x).color} as CSSProperties} title={`${x.name} (${fishRarity(x).name}): ${f.caught[x.id]} pescado(s), recorde ${f.best[x.id]?.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg`}>
      <FishingIcon id={x.id} size={46}/><em>×{f.caught[x.id]}</em><small>{x.name}</small></li>
     :<li key={`empty-${i}`} className="fishing-bag-slot empty"/>;})}</ul>
    {!fish.length&&<p className="fishing-bag-empty">A sacola está vazia. Aperte Lançar e pesque no lago!</p>}
   </>:<>
    <ul className="fishing-bag-slots rods">{FISHING_RODS.map(r=>{const has=f.rods.includes(r.id),using=r.id===f.rod;
     return <li key={r.id} className={`fishing-bag-slot rod ${has?'':'locked'} ${using?'using':''}`} {...rodTip.handlers(r)}>
      <FishingIcon id={r.id} size={50}/>{using&&<i className="fishing-rod-using">Em uso</i>}{!has&&<i className="fishing-rod-lock">Nv. {ROD_LEVEL.get(r.id)??1}</i>}<small>{r.name.replace(/^Vara (de |da |do )?/,'')}</small></li>;})}
     <li className="fishing-bag-slot fragment" title={`Fragmentos da Vara das Marés: ${fragments} de ${FRAGMENTS_NEEDED}. Com ${FRAGMENTS_NEEDED}, forje a arma na Síntese do Ferreiro.`}>
      <FishingIcon id="fragment" size={44}/><em>{fragments}/{FRAGMENTS_NEEDED}</em><small>Fragmentos</small></li>
    </ul>
    <p className="fishing-bag-empty">Passe o mouse numa vara para ver o que ela pesca. Varas novas saem nas Trocas, liberadas pelo nível de pescador.</p>
   </>}
  </div>
  {rodTip.node}
 </Modal>;
}
