import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,ChevronLeft,ChevronRight,Gavel,Inbox,LoaderCircle,PackageOpen,PackagePlus,Search,Store,Tag,Undo2,X} from 'lucide-react';
import {CATALOG,copyBase,equippedCopy,SLOTS,STONES} from '../../shared/catalog';
import {COMPOSITION_STONES,COMPOSITION_STONE_BY_ID} from '../../shared/composition';
import {AUCTION_CATEGORIES,AUCTION_DURATIONS,AUCTION_MAX_LISTINGS,AUCTION_PRICE_MAX,CURRENCY_NAMES,goodsAmount,goodsName,isListableItem,timeLeft} from '../../shared/auction';
import type {AuctionCurrency,AuctionGoods,AuctionListing,AuctionSource} from '../../shared/auction';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {CompositionIcon} from './CompositionIcon';
import {InventoryTooltip} from './Inventory';
import type {Tip} from './Inventory';
import {ItemCard,ItemCardFrame} from './ItemCard';
import type {ItemRarity} from './ItemCard';
import {ItemIcon} from './ItemIcon';
import {Modal} from './Modal';
import {playerMenuProps} from './PlayerActions';
import {CouponIcon,RewardIcon} from './RewardIcon';
import {UpgradeTag} from './UpgradeTag';
import './Backpack.css';
import './WoodTheme.css';
import './Auction.css';

/* Leilão no padrão da mochila e do correio: madeira laranja, painéis creme e cards de item.
   Comprar: menu de categorias que expande à esquerda e a tabela paginada à direita.
   Vender: os meus anúncios (até 3) e o formulário do anúncio, que escolhe o item numa janela da mochila. */
const money=(value:number)=>value.toLocaleString('pt-BR');
export function CurrencyIcon({currency,size=20}:{currency:AuctionCurrency;size?:number}){return currency==='gold'?<RewardIcon size={size}/>:<CouponIcon size={size}/>;}
const goodsRarity=(goods:AuctionGoods):ItemRarity=>goods.kind==='item'?(CATALOG[goods.item]?.rarity??'common'):'common';
/** Where the hover card reads a listed copy from: its own key, so forge level, compositions and color show. */
const tipKey=(listing:{id:number;goods:AuctionGoods})=>listing.goods.kind==='item'?`${listing.goods.item}~L${listing.id}`:listing.goods.kind==='stone'?`stone-${listing.goods.level}`:'';

function GoodsArt({goods,size=46}:{goods:AuctionGoods;size?:number}){
 if(goods.kind==='item')return <ItemIcon id={goods.item} size={size} upgrade={goods.upgrade??0} color={goods.color}/>;
 if(goods.kind==='stone')return <RewardIcon kind="stone" level={goods.level} size={size-6}/>;
 return <CompositionIcon stat={COMPOSITION_STONE_BY_ID[goods.stone]?.stat??'attack'} size={size-6}/>;
}
function GoodsCard({goods,size=50,...props}:{goods:AuctionGoods;size?:number}&React.HTMLAttributes<HTMLDivElement>){
 const amount=goodsAmount(goods);
 return <ItemCardFrame rarity={goodsRarity(goods)} variant="slot" className="auction-goods-card" style={{width:size,height:size}} {...props}>
  <GoodsArt goods={goods} size={Math.round(size*.86)}/>
  {goods.kind==='item'&&!!goods.upgrade&&<UpgradeTag level={goods.upgrade} size={28} className="bag-upgrade-tag"/>}
  {amount>1&&<b className="auction-goods-count">{money(amount)}</b>}
 </ItemCardFrame>;
}

export function Auction(){
 const state=useGame(),p=state.profile!,{auctionPage:page,auctionMine:mine,auctionPending:pending,auctionResult:result}=state;
 const [tab,setTab]=useState<'buy'|'sell'>('buy');
 const [category,setCategory]=useState<string|null>(null),[open,setOpen]=useState<Set<string>>(()=>new Set()),[search,setSearch]=useState(''),[pageNumber,setPageNumber]=useState(1);
 const [buying,setBuying]=useState<AuctionListing|null>(null),[bell,setBell]=useState(false),[tip,setTip]=useState<Tip|null>(null),[now,setNow]=useState(()=>Date.now());
 const [feedback,setFeedback]=useState('');const sent=useRef<string|null>(null);
 const locked=pending||state.status!=='online'||!!state.battle;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),20_000);return()=>clearInterval(t);},[]);
 const query=(next:{category?:string|null;page?:number;search?:string})=>{
  const c=next.category===undefined?category:next.category,n=next.page??1,s=next.search??search;
  setCategory(c);setPageNumber(n);setTip(null);client.auctionList({page:n,...(c?{category:c}:{}),...(s.trim()?{search:s}:{})});
 };
 // A finished sale, purchase or withdrawal closes its dialog and says so under the table.
 useEffect(()=>{
  if(!result||!sent.current)return;sent.current=null;setBuying(null);audio.play('click');
  const name=goodsName(result.listing.goods);
  setFeedback(result.action==='buy'?`${name} foi para a sua mochila!`:result.action==='sell'?`${name} está no leilão.`:`Anúncio retirado: ${name} chega pelo correio.`);
 },[result]);
 useEffect(()=>{if(sent.current&&state.error){sent.current=null;setFeedback(state.error);}},[state.error]);
 useEffect(()=>{if(!feedback)return;const t=setTimeout(()=>setFeedback(''),6000);return()=>clearTimeout(t);},[feedback]);
 useEffect(()=>{
  if(!tip)return;const outside=(event:Event)=>{if(!tip.anchor.contains(event.target as Node))setTip(null);};
  window.addEventListener('pointerdown',outside,true);window.addEventListener('scroll',()=>setTip(null),true);return()=>window.removeEventListener('pointerdown',outside,true);
 },[tip]);
 const toggleGroup=(id:string)=>{setOpen(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});query({category:id});audio.play('click');};
 const showTip=(listing:{id:number;goods:AuctionGoods})=>(event:React.SyntheticEvent<HTMLElement>)=>{const key=tipKey(listing);if(key)setTip({id:key,anchor:event.currentTarget,mode:event.type==='focus'?'focus':'hover'});};
 const tipListing=[...(page?.listings??[]),...mine.listings].find(l=>tipKey(l)===tip?.id);
 const tipGoods=tipListing?.goods.kind==='item'?tipListing.goods:null,key=tip?.id??'';
 const buy=()=>{if(!buying||locked)return;sent.current='buy';setFeedback('');client.auctionBuy(buying.id,buying.currency,buying.price);};
 const balance=(currency:AuctionCurrency)=>currency==='gold'?p.gold:p.coupons;

 return <Modal title="Leilão" onClose={()=>client.closeAuction()} className="bag-window auction-window" viewport>
  <div className="auction-top">
   <nav className="auction-tabs" aria-label="Leilão">
    <button className={tab==='buy'?'active':''} aria-pressed={tab==='buy'} onClick={()=>{setTab('buy');setFeedback('');audio.play('click');}}><Store size={17}/>Comprar</button>
    <button className={tab==='sell'?'active':''} aria-pressed={tab==='sell'} onClick={()=>{setTab('sell');setFeedback('');setTip(null);audio.play('click');}}><Tag size={17}/>Vender</button>
   </nav>
   <div className="auction-wallet">
    <span className="wood-pill" title="Ouro (Moedas Brasa)"><RewardIcon size={20}/><b>{money(p.gold)}</b></span>
    <span className="wood-pill" title="Cupons"><CouponIcon size={24}/><b>{money(p.coupons)}</b></span>
    <div className="auction-bell-wrap">
     <button className={`auction-bell ${mine.unseen?'ringing':''}`} aria-label={`Notificações do leilão${mine.unseen?`: ${mine.unseen} novas`:''}`} aria-expanded={bell} onClick={()=>{setBell(!bell);if(!bell)client.auctionSeen();audio.play('click');}}>
      <img src="/assets/ui/auction-bell.png" alt="" draggable={false}/>{mine.unseen>0&&<b>{mine.unseen}</b>}
     </button>
     {bell&&<section className="auction-notices" role="dialog" aria-label="Notificações do leilão">
      <header><strong>Notificações</strong><button aria-label="Fechar notificações" onClick={()=>setBell(false)}><X size={15}/></button></header>
      {mine.notices.length?<ul>{mine.notices.map(n=><li key={n.id} className={n.seen?'':'new'}>
       <GoodsCard goods={n.goods} size={40}/>
       <div><b>{n.kind==='sold'?'Vendido!':'Não vendido'}</b><span>{goodsName(n.goods)}{goodsAmount(n.goods)>1?` ×${goodsAmount(n.goods)}`:''}</span>
        <small>{n.kind==='sold'?<>Para {n.buyerName} por <CurrencyIcon currency={n.currency} size={14}/> {money(n.price)}</>:'O item voltou pelo correio.'}</small></div>
      </li>)}</ul>:<p>Quando um item seu for vendido, o aviso aparece aqui.</p>}
      <footer><button className="wood-quiet" onClick={()=>{client.closeAuction();client.openMail();}}><Inbox size={15}/>Abrir correio</button></footer>
     </section>}
    </div>
   </div>
  </div>

  {tab==='buy'?<div className="auction-buy">
   <nav className="auction-menu wood-cream" aria-label="Categorias">
    <button className={`auction-menu-all ${category===null?'active':''}`} onClick={()=>{query({category:null});audio.play('click');}}>Todos os itens</button>
    {AUCTION_CATEGORIES.map(group=><div key={group.id} className={`auction-menu-group ${open.has(group.id)?'open':''}`}>
     <button className={category===group.id?'active':''} aria-expanded={open.has(group.id)} onClick={()=>toggleGroup(group.id)}><ChevronDown size={15} className="auction-chevron"/>{group.name}</button>
     {open.has(group.id)&&<div className="auction-menu-leaves">{group.children.map(child=><button key={child.id} className={category===child.id?'active':''} onClick={()=>{query({category:child.id});audio.play('click');}}>{child.name}</button>)}</div>}
    </div>)}
   </nav>
   <section className="auction-board">
    <form className="auction-search" onSubmit={e=>{e.preventDefault();query({search});}}>
     <label><Search size={15}/><input value={search} maxLength={24} onChange={e=>setSearch(e.target.value)} placeholder="Buscar item…" aria-label="Buscar item no leilão"/></label>
     <button className="wood-quiet">Buscar</button>
     <span className="auction-count">{page?`${money(page.total)} ${page.total===1?'anúncio':'anúncios'}`:''}</span>
    </form>
    <div className="auction-table-wrap wood-cream">
     <table className="auction-table">
      <thead><tr><th>Item</th><th>Vendedor</th><th>Tempo</th><th>Preço</th><th aria-label="Comprar"/></tr></thead>
      <tbody>{page?.listings.map(l=>{const own=l.sellerId===p.id,short=balance(l.currency)<l.price;return <tr key={l.id} data-listing={l.id}>
        <td><div className="auction-item" tabIndex={0} onMouseEnter={showTip(l)} onMouseLeave={()=>setTip(null)} onFocus={showTip(l)} onBlur={()=>setTip(null)}><GoodsCard goods={l.goods} size={46}/><span><b>{goodsName(l.goods)}</b>{goodsAmount(l.goods)>1&&<small>Quantidade: {money(goodsAmount(l.goods))}</small>}</span></div></td>
        <td><span className="auction-seller" title="Botão direito: informações e mensagem" {...playerMenuProps(own?null:{id:l.sellerId,name:l.sellerName,context:'auction'})}>{l.sellerName}</span></td>
        <td className="auction-time">{timeLeft(l.expiresAt,now)}</td>
        <td><span className={`auction-price ${l.currency}`}><CurrencyIcon currency={l.currency}/>{money(l.price)}</span></td>
        <td>{own?<span className="auction-own">Seu</span>:<button className="wood-button auction-buy-button" disabled={locked||short} title={short?`${CURRENCY_NAMES[l.currency]} insuficientes`:'Comprar'} onClick={()=>{setBuying(l);audio.play('click');}}><Gavel size={15}/>Comprar</button>}</td>
       </tr>;})}</tbody>
     </table>
     {!page?<p className="auction-empty"><LoaderCircle className="button-spinner" size={24}/>Abrindo o leilão…</p>
      :!page.listings.length&&<p className="auction-empty"><PackageOpen size={30}/>Nenhum item à venda {category?'nesta categoria':'agora'}.</p>}
    </div>
    <footer className="auction-pager">
     <span className="auction-feedback" role="status">{feedback}</span>
     <div><button aria-label="Página anterior" disabled={!page||page.page<=1} onClick={()=>query({page:pageNumber-1})}><ChevronLeft size={16}/></button><span>{page?.page??1} / {page?.pages??1}</span><button aria-label="Próxima página" disabled={!page||page.page>=page.pages} onClick={()=>query({page:pageNumber+1})}><ChevronRight size={16}/></button></div>
    </footer>
   </section>
  </div>:<SellTab feedback={feedback} setFeedback={setFeedback} sent={sent} locked={locked} now={now} showTip={showTip} hideTip={()=>setTip(null)}/>}

  {buying&&<div className="auction-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget&&!pending)setBuying(null);}}>
   <div className="auction-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar compra">
    <header><strong>Confirmar compra</strong><button className="wood-close" aria-label="Cancelar" disabled={pending} onClick={()=>setBuying(null)}><X size={18}/></button></header>
    <div className="auction-confirm-body"><GoodsCard goods={buying.goods} size={76}/><div><b>{goodsName(buying.goods)}{goodsAmount(buying.goods)>1?` ×${goodsAmount(buying.goods)}`:''}</b><small>Vendido por {buying.sellerName}</small></div></div>
    <dl><div><dt>Preço</dt><dd><CurrencyIcon currency={buying.currency}/>{money(buying.price)}</dd></div><div><dt>Seu saldo</dt><dd><CurrencyIcon currency={buying.currency}/>{money(balance(buying.currency))}</dd></div><div className="after"><dt>Depois da compra</dt><dd><CurrencyIcon currency={buying.currency}/>{money(balance(buying.currency)-buying.price)}</dd></div></dl>
    <footer><button className="wood-quiet" disabled={pending} onClick={()=>setBuying(null)}>Cancelar</button><button className="wood-button" disabled={locked||balance(buying.currency)<buying.price} onClick={buy}>{pending?<LoaderCircle size={17} className="button-spinner"/>:<Gavel size={17}/>}{pending?'Comprando…':'Comprar'}</button></footer>
   </div>
  </div>}
  {tip&&tip.id&&createPortal(<InventoryTooltip tip={tip} gender={p.gender} equipment={p.equipment} hideGender upgrades={tipGoods?{[key]:tipGoods.upgrade??0}:{}} compositions={tipGoods?.compositions?{[key]:tipGoods.compositions}:{}} colors={tipGoods?.color?{[key]:tipGoods.color}:{}}/>,document.body)}
 </Modal>;
}

type Sellable={key:string;source:AuctionSource;goods:AuctionGoods;owned:number};

function SellTab({feedback,setFeedback,sent,locked,now,showTip,hideTip}:{feedback:string;setFeedback:(text:string)=>void;sent:React.RefObject<string|null>;locked:boolean;now:number;showTip:(listing:{id:number;goods:AuctionGoods})=>(event:React.SyntheticEvent<HTMLElement>)=>void;hideTip:()=>void}){
 const {profile,auctionMine:mine,auctionPending:pending}=useGame(),p=profile!;
 // What can go to the auction: unworn items of the listed types, and stones (by quantity).
 const sellables=useMemo<Sellable[]>(()=>{
  const worn=new Set(SLOTS.map(slot=>equippedCopy(p.equipment,slot)));
  const items=p.inventory.filter(key=>!worn.has(key)&&isListableItem(copyBase(key))).map(key=>({key,source:{kind:'item',key} as AuctionSource,owned:1,
   goods:{kind:'item',item:copyBase(key),upgrade:p.upgrades[key]||undefined,compositions:p.compositions[key],color:p.itemColors[key]} as AuctionGoods}));
  const stones=STONES.filter(s=>(p.stones[String(s.level)]??0)>0).map(s=>({key:`stone-${s.level}`,source:{kind:'stone',level:s.level,amount:1} as AuctionSource,owned:p.stones[String(s.level)],goods:{kind:'stone',level:s.level,amount:p.stones[String(s.level)]} as AuctionGoods}));
  const compositions=COMPOSITION_STONES.filter(s=>(p.compositionStones[s.id]??0)>0).map(s=>({key:`composition-${s.id}`,source:{kind:'composition',stone:s.id,amount:1} as AuctionSource,owned:p.compositionStones[s.id],goods:{kind:'composition',stone:s.id,amount:p.compositionStones[s.id]} as AuctionGoods}));
  return [...items,...stones,...compositions];
 },[p]);
 const [selected,setSelected]=useState<string|null>(null),[amount,setAmount]=useState(1),[currency,setCurrency]=useState<AuctionCurrency>('gold'),[price,setPrice]=useState(''),[hours,setHours]=useState<2|8|24>(8);
 const choice=sellables.find(s=>s.key===selected)??null;
 useEffect(()=>{if(selected&&!choice)setSelected(null);},[selected,choice]);
 const fee=AUCTION_DURATIONS.find(d=>d.hours===hours)!.fee,value=Math.floor(Number(price)),full=mine.listings.length>=AUCTION_MAX_LISTINGS;
 const count=choice&&choice.source.kind!=='item'?Math.max(1,Math.min(choice.owned,amount)):1;
 const ready=!!choice&&value>=1&&value<=AUCTION_PRICE_MAX&&!full&&p.gold>=fee&&!locked;
 const submit=(event:React.FormEvent)=>{
  event.preventDefault();if(!ready||!choice)return;
  const source:AuctionSource=choice.source.kind==='item'?choice.source:{...choice.source,amount:count};
  sent.current='sell';setFeedback('');client.auctionSell(source,currency,value,hours);setSelected(null);setPrice('');setAmount(1);
 };
 const preview:AuctionGoods|null=choice?(choice.goods.kind==='item'?choice.goods:{...choice.goods,amount:count}):null;
 const [picking,setPicking]=useState(false);
 return <div className="auction-sell">
  <section className="auction-mine wood-cream" aria-label="Meus anúncios">
   <h3>Meus anúncios <small>{mine.listings.length} / {AUCTION_MAX_LISTINGS}</small></h3>
   {mine.listings.length?<ul>{mine.listings.map(l=><li key={l.id}>
    <div className="auction-item" tabIndex={0} onMouseEnter={showTip(l)} onMouseLeave={hideTip} onFocus={showTip(l)} onBlur={hideTip}><GoodsCard goods={l.goods} size={52}/><span><b>{goodsName(l.goods)}</b>{goodsAmount(l.goods)>1&&<small>Quantidade: {money(goodsAmount(l.goods))}</small>}</span></div>
    <span className="auction-time">{timeLeft(l.expiresAt,now)}</span>
    <span className={`auction-price ${l.currency}`}><CurrencyIcon currency={l.currency} size={18}/>{money(l.price)}</span>
    <button className="wood-quiet" disabled={locked} title="Retirar do leilão (o item volta pelo correio)" onClick={()=>{sent.current='cancel';setFeedback('');client.auctionCancel(l.id);audio.play('click');}}><Undo2 size={15}/>Retirar</button>
   </li>)}</ul>:<p className="auction-empty"><Tag size={30}/>Você não tem itens no leilão.</p>}
   <span className="auction-feedback" role="status">{feedback}</span>
  </section>
  <form className="auction-form wood-cream" onSubmit={submit}>
   <h3>Novo anúncio</h3>
   <div className="auction-form-item">{preview?<><GoodsCard goods={preview} size={64}/><div><b>{goodsName(preview)}</b><small>{choice!.goods.kind==='item'?'1 unidade':`Você tem ${money(choice!.owned)}`}</small></div><button type="button" className="wood-quiet auction-pick-again" onClick={()=>{setPicking(true);audio.play('click');}}>Trocar</button></>
    :<button type="button" className="wood-button auction-pick" onClick={()=>{setPicking(true);audio.play('click');}}><PackagePlus size={18}/>Selecionar item</button>}</div>
   {choice&&choice.source.kind!=='item'&&<label className="auction-field"><span>Quantidade</span><input type="number" min={1} max={choice.owned} value={count} onChange={e=>setAmount(Math.floor(Number(e.target.value))||1)}/></label>}
   <div className="auction-field"><span>Vender por</span><div className="auction-toggle">{(['gold','coupons'] as const).map(c=><button type="button" key={c} className={currency===c?'active':''} aria-pressed={currency===c} onClick={()=>setCurrency(c)}><CurrencyIcon currency={c} size={18}/>{CURRENCY_NAMES[c]}</button>)}</div></div>
   <label className="auction-field"><span>Preço</span><span className="auction-price-input"><CurrencyIcon currency={currency} size={20}/><input inputMode="numeric" value={price} placeholder="0" onChange={e=>setPrice(e.target.value.replace(/\D/g,'').slice(0,7))} aria-label="Preço"/></span></label>
   <div className="auction-field"><span>Tempo no leilão</span><div className="auction-toggle">{AUCTION_DURATIONS.map(d=><button type="button" key={d.hours} className={hours===d.hours?'active':''} aria-pressed={hours===d.hours} onClick={()=>setHours(d.hours)}>{d.hours}h</button>)}</div></div>
   <p className="auction-fee">Taxa do anúncio: <RewardIcon size={16}/><b>{fee}</b> de ouro{p.gold<fee&&<em> · ouro insuficiente</em>}</p>
   <button className="wood-button auction-submit" disabled={!ready}>{pending?<LoaderCircle size={17} className="button-spinner"/>:<Gavel size={17}/>}{full?`Limite de ${AUCTION_MAX_LISTINGS} anúncios`:'Anunciar'}</button>
   <p className="auction-hint">Se ninguém comprar até o fim do tempo, o item volta pelo correio. O pagamento de uma venda também chega pelo correio.</p>
  </form>
  {picking&&<div className="auction-confirm-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setPicking(false);}}>
   <section className="auction-confirm auction-picker" role="dialog" aria-modal="true" aria-label="Selecionar item">
    <header><strong>Selecionar item</strong><button type="button" className="wood-close" aria-label="Fechar" onClick={()=>setPicking(false)}><X size={18}/></button></header>
    {sellables.length?<div className="auction-bag-grid">{sellables.map(s=><ItemCard key={s.key} rarity={goodsRarity(s.goods)} selected={selected===s.key} className="auction-bag-cell" aria-label={goodsName(s.goods)} aria-pressed={selected===s.key} title={goodsName(s.goods)} onClick={()=>{setSelected(s.key);setAmount(1);setPicking(false);audio.play('click');}}>
     <GoodsArt goods={s.goods} size={48}/>{s.goods.kind==='item'&&!!s.goods.upgrade&&<UpgradeTag level={s.goods.upgrade} size={26} className="bag-upgrade-tag"/>}{s.owned>1&&<b className="auction-goods-count">{money(s.owned)}</b>}
    </ItemCard>)}</div>:<p className="auction-empty">Nada para vender. Itens equipados não vão para o leilão.</p>}
   </section>
  </div>}
 </div>;
}
