import {useEffect,useState} from 'react';
import {Lock} from 'lucide-react';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {FISH,FISHING_LAKES,FISHING_SHOP,MAX_FISHING_BUY,fishingLevelProgress,normalizeFishing} from '../../shared/fishing';
import type {FishingOffer} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {RewardIcon} from './RewardIcon';
import {ItemCardFrame} from './ItemCard';
import './Fishing.css';

/** Prizes the game already has art for use it (coins, stones, tickets, pet food); rods and baits use the fishing icons. */
function PrizeIcon({offer,size}:{offer:FishingOffer;size:number}){
 const p=offer.prize;
 if(p.kind==='gold')return <RewardIcon kind="coins" size={size}/>;
 if(p.kind==='stone')return <RewardIcon kind="stone" level={p.level} size={size}/>;
 if(p.kind==='ticket')return <RewardIcon kind="ticket" size={size}/>;
 if(p.kind==='pet-food')return <img src={`/assets/pets/${p.food.replace('pet-food-','food-')}.png`} width={size} height={size} alt="" draggable={false} style={{objectFit:'contain'}}/>;
 return <FishingIcon id={p.kind==='rod'?p.rod:p.bait} size={size}/>;
}
/** Casa de Pesca: trade Pontos de Pesca for rewards, and the collection of every fish caught. */
export function FishingShop(){
 const {profile,fishBuy}=useGame(),f=normalizeFishing(profile!.fishing),progress=fishingLevelProgress(f.xp),level=progress.level;
 const [tab,setTab]=useState<'shop'|'collection'>('shop'),[amounts,setAmounts]=useState<Record<string,number>>({}),[asking,setAsking]=useState<string|null>(null);
 useEffect(()=>{if(fishBuy)setAsking(null);},[fishBuy?.at]);
 const close=()=>client.closeFishShop();
 const amount=(id:string)=>amounts[id]??1;
 const setAmount=(id:string,n:number)=>setAmounts(a=>({...a,[id]:Math.max(1,Math.min(MAX_FISHING_BUY,Math.floor(n)||1))}));
 const known=Object.keys(f.caught).length;
 return <Modal title="Casa de Pesca" onClose={close} className="bag-window fishing-shop-window" viewport>
  <div className="fishing-shop">
   <aside className="fishing-counter">
    <div className="fishing-counter-art"><img className="sigil" src="/assets/ui/aura-gold-sigil.png" alt="" draggable={false}/><img className="house" src="/assets/fishing/props/gazebo.webp" alt="" draggable={false}/></div>
    <div className="fishing-counter-level"><small>Pescador</small><b>Nível {level}</b>
     <div className="fishing-xp"><i style={{width:`${progress.percent}%`}}/><span>{progress.required?`${progress.current} / ${progress.required}`:'MÁXIMO'}</span></div></div>
    <div className="fishing-counter-points"><FishingIcon id="fishing-points" size={34}/><div><b>{f.points.toLocaleString('pt-BR')}</b><small>Pontos de Pesca</small></div></div>
    <dl className="fishing-counter-stats">
     <div><dt>Peixes pescados</dt><dd>{f.total.toLocaleString('pt-BR')}</dd></div>
     <div><dt>Coleção</dt><dd>{known} / {FISH.length}</dd></div>
    </dl>
    <p>Pesque nos lagos para ganhar Pontos de Pesca e EXP de pescador.</p>
   </aside>
   <div className="fishing-shop-main">
    <nav className="fishing-shop-tabs">
     <button className={tab==='shop'?'active':''} onClick={()=>setTab('shop')}>Trocas</button>
     <button className={tab==='collection'?'active':''} onClick={()=>setTab('collection')}>Coleção <small>{known}/{FISH.length}</small></button>
    </nav>
    {tab==='shop'?<ul className="fishing-offers">{FISHING_SHOP.map(offer=>{
     const locked=!!offer.level&&level<offer.level,single=offer.prize.kind==='rod',owned=offer.prize.kind==='rod'&&f.rods.includes(offer.prize.rod);
     const n=single?1:amount(offer.id),cost=offer.cost*n,poor=f.points<cost;
     return <li key={offer.id} className={`fishing-offer ${locked?'locked':''} ${owned?'owned':''}`}>
      <ItemCardFrame variant="preview" className="fishing-offer-art"><PrizeIcon offer={offer} size={50}/>{locked&&<span className="fishing-lock"><Lock size={14}/> Nv. {offer.level}</span>}</ItemCardFrame>
      <div className="fishing-offer-text"><b>{offer.name}</b><small>{offer.description}</small></div>
      <div className="fishing-offer-foot">
       <span className="fishing-cost"><FishingIcon id="fishing-points" size={18}/>{cost.toLocaleString('pt-BR')}</span>
       {locked?<span className="fishing-need">Pescador Nv. {offer.level}</span>:owned?<span className="fishing-need">Já tem</span>:
        asking===offer.id?<span className="fishing-buy"><button className="wood-button" onClick={()=>{client.send({type:'fish-buy',offer:offer.id,quantity:n});audio.play('click');}}>Confirmar</button><button className="wood-quiet" onClick={()=>setAsking(null)}>Não</button></span>
        :<span className="fishing-buy">
         {!single&&<span className="fishing-stepper"><button onClick={()=>setAmount(offer.id,n-1)} disabled={n<=1} aria-label="Menos">−</button><input type="number" min={1} max={MAX_FISHING_BUY} value={n} aria-label="Quantidade" onChange={e=>setAmount(offer.id,Number(e.target.value))}/><button onClick={()=>setAmount(offer.id,n+1)} disabled={n>=MAX_FISHING_BUY} aria-label="Mais">+</button></span>}
         <button className="wood-button" disabled={poor} title={poor?'Pontos de Pesca insuficientes':undefined} onClick={()=>setAsking(offer.id)}>Trocar</button>
        </span>}
      </div>
     </li>;})}</ul>
    :<div className="fishing-collection">{FISHING_LAKES.map(lake=>{const list=FISH.filter(fish=>fish.lakes[0]===lake.id),got=list.filter(fish=>f.caught[fish.id]).length;
     return <section key={lake.id}><h3 className="wood-ribbon">{lake.name}<small>{got}/{list.length}</small></h3><ul>{list.map(fish=>{
      const count=f.caught[fish.id]??0;
      return <li key={fish.id} className={`fishing-entry ${count?'':'unknown'}`} title={count?`${fish.name}: ${count} pescado(s)`:'Ainda não pescado'}>
       <ItemCardFrame variant="preview" empty={!count}><FishingIcon id={fish.id} size={54} unknown={!count}/>{count>0&&<span className="fishing-count">×{count}</span>}</ItemCardFrame>
       <b>{count?fish.name:'???'}</b>
       <span className="fishing-stars" aria-label={`Dificuldade ${fish.difficulty}`}>{Array.from({length:5},(_,i)=><i key={i} className={i<fish.difficulty?'on':''}>★</i>)}</span>
       <small>{count?`Recorde ${f.best[fish.id]?.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg`:'Ainda não pescado'}</small>
      </li>;})}</ul></section>;})}</div>}
    {fishBuy&&<p className="fishing-shop-done">Troca feita: {FISHING_SHOP.find(o=>o.id===fishBuy.offer)?.name}{fishBuy.quantity>1?` ×${fishBuy.quantity}`:''}.</p>}
   </div>
  </div>
 </Modal>;
}
