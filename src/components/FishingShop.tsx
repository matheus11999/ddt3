import {useEffect,useState} from 'react';
import {Lock} from 'lucide-react';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {FISH,FISHING_LAKES,FISHING_SHOP,MAX_FISHING_BUY,fishingLevel,normalizeFishing} from '../../shared/fishing';
import type {FishingOffer} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {RewardIcon} from './RewardIcon';
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
 const {profile,fishBuy}=useGame(),f=normalizeFishing(profile!.fishing),level=fishingLevel(f.xp);
 const [tab,setTab]=useState<'shop'|'collection'>('shop'),[amounts,setAmounts]=useState<Record<string,number>>({}),[asking,setAsking]=useState<string|null>(null);
 useEffect(()=>{if(fishBuy)setAsking(null);},[fishBuy?.at]);
 const close=()=>client.closeFishShop();
 const amount=(id:string)=>amounts[id]??1;
 return <Modal title="Casa de Pesca" onClose={close} className="bag-window fishing-shop-window" viewport>
  <div className="fishing-shop">
   <nav className="fishing-shop-tabs">
    <button className={tab==='shop'?'active':''} onClick={()=>setTab('shop')}>Trocas</button>
    <button className={tab==='collection'?'active':''} onClick={()=>setTab('collection')}>Coleção ({Object.keys(f.caught).length}/{FISH.length})</button>
    <span className="fishing-shop-wallet"><FishingIcon id="fishing-points" size={24}/><b>{f.points.toLocaleString('pt-BR')}</b> Pontos de Pesca · Pescador Nv. {level}</span>
   </nav>
   {tab==='shop'?<ul className="fishing-offers">{FISHING_SHOP.map(offer=>{
    const locked=!!offer.level&&level<offer.level,single=offer.prize.kind==='rod',owned=offer.prize.kind==='rod'&&f.rods.includes(offer.prize.rod);
    const n=single?1:amount(offer.id),cost=offer.cost*n,poor=f.points<cost;
    return <li key={offer.id} className={`fishing-offer wood-cream ${locked?'locked':''}`}>
     <PrizeIcon offer={offer} size={56}/>
     <div className="fishing-offer-text"><b>{offer.name}</b><small>{offer.description}</small><span className="fishing-cost"><FishingIcon id="fishing-points" size={18}/>{offer.cost}</span></div>
     {locked?<span className="fishing-lock"><Lock size={16}/> Nv. {offer.level}</span>:owned?<span className="fishing-lock">Já tem</span>:
      <div className="fishing-buy">
       {!single&&<input type="number" min={1} max={MAX_FISHING_BUY} value={n} aria-label="Quantidade" onChange={e=>setAmounts(a=>({...a,[offer.id]:Math.max(1,Math.min(MAX_FISHING_BUY,Math.floor(Number(e.target.value)||1)))}))}/>}
       {asking===offer.id?<><button className="wood-button" onClick={()=>{client.send({type:'fish-buy',offer:offer.id,quantity:n});audio.play('click');}}>Confirmar {cost}</button><button className="wood-quiet" onClick={()=>setAsking(null)}>Não</button></>
        :<button className="wood-button" disabled={poor} title={poor?'Pontos de Pesca insuficientes':undefined} onClick={()=>setAsking(offer.id)}>Trocar</button>}
      </div>}
    </li>;})}</ul>
   :<div className="fishing-collection">{FISHING_LAKES.map(lake=><section key={lake.id}><h3>{lake.name}</h3><ul>{FISH.filter(fish=>fish.lakes[0]===lake.id).map(fish=>{
     const count=f.caught[fish.id]??0;
     return <li key={fish.id} className={`fishing-entry wood-cream ${count?'':'unknown'}`} title={count?`${fish.name}: ${count} pescado(s)`:'Ainda não pescado'}>
      <FishingIcon id={fish.id} size={58} unknown={!count}/><b>{count?fish.name:'???'}</b>
      <small>{count?`×${count} · recorde ${f.best[fish.id]?.toLocaleString('pt-BR',{minimumFractionDigits:2})} kg`:'—'}</small>
      <span className="fishing-stars" aria-label={`Dificuldade ${fish.difficulty}`}>{'★'.repeat(fish.difficulty)}</span>
     </li>;})}</ul></section>)}</div>}
   {fishBuy&&<p className="fishing-shop-done">Troca feita: {FISHING_SHOP.find(o=>o.id===fishBuy.offer)?.name}{fishBuy.quantity>1?` ×${fishBuy.quantity}`:''}.</p>}
  </div>
 </Modal>;
}
