import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {Lock} from 'lucide-react';
import {client,useGame} from '../client';
import type {FishShopTab} from '../client';
import {audio} from '../game/audio';
import {FISH,FISHING_WEAPON,FISH_BAG_MAX,FISH_BY_ID,FISH_RARITIES,FISHING_SHOP,ROD_BY_ID,fishRarity,MAX_FISHING_BUY,fishingLevelProgress,normalizeFishing} from '../../shared/fishing';
import type {BagFish,FishRarity,FishingOffer} from '../../shared/fishing';
import {Modal} from './Modal';
import {FishingIcon} from './FishingIcon';
import {RewardIcon} from './RewardIcon';
import {useRodTip} from './FishingRodInfo';
import {BagFishCard,kg,useFishTip} from './FishingFish';
import {CATALOG,weaponIconPath} from '../../shared/catalog';
import {WEAPON_FRAGMENT_RECIPES,fragmentId} from '../../shared/synthesis';
import './Fishing.css';
import './FishingHouse.css';

/** Prizes the game already has art for use it (coins, stones, tickets, pet food); rods use the fishing icons. */
function PrizeIcon({offer,size}:{offer:FishingOffer;size:number}){
 const p=offer.prize;
 if(p.kind==='gold')return <RewardIcon kind="coins" size={size}/>;
 if(p.kind==='stone')return <RewardIcon kind="stone" level={p.level} size={size}/>;
 if(p.kind==='ticket')return <RewardIcon kind="ticket" size={size}/>;
 if(p.kind==='pet-food')return <img src={`/assets/pets/${p.food.replace('pet-food-','food-')}.png`} width={size} height={size} alt="" draggable={false} style={{objectFit:'contain'}}/>;
 if(p.kind==='fragment')return <FishingIcon id="fragment" size={size}/>;
 return <FishingIcon id={p.rod} size={size}/>;
}
/** Comprar em grupos (pedido do matheus: "uma linha muito grande com muitos itens, compacte"). */
const GROUPS:{name:string;has:(o:FishingOffer)=>boolean}[]=[
 {name:'Varas',has:o=>o.prize.kind==='rod'},
 {name:'Materiais',has:o=>['stone','fragment','ticket','pet-food'].includes(o.prize.kind)},
 {name:'Ouro',has:o=>o.prize.kind==='gold'},
];
type Sort='value'|'kg'|'new';
const SORTS:{id:Sort;name:string}[]=[{id:'value',name:'Mais valiosos'},{id:'kg',name:'Mais pesados'},{id:'new',name:'Mais recentes'}];
const points=(n:number)=>n.toLocaleString('pt-BR');

/** Casa de Pesca: Comprar with Pontos de Pesca, Vender the fish of the Sacola, and the Coleção of every fish caught. */
export function FishingShop(){
 const {profile,fishShopTab:tab,fishSold}=useGame(),f=normalizeFishing(profile!.fishing),progress=fishingLevelProgress(f.xp),level=progress.level;
 const close=()=>client.closeFishShop();
 const known=Object.keys(f.caught).length;
 // The points counter rolls up after a sale, with the amount floating over it.
 const [gain,setGain]=useState<{points:number;at:number}|null>(null);
 useEffect(()=>{if(!fishSold)return;setGain({points:fishSold.points,at:fishSold.at});audio.cue('boost','general');const t=setTimeout(()=>setGain(null),1600);return()=>clearTimeout(t);},[fishSold?.at]);
 const go=(next:FishShopTab)=>{client.setFishShopTab(next);audio.play('click');};
 return <Modal title="Casa de Pesca" onClose={close} className="fishing-shop-window fishing-house" viewport>
  <div className="fishing-shop">
   <aside className="fishing-counter">
    <TideRodShowcase/>
    <div className="fishing-counter-card">
     <div className="fishing-counter-level"><small>Pescador</small><b>Nível {level}</b></div>
     <div className="fishing-xp"><i style={{width:`${progress.percent}%`}}/><span>{progress.required?`${progress.current} / ${progress.required}`:'MÁXIMO'}</span></div>
     <div className={`fishing-counter-points ${gain?'gain':''}`}><FishingIcon id="fishing-points" size={30}/><div><b>{points(f.points)}</b><small>Pontos de Pesca</small></div>
      {gain&&<em key={gain.at} className="fishing-points-gain">+{points(gain.points)}</em>}</div>
     <dl className="fishing-counter-stats">
      <div><dt>Na Sacola</dt><dd>{f.bag.length} / {FISH_BAG_MAX}</dd></div>
      <div><dt>Peixes pescados</dt><dd>{points(f.total)}</dd></div>
      <div><dt>Coleção</dt><dd>{known} / {FISH.length}</dd></div>
     </dl>
    </div>
   </aside>
   <div className="fishing-shop-main">
    <nav className="fishing-shop-tabs">
     <button className={tab==='buy'?'active':''} onClick={()=>go('buy')}>Comprar</button>
     <button className={tab==='sell'?'active':''} onClick={()=>go('sell')}>Vender {f.bag.length>0&&<small>{f.bag.length}</small>}</button>
     <button className={tab==='collection'?'active':''} onClick={()=>go('collection')}>Coleção <small>{known}/{FISH.length}</small></button>
    </nav>
    <div className="fishing-shop-body">{tab==='buy'?<Buy level={level}/>:tab==='sell'?<Sell/>:<Collection/>}</div>
   </div>
  </div>
 </Modal>;
}

/**
 * The fished weapon in its painted showcase (pedido do matheus, 21/10): fragments against the recipe (0/50)
 * and Resgatar, which is the Ferreiro's Síntese of the same recipe (same gold cost, checked by the server).
 */
function TideRodShowcase(){
 const {profile,synthesisResult,error}=useGame(),p=profile!;
 const recipe=WEAPON_FRAGMENT_RECIPES.find(r=>r.weapon===FISHING_WEAPON)!,weapon=CATALOG[FISHING_WEAPON];
 const have=p.fragments?.[FISHING_WEAPON]??0,ready=have>=recipe.count,rich=p.gold>=recipe.cost;
 const [pending,setPending]=useState(false),[done,setDone]=useState(false),sent=useRef(synthesisResult);
 useEffect(()=>{if(!pending||synthesisResult===sent.current)return;setPending(false);if(synthesisResult?.target===FISHING_WEAPON){setDone(true);audio.cue('boost','general');}},[synthesisResult,pending]);
 useEffect(()=>{if(pending&&error)setPending(false);},[error,pending]);
 useEffect(()=>{if(!done)return;const t=setTimeout(()=>setDone(false),2200);return()=>clearTimeout(t);},[done]);
 const redeem=()=>{if(!ready||!rich||pending)return;sent.current=synthesisResult;setPending(true);client.send({type:'synthesize',stone:fragmentId(FISHING_WEAPON),count:1});audio.play('click');};
 const why=!ready?`Faltam ${recipe.count-have} fragmentos`:!rich?`Precisa de ${points(recipe.cost)} de ouro`:undefined;
 return <section className={`fishing-showcase ${ready?'ready':''} ${done?'done':''}`} aria-label={weapon.name}>
  <div className="fishing-showcase-art">
   <img className="fishing-showcase-weapon" src={weaponIconPath(FISHING_WEAPON)} alt="" draggable={false}/>
   <div className="fishing-showcase-info">
    <b>{weapon.name}</b>
    <div className="fishing-fragments" role="progressbar" aria-valuemin={0} aria-valuemax={recipe.count} aria-valuenow={Math.min(have,recipe.count)} aria-label="Fragmentos">
     <FishingIcon id="fragment" size={26}/>
     <div className="fishing-fragments-bar"><i style={{width:`${Math.min(100,have/recipe.count*100)}%`}}/><span>{points(have)}/{recipe.count}</span></div>
    </div>
   </div>
   {done&&<em className="fishing-showcase-done">Na mochila!</em>}
  </div>
  <p>Colete {recipe.count} fragmentos para sintetizar uma arma exclusiva.</p>
  <button className="fishing-redeem" disabled={!ready||!rich||pending} title={why} onClick={redeem}>{pending?'Resgatando…':'Resgatar'}</button>
  <small className="fishing-redeem-cost">{why??<><RewardIcon kind="coins" size={14}/>{points(recipe.cost)} de ouro</>}</small>
 </section>;
}

function Buy({level}:{level:number}){
 const {profile,fishBuy}=useGame(),f=normalizeFishing(profile!.fishing);
 const [amounts,setAmounts]=useState<Record<string,number>>({}),[asking,setAsking]=useState<string|null>(null);
 const [done,setDone]=useState<string|null>(null);
 useEffect(()=>{if(!fishBuy)return;setAsking(null);setDone(fishBuy.offer);audio.cue('boost','general');const t=setTimeout(()=>setDone(null),1400);return()=>clearTimeout(t);},[fishBuy?.at]);
 const amount=(id:string)=>amounts[id]??1;
 const setAmount=(id:string,n:number)=>setAmounts(a=>({...a,[id]:Math.max(1,Math.min(MAX_FISHING_BUY,Math.floor(n)||1))}));
 const rodTip=useRodTip(f.rods,f.rod,level);
 return <div className="fishing-buy-list">
  {GROUPS.map(g=><section key={g.name}><h4>{g.name}</h4><ul className="fishing-offers">{FISHING_SHOP.filter(g.has).map(offer=>{
   const locked=!!offer.level&&level<offer.level,single=offer.prize.kind==='rod',owned=offer.prize.kind==='rod'&&f.rods.includes(offer.prize.rod);
   const n=single?1:amount(offer.id),cost=offer.cost*n,poor=f.points<cost;
   const rod=offer.prize.kind==='rod'?ROD_BY_ID.get(offer.prize.rod):undefined;
   return <li key={offer.id} className={`fishing-offer ${locked?'locked':''} ${owned?'owned':''} ${asking===offer.id?'asking':''} ${done===offer.id?'done':''}`} title={rod?undefined:offer.description} {...(rod?rodTip.handlers(rod):{})}>
    <span className="fishing-house-card fishing-offer-art"><PrizeIcon offer={offer} size={34}/>{locked&&<span className="fishing-lock"><Lock size={9}/>{offer.level}</span>}</span>
    <div className="fishing-offer-text"><b className="fishing-offer-name">{offer.name}</b>
     <span className="fishing-cost"><FishingIcon id="fishing-points" size={14}/>{points(cost)}</span></div>
    <div className="fishing-offer-foot">
     {locked?<span className="fishing-need">Nv. {offer.level}</span>:owned?<span className="fishing-need ok">Já tem</span>:
      asking===offer.id?<span className="fishing-buy">
       {!single&&<span className="fishing-stepper"><button onClick={()=>setAmount(offer.id,n-1)} disabled={n<=1} aria-label="Menos">−</button><input type="number" min={1} max={MAX_FISHING_BUY} value={n} aria-label="Quantidade" onChange={e=>setAmount(offer.id,Number(e.target.value))}/><button onClick={()=>setAmount(offer.id,n+1)} disabled={n>=MAX_FISHING_BUY} aria-label="Mais">+</button></span>}
       <button className="fishing-house-button" disabled={poor} title={poor?'Pontos de Pesca insuficientes':undefined} onClick={()=>{client.send({type:'fish-buy',offer:offer.id,quantity:n});audio.play('click');}}>OK</button><button className="fishing-house-quiet" onClick={()=>setAsking(null)} aria-label="Cancelar">×</button></span>
      :<button className="fishing-house-button" disabled={f.points<offer.cost} title={f.points<offer.cost?'Pontos de Pesca insuficientes':undefined} onClick={()=>{setAsking(offer.id);audio.play('click');}}>Comprar</button>}
    </div>
    {done===offer.id&&<em className="fishing-offer-done">Comprado!</em>}
   </li>;})}</ul></section>)}
  {rodTip.node}
 </div>;
}

/**
 * Vender (pedido do matheus, 20/10): every fish of the Sacola one by one, each with its weight and value.
 * Click to pick, filter by rarity, sort, select all (records stay out unless clicked), then sell.
 */
function Sell(){
 const {profile,fishSold}=useGame(),f=normalizeFishing(profile!.fishing);
 const [rarity,setRarity]=useState<FishRarity|'all'>('all'),[sort,setSort]=useState<Sort>('value');
 const [picked,setPicked]=useState<Set<string>>(new Set()),[pending,setPending]=useState(false);
 const tip=useFishTip();
 // The heaviest of each kind in the Sacola is its record: kept out of "Selecionar todos".
 const records=useMemo(()=>{const best=new Map<string,BagFish>();for(const b of f.bag){const o=best.get(b.fish);if(!o||b.kg>o.kg)best.set(b.fish,b);}return new Set([...best.values()].filter(b=>b.kg>=(f.best[b.fish]??0)).map(b=>b.id));},[f.bag,f.best]);
 const shown=useMemo(()=>f.bag.filter(b=>rarity==='all'||fishRarity(FISH_BY_ID.get(b.fish)!).id===rarity)
  .sort((a,b)=>sort==='value'?b.value-a.value||b.kg-a.kg:sort==='kg'?b.kg-a.kg:b.at-a.at),[f.bag,rarity,sort]);
 // Fish that left the Sacola (sold) leave the selection; the sale's answer ends the wait.
 useEffect(()=>{setPicked(p=>{const ids=new Set(f.bag.map(b=>b.id)),next=new Set([...p].filter(id=>ids.has(id)));return next.size===p.size?p:next;});},[f.bag]);
 useEffect(()=>{if(fishSold){setPending(false);setPicked(new Set());}},[fishSold?.at]);
 useEffect(()=>{if(!pending)return;const t=setTimeout(()=>setPending(false),5000);return()=>clearTimeout(t);},[pending]);
 const toggle=(id:string)=>{setPicked(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n;});audio.play('click');};
 const all=shown.filter(b=>!records.has(b.id)),allPicked=all.length>0&&all.every(b=>picked.has(b.id));
 const selectAll=()=>{setPicked(p=>{const n=new Set(p);for(const b of all)if(allPicked)n.delete(b.id);else n.add(b.id);return n;});audio.play('click');};
 const chosen=f.bag.filter(b=>picked.has(b.id)),total=chosen.reduce((s,b)=>s+b.value,0);
 const sell=()=>{if(!chosen.length||pending)return;setPending(true);tip.clear();client.send({type:'fish-sell',ids:chosen.map(b=>b.id)});audio.play('click');};
 const count=(id:FishRarity)=>f.bag.filter(b=>fishRarity(FISH_BY_ID.get(b.fish)!).id===id).length;
 if(!f.bag.length)return <div className="fishing-sell empty"><FishingIcon id="lambari-dourado" size={64}/><p>{fishSold?`Vendido! +${points(fishSold.points)} Pontos de Pesca.`:'Nenhum peixe na Sacola.'}</p><small>Pesque no lago e volte aqui para vender. Cada peixe vale pela raridade e pelo peso.</small></div>;
 return <div className="fishing-sell">
  <div className="fishing-sell-tools">
   <div className="fishing-chips" role="group" aria-label="Raridade">
    <button className={rarity==='all'?'on':''} onClick={()=>setRarity('all')}>Todos <small>{f.bag.length}</small></button>
    {FISH_RARITIES.map(r=>{const n=count(r.id);return n?<button key={r.id} className={rarity===r.id?'on':''} style={{'--rarity':r.color} as CSSProperties} onClick={()=>setRarity(r.id)}><i/>{r.name} <small>{n}</small></button>:null;})}
   </div>
   <select value={sort} onChange={e=>setSort(e.target.value as Sort)} aria-label="Ordenar">{SORTS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
  </div>
  <ul className="fishing-sell-grid">{shown.map(b=><li key={b.id}><BagFishCard item={b} record={records.has(b.id)} selected={picked.has(b.id)} onClick={()=>toggle(b.id)} onHover={tip.handlers(b,records.has(b.id))}/></li>)}</ul>
  <footer className="fishing-sell-bar">
   <button className="fishing-house-quiet" onClick={selectAll} disabled={!all.length}>{allPicked?'Desmarcar todos':'Selecionar todos'}</button>
   {picked.size>0&&<button className="fishing-house-quiet" onClick={()=>setPicked(new Set())}>Limpar</button>}
   <span className="fishing-sell-total">{chosen.length?<>{chosen.length} {chosen.length===1?'peixe':'peixes'} · <FishingIcon id="fishing-points" size={16}/><b>{points(total)}</b></>:<em>Clique nos peixes para vender. A coroa marca o recorde de cada espécie.</em>}</span>
   <button className="fishing-house-button fishing-sell-go" disabled={!chosen.length||pending} onClick={sell}>{pending?'Vendendo…':'Vender'}</button>
  </footer>
  {tip.node}
 </div>;
}

function Collection(){
 const {profile}=useGame(),f=normalizeFishing(profile!.fishing);
 return <div className="fishing-collection">{FISH_RARITIES.map(rarity=>{const {id,name}=rarity,list=FISH.filter(fish=>fishRarity(fish).id===id),got=list.filter(fish=>f.caught[fish.id]).length;if(!list.length)return null;
  return <section key={id}><h3>{name}<small>{got}/{list.length}</small></h3><ul>{list.map(fish=>{
   const count=f.caught[fish.id]??0;
   return <li key={fish.id} className={`fishing-entry ${count?'':'unknown'}`} title={count?`${fish.name}: ${count} pescado(s)`:'Ainda não pescado'}>
    <span className="fishing-house-card"><FishingIcon id={fish.id} size={54} unknown={!count}/>{count>0&&<span className="fishing-count">×{count}</span>}</span>
    <b>{count?fish.name:'???'}</b>
    <span className="fishing-stars" aria-label={`Dificuldade ${fish.difficulty}`}>{Array.from({length:5},(_,i)=><i key={i} className={i<fish.difficulty?'on':''}>★</i>)}</span>
    <small>{count?`Recorde ${kg(f.best[fish.id]??0)} kg`:`${kg(fish.minKg)} a ${kg(fish.maxKg)} kg`}</small>
   </li>;})}</ul></section>;})}</div>;
}
