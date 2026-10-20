import {useState} from 'react';
import {useGame,client} from '../client';
import {FISH_BAG_MAX,FISHING_RODS,FISHING_WEAPON,fishingLevel,normalizeFishing} from '../../shared/fishing';
import {WEAPON_FRAGMENT_RECIPES} from '../../shared/synthesis';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {ROD_LEVEL,useRodTip} from './FishingRodInfo';
import {BagFishCard,useFishTip} from './FishingFish';
import {audio} from '../game/audio';
import './Fishing.css';

const SLOTS=24;
const FRAGMENTS_NEEDED=WEAPON_FRAGMENT_RECIPES.find(r=>r.weapon===FISHING_WEAPON)?.count??50;

/**
 * Sacola da Pescaria (pedidos do matheus): Peixes (cada peixe pescado com o seu peso e valor, até vender
 * na Casa de Pesca) e Varas (todas, com as informações ao passar o mouse, e os Fragmentos).
 */
export function FishingBag(){
 const {profile}=useGame(),f=normalizeFishing(profile!.fishing),level=fishingLevel(f.xp);
 const [tab,setTab]=useState<'fish'|'rods'>('fish'),rodTip=useRodTip(f.rods,f.rod,level);
 const fishTip=useFishTip(),records=new Set(f.bag.filter(b=>b.kg>=(f.best[b.fish]??0)).map(b=>b.id));
 const worth=f.bag.reduce((s,b)=>s+b.value,0);
 const fragments=profile!.fragments?.[FISHING_WEAPON]??0;
 return <Modal title="Sacola" onClose={()=>client.closeFishBag()} className="fishing-bag-window">
  <div className="fishing-bag">
   <nav className="fishing-bag-tabs">
    <button className={tab==='fish'?'active':''} onClick={()=>setTab('fish')}>Peixes<small>{f.bag.length}/{FISH_BAG_MAX}</small></button>
    <button className={tab==='rods'?'active':''} onClick={()=>setTab('rods')}>Varas<small>{f.rods.length}/{FISHING_RODS.length}</small></button>
   </nav>
   {tab==='fish'?<>
    <ul className="fishing-bag-slots fish">{Array.from({length:Math.max(SLOTS,Math.ceil(f.bag.length/8)*8)},(_,i)=>{const b=f.bag[i];
     return b?<li key={b.id} className="fishing-bag-slot fish"><BagFishCard item={b} record={records.has(b.id)} size={32} onHover={fishTip.handlers(b,records.has(b.id))}/></li>
     :<li key={`empty-${i}`} className="fishing-bag-slot empty"/>;})}</ul>
    {f.bag.length?<div className="fishing-bag-sell"><span>{f.bag.length} {f.bag.length===1?'peixe vale':'peixes valem'} <FishingIcon id="fishing-points" size={16}/><b>{worth.toLocaleString('pt-BR')}</b>{f.bag.length>=FISH_BAG_MAX&&<em> · Sacola cheia: novos peixes são vendidos na hora</em>}</span>
     <button className="wood-button" onClick={()=>{client.openFishShop('sell');audio.play('click');}}>Vender na Casa de Pesca</button></div>
     :<p className="fishing-bag-empty">A sacola está vazia. Aperte Lançar e pesque no lago!</p>}
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
  {rodTip.node}{fishTip.node}
 </Modal>;
}
